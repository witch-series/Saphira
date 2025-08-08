/**
 * Google Search Adapter Test
 * Tests the new Google Search functionality using google-sr library
 */
const GoogleSearchAdapter = require('../src/googleSearchAdapter');

async function testGoogleSearchAdapter() {
  console.log('[INFO] === Google Search Adapter Test ===');
  console.log('[INFO] Testing real Google search functionality using google-sr library\n');

  const adapter = new GoogleSearchAdapter({
    maxResults: 5,
    logger: console
  });

  const testQueries = [
    'JavaScript programming',
    'Node.js tutorial',
    'machine learning'
  ];

  let totalTests = testQueries.length;
  let successfulTests = 0;
  let failedTests = 0;

  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    try {
      console.log('==========================================');
      console.log(`Test ${i + 1}/${totalTests}: "${query}"`);
      console.log('==========================================');

      const startTime = Date.now();
      const results = await adapter.collectData([query]);
      const duration = Date.now() - startTime;

      console.log(`[INFO] ✅ Search completed in ${duration}ms`);
      console.log(`[INFO] 📝 Total results: ${results.length}`);

      if (results.length > 0) {
        console.log('[INFO] 📄 Sample results:');
        results.slice(0, 3).forEach((result, idx) => {
          console.log(`[INFO]   ${idx + 1}. ${result.title}`);
          console.log(`[INFO]      🌐 ${result.sourceUrl}`);
          console.log(`[INFO]      📄 ${result.summary.substring(0, 100)}...`);
          console.log(`[INFO]      🏷️  Source: ${result.sourceName}`);
        });
        successfulTests++;
      } else {
        console.log('[WARN] ⚠️ No results returned');
        failedTests++;
      }

      console.log('');

      // Add delay between searches to be respectful
      if (i < testQueries.length - 1) {
        console.log('Waiting 3 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

    } catch (error) {
      console.log(`[ERROR] ❌ Test failed: ${error.message}`);
      failedTests++;
      console.log('');
      
      // Add delay even on failure
      if (i < testQueries.length - 1) {
        console.log('Waiting 3 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }

  console.log('\n==========================================');
  console.log('=== Google Search Adapter Test Summary ===');
  console.log(`Total tests: ${totalTests}`);
  console.log(`Successful: ${successfulTests} ✅`);
  console.log(`Failed: ${failedTests} ❌`);
  console.log(`Success rate: ${((successfulTests / totalTests) * 100).toFixed(1)}%`);

  if (successfulTests > 0) {
    console.log('\n[INFO] ✅ Google Search Adapter is working correctly!');
    console.log('[INFO] 🚀 Ready for production use.');
  } else {
    console.log('\n[WARN] ⚠️ All tests failed. Check network connectivity and google-sr library.');
  }

  console.log('==========================================');

  return successfulTests === totalTests;
}

// URL-only test
async function testGoogleSearchUrls() {
  console.log('\n[INFO] === Testing URL-only search functionality ===');
  
  const adapter = new GoogleSearchAdapter({
    maxResults: 5,
    logger: console
  });

  try {
    const urls = await adapter.getSearchUrls('React.js tutorial', 5);
    console.log(`[INFO] ✅ Found ${urls.length} URLs:`);
    urls.forEach((url, idx) => {
      console.log(`[INFO]   ${idx + 1}. ${url}`);
    });
    return urls.length > 0;
  } catch (error) {
    console.log(`[ERROR] ❌ URL search failed: ${error.message}`);
    return false;
  }
}

// Run the tests
async function runAllTests() {
  console.log('[INFO] 🚀 Starting Google Search Adapter tests...\n');
  
  const mainTestResult = await testGoogleSearchAdapter();
  const urlTestResult = await testGoogleSearchUrls();
  
  console.log('\n[INFO] ==========================================');
  console.log('[INFO] 🎯 FINAL TEST RESULTS');
  console.log('[INFO] ==========================================');
  console.log(`[INFO] Main functionality test: ${mainTestResult ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`[INFO] URL search test: ${urlTestResult ? '✅ PASS' : '❌ FAIL'}`);
  
  if (mainTestResult && urlTestResult) {
    console.log('\n[INFO] 🎉 ALL TESTS PASSED!');
    console.log('[INFO] Google Search Adapter is ready for production use.');
    process.exit(0);
  } else {
    console.log('\n[WARN] ⚠️ Some tests failed. Review the output above.');
    process.exit(1);
  }
}

runAllTests().catch(error => {
  console.error('[ERROR] Test suite failed:', error);
  process.exit(1);
});
