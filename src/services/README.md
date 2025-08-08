# Services Directory (src/services/)

This directory contains the service layer responsible for Saphira's business logic.

## 📁 File Structure

```
services/
├── knowledge-book-manager.js  # Knowledge Book management service
└── url-tracker.js            # URL duplication tracking service
```

## 🛠️ Service Overview

### KnowledgeBookManager (knowledge-book-manager.js)
Service responsible for creating, managing, and persisting Knowledge Books

#### Core Features
- **Knowledge Book Creation**: Generate Knowledge Books from search results
- **File Management**: Persistence in user/data/ directory
- **Collection Management**: Provide Knowledge Book listings and metadata
- **Deletion Feature**: Safe deletion of Knowledge Books

#### Usage Example
```javascript
const KnowledgeBookManager = require('./services/knowledge-book-manager');

const manager = new KnowledgeBookManager({ 
  logger: console, 
  urlTracker: urlTracker 
});

// Create Knowledge Book
const knowledgeBook = await manager.createKnowledgeBook(
  'JavaScript Introduction',
  searchResults,
  ['wikipedia', 'google'],
  { searchDuration: '1500ms' }
);

// Get collection
const collection = await manager.getKnowledgeBookCollection();
```

#### Data Format
```javascript
{
  title: "Knowledge Book Title",
  searchQuery: "Original search query",
  sources: ["wikipedia", "google", "arxiv"],
  createdAt: "2025-08-07T09:30:00.000Z",
  totalResults: 15,
  results: [{ title, url, description, source }],
  metadata: { searchDuration: "1500ms" }
}
```

### URLTracker (url-tracker.js)
Service responsible for tracking processed URLs to prevent duplication

#### Core Features
- **URL History Management**: Persistence in user/url-list.json
- **Duplication Check**: Validation of new URLs
- **Statistics**: Stats like number of processed URLs
- **New URL Extraction**: Extract unprocessed URLs from search results

#### Usage Example
```javascript
const URLTracker = require('./services/url-tracker');

const tracker = new URLTracker({ logger: console });
await tracker.initialize();

// Check duplication
const isNew = !tracker.hasBeenProcessed('https://example.com');

// Add new URLs
await tracker.addURLs(['https://example.com', 'https://test.com']);

// Get statistics
const stats = await tracker.getStats();
```

#### Data Format
```javascript
{
  lastUpdated: "2025-08-07T09:30:59.460Z",
  totalUrls: 15,
  urls: [
    "https://arxiv.org/abs/2004.04023v1",
    "https://en.wikipedia.org/wiki/JavaScript",
    // ...
  ]
}
```

## 🔧 Design Principles

### 1. Single Responsibility Principle
Each service has a clearly defined single responsibility

### 2. Dependency Injection
Constructor receives logger and other dependent services

### 3. Asynchronous Processing
All I/O operations are Promise/async-await based

### 4. Error Handling
Proper error messages and recoverable design

## 📊 Performance Considerations

### KnowledgeBookManager
- Efficient JSON file read/write operations
- Support for large number of Knowledge Books (optimized directory scanning)
- High-speed processing through metadata caching

### URLTracker
- O(1) duplication checking using Set type
- Efficiency through batch URL addition
- Memory usage optimization

## 🚀 Integration Usage Example

```javascript
// Service initialization
const urlTracker = new URLTracker({ logger });
await urlTracker.initialize();

const knowledgeBookManager = new KnowledgeBookManager({ 
  logger, 
  urlTracker 
});

// Execute workflow
const searchResults = await searchService.search('Node.js');
const knowledgeBook = await knowledgeBookManager.createKnowledgeBook(
  'Node.js Learning Resources',
  searchResults,
  ['wikipedia', 'google']
);

console.log(`Created: ${knowledgeBook.filename}`);
```
