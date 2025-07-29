import * as monaco from 'monaco-editor';
import { setupQueryLanguage } from '../../src/features/query-language';
import './styles.css';

const fieldNames = {
  id: { type: 'number' },
  name: { type: 'string', values: ['Alice', 'Bob', 'Charlie'] },
  groupName: { type: 'string', values: ['Admin', 'User', 'Guest'] },
  active: { type: 'boolean' },
  TE: { type: 'string' }
};


// Initialize query language support
const { languageId } = setupQueryLanguage(monaco, { fieldNames });

// Create editor model
const model = monaco.editor.createModel('', languageId);

// Get the root container and clean up any existing content
const rootContainer = document.getElementById('container');
rootContainer.innerHTML = ''; // Clear any existing content

// Create editor directly in the root container
const editor = monaco.editor.create(rootContainer, {
  model,
  language: languageId,
  theme: 'queryTheme',
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
  automaticLayout: false, // Disable automatic layout
  fixedOverflowWidgets: true, // Fix overflow widgets positioning
  placeholder: 'Enter query here (e.g., id > 5 AND active = true)'
})
  .onKeyDown((e) => {
    // Prevent Enter key from adding newlines
    if (e.code === 'Enter') e.preventDefault();
  });
/*
// Manual layout handling
const resizeObserver = new ResizeObserver(() => {
  // Debounce the layout call
  if (editor) {
    requestAnimationFrame(() => {
      editor.layout();
    });
  }
});

// Observe container size changes
resizeObserver.observe(rootContainer);
*/
