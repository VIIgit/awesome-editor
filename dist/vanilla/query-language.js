/**
 * @license
 * query-language feature for Awesome Editor
 * Adds custom query language support with syntax highlighting and completion
 * 
 * @version 0.1.1
 * @copyright (c) 2025 Awesome Editor Contributors
 * @license MIT License
 */

(function(monaco) {
            if (typeof monaco === 'undefined') {
              console.error('Monaco Editor must be loaded before the query-language feature');
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
      { token: 'keyword', foreground: '007acc', fontStyle: 'bold' }
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
    
    tokenizer: {
      root: [
        // Keywords and operators (most specific word-based matches first)
        [/\b(AND|OR)\b/, 'keyword'],
        [/\b(IN)\b/, { token: 'operator', next: '@inArray' }],
        [/\b(true|false)\b/, 'boolean'],
        
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
  const logicalPattern = /^(AND|OR)$/i;
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
        label: `"${v}"`,
        kind: monaco.languages.CompletionItemKind.Value,
        insertText: `"${v}"`,
        documentation: docMarkdown(`String value "${v}"`),
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
      // Get text up to cursor
      const text = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column
      }).trim();

      // Enhanced context extraction
      const tokens = text.match(/([\w]+|\(|\)|\[|\]|"[^"]*"|\S)/g) || [];
      const context = getExpressionContext(tokens, position);
      let suggestions = [];

      // Context-aware suggestions
      if (context.needsField || context.afterLogical || (tokens.length === 1 && /^[a-zA-Z]+$/.test(tokens[0]) && !fieldPattern.test(tokens[0]))) {
        // Get the current word being typed
        const currentWord = context.afterLogical ? '' : (tokens[tokens.length - 1] || '');
        const prevToken = context.afterLogical ? tokens[tokens.length - 1] : (tokens[tokens.length - 2] || '');
        
        // Only show field suggestions if:
        // 1. We're at the start of a query, or
        // 2. After a logical operator (AND/OR), or
        // 3. We're typing something that isn't a complete field name yet
        if (!prevToken || logicalPattern.test(prevToken) || !fieldPattern.test(currentWord)) {
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
      } else if (context.needsOperator && context.currentField) {
        suggestions = getOperatorSuggestions(fieldNames[context.currentField], position, model);
      } else if (context.needsValue && context.currentField && fieldNames[context.currentField]) {
        suggestions = getValueSuggestions(fieldNames[context.currentField]);
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
            label: `"${v}"`,
            kind: monaco.languages.CompletionItemKind.Value,
            insertText: `"${v}"`,
            documentation: docMarkdown(`String value "${v}"`),
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
    // Enhanced regex - put longer patterns first and use word boundaries for keywords
    const re = /([()\[\]]|!=|>=|<=|=|>|<|\bIN\b|\bAND\b|\bOR\b|,|"(?:[^"\\]|\\.)*(?:"|$)|[-]?\d*\.?\d+|\btrue\b|\bfalse\b|\w+)/gi;
    let match;
    
    while ((match = re.exec(str)) !== null) {
      const value = match[0].trim();
      if (!value) continue; // Skip empty matches

      // Determine token type
      let type = getTokenType(value);
      // Special handling for unclosed strings
      if (type === 'string' && !value.endsWith('"')) {
        type = 'unclosed-string';
      }

      tokens.push({
        value,
        type,
        start: match.index,
        end: match.index + match[0].length
      });
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
    if (/^"/.test(value)) return 'unclosed-string';
    if (/^(true|false)$/i.test(value)) return 'boolean';
    if (/^(AND|OR)$/i.test(value)) return 'keyword';
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
      const isValid = fieldNames[token] || /^[A-Z_][A-Z0-9_]*$/i.test(token);
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

      // Reset expression state after logical operators
      if (['AND', 'OR'].includes(current)) {
        // Check if we have a complete expression before the logical operator
        const hasCompleteExpression = expressionState.hasValue || 
                                    (prev === ']' && tokens.slice(0, index).some(t => t.value.toUpperCase() === 'IN'));
        if (!hasCompleteExpression && !expressionState.inParentheses) {
          addError(token, 'Incomplete expression before logical operator');
        }
        expressionState.reset();
        return;
      }

      // Enhanced field name validation
      if (isValidField(token.value) && !['AND', 'OR', 'IN', 'TRUE', 'FALSE'].includes(current)) {
        if (expressionState.hasField && !expressionState.hasValue && !['AND', 'OR'].includes(prev)) {
          addError(token, 'Unexpected field name. Did you forget an operator or AND/OR?');
        }
        expressionState.hasField = true;
        expressionState.currentField = token.value;
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
           token.type === 'unclosed-string') && expressionState.hasOperator) {
        if (expressionState.currentField) {
          const field = fieldNames[expressionState.currentField];
          if (field) {
            if (field.type === 'string' && token.type !== 'string' && token.type !== 'unclosed-string') {
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
 * @returns {object} The created editor instance and its model
 */
function createQueryEditor(monaco, container, { fieldNames = {}, initialValue = '', placeholder = '' } = {}) {
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



            // Expose feature to global scope
            window.awesomeEditor = window.awesomeEditor || {};
            window.awesomeEditor['query-language'] = {
              setupQueryLanguage, createQueryEditor
            };
          })(window.monaco);
