/**
 * API Routes for Saphira GUI Viewer
 * Provides API endpoints for status checks and data retrieval
 */

const express = require('express');
const router = express.Router();

// Function to define API routes
module.exports = function(options) {
  const { logger, collectionState, loadKnowledgeBooks } = options;

  /**
   * API endpoint - Get collection status
   */
  router.get('/collection/status', (req, res) => {
    res.json({
      running: collectionState.running,
      progress: collectionState.progress,
      currentSource: collectionState.currentSource,
      itemsCollected: collectionState.itemsCollected,
      startTime: collectionState.startTime
    });
  });

  /**
   * Collection complete API endpoint - Called by client to check if collection is complete
   */
  router.get('/collection/complete', async (req, res) => {
    try {
      if (!collectionState.running && collectionState.progress === 100) {
        const knowledgeBooks = await loadKnowledgeBooks();
        
        res.json({
          complete: true,
          itemCount: knowledgeBooks.length
        });
      } else {
        res.json({
          complete: false
        });
      }
    } catch (error) {
      logger.error('Error in collection complete endpoint', error);
      res.status(500).json({
        complete: false,
        error: 'Failed to check collection status'
      });
    }
  });

  return router;
};