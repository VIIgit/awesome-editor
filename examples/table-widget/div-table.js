/**
 * DivTable - A modern table widget using CSS Grid and Flexbox instead of HTML tables
 * Provides the same functionality as SmartTable but with a more flexible div-based layout
 */
class DivTable {
  constructor(monaco, options) {
    this.monaco = monaco;
    this.options = options;
    this.data = options.data || [];
    this.columns = options.columns || [];
    this.showCheckboxes = options.showCheckboxes !== false;
    this.multiSelect = options.multiSelect !== false;
    this.onSelectionChange = options.onSelectionChange || (() => {});
    this.onRowFocus = options.onRowFocus || (() => {});
    
    // Virtual scrolling options
    this.virtualScrolling = options.virtualScrolling || false;
    this.pageSize = options.pageSize || 100;
    this.totalRecords = options.totalRecords || this.data.length;
    this.onNextPage = options.onNextPage || (() => {});
    this.onPreviousPage = options.onPreviousPage || (() => {});
    this.loadingThreshold = options.loadingThreshold || Math.floor(this.pageSize * 0.8); // Default: 80% of page size
    this.scrollThreshold = options.scrollThreshold || 0.95; // Fallback for percentage-based logic
    
    // Internal state
    this.filteredData = [...this.data];
    this.sortColumn = null;
    this.sortDirection = 'asc';
    this.groupByField = null;
    this.collapsedGroups = new Set();
    this.selectedRows = new Set();
    this.focusedRowId = null;
    this.currentQuery = '';
    this._lastFocusCallback = { rowId: null, groupKey: null }; // Track last focus callback to prevent duplicates
    
    // Virtual scrolling state
    this.currentPage = 0;
    this.isLoading = false;
    this.hasMoreData = true;
    this.estimatedRowHeight = 40; // Default row height for calculations
    this.visibleStartIndex = 0;
    this.visibleEndIndex = this.pageSize;
    
    // Find primary key field first
    this.primaryKeyField = this.columns.find(col => col.primaryKey)?.field || 'id';
    
    // Initialize QueryEngine like in smart-table with primary key field
    this.queryEngine = new QueryEngine(this.data, this.primaryKeyField);
    
    // Initialize the widget
    this.init();
  }

  init() {
    const container = this.options.tableWidgetElement;
    if (!container) {
      console.error('DivTable: tableWidgetElement is required');
      return;
    }

    // Set up container classes
    if (!this.showCheckboxes) {
      container.classList.add('no-checkboxes');
    }
    if (!this.multiSelect) {
      container.classList.add('no-multiselect');
    }

    // Create the table structure
    this.createTableStructure(container);
    
    // Set up query editor
    this.setupQueryEditor();
    
    // Initial render
    this.render();
    
    // Set up keyboard navigation
    this.setupKeyboardNavigation();
  }

  getOrderedColumns() {
    // Filter out hidden columns first
    let visibleColumns = this.columns.filter(col => !col.hidden);
    
    if (!this.groupByField) {
      return visibleColumns;
    }
    
    // When grouping, move the grouped column to second position (after checkbox)
    const orderedColumns = [...visibleColumns];
    const groupedColumnIndex = orderedColumns.findIndex(col => col.field === this.groupByField);
    
    if (groupedColumnIndex > 0) {
      // Remove the grouped column from its current position
      const [groupedColumn] = orderedColumns.splice(groupedColumnIndex, 1);
      // Insert it at position 0 (first visible column after checkbox)
      orderedColumns.unshift(groupedColumn);
    }
    
    return orderedColumns;
  }

  getAllColumns() {
    // Returns all columns including hidden ones - useful for data operations
    return this.columns;
  }

  createTableStructure(container) {
    // Find or create toolbar
    this.toolbar = container.querySelector('.div-table-toolbar');
    if (!this.toolbar) {
      this.toolbar = document.createElement('div');
      this.toolbar.className = 'div-table-toolbar';
      container.appendChild(this.toolbar);
    }

    // Create toolbar elements if they don't exist
    this.createToolbarElements();

    // Create main table container
    this.tableContainer = document.createElement('div');
    this.tableContainer.className = 'div-table-container';
    container.appendChild(this.tableContainer);

    // Create header
    this.headerContainer = document.createElement('div');
    this.headerContainer.className = 'div-table-header';
    this.tableContainer.appendChild(this.headerContainer);

    // Create body
    this.bodyContainer = document.createElement('div');
    this.bodyContainer.className = 'div-table-body';
    this.tableContainer.appendChild(this.bodyContainer);

    // Set up scroll shadow effect
    this.setupScrollShadow();
  }

  createToolbarElements() {
    // Create query input container if it doesn't exist
    let queryContainer = this.toolbar.querySelector('.query-input-container');
    if (!queryContainer) {
      queryContainer = document.createElement('div');
      queryContainer.className = 'query-input-container';
      queryContainer.setAttribute('tabindex', '0');
      this.toolbar.appendChild(queryContainer);
    }


    // Create info section if it doesn't exist
    let infoSection = this.toolbar.querySelector('.info-section');
    if (!infoSection) {
      infoSection = document.createElement('div');
      infoSection.className = 'info-section';
      this.toolbar.appendChild(infoSection);
    }

    // Store references
    this.infoSection = infoSection;
  }

  setupScrollShadow() {
    this.bodyContainer.addEventListener('scroll', () => {
      if (this.bodyContainer.scrollTop > 0) {
        this.headerContainer.classList.add('scrolled');
      } else {
        this.headerContainer.classList.remove('scrolled');
      }
      
      // Handle virtual scrolling if enabled
      if (this.virtualScrolling && !this.isLoading) {
        this.handleVirtualScroll();
      }
    });
  }

  setupQueryEditor() {
    const queryContainer = this.toolbar.querySelector('.query-input-container');
    if (!queryContainer) return;

    queryContainer.className = 'query-input-container query-inputfield';
    
    // Set up Monaco editor for query input with proper field type analysis like smart-table
    const fieldNames = {};
    if (this.data.length > 0) {
      const sampleItem = this.data[0];
      Object.keys(sampleItem).forEach(field => {
        const fieldType = typeof sampleItem[field] === 'boolean' ? 'boolean'
          : typeof sampleItem[field] === 'number' ? 'number'
            : 'string';

        let fieldValues;
        if (fieldType === 'string') {
          const uniqueValues = [...new Set(this.data.map(item => item[field]))];
          const definedValues = uniqueValues.filter(value =>
            value !== null && value !== undefined && value !== ''
          );
          const hasUndefinedValues = uniqueValues.some(value =>
            value === null || value === undefined || value === ''
          );
          fieldValues = hasUndefinedValues
            ? [...definedValues, 'NULL']
            : definedValues;
        }
        fieldNames[field] = { type: fieldType, values: fieldValues };
      });
    }

    if (typeof createQueryEditor === 'function') {
      this.queryEditor = createQueryEditor(this.monaco, queryContainer, {
        fieldNames,
        initialValue: this.currentQuery,
        placeholder: 'Filter data... (e.g., age > 25 AND city = "New York")'
      });

      // Clear any initial markers if the editor starts empty (like in smart-table)
      setTimeout(() => {
        const value = this.queryEditor.model?.getValue();
        if (value === '') {
          this.monaco.editor.setModelMarkers(this.queryEditor.model, this.queryEditor.model.getLanguageId(), []);
        }
      }, 10);

      // Set up proper query change handling with error detection like smart-table
      if (this.queryEditor.model) {
        this.queryEditor.model.onDidChangeContent(() => {
          const query = this.queryEditor.model.getValue();
          this.handleQueryChange(query);
        });
      }

      // Set up additional query listeners with debouncing like smart-table
      this._setupQueryListeners();
    }
  }

  handleQueryChange(query) {
    // If no query parameter provided, get it from the model (for debounced calls)
    if (typeof query === 'undefined') {
      query = this.queryEditor.model?.getValue() || '';
    }
    
    // Get Monaco editor markers to check for errors
    const model = this.queryEditor.editor?.getModel();
    if (model) {
      const markers = this.monaco.editor.getModelMarkers({ resource: model.uri });
      const hasErrors = markers.some(m => m.severity === this.monaco.MarkerSeverity.Error);
      
      const queryContainer = this.toolbar.querySelector('.query-input-container');
      if (!hasErrors) {
        queryContainer.classList.remove('error');
        this.applyQuery(query);
      } else {
        queryContainer.classList.add('error');
      }
    } else {
      // Fallback if no Monaco model available
      this.applyQuery(query);
    }
  }

  _setupQueryListeners() {
    // Also check on content changes with debouncing
    let errorTimeout;
    this.queryEditor.model.onDidChangeContent(() => {
      if (errorTimeout) clearTimeout(errorTimeout);
      errorTimeout = setTimeout(() => this.handleQueryChange(), 350);
    });
  }

  setupKeyboardNavigation() {
    this.bodyContainer.addEventListener('keydown', (e) => {
      this.handleKeyDown(e);
    });

    this.bodyContainer.addEventListener('focus', () => {
      if (!this.focusedRowId) {
        this.focusFirstRecord();
      }
    });
  }

  getCurrentFocusedElement() {
    // Get the actually focused element in the browser
    const activeElement = document.activeElement;
    
    // Check if it's a checkbox in our table
    if (activeElement && activeElement.type === 'checkbox') {
      const row = activeElement.closest('.div-table-row');
      if (row && this.bodyContainer.contains(row)) {
        return { element: activeElement, row: row, type: 'checkbox' };
      }
    }
    
    // Check if it's a row in our table
    if (activeElement && activeElement.classList.contains('div-table-row')) {
      if (this.bodyContainer.contains(activeElement)) {
        return { element: activeElement, row: activeElement, type: 'row' };
      }
    }
    
    return null;
  }

