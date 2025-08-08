/**
 * OpenLibrary Search Engine
 * 
 * Implements OpenLibrary book search functionality.
 */

const https = require('https');
const { URL } = require('url');
const BaseSearchEngine = require('./BaseSearchEngine');

class OpenLibrarySearchEngine extends BaseSearchEngine {
  constructor(options = {}) {
    super(options);
    this.baseUrl = 'https://openlibrary.org';
    this.userAgent = 'Saphira-Search/1.0';
  }

  /**
   * Search OpenLibrary for books
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Book search results
   */
  async search(query, options = {}) {
    this.validateQuery(query);
    
    const maxResults = options.maxResults || this.maxResults;
    const searchUrl = `${this.baseUrl}/search.json?q=${encodeURIComponent(query)}&limit=${Math.min(maxResults, 100)}`;
    
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
              
              if (parsed.docs && parsed.docs.length > 0) {
                parsed.docs.slice(0, maxResults).forEach(book => {
                  results.push(this.createResult(
                    `📚 ${book.title}`,
                    `${this.baseUrl}${book.key}`,
                    this.formatBookDescription(book),
                    {
                      type: 'book',
                      authors: book.author_name || [],
                      publishYear: book.first_publish_year || null,
                      isbn: book.isbn || [],
                      subjects: book.subject || []
                    }
                  ));
                });
              }
              
              this.logSearchOperation(query, results.length);
              resolve(results);
            } else {
              resolve([]);
            }
          } catch (error) {
            this.handleError(error, query);
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('OpenLibrary search timeout'));
      });

      req.on('error', (error) => {
        this.handleError(error, query);
      });
      
      req.end();
    });
  }

  /**
   * Format book description from OpenLibrary data
   * @param {Object} book - Book data from OpenLibrary
   * @returns {string} Formatted description
   */
  formatBookDescription(book) {
    const parts = [];
    
    if (book.author_name && book.author_name.length > 0) {
      parts.push(`Author: ${book.author_name.join(', ')}`);
    } else {
      parts.push('Author: Unknown');
    }
    
    if (book.first_publish_year) {
      parts.push(`Published: ${book.first_publish_year}`);
    }
    
    if (book.subject && book.subject.length > 0) {
      const subjects = book.subject.slice(0, 3).join(', ');
      parts.push(`Subjects: ${subjects}`);
    }
    
    if (book.edition_count && book.edition_count > 1) {
      parts.push(`${book.edition_count} editions`);
    }
    
    return parts.join('. ') || 'No description available';
  }

  getSourceName() {
    return 'OpenLibrary';
  }
}

module.exports = OpenLibrarySearchEngine;
