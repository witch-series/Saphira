/**
 * Mock Search Engine
 * 
 * Provides fallback mock data when other search engines are unavailable.
 */

const BaseSearchEngine = require('./BaseSearchEngine');

class MockSearchEngine extends BaseSearchEngine {
  constructor(options = {}) {
    super(options);
    this.mockDatabase = this.initializeMockDatabase();
  }

  /**
   * Initialize mock database with sample data
   * @returns {Object} Mock database
   */
  initializeMockDatabase() {
    return {
      'javascript': [
        {
          title: '🔍 JavaScript Programming Guide',
          url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
          snippet: 'JavaScript (JS) is a lightweight, interpreted programming language with first-class functions.',
          category: 'programming'
        },
        {
          title: '🔍 Modern JavaScript Features',
          url: 'https://javascript.info/',
          snippet: 'Learn about ES6+ features including arrow functions, promises, async/await, and modules.',
          category: 'programming'
        }
      ],
      'plant phenotyping': [
        {
          title: '🔍 Plant Phenotyping Research',
          url: 'https://example.com/plant-phenotyping',
          snippet: 'Plant phenotyping is the quantitative analysis of plant form and function.',
          category: 'research'
        },
        {
          title: '🔍 Automated Plant Analysis',
          url: 'https://example.com/automated-plant-analysis',
          snippet: 'High-throughput plant phenotyping using computer vision and machine learning.',
          category: 'technology'
        }
      ],
      'artificial intelligence': [
        {
          title: '🔍 Artificial Intelligence Overview',
          url: 'https://example.com/ai-overview',
          snippet: 'AI refers to the simulation of human intelligence in machines.',
          category: 'technology'
        },
        {
          title: '🔍 Machine Learning Fundamentals',
          url: 'https://example.com/ml-fundamentals',
          snippet: 'Introduction to machine learning algorithms and their applications.',
          category: 'education'
        }
      ],
      'robotics': [
        {
          title: '🔍 Robotics Engineering',
          url: 'https://example.com/robotics-engineering',
          snippet: 'Design and development of robots for various applications.',
          category: 'engineering'
        }
      ],
      'tomato robot': [
        {
          title: '🔍 Agricultural Robotics',
          url: 'https://example.com/agricultural-robotics',
          snippet: 'Robots designed for farming applications including harvesting and monitoring.',
          category: 'agriculture'
        }
      ]
    };
  }

  /**
   * Search mock database
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Mock search results
   */
  async search(query, options = {}) {
    this.validateQuery(query);
    
    const maxResults = options.maxResults || this.maxResults;
    const normalizedQuery = query.toLowerCase().trim();
    
    // Simulate slight delay like real search engines
    await new Promise(resolve => setTimeout(resolve, 100));
    
    let results = [];
    
    // Check exact matches
    if (this.mockDatabase[normalizedQuery]) {
      results = [...this.mockDatabase[normalizedQuery]];
    } else {
      // Check partial matches
      for (const [key, value] of Object.entries(this.mockDatabase)) {
        if (normalizedQuery.includes(key) || key.includes(normalizedQuery)) {
          results.push(...value);
        }
      }
    }
    
    // If no matches found, provide generic fallback
    if (results.length === 0) {
      results = [
        {
          title: `🔍 Search Results for "${query}"`,
          url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
          snippet: `Fallback search results for "${query}". This appears when external APIs are unavailable.`,
          category: 'fallback'
        }
      ];
    }
    
    // Convert to standard format
    const formattedResults = results.map(result => 
      this.createResult(
        result.title,
        result.url,
        result.snippet,
        {
          type: 'mock_result',
          category: result.category || 'general',
          isFallback: true
        }
      )
    );
    
    const finalResults = formattedResults.slice(0, maxResults);
    this.logSearchOperation(query, finalResults.length);
    
    return finalResults;
  }

  /**
   * Add custom mock data
   * @param {string} query - Query key
   * @param {Array} results - Mock results to add
   */
  addMockData(query, results) {
    const normalizedQuery = query.toLowerCase().trim();
    if (!this.mockDatabase[normalizedQuery]) {
      this.mockDatabase[normalizedQuery] = [];
    }
    this.mockDatabase[normalizedQuery].push(...results);
  }

  /**
   * Get all mock data categories
   * @returns {Array} List of available categories
   */
  getCategories() {
    return Object.keys(this.mockDatabase);
  }

  getSourceName() {
    return 'Mock';
  }
}

module.exports = MockSearchEngine;
