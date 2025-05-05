/**
 * KnowledgeBook represents a single piece of collected information
 * that will be displayed as a book in the Auto Libra 3D environment
 */
class KnowledgeBook {
  constructor(data = {}) {
    this.id = data.id || this._generateId();
    this.title = data.title || 'Untitled';
    this.author = data.author || 'Unknown';
    this.sourceUrl = data.sourceUrl || '';
    this.sourceName = data.sourceName || '';
    this.summary = data.summary || '';
    this.content = data.content || '';
    this.tags = data.tags || [];
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.rating = data.rating || null; // User rating (if any)
    this.category = data.category || 'general';
    this.position = data.position || { x: 0, y: 0, z: 0 }; // 3D position in library
    this.metadata = data.metadata || {}; // Additional metadata
  }
  
  /**
   * Generate a unique identifier
   * @private
   */
  _generateId() {
    return 'kb_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  }
  
  /**
   * Add a tag to the knowledge book
   * @param {string} tag - Tag to add
   */
  addTag(tag) {
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
      this.updatedAt = new Date();
    }
  }
  
  /**
   * Remove a tag from the knowledge book
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
   * Update the summary of the book
   * @param {string} summary - New summary
   */
  updateSummary(summary) {
    this.summary = summary;
    this.updatedAt = new Date();
  }
  
  /**
   * Set user rating for this book
   * @param {number} rating - Rating value (typically 1-5)
   */
  setRating(rating) {
    this.rating = rating;
    this.updatedAt = new Date();
  }
  
  /**
   * Update 3D position in library
   * @param {Object} position - Position object with x, y, z coordinates
   */
  setPosition(position) {
    this.position = { ...position };
    this.updatedAt = new Date();
  }
  
  /**
   * Create a JSON representation for storage/transmission
   * @returns {Object} - JSON representation of the book
   */
  toJSON() {
    return {
      id: this.id,
      title: this.title,
      author: this.author,
      sourceUrl: this.sourceUrl,
      sourceName: this.sourceName,
      summary: this.summary,
      content: this.content,
      tags: [...this.tags],
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      rating: this.rating,
      category: this.category,
      position: { ...this.position },
      metadata: { ...this.metadata }
    };
  }
  
  /**
   * Create a KnowledgeBook instance from JSON data
   * @param {Object} json - JSON data
   * @returns {KnowledgeBook} - New instance
   */
  static fromJSON(json) {
    return new KnowledgeBook({
      ...json,
      createdAt: new Date(json.createdAt),
      updatedAt: new Date(json.updatedAt)
    });
  }
}

module.exports = KnowledgeBook;