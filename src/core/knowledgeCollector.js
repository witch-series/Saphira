/**
 * KnowledgeCollector is responsible for collecting information based on user interests
 * and transforming it into KnowledgeBook objects
 */
const KnowledgeBook = require('../models/knowledgeBook');

class KnowledgeCollector {
  constructor(options = {}) {
    this.adapters = options.adapters || [];
    this.processors = options.processors || [];
    this.storageManager = options.storageManager;
    this.collectionSchedule = options.schedule || '0 */12 * * *'; // Twice daily by default
    this.isCollecting = false;
    this.collectionQueue = [];
    this.logger = options.logger || console;
  }
  
  /**
   * Register a source adapter
   * @param {Object} adapter - Source adapter implementation
   */
  registerAdapter(adapter) {
    if (!adapter) {
      throw new Error('Invalid adapter: adapter must not be null');
    }
    
    // Accept adapters with either fetchContent or collectData methods
    if (typeof adapter.fetchContent !== 'function' && typeof adapter.collectData !== 'function') {
      throw new Error('Invalid adapter: must implement either fetchContent or collectData method');
    }
    
    this.adapters.push(adapter);
    this.logger.info(`Registered adapter: ${adapter.name}`);
    return this;
  }
  
  /**
   * Register a content processor
   * @param {Object} processor - Content processor implementation
   */
  registerProcessor(processor) {
    if (!processor || typeof processor.process !== 'function') {
      throw new Error('Invalid processor: must implement process method');
    }
    this.processors.push(processor);
    this.logger.info(`Registered processor: ${processor.constructor.name}`);
    return this;
  }
  
  /**
   * Collect information based on user interests
   * @param {Array} interests - Array of user interest objects
   * @returns {Promise<Array>} - Array of created KnowledgeBook objects
   */
  async collectByInterests(interests) {
    if (this.isCollecting) {
      this.logger.warn('Collection already in progress, queuing request');
      return new Promise((resolve) => {
        this.collectionQueue.push(() => {
          this.collectByInterests(interests).then(resolve);
        });
      });
    }
    
    this.isCollecting = true;
    const books = [];
    
    try {
      this.logger.info(`Starting collection for ${interests.length} interests`);
      
      // Filter to only enabled interests
      const activeInterests = interests.filter(interest => interest.enabled);
      
      // Sort interests by weight (priority)
      activeInterests.sort((a, b) => b.weight - a.weight);
      
      for (const interest of activeInterests) {
        // Skip if collection is not due
        if (!interest.isCollectionDue()) {
          this.logger.debug(`Skipping collection for interest ${interest.id}, not due yet`);
          continue;
        }
        
        const interestTags = interest.tags;
        this.logger.info(`Collecting for interest: ${interestTags.join(', ')}`);
        
        // Gather content from all adapters
        for (const adapter of this.adapters) {
          try {
            this.logger.debug(`Using adapter: ${adapter.name}`);
            
            // Support both adapter interfaces: fetchContent (old) and collectData (new)
            let rawContentItems;
            
            if (typeof adapter.collectData === 'function') {
              // New adapter interface
              rawContentItems = await adapter.collectData(interestTags);
            } else {
              // Original adapter interface
              rawContentItems = await adapter.fetchContent(interestTags);
            }
            
            // Process each content item
            for (const rawContent of rawContentItems) {
              let processedContent = { ...rawContent };
              
              // Run through processing pipeline
              for (const processor of this.processors) {
                processedContent = await processor.process(processedContent, interestTags);
              }
              
              // Create KnowledgeBook
              const book = new KnowledgeBook({
                title: processedContent.title || 'Untitled',
                author: processedContent.author,
                sourceUrl: processedContent.sourceUrl || processedContent.url,
                sourceName: adapter.name,
                summary: processedContent.summary,
                content: processedContent.content,
                tags: processedContent.tags,
                category: processedContent.category
              });
              
              books.push(book);
              
              // Save to storage if available
              if (this.storageManager) {
                await this.storageManager.saveBook(book);
              }
            }
          } catch (error) {
            this.logger.error(`Error collecting from ${adapter.name}:`, error);
          }
        }
        
        // Update last collection date
        interest.updateCollectionDate();
      }
      
      this.logger.info(`Collection completed, created ${books.length} knowledge books`);
      
    } catch (error) {
      this.logger.error('Error during collection process:', error);
    } finally {
      this.isCollecting = false;
      
      // Process queued collections
      if (this.collectionQueue.length > 0) {
        const nextCollection = this.collectionQueue.shift();
        nextCollection();
      }
    }
    
    return books;
  }
  
  /**
   * Start scheduled collection based on user profiles
   * @param {Function} getUserInterests - Function that returns array of current user interests
   */
  startScheduledCollection(getUserInterests) {
    // Implementation depends on the scheduling library
    // This is a placeholder for scheduled job logic
    this.logger.info('Scheduled collection started with frequency:', this.collectionSchedule);
    
    // Example implementation using setInterval
    const intervalMap = {
      'hourly': 3600000,      // 1 hour in ms
      'daily': 86400000,      // 24 hours in ms
      'weekly': 604800000,    // 7 days in ms
    };
    
    // Check collection state every hour
    setInterval(async () => {
      try {
        const interests = getUserInterests();
        
        // Filter to only interests that are due for collection
        const dueInterests = interests.filter(interest => interest.isCollectionDue());
        
        if (dueInterests.length > 0) {
          this.logger.info(`Found ${dueInterests.length} interests due for collection`);
          await this.collectByInterests(dueInterests);
        }
      } catch (error) {
        this.logger.error('Error in scheduled collection:', error);
      }
    }, intervalMap.hourly); // Check every hour
  }
  
  /**
   * Manually trigger collection for specific interests
   * @param {Array} interests - Array of user interest objects to collect for
   * @returns {Promise<Array>} - Array of created KnowledgeBook objects
   */
  async manualCollection(interests) {
    this.logger.info('Manual collection triggered');
    return this.collectByInterests(interests);
  }
  
  /**
   * Set allowed sources for all adapters that support it
   * @param {Array} sources - List of allowed domain names (e.g., ['wikipedia.org'])
   */
  setAllowedSources(sources) {
    for (const adapter of this.adapters) {
      if (adapter && typeof adapter.setAllowedSources === 'function') {
        adapter.setAllowedSources(sources);
      }
    }
  }
}

module.exports = KnowledgeCollector;