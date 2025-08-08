/**
 * Saphira UI Application
 * 
 * This is the main UI application that provides a web interface for the Saphira search system.
 * It uses Express.js and EJS templates for a customizable user experience.
 * 
 * To run this application:
 * 1. Run: node ui/app.js
 * 2. Open your browser and go to: http://localhost:3333
 */

const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const app = express();
const port = 3333;

// Configure logging - minimal mode for production
const logger = {
  info: (message) => {
    // Only log server startup and search requests
    if (message.includes('server running') || message.includes('Search Request:') || message.includes('Search completed')) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [INFO] ${message}`);
    }
  },
  warn: (message) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [WARN] ${message}`);
  },
  error: (message, error) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [ERROR] ${message}`);
    if (error) {
      console.error(error);
    }
  },
  debug: (message, data) => {
    // Disable debug logging completely
    return;
  }
};

// Import required services and routes
const createCollectionRoutes = require('../src/routes/collection-routes');
const SearchService = require('../src/searchService');
const URLTracker = require('../src/services/url-tracker');

// Initialize URL tracker
const urlTracker = new URLTracker({ logger });

// Initialize search service with logger, URL tracker, and multi-source support
const searchService = new SearchService({
  logger,
  urlTracker,
  maxResults: 15,
  cacheTtl: 300, // 5 minutes
  saveDirectory: path.join(__dirname, '../user/data') // Save search results to user/data directory
});

// Test network connectivity - minimal logging
setTimeout(async () => {
  try {
    logger.info('🔍 Testing search functionality...');
    const testResult = await searchService.search('test', { 
      maxResults: 3,
      sources: ['wikipedia', 'openlibrary', 'google', 'arxiv']
    });
    
    // Simple success message only
    logger.info(`✅ Search service ready`);
    
  } catch (error) {
    logger.warn('⚠️ Search service test failed, but application will continue');
  }
}, 2000); // Test after 2 seconds

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, './views'));

// Middleware
app.use(express.static(path.join(__dirname, './public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// User data paths (relative to project root)
const USER_DIR = path.join(__dirname, '../user');
const DATA_DIR = path.join(USER_DIR, 'data');

// Ensure directories exist
async function ensureDirectories() {
  try {
    await fs.mkdir(USER_DIR, { recursive: true });
    await fs.mkdir(DATA_DIR, { recursive: true });
    // Silent - no directory creation logging
  } catch (error) {
    logger.error('Failed to create directories', error);
    throw error;
  }
}

/**
 * Find available data files in DATA_DIR
 */
async function findAvailableDataFiles() {
  const files = [];
  
  try {
    // Look for JSON files in DATA_DIR
    const dataFiles = await fs.readdir(DATA_DIR);
    const jsonFiles = dataFiles.filter(file => 
      file.endsWith('.json')
    );
    
    if (jsonFiles.length > 0) {
      // Silent - no data file listing
      
      // Add each JSON file with clean display name
      for (const file of jsonFiles) {
        const filePath = path.join(DATA_DIR, file);
        const baseNameWithoutExt = file.replace('.json', '');
        
        // Extract keyword and date from filename if it follows keyword-date format
        let displayName = baseNameWithoutExt;
        const parts = baseNameWithoutExt.split('-');
        if (parts.length >= 7) {
          const keyword = parts.slice(0, -6).join('-');
          const datePart = parts.slice(-6).join('-');
          displayName = `${keyword} (${datePart.replace(/-/g, '/')})`;
        }
        
        files.push({
          id: baseNameWithoutExt,
          name: displayName,
          path: filePath
        });
      }
    }
  } catch (error) {
    logger.warn('Failed to read data directory:', error);
  }
  
  // Silent - no debug logging
  return files;
}

// Check if a file exists
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load user interests (simplified version)
 */
async function loadUserInterests() {
  // For now, return an empty array since we don't have a user interests system
  // This can be expanded later
  return [];
}

const KnowledgeBookManager = require('../src/services/knowledge-book-manager');

// Initialize Knowledge Book Manager (URLTracker already initialized above)
const knowledgeBookManager = new KnowledgeBookManager({ logger, urlTracker });

// Options required for router initialization
const routerOptions = {
  logger,
  searchService
};

// Collection router setup
app.use('/collection', createCollectionRoutes(routerOptions));

/**
 * Main route - Knowledge Book Collection (Home)
 */
app.get('/', async (req, res) => {
  try {
    const message = req.query.message;
    const error = req.query.error;
    
    // Get Knowledge Book collection
    const collection = await knowledgeBookManager.getKnowledgeBookCollection();
    const stats = await knowledgeBookManager.getCollectionStats();
    const urlStats = await urlTracker.getStats();
    
    res.render('index', {
      title: 'Saphira - Knowledge Collection',
      collection: collection,
      stats: stats,
      urlStats: urlStats,
      message: message,
      error: error
    });
  } catch (error) {
    logger.error('Error loading Knowledge Book collection', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load Knowledge Book collection',
      error
    });
  }
});

/**
 * View Knowledge Book content route
 */
app.get('/knowledge-book/:filename', async (req, res) => {
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
 * Delete Knowledge Book route
 */
app.delete('/knowledge-book/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    await knowledgeBookManager.deleteKnowledgeBook(filename);
    
    res.json({ success: true, message: `Knowledge Book ${filename} deleted successfully` });
  } catch (error) {
    logger.error(`❌ Error deleting Knowledge Book ${req.params.filename}:`, error);
    res.status(500).json({ success: false, message: 'Failed to delete Knowledge Book' });
  }
});

/**
 * View JSON file content route (legacy support)
 */
app.get('/view/:fileId(*)', async (req, res) => {
  try {
    const fileId = decodeURIComponent(req.params.fileId);
    
    // Find the file in DATA_DIR
    let filePath = null;
    
    // Try different possible file names
    const possibleFiles = [
      `${fileId}.json`,
      fileId.endsWith('.json') ? fileId : `${fileId}.json`
    ];
    
    for (const fileName of possibleFiles) {
      const testPath = path.join(DATA_DIR, fileName);
      try {
        await fs.access(testPath);
        filePath = testPath;
        break;
      } catch (error) {
        // File doesn't exist, try next
      }
    }
    
    if (!filePath) {
      return res.status(404).render('error', {
        title: 'File Not Found',
        message: `File ${fileId} not found`,
        error: new Error('File not found')
      });
    }
    
    // Read and parse the JSON file
    const fileContent = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(fileContent);
    
    // Determine if it's an array or object
    let items = [];
    let title = fileId;
    
    if (Array.isArray(data)) {
      items = data;
      title = `${fileId} (${data.length} items)`;
    } else if (data.results && Array.isArray(data.results)) {
      items = data.results;
      title = data.title || `${fileId} (${data.results.length} items)`;
    } else {
      // Single object, wrap in array for display
      items = [data];
      title = data.title || fileId;
    }
    
    res.render('data-view', {
      title: `View: ${title}`,
      fileName: fileId,
      items: items,
      totalItems: items.length
    });
    
  } catch (error) {
    logger.error('Error viewing file:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load file content',
      error
    });
  }
});

/**
 * Delete file route - Updated to handle URL management
 */
app.get('/file/delete/:fileId(*)', async (req, res) => {
  try {
    const fileId = decodeURIComponent(req.params.fileId);
    
    // Find the file in DATA_DIR
    let filePath = null;
    
    const possibleFiles = [
      `${fileId}.json`,
      fileId.endsWith('.json') ? fileId : `${fileId}.json`
    ];
    
    for (const fileName of possibleFiles) {
      const testPath = path.join(DATA_DIR, fileName);
      try {
        await fs.access(testPath);
        filePath = testPath;
        break;
      } catch (error) {
        // File doesn't exist, try next
      }
    }
    
    if (!filePath) {
      return res.redirect('/?message=File not found');
    }
    
    // Read the file to extract collection ID for URL cleanup
    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(fileContent);
      
      // If it's a collection file with an ID, use the collection service to delete it
      if (data.id && collectionService.deleteCollection) {
        const result = await collectionService.deleteCollection(data.id);
        logger.info(`Deleted collection with ${result.deletedFiles} files and ${result.deletedUrls} URLs`);
        return res.redirect('/?message=Collection deleted successfully');
      }
    } catch (error) {
      logger.warn('Could not parse file for collection cleanup, proceeding with simple delete:', error);
    }
    
    // Fallback to simple file deletion
    await fs.unlink(filePath);
    // Silent - no file deletion logging
    
    res.redirect('/?message=File deleted successfully');
    
  } catch (error) {
    logger.error('Error deleting file:', error);
    res.redirect('/?message=Error deleting file');
  }
});

// Start the server
async function startServer() {
  try {
    // Initialize URLTracker before starting server
    await urlTracker.initialize();
    logger.info('✅ URL Tracker initialized');
    
    // Start the server
    app.listen(port, () => {
      logger.info(`Saphira UI server running at http://localhost:${port}`);
      logger.info('Access the interface by opening the URL in your web browser');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
