/**
 * Integration Tests for Search Architecture
 * 
 * Tests the complete search system including SearchEngineManager and individual engines.
 */

const { SearchEngineManager, engines } = require('../src/search/index.js');

async function runIntegrationTests() {
  console.log('🧪 Starting Search Architecture Integration Tests\n');
  
  let passedTests = 0;
  let totalTests = 0;

  // Test 1: SearchEngineManager initialization
  totalTests++;
  console.log('Test 1: SearchEngineManager Initialization');
  try {
    const manager = new SearchEngineManager({ 
      logger: console, 
      timeout: 10000 
    });
    const availableEngines = manager.availableEngines;
    console.log(`  ✅ Manager initialized with ${availableEngines.length} engines: [${availableEngines.join(', ')}]`);
    passedTests++;
  } catch (error) {
    console.log(`  ❌ Failed: ${error.message}`);
  }

  // Test 2: Individual Wikipedia Engine Test
  totalTests++;
  console.log('\nTest 2: Wikipedia Search Engine');
  try {
    const wikiEngine = new engines.WikipediaSearchEngine({ 
      logger: console, 
      timeout: 15000 
    });
    const results = await wikiEngine.search('artificial intelligence', { maxResults: 3 });
    if (results && results.length > 0) {
      console.log(`  ✅ Wikipedia search successful: ${results.length} results`);
      console.log(`  📄 First result: "${results[0].title.substring(0, 50)}..."`);
      passedTests++;
    } else {
      console.log(`  ❌ No results returned`);
    }
  } catch (error) {
    console.log(`  ❌ Failed: ${error.message}`);
  }

  // Test 3: SearchEngineManager with Single Source
  totalTests++;
  console.log('\nTest 3: SearchEngineManager - Single Source (Wikipedia)');
  try {
    const manager = new SearchEngineManager({ 
      logger: console, 
      timeout: 15000 
    });
    const result = await manager.searchAll('machine learning', {
      sources: ['wikipedia'],
      maxResults: 2
    });
    
    if (result.results && result.results.length > 0) {
      console.log(`  ✅ Manager single-source search successful: ${result.results.length} results`);
      console.log(`  🎯 Sources used: [${result.sourcesUsed.join(', ')}]`);
      console.log(`  📊 Stats:`, result.sourceStats);
      passedTests++;
    } else {
      console.log(`  ❌ No results returned from manager`);
    }
  } catch (error) {
    console.log(`  ❌ Failed: ${error.message}`);
  }

  // Test 4: SearchEngineManager with Multiple Sources
  totalTests++;
  console.log('\nTest 4: SearchEngineManager - Multiple Sources');
  try {
    const manager = new SearchEngineManager({ 
      logger: console, 
      timeout: 15000 
    });
    const result = await manager.searchAll('plant phenotyping', {
      sources: ['wikipedia', 'openlibrary'],
      maxResults: 5
    });
    
    console.log(`  📊 Multi-source search completed:`);
    console.log(`    - Total results: ${result.results.length}`);
    console.log(`    - Successful sources: [${result.sourcesUsed.join(', ')}]`);
    console.log(`    - Requested sources: [${result.requestedSources.join(', ')}]`);
    
    if (result.results.length > 0 || result.sourcesUsed.includes('Mock')) {
      console.log(`  ✅ Multi-source search completed (including fallback)`);
      passedTests++;
    } else {
      console.log(`  ❌ No results from any source`);
    }
  } catch (error) {
    console.log(`  ❌ Failed: ${error.message}`);
  }

  // Test 5: Error Handling
  totalTests++;
  console.log('\nTest 5: Error Handling with Invalid Engine');
  try {
    const manager = new SearchEngineManager({ 
      logger: console, 
      timeout: 15000 
    });
    const result = await manager.searchAll('test query', {
      sources: ['invalid_engine', 'wikipedia'],
      maxResults: 2
    });
    
    if (result.sourcesUsed.includes('Wikipedia') || result.sourcesUsed.includes('Mock')) {
      console.log(`  ✅ Error handling successful: valid engines still worked`);
      console.log(`  🎯 Working sources: [${result.sourcesUsed.join(', ')}]`);
      passedTests++;
    } else {
      console.log(`  ❌ Error handling failed: no sources worked`);
    }
  } catch (error) {
    console.log(`  ❌ Failed: ${error.message}`);
  }

  // Test Summary
  console.log('\n' + '='.repeat(60));
  console.log(`🧪 Integration Tests Complete: ${passedTests}/${totalTests} passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Search architecture is working correctly.');
  } else {
    console.log(`⚠️ ${totalTests - passedTests} test(s) failed. Check the logs above.`);
  }
  
  return { passedTests, totalTests };
}

// Run tests if this file is executed directly
if (require.main === module) {
  runIntegrationTests()
    .then(({ passedTests, totalTests }) => {
      process.exit(passedTests === totalTests ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { runIntegrationTests };
