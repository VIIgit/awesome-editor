//import { sayHello } from '/../features/hello/index.js';

let monacoEditor;


function createEditorInstance(container, value = '', language = 'plaintext', theme = 'vs-dark') {
  return monaco.editor.create(container, {
    value,
    language,
    theme,
    automaticLayout: true
  });
}

function waitForMonacoEditor(callback) {
  if (typeof require !== 'undefined' && typeof require.config === 'function') {
    require.config({ paths: { 'vs': 'https://unpkg.com/monaco-editor@0.52.2/min/vs' } });
    require(['vs/editor/editor.main'], function () {
      callback();
    });
  } else if (typeof monaco !== 'undefined') {
    callback();
  } else {
    console.error('Monaco Editor is not available. Please check that the loader script is included and loaded correctly.');
  }
}

function init() {
  const container = document.getElementById('monaco-container');
  monacoEditor = createEditorInstance(container);
  document.getElementById('hello-btn').addEventListener('click', function () {
    if (monacoEditor) {
      monacoEditor.setValue(sayHello());
    }
  });
}

waitForMonacoEditor(init);

