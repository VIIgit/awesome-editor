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
  { id: 8, name: 'Grace Taylor', age: 22, city: 'Los Angeles', active: true }
];

// Column definitions
const columns = [
  { field: 'id', header: 'ID' },
  { field: 'name', header: 'Name' },
  { field: 'age', header: 'Age', render: (value) => `${value} years` },
  { field: 'city', header: 'City' },
  { field: 'active', header: 'Status', render: (value) => value ? '✅ Active' : '❌ Inactive' }
];

// Initialize Monaco editor
const editorContainer = document.getElementById('editor-container');
const table = document.getElementById('data-table');

// Set up smart table
const { editor, filter } = setupSmartTable(monaco, {
  table,
  data,
  columns,
  editorContainer
});

// Function to try a sample query
window.tryQuery = (query) => {
  filter(query);
};

// Create example query buttons
const sampleQueries = [
  'age > 30',
  'active = true AND city = "New York"',
  'age < 30 OR city IN ["Chicago", "Los Angeles"]'
];

const buttonsContainer = document.createElement('div');
buttonsContainer.className = 'example-buttons';
sampleQueries.forEach(query => {
  const button = document.createElement('button');
  button.textContent = `Try: ${query}`;
  button.onclick = () => tryQuery(query);
  buttonsContainer.appendChild(button);
});
editorContainer.parentNode.insertBefore(buttonsContainer, editorContainer);

// Initial layout
editor.layout({
  width: editorContainer.clientWidth,
  height: 20 // Single line editor
});

// Handle window resize
let resizeTimer;
window.addEventListener('resize', () => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    editor.layout({
      width: editorContainer.clientWidth,
      height: 20
    });
  }, 100);
});

// Cleanup
window.addEventListener('unload', () => {
  if (resizeTimer) clearTimeout(resizeTimer);
});
