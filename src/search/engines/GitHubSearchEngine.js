/**
 * GitHub Search Engine
 * 
 * Implements GitHub repository and code search functionality using GitHub's public API.
 * No API key required for basic searches, but rate limited.
 */

const https = require('https');
const { URL } = require('url');
const BaseSearchEngine = require('./BaseSearchEngine');

class GitHubSearchEngine extends BaseSearchEngine {
  constructor(options = {}) {
    super(options);
    this.baseUrl = 'https://api.github.com';
    this.userAgent = 'Saphira-Search/1.0';
    this.rateLimit = {
      remaining: 60,
      reset: Date.now() + 3600000 // 1 hour from now
    };
  }

  /**
   * Search GitHub repositories
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} GitHub search results
   */
  async search(query, options = {}) {
    this.validateQuery(query);
    
    const maxResults = Math.min(options.maxResults || this.maxResults, 100); // GitHub API limit
    const searchType = options.type || 'repositories'; // repositories, code, issues, users
    
    // Check rate limit
    if (this.rateLimit.remaining <= 1 && Date.now() < this.rateLimit.reset) {
      this.logger.warn('GitHub API rate limit reached, using fallback');
      return this.getFallbackResults(query);
    }

    try {
      let results = [];
      
      if (searchType === 'repositories' || searchType === 'all') {
        const repoResults = await this.searchRepositories(query, maxResults);
        results.push(...repoResults);
      }
      
      if (searchType === 'code' || searchType === 'all') {
        const codeResults = await this.searchCode(query, Math.min(maxResults, 30));
        results.push(...codeResults);
      }

      // Remove duplicates and limit results
      const uniqueResults = this.deduplicateResults(results);
      const finalResults = uniqueResults.slice(0, maxResults);
      
      this.logSearchOperation(query, finalResults.length);
      return finalResults;
      
    } catch (error) {
      this.logger.warn(`GitHub search failed: ${error.message}`);
      return this.getFallbackResults(query);
    }
  }

  /**
   * Search GitHub repositories
   * @param {string} query - Search query
   * @param {number} maxResults - Maximum results
   * @returns {Promise<Array>} Repository search results
   */
  async searchRepositories(query, maxResults = 30) {
    const searchUrl = `${this.baseUrl}/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${Math.min(maxResults, 100)}`;
    
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
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        // Update rate limit info from headers
        this.updateRateLimit(res.headers);
        
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const parsed = JSON.parse(data);
              const results = [];
              
              if (parsed.items && parsed.items.length > 0) {
                parsed.items.forEach(repo => {
                  results.push(this.createResult(
                    `🔧 ${repo.full_name}`,
                    repo.html_url,
                    this.formatRepoDescription(repo),
                    {
                      type: 'repository',
                      language: repo.language,
                      stars: repo.stargazers_count,
                      forks: repo.forks_count,
                      topics: repo.topics || [],
                      lastUpdated: repo.updated_at
                    }
                  ));
                });
              }
              
              resolve(results);
            } else if (res.statusCode === 403) {
              this.logger.warn('GitHub API rate limit exceeded');
              resolve([]);
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
        reject(new Error('GitHub repository search timeout'));
      });

      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Search GitHub code
   * @param {string} query - Search query
   * @param {number} maxResults - Maximum results
   * @returns {Promise<Array>} Code search results
   */
  async searchCode(query, maxResults = 30) {
    const searchUrl = `${this.baseUrl}/search/code?q=${encodeURIComponent(query)}&per_page=${Math.min(maxResults, 100)}`;
    
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
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        this.updateRateLimit(res.headers);
        
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const parsed = JSON.parse(data);
              const results = [];
              
              if (parsed.items && parsed.items.length > 0) {
                parsed.items.forEach(code => {
                  results.push(this.createResult(
                    `📄 ${code.name} - ${code.repository.full_name}`,
                    code.html_url,
                    `Code file in ${code.repository.full_name}. Path: ${code.path}`,
                    {
                      type: 'code',
                      repository: code.repository.full_name,
                      path: code.path,
                      language: code.repository.language
                    }
                  ));
                });
              }
              
              resolve(results);
            } else if (res.statusCode === 403) {
              this.logger.warn('GitHub API rate limit exceeded for code search');
              resolve([]);
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
        reject(new Error('GitHub code search timeout'));
      });

      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Format repository description
   * @param {Object} repo - Repository data from GitHub API
   * @returns {string} Formatted description
   */
  formatRepoDescription(repo) {
    const parts = [];
    
    if (repo.description) {
      parts.push(repo.description);
    }
    
    const details = [];
    if (repo.language) details.push(`Language: ${repo.language}`);
    if (repo.stargazers_count) details.push(`⭐ ${repo.stargazers_count}`);
    if (repo.forks_count) details.push(`🔀 ${repo.forks_count}`);
    
    if (details.length > 0) {
      parts.push(details.join(' • '));
    }
    
    return parts.join(' | ') || 'No description available';
  }

  /**
   * Update rate limit information from response headers
   * @param {Object} headers - Response headers
   */
  updateRateLimit(headers) {
    if (headers['x-ratelimit-remaining']) {
      this.rateLimit.remaining = parseInt(headers['x-ratelimit-remaining']);
    }
    if (headers['x-ratelimit-reset']) {
      this.rateLimit.reset = parseInt(headers['x-ratelimit-reset']) * 1000;
    }
  }

  /**
   * Get fallback results when API is unavailable
   * @param {string} query - Search query
   * @returns {Array} Fallback results
   */
  getFallbackResults(query) {
    return [
      this.createResult(
        `🔧 GitHub Search: ${query}`,
        `https://github.com/search?q=${encodeURIComponent(query)}`,
        `Search GitHub repositories and code for "${query}". Click to view results on GitHub.`,
        { type: 'fallback' }
      )
    ];
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
    return 'GitHub';
  }
}

module.exports = GitHubSearchEngine;
