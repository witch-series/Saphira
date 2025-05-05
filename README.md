# Saphira

AI system for gathering and updating domain knowledge from diverse sources, with a powerful GUI viewer for exploration.

## Project Overview

Saphira is an intelligent knowledge collection system that automatically collects, organizes, and presents information based on user interests. The system offers both a GUI viewer for interactive exploration and API interfaces for programmatic integration.

## Key Features

1. **Interest-Based Automatic Collection**
   - User interest tag registration
   - Periodic and on-demand information gathering
   - Multiple processing levels (basic, enhanced, full)

2. **Multi-source Collection**
   - Scientific papers (arXiv)
   - Encyclopedia articles (Wikipedia)
   - Current news (NewsAPI)
   - Web search results (DuckDuckGo)
   - Code repositories (GitHub)
   - General web content

3. **Knowledge Processing**
   - Automatic summarization
   - Content tagging and categorization
   - Metadata enhancement

4. **GUI Viewer**
   - Interactive knowledge exploration
   - Tag-based filtering and search
   - Custom tag color management
   - Collection history tracking

5. **API Access**
   - Programmatic collection triggering
   - Query and search capabilities
   - Knowledge book management

## Getting Started

### Installation

```bash
# Clone the repository
git clone https://github.com/witch-series/saphira.git
cd saphira

# Install dependencies
npm install
```

### Setting Up API Keys

Saphira can use various APIs to collect information. Some APIs require authentication keys:

1. **API Key Configuration**:
   - Create a `user/api-keys.json` file (this directory is gitignored for security)
   - You can use the following template:
   ```json
   {
     "newsApiKey": "your_news_api_key_here",
     "githubApiKey": "your_github_token_here",
     "otherApiKeys": {
       "_comment": "Section for future API keys"
     }
   }
   ```
   - Keys can also be managed through the GUI viewer once running
   - Alternatively, you can set environment variables: `NEWS_API_KEY`, `GITHUB_API_KEY`

2. **Supported APIs**:
   - **NewsAPI**: Requires API key (get from [newsapi.org](https://newsapi.org/register))
   - **GitHub API**: Optional token for higher rate limits
   - **arXiv API**: No key required
   - **Wikipedia API**: No key required
   - **DuckDuckGo**: No key required

### Running the GUI Viewer

```bash
# Start the GUI viewer
node examples/gui-viewer-app.js

# Access the viewer in your browser
# Default URL: http://localhost:3333
```

### Running Tests

The project includes test files to verify the API collection functionality:

```bash
# Run basic API collection test
node test/core/apiCollection.test.js

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
