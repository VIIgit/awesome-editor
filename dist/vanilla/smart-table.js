/**
 * @license
 * smart-table feature for Awesome Editor
 * Adds table filtering capabilities using a query language
 * 
 * @version 0.1.1
 * @copyright (c) 2025 Awesome Editor Contributors
 * @license MIT License
 */

(function(monaco) {
            if (typeof monaco === 'undefined') {
              console.error('Monaco Editor must be loaded before the smart-table feature');
              return;
            }

            /**
 * Sets up a smart table with query filtering, grouping, and sorting capabilities
 * @param {object} monaco The Monaco editor instance
 * @param {object} options Configuration options
 * @param {HTMLTableElement} options.table The table element to enhance
 * @param {object[]} options.data The data to display in the table
 * @param {object} options.columns Column definitions { field, header, render? }
 * @param {object} options.editorContainer Container element for the Monaco editor
 * @returns {object} Object containing control methods
 */
function setupSmartTable(monaco, { table, data, columns, editorContainer }) {
  let sortField = null;
  let sortDirection = 'asc';
  let groupByField = '';
  let selectedRows = new Set();
  let collapsedGroups = new Set();

  // Set up the query language feature with the data fields
  const fieldNames = {};
  
  // Extract field definitions from the first data item and columns
  if (data.length > 0) {
    const sampleItem = data[0];
    Object.keys(sampleItem).forEach(field => {
      fieldNames[field] = {
        type: typeof sampleItem[field] === 'boolean' ? 'boolean' :
              typeof sampleItem[field] === 'number' ? 'number' : 'string',
        values: typeof sampleItem[field] === 'string' ? 
                [...new Set(data.map(item => item[field]))] : undefined
      };
    });
  }

  // Create query editor using the new modular approach
  const { editor, model } = createQueryEditor(monaco, editorContainer, {
    fieldNames,
    placeholder: 'Enter query to filter table (e.g., age > 25 AND city = "New York")'
  });

  // Function to sort objects
  function sortObjects(objects) {
    if (!sortField) return objects;

    return [...objects].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (aValue === bValue) return 0;
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      const result = typeof aValue === 'string' ? 
        aValue.localeCompare(bValue) : 
        aValue - bValue;

      return sortDirection === 'asc' ? result : -result;
    });
  }

  // Function to group objects
  function groupObjects(objects) {
    if (!groupByField) return objects;

    const groups = new Map();
    objects.forEach(obj => {
      const value = obj[groupByField];
      const key = value === null || value === undefined ? 'N/A' : value;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(obj);
    });

    // Sort groups by key
    return [...groups.entries()].sort(([a], [b]) => {
      if (a === 'N/A') return 1;
      if (b === 'N/A') return -1;
      return typeof a === 'string' ? a.localeCompare(b) : a - b;
    });
  }

  // Function to render objects with grouping
  function renderObjects(filteredObjects) {
    const tbody = table.querySelector('tbody') || table.appendChild(document.createElement('tbody'));
    tbody.innerHTML = ''; // Clear previous rows

    const sortedObjects = sortObjects(filteredObjects);
    const groups = groupObjects(sortedObjects);

    if (!groupByField) {
      renderRows(sortedObjects, tbody);
      return;
    }

    groups.forEach(([groupValue, objects], groupIndex) => {
      // Add group header
      const groupHeader = document.createElement('tr');
      groupHeader.className = 'group-header';
      if (collapsedGroups.has(groupIndex)) {
        groupHeader.className += ' collapsed';
      }

      const groupCell = document.createElement('td');
      groupCell.colSpan = columns.length + 1; // +1 for select column
      groupCell.innerHTML = `
        <span class="group-toggle"></span>
        ${groupByField}: ${groupValue} (${objects.length} items)
      `;

      groupHeader.appendChild(groupCell);
      tbody.appendChild(groupHeader);

      // Add group rows
      renderRows(objects, tbody, groupIndex);

      // Set up group toggle
      groupHeader.addEventListener('click', () => {
        const isCollapsed = collapsedGroups.has(groupIndex);
        if (isCollapsed) {
          collapsedGroups.delete(groupIndex);
          groupHeader.classList.remove('collapsed');
        } else {
          collapsedGroups.add(groupIndex);
          groupHeader.classList.add('collapsed');
        }

        const groupRows = tbody.querySelectorAll(`[data-group="${groupIndex}"]`);
        groupRows.forEach(row => {
          if (isCollapsed) {
            row.classList.remove('group-collapsed');
          } else {
            row.classList.add('group-collapsed');
          }
        });
      });
    });
  }

  // Function to render table rows
  function renderRows(objects, tbody, groupIndex = null) {
    objects.forEach((obj) => {
      const row = document.createElement('tr');
      if (groupIndex !== null) {
        row.setAttribute('data-group', groupIndex);
        if (collapsedGroups.has(groupIndex)) {
          row.className = 'group-collapsed';
        }
      }

      // Add select checkbox
      const selectCell = document.createElement('td');
      selectCell.className = 'select-cell';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'row-checkbox';
      checkbox.checked = selectedRows.has(obj.id);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          selectedRows.add(obj.id);
        } else {
          selectedRows.delete(obj.id);
        }
      });
      selectCell.appendChild(checkbox);
      row.appendChild(selectCell);

      // Add data cells
      columns.forEach(({ field, render }) => {
        const cell = document.createElement('td');
        cell.innerHTML = render ? render(obj[field], obj) : obj[field];
        row.appendChild(cell);
      });

      tbody.appendChild(row);
    });
  }

  // Create table header if it doesn't exist
  if (!table.querySelector('thead')) {
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    // Add select all header
    const selectAllHeader = document.createElement('th');
    selectAllHeader.className = 'select-cell';
    const selectAllCheckbox = document.createElement('input');
    selectAllCheckbox.type = 'checkbox';
    selectAllCheckbox.className = 'row-checkbox';
    selectAllCheckbox.addEventListener('change', () => {
      const filteredIds = filterObjects(data, model.getValue());
      if (selectAllCheckbox.checked) {
        filteredIds.forEach(id => selectedRows.add(id));
      } else {
        selectedRows.clear();
      }
      renderObjects(data.filter(obj => filteredIds.includes(obj.id)));
    });
    selectAllHeader.appendChild(selectAllCheckbox);
    headerRow.appendChild(selectAllHeader);

    // Add column headers
    columns.forEach(({ field, header }) => {
      const th = document.createElement('th');
      th.textContent = header;
      if (sortField === field) {
        th.className = `sorted ${sortDirection}`;
      }
      th.addEventListener('click', () => {
        if (sortField === field) {
          sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          sortField = field;
          sortDirection = 'asc';
        }
        
        // Update header classes
        headerRow.querySelectorAll('th').forEach(header => {
          header.className = header.className.replace(/sorted|asc|desc/g, '').trim();
        });
        th.className = `sorted ${sortDirection}`;

        // Rerender with new sorting
        const filteredIds = filterObjects(data, model.getValue());
        renderObjects(data.filter(obj => filteredIds.includes(obj.id)));
      });
      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Set up group by dropdown
    const groupBySelect = document.getElementById('group-by');
    if (groupBySelect) {
      columns.forEach(({ field, header }) => {
        const option = document.createElement('option');
        option.value = field;
        option.textContent = header;
        groupBySelect.appendChild(option);
      });

      groupBySelect.addEventListener('change', () => {
        groupByField = groupBySelect.value;
        collapsedGroups.clear(); // Reset collapsed state
        const filteredIds = filterObjects(data, model.getValue());
        renderObjects(data.filter(obj => filteredIds.includes(obj.id)));
      });
    }
  }

  // Parse and apply the query to filter objects
  function applyQuery(query) {
    try {
      const filteredIds = filterObjects(data, query);
      const filteredObjects = data.filter((obj) => filteredIds.includes(obj.id));
      renderObjects(filteredObjects);
      return { error: null, count: filteredObjects.length };
    } catch (error) {
      renderObjects(data); // Reset to show all objects
      return { error: error.message, count: data.length };
    }
  }

  // Initial render
  renderObjects(data);

  // Set up model change listener
  model.onDidChangeContent(() => {
    const query = model.getValue();
    applyQuery(query);
  });

  // Return control methods
  return {
    editor,
    refresh: () => renderObjects(data),
    filter: (query) => {
      model.setValue(query);
      return applyQuery(query);
    },
    sort: (field, direction) => {
      sortField = field;
      sortDirection = direction || 'asc';
      const filteredIds = filterObjects(data, model.getValue());
      renderObjects(data.filter(obj => filteredIds.includes(obj.id)));
    },
    group: (field) => {
      groupByField = field;
      const filteredIds = filterObjects(data, model.getValue());
      renderObjects(data.filter(obj => filteredIds.includes(obj.id)));
    },
    getSelectedRows: () => [...selectedRows],
    dispose: () => {
      model.dispose();
      editor.dispose();
    }
  };
}

// Helper function to filter objects based on query
function filterObjects(objects, query) {
  if (!query.trim()) return objects.map(obj => obj.id);
  
  const results = [];
  for (const obj of objects) {
    try {
      if (evaluateExpression(obj, query)) {
        results.push(obj.id);
      }
    } catch (error) {
      throw new Error(`Query error: ${error.message}`);
    }
  }
  return results;
}

// Helper function to evaluate expression (imported from query-language)
function evaluateExpression(obj, expression) {
  if (!expression.trim()) return true;
  
  // Remove extra spaces
  expression = expression.replace(/\s+/g, ' ').trim();

  // Process the innermost parentheses first
  while (/\(([^()]+)\)/.test(expression)) {
    expression = expression.replace(/\(([^()]+)\)/g, (match, innerExpr) => {
      return processGroup(obj, innerExpr) ? 'true' : 'false';
    });
  }

  return processGroup(obj, expression);
}

// Helper function to process condition groups
function processGroup(obj, group) {
  const orConditions = group.split(/\s+OR\s+/);

  return orConditions.some((conditionGroup) => {
    const andConditions = conditionGroup.split(/\s+AND\s+/);

    return andConditions.every((condition) => {
      if (condition.trim().toLowerCase() === 'false') return false;
      if (condition.trim().toLowerCase() === 'true') return true;

      try {
        const parsedCondition = parseCondition(condition);
        return applyCondition(obj, parsedCondition);
      } catch (error) {
        throw new Error(`Invalid condition: ${condition}`);
      }
    });
  });
}

// Helper function to parse conditions
function parseCondition(condition) {
  const inMatch = condition.match(/(\w+)\s+IN\s+\[([^\]]+)\]/);
  if (inMatch) {
    const [, field, values] = inMatch;
    return {
      field,
      operator: 'IN',
      value: values.split(',').map(v => v.trim().replace(/"/g, ''))
    };
  }

  const match = condition.match(/(\w+)\s*(=|!=|>|<)\s*(\d+|".*"|true|false)/i);
  if (match) {
    const [, field, operator, value] = match;
    let parsedValue = value.replace(/"/g, '');

    if (parsedValue.toLowerCase() === 'true') parsedValue = true;
    else if (parsedValue.toLowerCase() === 'false') parsedValue = false;
    else if (!isNaN(parsedValue)) parsedValue = parseFloat(parsedValue);

    return { field, operator, value: parsedValue };
  }

  throw new Error(`Invalid condition: ${condition}`);
}

// Helper function to apply conditions
function applyCondition(obj, { field, operator, value }) {
  if (!(field in obj)) return false;

  const objValue = obj[field];
  switch (operator) {
    case '=': return objValue == value;
    case '!=': return objValue != value;
    case '>': return objValue > parseFloat(value);
    case '<': return objValue < parseFloat(value);
    case 'IN': return value.includes(objValue);
    default: return false;
  }
}

            // Expose feature to global scope
            window.awesomeEditor = window.awesomeEditor || {};
            window.awesomeEditor['smart-table'] = {
              setupSmartTable
            };
          })(window.monaco);
