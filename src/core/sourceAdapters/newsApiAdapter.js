/**
 * NewsApiAdapter collects information from news articles using the NewsAPI service
 * Documentation: https://newsapi.org/docs/endpoints
 * 
 * This adapter requires a NewsAPI API key, which can be obtained for free from:
 * https://newsapi.org/register
 */

const https = require('https');
const axios = require('axios');
const path = require('path');

class NewsApiAdapter {
  constructor(options = {}) {
    this.name = 'News Articles';
    this.apiKey = options.apiKey || process.env.NEWS_API_KEY || '';
    this.endpoint = options.endpoint || 'https://newsapi.org/v2';
    this.maxResults = options.maxResults || 10;
    this.logger = options.logger || console;
    this.axios = axios.create({
      timeout: 10000, // 10 second timeout
      headers: {
        'User-Agent': 'Saphira/1.0'
      }
    });
    
    if (!this.apiKey) {
      this.logger.warn('NewsApiAdapter initialized without an API key. API calls will fail.');
    }
  }
  
  /**
   * Fetch content based on interest tags
   * @param {Array} interests - Array of interest tags
   * @returns {Promise<Array>} - Array of raw content items
   */
  async fetchContent(interests) {
    const results = [];
    
    // Return an error message if the API key is missing
    if (!this.apiKey) {
      this.logger.error('NewsAPI key is missing. Please set up a NewsAPI key in user/api-keys.json or as NEWS_API_KEY environment variable');
      throw new Error('NewsAPI key is required. Get one from https://newsapi.org/register and add it to user/api-keys.json');
    }
    
    this.logger.info(`Searching news for interests: ${interests.join(', ')}`);
    
    for (const interest of interests) {
      try {
        this.logger.debug(`Fetching news content for tag: ${interest}`);
        
        // Call NewsAPI to search for articles
        const articles = await this._searchArticles(interest);
        
        if (!articles || articles.length === 0) {
          this.logger.warn(`No articles found for interest: ${interest}`);
          continue;
        }
        
        this.logger.info(`Found ${articles.length} articles for interest: ${interest}`);
        
        for (const article of articles) {
          // Ensure URL is properly formatted
          let url = article.url;
          if (url && !url.startsWith('http')) {
            url = `https://${url}`;
          }
          
          // Check if URL is valid before adding to results
          if (!url) {
            this.logger.debug('Skipping article with invalid URL');
            continue;
          }
          
          try {
            // Try to fetch the full article content if available
            let content = article.content || article.description || '';
            
            // If the content is truncated (as it usually is with NewsAPI free tier)
            if (content.includes('[+') || content.length < 200) {
              try {
                // Try to fetch more complete content from the source
                const fetchedContent = await this._fetchArticleContent(url);
                if (fetchedContent && fetchedContent.trim().length > content.length) {
                  content = fetchedContent;
                }
              } catch (fetchError) {
                this.logger.debug(`Could not fetch additional content from ${url}: ${fetchError.message}`);
                // Continue with the original content
              }
            }
            
            results.push({
              title: article.title,
              author: article.author || 'Unknown',
              url: url,
              content: content,
              publishedDate: article.publishedAt,
              tags: [interest, 'news'],
              category: 'news',
              sourceName: article.source?.name || 'News Source'
            });
          } catch (articleError) {
            this.logger.error(`Error processing article ${url}: ${articleError.message}`);
          }
        }
      } catch (error) {
        this.logger.error(`Error fetching news for tag ${interest}:`, error);
      }
    }
    
    this.logger.info(`NewsApiAdapter found ${results.length} results`);
    return results;
  }
  
