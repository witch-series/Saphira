/**
 * API Key Manager
 * 
 * Utility for loading API keys from user/api-keys.json file.
 * Environment variables or directly specified keys are given higher priority than keys from the configuration file.
 */

const fs = require('fs').promises;
const path = require('path');

// API key file path
const USER_DIR = path.join(__dirname, '..', '..', 'user');
const API_KEYS_FILE = path.join(USER_DIR, 'api-keys.json');

/**
 * API Key Manager Class
 */
class ApiKeyManager {
  /**
   * Initialization
   * @param {Object} options - Options
   * @param {Object} options.logger - Logger object
   */
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.keysLoaded = false;
    this.keys = {};
  }

  /**
   * Load API keys from user folder
   * @returns {Promise<Object>} - Loaded API keys
   */
  async loadApiKeys() {
    try {
      // Check if file exists
      try {
        await fs.access(API_KEYS_FILE);
      } catch (error) {
        // Create file if it doesn't exist
        await this._createDefaultApiKeysFile();
      }

      // Load file
      const data = await fs.readFile(API_KEYS_FILE, 'utf8');
      this.keys = JSON.parse(data);
      this.keysLoaded = true;
      
      this.logger.debug('API keys loaded from user/api-keys.json');
      return this.keys;
    } catch (error) {
      this.logger.warn(`Failed to load API keys: ${error.message}`);
      this.keys = {};
      return {};
    }
  }

  /**
   * Get API key
   * Priority: 1. Directly specified key  2. Environment variable  3. Key loaded from file
   * @param {string} keyName - Key name (e.g. 'newsApiKey')
   * @param {string} envVarName - Environment variable name (e.g. 'NEWS_API_KEY')
   * @param {string} directKey - Directly specified key
   * @returns {Promise<string>} - API key
   */
  async getApiKey(keyName, envVarName, directKey = '') {
    // Return directly specified key if provided
    if (directKey) {
      return directKey;
    }

    // Return environment variable if provided
    if (process.env[envVarName]) {
      return process.env[envVarName];
    }

    // Load keys from file if not loaded yet
    if (!this.keysLoaded) {
      await this.loadApiKeys();
    }

    // Return key from file
    return this.keys[keyName] || '';
  }

  /**
   * Create default API key file
   * @private
   */
  async _createDefaultApiKeysFile() {
    try {
      await fs.mkdir(USER_DIR, { recursive: true });
      
      const defaultKeys = {
        newsApiKey: "",
        githubApiKey: "",
        otherApiKeys: {
          "_comment": "Section for storing keys for future APIs"
        }
      };
      
      await fs.writeFile(API_KEYS_FILE, JSON.stringify(defaultKeys, null, 2));
      this.logger.info(`Created default API key file: ${API_KEYS_FILE}`);
    } catch (error) {
      this.logger.error(`Failed to create API key file: ${error.message}`);
    }
  }

  /**
   * Save API key
   * @param {string} keyName - Key name
   * @param {string} value - Key value
   * @returns {Promise<boolean>} - Whether the save was successful
   */
  async saveApiKey(keyName, value) {
    try {
      // Load current keys
      if (!this.keysLoaded) {
        await this.loadApiKeys();
      }
      
      // Update key
      this.keys[keyName] = value;
      
      // Save to file
      await fs.writeFile(API_KEYS_FILE, JSON.stringify(this.keys, null, 2));
      
      this.logger.debug(`Saved API key ${keyName}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to save API key: ${error.message}`);
      return false;
    }
  }
}

// Export singleton instance
module.exports = new ApiKeyManager();