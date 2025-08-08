# Routes Directory (src/routes/)

This directory contains Express route definitions for the Saphira web application.

## 📁 File Structure

```
routes/
└── collection-routes.js  # Knowledge Book management routes
```

## 🌐 Route Definitions

### collection-routes.js
HTTP endpoints that implement the Knowledge Book workflow:

#### Search & Creation Routes
- **POST /collection/search**
  - Execute multi-source search
  - Automatically generate Knowledge Book from search results
  - URL duplication checking functionality
  - Redirect to home screen

#### Display Routes
- **GET /collection**
  - Display multi-source search interface
  - Search settings form (result count, source selection)
  
- **GET /collection/knowledge-books**
  - Display Knowledge Book collection list
  - Statistical information display (total count, URL count, etc.)

- **GET /collection/knowledge-book/:filename**
  - Display individual Knowledge Book details
  - Display search results and metadata

#### Management Routes
- **DELETE /collection/knowledge-book/:filename**
  - Knowledge Book deletion functionality
  - JSON response (for Ajax)

## 🔧 Implementation Details

### Dependent Services
- **SearchService**: Multi-source search execution
- **KnowledgeBookManager**: Knowledge Book CRUD operations
- **URLTracker**: URL duplication prevention

### Error Handling
- Redirect with appropriate error message on search failure
- Display custom error page for 404 errors
- Structured error response for JSON API errors

### Response Formats
- **HTML**: Template display system (using EJS)
- **JSON**: API system (deletion, etc.)
- **Redirect**: After form processing

## 📊 Log Output

Log output for main actions in route processing only:
- Search request start
- Knowledge Book creation completion
- Detailed information when errors occur

## 🚀 Usage Example

### Module Loading
```javascript
const createCollectionRoutes = require('./routes/collection-routes');

const collectionRouter = createCollectionRoutes({
  logger: logger,
  searchService: searchService
});

app.use('/collection', collectionRouter);
```

### URL Patterns
- `/collection` - Search interface
- `/collection/search` - Search execution
- `/collection/knowledge-books` - Collection list
- `/collection/knowledge-book/knowledge-book-javascript-2025-08-07.json` - Individual display
