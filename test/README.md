# Test Directory (test/)

This directory contains core functionality tests for Saphira.

## 📁 File Structure

```
test/
├── search-service-integration.js  # SearchService integration tests
├── arxiv-search-adapter-test.js   # arXiv search adapter tests
├── google-search-adapter-test.js  # Google search adapter tests
└── test-arxiv-api.js              # arXiv API connection test
```

## 🧪 Test Overview

### Integration Tests

#### search-service-integration.js
Comprehensive test suite for SearchService

**Test Items**:
- JavaScript search test (all sources)
- Machine Learning search test (all sources)
- Single source test (Wikipedia)
- Result structure validation
- Error handling

**Execution**:
```bash
node test/search-service-integration.js
```

**Expected Results**:
- Result integration from multiple sources
- Proper result count retrieval
- Result structure consistency

### Adapter Tests

#### arxiv-search-adapter-test.js
Dedicated tests for arXiv academic paper search

**Test Items**:
- API connection test
- XML response parsing
- Metadata extraction
- Error response handling

#### google-search-adapter-test.js  
Dedicated tests for Google search scraping

**Test Items**:
- HTML structure analysis
- Search result extraction
- Rate limit handling
- Timeout processing

### API Connection Test

#### test-arxiv-api.js
Basic connection verification for arXiv API

**Purpose**:
- API availability confirmation
- Response format verification
- Network connection diagnosis

## 🚀 Test Execution Methods

### Overall Testing
```bash
# Execute integration tests
node test/search-service-integration.js

# Individual adapter tests
node test/arxiv-search-adapter-test.js
node test/google-search-adapter-test.js

# API connection verification
node test/test-arxiv-api.js
```

### CI/CD Support
```bash
# Execute all tests sequentially
npm test  # Defined in package.json
```

## ✅ Test Criteria

### Success Criteria
- ✅ **Result Retrieval**: Obtain appropriate number of results from each source
- ✅ **Structure Integrity**: Confirm presence of required fields (title, url)
- ✅ **Duplicate Removal**: Proper handling of same URL results
- ✅ **Error Recovery**: Single source failure doesn't stop entire process

### Failure Patterns
- ❌ **Network Error**: API connection failure
- ❌ **Parse Failure**: HTML/XML structure changes
- ❌ **Rate Limiting**: Search source access restrictions
- ❌ **Timeout**: Response delays

## 🔧 Test Environment Setup

### Required Dependencies
```json
{
  "dependencies": {
    "https": "Node.js standard",
    "../src/searchService": "Main search service",
    "../src/googleSearchAdapter": "Google search adapter",
    "../src/arxivSearchAdapter": "arXiv search adapter"
  }
}
```

### Log Level Configuration
```javascript
const logger = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  debug: (msg) => console.log(`[DEBUG] ${msg}`),
  warn: (msg) => console.log(`[WARN] ${msg}`),
  error: (msg) => console.log(`[ERROR] ${msg}`)
};
```

## 📊 Test Result Examples

```
[INFO] === SearchService Integration Test ===
[INFO] Testing multi-source search functionality

=== JavaScript Search Test ===
[INFO] ✅ JavaScript Search Test PASSED
[INFO]    Duration: 2341ms
[INFO]    Results: 15 items
[INFO]    Query: "JavaScript"

=== Test Summary ===
[INFO] Tests passed: 3/3
[INFO] Success rate: 100%
[INFO] 🎉 All integration tests passed!
```

## 🛠️ Test Maintenance

### Regular Maintenance Items
- Adaptation to HTML structure changes (Google search)
- Adaptation to API specification changes (arXiv)
- Rate limit value adjustments
- Timeout value optimization
