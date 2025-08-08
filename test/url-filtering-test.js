/**
 * URL Filtering Test
 * 
 * Tests URL filtering functionality to ensure duplicates are properly filtered out.
 */

const { SearchEngineManager } = require('../src/search/index.js');
const URLTracker = require('../src/services/url-tracker');

async function testURLFiltering() {
  console.log('🧪 Testing URL Filtering Functionality\n');

  // Create logger
  const logger = {
    info: (msg, ...args) => console.log(`📝 ${msg}`, ...args),
    debug: (msg, ...args) => console.log(`🔍 ${msg}`, ...args),
    warn: (msg, ...args) => console.log(`⚠️ ${msg}`, ...args),
    error: (msg, ...args) => console.log(`❌ ${msg}`, ...args)
  };

  try {
    // Initialize URL Tracker
    console.log('Step 1: Initializing URL Tracker');
    const urlTracker = new URLTracker({ 
      logger,
      urlListPath: require('path').join(__dirname, '../user/url-list.json')
    });
    await urlTracker.initialize();
    
    const urlCount = await urlTracker.getURLCount();
    console.log(`✅ URL Tracker initialized with ${urlCount} existing URLs\n`);

    // Show some existing URLs
    if (urlCount > 0) {
      const allUrls = await urlTracker.getAllURLs();
      console.log('📋 Sample of existing URLs:');
      allUrls.slice(0, 5).forEach((url, i) => {
        console.log(`  ${i + 1}. ${url}`);
      });
      if (allUrls.length > 5) {
        console.log(`  ... and ${allUrls.length - 5} more`);
      }
      console.log('');
    }

    // Initialize Search Engine Manager with URL Tracker
    console.log('Step 2: Testing Search with URL Filtering');
    const manager = new SearchEngineManager({
      logger,
      urlTracker,
      timeout: 15000
    });

    // Test search with plant phenotyping (should have many duplicates)
    console.log('🔍 Testing search for "plant phenotyping" (expecting many duplicates)...');
    const result = await manager.searchAll('plant phenotyping', {
      sources: ['wikipedia', 'openlibrary', 'arxiv'],
      maxResults: 10
    });

    console.log('\n📊 Search Results Summary:');
    console.log(`  - Total final results: ${result.results.length}`);
    console.log(`  - Sources used: [${result.sourcesUsed.join(', ')}]`);
    console.log(`  - Detailed statistics:`);
    
    Object.entries(result.sourceStats || {}).forEach(([source, stats]) => {
      console.log(`    ${source}: ${stats.original} found → ${stats.filtered} new (${stats.original - stats.filtered} duplicates)`);
    });

    // Test with a fresh query that should have no duplicates
    console.log('\n🔍 Testing search for "quantum computing" (expecting few/no duplicates)...');
    const freshResult = await manager.searchAll('quantum computing', {
      sources: ['wikipedia', 'openlibrary'],
      maxResults: 5
    });

    console.log('\n📊 Fresh Query Results Summary:');
    console.log(`  - Total final results: ${freshResult.results.length}`);
    console.log(`  - Sources used: [${freshResult.sourcesUsed.join(', ')}]`);
    console.log(`  - Detailed statistics:`);
    
    Object.entries(freshResult.sourceStats || {}).forEach(([source, stats]) => {
      console.log(`    ${source}: ${stats.original} found → ${stats.filtered} new (${stats.original - stats.filtered} duplicates)`);
    });

    // Test specific URL checking
    console.log('\nStep 3: Testing Individual URL Checking');
    const testUrls = [
      'https://en.wikipedia.org/wiki/Plant_phenotyping',
      'http://arxiv.org/abs/1903.01652v1', // Should be in existing list
      'https://example.com/new-url-test-12345' // Should be new
    ];

    for (const url of testUrls) {
      const isProcessed = await urlTracker.hasBeenProcessed(url);
      console.log(`  ${url}`);
      console.log(`    Status: ${isProcessed ? '❌ Already processed' : '✅ New URL'}`);
    }

    console.log('\n🎉 URL Filtering Test Complete!');
    
    return {
      existingUrlCount: urlCount,
      plantSearchResults: result.results.length,
      quantumSearchResults: freshResult.results.length,
      plantStats: result.sourceStats,
      quantumStats: freshResult.sourceStats
    };

  } catch (error) {
    console.error('❌ URL Filtering test failed:', error);
    throw error;
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testURLFiltering()
    .then((results) => {
      console.log('\n📈 Test completed successfully:', results);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testURLFiltering };
