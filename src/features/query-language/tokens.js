/**
 * Sets up the token provider for syntax highlighting
 * @param {object} monaco The Monaco editor instance
 * @param {object} options Configuration options
 * @param {object} options.fieldNames The field name definitions
 */
export function setupTokenProvider(monaco, { fieldNames }) {
  // Create pattern for field names
  const fieldPattern = `\\b(${Object.keys(fieldNames).join('|')})\\b`;
  
  monaco.languages.setMonarchTokensProvider('querylang', {
    tokenizer: {
      root: [
        // Identifiers (dynamically based on field names)
        [new RegExp(fieldPattern), 'identifier'],
        [/\b(AND|OR)\b/, 'keyword'],
        [/\b(IN)\b/, 'operator'],
        [/\b(true|false)\b/, 'boolean'],
        [/(=|!=|>=|<=|>|<)/, 'operator'],
        [/\[|\]/, 'delimiter.square'],
        [/".*?"/, 'string'],
        [/-?\d*\.?\d+/, 'number'],
        [/\(|\)/, 'delimiter.parenthesis']
      ]
    }
  });
}
