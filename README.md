# Saphira

AI-powered multi-source search and knowledge collection system with intelligent URL tracking.

## Project Overview

Saphira is an intelligent search system that aggregates information from multiple sources (Wikipedia, OpenLibrary, Google, arXiv) to collect, organize, and present search results in a comprehensive knowledge book format. The system features intelligent URL tracking to avoid duplicate content collection and continuously expand your knowledge base.

## User Workflow

The Saphira system follows a streamlined workflow designed for continuous knowledge accumulation:

### 1. Search Execution
- Navigate to the Multi-Source Search page
- Enter your search query
- Select desired sources (Wikipedia, OpenLibrary, Google, arXiv)
- Adjust search settings (max results per source)
- Execute search to collect information

### 2. Knowledge Book Creation
- Search results are automatically compiled into a Knowledge Book
- Each Knowledge Book is saved as a JSON file in `user/data/` folder
- Filename format: `knowledge-book-{query}-{timestamp}.json`
- Contains structured data with source attribution and metadata

### 3. URL Tracking
- All searched URLs are recorded in `user/url-list.json`
- Prevents duplicate content collection in future searches
- Enables intelligent content discovery by avoiding already-processed sources

### 4. Knowledge Collection Management
- After search completion, return to Home screen
- View complete Knowledge Collection (list of all Knowledge Books)
- Browse your accumulated knowledge library with easy access

### 5. Knowledge Book Inspection
- Click on any Knowledge Book name to view its contents
- Examine search results organized by source
- Review collected information with full metadata

### 6. Continuous Learning
- Subsequent searches automatically reference `user/url-list.json`
- System intelligently skips previously processed URLs
- Focus collection efforts on new, unexplored information sources
- Continuously expand knowledge base without redundancy

This workflow ensures efficient knowledge accumulation while maximizing the discovery of new information sources.

## Architecture

### Core System (`src/`)
- **`src/core/`**: DuckDuckGo search engine and caching
- **`src/api/`**: RESTful API routes and business logic  
- **`src/models/`**: Data models for knowledge books
- **`src/utils/`**: Configuration and utility functions

### User Interface (`ui/`)
- **`ui/app.js`**: Main web application server
- **`ui/views/`**: Customizable EJS templates
- **`ui/public/`**: Static assets (CSS, JS, images)

## Key Features

1. **DuckDuckGo Search Integration**
   - Fast and privacy-focused search
   - Result caching for performance
   - Automatic knowledge book creation

2. **Knowledge Book System**
   - Search results organized by query and timestamp
   - Clean filename format: `{keyword}-{date}.json`
   - Persistent storage with metadata

3. **Customizable UI**
   - Responsive web interface built with Bootstrap
   - Tag-based filtering and organization
   - Easy-to-customize templates and styling

4. **API Management**
   - Built-in API key management
   - Future-ready for additional search engines
   - RESTful endpoints for programmatic access

## Getting Started

### Installation

```bash
# Clone the repository
git clone https://github.com/witch-series/saphira.git
cd saphira

# Install dependencies
npm install
```
```

### Quick Start

```bash
# Start the UI application
node ui/app.js

# Access the interface in your browser
# Default URL: http://localhost:3333
```

### API Key Configuration

Saphira includes built-in API key management for future extensions:

1. **Through the Web Interface**:
   - Navigate to http://localhost:3333/api-keys
   - Update keys through the management interface
   - Keys are automatically saved to `user/api-keys.json`

2. **Manual Configuration**:
   ```json
   {
     "newsApiKey": "your_future_news_api_key",
     "githubApiKey": "your_future_github_token",
     "otherApiKeys": {
       "_comment": "Reserved for future API integrations"
     }
   }
   ```

### Usage

1. **Search**: Enter queries to search DuckDuckGo and create knowledge books
2. **Browse**: View saved search collections on the home page
3. **Organize**: Use tags to filter and organize your knowledge books
4. **Customize**: Modify `ui/views/` templates and `ui/public/` assets

## Development

### Project Structure

```
saphira/
├── src/                    # Core search system
│   ├── api/               # API routes and business logic
│   ├── core/              # Search engine and services
│   ├── models/            # Data models
│   └── utils/             # Configuration and utilities
├── ui/                    # Customizable user interface
│   ├── app.js            # Main web server
│   ├── views/            # EJS templates (customize here)
│   └── public/           # Static assets (customize here)
├── user/                  # User data (auto-created)
│   ├── api-keys.json     # API configuration
│   └── data/             # Knowledge books storage
└── README.md
```

### Customization

The UI layer is designed for easy customization:

- **Templates**: Modify `ui/views/*.ejs` files for layout changes
- **Styling**: Update `ui/public/css/style.css` for visual customization  
- **Functionality**: Extend `ui/app.js` for additional features
- **API**: Add new routes in `src/api/` for custom endpoints

# Run enhanced collection test (uses all available APIs)
node test/core/enhancedApiCollection.test.js
```

All user-generated content and logs will be stored in the `user` directory (which is excluded from git).

## Project Structure

- **src/core/**: Core collection and processing functionality
  - **sourceAdapters/**: Adapters for different information sources
  - **processingPipeline/**: Content processing components

- **src/models/**: Data models for knowledge representation
  - **knowledgeBook.js**: Core knowledge representation
  - **userInterest.js**: User interest tracking

- **examples/**: Sample applications
  - **gui-viewer-app.js**: Interactive GUI application
  - **routes/**: Route handlers for GUI application
  - **views/**: EJS templates for the GUI viewer
  - **public/**: Static assets for the GUI viewer

- **test/**: Test files for verifying functionality
  - **core/**: Tests for core functionality

- **user/**: User-specific data storage and configuration (gitignored)

## Processing Levels

Saphira supports three processing levels for knowledge collection:

1. **Basic**: Simple data collection without additional processing
2. **Enhanced**: Includes summarization and tagging of content
3. **Full**: Complete knowledge processing including categorization and relationship detection

## Security Notes

- **API Keys**: Never commit your API keys to the repository. They should only exist in your local `user/api-keys.json` file or as environment variables.
- **User Data**: All collected data is stored in the `user` directory, which is excluded from git.

## Development

This project follows [Witch Series Guidelines](witch-guideline/README.md) for collaborative development with AI assistance.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
