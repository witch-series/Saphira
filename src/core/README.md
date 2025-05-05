# Core Module

This directory contains the core functionality of Saphira, focused on knowledge collection, processing, and management.

## Components

### Knowledge Collection

- **knowledgeCollector.js**: Central component that orchestrates the information collection process
- **searchService.js**: Service for performing searches and retrieving content
- **sourceAdapters/**: Adapters for different information sources (web, academic, news)
- **processingPipeline/**: Processing components that transform raw content into enriched knowledge

### Key Workflows

1. **Interest-Based Collection**:
   - User interests are used as search terms
   - Multiple adapters collect relevant content
   - Processing pipeline enriches content (summarization, tagging)
   - Content is transformed into KnowledgeBook objects

2. **Scheduled Collection**:
   - Periodic background collection based on user interests
   - Updates existing knowledge with new information

3. **Manual Collection**:
   - Users can manually trigger collection for specific topics
   - Supports different processing levels (basic, enhanced, full)

4. **Search and Retrieval**:
   - Real-time search across configured sources
   - Content scraping and extraction
   - Integration with the knowledge storage system

## Processing Levels

Saphira supports three processing levels:

- **Basic**: Simple data collection without additional processing
- **Enhanced**: Includes summarization and tagging of content
- **Full**: Complete knowledge processing including related content detection and categorization

## Integration Points

- Connects with the user profile system to get interest tags
- Provides KnowledgeBook objects to the visualization system
- Works with storage systems to persist collected knowledge
- Interfaces with the GUI viewer for user interaction

## Future Enhancements

- Enhanced natural language processing capabilities
- Improved cross-referencing between knowledge items
- Support for multimedia content extraction