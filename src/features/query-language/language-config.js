/**
 * Sets up basic language configuration for the query language
 * @param {object} monaco The Monaco editor instance
 */
export function setupLanguageConfiguration(monaco) {
  monaco.languages.setLanguageConfiguration('querylang', {
    autoClosingPairs: [
      { open: '(', close: ')' },
      { open: '[', close: ']' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ],
    surroundingPairs: [
      { open: '(', close: ')' },
      { open: '[', close: ']' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ]
  });
}
