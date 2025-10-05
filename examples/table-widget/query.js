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
    
    // Convert label to string to handle numeric values
    const labelStr = String(label);
    
    // Special ordering for operators
    if (type === 'operator') {
      const operatorOrder = {
        '=': '1',
        '!=': '2',
        '>': '3',
        '<': '4',
        'IN': '5'
      };
      return `${order[type]}${operatorOrder[labelStr] || '9'}${labelStr.toLowerCase()}`;
    }
    
    return `${order[type]}${labelStr.toLowerCase()}`;
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
  function getValueSuggestions(field, fieldName = 'unknown') {
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
      console.log(`🔍 Generating suggestions for field "${fieldName}" with values:`, field.values);
      const newSuggestions = field.values.map(v => ({
        label: v === 'NULL' ? 'NULL' : `"${v}"`,
        kind: monaco.languages.CompletionItemKind.Value,
        insertText: v === 'NULL' ? 'NULL' : `"${v}"`,
        documentation: v === 'NULL' ? 
          docMarkdown('Special keyword for null/undefined/empty values') :
          docMarkdown(`String value "${v}"`),
        sortText: getSortText('value', v)
      }));
      console.log(`📋 Generated ${newSuggestions.length} suggestions for field "${fieldName}"`);
      suggestions.push(...newSuggestions);
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
      if (isFirstWord && !hasOperators && currentWord.length >= 1 && /^[a-zA-Z]+$/.test(currentWord)) {
        // Show field name suggestions (for structured mode)
        const matchingFields = fieldList.filter(f => 
          f.toLowerCase().startsWith(currentWord.toLowerCase())
        );
        
        if (matchingFields.length > 0) {
          suggestions.push(...matchingFields.map(f => ({
            label: f,
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: `${f} `,
            documentation: docMarkdown(`Field: ${descriptions[f] || f}\n\nClick to start a structured query with this field.`),
            detail: 'Field (start structured query)',
            sortText: `0_field_${f}`, // Sort fields first
            command: { id: 'editor.action.triggerSuggest' } // Auto-trigger next suggestions
          })));
        }

        // Show search mode suggestion for any alphabetical input
        suggestions.push({
          label: `"${currentWord}" (search all fields)`,
          kind: monaco.languages.CompletionItemKind.Text,
          insertText: currentWord,
          documentation: docMarkdown(`Search for "${currentWord}" in any field\n\nType additional words to search for multiple terms.`),
          detail: 'Text search mode',
          sortText: `1_search_${currentWord}` // Sort after fields
        });
        
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
        suggestions = getValueSuggestions(fieldNames[context.currentField], context.currentField);
      } else if (context.needsField || context.afterLogical || (tokens.length === 1 && /^[a-zA-Z]+$/.test(tokens[0]) && !fieldPattern.test(tokens[0]))) {        
        // Only show field suggestions if:
        // 1. We're at the start of a query, or
        // 2. After a logical operator (AND/OR), or
        // 3. We're typing something that isn't a complete field name yet
        if (!prevToken || logicalPattern.test(prevToken) || (currentWord && !fieldPattern.test(currentWord))) {
          // Filter field list by the current word if it's an alphabetical string (including single characters)
          const matchingFields = /^[a-zA-Z]+$/.test(currentWord) && currentWord.length >= 1
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

    // Accept valid expressions ending with string/number/boolean/null
    const lastToken = tokens[tokens.length - 1];
    const validEndTypes = ['string', 'number', 'boolean', 'null'];
    if (
      tokens.length > 0 &&
      !expressionState.hasValue &&
      !expressionState.inParentheses &&
      validEndTypes.includes(lastToken.type) &&
      expressionState.hasField &&
      expressionState.hasOperator
    ) {
      expressionState.hasValue = true;
    }

    if (tokens.length > 0 && !expressionState.hasValue && !expressionState.inParentheses) {
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

  // Helper function to set up validation for a model
  const setupModelValidation = (model) => {
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
    
    return changeDisposable;
  };

  // Set up validation for existing models with this language
  const existingModelDisposables = [];
  monaco.editor.getModels().forEach(model => {
    if (model.getLanguageId() === languageId) {
      const disposable = setupModelValidation(model);
      existingModelDisposables.push(disposable);
    }
  });

  // Set up model change listener for future models
  let validateTimeout = null;
  let disposable = monaco.editor.onDidCreateModel(model => {
    if (model.getLanguageId() === languageId) {
      setupModelValidation(model);
    }
  });

  // Return dispose function
  const disposeFunction = {
    dispose: () => {
      if (validateTimeout) {
        clearTimeout(validateTimeout);
      }
      disposable.dispose();
      // Dispose existing model listeners
      existingModelDisposables.forEach(d => d.dispose());
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
 * Sets up query language support for a Monaco editor instance
 * @param {object} monaco The Monaco editor instance
 * @param {object} options Configuration options
 * @param {object} options.fieldNames The field name definitions with types and valid values
 * @returns {object} The configured editor features
 */
// Track registered languages and their field schemas with better isolation
const registeredLanguages = new Map();
let languageCounter = 0;

// Generate a unique ID for each editor instance
function generateUniqueLanguageId(fieldNames) {
  // Create a hash of the field schema for consistency
  const sortedFields = Object.entries(fieldNames)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, def]) => `${name}:${def.type}:${def.values ? def.values.join('|') : ''}`)
    .join(',');
  
  // Create a hash to make it more compact
  let hash = 0;
  for (let i = 0; i < sortedFields.length; i++) {
    const char = sortedFields.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  // Use absolute hash value and increment counter for uniqueness
  const uniqueId = `querylang-${Math.abs(hash)}-${++languageCounter}`;
  return uniqueId;
}

function setupQueryLanguage(monaco, { fieldNames = {} } = {}) {
  // Always generate a unique language ID for this editor instance
  const languageId = generateUniqueLanguageId(fieldNames);

  // Register new language instance with unique ID
  monaco.languages.register({ id: languageId });
  
  // Set up all language features with the unique language ID
  const completionSetup = setupCompletionProvider(monaco, { fieldNames, languageId });
  const disposables = [
    setupLanguageConfiguration(monaco, languageId),
    setupTokenProvider(monaco, { fieldNames, languageId }),
    completionSetup.provider,
    setupValidation(monaco, { fieldNames, languageId })
  ];
  
  // Set up theme only once (shared across all instances, but that's okay)
  if (!monaco._queryThemeSetup) {
    setupEditorTheme(monaco);
    monaco._queryThemeSetup = true;
  }

  // Store the registration info
  registeredLanguages.set(languageId, { 
    fieldNames,
    setupAutoInsertBrackets: completionSetup.setupAutoInsertBrackets,
    disposables
  });

  return {
    languageId,
    setupAutoInsertBrackets: completionSetup.setupAutoInsertBrackets,
    dispose: () => {
      // Clean up this specific language registration
      disposables.forEach(d => d && d.dispose && d.dispose());
      registeredLanguages.delete(languageId);
    }
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
  // Set up isolated language features for this specific editor instance
  const languageSetup = setupQueryLanguage(monaco, { fieldNames });
  const { languageId, setupAutoInsertBrackets } = languageSetup;

  // Create editor model with unique language ID
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
      top: -12px;
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
    });

    clearButton.addEventListener('mouseleave', () => {
      clearButton.style.background = '#f9fafb';
      clearButton.style.color = '#6b7280';
      clearButton.style.borderColor = '#d1d5db';
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

  // Create editor with standard configuration and proper widget positioning
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
    fixedOverflowWidgets: true,  // This is crucial for proper popup positioning
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
    quickSuggestionsDelay: 100,
    suggestFontSize: 13,
    suggestLineHeight: 20,
    suggest: {
      insertMode: 'insert',
      showStatusBar: false,
      // Ensure suggestions are positioned relative to this editor
      localityBonus: true
    }
  });

  // Set up auto-insert brackets functionality for this specific editor
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

  // Prevent Enter key from adding newlines and handle Tab navigation
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
    
    // Handle Tab key for navigation instead of inserting tab character
    if (e.code === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      
      // Find all focusable elements with tabindex, but exclude Monaco internal elements
      const focusableElements = document.querySelectorAll('[tabindex]:not([tabindex="-1"])');
      const focusableArray = Array.from(focusableElements).filter(element => {
        // Filter out Monaco Editor internal elements
        const isMonacoInternal = element.classList.contains('monaco-hover') ||
                                element.classList.contains('monaco-mouse-cursor-text') ||
                                element.classList.contains('monaco-editor') ||
                                element.closest('.monaco-hover') ||
                                element.closest('.monaco-mouse-cursor-text') ||
                                element.closest('.monaco-editor-hover') ||
                                element.closest('.monaco-scrollable-element') ||
                                (element.className && typeof element.className === 'string' && 
                                 element.className.includes('monaco-')) ||
                                element.getAttribute('role') === 'tooltip';
        
        return !isMonacoInternal;
      });
      
      const currentIndex = focusableArray.indexOf(container);
      
      if (currentIndex !== -1) {
        let nextIndex;
        if (e.shiftKey) {
          // Shift+Tab: Move to previous element
          nextIndex = currentIndex === 0 ? focusableArray.length - 1 : currentIndex - 1;
        } else {
          // Tab: Move to next element
          nextIndex = currentIndex === focusableArray.length - 1 ? 0 : currentIndex + 1;
        }
        
        // Remove focus from the Monaco editor by focusing the next element directly
        focusableArray[nextIndex].focus();
      }
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

  // Prevent newlines from any other source
  model.onDidChangeContent((e) => {
    const currentValue = model.getValue();
    if (/[\r\n]/.test(currentValue)) {
      const cleanValue = currentValue.replace(/[\r\n]/g, ' ');
      model.pushEditOperations([], [{
        range: model.getFullModelRange(),
        text: cleanValue
      }], () => null);
    }
  });

  // Enhanced cleanup method that also disposes language features
  const originalDispose = editor.dispose.bind(editor);
  editor.dispose = () => {
    autoInsertDisposable.dispose();
    if (contentChangeDisposable) {
      contentChangeDisposable.dispose();
    }
    // Clean up the isolated language features
    languageSetup.dispose();
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

  // Add method to update field names dynamically
  editor.updateFieldNames = function(newFieldNames) {
    return updateQueryEditorFieldNames(monaco, languageId, newFieldNames);
  };

  // Add method to get current field names
  editor.getFieldNames = function() {
    return getQueryEditorFieldNames(languageId);
  };

  // Store language ID for reference
  editor.languageId = languageId;

  return { editor, model };
}

/**
 * Updates field names for an existing query editor without recreating it
 * @param {object} monaco The Monaco editor instance
 * @param {string} languageId The language ID used by the editor
 * @param {object} newFieldNames New field definitions
 * @returns {boolean} True if update was successful
 */
function updateQueryEditorFieldNames(monaco, languageId, newFieldNames) {
  try {
    // Store the reference to the language setup for this language ID
    const existingSetup = registeredLanguages.get(languageId);
    if (!existingSetup) {
      console.warn('No existing language setup found for', languageId);
      return false;
    }

    // Dispose existing providers (both completion AND validation)
    if (existingSetup.disposables) {
      // Original structure with disposables array
      const completionProviderIndex = 2; // Based on setupLanguageSupport disposables order
      const validationProviderIndex = 3;
      
      if (existingSetup.disposables[completionProviderIndex]) {
        existingSetup.disposables[completionProviderIndex].dispose();
      }
      
      if (existingSetup.disposables[validationProviderIndex]) {
        existingSetup.disposables[validationProviderIndex].dispose();
      }
    } else {
      // Updated structure with individual providers
      if (existingSetup.completionProvider) {
        existingSetup.completionProvider.dispose();
      }

      if (existingSetup.validationProvider) {
        existingSetup.validationProvider.dispose();
      }
    }

    // Clear validation cache to ensure new provider is created with updated field names
    if (monaco._validationSetup && monaco._validationSetup[languageId]) {
      delete monaco._validationSetup[languageId];
    }

    // Create NEW completion provider with updated field names
    const newCompletionProvider = setupCompletionProvider(monaco, { 
      fieldNames: newFieldNames, 
      languageId 
    });

    // Create NEW validation provider with updated field names
    const newValidationProvider = setupValidation(monaco, { 
      fieldNames: newFieldNames, 
      languageId 
    });

    // Update the stored language setup with new field names and providers
    existingSetup.fieldNames = newFieldNames;
    
    if (existingSetup.disposables) {
      // Update disposables array with new providers
      existingSetup.disposables[2] = newCompletionProvider.provider;
      existingSetup.disposables[3] = newValidationProvider;
    } else {
      // Update individual providers
      existingSetup.completionProvider = newCompletionProvider.provider;
      existingSetup.validationProvider = newValidationProvider;
    }

    // Force re-validation for all models using this language
    const models = monaco.editor.getModels();
    models.forEach(model => {
      if (model.getLanguageId() === languageId) {
        // Clear existing markers first
        monaco.editor.setModelMarkers(model, languageId, []);
        
        // Trigger validation update by making a minimal change and reverting
        const currentValue = model.getValue();
        const currentPosition = model.getPositionAt(currentValue.length);
        
        // Force revalidation by making a minimal change and reverting
        model.pushEditOperations([], [{
          range: new monaco.Range(currentPosition.lineNumber, currentPosition.column, currentPosition.lineNumber, currentPosition.column),
          text: ' '
        }], () => null);
        
        model.pushEditOperations([], [{
          range: new monaco.Range(currentPosition.lineNumber, currentPosition.column, currentPosition.lineNumber, currentPosition.column + 1),
          text: ''
        }], () => null);
        
        // Explicitly trigger validation again after a short delay to ensure providers are ready
        setTimeout(() => {
          const value = model.getValue();
          // Create a change event to trigger validation
          model.pushEditOperations([], [{
            range: new monaco.Range(1, 1, 1, 1),
            text: ''
          }], () => null);
        }, 50);
      }
    });

    return true;
  } catch (error) {
    console.error('Failed to update field names:', error);
    return false;
  }
}

/**
 * Gets current field names for a query editor
 * @param {string} languageId The language ID used by the editor
 * @returns {object|null} Current field names or null if not found
 */
function getQueryEditorFieldNames(languageId) {
  const existingSetup = registeredLanguages.get(languageId);
  return existingSetup ? existingSetup.fieldNames : null;
}
