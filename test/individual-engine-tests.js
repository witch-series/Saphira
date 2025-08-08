/**
 * Individual Search Engine Tests
 * 
 * Tests each search engine individually to verify they work correctly.
 */

const { engines } = require('../src/search/index.js');

async function testSearchEngine(engineName, EngineClass, testQueries) {
  console.log(`\n🔍 Testing ${engineName} Search Engine`);
  console.log('-'.repeat(40));
  
  let passedTests = 0;
  let totalTests = testQueries.length;

  const engine = new EngineClass({
    logger: { 
      info: (msg) => console.log(`  📝 ${msg}`),
      debug: (msg) => console.log(`  🔍 ${msg}`),
      warn: (msg) => console.log(`  ⚠️ ${msg}`),
      error: (msg) => console.log(`  ❌ ${msg}`)
    },
    timeout: 15000,
    maxResults: 3
  });

  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    console.log(`\n  Test ${i + 1}: "${query}"`);
    
    try {
      const startTime = Date.now();
      const results = await engine.search(query, { maxResults: 3 });
      const duration = Date.now() - startTime;
      
      if (results && Array.isArray(results)) {
        console.log(`  ✅ Success: ${results.length} results in ${duration}ms`);
        if (results.length > 0) {
          console.log(`  📄 First result: "${results[0].title?.substring(0, 60)}..."`);
          console.log(`  🔗 URL: ${results[0].url}`);
        }
        passedTests++;
      } else {
        console.log(`  ❌ Invalid results format:`, typeof results);
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }

  console.log(`\n  📊 ${engineName} Results: ${passedTests}/${totalTests} tests passed`);
  return { passedTests, totalTests };
}

async function runIndividualEngineTests() {
  console.log('🧪 Starting Individual Search Engine Tests\n');
  
  const testResults = [];

  // Test Wikipedia
  const wikiResults = await testSearchEngine('Wikipedia', engines.WikipediaSearchEngine, [
    'artificial intelligence',
    'machine learning',
    'computer science'
  ]);
  testResults.push({ name: 'Wikipedia', ...wikiResults });

  // Test OpenLibrary  
  const openLibResults = await testSearchEngine('OpenLibrary', engines.OpenLibrarySearchEngine, [
    'programming',
    'javascript',
    'algorithms'
  ]);
  testResults.push({ name: 'OpenLibrary', ...openLibResults });

  // Test Google
  const googleResults = await testSearchEngine('Google', engines.GoogleSearchEngine, [
    'Node.js tutorial',
    'React documentation'
  ]);
  testResults.push({ name: 'Google', ...googleResults });

  // Test arXiv
  const arxivResults = await testSearchEngine('arXiv', engines.ArxivSearchEngine, [
    'machine learning',
    'neural networks'
  ]);
  testResults.push({ name: 'arXiv', ...arxivResults });

  // Test GitHub
  const githubResults = await testSearchEngine('GitHub', engines.GitHubSearchEngine, [
    'javascript search engine',
    'node.js web server'
  ]);
  testResults.push({ name: 'GitHub', ...githubResults });

  // Test MDN
  const mdnResults = await testSearchEngine('MDN', engines.MDNSearchEngine, [
    'javascript array',
    'css flexbox'
  ]);
  testResults.push({ name: 'MDN', ...mdnResults });

  // Test StackOverflow
  const stackResults = await testSearchEngine('StackOverflow', engines.StackOverflowSearchEngine, [
    'javascript promises',
    'node.js express'
  ]);
  testResults.push({ name: 'StackOverflow', ...stackResults });

  // Test Mock (should always work)
  const mockResults = await testSearchEngine('Mock', engines.MockSearchEngine, [
    'test query'
  ]);
  testResults.push({ name: 'Mock', ...mockResults });

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Individual Engine Test Summary:');
  console.log('='.repeat(60));
  
  let totalPassed = 0;
  let totalTests = 0;
  
  testResults.forEach(result => {
    totalPassed += result.passedTests;
    totalTests += result.totalTests;
    const percentage = result.totalTests > 0 ? Math.round((result.passedTests / result.totalTests) * 100) : 0;
    console.log(`${result.name.padEnd(15)}: ${result.passedTests}/${result.totalTests} (${percentage}%)`);
  });
  
  console.log('-'.repeat(60));
  console.log(`Overall Total: ${totalPassed}/${totalTests} (${Math.round((totalPassed / totalTests) * 100)}%)`);
  
  return { totalPassed, totalTests, engineResults: testResults };
}

// Run tests if this file is executed directly
if (require.main === module) {
  runIndividualEngineTests()
    .then(({ totalPassed, totalTests }) => {
      process.exit(totalPassed > totalTests * 0.5 ? 0 : 1); // Pass if more than 50% work
    })
    .catch(error => {
      console.error('❌ Individual engine test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { runIndividualEngineTests, testSearchEngine };
