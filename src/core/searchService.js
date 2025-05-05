/**
 * Search Service for Saphira
 * 
 * This service provides search functionality using various search adapters,
 * starting with DuckDuckGo. It handles caching, result processing, and management.
 */

const DuckDuckGoAdapter = require('./sourceAdapters/duckDuckGoAdapter');

class SearchService {
  /**
   * Create a new search service
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger object
   * @param {Number} options.cacheTtl - Cache time to live in seconds (default: 300s)
   * @param {Number} options.defaultMaxResults - Default maximum results to return (default: 10)
   */
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.cacheTtl = options.cacheTtl || 300; // 5 minutes default
    this.defaultMaxResults = options.defaultMaxResults || 10;
    
    // Initialize search adapters
    this.adapters = {
      duckduckgo: new DuckDuckGoAdapter({
        logger: this.logger,
        maxResults: this.defaultMaxResults,
        allowedSources: [] // Allow all sources
      })
    };
    
    // Search results cache
    this.cache = {
      duckduckgo: {
        results: [],
        query: '',
        timestamp: null,
        summary: ''
      },
      scraped: {
        results: [],
        query: '',
        timestamp: null,
        total: 0
      }
    };
  }
  
  /**
   * Set allowed sources for a specific adapter
   * @param {String} adapterName - Name of the adapter (e.g., 'duckduckgo')
   * @param {Array} sources - Array of allowed domain strings
   */
  setAllowedSources(adapterName, sources) {
    if (this.adapters[adapterName] && typeof this.adapters[adapterName].setAllowedSources === 'function') {
      this.adapters[adapterName].setAllowedSources(sources);
      this.logger.info(`Set allowed sources for ${adapterName}: ${sources.join(', ')}`);
    } else {
      this.logger.warn(`Cannot set allowed sources for ${adapterName}: adapter not found or doesn't support this method`);
    }
  }
  
  /**
   * Set maximum results for a specific adapter
   * @param {String} adapterName - Name of the adapter (e.g., 'duckduckgo')
   * @param {Number} maxResults - Maximum number of results to return
   */
  setMaxResults(adapterName, maxResults) {
    if (this.adapters[adapterName]) {
      this.adapters[adapterName].maxResults = maxResults;
      this.logger.info(`Set max results for ${adapterName} to ${maxResults}`);
    } else {
      this.logger.warn(`Cannot set max results for ${adapterName}: adapter not found`);
    }
  }
  
  /**
   * Perform a search using the specified engine
   * @param {String} query - Search query
   * @param {Object} options - Search options
   * @param {String} options.engine - Search engine to use (default: duckduckgo)
   * @param {Boolean} options.useCache - Whether to use cached results (default: true)
   * @param {Number} options.maxResults - Maximum results to return (default: this.defaultMaxResults)
   * @returns {Promise<Object>} - Search results
   */
  async search(query, options = {}) {
    const engine = options.engine || 'duckduckgo';
    const useCache = options.useCache !== false;
    const maxResults = options.maxResults || this.defaultMaxResults;
    
    // Check if we should use cached results
    if (useCache && 
        this.cache[engine] && 
        this.cache[engine].query === query && 
        this.cache[engine].timestamp &&
        (Date.now() - new Date(this.cache[engine].timestamp).getTime()) < this.cacheTtl * 1000) {
      this.logger.info(`Using cached search results for query: ${query}`);
      return {
        results: this.cache[engine].results,
        query: query,
        engine: engine,
        timestamp: this.cache[engine].timestamp,
        fromCache: true
      };
    }
    
    // Validate and select search adapter
    if (!this.adapters[engine]) {
      throw new Error(`Search engine "${engine}" not supported`);
    }
    
    // Configure adapter for this search
    if (maxResults && maxResults !== this.defaultMaxResults) {
      this.adapters[engine].maxResults = maxResults;
    } else {
      this.adapters[engine].maxResults = this.defaultMaxResults;
    }
    
    try {
      // Create search terms array
      const searchTerms = query.split(' ').filter(term => term.trim().length > 0);
      
      // Perform search
      const results = await this.adapters[engine].collectData(searchTerms);
      
      // Update cache
      this.cache[engine] = {
        results: results,
        query: query,
        timestamp: new Date().toISOString(),
      };
      
      // Return search results
      return {
        results: results,
        query: query,
        engine: engine,
        timestamp: this.cache[engine].timestamp,
        fromCache: false
      };
    } catch (error) {
      this.logger.error(`Search error (${engine}): ${error.message}`);
      throw error;
    }
  }

  /**
   * Scrape top search results from DuckDuckGo
   * @param {String} query - Search query
   * @param {Object} options - Scraping options
   * @param {Boolean} options.useCache - Whether to use cached results (default: true)
   * @param {Number} options.maxResults - Maximum results to scrape (default: 10)
   * @returns {Promise<Object>} - Scraped results
   */
  async scrapeTopResults(query, options = {}) {
    const useCache = options.useCache !== false;
    const maxResults = options.maxResults || 10;
    
    // Check if we should use cached results
    if (useCache && 
        this.cache.scraped && 
        this.cache.scraped.query === query && 
        this.cache.scraped.timestamp &&
        (Date.now() - new Date(this.cache.scraped.timestamp).getTime()) < this.cacheTtl * 1000) {
      this.logger.info(`Using cached scraped results for query: ${query}`);
      return {
        results: this.cache.scraped.results,
        query: query,
        timestamp: this.cache.scraped.timestamp,
        fromCache: true,
        totalScraped: this.cache.scraped.total
      };
    }
    
    try {
      this.logger.info(`Scraping top ${maxResults} results for query: ${query}`);
      
      // Call scraping function in DuckDuckGo adapter
      const scrapingResult = await this.adapters.duckduckgo.scrapeTopResults(query, maxResults);
      
      // Update cache
      this.cache.scraped = {
        results: scrapingResult.results,
        query: query,
        timestamp: new Date().toISOString(),
        total: scrapingResult.totalScraped || scrapingResult.results.length
      };
      
      // Return scraped results
      return {
        results: scrapingResult.results,
        query: query,
        timestamp: this.cache.scraped.timestamp,
        fromCache: false,
        totalScraped: scrapingResult.totalScraped || scrapingResult.results.length
      };
    } catch (error) {
      this.logger.error(`Scraping error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get detailed information about a specific search result
   * @param {String} adapterName - Name of the adapter used for the search
   * @param {Number} index - Index of the result in the cache
   * @returns {Object} - Result details and metadata
   */
  getResultDetail(adapterName, index) {
    const cache = this.cache[adapterName];
    
    if (!cache || !cache.results || !cache.results[index]) {
      this.logger.warn(`Result not found at index ${index} for ${adapterName}`);
      throw new Error(`Result not found at index ${index}`);
    }
    
    return {
      result: cache.results[index],
      query: cache.query,
      index: index
    };
  }
  
  /**
   * Clear the search cache for a specific adapter or all adapters
   * @param {String} adapterName - Name of the adapter to clear cache for (optional)
   */
  clearCache(adapterName = null) {
    if (adapterName) {
      if (this.cache[adapterName]) {
        this.cache[adapterName] = {
          results: [],
          query: '',
          timestamp: null,
          summary: ''
        };
        this.logger.info(`Cache cleared for ${adapterName}`);
      }
    } else {
      // Clear all caches
      Object.keys(this.cache).forEach(adapter => {
        this.cache[adapter] = {
          results: [],
          query: '',
          timestamp: null,
          summary: ''
        };
      });
      this.logger.info('All search caches cleared');
    }
  }
}

module.exports = SearchService;