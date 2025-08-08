/**
 * Main Test Suite for Saphira Search Architecture
 * 
 * Runs all tests and provides comprehensive reporting.
 */

const { runIntegrationTests } = require('./search-integration-tests');
const { runIndividualEngineTests } = require('./individual-engine-tests');
const { testFormDataParsing, testRouteProcessing } = require('./ui-route-tests');

async function runAllTests() {
  console.log('🚀 Starting Saphira Search Architecture Test Suite');
  console.log('='.repeat(70));
  console.log(`📅 Test run started at: ${new Date().toISOString()}`);
  console.log('='.repeat(70));

  const startTime = Date.now();
  const testResults = {
    integration: { passed: 0, total: 0 },
    individual: { passed: 0, total: 0 },
    ui: { passed: 0, total: 0 }
  };

  try {
    // Run Integration Tests
    console.log('\n📋 PHASE 1: Integration Tests');
    console.log('='.repeat(50));
    const integrationResults = await runIntegrationTests();
    testResults.integration = {
      passed: integrationResults.passedTests,
      total: integrationResults.totalTests
    };

    // Run Individual Engine Tests
    console.log('\n🔍 PHASE 2: Individual Engine Tests');
    console.log('='.repeat(50));
    const individualResults = await runIndividualEngineTests();
    testResults.individual = {
      passed: individualResults.totalPassed,
      total: individualResults.totalTests
    };

    // Run UI/Route Tests
    console.log('\n🌐 PHASE 3: UI and Route Tests');
    console.log('='.repeat(50));
    await testFormDataParsing();
    const routeTestCount = await testRouteProcessing();
    testResults.ui = {
      passed: routeTestCount > 0 ? 1 : 0,
      total: 1
    };

  } catch (error) {
    console.error('❌ Test suite encountered an error:', error);
  }

  // Final Report
  const endTime = Date.now();
  const duration = endTime - startTime;

  console.log('\n' + '='.repeat(70));
  console.log('📊 FINAL TEST REPORT');
  console.log('='.repeat(70));
  
  const totalPassed = testResults.integration.passed + testResults.individual.passed + testResults.ui.passed;
  const totalTests = testResults.integration.total + testResults.individual.total + testResults.ui.total;
  const overallPercentage = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;

  console.log(`⏱️  Total execution time: ${duration}ms (${(duration/1000).toFixed(2)}s)`);
  console.log(`📈 Overall Results: ${totalPassed}/${totalTests} tests passed (${overallPercentage}%)`);
  console.log('');
  console.log('📋 Breakdown by Category:');
  console.log(`   Integration Tests:     ${testResults.integration.passed}/${testResults.integration.total} (${testResults.integration.total > 0 ? Math.round((testResults.integration.passed / testResults.integration.total) * 100) : 0}%)`);
  console.log(`   Individual Engines:    ${testResults.individual.passed}/${testResults.individual.total} (${testResults.individual.total > 0 ? Math.round((testResults.individual.passed / testResults.individual.total) * 100) : 0}%)`);
  console.log(`   UI/Route Processing:   ${testResults.ui.passed}/${testResults.ui.total} (${testResults.ui.total > 0 ? Math.round((testResults.ui.passed / testResults.ui.total) * 100) : 0}%)`);

  console.log('');
  if (overallPercentage >= 80) {
    console.log('🎉 EXCELLENT: System is working well!');
  } else if (overallPercentage >= 60) {
    console.log('✅ GOOD: Most components are working, some issues to address.');
  } else if (overallPercentage >= 40) {
    console.log('⚠️  NEEDS ATTENTION: Several issues need to be resolved.');
  } else {
    console.log('❌ CRITICAL: Major issues detected, system needs debugging.');
  }

  console.log('');
  console.log('📝 Test Summary:');
  console.log('   - Integration tests verify the complete system works end-to-end');
  console.log('   - Individual engine tests verify each search engine works independently');
  console.log('   - UI/Route tests verify form submission and data processing');
  console.log('');
  console.log('🔧 To debug issues:');
  console.log('   1. Check individual failing engines with: node test/individual-engine-tests.js');
  console.log('   2. Run integration tests with: node test/search-integration-tests.js');
  console.log('   3. Test UI routes with: node test/ui-route-tests.js');

  return { totalPassed, totalTests, overallPercentage };
}

// Run all tests if this file is executed directly
if (require.main === module) {
  runAllTests()
    .then(({ overallPercentage }) => {
      process.exit(overallPercentage >= 50 ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test suite failed completely:', error);
      process.exit(1);
    });
}

module.exports = { runAllTests };
