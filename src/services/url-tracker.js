/**
 * URL Tracker Service for Saphira
 * 
 * This service manages the tracking of processed URLs to prevent duplicate content collection.
 * It maintains a persistent list of URLs that have been previously searched/processed.
 */

const fs = require('fs').promises;
const path = require('path');

class URLTracker {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.urlListPath = options.urlListPath || path.join(__dirname, '../../user/url-list.json');
    this.urlSet = new Set();
    this.initialized = false;
  }

  /**
   * Initialize the URL tracker by loading existing URLs
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Ensure the user directory exists
      const userDir = path.dirname(this.urlListPath);
      await fs.mkdir(userDir, { recursive: true });

      // Load existing URLs if the file exists
      try {
        const data = await fs.readFile(this.urlListPath, 'utf8');
        const urlData = JSON.parse(data);
        
        if (urlData.urls && Array.isArray(urlData.urls)) {
          urlData.urls.forEach(url => this.urlSet.add(url));
          this.logger.info(`📚 Loaded ${this.urlSet.size} previously processed URLs`);
        }
      } catch (error) {
        // File doesn't exist or is empty, start with empty set
        this.logger.info('📚 Starting with empty URL tracking list');
      }

      this.initialized = true;
    } catch (error) {
      this.logger.error('❌ Failed to initialize URL tracker:', error);
      throw error;
    }
  }

  /**
   * Check if a URL has been previously processed
   * @param {string} url - URL to check
   * @returns {boolean} True if URL has been processed before
   */
  async hasBeenProcessed(url) {
    await this.initialize();
    return this.urlSet.has(url);
  }

  /**
   * Check if a URL has been previously processed (synchronous version)
   * Note: This assumes the tracker has already been initialized
   * @param {string} url - URL to check
   * @returns {boolean} True if URL has been processed before
   */
  hasBeenProcessedSync(url) {
    if (!this.initialized) {
      this.logger.warn('⚠️ URLTracker not initialized, treating URL as new:', url);
      return false;
    }
    return this.urlSet.has(url);
  }

  /**
   * Get all processed URLs (for access to urlSet size, etc)
   * @returns {Array<string>} Array of processed URLs
   */
  getProcessedUrls() {
    return Array.from(this.urlSet);
  }

  /**
   * Add a URL to the processed list
   * @param {string} url - URL to add
   */
  async addURL(url) {
    await this.initialize();
    this.urlSet.add(url);
  }

  /**
   * Add multiple URLs to the processed list
   * @param {Array<string>} urls - URLs to add
   */
  async addURLs(urls) {
    await this.initialize();
    urls.forEach(url => this.urlSet.add(url));
  }

  /**
   * Get all processed URLs
   * @returns {Array<string>} List of all processed URLs
   */
  async getAllURLs() {
    await this.initialize();
    return Array.from(this.urlSet);
  }

  /**
   * Get count of processed URLs
   * @returns {number} Number of processed URLs
   */
  async getURLCount() {
    await this.initialize();
    return this.urlSet.size;
  }

  /**
   * Filter out already processed URLs from a list
   * @param {Array<string>} urls - URLs to filter
   * @returns {Array<string>} Only new URLs that haven't been processed
   */
  async filterNewURLs(urls) {
    await this.initialize();
    return urls.filter(url => !this.urlSet.has(url));
  }

  /**
   * Save the URL list to disk
   */
  async save() {
    await this.initialize();
    
    try {
      const urlData = {
        lastUpdated: new Date().toISOString(),
        totalUrls: this.urlSet.size,
        urls: Array.from(this.urlSet).sort()
      };

      await fs.writeFile(this.urlListPath, JSON.stringify(urlData, null, 2), 'utf8');
      this.logger.info(`💾 Saved ${this.urlSet.size} URLs to tracking list`);
    } catch (error) {
      this.logger.error('❌ Failed to save URL list:', error);
      throw error;
    }
  }

  /**
   * Clear all tracked URLs (use with caution)
   */
  async clear() {
    await this.initialize();
    this.urlSet.clear();
    await this.save();
    this.logger.info('🗑️ Cleared all tracked URLs');
  }

  /**
   * Get statistics about tracked URLs
   * @returns {Object} Statistics object
   */
  async getStats() {
    await this.initialize();
    
    const urls = Array.from(this.urlSet);
    const domainCounts = {};
    
    urls.forEach(url => {
      try {
        const domain = new URL(url).hostname;
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      } catch (error) {
        // Invalid URL, skip
      }
    });

    return {
      totalUrls: urls.length,
      uniqueDomains: Object.keys(domainCounts).length,
      topDomains: Object.entries(domainCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([domain, count]) => ({ domain, count }))
    };
  }

  /**
   * Remove URLs from tracking
   * @param {Array<string>} urlsToRemove - URLs to remove from tracking
   */
  async removeURLs(urlsToRemove) {
    if (!urlsToRemove || !Array.isArray(urlsToRemove) || urlsToRemove.length === 0) {
      this.logger.info('📋 No URLs provided for removal');
      return 0;
    }

    this.logger.info(`🔄 URLTracker: Starting removal process for ${urlsToRemove.length} URLs`);
    await this.initialize();

    const initialSize = this.urlSet.size;
    this.logger.info(`🔄 URLTracker: Current tracking list has ${initialSize} URLs`);

    let removedCount = 0;
    urlsToRemove.forEach(url => {
      if (this.urlSet.has(url)) {
        this.urlSet.delete(url);
        removedCount++;
      }
    });

    this.logger.info(`🔄 URLTracker: Found ${removedCount}/${urlsToRemove.length} URLs in tracking list to remove`);

    if (removedCount > 0) {
      // Save updated list
      try {
        await this.save();
        this.logger.info(`✅ URLTracker: Successfully removed ${removedCount} URLs and saved tracking list (${this.urlSet.size} remaining)`);
      } catch (saveError) {
        this.logger.error('❌ URLTracker: Failed to save updated tracking list:', saveError);
        throw saveError;
      }
    } else {
      this.logger.info('📋 URLTracker: No URLs were found in tracking list to remove');
    }

    return removedCount;
  }
}

module.exports = URLTracker;
