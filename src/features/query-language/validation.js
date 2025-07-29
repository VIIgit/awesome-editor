/**
 * Sets up validation for the query language
 * @param {object} monaco The Monaco editor instance
 * @param {object} options Configuration options
 * @param {object} options.fieldNames The field name definitions
 */
export function setupValidation(monaco, { fieldNames }) {
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
    // Enhanced regex to also capture potential unclosed quotes and escaped quotes
    const re = /([()\[\]]|!=|>=|<=|=|>|<|IN|AND|OR|,|"(?:[^"\\]|\\.)*(?:"|$)|[-]?\d*\.?\d+|true|false|\w+)/gi;
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
    if (/^(AND|OR|IN)$/i.test(value)) return 'keyword';
    if (/^[=!<>]=?$/.test(value)) return 'operator';
    if (/^[\[\](),]$/.test(value)) return 'punctuation';
    return 'identifier';
  }

  // Helper to find the field name before IN operator
  function findFieldBeforeIN(tokens, startIndex) {
    for (let i = startIndex; i >= 0; i--) {
      if (tokens[i].value.toUpperCase() === 'IN') {
        if (i > 0 && fieldNames[tokens[i - 1].value]) {
          return tokens[i - 1].value;
        }
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
    let currentListField = null;
    let currentListValues = new Set();
    let valueCount = 0;
    let hasTrailingComma = false;
    let bracketBalance = 0;

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
          return false;
        }
        inList = true;
        bracketBalance++;
        continue;
      }

      if (!inList) continue;

      if (value === ']') {
        bracketBalance--;
        if (bracketBalance < 0) {
          markers.push({
            severity: monaco.MarkerSeverity.Error,
            message: 'Unmatched closing bracket',
            startLineNumber: 1,
            startColumn: token.start + 1,
            endLineNumber: 1,
            endColumn: token.end + 1
          });
          return false;
        }
        
        if (hasTrailingComma) {
          markers.push({
            severity: monaco.MarkerSeverity.Error,
            message: 'Trailing comma in IN list',
            startLineNumber: 1,
            startColumn: tokens[i-1].start + 1,
            endLineNumber: 1,
            endColumn: tokens[i-1].end + 1
          });
          return false;
        }

        if (valueCount === 0) {
          markers.push({
            severity: monaco.MarkerSeverity.Error,
            message: 'Empty IN list. Must contain at least one value.',
            startLineNumber: 1,
            startColumn: token.start + 1,
            endLineNumber: 1,
            endColumn: token.end + 1
          });
          return false;
        }

        inList = false;
        return true;
      }

      if (value === ',') {
        if (i === startIndex + 1 || tokens[i-1].value === ',') {
          markers.push({
            severity: monaco.MarkerSeverity.Error,
            message: 'Empty element in IN list',
            startLineNumber: 1,
            startColumn: token.start + 1,
            endLineNumber: 1,
            endColumn: token.end + 1
          });
          return false;
        }
        hasTrailingComma = true;
        continue;
      }

      hasTrailingComma = false;
      if (['string', 'number', 'boolean'].includes(token.type)) {
        valueCount++;
      }
    }

    if (bracketBalance > 0) {
      markers.push({
        severity: monaco.MarkerSeverity.Error,
        message: 'Unclosed IN list. Missing closing bracket.',
        startLineNumber: 1,
        startColumn: tokens[startIndex].start + 1,
        endLineNumber: 1,
        endColumn: tokens[startIndex].end + 1
      });
      return false;
    }

    return true;
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

  // Main validation function with incremental updates
  function validateQuery(model) {
    const value = model.getValue();
    
    // Quick check if content hasn't changed
    if (value === lastValidationState.content) {
      monaco.editor.setModelMarkers(model, 'querylang', lastValidationState.markers);
      return;
    }

    // Check cache for identical content
    const validationHash = getValidationHash(value);
    const cached = validationCache.get(validationHash);
    if (cached) {
      monaco.editor.setModelMarkers(model, 'querylang', cached);
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
        if (!expressionState.hasValue && !expressionState.inParentheses) {
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
      if (['=', '!=', '>', '<', '>=', '<=', 'IN'].includes(current)) {
        if (!expressionState.hasField) {
          addError(token, 'Operator without a preceding field name');
        }
        expressionState.hasOperator = true;

        // Validate operator compatibility with field type
        if (expressionState.currentField) {
          const field = fieldNames[expressionState.currentField];
          if (field && ['>', '<', '>=', '<='].includes(current) && field.type !== 'number') {
            addError(token, `Operator ${current} can only be used with number fields`);
          }
        }
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
      if (lastToken.type === 'identifier' || lastToken.type === 'operator') {
        addError(lastToken, 'Incomplete expression at end of query');
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

    // Set markers
    monaco.editor.setModelMarkers(model, 'querylang', markers);
  }

  // Set up model change listener with incremental validation
  let validateTimeout = null;
  let disposable = monaco.editor.onDidCreateModel(model => {
    if (model.getLanguageId() === 'querylang') {
      // Initial validation
      validateQuery(model);

      // Set up change listener with debouncing
      const changeDisposable = model.onDidChangeContent(() => {
        // Clear previous timeout
        if (validateTimeout) {
          clearTimeout(validateTimeout);
        }

        // Set new timeout for validation
        validateTimeout = setTimeout(() => {
          validateQuery(model);
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
  return {
    dispose: () => {
      if (validateTimeout) {
        clearTimeout(validateTimeout);
      }
      disposable.dispose();
    }
  };
}
