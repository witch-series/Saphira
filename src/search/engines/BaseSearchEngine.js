/**
 * Base Search Engine Class
 * 
 * Abstract base class for all search engines in Saphira.
 * Provides common functionality and interface for search implementations.
 */

class BaseSearchEngine {
  constructor(options = {}) {
    this.name = this.constructor.name;
    this.logger = options.logger || console;
    this.maxResults = options.maxResults || 20;
    this.timeout = options.timeout || 5000;
  }

  /**
   * Abstract method - must be implemented by subclasses
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Search results
   */
  async search(query, options = {}) {
    throw new Error(`search() method must be implemented by ${this.name}`);
  }

  /**
   * Validate search query
   * @param {string} query - Search query to validate
   * @throws {Error} If query is invalid
   */
  validateQuery(query) {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('Query is required and must be a non-empty string');
    }
  }

  /**
   * Create standardized result object
   * @param {string} title - Result title
   * @param {string} url - Result URL
   * @param {string} snippet - Result description/snippet
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Standardized result object
   */
  createResult(title, url, snippet, metadata = {}) {
    return {
      title: title || 'No title',
      url: url || '',
      snippet: snippet || 'No description available',
      source: this.getSourceName(),
      timestamp: new Date().toISOString(),
      ...metadata
    };
  }

  /**
   * Get the display name for this search engine
   * @returns {string} Source name
   */
  getSourceName() {
    return this.name.replace('SearchEngine', '');
  }

  /**
   * Log search operation
   * @param {string} query - Search query
   * @param {number} resultCount - Number of results found
   */
  logSearchOperation(query, resultCount) {
    this.logger.debug(`${this.getSourceName()}: "${query}" -> ${resultCount} results`);
  }

  /**
   * Handle search errors
   * @param {Error} error - Error object
   * @param {string} query - Search query that failed
   */
  handleError(error, query) {
    this.logger.warn(`${this.getSourceName()} search failed for "${query}": ${error.message}`);
    throw error;
  }

  /**
   * Create timeout promise for request handling
   * @param {number} ms - Timeout in milliseconds
   * @returns {Promise} Timeout promise
   */
  createTimeout(ms = this.timeout) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), ms);
    });
  }
}

module.exports = BaseSearchEngine;
