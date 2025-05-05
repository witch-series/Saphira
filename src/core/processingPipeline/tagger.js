/**
 * Tagger automatically assigns relevant tags to content
 * based on content analysis and existing metadata
 */
class Tagger {
  constructor(options = {}) {
    this.maxTags = options.maxTags || 10; // Maximum number of tags to assign
    this.minTagConfidence = options.minTagConfidence || 0.3; // Minimum confidence score (0-1)
    this.aiModel = options.aiModel || null;
    this.logger = options.logger || console;
    
    // Common tags by category for rule-based tagging
    this.commonTags = {
      academic: ['research', 'study', 'paper', 'findings', 'science', 'analysis'],
      news: ['current events', 'update', 'announcement', 'report'],
      education: ['tutorial', 'guide', 'how-to', 'learning', 'explanation'],
      reviews: ['opinion', 'assessment', 'critique', 'evaluation']
    };
  }
  
  /**
   * Process content by analyzing it and adding relevant tags
   * @param {Object} content - Content object to process
   * @param {Array} contextTags - Tags from the context (e.g., user interests)
   * @returns {Promise<Object>} - Content with enhanced tags
   */
  async process(content, contextTags = []) {
    try {
      this.logger.info(`Tagging content: ${content.title}`);
      
      // Start with existing tags, adding context tags
      let tags = Array.isArray(content.tags) ? [...content.tags] : [];
      
      // Add context tags if not already present
      for (const tag of contextTags) {
        if (!tags.includes(tag)) {
          tags.push(tag);
        }
      }
      
      // Extract additional tags from content
      const extractedTags = await this._extractTags(content, tags);
      
      // Merge all tags and remove duplicates
      tags = [...new Set([...tags, ...extractedTags])];
      
      // Limit to maximum number of tags
      if (tags.length > this.maxTags) {
        tags = tags.slice(0, this.maxTags);
      }
      
      this.logger.debug(`Assigned tags: ${tags.join(', ')}`);
      
      return {
        ...content,
        tags
      };
    } catch (error) {
      this.logger.error('Error during tagging:', error);
      // Return original content with existing tags if tagging fails
      return content;
    }
  }
  
  /**
   * Extract tags from content
   * @private
   * @param {Object} content - Content to analyze
   * @param {Array} existingTags - Already assigned tags
   * @returns {Promise<Array>} - Extracted tags
   */
  async _extractTags(content, existingTags = []) {
    // If AI model is available, use it for tagging
    if (this.aiModel) {
      try {
        this.logger.debug('Using AI model for tagging');
        return await this._aiTagging(content, existingTags);
      } catch (error) {
        this.logger.error('AI tagging failed, falling back to rule-based method:', error);
      }
    }
    
    // Use rule-based tagging as fallback
    return this._ruleBasedTagging(content, existingTags);
  }
  
  /**
   * Extract tags using AI
   * @private
   * @param {Object} content - Content to analyze
   * @param {Array} existingTags - Already assigned tags
   * @returns {Promise<Array>} - AI generated tags
   */
  async _aiTagging(content, existingTags) {
    // In a real implementation, this would call an AI API
    // For example: OpenAI, Anthropic, etc.
    /*
    const text = `Title: ${content.title}\n\nContent: ${content.content.substring(0, 2000)}`;
    
    const response = await fetch('https://api.openai.com/v1/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.aiModel.apiKey}`
      },
      body: JSON.stringify({
        model: this.aiModel.modelName,
        prompt: `Extract 5-10 relevant tags from the following text. Return only the tags as a comma-separated list.\n\n${text}`,
        max_tokens: 50,
        temperature: 0.3
      })
    });
    
    const data = await response.json();
    const tagString = data.choices[0].text.trim();
    return tagString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    */
    
    // Mock implementation - generate some tags based on the content and category
    const mockTags = [];
    
    // Add category-based tags
    if (content.category && this.commonTags[content.category]) {
      // Add 1-2 random tags from the category
      const categoryTags = this.commonTags[content.category];
      const numToAdd = Math.min(2, categoryTags.length);
      
      for (let i = 0; i < numToAdd; i++) {
        const randomIndex = Math.floor(Math.random() * categoryTags.length);
        mockTags.push(categoryTags[randomIndex]);
      }
    }
    
    // Add title-based tags
    const words = content.title.toLowerCase().split(/\s+/);
    for (const word of words) {
      // Skip short words and common stop words
      if (word.length > 4 && !this._isStopWord(word) && !existingTags.includes(word)) {
        mockTags.push(word);
      }
    }
    
    return mockTags;
  }
  
  /**
   * Extract tags using rule-based methods
   * @private
   * @param {Object} content - Content to analyze
   * @param {Array} existingTags - Already assigned tags
   * @returns {Array} - Rule-based generated tags
   */
  _ruleBasedTagging(content, existingTags) {
    const tags = [];
    
    // Add category as a tag if present
    if (content.category && !existingTags.includes(content.category)) {
      tags.push(content.category);
    }
    
    // Add source name as tag if present
    if (content.sourceName && !existingTags.includes(content.sourceName)) {
      tags.push(content.sourceName.toLowerCase());
    }
    
    // Extract keywords from title
    const titleWords = content.title.toLowerCase().split(/\s+/);
    for (const word of titleWords) {
      if (word.length > 4 && !this._isStopWord(word) && !existingTags.includes(word)) {
        tags.push(word);
      }
    }
    
    // Extract keywords from content (using a simple frequency analysis)
    const contentTags = this._extractKeywordsFromText(content.content);
    for (const tag of contentTags) {
      if (!existingTags.includes(tag) && !tags.includes(tag)) {
        tags.push(tag);
      }
    }
    
    return tags;
  }
  
  /**
   * Extract keywords from text using simple frequency analysis
   * @private
   * @param {string} text - Text to analyze
   * @returns {Array} - Extracted keywords
   */
  _extractKeywordsFromText(text) {
    // This is a very basic implementation that could be improved
    const words = text.toLowerCase().split(/\s+/);
    const wordCount = {};
    
    // Count word occurrences
    for (const word of words) {
      // Skip short words and stop words
      if (word.length <= 4 || this._isStopWord(word)) continue;
      
      wordCount[word] = (wordCount[word] || 0) + 1;
    }
    
    // Sort by frequency
    const sortedWords = Object.keys(wordCount).sort((a, b) => wordCount[b] - wordCount[a]);
    
    // Return top words (up to 5)
    return sortedWords.slice(0, 5);
  }
  
  /**
   * Check if a word is a common stop word
   * @private
   * @param {string} word - Word to check
   * @returns {boolean} - Whether it's a stop word
   */
  _isStopWord(word) {
    const stopWords = ['the', 'and', 'or', 'but', 'for', 'with', 'about', 'that', 'this', 
                      'these', 'those', 'from', 'to', 'in', 'on', 'by', 'at', 'of',
                      'have', 'has', 'had', 'not', 'are', 'were', 'was', 'will', 'would'];
    return stopWords.includes(word.toLowerCase());
  }
}

module.exports = Tagger;