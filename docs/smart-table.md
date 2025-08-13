# Smart Table Feature

The Smart Table feature enhances HTML tables with powerful query filtering capabilities using Monaco Editor integration. It allows users to filter table data using a simple yet powerful query language.

## Installation

### Module Import (ES6/Webpack)

```javascript
import { setupSmartTable } from '@awesome-editor/smart-table';
```

### Vanilla JavaScript (Plain HTML)

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Smart Table Example</title>
    <link rel="stylesheet" data-name="vs/editor/editor.main" href="https://unpkg.com/monaco-editor@latest/min/vs/editor/editor.main.css">
    <style>
        .smart-table-wrapper {
            border: 1px solid #dee2e6;
            border-radius: 4px;
            overflow: hidden;
            background: white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .smart-table-filter-toolbar {
            display: flex;
            gap: 10px;
            align-items: center;
            padding: 12px;
            background: rgba(248, 249, 250, 0.95);
            border-bottom: 1px solid rgba(222, 226, 230, 0.8);
        }
        .smart-table-filter-toolbar #query-container {
            flex: 1;
            min-width: 200px;
        }
        .smart-table-filter-toolbar #group-by {
            min-width: 140px;
        }
        .query-inputfield {
            padding: 10px;
            border: 2px solid #e1e5e9;
            border-radius: 8px;
            background: #ffffff;
        }
    </style>
</head>
<body>
    <div class="smart-table-wrapper">
        <div class="smart-table-filter-toolbar">
            <div id="query-container" class="query-inputfield"></div>
            <select id="group-by">
                <option value="">Group by...</option>
            </select>
        </div>
        <div class="smart-table-header-container">
            <table id="header-table" class="smart-table smart-table-header">
                <!-- Header will be populated by JavaScript -->
            </table>
        </div>
        <div class="smart-table-container">
            <table id="data-table" class="smart-table smart-table-body">
                <!-- Body will be populated by JavaScript -->
            </table>
        </div>
    </div>
    
    <script src="https://unpkg.com/monaco-editor@latest/min/vs/loader.js"></script>
    <script src="../dist/vanilla/smart-table.js"></script>
    <script>
        require.config({ paths: { vs: 'https://unpkg.com/monaco-editor@latest/min/vs' }});
        require(['vs/editor/editor.main'], function() {
            // Your data and table setup
            const data = [
                { id: 1, name: 'John', age: 30, city: 'New York', active: true, status: 'active' },
                { id: 2, name: 'Jane', age: 25, city: 'Los Angeles', active: false, status: 'inactive' },
                { id: 3, name: 'Bob', age: 35, city: 'Chicago', active: true, status: 'active' }
            ];
            
            const columns = [
                { field: 'id', header: 'ID' },
                { field: 'name', header: 'Name' },
                { field: 'age', header: 'Age', groupable: true },
                { 
                    field: 'city', 
                    header: 'City', 
                    groupable: true,
                    render: (value) => `<a href="https://www.example.com?city=${encodeURIComponent(value)}" target="_blank">${value}</a>`
                },
                { 
                    field: 'active', 
                    header: 'Status',
                    render: (value) => value ? '✅ Active' : '❌ Inactive'
                },
                { field: 'status', header: 'Status Text', groupable: true }
            ];
            
            // Initialize smart table
            const { filter, group } = setupSmartTable(monaco, {
                table: document.getElementById('data-table'),
                data,
                columns,
                editorContainer: document.getElementById('query-container'),
                showCheckboxes: false,
                multiSelect: true
            });
        });
    </script>
</body>
</html>
```

## Usage

### Basic Setup

```javascript
import * as monaco from 'monaco-editor';
import { setupSmartTable } from '@awesome-editor/smart-table';

// Initialize with a table element and data
const table = document.getElementById('myTable');
const editorContainer = document.getElementById('editorContainer');

const data = [
  { id: 1, name: 'John', age: 30, active: true },
  { id: 2, name: 'Jane', age: 25, active: false }
];

const columns = [
  { field: 'id', header: 'ID' },
  { field: 'name', header: 'Name' },
  { field: 'age', header: 'Age' },
  { field: 'active', header: 'Status' }
];

const { editor, filter, refresh, dispose } = setupSmartTable(monaco, {
  table,
  data,
  columns,
  editorContainer
});
```

### Column Configuration

Each column can be configured with:

- `field`: The property name in the data objects
- `header`: The display text for the column header
- `render`: (Optional) A function to customize the rendering of cell values
- `groupable`: (Optional) Boolean to enable grouping for this column
- `responsive`: (Optional) Object with responsive behavior settings
  - `priority`: Priority level ('high', 'medium', 'low')
  - `size`: Column size ('flexible-small', 'flexible-medium', 'flexible-large')
  - `hideMobile`: Hide on mobile devices
  - `hideSmall`: Hide on small screens
  - `allowWrap`: Allow text wrapping in cells

```javascript
const columns = [
  {
    field: 'active',
    header: 'Status',
    groupable: true,
    render: (value) => value ? '✅ Active' : '❌ Inactive',
    responsive: {
      priority: 'medium',
      size: 'flexible-small',
      hideMobile: false
    }
  },
  {
    field: 'city',
    header: 'City',
    groupable: true,
    render: (value) => `<a href="https://www.example.com?city=${encodeURIComponent(value)}" target="_blank">${value}</a>`,
    responsive: {
      priority: 'high',
      size: 'flexible-medium'
    }
  }
];
```

### Query Language

The query language supports:

#### Comparison Operators

- Equals: `field = value`
- Not Equals: `field != value`
- Greater Than: `field > value`
- Less Than: `field < value`

#### Logical Operators

- AND: `condition1 AND condition2`
- OR: `condition1 OR condition2`

#### List Operations

- IN: `field IN [value1, value2, ...]`

#### Data Types

- Strings: Use quotes (`"value"`)
- Numbers: Direct numbers (`42`)
- Booleans: `true` or `false`

### Example Queries

```sql
age > 25
active = true AND city = "New York"
age < 30 OR city IN ["Chicago", "Los Angeles"]
```

## API Reference

### setupSmartTable(monaco, options)

Sets up a smart table with query filtering capabilities.

#### Parameters

- `monaco`: The Monaco editor instance
- `options`: Configuration object
  - `table`: HTMLTableElement to enhance
  - `data`: Array of objects to display
  - `columns`: Array of column definitions
  - `editorContainer`: DOM element for the Monaco editor

#### Returns

Object with the following methods:

- `editor`: The Monaco editor instance
- `filter(query)`: Apply a query to filter the table
- `refresh()`: Refresh the table display
- `dispose()`: Clean up resources

## Best Practices

1. **Editor Layout**
   - Set a fixed height for single-line queries
   - Handle window resize events to update the editor layout

2. **Performance**
   - Keep data sets reasonable (under 10,000 items for smooth performance)
   - Use appropriate data types in your objects

3. **Error Handling**
   - Invalid queries will show all data
   - Query errors are caught and can be handled gracefully

## Example

### Complete Working Example

See the complete example in `/examples/smart-table/index.html` for a full-featured implementation.

### Vanilla JavaScript Example

For a simpler vanilla JavaScript setup, see `/examples/vanilla/index.html` which demonstrates how to use the smart table feature without a build system.

### Basic Integration

```html
<!-- Minimal setup -->
<div id="editor-container"></div>
<table id="my-table"></table>

<script>
// After Monaco is loaded
const { filter } = setupSmartTable(monaco, {
    table: document.getElementById('my-table'),
    data: yourData,
    columns: yourColumns,
    editorContainer: document.getElementById('editor-container')
});
</script>
```
