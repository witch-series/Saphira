/**
 * Collection Routes for Saphira UI
 * Handles Knowledge Book creation and management
 */

const express = require('express');
const router = express.Router();
const URLTracker = require('../services/url-tracker');
const KnowledgeBookManager = require('../services/knowledge-book-manager');

module.exports = function(options) {
  const { logger, searchService } = options;

  // Initialize URL Tracker and Knowledge Book Manager
  const urlTracker = new URLTracker({ logger });
  const knowledgeBookManager = new KnowledgeBookManager({ 
    logger, 
    urlTracker 
  });

  /**
   * GET /collection - Show multi-source search interface
   */
  router.get('/', async (req, res) => {
    try {
      // Get any status or message from query params
      const message = req.query.message;
      const error = req.query.error;
      
      res.render('collection', {
        title: 'Multi-Source Search',
        message: message,
        error: error
      });
    } catch (error) {
      logger.error('Error loading collection page:', error);
      res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to load collection page',
        error
      });
    }
  });

  /**
   * POST /collection/search - Execute multi-source search and create Knowledge Book
   */
  router.post('/search', async (req, res) => {
    try {
      const { query, sources, maxResults } = req.body;

      // Validate input
      if (!query || !query.trim()) {
        return res.redirect('/collection?error=Please enter a search query');
      }

      logger.info(`🔍 Collection Search Request: "${query}"`);
      logger.info(`📋 Selected sources: ${JSON.stringify(sources)}`);
      logger.info(`🔢 Request body keys: ${JSON.stringify(Object.keys(req.body))}`);
      
      const searchStartTime = Date.now();
      
      // Parse sources (default to all if none specified)
      const selectedSources = sources && sources.length > 0 ? 
        (Array.isArray(sources) ? sources : [sources]) : 
        ['wikipedia', 'openlibrary', 'google', 'arxiv'];
      
      logger.info(`✅ Final selected sources: ${JSON.stringify(selectedSources)}`);
      
      const searchOptions = {
        maxResults: parseInt(maxResults) || 15,
        sources: selectedSources
      };

      // Execute search using SearchService
      const searchResult = await searchService.search(query, searchOptions);
      const searchDuration = Date.now() - searchStartTime;
      
      // Extract results array from the search result object
      const searchResults = searchResult && searchResult.results ? searchResult.results : [];
      
      logger.info(`✅ Collection Search completed in ${searchDuration}ms: ${searchResults.length} results`);

      // Create Knowledge Book from search results
      const knowledgeBookInfo = await knowledgeBookManager.createKnowledgeBook(
        query,
        searchResults,
        selectedSources,
        { 
          searchDuration: `${searchDuration}ms`,
          searchTimestamp: new Date().toISOString()
        }
      );

      // Redirect to home page with success message
      const successMessage = `Knowledge Book created successfully! "${knowledgeBookInfo.title}" with ${searchResults.length} results.`;
      res.redirect(`/?message=${encodeURIComponent(successMessage)}`);
      
    } catch (error) {
      logger.error('❌ Collection Search Error:', error);
      res.redirect('/collection?error=Search failed. Please try again.');
    }
  });

  /**
   * GET /collection/knowledge-books - View Knowledge Book collection
   */
  router.get('/knowledge-books', async (req, res) => {
    try {
      const collection = await knowledgeBookManager.getKnowledgeBookCollection();
      const stats = await knowledgeBookManager.getCollectionStats();
      const urlStats = await urlTracker.getStats();

      res.render('knowledge-collection', {
        title: 'Knowledge Book Collection',
        collection: collection,
        stats: stats,
        urlStats: urlStats
      });
    } catch (error) {
      logger.error('❌ Error loading Knowledge Book collection:', error);
      res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to load Knowledge Book collection',
        error
      });
    }
  });

  /**
   * GET /collection/knowledge-book/:filename - View specific Knowledge Book
   */
  router.get('/knowledge-book/:filename', async (req, res) => {
    try {
      const filename = req.params.filename;
      const knowledgeBook = await knowledgeBookManager.loadKnowledgeBook(filename);

      res.render('knowledge-book-detail', {
        title: knowledgeBook.title,
        knowledgeBook: knowledgeBook,
        filename: filename
      });
    } catch (error) {
      logger.error(`❌ Error loading Knowledge Book ${req.params.filename}:`, error);
      res.status(404).render('error', {
        title: 'Knowledge Book Not Found',
        message: `Knowledge Book "${req.params.filename}" not found`,
        error
      });
    }
  });

  /**
   * DELETE /collection/knowledge-book/:filename - Delete Knowledge Book and associated URLs
   */
  router.delete('/knowledge-book/:filename', async (req, res) => {
    try {
      const filename = req.params.filename;
      const deleteResult = await knowledgeBookManager.deleteKnowledgeBook(filename);
      
      logger.info(`✅ Knowledge Book deleted: ${filename} (removed ${deleteResult.removedUrls} URLs)`);
      
      res.json({ 
        success: true, 
        message: `Knowledge Book "${filename}" deleted successfully`,
        deletedFile: deleteResult.deletedFile,
        removedUrls: deleteResult.removedUrls
      });
    } catch (error) {
      logger.error(`❌ Error deleting Knowledge Book ${req.params.filename}:`, error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to delete Knowledge Book', 
        error: error.message 
      });
    }
  });

  return router;
};
