# UI Directory (ui/)

This directory contains the frontend and Express server for the Saphira web application.

## 📁 Directory Structure

```
ui/
├── app.js              # Express.js main application
├── views/              # EJS template files
│   ├── index.ejs           # Home screen (Knowledge Collection display)
│   ├── collection.ejs      # Multi-source search interface
│   ├── knowledge-book-detail.ejs # Individual Knowledge Book display
│   ├── error.ejs           # Error page
│   └── partials/           # Common components
│       ├── header.ejs      # HTML header
│       └── footer.ejs      # HTML footer
└── public/             # Static files
    └── css/
        └── style.css       # Main stylesheet
```

## 🌐 Application Structure

### app.js - Main Application
Express.js-based web application server

#### Core Features
- **Server Configuration**: Runs on port 3333
- **Templates**: EJS template engine
- **Routing**: Routes for Knowledge Book workflow
- **Static Files**: CSS, images, etc. serving
- **Error Handling**: 404 & 500 error pages

#### Dependent Services
- **SearchService**: Multi-source search functionality
- **KnowledgeBookManager**: Knowledge Book CRUD
- **URLTracker**: URL duplication tracking

#### Startup Method
```bash
node ui/app.js
```

## 🎨 Views (Templates)

### index.ejs - Home Screen
Display and navigation for Knowledge Collection

**Features**:
- Knowledge Book card display
- Link to search interface
- Statistics display
- Success/error message display

### collection.ejs - Search Interface  
Multi-source search operation screen

**Features**:
- Search query input
- Source selection (Wikipedia, OpenLibrary, Google, arXiv)
- Search result count setting (5-50 items)
- English UI support

### knowledge-book-detail.ejs - Knowledge Book Details
Individual Knowledge Book content display

**Features**:
- Search results list display
- Source-specific tag display
- Metadata information
- Delete button

### Error Pages
- **error.ejs**: Unified error page template

### Partials
- **header.ejs**: Bootstrap CDN, meta tags, navigation
- **footer.ejs**: JavaScript, closing tags

## 🎯 User Workflow

### 1. Home Screen Access
```
GET / → index.ejs
```
- Knowledge Collection display
- "Start New Search" button

### 2. Search Execution
```
GET /collection → collection.ejs
POST /collection/search → Knowledge Book creation → Redirect to home
```
- Search form input
- Result count & source selection
- Automatic Knowledge Book generation

### 3. Knowledge Book Viewing
```
GET /collection/knowledge-book/:filename → knowledge-book-detail.ejs
```
- Detailed search results display
- Source-specific information confirmation

### 4. Knowledge Book Deletion
```
DELETE /collection/knowledge-book/:filename → JSON response
```
- Ajax deletion processing
- Automatic UI update

## 🎨 Styling

### Bootstrap 5
Loaded via CDN with responsive design support

### Custom CSS (public/css/style.css)
- Source-specific badge colors
- Knowledge Book card design
- Search form styling
- Responsive adjustments

#### Source-Specific Color Theme
```css
.badge-wikipedia { background-color: #000; }
.badge-openlibrary { background-color: #8B4513; }
.badge-google { background-color: #4285F4; }
.badge-arxiv { background-color: #B31B1B; }
```

## 🔧 Configuration and Performance

### Express Configuration
- **Port**: 3333
- **View Engine**: EJS
- **Static Files**: public/ directory
- **Body Parser**: JSON & URLencoded support

### Security
- Basic XSS protection (EJS escaping)
- CSRF protection planned for future implementation

### Performance
- Static file caching
- EJS template caching
- Minimal JavaScript usage

## 🚀 Development & Debugging

### Log Configuration
Minimal log output for clean display:
```javascript
[2025-08-07T09:29:06.487Z] [INFO] Saphira UI server running at http://localhost:3333
```

### Debug Mode
```bash
DEBUG=* node ui/app.js
```

### Development Reload
Manual restart required when files change
