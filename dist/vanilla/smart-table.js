/**
 * @license
 * smart-table feature for Awesome Editor
 * Adds table filtering capabilities using a query language (includes query-language features)
 * 
 * @version 0.1.1
 * @copyright (c) 2025 Awesome Editor Contributors
 * @license MIT License
 */

(function() {
              // Ensure Monaco Editor is loaded before initializing
              if (typeof require !== 'undefined' && typeof require.config === 'function') {
                require(['vs/editor/editor.main'], function() {
                  initializeSmartTable();
                });
              } else if (typeof monaco !== 'undefined') {
                // Monaco is already loaded
                initializeSmartTable();
              } else {
                console.error('Monaco Editor must be loaded before the smart-table feature');
                return;
              }

              function initializeSmartTable() {
                if (typeof monaco === 'undefined') {
                  console.error('Monaco Editor is not available');
                  return;
                }

                /**
 * Sets up basic language configuration for the query language
 * @param {object} monaco The Monaco editor instance
 */
function setupLanguageConfiguration(monaco, languageId) {
  monaco.languages.setLanguageConfiguration(languageId, {
    
    // Auto-closing pairs
    autoClosingPairs: [
      { open: '(', close: ')' },
      { open: '[', close: ']' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ],
    
    // Surrounding pairs
    surroundingPairs: [
      { open: '(', close: ')' },
      { open: '[', close: ']' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ]
  });
}

/**
 * Sets up the editor theme for the query language
 * @param {object} monaco The Monaco editor instance
 */
function setupEditorTheme(monaco) {
  monaco.editor.defineTheme("queryTheme", {
    base: "vs",
    inherit: true,
    rules: [
      { token: 'identifier', foreground: '795E26', background: 'FFF3D0', fontStyle: 'italic' },
      { token: 'operator', foreground: 'af00db' },
      { token: 'boolean', foreground: '5f5757', fontStyle: 'bold' },
      { token: 'number', foreground: '5f5757', fontStyle: 'bold' },
      { token: 'string', foreground: '5f5757', fontStyle: 'bold' },
      { token: 'string.search', foreground: '5f5757', fontStyle: 'bold' },
      { token: 'keyword', foreground: '007acc', fontStyle: 'bold' },
      { token: 'keyword.null', foreground: '5f5757', fontStyle: 'bold' }
    ],
    colors: {
      'editor.foreground': '#5f5757',
      'editor.background': '#ffffff'
    }
  });
}

/**
 * Sets up the token provider for syntax highlighting
 * @param {object} monaco The Monaco editor instance
 * @param {object} options Configuration options
 * @param {object} options.fieldNames The field name definitions
 */
function setupTokenProvider(monaco, { fieldNames, languageId }) {
  // Create pattern for field names - add word boundary only at end to allow partial matches
  const fieldPattern = `\\b(${Object.keys(fieldNames).join('|')})\\b`;
  
  monaco.languages.setMonarchTokensProvider(languageId, {
    // Define the states
    defaultToken: '',
    tokenPostfix: '.querylang',

    // Track values in arrays for duplicate detection
    brackets: [
      { open: '[', close: ']', token: 'delimiter.square' },
      { open: '(', close: ')', token: 'delimiter.parenthesis' }
    ],

    keywords: ['AND', 'OR', 'IN'],
    operators: ['=', '!=', '>=', '<=', '>', '<'],
    
    tokenizer: {
      root: [
        // Keywords and operators (most specific word-based matches first)
        [/\b(AND|OR)\b/, 'keyword'],
        [/\b(IN)\b/, { token: 'operator', next: '@inArray' }],
        [/\b(true|false)\b/, 'boolean'],
        [/\b(NULL)\b/, 'keyword.null'],
        
        // Operators and delimiters
        [/(=|!=|>=|<=|>|<)/, 'operator'],
        [/\(|\)/, 'delimiter.parenthesis'],
        [/\[/, { token: 'delimiter.square', next: '@inArray' }],
        [/\]/, 'delimiter.square'],

        // Field names (after keywords to avoid conflicts)
        [new RegExp(fieldPattern), 'identifier'],
        
        // Literals (after operators to avoid partial matches)
        [/"(?:[^"\\]|\\.)*"/, 'string'],
        [/-?\d+(?:\.\d+)?/, 'number'],
        
        // Free text/search terms (words that don't match above patterns)
        [/[a-zA-Z0-9_]+/, 'string.search'],
        
        // Whitespace
        [/\s+/, 'white']
      ],

      inArray: [
        [/\s+/, 'white'],
        [/,/, 'delimiter.comma'],
        [/\]/, { token: 'delimiter.square', next: '@pop' }],
        [/"(?:[^"\\]|\\.)*"/, 'string.array'],
        [/-?\d+(?:\.\d+)?/, 'number.array']
      ]
    }
  });
}

/**
 * Sets up the completion provider for the query language
 * @param {object} monaco The Monaco editor instance
 * @param {object} options Configuration options
 * @param {object} options.fieldNames The field name definitions
 */
function setupCompletionProvider(monaco, { fieldNames, languageId }) {
  // Set up auto-insertion of brackets after "IN " is typed
  function setupAutoInsertBrackets(editor) {
    const disposable = editor.onDidChangeModelContent((e) => {
      // Only handle single character insertions
      if (e.changes.length !== 1) return;
      
      const change = e.changes[0];
      if (change.text.length !== 1) return;
      
      // Only trigger if the user just typed a space character
      if (change.text !== ' ') return;
      
      const model = editor.getModel();
      if (!model) return;
      
      // Get the current position after the change
      const position = {
        lineNumber: change.range.startLineNumber,
        column: change.range.startColumn + change.text.length
      };
      
      // Get the text before the cursor to check if we just typed "IN "
      const lineText = model.getLineContent(position.lineNumber);
      const textBeforeCursor = lineText.substring(0, position.column - 1);
      
      // Check if we just completed "IN " (case-sensitive, with space)
      if (textBeforeCursor.endsWith('IN ')) {
        // Check if brackets don't already exist immediately after the space
        const textAfterCursor = lineText.substring(position.column - 1);
        
        // Only auto-insert if there are no brackets already present
        if (!textAfterCursor.trimStart().startsWith('[')) {
          // Also check that "IN" is a standalone word (not part of another word like "inStock")
          const beforeIN = textBeforeCursor.substring(0, textBeforeCursor.length - 3);
          const lastChar = beforeIN[beforeIN.length - 1];
          
          // Only proceed if "IN" is preceded by whitespace or is at the start
          if (!lastChar || /\s/.test(lastChar)) {
            // Insert brackets and position cursor between them
            editor.executeEdits('auto-insert-brackets', [
              {
                range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                text: '[]'
              }
            ]);
            
            // Position cursor between the brackets
            editor.setPosition({
              lineNumber: position.lineNumber,
              column: position.column + 1
            });
            
            // Trigger completion suggestions for the list content
            setTimeout(() => {
              editor.trigger('auto-insert', 'editor.action.triggerSuggest', {});
            }, 10);
          }
        }
      }
    });
    
    return disposable;
  }
  // Helper: Insert operator with proper spacing
  function operatorInsertText(op, position, model) {
    // Get the text before the cursor
    const textBefore = model.getValueInRange({
      startLineNumber: position.lineNumber,
      startColumn: Math.max(1, position.column - 1),
      endLineNumber: position.lineNumber,
      endColumn: position.column
    });

    // If no text before or ends with whitespace, don't add leading space
    if (!textBefore || /\s$/.test(textBefore)) {
      return op;
    }
    // Otherwise add a leading space
    return ` ${op}`;
  }

  // Create patterns for matching with better context awareness
  const fieldPattern = new RegExp(`^(${Object.keys(fieldNames).join('|')})$`);
  const operPattern = /^(=|!=|>=|<=|>|<)$/i;
  const inPattern = /^IN$/; // Case-sensitive IN operator
  const logicalPattern = /^(AND|OR)$/; // Case-sensitive logical operators
  const fieldList = Object.keys(fieldNames);
  

  // Documentation helper
  function docMarkdown(text) {
    return { value: text, isTrusted: true };
  }

  // Sort text helper to ensure consistent ordering
  function getSortText(type, label) {
    const order = {
      field: '1',
      operator: '2',
      value: '3',
      logical: '4',
      list: '5'
    };
    
    // Handle undefined or null labels
    if (!label) {
      return `${order[type] || '9'}`;
    }
    
    // Special ordering for operators
    if (type === 'operator') {
      const operatorOrder = {
        '=': '1',
        '!=': '2',
        '>': '3',
        '<': '4',
        'IN': '5'
      };
      return `${order[type]}${operatorOrder[label] || '9'}${label.toLowerCase()}`;
    }
    
    return `${order[type]}${label.toLowerCase()}`;
  }

  // Operator descriptions
  const descriptions = {
    '=': 'Equals operator',
    '!=': 'Not equals operator',
    '>': 'Greater than operator',
    '<': 'Less than operator',
    'IN': 'Check if a value is in a list',
    'AND': 'Logical AND operator',
    'OR': 'Logical OR operator',
    'true': 'Boolean true value',
    'false': 'Boolean false value',
    ...Object.fromEntries(Object.entries(fieldNames).map(([key, attr]) => 
      [key, `${key} (${attr.type}${attr.values ? `: One of [${attr.values.join(', ')}]` : ''})`]
    ))
  };

  // Helper to get value suggestions based on field type
  function getValueSuggestions(field) {
    const suggestions = [];
    if (!field) {
      return suggestions;
    }
    if (field.type === 'boolean') {
      suggestions.push(
        { 
          label: 'true', 
          kind: monaco.languages.CompletionItemKind.Value, 
          insertText: 'true', 
          documentation: docMarkdown('Boolean true value'),
          sortText: getSortText('value', 'true')
        },
        { 
          label: 'false', 
          kind: monaco.languages.CompletionItemKind.Value, 
          insertText: 'false', 
          documentation: docMarkdown('Boolean false value'),
          sortText: getSortText('value', 'false')
        }
      );
    } else if (field.type === 'string' && field.values) {
      suggestions.push(...field.values.map(v => ({
        label: v === 'NULL' ? 'NULL' : `"${v}"`,
        kind: monaco.languages.CompletionItemKind.Value,
        insertText: v === 'NULL' ? 'NULL' : `"${v}"`,
        documentation: v === 'NULL' ? 
          docMarkdown('Special keyword for null/undefined/empty values') :
          docMarkdown(`String value "${v}"`),
        sortText: getSortText('value', v)
      })));
    } else if (field.type === 'string' && !field.values) {
      // For string fields without predefined values, suggest empty quotes with cursor positioning
      suggestions.push({
        label: '""',
        kind: monaco.languages.CompletionItemKind.Value,
        insertText: '"${1}"',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: docMarkdown('Enter a string value'),
        sortText: getSortText('value', '""'),
        detail: 'Free text string'
      });
    } else if (field.type === 'number') {
      // First add a hint suggestion that shows but doesn't insert anything
      suggestions.push({
        label: '(a number)',
        kind: monaco.languages.CompletionItemKind.Text,
        insertText: '', // Don't insert anything when selected
        documentation: docMarkdown(
          field.range 
            ? `Enter a number${field.range.min !== undefined ? ` ≥ ${field.range.min}` : ''}${field.range.max !== undefined ? ` ≤ ${field.range.max}` : ''}`
            : 'Enter a number'
        ),
        sortText: getSortText('value', '0'),
        preselect: false, // Don't preselect this item
        filterText: '' // Make it appear but not match any typing
      });

      // Then add actual values if we have range information
      if (field.range) {
        const suggestions = new Set();
        if (field.range.min !== undefined) {
          suggestions.add(field.range.min);
        }
        if (field.range.max !== undefined) {
          suggestions.add(field.range.max);
        }
        // If we have both min and max, suggest some values in between
        if (field.range.min !== undefined && field.range.max !== undefined) {
          const mid = Math.floor((field.range.min + field.range.max) / 2);
          if (mid !== field.range.min && mid !== field.range.max) {
            suggestions.add(mid);
          }
          // Add quarter points if they're different enough
          const quarter = Math.floor((field.range.min + mid) / 2);
          const threeQuarter = Math.floor((mid + field.range.max) / 2);
          if (quarter !== field.range.min && quarter !== mid) {
            suggestions.add(quarter);
          }
          if (threeQuarter !== mid && threeQuarter !== field.range.max) {
            suggestions.add(threeQuarter);
          }
        }

        // Add all the suggestions
        [...suggestions].sort((a, b) => a - b).forEach(value => {
          suggestions.push({
            label: value.toString(),
            kind: monaco.languages.CompletionItemKind.Value,
            insertText: value.toString(),
            documentation: docMarkdown(`Number value: ${value}`),
            sortText: getSortText('value', value.toString())
          });
        });
      }
    }
    return suggestions;
  }

  // Helper to get operator suggestions based on field type
  function getOperatorSuggestions(field, position, model) {
    const suggestions = [
      { 
        label: '=', 
        kind: monaco.languages.CompletionItemKind.Operator, 
        insertText: operatorInsertText('= ', position, model), 
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.KeepWhitespace, 
        documentation: docMarkdown(descriptions['=']),
        sortText: getSortText('operator', '='),
        command: { id: 'editor.action.triggerSuggest' }
      },
      { 
        label: '!=', 
        kind: monaco.languages.CompletionItemKind.Operator, 
        insertText: operatorInsertText('!= ', position, model), 
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.KeepWhitespace, 
        documentation: docMarkdown(descriptions['!=']),
        sortText: getSortText('operator', '!='),
        command: { id: 'editor.action.triggerSuggest' }
      }
    ];

    if (field.type === 'number') {
      suggestions.push(
        { 
          label: '>', 
          kind: monaco.languages.CompletionItemKind.Operator, 
          insertText: operatorInsertText('> ', position, model), 
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.KeepWhitespace, 
          documentation: docMarkdown(descriptions['>']),
          sortText: getSortText('operator', '>'),
          command: { id: 'editor.action.triggerSuggest' }
        },
        { 
          label: '<', 
          kind: monaco.languages.CompletionItemKind.Operator, 
          insertText: operatorInsertText('< ', position, model), 
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.KeepWhitespace, 
          documentation: docMarkdown(descriptions['<']),
          sortText: getSortText('operator', '<'),
          command: { id: 'editor.action.triggerSuggest' }
        },
        { 
          label: '>=', 
          kind: monaco.languages.CompletionItemKind.Operator, 
          insertText: operatorInsertText('>= ', position, model), 
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.KeepWhitespace, 
          documentation: docMarkdown('Greater than or equal operator'),
          sortText: getSortText('operator', '>='),
          command: { id: 'editor.action.triggerSuggest' }
        },
        { 
          label: '<=', 
          kind: monaco.languages.CompletionItemKind.Operator, 
          insertText: operatorInsertText('<= ', position, model), 
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.KeepWhitespace, 
          documentation: docMarkdown('Less than or equal operator'),
          sortText: getSortText('operator', '<='),
          command: { id: 'editor.action.triggerSuggest' }
        }
      );
    }

    if (field.values || ['string', 'number'].includes(field.type)) {
      suggestions.push({
        label: 'IN',
        kind: monaco.languages.CompletionItemKind.Operator,
        insertText: operatorInsertText('IN [${1}]', position, model),
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet | monaco.languages.CompletionItemInsertTextRule.KeepWhitespace,
        documentation: docMarkdown(descriptions['IN']),
        sortText: getSortText('operator', 'IN'),
        command: { id: 'editor.action.triggerSuggest' }
      });
    }

    return suggestions;
  }

  // Helper to check expression context
  function getExpressionContext(tokens, position) {
    const lastToken = tokens[tokens.length - 1] || '';
    const prevToken = tokens[tokens.length - 2] || '';
    const context = {
      needsField: false,
      needsOperator: false,
      needsValue: false,
      inList: false,
      currentField: null,
      afterLogical: false
    };

    // Check for parentheses context - if we're right after an opening parenthesis
    // or inside empty parentheses, we should expect a field name
    if (lastToken === '(' || (lastToken === '' && prevToken === '(')) {
      context.needsField = true;
      context.afterLogical = false;
      return context;
    }

    // First check for logical operators as they reset the expression context
    if (!lastToken || logicalPattern.test(lastToken)) {
      context.needsField = true;
      context.afterLogical = !!lastToken; // true if we're after AND/OR, false if empty query
    } else if (fieldPattern.test(lastToken)) {
      context.needsOperator = true;
      context.currentField = lastToken;
    } else if (operPattern.test(lastToken) || inPattern.test(lastToken)) {
      context.needsValue = true;
      // Find the associated field name by looking backwards
      for (let i = tokens.length - 2; i >= 0; i--) {
        if (fieldPattern.test(tokens[i])) {
          context.currentField = tokens[i];
          break;
        }
        // Stop if we hit a logical operator or another expression
        if (logicalPattern.test(tokens[i]) || operPattern.test(tokens[i]) || inPattern.test(tokens[i])) {
          break;
        }
      }
    } else if (/\[$/.test(lastToken) || // after opening bracket
           (/\[/.test(lastToken) && !/\]$/.test(lastToken)) || // between brackets
           /,$/.test(lastToken) || // after comma
           (lastToken === '' && tokens.length >= 2 && /\[/.test(tokens[tokens.length - 2]))) { // empty space between brackets
      context.inList = true;
      // Find the field name before IN
      for (let i = tokens.length - 1; i >= 0; i--) {
        if (tokens[i] === 'IN' && i > 0) {
          context.currentField = tokens[i - 1];
          break;
        }
      }
    }

    return context;
  }

  const triggerCharacters= [
      // Add all alphabetical characters first
      ...Array.from('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'),
      // Then add other special characters
      ',', ' ', '=', '!', '>', '<', '[', ']', '(', ')', '"', "'"
    ];
  const completionProvider = monaco.languages.registerCompletionItemProvider(languageId, {
    triggerCharacters,
    provideCompletionItems: (model, position) => {
      // Get text up to cursor (don't trim to preserve space context)
      const text = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column
      });

      // Check if cursor is after whitespace (indicates we completed a token)
      const endsWithSpace = /\s$/.test(text);
      
      // Enhanced context extraction - use trimmed text for tokenization
      const tokens = text.trim().match(/([\w]+|\(|\)|\[|\]|"[^"]*"|\S)/g) || [];
      const context = getExpressionContext(tokens, position);
      let suggestions = [];

      // If we're after whitespace and have tokens, we might need to adjust context
      if (endsWithSpace && tokens.length > 0) {
        const lastToken = tokens[tokens.length - 1];
        // If last token is a field name and we're after space, we need operators
        if (fieldList.includes(lastToken)) {
          context.needsOperator = true;
          context.currentField = lastToken;
          context.needsField = false;
          context.afterLogical = false;
        }
      }

      // Detect if we're in search mode or structured query mode
      const hasOperators = tokens.some(token => 
        ['=', '!=', '>', '<', '>=', '<=', 'IN', 'AND', 'OR','(', ')'].includes(token)
      );

      // Count meaningful tokens (exclude empty strings)
      const meaningfulTokens = tokens.filter(token => token.trim().length > 0);
      const isFirstWord = meaningfulTokens.length <= 1 && !context.needsOperator;

      // Get the current word being typed
      const currentWord = context.afterLogical ? '' : (tokens[tokens.length - 1] || '');
      const prevToken = context.afterLogical ? tokens[tokens.length - 1] : (tokens[tokens.length - 2] || '');

      // Special handling for first word - show both structured and search suggestions
      if (isFirstWord && !hasOperators && /^[a-zA-Z]+$/.test(currentWord)) {
        // Show field name suggestions (for structured mode)
        const matchingFields = fieldList.filter(f => 
          f.toLowerCase().startsWith(currentWord.toLowerCase())
        );
        
        if (matchingFields.length > 0) {
          suggestions.push(...matchingFields.map(f => ({
            label: f,
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: `${f} = `,
            documentation: docMarkdown(`Field: ${descriptions[f] || f}\n\nClick to start a structured query with this field.`),
            detail: 'Field (start structured query)',
            sortText: `0_field_${f}`, // Sort fields first
            command: { id: 'editor.action.triggerSuggest' } // Auto-trigger next suggestions
          })));
        }

        // Show search mode suggestion
        if (currentWord.length >= 1) {
          suggestions.push({
            label: `"${currentWord}" (search all fields)`,
            kind: monaco.languages.CompletionItemKind.Text,
            insertText: currentWord,
            documentation: docMarkdown(`Search for "${currentWord}" in any field\n\nType additional words to search for multiple terms.`),
            detail: 'Text search mode',
            sortText: `1_search_${currentWord}` // Sort after fields
          });
        }
        
        return { suggestions };
      }

      // Search mode suggestions (for subsequent words when no operators detected)
      if (!hasOperators && meaningfulTokens.length > 1) {
        // After first word in search mode, only suggest search continuation
        if (/^[a-zA-Z0-9]*$/.test(currentWord)) {
          suggestions.push({
            label: `"${currentWord || 'term'}" (continue search)`,
            kind: monaco.languages.CompletionItemKind.Text,
            insertText: currentWord || '',
            documentation: docMarkdown(`Add "${currentWord || 'term'}" as additional search term\n\nAll terms must be found in the record for it to match.`),
            detail: 'Additional search term',
            sortText: `0_search_continue`
          });
        }
        
        return { suggestions };
      }

      // Structured query mode (existing logic)
      if (context.needsOperator && context.currentField) {
        // After a field name, show operators
        suggestions = getOperatorSuggestions(fieldNames[context.currentField], position, model);
      } else if (context.needsValue && context.currentField && fieldNames[context.currentField]) {
        // After an operator, show values
        suggestions = getValueSuggestions(fieldNames[context.currentField]);
      } else if (context.needsField || context.afterLogical || (tokens.length === 1 && /^[a-zA-Z]+$/.test(tokens[0]) && !fieldPattern.test(tokens[0]))) {        
        // Only show field suggestions if:
        // 1. We're at the start of a query, or
        // 2. After a logical operator (AND/OR), or
        // 3. We're typing something that isn't a complete field name yet
        if (!prevToken || logicalPattern.test(prevToken) || (currentWord && !fieldPattern.test(currentWord))) {
          // Filter field list by the current word if it's an alphabetical string
          const matchingFields = /^[a-zA-Z]+$/.test(currentWord) 
            ? fieldList.filter(f => f.toLowerCase().startsWith(currentWord.toLowerCase()))
            : fieldList;

          suggestions = matchingFields.map(f => ({
            label: f,
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: `${f} `,
            documentation: docMarkdown(descriptions[f] || ''),
            sortText: getSortText('field', f),
            command: { id: 'editor.action.triggerSuggest' }
          }));
        } else {
          suggestions = [];
        }
      } else if (context.inList && context.currentField) {
        // Handle IN list suggestions...
        const field = fieldNames[context.currentField];
        if (!field) return { suggestions: [] };
        
        // Extract existing values
        const listValues = new Set();
        const listStart = tokens.findIndex(t => t === '[');
        if (listStart !== -1) {
          tokens.slice(listStart + 1)
            .filter(t => t !== ',' && t !== '[')
            .forEach(t => listValues.add(t.replace(/^"(.*)"$/, '$1')));
        }

        // Filter out used values and add remaining ones
        if (field.type === 'string' && field.values) {
          const remainingValues = field.values.filter(v => !listValues.has(v));
          suggestions = remainingValues.map(v => ({
            label: v === 'NULL' ? 'NULL' : `"${v}"`,
            kind: monaco.languages.CompletionItemKind.Value,
            insertText: v === 'NULL' ? 'NULL' : `"${v}"`,
            documentation: v === 'NULL' ? 
              docMarkdown('Special keyword for null/undefined/empty values') :
              docMarkdown(`String value "${v}"`),
            sortText: getSortText('value', v)
          }));
        } else if (field.type === 'string' && !field.values) {
          // For string fields without predefined values in IN lists, suggest empty quotes
          suggestions.push({
            label: '""',
            kind: monaco.languages.CompletionItemKind.Value,
            insertText: '"${1}"',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: docMarkdown('Enter a string value for the list'),
            sortText: getSortText('value', '""'),
            detail: 'Free text string'
          });
        } else if (field.type === 'number') {
          // First add the hint suggestion
          suggestions.push({
            label: '(a number)',
            kind: monaco.languages.CompletionItemKind.Text,
            insertText: '', // Don't insert anything when selected
            documentation: docMarkdown(
              field.range 
                ? `Enter a number${field.range.min !== undefined ? ` ≥ ${field.range.min}` : ''}${field.range.max !== undefined ? ` ≤ ${field.range.max}` : ''}`
                : 'Enter a number'
            ),
            sortText: getSortText('value', '0'),
            preselect: false,
            filterText: ''
          });

          // Then add some reasonable values if we have range info
          if (field.range) {
            const values = new Set();
            if (field.range.min !== undefined) values.add(field.range.min);
            if (field.range.max !== undefined) values.add(field.range.max);
            // Add some values in between if we have both min and max
            if (field.range.min !== undefined && field.range.max !== undefined) {
              const mid = Math.floor((field.range.min + field.range.max) / 2);
              values.add(mid);
            }
            suggestions.push(...Array.from(values).map(v => ({
              label: v.toString(),
              kind: monaco.languages.CompletionItemKind.Value,
              insertText: v.toString(),
              documentation: docMarkdown(`Number value ${v}`),
              sortText: getSortText('value', v.toString())
            })));
          }
        }

        // Add comma if we have values and aren't right after a comma
        if (suggestions.length > 0 && tokens[tokens.length - 1] !== ',') {
          suggestions.unshift({
            label: ',',
            kind: monaco.languages.CompletionItemKind.Operator,
            insertText: operatorInsertText(', ', position, model),
            documentation: docMarkdown('Add another value'),
            sortText: getSortText('list', ','),
            command: { id: 'editor.action.triggerSuggest' }
          });
        }
      } else if (/[\])]$/.test(tokens[tokens.length - 1]) || /^".*"|\d+|true|false$/i.test(tokens[tokens.length - 1])) {
        // After a complete value or closing bracket/parenthesis, suggest logical operators
        suggestions = ['AND', 'OR'].map(op => ({
          label: op,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: operatorInsertText(`${op} `, position, model),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.KeepWhitespace,
          documentation: docMarkdown(descriptions[op]),
          sortText: getSortText('logical', op),
          command: { id: 'editor.action.triggerSuggest' }
        }));
      }

      return { suggestions };
    }
  });

  return {
    provider: completionProvider,
    setupAutoInsertBrackets
  };
}

/**
 * Sets up validation for the query language
 * @param {object} monaco The Monaco editor instance
 * @param {object} options Configuration options
 * @param {object} options.fieldNames The field name definitions
 */
function setupValidation(monaco, { fieldNames, languageId }) {
  // Prevent duplicate validation setup for the same language ID
  if (monaco._validationSetup && monaco._validationSetup[languageId]) {
    return monaco._validationSetup[languageId];
  }
  
  if (!monaco._validationSetup) {
    monaco._validationSetup = {};
  }

  // Cache for tokenization and validation results
  const tokenCache = new Map();
  const validationCache = new Map();

  // Enhanced tokenizer
  function tokenize(str) {
    // Check cache first
    const cached = tokenCache.get(str);
    if (cached) {
      return cached;
    }

    const tokens = [];
    let position = 0;
    
    while (position < str.length) {
      // Skip whitespace
      if (/\s/.test(str[position])) {
        position++;
        continue;
      }
      
      let match = null;
      let value = '';
      let type = '';
      let tokenStart = position;
      
      // Check for specific patterns in order of priority
      
      // 1. Operators (multi-character first)
      if (str.substring(position).match(/^(!=|>=|<=)/)) {
        const op = str.substring(position).match(/^(!=|>=|<=)/)[0];
        value = op;
        type = 'operator';
        position += op.length;
      }
      // 2. Single character operators
      else if (/[=<>]/.test(str[position])) {
        value = str[position];
        type = 'operator';
        position++;
      }
      // 3. Punctuation
      else if (/[(),\[\]]/.test(str[position])) {
        value = str[position];
        type = 'punctuation';
        position++;
      }
      // 4. Comma
      else if (str[position] === ',') {
        value = ',';
        type = 'punctuation';
        position++;
      }
      // 5. Quoted strings (including unclosed ones)
      else if (str[position] === '"') {
        let endQuoteFound = false;
        let stringEnd = position + 1;
        
        // Look for closing quote, handling escaped quotes
        while (stringEnd < str.length) {
          if (str[stringEnd] === '"' && str[stringEnd - 1] !== '\\') {
            endQuoteFound = true;
            stringEnd++;
            break;
          }
          stringEnd++;
        }
        
        value = str.substring(position, stringEnd);
        type = endQuoteFound ? 'string' : 'unclosed-string';
        position = stringEnd;
      }
      // 6. Numbers
      else if (/\d/.test(str[position]) || (str[position] === '-' && /\d/.test(str[position + 1]))) {
        const numberMatch = str.substring(position).match(/^-?\d*\.?\d+/);
        if (numberMatch) {
          value = numberMatch[0];
          type = 'number';
          position += value.length;
        } else {
          // Fallback - treat as identifier
          const identifierMatch = str.substring(position).match(/^\w+/);
          value = identifierMatch ? identifierMatch[0] : str[position];
          type = 'identifier';
          position += value.length;
        }
      }
      // 7. Keywords and identifiers
      else if (/[a-zA-Z_]/.test(str[position])) {
        const wordMatch = str.substring(position).match(/^[a-zA-Z_]\w*/);
        if (wordMatch) {
          value = wordMatch[0];
          
          // Check for keywords (case-sensitive for logical operators)
          if (['AND', 'OR'].includes(value)) { // Case-sensitive check
            type = 'keyword';
          } else if (value === 'IN') { // Case-sensitive
            type = 'keyword';
          } else if (['true', 'false'].includes(value.toLowerCase())) {
            type = 'boolean';
          } else if (value.toLowerCase() === 'null') {
            type = 'null';
          } else {
            type = 'identifier';
          }
          
          position += value.length;
        } else {
          // Single character fallback
          value = str[position];
          type = 'identifier';
          position++;
        }
      }
      // 8. Fallback for any other character
      else {
        value = str[position];
        type = 'identifier';
        position++;
      }
      
      if (value) {
        tokens.push({
          value,
          type,
          start: tokenStart,
          end: position
        });
      }
    }

    // Cache the result if it's not too large (prevent memory issues)
    if (str.length < 10000) {
      tokenCache.set(str, tokens);
    }

    return tokens;
  }

  // Helper to get token type with enhanced pattern recognition
  function getTokenType(value) {
    if (/^-?\d*\.?\d+$/.test(value)) return 'number';
    if (/^".*"$/.test(value)) return 'string';
    if (/^"/.test(value) && !value.endsWith('"')) return 'unclosed-string';
    if (/^(true|false)$/i.test(value)) return 'boolean';
    if (/^(null)$/i.test(value)) return 'null';
    if (/^(AND|OR)$/.test(value)) return 'keyword'; // Case-sensitive check for logical operators
    if (value === 'IN') return 'keyword'; // Case-sensitive check for IN operator
    if (/^[=!<>]=?$/.test(value)) return 'operator';
    if (/^[\[\](),]$/.test(value)) return 'punctuation';
    return 'identifier';
  }

  // Helper function to find the field name before an IN operator
  function findFieldBeforeIN(tokens, inStartIndex) {
    // Walk backwards from the IN token to find the field name
    for (let i = inStartIndex - 1; i >= 0; i--) {
      const token = tokens[i];
      // Check if it's a valid field name (identifier that matches our field names)
      if (token.type === 'identifier' && fieldNames[token.value]) {
        return token.value;
      }
      // Stop if we hit another operator or the start
      if (token.type === 'operator' || i === 0) {
        break;
      }
    }
    return null;
  }

  // Validate string values
  function validateStringValue(value, token, markers) {
    // Check for unclosed quotes
    if (token.type === 'unclosed-string') {
      markers.push({
        severity: monaco.MarkerSeverity.Error,
        message: 'Unclosed string literal. Did you forget a closing quote?',
        startLineNumber: 1,
        startColumn: token.start + 1,
        endLineNumber: 1,
        endColumn: token.end + 1
      });
      return false;
    }
    
    // Check for properly escaped quotes
    const unescapedQuotes = value.slice(1, -1).match(/(?<!\\)"/g);
    if (unescapedQuotes) {
      markers.push({
        severity: monaco.MarkerSeverity.Error,
        message: 'Unescaped quote in string literal. Use \\" for quotes inside strings.',
        startLineNumber: 1,
        startColumn: token.start + 1,
        endLineNumber: 1,
        endColumn: token.end + 1
      });
      return false;
    }

    // Check for invalid escape sequences
    const invalidEscapes = value.slice(1, -1).match(/\\(?!["\\/bfnrt])/g);
    if (invalidEscapes) {
      markers.push({
        severity: monaco.MarkerSeverity.Error,
        message: 'Invalid escape sequence. Valid escapes are: \\", \\\\, \\/, \\b, \\f, \\n, \\r, \\t',
        startLineNumber: 1,
        startColumn: token.start + 1,
        endLineNumber: 1,
        endColumn: token.end + 1
      });
      return false;
    }
    
    return true;
  }

  // Validate number value
  function validateNumberValue(value, field, token, markers) {
    // Check if it's a valid number
    if (!/^-?\d*\.?\d+$/.test(value)) {
      markers.push({
        severity: monaco.MarkerSeverity.Error,
        message: `Invalid number format: ${value}`,
        startLineNumber: 1,
        startColumn: token.start + 1,
        endLineNumber: 1,
        endColumn: token.end + 1
      });
      return false;
    }

    // If field has range validation
    if (field.range) {
      const num = parseFloat(value);
      if (field.range.min !== undefined && num < field.range.min) {
        markers.push({
          severity: monaco.MarkerSeverity.Error,
          message: `Value must be greater than or equal to ${field.range.min}`,
          startLineNumber: 1,
          startColumn: token.start + 1,
          endLineNumber: 1,
          endColumn: token.end + 1
        });
        return false;
      }
      if (field.range.max !== undefined && num > field.range.max) {
        markers.push({
          severity: monaco.MarkerSeverity.Error,
          message: `Value must be less than or equal to ${field.range.max}`,
          startLineNumber: 1,
          startColumn: token.start + 1,
          endLineNumber: 1,
          endColumn: token.end + 1
        });
        return false;
      }
    }

    return true;
  }

  // Helper to validate IN list structure and values
  function validateInList(tokens, startIndex, markers) {
    let inList = false;
    let valueCount = 0;
    let hasTrailingComma = false;
    let bracketBalance = 0;
    let arrayStart = -1;

    // Store values and their positions
    let values = [];

    // Find the field name associated with this IN list
    const currentListField = findFieldBeforeIN(tokens, startIndex);
    const fieldDef = currentListField ? fieldNames[currentListField] : null;
    let hasErrors = false;

    // Function to check for duplicates in the collected values
    function checkForDuplicates() {
      for (let i = 0; i < values.length; i++) {
        for (let j = i + 1; j < values.length; j++) {
          const a = values[i];
          const b = values[j];
          
          let isDuplicate = false;
          if (a.type === 'number' && b.type === 'number') {
            // Compare numbers with fixed precision
            isDuplicate = Number(a.value).toFixed(10) === Number(b.value).toFixed(10);
          } else {
            // Direct comparison for strings and booleans
            isDuplicate = a.value === b.value;
          }

          if (isDuplicate) {
            // Mark the first occurrence
            markers.push({
              severity: monaco.MarkerSeverity.Error,
              message: 'This value is duplicated later in the list',
              startLineNumber: 1,
              startColumn: a.token.start + 1,
              endLineNumber: 1,
              endColumn: a.token.end + 1
            });

            // Mark the duplicate
            markers.push({
              severity: monaco.MarkerSeverity.Error,
              message: `Duplicate value ${b.value} in IN list`,
              startLineNumber: 1,
              startColumn: b.token.start + 1,
              endLineNumber: 1,
              endColumn: b.token.end + 1
            });

            hasErrors = true;
          }
        }
      }
    }

    for (let i = startIndex; i < tokens.length; i++) {
      const token = tokens[i];
      const value = token.value;

      if (value === '[') {
        if (inList) {
          markers.push({
            severity: monaco.MarkerSeverity.Error,
            message: 'Unexpected opening bracket inside IN list',
            startLineNumber: 1,
            startColumn: token.start + 1,
            endLineNumber: 1,
            endColumn: token.end + 1
          });
          hasErrors = true;
        }
        inList = true;
        bracketBalance++;
        arrayStart = token.start;
        continue;
      }

      if (!inList) continue;

      if (value === ']') {
        bracketBalance--;
        // Check for duplicate values before exiting
        checkForDuplicates();
        break;
      }

      if (value === ',') {
        hasTrailingComma = true;
        continue;
      }

      hasTrailingComma = false;
      if (['string', 'number', 'boolean'].includes(token.type)) {
        valueCount++;
        
        // Check for allowed values if field has specific values defined
        if (fieldDef && fieldDef.values && fieldDef.type === 'string' && token.type === 'string') {
          // Remove quotes from string value to compare with allowed values
          const stringValue = token.value.slice(1, -1);
          if (!fieldDef.values.includes(stringValue)) {
            let message;
            if (fieldDef.values.length <= 3) {
              // Show all values if there are 10 or fewer
              message = `Value "${stringValue}" is not one of the allowed values: [${fieldDef.values.join(', ')}]`;
            } else {
              // Show first few values and indicate there are more
              const preview = fieldDef.values.slice(0, 3).join(', ');
              message = `Value "${stringValue}" is not one of the allowed values. Expected one of: ${preview}... (${fieldDef.values.length} total values)`;
            }
            markers.push({
              severity: monaco.MarkerSeverity.Warning,
              message: message,
              startLineNumber: 1,
              startColumn: token.start + 1,
              endLineNumber: 1,
              endColumn: token.end + 1
            });
          }
        }
        
        values.push({
          value: token.value,
          token: token,
          type: token.type
        });
      }
    }

    return !hasErrors;
  }

  // Track the last validation state
  let lastValidationState = {
    content: '',
    tokens: [],
    markers: [],
    hasErrors: false
  };

  // Helper to calculate validation state hash
  function getValidationHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  // Helper to check if position is in the middle of complete content
  function isPositionInMiddle(model, position) {
    const lineCount = model.getLineCount();
    const lastLineLength = model.getLineLength(lineCount);
    
    return position.lineNumber < lineCount || 
           (position.lineNumber === lineCount && position.column < lastLineLength);
  }

  // Helper to get tokens up to position
  function getTokensUpToPosition(tokens, position, model) {
    if (!position) return tokens;
    
    const offset = model.getOffsetAt(position);
    return tokens.filter(token => token.end <= offset);
  }

  // Main validation function with incremental updates
  function validateQuery(model, position) {
    const value = model.getValue();
    
    // Quick check if content hasn't changed
    if (value === lastValidationState.content) {
      monaco.editor.setModelMarkers(model, languageId, lastValidationState.markers);
      return;
    }

    // Check cache for identical content
    const validationHash = getValidationHash(value);
    const cached = validationCache.get(validationHash);
    if (cached && !position) {  // Only use cache if we don't need position-aware validation
      monaco.editor.setModelMarkers(model, languageId, cached);
      lastValidationState = {
        content: value,
        tokens: tokenCache.get(value) || [],
        markers: cached,
        hasErrors: cached.length > 0
      };
      return;
    }

    const markers = [];
    const tokens = tokenize(value);

    // Detect if this is search mode or structured query mode
    const hasOperators = tokens.some(token => 
      ['=', '!=', '>', '<', '>=', '<=', 'IN', 'AND', 'OR', '(', ')'].includes(token.value)
    );
    
    // If no operators found, treat as search mode (no validation needed)
    if (!hasOperators && tokens.length > 0) {
      // Search mode - just check for unclosed strings
      tokens.forEach(token => {
        if (token.type === 'unclosed-string') {
          addError(token, 'Unclosed string literal');
        }
      });
      
      // Cache and store validation result
      validationCache.set(validationHash, markers);
      lastValidationState = {
        content: value,
        tokens,
        markers,
        hasErrors: markers.length > 0
      };
      monaco.editor.setModelMarkers(model, languageId, markers);
      return;
    }

    // Helper to add error marker
    function addError(token, message) {
      markers.push({
        severity: monaco.MarkerSeverity.Error,
        message,
        startLineNumber: 1,
        startColumn: token.start + 1,
        endLineNumber: 1,
        endColumn: token.end + 1
      });
    }

    // Helper to add warning marker
    function addWarning(token, message) {
      markers.push({
        severity: monaco.MarkerSeverity.Warning,
        message,
        startLineNumber: 1,
        startColumn: token.start + 1,
        endLineNumber: 1,
        endColumn: token.end + 1
      });
    }

    // State tracking
    let expressionState = {
      hasField: false,
      hasOperator: false,
      hasValue: false,
      currentField: null,
      lastValueToken: null,
      inParentheses: false,
      parenthesesBalance: 0,
      reset() {
        this.hasField = false;
        this.hasOperator = false;
        this.hasValue = false;
        this.currentField = null;
        this.lastValueToken = null;
      }
    };

    // Optimize token validation by caching field lookups
    const fieldCache = new Map();
    function isValidField(token) {
      if (fieldCache.has(token)) {
        return fieldCache.get(token);
      }
      // Only allow defined field names - remove the fallback regex
      const isValid = fieldNames[token] !== undefined;
      fieldCache.set(token, isValid);
      return isValid;
    }

    // Track parentheses for complex expressions
    let parenthesesStack = [];

    // Validate each token with enhanced state tracking
    tokens.forEach((token, index) => {
      const current = token.value.toUpperCase();
      const prev = index > 0 ? tokens[index - 1].value : '';
      const next = index < tokens.length - 1 ? tokens[index + 1].value : '';

      // Track parentheses state
      if (current === '(') {
        expressionState.inParentheses = true;
        expressionState.parenthesesBalance++;
        parenthesesStack.push(expressionState.parenthesesBalance);
      } else if (current === ')') {
        expressionState.parenthesesBalance--;
        parenthesesStack.pop();
        if (expressionState.parenthesesBalance < 0) {
          addError(token, 'Unmatched closing parenthesis');
          return;
        }
        expressionState.inParentheses = expressionState.parenthesesBalance > 0;
      }

      // Reset expression state after logical operators (only uppercase ones are valid)
      if (['AND', 'OR'].includes(token.value)) {
        // Check if we have a complete expression before the logical operator
        const hasCompleteExpression = expressionState.hasValue || 
                                    (prev === ']' && tokens.slice(0, index).some(t => t.value.toUpperCase() === 'IN'));
        if (!hasCompleteExpression && !expressionState.inParentheses) {
          addError(token, 'Incomplete expression before logical operator');
        }
        expressionState.reset();
        return;
      }

      // Check if we're expecting a logical operator after a complete expression
      if (token.type === 'identifier' && expressionState.hasValue) {
        // We just completed an expression (field = value), so we expect a logical operator
        if (['and', 'or'].includes(token.value.toLowerCase())) {
          // This is a logical operator but in wrong case
          addError(token, `Logical operator must be uppercase. Use '${token.value.toUpperCase()}' instead of '${token.value}'.`);
          return;
        } else if (!['AND', 'OR'].includes(token.value.toUpperCase())) {
          // This is not a logical operator at all, but we expected one
          addError(token, `Expected logical operator (AND/OR) after complete expression, but found '${token.value}'.`);
          return;
        }
      }

      // Enhanced field name validation      
      if (token.type === 'identifier' && !['AND', 'OR', 'IN', 'TRUE', 'FALSE', 'NULL'].includes(token.value)) {
        // Check for lowercase logical operators first
        if (['and', 'or'].includes(token.value.toLowerCase()) && token.value !== token.value.toUpperCase()) {
          addError(token, `Logical operator must be uppercase. Use '${token.value.toUpperCase()}' instead of '${token.value}'.`);
          return;
        }
        
        // Check if this is a valid field name
        if (!isValidField(token.value)) {
          // Check if we're in a position where a field name is expected
          const expectingField = !expressionState.hasField || 
                               (index > 0 && ['AND', 'OR'].includes(tokens[index - 1].value.toUpperCase()));
          
          if (expectingField) {
            const availableFields = Object.keys(fieldNames);
            let suggestion = '';
            if (availableFields.length > 0) {
              // Find the closest matching field name
              const closest = availableFields.find(f => 
                f.toLowerCase().includes(token.value.toLowerCase()) ||
                token.value.toLowerCase().includes(f.toLowerCase())
              );
              if (closest) {
                suggestion = ` Did you mean '${closest}'?`;
              } else {
                const fieldList = availableFields.length <= 5 
                  ? availableFields.join(', ')
                  : availableFields.slice(0, 5).join(', ') + '...';
                suggestion = ` Available fields: ${fieldList}`;
              }
            }
            addError(token, `Unknown field name '${token.value}'.${suggestion}`);
          }
        } else {
          // Valid field name
          if (expressionState.hasField && !expressionState.hasValue && !['AND', 'OR'].includes(prev)) {
            addError(token, 'Unexpected field name. Did you forget an operator or AND/OR?');
          }
          expressionState.hasField = true;
          expressionState.currentField = token.value;
        }
      }

      // Enhanced operator validation
      if (['=', '!=', '>', '<', '>=', '<='].includes(current)) {
        if (!expressionState.hasField) {
          addError(token, 'Operator without a preceding field name');
        }
        expressionState.hasOperator = true;
        expressionState.hasValue = false; // Reset value state when we see an operator

        // Validate operator compatibility with field type
        if (expressionState.currentField) {
          const field = fieldNames[expressionState.currentField];
          if (field && ['>', '<', '>=', '<='].includes(current) && field.type !== 'number') {
            addError(token, `Operator ${current} can only be used with number fields`);
          }
        }
      }

      // Check for unclosed strings immediately (regardless of expression state)
      if (token.type === 'unclosed-string') {
        addError(token, 'Unclosed string literal. Did you forget a closing quote?');
      }

      // Special handling for IN operator (case-sensitive, uppercase only)
      if (token.value === 'IN') {
        if (!expressionState.hasField) {
          addError(token, 'IN operator without a preceding field name');
        }
        expressionState.hasOperator = true;
        expressionState.hasValue = false;
        validateInList(tokens, index + 1, markers);
      }

      // Value validation with type checking
      if ((token.type === 'string' || token.type === 'number' || token.type === 'boolean' || 
           token.type === 'null' || token.type === 'unclosed-string') && expressionState.hasOperator) {
        if (expressionState.currentField) {
          const field = fieldNames[expressionState.currentField];
          if (field) {
            // NULL is allowed for any field type (represents absence of value)
            if (token.type === 'null') {
              // NULL is valid for any field, skip type validation
            } else if (field.type === 'string' && token.type !== 'string' && token.type !== 'unclosed-string') {
              addError(token, `Value must be a string for field '${expressionState.currentField}'`);
            } else if (field.type === 'number' && token.type !== 'number') {
              addError(token, `Value must be a number for field '${expressionState.currentField}'`);
            } else if (field.type === 'boolean' && token.type !== 'boolean') {
              addError(token, `Value must be a boolean for field '${expressionState.currentField}'`);
            } else {
              // Check for allowed values if field has specific values defined
              if (field.values && field.type === 'string' && token.type === 'string') {
                // Remove quotes from string value to compare with allowed values
                const stringValue = token.value.slice(1, -1);
                if (!field.values.includes(stringValue)) {
                  let message;
                  if (field.values.length <= 2) {
                    // Show all values if there are 10 or fewer
                    message = `Value "${stringValue}" is not one of the allowed values: [${field.values.join(', ')}]`;
                  } else {
                    // Show first few values and indicate there are more
                    const preview = field.values.slice(0, 5).join(', ');
                    message = `Value "${stringValue}" is not one of the allowed values. Expected one of: ${preview}... (${field.values.length} total values)`;
                  }
                  addWarning(token, message);
                }
              }
            }
          }
        }
        expressionState.hasValue = true;
        expressionState.lastValueToken = token;
        
        // Check for consecutive tokens without proper logical operators
        if (index < tokens.length - 1) {
          const nextToken = tokens[index + 1];
          if (nextToken.type === 'identifier' && !['AND', 'OR'].includes(nextToken.value.toUpperCase())) {
            // We have a value followed immediately by an identifier that's not a logical operator
            addError(nextToken, `Unexpected token '${nextToken.value}' after value. Did you forget a logical operator (AND/OR)?`);
          }
        }
      }
    });

    // Final validation checks
    if (expressionState.parenthesesBalance > 0) {
      markers.push({
        severity: monaco.MarkerSeverity.Error,
        message: 'Unclosed parentheses in expression',
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: value.length + 1
      });
    }

    if (tokens.length > 0 && !expressionState.hasValue && !expressionState.inParentheses) {
      const lastToken = tokens[tokens.length - 1];
      // Only mark as incomplete if we're at the actual end of content
      // or if the last token is an operator/identifier and there's nothing valid after it
      if (lastToken.type === 'identifier' || lastToken.type === 'operator') {
        if (!position || !isPositionInMiddle(model, position)) {
          addError(lastToken, 'Incomplete expression at end of query');
        } else {
          // Check if there's valid content after the cursor
          const fullTokens = tokenize(value);
          const tokensAfterCursor = fullTokens.filter(t => t.start >= model.getOffsetAt(position));
          if (!tokensAfterCursor.some(t => t.type === 'string' || t.type === 'number' || t.type === 'boolean')) {
            addError(lastToken, 'Incomplete expression at end of query');
          }
        }
      }
    }

    // Cache validation results
    if (value.length < 10000) {
      validationCache.set(validationHash, markers);
    }

    // Update last validation state
    lastValidationState = {
      content: value,
      tokens,
      markers,
      hasErrors: markers.length > 0
    };

    // Set markers using the specific language ID
    monaco.editor.setModelMarkers(model, languageId, markers);
  }

  // Set up model change listener with incremental validation
  let validateTimeout = null;
  let disposable = monaco.editor.onDidCreateModel(model => {
    if (model.getLanguageId() === languageId) {
      // Initial validation
      validateQuery(model);

      // Set up change listener with debouncing
      const changeDisposable = model.onDidChangeContent((e) => {
        // Clear previous timeout
        if (validateTimeout) {
          clearTimeout(validateTimeout);
        }

        // Get the cursor position from the last change
        const position = e.changes[e.changes.length - 1].rangeOffset ? {
          lineNumber: model.getPositionAt(e.changes[e.changes.length - 1].rangeOffset).lineNumber,
          column: model.getPositionAt(e.changes[e.changes.length - 1].rangeOffset).column
        } : null;

        // Set new timeout for validation
        validateTimeout = setTimeout(() => {
          validateQuery(model, position);
        }, 300); // 300ms debounce
      });

      // Clean up when model is disposed
      model.onWillDispose(() => {
        if (validateTimeout) {
          clearTimeout(validateTimeout);
        }
        changeDisposable.dispose();
      });
    }
  });

  // Return dispose function
  const disposeFunction = {
    dispose: () => {
      if (validateTimeout) {
        clearTimeout(validateTimeout);
      }
      disposable.dispose();
      // Clean up the registration tracker
      if (monaco._validationSetup && monaco._validationSetup[languageId]) {
        delete monaco._validationSetup[languageId];
      }
    }
  };
  
  // Store the disposal function to prevent duplicate setup
  monaco._validationSetup[languageId] = disposeFunction;
  
  return disposeFunction;
}

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

function setupQueryLanguage(monaco, { fieldNames = {} } = {}) {
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
function createQueryEditor(monaco, container, { fieldNames = {}, initialValue = '', placeholder = '', showClearButton = true } = {}) {
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

/**
 * Sets up a smart table with query filtering, grouping, and sorting capabilities
 * @param {object} monaco The Monaco editor instance
 * @param {object} options Configuration options
 * @param {HTMLTableElement} options.table The table element to enhance
 * @param {object[]} options.data The data to display in the table
 * @param {object} options.columns Column definitions { field, header, render?, responsive? }
 * @param {object} options.editorContainer Container element for the Monaco editor
 * @param {boolean} options.showCheckboxes Whether to show selection checkboxes (default: true)
 * @param {boolean} options.multiSelect Whether to enable multi-selection (default: true)
 * @param {function} options.onSelectionChange Callback when selection changes (receives array with last selected first)
 * @returns {object} Object containing control methods
 */
function setupSmartTable(monaco, { 
  table, 
  data, 
  columns, 
  editorContainer, 
  showCheckboxes = false, 
  multiSelect = true,
  onSelectionChange = null 
}) {
  let sortField = null;
  let sortDirection = 'asc';
  let groupByField = '';
  let selectedRows = new Set();
  let selectionOrder = []; // Track order of selection (last selected first)
  let lastClickedRowId = null; // Track last clicked row for range selection
  let collapsedGroups = new Set();
  let isNewGrouping = false; // Track if we just changed grouping field
  let filteredData = data; // Track currently filtered data
  let originalColumns = [...columns]; // Store original column order
  let currentColumns = [...columns]; // Track current column order

  // Check if we have a split table setup
  const headerTable = document.getElementById('header-table');
  const isSplitTable = headerTable && headerTable !== table;

  // Use header table for header, main table for body
  const tableForHeader = isSplitTable ? headerTable : table;
  const tableForBody = table;

  // Add CSS class to tables based on checkbox setting
  if (!showCheckboxes) {
    tableForHeader.classList.add('no-checkboxes');
    tableForBody.classList.add('no-checkboxes');
  }
  
  // Add CSS class for multi-select behavior
  if (!multiSelect) {
    tableForHeader.classList.add('no-multiselect');
    tableForBody.classList.add('no-multiselect');
  }

  // Set up the query language feature with the data fields
  const fieldNames = {};

  // Extract field definitions from the first data item and columns
  if (data.length > 0) {
    const sampleItem = data[0];
    Object.keys(sampleItem).forEach(field => {
      const fieldType = typeof sampleItem[field] === 'boolean' ? 'boolean' :
        typeof sampleItem[field] === 'number' ? 'number' : 'string';
      
      let fieldValues = undefined;
      if (fieldType === 'string') {
        // Get unique values, filtering out null/undefined and empty strings
        const uniqueValues = [...new Set(data.map(item => item[field]))];
        const definedValues = uniqueValues.filter(value => 
          value !== null && value !== undefined && value !== ''
        );
        
        // Check if there are any null/undefined/empty values in the data
        const hasUndefinedValues = uniqueValues.some(value => 
          value === null || value === undefined || value === ''
        );
        
        // Include a special keyword for searching null/undefined values
        fieldValues = hasUndefinedValues 
          ? [...definedValues, 'NULL'] 
          : definedValues;
      }
      
      fieldNames[field] = {
        type: fieldType,
        values: fieldValues
      };
    });
  }

  // Create query editor using the new modular approach
  const { editor, model } = createQueryEditor(monaco, editorContainer, {
    fieldNames,
    placeholder: 'Search or filter results... (e.g., age > 25 AND city = "New York")'
  });

  // Add the query-inputfield class for consistent styling
  editorContainer.classList.add('query-inputfield');

  // Manually trigger initial validation for the created model
  // This ensures validation is set up for our existing model
  setTimeout(() => {
    const value = model.getValue();
    // Trigger validation by simulating a content change
    if (value === '') {
      // For empty content, ensure we clear any previous markers
      monaco.editor.setModelMarkers(model, model.getLanguageId(), []);
    }
  }, 10);

  // Function to reorder columns based on grouping
  function updateColumnOrder() {
    if (groupByField) {
      // Move the grouped column to the first position
      const groupedColumn = originalColumns.find(col => col.field === groupByField);
      const otherColumns = originalColumns.filter(col => col.field !== groupByField);
      currentColumns = groupedColumn ? [groupedColumn, ...otherColumns] : [...originalColumns];
    } else {
      // Restore original column order when not grouping
      currentColumns = [...originalColumns];
    }
  }

  // Function to rebuild table headers
  function rebuildHeaders() {
    const targetTable = isSplitTable ? tableForHeader : tableForBody;
    const existingThead = targetTable.querySelector('thead');
    if (existingThead) {
      existingThead.remove();
    }

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    // Add select all header (conditionally)
    if (showCheckboxes) {
      const selectAllHeader = document.createElement('th');
      selectAllHeader.className = 'select-cell';
      const selectAllCheckbox = document.createElement('input');
      selectAllCheckbox.type = 'checkbox';
      selectAllCheckbox.className = 'row-checkbox';
      selectAllCheckbox.addEventListener('change', () => {
        if (selectAllCheckbox.checked) {
          // Select all filtered items
          filteredData.forEach(obj => {
            if (!selectedRows.has(obj.id)) {
              handleSelectionChange(obj.id, true);
            }
          });
        } else {
          // Deselect all items
          const idsToDeselect = [...selectedRows];
          idsToDeselect.forEach(id => {
            handleSelectionChange(id, false);
          });
        }
        renderAndSync(filteredData);
      });
      selectAllHeader.appendChild(selectAllCheckbox);
      headerRow.appendChild(selectAllHeader);
    }

    // Add column headers with responsive classes (including grouped column)
    currentColumns.forEach(({ field, header, responsive = {} }) => {
      const th = document.createElement('th');
      th.textContent = header;
      th.setAttribute('data-field', field);
      
      // Add special class for grouped column
      if (groupByField && field === groupByField) {
        th.classList.add('grouped-column-header');
      }
      
      // Add responsive classes
      if (responsive.priority) {
        th.classList.add(`col-priority-${responsive.priority}`);
      }
      if (responsive.size) {
        th.classList.add(`col-${responsive.size}`);
      }
      if (responsive.hideMobile) {
        th.classList.add('hidden-mobile');
      }
      if (responsive.hideSmall) {
        th.classList.add('hidden-small');
      }
      
      if (sortField === field) {
        th.className += ` sorted ${sortDirection}`;
      }
      th.addEventListener('click', () => {
        if (sortField === field) {
          sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          sortField = field;
          sortDirection = 'asc';
        }

        // Update header classes
        headerRow.querySelectorAll('th').forEach(header => {
          header.className = header.className.replace(/\ssorted\s|\sasc\s|\sdesc\s/g, '').trim();
        });
        th.className += ` sorted ${sortDirection}`;

        // Rerender with new sorting
        const filteredIds = filterObjects(data, model.getValue());
        renderAndSync(data.filter(obj => filteredIds.includes(obj.id)));
      });
      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    targetTable.appendChild(thead);
  }

  // Function to update all visual selection states
  function updateVisualSelectionStates() {
    // Update row visual states (for both with and without checkboxes)
    document.querySelectorAll('tbody tr:not(.group-header)').forEach(rowElement => {
      const rowId = parseInt(rowElement.getAttribute('data-row-id'));
      if (!isNaN(rowId)) {
        const isSelected = selectedRows.has(rowId);
        const isLastSelected = selectionOrder.length > 0 && selectionOrder[0] === rowId;
        
        if (isSelected) {
          rowElement.classList.add('selected');
          if (isLastSelected) {
            rowElement.classList.add('last-selected');
          } else {
            rowElement.classList.remove('last-selected');
          }
        } else {
          rowElement.classList.remove('selected', 'last-selected');
        }
      }
    });

    // Update checkbox states if checkboxes are enabled
    if (showCheckboxes) {
      document.querySelectorAll('.row-checkbox').forEach(checkbox => {
        const rowElement = checkbox.closest('tr');
        if (rowElement) {
          const rowId = parseInt(rowElement.getAttribute('data-row-id'));
          if (!isNaN(rowId)) {
            checkbox.checked = selectedRows.has(rowId);
          }
        }
      });
    }
  }

  // Function to update info section
  function updateInfoSection() {
    let infoSection = document.querySelector('.smart-table-info');
    if (!infoSection) {
      // Create info section if it doesn't exist
      infoSection = document.createElement('div');
      infoSection.className = 'smart-table-info';
      
      const wrapper = tableForBody.closest('.smart-table-wrapper');
      const headerContainer = wrapper.querySelector('.smart-table-header-container');
      wrapper.insertBefore(infoSection, headerContainer);
    }
    
    const totalOriginalRecords = data.length;
    const filteredRecords = filteredData.length;
    const selectedCount = selectedRows.size;
    
    let infoText = '';
    
    // Check if data is filtered
    if (filteredRecords < totalOriginalRecords) {
      infoText = `${filteredRecords} record${filteredRecords !== 1 ? 's' : ''}, filtered out of ${totalOriginalRecords} record${totalOriginalRecords !== 1 ? 's' : ''}`;
    } else {
      infoText = `${filteredRecords} record${filteredRecords !== 1 ? 's' : ''}`;
    }
    
    // Add selection information
    if (selectedCount > 0) {
      infoText += ` and ${selectedCount} ${selectedCount === 1 ? 'is' : 'are'} selected`;
    }
    
    infoSection.textContent = infoText;
    
    // Update select all checkbox state
    updateSelectAllCheckbox();
  }

  // Function to update select all checkbox state
  function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.querySelector('.smart-table-header .row-checkbox');
    if (selectAllCheckbox && showCheckboxes) {
      const totalFilteredRows = filteredData.length;
      const selectedFilteredRows = filteredData.filter(obj => selectedRows.has(obj.id)).length;
      
      if (selectedFilteredRows === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
      } else if (selectedFilteredRows === totalFilteredRows) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
      } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
      }
    }
  }

  // Function to handle selection changes
  function handleSelectionChange(rowId, isSelected, isRangeSelection = false) {
    if (isSelected) {
      if (!multiSelect && !isRangeSelection) {
        // Clear previous selections if multiSelect is disabled
        selectedRows.clear();
        selectionOrder = [];
      }
      selectedRows.add(rowId);
      // Add to beginning of array (last selected first)
      selectionOrder = [rowId, ...selectionOrder.filter(id => id !== rowId)];
    } else {
      selectedRows.delete(rowId);
      selectionOrder = selectionOrder.filter(id => id !== rowId);
    }
    
    updateInfoSection();
    updateVisualSelectionStates();
    
    // Trigger callback if provided
    if (onSelectionChange) {
      const selectedData = selectionOrder.map(id => 
        data.find(item => item.id === id)
      ).filter(Boolean);
      onSelectionChange(selectedData);
    }
  }

  // Function to handle range selection (Shift+click)
  function handleRangeSelection(targetRowId) {
    if (!lastClickedRowId) {
      // No previous selection, treat as single selection
      handleSelectionChange(targetRowId, true);
      lastClickedRowId = targetRowId;
      return;
    }

    // Get the visible rows in current order (filtered and sorted)
    const visibleRowIds = filteredData.map(obj => obj.id);
    const startIndex = visibleRowIds.indexOf(lastClickedRowId);
    const endIndex = visibleRowIds.indexOf(targetRowId);

    if (startIndex === -1 || endIndex === -1) {
      // Fallback to single selection if we can't find the range
      handleSelectionChange(targetRowId, true);
      lastClickedRowId = targetRowId;
      return;
    }

    // Select all rows in the range
    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);
    
    for (let i = minIndex; i <= maxIndex; i++) {
      const rowId = visibleRowIds[i];
      handleSelectionChange(rowId, true, true); // Mark as range selection
    }
    
    lastClickedRowId = targetRowId;
  }

  // Function to sort objects
  function sortObjects(objects) {
    const sorted = [...objects].sort((a, b) => {
      // If no sort field is set, maintain original order
      if (!sortField) return 0;

      const aValue = a[sortField];
      const bValue = b[sortField];

      if (aValue === bValue) return 0;
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      const result = typeof aValue === 'string' ?
        aValue.localeCompare(bValue) :
        aValue - bValue;

      return sortDirection === 'asc' ? result : -result;
    });

    return sorted;
  }

  // Function to group objects
  function groupObjects(objects) {
    if (!groupByField) return objects;

    const groups = new Map();
    objects.forEach(obj => {
      const value = obj[groupByField];
      const key = value === null || value === undefined ? 'N/A' : value;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(obj);
    });

    // Sort objects within each group if we're sorting by a non-grouped field
    if (sortField && sortField !== groupByField) {
      groups.forEach((groupObjects, key) => {
        groups.set(key, sortObjects(groupObjects));
      });
    }

    // Sort groups by key, respecting sort direction when sorting by grouped field
    const groupEntries = [...groups.entries()].sort(([a], [b]) => {
      if (a === 'N/A') return 1;
      if (b === 'N/A') return -1;
      
      const result = typeof a === 'string' ? a.localeCompare(b) : a - b;
      
      // If we're sorting by the grouped field, respect the sort direction
      if (sortField === groupByField) {
        return sortDirection === 'asc' ? result : -result;
      }
      
      // Otherwise, default to ascending order for groups
      return result;
    });

    return groupEntries;
  }

  // Function to render objects with grouping
  function renderObjects(filteredObjects) {
    const tbody = tableForBody.querySelector('tbody') || tableForBody.appendChild(document.createElement('tbody'));
    tbody.innerHTML = ''; // Clear previous rows

    if (!groupByField) {
      // No grouping - just sort and render
      const sortedObjects = sortObjects(filteredObjects);
      renderRows(sortedObjects, tbody);
      return;
    }

    // With grouping - groupObjects will handle sorting internally
    const groups = groupObjects(filteredObjects);

    groups.forEach(([groupValue, objects], groupIndex) => {
      // Only start with groups collapsed when it's a new grouping field
      if (isNewGrouping && !collapsedGroups.has(groupIndex)) {
        collapsedGroups.add(groupIndex);
      }

      // Add group header
      const groupHeader = document.createElement('tr');
      groupHeader.className = 'group-header';
      if (collapsedGroups.has(groupIndex)) {
        groupHeader.className += ' collapsed';
      }

      const groupCell = document.createElement('td');
      // Calculate colspan based on all columns (including empty grouped column + select column if present)
      const visibleColumnsCount = currentColumns.length;
      groupCell.colSpan = visibleColumnsCount + (showCheckboxes ? 1 : 0);
      
      // Apply the same render logic as the column for consistency
      const groupedColumn = currentColumns.find(col => col.field === groupByField);
      const renderedGroupValue = groupedColumn && groupedColumn.render 
        ? groupedColumn.render(groupValue) 
        : groupValue;
      
      // Show only the group value, not the redundant column name since it's in the header
      groupCell.innerHTML = `
        <span class="group-toggle"></span>
        ${renderedGroupValue} (${objects.length} items)
      `;

      groupHeader.appendChild(groupCell);
      tbody.appendChild(groupHeader);

      // Add group rows
      renderRows(objects, tbody, groupIndex);

      // Set up group toggle
      groupHeader.addEventListener('click', () => {
        const isCollapsed = collapsedGroups.has(groupIndex);
        if (isCollapsed) {
          collapsedGroups.delete(groupIndex);
          groupHeader.classList.remove('collapsed');
        } else {
          collapsedGroups.add(groupIndex);
          groupHeader.classList.add('collapsed');
        }

        const groupRows = tbody.querySelectorAll(`[data-group="${groupIndex}"]`);
        groupRows.forEach(row => {
          if (isCollapsed) {
            row.classList.remove('group-collapsed');
          } else {
            row.classList.add('group-collapsed');
          }
        });
      });
    });

    // Reset the new grouping flag after rendering
    isNewGrouping = false;
  }

  // Function to render table rows
  function renderRows(objects, tbody, groupIndex = null) {
    objects.forEach((obj) => {
      const row = document.createElement('tr');
      row.setAttribute('data-row-id', obj.id); // Add row ID for selection tracking
      if (groupIndex !== null) {
        row.setAttribute('data-group', groupIndex);
        if (collapsedGroups.has(groupIndex)) {
          row.className = 'group-collapsed';
        }
      }

      // Add select checkbox (conditionally)
      if (showCheckboxes) {
        const selectCell = document.createElement('td');
        selectCell.className = 'select-cell';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'row-checkbox';
        checkbox.checked = selectedRows.has(obj.id);
        checkbox.addEventListener('change', () => {
          handleSelectionChange(obj.id, checkbox.checked);
        });
        selectCell.appendChild(checkbox);
        row.appendChild(selectCell);
      }

      // Enhanced multi-selection functionality
      row.addEventListener('click', (e) => {
        // Prevent default behavior for selection clicks
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
          e.preventDefault();
        }

        const isCurrentlySelected = selectedRows.has(obj.id);

        if (e.shiftKey && multiSelect) {
          // Shift+click: Range selection
          handleRangeSelection(obj.id);
        } else if (e.ctrlKey || e.metaKey) {
          // Ctrl/Cmd+click: Toggle selection
          handleSelectionChange(obj.id, !isCurrentlySelected);
          lastClickedRowId = obj.id;
        } else {
          // Regular click: Single selection (clear others)
          if (multiSelect) {
            // Clear all selections first
            const wasSelected = isCurrentlySelected;
            selectedRows.clear();
            selectionOrder = [];
            updateInfoSection();
            
            // Then select this one (unless it was the only one selected)
            if (!wasSelected || selectedRows.size > 1) {
              handleSelectionChange(obj.id, true);
            }
          } else {
            // Single select mode
            handleSelectionChange(obj.id, !isCurrentlySelected);
          }
          lastClickedRowId = obj.id;
        }

        // Update all visual states
        updateVisualSelectionStates();
      });

      // Add data cells with responsive classes (render grouped column cells as empty)
      currentColumns.forEach(({ field, render, responsive = {} }) => {
        const cell = document.createElement('td');
        
        // Render grouped column cells as empty since all values in the group are the same
        if (groupByField && field === groupByField) {
          cell.innerHTML = ''; // Empty content but cell structure maintained
          cell.classList.add('grouped-column-cell'); // Add special class for styling
        } else {
          cell.innerHTML = render ? render(obj[field], obj) : obj[field];
        }
        
        cell.setAttribute('data-field', field);
        
        // Add responsive classes to match the header
        if (responsive.priority) {
          cell.classList.add(`col-priority-${responsive.priority}`);
        }
        if (responsive.size) {
          cell.classList.add(`col-${responsive.size}`);
        }
        if (responsive.hideMobile) {
          cell.classList.add('hidden-mobile');
        }
        if (responsive.hideSmall) {
          cell.classList.add('hidden-small');
        }
        if (responsive.allowWrap) {
          cell.classList.add('flexible-text');
        }
        
        row.appendChild(cell);
      });

      // Apply visual selection state
      if (selectedRows.has(obj.id)) {
        row.classList.add('selected');
        // Check if this is the last selected row
        if (selectionOrder.length > 0 && selectionOrder[0] === obj.id) {
          row.classList.add('last-selected');
        }
      }

      tbody.appendChild(row);
    });
  }

  // Flag to prevent infinite synchronization loops
  let isSynchronizing = false;

  // Helper function to synchronize column widths after rendering (for split table mode)
  function synchronizeColumnWidths() {
    if (!isSplitTable || isSynchronizing) return;

    try {
      isSynchronizing = true;

      const headerTable = tableForHeader;
      const bodyTable = tableForBody;

      // Check if both tables are still in the DOM
      if (!headerTable.isConnected || !bodyTable.isConnected) {
        return;
      }

      const headerCells = headerTable.querySelectorAll('thead th');

      // Find the first data row (skip group headers)
      let firstBodyRow = bodyTable.querySelector('tbody tr:not(.group-header)');

      // If no regular rows, try to get any row
      if (!firstBodyRow) {
        firstBodyRow = bodyTable.querySelector('tbody tr');
      }

      if (firstBodyRow && headerCells.length > 0) {
        const bodyCells = firstBodyRow.querySelectorAll('td');

        // Get the container width to respect horizontal limits
        const containerWidth = bodyTable.closest('.smart-table-container').clientWidth;
        const headerContainerWidth = headerTable.closest('.smart-table-header-container').clientWidth;
        const availableWidth = Math.min(containerWidth, headerContainerWidth) - 20; // 20px for padding/margins

        // Remove any existing colgroups
        headerTable.querySelectorAll('colgroup').forEach(cg => cg.remove());
        bodyTable.querySelectorAll('colgroup').forEach(cg => cg.remove());

        // Define responsive column distribution based on actual columns and their metadata
        const columnConfig = [];
        headerCells.forEach((cell, index) => {
          if (index === 0) {
            // Select column - always fixed
            columnConfig.push({ min: 40, max: 50, flex: 0 });
          } else {
            // Find the corresponding column definition
            const fieldName = cell.getAttribute('data-field');
            const columnDef = columns.find(col => col.field === fieldName);
            
            if (columnDef && columnDef.responsive) {
              const { size } = columnDef.responsive;
              
              switch (size) {
                case 'fixed-narrow':
                  columnConfig.push({ min: 50, max: 80, flex: 0 });
                  break;
                case 'fixed-medium':
                  columnConfig.push({ min: 80, max: 120, flex: 0 });
                  break;
                case 'flexible-small':
                  columnConfig.push({ min: 100, max: 150, flex: 1 });
                  break;
                case 'flexible-medium':
                  columnConfig.push({ min: 120, max: 200, flex: 2 });
                  break;
                case 'flexible-large':
                  columnConfig.push({ min: 150, max: 300, flex: 3 });
                  break;
                default:
                  columnConfig.push({ min: 80, max: 150, flex: 1 });
              }
            } else {
              // Default configuration for columns without responsive metadata
              columnConfig.push({ min: 80, max: 150, flex: 1 });
            }
          }
        });

        // Calculate responsive column widths
        let totalFlexWidth = 0;
        let totalFixedWidth = 0;
        
        columnConfig.forEach(config => {
          if (config.flex === 0) {
            totalFixedWidth += config.min;
          } else {
            totalFlexWidth += config.flex;
            totalFixedWidth += config.min;
          }
        });

        const remainingWidth = Math.max(0, availableWidth - totalFixedWidth);
        const flexUnit = totalFlexWidth > 0 ? remainingWidth / totalFlexWidth : 0;

        const columnWidths = columnConfig.map(config => {
          if (config.flex === 0) {
            return config.min;
          } else {
            const flexWidth = config.min + (config.flex * flexUnit);
            return Math.min(Math.max(flexWidth, config.min), config.max);
          }
        });

        // Ensure total width doesn't exceed container
        const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0);
        if (totalWidth > availableWidth) {
          const scale = availableWidth / totalWidth;
          columnWidths.forEach((width, index) => {
            columnWidths[index] = Math.max(width * scale, columnConfig[index].min);
          });
        }

        // Create colgroup elements for both tables to enforce column widths
        const headerColgroup = document.createElement('colgroup');
        const bodyColgroup = document.createElement('colgroup');

        columnWidths.forEach((width, index) => {
          const headerCol = document.createElement('col');
          const bodyCol = document.createElement('col');
          headerCol.style.width = `${Math.round(width)}px`;
          bodyCol.style.width = `${Math.round(width)}px`;
          headerColgroup.appendChild(headerCol);
          bodyColgroup.appendChild(bodyCol);
        });

        // Insert colgroups at the beginning of tables
        headerTable.insertBefore(headerColgroup, headerTable.firstChild);
        bodyTable.insertBefore(bodyColgroup, bodyTable.firstChild);

        // Set table-layout to fixed for consistent behavior
        headerTable.style.tableLayout = 'fixed';
        bodyTable.style.tableLayout = 'fixed';
      }
    } catch (error) {
      console.warn('Error synchronizing column widths:', error);
    } finally {
      isSynchronizing = false;
    }
  }

  // Set up group by dropdown
  const groupBySelect = document.getElementById('group-by');
  if (groupBySelect) {
    // Only include columns that are marked as groupable
    originalColumns
      .filter(column => column.groupable === true)
      .forEach(({ field, header }) => {
        const option = document.createElement('option');
        option.value = field;
        option.textContent = header;
        groupBySelect.appendChild(option);
      });

    groupBySelect.addEventListener('change', () => {
      groupByField = groupBySelect.value;
      updateColumnOrder(); // Update column order based on grouping
      collapsedGroups.clear(); // Reset collapsed state
      isNewGrouping = true; // Mark as new grouping to start collapsed
      const filteredIds = filterObjects(data, model.getValue());
      renderAndSync(data.filter(obj => filteredIds.includes(obj.id)));
    });
  }

  // Wrapper function to render objects and synchronize column widths
  function renderAndSync(filteredObjects) {
    filteredData = filteredObjects;
    updateColumnOrder(); // Ensure column order is up to date
    rebuildHeaders(); // Rebuild headers with current column order
    renderObjects(filteredObjects);
    updateInfoSection();

    // Synchronize column widths after rendering for split table
    // Use a longer delay to ensure DOM is fully rendered
    if (isSplitTable) {
      setTimeout(() => synchronizeColumnWidths(), 100);
    }
  }

  // Parse and apply the query to filter objects
  function applyQuery(query) {
    try {
      const filteredIds = filterObjects(data, query);
      const filteredObjects = data.filter((obj) => filteredIds.includes(obj.id));
      renderAndSync(filteredObjects);

      return { error: null, count: filteredObjects.length };
    } catch (error) {
      renderAndSync(data); // Reset to show all objects
      return { error: error.message, count: data.length };
    }
  }

  // Initial render
  renderAndSync(data);

  // Function to check validation and update table
  function handleQueryChange() {
    const query = model.getValue();

    // Get validation markers
    const markers = monaco.editor.getModelMarkers({ resource: model.uri });
    const errors = markers.filter(marker =>
      marker.severity === monaco.MarkerSeverity.Error
    );

    if (errors.length === 0) {
      // No validation errors - apply the query and remove error class
      try {
        applyQuery(query);
        // Remove error class from the editor container
        editorContainer.classList.remove('error');
      } catch (error) {
        // Runtime error from query execution
        // Add error class to show the error state visually
        editorContainer.classList.add('error');
      }
    } else {
      // Has validation errors - add error class and don't filter
      editorContainer.classList.add('error');
    }
  }

  // Set up model change listener with proper validation handling
  let changeTimeout;
  model.onDidChangeContent(() => {
    // Clear previous timeout
    if (changeTimeout) {
      clearTimeout(changeTimeout);
    }

    // Debounce the change handling to allow validation to complete
    // Use 350ms to ensure it runs after the validation's 300ms debounce
    changeTimeout = setTimeout(handleQueryChange, 350);
  });

  // Also listen to marker changes for more responsive error handling
  monaco.editor.onDidChangeMarkers(([resource]) => {
    if (resource.toString() === model.uri.toString()) {
      // Clear timeout if we have a marker change event - markers have been updated
      if (changeTimeout) {
        clearTimeout(changeTimeout);
      }
      // Handle immediately since markers have been updated
      setTimeout(handleQueryChange, 10); // Small delay to ensure markers are fully processed
    }
  });

  // Set up sticky header shadow effect on scroll
  const tableContainer = tableForBody.closest('.smart-table-container');
  if (tableContainer && isSplitTable) {
    // For split tables, add shadow to the header container
    const headerContainer = tableForHeader.closest('.smart-table-header-container');
    const handleScroll = () => {
      if (tableContainer.scrollTop > 0) {
        if (headerContainer) {
          headerContainer.classList.add('scrolled');
        }
      } else {
        if (headerContainer) {
          headerContainer.classList.remove('scrolled');
        }
      }
    };

    tableContainer.addEventListener('scroll', handleScroll);

    // Store scroll handler for cleanup
    tableForBody._scrollHandler = handleScroll;
    tableForBody._scrollContainer = tableContainer;
  } else if (tableContainer) {
    // For single tables, use the existing logic
    const handleScroll = () => {
      if (tableContainer.scrollTop > 0) {
        tableContainer.classList.add('scrolled');
      } else {
        tableContainer.classList.remove('scrolled');
      }
    };

    tableContainer.addEventListener('scroll', handleScroll);

    // Store scroll handler for cleanup
    tableForBody._scrollHandler = handleScroll;
    tableForBody._scrollContainer = tableContainer;
  }

  // Set up resize observer for dynamic column width synchronization
  if (isSplitTable && window.ResizeObserver) {
    try {
      let resizeTimeout;
      const resizeObserver = new ResizeObserver((entries) => {
        // Debounce resize events to prevent excessive synchronization
        if (resizeTimeout) {
          clearTimeout(resizeTimeout);
        }

        resizeTimeout = setTimeout(() => {
          // Use requestAnimationFrame to avoid ResizeObserver loop errors
          requestAnimationFrame(() => {
            try {
              // Only synchronize if the table is still in the DOM
              if (tableForBody.isConnected && tableForHeader.isConnected) {
                synchronizeColumnWidths();
              }
            } catch (error) {
              console.warn('Error in resize observer callback:', error);
            }
          });
        }, 100); // 100ms debounce
      });

      // Add a small delay before observing to ensure DOM is ready
      setTimeout(() => {
        try {
          if (tableForBody.isConnected) {
            resizeObserver.observe(tableForBody);
            // Store observer for cleanup
            tableForBody._resizeObserver = resizeObserver;
          }
        } catch (error) {
          console.warn('Error setting up resize observer:', error);
        }
      }, 100);

    } catch (error) {
      console.warn('ResizeObserver not available or failed to initialize:', error);
    }

    // Return control methods
    return {
      editor,
      refresh: () => renderAndSync(data),
      filter: (query) => {
        model.setValue(query);

        // Check for validation errors before applying the query
        const markers = monaco.editor.getModelMarkers({ resource: model.uri });
        const hasErrors = markers.some(marker =>
          marker.severity === monaco.MarkerSeverity.Error
        );

        // Only apply the query if there are no errors
        if (!hasErrors) {
          editorContainer.classList.remove('error');
          return applyQuery(query);
        } else {
          editorContainer.classList.add('error');
          return data; // Return unfiltered data
        }
      },
      sort: (field, direction) => {
        sortField = field;
        sortDirection = direction || 'asc';
        const filteredIds = filterObjects(data, model.getValue());
        renderAndSync(data.filter(obj => filteredIds.includes(obj.id)));
      },
      group: (field) => {
        groupByField = field;
        updateColumnOrder(); // Update column order based on grouping
        const filteredIds = filterObjects(data, model.getValue());
        renderAndSync(data.filter(obj => filteredIds.includes(obj.id)));
      },
      getSelectedRows: () => selectionOrder.map(id => 
        data.find(item => item.id === id)
      ).filter(Boolean),
      getSelectedRowIds: () => [...selectionOrder],
      getSelectedCount: () => selectedRows.size,
      addRecord: (record) => {
        // Generate a new ID if not provided
        if (!record.id) {
          const maxId = Math.max(...data.map(item => item.id || 0));
          record.id = maxId + 1;
        }
        
        // Add the record to the data array
        data.push(record);
        
        // Apply current filter to refresh the table with new data
        const currentQuery = model.getValue();
        const filteredIds = filterObjects(data, currentQuery);
        const newFilteredData = data.filter(obj => filteredIds.includes(obj.id));
        
        // Update filtered data reference
        filteredData = newFilteredData;
        
        // Select the newly added record if it's visible after filtering
        if (filteredIds.includes(record.id)) {
          // If we have grouping enabled, expand the group containing the new record
          if (groupByField) {
            const recordGroupValue = record[groupByField];
            const groupKey = recordGroupValue === null || recordGroupValue === undefined ? 'N/A' : recordGroupValue;
            
            // Get the grouped data to find the group index
            const groups = groupObjects(newFilteredData);
            const groupIndex = groups.findIndex(([groupValue]) => groupValue === groupKey);
            
            // Expand the group if it exists and is currently collapsed
            if (groupIndex !== -1 && collapsedGroups.has(groupIndex)) {
              collapsedGroups.delete(groupIndex);
            }
          }
          
          // Re-render the table
          renderAndSync(newFilteredData);
          
          // Clear previous selections
          selectedRows.clear();
          selectionOrder = [];
          
          // Select the new record
          handleSelectionChange(record.id, true);
        } else {
          // Record is filtered out, just re-render without selecting
          renderAndSync(newFilteredData);
        }
        
        return record;
      },
      dispose: () => {
        // Clean up scroll event listener
        if (tableForBody._scrollHandler && tableForBody._scrollContainer) {
          tableForBody._scrollContainer.removeEventListener('scroll', tableForBody._scrollHandler);
          delete tableForBody._scrollHandler;
          delete tableForBody._scrollContainer;
        }

        // Clean up resize observer
        if (tableForBody._resizeObserver) {
          try {
            tableForBody._resizeObserver.disconnect();
          } catch (error) {
            console.warn('Error disconnecting resize observer:', error);
          }
          delete tableForBody._resizeObserver;
        }

        model.dispose();
        editor.dispose();
      }
    }
  }
}
// Helper function to filter objects based on query
function filterObjects(objects, query) {
  if (!query.trim()) return objects.map(obj => obj.id);

  // Detect if this is search mode or structured query mode
  const hasOperators = /[=!<>()]|(\bAND\b|\bOR\b|\bIN\b)/i.test(query);
  
  if (!hasOperators) {
    // Search mode: look for terms in any field values
    return searchObjects(objects, query);
  }

  // Structured query mode (existing logic)
  const results = [];
  for (const obj of objects) {
    try {
      if (evaluateExpression(obj, query)) {
        results.push(obj.id);
      }
    } catch (error) {
      throw new Error(`Query error: ${error.message}`);
    }
  }
  return results;
}

// Helper function for search mode
function searchObjects(objects, searchTerms) {
  const terms = searchTerms.trim().toLowerCase().split(/\s+/).filter(term => term.length > 0);
  
  if (terms.length === 0) return objects.map(obj => obj.id);

  const results = [];
  
  for (const obj of objects) {
    // Convert all object values to searchable strings
    const searchableValues = Object.values(obj)
      .map(value => {
        if (value === null || value === undefined) return '';
        return String(value).toLowerCase();
      })
      .join(' ');

    // Check if all search terms are found in the searchable values
    const allTermsFound = terms.every(term => searchableValues.includes(term));
    
    if (allTermsFound) {
      results.push(obj.id);
    }
  }
  
  return results;
}

// Helper function to evaluate expression (imported from query-language)
function evaluateExpression(obj, expression) {
  if (!expression.trim()) return true;

  // Remove extra spaces
  expression = expression.replace(/\s+/g, ' ').trim();

  // Process the innermost parentheses first
  while (/\(([^()]+)\)/.test(expression)) {
    expression = expression.replace(/\(([^()]+)\)/g, (match, innerExpr) => {
      return processGroup(obj, innerExpr) ? 'true' : 'false';
    });
  }

  return processGroup(obj, expression);
}

// Helper function to process condition groups
function processGroup(obj, group) {
  const orConditions = group.split(/\s+OR\s+/);

  return orConditions.some((conditionGroup) => {
    const andConditions = conditionGroup.split(/\s+AND\s+/);

    return andConditions.every((condition) => {
      if (condition.trim().toLowerCase() === 'false') return false;
      if (condition.trim().toLowerCase() === 'true') return true;

      try {
        const parsedCondition = parseCondition(condition);
        return applyCondition(obj, parsedCondition);
      } catch (error) {
        throw new Error(`Invalid condition: ${condition}`);
      }
    });
  });
}

// Helper function to parse conditions
function parseCondition(condition) {
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

    // Handle quoted strings
    if (parsedValue.startsWith('"') && parsedValue.endsWith('"')) {
      parsedValue = parsedValue.slice(1, -1);
    }
    // Handle special values
    else if (parsedValue === 'NULL') {
      parsedValue = null;
    }
    else if (parsedValue.toLowerCase() === 'true') {
      parsedValue = true;
    }
    else if (parsedValue.toLowerCase() === 'false') {
      parsedValue = false;
    }
    // Handle numbers
    else if (!isNaN(parsedValue) && parsedValue !== '') {
      parsedValue = parseFloat(parsedValue);
    }
    // Otherwise keep as string

    return { field, operator, value: parsedValue };
  }

  throw new Error(`Invalid condition: ${condition}`);
}

// Helper function to apply conditions
function applyCondition(obj, { field, operator, value }) {
  // Handle missing field - treat as null/undefined
  const objValue = field in obj ? obj[field] : null;
  
  // Helper function to check if value is null/undefined/empty
  const isNullish = (val) => val === null || val === undefined || val === '';
  
  switch (operator) {
    case '=': 
      // Handle NULL comparison specially
      if (value === null) return isNullish(objValue);
      if (isNullish(objValue)) return false;
      return objValue == value;
      
    case '!=': 
      // Handle NULL comparison specially
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
      // Handle NULL in array specially
      if (value.includes(null)) {
        return isNullish(objValue) || value.includes(objValue);
      }
      if (isNullish(objValue)) return false;
      return value.includes(objValue);
      
    default: return false;
  }
}



                // Expose feature to global scope when available
                if (typeof window !== 'undefined') {
                  window.awesomeEditor = window.awesomeEditor || {};
                  window.awesomeEditor['smart-table'] = {
                    setupSmartTable, setupQueryLanguage, createQueryEditor
                  };
                  
                  // Also expose functions directly on window for immediate access
                  window.setupSmartTable = setupSmartTable;
                  window.setupQueryLanguage = setupQueryLanguage;
                  window.createQueryEditor = createQueryEditor;
                }
              }
            })();
