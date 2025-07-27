import * as monaco from 'monaco-editor';
import { setupJsonValidation } from '../../src/features/json-schema-validation';
import { schema, PROPERTIES } from './schema';
import './styles.css';

let monacoEditor;

function initializeEditor() {
    if (monacoEditor) {
        // If editor exists, just re-setup the features
        setupJsonValidation(monacoEditor, {
            schema,
            properties: PROPERTIES
        });
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

    // Add JSON schema validation feature
    setupJsonValidation(monacoEditor, {
        schema,
        properties: PROPERTIES
    });

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
