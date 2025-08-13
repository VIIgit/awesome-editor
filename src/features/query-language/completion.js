/**
 * Sets up the completion provider for the query language
 * @param {object} monaco The Monaco editor instance
 * @param {object} options Configuration options
 * @param {object} options.fieldNames The field name definitions
 */
export function setupCompletionProvider(monaco, { fieldNames, languageId }) {
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
        ['=', '!=', '>', '<', '>=', '<=', 'IN', 'AND', 'OR'].includes(token.toUpperCase())
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
