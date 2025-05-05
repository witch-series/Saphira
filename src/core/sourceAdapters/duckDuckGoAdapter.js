/**
 * DuckDuckGo search adapter for Saphira
 * Fetches search results and extracts content from top sites
 */
const https = require('https');
const http = require('http');
const { JSDOM } = require('jsdom');
const url = require('url');
const axios = require('axios');
const cheerio = require('cheerio');

class DuckDuckGoAdapter {
  constructor(options = {}) {
    this.name = 'DuckDuckGo';
    this.maxResults = options.maxResults || 5; // Default to top 5 results
    this.timeout = options.timeout || 15000; // 15 seconds
    this.userAgent = options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    // Default to an empty array to allow all domains
    this.allowedSources = options.allowedSources || []; 
    this.logger = options.logger || console;
  }

  /**
   * Set allowed source domains
   * @param {Array} sources - List of allowed domain names (e.g., ['wikipedia.org'])
   */
  setAllowedSources(sources) {
    if (Array.isArray(sources)) {
      this.allowedSources = sources;
      this.logger.info(`DuckDuckGo adapter: set allowed sources to [${sources.join(', ')}]`);
    }
  }

  /**
   * Collect data based on search terms
   * @param {Array} searchTerms - Array of search terms/tags
   * @returns {Promise<Array>} - Array of content items
   */
  async collectData(searchTerms) {
    if (!searchTerms || searchTerms.length === 0) {
      return [];
    }

    try {
      // Build search query from search terms
      const query = searchTerms.join(' ');
      this.logger.info(`DuckDuckGo search for: ${query}`);

      // Get search results from DuckDuckGo
      const searchResults = await this.performSearch(query);
      
      if (!searchResults || searchResults.length === 0) {
        this.logger.warn('No search results found');
        return [];
      }
      
      this.logger.info(`Found ${searchResults.length} search results, processing top ${Math.min(this.maxResults, searchResults.length)}`);
      
      // Process each search result (limited to maxResults)
      const contentItems = [];
      const limitedResults = searchResults.slice(0, this.maxResults);
      const processedUrls = new Set(); // Avoid duplicate URLs
      
      for (const result of limitedResults) {
        try {
          // Skip duplicate URLs
          if (processedUrls.has(result.url)) {
            continue;
          }
          processedUrls.add(result.url);
          
          // Check if the source domain is allowed - only if allowedSources has items
          const domain = this.extractDomain(result.url);
          
          // If allowedSources is empty, allow all domains
          const isAllowedDomain = this.allowedSources.length === 0 || 
            this.allowedSources.some(allowedDomain => domain.includes(allowedDomain));
          
          if (!isAllowedDomain) {
            this.logger.debug(`Skipping result from ${domain} - not in allowed sources`);
            continue;
          }
          
          // Check if the URL is valid
          if (!result.url || !result.url.startsWith('http')) {
            this.logger.debug(`Skipping result with invalid URL: ${result.url}`);
            continue;
          }
          
          this.logger.info(`Fetching content from: ${result.url}`);
          
          // Fetch and extract content from the page with error handling
          let pageContent;
          try {
            pageContent = await this.fetchPage(result.url);
            
            // Create more comprehensive content item with enhanced error handling
            contentItems.push({
              title: result.title || 'Untitled',
              sourceUrl: result.url,
              summary: result.snippet || (pageContent ? pageContent.summary : 'No summary available'),
              content: pageContent ? pageContent.content : 'Content could not be retrieved',
              sourceName: domain || 'Unknown source',
              tags: [...searchTerms, 'duckduckgo']
            });
            
            this.logger.debug(`Successfully processed content from ${result.url}`);
            
          } catch (fetchError) {
            this.logger.warn(`Could not fetch content from ${result.url}: ${fetchError.message}`);
            
            // Still include the result with available metadata even if content fetching failed
            contentItems.push({
              title: result.title || 'Untitled',
              sourceUrl: result.url,
              summary: result.snippet || 'Content unavailable',
              content: `Unable to retrieve content: ${fetchError.message}`,
              sourceName: domain || 'Unknown source',
              tags: [...searchTerms, 'duckduckgo', 'fetch_error']
            });
          }
          
        } catch (error) {
          this.logger.error(`Error processing search result ${result.url}:`, error);
        }
      }
      
      return contentItems;
    } catch (error) {
      this.logger.error('Error in DuckDuckGo adapter:', error);
      return [];
    }
  }

