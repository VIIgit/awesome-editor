/**
 * Sets up the editor theme for the query language
 * @param {object} monaco The Monaco editor instance
 */
export function setupEditorTheme(monaco) {
  monaco.editor.defineTheme("queryTheme", {
    base: "vs",
    inherit: true,
    rules: [
      { token: 'identifier', foreground: '795E26', background: 'FFF3D0' },
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
