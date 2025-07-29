import * as monaco from 'monaco-editor';

export function setupHoverProvider(options) {
  const { wordMap, contentTemplate = (word, wordDetail) => [
    { value: `**${word} ${wordDetail}**` }
  ] } = options;

  if (!wordMap) {
    throw new Error('WordMap is required for hover setup');
  }

  monaco.languages.registerHoverProvider('json', {
    provideHover: (model, position) => {
      // Get the word at the current position
      const word = model.getWordAtPosition(position);
      if (!word) return null;

      const details = wordMap(word.word);
      if (!details) return null;

      return {
        range: new monaco.Range(
          position.lineNumber,
          word.startColumn,
          position.lineNumber,
          word.endColumn
        ),
        contents: contentTemplate(word.word, details)
      };
    }
  });
}
