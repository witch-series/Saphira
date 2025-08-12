/**
 * Production Multi-Source Search Service for Saphira
 * 
 * Thi    this.logger.info(`🔍 Starting search for: "${trimmedQuery}" (requesting ${requestedMaxResults} results)`);

    // Cache disabled - always perform fresh searches for URL deduplication
    this.logger.info(`🔄 Cache disabled - performing fresh search`);

    try {
      // Ensure URLTracker is initialized before search// Ensure URLTracker is initialized before search
      if (!this.urlTracker) {
        this.urlTracker = new URLTracker();
      }
      await this.urlTracker.initialize();
      this.logger.info(`🔗 URLTracker initialized with ${await this.urlTracker.getURLCount()} tracked URLs`);s comprehensive search functionality using multiple sources:
 * - Wikipedia for encyclopedia content
 * - OpenLibrary for books and publications  
 * - Google Search as primary web search
 * - arXiv for academic papers
 * - Mock data as final fallback
 * 
 * Refactored to use modular SearchEngineManager architecture.
 */

const fs = require('fs').promises;
const path = require('path');
const { SearchEngineManager } = require('./search');
const URLTracker = require('./services/url-tracker');

class SearchService {
  /**
   * Create a new production-ready search service
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger object
   * @param {Object} options.urlTracker - URL tracking service
   * @param {Number} options.cacheTtl - Cache time to live in seconds (default: 300s)
   * @param {Number} options.maxResults - Maximum results to return (default: 10)
   * @param {String} options.saveDirectory - Directory to save search results (optional)
   */
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.urlTracker = options.urlTracker || new URLTracker();
    this.cache = new Map();
    this.cacheTimeout = (options.cacheTtl || 300) * 1000; // Convert to milliseconds
    this.maxResults = options.maxResults || 10;
    this.saveDirectory = options.saveDirectory || path.join(__dirname, '../user/data');
    
    // Initialize the search engine manager
    this.searchEngineManager = new SearchEngineManager({
      logger: this.logger,
      urlTracker: this.urlTracker,
      maxResults: options.maxResults || 20,
      timeout: options.timeout || 10000  // Increased from 5000 to 10000
    });
    
