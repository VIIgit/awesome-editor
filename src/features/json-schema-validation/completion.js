import * as monaco from 'monaco-editor';
import { JsonPathParser } from './parser';
import { TokenValidator } from './token-validator';

export class CompletionProvider {
    constructor(editor, propertyConfigs, schema) {
        this.editor = editor;
        this.propertyConfigs = propertyConfigs;
        this.schema = schema;
        this.tokenValidator = new TokenValidator(editor, propertyConfigs, schema);
    }

    setupCompletion() {
        monaco.languages.registerCompletionItemProvider("json", {
            triggerCharacters: ['"', ' '],
            provideCompletionItems: (model, position) => {
                const content = model.getValue();
                const offset = model.getOffsetAt(position);
                console.log('Position:', position, 'Offset:', offset);
                console.log('Content:', content);
                
                const parser = new JsonPathParser(content);
                const jsonPath = parser.getPathAtOffset(offset);

                const property = this.propertyConfigs.find(
                    p => JSON.stringify(p.jsonPath) === JSON.stringify(jsonPath)
                );
                if (!property) return { suggestions: [] };

                let obj;
                try { 
                    obj = JSON.parse(content); 
                } catch { 
                    return { suggestions: [] }; 
                }

                let val = obj;
                for (const k of property.jsonPath) {
                    if (val && typeof val === "object" && k in val) val = val[k];
                    else { val = ""; break; }
                }

                const currentTokens = typeof val === "string" && val.trim().length > 0
                    ? val.trim().split(/\s+/)
                    : [];

                debugger; // Browser will pause here when you trigger completions
                const pattern = this.tokenValidator.getPatternByPath(this.tokenValidator.schema, property.schemaPath);
                const tokens = pattern ? this.tokenValidator.extractNamesFromPattern(pattern) : [];

                const remaining = tokens.filter(n => !currentTokens.includes(n));

                return {
                    suggestions: remaining.map(name => ({
                        label: name,
                        kind: monaco.languages.CompletionItemKind.Value,
                        insertText: name,
                        detail: `From schema pattern (${property.label})`,
                        sortText: "0"
                    }))
                };
            }
        });
    }
}
