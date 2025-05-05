/**
 * Collection Service for Saphira
 * Provides functions for data collection and knowledge book management
 */
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { v4: uuidv4 } = require('uuid');

/**
 * Create a collection service with the given options
 * @param {Object} options - Configuration options
 * @returns {Object} - Collection service functions
 */
class CollectionService {
  /**
   * Constructor for CollectionService
   * 
   * @param {Object} options - Service configuration
   * @param {Object} options.logger - Logger instance
   * @param {string} options.dataDir - Directory for storing data files
   * @param {Function} options.loadApiKeys - Function to load API keys
   * @param {string} options.rootDir - Application root directory
   */
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.dataDir = options.dataDir || path.join(process.cwd(), 'user', 'data');
    this.loadApiKeys = options.loadApiKeys;
    this.rootDir = options.rootDir || process.cwd();
    this.knowledgeBooksFile = options.knowledgeBooksFile || path.join(this.dataDir, 'knowledge-books.json');
    
    // Collection state
    this.state = {
      running: false,
      progress: 0,
      currentSource: '',
      itemsCollected: 0,
      startTime: null,
      processingLevel: 'basic',
      sources: [],
      keywords: [],
      maxResults: 10,
      results: []
    };
    
    // Collection history
    this.collectionHistory = [];
  }
  
  /**
   * Get current collection state
   * @returns {Object} The current collection state
   */
  getState() {
    return { ...this.state };
  }
  
  /**
   * Get collection history
   * @returns {Array} The collection history
   */
  getCollectionHistory() {
    return [...this.collectionHistory];
  }
  
  /**
   * Set collection state
   * @param {Object} newState - Partial state to update
   */
  setState(newState) {
    this.state = { ...this.state, ...newState };
    return this.state;
  }
  
  /**
   * Collection process for real data from adapters
   * @param {Object} config - Collection configuration
   * @returns {Promise<Array>} Collected results
   */
  async collectData(config) {
    // Reset collection state
    this.setState({
      running: true,
      progress: 0,
      currentSource: 'Initializing...',
      itemsCollected: 0,
      startTime: new Date().toISOString(),
      processingLevel: config.processingLevel,
      sources: config.sources,
      keywords: config.keywords,
      maxResults: config.maxResults,
      results: []
    });
    
    this.logger.info(`Starting collection with level: ${config.processingLevel}`);
    this.logger.info(`Sources: ${config.sources.join(', ')}`);
    this.logger.debug('Collection config', config);
    
    // Create a collection ID for this run
    const collectionId = uuidv4();
    const collectionDate = new Date().toISOString();
    
    // Load API keys
    let apiKeys = {};
    try {
      if (this.loadApiKeys && typeof this.loadApiKeys === 'function') {
        apiKeys = await this.loadApiKeys();
        this.logger.info('Successfully loaded API keys for collection');
      } else {
        this.logger.warn('API key loading function not provided');
      }
    } catch (error) {
      this.logger.error('Failed to load API keys', error);
      apiKeys = {}; // Default empty object
    }

    // Process each source
    for (let i = 0; i < config.sources.length; i++) {
      const source = config.sources[i];
      this.setState({
        currentSource: source,
        progress: Math.floor((i / config.sources.length) * 100)
      });
      
      this.logger.info(`Collecting from source: ${source}`);
      
      try {
        // Try to use the actual adapter to collect data
        let adapterPath = '';
        try {
          // First try with uppercase first letter
          const capitalizedSource = source.charAt(0).toUpperCase() + source.slice(1);
          adapterPath = path.join(this.rootDir, 'src', 'core', 'sourceAdapters', `${capitalizedSource}Adapter.js`);
          
          if (!fsSync.existsSync(adapterPath)) {
            // If not found, try with lowercase
            adapterPath = path.join(this.rootDir, 'src', 'core', 'sourceAdapters', `${source.toLowerCase()}Adapter.js`);
          }
          
          if (!fsSync.existsSync(adapterPath)) {
            // Special case for duckDuckGo (camelCase)
            if (source.toLowerCase() === 'duckduckgo') {
              adapterPath = path.join(this.rootDir, 'src', 'core', 'sourceAdapters', `duckDuckGoAdapter.js`);
            } else {
              // Try other name format
              adapterPath = path.join(this.rootDir, 'src', 'core', 'sourceAdapters', `${source}Adapter.js`);
            }
          }
          
          this.logger.debug(`Looking for adapter at: ${adapterPath}`);
          const AdapterClass = require(adapterPath);
          
          // Initialize adapter - check for class or direct export
          let sourceAdapter;
          if (typeof AdapterClass === 'function') {
            // For class-based adapters
            sourceAdapter = new AdapterClass({
              logger: this.logger,
              maxResults: config.maxResults,
              // Additional options for specific adapters
              ...(source.toLowerCase() === 'wikipedia' ? { language: 'en' } : {}),
              ...(source.toLowerCase() === 'arxiv' ? { sortBy: 'relevance' } : {}),
              ...(source.toLowerCase() === 'duckduckgo' ? { 
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                timeout: 15000
              } : {}),
              // Configure API keys for appropriate adapters
              ...(source.toLowerCase() === 'newsapi' ? { 
                apiKey: apiKeys.newsApiKey
              } : {}),
              ...(source.toLowerCase() === 'github' ? { 
                apiKey: apiKeys.githubApiKey
              } : {}),
            });
          } else {
            sourceAdapter = AdapterClass;
          }
          
          // Check for available methods (fetchContent or collectData)
          if (sourceAdapter) {
            // Check if API key is configured for adapters that require it
            if (source.toLowerCase() === 'newsapi' && !apiKeys.newsApiKey) {
              this.logger.warn(`NewsAPI requires an API key, but none was provided. Please set one in the API Keys settings.`);
              throw new Error('NewsAPI requires an API key. Please add it in the API Keys settings page.');
            }
            
            let adapterResults = [];
            
            // Make sure we always have at least one keyword for adapters that require it
            const keywordsToUse = config.keywords.length > 0 ? 
                                 config.keywords.filter(k => k && k.trim()) : 
                                 ['general'];
            
            // Try fetchContent method first (used in most adapters)
            if (typeof sourceAdapter.fetchContent === 'function') {
              this.logger.info(`Using fetchContent method for ${source} adapter with keywords: ${keywordsToUse.join(', ')}`);
              adapterResults = await sourceAdapter.fetchContent(keywordsToUse);
            } 
            // Fall back to collectData if fetchContent doesn't exist
            else if (typeof sourceAdapter.collectData === 'function') {
              this.logger.info(`Using collectData method for ${source} adapter with keywords: ${keywordsToUse.join(', ')}`);
              adapterResults = await sourceAdapter.collectData(keywordsToUse);
            }
            
            if (Array.isArray(adapterResults) && adapterResults.length > 0) {
              this.logger.info(`Successfully collected ${adapterResults.length} items from ${source} adapter`);
              
              // Process the results to ensure they have all required fields
              const processedResults = adapterResults.map(item => {
                return {
                  id: item.id || uuidv4(),
                  title: item.title || `Information from ${source}`,
                  summary: item.summary || (item.content ? item.content.substring(0, 200) + '...' : 'No summary available'),
                  content: item.content || item.summary || 'No content available',
                  tags: item.tags || [...keywordsToUse, source],
                  createdAt: item.createdAt || item.date || new Date().toISOString(),
                  date: item.date || item.createdAt || new Date().toISOString(),
                  sourceName: item.sourceName || item.source || source,
                  source: item.source || item.sourceName || source,
                  sourceUrl: item.sourceUrl || item.url || '',
                  url: item.url || item.sourceUrl || '',
                  collectionId: collectionId // Add collection ID to track which collection this item belongs to
                };
              });
              
              // Update collection state
              const updatedResults = [...this.state.results, ...processedResults];
              this.setState({
                results: updatedResults,
                itemsCollected: updatedResults.length
              });
              continue;
            } else {
              // Special handling for DuckDuckGo adapter
              if (source.toLowerCase() === 'duckduckgo') {
                this.logger.warn(`DuckDuckGo adapter returned no results. Retrying with fallback approach...`);
                
                await this.handleDuckDuckGoFallback(source, config.keywords, config.maxResults, collectionId);
              } else {
                // No results from adapter - add error message
                this.logger.warn(`Adapter for ${source} returned no results`);
                const errorItem = this.createErrorItem(
                  source,
                  config.keywords,
                  `No results found from ${source} for the specified keywords.`,
                  collectionId
                );
                
                const updatedResults = [...this.state.results, errorItem];
                this.setState({
                  results: updatedResults,
                  itemsCollected: updatedResults.length
                });
              }
            }
          }
        } catch (error) {
          // Adapter error - add error message
          this.logger.warn(`Error using adapter for ${source}: ${error.message}`);
          const errorItem = this.createErrorItem(
            source,
            config.keywords,
            `Error using ${source} adapter: ${error.message}`,
            collectionId
          );
          
          const updatedResults = [...this.state.results, errorItem];
          this.setState({
            results: updatedResults,
            itemsCollected: updatedResults.length
          });
        }
      } catch (error) {
        this.logger.error(`Error collecting from source ${source}:`, error);
      }
    }
    
    // Save collection results if saveToKnowledgeBooks is true
    if (config.saveToKnowledgeBooks) {
      await this.saveCollectionResults(collectionId);
    }
    
    // Complete collection
    this.setState({
      running: false,
      progress: 100,
      currentSource: 'Completed'
    });
    
    return this.state.results;
  }
  
  /**
   * Special handler for DuckDuckGo fallback methods
   * @private
   */
  async handleDuckDuckGoFallback(source, keywords, maxResults, collectionId) {
    try {
      // Manually use the adapter for better debugging
      const DuckDuckGoAdapter = require(path.join(this.rootDir, 'src', 'core', 'sourceAdapters', `duckDuckGoAdapter.js`));
      
      // Create new instance with more explicit options
      const duckAdapter = new DuckDuckGoAdapter({
        logger: this.logger,
        maxResults: maxResults,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
        timeout: 30000 // Increased timeout
      });
      
      // Try collectData method directly with logging
      const keywordsToUse = keywords.length > 0 ? 
        keywords.filter(k => k && k.trim()) : 
        ['artificial intelligence']; // Default keyword if none provided
      
      this.logger.info(`Explicitly calling DuckDuckGo adapter with keywords: ${keywordsToUse.join(', ')}`);
      const duckResults = await duckAdapter.collectData(keywordsToUse);
      
      if (Array.isArray(duckResults) && duckResults.length > 0) {
        this.logger.info(`Successfully collected ${duckResults.length} items from DuckDuckGo adapter after retry`);
        
        // Process the results
        const processedResults = duckResults.map(item => {
          return {
            id: item.id || uuidv4(),
            title: item.title || `Search results from DuckDuckGo`,
            summary: item.summary || (item.content ? item.content.substring(0, 200) + '...' : 'No summary available'),
            content: item.content || item.summary || 'No content available',
            tags: item.tags || [...keywordsToUse, 'duckduckgo'],
            createdAt: item.createdAt || item.date || new Date().toISOString(),
            date: item.date || item.createdAt || new Date().toISOString(),
            sourceName: item.sourceName || 'DuckDuckGo',
            source: item.source || 'duckduckgo',
            sourceUrl: item.sourceUrl || item.url || `https://duckduckgo.com/?q=${encodeURIComponent(keywordsToUse.join(' '))}`,
            url: item.url || item.sourceUrl || `https://duckduckgo.com/?q=${encodeURIComponent(keywordsToUse.join(' '))}`,
            collectionId: collectionId
          };
        });
        
        const updatedResults = [...this.state.results, ...processedResults];
        this.setState({
          results: updatedResults,
          itemsCollected: updatedResults.length
        });
        return;
      } 
      
      // DuckDuckGo retry failed - get search results directly without content fetching
      this.logger.warn(`DuckDuckGo adapter content fetch failed, trying to get just search results`);
      
      try {
        // Get only search results without content fetching
        const query = keywordsToUse.join(' ');
        const searchResults = await duckAdapter.performSearch(query);
        
        if (Array.isArray(searchResults) && searchResults.length > 0) {
          this.logger.info(`Got ${searchResults.length} raw search results from DuckDuckGo`);
          
          // Process top results to create list of links
          const topResults = searchResults.slice(0, 5); // Limit to top 5 results
          const linksContent = topResults.map((result, index) => 
            `${index+1}. [${result.title}](${result.url})\n   ${result.snippet || ''}`
          ).join('\n\n');
          
          // Create a single item with all the search results as links
          const searchItem = {
            id: uuidv4(),
            title: `DuckDuckGo search results for: ${query}`,
            summary: `Found ${searchResults.length} results for "${query}". Here are the top ${topResults.length} matches:`,
            content: `# Search results for "${query}"\n\n${linksContent}\n\nThese links were found using DuckDuckGo search. Click on any link to view the actual page.`,
            tags: [...keywordsToUse, 'duckduckgo', 'search-results'],
            createdAt: new Date().toISOString(),
            date: new Date().toISOString(),
            sourceName: 'DuckDuckGo Search',
            source: 'duckduckgo',
            // Use the first result URL if available, otherwise generic search link
            sourceUrl: topResults.length > 0 ? topResults[0].url : `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
            url: topResults.length > 0 ? topResults[0].url : `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
            searchResults: topResults, // Store all results for reference
            collectionId: collectionId
          };
          
          const updatedResults = [...this.state.results, searchItem];
          this.setState({
            results: updatedResults,
            itemsCollected: updatedResults.length
          });
        } else {
          // No search results at all - add error message
          const errorItem = this.createErrorItem(
            source,
            keywordsToUse,
            "DuckDuckGo search API returned no results. DuckDuckGo may be restricting automated queries.",
            collectionId
          );
          
          const updatedResults = [...this.state.results, errorItem];
          this.setState({
            results: updatedResults,
            itemsCollected: updatedResults.length
          });
        }
      } catch (searchError) {
        this.logger.error(`Error getting raw search results from DuckDuckGo:`, searchError);
        const errorItem = this.createErrorItem(
          source,
          keywordsToUse,
          `Error during DuckDuckGo search: ${searchError.message}`,
          collectionId
        );
        
        const updatedResults = [...this.state.results, errorItem];
        this.setState({
          results: updatedResults,
          itemsCollected: updatedResults.length
        });
      }
    } catch (duckError) {
      // DuckDuckGo adapter error - add error message
      this.logger.error(`Error during DuckDuckGo adapter retry:`, duckError);
      const errorItem = this.createErrorItem(
        source,
        keywords,
        `Error connecting to DuckDuckGo: ${duckError.message}`,
        collectionId
      );
      
      const updatedResults = [...this.state.results, errorItem];
      this.setState({
        results: updatedResults,
        itemsCollected: updatedResults.length
      });
    }
  }

  /**
   * Create error item helper function
   * @private
   */
  createErrorItem(source, keywords, errorMessage, collectionId) {
    const timestamp = new Date();
    const keywordsStr = Array.isArray(keywords) ? keywords.join(', ') : keywords;
    
    return {
      id: uuidv4(),
      title: `Error retrieving data from ${source}`,
      summary: `Could not retrieve information from ${source} for keywords: ${keywordsStr}`,
      content: `${errorMessage}\n\nTried to collect data at: ${timestamp.toISOString()}\nKeywords: ${keywordsStr}\n\nTo troubleshoot this issue:\n- Check your network connection\n- Verify API credentials if applicable\n- Try different keywords\n- Try again later`,
      tags: ['error', source, ...(Array.isArray(keywords) ? keywords : [keywords])],
      createdAt: timestamp.toISOString(),
      date: timestamp.toISOString(),
      sourceName: source,
      sourceUrl: '',
      source: source,
      url: '',
      isError: true,
      collectionId: collectionId
    };
  }
  
  /**
   * Save collection results to knowledge books
   * @private
   */
  async saveCollectionResults(collectionId) {
    try {
      // Check for directory existence
      await fs.mkdir(path.dirname(this.dataDir), { recursive: true });
      await fs.mkdir(this.dataDir, { recursive: true });
      
      // Improved date format: YYYY-MM-DD_HH-MM-SS
      const now = new Date();
      const dateFormat = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(now).replace(/\//g, '-').replace(/:/g, '-').replace(/\s/g, '_');
      
      // Create formatted date string for the books file name
      const formattedDate = dateFormat;
      
      // Combined array for all knowledge books
      let allKnowledgeBooks = [];
      
      // Get all existing knowledge book files
      try {
        const files = await fs.readdir(this.dataDir);
        const knowledgeBookFiles = files.filter(file => file.startsWith('knowledge-books-') && file.endsWith('.json'));
        
        // Load all knowledge books from all dated files
        for (const file of knowledgeBookFiles) {
          try {
            const fileData = await fs.readFile(path.join(this.dataDir, file), 'utf8');
            const booksData = JSON.parse(fileData);
            
            if (Array.isArray(booksData)) {
              allKnowledgeBooks.push(...booksData);
            }
          } catch (readError) {
            this.logger.warn(`Error reading knowledge book file ${file}: ${readError.message}`);
          }
        }
        
        // Also check the main file if it exists (for backward compatibility)
        if (fsSync.existsSync(this.knowledgeBooksFile)) {
          try {
            const mainFileData = await fs.readFile(this.knowledgeBooksFile, 'utf8');
            const mainBooks = JSON.parse(mainFileData);
            
            if (Array.isArray(mainBooks)) {
              // Merge with all books, avoiding duplicates by ID
              const existingIds = new Set(allKnowledgeBooks.map(book => book.id));
              const uniqueMainBooks = mainBooks.filter(book => !existingIds.has(book.id));
              
              allKnowledgeBooks.push(...uniqueMainBooks);
            }
          } catch (error) {
            this.logger.warn(`Error reading main knowledge books file: ${error.message}`);
          }
        }
      } catch (error) {
        this.logger.warn(`Could not read data directory: ${error.message}`);
        allKnowledgeBooks = [];
      }
      
      // Convert collection results to knowledge books
      const newBooks = this.state.results.map(item => ({
        id: item.id,
        title: item.title,
        summary: item.summary,
        content: item.content,
        tags: item.tags,
        date: item.createdAt || item.date,
        source: item.sourceName || item.source,
        sourceUrl: item.sourceUrl || item.url,
        url: item.url || item.sourceUrl,
        isError: item.isError || false,
        collectionId: collectionId,
        collectionDate: formattedDate // Add collection date to each item
      }));
      
      // Add new books to knowledge books collection
      allKnowledgeBooks.push(...newBooks);
      
      // Sort by newest date first
      allKnowledgeBooks.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB - dateA;
      });
      
      // Create dated knowledge books file for this specific collection
      const datedBooksFile = path.join(this.dataDir, `knowledge-books-${formattedDate}.json`);
      
      // Save only the current collection books
      await fs.writeFile(
        datedBooksFile,
        JSON.stringify(newBooks, null, 2),
        'utf8'
      );
      
      // Update main knowledge books file
      await fs.writeFile(
        this.knowledgeBooksFile,
        JSON.stringify(allKnowledgeBooks, null, 2),
        'utf8'
      );
      
      // Add to collection history with dated knowledge books filename
      const filename = path.basename(datedBooksFile);
      
      this.collectionHistory.push({
        id: collectionId,
        date: now.toISOString(),
        displayDate: formattedDate,
        sources: this.state.sources,
        itemCount: this.state.results.length,
        processingLevel: this.state.processingLevel,
        filename: filename,
        booksFile: datedBooksFile
      });
      
      this.logger.info(`Collection completed: ${this.state.results.length} items collected and saved to ${datedBooksFile}`);
      return datedBooksFile;
    } catch (error) {
      this.logger.error('Error saving collection results', error);
      throw error;
    }
  }
  
  /**
   * Load all knowledge books from the data directory
   */
  async loadKnowledgeBooks() {
    // Load from all dated files
    const allBooks = [];
    
    try {
      // Read the data directory to find all dated knowledge book files
      const files = await fs.readdir(this.dataDir);
      const knowledgeBookFiles = files.filter(file => file.startsWith('knowledge-books-') && file.endsWith('.json'));
      
      // If we found dated files, read from them
      if (knowledgeBookFiles.length > 0) {
        this.logger.info(`Found ${knowledgeBookFiles.length} dated knowledge book files: ${knowledgeBookFiles.join(', ')}`);
        
        // Load all books from all dated files
        for (const file of knowledgeBookFiles) {
          try {
            const filePath = path.join(this.dataDir, file);
            this.logger.debug(`Attempting to load knowledge books from: ${filePath}`);
            
            // Check if the file exists and is accessible
            if (await this.fileExists(filePath)) {
              const fileData = await fs.readFile(filePath, 'utf8');
              let booksData;
              
              try {
                booksData = JSON.parse(fileData);
                this.logger.debug(`Successfully parsed JSON from ${file}`);
              } catch (parseError) {
                this.logger.error(`Error parsing JSON from ${file}:`, parseError);
                continue;
              }
              
              if (Array.isArray(booksData)) {
                // Add books from this file, avoiding duplicates by ID
                const existingIds = new Set(allBooks.map(book => book.id));
                const uniqueBooks = booksData.filter(book => !existingIds.has(book.id));
                
                allBooks.push(...uniqueBooks);
                this.logger.debug(`Added ${uniqueBooks.length} books from ${file}`);
                
                // Update our set of IDs
                uniqueBooks.forEach(book => existingIds.add(book.id));
              } else {
                this.logger.warn(`File ${file} does not contain an array of books`);
              }
            } else {
              this.logger.warn(`File ${file} exists in directory listing but is not accessible`);
            }
          } catch (readError) {
            this.logger.warn(`Error reading knowledge book file ${file}: ${readError.message}`);
          }
        }
        
        // Sort all books by date - newest first
        allBooks.sort((a, b) => {
          const dateA = new Date(a.date || a.createdAt || 0);
          const dateB = new Date(b.date || b.createdAt || 0);
          return dateB - dateA;
        });
        
        this.logger.info(`Loaded ${allBooks.length} total knowledge books from dated files`);
        return allBooks;
      }
      
      // For backward compatibility: If no dated files, try the main file
      this.logger.debug(`No dated knowledge book files found, trying legacy file: ${this.knowledgeBooksFile}`);
      await fs.access(this.knowledgeBooksFile);
      const data = await fs.readFile(this.knowledgeBooksFile, 'utf8');
      this.logger.warn('Using deprecated knowledge-books.json file - future collections will use dated files');
      return JSON.parse(data);
    } catch (error) {
      this.logger.warn('Knowledge books files not found or invalid, returning empty array', error);
      return [];
    }
  }
  
  /**
   * Check if a file exists
   * @private
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = CollectionService;