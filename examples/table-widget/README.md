# DivTable Widget

A modern table widget built with CSS Grid and Flexbox instead of HTML tables, providing flexible layout and advanced functionality.

## Features

- **Modern CSS-based Layout**: Uses CSS Grid and Flexbox for flexible, responsive design
- **Advanced Query Language**: Monaco Editor integration with intelligent query suggestions
- **Virtual Scrolling**: Handle large datasets efficiently with pagination support
- **Auto-Fetch**: Automated pagination with play/pause/resume controls
- **Grouping & Sorting**: Multi-level grouping and sorting capabilities
- **Selection Management**: Single and multi-row selection with checkbox support
- **Loading States**: Configurable loading placeholders and progress indicators
- **Keyboard Navigation**: Full keyboard accessibility with arrow key navigation
- **Responsive Design**: Adaptive column sizing and mobile-friendly layout

## Basic Usage

```javascript
const divTable = new DivTable(monaco, {
  tableWidgetElement: document.getElementById('table-container'),
  data: myData,
  columns: columnDefinitions,
  showCheckboxes: true,
  multiSelect: true,
  onSelectionChange: (selectedRows) => {
    console.log('Selected:', selectedRows);
  }
});
```

## Configuration Options

### Core Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `tableWidgetElement` | HTMLElement | **required** | Container element for the table |
| `data` | Array | `[]` | Initial data array |
| `columns` | Array | `[]` | Column definitions |
| `showCheckboxes` | boolean | `true` | Show selection checkboxes |
| `multiSelect` | boolean | `true` | Allow multiple row selection |

### Loading & Refresh Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `showLoadingPlaceholder` | boolean | `true` | Show loading placeholder when no data |
| `loadingPlaceholderText` | string | `'...loading'` | Text for loading placeholder |
| `showRefreshButton` | boolean | `false` | Show refresh button in info section |
| `showAutoFetchButton` | boolean | `true` | Show auto-fetch button (for virtual scrolling only) |
| `autoFetchDelay` | number | `500` | Delay in milliseconds between auto-fetch requests |

### Virtual Scrolling Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `virtualScrolling` | boolean | `false` | Enable virtual scrolling for large datasets |
| `pageSize` | number | `100` | Number of records per page |
| `totalRecords` | number | `data.length` | Total records available (for pagination) |
| `loadingThreshold` | number | `pageSize * 0.8` | Records before end to trigger next page load |

### Callback Functions

| Option | Type | Description |
|--------|------|-------------|
| `onSelectionChange` | function | Called when row selection changes: `(selectedRows) => {}` |
| `onRowFocus` | function | Called when row focus changes: `(row, group) => {}` |
| `onRefresh` | function | Called when refresh button is clicked: `() => {}` or `async () => {}` |
| `onNextPage` | function | Called for virtual scrolling: `async (page, pageSize) => {}` |

## Column Definition

```javascript
const columns = [
  {
    field: 'id',
    label: 'ID',
    primaryKey: true,
    hidden: false,
    groupable: false,
    responsive: {
      priority: 'low',
      size: 'fixed-narrow',
      hideMobile: true
    },
    render: (value, row) => `ID: ${value}`
  }
];
```

### Column Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `field` | string | **required** | Data field name |
| `label` | string | `field` | Display label |
| `primaryKey` | boolean | `false` | Marks field as primary key |
| `hidden` | boolean | `false` | Hide column from display |
| `groupable` | boolean | `true` | Allow grouping by this column |
| `render` | function | `null` | Custom render function: `(value, row) => string` |

**HTML Content Support:**
- Column labels (`label` property) support HTML content
- Cell values support HTML content directly from data (no render function needed)
- Loading placeholder text supports HTML content

```javascript
// HTML in column labels
{
  field: 'status',
  label: '📊 Status<br><small>with icons</small>'
}

// HTML in cell values (directly from data)
const data = [
  { 
    status: '<span style="color: green;">✅ Active</span>',
    name: '<strong>John Doe</strong>'
  }
];

// HTML in loading placeholder
loadingPlaceholderText: '🔄 <em>Loading data...</em>'
```

### Responsive Options

| Property | Type | Options | Description |
|----------|------|---------|-------------|
| `priority` | string | `'high'`, `'medium'`, `'low'` | Column importance |
| `size` | string | `'fixed-narrow'`, `'fixed-medium'`, `'flexible-small'`, `'flexible-medium'`, `'flexible-large'` | Column width behavior |
| `hideMobile` | boolean | `false` | Hide on mobile devices |
| `hideSmall` | boolean | `false` | Hide on small screens |
| `allowWrap` | boolean | `false` | Allow text wrapping |

## Public Methods

### Data Management

#### `replaceData(newData)`

Replace entire dataset with new data.

```javascript
divTable.replaceData(newDataArray);
```

#### `addRecord(record)`

Add or update a single record.

```javascript
divTable.addRecord({
  id: 123,
  name: 'John Doe',
  email: 'john@example.com'
});
```

#### `removeRecord(id)`

Remove a record by primary key.

```javascript
const removedRecord = divTable.removeRecord(123);
```

#### `appendData(newData)`

Append new records to existing data (with upsert behavior).

```javascript
const result = divTable.appendData(additionalRecords);
// Returns: { added: 5, updated: 2, skipped: 0, invalid: [] }
```

### Query & Filtering

#### `applyQuery(query)`

Apply a query string to filter data.

```javascript
divTable.applyQuery('age > 25 AND city = "New York"');
```

### Sorting & Grouping

#### `sort(field, direction)`

Sort data by specified field.

```javascript
divTable.sort('name', 'asc');
```

#### `group(field)`

Group data by specified field.

