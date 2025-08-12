/**
 * Library Service - Cross-Knowledge Book Search Service
 * 
 * Provides functionality to search and browse items across multiple Knowledge Books
 */

const fs = require('fs').promises;
const path = require('path');
const KnowledgeItemRenderer = require('./knowledge-item-renderer');

class LibraryService {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.dataDirectory = options.dataDirectory || path.join(__dirname, '../../user/data');
    this.renderer = new KnowledgeItemRenderer({ logger: this.logger });
  }

  /**
   * Get all items from all Knowledge Books
   * @returns {Promise<Array>} List of all items
   */
  async getAllItems() {
    try {
      const files = await fs.readdir(this.dataDirectory);
      // Check all JSON files instead of filtering by filename prefix
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      this.logger.info(`📚 LibraryService: Found ${jsonFiles.length} JSON files in ${this.dataDirectory}`);
      this.logger.info(`📚 LibraryService: Files: ${jsonFiles.join(', ')}`);

      const allItems = [];

      for (const filename of jsonFiles) {
        try {
          const filePath = path.join(this.dataDirectory, filename);
          const content = await fs.readFile(filePath, 'utf8');
          const data = JSON.parse(content);

          // Check if this is a Knowledge Book by looking for required properties
          if (data && 
              typeof data.id === 'string' && 
              typeof data.title === 'string' && 
              typeof data.query === 'string' && 
              Array.isArray(data.results)) {

            this.logger.info(`📚 LibraryService: Processing Knowledge Book ${filename} with ${data.results.length} items`);

            // Add Knowledge Book information to each item
            const itemsWithSource = data.results.map(item => ({
              ...item,
              knowledgeBookTitle: data.title,
              knowledgeBookFilename: filename,
              knowledgeBookCreated: data.created,
              knowledgeBookKeywords: data.query
            }));

            allItems.push(...itemsWithSource);
          } else {
            this.logger.info(`📚 LibraryService: Skipped ${filename} (not a Knowledge Book)`);
          }
        } catch (error) {
          this.logger.warn(`Failed to read Knowledge Book: ${filename}`, error);
        }
      }

      this.logger.info(`📚 LibraryService: Total items loaded: ${allItems.length}`);
      return allItems;
    } catch (error) {
      this.logger.error('Failed to get all items:', error);
      return [];
    }
  }

  /**
   * Cross-search items by keywords
   * @param {string} query - Search keywords
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Search results
   */
  async searchItems(query, filters = {}) {
    if (!query || typeof query !== 'string') {
      return [];
    }

    const allItems = await this.getAllItems();
    let filteredItems = allItems;

    // Category filter
    if (filters.category) {
      filteredItems = filteredItems.filter(item => 
        item.tags && item.tags.includes(filters.category)
      );
    }

    // Source filter
    if (filters.source) {
      filteredItems = filteredItems.filter(item => 
        item.source === filters.source
      );
    }

    const searchTerms = query.toLowerCase().split(/\s+/);

    const results = filteredItems.filter(item => {
      const searchableText = [
        item.title || '',
        item.description || '',
        item.snippet || '',
        item.content || '',
        item.knowledgeBookTitle || '',
        item.knowledgeBookKeywords || '',
        ...(item.tags || [])
      ].join(' ').toLowerCase();

      return searchTerms.every(term => searchableText.includes(term));
    });

    // Sort by relevance (items with more search terms get higher ranking)
    results.sort((a, b) => {
      const scoreA = this.calculateRelevanceScore(a, searchTerms);
      const scoreB = this.calculateRelevanceScore(b, searchTerms);
      return scoreB - scoreA;
    });

    return results;
  }

  /**
   * Calculate relevance score for search results
   * @param {Object} item - Item to score
   * @param {Array} searchTerms - Search terms
   * @returns {number} Relevance score
   */
  calculateRelevanceScore(item, searchTerms) {
    const title = (item.title || '').toLowerCase();
    const description = (item.description || item.snippet || '').toLowerCase();
    const content = (item.content || '').toLowerCase();

    let score = 0;

    searchTerms.forEach(term => {
      // High score if term matches in title
      if (title.includes(term)) score += 10;
      
      // Medium score if term matches in description
      if (description.includes(term)) score += 5;
      
      // Low score if term matches in content
      if (content.includes(term)) score += 2;
    });

    return score;
  }

  /**
   * Group items by Knowledge Book
   * @param {Array} items - List of items
   * @returns {Object} Items grouped by Knowledge Book
   */
  /**
   * Group search results by Knowledge Book
   * @param {Array} items - Search result items
   * @returns {Object} Items grouped by Knowledge Book
   */
  groupByKnowledgeBook(items) {
    const grouped = {};
    
    items.forEach(item => {
      const bookTitle = item.knowledgeBookTitle || 'Unknown Book';
      const bookFilename = item.knowledgeBookFilename || 'unknown';
      
      if (!grouped[bookTitle]) {
        grouped[bookTitle] = {
          title: bookTitle,
          filename: bookFilename,
          created: item.knowledgeBookCreated,
          keywords: item.knowledgeBookKeywords,
          items: []
        };
      }
      
      grouped[bookTitle].items.push(item);
    });
    
    return grouped;
  }

  /**
   * Get formatted statistics data for display
   * @returns {Promise<Object>} Formatted statistics data
   */
  async getFormattedStats() {
    const stats = await this.getCategoryStats();
    return this.renderer.formatStatsForDisplay(stats);
  }

  /**
   * Get category-based statistics
   * @returns {Promise<Object>} Category statistics
   */
  async getCategoryStats() {
    const allItems = await this.getAllItems();
    const stats = {
      totalItems: allItems.length,
      totalKnowledgeBooks: 0,
      categories: {},
      sources: {},
      searchKeywords: {},
      recentItems: []
    };

    const knowledgeBooks = new Set();
    
    allItems.forEach(item => {
      // Count unique Knowledge Books
      if (item.knowledgeBookTitle) {
        knowledgeBooks.add(item.knowledgeBookTitle);
      }
      
      // Search keywords from Knowledge Book
      if (item.knowledgeBookKeywords) {
        const keywords = item.knowledgeBookKeywords.toLowerCase();
        stats.searchKeywords[keywords] = (stats.searchKeywords[keywords] || 0) + 1;
      }

      // Source statistics
      if (item.source) {
        stats.sources[item.source] = (stats.sources[item.source] || 0) + 1;
      }

      // Tag-based statistics
      if (item.tags && Array.isArray(item.tags)) {
        item.tags.forEach(tag => {
          stats.categories[tag] = (stats.categories[tag] || 0) + 1;
        });
      }
    });

    stats.totalKnowledgeBooks = knowledgeBooks.size;

    // Recent items (maximum 10 items)
    stats.recentItems = allItems
      .sort((a, b) => new Date(b.knowledgeBookCreated || 0) - new Date(a.knowledgeBookCreated || 0))
      .slice(0, 10);

    return stats;
  }

  /**
   * Get items for a specific category
   * @param {string} category - Category name
   * @returns {Promise<Array>} Items in the category
   */
  async getItemsByCategory(category) {
    const allItems = await this.getAllItems();
    return allItems.filter(item => 
      item.tags && item.tags.includes(category)
    );
  }

  /**
   * Get items for a specific source
   * @param {string} source - Source name
   * @returns {Promise<Array>} Items from the source
   */
  async getItemsBySource(source) {
    const allItems = await this.getAllItems();
    return allItems.filter(item => item.source === source);
  }
}

module.exports = LibraryService;

module.exports = LibraryService;
