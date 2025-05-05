/**
 * ArxivAdapter collects information from academic papers using the arXiv API
 * Documentation: https://arxiv.org/help/api/
 * 
 * This adapter does not require an API key and is suitable for retrieving
 * scientific and academic papers across various disciplines.
 */

const https = require('https');
const { XMLParser } = require('fast-xml-parser');

class ArxivAdapter {
  constructor(options = {}) {
    this.name = 'Academic Papers';
    this.endpoint = options.endpoint || 'https://export.arxiv.org/api/query';
    this.maxResults = options.maxResults || 5;
    this.logger = options.logger || console;
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });
  }
  
  /**
   * Fetch content based on interest tags
   * @param {Array} interests - Array of interest tags
   * @returns {Promise<Array>} - Array of raw content items
   */
  async fetchContent(interests) {
    const results = [];
    
    this.logger.info(`Searching arXiv for papers on: ${interests.join(', ')}`);
    
    for (const interest of interests) {
      try {
        this.logger.debug(`Fetching academic papers for tag: ${interest}`);
        
        // Call arXiv API to search for papers
        const papers = await this._searchPapers(interest);
        
        for (const paper of papers) {
          results.push({
            title: paper.title.replace(/\s+/g, ' ').trim(),
            author: this._formatAuthors(paper.authors),
            // Fix URL format - convert raw ID to proper arXiv web URL
            url: `https://arxiv.org/abs/${paper.id.split('/').pop()}`,
            content: paper.summary.replace(/\s+/g, ' ').trim(),
            publishedDate: paper.published,
            tags: [interest, 'academic', 'paper'],
            category: 'academic',
            sourceName: 'arXiv'
          });
        }
      } catch (error) {
        this.logger.error(`Error fetching papers for tag ${interest}:`, error);
      }
    }
    
    this.logger.info(`ArxivAdapter found ${results.length} results`);
    return results;
  }
  
  /**
   * Call arXiv API to search for papers
   * @private
   * @param {string} query - The search query
   * @returns {Promise<Array>} - Array of paper objects
   */
  async _searchPapers(query) {
    return new Promise((resolve, reject) => {
      // Build the API URL with query parameters
      const apiUrl = new URL(this.endpoint);
      apiUrl.searchParams.append('search_query', `all:${query}`);
      apiUrl.searchParams.append('start', 0);
      apiUrl.searchParams.append('max_results', this.maxResults);
      apiUrl.searchParams.append('sortBy', 'relevance');
      apiUrl.searchParams.append('sortOrder', 'descending');
      
      this.logger.debug(`Making API request to: ${apiUrl.toString()}`);
      
      // Make the HTTP request
      const req = https.get(apiUrl, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const papers = this._parseArxivResponse(data);
              this.logger.debug(`Received ${papers.length} papers from arXiv`);
              resolve(papers);
            } catch (e) {
              reject(new Error(`Failed to parse arXiv response: ${e.message}`));
            }
          } else {
            reject(new Error(`arXiv API request failed with status code: ${res.statusCode}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`arXiv API request error: ${error.message}`));
      });
      
      req.end();
    });
  }
  
  /**
   * Parse the XML response from arXiv API
   * @private
   * @param {string} xmlData - XML response from arXiv API
   * @returns {Array} - Array of paper objects
   */
  _parseArxivResponse(xmlData) {
    try {
      const result = this.xmlParser.parse(xmlData);
      
      if (!result.feed || !result.feed.entry) {
        return [];
      }
      
      // Handle both single entry and multiple entries
      const entries = Array.isArray(result.feed.entry) 
        ? result.feed.entry 
        : [result.feed.entry];
      
      return entries.map(entry => {
        return {
          id: entry.id,
          title: entry.title,
          authors: this._extractAuthors(entry),
          summary: entry.summary,
          published: entry.published,
          updated: entry.updated,
          categories: this._extractCategories(entry)
        };
      });
    } catch (error) {
      this.logger.error('Error parsing arXiv XML response:', error);
      return [];
    }
  }
  
  /**
   * Extract author information from an entry
   * @private
   * @param {Object} entry - arXiv entry object
   * @returns {Array} - Array of author objects
   */
  _extractAuthors(entry) {
    if (!entry.author) return [];
    
    // Handle both single author and multiple authors
    const authors = Array.isArray(entry.author) 
      ? entry.author 
      : [entry.author];
    
    return authors.map(author => {
      return {
        name: author.name
      };
    });
  }
  
  /**
   * Extract category information from an entry
   * @private
   * @param {Object} entry - arXiv entry object
   * @returns {Array} - Array of category strings
   */
  _extractCategories(entry) {
    if (!entry.category) return [];
    
    // Handle both single category and multiple categories
    const categories = Array.isArray(entry.category) 
      ? entry.category 
      : [entry.category];
    
    return categories.map(category => {
      return category['@_term'];
    }).filter(Boolean);
  }
  
  /**
   * Format authors list into a string
   * @private
   * @param {Array} authors - Array of author objects
   * @returns {string} - Formatted authors string
   */
  _formatAuthors(authors) {
    if (!authors || !authors.length) return 'Unknown';
    
    const authorNames = authors.map(author => author.name);
    
    if (authorNames.length === 1) {
      return authorNames[0];
    } else if (authorNames.length === 2) {
      return `${authorNames[0]} and ${authorNames[1]}`;
    } else {
      return `${authorNames[0]} et al.`;
    }
  }
}

module.exports = ArxivAdapter;