  /**
   * Perform a search using DuckDuckGo
   * @param {String} query - Search query
   * @returns {Promise<Array>} - Array of search results
   */
  async performSearch(query) {
    return new Promise((resolve, reject) => {
      // Encode the query for use in URL
      const encodedQuery = encodeURIComponent(query);
      // Use the HTML search page which is more reliable
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;
      
      const options = {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        timeout: this.timeout
      };
      
      this.logger.debug(`Making search request to: ${searchUrl}`);
      
      const req = https.get(searchUrl, options, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`DuckDuckGo search failed with status: ${res.statusCode}`));
          return;
        }
        
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            // Parse the HTML response
            const results = this.parseSearchResults(data);
            this.logger.info(`Successfully parsed ${results.length} search results`);
            resolve(results);
          } catch (error) {
            reject(error);
          }
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Search request timed out'));
      });
    });
  }

  /**
   * Parse DuckDuckGo HTML search results
   * @param {String} html - HTML content
   * @returns {Array} - Array of search results
   */
  parseSearchResults(html) {
    try {
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      // Find all search result elements - DuckDuckGo HTML results use 'results_links' class
      const resultElements = document.querySelectorAll('.result, .results_links');
      const results = [];
      
      this.logger.debug(`Found ${resultElements.length} raw result elements`);
      
      // Extract data from each result element
      for (const element of resultElements) {
        try {
          // Find the title and link - different selectors to be more robust
          const titleElem = element.querySelector('.result__title a, .links_main a');
          if (!titleElem) continue;
          
          // Find the snippet
          const snippetElem = element.querySelector('.result__snippet, .result__body, .links_main + .links_main');
          
          // Get the URL from href attribute
          let resultUrl = titleElem.getAttribute('href') || '';
          
          // Extract target URL from DuckDuckGo redirect links
          try {
            if (resultUrl.includes('/l/?uddg=') || resultUrl.includes('&uddg=')) {
              // Extract via regex pattern
              const urlMatch = resultUrl.match(/[?&]uddg=([^&]+)/);
              if (urlMatch && urlMatch[1]) {
                resultUrl = decodeURIComponent(urlMatch[1]);
              }
            } else if (resultUrl.startsWith('/')) {
              // Handle relative URLs
              resultUrl = 'https://duckduckgo.com' + resultUrl;
              
              // Try to extract the actual URL from the constructed DuckDuckGo URL
              try {
                const parsedDdgUrl = new URL(resultUrl);
                const targetParam = parsedDdgUrl.searchParams.get('uddg');
                if (targetParam) {
                  resultUrl = decodeURIComponent(targetParam);
                }
              } catch (urlParseError) {
                this.logger.warn(`Failed to parse DuckDuckGo redirect URL: ${urlParseError.message}`);
              }
            }
          } catch (extractionError) {
            this.logger.warn(`URL extraction error: ${extractionError.message}`);
          }
          
          // Check if the URL is valid
          let isValidUrl = false;
          try {
            const parsedUrl = new URL(resultUrl);
            isValidUrl = ['http:', 'https:'].includes(parsedUrl.protocol);
          } catch (e) {
            isValidUrl = false;
          }
          
          // Add only valid URLs to the results
          if (isValidUrl) {
            results.push({
              title: titleElem.textContent.trim(),
              url: resultUrl,
              snippet: snippetElem ? snippetElem.textContent.trim() : ''
            });
          }
        } catch (elementError) {
          this.logger.warn(`Error processing search result element: ${elementError.message}`);
        }
      }
      
      return results;
    } catch (error) {
      this.logger.error('Error parsing search results:', error);
      return [];
    }
  }

  /**
   * Extract domain name from a URL
   * @param {String} url - URL to extract domain from
   * @returns {String} - Domain name
   */
  extractDomain(url) {
    try {
      if (!url) return null;
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch (error) {
      this.logger.error(`Error extracting domain from ${url}:`, error);
      return null;
    }
  }
  
  /**
   * Fetch a web page and extract its content
   * @param {String} url - URL to fetch
   * @returns {Promise<Object>} - Object with content and summary
   */
  async fetchPage(url) {
    if (!url) throw new Error('URL is required');
    
    try {
      this.logger.info(`Fetching page content for: ${url}`);
      
      // Use axios to get the page content
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 10000  // 10 second timeout
      });
      
      // Check if the response is HTML
      const contentType = response.headers['content-type'] || '';
      if (!contentType.includes('text/html')) {
        throw new Error(`Unsupported content type: ${contentType}`);
      }
      
      const html = response.data;
      
      // Use cheerio to extract the text content
      const $ = cheerio.load(html);
      
      // Remove script and style elements
      $('script, style, nav, footer, header, aside, iframe').remove();
      
      // Get the text from the body
      const bodyText = $('body').text().trim()
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, '\n')
        .trim();
      
      // Create a simple summary (first 200 characters)
      const summary = bodyText.slice(0, 200) + (bodyText.length > 200 ? '...' : '');
      
      return {
        content: bodyText,
        summary
      };
    } catch (error) {
      this.logger.error(`Error fetching page ${url}:`, error);
      throw error;
    }
  }

  /**
   * Scrape the top search results from DuckDuckGo and fetch their content
   * @param {String} query - Search query
   * @param {Number} numResults - Number of results to fetch (default: 5)
   * @returns {Promise<Array>} - Array of search result objects with content
   */
  async scrapeTopResults(query, numResults = 5) {
    if (!query) throw new Error('Query is required');

    try {
      this.logger.info(`Scraping top ${numResults} results for query: "${query}"`);
      
      // First, get the search results
      const searchResults = await this.performSearch(query);
      
      // Limit the number of results to process
      const limitedResults = searchResults.slice(0, numResults);
      
      if (!limitedResults || !Array.isArray(limitedResults) || limitedResults.length === 0) {
        return [];
      }
      
      // Process each result to add content
      const detailedResults = await Promise.all(limitedResults.map(async (result) => {
        try {
          if (!result.url) return { ...result, content: null, error: 'No URL provided' };
          
          // Extract the domain before fetching (in case fetch fails)
          const domain = this.extractDomain(result.url);
          
          // Fetch and add content
          const { content, summary } = await this.fetchPage(result.url);
          
          return {
            ...result,
            domain,
            content,
            summary,
            scrapedAt: new Date().toISOString()
          };
        } catch (error) {
          this.logger.error(`Error fetching content for ${result.url}:`, error);
          return {
            ...result,
            domain: this.extractDomain(result.url),
            content: null,
            summary: null,
            error: error.message,
            scrapedAt: new Date().toISOString()
          };
        }
      }));
      
      // Filter out results without content, unless that would return an empty array
      const validResults = detailedResults.filter(r => r.content !== null);
      return validResults.length > 0 ? validResults : detailedResults;
      
    } catch (error) {
      this.logger.error(`Error scraping top results for "${query}":`, error);
      throw error;
    }
  }
}

module.exports = DuckDuckGoAdapter;