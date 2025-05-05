# Source Adapters

This directory contains adapters for collecting information from different sources.

## Overview

Source adapters are responsible for interfacing with external data sources and extracting information based on user interests. Each adapter is specialized for a specific type of source and implements a common interface for data collection.

## Included Adapters

- **arxivAdapter.js**: Collects scientific papers and research from arXiv.org
- **duckDuckGoAdapter.js**: Searches the web using DuckDuckGo's privacy-focused search engine
- **githubAdapter.js**: Retrieves code repositories and documentation from GitHub
- **newsApiAdapter.js**: Gathers news articles and current events from various news sources
- **webAdapter.js**: Collects information from general web pages with content extraction
- **wikipediaAdapter.js**: Retrieves encyclopedia articles and reference information

## Common Interface

All adapters implement one of the following interfaces:

```javascript
// Modern interface
{
  name: string;                // Descriptive name of the source
  collectData(keywords): Promise<Array>; // Method to fetch content based on keywords
}

// Legacy interface (still supported)
{
  name: string;                // Descriptive name of the source
  fetchContent(interests): Promise<Array>; // Method to fetch content based on interests
}
```

## API Key Requirements

Some adapters require API keys for operation:
- NewsAPI: Requires API key for access to news sources
- GitHub: Requires API key for higher rate limits (optional)

API keys are managed through the `apiKeyManager.js` utility.

## Usage

Source adapters are registered with the `KnowledgeCollector` which orchestrates the collection process:

```javascript
const collector = new KnowledgeCollector();
collector.registerAdapter(new NewsApiAdapter({ apiKey: 'your-api-key' }));
collector.registerAdapter(new ArxivAdapter());
```

## Extending with New Adapters

To add support for a new information source:

1. Create a new file following the naming convention `[source]Adapter.js`
2. Implement the common adapter interface (preferably the modern `collectData` method)
3. Add appropriate error handling and rate limiting
4. Register the adapter with the knowledge collector

## Implementation Guidelines

- Respect rate limits and terms of service of the source APIs
- Implement proper error handling and fallback mechanisms
- Use consistent data format for returned content items
- Document any special requirements or limitations