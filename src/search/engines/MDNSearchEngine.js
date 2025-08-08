/**
 * MDN (Mozilla Developer Network) Search Engine
 * 
 * Implements MDN documentation search functionality.
 * Uses MDN's search API for developer documentation.
 */

const https = require('https');
const { URL } = require('url');
const BaseSearchEngine = require('./BaseSearchEngine');

class MDNSearchEngine extends BaseSearchEngine {
  constructor(options = {}) {
    super(options);
    this.baseUrl = 'https://developer.mozilla.org';
    this.searchUrl = 'https://developer.mozilla.org/api/v1/search';
    this.userAgent = 'Saphira-Search/1.0';
  }

  /**
   * Search MDN documentation
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} MDN search results
   */
  async search(query, options = {}) {
    this.validateQuery(query);
    
    const maxResults = Math.min(options.maxResults || this.maxResults, 50);
    const locale = options.locale || 'en-US';
    
    try {
      const results = await this.performSearch(query, maxResults, locale);
      this.logSearchOperation(query, results.length);
      return results;
    } catch (error) {
      this.logger.warn(`MDN search failed: ${error.message}`);
      return this.getFallbackResults(query);
    }
  }

  /**
   * Perform the actual search request
   * @param {string} query - Search query
   * @param {number} maxResults - Maximum results
   * @param {string} locale - Locale for search
   * @returns {Promise<Array>} Search results
   */
  async performSearch(query, maxResults, locale) {
    const searchParams = new URLSearchParams({
      q: query,
      locale: locale,
      size: Math.min(maxResults, 50)
    });
    
    const searchUrl = `${this.searchUrl}?${searchParams.toString()}`;
    
    return new Promise((resolve, reject) => {
      const url = new URL(searchUrl);
      
      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        method: 'GET',
        timeout: this.timeout,
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const parsed = JSON.parse(data);
              const results = [];
              
              if (parsed.documents && parsed.documents.length > 0) {
                parsed.documents.forEach(doc => {
                  results.push(this.createResult(
                    `📚 ${doc.title}`,
                    `${this.baseUrl}${doc.mdn_url}`,
                    this.formatDocDescription(doc),
                    {
                      type: 'documentation',
                      category: this.categorizeDocument(doc),
                      locale: doc.locale,
                      tags: doc.tags || [],
                      lastModified: doc.last_modified || null
                    }
                  ));
                });
              }
              
              resolve(results.slice(0, maxResults));
            } else {
              resolve([]);
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('MDN search timeout'));
      });

      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Format document description
   * @param {Object} doc - Document data from MDN API
   * @returns {string} Formatted description
   */
  formatDocDescription(doc) {
    if (doc.summary) {
      return doc.summary;
    }
    
    const parts = [];
    
    if (doc.tags && doc.tags.length > 0) {
      const relevantTags = doc.tags.slice(0, 3);
      parts.push(`Tags: ${relevantTags.join(', ')}`);
    }
    
    if (doc.locale && doc.locale !== 'en-US') {
      parts.push(`Language: ${doc.locale}`);
    }
    
    return parts.length > 0 ? parts.join(' | ') : 'MDN documentation page';
  }

  /**
   * Categorize document based on URL path
   * @param {Object} doc - Document data
   * @returns {string} Category
   */
  categorizeDocument(doc) {
    const url = doc.mdn_url || '';
    
    if (url.includes('/Web/JavaScript')) return 'JavaScript';
    if (url.includes('/Web/CSS')) return 'CSS';
    if (url.includes('/Web/HTML')) return 'HTML';
    if (url.includes('/Web/API')) return 'Web API';
    if (url.includes('/Web/HTTP')) return 'HTTP';
    if (url.includes('/Mozilla')) return 'Mozilla';
    if (url.includes('/Firefox')) return 'Firefox';
    if (url.includes('/Tools')) return 'Developer Tools';
    if (url.includes('/Games')) return 'Web Games';
    
    return 'Documentation';
  }

  /**
   * Get fallback results when API is unavailable
   * @param {string} query - Search query
   * @returns {Array} Fallback results
   */
  getFallbackResults(query) {
    const searchUrl = `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(query)}`;
    
    return [
      this.createResult(
        `📚 MDN Search: ${query}`,
        searchUrl,
        `Search Mozilla Developer Network documentation for "${query}". Comprehensive web development resources.`,
        { 
          type: 'fallback',
          category: 'Documentation'
        }
      )
    ];
  }

  getSourceName() {
    return 'MDN';
  }
}

module.exports = MDNSearchEngine;
