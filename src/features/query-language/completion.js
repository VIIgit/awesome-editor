/**
 * Sets up the completion provider for the query language
 * @param {object} monaco The Monaco editor instance
 * @param {object} options Configuration options
 * @param {object} options.fieldNames The field name definitions
 */
export function setupCompletionProvider(monaco, { fieldNames }) {
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
  const operPattern = /^(=|!=|>=|<=|>|<|IN)$/i;
  const logicalPattern = /^(AND|OR)$/i;
  const fieldList = Object.keys(fieldNames);
  
  // Create trigger characters for all alphabetical characters
  const triggerChars = Array.from('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');

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
    } else if (field.type === 'number') {
      suggestions.push(
        { 
          label: '0', 
          kind: monaco.languages.CompletionItemKind.Value, 
          insertText: '0', 
          documentation: docMarkdown('Number value'),
          sortText: getSortText('value', '0')
        }
      );
      if (field.range) {
        if (field.range.min !== undefined) {
          suggestions.push({ 
            label: field.range.min.toString(), 
            kind: monaco.languages.CompletionItemKind.Value, 
            insertText: field.range.min.toString(),
            documentation: docMarkdown(`Minimum allowed value: ${field.range.min}`),
            sortText: getSortText('value', field.range.min.toString())
          });
        }
        if (field.range.max !== undefined) {
          suggestions.push({ 
            label: field.range.max.toString(), 
            kind: monaco.languages.CompletionItemKind.Value, 
            insertText: field.range.max.toString(),
            documentation: docMarkdown(`Maximum allowed value: ${field.range.max}`),
            sortText: getSortText('value', field.range.max.toString())
          });
        }
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
    } else if (operPattern.test(lastToken)) {
      context.needsValue = true;
      context.currentField = prevToken;
    } else if (/\[$/.test(lastToken) || (/\[/.test(lastToken) && !/\]$/.test(lastToken)) || /,$/.test(lastToken)) {
      context.inList = true;
      // Find the field name before IN
      for (let i = tokens.length - 1; i >= 0; i--) {
        if (tokens[i].toUpperCase() === 'IN' && i > 0) {
          context.currentField = tokens[i - 1];
          break;
        }
      }
    }

    return context;
  }

  return monaco.languages.registerCompletionItemProvider('querylang', {
    triggerCharacters: [
      ',', ' ', '=', '!', '>', '<', '[', ']', '(', ')', '"', "'",
      ...triggerChars
    ],
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
        // Extract existing values
        const listValues = new Set();
        const listStart = tokens.findIndex(t => t === '[');
        if (listStart !== -1) {
          tokens.slice(listStart + 1)
            .filter(t => t !== ',' && t !== '[')
            .forEach(t => listValues.add(t.replace(/^"(.*)"$/, '$1')));
        }

        if (field) {
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
          } else if (field.type === 'number') {
            // For numbers, suggest some reasonable values if we have range info
            if (field.range) {
              const values = new Set();
              if (field.range.min !== undefined) values.add(field.range.min);
              if (field.range.max !== undefined) values.add(field.range.max);
              // Add some values in between if we have both min and max
              if (field.range.min !== undefined && field.range.max !== undefined) {
                const mid = Math.floor((field.range.min + field.range.max) / 2);
                values.add(mid);
              }
              suggestions = Array.from(values).map(v => ({
                label: v.toString(),
                kind: monaco.languages.CompletionItemKind.Value,
                insertText: v.toString(),
                documentation: docMarkdown(`Number value ${v}`),
                sortText: getSortText('value', v.toString())
              }));
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
}
