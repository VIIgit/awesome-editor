import * as monaco from 'monaco-editor';
import { setupJsonValidation, setupHoverProvider } from '../../src/features/json-schema-validation';
import { schema, PROPERTIES } from './schema';
import { PERSON_DETAILS } from './person-details';
import './styles.css';

let monacoEditor;

// Configure the editor features
function setupEditorFeatures() {
  // Add JSON schema validation feature
  setupJsonValidation(monacoEditor, {
    schema,
    properties: PROPERTIES
  });

  // Add hover support
  setupHoverProvider({
    detailsProvider: (name) => PERSON_DETAILS[name],
    // Optional: customize the hover content
    contentTemplate: (word, details) => [
      { value: `**${word} ${details.lastName}**` },
      { value: '---' },
      { value: `Age: ${details.age}` },
      { value: `Role: ${details.role}` },
      { value: `Link: [example](https://example.com)` }
    ]
  });
}

function initializeEditor() {
  if (monacoEditor) {
    // If editor exists, just re-setup the features
    setupEditorFeatures();
    return;
  }

  // First create a Monaco editor instance
  monacoEditor = monaco.editor.create(document.getElementById('editor-container'), {
    language: 'json',
    theme: 'vs-dark',
    automaticLayout: true,
    value: JSON.stringify({
      id: 1,
      name: "John Doe",
      address: {
        name: "Alpha Beta"
      }
    }, null, 2)
  });

  // Set up features
  setupEditorFeatures();

  // Clean up on unload
  window.addEventListener('unload', () => {
    monacoEditor?.dispose();
  });
}

// Initialize on DOM content loaded
document.addEventListener('DOMContentLoaded', initializeEditor);

// Support hot module replacement
if (module.hot) {
  module.hot.accept(['../../src/features/json-schema-validation', './schema'], () => {
    console.log('Hot reloading validation feature...');
    initializeEditor();
  });
}
