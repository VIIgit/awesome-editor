/**
 * Sets up basic language configuration for the query language
 * @param {object} monaco The Monaco editor instance
 */
export function setupLanguageConfiguration(monaco, languageId) {
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
