# Models

This directory contains data models used throughout the Saphira system.

## Overview

Models define the structure of data entities in the system. They provide consistent data representation and encapsulate entity-specific logic.

## Included Models

- **knowledgeBook.js**: Represents a piece of collected information from various sources
- **userInterest.js**: Defines user interests and preferences for information collection

## KnowledgeBook Model

The KnowledgeBook model is the core data structure in Saphira:

- **Properties**:
  - `id`: Unique identifier for the book
  - `title`: Title of the content
  - `summary`: Brief summary of the content
  - `content`: Full text or structured content
  - `tags`: Array of associated keywords or categories
  - `source`: Source name (e.g., "Wikipedia", "arXiv")
  - `sourceUrl`: URL of the original content
  - `date`: Creation or publication date
  - `collectionId`: ID of the collection run that created this book
  - `collectionDate`: Date when this content was collected

- **Functionality**:
  - Content storage and retrieval
  - Metadata management
  - Tagging and categorization
  - Serialization for storage
  
## UserInterest Model

The UserInterest model defines user preferences:

- **Properties**:
  - `id`: Unique identifier for the interest
  - `name`: Name of the interest
  - `tags`: Related keywords for this interest
  - `weight`: Importance level (used for prioritization)
  - `enabled`: Whether this interest is active
  - `lastCollectionDate`: When content was last collected for this interest

- **Functionality**:
  - Collection scheduling
  - Interest management
  - Tag association

## Common Patterns

Models typically follow these patterns:

1. Constructor-based initialization with default values
2. Immutable properties where appropriate
3. Methods for manipulating or transforming the model data
4. Serialization/deserialization support for storage and transmission

## Usage

Models are instantiated and used throughout the system:

```javascript
// Creating a knowledge book
const book = new KnowledgeBook({
  title: 'Understanding AI',
  summary: 'A comprehensive overview of artificial intelligence concepts',
  content: 'Artificial intelligence (AI) refers to...',
  tags: ['artificial intelligence', 'machine learning'],
  source: 'Wikipedia',
  sourceUrl: 'https://en.wikipedia.org/wiki/Artificial_intelligence'
});

// Using user interests
const interest = new UserInterest({
  name: 'Machine Learning',
  tags: ['ML', 'neural networks', 'deep learning'],
  weight: 0.8
});

// Check if collection is due
if (interest.isCollectionDue()) {
  // Perform collection...
}
```

## Future Extensions

Planned model improvements:
- Enhanced relationship mapping between knowledge books
- Support for multimedia content
- User annotation and notes