  /**
   * Call NewsAPI to search for articles
   * @private
   * @param {string} query - The search query
   * @returns {Promise<Array>} - Array of article objects
   */
  async _searchArticles(query) {
    try {
      // Try using axios first for more reliable requests
      const apiUrl = new URL(`${this.endpoint}/everything`);
      apiUrl.searchParams.append('q', query);
      apiUrl.searchParams.append('language', 'en');
      apiUrl.searchParams.append('sortBy', 'relevancy');
      apiUrl.searchParams.append('pageSize', this.maxResults);
      
      this.logger.debug(`Making API request to: ${apiUrl.toString()}`);
      
      const response = await this.axios.get(apiUrl.toString(), {
        headers: {
          'X-Api-Key': this.apiKey
        }
      });
      
      if (response.status === 200 && response.data.status === 'ok') {
        this.logger.debug(`Received ${response.data.articles?.length || 0} articles from NewsAPI`);
        return response.data.articles || [];
      } else {
        throw new Error(`NewsAPI returned error: ${response.data.message || 'Unknown error'}`);
      }
    } catch (axiosError) {
      this.logger.warn(`Axios request failed: ${axiosError.message}, trying with https module`);
      
      // Fall back to https module if axios fails
      return new Promise((resolve, reject) => {
        // Build the API URL with query parameters
        const apiUrl = new URL(`${this.endpoint}/everything`);
        apiUrl.searchParams.append('q', query);
        apiUrl.searchParams.append('language', 'en');
        apiUrl.searchParams.append('sortBy', 'relevancy');
        apiUrl.searchParams.append('pageSize', this.maxResults);
        
        const options = {
          headers: {
            'X-Api-Key': this.apiKey
          }
        };
        
        this.logger.debug(`Making fallback API request to: ${apiUrl.toString()}`);
        
        // Make the HTTP request
        const req = https.get(apiUrl, options, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            if (res.statusCode === 200) {
              try {
                const parsedData = JSON.parse(data);
                
                if (parsedData.status === 'ok') {
                  this.logger.debug(`Received ${parsedData.articles?.length || 0} articles from NewsAPI`);
                  resolve(parsedData.articles || []);
                } else {
                  reject(new Error(`NewsAPI returned error: ${parsedData.message || 'Unknown error'}`));
                }
              } catch (e) {
                reject(new Error(`Failed to parse NewsAPI response: ${e.message}`));
              }
            } else if (res.statusCode === 401) {
              reject(new Error('Invalid API key. Please check your NewsAPI key.'));
            } else if (res.statusCode === 429) {
              reject(new Error('Exceeded NewsAPI request limit. Please try again later.'));
            } else {
              reject(new Error(`NewsAPI request failed with status code: ${res.statusCode}`));
            }
          });
        });
        
        req.on('error', (error) => {
          reject(new Error(`NewsAPI request error: ${error.message}`));
        });
        
        // Set timeout
        req.setTimeout(10000, () => {
          req.abort();
          reject(new Error('NewsAPI request timed out after 10 seconds'));
        });
        
        req.end();
      });
    }
  }
  
  /**
   * Fetches additional content from an article URL
   * @private
   * @param {string} url - URL of the article
   * @returns {Promise<string>} - Article content
   */
  async _fetchArticleContent(url) {
    try {
      const { JSDOM } = require('jsdom');
      
      // Attempt to fetch page content
      const response = await this.axios.get(url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      const dom = new JSDOM(response.data);
      const document = dom.window.document;
      
      // Common article content selectors
      const contentSelectors = [
        'article', 
        '.article-content', 
        '.article-body', 
        '.story-body', 
        '.entry-content',
        '.post-content',
        '#article-body',
        '[itemprop="articleBody"]'
      ];
      
      // Try to find the content using the selectors
      let contentElement = null;
      for (const selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          contentElement = element;
          break;
        }
      }
      
      // Fall back to main or body if no specific article container found
      if (!contentElement) {
        contentElement = document.querySelector('main') || document.body;
      }
      
      // Remove unwanted elements
      const unwantedSelectors = [
        'script', 'style', 'nav', 'header', 'footer', 
        '.ad', '.ads', '.advertisement', '.social-share',
        '.related-articles', '.comments', '.newsletter'
      ];
      
      for (const selector of unwantedSelectors) {
        const elements = contentElement.querySelectorAll(selector);
        for (const element of elements) {
          element.remove();
        }
      }
      
      // Extract text content
      let content = contentElement.textContent
        .replace(/\s+/g, ' ')
        .trim();
      
      return content;
    } catch (error) {
      this.logger.debug(`Error fetching article content: ${error.message}`);
      return '';
    }
  }
}

module.exports = NewsApiAdapter;