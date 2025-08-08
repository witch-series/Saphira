# ui/views/ - Template Files

EJS template files for the web interface.

## File Structure

```
views/
├── partials/        # Reusable template components
├── index.ejs        # Homepage
├── search.ejs       # Search form
├── data-view.ejs    # Data display page
├── no-data.ejs      # No data display
└── error.ejs        # Error page
```

## Template Roles

- **index.ejs**: Display list of saved collections
- **search.ejs**: DuckDuckGo search form
- **data-view.ejs**: Detailed collection display (list format)
- **error.ejs**: Error page display
- **no-data.ejs**: Display when no data is available

## Partials Folder

- **header.ejs**: Page header and navigation
- **footer.ejs**: Page footer

## Design Principles

- Responsive design using Bootstrap classes
- Consistent UI/UX throughout the application
- Accessibility considerations
