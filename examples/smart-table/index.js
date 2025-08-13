import * as monaco from 'monaco-editor';
import { setupSmartTable } from '@features/smart-table';
import './styles.css';

// Sample data
const data = [
  { id: 1, name: 'John Doe', age: 30, city: 'New York', active: true },
  { id: 2, name: 'Jane Smith', age: 25, city: 'Los Angeles', active: false },
  { id: 3, name: 'Bob Johnson', age: 35, city: 'Chicago', active: true },
  { id: 4, name: 'Alice Brown', age: 28, city: 'New York', active: false },
  { id: 5, name: 'Charlie Wilson', age: 32, city: 'Los Angeles', active: true },
  { id: 6, name: 'Eva Martinez', age: 27, city: 'Chicago', active: true },
  { id: 7, name: 'David Lee', age: 40, city: 'New York', active: false },
  { id: 8, name: 'Grace Taylor', age: 22, city: 'Los Angeles', active: true },
  { id: 9, name: 'Grace Taylor9', age: 2, city: 'Los Angeles', active: true },
  { id: 10, name: 'Grace Taylor10',  city: 'Los Angeles', active: true },
  { id: 11, name: 'Grace11 Taylor', age: 22, city: 'Los Angeles', active: true },
  { id: 12, name: 'no age, city, active' },
  { id: 13, name: 'Grace Taylor13', age: 22, city: 'Los Angeles', active: true }
];

// Column definitions with responsive metadata
const columns = [
  { 
    field: 'id', 
    header: 'ID', 
    responsive: { priority: 'low', size: 'fixed-narrow', hideMobile: true },
    groupable: false
  },
  { 
    field: 'name', 
    header: 'Name', 
    responsive: { priority: 'high', size: 'flexible-large', allowWrap: true },
    groupable: false
  },
  { 
    field: 'age', 
    header: 'Age', 
    render: (value) => `${value} years`,
    responsive: { priority: 'medium', size: 'fixed-medium', hideSmall: true },
    groupable: true
  },
  { 
    field: 'city', 
    header: 'City', 
    render: (value) => value ? `<a href="https://www.example.com?city=${encodeURIComponent(value)}" target="_blank" rel="noopener noreferrer">${value}</a>` : '',
    responsive: { priority: 'medium', size: 'flexible-medium', allowWrap: true },
    groupable: true
  },
  { 
    field: 'active', 
    header: 'Status', 
    render: (value) => value ? '✅ Active' : '❌ Inactive',
    responsive: { priority: 'high', size: 'flexible-small' },
    groupable: true
  }
];

// Initialize Monaco editor and smart table
const editorContainer = document.getElementById('query-input-container');
const table = document.getElementById('data-table');
const errorMessageElement = document.getElementById('error-message');

// Ensure DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSmartTable);
} else {
  initializeSmartTable();
}

