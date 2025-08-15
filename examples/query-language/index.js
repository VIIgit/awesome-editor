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
    const { editor, model } = createQueryEditor(monaco, userQueryField, {
      fieldNames: userFields,
      placeholder: 'Enter user query (e.g., id > 5 AND active = true)'
    });

    // Add error handling for validation markers
    function updateErrorState() {
      const markers = monaco.editor.getModelMarkers({ resource: model.uri });
      const hasErrors = markers.some(marker => 
        marker.severity === monaco.MarkerSeverity.Error
      );
      
      if (hasErrors) {
        userQueryField.classList.add('error');
      } else {
        userQueryField.classList.remove('error');
      }
    }

    // Listen for marker changes
    monaco.editor.onDidChangeMarkers(([resource]) => {
      if (resource.toString() === model.uri.toString()) {
        updateErrorState();
      }
    });

    // Also check on content changes with debouncing
    let errorTimeout;
    model.onDidChangeContent(() => {
      if (errorTimeout) clearTimeout(errorTimeout);
      errorTimeout = setTimeout(updateErrorState, 350);
    });
  }

  // Create product query editor
  const productQueryField = document.getElementById('query-inputfield-2');
  if (productQueryField) {
    const { editor, model } = createQueryEditor(monaco, productQueryField, {
      fieldNames: productFields,
      placeholder: 'Enter product query (e.g., price < 100 AND inStock = true)'
    });

    // Add error handling for validation markers
    function updateErrorState() {
      const markers = monaco.editor.getModelMarkers({ resource: model.uri });
      const hasErrors = markers.some(marker => 
        marker.severity === monaco.MarkerSeverity.Error
      );
      
      if (hasErrors) {
        productQueryField.classList.add('error');
      } else {
        productQueryField.classList.remove('error');
      }
    }

    // Listen for marker changes
    monaco.editor.onDidChangeMarkers(([resource]) => {
      if (resource.toString() === model.uri.toString()) {
        updateErrorState();
      }
    });

    // Also check on content changes with debouncing
    let errorTimeout;
    model.onDidChangeContent(() => {
      if (errorTimeout) clearTimeout(errorTimeout);
      errorTimeout = setTimeout(updateErrorState, 350);
    });
  }

}