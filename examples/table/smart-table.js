class SmartTable {
  constructor(monaco, {
    tableWidgetElement,
    data,
    columns,
    showCheckboxes = false,
    multiSelect = true,
    onSelectionChange = null,
    onRowFocus = null
  }) {
    this.monaco = monaco;
    this.tableWidgetElement = tableWidgetElement;
    this.data = data;
    // Add virtual 'selected' column if showCheckboxes is true
    if (showCheckboxes) {
      columns = [
        {
          field: 'selected',
          label: 'Selection', // Proper label for dropdown
          groupable: true,
          render: value => value ? 'Selected' : 'Unselected', // Use text instead of symbols
          responsive: { priority: 'low', size: 'fixed-narrow' }
        },
        ...columns
      ];
      data.forEach(record => {
        if (typeof record.selected === 'undefined') record.selected = false;
      });
    }
    this.columns = columns;
    this.showCheckboxes = showCheckboxes;
    this.multiSelect = multiSelect;
    this.onSelectionChange = onSelectionChange;
    this.onRowFocus = onRowFocus;
    this.queryEngine = new QueryEngine(this.data);

    // Find the primary key field
    const primaryKeyColumn = columns.find(col => col.primaryKey === true);
    this.primaryKeyField = primaryKeyColumn ? primaryKeyColumn.field : 'id';

    this.sortField = null;
    this.sortDirection = 'asc';
    this.groupByField = '';
    this.selectedRows = new Set();
    this.selectionOrder = [];
    this.lastClickedRowId = null;
    this.focusedRow = null; // Track the currently focused row
    this.collapsedGroups = new Set();
    this.isNewGrouping = false;
    this.filteredData = data;
    this.originalColumns = [...columns];
    this.currentColumns = [...columns];

    // Create parent container for header and body
    const parentContainer = document.createElement('div');
    parentContainer.className = 'smart-table-container';
    parentContainer.style.position = 'relative';

    // Create header container
    const headerContainer = document.createElement('div');
    headerContainer.className = 'smart-table-header-container';

    // Create header table
    this.tableForHeader = document.createElement('table');
    this.tableForHeader.className = "smart-table-header smart-table";

    headerContainer.appendChild(this.tableForHeader);

    // Create body container
    const bodyContainer = document.createElement('div');
    bodyContainer.className = 'smart-table-body-container';
    bodyContainer.tabIndex = 0; // Make the table focusable

    // Create body table
    this.tableForBody = document.createElement('table');
    this.tableForBody.className = "smart-table-body smart-table";
    bodyContainer.appendChild(this.tableForBody);

    // Append header and body containers to parent
    parentContainer.appendChild(headerContainer);
    parentContainer.appendChild(bodyContainer);

    // Store reference to body container
    this.bodyContainer = bodyContainer;

    // Insert parent container into tableWidgetElement
    this.tableWidgetElement.appendChild(parentContainer);

    // Add drop-shadow to header when value table is scrolled
    bodyContainer.addEventListener('scroll', function () {
      if (bodyContainer.scrollTop > 0) {
        headerContainer.classList.add('drop-shadow');
      } else {
        headerContainer.classList.remove('drop-shadow');
      }
    });
    this.editorContainer = this.tableWidgetElement.querySelector('.query-input-container');
    this.groupBySelect = this.tableWidgetElement.querySelector('.group-by');

    if (!this.showCheckboxes) {
      this.tableForHeader.classList.add('no-checkboxes');
      this.tableForBody.classList.add('no-checkboxes');
    }
    if (!this.multiSelect) {
      this.tableForHeader.classList.add('no-multiselect');
      this.tableForBody.classList.add('no-multiselect');
    }

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

    const { editor, model } = createQueryEditor(this.monaco, this.editorContainer, {
      fieldNames,
      placeholder: 'Search or filter results... (e.g., age > 25 AND city = "New York")'
    });
    this.editor = editor;
    this.model = model;

    this.editorContainer.classList.add('query-inputfield');

    // Set up focus handling for the query-input-container
    this.editorContainer.addEventListener('focus', () => {
      // When the container gets focus via tabindex, focus the Monaco editor
      this.editor.focus();
    });

    // Set up focus handling for the table body container
    this.bodyContainer.addEventListener('focus', () => {
      // When the table gets focus via tabindex, focus the first visible record
      this.focusFirstRecord();
    });

    setTimeout(() => {
      const value = this.model.getValue();
      if (value === '') {
        this.monaco.editor.setModelMarkers(this.model, this.model.getLanguageId(), []);
      }
    }, 10);

    this._setupQueryListeners();
    this._setupScrollAndResize();
    this._setupGroupByDropdown();
    this._setupKeyboardNavigation();

    this.renderAndSync(this.data);
  }

  updateColumnOrder() {
    // Start with original columns but filter out the 'selected' virtual column
    this.currentColumns = this.originalColumns.filter(col => col.field !== 'selected');
    
    if (this.groupByField) {
      // Remove the grouped column from its original position
      this.currentColumns = this.currentColumns.filter(col => col.field !== this.groupByField);
      
      // Handle special case for "selected" field
      if (this.groupByField === 'selected') {
        const groupColumn = { 
          field: 'selected', 
          label: 'Selection',
          isGroupColumn: true,
          responsive: { size: 'fixed-narrow' } // Give it a narrow fixed width
        };
        this.currentColumns.unshift(groupColumn);
      } else {
        // Insert the grouped column as the first column in the array (will be second after selection)
        const groupedCol = this.originalColumns.find(col => col.field === this.groupByField);
        const groupColumn = { 
          field: this.groupByField, 
          label: groupedCol ? groupedCol.label : this.groupByField,
          isGroupColumn: true, // Mark this as the grouping column
          responsive: groupedCol ? groupedCol.responsive : null // Keep original responsive settings
        };
        this.currentColumns.unshift(groupColumn); // Add as first column
      }
    }
    this.rebuildHeaders();
  }

  rebuildHeaders() {
    const thead = this.tableForHeader.querySelector('thead') || this.tableForHeader.appendChild(document.createElement('thead'));
    thead.innerHTML = '';

    const tr = document.createElement('tr');

    if (this.showCheckboxes) {
      const th = document.createElement('th');
      th.classList.add('checkbox-column', 'select-cell');
      th.innerHTML = ''; // No label for selection column
      th.onclick = (e) => {
        e.stopPropagation();
        // Toggle all records selection
        const allSelected = this.filteredData.every(item => item.selected);
        this.filteredData.forEach(item => {
          item.selected = !allSelected;
        });
        
        this.updateVisualSelectionStates();
        this.updateInfoSection();
        if (this.onSelectionChange) this.onSelectionChange(this.getSelectedRows());
      };
      tr.appendChild(th);
    }

    this.currentColumns.forEach(col => {
      // Skip the virtual 'selected' column in headers - it's handled separately
      if (col.field === 'selected') return;
      
      const th = document.createElement('th');
      th.classList.add('sortable');
      //th.style.cursor = 'pointer';
      let arrow = '';
      if (this.sortField === col.field) {
        arrow = this.sortDirection === 'asc' ? ' ▲' : ' ▼';
      }
      th.innerHTML = `${col.label}${arrow}`;
      th.addEventListener('click', () => {
        if (this.sortField === col.field) {
          this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          this.sortField = col.field;
          // Always start with 'asc' when a new column is selected
          this.sortDirection = 'asc';
        }
        this.rebuildHeaders(); // Force header re-render to update arrow
        const filteredIds = this.queryEngine.filterObjects(this.model.getValue());
        this.renderAndSync(this.data.filter(obj => filteredIds.includes(obj.id)));
      });
      tr.appendChild(th);
    });

    thead.appendChild(tr);
    // Synchronize column widths after header re-render (including sort icon)
    setTimeout(() => {
      this.synchronizeColumnWidths();
    }, 0);
  }

  updateVisualSelectionStates() {
    // Update row selection indicators, focus states, and selection cells
    this.tableForBody.querySelectorAll('tbody tr').forEach(tr => {
      const rowId = tr.getAttribute('data-id');
      const groupKey = tr.getAttribute('data-group-key');
      
      if (rowId) {
        // This is a data row
        const record = this.data.find(item => String(item[this.primaryKeyField]) === rowId);
        
        if (record) {
          // Handle selection state
          if (record.selected) {
            tr.classList.add('selected');
          } else {
            tr.classList.remove('selected');
          }
          
          // Handle focus state (separate from selection)
          if (this.focusedRow && String(record[this.primaryKeyField]) === this.focusedRow) {
            tr.classList.add('focused');
          } else {
            tr.classList.remove('focused');
          }
          
          // Update selection cell
          const checkboxCell = tr.querySelector('.checkbox-column.select-cell');
          if (checkboxCell) {
            checkboxCell.innerHTML = record.selected ? '☑' : '☐';
          }
        } else {
          tr.classList.remove('selected', 'focused');
        }
      } else if (groupKey !== null && tr.classList.contains('group-header')) {
        // This is a group header row
        const expectedFocusId = `group_${groupKey}`;
        if (this.focusedRow === expectedFocusId) {
          tr.classList.add('focused');
        } else {
          tr.classList.remove('focused');
        }
      }
    });

    // Update header selection indicator
    if (this.showCheckboxes) {
      const headerSelectCell = this.tableForHeader.querySelector('thead th.checkbox-column.select-cell');
      if (headerSelectCell) {
        const totalVisible = this.filteredData.length;
        const selectedVisible = this.filteredData.filter(item => item.selected).length;
        if (selectedVisible === 0) {
          headerSelectCell.innerHTML = '☐';
        } else if (selectedVisible === totalVisible) {
          headerSelectCell.innerHTML = '☑';
        } else {
          headerSelectCell.innerHTML = '☒';
        }
      }
    }

    // Update group-header select box state
    this.tableForBody.querySelectorAll('tbody tr.group-header').forEach(groupRow => {
      const selectTd = groupRow.querySelector('.checkbox-column.select-cell');
      if (selectTd) {
        // Get group key with original type preserved
        const groupKey = groupRow._groupKey;
        if (groupKey !== undefined) {
          // Use consistent grouping logic for filtering
          const groupRows = this.filteredData.filter(item => {
            const value = item[this.groupByField];
            const key = (value !== undefined && value !== null) ? value : '_GROUP_NULL_';
            return key === groupKey;
          });
          const selectedCount = groupRows.filter(item => item.selected).length;
          if (selectedCount === 0) {
            selectTd.innerHTML = '☐';
          } else if (selectedCount === groupRows.length) {
            selectTd.innerHTML = '☑';
          } else {
            selectTd.innerHTML = '☒';
          }
        }
      }
    });
  }

  updateInfoSection() {
    const infoSection = this.tableWidgetElement.querySelector('.info-section');

    if (infoSection) {
      const selectedCount = this.data.filter(item => item.selected).length;
      const filteredTotal = this.filteredData.length;
      const grandTotal = this.data.length;
      
      let infoText = `${selectedCount} selected`;
      
      if (filteredTotal < grandTotal) {
        // Filter is applied - show filtered total and grand total
        infoText += ` of ${filteredTotal} filtered (${grandTotal} total)`;
      } else {
        // No filter - show only grand total
        infoText += ` of ${grandTotal} total`;
      }
      
      infoSection.textContent = infoText;
    }
    
    // Debounced regrouping if currently grouping by selection
    if (this.groupByField === 'selected' && !this._isRegrouping) {
      // Clear any existing regrouping timeout
      if (this._regroupingTimeout) {
        clearTimeout(this._regroupingTimeout);
      }
      
      // Schedule regrouping with debounce (300ms delay)
      this._regroupingTimeout = setTimeout(() => {
        this._isRegrouping = true;
        const filteredIds = this.queryEngine.filterObjects(this.model.getValue());
        this.renderAndSync(this.data.filter(obj => filteredIds.includes(obj.id)));
        this._isRegrouping = false;
        this._regroupingTimeout = null;
      }, 300);
    }
  }

  updateSelectAllCheckbox() {
    if (!this.showCheckboxes) return;
    const selectAllCheckbox = this.tableForHeader.querySelector('thead th input[type="checkbox"]');
    if (selectAllCheckbox) {
      const total = this.filteredData.length;
      const selected = this.selectedRows.size;
      selectAllCheckbox.checked = total > 0 && selected === total;
      selectAllCheckbox.indeterminate = selected > 0 && selected < total;
    }
  }

  handleRowFocus(rowId) {
    // Set the focused row ID (store as string for consistent comparison)
    this.focusedRow = String(rowId);
    
    // Find the actual record for the callback
    const record = this.data.find(item => String(item[this.primaryKeyField]) === String(rowId));
    
    // Update visual states
    this.updateVisualSelectionStates();
    
    // Scroll focused row into view
    this.scrollToFocusedRow();
    
    // Trigger callback with the actual record object
    if (this.onRowFocus && record) {
      this.onRowFocus(record);
    }
  }

  focusFirstRecord() {
    // If there's already a focused row, maintain that focus
    if (this.focusedRow) {
      // Check if the currently focused row is still visible
      if (this.focusedRow.startsWith('group_')) {
        // Check if the focused group still exists
        const groupKeyString = this.focusedRow.replace('group_', '');
        const groupKey = this.parseGroupKey(groupKeyString);
        const groups = this.groupObjects(this.sortObjects(this.filteredData));
        const groupExists = groups.some(group => group.key === groupKey);
        if (groupExists) {
          // Keep the current focus and update visual states
          this.updateVisualSelectionStates();
          this.scrollToFocusedRow();
          if (this.onRowFocus) {
            this.onRowFocus(null);
          }
          return;
        }
      } else {
        // Check if the focused data row still exists in filtered data
        const focusedRecord = this.filteredData.find(item => 
          String(item[this.primaryKeyField]) === this.focusedRow
        );
        if (focusedRecord) {
          // Keep the current focus and update visual states
          this.updateVisualSelectionStates();
          this.scrollToFocusedRow();
          if (this.onRowFocus) {
            this.onRowFocus(focusedRecord);
          }
          return;
        }
      }
    }

    // No existing focus or focused row is no longer visible - focus the first visible record
    if (this.filteredData && this.filteredData.length > 0) {
      // If we have grouped data, focus the first group header
      if (this.groupByField) {
        const groups = this.groupObjects(this.sortObjects(this.filteredData));
        if (groups.length > 0) {
          const firstGroupKey = groups[0].key;
          this.focusedRow = `group_${firstGroupKey}`;
          this.updateVisualSelectionStates();
          this.scrollToFocusedRow();
          // Trigger callback with null to indicate group header focus
          if (this.onRowFocus) {
            this.onRowFocus(null);
          }
        }
      } else {
        // Focus the first data record
        const firstRecord = this.filteredData[0];
        if (firstRecord) {
          this.handleRowFocus(firstRecord[this.primaryKeyField]);
        }
      }
    }
  }

  handleSelectionChange(rowId, isSelected, isRangeSelection = false) {
    if (!this.multiSelect) {
      this.selectedRows.clear();
      this.selectionOrder = [];
      if (isSelected) {
        this.selectedRows.add(rowId);
        this.selectionOrder.push(rowId);
      }
    } else if (isRangeSelection && this.lastClickedRowId) {
      this.handleRangeSelection(rowId);
    } else {
      if (isSelected) {
        this.selectedRows.add(rowId);
        if (!this.selectionOrder.includes(rowId)) {
          this.selectionOrder.push(rowId);
        }
      } else {
        this.selectedRows.delete(rowId);
        this.selectionOrder = this.selectionOrder.filter(id => id !== rowId);
      }
    }
    this.lastClickedRowId = rowId;
    this.updateVisualSelectionStates();
    this.updateInfoSection();
    if (this.onSelectionChange) this.onSelectionChange(this.getSelectedRows());
  }

  handleRangeSelection(targetRowId) {
    const ids = this.filteredData.map(item => item.id);
    const start = ids.indexOf(this.lastClickedRowId);
    const end = ids.indexOf(targetRowId);
    if (start === -1 || end === -1) return;
    const [from, to] = start < end ? [start, end] : [end, start];
    const rangeIds = ids.slice(from, to + 1);
    rangeIds.forEach(id => {
      this.selectedRows.add(id);
      if (!this.selectionOrder.includes(id)) {
        this.selectionOrder.push(id);
      }
    });
  }

  sortObjects(objects) {
    if (!this.sortField) return objects;
    return [...objects].sort((a, b) => {
      const aValue = a[this.sortField];
      const bValue = b[this.sortField];

      // Handle undefined/null values
      const aIsNullish = aValue === undefined || aValue === null || aValue === '';
      const bIsNullish = bValue === undefined || bValue === null || bValue === '';

      if (aIsNullish && bIsNullish) return 0;
      if (aIsNullish) return this.sortDirection === 'asc' ? 1 : -1;
      if (bIsNullish) return this.sortDirection === 'asc' ? -1 : 1;

      if (aValue < bValue) return this.sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  groupObjects(objects) {
    if (!this.groupByField) return [{ key: null, items: objects }];
    const groups = new Map();
    objects.forEach(obj => {
      // Handle falsy values properly - only treat undefined/null as missing
      const value = obj[this.groupByField];
      const key = (value !== undefined && value !== null) ? value : '_GROUP_NULL_';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(obj);
    });
    
    // Convert to array and sort groups
    return Array.from(groups.entries())
      .sort(([keyA], [keyB]) => {
        // Handle undefined/null groups (_GROUP_NULL_) based on sort direction
        if (keyA === '_GROUP_NULL_' && keyB !== '_GROUP_NULL_') {
          // If we're sorting by the same field as grouping, respect sort direction
          if (this.sortField === this.groupByField) {
            return this.sortDirection === 'asc' ? 1 : -1; // asc: end, desc: top
          }
          return 1; // Default: put at end for non-sorted grouping
        }
        if (keyA !== '_GROUP_NULL_' && keyB === '_GROUP_NULL_') {
          // If we're sorting by the same field as grouping, respect sort direction
          if (this.sortField === this.groupByField) {
            return this.sortDirection === 'asc' ? -1 : 1; // asc: end, desc: top
          }
          return -1; // Default: put at end for non-sorted grouping
        }
        if (keyA === '_GROUP_NULL_' && keyB === '_GROUP_NULL_') return 0;
        
        // If we're sorting by the same field as we're grouping by, use sort direction
        if (this.sortField === this.groupByField) {
          if (keyA < keyB) return this.sortDirection === 'asc' ? -1 : 1;
          if (keyA > keyB) return this.sortDirection === 'asc' ? 1 : -1;
          return 0;
        }
        
        // Otherwise, use alphabetical sorting for group keys
        const strA = String(keyA).toLowerCase();
        const strB = String(keyB).toLowerCase();
        return strA.localeCompare(strB);
      })
      .map(([key, items]) => ({ key, items }));
  }

  renderObjects(filteredObjects) {
    this.filteredData = filteredObjects;
    // Add/replace thead in body table for alignment
    let thead = this.tableForBody.querySelector('thead');
    if (!thead) {
      thead = document.createElement('thead');
      this.tableForBody.insertBefore(thead, this.tableForBody.firstChild);
    }
    thead.innerHTML = '';
    const headerTr = document.createElement('tr');
    if (this.showCheckboxes) {
      const th = document.createElement('th');
      th.classList.add('checkbox-column', 'select-cell');
      headerTr.appendChild(th);
    }
    this.currentColumns.forEach(col => {
      // Skip the virtual 'selected' column in headers - it's handled separately
      if (col.field === 'selected') return;
      
      const th = document.createElement('th');
      th.classList.add('body-header');
      th.innerHTML = col.label || ''; // Add content for width calculation
      headerTr.appendChild(th);
    });
    thead.appendChild(headerTr);
    
    // Hide the body table's thead completely - zero height but keep structure for width calculations
    thead.style.height = '0';
    thead.style.maxHeight = '0';
    thead.style.overflow = 'hidden';
    thead.style.visibility = 'hidden';
    thead.style.lineHeight = '0';
    thead.style.fontSize = '0';
    
    // Also ensure all th elements in the hidden thead have zero height
    headerTr.querySelectorAll('th').forEach(th => {
      th.style.height = '0';
      th.style.maxHeight = '0';
      th.style.lineHeight = '0';
      th.style.fontSize = '0';
    });

    const tbody = this.tableForBody.querySelector('tbody') || this.tableForBody.appendChild(document.createElement('tbody'));
    tbody.innerHTML = '';

    // Remove previous delegated click handler if any
    if (tbody._delegatedClickHandler) {
      tbody.removeEventListener('click', tbody._delegatedClickHandler);
    }
    // Add delegated click handler for row focus (not selection)
    tbody._delegatedClickHandler = (e) => {
      let tr = e.target.closest('tr');
      if (!tr) return;
      
      // For group rows, let the individual click handlers handle the event
      if (tr.classList.contains('group-header')) {
        // Don't interfere with group row click handlers
        return;
      }
      
      // Ignore clicks on selection cells (they have their own handlers for selection)
      if (e.target.classList.contains('select-cell')) return;

      const rowId = tr.getAttribute('data-id');
      if (!rowId) return;

      // Set focus on this row (does not change selection)
      this.handleRowFocus(rowId);
    };
    tbody.addEventListener('click', tbody._delegatedClickHandler);

    const groups = this.groupObjects(this.sortObjects(filteredObjects));

    groups.forEach((group, index) => {
      if (this.groupByField) {
        const groupRow = document.createElement('tr');
        groupRow.classList.add('group-header'); // Match CSS styling
        groupRow.style.fontWeight = 'bold';
        groupRow.setAttribute('data-group-key', String(group.key)); // For CSS/debugging
        groupRow._groupKey = group.key; // Store original type
        if (this.collapsedGroups.has(group.key)) {
          groupRow.classList.add('collapsed');
        }
        // Selection column (first)
        if (this.showCheckboxes) {
          const selectTd = document.createElement('td');
          // Use consistent grouping logic for filtering - only treat undefined/null as missing
          const groupRows = this.filteredData.filter(item => {
            const value = item[this.groupByField];
            const key = (value !== undefined && value !== null) ? value : '_GROUP_NULL_';
            return key === group.key;
          });
          const selectedCount = groupRows.filter(item => item.selected).length;
          if (selectedCount === 0) {
            selectTd.innerHTML = '☐';
          } else if (selectedCount === groupRows.length) {
            selectTd.innerHTML = '☑';
          } else {
            selectTd.innerHTML = '☒';
          }
          selectTd.className = 'checkbox-column select-cell';
          selectTd.onclick = (e) => {
            e.stopPropagation();
            // Recalculate selected count at click time with consistent grouping logic
            const currentGroupRows = this.filteredData.filter(item => {
              const value = item[this.groupByField];
              const key = (value !== undefined && value !== null) ? value : '_GROUP_NULL_';
              return key === group.key;
            });
            const currentSelectedCount = currentGroupRows.filter(item => item.selected).length;
            const selectAll = currentSelectedCount !== currentGroupRows.length;
            currentGroupRows.forEach(item => {
              item.selected = selectAll;
            });
            
            this.updateVisualSelectionStates();
            this.updateInfoSection();
            if (this.onSelectionChange) this.onSelectionChange(this.getSelectedRows());
          };
          groupRow.appendChild(selectTd);
        }
        // Group label/value cell with reduced colspan
        const groupCell = document.createElement('td');
        groupCell.colSpan = (this.showCheckboxes ? this.currentColumns.length + 1 : this.currentColumns.length) - 1;

        // Use label from grouped column definition
        const groupedCol = this.originalColumns.find(col => col.field === this.groupByField);
        let renderedValue;
        if (group.key === undefined || group.key === null || group.key === '_GROUP_NULL_') {
          renderedValue = `${groupedCol ? groupedCol.label : this.groupByField} not defined`;
        } else if (groupedCol && typeof groupedCol.render === 'function') {
          // Use the render function for the group value with original data type preserved
          renderedValue = groupedCol.render(group.key, undefined);
        } else {
          renderedValue = group.key;
        }
        // Arrow indicator
        const arrow = `<span style="display:inline-block;width:18px;text-align:center;">${this.collapsedGroups.has(group.key) ? '▶' : '▼'}</span>`;
        groupCell.innerHTML = `${arrow}${renderedValue} <span style="color:#888;font-size:0.95em;">(${group.items.length})</span>`;
        groupRow.appendChild(groupCell);
        tbody.appendChild(groupRow);

        // Click to toggle collapse/expand and focus
        groupRow.addEventListener('click', (e) => {
          // Focus the group row
          this.focusedRow = `group_${group.key}`;
          this.updateVisualSelectionStates();
          
          // Call onRowFocus with undefined for group headers
          if (this.onRowFocus) {
            this.onRowFocus(undefined);
          }
          
          // Toggle collapse/expand
          if (this.collapsedGroups.has(group.key)) {
            this.collapsedGroups.delete(group.key);
          } else {
            this.collapsedGroups.add(group.key);
          }
          this.renderObjects(this.filteredData);
          this.synchronizeColumnWidths();
        });

        if (!this.collapsedGroups.has(group.key)) {
          this.renderRows(group.items, tbody, index);
        }
      } else {
        this.renderRows(group.items, tbody);
      }
    });

    this.tableForBody.appendChild(tbody);
    this.updateVisualSelectionStates();
    this.updateInfoSection();
  }

  renderRows(objects, tbody, groupIndex = null) {
    objects.forEach(obj => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-id', obj[this.primaryKeyField]);
      // Selection column (first)
      if (this.showCheckboxes) {
        const td = document.createElement('td');
        td.className = 'checkbox-column select-cell';
        td.innerHTML = obj.selected ? '☑' : '☐';
        td.onclick = (e) => {
          e.stopPropagation();
          const isSelected = !obj.selected;
          obj.selected = isSelected;
          
          // Call handleSelectionChange to properly set lastSelectedRow
          this.handleSelectionChange(obj[this.primaryKeyField], isSelected);
        };
        tr.appendChild(td);
      }

      // Other columns
      this.currentColumns.forEach((col) => {
        if (col.field === 'selected') return; // already rendered
        
        const td = document.createElement('td');
        
        // For the grouped column, render as empty
        if (this.groupByField && col.field === this.groupByField) {
          td.classList.add('grouped-column');
          td.textContent = '';
        } else {
          // Regular column rendering
          if (typeof col.render === 'function') {
            td.innerHTML = col.render(obj[col.field], obj);
          } else {
            td.textContent = obj[col.field] ?? '';
          }
        }
        
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  synchronizeColumnWidths() {
    const headerThs = this.tableForHeader.querySelectorAll('thead tr:first-child th');
    const bodyThs = this.tableForBody.querySelectorAll('thead tr:first-child th');
    
    if (headerThs.length === bodyThs.length) {
      // Get container width but constrain it to viewport width for better responsiveness
      const rawContainerWidth = this.tableForHeader.parentElement.offsetWidth;
      const viewportWidth = window.innerWidth;
      const containerWidth = Math.min(rawContainerWidth, viewportWidth - 40); // 40px for margins
      
      let usedWidth = 0;
      let flexibleColumns = [];
      
      // First pass: handle fixed-size columns and collect flexible ones
      headerThs.forEach((headerTh, i) => {
        const bodyTh = bodyThs[i];
        if (!bodyTh) return;
        
        // Find the corresponding column definition
        let column = null;
        if (this.showCheckboxes && i === 0) {
          // Selection column - always fixed small
          const selectionWidth = '32px';
          headerTh.style.width = selectionWidth;
          headerTh.style.minWidth = selectionWidth;
          headerTh.style.maxWidth = selectionWidth;
          bodyTh.style.width = selectionWidth;
          bodyTh.style.minWidth = selectionWidth;
          bodyTh.style.maxWidth = selectionWidth;
          usedWidth += 32;
          return;
        }
        
        // Find column definition (adjust index for selection column)
        const columnIndex = this.showCheckboxes ? i - 1 : i;
        column = this.currentColumns[columnIndex];
        
        if (column && column.responsive) {
          const { size } = column.responsive;
          
          if (size.startsWith('fixed-')) {
            // Fixed size columns
            let width = '';
            switch (size) {
              case 'fixed-narrow':
                width = '60px'; // Reduced from 80px
                usedWidth += 60;
                break;
              case 'fixed-medium':
                width = '100px'; // Reduced from 120px
                usedWidth += 100;
                break;
              case 'fixed-wide':
                width = '160px'; // Reduced from 180px
                usedWidth += 160;
                break;
            }
            
            if (width) {
              headerTh.style.width = width;
              headerTh.style.minWidth = width;
              headerTh.style.maxWidth = width;
              bodyTh.style.width = width;
              bodyTh.style.minWidth = width;
              bodyTh.style.maxWidth = width;
            }
          } else if (size.startsWith('flexible-')) {
            // Flexible columns - handle in second pass
            flexibleColumns.push({
              headerTh,
              bodyTh,
              size,
              weight: size === 'flexible-small' ? 1 : 
                     size === 'flexible-medium' ? 2 : 
                     size === 'flexible-large' ? 4 : 1
            });
          }
        }
      });
      
      // Second pass: distribute remaining space among flexible columns
      const remainingWidth = containerWidth - usedWidth - 40; // Increased from 20px to 40px for more padding
      const totalWeight = flexibleColumns.reduce((sum, col) => sum + col.weight, 0);
      
      if (totalWeight > 0 && remainingWidth > 0) {
        flexibleColumns.forEach(({ headerTh, bodyTh, size, weight }) => {
          const columnWidth = Math.floor((remainingWidth * weight) / totalWeight);
          const minWidth = size === 'flexible-small' ? '50px' :  // Reduced from 60px
                          size === 'flexible-medium' ? '80px' :  // Reduced from 100px
                          size === 'flexible-large' ? '120px' : '50px'; // Reduced from 150px
          
          // Set reasonable maximum widths to prevent columns from becoming too wide
          const maxWidth = size === 'flexible-small' ? '120px' :
                          size === 'flexible-medium' ? '250px' :
                          size === 'flexible-large' ? '400px' : '200px';
          
          const finalWidth = Math.min(Math.max(columnWidth, parseInt(minWidth)), parseInt(maxWidth));
          
          headerTh.style.width = `${finalWidth}px`;
          headerTh.style.minWidth = minWidth;
          headerTh.style.maxWidth = maxWidth;
          bodyTh.style.width = `${finalWidth}px`;
          bodyTh.style.minWidth = minWidth;
          bodyTh.style.maxWidth = maxWidth;
        });
      }
    }
  }

  renderAndSync(filteredObjects) {
    this.renderObjects(filteredObjects);
    this.synchronizeColumnWidths();
  }

  applyQuery(query) {
    const filteredIds = this.queryEngine.filterObjects(query);
    const filteredObjects = this.data.filter(obj => filteredIds.includes(obj.id));
    this.renderAndSync(filteredObjects);
    return filteredObjects;
  }

  handleQueryChange() {
    const query = this.model.getValue();
    const markers = this.monaco.editor.getModelMarkers({ resource: this.model.uri });
    const hasErrors = markers.some(m => m.severity === this.monaco.MarkerSeverity.Error);
    if (!hasErrors) {
      this.editorContainer.classList.remove('error');
      this.applyQuery(query);
    } else {
      this.editorContainer.classList.add('error');
    }
  }

  _setupQueryListeners() {
    // Also check on content changes with debouncing
    let errorTimeout;
    this.model.onDidChangeContent(() => {
      if (errorTimeout) clearTimeout(errorTimeout);
      errorTimeout = setTimeout(() => this.handleQueryChange(), 350);
    });
  }

  _setupScrollAndResize() {

    this.tableForBody.parentElement.addEventListener('scroll', e => {
      this.tableForHeader.parentElement.scrollLeft = e.target.scrollLeft;
    });
    window.addEventListener('resize', () => {
      this.synchronizeColumnWidths();
    });

  }

  _setupGroupByDropdown() {

    if (!this.groupBySelect) return;

    // Only add groupable columns
    this.columns.forEach(col => {
      if (col.groupable) {
        const option = document.createElement('option');
        option.value = col.field;
        option.textContent = col.label;
        this.groupBySelect.appendChild(option);
      }
    });

    this.groupBySelect.addEventListener('change', e => {
      this.groupByField = e.target.value || '';
      this.isNewGrouping = true;
      this.updateColumnOrder();
      const filteredIds = this.queryEngine.filterObjects(this.model.getValue());
      this.renderAndSync(this.data.filter(obj => filteredIds.includes(obj.id)));
      // Ensure selection states are recalculated after grouping change
      if (this.showCheckboxes) {
        setTimeout(() => this.updateVisualSelectionStates(), 0);
      }
    });
  }

  _setupKeyboardNavigation() {
    // Keyboard navigation is handled on the body container (which already has tabindex=0)
    // No need to set tabindex again since it's already set in the constructor
    
    this.bodyContainer.addEventListener('keydown', (e) => {
      // Only handle keyboard navigation if the body container has focus
      if (document.activeElement !== this.bodyContainer) return;
      
      // Get all focusable elements (both group headers and data rows) in display order
      const focusableElements = this.getFocusableElementsInDisplayOrder();
      if (focusableElements.length === 0) return;
      
      let currentIndex = -1;
      if (this.focusedRow) {
        currentIndex = focusableElements.findIndex(element => {
          if (element.type === 'group') {
            return this.focusedRow === `group_${element.key}`;
          } else {
            return String(element.item[this.primaryKeyField]) === this.focusedRow;
          }
        });
      }
      
      console.log('Keyboard navigation:', e.key, 'currentIndex:', currentIndex, 'focusedRow:', this.focusedRow, 'focusableElements length:', focusableElements.length);
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (currentIndex === -1) {
            // If no row is focused, focus the first element when going down
            const firstElement = focusableElements[0];
            this.handleElementFocus(firstElement);
          } else if (currentIndex < focusableElements.length - 1) {
            const nextElement = focusableElements[currentIndex + 1];
            this.handleElementFocus(nextElement);
          }
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          if (currentIndex === -1) {
            // If no row is focused, focus the last element when going up
            const lastElement = focusableElements[focusableElements.length - 1];
            this.handleElementFocus(lastElement);
          } else if (currentIndex > 0) {
            const prevElement = focusableElements[currentIndex - 1];
            this.handleElementFocus(prevElement);
          }
          break;
          
        case 'ArrowRight':
          e.preventDefault();
          if (this.focusedRow && this.focusedRow.startsWith('group_')) {
            // Expand the focused group
            const groupKeyString = this.focusedRow.replace('group_', '');
            // Convert string back to original type for proper lookup
            const groupKey = this.parseGroupKey(groupKeyString);
            console.log('Arrow Right: groupKeyString =', groupKeyString, 'groupKey =', groupKey, 'collapsedGroups has?', this.collapsedGroups.has(groupKey));
            // Use the same key format as click handlers (don't convert back to null)
            if (this.collapsedGroups.has(groupKey)) {
              this.collapsedGroups.delete(groupKey);
              this.renderAndSync(this.filteredData);
            }
          }
          break;
          
        case 'ArrowLeft':
          e.preventDefault();
          if (this.focusedRow && this.focusedRow.startsWith('group_')) {
            // Collapse the focused group
            const groupKeyString = this.focusedRow.replace('group_', '');
            // Convert string back to original type for proper lookup
            const groupKey = this.parseGroupKey(groupKeyString);
            console.log('Arrow Left: groupKeyString =', groupKeyString, 'groupKey =', groupKey, 'collapsedGroups has?', this.collapsedGroups.has(groupKey));
            // Use the same key format as click handlers (don't convert back to null)
            if (!this.collapsedGroups.has(groupKey)) {
              this.collapsedGroups.add(groupKey);
              this.renderAndSync(this.filteredData);
            }
          }
          break;
          
        case ' ': // Space bar
        case 'Enter':
          e.preventDefault();
          console.log('Space/Enter pressed, focusedRow:', this.focusedRow);
          if (this.focusedRow) {
            if (this.focusedRow.startsWith('group_')) {
              if (this.showCheckboxes) {
                // Toggle group selection (select all or deselect all in the group)
                const groupKeyString = this.focusedRow.replace('group_', '');
                const groupKey = this.parseGroupKey(groupKeyString);
                
                // Get all rows in this group using the same logic as the click handler
                const currentGroupRows = this.filteredData.filter(item => {
                  const value = item[this.groupByField];
                  const key = (value !== undefined && value !== null) ? value : '_GROUP_NULL_';
                  return key === groupKey;
                });
                
                const currentSelectedCount = currentGroupRows.filter(item => item.selected).length;
                const selectAll = currentSelectedCount !== currentGroupRows.length;
                
                console.log('Group selection toggle:', groupKeyString, '->', groupKey, 'selectAll:', selectAll, 'groupRows:', currentGroupRows.length);
                
                // Select all or deselect all items in the group
                currentGroupRows.forEach(item => {
                  item.selected = selectAll;
                });
                
                this.updateVisualSelectionStates();
                this.updateInfoSection();
                if (this.onSelectionChange) this.onSelectionChange(this.getSelectedRows());
              } else {
                // If no checkboxes, just toggle group expansion/collapse
                const groupKeyString = this.focusedRow.replace('group_', '');
                const groupKey = this.parseGroupKey(groupKeyString);
                console.log('Toggling group expansion:', groupKeyString, '->', groupKey);
                if (this.collapsedGroups.has(groupKey)) {
                  this.collapsedGroups.delete(groupKey);
                } else {
                  this.collapsedGroups.add(groupKey);
                }
                this.renderAndSync(this.filteredData);
              }
            } else if (this.showCheckboxes) {
              // Toggle selection of focused data row
              const rowData = this.data.find(item => String(item[this.primaryKeyField]) === this.focusedRow);
              console.log('Toggling selection for data row:', this.focusedRow, rowData);
              if (rowData) {
                rowData.selected = !rowData.selected;
                this.updateVisualSelectionStates();
                this.updateInfoSection();
                if (this.onSelectionChange) this.onSelectionChange(this.getSelectedRows());
              }
            }
          }
          break;
      }
    });

    // Focus the body container when a row is clicked so keyboard navigation works
    this.tableForBody.addEventListener('click', () => {
      this.bodyContainer.focus();
    });
  }

  // Helper method to convert group key string back to original type
  parseGroupKey(groupKeyString) {
    // Handle special null/undefined case
    if (groupKeyString === '_GROUP_NULL_') {
      return '_GROUP_NULL_';
    }
    
    // Try to convert back to boolean
    if (groupKeyString === 'true') return true;
    if (groupKeyString === 'false') return false;
    
    // Try to convert back to number
    const num = Number(groupKeyString);
    if (!isNaN(num) && String(num) === groupKeyString) {
      return num;
    }
    
    // Return as string if no conversion applies
    return groupKeyString;
  }

  // Helper method to handle focus for both data rows and group headers
  handleElementFocus(element) {
    if (element.type === 'group') {
      // Focusing a group header
      this.focusedRow = `group_${element.key}`;
      this.updateVisualSelectionStates();
      
      // Scroll focused group row into view
      this.scrollToFocusedRow();
      
      // Call onRowFocus with undefined for group headers
      if (this.onRowFocus) {
        this.onRowFocus(undefined);
      }
    } else {
      // Focusing a data row
      const rowId = String(element.item[this.primaryKeyField]);
      this.handleRowFocus(rowId);
    }
  }

  // Helper method to scroll the focused row into view
  scrollToFocusedRow() {
    if (!this.focusedRow) return;
    
    let targetRow = null;
    
    if (this.focusedRow.startsWith('group_')) {
      // Find the focused group row
      const groupKeyString = this.focusedRow.replace('group_', '');
      // Find the group row with matching data-group-key
      targetRow = this.tableForBody.querySelector(`tr.group-header[data-group-key="${groupKeyString}"]`);
    } else {
      // Find the focused data row
      targetRow = this.tableForBody.querySelector(`tr[data-id="${this.focusedRow}"]`);
    }
    
    if (targetRow) {
      // Get the body container that has the scroll
      const bodyContainer = this.tableForBody.closest('.smart-table-body-container');
      if (bodyContainer) {
        // Calculate if the row is visible
        const containerRect = bodyContainer.getBoundingClientRect();
        const rowRect = targetRow.getBoundingClientRect();
        
        // Check if row is above the visible area
        if (rowRect.top < containerRect.top) {
          // Scroll up to show the row at the top with some padding
          const scrollTop = bodyContainer.scrollTop + (rowRect.top - containerRect.top) - 10;
          bodyContainer.scrollTo({
            top: Math.max(0, scrollTop),
            behavior: 'smooth'
          });
        }
        // Check if row is below the visible area
        else if (rowRect.bottom > containerRect.bottom) {
          // Scroll down to show the row at the bottom with some padding
          const scrollTop = bodyContainer.scrollTop + (rowRect.bottom - containerRect.bottom) + 10;
          bodyContainer.scrollTo({
            top: scrollTop,
            behavior: 'smooth'
          });
        }
        // If row is already visible, no scrolling needed
      }
    }
  }

  // Helper method to get all focusable elements (groups + data rows) in display order
  getFocusableElementsInDisplayOrder() {
    const focusableElements = [];
    
    if (!this.groupByField) {
      // No grouping - just return sorted data as focusable elements
      const sortedData = this.sortObjects(this.filteredData);
      sortedData.forEach(item => {
        focusableElements.push({ type: 'data', item });
      });
    } else {
      // With grouping - include group headers and their data rows
      const groups = this.groupObjects(this.sortObjects(this.filteredData));
      
      groups.forEach(group => {
        // Add the group header as focusable
        focusableElements.push({ type: 'group', key: group.key });
        
        // Add data rows if group is not collapsed
        if (!this.collapsedGroups.has(group.key)) {
          group.items.forEach(item => {
            focusableElements.push({ type: 'data', item });
          });
        }
      });
    }
    
    return focusableElements;
  }

  // Helper method to get data in the exact display order (grouped and sorted)
  getDataInDisplayOrder() {
    if (!this.groupByField) {
      // No grouping - just return sorted data
      return this.sortObjects(this.filteredData);
    }
    
    // With grouping - get data in the same order as displayed
    const groups = this.groupObjects(this.sortObjects(this.filteredData));
    const displayOrderData = [];
    
    groups.forEach(group => {
      // Skip collapsed groups
      if (this.collapsedGroups.has(group.key)) {
        return;
      }
      
      // Add all items from this group in order
      group.items.forEach(item => {
        displayOrderData.push(item);
      });
    });
    
    return displayOrderData;
  }

  // Helper method to get visible data rows (excluding group headers)
  getVisibleDataRows() {
    const tbody = this.tableForBody.querySelector('tbody');
    if (!tbody) return [];
    
    return Array.from(tbody.querySelectorAll('tr[data-id]:not(.group-header):not(.group-collapsed)'));
  }

  // ========== Öffentliche API ==========
  refresh() {
    this.renderAndSync(this.data);
  }

  filter(query) {
    this.model.setValue(query);
    const markers = this.monaco.editor.getModelMarkers({ resource: this.model.uri });
    const hasErrors = markers.some(m => m.severity === this.monaco.MarkerSeverity.Error);
    if (!hasErrors) {
      this.editorContainer.classList.remove('error');
      return this.applyQuery(query);
    } else {
      this.editorContainer.classList.add('error');
      return this.data;
    }
  }

  sort(field, direction) {
    this.sortField = field;
    this.sortDirection = direction || 'asc';
    const filteredIds = this.queryEngine.filterObjects(this.model.getValue());
    this.renderAndSync(this.data.filter(obj => filteredIds.includes(obj.id)));
  }

  group(field) {
    this.groupByField = field;
    // Update the group-by select field if set programmatically
    if (this.groupBySelect) {
      this.groupBySelect.value = field || '';
    }
    this.updateColumnOrder();
    // Collapse all groups by default
    const filteredIds = this.queryEngine.filterObjects(this.model.getValue());
    const groupedObjects = this.groupObjects(this.data.filter(obj => filteredIds.includes(obj.id)));
    this.collapsedGroups = new Set(groupedObjects.map(g => g.key));
    this.renderAndSync(this.data.filter(obj => filteredIds.includes(obj.id)));
    // Ensure selection states are recalculated after grouping change
    if (this.showCheckboxes) {
      setTimeout(() => this.updateVisualSelectionStates(), 0);
    }
  }

  getSelectedRows() {
    // Return all selected records
    return this.data.filter(item => item.selected);
  }
  getSelectedRowIds() {
    // Use primaryKey for selection
    return [...this.selectionOrder];
  }

  getSelectedCount() {
    return this.data.filter(item => item.selected).length;
  }

  getFocusedRow() {
    return this.focusedRow;
  }

  addRecord(record) {
    // Use primaryKey for uniqueness
    const pk = this.primaryKeyField;
    const pkValue = record[pk];
    if (pkValue === undefined) return; // ignore if no primaryKey value
    
    // Ensure selected attribute is set if showCheckboxes is enabled
    if (this.showCheckboxes && typeof record.selected === 'undefined') {
      record.selected = false;
    }
    
    const idx = this.data.findIndex(item => item[pk] === pkValue);
    if (idx !== -1) {
      // Replace existing record
      this.data[idx] = record;
    } else {
      // Add new record
      this.data.push(record);
    }
    this.refresh();
  }

  addRecords(records) {
    // Bulk add records with proper selected attribute handling
    if (!Array.isArray(records)) {
      console.warn('addRecords expects an array of records');
      return;
    }
    
    records.forEach(record => {
      // Use primaryKey for uniqueness
      const pk = this.primaryKeyField;
      const pkValue = record[pk];
      if (pkValue === undefined) return; // ignore if no primaryKey value
      
      // Ensure selected attribute is set if showCheckboxes is enabled
      if (this.showCheckboxes && typeof record.selected === 'undefined') {
        record.selected = false;
      }
      
      const idx = this.data.findIndex(item => item[pk] === pkValue);
      if (idx !== -1) {
        // Replace existing record
        this.data[idx] = record;
      } else {
        // Add new record
        this.data.push(record);
      }
    });
    
    this.refresh();
  }

  dispose() {
    // Clear any pending regrouping timeout
    if (this._regroupingTimeout) {
      clearTimeout(this._regroupingTimeout);
      this._regroupingTimeout = null;
    }
    
    this.editor.dispose();
    this.model.dispose();
    this.tableForBody.querySelector('tbody').innerHTML = '';
  }
}


class QueryEngine {
  constructor(objects = []) {
    this.objects = objects;
  }

  setObjects(objects) {
    this.objects = objects;
  }
 
  filterObjects(query) {
    if (!query.trim()) return this.objects.map(obj => obj.id);

    const hasOperators = /[=!<>()]|(\bAND\b|\bOR\b|\bIN\b)/i.test(query);

    if (!hasOperators) {
      return this.searchObjects(query);
    }

    const results = [];
    for (const obj of this.objects) {
      try {
        if (this.evaluateExpression(obj, query)) {
          results.push(obj.id);
        }
      } catch (error) {
        throw new Error(`Query error: ${error.message}`);
      }
    }
    return results;
  }

  searchObjects(searchTerms) {
    const terms = searchTerms.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return this.objects.map(obj => obj.id);

    const results = [];
    for (const obj of this.objects) {
      const searchableValues = Object.values(obj)
        .map(value => (value == null ? '' : String(value).toLowerCase()))
        .join(' ');

      const allTermsFound = terms.every(term => searchableValues.includes(term));
      if (allTermsFound) results.push(obj.id);
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

