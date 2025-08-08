# Saphira Source Code (src/)

This directory contains the core search functionality and services for Saphira.

## 📁 Directory Structure

```
src/
├── searchService.js           # Main search service
├── googleSearchAdapter.js     # Google search adapter
├── arxivSearchAdapter.js      # arXiv academic paper search adapter
├── routes/                   # Express.js route definitions
│   └── collection-routes.js  # Knowledge Book management routes
└── services/                # Business logic services
    ├── knowledge-book-manager.js  # Knowledge Book management
    └── url-tracker.js            # URL duplication tracking
```

## 🔍 Core Features

### SearchService (searchService.js)
- **Role**: Multi-source integrated search engine
- **Features**:
  - Wikipedia search (encyclopedia content)
  - OpenLibrary search (books and publications)
  - Google search (web content)
  - arXiv search (academic papers)
  - Result deduplication and caching functionality
- **Usage Example**:
  ```javascript
  const searchService = new SearchService({ logger });
  const results = await searchService.search('JavaScript', {
    maxResults: 15,
    sources: ['wikipedia', 'google', 'arxiv']
  });
  ```

### Search Adapters
Dedicated adapters for each search source:

#### GoogleSearchAdapter (googleSearchAdapter.js)
- Google search result web scraping
- HTML parsing functionality
- Rate limiting support

#### ArxivSearchAdapter (arxivSearchAdapter.js) 
- arXiv API integration
- Academic paper metadata retrieval
- XML/JSON format support

## 🛠️ Services

### KnowledgeBookManager (services/knowledge-book-manager.js)
- **Role**: Knowledge Book creation, management, and persistence
- **Features**:
  - Generate Knowledge Books from search results
  - File-based storage (JSON format)
  - Collection display metadata management
  - Knowledge Book deletion functionality

### URLTracker (services/url-tracker.js)
- **Role**: Processed URL tracking for duplicate prevention
- **Features**:
  - URL history management (user/url-list.json)
  - New URL detection
  - Statistical information provision

## 🌐 Routes

### collection-routes.js
Express routes for Knowledge Book workflow:
- `POST /search` - Execute multi-source search & create Knowledge Book
- `GET /knowledge-books` - Display Knowledge Book collection
- `GET /knowledge-book/:filename` - Display individual Knowledge Book
- `DELETE /knowledge-book/:filename` - Delete Knowledge Book

## 🔧 Design Principles

### 1. Module Separation
Each search source is implemented as an independent adapter, with SearchService managing integration

### 2. Error Handling
Failure of each source does not affect other sources, prioritizing availability

### 3. Caching Strategy
Search results are cached with configurable TTL to improve performance

### 4. Flexible Configuration
Search options like maxResults, sources, cacheTtl can be dynamically adjusted

## 🚀 Usage

### Basic Search
```javascript
const SearchService = require('./src/searchService');

const service = new SearchService({
  logger: console,
  maxResults: 20,
  cacheTtl: 300
});

const results = await service.search('Node.js', {
  maxResults: 15,
  sources: ['wikipedia', 'openlibrary', 'google', 'arxiv']
});
```

### Knowledge Book Creation
```javascript
const KnowledgeBookManager = require('./src/services/knowledge-book-manager');

const manager = new KnowledgeBookManager({ logger, urlTracker });
const knowledgeBook = await manager.createKnowledgeBook(
  'JavaScript Fundamentals',
  searchResults,
  ['wikipedia', 'google']
);
```

## ⚡ Performance Considerations

- Number of results from each source is dynamically adjusted (`Math.ceil(maxResults / sources.length)`)
- HTTP connection timeout settings (5 seconds)
- Response speed improvement through result caching
- Efficiency through asynchronous parallel processing

## 📊 Log Output

Minimal log output to prioritize terminal readability:
- Search start log (query, expected result count)
- Search completion log (actual result count, source list)
- Detailed log output only on errors
