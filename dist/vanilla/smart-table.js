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
 * Sets up a smart table with query filtering capabilities
 * @param {object} monaco The Monaco editor instance
 * @param {object} options Configuration options
 * @param {HTMLTableElement} options.table The table element to enhance
 * @param {object[]} options.data The data to display in the table
 * @param {object} options.columns Column definitions { field, header, render? }
 * @param {object} options.editorContainer Container element for the Monaco editor
 * @returns {object} Object containing control methods
 */
function setupSmartTable(monaco, { table, data, columns, editorContainer }) {
  // Set up the query language feature with the data fields
  const fieldNames = {};
  
  // Extract field definitions from the first data item and columns
  if (data.length > 0) {
    const sampleItem = data[0];
    Object.keys(sampleItem).forEach(field => {
      fieldNames[field] = {
        type: typeof sampleItem[field] === 'boolean' ? 'boolean' :
              typeof sampleItem[field] === 'number' ? 'number' : 'string',
        // If we have unique values in the data, add them as suggestions
        values: typeof sampleItem[field] === 'string' ? 
                [...new Set(data.map(item => item[field]))] : undefined
      };
    });
  }

  // Initialize query language support
  const { languageId } = setupQueryLanguage(monaco, { fieldNames });

  // Create editor model
  const model = monaco.editor.createModel('', languageId);

  // Create editor instance
  const editor = monaco.editor.create(editorContainer, {
    model,
    language: languageId,
    theme: 'vs',
    lineNumbers: 'off',
    minimap: { enabled: false },
    scrollbar: { vertical: 'hidden', horizontal: 'hidden' },
    overviewRulerLanes: 0,
    lineDecorationsWidth: 0,
    lineNumbersMinChars: 0,
    folding: false,
    scrollBeyondLastLine: false,
    wordWrap: 'off',
    renderLineHighlight: 'none',
    overviewRulerBorder: false,
    automaticLayout: false,
    fixedOverflowWidgets: true,
    placeholder: 'Enter query to filter table (e.g., id > 5 AND active = true)',
    dimension: {
      width: undefined,
      height: 20
    }
  });

  // Function to render objects in the table
  function renderObjects(filteredObjects) {
    const tbody = table.querySelector('tbody') || table.appendChild(document.createElement('tbody'));
    tbody.innerHTML = ''; // Clear previous rows

    filteredObjects.forEach((obj) => {
      const row = document.createElement('tr');
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
    columns.forEach(({ header }) => {
      const th = document.createElement('th');
      th.textContent = header;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
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
