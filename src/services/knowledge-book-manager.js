/**
 * Knowledge Book Manager for Saphira
 * 
 * This service manages the creation, storage, and retrieval of Knowledge Books.
 * Each Knowledge Book contains search results organized by source with metadata.
 */

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class KnowledgeBookManager {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.dataDirectory = options.dataDirectory || path.join(__dirname, '../../user/data');
    this.urlTracker = options.urlTracker;
  }

  /**
   * Create a new Knowledge Book from search results
   * @param {string} query - Search query used
   * @param {Array} results - Search results array
   * @param {Array} sources - Sources used for search
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Created Knowledge Book info
   */
  async createKnowledgeBook(query, results, sources, metadata = {}) {
    try {
      // Ensure data directory exists
      await fs.mkdir(this.dataDirectory, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const safeQuery = query.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-').toLowerCase();
      const filename = `knowledge-book-${safeQuery}-${timestamp}.json`;
      const filepath = path.join(this.dataDirectory, filename);

      // Extract URLs from results for tracking
      const extractedUrls = results
        .filter(result => result.url)
        .map(result => result.url);

      // Group results by source
      const groupedResults = results.reduce((groups, result) => {
        const source = result.source || 'Unknown';
        if (!groups[source]) groups[source] = [];
        groups[source].push(result);
        return groups;
      }, {});

      // Create Knowledge Book structure
      const knowledgeBook = {
        id: uuidv4(),
        title: `Knowledge Book: ${query}`,
        query: query,
        created: new Date().toISOString(),
        sources: sources,
        totalResults: results.length,
        resultsBySources: Object.keys(groupedResults).map(source => ({
          source: source,
          count: groupedResults[source].length
        })),
        metadata: {
          searchDuration: metadata.searchDuration || null,
          urlsProcessed: extractedUrls.length,
          ...metadata
        },
        results: results,
        groupedResults: groupedResults,
        processedUrls: extractedUrls
      };

      // Save Knowledge Book to file
      await fs.writeFile(filepath, JSON.stringify(knowledgeBook, null, 2), 'utf8');

      // Track URLs to prevent future duplicates
      if (this.urlTracker && extractedUrls.length > 0) {
        await this.urlTracker.addURLs(extractedUrls);
        await this.urlTracker.save();
      }

      this.logger.info(`📚 Created Knowledge Book: ${filename}`);
      this.logger.info(`📊 Results: ${results.length} items from ${sources.length} sources`);

      return {
        id: knowledgeBook.id,
        filename: filename,
        filepath: filepath,
        title: knowledgeBook.title,
        query: query,
        totalResults: results.length,
        sources: sources,
        created: knowledgeBook.created
      };

    } catch (error) {
      this.logger.error('❌ Failed to create Knowledge Book:', error);
      throw error;
    }
  }

  /**
   * Load a Knowledge Book from file
   * @param {string} filename - Knowledge Book filename
   * @returns {Object} Knowledge Book data
   */
  async loadKnowledgeBook(filename) {
    try {
      const filepath = path.join(this.dataDirectory, filename);
      const data = await fs.readFile(filepath, 'utf8');
      const knowledgeBook = JSON.parse(data);
      
      return knowledgeBook;
    } catch (error) {
      this.logger.error(`❌ Failed to load Knowledge Book ${filename}:`, error);
      throw error;
    }
  }

  /**
   * Get list of all Knowledge Books
   * @returns {Array} List of Knowledge Books with metadata
   */
  async getKnowledgeBookCollection() {
    try {
      await fs.mkdir(this.dataDirectory, { recursive: true });
      
      const files = await fs.readdir(this.dataDirectory);
      const knowledgeBooks = [];

      for (const file of files) {
        if (file.startsWith('knowledge-book-') && file.endsWith('.json')) {
          try {
            const knowledgeBook = await this.loadKnowledgeBook(file);
            knowledgeBooks.push({
              filename: file,
              id: knowledgeBook.id,
              title: knowledgeBook.title,
              query: knowledgeBook.query,
              created: knowledgeBook.created,
              totalResults: knowledgeBook.totalResults,
              sources: knowledgeBook.sources,
              resultsBySources: knowledgeBook.resultsBySources,
              urlsProcessed: knowledgeBook.metadata?.urlsProcessed || 0
            });
          } catch (error) {
            this.logger.warn(`⚠️ Failed to load Knowledge Book ${file}, skipping`);
          }
        }
      }

      // Sort by creation date (newest first)
      knowledgeBooks.sort((a, b) => new Date(b.created) - new Date(a.created));

      return knowledgeBooks;
    } catch (error) {
      this.logger.error('❌ Failed to get Knowledge Book collection:', error);
      throw error;
    }
  }

  /**
   * Delete a Knowledge Book and remove its URLs from tracking
   * @param {string} filename - Knowledge Book filename
   */
  async deleteKnowledgeBook(filename) {
    try {
      const filepath = path.join(this.dataDirectory, filename);
      
      // Load the Knowledge Book to get its URLs before deletion
      let urlsToRemove = [];
      try {
        const knowledgeBookData = await fs.readFile(filepath, 'utf-8');
        const knowledgeBook = JSON.parse(knowledgeBookData);
        
        // Extract URLs from results
        if (knowledgeBook.results && Array.isArray(knowledgeBook.results)) {
          urlsToRemove = knowledgeBook.results
            .map(result => result.url)
            .filter(url => url && typeof url === 'string');
        }
        
        this.logger.info(`📋 Found ${urlsToRemove.length} URLs to remove from tracking`);
      } catch (readError) {
        this.logger.warn(`⚠️ Could not read Knowledge Book for URL cleanup: ${readError.message}`);
      }

      // Delete the Knowledge Book file
      await fs.unlink(filepath);
      this.logger.info(`🗑️ Deleted Knowledge Book file: ${filename}`);

      // Remove URLs from tracking if URLTracker is available
      if (this.urlTracker && urlsToRemove.length > 0) {
        try {
          await this.urlTracker.removeURLs(urlsToRemove);
          this.logger.info(`🔄 Removed ${urlsToRemove.length} URLs from URL tracking`);
        } catch (urlError) {
          this.logger.warn(`⚠️ Failed to remove URLs from tracking: ${urlError.message}`);
        }
      }

      return {
        success: true,
        deletedFile: filename,
        removedUrls: urlsToRemove.length
      };
      
    } catch (error) {
      this.logger.error(`❌ Failed to delete Knowledge Book ${filename}:`, error);
      throw error;
    }
  }

  /**
   * Get statistics about the Knowledge Book collection
   * @returns {Object} Collection statistics
   */
  async getCollectionStats() {
    try {
      const collection = await this.getKnowledgeBookCollection();
      
      const stats = {
        totalBooks: collection.length,
        totalResults: collection.reduce((sum, book) => sum + book.totalResults, 0),
        totalUrlsProcessed: collection.reduce((sum, book) => sum + (book.urlsProcessed || 0), 0),
        sourceDistribution: {},
        queryTopics: collection.map(book => book.query),
        creationDates: collection.map(book => book.created.split('T')[0]) // Just the date part
      };

      // Count source usage
      collection.forEach(book => {
        if (book.sources) {
          // Handle both string and array formats for sources
          let sources = [];
          if (typeof book.sources === 'string') {
            // If sources is a string, try to parse it or treat as single source
            sources = [book.sources];
          } else if (Array.isArray(book.sources)) {
            sources = book.sources;
          }
          
          sources.forEach(source => {
            stats.sourceDistribution[source] = (stats.sourceDistribution[source] || 0) + 1;
          });
        }
        
        // Also count from resultsBySources if available
        if (book.resultsBySources && Array.isArray(book.resultsBySources)) {
          book.resultsBySources.forEach(sourceInfo => {
            if (sourceInfo.source) {
              stats.sourceDistribution[sourceInfo.source] = 
                (stats.sourceDistribution[sourceInfo.source] || 0) + (sourceInfo.count || 1);
            }
          });
        }
      });

      return stats;
    } catch (error) {
      this.logger.error('❌ Failed to get collection statistics:', error);
      throw error;
    }
  }
}

module.exports = KnowledgeBookManager;
