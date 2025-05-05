/**
 * Search Routes for Saphira GUI Viewer
 * Handles DuckDuckGo search functionality and knowledge book integration
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const SearchService = require('../../src/core/searchService');

// Initialize search service
const searchService = new SearchService();

// Function to define search-related routes
module.exports = function(options) {
  const { logger, KNOWLEDGE_BOOKS_FILE, DATA_DIR, loadKnowledgeBooks } = options;
  
  // Search results cache
  const searchCache = {
    results: [],
    query: '',
    timestamp: null,
    summary: '',
    savedIds: {}
  };

  // Helper function to save to dated knowledge book files
  async function saveToKnowledgeBooks(newItems) {
    try {
      // Load existing knowledge books
      let knowledgeBooks = await loadKnowledgeBooks();
      
      // Create a dated file name for this update
      const now = new Date();
      const dateFormat = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(now).replace(/\//g, '-').replace(/:/g, '-').replace(/\s/g, '_');
      
      // Create the dated file path
      const datedBooksFile = path.join(DATA_DIR, `knowledge-books-${dateFormat}.json`);
      
      // Save to the dated file
      await fs.writeFile(datedBooksFile, JSON.stringify(newItems, null, 2), 'utf8');
      
      // Add collection date to each item
      for (const item of newItems) {
        item.collectionDate = dateFormat;
      }
      
      // Add new items to knowledge books
      knowledgeBooks = [...newItems, ...knowledgeBooks];
      
      // For compatibility, also update the main file
      await fs.writeFile(KNOWLEDGE_BOOKS_FILE, JSON.stringify(knowledgeBooks, null, 2), 'utf8');
      
      logger.info(`Added ${newItems.length} items to knowledge books at ${datedBooksFile}`);
      return true;
    } catch (error) {
      logger.error('Error saving to knowledge books:', error);
      return false;
    }
  }
  
  /**
   * DuckDuckGo Search route
   * This route handles web search using DuckDuckGo
   */
  router.get('/', async (req, res) => {
    const { q, maxResults, saveToKnowledge, message } = req.query;
    const limit = parseInt(maxResults) || 5;
    
    try {
      if (!q) {
        // Show search form if no query
        return res.render('search', {
          title: 'Web Search',
          query: '',
          results: [],
          isLoading: false,
          error: null,
          summary: null,
          maxResults: limit,
          saveToKnowledge: saveToKnowledge === 'on',
          message: message || null
        });
      }
      
      logger.info(`Performing search for: ${q}`);
      
      // Configure search service with max results
      searchService.setMaxResults('duckduckgo', limit);
      
      try {
        // Perform search using the service
        const searchResults = await searchService.search('duckduckgo', q, { maxResults: limit });
        
        // Get the results from the search results object
        const results = searchResults.results;
        const summary = searchResults.summary;
        
        // Save to cache for detail view
        searchCache.results = results;
        searchCache.query = q;
        searchCache.timestamp = searchResults.timestamp;
        searchCache.summary = summary;
        
        // Save to knowledge books if requested
        if (saveToKnowledge === 'on' && results.length > 0) {
          // Add each search result to knowledge books with unique IDs
          const savedIds = {};
          const newItems = [];
          
          for (const result of results) {
            const newId = uuidv4();
            savedIds[results.indexOf(result)] = newId;
            
            newItems.push({
              id: newId,
              title: result.title,
              summary: result.summary,
              content: result.content,
              tags: ['search', 'duckduckgo', ...q.split(' ').filter(t => t.trim().length > 0)],
              date: new Date().toISOString(),
              source: 'DuckDuckGo',
              sourceUrl: result.sourceUrl
            });
          }
          
          // Save to knowledge books using helper function
          await saveToKnowledgeBooks(newItems);
          
          // Add saved IDs to searchCache
          searchCache.savedIds = savedIds;
        }
        
        // Render search results
        res.render('search', {
          title: `Search: ${q}`,
          query: q,
          results,
          isLoading: false,
          error: null,
          summary,
          maxResults: limit,
          saveToKnowledge: saveToKnowledge === 'on',
          message: message || null,
          fromCache: searchResults.fromCache
        });
        
      } catch (error) {
        logger.error('Error executing search', error);
        
        res.render('search', {
          title: 'Search Error',
          query: q,
          results: [],
          isLoading: false,
          error: `Search execution error: ${error.message}`,
          summary: null,
          maxResults: limit,
          saveToKnowledge: saveToKnowledge === 'on',
          message: null
        });
      }
    } catch (error) {
      logger.error('Error in search route', error);
      
      res.render('search', {
        title: 'Search Error',
        query: q || '',
        results: [],
        isLoading: false,
        error: `Error performing search: ${error.message}`,
        summary: null,
        maxResults: limit,
        saveToKnowledge: saveToKnowledge === 'on',
        message: null
      });
    }
  });

  /**
   * DuckDuckGo Scrape route
   * This route handles web scraping using DuckDuckGo
   */
  router.get('/scrape', async (req, res) => {
    const { q, maxResults, saveToKnowledge, message } = req.query;
    const limit = parseInt(maxResults) || 5;
    
    try {
      if (!q) {
        // Show scrape form if no query
        return res.render('scrape', {
          title: 'Web Scraping',
          query: '',
          results: [],
          isLoading: false,
          error: null,
          maxResults: limit,
          saveToKnowledge: saveToKnowledge === 'on',
          message: message || null
        });
      }
      
      logger.info(`Performing scraping for: ${q}`);
      
      // Configure search service with max results
      searchService.setMaxResults('duckduckgo', limit);
      
      try {
        // Perform scraping using the service
        const searchResults = await searchService.scrapeTopResults(q, { maxResults: limit });
        
        // Get the results from the search results object
        const results = searchResults.results || [];
        
        // Save to cache for detail view
        searchCache.results = results;
        searchCache.query = q;
        searchCache.timestamp = searchResults.timestamp || new Date();
        
        // Save to knowledge books if requested
        if (saveToKnowledge === 'on' && results.length > 0) {
          // Add each search result to knowledge books with unique IDs
          const savedIds = {};
          const newItems = [];
          
          for (const result of results) {
            const newId = uuidv4();
            savedIds[results.indexOf(result)] = newId;
            
            newItems.push({
              id: newId,
              title: result.title || 'Untitled Result',
              source: result.url || 'Unknown Source',
              content: result.content || result.snippet || '',
              type: 'scraped_content',
              tags: ['scraped', 'duckduckgo', q.split(' ')].flat(),
              created: new Date().toISOString(),
              lastModified: new Date().toISOString()
            });
          }
          
          // Save to knowledge books using helper function
          await saveToKnowledgeBooks(newItems);
          searchCache.savedIds = savedIds;
          
          return res.redirect(`/search/scrape?q=${encodeURIComponent(q)}&maxResults=${limit}&message=Results saved to knowledge books`);
        }
        
        // Render search results
        return res.render('scrape', {
          title: 'Web Scraping Results',
          query: q,
          results: results,
          isLoading: false,
          error: null,
          maxResults: limit,
          saveToKnowledge: saveToKnowledge === 'on',
          message: message || null
        });
      } catch (error) {
        logger.error('Scrape error:', error);
        
        return res.render('scrape', {
          title: 'Web Scraping Error',
          query: q,
          results: [],
          isLoading: false,
          error: error.message || 'Unknown error occurred during scraping',
          maxResults: limit,
          saveToKnowledge: saveToKnowledge === 'on',
          message: null
        });
      }
    } catch (error) {
      logger.error('Route error:', error);
      
      return res.render('error', {
        title: 'Error',
        message: 'An unexpected error occurred',
        error: error
      });
    }
  });

  /**
   * Search detail route
   * This route shows detailed information about a search result
   */
  router.get('/detail/:index', async (req, res) => {
    const { index } = req.params;
    const idx = parseInt(index);
    
    try {
      if (!searchCache.results || !searchCache.results[idx]) {
        logger.warn(`Search result not found at index: ${idx}`);
        return res.redirect('/search');
      }
      
      const result = searchCache.results[idx];
      let savedId = null;
      let saved = false;
      
      // Check if this result was already saved
      if (searchCache.savedIds && searchCache.savedIds[idx]) {
        // If we have a record of this being saved during this session
        savedId = searchCache.savedIds[idx];
        saved = true;
      } else {
        // Check in knowledge books if the item exists with the same title and source URL
        try {
          const knowledgeBooks = await loadKnowledgeBooks();
          const existingItem = knowledgeBooks.find(book => 
            book.title === result.title && 
            book.sourceUrl === result.sourceUrl &&
            book.source === 'DuckDuckGo'
          );
          
          if (existingItem) {
            savedId = existingItem.id;
            saved = true;
            // Update cache for future reference
            if (!searchCache.savedIds) {
              searchCache.savedIds = {};
            }
            searchCache.savedIds[idx] = savedId;
          }
        } catch (error) {
          logger.error('Error checking if item is already saved', error);
        }
      }
      
      res.render('search-detail', {
        title: result.title,
        result,
        query: searchCache.query,
        index: idx,
        saved,
        savedId
      });
    } catch (error) {
      logger.error('Error loading search detail', error);
      res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to load search result detail',
        error
      });
    }
  });

  /**
   * Save search result route
   * This route saves a search result to knowledge books
   */
  router.post('/save', async (req, res) => {
    const { index } = req.body;
    const idx = parseInt(index);
    
    try {
      if (!searchCache.results || !searchCache.results[idx]) {
        logger.warn(`Search result not found at index: ${idx}`);
        return res.redirect('/search');
      }
      
      const result = searchCache.results[idx];
      
      // Generate a new ID
      const newId = uuidv4();
      
      // Create new item for knowledge books
      const searchTerms = searchCache.query.split(' ').filter(term => term.trim().length > 0);
      const newItem = {
        id: newId,
        title: result.title,
        summary: result.summary,
        content: result.content,
        tags: ['search', 'duckduckgo', ...searchTerms],
        date: new Date().toISOString(),
        source: 'DuckDuckGo',
        sourceUrl: result.sourceUrl
      };
      
      // Save to knowledge books using helper function
      await saveToKnowledgeBooks([newItem]);
      
      // Save ID
      if (!searchCache.savedIds) {
        searchCache.savedIds = {};
      }
      searchCache.savedIds[idx] = newId;
      
      logger.info(`Saved search result to knowledge books: ${result.title}`);
      
      // Render detail view with saved flag
      res.render('search-detail', {
        title: result.title,
        result,
        query: searchCache.query,
        index: idx,
        saved: true,
        savedId: newId
      });
    } catch (error) {
      logger.error('Error saving search result', error);
      res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to save search result',
        error
      });
    }
  });

  /**
   * Delete search result from Knowledge Books route
   */
  router.get('/delete/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
      // Load knowledge books
      let knowledgeBooks = await loadKnowledgeBooks();
      
      // Find the item by ID
      const itemIndex = knowledgeBooks.findIndex(book => book.id === id);
      
      if (itemIndex === -1) {
        logger.warn(`Item not found for deletion: ${id}`);
        return res.redirect('/search?message=Item not found');
      }
      
      // Store the title and collection date for the message
      const deletedTitle = knowledgeBooks[itemIndex].title;
      const collectionDate = knowledgeBooks[itemIndex].collectionDate;
      
      // Remove the item from the main array
      knowledgeBooks.splice(itemIndex, 1);
      
      // Find and update the dated file if collection date is available
      if (collectionDate) {
        try {
          const datedBooksFilename = `knowledge-books-${collectionDate}.json`;
          const datedBooksPath = path.join(DATA_DIR, datedBooksFilename);
          
          // Check if the dated file exists
          try {
            await fs.access(datedBooksPath);
            
            // Read and update the dated file
            const datedBooks = JSON.parse(await fs.readFile(datedBooksPath, 'utf8'));
            const datedBookIndex = datedBooks.findIndex(book => book.id === id);
            
            if (datedBookIndex !== -1) {
              datedBooks.splice(datedBookIndex, 1);
              await fs.writeFile(datedBooksPath, JSON.stringify(datedBooks, null, 2), 'utf8');
              logger.info(`Updated dated knowledge books file: ${datedBooksFilename}`);
            }
          } catch (accessError) {
            logger.warn(`Dated knowledge books file not found: ${datedBooksFilename}`);
          }
        } catch (dateError) {
          logger.warn(`Error updating dated file: ${dateError.message}`);
        }
      }
      
      // For compatibility, also update the main knowledge books file
      await fs.writeFile(
        KNOWLEDGE_BOOKS_FILE,
        JSON.stringify(knowledgeBooks, null, 2),
        'utf8'
      );
      
      logger.info(`Deleted item from Knowledge Books: ${deletedTitle} (${id})`);
      
      // Remove from searchCache.savedIds if it exists there
      for (const [idx, savedId] of Object.entries(searchCache.savedIds)) {
        if (savedId === id) {
          delete searchCache.savedIds[idx];
          break;
        }
      }
      
      // Redirect back to search page with success message
      res.redirect(`/search?message=Successfully deleted "${deletedTitle}"`);
    } catch (error) {
      logger.error('Error deleting item from Knowledge Books', error);
      res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to delete item',
        error
      });
    }
  });

  /**
   * GET /api/search
   * Search API endpoint
   */
  router.get('/api/search', async (req, res) => {
    try {
      const query = req.query.q;
      const engine = req.query.engine || 'duckduckgo';
      const maxResults = parseInt(req.query.max || 10);
      
      if (!query) {
        return res.status(400).json({
          error: 'Query parameter "q" is required'
        });
      }
      
      const results = await searchService.search(query, {
        engine: engine,
        maxResults: maxResults
      });
      
      res.json(results);
    } catch (error) {
      console.error('Search API error:', error);
      res.status(500).json({
        error: error.message || 'An error occurred during search'
      });
    }
  });

  /**
   * GET /api/scrape
   * Scrape content from top search results
   */
  router.get('/api/scrape', async (req, res) => {
    try {
      const query = req.query.q;
      const maxResults = parseInt(req.query.max || 10);
      const useCache = req.query.cache !== 'false';
      
      if (!query) {
        return res.status(400).json({
          error: 'Query parameter "q" is required'
        });
      }
      
      const results = await searchService.scrapeTopResults(query, {
        maxResults: maxResults,
        useCache: useCache
      });
      
      res.json(results);
    } catch (error) {
      console.error('Search scraping error:', error);
      res.status(500).json({
        error: error.message || 'An error occurred during content scraping'
      });
    }
  });

  /**
   * GET /search
   * Search page
   */
  router.get('/search', async (req, res) => {
    try {
      // Load knowledge books to check if we have data
      const knowledgeBooks = await loadKnowledgeBooks();
      const hasData = knowledgeBooks && knowledgeBooks.length > 0;
      
      // Calculate tag counts if we have data
      let popularTags = [];
      if (hasData) {
        const tagCounts = {};
        knowledgeBooks.forEach(book => {
          if (book.tags && Array.isArray(book.tags)) {
            book.tags.forEach(tag => {
              tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
          }
        });
        
        // Extract popular tags
        popularTags = Object.keys(tagCounts)
          .map(name => ({ name, count: tagCounts[name] }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);
      }
      
      res.render('search', {
        title: 'Search - Saphira',
        query: '',
        results: [],
        isLoading: false,
        error: null,
        summary: null,
        maxResults: 5,
        saveToKnowledge: false,
        message: req.query.message || null,
        hasData,
        popularTags,
        totalBooks: knowledgeBooks.length
      });
    } catch (error) {
      logger.error('Error loading search page', error);
      res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to load search page',
        error
      });
    }
  });

  /**
   * GET /search/scrape
   * Web scraping interface for DuckDuckGo search results
   */
  router.get('/search/scrape', async (req, res) => {
    const { q, maxResults, useCache, saveToKnowledge } = req.query;
    const limit = parseInt(maxResults) || 5;
    const useCacheOption = useCache !== 'false';
    
    try {
      if (!q) {
        // Show scrape form if no query
        return res.render('scrape', {
          title: 'Content Scraper',
          query: '',
          results: [],
          isLoading: false,
          error: null,
          summary: null,
          maxResults: limit,
          saveToKnowledge: saveToKnowledge === 'on'
        });
      }
      
      logger.info(`Performing content scraping for: ${q}`);
      
      // Render loading state first
      res.render('scrape', {
        title: `Scraping: ${q}`,
        query: q,
        results: [],
        isLoading: true,
        error: null,
        summary: null,
        maxResults: limit,
        saveToKnowledge: saveToKnowledge === 'on'
      });
      
      try {
        // Perform scraping using the service
        const scrapeResults = await searchService.scrapeTopResults(q, {
          maxResults: limit,
          useCache: useCacheOption
        });
        
        // Get the results from the scrape results object
        const results = scrapeResults.results;
        const summary = scrapeResults.summary;
        
        // Save to cache for detail view
        searchCache.results = results;
        searchCache.query = q;
        searchCache.timestamp = scrapeResults.timestamp;
        searchCache.summary = summary;
        
        // Save to knowledge books if requested
        if (saveToKnowledge === 'on' && results.length > 0) {
          // Add each search result to knowledge books with unique IDs
          const savedIds = {};
          const newItems = [];
          
          for (const result of results) {
            const newId = uuidv4();
            savedIds[results.indexOf(result)] = newId;
            
            newItems.push({
              id: newId,
              title: result.title,
              summary: result.summary,
              content: result.content,
              tags: ['scrape', 'duckduckgo', ...q.split(' ').filter(t => t.trim().length > 0)],
              date: new Date().toISOString(),
              source: 'DuckDuckGo Scrape',
              sourceUrl: result.sourceUrl
            });
          }
          
          // Save to knowledge books using helper function
          await saveToKnowledgeBooks(newItems);
          
          // Add saved IDs to searchCache
          searchCache.savedIds = savedIds;
        }
        
        // Mark saved items
        results.forEach((result, index) => {
          result.saved = searchCache.savedIds && searchCache.savedIds[index] ? true : false;
        });
        
        // Render scrape results
        return res.render('scrape', {
          title: `Scraped: ${q}`,
          query: q,
          results,
          isLoading: false,
          error: null,
          summary,
          maxResults: limit,
          saveToKnowledge: saveToKnowledge === 'on',
          fromCache: scrapeResults.fromCache
        });
        
      } catch (error) {
        logger.error('Error executing scraping', error);
        
        return res.render('scrape', {
          title: 'Scrape Error',
          query: q,
          results: [],
          isLoading: false,
          error: `Scraping execution error: ${error.message}`,
          summary: null,
          maxResults: limit,
          saveToKnowledge: saveToKnowledge === 'on'
        });
      }
    } catch (error) {
      logger.error('Error in scrape route', error);
      
      return res.render('scrape', {
        title: 'Scrape Error',
        query: q || '',
        results: [],
        isLoading: false,
        error: `Error performing scrape: ${error.message}`,
        summary: null,
        maxResults: limit,
        saveToKnowledge: saveToKnowledge === 'on'
      });
    }
  });
  
  /**
   * GET /search-detail
   * Search detail page
   */
  router.get('/search-detail/:index', async (req, res) => {
    try {
      const index = parseInt(req.params.index || 0);
      const adapterName = req.query.adapter || 'duckduckgo';
      const resultDetail = searchService.getResultDetail(adapterName, index);
      
      res.render('search-detail', {
        title: `${resultDetail.result.title} - Search Result`,
        resultDetail: resultDetail
      });
    } catch (error) {
      console.error('Search detail error:', error);
      res.status(404).render('error', {
        message: 'Search result not found',
        error: error
      });
    }
  });

  /**
   * GET /scrape
   * Scrape page - GUI for scraping content from search results
   */
  router.get('/scrape', (req, res) => {
    res.render('scrape', {
      title: 'Content Scraper - Saphira',
      query: req.query.q || ''
    });
  });

  return router;
};