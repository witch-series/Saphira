/**
 * Enhanced API Collection Test
 * 
 * This test verifies the Saphira enhanced API collection functionality.
 * It uses the following APIs:
 * - NewsAPI (requires API key)
 * - arXiv API (no API key required)
 * - Wikipedia API (no API key required)
 * - GitHub API (API token recommended for higher rate limits)
 * 
 * How to run:
 * 1. Set your API keys in user/api-keys.json or as environment variables
 * 2. Run: `node test/core/enhancedApiCollection.test.js`
 */

// Import required modules
const fs = require('fs').promises;
const path = require('path');
const KnowledgeCollector = require('../../src/core/knowledgeCollector');
const NewsApiAdapter = require('../../src/core/sourceAdapters/newsApiAdapter');
const ArxivAdapter = require('../../src/core/sourceAdapters/arxivAdapter');
const WikipediaAdapter = require('../../src/core/sourceAdapters/wikipediaAdapter');
const GitHubAdapter = require('../../src/core/sourceAdapters/githubAdapter');
const Tagger = require('../../src/core/processingPipeline/tagger');
const UserInterest = require('../../src/models/userInterest');
const apiKeyManager = require('../../src/utils/apiKeyManager');

// Output configuration - Save results to user folder
const USER_DIR = path.join(__dirname, '..', '..', 'user');
const OUTPUT_FILE = path.join(USER_DIR, 'enhanced-collection-results.json');
const LOG_FILE = path.join(USER_DIR, 'enhanced-collection-log.txt');

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
    const formattedBooks = books.map(book => {
      // Create summary for content if it's too long
      const contentSummary = book.content.length > 500 
        ? book.content.substring(0, 500) + '...' 
        : book.content;
        
      return {
        id: book.id,
        title: book.title,
        author: book.author,
        category: book.category,
        tags: book.tags,
        contentSummary: contentSummary,
        sourceUrl: book.sourceUrl,
        sourceName: book.sourceName,
        createdAt: book.createdAt,
        metadata: book.metadata || {}
      };
    });
    
    // Group by source for better organization
    const groupedBySource = formattedBooks.reduce((acc, book) => {
      const source = book.sourceName;
      if (!acc[source]) {
        acc[source] = [];
      }
      acc[source].push(book);
      return acc;
    }, {});
    
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(groupedBySource, null, 2));
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
  logger.info('Starting Saphira Enhanced API Collection test');
  
  // Load API keys
  logger.info('Loading API keys from user/api-keys.json...');
  const newsApiKey = await apiKeyManager.getApiKey('newsApiKey', 'NEWS_API_KEY');
  const githubApiKey = await apiKeyManager.getApiKey('githubApiKey', 'GITHUB_API_KEY');
  
  // Log available adapters
  logger.info('Available adapters:');
  logger.info('- Wikipedia API (no authentication required)');
  logger.info('- arXiv API (no authentication required)');
  
  if (newsApiKey) {
    logger.info('- NewsAPI (authentication configured)');
  } else {
    logger.warn('- NewsAPI (authentication not configured - will be skipped)');
    logger.warn('  To use NewsAPI, add your API key to user/api-keys.json');
  }
  
  if (githubApiKey) {
    logger.info('- GitHub API (authentication configured for higher rate limits)');
  } else {
    logger.info('- GitHub API (authentication not configured - will use lower rate limits)');
    logger.info('  For higher rate limits, add your GitHub token to user/api-keys.json');
  }
  
  try {
    // 1. Load user interests
    const interests = await loadUserInterests();
    logger.info(`Loaded ${interests.length} interests for collection`);
    
    // Display interests
    interests.forEach(interest => {
      logger.info(`Interest: ${interest.tags.join(', ')} (weight: ${interest.weight})`);
    });
    
    // 2. Configure information collection core components
    const collector = new KnowledgeCollector({ logger });
    
    // 3. Register API adapters
    // Always add Wikipedia and arXiv (no API keys required)
    collector.registerAdapter(
      new WikipediaAdapter({
        maxResults: 2,
        logger
      })
    );
    
    collector.registerAdapter(
      new ArxivAdapter({
        maxResults: 3,
        logger
      })
    );
    
    // GitHub adapter (works with or without API key)
    collector.registerAdapter(
      new GitHubAdapter({
        apiKey: githubApiKey,
        maxResults: 2,
        logger
      })
    );
    
    // Add NewsAPI if key is provided
    if (newsApiKey) {
      collector.registerAdapter(
        new NewsApiAdapter({
          apiKey: newsApiKey,
          maxResults: 3,
          logger
        })
      );
    }
    
    // 4. Register processing pipeline (tagging only)
    collector.registerProcessor(
      new Tagger({
        maxTags: 8,
        logger
      })
    );
    
    // 5. Execute information collection
    logger.info('Starting information collection from all configured APIs...');
    const books = await collector.collectByInterests(interests);
    
    // 6. Display results
    logger.info(`Created ${books.length} knowledge books from multiple sources`);
    
    // Group books by source for display
    const booksBySource = books.reduce((acc, book) => {
      const source = book.sourceName;
      if (!acc[source]) {
        acc[source] = [];
      }
      acc[source].push(book);
      return acc;
    }, {});
    
    // Display summary by source
    console.log('\n===== Collection Results by Source =====\n');
    for (const [source, sourceBooks] of Object.entries(booksBySource)) {
      console.log(`\n== ${source} (${sourceBooks.length} items) ==\n`);
      
      sourceBooks.forEach((book, index) => {
        console.log(`[${index + 1}] ${book.title}`);
        console.log(`URL: ${book.sourceUrl}`);
        
        // If it's a GitHub repository, show additional metadata
        if (source === 'GitHub' && book.metadata) {
          console.log(`Language: ${book.metadata.language || 'Not specified'}`);
          console.log(`Stars: ${book.metadata.stars}, Forks: ${book.metadata.forks}`);
        }
        
        console.log('-'.repeat(50));
      });
    }
    
    // Save results to file
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
    logger.info(`Enhanced API Collection test ${success ? 'succeeded' : 'failed'}`);
    return logger.saveToFile();
  })
  .then(() => {
    console.log(`\nLogs saved to: ${LOG_FILE}`);
    console.log(`Results saved to: ${OUTPUT_FILE}`);
    process.exit(testSuccess ? 0 : 1); // Use the saved variable
  })
  .catch(error => {
    logger.error('Test execution failed:', error);
    logger.saveToFile()
      .then(() => process.exit(1));
  });