  getFocusableElementForRow(row) {
    // Find the element that should receive browser focus for this row
    if (this.showCheckboxes) {
      // When checkboxes are enabled, focus the checkbox
      const checkbox = row.querySelector('input[type="checkbox"]');
      if (checkbox) {
        return checkbox;
      }
    }
    // When no checkboxes or no checkbox found, focus the row itself (for non-checkbox tables)
    return row;
  }

  handleKeyDown(e) {
    const focusableElements = this.getAllFocusableElements();
    if (focusableElements.length === 0) return;

    // Get the currently focused element
    const currentFocus = this.getCurrentFocusedElement();
    if (!currentFocus) return;

    let currentIndex = focusableElements.indexOf(currentFocus.element);
    if (currentIndex === -1) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.focusElementAtIndex(Math.min(currentIndex + 1, focusableElements.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.focusElementAtIndex(Math.max(currentIndex - 1, 0));
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.handleRightArrow(currentFocus.row);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        this.handleLeftArrow(currentFocus.row);
        break;
      case ' ':
      case 'Enter':
        e.preventDefault();
        this.handleSelectionToggleForElement(currentFocus);
        break;
    }
  }

  getAllFocusableElements() {
    // Get all elements that can receive focus (checkboxes or rows)
    const focusableElements = [];
    const allRows = Array.from(this.bodyContainer.querySelectorAll('.div-table-row'));
    
    for (const row of allRows) {
      if (row.classList.contains('group-header')) {
        if (this.showCheckboxes) {
          const checkbox = row.querySelector('input[type="checkbox"]');
          if (checkbox && checkbox.getAttribute('tabindex') === '0') {
            focusableElements.push(checkbox);
          }
        } else {
          // For group headers without checkboxes, always include the row
          focusableElements.push(row);
        }
      } else if (row.dataset.id) {
        // For data rows, check if they're visible
        const groupKey = this.getRowGroupKey(row);
        const isVisible = !groupKey || !this.collapsedGroups.has(groupKey);
        
        if (isVisible) {
          if (this.showCheckboxes) {
            const checkbox = row.querySelector('input[type="checkbox"]');
            if (checkbox && checkbox.getAttribute('tabindex') === '0') {
              focusableElements.push(checkbox);
            }
          } else {
            // For rows without checkboxes, always include the row
            focusableElements.push(row);
          }
        }
      }
    }
    
    return focusableElements;
  }

  focusElementAtIndex(index) {
    const focusableElements = this.getAllFocusableElements();
    if (index >= 0 && index < focusableElements.length) {
      const element = focusableElements[index];
      element.focus();
      
      // Update our internal focus tracking
      const row = element.closest('.div-table-row');
      if (row) {
        this.updateFocusState(row);
      }
    }
  }

  updateFocusState(row) {
    // Clear previous focus classes
    const previousFocused = this.bodyContainer.querySelectorAll('.div-table-row.focused');
    previousFocused.forEach(r => r.classList.remove('focused'));
    
    // Set new focus
    row.classList.add('focused');
    
    if (row.classList.contains('group-header')) {
      this.focusedRowId = null;
      this.focusedGroupKey = row.dataset.groupKey;
      
      // Only trigger callback if this is a different group than last time
      if (this._lastFocusCallback.groupKey !== row.dataset.groupKey) {
        this._lastFocusCallback = { rowId: null, groupKey: row.dataset.groupKey };
        
        const groups = this.groupData(this.filteredData);
        const group = groups.find(g => g.key === row.dataset.groupKey);
        if (group) {
          const groupColumn = this.columns.find(col => col.field === this.groupByField);
          const groupInfo = {
            key: group.key,
            value: group.value,
            field: this.groupByField,
            label: groupColumn?.label || this.groupByField,
            itemCount: group.items.length
          };
          this.onRowFocus(undefined, groupInfo);
        }
      }
    } else if (row.dataset.id) {
      this.focusedRowId = row.dataset.id;
      this.focusedGroupKey = null;
      
      // Only trigger callback if this is a different row than last time
      if (this._lastFocusCallback.rowId !== row.dataset.id) {
        this._lastFocusCallback = { rowId: row.dataset.id, groupKey: null };
        
        const rowData = this.findRowData(row.dataset.id);
        this.onRowFocus(rowData, undefined);
      }
    }
  }

  handleSelectionToggleForElement(focusInfo) {
    const row = focusInfo.row;
    
    if (row.classList.contains('group-header')) {
      // Toggle group selection
      this.toggleGroupSelection(row);
    } else if (row.dataset.id) {
      // Toggle individual row selection
      this.toggleIndividualRowSelection(row);
    }
  }

  handleRightArrow(focusedRow) {
    // Right arrow: expand group if focused on a collapsed group header
    if (focusedRow && focusedRow.classList.contains('group-header') && focusedRow.classList.contains('collapsed')) {
      const groupKey = focusedRow.dataset.groupKey;
      this.collapsedGroups.delete(groupKey);
      focusedRow.classList.remove('collapsed');
      
      // Store the group key to restore focus after render
      const groupToRefocus = { key: groupKey };
      this.render();
      
      // Restore focus to the same group header
      this.restoreGroupFocus(groupToRefocus);
    }
  }

  handleLeftArrow(focusedRow) {
    // Left arrow: collapse group if focused on an expanded group header
    if (focusedRow && focusedRow.classList.contains('group-header') && !focusedRow.classList.contains('collapsed')) {
      const groupKey = focusedRow.dataset.groupKey;
      this.collapsedGroups.add(groupKey);
      focusedRow.classList.add('collapsed');
      
      // Store the group key to restore focus after render
      const groupToRefocus = { key: groupKey };
      this.render();
      
      // Restore focus to the same group header
      this.restoreGroupFocus(groupToRefocus);
    }
  }

  restoreGroupFocus(groupToRefocus) {
    // Find and restore focus to the group header after render
    const groupRow = this.bodyContainer.querySelector(`[data-group-key="${groupToRefocus.key}"]`);
    if (groupRow) {
      // Focus the appropriate element (checkbox or row)
      if (this.showCheckboxes) {
        const checkbox = groupRow.querySelector('input[type="checkbox"]');
        if (checkbox) {
          checkbox.focus();
        }
      } else {
        groupRow.focus();
      }
      
      // Update our internal focus tracking
      this.updateFocusState(groupRow);
    }
  }

  getVisibleRows() {
    return Array.from(this.bodyContainer.querySelectorAll('.div-table-row[data-id]:not(.group-header):not(.group-collapsed)'));
  }

  getAllFocusableRows() {
    // Include group headers and data rows, but exclude rows from collapsed groups
    const allRows = Array.from(this.bodyContainer.querySelectorAll('.div-table-row'));
    const focusableRows = [];
    
    for (const row of allRows) {
      if (row.classList.contains('group-header')) {
        // Always include group headers
        focusableRows.push(row);
      } else if (row.dataset.id) {
        // For data rows, check if their group is collapsed
        const groupKey = this.getRowGroupKey(row);
        if (!groupKey || !this.collapsedGroups.has(groupKey)) {
          // Include row if it's not in a collapsed group
          focusableRows.push(row);
        }
      }
    }
    
    return focusableRows;
  }

  getRowGroupKey(row) {
    // Find the group key for a data row by looking at preceding group headers
    let currentElement = row.previousElementSibling;
    while (currentElement) {
      if (currentElement.classList.contains('group-header')) {
        return currentElement.dataset.groupKey;
      }
      currentElement = currentElement.previousElementSibling;
    }
    return null;
  }

  focusRow(index) {
    // This method is now replaced by focusElementAtIndex for consistency
    // but kept for backward compatibility
    const focusableElements = this.getAllFocusableElements();
    if (index >= 0 && index < focusableElements.length) {
      this.focusElementAtIndex(index);
    }
  }

  focusFirstRecord() {
    const rows = this.getAllFocusableRows();
    if (rows.length > 0) {
      this.focusRow(0);
    }
  }

  setFocusedRow(rowId, skipCheckboxFocus = false) {
    // Remove previous focus
    this.bodyContainer.querySelectorAll('.div-table-row.focused').forEach(row => {
      row.classList.remove('focused');
    });

    if (rowId) {
      const row = this.bodyContainer.querySelector(`[data-id="${rowId}"]`);
      if (row) {
        row.classList.add('focused');
        row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        // If the row has a checkbox and we're not skipping focus, focus it to sync tabIndex navigation
        if (!skipCheckboxFocus) {
          const checkbox = row.querySelector('input[type="checkbox"]');
          if (checkbox && document.activeElement !== checkbox) {
            checkbox.focus();
          }
        }
        
        // Only trigger callback if this is a different row than last time
        if (this._lastFocusCallback.rowId !== rowId) {
          this._lastFocusCallback = { rowId: rowId, groupKey: null };
          
          const rowData = this.findRowData(rowId);
          this.onRowFocus(rowData);
        }
      }
    }

    this.focusedRowId = rowId;
  }

  setFocusedGroup(group) {
    // Remove previous focus from both rows and groups
    this.bodyContainer.querySelectorAll('.div-table-row.focused').forEach(row => {
      row.classList.remove('focused');
    });

    // Clear focused row ID since we're focusing a group
    this.focusedRowId = null;

    // Add focus to the group header
    const groupRow = this.bodyContainer.querySelector(`[data-group-key="${group.key}"]`);
    if (groupRow) {
      groupRow.classList.add('focused');
      groupRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      
      // Create group info for the callback
      const groupColumn = this.columns.find(col => col.field === this.groupByField);
      const groupInfo = {
        key: group.key,
        value: group.value,
        field: this.groupByField,
        label: groupColumn?.label || this.groupByField,
        itemCount: group.items.length
      };
      
      // Trigger focus callback with row=undefined and group info
      this.onRowFocus(undefined, groupInfo);
    }
  }

  findRowData(rowId) {
    // First try to find in the current filteredData
    let result = this.filteredData.find(item => 
      String(item[this.primaryKeyField]) === String(rowId)
    );
    
    // If not found in filteredData, search in the original data
    // This ensures we can always find the data even if there are timing issues
    if (!result) {
      result = this.data.find(item => 
        String(item[this.primaryKeyField]) === String(rowId)
      );
    }
    
    return result;
  }

  handleSelectionToggle(currentIndex) {
    const rows = this.getAllFocusableRows();
    if (currentIndex < 0 || currentIndex >= rows.length) return;

    const row = rows[currentIndex];
    
    if (row.classList.contains('group-header')) {
      // Toggle group selection
      this.toggleGroupSelection(row);
    } else if (row.dataset.id) {
      // Toggle individual row selection
      this.toggleIndividualRowSelection(row);
    }
  }

  toggleGroupSelection(groupRow) {
    const groupKey = groupRow.dataset.groupKey;
    const groups = this.groupData(this.filteredData);
    const group = groups.find(g => g.key === groupKey);
    
    if (!group) return;
    
    // Check current selection state of the group
    const groupItemIds = group.items.map(item => String(item[this.primaryKeyField]));
    const selectedInGroup = groupItemIds.filter(id => this.selectedRows.has(id));
    const shouldSelect = selectedInGroup.length < groupItemIds.length;
    
    // Toggle all items in the group
    group.items.forEach(item => {
      const itemId = String(item[this.primaryKeyField]);
      if (shouldSelect) {
        this.selectedRows.add(itemId);
        item.selected = true;
      } else {
        this.selectedRows.delete(itemId);
        item.selected = false;
      }
    });
    
    // Update visual states
    this.updateSelectionStates();
    this.updateInfoSection();
    
    // Trigger selection change callback
    this.onSelectionChange(Array.from(this.selectedRows).map(id => this.findRowData(id)).filter(Boolean));
  }

  toggleIndividualRowSelection(row) {
    const rowId = row.dataset.id;
    if (!rowId) {
      console.warn('DivTable: Row missing data-id attribute');
      return;
    }
    
    const rowData = this.findRowData(rowId);
    if (!rowData) {
      console.warn('DivTable: Could not find data for row ID:', rowId);
      return;
    }

    const isSelected = this.selectedRows.has(rowId);
    
    if (isSelected) {
      this.selectedRows.delete(rowId);
      rowData.selected = false;
      row.classList.remove('selected');
    } else {
      if (!this.multiSelect) {
        this.clearSelection();
      }
      this.selectedRows.add(rowId);
      rowData.selected = true;
      row.classList.add('selected');
    }
    
    // Update visual states
    this.updateSelectionStates();
    this.updateInfoSection();
    
    // Trigger selection change callback with verified data
    const selectedData = Array.from(this.selectedRows)
      .map(id => this.findRowData(id))
      .filter(Boolean);
    
    this.onSelectionChange(selectedData);
  }

  toggleRowSelection(index) {
    const rows = this.getVisibleRows();
    if (index < 0 || index >= rows.length) return;

    const row = rows[index];
    const rowId = row.dataset.id;
    const rowData = this.findRowData(rowId);
    
    if (!rowData) return;

    const isSelected = this.selectedRows.has(rowId);
    
    if (isSelected) {
      this.selectedRows.delete(rowId);
      rowData.selected = false;
      row.classList.remove('selected');
    } else {
      if (!this.multiSelect) {
        this.clearSelection();
      }
      this.selectedRows.add(rowId);
      rowData.selected = true;
      row.classList.add('selected');
    }

    this.updateCheckboxes();
    this.onSelectionChange(Array.from(this.selectedRows).map(id => this.findRowData(id)).filter(Boolean));
  }

  clearSelection() {
    this.selectedRows.clear();
    this.filteredData.forEach(item => item.selected = false);
    this.updateSelectionStates();
    this.updateInfoSection();
  }

  updateCheckboxes() {
    this.bodyContainer.querySelectorAll('.div-table-row[data-id] input[type="checkbox"]').forEach(checkbox => {
      const rowId = checkbox.closest('.div-table-row').dataset.id;
      checkbox.checked = this.selectedRows.has(rowId);
    });
  }

  updateSelectionStates() {
    // Update individual row selection states
    this.bodyContainer.querySelectorAll('.div-table-row[data-id]').forEach(row => {
      const rowId = row.dataset.id;
      const checkbox = row.querySelector('input[type="checkbox"]');
      
      if (this.selectedRows.has(rowId)) {
        row.classList.add('selected');
        if (checkbox) checkbox.checked = true;
      } else {
        row.classList.remove('selected');
        if (checkbox) checkbox.checked = false;
      }
    });

    // Update group header checkbox states
    if (this.groupByField) {
      const groups = this.groupData(this.sortData(this.filteredData));
      
      this.bodyContainer.querySelectorAll('.div-table-row.group-header').forEach((groupRow) => {
        const checkbox = groupRow.querySelector('input[type="checkbox"]');
        if (!checkbox) return;

        // Find the group by matching the groupKey instead of relying on index
        const groupKey = groupRow.dataset.groupKey;
        const group = groups.find(g => g.key === groupKey);
        if (!group) return;

        // Calculate selection state for this group
        const groupItemIds = group.items.map(item => String(item[this.primaryKeyField]));
        const selectedInGroup = groupItemIds.filter(id => this.selectedRows.has(id));

        if (selectedInGroup.length === 0) {
          checkbox.checked = false;
          checkbox.indeterminate = false;
        } else if (selectedInGroup.length === groupItemIds.length) {
          checkbox.checked = true;
          checkbox.indeterminate = false;
        } else {
          checkbox.checked = false;
          checkbox.indeterminate = true;
        }
      });
    }

    // Update main header checkbox state
    this.updateHeaderCheckbox();
  }

  updateHeaderCheckbox() {
    const headerCheckbox = this.headerContainer.querySelector('input[type="checkbox"]');
    if (!headerCheckbox) return;

    const totalItems = this.filteredData.length;
    const selectedItems = this.filteredData.filter(item => 
      this.selectedRows.has(String(item[this.primaryKeyField]))
    ).length;

    if (selectedItems === 0) {
      headerCheckbox.checked = false;
      headerCheckbox.indeterminate = false;
    } else if (selectedItems === totalItems) {
      headerCheckbox.checked = true;
      headerCheckbox.indeterminate = false;
    } else {
      headerCheckbox.checked = false;
      headerCheckbox.indeterminate = true;
    }
  }

  updateTabIndexes() {
    // Update tabindex for checkboxes only, not rows
    const allRows = Array.from(this.bodyContainer.querySelectorAll('.div-table-row'));
    
    for (const row of allRows) {
      if (row.classList.contains('group-header')) {
        if (this.showCheckboxes) {
          // For group headers with checkboxes, make the checkbox focusable
          const checkbox = row.querySelector('input[type="checkbox"]');
          if (checkbox) {
            checkbox.setAttribute('tabindex', '0');
          }
        }
      } else if (row.dataset.id) {
        // For data rows, check if their group is collapsed
        const groupKey = this.getRowGroupKey(row);
        const isVisible = !groupKey || !this.collapsedGroups.has(groupKey);
        
        if (this.showCheckboxes) {
          // When checkboxes are enabled, make the checkbox focusable if visible
          const checkbox = row.querySelector('input[type="checkbox"]');
          if (checkbox) {
            checkbox.setAttribute('tabindex', isVisible ? '0' : '-1');
          }
        }
      }
    }
  }

  render() {
    this.renderHeader();
    this.renderBody();
    this.updateInfoSection();
    this.updateSelectionStates();
    this.updateTabIndexes(); // Update tab navigation order
    
    // Verify data consistency in development mode
    if (typeof process === 'undefined' || process.env.NODE_ENV !== 'production') {
      setTimeout(() => this.verifyDataConsistency(), 0);
    }
  }

  renderHeader() {
    this.headerContainer.innerHTML = '';
    
    const orderedColumns = this.getOrderedColumns();
    
    // Calculate total columns
    const totalColumns = this.showCheckboxes ? orderedColumns.length + 1 : orderedColumns.length;
    // Set grid template based on actual columns
    let gridTemplate = '';
    if (this.showCheckboxes) {
      gridTemplate = '40px '; // Checkbox column
    }
    
    // Add column templates
    orderedColumns.forEach(col => {
      const responsive = col.responsive || {};
      switch (responsive.size) {
        case 'fixed-narrow':
          gridTemplate += '80px ';
          break;
        case 'fixed-medium':
          gridTemplate += '120px ';
          break;
        case 'flexible-small':
          gridTemplate += '1fr ';
          break;
        case 'flexible-medium':
          gridTemplate += '2fr ';
          break;
        case 'flexible-large':
          gridTemplate += '3fr ';
          break;
        default:
          gridTemplate += '1fr ';
      }
    });
    
    this.headerContainer.style.gridTemplateColumns = gridTemplate.trim();

    // Checkbox column header
    if (this.showCheckboxes) {
      const checkboxCell = document.createElement('div');
      checkboxCell.className = 'div-table-header-cell checkbox-column';
      
      if (this.multiSelect) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.addEventListener('change', (e) => {
          if (e.target.checked || e.target.indeterminate) {
            // If checked or indeterminate, select all
            this.selectAll();
          } else {
            // If unchecked, clear selection
            this.clearSelection();
          }
        });
        checkboxCell.appendChild(checkbox);
      }
      
      this.headerContainer.appendChild(checkboxCell);
    }

    // Column headers
    orderedColumns.forEach(col => {
      const headerCell = document.createElement('div');
      headerCell.className = 'div-table-header-cell sortable';
      
      // Create header content with label and indicators
      const headerContent = document.createElement('span');
      headerContent.textContent = col.label || col.field;
      headerCell.appendChild(headerContent);
      
      // Add groupable indicator if column is groupable
      if (col.groupable !== false && !col.hidden) {
        const groupIndicator = document.createElement('span');
        groupIndicator.className = 'group-indicator';
        if (this.groupByField === col.field) {
          groupIndicator.classList.add('grouped');
        }
        groupIndicator.textContent = this.groupByField === col.field ? '☴' : '☷';
        groupIndicator.style.cursor = 'pointer';
        const columnTitle = col.label || col.field;
        groupIndicator.title = this.groupByField === col.field ? `Grouped by ${columnTitle} (click to ungroup)` : `Click to group by ${columnTitle}`;
        
        // Add click handler for grouping
        groupIndicator.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent triggering sort
          if (this.groupByField === col.field) {
            // If already grouped by this column, remove grouping
            this.group('');
          } else {
            // Group by this column
            this.group(col.field);
          }
        });
        
        headerCell.appendChild(groupIndicator);
      }
      
      if (this.sortColumn === col.field) {
        headerCell.classList.add('sorted', this.sortDirection);
      }

      headerCell.addEventListener('click', (e) => {
        // Only sort if not clicking on group indicator
        if (!e.target.classList.contains('group-indicator')) {
          this.sort(col.field);
        }
      });

      this.headerContainer.appendChild(headerCell);
    });
  }

  renderBody() {
    this.bodyContainer.innerHTML = '';

    if (this.filteredData.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'div-table-empty';
      emptyState.textContent = 'No data to display';
      this.bodyContainer.appendChild(emptyState);
      return;
    }

    if (this.groupByField) {
      this.renderGroupedRows();
    } else {
      this.renderRegularRows();
    }
  }

  renderRegularRows() {
    const sortedData = this.sortData(this.filteredData);
    
    sortedData.forEach(item => {
      const row = this.createRow(item);
      this.bodyContainer.appendChild(row);
    });
  }

  renderGroupedRows() {
    let groups = this.groupData(this.filteredData);
    
    // If sorting by the grouped column, sort the groups themselves
    if (this.sortColumn === this.groupByField) {
      groups = groups.sort((a, b) => {
        if (a.value == null && b.value == null) return 0;
        
        // For undefined/null values in group sorting:
        // - In ASC: nulls go to top (return -1 for null a, 1 for null b)  
        // - In DESC: nulls go to bottom (return 1 for null a, -1 for null b)
        if (a.value == null) return this.sortDirection === 'asc' ? -1 : 1;
        if (b.value == null) return this.sortDirection === 'asc' ? 1 : -1;
        
        let result = 0;
        if (typeof a.value === 'number' && typeof b.value === 'number') {
          result = a.value - b.value;
        } else {
          result = String(a.value).localeCompare(String(b.value));
        }
        
        return this.sortDirection === 'desc' ? -result : result;
      });
    }
    
    groups.forEach(group => {
      // Sort items within each group (unless sorting by grouped column, then no need to sort items)
      if (this.sortColumn !== this.groupByField) {
        group.items = this.sortData(group.items);
      }
      
      // Group header
      const groupHeader = this.createGroupHeader(group);
      this.bodyContainer.appendChild(groupHeader);
      
      // Group rows (if not collapsed)
      if (!this.collapsedGroups.has(group.key)) {
        group.items.forEach(item => {
          const row = this.createRow(item);
          this.bodyContainer.appendChild(row);
        });
      }
    });
  }

  createRow(item) {
    const row = document.createElement('div');
    row.className = 'div-table-row';
    row.dataset.id = item[this.primaryKeyField];
    // Don't set tabindex here - will be managed by updateTabIndexes() based on checkbox presence
    
    const orderedColumns = this.getOrderedColumns();
    
    // Use the same grid template as header
    const totalColumns = this.showCheckboxes ? orderedColumns.length + 1 : orderedColumns.length;
    
    // Set the same grid template as header
    let gridTemplate = '';
    if (this.showCheckboxes) {
      gridTemplate = '40px '; // Checkbox column
    }
    
    // Add column templates
    orderedColumns.forEach(col => {
      const responsive = col.responsive || {};
      switch (responsive.size) {
        case 'fixed-narrow':
          gridTemplate += '80px ';
          break;
        case 'fixed-medium':
          gridTemplate += '120px ';
          break;
        case 'flexible-small':
          gridTemplate += '1fr ';
          break;
        case 'flexible-medium':
          gridTemplate += '2fr ';
          break;
        case 'flexible-large':
          gridTemplate += '3fr ';
          break;
        default:
          gridTemplate += '1fr ';
      }
    });
    
    row.style.gridTemplateColumns = gridTemplate.trim();

    // Selection state
    const rowId = String(item[this.primaryKeyField]);
    if (this.selectedRows.has(rowId)) {
      row.classList.add('selected');
    }
    if (this.focusedRowId === rowId) {
      row.classList.add('focused');
    }

    // Checkbox column
    if (this.showCheckboxes) {
      const checkboxCell = document.createElement('div');
      checkboxCell.className = 'div-table-cell checkbox-column';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = this.selectedRows.has(rowId);
      
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        
        // Verify that the row data exists before proceeding
        const rowData = this.findRowData(rowId);
        if (!rowData) {
          console.warn('DivTable: Could not find data for row ID:', rowId);
          return;
        }
        
        if (checkbox.checked) {
          if (!this.multiSelect) this.clearSelection();
          this.selectedRows.add(rowId);
          rowData.selected = true;
          row.classList.add('selected');
        } else {
          this.selectedRows.delete(rowId);
          rowData.selected = false;
          row.classList.remove('selected');
        }
        
        // Update all checkbox states (group and header)
        this.updateSelectionStates();
        this.updateInfoSection();
        
        // Ensure we only return valid data objects
        const selectedData = Array.from(this.selectedRows)
          .map(id => this.findRowData(id))
          .filter(Boolean);
        
        this.onSelectionChange(selectedData);
      });
      
      // Sync checkbox focus with row focus
      checkbox.addEventListener('focus', (e) => {
        this.updateFocusState(row);
      });
      
      checkbox.addEventListener('blur', (e) => {
        // Optionally handle blur if needed - for now, keep row focused
        // This allows arrow key navigation to continue working
      });
      
      checkboxCell.appendChild(checkbox);
      
      // Make the entire checkbox cell clickable
      checkboxCell.addEventListener('click', (e) => {
        // If clicked on the checkbox itself, let it handle naturally
        if (e.target === checkbox) return;
        
        // If clicked elsewhere in the cell, toggle the checkbox
        e.stopPropagation();
        checkbox.click();
      });
      
      row.appendChild(checkboxCell);
    }

    // Data columns
    this.getOrderedColumns().forEach(col => {
      const cell = document.createElement('div');
      cell.className = 'div-table-cell';
      
      // For grouped column, show empty
      if (this.groupByField && col.field === this.groupByField) {
        cell.classList.add('grouped-column');
        cell.textContent = '';
      } else {
        // Regular column rendering
        if (typeof col.render === 'function') {
          cell.innerHTML = col.render(item[col.field], item);
        } else {
          cell.textContent = item[col.field] ?? '';
        }
      }
      
      row.appendChild(cell);
    });

    // Row click handler - set focus index for clicked row
    row.addEventListener('click', (e) => {
      // Only handle focus if not clicking on checkbox column
      if (e.target.closest('.checkbox-column')) return;
      
      // Check if user is making a text selection
      const selection = window.getSelection();
      if (selection.toString().length > 0) {
        return; // Don't trigger focus if user is selecting text
      }
      
      // Find the focusable element for this row
      const focusableElement = this.getFocusableElementForRow(row);
      if (focusableElement) {
        // Check if this row already has focus
        const currentFocused = this.getCurrentFocusedElement();
        if (currentFocused === focusableElement) {
          return; // Don't trigger focus event if already focused
        }
        
        // Get all focusable elements and find the index of this element
        const focusableElements = this.getAllFocusableElements();
        const focusIndex = focusableElements.indexOf(focusableElement);
        
        if (focusIndex !== -1) {
          // Use the existing focus system to set focus to this index
          this.focusElementAtIndex(focusIndex);
        }
      }
    });

    // Row focus event to sync with tabIndex navigation
    row.addEventListener('focus', (e) => {
      this.updateFocusState(row);
    });

    return row;
  }

  createGroupHeader(group) {
    const groupRow = document.createElement('div');
    groupRow.className = 'div-table-row group-header';
    groupRow.dataset.groupKey = group.key; // Store group key for identification
    
    const orderedColumns = this.getOrderedColumns();
    
    // Use the same grid template as header
    let gridTemplate = '';
    if (this.showCheckboxes) {
      gridTemplate = '40px '; // Checkbox column
    }
    
    // Add column templates
    orderedColumns.forEach(col => {
      const responsive = col.responsive || {};
      switch (responsive.size) {
        case 'fixed-narrow':
          gridTemplate += '80px ';
          break;
        case 'fixed-medium':
          gridTemplate += '120px ';
          break;
        case 'flexible-small':
          gridTemplate += '1fr ';
          break;
        case 'flexible-medium':
          gridTemplate += '2fr ';
          break;
        case 'flexible-large':
          gridTemplate += '3fr ';
          break;
        default:
          gridTemplate += '1fr ';
      }
    });
    
    groupRow.style.gridTemplateColumns = gridTemplate.trim();
    
    if (this.collapsedGroups.has(group.key)) {
      groupRow.classList.add('collapsed');
    }

    // Checkbox column for group (if enabled)
    if (this.showCheckboxes) {
      const checkboxCell = document.createElement('div');
      checkboxCell.className = 'div-table-cell checkbox-column';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      
      // Determine checkbox state based on group items
      const groupItemIds = group.items.map(item => String(item[this.primaryKeyField]));
      const selectedInGroup = groupItemIds.filter(id => this.selectedRows.has(id));
      
      if (selectedInGroup.length === 0) {
        checkbox.checked = false;
        checkbox.indeterminate = false;
      } else if (selectedInGroup.length === groupItemIds.length) {
        checkbox.checked = true;
        checkbox.indeterminate = false;
      } else {
        checkbox.checked = false;
        checkbox.indeterminate = true;
      }
      
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        const shouldSelect = checkbox.checked;
        
        // Select/deselect all items in the group
        group.items.forEach(item => {
          const itemId = String(item[this.primaryKeyField]);
          if (shouldSelect) {
            this.selectedRows.add(itemId);
            item.selected = true;
          } else {
            this.selectedRows.delete(itemId);
            item.selected = false;
          }
        });
        
        // Update visual states for all rows
        this.updateSelectionStates();
        this.updateInfoSection();
        
        // Trigger selection change callback
        this.onSelectionChange(Array.from(this.selectedRows).map(id => this.findRowData(id)).filter(Boolean));
      });
      
      // Add focus handler for group header checkbox
      checkbox.addEventListener('focus', (e) => {
        this.updateFocusState(groupRow);
      });
      
      checkboxCell.appendChild(checkbox);
      groupRow.appendChild(checkboxCell);
    }

    // Group label cell (spans remaining columns)
    const cell = document.createElement('div');
    cell.className = 'div-table-cell';
    cell.style.gridColumn = this.showCheckboxes ? '2 / -1' : '1 / -1'; // Span from after checkbox to end
    
    const toggleBtn = document.createElement('span');
    toggleBtn.className = 'group-toggle';
    
    const groupColumn = this.columns.find(col => col.field === this.groupByField);
    const groupLabel = groupColumn?.label || this.groupByField;
    
    // Use render function if available, otherwise use raw value
    let renderedGroupValue;
    if (group.value == null || group.value === '') {
      // Handle undefined/null/empty values
      renderedGroupValue = `${groupLabel} is undefined`;
    } else if (groupColumn && typeof groupColumn.render === 'function') {
      renderedGroupValue = groupColumn.render(group.value, null); // No specific row data for group headers
    } else {
      renderedGroupValue = group.value;
    }
    
    cell.appendChild(toggleBtn);
    
    // Create a span for the group text that can handle HTML
    const textSpan = document.createElement('span');
    textSpan.innerHTML = `${renderedGroupValue} (${group.items.length} items)`;
    cell.appendChild(textSpan);
    
    groupRow.appendChild(cell);

    // Group toggle click handler - only handles expand/collapse
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent event bubbling to group row
      
      if (this.collapsedGroups.has(group.key)) {
        this.collapsedGroups.delete(group.key);
        groupRow.classList.remove('collapsed');
      } else {
        this.collapsedGroups.add(group.key);
        groupRow.classList.add('collapsed');
      }
      this.render();
      
      // After render, restore focus
      setTimeout(() => {
        const newGroupRow = this.bodyContainer.querySelector(`[data-group-key="${group.key}"]`);
        if (newGroupRow) {
          const focusableElement = this.getFocusableElementForRow(newGroupRow);
          if (focusableElement) {
            const focusableElements = this.getAllFocusableElements();
            const focusIndex = focusableElements.indexOf(focusableElement);
            if (focusIndex !== -1) {
              this.focusElementAtIndex(focusIndex);
            }
          }
        }
      }, 0);
    });

    // Group header click handler - only handles focus
    groupRow.addEventListener('click', (e) => {
      // Skip if clicking on checkbox column (checkbox handles its own logic)
      if (e.target.closest('.checkbox-column')) return;
      
      // Check if user is making a text selection
      const selection = window.getSelection();
      if (selection.toString().length > 0) {
        return; // Don't trigger focus if user is selecting text
      }
      
      // Set focus for any click on the group row
      const focusableElement = this.getFocusableElementForRow(groupRow);
      if (focusableElement) {
        // Check if this group row already has focus
        const currentFocused = this.getCurrentFocusedElement();
        if (currentFocused === focusableElement) {
          return; // Don't trigger focus event if already focused
        }
        
        const focusableElements = this.getAllFocusableElements();
        const focusIndex = focusableElements.indexOf(focusableElement);
        if (focusIndex !== -1) {
          this.focusElementAtIndex(focusIndex);
        }
      }
    });

    // Group header focus event to sync with tabIndex navigation
    groupRow.addEventListener('focus', (e) => {
      this.updateFocusState(groupRow);
    });

    return groupRow;
  }

  groupData(data) {
    const groups = new Map();
    
    data.forEach(item => {
      const value = item[this.groupByField];
      const key = value ?? '__null__';
      
      if (!groups.has(key)) {
        groups.set(key, { key, value, items: [] });
      }
      groups.get(key).items.push(item);
    });

    return Array.from(groups.values()).sort((a, b) => {
      if (a.value == null) return 1;
      if (b.value == null) return -1;
      return String(a.value).localeCompare(String(b.value));
    });
  }

  sortData(data) {
    if (!this.sortColumn) return data;
    
    return [...data].sort((a, b) => {
      const aVal = a[this.sortColumn];
      const bVal = b[this.sortColumn];
      
      if (aVal == null && bVal == null) return 0;
      
      // For undefined/null values:
      // - In ASC: nulls go to top (return -1 for null a, 1 for null b)
      // - In DESC: nulls go to bottom (return 1 for null a, -1 for null b)
      if (aVal == null) return this.sortDirection === 'asc' ? -1 : 1;
      if (bVal == null) return this.sortDirection === 'asc' ? 1 : -1;
      
      let result = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        result = aVal - bVal;
      } else {
        result = String(aVal).localeCompare(String(bVal));
      }
      
      return this.sortDirection === 'desc' ? -result : result;
    });
  }

  selectAll() {
    this.selectedRows.clear();
    this.filteredData.forEach(item => {
      const rowId = String(item[this.primaryKeyField]);
      this.selectedRows.add(rowId);
      item.selected = true;
    });
    this.updateSelectionStates();
    this.updateInfoSection();
    this.onSelectionChange(Array.from(this.selectedRows).map(id => this.findRowData(id)).filter(Boolean));
  }

  updateInfoSection() {
    if (!this.infoSection) return;
    
    const total = this.virtualScrolling ? this.totalRecords : this.data.length;
    const loaded = this.data.length;
    const filtered = this.filteredData.length;
    const selected = this.selectedRows.size;
    
    // Clear existing content
    this.infoSection.innerHTML = '';
    
    // First line: Selection info (only show when there are selections)
    if (selected > 0) {
      const selectionLine = document.createElement('div');
      selectionLine.className = 'info-line';
      
      const selectionInfo = document.createElement('span');
      selectionInfo.className = 'info-selection';
      selectionInfo.textContent = `${selected} selected`;
      
      selectionLine.appendChild(selectionInfo);
      this.infoSection.appendChild(selectionLine);
    }
    
    // Second line: Stats (always shown) - smaller font
    const statsLine = document.createElement('div');
    statsLine.className = 'info-line secondary';
    
    const statsInfo = document.createElement('span');
    statsInfo.className = 'info-stats';
    
    let statsText = '';
    if (this.virtualScrolling) {
      // Virtual scrolling mode
      if (filtered < loaded) {
        // Has filtering applied
        if (loaded < total) {
          // Filtered and still loading: "2 filtered (15% of 13 total)"
          const loadPercentage = Math.round((loaded / total) * 100);
          statsText = `${filtered} filtered (${loadPercentage}% of ${total} total)`;
        } else {
          // Filtered and fully loaded: "2 filtered (13 total)"
          statsText = `${filtered} filtered (${total} total)`;
        }
      } else {
        // No filtering
        if (loaded < total) {
          const percentage = Math.round((loaded / total) * 100);
          statsText = `${percentage}% of ${total} total`;
        } else {
          statsText = `${total} total`;
        }
      }
    } else {
      // Regular mode
      if (filtered < total) {
        // Simple filtered format: "2 filtered (13 total)"
        statsText = `${filtered} filtered (${total} total)`;
      } else {
        statsText = `${total} total`;
      }
    }
    
    statsInfo.textContent = statsText;
    statsLine.appendChild(statsInfo);
    this.infoSection.appendChild(statsLine);
    
    // Third line: Visual progress bar
    this.createProgressBar(loaded, total, filtered);
  }

  createProgressBar(loaded, total, filtered) {
    const progressLine = document.createElement('div');
    progressLine.className = 'progress-line';
    
    // Show progress bar for loading or filtering states
    if ((this.virtualScrolling && loaded < total) || filtered < total) {
      const progressContainer = document.createElement('div');
      progressContainer.className = 'loading-progress';
      
      // When both filtered and loading, show layered progress bars
      if (this.virtualScrolling && loaded < total && filtered < loaded) {
        // Filtered + Loading state: show both layers
        const filteredPercentage = (filtered / total) * 100;
        const loadedPercentage = (loaded / total) * 100;
        
        // Background loading bar (transparent animated)
        const loadingBar = document.createElement('div');
        loadingBar.className = 'loading-progress-bar loading-layer';
        loadingBar.style.width = `${loadedPercentage}%`;
        
        // Foreground filtered bar (solid)
        const filteredBar = document.createElement('div');
        filteredBar.className = 'loading-progress-bar filtered-layer';
        filteredBar.style.width = `${filteredPercentage}%`;
        
        progressContainer.appendChild(loadingBar);
        progressContainer.appendChild(filteredBar);
        progressContainer.setAttribute('data-state', 'filtered-loading');
      } else if (this.virtualScrolling && loaded < total) {
        // Loading only
        const percentage = (loaded / total) * 100;
        const progressBar = document.createElement('div');
        progressBar.className = 'loading-progress-bar';
        progressBar.style.width = `${percentage}%`;
        progressContainer.appendChild(progressBar);
        progressContainer.setAttribute('data-state', 'loading');
      } else if (filtered < total) {
        // Filtered only
        const percentage = (filtered / total) * 100;
        const progressBar = document.createElement('div');
        progressBar.className = 'loading-progress-bar';
        progressBar.style.width = `${percentage}%`;
        progressContainer.appendChild(progressBar);
        progressContainer.setAttribute('data-state', 'filtered');
      }
      
      progressLine.appendChild(progressContainer);
      this.infoSection.appendChild(progressLine);
    }
  }

  // Public API methods
  applyQuery(query) {
    this.currentQuery = query;
    
    // Update Monaco editor value to match the applied query
    if (this.queryEditor?.editor) {
      const currentValue = this.queryEditor.editor.getValue();
      if (currentValue !== query) {
        this.queryEditor.editor.setValue(query);
      }
    }
    
    if (!query.trim()) {
      this.filteredData = [...this.data];
    } else {
      try {
        // Use QueryEngine like in smart-table for proper query parsing
        const filteredIds = this.queryEngine.filterObjects(query);
        this.filteredData = this.data.filter(obj => filteredIds.includes(obj[this.primaryKeyField]));
      } catch (error) {
        console.error('Query error:', error);
        this.filteredData = [...this.data];
      }
    }
    
    this.render();
  }

  sort(field, direction) {
    if (this.sortColumn === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = field;
      this.sortDirection = direction || 'asc';
    }
    
    this.render();
  }

  group(field) {
    // Validate that the field exists and is not hidden
    if (field) {
      const column = this.columns.find(col => col.field === field);
      if (!column) {
        console.warn(`DivTable: Cannot group by field '${field}' - field not found in columns`);
        return;
      }
      if (column.hidden) {
        console.warn(`DivTable: Cannot group by field '${field}' - hidden columns cannot be used for grouping`);
        return;
      }
      if (column.groupable === false) {
        console.warn(`DivTable: Cannot group by field '${field}' - column is marked as not groupable`);
        return;
      }
    }
    
    this.groupByField = field || null;
    
    if (field) {
      // When grouping is enabled, start with all groups collapsed
      this.collapsedGroups.clear();
      
      // Get all groups to populate the collapsed set
      const groups = this.groupData(this.filteredData);
      groups.forEach(group => {
        this.collapsedGroups.add(group.key);
      });
    } else {
      // When grouping is disabled, clear collapsed groups
      this.collapsedGroups.clear();
    }
    
    this.render();
  }

  clearGrouping() {
    this.group(null);
  }

  addRecord(record) {
    if (!record || typeof record !== 'object') {
      console.warn('addRecord requires a valid record object');
      return false;
    }
    
    // Ensure the record has a primary key
    if (!record[this.primaryKeyField]) {
      console.warn(`addRecord: Record must have a ${this.primaryKeyField} field`);
      return false;
    }
    
    // Check for existing record with same primary key (upsert behavior)
    const recordId = String(record[this.primaryKeyField]);
    const existingIndex = this.data.findIndex(item => 
      String(item[this.primaryKeyField]) === recordId
    );
    
    if (existingIndex >= 0) {
      // Update existing record
      this.data[existingIndex] = { ...record };
      console.log(`addRecord: Updated existing record with ${this.primaryKeyField} '${recordId}'`);
    } else {
      // Add new record
      this.data.push(record);
      console.log(`addRecord: Added new record with ${this.primaryKeyField} '${recordId}'`);
    }
    
    // Update the query engine with new/updated data
    this.queryEngine.setObjects(this.data);
    
    // Update query editor if field values changed (for completion suggestions)
    this.updateQueryEditorIfNeeded();
    
    // Re-apply current filter to include new/updated record if it matches
    this.applyQuery(this.currentQuery);
    
    return true;
  }

  removeRecord(id) {
    if (id === undefined || id === null) {
      console.warn('removeRecord requires a valid ID');
      return false;
    }
    
    const recordId = String(id);
    const index = this.data.findIndex(item => 
      String(item[this.primaryKeyField]) === recordId
    );
    
    if (index >= 0) {
      const removedRecord = this.data[index];
      this.data.splice(index, 1);
      
      // Remove from selection if it was selected
      this.selectedRows.delete(recordId);
      
      // Update the query engine with updated data
      this.queryEngine.setObjects(this.data);
      
      // Update query editor if field values changed (for completion suggestions)
      this.updateQueryEditorIfNeeded();
      
      // Re-apply current filter
      this.applyQuery(this.currentQuery);
      
      return removedRecord;
    }
    
    console.warn(`removeRecord: Record with ${this.primaryKeyField} '${recordId}' not found`);
    return false;
  }

  getSelectedRows() {
    return Array.from(this.selectedRows).map(id => this.findRowData(id)).filter(Boolean);
  }

  // Helper method to update query editor when field values change
  updateQueryEditorIfNeeded() {
    if (!this.queryEditor || !this.queryEditor.editor) {
      return;
    }

    // Check if we need to update field values for completion suggestions
    // This is particularly important for fields with specific value sets
    const hasFieldsWithValues = this.columns.some(col => 
      col.values || (col.field && this.data.length > 0)
    );

    if (hasFieldsWithValues) {
      // Recreate field names object with updated values
      const updatedFieldNames = {};
      
      this.columns.forEach(col => {
        if (!col.field) return;
        
        // Determine field type from data if not explicitly set
        let fieldType = col.type || 'string';
        let fieldValues = col.values;
        
        // If no explicit values but we have data, extract unique values for string fields
        if (!fieldValues && this.data.length > 0) {
          const uniqueValues = [...new Set(
            this.data
              .map(item => item[col.field])
              .filter(val => val !== null && val !== undefined && val !== '')
              .map(val => String(val))
          )].sort();
          
          // Only include values for string fields with reasonable number of unique values
          if (fieldType === 'string' && uniqueValues.length <= 50 && uniqueValues.length > 0) {
            fieldValues = uniqueValues;
          }
        }
        
        updatedFieldNames[col.field] = {
          type: fieldType,
          values: fieldValues,
          groupable: col.groupable !== false
        };
      });

      // Update the query editor's field names if they changed
      // Note: This would require the query editor to support dynamic updates
      // For now, we'll just log that an update might be beneficial
      console.log('🔄 Field values may have changed, query editor could benefit from refresh');
    }
  }

  // Debug method to verify data consistency
  verifyDataConsistency() {
    const issues = [];
    
    // Check if all selectedRows exist in the data
    for (const selectedId of this.selectedRows) {
      const rowData = this.findRowData(selectedId);
      if (!rowData) {
        issues.push(`Selected row ${selectedId} not found in data`);
      }
    }
    
    // Check if all displayed rows have corresponding data
    const displayedRowIds = Array.from(this.bodyContainer.querySelectorAll('.div-table-row[data-id]'))
      .map(row => row.dataset.id);
    
    for (const displayedId of displayedRowIds) {
      const rowData = this.findRowData(displayedId);
      if (!rowData) {
        issues.push(`Displayed row ${displayedId} not found in data`);
      }
    }
    
    if (issues.length > 0) {
      console.warn('DivTable data consistency issues:', issues);
    }
    
    return issues.length === 0;
  }

  // Test method to verify group selection states
  testGroupSelectionStates() {
    if (!this.groupByField) {
      console.log('No grouping applied');
      return;
    }

    const groups = this.groupData(this.sortData(this.filteredData));
    console.log('Group selection states:');
    
    groups.forEach(group => {
      const groupItemIds = group.items.map(item => String(item[this.primaryKeyField]));
      const selectedInGroup = groupItemIds.filter(id => this.selectedRows.has(id));
      
      let state = 'none';
      if (selectedInGroup.length === groupItemIds.length) {
        state = 'all';
      } else if (selectedInGroup.length > 0) {
        state = 'partial';
      }
      
      console.log(`Group "${group.value}": ${selectedInGroup.length}/${groupItemIds.length} selected (${state})`);
    });
  }

  // Virtual Scrolling Methods
  handleVirtualScroll() {
    const scrollTop = this.bodyContainer.scrollTop;
    const scrollHeight = this.bodyContainer.scrollHeight;
    const clientHeight = this.bodyContainer.clientHeight;
    
    // Calculate current visible position and determine loading trigger
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
    const currentDataLength = this.filteredData.length;
    
    // Calculate which record would be approximately visible at current scroll position
    const estimatedVisibleRecord = Math.floor(scrollPercentage * currentDataLength);
    
    // Calculate the trigger point: total records minus loading threshold
    const triggerPoint = currentDataLength - this.loadingThreshold;
    
    // Load next page when we're close to the end of currently loaded data
    if (estimatedVisibleRecord >= triggerPoint && this.hasMoreData && !this.isLoading) {
      console.log('📊 Virtual scroll triggered:', {
        estimatedVisibleRecord: estimatedVisibleRecord,
        triggerPoint: triggerPoint,
        loadingThreshold: this.loadingThreshold,
        currentDataLength: currentDataLength,
        hasMoreData: this.hasMoreData,
        isLoading: this.isLoading
      });
      this.loadNextPage();
    }
  }

  async loadNextPage() {
    if (this.isLoading || !this.hasMoreData) {
      console.log('🚫 Load next page skipped:', { isLoading: this.isLoading, hasMoreData: this.hasMoreData });
      return;
    }
    
    console.log('🔄 Loading next page...', { currentPage: this.currentPage, dataLength: this.data.length });
    
    this.isLoading = true;
    this.showLoadingIndicator();
    
    // Show loading placeholder rows for the next page
    this.showLoadingPlaceholders();
    
    // Start progress bar animation
    this.startProgressBarAnimation();
    
    try {
      // Recalculate current page based on current data count
      // If current count <= pageSize, then we're on page 0
      const currentDataCount = this.data.length;
      this.currentPage = currentDataCount <= this.pageSize ? 0 : Math.floor((currentDataCount - 1) / this.pageSize);
      
      // Call the pagination callback - note: currentPage is zero-indexed, so currentPage+1 is the next page to load
      const nextPageToLoad = this.currentPage + 1;
      console.log(`📄 Requesting page ${nextPageToLoad} (recalculated currentPage: ${this.currentPage}, dataCount: ${currentDataCount})`);
      const newData = await this.onNextPage(nextPageToLoad, this.pageSize);
      
      console.log('📦 Received new data:', { newRecords: newData?.length || 0, requestedPage: nextPageToLoad });
      
      if (newData && Array.isArray(newData) && newData.length > 0) {
        // Use appendData for all the heavy lifting - it handles:
        // - Validation
        // - Upsert behavior (add new, update existing)
        // - Query engine updates
        // - Query editor refresh
        // - Re-applying current query/filter
        // - Info section updates and re-rendering
        const result = this.appendData(newData);
        
        // Log the results for debugging
        if (result.updated > 0) {
          console.log('🔄 Updated existing records during pagination:', result.updated);
        }
        if (result.invalid.length > 0) {
          console.warn('⚠️ Invalid records found during pagination:', result.invalid.length);
        }
        
        // Only increment page if we actually processed some data
        if (result.added > 0 || result.updated > 0) {
          const oldPage = this.currentPage;
          // Recalculate current page based on new data count
          const newDataCount = this.data.length;
          this.currentPage = newDataCount <= this.pageSize ? 0 : Math.floor((newDataCount - 1) / this.pageSize);
          console.log(`📈 Page recalculated: ${oldPage} → ${this.currentPage} (dataCount: ${newDataCount})`);
        }
        
        // Check if we have more data (standard pagination logic)
        this.hasMoreData = newData.length === this.pageSize;
        
        console.log('✅ Page loaded successfully:', { 
          totalRecords: this.data.length, 
          currentPage: this.currentPage, 
          hasMoreData: this.hasMoreData,
          addedRecords: result.added,
          updatedRecords: result.updated,
          invalidRecords: result.skipped
        });
      } else {
        // No more data available
        this.hasMoreData = false;
        console.log('🏁 No more data available');
      }
    } catch (error) {
      console.error('❌ Error loading next page:', error);
      this.showErrorIndicator();
    } finally {
      this.isLoading = false;
      this.hideLoadingIndicator();
      // Remove loading placeholders whether success or error
      this.hideLoadingPlaceholders();
      // Stop progress bar animation
      this.stopProgressBarAnimation();
    }
  }

  showLoadingIndicator() {
    let indicator = this.bodyContainer.querySelector('.loading-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'loading-indicator';
      indicator.innerHTML = `
        <div class="loading-spinner"></div>
        <span>Loading more records...</span>
      `;
      this.bodyContainer.appendChild(indicator);
    }
    indicator.style.display = 'flex';
  }

  hideLoadingIndicator() {
    const indicator = this.bodyContainer.querySelector('.loading-indicator');
    if (indicator) {
      indicator.style.display = 'none';
    }
  }

  showErrorIndicator() {
    let indicator = this.bodyContainer.querySelector('.error-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'error-indicator';
      indicator.innerHTML = `
        <span>Error loading data. Please try again.</span>
        <button class="retry-button">Retry</button>
      `;
      
      const retryButton = indicator.querySelector('.retry-button');
      retryButton.addEventListener('click', () => {
        this.hideErrorIndicator();
        this.loadNextPage();
      });
      
      this.bodyContainer.appendChild(indicator);
    }
    indicator.style.display = 'flex';
  }

  hideErrorIndicator() {
    const indicator = this.bodyContainer.querySelector('.error-indicator');
    if (indicator) {
      indicator.style.display = 'none';
    }
  }

  showLoadingPlaceholders() {
    // Remove any existing placeholders first
    this.hideLoadingPlaceholders();
    
    // Create placeholder rows for the expected page size
    const placeholdersToShow = Math.min(this.pageSize, 5); // Show max 5 placeholder rows to avoid overwhelming UI
    
    for (let i = 0; i < placeholdersToShow; i++) {
      const placeholderRow = this.createLoadingPlaceholderRow();
      this.bodyContainer.appendChild(placeholderRow);
    }
  }

  hideLoadingPlaceholders() {
    const placeholders = this.bodyContainer.querySelectorAll('.div-table-row.loading-placeholder');
    placeholders.forEach(placeholder => placeholder.remove());
  }

  createLoadingPlaceholderRow() {
    const row = document.createElement('div');
    row.className = 'div-table-row loading-placeholder';
    
    const orderedColumns = this.getOrderedColumns();
    
    // Use the same grid template as regular rows
    let gridTemplate = '';
    if (this.showCheckboxes) {
      gridTemplate = '40px '; // Checkbox column
    }
    
    // Add column templates
    orderedColumns.forEach(col => {
      // If this is the grouped column, make it narrower since values are empty
      if (this.groupByField && col.field === this.groupByField) {
        gridTemplate += '100px '; // Fixed narrow width for grouped column
        return;
      }
      
      const responsive = col.responsive || {};
      switch (responsive.size) {
        case 'fixed-narrow':
          gridTemplate += '80px ';
          break;
        case 'fixed-medium':
          gridTemplate += '120px ';
          break;
        case 'flexible-small':
          gridTemplate += '1fr ';
          break;
        case 'flexible-medium':
          gridTemplate += '2fr ';
          break;
        case 'flexible-large':
          gridTemplate += '3fr ';
          break;
        default:
          gridTemplate += '1fr ';
      }
    });
    
    row.style.gridTemplateColumns = gridTemplate.trim();

    // Checkbox column placeholder
    if (this.showCheckboxes) {
      const checkboxCell = document.createElement('div');
      checkboxCell.className = 'div-table-cell checkbox-column loading-cell';
      row.appendChild(checkboxCell);
    }

    // Column placeholders
    orderedColumns.forEach(col => {
      const cell = document.createElement('div');
      cell.className = 'div-table-cell loading-cell';
      
      // Create shimmer placeholder content
      const shimmerContent = document.createElement('div');
      shimmerContent.className = 'loading-shimmer-content';
      
      // Vary the width of placeholder content to look more realistic
      const widthPercentage = 60 + Math.random() * 30; // Between 60% and 90%
      shimmerContent.style.width = `${widthPercentage}%`;
      
      cell.appendChild(shimmerContent);
      row.appendChild(cell);
    });

    return row;
  }

  startProgressBarAnimation() {
    // Find all progress bars and add loading class for animation
    const progressBars = this.infoSection.querySelectorAll('.loading-progress-bar');
    progressBars.forEach(bar => {
      bar.classList.add('loading');
    });
  }

  stopProgressBarAnimation() {
    // Find all progress bars and remove loading class to stop animation
    const progressBars = this.infoSection.querySelectorAll('.loading-progress-bar');
    progressBars.forEach(bar => {
      bar.classList.remove('loading');
    });
  }

  // Public API for virtual scrolling configuration
  setTotalRecords(total) {
    if (typeof total !== 'number' || total < 0) {
      console.warn('DivTable: totalRecords must be a non-negative number');
      return;
    }
    
    this.totalRecords = total;
    this.hasMoreData = this.data.length < total;
    
    // Update info section to reflect new total
    this.updateInfoSection();
    
    console.log(`DivTable: Updated totalRecords to ${total}, hasMoreData: ${this.hasMoreData}`);
  }

  setPageSize(newPageSize) {
    if (typeof newPageSize !== 'number' || newPageSize <= 0) {
      console.warn('DivTable: pageSize must be a positive number');
      return;
    }
    
    const oldPageSize = this.pageSize;
    this.pageSize = newPageSize;
    
    // Recalculate loading threshold based on new page size
    this.loadingThreshold = Math.floor(this.pageSize * 0.8);
    
    // Update visible end index for virtual scrolling
    this.visibleEndIndex = Math.min(this.visibleStartIndex + this.pageSize, this.data.length);
    
    // Update info section to reflect new configuration
    this.updateInfoSection();
    
    console.log(`DivTable: Updated pageSize from ${oldPageSize} to ${newPageSize}, loadingThreshold: ${this.loadingThreshold}`);
  }

  setVirtualScrollingConfig({ totalRecords, pageSize, loadingThreshold }) {
    let updated = false;
    
    if (typeof totalRecords === 'number' && totalRecords >= 0) {
      this.totalRecords = totalRecords;
      this.hasMoreData = this.data.length < totalRecords;
      updated = true;
    }
    
    if (typeof pageSize === 'number' && pageSize > 0) {
      this.pageSize = pageSize;
      this.visibleEndIndex = Math.min(this.visibleStartIndex + this.pageSize, this.data.length);
      updated = true;
    }
    
    if (typeof loadingThreshold === 'number' && loadingThreshold > 0) {
      this.loadingThreshold = loadingThreshold;
      updated = true;
    } else if (typeof pageSize === 'number') {
      // Recalculate loading threshold if pageSize changed but threshold wasn't provided
      this.loadingThreshold = Math.floor(this.pageSize * 0.8);
      updated = true;
    }
    
    if (updated) {
      this.updateInfoSection();
      console.log(`DivTable: Updated virtual scrolling config - totalRecords: ${this.totalRecords}, pageSize: ${this.pageSize}, loadingThreshold: ${this.loadingThreshold}`);
    }
  }

  setHasMoreData(hasMore) {
    this.hasMoreData = hasMore;
  }

  resetPagination() {
    this.currentPage = 0;
    this.isLoading = false;
    this.hasMoreData = true;
    this.data = this.data.slice(0, this.pageSize); // Keep only first page
    this.filteredData = [...this.data];
    this.hideLoadingIndicator();
    this.hideErrorIndicator();
    this.render();
  }

  appendData(newData) {
    if (!newData || !Array.isArray(newData)) {
      console.warn('appendData requires a valid array');
      return { added: 0, updated: 0, skipped: 0, invalid: [] };
    }
    
    const invalid = [];
    let addedCount = 0;
    let updatedCount = 0;
    
    // Process each record with upsert behavior
    for (const record of newData) {
      if (!record || typeof record !== 'object') {
        invalid.push(record);
        console.warn('appendData: Skipping invalid record', record);
        continue;
      }
      
      // Ensure the record has a primary key
      if (!record[this.primaryKeyField]) {
        invalid.push(record);
        console.warn(`appendData: Skipping record without ${this.primaryKeyField}`, record);
        continue;
      }
      
      // Check for existing record with same primary key (upsert behavior)
      const recordId = String(record[this.primaryKeyField]);
      const existingIndex = this.data.findIndex(item => 
        String(item[this.primaryKeyField]) === recordId
      );
      
      if (existingIndex >= 0) {
        // Update existing record
        this.data[existingIndex] = { ...record };
        updatedCount++;
      } else {
        // Add new record
        this.data.push(record);
        addedCount++;
      }
    }
    
    if (addedCount > 0 || updatedCount > 0) {
      // Update the query engine with new/updated data
      this.queryEngine.setObjects(this.data);
      
      // Update query editor if field values changed (for completion suggestions)
      this.updateQueryEditorIfNeeded();
      
      // Update filtered data if no active query
      if (!this.currentQuery.trim()) {
        this.filteredData = [...this.data];
      } else {
        // Re-apply query to include new/updated data
        this.applyQuery(this.currentQuery);
      }
      
      // Update info section and re-render
      this.updateInfoSection();
      this.render();
    }
    
    return { 
      added: addedCount, 
      updated: updatedCount, 
      skipped: invalid.length, 
      invalid 
    };
  }

  replaceData(newData) {
    if (!newData || !Array.isArray(newData)) {
      console.warn('replaceData requires a valid array');
      return { success: false, message: 'Invalid data provided' };
    }

    // Validate data integrity and check for duplicates within the new data
    const duplicates = [];
    const seenIds = new Set();
    const validRecords = [];
    
    for (const record of newData) {
      if (!record || typeof record !== 'object') {
        console.warn('replaceData: Skipping invalid record', record);
        continue;
      }
      
      // Ensure the record has a primary key
      if (!record[this.primaryKeyField]) {
        console.warn(`replaceData: Skipping record without ${this.primaryKeyField}`, record);
        continue;
      }
      
      // Check for duplicate primary key within the new data
      const recordId = String(record[this.primaryKeyField]);
      if (seenIds.has(recordId)) {
        duplicates.push(recordId);
        console.warn(`replaceData: Skipping duplicate ${this.primaryKeyField} '${recordId}' within new data`);
        continue;
      }
      
      seenIds.add(recordId);
      validRecords.push(record);
    }

    // Replace the entire data array with validated data
    this.data = validRecords;
    
    // Update the query engine with new data
    this.queryEngine.setObjects(this.data);
    
    // Update query editor if field values changed (for completion suggestions)
    this.updateQueryEditorIfNeeded();
    
    // Keep the current query and re-apply it to filter the new data
    if (this.currentQuery && this.currentQuery.trim()) {
      this.applyQuery(this.currentQuery);
    } else {
      this.filteredData = [...this.data];
    }
    
    // Clear selection state (using correct property name)
    this.selectedRows.clear();
    
    // Reset virtual scrolling state
    this.virtualScrollingState = {
      scrollTop: 0,
      displayStartIndex: 0,
      displayEndIndex: Math.min(this.pageSize, this.data.length),
      isLoading: false,
      //loadedPages: new Set([0]) // First page is page 0
    };
    
    // Reset pagination to first page (zero-indexed)
    this.currentPage = 0;
    this.startId = 1;
    
    // Update info display and re-render
    this.updateInfoSection();
    this.render();
    
    return { 
      success: true, 
      totalProvided: newData.length,
      validRecords: validRecords.length, 
      skipped: newData.length - validRecords.length, 
      duplicates 
    };
  }
}