    // Minimal logging - only log initialization once
    if (!SearchService._initialized) {
      this.logger.info('Production SearchService initialized with modular search architecture');
      SearchService._initialized = true;
    }
  }

  /**
   * Primary search method - searches multiple sources and returns combined results
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Object} Search results with metadata
   */
  async search(query, options = {}) {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('Query is required and must be a non-empty string');
    }

    const trimmedQuery = query.trim();
    const requestedMaxResults = options.maxResults || this.maxResults;
    const sourcesRequested = options.sources || ['wikipedia', 'openlibrary', 'google', 'arxiv', 'github', 'mdn', 'stackoverflow'];
    
    this.logger.info(`🔍 Starting search for: "${trimmedQuery}" (requesting ${requestedMaxResults} results)`);

    // Check cache first
    const cacheKey = `${trimmedQuery}_${requestedMaxResults}_${sourcesRequested.join(',')}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.logger.info('� Using cached results');
      return {
        results: cached,
        source: 'Cache',
        cached: true,
        query: trimmedQuery,
        totalResults: cached.length
      };
    }

    try {
      // Ensure URLTracker is initialized before search
      if (this.urlTracker) {
        await this.urlTracker.initialize();
        this.logger.info(`� URLTracker initialized with ${(await this.urlTracker.getURLCount())} tracked URLs`);
      }

      // Use the SearchEngineManager to perform the search
      const searchResult = await this.searchEngineManager.searchAll(trimmedQuery, {
        sources: sourcesRequested,
        maxResults: requestedMaxResults,
        urlTracker: this.urlTracker
      });

      const { results, sourcesUsed, sourceStats } = searchResult;

      // Add search engine tags to results
      this.addSearchEngineTags(results, sourcesUsed);

      // Track URLs immediately to prevent future duplicates
      if (this.urlTracker && results.length > 0) {
        const urlsToTrack = results
          .filter(result => result.url)
          .map(result => result.url);
        
        if (urlsToTrack.length > 0) {
          await this.urlTracker.addURLs(urlsToTrack);
          await this.urlTracker.save();
          this.logger.info(`🔗 Tracked ${urlsToTrack.length} new URLs to prevent future duplicates`);
        }
      }

      // Cache disabled for fresh searches
      // this.saveToCache(cacheKey, results);

      // Save results to file if requested
      // Note: Commented out to prevent automatic creation of search-results files
      // Knowledge Book creation handles data persistence instead
      // if (options.saveResults !== false) {
      //   await this.saveSearchResults(trimmedQuery, results, sourcesUsed);
      // }

      this.logger.info(`✅ Search completed: ${results.length} total results from [${sourcesUsed.join(', ')}]`);

      return {
        results: results,
        source: sourcesUsed.join(', '),
        cached: false,
        query: trimmedQuery,
        totalResults: results.length,
        sourcesUsed: sourcesUsed.length,
        sourceStats: sourceStats,
        timestamp: searchResult.timestamp
      };

    } catch (error) {
      this.logger.error('❌ Search failed:', error);
      throw error;
    }
  }

  /**
   * Get available search engines from the manager
   * @returns {Array} List of available engine names
   */
  getAvailableEngines() {
    return this.searchEngineManager.getAvailableEngines();
  }

  /**
   * Get specific search engine for direct access
   * @param {string} name - Engine name
   * @returns {Object} Search engine instance
   */
  getEngine(name) {
    return this.searchEngineManager.getEngine(name);
  }

  /**
   * Add search engine tags to results based on successful sources
   * @param {Array} results - Search results
   * @param {Array} sourcesUsed - List of successful search sources
   */
  addSearchEngineTags(results, sourcesUsed) {
    if (!results || !Array.isArray(results)) return;
    
    results.forEach(result => {
      // Initialize tags array if it doesn't exist
      if (!result.tags) {
        result.tags = [];
      }
      
      // Add the search engine tag based on the source
      if (result.source && !result.tags.includes(result.source.toLowerCase())) {
        result.tags.push(result.source.toLowerCase());
      }
      
      // Add general search tags
      if (!result.tags.includes('search-result')) {
        result.tags.push('search-result');
      }
      
      // Add source-specific tags
      switch (result.source) {
        case 'Wikipedia':
          if (!result.tags.includes('encyclopedia')) {
            result.tags.push('encyclopedia');
          }
          break;
        case 'OpenLibrary':
          if (!result.tags.includes('books')) {
            result.tags.push('books');
          }
          break;
        case 'Google':
          if (!result.tags.includes('web-search')) {
            result.tags.push('web-search');
          }
          break;
        case 'arXiv':
          if (!result.tags.includes('academic')) {
            result.tags.push('academic');
          }
          if (!result.tags.includes('research-paper')) {
            result.tags.push('research-paper');
          }
          break;
      }
    });
    
    // Silent - no tag logging
  }

  /**
   * Remove duplicate results based on title and URL
   * @param {Array} results - Array of search results
   * @returns {Array} Deduplicated results
   */
  deduplicateResults(results) {
    const seen = new Set();
    return results.filter(result => {
      const key = result.title.toLowerCase() + '|' + result.url;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Get results from cache
   * @param {string} query - Search query
   * @returns {Array|null} Cached results or null
   */
  getFromCache(query) {
    const cached = this.cache.get(query.toLowerCase());
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.cache.delete(query.toLowerCase());
      this.logger.debug(`Cache expired for query: ${query}`);
      return null;
    }
    
    return cached.results;
  }

  /**
   * Save results to cache
   * @param {string} query - Search query
   * @param {Array} results - Search results
   */
  saveToCache(query, results) {
    this.cache.set(query.toLowerCase(), {
      results: results,
      timestamp: Date.now()
    });
    this.logger.debug(`Cache updated for query: ${query}`);
  }

  /**
   * Clear all cached results
   */
  clearCache() {
    this.cache.clear();
    this.logger.info('Cache cleared');
  }

  /**
   * Save search results to file
   * @param {string} query - Search query
   * @param {Array} results - Search results
   * @param {Array} sources - Sources used
   */
  async saveSearchResults(query, results, sources = []) {
    try {
      // Ensure directory exists
      await fs.mkdir(this.saveDirectory, { recursive: true });
      
      // Create dated filename
      const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const timestamp = new Date().toISOString();
      const filename = `search-results-${date}.json`;
      const filepath = path.join(this.saveDirectory, filename);
      
      // Prepare search result data
      const searchResultData = {
        query: query,
        timestamp: timestamp,
        sources: sources,
        totalResults: results.length,
        results: results.map(result => ({
          id: `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: result.title,
          url: result.url,
          snippet: result.snippet,
          source: result.source,
          searchQuery: query,
          savedAt: timestamp,
          type: 'search_result'
        }))
      };
      
      // Load existing data or create new
      let existingData = [];
      try {
        const existingFileData = await fs.readFile(filepath, 'utf8');
        existingData = JSON.parse(existingFileData);
        if (!Array.isArray(existingData)) {
          existingData = [];
        }
      } catch (error) {
        // File doesn't exist or is invalid, start with empty array
        this.logger.debug(`Creating new search results file: ${filename}`);
      }
      
      // Add new search result
      existingData.push(searchResultData);
      
      // Save updated data
      await fs.writeFile(filepath, JSON.stringify(existingData, null, 2), 'utf8');
      
      // Silent - no save logging
      
    } catch (error) {
      this.logger.warn(`⚠️ Failed to save search results: ${error.message}`);
    }
  }

  /**
   * Load saved search results
   * @param {string} date - Date in YYYY-MM-DD format (optional, defaults to today)
   * @returns {Array} Saved search results
   */
  async loadSearchResults(date = null) {
    try {
      if (!date) {
        date = new Date().toISOString().split('T')[0];
      }
      
      const filename = `search-results-${date}.json`;
      const filepath = path.join(this.saveDirectory, filename);
      
      const fileData = await fs.readFile(filepath, 'utf8');
      const data = JSON.parse(fileData);
      
      return Array.isArray(data) ? data : [];
    } catch (error) {
      this.logger.debug(`No search results file found for date: ${date}`);
      return [];
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      timeout: this.cacheTimeout,
      keys: Array.from(this.cache.keys())
    };
  }
}

module.exports = SearchService;
