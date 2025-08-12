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
const LibraryService = require('../src/services/library-service');

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

// Initialize library service for Knowledge Book横断検索
const libraryService = new LibraryService({
  logger,
  dataDirectory: path.join(__dirname, '../user/data')
});

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
    const deleted = req.query.deleted;
    
    // Get Knowledge Book collection
    const collection = await knowledgeBookManager.getKnowledgeBookCollection();
    const stats = await knowledgeBookManager.getCollectionStats();
    const urlStats = await urlTracker.getStats();
    
    res.render('index', {
      title: 'Saphira - Knowledge Collection',
      collection: collection,
      stats: stats,
      urlStats: urlStats,
      message: deleted ? `Knowledge Book "${deleted}" deleted successfully` : message,
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
 * Library route - Cross-Knowledge Book Search
 */
app.get('/library', async (req, res) => {
  try {
    const query = req.query.q || '';
    const category = req.query.category || '';
    const source = req.query.source || '';
    const page = parseInt(req.query.page) || 1;
    const itemsPerPage = 20;

    let searchResults = [];
    let totalResults = 0;
    let stats = {};

    if (query.trim() || category || source) {
      // Keyword search or filter
      const filters = {};
      if (category) filters.category = category;
      if (source) filters.source = source;
      
      if (query.trim()) {
        const allResults = await libraryService.searchItems(query.trim(), filters);
        totalResults = allResults.length;
        
        // Pagination
        const startIndex = (page - 1) * itemsPerPage;
        searchResults = allResults.slice(startIndex, startIndex + itemsPerPage);
      } else if (category) {
        const allResults = await libraryService.getItemsByCategory(category);
        totalResults = allResults.length;
        
        // Pagination
        const startIndex = (page - 1) * itemsPerPage;
        searchResults = allResults.slice(startIndex, startIndex + itemsPerPage);
      } else if (source) {
        const allResults = await libraryService.getItemsBySource(source);
        totalResults = allResults.length;
        
        // Pagination
        const startIndex = (page - 1) * itemsPerPage;
        searchResults = allResults.slice(startIndex, startIndex + itemsPerPage);
      }
    } else {
      // Show statistics when no search is performed
      stats = await libraryService.getFormattedStats();
      logger.info(`📚 Library stats loaded: ${JSON.stringify(stats)}`);
    }

    const totalPages = Math.ceil(totalResults / itemsPerPage);
    const groupedResults = (query.trim() || category || source) ? libraryService.groupByKnowledgeBook(searchResults) : {};

    res.render('library', {
      title: 'Saphira Library - Cross-Knowledge Book Search',
      query: query,
      category: category,
      source: source,
      searchResults: searchResults,
      groupedResults: groupedResults,
      totalResults: totalResults,
      stats: stats,
      pagination: {
        current: page,
        total: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        nextPage: page + 1,
        prevPage: page - 1
      }
    });
  } catch (error) {
    logger.error('Error loading Library:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load Library',
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
    const knowledgeBookData = await knowledgeBookManager.getKnowledgeBookForDisplay(filename);

    res.render('knowledge-book-detail', {
      title: knowledgeBookData.title,
      knowledgeBook: knowledgeBookData,
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
 * Export Knowledge Book to HTML
 */
app.get('/knowledge-book/:filename/export-html', async (req, res) => {
  try {
    const filename = req.params.filename;
    
    // Get Knowledge Book data and generate HTML directly
    const knowledgeBook = await knowledgeBookManager.loadKnowledgeBook(filename);
    const html = knowledgeBookManager.renderer.exportToHTML(knowledgeBook);
    
    // Generate HTML filename for download
    const htmlFilename = filename.replace('.json', '.html');
    
    // Send HTML directly as download without saving to filesystem
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="${htmlFilename}"`);
    res.send(html);
    
    logger.info(`📄 Knowledge Book ${filename} exported to HTML (direct download)`);
  } catch (error) {
    logger.error(`❌ Error exporting Knowledge Book ${req.params.filename}:`, error);
    res.status(500).render('error', {
      title: 'Export Error',
      message: 'Failed to export Knowledge Book to HTML',
      error
    });
  }
});

/**
 * Library item detail view route
 */
app.get('/library/item/:bookFilename/:itemIndex', async (req, res) => {
  try {
    const bookFilename = req.params.bookFilename;
    const itemIndex = parseInt(req.params.itemIndex);
    
    const knowledgeBookData = await knowledgeBookManager.getKnowledgeBookForDisplay(bookFilename);
    
    if (!knowledgeBookData.enrichedItems || itemIndex >= knowledgeBookData.enrichedItems.length) {
      return res.status(404).render('error', {
        title: 'Item Not Found',
        message: 'The requested item was not found',
        error: null
      });
    }
    
    const item = knowledgeBookData.enrichedItems[itemIndex];
    
    // Get user memo from Knowledge Book data (now stored directly in JSON)
    const userMemo = knowledgeBookData.results[itemIndex]?.userMemo?.content || '';
    
    res.render('library-item-detail', {
      title: `Library Item: ${item.title}`,
      knowledgeBook: knowledgeBookData,
      item: item,
      itemIndex: itemIndex,
      filename: bookFilename,
      userMemo: userMemo
    });
  } catch (error) {
    logger.error(`❌ Error loading Library item detail:`, error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load item details',
      error
    });
  }
});

/**
 * Save user memo for Library item (directly to Knowledge Book JSON)
 */
app.post('/library/item/:bookFilename/:itemIndex/memo', async (req, res) => {
  try {
    const bookFilename = req.params.bookFilename;
    const itemIndex = parseInt(req.params.itemIndex);
    const { memo } = req.body;
    
    // Load the Knowledge Book JSON file
    const filepath = path.join(DATA_DIR, bookFilename);
    const knowledgeBookContent = await fs.readFile(filepath, 'utf8');
    const knowledgeBook = JSON.parse(knowledgeBookContent);
    
    // Ensure results array exists and has enough items
    if (!knowledgeBook.results || itemIndex >= knowledgeBook.results.length) {
      return res.status(400).json({ success: false, message: 'Invalid item index' });
    }
    
    // Add or update memo to the specific item
    if (!knowledgeBook.results[itemIndex].userMemo) {
      knowledgeBook.results[itemIndex].userMemo = {};
    }
    
    knowledgeBook.results[itemIndex].userMemo = {
      content: memo || '',
      lastUpdated: new Date().toISOString(),
      createdAt: knowledgeBook.results[itemIndex].userMemo.createdAt || new Date().toISOString()
    };
    
    // Save the updated Knowledge Book back to file
    await fs.writeFile(filepath, JSON.stringify(knowledgeBook, null, 2), 'utf8');
    
    res.json({ success: true, message: 'Memo saved to Knowledge Book successfully' });
  } catch (error) {
    logger.error(`❌ Error saving library item memo to Knowledge Book:`, error);
    res.status(500).json({ success: false, message: 'Failed to save memo' });
  }
});

/**
 * Knowledge Book item detail view route
 */
app.get('/knowledge-book/:filename/item/:itemIndex', async (req, res) => {
  try {
    const filename = req.params.filename;
    const itemIndex = parseInt(req.params.itemIndex);
    
    const knowledgeBookData = await knowledgeBookManager.getKnowledgeBookForDisplay(filename);
    
    if (!knowledgeBookData.enrichedItems || itemIndex >= knowledgeBookData.enrichedItems.length) {
      return res.status(404).render('error', {
        title: 'Item Not Found',
        message: 'The requested item was not found in this Knowledge Book',
        error: null
      });
    }
    
    const item = knowledgeBookData.enrichedItems[itemIndex];
    
    // Get user memo from Knowledge Book data (now stored directly in JSON)
    const userMemo = knowledgeBookData.results[itemIndex]?.userMemo?.content || '';
    
    res.render('knowledge-item-detail', {
      title: `Item: ${item.title}`,
      knowledgeBook: knowledgeBookData,
      item: item,
      itemIndex: itemIndex,
      filename: filename,
      userMemo: userMemo
    });
  } catch (error) {
    logger.error(`❌ Error loading Knowledge Book item detail:`, error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load item details',
      error
    });
  }
});

/**
 * Save user memo for Knowledge Book item (directly to Knowledge Book JSON)
 */
app.post('/knowledge-book/:filename/item/:itemIndex/memo', async (req, res) => {
  try {
    const filename = req.params.filename;
    const itemIndex = parseInt(req.params.itemIndex);
    const { memo } = req.body;
    
    // Load the Knowledge Book JSON file
    const filepath = path.join(DATA_DIR, filename);
    const knowledgeBookContent = await fs.readFile(filepath, 'utf8');
    const knowledgeBook = JSON.parse(knowledgeBookContent);
    
    // Ensure results array exists and has enough items
    if (!knowledgeBook.results || itemIndex >= knowledgeBook.results.length) {
      return res.status(400).json({ success: false, message: 'Invalid item index' });
    }
    
    // Add or update memo to the specific item
    if (!knowledgeBook.results[itemIndex].userMemo) {
      knowledgeBook.results[itemIndex].userMemo = {};
    }
    
    knowledgeBook.results[itemIndex].userMemo = {
      content: memo || '',
      lastUpdated: new Date().toISOString(),
      createdAt: knowledgeBook.results[itemIndex].userMemo.createdAt || new Date().toISOString()
    };
    
    // Save the updated Knowledge Book back to file
    await fs.writeFile(filepath, JSON.stringify(knowledgeBook, null, 2), 'utf8');
    
    res.json({ success: true, message: 'Memo saved to Knowledge Book successfully' });
  } catch (error) {
    logger.error(`❌ Error saving memo to Knowledge Book:`, error);
    res.status(500).json({ success: false, message: 'Failed to save memo' });
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
 * GET route for Knowledge Book deletion (for UI links)
 */
app.get('/delete/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    await knowledgeBookManager.deleteKnowledgeBook(filename);
    
    // Redirect back to Knowledge Book collection with success message
    res.redirect('/?deleted=' + encodeURIComponent(filename));
  } catch (error) {
    logger.error(`❌ Error deleting Knowledge Book ${req.params.filename}:`, error);
    // Redirect back with error message
    res.redirect('/?error=' + encodeURIComponent('Failed to delete Knowledge Book'));
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
