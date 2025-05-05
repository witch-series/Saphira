/**
 * UserInterest represents a user's interests and preferences for information collection
 * These interests drive the automatic collection of knowledge
 */
class UserInterest {
  constructor(data = {}) {
    this.id = data.id || this._generateId();
    this.userId = data.userId || ''; // Reference to user profile
    this.tags = data.tags || []; // Interest tags like "AI", "Robotics", "Philosophy"
    this.weight = data.weight || 1; // Higher weight means higher priority in collection (1-10)
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.lastCollectionDate = data.lastCollectionDate || null; // Last time info was collected for this interest
    this.collectFrequency = data.collectFrequency || 'daily'; // How often to collect: 'hourly', 'daily', 'weekly'
    this.enabled = data.enabled !== undefined ? data.enabled : true; // Whether this interest is active
  }

  /**
   * Generate a unique identifier
   * @private
   */
  _generateId() {
    return 'ui_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  }

  /**
   * Add a new interest tag
   * @param {string} tag - Tag to add
   */
  addTag(tag) {
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
      this.updatedAt = new Date();
    }
  }

  /**
   * Remove an interest tag
   * @param {string} tag - Tag to remove
   */
  removeTag(tag) {
    const index = this.tags.indexOf(tag);
    if (index !== -1) {
      this.tags.splice(index, 1);
      this.updatedAt = new Date();
    }
  }

  /**
   * Set the weight/priority of this interest
   * @param {number} weight - Weight value (1-10)
   */
  setWeight(weight) {
    // Ensure weight is within valid range
    this.weight = Math.max(1, Math.min(10, weight));
    this.updatedAt = new Date();
  }

  /**
   * Set collection frequency
   * @param {string} frequency - One of: 'hourly', 'daily', 'weekly'
   */
  setCollectFrequency(frequency) {
    const validFrequencies = ['hourly', 'daily', 'weekly'];
    if (validFrequencies.includes(frequency)) {
      this.collectFrequency = frequency;
      this.updatedAt = new Date();
    } else {
      throw new Error(`Invalid collection frequency: ${frequency}. Must be one of: ${validFrequencies.join(', ')}`);
    }
  }

  /**
   * Update the last collection date to now
   */
  updateCollectionDate() {
    this.lastCollectionDate = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Enable or disable this interest
   * @param {boolean} enabled - Whether this interest is active
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    this.updatedAt = new Date();
  }

  /**
   * Check if it's time to collect information for this interest
   * @returns {boolean} - Whether collection is due
   */
  isCollectionDue() {
    // If disabled or never collected before, collection is due
    if (!this.enabled || !this.lastCollectionDate) {
      return this.enabled; // Return true only if enabled
    }

    const now = new Date();
    const elapsed = now - this.lastCollectionDate;
    
    // Convert elapsed time to hours
    const elapsedHours = elapsed / (1000 * 60 * 60);
    
    switch (this.collectFrequency) {
      case 'hourly': return elapsedHours >= 1;
      case 'daily': return elapsedHours >= 24;
      case 'weekly': return elapsedHours >= 168; // 7 days
      default: return false;
    }
  }

  /**
   * Create a JSON representation for storage/transmission
   * @returns {Object} - JSON representation of the interest
   */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      tags: [...this.tags],
      weight: this.weight,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      lastCollectionDate: this.lastCollectionDate ? this.lastCollectionDate.toISOString() : null,
      collectFrequency: this.collectFrequency,
      enabled: this.enabled
    };
  }

  /**
   * Create a UserInterest instance from JSON data
   * @param {Object} json - JSON data
   * @returns {UserInterest} - New instance
   */
  static fromJSON(json) {
    return new UserInterest({
      ...json,
      createdAt: new Date(json.createdAt),
      updatedAt: new Date(json.updatedAt),
      lastCollectionDate: json.lastCollectionDate ? new Date(json.lastCollectionDate) : null
    });
  }
}

module.exports = UserInterest;