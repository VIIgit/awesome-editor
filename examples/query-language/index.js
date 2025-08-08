import * as monaco from 'monaco-editor';
import { createQueryEditor } from '../../src/features/query-language';


// Define field schemas for different query editors
const userFields = {
  id: { type: 'number' },
  name: { type: 'string', values: ['Alice', 'Bob', 'Charlie'] },
  groupName: { type: 'string', values: ['Admin', 'User', 'Guest'] },
  active: { type: 'boolean' }
};

const productFields = {
  productId: { type: 'number' },
  productName: { type: 'string' },
  category: { type: 'string', values: ['Electronics', 'Books', 'Clothing'] },
  inStock: { type: 'boolean' },
  price: { type: 'number' }
};

// Use a self-executing function to initialize once
(() => {
  if (!window.editorInitialized) {
    window.editorInitialized = true;
    initializeEditors();
  }
})();

function initializeEditors() {
  // Create user query editor
  const userQueryField = document.getElementById('query-inputfield-1');
  if (userQueryField) {
    const { editor } = createQueryEditor(monaco, userQueryField, {
      fieldNames: userFields,
      placeholder: 'Enter user query (e.g., id > 5 AND active = true)'
    });
    
    // Add modern input field focus/blur behavior
    editor.onDidFocusEditorWidget(() => {
      userQueryField.classList.add('focused');
    });
    
    editor.onDidBlurEditorWidget(() => {
      userQueryField.classList.remove('focused');
    });
  }

  // Create product query editor
  const productQueryField = document.getElementById('query-inputfield-2');
  if (productQueryField) {
    const { editor } = createQueryEditor(monaco, productQueryField, {
      fieldNames: productFields,
      placeholder: 'Enter product query (e.g., price < 100 AND inStock = true)'
    });
    
    // Add modern input field focus/blur behavior
    editor.onDidFocusEditorWidget(() => {
      productQueryField.classList.add('focused');
    });
    
    editor.onDidBlurEditorWidget(() => {
      productQueryField.classList.remove('focused');
    });
  }

}