function initializeSmartTable() {

  try {
    // Set up smart table with query language integration and new features
    const { editor, filter, getSelectedRows, getSelectedRowIds, getSelectedCount, addRecord } = setupSmartTable(monaco, {
      table,
      data,
      columns,
      editorContainer,
      showCheckboxes: false, // Enable checkboxes
      multiSelect: true, // Enable multi-selection
      onSelectionChange: (selectedData) => {
        // Log selection changes (last selected first)
        console.log('Selection changed:', selectedData.map(item => ({ id: item.id, name: item.name })));
        
        // You can add custom logic here, like updating other UI elements
        if (selectedData.length > 0) {
          console.log('Last selected:', selectedData[0]);
        }
      }
    });
    // Add the query-inputfield class for consistent styling
    editorContainer.classList.add('query-inputfield');

    // Add focus management for styling
    editor.onDidFocusEditorWidget(() => {
      editorContainer.classList.add('focused');
    });

    editor.onDidBlurEditorWidget(() => {
      editorContainer.classList.remove('focused');
    });

    // Group-by dropdown is automatically populated by the smart table

    // Add records button functionality
    const addRecordsBtn = document.getElementById('add-records-btn');
    let recordIdCounter = Math.max(...data.map(item => item.id)) + 1; // Start from highest existing ID + 1
    
    addRecordsBtn.addEventListener('click', () => {
      // Get existing cities to add records with both existing and new cities
      const existingCities = [...new Set(data.map(item => item.city).filter(Boolean))];
      const newCity = 'Miami'; // A new city to test with
      
      // Create 5 new records: 3 with existing cities, 2 with new city
      const newRecords = [
        { id: recordIdCounter++, name: `Test User ${recordIdCounter-1}`, age: 25 + Math.floor(Math.random() * 15), city: existingCities[0] || 'New York', active: true },
        { id: recordIdCounter++, name: `Test User ${recordIdCounter-1}`, age: 25 + Math.floor(Math.random() * 15), city: existingCities[1] || 'Los Angeles', active: false },
        { id: recordIdCounter++, name: `Test User ${recordIdCounter-1}`, age: 25 + Math.floor(Math.random() * 15), city: existingCities[2] || 'Chicago', active: true },
        { id: recordIdCounter++, name: `Test User ${recordIdCounter-1}`, age: 25 + Math.floor(Math.random() * 15), city: newCity, active: true },
        { id: recordIdCounter++, name: `Test User ${recordIdCounter-1}`, age: 25 + Math.floor(Math.random() * 15), city: newCity, active: false }
      ];
      
      // Add new records to the data array
      data.push(...newRecords);
      
      // Re-apply current filter to maintain filtering, grouping, and selections
      const currentQuery = editor.getValue();
      filter(currentQuery); // This will refresh the table with new data while maintaining current state
      
      console.log('Added 5 new test records:', newRecords);
      console.log('Total records now:', data.length);
    });

    // Add single record button functionality
    const addSingleRecordBtn = document.getElementById('add-single-record-btn');
    addSingleRecordBtn.addEventListener('click', () => {
      // Get existing cities to choose from
      const existingCities = [...new Set(data.map(item => item.city).filter(Boolean))];
      const cities = [...existingCities, 'Miami', 'Seattle', 'Austin'];
      const randomCity = cities[Math.floor(Math.random() * cities.length)];
      
      // Create a single new record
      const newRecord = {
        name: `New User ${recordIdCounter}`,
        age: 20 + Math.floor(Math.random() * 40), // Age between 20-59
        city: randomCity,
        active: Math.random() > 0.5, // Random boolean
        status: Math.random() > 0.5 ? 'active' : 'inactive'
      };
      
      // Use the new addRecord function which will auto-select the new record
      const addedRecord = addRecord(newRecord);
      recordIdCounter++;
      
      console.log('Added new record:', addedRecord);
      console.log('Total records now:', data.length);
    });

    // Function to try a sample query
    window.tryQuery = (query) => {
      filter(query);
    };

    // Function to get current selection (demonstrates the new features)
    window.getSelection = () => {
      const selected = getSelectedRows();
      console.log('Currently selected rows (last selected first):', selected);
      console.log('Selected count:', getSelectedCount());
      console.log('Selected IDs:', getSelectedRowIds());
      return selected;
    };

    // Function to demonstrate single-select mode
    window.toggleSingleSelect = () => {
      console.log('Note: To enable single-select mode, reinitialize the table with multiSelect: false');
    };

    // Example of how to add a new column dynamically
    window.addColumn = (field, header, responsive = {}) => {
      columns.push({ 
        field, 
        header, 
        responsive: {
          priority: 'medium',
          size: 'flexible-small',
          ...responsive
        }
      });
      // Re-initialize the table (in a real app, you'd call a refresh method)
      console.log('Column added:', { field, header, responsive });
    };

    // Example usage in console:
    // addColumn('department', 'Department', { priority: 'low', size: 'flexible-medium', hideMobile: true });

  } catch (error) {
    console.error('Error setting up smart table:', error);
  }
}
