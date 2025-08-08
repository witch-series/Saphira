/**
 * Search Module Index
 * 
 * Exports all search-related components for easy importing.
 */

const SearchEngineManager = require('./SearchEngineManager');
const BaseSearchEngine = require('./engines/BaseSearchEngine');
const WikipediaSearchEngine = require('./engines/WikipediaSearchEngine');
const OpenLibrarySearchEngine = require('./engines/OpenLibrarySearchEngine');
const GoogleSearchEngine = require('./engines/GoogleSearchEngine');
const ArxivSearchEngine = require('./engines/ArxivSearchEngine');
const GitHubSearchEngine = require('./engines/GitHubSearchEngine');
const MDNSearchEngine = require('./engines/MDNSearchEngine');
const StackOverflowSearchEngine = require('./engines/StackOverflowSearchEngine');
const MockSearchEngine = require('./engines/MockSearchEngine');

module.exports = {
  SearchEngineManager,
  BaseSearchEngine,
  engines: {
    WikipediaSearchEngine,
    OpenLibrarySearchEngine,
    GoogleSearchEngine,
    ArxivSearchEngine,
    GitHubSearchEngine,
    MDNSearchEngine,
    StackOverflowSearchEngine,
    MockSearchEngine
  }
};
