# Search Module (src/search/)

This directory contains the modular search engine architecture for Saphira.

## 📁 Directory Structure

```
search/
├── index.js                    # Main exports for the search module
├── SearchEngineManager.js      # Coordinates multiple search engines
└── engines/                    # Individual search engine implementations
    ├── BaseSearchEngine.js     # Abstract base class for all engines
    ├── WikipediaSearchEngine.js # Wikipedia article search
    ├── OpenLibrarySearchEngine.js # Book and publication search
    ├── GoogleSearchEngine.js   # Web search via Google
    ├── ArxivSearchEngine.js    # Academic paper search
    └── MockSearchEngine.js     # Fallback mock data provider
```

## 🏗️ Architecture

### SearchEngineManager
The main coordinator that:
- Manages multiple search engines
- Executes parallel searches across sources
- Handles URL deduplication and filtering
- Provides unified result formatting
- Manages fallback to mock data

### BaseSearchEngine
Abstract base class providing:
- Common interface for all search engines
- Standardized result formatting
- Error handling utilities
- Logging and timeout management
- Input validation

### Individual Search Engines
Each engine implements specific source logic:
- **WikipediaSearchEngine**: Encyclopedia content via Wikipedia API
- **OpenLibrarySearchEngine**: Books via OpenLibrary API
- **GoogleSearchEngine**: Web search via existing adapter
- **ArxivSearchEngine**: Academic papers via existing adapter
- **MockSearchEngine**: Fallback mock data when APIs fail

## 🚀 Usage

### Basic Usage
```javascript
const { SearchEngineManager } = require('./src/search');

const searchManager = new SearchEngineManager({
  logger: console,
  urlTracker: urlTrackerInstance,
  maxResults: 20
});

const results = await searchManager.searchAll('javascript', {
  sources: ['wikipedia', 'openlibrary', 'google'],
  maxResults: 50
});
```

### Single Engine Usage
```javascript
const { engines } = require('./src/search');

const wikipedia = new engines.WikipediaSearchEngine({
  logger: console,
  maxResults: 10
});

const results = await wikipedia.search('artificial intelligence');
```

### Custom Engine
```javascript
const { BaseSearchEngine } = require('./src/search');

class CustomSearchEngine extends BaseSearchEngine {
  async search(query, options = {}) {
    this.validateQuery(query);
    // Implement custom search logic
    return results.map(r => this.createResult(r.title, r.url, r.description));
  }
}
```

## 🔧 Configuration

### SearchEngineManager Options
- **logger**: Logging interface (default: console)
- **urlTracker**: URL tracking service for deduplication
- **maxResults**: Default maximum results per search (default: 20)
- **timeout**: Request timeout in milliseconds (default: 5000)

### Search Options
- **sources**: Array of engine names to use (default: all)
- **maxResults**: Maximum results to return
- **timeout**: Override default timeout

## 📊 Result Format

All engines return standardized result objects:
```javascript
{
  title: "Result Title",
  url: "https://example.com",
  snippet: "Description text",
  source: "Wikipedia",
  timestamp: "2025-08-07T10:00:00.000Z",
  // Engine-specific metadata
  metadata: {
    type: "article",
    category: "technology"
  }
}
```

## 🎯 Features

### URL Deduplication
- Integrates with URLTracker service
- Filters out previously processed URLs
- Focuses searches on new content discovery

### Parallel Processing
- Executes multiple engine searches simultaneously
- Improves overall search performance
- Handles individual engine failures gracefully

### Fallback Mechanism
- Uses mock data when all engines fail
- Ensures consistent user experience
- Provides debugging information

### Extensibility
- Easy to add new search engines
- Plugin-like architecture
- Custom engines inherit base functionality

## 🔍 Search Flow

1. **Query Validation**: Validate input query
2. **Engine Selection**: Choose engines based on sources parameter
3. **Parallel Execution**: Run searches simultaneously
4. **URL Filtering**: Remove already-processed URLs
5. **Result Aggregation**: Combine results from all engines
6. **Deduplication**: Remove duplicate results
7. **Fallback**: Add mock data if no results
8. **Final Processing**: Limit results and add metadata

## 🛠️ Development

### Adding New Engine
1. Extend BaseSearchEngine
2. Implement search() method
3. Add to SearchEngineManager.initializeEngines()
4. Update exports in index.js

### Testing
Each engine should handle:
- Network failures gracefully
- API rate limits and timeouts
- Invalid or empty responses
- Query validation

### Performance
- Set appropriate timeouts
- Use parallel processing
- Implement result caching where beneficial
- Monitor API rate limits
