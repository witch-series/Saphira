/**
 * Collection Service for Saphira GUI Viewer
 * Provides functions for data collection simulation and management
 */
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs'); // Added: Module for synchronous file system operations
const { v4: uuidv4 } = require('uuid');

/**
 * Create a collection service with the given options
 * @param {Object} options - Configuration options
 * @returns {Object} - Collection service functions
 */
module.exports = function(options) {
  const { 
    logger, 
    collectionState, 
    collectionHistory, 
    USER_DIR, 
    KNOWLEDGE_BOOKS_FILE,
    loadApiKeys // Added: Function to load API keys
  } = options;

  /**
   * Collection process for real data from adapters
   * @param {Object} config - Collection configuration
   * @returns {Promise<void>}
   */
  async function simulateCollection(config) {
    // Reset collection state
    collectionState.running = true;
    collectionState.progress = 0;
    collectionState.currentSource = 'Initializing...';
    collectionState.itemsCollected = 0;
    collectionState.startTime = new Date().toISOString();
    collectionState.processingLevel = config.processingLevel;
    collectionState.sources = config.sources;
    collectionState.keywords = config.keywords;
    collectionState.maxResults = config.maxResults;
    collectionState.results = [];
    
    logger.info(`Starting collection with level: ${config.processingLevel}`);
    logger.info(`Sources: ${config.sources.join(', ')}`);
    logger.debug('Collection config', config);
    
    // Create a collection ID for this run
    const collectionId = uuidv4();
    const collectionDate = new Date().toISOString();
    
    // Load API keys
    let apiKeys = {};
    try {
      apiKeys = await loadApiKeys();
      logger.info('Successfully loaded API keys for collection');
    } catch (error) {
      logger.error('Failed to load API keys', error);
      apiKeys = {}; // Default empty object
    }

    // Process each source
    for (let i = 0; i < config.sources.length; i++) {
      const source = config.sources[i];
      collectionState.currentSource = source;
      collectionState.progress = Math.floor((i / config.sources.length) * 100);
      
      logger.info(`Collecting from source: ${source}`);
      
      try {
        // Try to use the actual adapter to collect data
        let adapterPath = '';
        try {
          // First try with uppercase first letter
          const capitalizedSource = source.charAt(0).toUpperCase() + source.slice(1);
          adapterPath = path.join(options.rootDir, 'src', 'core', 'sourceAdapters', `${capitalizedSource}Adapter.js`);
          
          if (!fsSync.existsSync(adapterPath)) { // Fixed: Changed from fs.existsSync to fsSync.existsSync
            // If not found, try with lowercase
            adapterPath = path.join(options.rootDir, 'src', 'core', 'sourceAdapters', `${source.toLowerCase()}Adapter.js`);
          }
          
          if (!fsSync.existsSync(adapterPath)) { // Fixed: Changed from fs.existsSync to fsSync.existsSync
            // Special case for duckDuckGo (camelCase)
            if (source.toLowerCase() === 'duckduckgo') {
              adapterPath = path.join(options.rootDir, 'src', 'core', 'sourceAdapters', `duckDuckGoAdapter.js`);
            } else {
              // Try other name format
              adapterPath = path.join(options.rootDir, 'src', 'core', 'sourceAdapters', `${source}Adapter.js`);
            }
          }
          
          logger.debug(`Looking for adapter at: ${adapterPath}`);
          const AdapterClass = require(adapterPath);
          
          // Initialize adapter - check for class or direct export
          let sourceAdapter;
          if (typeof AdapterClass === 'function') {
            // For class-based adapters
            sourceAdapter = new AdapterClass({
              logger,
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
              logger.warn(`NewsAPI requires an API key, but none was provided. Please set one in the API Keys settings.`);
              throw new Error('NewsAPI requires an API key. Please add it in the API Keys settings page.');
            }
            
            let adapterResults = [];
            
            // Make sure we always have at least one keyword for adapters that require it
            const keywordsToUse = config.keywords.length > 0 ? 
                                 config.keywords.filter(k => k && k.trim()) : 
                                 ['general'];
            
            // Try fetchContent method first (used in most adapters)
            if (typeof sourceAdapter.fetchContent === 'function') {
              logger.info(`Using fetchContent method for ${source} adapter with keywords: ${keywordsToUse.join(', ')}`);
              adapterResults = await sourceAdapter.fetchContent(keywordsToUse);
            } 
            // Fall back to collectData if fetchContent doesn't exist
            else if (typeof sourceAdapter.collectData === 'function') {
              logger.info(`Using collectData method for ${source} adapter with keywords: ${keywordsToUse.join(', ')}`);
              adapterResults = await sourceAdapter.collectData(keywordsToUse);
            }
            
            if (Array.isArray(adapterResults) && adapterResults.length > 0) {
              logger.info(`Successfully collected ${adapterResults.length} items from ${source} adapter`);
              
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
              
              collectionState.results.push(...processedResults);
              collectionState.itemsCollected = collectionState.results.length;
              continue;
            } else {
              // Special handling for DuckDuckGo adapter
              if (source.toLowerCase() === 'duckduckgo') {
                logger.warn(`DuckDuckGo adapter returned no results. Retrying with fallback approach...`);
                
                try {
                  // Manually use the adapter for better debugging
                  const DuckDuckGoAdapter = require(path.join(options.rootDir, 'src', 'core', 'sourceAdapters', `duckDuckGoAdapter.js`));
                  
                  // Create new instance with more explicit options
                  const duckAdapter = new DuckDuckGoAdapter({
                    logger,
                    maxResults: config.maxResults,
                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
                    timeout: 30000 // Increased timeout
                  });
                  
                  // Try collectData method directly with logging
                  const keywordsToUse = config.keywords.length > 0 ? 
                    config.keywords.filter(k => k && k.trim()) : 
                    ['artificial intelligence']; // Default keyword if none provided
                  
                  logger.info(`Explicitly calling DuckDuckGo adapter with keywords: ${keywordsToUse.join(', ')}`);
                  const duckResults = await duckAdapter.collectData(keywordsToUse);
                  
                  if (Array.isArray(duckResults) && duckResults.length > 0) {
                    logger.info(`Successfully collected ${duckResults.length} items from DuckDuckGo adapter after retry`);
                    
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
                    
                    collectionState.results.push(...processedResults);
                    collectionState.itemsCollected = collectionState.results.length;
                  } else {
                    // DuckDuckGo retry failed - get search results directly without content fetching
                    logger.warn(`DuckDuckGo adapter content fetch failed, trying to get just search results`);
                    
                    try {
                      // Get only search results without content fetching
                      const query = keywordsToUse.join(' ');
                      const searchResults = await duckAdapter.performSearch(query);
                      
                      if (Array.isArray(searchResults) && searchResults.length > 0) {
                        logger.info(`Got ${searchResults.length} raw search results from DuckDuckGo`);
                        
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
                        
                        collectionState.results.push(searchItem);
                        collectionState.itemsCollected = collectionState.results.length;
                      } else {
                        // No search results at all - add error message
                        const errorItem = createErrorItem(
                          source,
                          keywordsToUse,
                          "DuckDuckGo search API returned no results. DuckDuckGo may be restricting automated queries.",
                          collectionId
                        );
                        collectionState.results.push(errorItem);
                        collectionState.itemsCollected = collectionState.results.length;
                      }
                    } catch (searchError) {
                      logger.error(`Error getting raw search results from DuckDuckGo:`, searchError);
                      const errorItem = createErrorItem(
                        source,
                        keywordsToUse,
                        `Error during DuckDuckGo search: ${searchError.message}`,
                        collectionId
                      );
                      collectionState.results.push(errorItem);
                      collectionState.itemsCollected = collectionState.results.length;
                    }
                  }
                } catch (duckError) {
                  // DuckDuckGo adapter error - add error message
                  logger.error(`Error during DuckDuckGo adapter retry:`, duckError);
                  const errorItem = createErrorItem(
                    source,
                    config.keywords,
                    `Error connecting to DuckDuckGo: ${duckError.message}`,
                    collectionId
                  );
                  collectionState.results.push(errorItem);
                  collectionState.itemsCollected = collectionState.results.length;
                }
              } else {
                // No results from adapter - add error message
                logger.warn(`Adapter for ${source} returned no results`);
                const errorItem = createErrorItem(
                  source,
                  config.keywords,
                  `No results found from ${source} for the specified keywords.`,
                  collectionId
                );
                collectionState.results.push(errorItem);
                collectionState.itemsCollected = collectionState.results.length;
              }
            }
          }
        } catch (error) {
          // Adapter error - add error message
          logger.warn(`Error using adapter for ${source}: ${error.message}`);
          const errorItem = createErrorItem(
            source,
            config.keywords,
            `Error using ${source} adapter: ${error.message}`,
            collectionId
          );
          collectionState.results.push(errorItem);
          collectionState.itemsCollected = collectionState.results.length;
        }
      } catch (error) {
        logger.error(`Error collecting from source ${source}:`, error);
      }
    }
    
    // Create error item helper function
    function createErrorItem(source, keywords, errorMessage, collectionId) {
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
    
    // Save collection results
    try {
      // Check for directory existence
      await fs.mkdir(USER_DIR, { recursive: true });
      
      // Create data directory if it doesn't exist
      const DATA_DIR = path.join(USER_DIR, 'data');
      await fs.mkdir(DATA_DIR, { recursive: true });
      
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
        const files = await fs.readdir(DATA_DIR);
        const knowledgeBookFiles = files.filter(file => file.startsWith('knowledge-books-') && file.endsWith('.json'));
        
        // Load all knowledge books from all dated files
        for (const file of knowledgeBookFiles) {
          try {
            const fileData = await fs.readFile(path.join(DATA_DIR, file), 'utf8');
            const booksData = JSON.parse(fileData);
            
            if (Array.isArray(booksData)) {
              allKnowledgeBooks.push(...booksData);
            }
          } catch (readError) {
            logger.warn(`Error reading knowledge book file ${file}: ${readError.message}`);
          }
        }
        
        // Also check the main file if it exists (for backward compatibility)
        if (fsSync.existsSync(KNOWLEDGE_BOOKS_FILE)) {
          try {
            const mainFileData = await fs.readFile(KNOWLEDGE_BOOKS_FILE, 'utf8');
            const mainBooks = JSON.parse(mainFileData);
            
            if (Array.isArray(mainBooks)) {
              // Merge with all books, avoiding duplicates by ID
              const existingIds = new Set(allKnowledgeBooks.map(book => book.id));
              const uniqueMainBooks = mainBooks.filter(book => !existingIds.has(book.id));
              
              allKnowledgeBooks.push(...uniqueMainBooks);
            }
          } catch (error) {
            logger.warn(`Error reading main knowledge books file: ${error.message}`);
          }
        }
      } catch (error) {
        logger.warn(`Could not read data directory: ${error.message}`);
        allKnowledgeBooks = [];
      }
      
      // Removed the Collection Report metadata book creation
      
      // Convert collection results to knowledge books
      const newBooks = collectionState.results.map(item => ({
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
      
      // Add new books to knowledge books collection (without metadata book)
      allKnowledgeBooks.push(...newBooks);
      
      // Sort by newest date first
      allKnowledgeBooks.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB - dateA;
      });
      
      // Create dated knowledge books file for this specific collection
      const datedBooksFile = path.join(DATA_DIR, `knowledge-books-${formattedDate}.json`);
      
      // Save only the current collection books (without metadata)
      await fs.writeFile(
        datedBooksFile,
        JSON.stringify(newBooks, null, 2),
        'utf8'
      );
      
      // Add to collection history with dated knowledge books filename
      const filename = path.basename(datedBooksFile);
      
      collectionHistory.push({
        id: collectionId,
        date: now.toISOString(),
        displayDate: formattedDate, 
        sources: config.sources,
        itemCount: collectionState.results.length,
        processingLevel: config.processingLevel,
        filename: filename,
        booksFile: datedBooksFile
      });
      
      logger.info(`Collection completed: ${collectionState.results.length} items collected and saved to ${datedBooksFile}`);
      
    } catch (error) {
      logger.error('Error saving collection results', error);
    }
    
    // Complete collection
    collectionState.running = false;
    collectionState.progress = 100;
    collectionState.currentSource = 'Completed';
  }
  
  return {
    simulateCollection
  };
};