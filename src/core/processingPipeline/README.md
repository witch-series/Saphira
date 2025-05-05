# Processing Pipeline

This directory contains components for processing and enriching collected information.

## Overview

The processing pipeline transforms raw content from source adapters into enriched knowledge that can be displayed in the Saphira environment. Each processor performs a specific task in the pipeline, such as summarization, tagging, or categorization.

## Included Processors

- **summarizer.js**: Generates concise summaries of collected content
- **tagger.js**: Extracts and assigns relevant tags to content based on content analysis

## Processing Levels

The pipeline supports three processing levels that can be configured:

1. **Basic** - Minimal processing for quick data collection
   - Simple cleanup and normalization
   - No intensive processing operations

2. **Enhanced** - Balanced processing for general use
   - Content summarization
   - Automatic tagging
   - Basic metadata extraction

3. **Full** - Complete processing for comprehensive knowledge development
   - Advanced summarization with key points extraction
   - Comprehensive tagging with hierarchical relationships
   - Related content identification
   - Sentiment and tone analysis

## Common Interface

All processors implement the following interface:

```javascript
{
  process(content, context?): Promise<Object>; // Transforms content and returns enhanced version
  getProcessingLevel(): string; // Returns the minimum processing level required
}
```

## Pipeline Flow

The typical processing flow is:

1. Raw content is collected from source adapters
2. Content passes through each applicable processor based on the configured processing level
3. Each processor enriches the content with additional information
4. The fully processed content is transformed into KnowledgeBook objects

## Usage

Processors are registered with the `KnowledgeCollector` which manages the pipeline:

```javascript
const collector = new KnowledgeCollector({ processingLevel: 'enhanced' });
collector.registerProcessor(new Summarizer({ maxLength: 200 }));
collector.registerProcessor(new Tagger());
```

## Extending with New Processors

To add a new processing capability:

1. Create a new file following the naming convention `[function]Processor.js`
2. Implement the common processor interface
3. Specify the minimum processing level required for the processor
4. Register the processor with the knowledge collector

## Performance Considerations

- Consider the computational cost of each processor
- Use async processing for intensive operations
- Implement caching strategies for expensive computations
- Associate processors with appropriate processing levels to optimize performance