// QueryEngine class for advanced query functionality
class QueryEngine {
  constructor(objects = [], primaryKeyField = 'id') {
    this.objects = objects;
    this.primaryKeyField = primaryKeyField;
  }

  setObjects(objects) {
    this.objects = objects;
  }
 
  filterObjects(query) {
    if (!query.trim()) return this.objects.map(obj => obj[this.primaryKeyField]);

    const hasOperators = /[=!<>()]|(\bAND\b|\bOR\b|\bIN\b)/i.test(query);

    if (!hasOperators) {
      return this.searchObjects(query);
    }

    const results = [];
    for (const obj of this.objects) {
      try {
        if (this.evaluateExpression(obj, query)) {
          results.push(obj[this.primaryKeyField]);
        }
      } catch (error) {
        throw new Error(`Query error: ${error.message}`);
      }
    }
    return results;
  }

  searchObjects(searchTerms) {
    const terms = searchTerms.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return this.objects.map(obj => obj[this.primaryKeyField]);

    const results = [];
    for (const obj of this.objects) {
      const searchableValues = Object.values(obj)
        .map(value => (value == null ? '' : String(value).toLowerCase()))
        .join(' ');

      const allTermsFound = terms.every(term => searchableValues.includes(term));
      if (allTermsFound) results.push(obj[this.primaryKeyField]);
    }
    return results;
  }

