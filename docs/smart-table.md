# Smart Table Feature

The Smart Table feature enhances HTML tables with powerful query filtering capabilities using Monaco Editor integration. It allows users to filter table data using a simple yet powerful query language.

## Installation

```javascript
import { setupSmartTable } from '@awesome-editor/smart-table';
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

```javascript
const columns = [
  {
    field: 'active',
    header: 'Status',
    render: (value) => value ? '✅ Active' : '❌ Inactive'
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

See the complete example in `/examples/smart-table/index.html`.
