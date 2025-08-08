/**
 * Sets up validation for the query language
 * @param {object} monaco The Monaco editor instance
 * @param {object} options Configuration options
 * @param {object} options.fieldNames The field name definitions
 */
export function setupValidation(monaco, { fieldNames, languageId }) {
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
