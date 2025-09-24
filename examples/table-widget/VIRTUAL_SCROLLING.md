# DivTable Virtual Scrolling

The DivTable widget now supports virtual scrolling for efficient handling of large datasets. Instead of loading all records at once, you can initialize the table with a subset of data and load more as the user scrolls.

## Features

- **Efficient Memory Usage**: Only renders visible rows plus a small buffer
- **Automatic Pagination**: Loads next page when user scrolls near the bottom
- **Loading States**: Visual indicators during data loading
- **Error Handling**: Retry functionality for failed requests
- **Configurable**: Adjustable page size and loading threshold
- **Compatible**: Works with grouping, sorting, and filtering
- **Responsive**: Maintains performance with large datasets

## Configuration

### Basic Setup

```javascript
const table = new DivTable(monaco, {
  tableWidgetElement: document.getElementById('table'),
  data: initialData, // First page of data (e.g., 100 records)
  columns: columns,
  
  // Enable virtual scrolling
  virtualScrolling: true,
  pageSize: 100,                    // Records per page
  totalRecords: 10000,              // Total records available on server
  loadingThreshold: 10,             // Load more when within 10 rows of end
  
  // Pagination callback
  onNextPage: async (page, pageSize) => {
    // Fetch data from your server/API
    const response = await fetch(`/api/data?page=${page}&size=${pageSize}`);
    return await response.json();
  },
  
  // Optional: Previous page callback (for bi-directional scrolling)
  onPreviousPage: async (page, pageSize) => {
    // Implementation for loading previous pages
    return await fetchPreviousPage(page, pageSize);
  }
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `virtualScrolling` | boolean | `false` | Enable virtual scrolling |
| `pageSize` | number | `100` | Number of records per page |
| `totalRecords` | number | `data.length` | Total records available |
| `loadingThreshold` | number | `10` | Load next page when within N rows of end |
| `onNextPage` | function | `() => {}` | Callback for loading next page |
| `onPreviousPage` | function | `() => {}` | Callback for loading previous page |

## Pagination Callback

The `onNextPage` callback receives two parameters and should return a Promise:

```javascript
onNextPage: async (page, pageSize) => {
  // page: 0-based page number (0, 1, 2, ...)
  // pageSize: number of records requested
  
  try {
    const newData = await yourApiCall(page, pageSize);
    return newData; // Array of new records
  } catch (error) {
    throw error; // Will trigger error state with retry option
  }
}
```

### Return Values

- **Array**: New records to append to the table
- **Empty Array**: No more data available (stops loading)
- **Thrown Error**: Triggers error state with retry button

## Public API Methods

### Pagination Control

```javascript
// Reset to first page only
table.resetPagination();

// Set total record count
table.setTotalRecords(5000);

// Control whether more data is available
table.setHasMoreData(false);

// Manually append data
table.appendData(newRecords);
```

### Status Information

The info section automatically shows virtual scrolling status:
- `"150 loaded of 1000 records"`
- `"25 selected of 150 loaded (1000 total)"`
- `"75 filtered (150 loaded, 1000 total)"`

## Error Handling

When `onNextPage` throws an error:

1. Loading stops and error indicator appears
2. User can click "Retry" to attempt loading again
3. Error is logged to console for debugging

```javascript
onNextPage: async (page, pageSize) => {
  try {
    const response = await fetch(`/api/data?page=${page}&size=${pageSize}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to load page:', error);
    throw error; // Will show retry button
  }
}
```

## Best Practices

### 1. Appropriate Page Size
- **Small datasets** (< 1000): Use regular mode, not virtual scrolling
- **Medium datasets** (1000-10000): Page size 50-100
- **Large datasets** (> 10000): Page size 100-500

### 2. Loading Threshold
- **Fast networks**: Lower threshold (5-10 rows)
- **Slow networks**: Higher threshold (15-25 rows)
- **Mobile devices**: Higher threshold for better UX

### 3. Server-Side Implementation
```javascript
// Example server endpoint
app.get('/api/data', (req, res) => {
  const page = parseInt(req.query.page) || 0;
  const size = parseInt(req.query.size) || 100;
  const offset = page * size;
  
  const data = database.query(`
    SELECT * FROM users 
    ORDER BY id 
    LIMIT ${size} OFFSET ${offset}
  `);
  
  res.json(data);
});
```

### 4. Data Consistency
- Use consistent sorting on server side
- Handle concurrent modifications appropriately
- Consider using cursor-based pagination for real-time data

## Advanced Usage

### With Filtering and Sorting

Virtual scrolling works with queries and sorting, but requires server-side support:

```javascript
onNextPage: async (page, pageSize) => {
  const params = new URLSearchParams({
    page: page,
    size: pageSize,
    query: table.currentQuery,      // Current filter
    sortBy: table.sortColumn,       // Current sort column
    sortOrder: table.sortDirection  // Current sort direction
  });
  
  const response = await fetch(`/api/data?${params}`);
  return await response.json();
}
```

### With Grouping

When using grouping with virtual scrolling:
- Groups are created from currently loaded data
- New data is automatically included in existing groups
- Group statistics update as more data loads

### Custom Loading Indicators

You can customize the loading appearance with CSS:

```css
.loading-indicator {
  background: your-brand-color;
  /* Custom styling */
}

.loading-spinner {
  border-color: your-accent-color;
  /* Custom spinner */
}
```

## Demo

See `virtual-scrolling-demo.html` for a complete working example with:
- Simulated server responses
- Error handling demonstration
- Integration with grouping and filtering
- Realistic data generation

## Performance Tips

1. **Optimize server queries** with proper indexing
2. **Cache frequently accessed data** on the server
3. **Use appropriate page sizes** based on your data and network
4. **Implement proper error handling** for better user experience
5. **Consider prefetching** the next page for smoother scrolling

## Browser Support

Virtual scrolling works in all modern browsers that support:
- CSS Grid
- JavaScript Promises
- Intersection Observer (optional, for future enhancements)
