/**
 * Collection Routes for Saphira GUI Viewer
 * Handles data collection functionality and management
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { v4: uuidv4 } = require('uuid');

// Function to define collection-related routes
module.exports = function(options) {
  const { 
    logger, 
    collectionState, 
    collectionHistory, 
    loadUserInterests,
    simulateCollection,
    USER_DIR,
    KNOWLEDGE_BOOKS_FILE 
  } = options;

  /**
   * Collection configuration route
   */
  router.get('/', async (req, res) => {
    try {
      const interests = await loadUserInterests();
      
      res.render('collection', {
        title: 'Data Collection',
        interests,
        status: collectionState,
        collections: collectionHistory
      });
    } catch (error) {
      logger.error('Error loading collection page', error);
      res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to load collection page',
        error
      });
    }
  });

  /**
   * Start collection route
   */
  router.post('/start', async (req, res) => {
    try {
      // If collection is already running, return
      if (collectionState.running) {
        return res.redirect('/collection');
      }
      
      // Parse sources (checkboxes array)
      const sources = Array.isArray(req.body.sources) ? req.body.sources : [req.body.sources];
      
      // Create collection config
      const config = {
        sources: sources,
        keywords: req.body.keywords ? req.body.keywords.split(',').map(k => k.trim()) : [],
        maxResults: parseInt(req.body.maxResults) || 10,
        processingLevel: req.body.processingLevel || 'basic',
        saveToKnowledgeBooks: req.body.saveToKnowledgeBooks === 'on'
      };
      
      // Add interests
      try {
        const interests = await loadUserInterests();
        const interestKeywords = interests.map(interest => interest.name);
        config.keywords = [...config.keywords, ...interestKeywords];
      } catch (error) {
        logger.warn('Failed to load interest tags for collection', error);
      }
      
      // Start collection process (non-async to show collection status)
      res.redirect('/collection');
      
      // Run collection and then redirect to home page when finished
      await simulateCollection(config);
      
      // After collection completes, we can't directly redirect as the response is already sent,
      // but the next time the user loads the page, they'll see updated data
      logger.info('Collection completed, user will see updated data on next page load');
    } catch (error) {
      logger.error('Error starting collection', error);
      // We can't respond with an error page here as response is already sent
      logger.error('Collection error occurred after redirect');
    }
  });

  /**
   * Stop collection route
   */
  router.post('/stop', (req, res) => {
    if (collectionState.running) {
      collectionState.running = false;
      collectionState.currentSource = 'Stopped';
      logger.info('Collection stopped by user');
    }
    
    res.redirect('/collection');
  });

  /**
   * Delete collection route
   */
  router.post('/delete/:id', async (req, res) => {
    try {
      const collectionId = req.params.id;
      
      if (!collectionId) {
        return res.status(400).json({ success: false, error: 'Missing collection ID' });
      }
      
      logger.info(`Deleting collection with ID: ${collectionId}`);
      
      // Find the collection in history to get the filename
      const collectionToDelete = collectionHistory.find(c => c.id === collectionId);
      let specificFilename = null;
      
      if (collectionToDelete && collectionToDelete.filename) {
        specificFilename = collectionToDelete.filename;
        logger.info(`Found specific filename to delete: ${specificFilename}`);
      }
      
      // Remove from collection history
      const collectionIndex = collectionHistory.findIndex(c => c.id === collectionId);
      if (collectionIndex !== -1) {
        collectionHistory.splice(collectionIndex, 1);
        logger.info(`Removed collection ${collectionId} from collection history`);
      }
      
      // Get all files in the user directory
      let fileList;
      try {
        fileList = fsSync.readdirSync(USER_DIR);
      } catch (readDirError) {
        logger.error(`Failed to read user directory: ${readDirError.message}`);
        fileList = [];
      }
      
      // Find files to delete (specific file if known, or any file with the collection ID)
      let collectionFilesToDelete = [];
      
      if (specificFilename && fileList.includes(specificFilename)) {
        // If we know the exact filename, only delete that one
        collectionFilesToDelete = [specificFilename];
      } else {
        // Otherwise find all files with the collection ID
        collectionFilesToDelete = fileList.filter(file => 
          file.includes(`collection-${collectionId}`) && file.endsWith('.json')
        );
      }
      
      logger.info(`Found ${collectionFilesToDelete.length} files to delete for collection ${collectionId}`);
      
      if (collectionFilesToDelete.length > 0) {
        let filesDeleted = 0;
        for (const fileName of collectionFilesToDelete) {
          const filePath = path.join(USER_DIR, fileName);
          
          try {
            // Use synchronous delete to ensure it completes before continuing
            fsSync.unlinkSync(filePath);
            filesDeleted++;
            logger.info(`Successfully deleted collection file: ${filePath}`);
          } catch (fileError) {
            logger.error(`Failed to delete file ${filePath}: ${fileError.message}`);
            // Continue with other files even if one fails
          }
        }
        
        logger.info(`Deleted ${filesDeleted} of ${collectionFilesToDelete.length} collection files`);
        
        if (filesDeleted === 0) {
          throw new Error("Could not delete any collection files");
        }
      } else {
        logger.warn(`No collection files found for ID: ${collectionId}`);
      }
      
      // If knowledge books exist, also remove items with this collection ID from knowledge books
      try {
        // Load knowledge books
        const knowledgeBooksPath = KNOWLEDGE_BOOKS_FILE;
        let knowledgeBooks = [];
        
        if (fsSync.existsSync(knowledgeBooksPath)) {
          try {
            const booksData = await fs.readFile(knowledgeBooksPath, 'utf8');
            knowledgeBooks = JSON.parse(booksData);
          } catch (readError) {
            logger.warn('Knowledge books file found but could not be parsed, creating new one');
          }
        } else {
          logger.info('Knowledge books file not found, no need to update it');
        }
        
        // Filter out items from this collection
        const originalCount = knowledgeBooks.length;
        knowledgeBooks = knowledgeBooks.filter(book => {
          return book.collectionId !== collectionId;
        });
        
        // Save updated knowledge books if any items were removed
        if (knowledgeBooks.length !== originalCount) {
          await fs.writeFile(
            knowledgeBooksPath,
            JSON.stringify(knowledgeBooks, null, 2),
            'utf8'
          );
          logger.info(`Removed ${originalCount - knowledgeBooks.length} items from knowledge books`);
        }
      } catch (kbError) {
        logger.error('Error updating knowledge books after collection deletion', kbError);
        // Continue even if knowledge books update fails
      }
      
      logger.info(`Collection ${collectionId} deletion process completed successfully`);
      
      // Redirect back to collection page
      res.redirect('/collection');
    } catch (error) {
      logger.error(`Error deleting collection: ${error.message}`, error);
      // Still redirect to collection page but with a flash message
      res.redirect('/collection');
    }
  });

  return router;
};