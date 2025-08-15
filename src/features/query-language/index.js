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
 * @param {boolean} [options.showClearButton=true] Whether to show the clear button
 * @returns {object} The created editor instance and its model
 */
export function createQueryEditor(monaco, container, { fieldNames = {}, initialValue = '', placeholder = '', showClearButton = true } = {}) {
  // Set up language features for this editor instance
  const { languageId, setupAutoInsertBrackets } = setupQueryLanguage(monaco, { fieldNames });

  // Create editor model with initial value
  const model = monaco.editor.createModel(initialValue, languageId);

  // Create wrapper div for proper sizing with clear button container
  const wrapper = document.createElement('div');
  wrapper.className = 'monaco-editor-wrapper';
  wrapper.style.cssText = `
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
  `;
  container.appendChild(wrapper);

  // Create editor container
  const editorContainer = document.createElement('div');
  editorContainer.style.cssText = `
    flex: 1;
    height: 100%;
    padding-right: ${showClearButton ? '30px' : '0px'};
  `;
  wrapper.appendChild(editorContainer);

  let clearButton = null;
  let updateClearButtonVisibility = null;

  // Create clear button if enabled
  if (showClearButton) {
    clearButton = document.createElement('button');
    clearButton.className = 'query-clear-button';
    clearButton.innerHTML = '✕';
    clearButton.title = 'Clear query';
    clearButton.style.cssText = `
      position: absolute;
      right: 5px;
      top: 40%;
      transform: translateY(-50%);
      width: 20px;
      height: 20px;
      border: 1px solid #d1d5db;
      background: #f9fafb;
      color: #6b7280;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: bold;
      line-height: 1;
      display: none;
      z-index: 1000;
      transition: all 0.15s ease;
      outline: none;
      padding: 0;
      font-family: monospace;
    `;

    // Add hover and focus effects
    clearButton.addEventListener('mouseenter', () => {
      clearButton.style.background = '#fef2f2';
      clearButton.style.color = '#dc2626';
      clearButton.style.borderColor = '#fca5a5';
      clearButton.style.transform = 'translateY(-50%) scale(1.05)';
    });

    clearButton.addEventListener('mouseleave', () => {
      clearButton.style.background = '#f9fafb';
      clearButton.style.color = '#6b7280';
      clearButton.style.borderColor = '#d1d5db';
      clearButton.style.transform = 'translateY(-50%) scale(1)';
    });

    // Add clear functionality
    clearButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      model.setValue('');
      editor.focus();
      if (updateClearButtonVisibility) {
        updateClearButtonVisibility();
      }
    });

    wrapper.appendChild(clearButton);

    // Function to toggle clear button visibility based on content
    updateClearButtonVisibility = function() {
      const hasContent = model.getValue().trim().length > 0;
      clearButton.style.display = hasContent ? 'block' : 'none';
    };
  }

  // Create editor with standard configuration
  const editor = monaco.editor.create(editorContainer, {
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
    smoothScrolling: true,
    // Enhanced suggestion settings for auto-triggering
    suggestOnTriggerCharacters: true,
    quickSuggestions: {
      other: true,
      comments: false,
      strings: false
    },
    quickSuggestionsDelay: 100, // Faster suggestions
    suggestFontSize: 13,
    suggestLineHeight: 20,
    suggest: {
      insertMode: 'insert',
      showStatusBar: false
    }
  });

  // Set up auto-insert brackets functionality
  const autoInsertDisposable = setupAutoInsertBrackets(editor);

  let contentChangeDisposable = null;

  // Listen for content changes to show/hide clear button
  if (showClearButton && updateClearButtonVisibility) {
    contentChangeDisposable = model.onDidChangeContent(() => {
      updateClearButtonVisibility();
    });

    // Initial visibility check
    updateClearButtonVisibility();
  }

  // Prevent Enter key from adding newlines, but allow it for accepting suggestions
  editor.onKeyDown((e) => {
    if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      // Check if the suggestion widget is visible using the correct Monaco API
      const suggestController = editor.getContribution('editor.contrib.suggestController');
      const isSuggestWidgetVisible = suggestController && suggestController.model && suggestController.model.state !== 0;
      
      // If suggestions are visible, allow Enter to accept them
      if (isSuggestWidgetVisible) {
        return; // Let Monaco handle the suggestion acceptance
      }
      
      // Otherwise, prevent Enter from adding newlines
      e.preventDefault();
      e.stopPropagation();
    }
  });

  // Also prevent paste operations that contain newlines
  editor.onDidPaste((e) => {
    const currentValue = model.getValue();
    // Remove any carriage return or line feed characters
    const cleanValue = currentValue.replace(/[\r\n]/g, ' ');
    if (cleanValue !== currentValue) {
      model.setValue(cleanValue);
    }
  });

  // Prevent newlines from any other source (like programmatic insertion)
  model.onDidChangeContent((e) => {
    const currentValue = model.getValue();
    if (/[\r\n]/.test(currentValue)) {
      const cleanValue = currentValue.replace(/[\r\n]/g, ' ');
      // Use pushEditOperations to maintain undo history
      model.pushEditOperations([], [{
        range: model.getFullModelRange(),
        text: cleanValue
      }], () => null);
    }
  });

  // Add cleanup method to the editor
  const originalDispose = editor.dispose.bind(editor);
  editor.dispose = () => {
    autoInsertDisposable.dispose();
    if (contentChangeDisposable) {
      contentChangeDisposable.dispose();
    }
    originalDispose();
  };

  // Add method to toggle clear button visibility programmatically
  if (showClearButton) {
    editor.setClearButtonMode = function(mode) {
      if (!clearButton) return;
      
      if (mode === 'always') {
        clearButton.style.display = 'block';
      } else if (mode === 'never') {
        clearButton.style.display = 'none';
      } else if (mode === 'auto' && updateClearButtonVisibility) {
        updateClearButtonVisibility();
      }
    };
  }

  // Add modern input field focus/blur behavior
  editor.onDidFocusEditorWidget(() => {
    container.classList.add('focused');
  });
  
  editor.onDidBlurEditorWidget(() => {
    container.classList.remove('focused');
  });

  return { editor, model };
}