```javascript
divTable.group('department');
```

#### `clearGrouping()`
Remove all grouping.
```javascript
divTable.clearGrouping();
```

### Selection Management

#### `getSelectedRows()`
Get currently selected rows.
```javascript
const selected = divTable.getSelectedRows();
```

#### `selectAll()`
Select all visible rows.
```javascript
divTable.selectAll();
```

#### `clearSelection()`
Clear all selections.
```javascript
divTable.clearSelection();
```

### Loading States

#### `resetToLoading()`

Reset table to loading state.

```javascript
divTable.resetToLoading();
```

#### `setLoadingPlaceholderText(text)`

Update loading placeholder text.

```javascript
divTable.setLoadingPlaceholderText('Fetching latest data...');
```

#### `setLoadingState(isLoading)`

Manually control the loading state. When `true`, shows loading placeholder (if enabled). When `false`, shows data or empty state.

```javascript
divTable.setLoadingState(true);  // Show loading placeholder
divTable.setLoadingState(false); // Hide loading placeholder
```

### Auto-Fetch

The auto-fetch feature allows automated pagination through all available data. When enabled, an auto-fetch button appears in the info section (virtual scrolling mode only).

#### Button States

- **Play** (▶️) - Start auto-fetching from the beginning
- **Pause** (⏸) - Pause during active fetching (yellow state)
- **Continue** (▶️) - Resume from paused state (green state)
- **Stop** - Auto-fetch stops automatically when all data is loaded or when refresh button is clicked

#### Configuration

```javascript
const divTable = new DivTable(container, columns, {
  showAutoFetchButton: true,  // Show auto-fetch button (default: true)
  autoFetchDelay: 500,        // Delay between requests in ms (default: 500)
  onNextPage: async (state) => {
    // Your pagination logic
    return { data: [...], hasMore: boolean };
  }
});
```

#### Behavior

- **Start**: Clicking play initiates auto-fetch from the current position
- **Pause**: Clicking during active fetch pauses at the current page
- **Resume**: Clicking while paused continues from where it stopped
- **Automatic Stop**: Auto-fetch stops when `hasMore` is false
- **Manual Stop**: Clicking the refresh button stops auto-fetch and resets data

### Query Editor

#### Dynamic Field Updates

The query editor automatically updates its field suggestions when data changes, but you can also manually control this:

```javascript
// Get current field names used by query editor
const currentFields = divTable.queryEditor.editor.getFieldNames();

// Update field names dynamically (useful for custom scenarios)
const newFieldNames = {
  name: { type: 'string', values: ['Alice', 'Bob', 'Carol'] },
  age: { type: 'number', values: [] },
  active: { type: 'boolean', values: [] }
};
divTable.queryEditor.editor.updateFieldNames(newFieldNames);
```

### Virtual Scrolling

#### `setTotalRecords(total)`

Update total record count for virtual scrolling.

```javascript
divTable.setTotalRecords(10000);
```

#### `setPageSize(size)`

Update page size for virtual scrolling.

```javascript
divTable.setPageSize(50);
```

#### `setVirtualScrollingConfig(config)`

Update virtual scrolling configuration.

```javascript
divTable.setVirtualScrollingConfig({
  totalRecords: 10000,
  pageSize: 100,
  loadingThreshold: 20
});
```

## Query Language

The widget supports an advanced query language for filtering with intelligent autocomplete:

**Dynamic Field Suggestions:** When the table is initialized with no data, the query editor provides basic field suggestions from column definitions. When data is loaded (via `replaceData()` or other methods), the editor automatically updates its completion providers dynamically to provide enhanced suggestions including actual field values for string fields, making it easier to construct accurate queries. This update happens without recreating the editor, preserving user state and performance.

### Basic Syntax

- `field = value` - Exact match
- `field != value` - Not equal
- `field > value` - Greater than
- `field >= value` - Greater than or equal
- `field < value` - Less than
- `field <= value` - Less than or equal

### String Operations

- `name = "John"` - Exact string match
- `name contains "John"` - Substring search
- `name starts "Jo"` - Starts with
- `name ends "hn"` - Ends with

### Logical Operators

- `age > 25 AND city = "New York"` - Both conditions
- `age < 20 OR age > 65` - Either condition
- `NOT active` - Negation

### Examples

```javascript
// Simple filtering
divTable.applyQuery('active = true');

// Complex queries
divTable.applyQuery('age > 25 AND (city = "New York" OR city = "Los Angeles")');

// String searches
divTable.applyQuery('name contains "Smith" AND department = "Engineering"');
```

## Styling

The widget uses CSS classes that can be customized:

### Main Structure
- `.div-table-widget` - Main container
- `.div-table-toolbar` - Toolbar area
- `.div-table-header` - Header container
- `.div-table-body` - Body container

### States
- `.div-table-loading` - Loading placeholder
- `.div-table-empty` - Empty state
- `.loading-placeholder` - Virtual scrolling placeholder rows

### Interactive Elements

- `.refresh-button` - Refresh button in info section
- `.auto-fetch-button` - Auto-fetch button for automated pagination
  - `.auto-fetch-button.active` - Active fetching state (green)
  - `.auto-fetch-button.paused` - Paused state (yellow)
  - `.auto-fetch-button:hover` - Hover state
- `.group-toggle` - Group expand/collapse button
- `.div-table-row.selected` - Selected rows
- `.div-table-row.focused` - Focused row

## Browser Support

- Modern browsers with CSS Grid support
- ES6+ JavaScript features
- Monaco Editor compatibility

## Dependencies

- Monaco Editor (for query interface)
- Modern browser with CSS Grid and Flexbox support

## License

[Insert your license information here]
