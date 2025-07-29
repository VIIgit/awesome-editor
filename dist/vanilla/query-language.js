/**
 * @license
 * query-language feature for Awesome Editor
 * (c) 2025 Awesome Editor Contributors
 * Released under the MIT License
 */

import { setupLanguageConfiguration } from './language-config';
import { setupCompletionProvider } from './completion';
import { setupHoverProvider } from '../json-schema-validation/hover';
import { setupTokenProvider } from './tokens';
import { setupValidation } from './validation';
import { setupEditorTheme } from './theme';

/**
 * Sets up query language support for a Monaco editor instance
 * @param {object} monaco The Monaco editor instance
 * @param {object} options Configuration options
 * @param {object} options.fieldNames The field name definitions with types and valid values
 * @returns {object} The configured editor features
 */
export function setupQueryLanguage(monaco, { fieldNames = {} } = {}) {
  // Register the language
  monaco.languages.register({ id: 'querylang' });

  // Set up individual features
  setupLanguageConfiguration(monaco);
  setupTokenProvider(monaco, { fieldNames });
  setupEditorTheme(monaco);

  const completion = setupCompletionProvider(monaco, { fieldNames });
  const validation = setupValidation(monaco, { fieldNames });

  setupHoverProvider({
    wordMap: (name) => PERSON_DETAILS[name],
    // Optional: customize the hover content
    contentTemplate: (word, details) => [
      { value: `**${word} ${details.lastName}**` },
      { value: '---' },
      { value: `Age: ${details.age}` },
      { value: `Role: ${details.role}` },
      { value: `Link: [example](https://example.com)` }
    ]
  });

  const operators = {
    'AND': 'Logical AND operator',
    'OR': 'Logical OR operator',
    'IN': 'Check if a value is in a list',
    'true': 'Boolean true value',
    'false': 'Boolean false value',
    '=': 'Equals operator',
    '!=': 'Not equals operator',
    '>': 'Greater than operator',
    '<': 'Less than operator'
  };

  setupHoverProvider({
    wordMap: (name) => operators[name]
  });



  return {
    completion,
    validation,
    languageId: 'querylang'
  };
}