  evaluateExpression(obj, expression) {
    if (!expression.trim()) return true;

    expression = expression.replace(/\s+/g, ' ').trim();

    while (/\(([^()]+)\)/.test(expression)) {
      expression = expression.replace(/\(([^()]+)\)/g, (_, innerExpr) =>
        this.processGroup(obj, innerExpr) ? 'true' : 'false'
      );
    }

    return this.processGroup(obj, expression);
  }

  processGroup(obj, group) {
    const orConditions = group.split(/\s+OR\s+/);

    return orConditions.some(conditionGroup => {
      const andConditions = conditionGroup.split(/\s+AND\s+/);

      return andConditions.every(condition => {
        const cond = condition.trim().toLowerCase();
        if (cond === 'false') return false;
        if (cond === 'true') return true;

        try {
          const parsed = this.parseCondition(condition);
          return this.applyCondition(obj, parsed);
        } catch {
          throw new Error(`Invalid condition: ${condition}`);
        }
      });
    });
  }

  parseCondition(condition) {
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

      if (parsedValue.startsWith('"') && parsedValue.endsWith('"')) {
        parsedValue = parsedValue.slice(1, -1);
      } else if (parsedValue === 'NULL') {
        parsedValue = null;
      } else if (parsedValue.toLowerCase() === 'true') {
        parsedValue = true;
      } else if (parsedValue.toLowerCase() === 'false') {
        parsedValue = false;
      } else if (!isNaN(parsedValue) && parsedValue !== '') {
        parsedValue = parseFloat(parsedValue);
      }

      return { field, operator, value: parsedValue };
    }

    throw new Error(`Invalid condition: ${condition}`);
  }

  applyCondition(obj, { field, operator, value }) {
    const objValue = field in obj ? obj[field] : null;
    const isNullish = val => val === null || val === undefined || val === '';

    switch (operator) {
      case '=':
        if (value === null) return isNullish(objValue);
        if (isNullish(objValue)) return false;
        return objValue == value;

      case '!=':
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
        if (value.includes(null)) {
          return isNullish(objValue) || value.includes(objValue);
        }
        if (isNullish(objValue)) return false;
        return value.includes(objValue);

      default:
        return false;
    }
  }
}
