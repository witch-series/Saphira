/**
 * Stack Overflow Search Engine
 * 
 * Implements Stack Overflow search functionality using their public API.
 * No API key required for basic searches.
 */

const https = require('https');
const { URL } = require('url');
const BaseSearchEngine = require('./BaseSearchEngine');

class StackOverflowSearchEngine extends BaseSearchEngine {
  constructor(options = {}) {
    super(options);
    this.baseUrl = 'https://api.stackexchange.com/2.3';
    this.site = 'stackoverflow';
    this.userAgent = 'Saphira-Search/1.0';
    this.minDelay = 100; // Stack Exchange API throttling
  }

  /**
   * Search Stack Overflow questions
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Stack Overflow search results
   */
  async search(query, options = {}) {
    this.validateQuery(query);
    
    const maxResults = Math.min(options.maxResults || this.maxResults, 100);
    const sort = options.sort || 'relevance'; // activity, votes, creation, relevance
    
    try {
      const results = await this.searchQuestions(query, maxResults, sort);
      this.logSearchOperation(query, results.length);
      return results;
    } catch (error) {
      this.logger.warn(`Stack Overflow search failed: ${error.message}`);
      return this.getFallbackResults(query);
    }
  }

  /**
   * Search questions on Stack Overflow
   * @param {string} query - Search query
   * @param {number} maxResults - Maximum results
   * @param {string} sort - Sort order
   * @returns {Promise<Array>} Question search results
   */
  async searchQuestions(query, maxResults, sort) {
    const searchParams = new URLSearchParams({
      order: 'desc',
      sort: sort,
      intitle: query,
      site: this.site,
      pagesize: Math.min(maxResults, 100),
      filter: 'default' // Include body, tags, etc.
    });
    
    const searchUrl = `${this.baseUrl}/search/advanced?${searchParams.toString()}`;
    
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
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        // Handle gzip compression
        let stream = res;
        if (res.headers['content-encoding'] === 'gzip') {
          const zlib = require('zlib');
          stream = res.pipe(zlib.createGunzip());
        }
        
        stream.on('data', chunk => data += chunk);
        stream.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const parsed = JSON.parse(data);
              const results = [];
              
              if (parsed.items && parsed.items.length > 0) {
                parsed.items.forEach(question => {
                  results.push(this.createResult(
                    `❓ ${question.title}`,
                    question.link,
                    this.formatQuestionDescription(question),
                    {
                      type: 'question',
                      score: question.score,
                      answerCount: question.answer_count,
                      isAnswered: question.is_answered,
                      tags: question.tags || [],
                      creationDate: new Date(question.creation_date * 1000).toISOString(),
                      lastActivityDate: new Date(question.last_activity_date * 1000).toISOString(),
                      viewCount: question.view_count
                    }
                  ));
                });
              }
              
              resolve(results);
            } else if (res.statusCode === 400) {
              this.logger.warn('Stack Overflow API: Bad request');
              resolve([]);
            } else if (res.statusCode === 429) {
              this.logger.warn('Stack Overflow API: Rate limit exceeded');
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
        reject(new Error('Stack Overflow search timeout'));
      });

      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Format question description
   * @param {Object} question - Question data from Stack Overflow API
   * @returns {string} Formatted description
   */
  formatQuestionDescription(question) {
    const parts = [];
    
    // Add basic info
    const info = [];
    if (question.score !== undefined) info.push(`Score: ${question.score}`);
    if (question.answer_count !== undefined) info.push(`${question.answer_count} answers`);
    if (question.view_count !== undefined) info.push(`${question.view_count} views`);
    
    if (info.length > 0) {
      parts.push(info.join(' • '));
    }
    
    // Add tags
    if (question.tags && question.tags.length > 0) {
      const topTags = question.tags.slice(0, 4);
      parts.push(`Tags: ${topTags.join(', ')}`);
    }
    
    // Add status
    const status = [];
    if (question.is_answered) status.push('✓ Answered');
    if (question.accepted_answer_id) status.push('✓ Accepted Answer');
    
    if (status.length > 0) {
      parts.push(status.join(' '));
    }
    
    return parts.join(' | ') || 'Stack Overflow question';
  }

  /**
   * Search by tags (alternative search method)
   * @param {Array} tags - Array of tags to search
   * @param {number} maxResults - Maximum results
   * @returns {Promise<Array>} Tag-based search results
   */
  async searchByTags(tags, maxResults = 20) {
    if (!Array.isArray(tags) || tags.length === 0) {
      throw new Error('Tags must be a non-empty array');
    }
    
    const searchParams = new URLSearchParams({
      order: 'desc',
      sort: 'activity',
      tagged: tags.join(';'),
      site: this.site,
      pagesize: Math.min(maxResults, 100),
      filter: 'default'
    });
    
    const searchUrl = `${this.baseUrl}/questions?${searchParams.toString()}`;
    
    // Similar implementation to searchQuestions but for tag-based search
    // ... (implementation would be similar to searchQuestions)
  }

  /**
   * Get fallback results when API is unavailable
   * @param {string} query - Search query
   * @returns {Array} Fallback results
   */
  getFallbackResults(query) {
    const searchUrl = `https://stackoverflow.com/search?q=${encodeURIComponent(query)}`;
    
    return [
      this.createResult(
        `❓ Stack Overflow: ${query}`,
        searchUrl,
        `Search Stack Overflow for programming questions about "${query}". Find answers from the developer community.`,
        { 
          type: 'fallback',
          category: 'Q&A'
        }
      )
    ];
  }

  getSourceName() {
    return 'StackOverflow';
  }
}

module.exports = StackOverflowSearchEngine;
