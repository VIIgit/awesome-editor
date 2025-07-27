import * as monaco from 'monaco-editor';

export class TokenValidator {
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
