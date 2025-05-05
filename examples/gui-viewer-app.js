/**
 * Saphira GUI Viewer
 * 
 * This is a simple GUI application that allows you to view and manage collected data
 * in a web browser. It uses Express.js and EJS templates.
 * 
 * To run this application:
 * 1. Make sure you have run at least one of the collection samples to generate data
 * 2. Run: node examples/gui-viewer-app.js
 * 3. Open your browser and go to: http://localhost:3333
 */

const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const app = express();
const port = 3333;

// Import SearchService instead of DuckDuckGoAdapter directly
const SearchService = require('../src/core/searchService');

// Configure logging
const logger = {
  info: (message) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [INFO] ${message}`);
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
    const timestamp = new Date().toISOString();
    console.debug(`[${timestamp}] [DEBUG] ${message}`);
    if (data) {
      console.debug(data);
    }
  }
};

// Import router files
const createApiRoutes = require('./routes/api-routes');
const createSearchRoutes = require('./routes/search-routes');
const createCollectionRoutes = require('./routes/collection-routes');
const createCollectionService = require('./routes/collection-service');

// Initialize search service with logger
const searchService = new SearchService({
  logger,
  defaultMaxResults: 10,
  cacheTtl: 300 // 5 minutes
});

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, './views'));

// Middleware
// Update static files path to include both the examples/public directory and the old public directory
app.use(express.static(path.join(__dirname, './public'))); // Use examples/public first
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// User data paths
const USER_DIR = path.join(__dirname, '../user');
const DATA_DIR = path.join(USER_DIR, 'data');
const API_COLLECTION_FILE = path.join(USER_DIR, 'api-collection-results.json');
const ENHANCED_COLLECTION_FILE = path.join(USER_DIR, 'enhanced-collection-results.json');
const API_KEYS_FILE = path.join(USER_DIR, 'api-keys.json');
const USER_INTERESTS_FILE = path.join(DATA_DIR, 'user-interests.json');
const KNOWLEDGE_BOOKS_FILE = path.join(DATA_DIR, 'knowledge-books.json');

// Collection state
const collectionState = {
  running: false,
  progress: 0,
  currentSource: '',
  itemsCollected: 0,
  startTime: null,
  processingLevel: 'basic',
  sources: [],
  keywords: [],
  maxResults: 10,
  results: []
};

// Collection history
let collectionHistory = [];

// Ensure directories exist
async function ensureDirectories() {
  try {
    await fs.mkdir(USER_DIR, { recursive: true });
    await fs.mkdir(DATA_DIR, { recursive: true });
    logger.info('Directories checked/created');
  } catch (error) {
    logger.error('Failed to create directories', error);
    throw error;
  }
}

/**
 * Find available data files
 */
async function findAvailableDataFiles() {
  const files = [];
  
  try {
    await fs.access(USER_DIR);
    
    // Check each data file
    try {
      await fs.access(API_COLLECTION_FILE);
      files.push({
        id: 'api-collection',
        name: 'API Collection Results',
        path: API_COLLECTION_FILE
      });
    } catch (error) {
      // File doesn't exist - skip
      logger.debug('API collection file not found');
    }
    
    try {
      await fs.access(ENHANCED_COLLECTION_FILE);
      files.push({
        id: 'enhanced-collection',
        name: 'Enhanced Collection Results',
        path: ENHANCED_COLLECTION_FILE
      });
    } catch (error) {
      // File doesn't exist - skip
      logger.debug('Enhanced collection file not found');
    }
    
    try {
      await fs.access(KNOWLEDGE_BOOKS_FILE);
      files.push({
        id: 'knowledge-books',
        name: 'Knowledge Books',
        path: KNOWLEDGE_BOOKS_FILE
      });
    } catch (error) {
      // File doesn't exist - skip
      logger.debug('Knowledge books file not found');
    }

    // Look for dated knowledge books files in DATA_DIR
    try {
      const dataFiles = await fs.readdir(DATA_DIR);
      const datedKnowledgeFiles = dataFiles.filter(file => file.startsWith('knowledge-books-') && file.endsWith('.json'));
      
      if (datedKnowledgeFiles.length > 0) {
        logger.info(`Found ${datedKnowledgeFiles.length} dated knowledge book files: ${datedKnowledgeFiles.join(', ')}`);
        
        // Add each dated file
        for (const file of datedKnowledgeFiles) {
          const filePath = path.join(DATA_DIR, file);
          const datePart = file.replace('knowledge-books-', '').replace('.json', '');
          
          files.push({
            id: `knowledge-books-${datePart}`,
            name: `Knowledge Books (${datePart})`,
            path: filePath
          });
          logger.debug(`Added dated knowledge book file: ${file}`);
        }
      }
    } catch (error) {
      logger.warn('Failed to check for dated knowledge book files', error);
    }

    // Add collection history files
    for (const collection of collectionHistory) {
      try {
        const collectionFile = path.join(USER_DIR, `collection-${collection.id}.json`);
        await fs.access(collectionFile);
        files.push({
          id: `collection-${collection.id}`,
          name: `Collection ${new Date(collection.date).toLocaleDateString()}`,
          path: collectionFile
        });
      } catch (error) {
        logger.debug(`Collection file ${collection.id} not found`);
      }
    }
  } catch (error) {
    // User directory doesn't exist
    logger.warn('User directory not found. Please run a collection sample first.');
  }
  
  logger.debug(`Found ${files.length} data files`, files);
  return files;
}

/**
 * Load API keys from file
 */
async function loadApiKeys() {
  try {
    await fs.access(API_KEYS_FILE);
    const data = await fs.readFile(API_KEYS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    logger.warn('API keys file not found or invalid, creating default');
    const defaultKeys = {
      newsApiKey: "",
      githubApiKey: "",
      otherApiKeys: {
        "_comment": "Section for future API keys"
      }
    };
    
    try {
      await fs.writeFile(API_KEYS_FILE, JSON.stringify(defaultKeys, null, 2), 'utf8');
    } catch (writeError) {
      logger.error('Failed to create default API keys file', writeError);
    }
    
    return defaultKeys;
  }
}

/**
 * Save API keys to file
 */
async function saveApiKeys(keys) {
  try {
    await ensureDirectories();
    await fs.writeFile(API_KEYS_FILE, JSON.stringify(keys, null, 2), 'utf8');
    logger.info('API keys saved successfully');
    return true;
  } catch (error) {
    logger.error('Failed to save API keys', error);
    return false;
  }
}

/**
 * Load user interests from file
 */
async function loadUserInterests() {
  try {
    await fs.access(USER_INTERESTS_FILE);
    const data = await fs.readFile(USER_INTERESTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    logger.warn('User interests file not found or invalid, returning empty array');
    return [];
  }
}

/**
 * Save user interests to file
 */
async function saveUserInterests(interests) {
  try {
    await ensureDirectories();
    await fs.writeFile(USER_INTERESTS_FILE, JSON.stringify(interests, null, 2), 'utf8');
    logger.info('User interests saved successfully');
    return true;
  } catch (error) {
    logger.error('Failed to save user interests', error);
    return false;
  }
}

/**
 * Load knowledge books from file
 */
async function loadKnowledgeBooks() {
  // We'll now load from all dated files instead of just the main file
  const allBooks = [];
  
  try {
    // Read the data directory to find all dated knowledge book files
    const files = await fs.readdir(DATA_DIR);
    const knowledgeBookFiles = files.filter(file => file.startsWith('knowledge-books-') && file.endsWith('.json'));
    
    // If we found dated files, read from them
    if (knowledgeBookFiles.length > 0) {
      logger.info(`Found ${knowledgeBookFiles.length} dated knowledge book files: ${knowledgeBookFiles.join(', ')}`);
      
      // Load all books from all dated files
      for (const file of knowledgeBookFiles) {
        try {
          const filePath = path.join(DATA_DIR, file);
          logger.debug(`Attempting to load knowledge books from: ${filePath}`);
          
          // Check if the file exists and is accessible
          if (await fileExists(filePath)) {
            const fileData = await fs.readFile(filePath, 'utf8');
            let booksData;
            
            try {
              booksData = JSON.parse(fileData);
              logger.debug(`Successfully parsed JSON from ${file}`);
            } catch (parseError) {
              logger.error(`Error parsing JSON from ${file}:`, parseError);
              continue;
            }
            
            if (Array.isArray(booksData)) {
              // Add books from this file, avoiding duplicates by ID
              const existingIds = new Set(allBooks.map(book => book.id));
              const uniqueBooks = booksData.filter(book => !existingIds.has(book.id));
              
              allBooks.push(...uniqueBooks);
              logger.debug(`Added ${uniqueBooks.length} books from ${file}`);
              
              // Update our set of IDs
              uniqueBooks.forEach(book => existingIds.add(book.id));
            } else {
              logger.warn(`File ${file} does not contain an array of books`);
            }
          } else {
            logger.warn(`File ${file} exists in directory listing but is not accessible`);
          }
        } catch (readError) {
          logger.warn(`Error reading knowledge book file ${file}: ${readError.message}`);
        }
      }
      
      // Sort all books by date - newest first
      allBooks.sort((a, b) => {
        const dateA = new Date(a.date || a.createdAt || 0);
        const dateB = new Date(b.date || b.createdAt || 0);
        return dateB - dateA;
      });
      
      logger.info(`Loaded ${allBooks.length} total knowledge books from dated files`);
      return allBooks;
    }
    
    // For backward compatibility: If no dated files, try the main file
    logger.debug(`No dated knowledge book files found, trying legacy file: ${KNOWLEDGE_BOOKS_FILE}`);
    await fs.access(KNOWLEDGE_BOOKS_FILE);
    const data = await fs.readFile(KNOWLEDGE_BOOKS_FILE, 'utf8');
    logger.warn('Using deprecated knowledge-books.json file - future collections will use dated files');
    return JSON.parse(data);
  } catch (error) {
    logger.warn('Knowledge books files not found or invalid, returning empty array', error);
    return [];
  }
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

// Initialize collection service
const collectionService = createCollectionService({
  logger,
  collectionState,
  collectionHistory,
  USER_DIR,
  KNOWLEDGE_BOOKS_FILE,
  loadKnowledgeBooks,
  loadApiKeys, // Add API key loading function
  rootDir: path.join(__dirname, '..')
});

// Options required for router initialization
const routerOptions = {
  logger,
  searchService,
  collectionState,
  collectionHistory,
  loadKnowledgeBooks,
  loadUserInterests,
  loadApiKeys,
  saveApiKeys,
  saveUserInterests,
  USER_DIR,
  DATA_DIR,
  KNOWLEDGE_BOOKS_FILE,
  simulateCollection: collectionService.simulateCollection
};

// API router setup
app.use('/api', createApiRoutes(routerOptions));

// Search router setup
app.use('/search', createSearchRoutes(routerOptions));

// Collection router setup
app.use('/collection', createCollectionRoutes(routerOptions));

/**
 * Main route - Data file selection
 */
app.get('/', async (req, res) => {
  try {
    const dataFiles = await findAvailableDataFiles();
    
    if (dataFiles.length === 0) {
      return res.render('no-data', {
        title: 'Saphira GUI Viewer - No Data'
      });
    }
    
    // Variables expected by index.ejs template
    let knowledgeBooks = [];
    let interests = [];
    let popularTags = [];
    
    // Get knowledge books
    try {
      knowledgeBooks = await loadKnowledgeBooks();
      
      // Ensure books are sorted by newest date first
      knowledgeBooks.sort((a, b) => {
        const dateA = new Date(a.date || a.createdAt || 0);
        const dateB = new Date(b.date || b.createdAt || 0);
        return dateB - dateA;
      });
    } catch (error) {
      logger.error('Failed to load knowledge books', error);
    }
    
    // Get user interests
    try {
      interests = await loadUserInterests();
    } catch (error) {
      logger.error('Failed to load user interests', error);
    }
    
    // Calculate tag counts
    const tagCounts = {};
    knowledgeBooks.forEach(book => {
      if (book.tags && Array.isArray(book.tags)) {
        book.tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });
    
    // Extract popular tags
    popularTags = Object.keys(tagCounts).map(name => ({
      name,
      count: tagCounts[name]
    })).sort((a, b) => b.count - a.count).slice(0, 10);
    
    res.render('index', {
      title: 'Saphira GUI Viewer',
      dataFiles,
      knowledgeBooks,
      interests,
      popularTags
    });
  } catch (error) {
    logger.error('Error loading data files', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load data files',
      error
    });
  }
});

/**
 * API Keys management route
 */
app.get('/api-keys', async (req, res) => {
  try {
    const apiKeys = await loadApiKeys();
    
    res.render('api-keys', {
      title: 'API Key Management',
      apiKeys
    });
  } catch (error) {
    logger.error('Error loading API keys', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load API keys',
      error
    });
  }
});

/**
 * API Keys update route
 */
app.post('/api-keys/update', async (req, res) => {
  try {
    logger.debug('Updating API keys', req.body);
    const apiKeys = await loadApiKeys();
    
    // Update main API keys
    apiKeys.newsApiKey = req.body.newsApiKey || '';
    apiKeys.githubApiKey = req.body.githubApiKey || '';
    
    // Update other API keys if they exist
    for (const key in req.body) {
      if (key.startsWith('otherApiKeys.')) {
        const keyName = key.replace('otherApiKeys.', '');
        apiKeys.otherApiKeys[keyName] = req.body[key];
      }
    }
    
    // Add new API key if provided
    if (req.body.newKeyName && req.body.newKeyValue) {
      apiKeys.otherApiKeys[req.body.newKeyName] = req.body.newKeyValue;
    }
    
    await saveApiKeys(apiKeys);
    
    res.render('api-keys', {
      title: 'API Key Management',
      apiKeys,
      message: 'API keys updated successfully'
    });
  } catch (error) {
    logger.error('Error updating API keys', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to update API keys',
      error
    });
  }
});

/**
 * Interest tags management route
 */
app.get('/interests', async (req, res) => {
  try {
    const interests = await loadUserInterests();
    
    res.render('interests', {
      title: 'User Interest Tags',
      interests
    });
  } catch (error) {
    logger.error('Error loading user interests', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load user interests',
      error
    });
  }
});

/**
 * Add interest tag route
 */
app.post('/interests/add', async (req, res) => {
  try {
    const interests = await loadUserInterests();
    const { name, description, tags, score } = req.body;
    
    // Validate input
    if (!name) {
      return res.render('interests', {
        title: 'User Interest Tags',
        interests,
        message: 'Interest name is required'
      });
    }
    
    // Create new interest
    const newInterest = {
      id: uuidv4(),
      name: name,
      description: description || '',
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      score: parseInt(score) || 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Add to interests array
    interests.push(newInterest);
    
    // Save updated interests
    await saveUserInterests(interests);
    
    logger.info(`Added new interest: ${name}`);
    
    res.render('interests', {
      title: 'User Interest Tags',
      interests,
      message: 'Interest tag added successfully'
    });
  } catch (error) {
    logger.error('Error adding interest tag', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to add interest tag',
      error
    });
  }
});

/**
 * Update interest tag route
 */
app.post('/interests/update', async (req, res) => {
  try {
    const interests = await loadUserInterests();
    const { id, name, description, tags, score } = req.body;
    
    // Find interest by ID
    const interestIndex = interests.findIndex(interest => interest.id === id);
    
    if (interestIndex === -1) {
      return res.render('interests', {
        title: 'User Interest Tags',
        interests,
        message: 'Interest not found'
      });
    }
    
    // Update interest
    interests[interestIndex] = {
      ...interests[interestIndex],
      name: name || interests[interestIndex].name,
      description: description || '',
      tags: tags ? tags.split(',').map(tag => tag.trim()) : interests[interestIndex].tags,
      score: parseInt(score) || interests[interestIndex].score,
      updatedAt: new Date().toISOString()
    };
    
    // Save updated interests
    await saveUserInterests(interests);
    
    logger.info(`Updated interest: ${name}`);
    
    res.render('interests', {
      title: 'User Interest Tags',
      interests,
      message: 'Interest tag updated successfully'
    });
  } catch (error) {
    logger.error('Error updating interest tag', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to update interest tag',
      error
    });
  }
});

/**
 * Delete interest tag route
 */
app.get('/interests/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const interests = await loadUserInterests();
    
    // Find interest by ID
    const interestIndex = interests.findIndex(interest => interest.id === id);
    
    if (interestIndex === -1) {
      return res.render('interests', {
        title: 'User Interest Tags',
        interests,
        message: 'Interest not found'
      });
    }
    
    // Remove interest
    const deletedInterest = interests.splice(interestIndex, 1)[0];
    
    // Save updated interests
    await saveUserInterests(interests);
    
    logger.info(`Deleted interest: ${deletedInterest.name}`);
    
    res.render('interests', {
      title: 'User Interest Tags',
      interests,
      message: `Interest tag "${deletedInterest.name}" deleted successfully`
    });
  } catch (error) {
    logger.error('Error deleting interest tag', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to delete interest tag',
      error
    });
  }
});

/**
 * Delete a specific knowledge book
 */
app.get('/delete/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    // Load current knowledge books
    let knowledgeBooks = await loadKnowledgeBooks();
    
    // Find the book by ID
    const bookIndex = knowledgeBooks.findIndex(book => book.id === id);
    
    if (bookIndex === -1) {
      logger.warn(`Knowledge book not found for deletion: ${id}`);
      return res.redirect('/?message=Item not found');
    }
    
    // Store the title and collection info for the message
    const deletedTitle = knowledgeBooks[bookIndex].title;
    const collectionDate = knowledgeBooks[bookIndex].collectionDate;
    
    // Remove the book
    knowledgeBooks.splice(bookIndex, 1);
    
    // Save updated knowledge books to main file
    await fs.writeFile(
      KNOWLEDGE_BOOKS_FILE,
      JSON.stringify(knowledgeBooks, null, 2),
      'utf8'
    );
    
    // Also update the dated knowledge books file if it exists and we know which collection this came from
    if (collectionDate) {
      try {
        const datedBooksFilename = `knowledge-books-${collectionDate}.json`;
        const datedBooksPath = path.join(DATA_DIR, datedBooksFilename);
        
        if (await fileExists(datedBooksPath)) {
          const datedBooks = JSON.parse(await fs.readFile(datedBooksPath, 'utf8'));
          const datedBookIndex = datedBooks.findIndex(book => book.id === id);
          
          if (datedBookIndex !== -1) {
            datedBooks.splice(datedBookIndex, 1);
            await fs.writeFile(datedBooksPath, JSON.stringify(datedBooks, null, 2), 'utf8');
            logger.info(`Updated dated knowledge books file: ${datedBooksFilename}`);
          }
        }
      } catch (err) {
        logger.warn(`Could not update dated knowledge books file: ${err.message}`);
      }
    }
    
    logger.info(`Deleted knowledge book: ${deletedTitle} (${id})`);
    
    // Redirect back to homepage with success message
    res.redirect(`/?message=Successfully deleted "${deletedTitle}"`);
  } catch (error) {
    logger.error('Error deleting knowledge book', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to delete knowledge book',
      error
    });
  }
});

/**
 * Delete all knowledge books
 */
app.get('/delete-all', async (req, res) => {
  try {
    // Get current count for logging
    let knowledgeBooks = [];
    try {
      knowledgeBooks = await loadKnowledgeBooks();
    } catch (error) {
      logger.warn('Failed to load knowledge books for counting before deletion');
    }
    
    const count = knowledgeBooks.length;
    
    // Save empty array to knowledge books file
    await fs.writeFile(
      KNOWLEDGE_BOOKS_FILE,
      JSON.stringify([]),
      'utf8'
    );
    
    // Delete all dated knowledge book files in the data directory
    try {
      const files = await fs.readdir(DATA_DIR);
      for (const file of files) {
        if (file.startsWith('knowledge-books-') && file.endsWith('.json')) {
          try {
            await fs.unlink(path.join(DATA_DIR, file));
            logger.info(`Deleted dated knowledge books file: ${file}`);
          } catch (err) {
            logger.warn(`Failed to delete dated knowledge books file ${file}: ${err.message}`);
          }
        }
      }
    } catch (err) {
      logger.warn(`Error listing data directory: ${err.message}`);
    }
    
    // Also remove old collection files from the user directory
    try {
      const files = await fs.readdir(USER_DIR);
      for (const file of files) {
        if (file.startsWith('collection_') && file.endsWith('.json')) {
          try {
            await fs.unlink(path.join(USER_DIR, file));
            logger.info(`Deleted collection file: ${file}`);
          } catch (err) {
            logger.warn(`Failed to delete collection file ${file}: ${err.message}`);
          }
        }
      }
    } catch (err) {
      logger.warn(`Error listing user directory: ${err.message}`);
    }
    
    logger.info(`Deleted all knowledge books (${count} items)`);
    
    // Redirect back to homepage with success message
    res.redirect('/?message=Successfully deleted all knowledge books');
  } catch (error) {
    logger.error('Error deleting all knowledge books', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to delete all knowledge books',
      error
    });
  }
});

/**
 * Data view route - Display selected file
 */
app.get('/view/:fileId', async (req, res) => {
  const { fileId } = req.params;
  const { q } = req.query; // Search query
  
  try {
    const dataFiles = await findAvailableDataFiles();
    const file = dataFiles.find(f => f.id === fileId);
    
    if (!file) {
      logger.warn(`File not found: ${fileId}`);
      return res.status(404).render('error', {
        title: 'Not Found',
        message: 'The requested data file was not found'
      });
    }
    
    // Load data from file
    const rawData = await fs.readFile(file.path, 'utf8');
    const data = JSON.parse(rawData);
    
    // Process data based on type
    let processedData;
    let sourceTypes = [];
    
    if (fileId === 'enhanced-collection') {
      // Data grouped by source
      processedData = data;
      sourceTypes = Object.keys(data);
      
      // Filter by search query if provided
      if (q) {
        const filteredData = {};
        sourceTypes.forEach(source => {
          const filtered = data[source].filter(item => 
            item.title.toLowerCase().includes(q.toLowerCase()) || 
            item.contentSummary.toLowerCase().includes(q.toLowerCase()) ||
            item.tags.some(tag => tag.toLowerCase().includes(q.toLowerCase()))
          );
          
          if (filtered.length > 0) {
            filteredData[source] = filtered;
          }
        });
        
        processedData = filteredData;
        sourceTypes = Object.keys(filteredData);
      }
    } else if (fileId === 'api-collection') {
      // Simple array data
      if (q) {
        processedData = data.filter(item => 
          item.title.toLowerCase().includes(q.toLowerCase()) || 
          item.summary.toLowerCase().includes(q.toLowerCase()) ||
          (item.tags && item.tags.some(tag => tag.toLowerCase().includes(q.toLowerCase())))
        );
      } else {
        processedData = data;
      }
    } else {
      // Other data displays directly
      processedData = data;
    }
    
    res.render('data-view', {
      title: `Saphira - ${file.name}`,
      fileId,
      fileName: file.name,
      data: processedData,
      sourceTypes,
      query: q || ''
    });
  } catch (error) {
    logger.error('Error loading data', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load data',
      error
    });
  }
});

/**
 * Detail view route - Display individual item details
 */
app.get('/detail/:fileId/:source/:index', async (req, res) => {
  const { fileId, source, index } = req.params;
  
  try {
    const dataFiles = await findAvailableDataFiles();
    const file = dataFiles.find(f => f.id === fileId);
    
    if (!file) {
      logger.warn(`File not found: ${fileId}`);
      return res.status(404).render('error', {
        title: 'Not Found',
        message: 'The requested data file was not found'
      });
    }
    
    // Load data from file
    const rawData = await fs.readFile(file.path, 'utf8');
    const data = JSON.parse(rawData);
    
    let item;
    
    if (fileId === 'enhanced-collection') {
      // Data grouped by source - get item by source and index
      if (data[source] && data[source][parseInt(index)]) {
        item = data[source][parseInt(index)];
      }
    } else if (fileId === 'api-collection') {
      // Simple array data - get by index
      item = data[parseInt(index)];
    } else {
      // Other data - get by index
      item = data[parseInt(index)];
    }
    
    if (!item) {
      logger.warn(`Item not found: ${fileId}/${source}/${index}`);
      return res.status(404).render('error', {
        title: 'Not Found',
        message: 'The requested item was not found'
      });
    }
    
    res.render('detail-view', {
      title: `Saphira - ${item.title}`,
      fileId,
      fileName: file.name,
      item,
      source
    });
  } catch (error) {
    logger.error('Error loading item details', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load item details',
      error
    });
  }
});

/**
 * Knowledge book details route
 */
app.get('/details/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    // Get knowledge books
    let book = null;
    
    try {
      const books = await loadKnowledgeBooks();
      book = books.find(b => b.id === id);
    } catch (error) {
      logger.error('Failed to load knowledge books', error);
    }
    
    if (!book) {
      logger.warn(`Knowledge book not found: ${id}`);
      return res.status(404).render('error', {
        title: 'Not Found',
        message: 'The requested knowledge book was not found'
      });
    }
    
    res.render('detail-view', {
      title: `Saphira - ${book.title}`,
      item: book,
      source: book.source || 'unknown'
    });
  } catch (error) {
    logger.error('Error loading knowledge book details', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load knowledge book details',
      error
    });
  }
});

/**
 * Delete a data file
 */
app.get('/file/delete/:fileId', async (req, res) => {
  const { fileId } = req.params;
  
  try {
    const dataFiles = await findAvailableDataFiles();
    const file = dataFiles.find(f => f.id === fileId);
    
    if (!file) {
      logger.warn(`File not found for deletion: ${fileId}`);
      return res.redirect('/?message=File not found');
    }
    
    // Delete the file
    await fs.unlink(file.path);
    logger.info(`Deleted file: ${file.name} (${file.path})`);
    
    // Redirect back to homepage with success message
    return res.redirect(`/?message=Successfully deleted "${file.name}"`);
  } catch (error) {
    logger.error('Error deleting file', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to delete file',
      error
    });
  }
});

/**
 * Tag filter route
 */
app.get('/tag/:tagName', async (req, res) => {
  const { tagName } = req.params;
  
  try {
    let knowledgeBooks = [];
    
    // Get knowledge books
    try {
      const allBooks = await loadKnowledgeBooks();
      
      // Filter by tag
      knowledgeBooks = allBooks.filter(book => 
        book.tags && book.tags.includes(tagName)
      );
    } catch (error) {
      logger.error('Failed to load knowledge books for tag filter', error);
    }
    
    // Get user interests
    let interests = [];
    try {
      interests = await loadUserInterests();
    } catch (error) {
      logger.error('Failed to load user interests', error);
    }
    
    res.render('index', {
      title: `Saphira - Tag: ${tagName}`,
      knowledgeBooks,
      interests,
      popularTags: [],
      dataFiles: [],
      tagFilter: tagName
    });
  } catch (error) {
    logger.error('Error loading data for tag', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load data for tag',
      error
    });
  }
});

// Ensure directories exist before starting server
ensureDirectories().then(() => {
  // Start server
  app.listen(port, () => {
    logger.info(`Saphira GUI Viewer is running at http://localhost:${port}`);
    logger.info('Press Ctrl+C to stop the server');
  });
}).catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});