import * as monaco from 'monaco-editor';
import { CompletionProvider } from './completion';
import { TokenValidator } from './token-validator';

export { setupHoverProvider } from './hover';

export function setupJsonValidation(editor, options) {
    if (!options.schema || !options.properties) {
        throw new Error('Schema and properties are required for JSON validation setup');
    }

    // Set up schema validation
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        schemas: [{ 
            uri: "schema://local/schema.json", 
            fileMatch: ["*"], 
            schema: options.schema
        }]
    });

    // Set up completion provider
    const completion = new CompletionProvider(editor, options.properties, options.schema);
    completion.setupCompletion();

    // Set up token validation
    const validator = new TokenValidator(editor, options.properties, options.schema);
    editor.onDidChangeModelContent(() => validator.validateDuplicates());
    validator.validateDuplicates();

    return {
        validateDuplicates: () => validator.validateDuplicates(),
        dispose: () => {
            // Clean up if needed
            monaco.editor.setModelMarkers(editor.getModel(), "duplicates-check", []);
        }
    };
}
