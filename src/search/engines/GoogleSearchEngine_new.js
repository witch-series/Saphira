/**
 * Google Search Engine
 * 
 * Implements Google search functionality using google-sr package directly.
 */

const BaseSearchEngine = require('./BaseSearchEngine');

class GoogleSearchEngine extends BaseSearchEngine {
  constructor(options = {}) {
    super(options);
    this.googleSr = null; // Lazy loaded
  }

  /**
   * Search Google using google-sr
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Google search results
   */
  async search(query, options = {}) {
    this.validateQuery(query);
    
    const maxResults = options.maxResults || this.maxResults;
    
    try {
      // Lazy load google-sr
      if (!this.googleSr) {
        const { search } = require('google-sr');
        this.googleSr = search;
      }
      
      this.logger.debug(`Google search request: ${query}`);
      
      // Perform Google search
      const searchResults = await this.googleSr({
        query: query,
        safeMode: false,
        filterResults: [],
        requestConfig: {},
        queryParameters: {}
      });
      
      // Convert to our standard format
      const results = searchResults.map(result => 
        this.createResult(
          result.title || 'No title',
          result.link || result.url,
          result.description || result.snippet || 'No description',
          {
            type: 'web_search',
            source: 'google',
            displayedLink: result.displayedLink || result.link,
            originalData: result
          }
        )
      );
      
      this.logSearchOperation(query, results.length);
      return results.slice(0, maxResults);
      
    } catch (error) {
      this.handleError(error, query);
      return [];
    }
  }

  getSourceName() {
    return 'Google';
  }
}

module.exports = GoogleSearchEngine;
