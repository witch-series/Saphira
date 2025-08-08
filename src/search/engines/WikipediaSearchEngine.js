/**
 * Wikipedia Search Engine
 * 
 * Implements Wikipedia search functionality using both exact match and search APIs.
 */

const https = require('https');
const { URL } = require('url');
const BaseSearchEngine = require('./BaseSearchEngine');

class WikipediaSearchEngine extends BaseSearchEngine {
  constructor(options = {}) {
    super(options);
    this.baseUrl = 'https://en.wikipedia.org';
    this.userAgent = 'Saphira-Search/1.0 (https://example.com)';
  }

  /**
   * Search Wikipedia for articles
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Wikipedia search results
   */
  async search(query, options = {}) {
    this.validateQuery(query);
    
    const maxResults = options.maxResults || this.maxResults;
    const results = [];
    
    try {
      // First try exact match
      const exactResult = await this.searchSingle(query);
      if (exactResult.length > 0) {
        results.push(...exactResult);
      }
    } catch (error) {
      this.logger.debug('Wikipedia exact match failed, continuing with search...');
    }

    try {
      // Then try search API for multiple results
      const searchResults = await this.searchMultiple(query, maxResults);
      results.push(...searchResults);
    } catch (error) {
      this.logger.debug('Wikipedia multiple search failed:', error.message);
    }

    // Remove duplicates and limit results
    const uniqueResults = this.deduplicateResults(results);
    const finalResults = uniqueResults.slice(0, maxResults);
    
    this.logSearchOperation(query, finalResults.length);
    return finalResults;
  }

  /**
   * Search for a single Wikipedia page (exact match)
   * @param {string} query - Search query
   * @returns {Promise<Array>} Single page result
   */
  async searchSingle(query) {
    const searchUrl = `${this.baseUrl}/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
    
    return new Promise((resolve, reject) => {
      const url = new URL(searchUrl);
      
      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
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
              resolve([this.createResult(
                parsed.title,
                parsed.content_urls.desktop.page,
                parsed.extract || 'No summary available',
                { 
                  type: 'exact_match',
                  thumbnail: parsed.thumbnail?.source || null
                }
              )]);
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
        reject(new Error('Wikipedia single search timeout'));
      });

      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Search for multiple Wikipedia pages
   * @param {string} query - Search query
   * @param {number} maxResults - Maximum results to return
   * @returns {Promise<Array>} Multiple search results
   */
  async searchMultiple(query, maxResults = 20) {
    const searchUrl = `${this.baseUrl}/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=${maxResults}&namespace=0&format=json`;
    
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
              
              if (parsed.length >= 4) {
                const titles = parsed[1];
                const descriptions = parsed[2];
                const urls = parsed[3];
                
                for (let i = 0; i < titles.length; i++) {
                  results.push(this.createResult(
                    titles[i],
                    urls[i],
                    descriptions[i] || 'No description available',
                    { type: 'search_result' }
                  ));
                }
              }
              
              resolve(results);
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
        reject(new Error('Wikipedia multiple search timeout'));
      });

      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Remove duplicate results based on URL
   * @param {Array} results - Search results
   * @returns {Array} Deduplicated results
   */
  deduplicateResults(results) {
    const seen = new Set();
    return results.filter(result => {
      if (seen.has(result.url)) {
        return false;
      }
      seen.add(result.url);
      return true;
    });
  }

  getSourceName() {
    return 'Wikipedia';
  }
}

module.exports = WikipediaSearchEngine;
