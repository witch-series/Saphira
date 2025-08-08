/**
 * UI Form and Route Tests
 * 
 * Tests the UI form submission and route processing to debug search issues.
 */

const express = require('express');
const request = require('supertest');
const path = require('path');

// Mock SearchService for testing
class MockSearchService {
  constructor() {
    this.searchCalls = [];
  }

  async search(query, options) {
    this.searchCalls.push({ query, options, timestamp: new Date().toISOString() });
    console.log(`📝 MockSearchService received: query="${query}", sources=[${options.sources?.join(', ') || 'none'}]`);
    
    return {
      results: [
        {
          title: `Mock result for "${query}"`,
          url: 'https://example.com/mock',
          summary: 'This is a mock search result for testing',
          source: 'Mock',
          tags: ['test']
        }
      ],
      source: 'Mock',
      cached: false,
      query: query,
      totalResults: 1,
      sourcesUsed: 1
    };
  }

  getSearchHistory() {
    return this.searchCalls;
  }
}

async function testRouteProcessing() {
  console.log('🧪 Testing Route Processing and Form Data\n');

  // Create express app for testing
  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  // Set up EJS
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '../ui/views'));

  const mockSearchService = new MockSearchService();
  
  // Mock logger
  const logger = {
    info: (msg, ...args) => console.log(`📝 ${msg}`, ...args),
    debug: (msg, ...args) => console.log(`🔍 ${msg}`, ...args),
    warn: (msg, ...args) => console.log(`⚠️ ${msg}`, ...args),
    error: (msg, ...args) => console.log(`❌ ${msg}`, ...args)
  };

  // Load collection routes
  const collectionRoutes = require('../src/routes/collection-routes')({
    logger: logger,
    searchService: mockSearchService
  });

  app.use('/collection', collectionRoutes);

  console.log('Test 1: Form submission with multiple sources');
  try {
    const response = await request(app)
      .post('/collection/search')
      .send({
        query: 'test search query',
        sources: ['wikipedia', 'arxiv', 'google'],
        maxResults: '10'
      });

    console.log(`  Response status: ${response.status}`);
    
    const searchHistory = mockSearchService.getSearchHistory();
    if (searchHistory.length > 0) {
      const lastSearch = searchHistory[searchHistory.length - 1];
      console.log(`  ✅ Search executed with query: "${lastSearch.query}"`);
      console.log(`  📋 Sources received: [${lastSearch.options.sources?.join(', ') || 'none'}]`);
      console.log(`  🔢 Max results: ${lastSearch.options.maxResults}`);
    } else {
      console.log(`  ❌ No search was executed`);
    }
  } catch (error) {
    console.log(`  ❌ Test failed: ${error.message}`);
  }

  console.log('\nTest 2: Form submission with single source');
  try {
    const response = await request(app)
      .post('/collection/search')
      .send({
        query: 'another test',
        sources: 'wikipedia',  // Single string instead of array
        maxResults: '5'
      });

    const searchHistory = mockSearchService.getSearchHistory();
    const lastSearch = searchHistory[searchHistory.length - 1];
    console.log(`  ✅ Single source test - Sources: [${lastSearch.options.sources?.join(', ') || 'none'}]`);
  } catch (error) {
    console.log(`  ❌ Single source test failed: ${error.message}`);
  }

  console.log('\nTest 3: Form submission with no sources selected');
  try {
    const response = await request(app)
      .post('/collection/search')
      .send({
        query: 'default sources test',
        maxResults: '5'
        // No sources parameter
      });

    const searchHistory = mockSearchService.getSearchHistory();
    const lastSearch = searchHistory[searchHistory.length - 1];
    console.log(`  ✅ Default sources test - Sources: [${lastSearch.options.sources?.join(', ') || 'none'}]`);
  } catch (error) {
    console.log(`  ❌ Default sources test failed: ${error.message}`);
  }

  // Summary
  console.log('\n📊 Route Testing Summary:');
  const allSearches = mockSearchService.getSearchHistory();
  console.log(`Total searches executed: ${allSearches.length}`);
  
  allSearches.forEach((search, index) => {
    console.log(`  ${index + 1}. "${search.query}" -> [${search.options.sources?.join(', ') || 'default'}]`);
  });

  return allSearches.length;
}

async function testFormDataParsing() {
  console.log('\n🧪 Testing Form Data Parsing\n');

  // Test different form data formats
  const testCases = [
    {
      name: 'Multiple checkboxes selected',
      data: { sources: ['wikipedia', 'arxiv', 'google'] },
      expected: ['wikipedia', 'arxiv', 'google']
    },
    {
      name: 'Single checkbox selected',
      data: { sources: 'wikipedia' },
      expected: ['wikipedia']
    },
    {
      name: 'No checkboxes selected',
      data: {},
      expected: ['wikipedia', 'openlibrary', 'google', 'arxiv']
    },
    {
      name: 'Empty sources array',
      data: { sources: [] },
      expected: ['wikipedia', 'openlibrary', 'google', 'arxiv']
    }
  ];

  testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: ${testCase.name}`);
    
    const { sources } = testCase.data;
    
    // Simulate the logic from collection-routes.js
    const selectedSources = sources && sources.length > 0 ? 
      (Array.isArray(sources) ? sources : [sources]) : 
      ['wikipedia', 'openlibrary', 'google', 'arxiv'];
    
    const matches = JSON.stringify(selectedSources) === JSON.stringify(testCase.expected);
    console.log(`  Input: ${JSON.stringify(sources)}`);
    console.log(`  Result: [${selectedSources.join(', ')}]`);
    console.log(`  Expected: [${testCase.expected.join(', ')}]`);
    console.log(`  ${matches ? '✅ PASS' : '❌ FAIL'}`);
  });
}

// Run tests if this file is executed directly
if (require.main === module) {
  async function runAllTests() {
    await testFormDataParsing();
    const routeTests = await testRouteProcessing();
    
    console.log('\n🎉 UI and Route testing complete!');
    return routeTests > 0;
  }

  runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ UI test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testRouteProcessing, testFormDataParsing };
