import * as monaco from 'monaco-editor';

export function setupHoverProvider(options) {
  const { detailsProvider, contentTemplate = (word, details) => [
    { value: `**${word} ${details}**` }
  ] } = options;

  if (!detailsProvider) {
    throw new Error('detailsProvider is required for hover setup');
  }

  monaco.languages.registerHoverProvider('json', {
    provideHover: (model, position) => {
      // Get the word at the current position
      const word = model.getWordAtPosition(position);
      if (!word) return null;

      const details = detailsProvider(word.word);
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
