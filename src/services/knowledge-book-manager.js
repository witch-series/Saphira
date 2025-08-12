/**
 * Knowledge Book Manager for Saphira
 * 
 * This service manages the creation, storage, and retrieval of Knowledge Books.
 * Each Knowledge Book contains search results organized by source with metadata.
 */

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const KnowledgeItemRenderer = require('./knowledge-item-renderer');

class KnowledgeBookManager {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.dataDirectory = options.dataDirectory || path.join(__dirname, '../../user/data');
    this.urlTracker = options.urlTracker;
    this.renderer = new KnowledgeItemRenderer({ logger: this.logger });
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
      const filename = `${safeQuery}-${timestamp}.json`;
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
        sources: Object.keys(groupedResults), // Only include sources that have results
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
        // Check all JSON files instead of filtering by filename prefix
        if (file.endsWith('.json')) {
          try {
            const filepath = path.join(this.dataDirectory, file);
            const content = await fs.readFile(filepath, 'utf8');
            const data = JSON.parse(content);
            
            // Check if this is a Knowledge Book by looking for required properties
            if (data && 
                typeof data.id === 'string' && 
                typeof data.title === 'string' && 
                typeof data.query === 'string' && 
                Array.isArray(data.results)) {
              
              knowledgeBooks.push({
                filename: file,
                id: data.id,
                title: data.title,
                query: data.query,
                created: data.created,
                totalResults: data.totalResults,
                sources: data.sources,
                resultsBySources: data.resultsBySources,
                urlsProcessed: data.metadata?.urlsProcessed || 0
              });
            }
          } catch (error) {
            // Skip invalid JSON files or files that don't match Knowledge Book structure
            this.logger.debug(`Skipping file ${file}: ${error.message}`);
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
        if (urlsToRemove.length > 0) {
          this.logger.info(`📋 Sample URLs to remove: ${urlsToRemove.slice(0, 3).join(', ')}${urlsToRemove.length > 3 ? '...' : ''}`);
        }
      } catch (readError) {
        this.logger.warn(`⚠️ Could not read Knowledge Book for URL cleanup: ${readError.message}`);
      }

      // Delete the Knowledge Book file
      await fs.unlink(filepath);
      this.logger.info(`🗑️ Deleted Knowledge Book file: ${filename}`);

      // Remove URLs from tracking if URLTracker is available
      if (this.urlTracker && urlsToRemove.length > 0) {
        this.logger.info(`🔄 Starting URL removal process with URLTracker...`);
        try {
          const removedCount = await this.urlTracker.removeURLs(urlsToRemove);
          this.logger.info(`🔄 Successfully removed ${removedCount}/${urlsToRemove.length} URLs from URL tracking`);
        } catch (urlError) {
          this.logger.error(`❌ Failed to remove URLs from tracking: ${urlError.message}`);
          this.logger.error('URLTracker error details:', urlError);
        }
      } else {
        if (!this.urlTracker) {
          this.logger.warn(`⚠️ URLTracker not available - URLs will not be removed from tracking`);
        } else {
          this.logger.info(`📋 No URLs to remove from tracking`);
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

  /**
   * Export Knowledge Book as HTML file
   * @param {string} filename - Knowledge Book filename
   * @returns {Promise<string>} Path to exported HTML file
   */
  async exportToHTML(filename) {
    try {
      const knowledgeBook = await this.loadKnowledgeBook(filename);
      const html = this.renderer.exportToHTML(knowledgeBook);
      
      // Generate HTML filename
      const htmlFilename = filename.replace('.json', '.html');
      const exportPath = path.join(this.dataDirectory, 'exports');
      
      const savedPath = await this.renderer.saveHTMLFile(html, htmlFilename, exportPath);
      
      this.logger.info(`Knowledge Book exported to HTML: ${savedPath}`);
      return savedPath;
    } catch (error) {
      this.logger.error('Failed to export Knowledge Book to HTML:', error);
      throw error;
    }
  }

  /**
   * Get Knowledge Book data formatted for display with enriched items and formatted stats
   * @param {string} filename - Knowledge Book filename
   * @returns {Object} Knowledge Book data with enrichedItems and formattedStats
   */
  /**
   * Get Knowledge Book data formatted for display with enriched items and formatted stats
   * @param {string} filename - Knowledge Book filename
   * @returns {Object} Knowledge Book data with enrichedItems and formattedStats
   */
  async getKnowledgeBookForDisplay(filename) {
    try {
      const knowledgeBook = await this.loadKnowledgeBook(filename);
      const items = knowledgeBook.results || knowledgeBook.items || [];
      
      // Enrich items with tag classes for consistent display
      const enrichedItems = this.renderer.enrichItemsWithTagClasses(items);
      
      // Format stats using the renderer's method
      const formattedStats = this.renderer.formatStatsForDisplay(knowledgeBook);
      
      return {
        ...knowledgeBook,
        enrichedItems: enrichedItems,
        formattedStats: formattedStats
      };
    } catch (error) {
      this.logger.error('Failed to prepare Knowledge Book for display:', error);
      throw error;
    }
  }
}

module.exports = KnowledgeBookManager;
