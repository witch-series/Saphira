/**
 * Configuration Manager for Saphira
 * Provides utilities for managing user configuration including API keys and user interests
 */
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

class ConfigManager {
  /**
   * Constructor for ConfigManager
   * 
   * @param {Object} options - Configuration options
   * @param {string} options.userDir - Base directory for user data
   * @param {Object} options.logger - Logger instance
   */
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.userDir = options.userDir || path.join(process.cwd(), 'user');
    this.dataDir = options.dataDir || path.join(this.userDir, 'data');
    
    // File paths
    this.apiKeysFile = path.join(this.userDir, 'api-keys.json');
    this.userInterestsFile = path.join(this.dataDir, 'user-interests.json');
  }
  
  /**
   * Ensure required directories exist
   * @returns {Promise<void>}
   */
  async ensureDirectories() {
    try {
      await fs.mkdir(this.userDir, { recursive: true });
      await fs.mkdir(this.dataDir, { recursive: true });
      this.logger.info('User directories checked/created');
    } catch (error) {
      this.logger.error('Failed to create user directories', error);
      throw error;
    }
  }
  
  /**
   * Load API keys from file
   * @returns {Promise<Object>} API keys
   */
  async loadApiKeys() {
    try {
      await this.ensureDirectories();
      
      try {
        await fs.access(this.apiKeysFile);
        const data = await fs.readFile(this.apiKeysFile, 'utf8');
        return JSON.parse(data);
      } catch (error) {
        this.logger.warn('API keys file not found or invalid, creating default');
        const defaultKeys = {
          newsApiKey: "",
          githubApiKey: "",
          otherApiKeys: {
            "_comment": "Section for future API keys"
          }
        };
        
        try {
          await fs.writeFile(this.apiKeysFile, JSON.stringify(defaultKeys, null, 2), 'utf8');
        } catch (writeError) {
          this.logger.error('Failed to create default API keys file', writeError);
        }
        
        return defaultKeys;
      }
    } catch (error) {
      this.logger.error('Error loading API keys', error);
      throw error;
    }
  }
  
  /**
   * Save API keys to file
   * @param {Object} keys - API keys to save
   * @returns {Promise<boolean>} Success indicator
   */
  async saveApiKeys(keys) {
    try {
      await this.ensureDirectories();
      await fs.writeFile(this.apiKeysFile, JSON.stringify(keys, null, 2), 'utf8');
      this.logger.info('API keys saved successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to save API keys', error);
      return false;
    }
  }
  
  /**
   * Update specific API key value
   * @param {string} keyName - Key name to update
   * @param {string} value - New key value
   * @returns {Promise<boolean>} Success indicator
   */
  async updateApiKey(keyName, value) {
    try {
      const keys = await this.loadApiKeys();
      
      if (keyName.includes('.')) {
        // Handle nested keys (e.g., otherApiKeys.something)
        const [parent, child] = keyName.split('.');
        if (!keys[parent]) keys[parent] = {};
        keys[parent][child] = value;
      } else {
        keys[keyName] = value;
      }
      
      return await this.saveApiKeys(keys);
    } catch (error) {
      this.logger.error(`Error updating API key: ${keyName}`, error);
      return false;
    }
  }
  
  /**
   * Load user interests from file
   * @returns {Promise<Array>} User interests
   */
  async loadUserInterests() {
    try {
      await this.ensureDirectories();
      
      try {
        await fs.access(this.userInterestsFile);
        const data = await fs.readFile(this.userInterestsFile, 'utf8');
        return JSON.parse(data);
      } catch (error) {
        this.logger.warn('User interests file not found or invalid, creating default');
        const defaultInterests = [];
        
        try {
          await fs.writeFile(this.userInterestsFile, JSON.stringify(defaultInterests, null, 2), 'utf8');
        } catch (writeError) {
          this.logger.error('Failed to create default user interests file', writeError);
        }
        
        return defaultInterests;
      }
    } catch (error) {
      this.logger.error('Error loading user interests', error);
      return [];
    }
  }
  
  /**
   * Save user interests to file
   * @param {Array} interests - Interests to save
   * @returns {Promise<boolean>} Success indicator
   */
  async saveUserInterests(interests) {
    try {
      await this.ensureDirectories();
      await fs.writeFile(this.userInterestsFile, JSON.stringify(interests, null, 2), 'utf8');
      this.logger.info('User interests saved successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to save user interests', error);
      return false;
    }
  }
  
  /**
   * Add a new user interest
   * @param {Object} interest - Interest data
   * @returns {Promise<Object>} Added interest with ID
   */
  async addUserInterest(interest) {
    // Validate required fields
    if (!interest.name) {
      throw new Error('Interest name is required');
    }
    
    try {
      const interests = await this.loadUserInterests();
      
      // Create new interest with ID and timestamps
      const newInterest = {
        id: interest.id || uuidv4(),
        name: interest.name,
        description: interest.description || '',
        tags: interest.tags || [],
        score: interest.score || 5,
        createdAt: interest.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Add to interests array
      interests.push(newInterest);
      
      // Save updated interests
      await this.saveUserInterests(interests);
      
      return newInterest;
    } catch (error) {
      this.logger.error('Failed to add user interest', error);
      throw error;
    }
  }
  
  /**
   * Update an existing user interest
   * @param {string} id - Interest ID
   * @param {Object} updates - Updated interest data
   * @returns {Promise<Object>} Updated interest
   */
  async updateUserInterest(id, updates) {
    try {
      const interests = await this.loadUserInterests();
      const index = interests.findIndex(interest => interest.id === id);
      
      if (index === -1) {
        throw new Error(`Interest with ID ${id} not found`);
      }
      
      const updatedInterest = {
        ...interests[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      interests[index] = updatedInterest;
      await this.saveUserInterests(interests);
      
      return updatedInterest;
    } catch (error) {
      this.logger.error(`Failed to update user interest: ${id}`, error);
      throw error;
    }
  }
  
  /**
   * Delete a user interest
   * @param {string} id - Interest ID
   * @returns {Promise<boolean>} Success indicator
   */
  async deleteUserInterest(id) {
    try {
      const interests = await this.loadUserInterests();
      const index = interests.findIndex(interest => interest.id === id);
      
      if (index === -1) {
        throw new Error(`Interest with ID ${id} not found`);
      }
      
      interests.splice(index, 1);
      await this.saveUserInterests(interests);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete user interest: ${id}`, error);
      return false;
    }
  }
}

module.exports = ConfigManager;