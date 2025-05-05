/**
 * API Collection Test
 * 
 * This test verifies the Saphira API collection functionality.
 * It uses the following APIs:
 * - NewsAPI (requires API key)
 * - arXiv API (no API key required)
 * 
 * How to run:
 * 1. Set your NewsAPI key in user/api-keys.json or as NEWS_API_KEY environment variable
 * 2. Run: `node test/core/apiCollection.test.js`
 */

// Import required modules
const fs = require('fs').promises;
const path = require('path');
const KnowledgeCollector = require('../../src/core/knowledgeCollector');
const NewsApiAdapter = require('../../src/core/sourceAdapters/newsApiAdapter');
const ArxivAdapter = require('../../src/core/sourceAdapters/arxivAdapter');
const Tagger = require('../../src/core/processingPipeline/tagger');
const UserInterest = require('../../src/models/userInterest');
const apiKeyManager = require('../../src/utils/apiKeyManager');

// Output configuration - Save results to user folder
const USER_DIR = path.join(__dirname, '..', '..', 'user');
const OUTPUT_FILE = path.join(USER_DIR, 'api-collection-results.json');
const LOG_FILE = path.join(USER_DIR, 'api-collection-log.txt');

// Create a logger that writes to both console and file
const logger = {
  _buffer: [],
  info: (message) => {
    const msg = `[INFO] ${message}`;
    console.log(msg);
    logger._buffer.push({ time: new Date().toISOString(), level: 'info', message });
  },
  debug: (message) => {
    const msg = `[DEBUG] ${message}`;
    console.log(msg);
    logger._buffer.push({ time: new Date().toISOString(), level: 'debug', message });
  },
  warn: (message) => {
    const msg = `[WARN] ${message}`;
    console.log(msg);
    logger._buffer.push({ time: new Date().toISOString(), level: 'warn', message });
  },
  error: (message, error) => {
    const msg = `[ERROR] ${message}`;
    console.error(msg, error);
    logger._buffer.push({ time: new Date().toISOString(), level: 'error', message, error: error?.toString() });
  },
  // Save logs to file
  saveToFile: async () => {
    try {
      await fs.mkdir(USER_DIR, { recursive: true });
      const logText = logger._buffer.map(entry => 
        `${entry.time} [${entry.level.toUpperCase()}] ${entry.message}${entry.error ? '\n' + entry.error : ''}`
      ).join('\n');
      await fs.writeFile(LOG_FILE, logText);
      return true;
    } catch (error) {
      console.error('Failed to save logs to file:', error);
      return false;
    }
  }
};

// Function to save collection results to a file
async function saveResults(books) {
  try {
    await fs.mkdir(USER_DIR, { recursive: true });
    
    // Format books for readable output
    const formattedBooks = books.map(book => ({
      id: book.id,
      title: book.title,
      author: book.author,
      category: book.category,
      tags: book.tags,
      summary: book.content.substring(0, 200) + (book.content.length > 200 ? '...' : ''),
      sourceUrl: book.sourceUrl,
      sourceName: book.sourceName,
      createdAt: book.createdAt
    }));
    
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(formattedBooks, null, 2));
    logger.info(`Results saved to user folder: ${OUTPUT_FILE}`);
    return true;
  } catch (error) {
    logger.error('Failed to save results to file:', error);
    return false;
  }
}

// Helper function to load interests from user folder
async function loadUserInterests() {
  try {
    const data = await fs.readFile(path.join(USER_DIR, 'data', 'user-interests.json'), 'utf8');
    const interestsData = JSON.parse(data);
    return interestsData.map(data => UserInterest.fromJSON(data));
  } catch (error) {
    logger.warn('Could not load user interests from file:', error.message);
    
    // Return default interests if file loading fails
    return [
      new UserInterest({
        userId: 'default-user',
        tags: ['quantum computing', 'quantum physics'],
        weight: 9,
        collectFrequency: 'daily'
      }),
      new UserInterest({
        userId: 'default-user',
        tags: ['space exploration', 'astronomy'],
        weight: 7,
        collectFrequency: 'daily'
      })
    ];
  }
}

/**
 * Main function - defines the test execution flow
 */
async function runTest() {
  logger.info('Starting Saphira API Collection test');
  
  // Load API keys
  const newsApiKey = await apiKeyManager.getApiKey('newsApiKey', 'NEWS_API_KEY');
  
  if (!newsApiKey) {
    logger.warn('NewsAPI key is not set. News article collection will be skipped.');
    logger.warn('Set your NewsAPI key in user/api-keys.json under newsApiKey.');
  }
  
  try {
    // 1. Load user interests from file
    const interests = await loadUserInterests();
    logger.info(`Loaded ${interests.length} interests from user data`);
    
    // 2. Configure information collection core components
    const collector = new KnowledgeCollector({ logger });
    
    // 3. Register API adapters
    if (newsApiKey) {
      collector.registerAdapter(
        new NewsApiAdapter({
          apiKey: newsApiKey,
          maxResults: 5,  // Limit results to avoid hitting API limits
          logger
        })
      );
    }
    
    collector.registerAdapter(
      new ArxivAdapter({
        maxResults: 5,
        logger
      })
    );
    
    // 4. Register processing pipeline (tagging only, no summarization)
    collector.registerProcessor(
      new Tagger({
        maxTags: 8,
        logger
      })
    );
    
    // 5. Execute information collection
    logger.info('Starting information collection from APIs...');
    const books = await collector.collectByInterests(interests);
    
    // 6. Display results
    logger.info(`Created ${books.length} knowledge books`);
    
    // Output details of results
    console.log('\n===== API Collection Test Results =====\n');
    books.forEach((book, index) => {
      console.log(`[Book ${index + 1}]`);
      console.log(`Title: ${book.title}`);
      console.log(`Author: ${book.author}`);
      console.log(`Source: ${book.sourceName}`);
      console.log(`Category: ${book.category}`);
      console.log(`Tags: ${book.tags.join(', ')}`);
      console.log(`URL: ${book.sourceUrl}`);
      console.log('-'.repeat(50));
    });
    
    // Save results to user folder
    await saveResults(books);
    
    return books.length > 0; // Success condition: At least one knowledge book was created
    
  } catch (error) {
    logger.error('Error during test execution:', error);
    return false;
  }
}

// Run the test
let testSuccess = false;
runTest()
  .then((success) => {
    testSuccess = success; // Save the success/failure result
    logger.info(`API Collection test ${success ? 'succeeded' : 'failed'}`);
    return logger.saveToFile();
  })
  .then(() => {
    console.log(`Logs saved to: ${LOG_FILE}`);
    process.exit(testSuccess ? 0 : 1); // Use the saved variable
  })
  .catch(error => {
    logger.error('Test execution failed:', error);
    logger.saveToFile()
      .then(() => process.exit(1));
  });