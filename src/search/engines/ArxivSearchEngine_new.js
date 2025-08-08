/**
 * arXiv Search Engine
 * 
 * Implements arXiv academic paper search functionality using the arXiv API directly.
 */

const BaseSearchEngine = require('./BaseSearchEngine');
const https = require('https');
const { parseStringPromise } = require('xml2js');

class ArxivSearchEngine extends BaseSearchEngine {
  constructor(options = {}) {
    super(options);
    this.baseUrl = 'https://export.arxiv.org/api/query';
  }

  /**
   * Search arXiv using the official arXiv API
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} arXiv search results
   */
  async search(query, options = {}) {
    this.validateQuery(query);
    
    const maxResults = options.maxResults || this.maxResults;
    
    try {
      // Build search URL
      const searchParams = new URLSearchParams({
        search_query: `all:${query}`,
        start: '0',
        max_results: maxResults.toString(),
        sortBy: 'relevance',
        sortOrder: 'descending'
      });
      
      const url = `${this.baseUrl}?${searchParams}`;
      this.logger.debug(`arXiv API request: ${url}`);
      
      // Make API request
      const xmlData = await this.makeHttpsRequest(url);
      
      // Parse XML response
      const parsed = await parseStringPromise(xmlData);
      const entries = parsed.feed?.entry || [];
      
      // Convert to our standard format
      const results = entries.map(entry => {
        const title = Array.isArray(entry.title) ? entry.title[0] : entry.title;
        const summary = Array.isArray(entry.summary) ? entry.summary[0] : entry.summary;
        const id = Array.isArray(entry.id) ? entry.id[0] : entry.id;
        const authors = entry.author ? entry.author.map(a => a.name?.[0] || a.name) : [];
        const categories = entry.category ? entry.category.map(c => c.$.term) : [];
        
        return this.createResult(
          title,
          id,
          summary,
          {
            type: 'academic_paper',
            source: 'arxiv',
            categories: categories,
            authors: authors,
            publishedDate: entry.published?.[0] || null,
            updatedDate: entry.updated?.[0] || null
          }
        );
      });
      
      this.logSearchOperation(query, results.length);
      return results.slice(0, maxResults);
      
    } catch (error) {
      this.handleError(error, query);
      return [];
    }
  }

  /**
   * Make HTTPS request and return response as string
   * @param {string} url - Request URL
   * @returns {Promise<string>} Response data
   */
  makeHttpsRequest(url) {
    return new Promise((resolve, reject) => {
      const request = https.get(url, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          }
        });
      });
      
      request.on('error', (error) => {
        reject(error);
      });
      
      request.setTimeout(this.timeout, () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  getSourceName() {
    return 'arXiv';
  }
}

module.exports = ArxivSearchEngine;
