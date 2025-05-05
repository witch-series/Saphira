/**
 * GitHubAdapter collects information from GitHub repositories and topics
 * Documentation: https://docs.github.com/en/rest
 * 
 * This adapter can work without authentication, but has strict rate limits.
 * For higher rate limits, provide a GitHub personal access token.
 */

const https = require('https');

class GitHubAdapter {
  constructor(options = {}) {
    this.name = 'GitHub';
    this.apiKey = options.apiKey || ''; // GitHub personal access token
    this.endpoint = options.endpoint || 'https://api.github.com';
    this.maxResults = options.maxResults || 5;
    this.logger = options.logger || console;
    
    if (!this.apiKey) {
      this.logger.warn('GitHubAdapter initialized without an API token. Rate limits will be strict.');
    }
  }
  
  /**
   * Fetch content based on interest tags
   * @param {Array} interests - Array of interest tags
   * @returns {Promise<Array>} - Array of raw content items
   */
  async fetchContent(interests) {
    const results = [];
    
    this.logger.info(`Searching GitHub for interests: ${interests.join(', ')}`);
    
    for (const interest of interests) {
      try {
        this.logger.debug(`Fetching GitHub repositories for: ${interest}`);
        
        // Search for repositories related to the interest
        const repositories = await this._searchRepositories(interest);
        
        for (const repo of repositories.slice(0, this.maxResults)) {
          try {
            // Get the README content for each repository
            const readme = await this._fetchRepositoryReadme(repo.owner.login, repo.name);
            
            if (readme) {
              results.push({
                title: `${repo.name} - GitHub Repository`,
                author: repo.owner.login,
                url: repo.html_url,
                content: readme.content,
                publishedDate: repo.created_at,
                tags: [interest, 'github', 'repository', 'code'],
                category: 'code',
                sourceName: 'GitHub',
                metadata: {
                  stars: repo.stargazers_count,
                  forks: repo.forks_count,
                  language: repo.language,
                  description: repo.description
                }
              });
            }
          } catch (repoError) {
            this.logger.error(`Error fetching README for repository "${repo.full_name}":`, repoError);
          }
        }
      } catch (error) {
        this.logger.error(`Error searching GitHub for ${interest}:`, error);
      }
    }
    
    this.logger.info(`GitHubAdapter found ${results.length} results`);
    return results;
  }
  
  /**
   * Search GitHub for repositories related to the query
   * @private
   * @param {string} query - The search query
   * @returns {Promise<Array>} - Array of repository objects
   */
  async _searchRepositories(query) {
    return new Promise((resolve, reject) => {
      // Build the API URL with query parameters
      const apiUrl = new URL(`${this.endpoint}/search/repositories`);
      apiUrl.searchParams.append('q', query);
      apiUrl.searchParams.append('sort', 'stars');
      apiUrl.searchParams.append('order', 'desc');
      apiUrl.searchParams.append('per_page', this.maxResults);
      
      const options = {
        headers: {
          'User-Agent': 'Saphira-Information-Collector',
          'Accept': 'application/vnd.github.v3+json'
        }
      };
      
      // Add authorization header if API key is provided
      if (this.apiKey) {
        options.headers['Authorization'] = `token ${this.apiKey}`;
      }
      
      this.logger.debug(`Making GitHub API request: ${apiUrl.toString()}`);
      
      // Make the HTTP request
      const req = https.get(apiUrl, options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          // Check for rate limit headers
          const rateLimit = res.headers['x-ratelimit-limit'];
          const rateRemaining = res.headers['x-ratelimit-remaining'];
          const rateReset = res.headers['x-ratelimit-reset'];
          
          if (rateRemaining && parseInt(rateRemaining) < 10) {
            this.logger.warn(`GitHub API rate limit running low: ${rateRemaining}/${rateLimit}. Resets at ${new Date(rateReset * 1000).toLocaleString()}`);
          }
          
          if (res.statusCode === 200) {
            try {
              const parsedData = JSON.parse(data);
              
              if (parsedData.items && Array.isArray(parsedData.items)) {
                this.logger.debug(`Found ${parsedData.items.length} GitHub repositories for "${query}"`);
                resolve(parsedData.items);
              } else {
                resolve([]);
              }
            } catch (e) {
              reject(new Error(`Failed to parse GitHub API response: ${e.message}`));
            }
          } else if (res.statusCode === 403 && res.headers['x-ratelimit-remaining'] === '0') {
            reject(new Error(`GitHub API rate limit exceeded. Resets at ${new Date(rateReset * 1000).toLocaleString()}`));
          } else {
            reject(new Error(`GitHub API request failed with status code: ${res.statusCode}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`GitHub API request error: ${error.message}`));
      });
      
      req.end();
    });
  }
  
  /**
   * Fetch the README content for a repository
   * @private
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Object|null>} - README object or null if not found
   */
  async _fetchRepositoryReadme(owner, repo) {
    return new Promise((resolve, reject) => {
      // Build the API URL
      const apiUrl = new URL(`${this.endpoint}/repos/${owner}/${repo}/readme`);
      
      const options = {
        headers: {
          'User-Agent': 'Saphira-Information-Collector',
          'Accept': 'application/vnd.github.v3+json'
        }
      };
      
      // Add authorization header if API key is provided
      if (this.apiKey) {
        options.headers['Authorization'] = `token ${this.apiKey}`;
      }
      
      this.logger.debug(`Making GitHub API request for README: ${apiUrl.toString()}`);
      
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
              
              if (parsedData.content) {
                // GitHub returns content as base64 encoded
                const content = Buffer.from(parsedData.content, 'base64').toString('utf8');
                resolve({
                  name: parsedData.name,
                  path: parsedData.path,
                  content: content
                });
              } else {
                resolve(null);
              }
            } catch (e) {
              reject(new Error(`Failed to parse GitHub README response: ${e.message}`));
            }
          } else if (res.statusCode === 404) {
            // README not found, but this is not an error
            resolve(null);
          } else {
            reject(new Error(`GitHub README request failed with status code: ${res.statusCode}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`GitHub README request error: ${error.message}`));
      });
      
      req.end();
    });
  }
}

module.exports = GitHubAdapter;