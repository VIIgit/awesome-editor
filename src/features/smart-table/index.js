import { createQueryEditor } from '../query-language';

/**
 * Sets up a smart table with query filtering, grouping, and sorting capabilities
 * @param {object} monaco The Monaco editor instance
 * @param {object} options Configuration options
 * @param {HTMLTableElement} options.table The table element to enhance
 * @param {object[]} options.data The data to display in the table
 * @param {object} options.columns Column definitions { field, header, render?, responsive? }
 * @param {object} options.editorContainer Container element for the Monaco editor
 * @param {boolean} options.showCheckboxes Whether to show selection checkboxes (default: true)
 * @param {boolean} options.multiSelect Whether to enable multi-selection (default: true)
 * @param {function} options.onSelectionChange Callback when selection changes (receives array with last selected first)
 * @returns {object} Object containing control methods
 */
export function setupSmartTable(monaco, { 
  table, 
  data, 
  columns, 
  editorContainer, 
  showCheckboxes = false, 
  multiSelect = true,
  onSelectionChange = null 
}) {
  let sortField = null;
  let sortDirection = 'asc';
  let groupByField = '';
  let selectedRows = new Set();
  let selectionOrder = []; // Track order of selection (last selected first)
  let lastClickedRowId = null; // Track last clicked row for range selection
  let collapsedGroups = new Set();
  let isNewGrouping = false; // Track if we just changed grouping field
  let filteredData = data; // Track currently filtered data
  let originalColumns = [...columns]; // Store original column order
  let currentColumns = [...columns]; // Track current column order

  // Check if we have a split table setup
  const headerTable = document.getElementById('header-table');
  const isSplitTable = headerTable && headerTable !== table;

  // Use header table for header, main table for body
  const tableForHeader = isSplitTable ? headerTable : table;
  const tableForBody = table;

  // Add CSS class to tables based on checkbox setting
  if (!showCheckboxes) {
    tableForHeader.classList.add('no-checkboxes');
    tableForBody.classList.add('no-checkboxes');
  }
  
  // Add CSS class for multi-select behavior
  if (!multiSelect) {
    tableForHeader.classList.add('no-multiselect');
    tableForBody.classList.add('no-multiselect');
  }

  // Set up the query language feature with the data fields
  const fieldNames = {};

  // Extract field definitions from the first data item and columns
  if (data.length > 0) {
    const sampleItem = data[0];
    Object.keys(sampleItem).forEach(field => {
      const fieldType = typeof sampleItem[field] === 'boolean' ? 'boolean' :
        typeof sampleItem[field] === 'number' ? 'number' : 'string';
      
      let fieldValues = undefined;
      if (fieldType === 'string') {
        // Get unique values, filtering out null/undefined and empty strings
        const uniqueValues = [...new Set(data.map(item => item[field]))];
        const definedValues = uniqueValues.filter(value => 
          value !== null && value !== undefined && value !== ''
        );
        
        // Check if there are any null/undefined/empty values in the data
        const hasUndefinedValues = uniqueValues.some(value => 
          value === null || value === undefined || value === ''
        );
        
        // Include a special keyword for searching null/undefined values
        fieldValues = hasUndefinedValues 
          ? [...definedValues, 'NULL'] 
          : definedValues;
      }
      
      fieldNames[field] = {
        type: fieldType,
        values: fieldValues
      };
    });
  }

  // Create query editor using the new modular approach
  const { editor, model } = createQueryEditor(monaco, editorContainer, {
    fieldNames,
    placeholder: 'Search or filter results... (e.g., age > 25 AND city = "New York")'
  });

  // Add the query-inputfield class for consistent styling
  editorContainer.classList.add('query-inputfield');

  // Manually trigger initial validation for the created model
  // This ensures validation is set up for our existing model
  setTimeout(() => {
    const value = model.getValue();
    // Trigger validation by simulating a content change
    if (value === '') {
      // For empty content, ensure we clear any previous markers
      monaco.editor.setModelMarkers(model, model.getLanguageId(), []);
    }
  }, 10);

  // Function to reorder columns based on grouping
  function updateColumnOrder() {
    if (groupByField) {
      // Move the grouped column to the first position
      const groupedColumn = originalColumns.find(col => col.field === groupByField);
      const otherColumns = originalColumns.filter(col => col.field !== groupByField);
      currentColumns = groupedColumn ? [groupedColumn, ...otherColumns] : [...originalColumns];
    } else {
      // Restore original column order when not grouping
      currentColumns = [...originalColumns];
    }
  }

  // Function to rebuild table headers
  function rebuildHeaders() {
    const targetTable = isSplitTable ? tableForHeader : tableForBody;
    const existingThead = targetTable.querySelector('thead');
    if (existingThead) {
      existingThead.remove();
    }

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    // Add select all header (conditionally)
    if (showCheckboxes) {
      const selectAllHeader = document.createElement('th');
      selectAllHeader.className = 'select-cell';
      const selectAllCheckbox = document.createElement('input');
      selectAllCheckbox.type = 'checkbox';
      selectAllCheckbox.className = 'row-checkbox';
      selectAllCheckbox.addEventListener('change', () => {
        if (selectAllCheckbox.checked) {
          // Select all filtered items
          filteredData.forEach(obj => {
            if (!selectedRows.has(obj.id)) {
              handleSelectionChange(obj.id, true);
            }
          });
        } else {
          // Deselect all items
          const idsToDeselect = [...selectedRows];
          idsToDeselect.forEach(id => {
            handleSelectionChange(id, false);
          });
        }
        renderAndSync(filteredData);
      });
      selectAllHeader.appendChild(selectAllCheckbox);
      headerRow.appendChild(selectAllHeader);
    }

    // Add column headers with responsive classes (including grouped column)
    currentColumns.forEach(({ field, header, responsive = {} }) => {
      const th = document.createElement('th');
      th.textContent = header;
      th.setAttribute('data-field', field);
      
      // Add special class for grouped column
      if (groupByField && field === groupByField) {
        th.classList.add('grouped-column-header');
      }
      
      // Add responsive classes
      if (responsive.priority) {
        th.classList.add(`col-priority-${responsive.priority}`);
      }
      if (responsive.size) {
        th.classList.add(`col-${responsive.size}`);
      }
      if (responsive.hideMobile) {
        th.classList.add('hidden-mobile');
      }
      if (responsive.hideSmall) {
        th.classList.add('hidden-small');
      }
      
      if (sortField === field) {
        th.className += ` sorted ${sortDirection}`;
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
          header.className = header.className.replace(/\ssorted\s|\sasc\s|\sdesc\s/g, '').trim();
        });
        th.className += ` sorted ${sortDirection}`;

        // Rerender with new sorting
        const filteredIds = filterObjects(data, model.getValue());
        renderAndSync(data.filter(obj => filteredIds.includes(obj.id)));
      });
      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    targetTable.appendChild(thead);
  }

  // Function to update all visual selection states
  function updateVisualSelectionStates() {
    // Update row visual states (for both with and without checkboxes)
    document.querySelectorAll('tbody tr:not(.group-header)').forEach(rowElement => {
      const rowId = parseInt(rowElement.getAttribute('data-row-id'));
      if (!isNaN(rowId)) {
        const isSelected = selectedRows.has(rowId);
        const isLastSelected = selectionOrder.length > 0 && selectionOrder[0] === rowId;
        
        if (isSelected) {
          rowElement.classList.add('selected');
          if (isLastSelected) {
            rowElement.classList.add('last-selected');
          } else {
            rowElement.classList.remove('last-selected');
          }
        } else {
          rowElement.classList.remove('selected', 'last-selected');
        }
      }
    });

    // Update checkbox states if checkboxes are enabled
    if (showCheckboxes) {
      document.querySelectorAll('.row-checkbox').forEach(checkbox => {
        const rowElement = checkbox.closest('tr');
        if (rowElement) {
          const rowId = parseInt(rowElement.getAttribute('data-row-id'));
          if (!isNaN(rowId)) {
            checkbox.checked = selectedRows.has(rowId);
          }
        }
      });
    }
  }

  // Function to update info section
  function updateInfoSection() {
    let infoSection = document.querySelector('.smart-table-info');
    if (!infoSection) {
      // Create info section if it doesn't exist
      infoSection = document.createElement('div');
      infoSection.className = 'smart-table-info';
      
      const wrapper = tableForBody.closest('.smart-table-wrapper');
      const headerContainer = wrapper.querySelector('.smart-table-header-container');
      wrapper.insertBefore(infoSection, headerContainer);
    }
    
    const totalOriginalRecords = data.length;
    const filteredRecords = filteredData.length;
    const selectedCount = selectedRows.size;
    
    let infoText = '';
    
    // Check if data is filtered
    if (filteredRecords < totalOriginalRecords) {
      infoText = `${filteredRecords} record${filteredRecords !== 1 ? 's' : ''}, filtered out of ${totalOriginalRecords} record${totalOriginalRecords !== 1 ? 's' : ''}`;
    } else {
      infoText = `${filteredRecords} record${filteredRecords !== 1 ? 's' : ''}`;
    }
    
    // Add selection information
    if (selectedCount > 0) {
      infoText += ` and ${selectedCount} ${selectedCount === 1 ? 'is' : 'are'} selected`;
    }
    
    infoSection.textContent = infoText;
    
    // Update select all checkbox state
    updateSelectAllCheckbox();
  }

  // Function to update select all checkbox state
  function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.querySelector('.smart-table-header .row-checkbox');
    if (selectAllCheckbox && showCheckboxes) {
      const totalFilteredRows = filteredData.length;
      const selectedFilteredRows = filteredData.filter(obj => selectedRows.has(obj.id)).length;
      
      if (selectedFilteredRows === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
      } else if (selectedFilteredRows === totalFilteredRows) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
      } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
      }
    }
  }

  // Function to handle selection changes
  function handleSelectionChange(rowId, isSelected, isRangeSelection = false) {
    if (isSelected) {
      if (!multiSelect && !isRangeSelection) {
        // Clear previous selections if multiSelect is disabled
        selectedRows.clear();
        selectionOrder = [];
      }
      selectedRows.add(rowId);
      // Add to beginning of array (last selected first)
      selectionOrder = [rowId, ...selectionOrder.filter(id => id !== rowId)];
    } else {
      selectedRows.delete(rowId);
      selectionOrder = selectionOrder.filter(id => id !== rowId);
    }
    
    updateInfoSection();
    updateVisualSelectionStates();
    
    // Trigger callback if provided
    if (onSelectionChange) {
      const selectedData = selectionOrder.map(id => 
        data.find(item => item.id === id)
      ).filter(Boolean);
      onSelectionChange(selectedData);
    }
  }

  // Function to handle range selection (Shift+click)
  function handleRangeSelection(targetRowId) {
    if (!lastClickedRowId) {
      // No previous selection, treat as single selection
      handleSelectionChange(targetRowId, true);
      lastClickedRowId = targetRowId;
      return;
    }

    // Get the visible rows in current order (filtered and sorted)
    const visibleRowIds = filteredData.map(obj => obj.id);
    const startIndex = visibleRowIds.indexOf(lastClickedRowId);
    const endIndex = visibleRowIds.indexOf(targetRowId);

    if (startIndex === -1 || endIndex === -1) {
      // Fallback to single selection if we can't find the range
      handleSelectionChange(targetRowId, true);
      lastClickedRowId = targetRowId;
      return;
    }

    // Select all rows in the range
    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);
    
    for (let i = minIndex; i <= maxIndex; i++) {
      const rowId = visibleRowIds[i];
      handleSelectionChange(rowId, true, true); // Mark as range selection
    }
    
    lastClickedRowId = targetRowId;
  }

  // Function to sort objects
  function sortObjects(objects) {
    const sorted = [...objects].sort((a, b) => {
      // If no sort field is set, maintain original order
      if (!sortField) return 0;

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

    return sorted;
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

    // Sort objects within each group if we're sorting by a non-grouped field
    if (sortField && sortField !== groupByField) {
      groups.forEach((groupObjects, key) => {
        groups.set(key, sortObjects(groupObjects));
      });
    }

    // Sort groups by key, respecting sort direction when sorting by grouped field
    const groupEntries = [...groups.entries()].sort(([a], [b]) => {
      if (a === 'N/A') return 1;
      if (b === 'N/A') return -1;
      
      const result = typeof a === 'string' ? a.localeCompare(b) : a - b;
      
      // If we're sorting by the grouped field, respect the sort direction
      if (sortField === groupByField) {
        return sortDirection === 'asc' ? result : -result;
      }
      
      // Otherwise, default to ascending order for groups
      return result;
    });

    return groupEntries;
  }

  // Function to render objects with grouping
  function renderObjects(filteredObjects) {
    const tbody = tableForBody.querySelector('tbody') || tableForBody.appendChild(document.createElement('tbody'));
    tbody.innerHTML = ''; // Clear previous rows

    if (!groupByField) {
      // No grouping - just sort and render
      const sortedObjects = sortObjects(filteredObjects);
      renderRows(sortedObjects, tbody);
      return;
    }

    // With grouping - groupObjects will handle sorting internally
    const groups = groupObjects(filteredObjects);

    groups.forEach(([groupValue, objects], groupIndex) => {
      // Only start with groups collapsed when it's a new grouping field
      if (isNewGrouping && !collapsedGroups.has(groupIndex)) {
        collapsedGroups.add(groupIndex);
      }

      // Add group header
      const groupHeader = document.createElement('tr');
      groupHeader.className = 'group-header';
      if (collapsedGroups.has(groupIndex)) {
        groupHeader.className += ' collapsed';
      }

      const groupCell = document.createElement('td');
      // Calculate colspan based on all columns (including empty grouped column + select column if present)
      const visibleColumnsCount = currentColumns.length;
      groupCell.colSpan = visibleColumnsCount + (showCheckboxes ? 1 : 0);
      
      // Apply the same render logic as the column for consistency
      const groupedColumn = currentColumns.find(col => col.field === groupByField);
      const renderedGroupValue = groupedColumn && groupedColumn.render 
        ? groupedColumn.render(groupValue) 
        : groupValue;
      
      // Show only the group value, not the redundant column name since it's in the header
      groupCell.innerHTML = `
        <span class="group-toggle"></span>
        ${renderedGroupValue} (${objects.length} items)
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

    // Reset the new grouping flag after rendering
    isNewGrouping = false;
  }

  // Function to render table rows
  function renderRows(objects, tbody, groupIndex = null) {
    objects.forEach((obj) => {
      const row = document.createElement('tr');
      row.setAttribute('data-row-id', obj.id); // Add row ID for selection tracking
      if (groupIndex !== null) {
        row.setAttribute('data-group', groupIndex);
        if (collapsedGroups.has(groupIndex)) {
          row.className = 'group-collapsed';
        }
      }

      // Add select checkbox (conditionally)
      if (showCheckboxes) {
        const selectCell = document.createElement('td');
        selectCell.className = 'select-cell';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'row-checkbox';
        checkbox.checked = selectedRows.has(obj.id);
        checkbox.addEventListener('change', () => {
          handleSelectionChange(obj.id, checkbox.checked);
        });
        selectCell.appendChild(checkbox);
        row.appendChild(selectCell);
      }

      // Enhanced multi-selection functionality
      row.addEventListener('click', (e) => {
        // Prevent default behavior for selection clicks
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
          e.preventDefault();
        }

        const isCurrentlySelected = selectedRows.has(obj.id);

        if (e.shiftKey && multiSelect) {
          // Shift+click: Range selection
          handleRangeSelection(obj.id);
        } else if (e.ctrlKey || e.metaKey) {
          // Ctrl/Cmd+click: Toggle selection
          handleSelectionChange(obj.id, !isCurrentlySelected);
          lastClickedRowId = obj.id;
        } else {
          // Regular click: Single selection (clear others)
          if (multiSelect) {
            // Clear all selections first
            const wasSelected = isCurrentlySelected;
            selectedRows.clear();
            selectionOrder = [];
            updateInfoSection();
            
            // Then select this one (unless it was the only one selected)
            if (!wasSelected || selectedRows.size > 1) {
              handleSelectionChange(obj.id, true);
            }
          } else {
            // Single select mode
            handleSelectionChange(obj.id, !isCurrentlySelected);
          }
          lastClickedRowId = obj.id;
        }

        // Update all visual states
        updateVisualSelectionStates();
      });

      // Add data cells with responsive classes (render grouped column cells as empty)
      currentColumns.forEach(({ field, render, responsive = {} }) => {
        const cell = document.createElement('td');
        
        // Render grouped column cells as empty since all values in the group are the same
        if (groupByField && field === groupByField) {
          cell.innerHTML = ''; // Empty content but cell structure maintained
          cell.classList.add('grouped-column-cell'); // Add special class for styling
        } else {
          cell.innerHTML = render ? render(obj[field], obj) : obj[field];
        }
        
        cell.setAttribute('data-field', field);
        
        // Add responsive classes to match the header
        if (responsive.priority) {
          cell.classList.add(`col-priority-${responsive.priority}`);
        }
        if (responsive.size) {
          cell.classList.add(`col-${responsive.size}`);
        }
        if (responsive.hideMobile) {
          cell.classList.add('hidden-mobile');
        }
        if (responsive.hideSmall) {
          cell.classList.add('hidden-small');
        }
        if (responsive.allowWrap) {
          cell.classList.add('flexible-text');
        }
        
        row.appendChild(cell);
      });

      // Apply visual selection state
      if (selectedRows.has(obj.id)) {
        row.classList.add('selected');
        // Check if this is the last selected row
        if (selectionOrder.length > 0 && selectionOrder[0] === obj.id) {
          row.classList.add('last-selected');
        }
      }

      tbody.appendChild(row);
    });
  }

  // Flag to prevent infinite synchronization loops
  let isSynchronizing = false;

  // Helper function to synchronize column widths after rendering (for split table mode)
  function synchronizeColumnWidths() {
    if (!isSplitTable || isSynchronizing) return;

    try {
      isSynchronizing = true;

      const headerTable = tableForHeader;
      const bodyTable = tableForBody;

      // Check if both tables are still in the DOM
      if (!headerTable.isConnected || !bodyTable.isConnected) {
        return;
      }

      const headerCells = headerTable.querySelectorAll('thead th');

      // Find the first data row (skip group headers)
      let firstBodyRow = bodyTable.querySelector('tbody tr:not(.group-header)');

      // If no regular rows, try to get any row
      if (!firstBodyRow) {
        firstBodyRow = bodyTable.querySelector('tbody tr');
      }

      if (firstBodyRow && headerCells.length > 0) {
        const bodyCells = firstBodyRow.querySelectorAll('td');

        // Get the container width to respect horizontal limits
        const containerWidth = bodyTable.closest('.smart-table-container').clientWidth;
        const headerContainerWidth = headerTable.closest('.smart-table-header-container').clientWidth;
        const availableWidth = Math.min(containerWidth, headerContainerWidth) - 20; // 20px for padding/margins

        // Remove any existing colgroups
        headerTable.querySelectorAll('colgroup').forEach(cg => cg.remove());
        bodyTable.querySelectorAll('colgroup').forEach(cg => cg.remove());

        // Define responsive column distribution based on actual columns and their metadata
        const columnConfig = [];
        headerCells.forEach((cell, index) => {
          if (index === 0) {
            // Select column - always fixed
            columnConfig.push({ min: 40, max: 50, flex: 0 });
          } else {
            // Find the corresponding column definition
            const fieldName = cell.getAttribute('data-field');
            const columnDef = columns.find(col => col.field === fieldName);
            
            if (columnDef && columnDef.responsive) {
              const { size } = columnDef.responsive;
              
              switch (size) {
                case 'fixed-narrow':
                  columnConfig.push({ min: 50, max: 80, flex: 0 });
                  break;
                case 'fixed-medium':
                  columnConfig.push({ min: 80, max: 120, flex: 0 });
                  break;
                case 'flexible-small':
                  columnConfig.push({ min: 100, max: 150, flex: 1 });
                  break;
                case 'flexible-medium':
                  columnConfig.push({ min: 120, max: 200, flex: 2 });
                  break;
                case 'flexible-large':
                  columnConfig.push({ min: 150, max: 300, flex: 3 });
                  break;
                default:
                  columnConfig.push({ min: 80, max: 150, flex: 1 });
              }
            } else {
              // Default configuration for columns without responsive metadata
              columnConfig.push({ min: 80, max: 150, flex: 1 });
            }
          }
        });

        // Calculate responsive column widths
        let totalFlexWidth = 0;
        let totalFixedWidth = 0;
        
        columnConfig.forEach(config => {
          if (config.flex === 0) {
            totalFixedWidth += config.min;
          } else {
            totalFlexWidth += config.flex;
            totalFixedWidth += config.min;
          }
        });

        const remainingWidth = Math.max(0, availableWidth - totalFixedWidth);
        const flexUnit = totalFlexWidth > 0 ? remainingWidth / totalFlexWidth : 0;

        const columnWidths = columnConfig.map(config => {
          if (config.flex === 0) {
            return config.min;
          } else {
            const flexWidth = config.min + (config.flex * flexUnit);
            return Math.min(Math.max(flexWidth, config.min), config.max);
          }
        });

        // Ensure total width doesn't exceed container
        const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0);
        if (totalWidth > availableWidth) {
          const scale = availableWidth / totalWidth;
          columnWidths.forEach((width, index) => {
            columnWidths[index] = Math.max(width * scale, columnConfig[index].min);
          });
        }

        // Create colgroup elements for both tables to enforce column widths
        const headerColgroup = document.createElement('colgroup');
        const bodyColgroup = document.createElement('colgroup');

        columnWidths.forEach((width, index) => {
          const headerCol = document.createElement('col');
          const bodyCol = document.createElement('col');
          headerCol.style.width = `${Math.round(width)}px`;
          bodyCol.style.width = `${Math.round(width)}px`;
          headerColgroup.appendChild(headerCol);
          bodyColgroup.appendChild(bodyCol);
        });

        // Insert colgroups at the beginning of tables
        headerTable.insertBefore(headerColgroup, headerTable.firstChild);
        bodyTable.insertBefore(bodyColgroup, bodyTable.firstChild);

        // Set table-layout to fixed for consistent behavior
        headerTable.style.tableLayout = 'fixed';
        bodyTable.style.tableLayout = 'fixed';
      }
    } catch (error) {
      console.warn('Error synchronizing column widths:', error);
    } finally {
      isSynchronizing = false;
    }
  }

  // Set up group by dropdown
  const groupBySelect = document.getElementById('group-by');
  if (groupBySelect) {
    // Only include columns that are marked as groupable
    originalColumns
      .filter(column => column.groupable === true)
      .forEach(({ field, header }) => {
        const option = document.createElement('option');
        option.value = field;
        option.textContent = header;
        groupBySelect.appendChild(option);
      });

    groupBySelect.addEventListener('change', () => {
      groupByField = groupBySelect.value;
      updateColumnOrder(); // Update column order based on grouping
      collapsedGroups.clear(); // Reset collapsed state
      isNewGrouping = true; // Mark as new grouping to start collapsed
      const filteredIds = filterObjects(data, model.getValue());
      renderAndSync(data.filter(obj => filteredIds.includes(obj.id)));
    });
  }

  // Wrapper function to render objects and synchronize column widths
  function renderAndSync(filteredObjects) {
    filteredData = filteredObjects;
    updateColumnOrder(); // Ensure column order is up to date
    rebuildHeaders(); // Rebuild headers with current column order
    renderObjects(filteredObjects);
    updateInfoSection();

    // Synchronize column widths after rendering for split table
    // Use a longer delay to ensure DOM is fully rendered
    if (isSplitTable) {
      setTimeout(() => synchronizeColumnWidths(), 100);
    }
  }

  // Parse and apply the query to filter objects
  function applyQuery(query) {
    try {
      const filteredIds = filterObjects(data, query);
      const filteredObjects = data.filter((obj) => filteredIds.includes(obj.id));
      renderAndSync(filteredObjects);

      return { error: null, count: filteredObjects.length };
    } catch (error) {
      renderAndSync(data); // Reset to show all objects
      return { error: error.message, count: data.length };
    }
  }

  // Initial render
  renderAndSync(data);

  // Function to check validation and update table
  function handleQueryChange() {
    const query = model.getValue();

    // Get validation markers
    const markers = monaco.editor.getModelMarkers({ resource: model.uri });
    const errors = markers.filter(marker =>
      marker.severity === monaco.MarkerSeverity.Error
    );

    if (errors.length === 0) {
      // No validation errors - apply the query and remove error class
      try {
        applyQuery(query);
        // Remove error class from the editor container
        editorContainer.classList.remove('error');
      } catch (error) {
        // Runtime error from query execution
        // Add error class to show the error state visually
        editorContainer.classList.add('error');
      }
    } else {
      // Has validation errors - add error class and don't filter
      editorContainer.classList.add('error');
    }
  }

  // Set up model change listener with proper validation handling
  let changeTimeout;
  model.onDidChangeContent(() => {
    // Clear previous timeout
    if (changeTimeout) {
      clearTimeout(changeTimeout);
    }

    // Debounce the change handling to allow validation to complete
    // Use 350ms to ensure it runs after the validation's 300ms debounce
    changeTimeout = setTimeout(handleQueryChange, 350);
  });

  // Also listen to marker changes for more responsive error handling
  monaco.editor.onDidChangeMarkers(([resource]) => {
    if (resource.toString() === model.uri.toString()) {
      // Clear timeout if we have a marker change event - markers have been updated
      if (changeTimeout) {
        clearTimeout(changeTimeout);
      }
      // Handle immediately since markers have been updated
      setTimeout(handleQueryChange, 10); // Small delay to ensure markers are fully processed
    }
  });

  // Set up sticky header shadow effect on scroll
  const tableContainer = tableForBody.closest('.smart-table-container');
  if (tableContainer && isSplitTable) {
    // For split tables, add shadow to the header container
    const headerContainer = tableForHeader.closest('.smart-table-header-container');
    const handleScroll = () => {
      if (tableContainer.scrollTop > 0) {
        if (headerContainer) {
          headerContainer.classList.add('scrolled');
        }
      } else {
        if (headerContainer) {
          headerContainer.classList.remove('scrolled');
        }
      }
    };

    tableContainer.addEventListener('scroll', handleScroll);

    // Store scroll handler for cleanup
    tableForBody._scrollHandler = handleScroll;
    tableForBody._scrollContainer = tableContainer;
  } else if (tableContainer) {
    // For single tables, use the existing logic
    const handleScroll = () => {
      if (tableContainer.scrollTop > 0) {
        tableContainer.classList.add('scrolled');
      } else {
        tableContainer.classList.remove('scrolled');
      }
    };

    tableContainer.addEventListener('scroll', handleScroll);

    // Store scroll handler for cleanup
    tableForBody._scrollHandler = handleScroll;
    tableForBody._scrollContainer = tableContainer;
  }

  // Set up resize observer for dynamic column width synchronization
  if (isSplitTable && window.ResizeObserver) {
    try {
      let resizeTimeout;
      const resizeObserver = new ResizeObserver((entries) => {
        // Debounce resize events to prevent excessive synchronization
        if (resizeTimeout) {
          clearTimeout(resizeTimeout);
        }

        resizeTimeout = setTimeout(() => {
          // Use requestAnimationFrame to avoid ResizeObserver loop errors
          requestAnimationFrame(() => {
            try {
              // Only synchronize if the table is still in the DOM
              if (tableForBody.isConnected && tableForHeader.isConnected) {
                synchronizeColumnWidths();
              }
            } catch (error) {
              console.warn('Error in resize observer callback:', error);
            }
          });
        }, 100); // 100ms debounce
      });

      // Add a small delay before observing to ensure DOM is ready
      setTimeout(() => {
        try {
          if (tableForBody.isConnected) {
            resizeObserver.observe(tableForBody);
            // Store observer for cleanup
            tableForBody._resizeObserver = resizeObserver;
          }
        } catch (error) {
          console.warn('Error setting up resize observer:', error);
        }
      }, 100);

    } catch (error) {
      console.warn('ResizeObserver not available or failed to initialize:', error);
    }

    // Return control methods
    return {
      editor,
      refresh: () => renderAndSync(data),
      filter: (query) => {
        model.setValue(query);

        // Check for validation errors before applying the query
        const markers = monaco.editor.getModelMarkers({ resource: model.uri });
        const hasErrors = markers.some(marker =>
          marker.severity === monaco.MarkerSeverity.Error
        );

        // Only apply the query if there are no errors
        if (!hasErrors) {
          editorContainer.classList.remove('error');
          return applyQuery(query);
        } else {
          editorContainer.classList.add('error');
          return data; // Return unfiltered data
        }
      },
      sort: (field, direction) => {
        sortField = field;
        sortDirection = direction || 'asc';
        const filteredIds = filterObjects(data, model.getValue());
        renderAndSync(data.filter(obj => filteredIds.includes(obj.id)));
      },
      group: (field) => {
        groupByField = field;
        updateColumnOrder(); // Update column order based on grouping
        const filteredIds = filterObjects(data, model.getValue());
        renderAndSync(data.filter(obj => filteredIds.includes(obj.id)));
      },
      getSelectedRows: () => selectionOrder.map(id => 
        data.find(item => item.id === id)
      ).filter(Boolean),
      getSelectedRowIds: () => [...selectionOrder],
      getSelectedCount: () => selectedRows.size,
      addRecord: (record) => {
        // Generate a new ID if not provided
        if (!record.id) {
          const maxId = Math.max(...data.map(item => item.id || 0));
          record.id = maxId + 1;
        }
        
        // Add the record to the data array
        data.push(record);
        
        // Apply current filter to refresh the table with new data
        const currentQuery = model.getValue();
        const filteredIds = filterObjects(data, currentQuery);
        const newFilteredData = data.filter(obj => filteredIds.includes(obj.id));
        
        // Update filtered data reference
        filteredData = newFilteredData;
        
        // Select the newly added record if it's visible after filtering
        if (filteredIds.includes(record.id)) {
          // If we have grouping enabled, expand the group containing the new record
          if (groupByField) {
            const recordGroupValue = record[groupByField];
            const groupKey = recordGroupValue === null || recordGroupValue === undefined ? 'N/A' : recordGroupValue;
            
            // Get the grouped data to find the group index
            const groups = groupObjects(newFilteredData);
            const groupIndex = groups.findIndex(([groupValue]) => groupValue === groupKey);
            
            // Expand the group if it exists and is currently collapsed
            if (groupIndex !== -1 && collapsedGroups.has(groupIndex)) {
              collapsedGroups.delete(groupIndex);
            }
          }
          
          // Re-render the table
          renderAndSync(newFilteredData);
          
          // Clear previous selections
          selectedRows.clear();
          selectionOrder = [];
          
          // Select the new record
          handleSelectionChange(record.id, true);
        } else {
          // Record is filtered out, just re-render without selecting
          renderAndSync(newFilteredData);
        }
        
        return record;
      },
      dispose: () => {
        // Clean up scroll event listener
        if (tableForBody._scrollHandler && tableForBody._scrollContainer) {
          tableForBody._scrollContainer.removeEventListener('scroll', tableForBody._scrollHandler);
          delete tableForBody._scrollHandler;
          delete tableForBody._scrollContainer;
        }

        // Clean up resize observer
        if (tableForBody._resizeObserver) {
          try {
            tableForBody._resizeObserver.disconnect();
          } catch (error) {
            console.warn('Error disconnecting resize observer:', error);
          }
          delete tableForBody._resizeObserver;
        }

        model.dispose();
        editor.dispose();
      }
    }
  }
}
// Helper function to filter objects based on query
function filterObjects(objects, query) {
  if (!query.trim()) return objects.map(obj => obj.id);

  // Detect if this is search mode or structured query mode
  const hasOperators = /[=!<>()]|(\bAND\b|\bOR\b|\bIN\b)/i.test(query);
  
  if (!hasOperators) {
    // Search mode: look for terms in any field values
    return searchObjects(objects, query);
  }

  // Structured query mode (existing logic)
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

// Helper function for search mode
function searchObjects(objects, searchTerms) {
  const terms = searchTerms.trim().toLowerCase().split(/\s+/).filter(term => term.length > 0);
  
  if (terms.length === 0) return objects.map(obj => obj.id);

  const results = [];
  
  for (const obj of objects) {
    // Convert all object values to searchable strings
    const searchableValues = Object.values(obj)
      .map(value => {
        if (value === null || value === undefined) return '';
        return String(value).toLowerCase();
      })
      .join(' ');

    // Check if all search terms are found in the searchable values
    const allTermsFound = terms.every(term => searchableValues.includes(term));
    
    if (allTermsFound) {
      results.push(obj.id);
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
      value: values.split(',').map(v => {
        const trimmed = v.trim().replace(/"/g, '');
        return trimmed === 'NULL' ? null : trimmed;
      })
    };
  }

  const match = condition.match(/(\w+)\s*(=|!=|>|<)\s*(.+)/i);
  if (match) {
    const [, field, operator, value] = match;
    let parsedValue = value.trim();

    // Handle quoted strings
    if (parsedValue.startsWith('"') && parsedValue.endsWith('"')) {
      parsedValue = parsedValue.slice(1, -1);
    }
    // Handle special values
    else if (parsedValue === 'NULL') {
      parsedValue = null;
    }
    else if (parsedValue.toLowerCase() === 'true') {
      parsedValue = true;
    }
    else if (parsedValue.toLowerCase() === 'false') {
      parsedValue = false;
    }
    // Handle numbers
    else if (!isNaN(parsedValue) && parsedValue !== '') {
      parsedValue = parseFloat(parsedValue);
    }
    // Otherwise keep as string

    return { field, operator, value: parsedValue };
  }

  throw new Error(`Invalid condition: ${condition}`);
}

// Helper function to apply conditions
function applyCondition(obj, { field, operator, value }) {
  // Handle missing field - treat as null/undefined
  const objValue = field in obj ? obj[field] : null;
  
  // Helper function to check if value is null/undefined/empty
  const isNullish = (val) => val === null || val === undefined || val === '';
  
  switch (operator) {
    case '=': 
      // Handle NULL comparison specially
      if (value === null) return isNullish(objValue);
      if (isNullish(objValue)) return false;
      return objValue == value;
      
    case '!=': 
      // Handle NULL comparison specially
      if (value === null) return !isNullish(objValue);
      if (isNullish(objValue)) return true;
      return objValue != value;
      
    case '>': 
      if (isNullish(objValue)) return false;
      return objValue > parseFloat(value);
      
    case '<': 
      if (isNullish(objValue)) return false;
      return objValue < parseFloat(value);
      
    case 'IN': 
      // Handle NULL in array specially
      if (value.includes(null)) {
        return isNullish(objValue) || value.includes(objValue);
      }
      if (isNullish(objValue)) return false;
      return value.includes(objValue);
      
    default: return false;
  }
}
