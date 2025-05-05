/**
 * WikipediaAdapter collects information from Wikipedia articles
 * Documentation: https://www.mediawiki.org/wiki/API:Main_page
 * 
 * This adapter does not require an API key and provides encyclopedic
 * knowledge on a wide range of topics.
 */

const https = require('https');

class WikipediaAdapter {
  constructor(options = {}) {
    this.name = 'Wikipedia';
    this.language = options.language || 'en';
    this.endpoint = options.endpoint || `https://${this.language}.wikipedia.org/w/api.php`;
    this.maxResults = options.maxResults || 3;
    this.logger = options.logger || console;
  }
  
  /**
   * Fetch content based on interest tags
   * @param {Array} interests - Array of interest tags
   * @returns {Promise<Array>} - Array of raw content items
   */
  async fetchContent(interests) {
    const results = [];
    
    this.logger.info(`Searching Wikipedia for interests: ${interests.join(', ')}`);
    
    for (const interest of interests) {
      try {
        this.logger.debug(`Fetching Wikipedia articles for: ${interest}`);
        
        // First search for relevant articles
        const searchResults = await this._searchWikipedia(interest);
        
        for (const page of searchResults.slice(0, this.maxResults)) {
          try {
            // Then get the full content of each article
            const article = await this._fetchArticleContent(page.title);
            
            if (article) {
              results.push({
                title: article.title,
                author: 'Wikipedia Contributors',
                url: `https://${this.language}.wikipedia.org/wiki/${encodeURIComponent(article.title.replace(/ /g, '_'))}`,
                sourceUrl: `https://${this.language}.wikipedia.org/wiki/${encodeURIComponent(article.title.replace(/ /g, '_'))}`,
                content: article.extract,
                summary: article.extract.substring(0, 200) + '...',
                publishedDate: new Date().toISOString(),
                date: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                tags: [interest, 'encyclopedia', 'reference'],
                category: 'reference',
                sourceName: 'Wikipedia',
                source: 'Wikipedia',
                id: require('crypto').createHash('md5').update(article.title).digest('hex')
              });
            }
          } catch (articleError) {
            this.logger.error(`Error fetching Wikipedia article "${page.title}":`, articleError);
          }
        }
      } catch (error) {
        this.logger.error(`Error searching Wikipedia for ${interest}:`, error);
      }
    }
    
    this.logger.info(`WikipediaAdapter found ${results.length} results`);
    return results;
  }
  
  /**
   * Search Wikipedia for articles related to the query
   * @private
   * @param {string} query - The search query
   * @returns {Promise<Array>} - Array of search result objects
   */
  async _searchWikipedia(query) {
    return new Promise((resolve, reject) => {
      // Build the API URL with query parameters
      const apiUrl = new URL(this.endpoint);
      apiUrl.searchParams.append('action', 'query');
      apiUrl.searchParams.append('list', 'search');
      apiUrl.searchParams.append('srsearch', query);
      apiUrl.searchParams.append('format', 'json');
      apiUrl.searchParams.append('srlimit', this.maxResults);
      
      this.logger.debug(`Making Wikipedia search API request: ${apiUrl.toString()}`);
      
      // Make the HTTP request
      const req = https.get(apiUrl, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const parsedData = JSON.parse(data);
              
              if (parsedData.query && parsedData.query.search) {
                this.logger.debug(`Found ${parsedData.query.search.length} Wikipedia search results for "${query}"`);
                resolve(parsedData.query.search);
              } else {
                resolve([]);
              }
            } catch (e) {
              reject(new Error(`Failed to parse Wikipedia search response: ${e.message}`));
            }
          } else {
            reject(new Error(`Wikipedia search request failed with status code: ${res.statusCode}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`Wikipedia search request error: ${error.message}`));
      });
      
      req.end();
    });
  }
  
  /**
   * Fetch the content of a Wikipedia article
   * @private
   * @param {string} title - The title of the article
   * @returns {Promise<Object|null>} - Article object or null if not found
   */
  async _fetchArticleContent(title) {
    return new Promise((resolve, reject) => {
      // Build the API URL with query parameters
      const apiUrl = new URL(this.endpoint);
      apiUrl.searchParams.append('action', 'query');
      apiUrl.searchParams.append('prop', 'extracts');
      apiUrl.searchParams.append('exintro', '1'); // Get only the intro section
      apiUrl.searchParams.append('explaintext', '1'); // Get plain text content
      apiUrl.searchParams.append('titles', title);
      apiUrl.searchParams.append('format', 'json');
      
      this.logger.debug(`Making Wikipedia content API request for "${title}"`);
      
      // Make the HTTP request
      const req = https.get(apiUrl, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const parsedData = JSON.parse(data);
              
              if (parsedData.query && parsedData.query.pages) {
                const pages = parsedData.query.pages;
                // There should be only one page, but we don't know the ID
                const pageId = Object.keys(pages)[0];
                
                if (pageId !== '-1') { // -1 indicates page not found
                  const page = pages[pageId];
                  resolve({
                    title: page.title,
                    extract: page.extract
                  });
                } else {
                  resolve(null);
                }
              } else {
                resolve(null);
              }
            } catch (e) {
              reject(new Error(`Failed to parse Wikipedia content response: ${e.message}`));
            }
          } else {
            reject(new Error(`Wikipedia content request failed with status code: ${res.statusCode}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`Wikipedia content request error: ${error.message}`));
      });
      
      req.end();
    });
  }
}

module.exports = WikipediaAdapter;