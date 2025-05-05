/**
 * File Manager for Saphira
 * Provides utilities for file operations, particularly for knowledge books
 */
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

class FileManager {
  /**
   * Constructor for FileManager
   * 
   * @param {Object} options - Configuration options
   * @param {string} options.userDir - Base directory for user data
   * @param {string} options.dataDir - Directory for data files
   * @param {Object} options.logger - Logger instance
   */
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.userDir = options.userDir || path.join(process.cwd(), 'user');
    this.dataDir = options.dataDir || path.join(this.userDir, 'data');
    this.knowledgeBooksFile = path.join(this.dataDir, 'knowledge-books.json');
  }
  
  /**
   * Ensure required directories exist
   * @returns {Promise<void>}
   */
  async ensureDirectories() {
    try {
      await fs.mkdir(this.userDir, { recursive: true });
      await fs.mkdir(this.dataDir, { recursive: true });
      this.logger.info('Directories checked/created');
    } catch (error) {
      this.logger.error('Failed to create directories', error);
      throw error;
    }
  }
  
  /**
   * Check if a file exists
   * @param {string} filePath - Path to file
   * @returns {Promise<boolean>}
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Get formatted date string suitable for filenames
   * @returns {string} Formatted date string
   */
  getFormattedDateString() {
    const now = new Date();
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(now).replace(/\//g, '-').replace(/:/g, '-').replace(/\s/g, '_');
  }
  
  /**
   * Load all knowledge books from data directory
   * @returns {Promise<Array>} Array of knowledge books
   */
  async loadKnowledgeBooks() {
    await this.ensureDirectories();
    
    // Load from all dated files
    const allBooks = [];
    
    try {
      // Read the data directory to find all dated knowledge book files
      const files = await fs.readdir(this.dataDir);
      const knowledgeBookFiles = files.filter(file => file.startsWith('knowledge-books-') && file.endsWith('.json'));
      
      // If we found dated files, read from them
      if (knowledgeBookFiles.length > 0) {
        this.logger.info(`Found ${knowledgeBookFiles.length} dated knowledge book files`);
        
        // Load all books from all dated files
        for (const file of knowledgeBookFiles) {
          try {
            const filePath = path.join(this.dataDir, file);
            this.logger.debug(`Attempting to load knowledge books from: ${filePath}`);
            
            // Check if the file exists and is accessible
            if (await this.fileExists(filePath)) {
              const fileData = await fs.readFile(filePath, 'utf8');
              let booksData;
              
              try {
                booksData = JSON.parse(fileData);
                this.logger.debug(`Successfully parsed JSON from ${file}`);
              } catch (parseError) {
                this.logger.error(`Error parsing JSON from ${file}:`, parseError);
                continue;
              }
              
              if (Array.isArray(booksData)) {
                // Add books from this file, avoiding duplicates by ID
                const existingIds = new Set(allBooks.map(book => book.id));
                const uniqueBooks = booksData.filter(book => !existingIds.has(book.id));
                
                allBooks.push(...uniqueBooks);
                this.logger.debug(`Added ${uniqueBooks.length} books from ${file}`);
                
                // Update our set of IDs
                uniqueBooks.forEach(book => existingIds.add(book.id));
              } else {
                this.logger.warn(`File ${file} does not contain an array of books`);
              }
            } else {
              this.logger.warn(`File ${file} exists in directory listing but is not accessible`);
            }
          } catch (readError) {
            this.logger.warn(`Error reading knowledge book file ${file}: ${readError.message}`);
          }
        }
        
        // Sort all books by date - newest first
        allBooks.sort((a, b) => {
          const dateA = new Date(a.date || a.createdAt || 0);
          const dateB = new Date(b.date || b.createdAt || 0);
          return dateB - dateA;
        });
        
        this.logger.info(`Loaded ${allBooks.length} total knowledge books from dated files`);
        return allBooks;
      }
      
      // For backward compatibility: If no dated files, try the main file
      this.logger.debug(`No dated knowledge book files found, trying legacy file: ${this.knowledgeBooksFile}`);
      if (await this.fileExists(this.knowledgeBooksFile)) {
        const data = await fs.readFile(this.knowledgeBooksFile, 'utf8');
        this.logger.warn('Using deprecated knowledge-books.json file - future collections will use dated files');
        return JSON.parse(data);
      } else {
        return [];
      }
    } catch (error) {
      this.logger.warn('Knowledge books files not found or invalid, returning empty array', error);
      return [];
    }
  }
  
  /**
   * Save knowledge books to file
   * @param {Array} books - Knowledge books to save
   * @param {string} collectionId - Collection ID (optional)
   * @returns {Promise<string>} Path to saved file
   */
  async saveKnowledgeBooks(books, collectionId = null) {
    await this.ensureDirectories();
    
    if (!Array.isArray(books)) {
      throw new Error('Books must be an array');
    }
    
    // Create dated knowledge books file
    const formattedDate = this.getFormattedDateString();
    const datedBooksFile = path.join(this.dataDir, `knowledge-books-${formattedDate}.json`);
    
    // Add collection metadata to books if not present
    const booksToSave = books.map(book => ({
      ...book,
      collectionId: book.collectionId || collectionId,
      collectionDate: book.collectionDate || formattedDate
    }));
    
    // Save the new collection to its own dated file
    await fs.writeFile(
      datedBooksFile,
      JSON.stringify(booksToSave, null, 2),
      'utf8'
    );
    
    // Also update the main knowledge books file by merging with existing books
    try {
      // Get existing books
      const existingBooks = await this.loadKnowledgeBooks();
      
      // Merge with new books, avoiding duplicates by ID
      const existingIds = new Set(existingBooks.map(book => book.id));
      const allBooks = [
        ...existingBooks,
        ...booksToSave.filter(book => !existingIds.has(book.id))
      ];
      
      // Sort by newest date first
      allBooks.sort((a, b) => {
        const dateA = new Date(a.date || a.createdAt || 0);
        const dateB = new Date(b.date || b.createdAt || 0);
        return dateB - dateA;
      });
      
      // Update main knowledge books file
      await fs.writeFile(
        this.knowledgeBooksFile,
        JSON.stringify(allBooks, null, 2),
        'utf8'
      );
      
      this.logger.info(`Saved ${booksToSave.length} books to ${datedBooksFile}`);
      return datedBooksFile;
    } catch (error) {
      this.logger.error('Error updating main knowledge books file', error);
      return datedBooksFile; // Return the path to the dated file even if updating the main file failed
    }
  }
  
  /**
   * Delete a knowledge book by ID
   * @param {string} id - Knowledge book ID
   * @returns {Promise<boolean>} Success indicator
   */
  async deleteKnowledgeBook(id) {
    try {
      // Load current knowledge books
      let knowledgeBooks = await this.loadKnowledgeBooks();
      
      // Find the book by ID
      const bookIndex = knowledgeBooks.findIndex(book => book.id === id);
      
      if (bookIndex === -1) {
        this.logger.warn(`Knowledge book not found for deletion: ${id}`);
        return false;
      }
      
      // Store the collection info for later updates
      const deletedBook = knowledgeBooks[bookIndex];
      const collectionDate = deletedBook.collectionDate;
      
      // Remove the book
      knowledgeBooks.splice(bookIndex, 1);
      
      // Save updated knowledge books to main file
      await fs.writeFile(
        this.knowledgeBooksFile,
        JSON.stringify(knowledgeBooks, null, 2),
        'utf8'
      );
      
      // Also update the dated knowledge books file if it exists and we know which collection this came from
      if (collectionDate) {
        try {
          const datedBooksFilename = `knowledge-books-${collectionDate}.json`;
          const datedBooksPath = path.join(this.dataDir, datedBooksFilename);
          
          if (await this.fileExists(datedBooksPath)) {
            const datedBooks = JSON.parse(await fs.readFile(datedBooksPath, 'utf8'));
            const datedBookIndex = datedBooks.findIndex(book => book.id === id);
            
            if (datedBookIndex !== -1) {
              datedBooks.splice(datedBookIndex, 1);
              await fs.writeFile(datedBooksPath, JSON.stringify(datedBooks, null, 2), 'utf8');
              this.logger.info(`Updated dated knowledge books file: ${datedBooksFilename}`);
            }
          }
        } catch (err) {
          this.logger.warn(`Could not update dated knowledge books file: ${err.message}`);
        }
      }
      
      this.logger.info(`Deleted knowledge book: ${deletedBook.title} (${id})`);
      return true;
    } catch (error) {
      this.logger.error('Error deleting knowledge book', error);
      return false;
    }
  }
  
  /**
   * Delete all knowledge books
   * @returns {Promise<boolean>} Success indicator
   */
  async deleteAllKnowledgeBooks() {
    try {
      // Get current count for logging
      let knowledgeBooks = [];
      try {
        knowledgeBooks = await this.loadKnowledgeBooks();
      } catch (error) {
        this.logger.warn('Failed to load knowledge books for counting before deletion');
      }
      
      const count = knowledgeBooks.length;
      
      // Save empty array to knowledge books file
      await fs.writeFile(
        this.knowledgeBooksFile,
        JSON.stringify([]),
        'utf8'
      );
      
      // Delete all dated knowledge book files in the data directory
      try {
        const files = await fs.readdir(this.dataDir);
        for (const file of files) {
          if (file.startsWith('knowledge-books-') && file.endsWith('.json')) {
            try {
              await fs.unlink(path.join(this.dataDir, file));
              this.logger.info(`Deleted dated knowledge books file: ${file}`);
            } catch (err) {
              this.logger.warn(`Failed to delete dated knowledge books file ${file}: ${err.message}`);
            }
          }
        }
      } catch (err) {
        this.logger.warn(`Error listing data directory: ${err.message}`);
      }
      
      this.logger.info(`Deleted all knowledge books (${count} items)`);
      return true;
    } catch (error) {
      this.logger.error('Error deleting all knowledge books', error);
      return false;
    }
  }
  
  /**
   * Find all available data files in the user directory
   * @returns {Promise<Array>} Array of file objects with id, name, and path
   */
  async findAvailableDataFiles() {
    const files = [];
    
    try {
      await this.ensureDirectories();
      
      // Look for dated knowledge books files in DATA_DIR
      try {
        const dataFiles = await fs.readdir(this.dataDir);
        const datedKnowledgeFiles = dataFiles.filter(file => file.startsWith('knowledge-books-') && file.endsWith('.json'));
        
        if (datedKnowledgeFiles.length > 0) {
          this.logger.info(`Found ${datedKnowledgeFiles.length} dated knowledge book files`);
          
          // Add each dated file
          for (const file of datedKnowledgeFiles) {
            const filePath = path.join(this.dataDir, file);
            const datePart = file.replace('knowledge-books-', '').replace('.json', '');
            
            files.push({
              id: `knowledge-books-${datePart}`,
              name: `Knowledge Books (${datePart})`,
              path: filePath
            });
          }
        }
      } catch (error) {
        this.logger.warn('Failed to check for dated knowledge book files', error);
      }
      
      // Check main knowledge books file
      if (await this.fileExists(this.knowledgeBooksFile)) {
        files.push({
          id: 'knowledge-books',
          name: 'Knowledge Books',
          path: this.knowledgeBooksFile
        });
      }
      
      // Check other common files in user directory
      const otherFilesToCheck = [
        { id: 'api-collection', name: 'API Collection Results', path: path.join(this.userDir, 'api-collection-results.json') },
        { id: 'enhanced-collection', name: 'Enhanced Collection Results', path: path.join(this.userDir, 'enhanced-collection-results.json') }
      ];
      
      for (const fileInfo of otherFilesToCheck) {
        if (await this.fileExists(fileInfo.path)) {
          files.push(fileInfo);
        }
      }
    } catch (error) {
      this.logger.warn('Error finding available data files', error);
    }
    
    return files;
  }
}

module.exports = FileManager;