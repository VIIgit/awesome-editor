import { setupLanguageConfiguration } from './language-config';
import { setupCompletionProvider } from './completion';
import { setupTokenProvider } from './tokens';
import { setupValidation } from './validation';
import { setupEditorTheme } from './theme';

/**
 * Sets up query language support for a Monaco editor instance
 * @param {object} monaco The Monaco editor instance
 * @param {object} options Configuration options
 * @param {object} options.fieldNames The field name definitions with types and valid values
 * @returns {object} The configured editor features
 */
// Track registered languages and their field schemas
const registeredLanguages = new Map();

// Generate a consistent ID for a given field schema
function generateLanguageId(fieldNames) {
  // Sort field names to ensure consistent order
  const sortedFields = Object.entries(fieldNames)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, def]) => `${name}:${def.type}`)
    .join(',');
  
  return `querylang-${sortedFields}`;
}

export function setupQueryLanguage(monaco, { fieldNames = {} } = {}) {
  // Generate language ID based on field schema
  const languageId = generateLanguageId(fieldNames);

  // Check if this language is already registered
  if (!registeredLanguages.has(languageId)) {
    // Register new language instance
    monaco.languages.register({ id: languageId });
    
    // Set up all language features
    const completionSetup = setupCompletionProvider(monaco, { fieldNames, languageId });
    const disposables = [
      setupLanguageConfiguration(monaco, languageId),
      setupTokenProvider(monaco, { fieldNames, languageId }),
      completionSetup.provider,
      setupValidation(monaco, { fieldNames, languageId })
    ];
    
    // Set up theme (shared across all instances)
    setupEditorTheme(monaco);

    // Store the registration with auto-insert setup
    registeredLanguages.set(languageId, { 
      fieldNames,
      setupAutoInsertBrackets: completionSetup.setupAutoInsertBrackets
    });
  }

  return {
    languageId,
    setupAutoInsertBrackets: registeredLanguages.get(languageId).setupAutoInsertBrackets
  };
}

/**
 * Creates a query editor instance with standardized configuration
 * @param {object} monaco The Monaco editor instance
 * @param {HTMLElement} container The container element for the editor
 * @param {object} options Configuration options
 * @param {object} options.fieldNames Field definitions for this editor instance
 * @param {string} [options.initialValue=''] Initial editor content
 * @param {string} [options.placeholder=''] Placeholder text when editor is empty
 * @returns {object} The created editor instance and its model
 */
export function createQueryEditor(monaco, container, { fieldNames = {}, initialValue = '', placeholder = '' } = {}) {
  // Set up language features for this editor instance
  const { languageId, setupAutoInsertBrackets } = setupQueryLanguage(monaco, { fieldNames });

  // Create editor model with initial value
  const model = monaco.editor.createModel(initialValue, languageId);

  // Create wrapper div for proper sizing
  const wrapper = document.createElement('div');
  wrapper.className = 'monaco-editor-container';
  container.appendChild(wrapper);

  // Create editor with standard configuration
  const editor = monaco.editor.create(wrapper, {
    model,
    theme: 'queryTheme',
    lineNumbers: 'off',
    minimap: { enabled: false },
    scrollbar: { 
      vertical: 'hidden', 
      horizontal: 'auto',
      horizontalScrollbarSize: 3,
      alwaysConsumeMouseWheel: false
    },
    overviewRulerLanes: 0,
    lineDecorationsWidth: 0,
    lineNumbersMinChars: 0,
    folding: false,
    scrollBeyondLastLine: false,
    wordWrap: 'off',
    renderLineHighlight: 'none',
    overviewRulerBorder: false,
    fixedOverflowWidgets: true,
    renderValidationDecorations: 'editable',
    automaticLayout: true,
    placeholder,
    smoothScrolling: true
  });

  // Set up auto-insert brackets functionality
  const autoInsertDisposable = setupAutoInsertBrackets(editor);

  // Prevent Enter key from adding newlines
  editor.onKeyDown((e) => {
    if (e.code === 'Enter') e.preventDefault();
  });

  // Add cleanup method to the editor
  const originalDispose = editor.dispose.bind(editor);
  editor.dispose = () => {
    autoInsertDisposable.dispose();
    originalDispose();
  };

  return { editor, model };
}
