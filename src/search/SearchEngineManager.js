/**
 * Search Engine Manager
 * 
 * Manages multiple search engines and coordinates search operations.
 */

const WikipediaSearchEngine = require('./engines/WikipediaSearchEngine');
const OpenLibrarySearchEngine = require('./engines/OpenLibrarySearchEngine');
const GoogleSearchEngine = require('./engines/GoogleSearchEngine');
const ArxivSearchEngine = require('./engines/ArxivSearchEngine');
const GitHubSearchEngine = require('./engines/GitHubSearchEngine');
const MDNSearchEngine = require('./engines/MDNSearchEngine');
const StackOverflowSearchEngine = require('./engines/StackOverflowSearchEngine');
const MockSearchEngine = require('./engines/MockSearchEngine');

class SearchEngineManager {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.urlTracker = options.urlTracker;
    this.engines = {};
    this.initializeEngines(options);
  }

  /**
   * Initialize all search engines
   * @param {Object} options - Configuration options
   */
  initializeEngines(options) {
    const engineOptions = {
      logger: this.logger,
      maxResults: options.maxResults || 20,
      timeout: options.timeout || 10000  // Increased from 5000 to 10000 (10 seconds)
    };

    this.engines = {
      wikipedia: new WikipediaSearchEngine(engineOptions),
      openlibrary: new OpenLibrarySearchEngine(engineOptions),
      google: new GoogleSearchEngine(engineOptions),
      arxiv: new ArxivSearchEngine(engineOptions),
      github: new GitHubSearchEngine(engineOptions),
      mdn: new MDNSearchEngine(engineOptions),
      stackoverflow: new StackOverflowSearchEngine(engineOptions),
      mock: new MockSearchEngine(engineOptions)
    };

    this.logger.debug('Search engines initialized:', Object.keys(this.engines));
  }

  /**
   * Get list of available engine names
   * @returns {string[]} Array of engine names
   */
  get availableEngines() {
    return Object.keys(this.engines);
  }

  /**
   * Search multiple engines in parallel
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Combined search results with metadata
   */
  async searchAll(query, options = {}) {
    const sources = options.sources || ['wikipedia', 'openlibrary', 'google', 'arxiv'];
    const maxResults = options.maxResults || 20;
    const resultsPerSource = Math.max(maxResults, 20);
    
    // Set URL tracker from options
    this.urlTracker = options.urlTracker || null;

    // Enhanced logging for search start
    this.logger.info(`🚀 Starting multi-source search for: "${query}"`);
    this.logger.info(`🎯 Target engines: [${sources.join(', ')}]`);
    this.logger.info(`📊 Max results per source: ${resultsPerSource}, Final limit: ${maxResults}`);

    const allResults = [];
    const sourcesUsed = [];
    const sourceStats = {};
    const searchPromises = [];

    // Create search promises for each requested source
    for (const sourceName of sources) {
      if (this.engines[sourceName]) {
        this.logger.info(`⚙️ Queuing ${this.engines[sourceName].getSourceName()} search...`);
        searchPromises.push(
          this.searchSingleEngine(sourceName, query, { maxResults: resultsPerSource })
            .then(result => ({ sourceName, ...result }))
            .catch(error => ({ sourceName, error, results: [] }))
        );
      } else {
        this.logger.warn(`⚠️ Unknown search engine requested: ${sourceName}`);
      }
    }

    this.logger.info(`🔄 Executing ${searchPromises.length} searches in parallel...`);

    // Execute all searches in parallel
    const searchResults = await Promise.all(searchPromises);

    // Process results from each source
    for (const result of searchResults) {
      const { sourceName, results = [], error } = result;
      
      if (error) {
        this.logger.warn(`⚠️ ${sourceName} search failed:`, error.message);
        continue;
      }

      this.logger.debug(`${sourceName} processing: ${results.length} results`);

      if (results.length > 0) {
        // Filter new URLs if URL tracker is available
        this.logger.debug(`URL tracker available: ${!!this.urlTracker}`);
        const filteredResults = await this.filterNewUrls(results);
        
        if (filteredResults.length > 0) {
          allResults.push(...filteredResults);
          sourcesUsed.push(this.engines[sourceName].getSourceName());
          sourceStats[sourceName] = {
            original: results.length,
            filtered: filteredResults.length,
            newUrls: filteredResults.length
          };
          this.logger.info(`✅ ${this.engines[sourceName].getSourceName()}: ${filteredResults.length} new URLs (${results.length} total found)`);
        } else {
          this.logger.info(`ℹ️ ${this.engines[sourceName].getSourceName()}: No new URLs found (${results.length} total found, all were duplicates)`);
          sourceStats[sourceName] = {
            original: results.length,
            filtered: 0,
            newUrls: 0
          };
        }
      } else {
        this.logger.info(`ℹ️ ${this.engines[sourceName].getSourceName()}: No results found`);
      }
    }

    // Add mock data if no results from any source
    if (allResults.length === 0) {
      this.logger.info('🔄 No results from any source, using mock data...');
      const mockResults = await this.engines.mock.search(query, { maxResults: 5 });
      allResults.push(...mockResults);
      sourcesUsed.push('Mock');
      sourceStats.mock = {
        original: mockResults.length,
        filtered: mockResults.length,
        newUrls: mockResults.length
      };
    }

    // Deduplicate and limit final results
    const uniqueResults = this.deduplicateResults(allResults);
    const finalResults = uniqueResults.slice(0, maxResults);

    // Enhanced final logging
    this.logger.info(`🎉 Search completed for "${query}"`);
    this.logger.info(`📈 Results summary: ${finalResults.length} final results from ${sourcesUsed.length} successful sources`);
    this.logger.info(`✅ Successful sources: [${sourcesUsed.join(', ')}]`);
    if (Object.keys(sourceStats).length > 0) {
      this.logger.info(`📊 Detailed stats:`, sourceStats);
    }

    return {
      results: finalResults,
      query: query,
      totalResults: finalResults.length,
      sourcesUsed: sourcesUsed,
      sourceStats: sourceStats,
      requestedSources: sources,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Search a single engine
   * @param {string} engineName - Name of the search engine
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results from single engine
   */
  async searchSingleEngine(engineName, query, options = {}) {
    if (!this.engines[engineName]) {
      throw new Error(`Unknown search engine: ${engineName}`);
    }

    this.logger.info(`🔍 Searching ${this.engines[engineName].getSourceName()}...`);
    
    try {
      const results = await this.engines[engineName].search(query, options);
      this.logger.debug(`${engineName} returned ${results?.length || 0} results`);
      return { results, success: true };
    } catch (error) {
      this.logger.warn(`${engineName} search failed:`, error.message);
      return { results: [], success: false, error };
    }
  }

  /**
   * Filter results to include only new URLs not in the tracker
   * @param {Array} results - Array of search results
   * @returns {Promise<Array>} Filtered results with new URLs only
   */
  async filterNewUrls(results) {
    if (!this.urlTracker) {
      this.logger.debug('No URL tracker - returning all results');
      return results;
    }

    this.logger.info(`🔍 URL filtering: checking ${results.length} results against known URLs`);
    
    const filtered = [];
    let duplicateCount = 0;
    
    for (const result of results) {
      if (!result.url) {
        this.logger.debug('✅ Keeping result without URL');
        filtered.push(result);
        continue;
      }
      
      const isNew = !(await this.urlTracker.hasBeenProcessed(result.url));
      if (!isNew) {
        this.logger.info(`❌ Filtering out existing URL: ${result.url}`);
        duplicateCount++;
      } else {
        this.logger.debug(`✅ New URL found: ${result.url}`);
        filtered.push(result);
      }
    }

    this.logger.info(`🎯 URL filtering result: ${filtered.length} new URLs from ${results.length} total (${duplicateCount} duplicates filtered out)`);
    return filtered;
  }

  /**
   * Remove duplicate results based on URL
   * @param {Array} results - Array of search results
   * @returns {Array} Deduplicated results
   */
  deduplicateResults(results) {
    const seen = new Set();
    return results.filter(result => {
      const key = result.url || result.title;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Get available search engines
   * @returns {Array} List of available engine names
   */
  getAvailableEngines() {
    return Object.keys(this.engines);
  }

  /**
   * Get specific search engine
   * @param {string} name - Engine name
   * @returns {Object} Search engine instance
   */
  getEngine(name) {
    return this.engines[name];
  }

  /**
   * Add custom search engine
   * @param {string} name - Engine name
   * @param {Object} engine - Engine instance
   */
  addEngine(name, engine) {
    this.engines[name] = engine;
    this.logger.info(`Added custom search engine: ${name}`);
  }

  /**
   * Remove search engine
   * @param {string} name - Engine name
   */
  removeEngine(name) {
    if (this.engines[name]) {
      delete this.engines[name];
      this.logger.info(`Removed search engine: ${name}`);
    }
  }
}

module.exports = SearchEngineManager;
