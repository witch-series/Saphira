/**
 * SearchService Integration Test
 * Tests the main search functionality across multiple sources
 */

const SearchService = require('../src/searchService');

class SearchServiceIntegrationTest {
    constructor() {
        this.logger = {
            info: (msg) => console.log(`[INFO] ${msg}`),
            warn: (msg) => console.log(`[WARN] ${msg}`),
            debug: (msg) => console.log(`[DEBUG] ${msg}`),
            error: (msg) => console.log(`[ERROR] ${msg}`)
        };
        
        this.searchService = new SearchService({
            logger: this.logger,
            cacheTtl: 300, // 5 minutes
            maxResults: 10
        });
    }

    async testSearchFunctionality() {
        console.log('[INFO] === SearchService Integration Test ===');
        console.log('[INFO] Testing multi-source search functionality');
        console.log('[INFO]');

        const testCases = [
            {
                name: 'JavaScript Search Test',
                query: 'JavaScript',
                maxResults: 15,
                sources: ['wikipedia', 'openlibrary', 'google', 'arxiv']
            },
            {
                name: 'Machine Learning Test', 
                query: 'machine learning',
                maxResults: 20,
                sources: ['wikipedia', 'openlibrary', 'google', 'arxiv']
            },
            {
                name: 'Single Source Test',
                query: 'Node.js',
                maxResults: 10,
                sources: ['wikipedia']
            }
        ];

        let successCount = 0;
        let totalTests = testCases.length;

        for (const testCase of testCases) {
            console.log(`\n=== ${testCase.name} ===`);
            try {
                const startTime = Date.now();
                const searchOptions = {
                    maxResults: testCase.maxResults,
                    sources: testCase.sources
                };

                const searchResult = await this.searchService.search(testCase.query, searchOptions);
                const duration = Date.now() - startTime;

                // Validate results
                if (this.validateSearchResults(searchResult, testCase)) {
                    console.log(`[INFO] ✅ ${testCase.name} PASSED`);
                    console.log(`[INFO]    Duration: ${duration}ms`);
                    console.log(`[INFO]    Results: ${searchResult.results.length} items`);
                    console.log(`[INFO]    Query: "${searchResult.query}"`);
                    successCount++;
                } else {
                    console.log(`[ERROR] ❌ ${testCase.name} FAILED - Results validation failed`);
                }

            } catch (error) {
                console.log(`[ERROR] ❌ ${testCase.name} FAILED - ${error.message}`);
            }
        }

        // Test Summary
        console.log('\n=== Test Summary ===');
        console.log(`[INFO] Tests passed: ${successCount}/${totalTests}`);
        console.log(`[INFO] Success rate: ${Math.round((successCount / totalTests) * 100)}%`);
        
        if (successCount === totalTests) {
            console.log('[INFO] 🎉 All integration tests passed!');
            return true;
        } else {
            console.log('[ERROR] 💥 Some tests failed!');
            return false;
        }
    }

    validateSearchResults(searchResult, testCase) {
        // Check result structure
        if (!searchResult || !searchResult.results || !Array.isArray(searchResult.results)) {
            console.log('[ERROR] Invalid result structure');
            return false;
        }

        // Check query matches
        if (searchResult.query !== testCase.query) {
            console.log('[ERROR] Query mismatch');
            return false;
        }

        // Check results count
        if (searchResult.results.length === 0) {
            console.log('[WARN] No results returned');
            return false;
        }

        // Check individual result structure
        for (const result of searchResult.results) {
            if (!result.title || !result.url) {
                console.log('[ERROR] Invalid result item structure');
                return false;
            }
        }

        return true;
    }

    async run() {
        try {
            const success = await this.testSearchFunctionality();
            process.exit(success ? 0 : 1);
        } catch (error) {
            console.log(`[ERROR] Test suite failed: ${error.message}`);
            process.exit(1);
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const test = new SearchServiceIntegrationTest();
    test.run();
}

module.exports = SearchServiceIntegrationTest;
