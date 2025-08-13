/**
 * Sets up the token provider for syntax highlighting
 * @param {object} monaco The Monaco editor instance
 * @param {object} options Configuration options
 * @param {object} options.fieldNames The field name definitions
 */
export function setupTokenProvider(monaco, { fieldNames, languageId }) {
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
