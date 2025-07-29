/**
 * @license
 * json-schema-validation feature for Awesome Editor
 * (c) 2025 Awesome Editor Contributors
 * Released under the MIT License
 */

(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['monaco-editor'], factory);
  } else if (typeof exports === 'object' && typeof module === 'object') {
    module.exports = factory(require('monaco-editor'));
  } else {
    root.awesomeEditor = factory(root.monaco);
  }
}(typeof self !== 'undefined' ? self : this, function(monaco) {

  // JsonPathParser implementation
  class JsonPathParser {
    constructor(jsonStr) {
      this.jsonStr = jsonStr;
      this.i = 0;
      this.stack = [];
    }

    getPathAtOffset(offset) {
      this.offset = offset;
      try {
        this.parseValue();
      } catch (e) {
        if (e.path) {
          return e.path;
        }
        throw e;
      }
      return [];
    }

    skipWhitespace() {
      while (this.i < this.jsonStr.length && /\s/.test(this.jsonStr[this.i])) this.i++;
    }

    parseValue() {
      this.skipWhitespace();
      const ch = this.jsonStr[this.i];
      if (ch === '{') return this.parseObject();
      if (ch === '[') return this.parseArray();
      if (ch === '"') return this.parseString();
      return this.parsePrimitive();
    }

    parseObject() {
      this.i++; this.skipWhitespace();
      while (this.i < this.jsonStr.length && this.jsonStr[this.i] !== '}') {
        const key = this.parseString(); this.skipWhitespace();
        if (this.jsonStr[this.i] === ':') this.i++;
        this.stack.push(key.value);
        this.parseValue();
        this.stack.pop();
        this.skipWhitespace();
        if (this.jsonStr[this.i] === ',') this.i++;
        this.skipWhitespace();
      }
      this.i++;
    }

    parseArray() {
      this.i++; this.skipWhitespace();
      let index = 0;
      while (this.i < this.jsonStr.length && this.jsonStr[this.i] !== ']') {
        this.stack.push(index);
        this.parseValue();
        this.stack.pop();
        index++;
        this.skipWhitespace();
        if (this.jsonStr[this.i] === ',') this.i++;
        this.skipWhitespace();
      }
      this.i++;
    }

    parseString() {
      const start = this.i;
      this.i++;
      while (this.i < this.jsonStr.length) {
        if (this.jsonStr[this.i] === '"' && this.jsonStr[this.i - 1] !== '\\') break;
        this.i++;
      }
      this.i++;
      const end = this.i;
      const value = this.jsonStr.slice(start + 1, end - 1);
      if (this.offset > start && this.offset <= end) {
        throw { path: [...this.stack] };
      }
      return { value, start, end };
    }

    parsePrimitive() {
      const start = this.i;
      while (this.i < this.jsonStr.length && /[^\s,\]\}]/.test(this.jsonStr[this.i])) this.i++;
      const end = this.i;
      if (this.offset >= start && this.offset <= end) throw { path: [...this.stack] };
    }
  }

  // TokenValidator implementation
  class TokenValidator {
    constructor(editor, propertyConfigs, schema) {
      this.editor = editor;
      this.propertyConfigs = propertyConfigs;
      this.schema = schema;
    }

    getPatternByPath(obj, path) {
      const keys = path.replace(/^\$\./, "").split(".");
      let current = obj;
      for (const key of keys) {
        if (!current || !(key in current)) {
          return null;
        }
        current = current[key];
      }
      return current;
    }

    extractNamesFromPattern(pattern) {
      const match = pattern.match(/^\^\(([^)]+)\)/);
      return match ? match[1].split("|").filter(Boolean) : [];
    }

    validateDuplicates() {
      let obj;
      try {
        obj = JSON.parse(this.editor.getValue());
      } catch {
        return;
      }

      const markers = [];

      this.propertyConfigs.forEach(property => {
        let val = obj;
        property.jsonPath.forEach(k => val = (val && typeof val === "object") ? val[k] : null);

        if (typeof val === "string" && val.length > 0) {
          const tokens = val.trim().split(/\s+/);
          const seen = new Set();
          const duplicates = [];
          tokens.forEach((t, idx) => {
            if (seen.has(t)) duplicates.push({ token: t, index: idx });
            seen.add(t);
          });

          if (duplicates.length > 0) {
            const text = this.editor.getValue();
            duplicates.forEach(d => {
              const regex = new RegExp(`"${tokens.join(" ")}"`, "g");
              const match = regex.exec(text);
              if (match) {
                const start = match.index + 1;
                const duplicateStart = start + tokens.slice(0, d.index).join(" ").length +
                  (d.index > 0 ? 1 : 0);
                markers.push({
                  severity: monaco.MarkerSeverity.Error,
                  message: `${property.label}: duplicate token '${d.token}'`,
                  startLineNumber: this.editor.getModel().getPositionAt(duplicateStart).lineNumber,
                  startColumn: this.editor.getModel().getPositionAt(duplicateStart).column,
                  endLineNumber: this.editor.getModel().getPositionAt(duplicateStart + d.token.length).lineNumber,
                  endColumn: this.editor.getModel().getPositionAt(duplicateStart + d.token.length).column
                });
              }
            });
          }
        }
      });

      monaco.editor.setModelMarkers(this.editor.getModel(), "duplicates-check", markers);
    }
  }

  // CompletionProvider implementation
  class CompletionProvider {
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

  // Hover Provider implementation
  function setupHoverProvider(options) {
    const { wordMap, contentTemplate = (word, wordDetail) => [
      { value: `**${word} ${wordDetail}**` }
    ] } = options;

    if (!wordMap) {
      throw new Error('WordMap is required for hover setup');
    }

    monaco.languages.registerHoverProvider('json', {
      provideHover: (model, position) => {
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

  // Main setup function
  function setupJsonValidation(editor, options) {
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
        monaco.editor.setModelMarkers(editor.getModel(), "duplicates-check", []);
      }
    };
  }

  // Export the public API
  return {
    setupJsonValidation,
    setupHoverProvider
  };
}));
