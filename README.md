# Awesome Editor

A collection of powerful Monaco Editor features for enhancing your web-based code editing experience.

## Features

### JSON Schema Validation

A powerful JSON validation and autocompletion feature that helps users work with JSON files that conform to a specific schema. It includes:

- Schema-based validation
- Smart autocompletion based on JSON path
- Token duplication detection
- Contextual hover information
- Pattern-based suggestions

#### Installation

##### Using NPM (With bundlers like webpack, rollup, etc.)

```bash
npm install awesome-editor
```

```javascript
import { setupJsonValidation, setupHoverProvider } from 'awesome-editor';

// Initialize the editor and features
const editor = monaco.editor.create(document.getElementById('editor'), {
  value: '{}',
  language: 'json'
});

// Setup validation with schema
setupJsonValidation(editor, {
  schema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      tags: { 
        type: 'string',
        pattern: '^(tag1|tag2|tag3)$'  // Example pattern
      }
    }
  },
  properties: [
    {
      jsonPath: ['tags'],
      schemaPath: '$.properties.tags.pattern',
      label: 'Available Tags'
    }
  ]
});

// Setup hover information
setupHoverProvider({
  wordMap: (word) => {
    const descriptions = {
      'tag1': 'First tag category',
      'tag2': 'Second tag category',
      'tag3': 'Third tag category'
    };
    return descriptions[word];
  },
  // Optional custom template for hover content
  contentTemplate: (word, detail) => [
    { value: `**${word}**` },
    { value: '---' },
    { value: detail }
  ]
});
```

##### Direct Browser Usage (Vanilla JS)

You can also use the feature directly in the browser without a build step:

```html
<!DOCTYPE html>
<html>
<head>
    <title>JSON Editor</title>
</head>
<body>
    <div id="editor" style="height: 400px;"></div>

    <!-- Monaco Editor Configuration -->
    <script>
        // Configure Monaco's base path and worker paths
        self.MonacoEnvironment = {
            getWorkerUrl: function(moduleId, label) {
                // Use Monaco's workers from your Monaco Editor installation
                if (label === 'json') {
                    return '/path/to/monaco-editor/min/vs/language/json/json.worker.js';
                }
                return '/path/to/monaco-editor/min/vs/editor/editor.worker.js';
            }
        };
    </script>

    <!-- First include Monaco Editor (use the version that matches your Monaco installation) -->
    <script src="/path/to/monaco-editor/min/vs/loader.js"></script>
    <script src="/path/to/monaco-editor/min/vs/editor/editor.main.nls.js"></script>
    <script src="/path/to/monaco-editor/min/vs/editor/editor.main.js"></script>

    <!-- Then include our feature -->
    <script src="path/to/awesome-editor/vanilla/json-schema-validation.js"></script>

    <script>
        // Create the editor
        const editor = monaco.editor.create(document.getElementById('editor'), {
            value: '{}',
            language: 'json'
        });

        // Access through the global awesomeEditor object
        awesomeEditor.setupJsonValidation(editor, {
            schema: {
                type: 'object',
                properties: {
                    tags: {
                        type: 'string',
                        pattern: '^(feature|bug|enhancement)$'
                    }
                }
            },
            properties: [{
                jsonPath: ['tags'],
                schemaPath: '$.properties.tags.pattern',
                label: 'Issue Tags'
            }]
        });

        // Set up hover information
        awesomeEditor.setupHoverProvider({
            wordMap: (word) => {
                const descriptions = {
                    'feature': 'New functionality request',
                    'bug': 'Something is not working',
                    'enhancement': 'Improvement to existing feature'
                };
                return descriptions[word];
            }
        });
    </script>
</body>
</html>
```

#### API Reference

##### setupJsonValidation(editor, options)

Sets up JSON validation and autocompletion for the editor.

Parameters:

- `editor`: Monaco Editor instance
- `options`: Configuration object containing:
  - `schema`: JSON Schema object defining the structure and constraints
  - `properties`: Array of property configurations, each containing:
    - `jsonPath`: Array of keys forming the path to the property
    - `schemaPath`: JSONPath string to the pattern in the schema
    - `label`: Display label for error messages and suggestions

Returns:

- Object with:
  - `validateDuplicates()`: Function to manually trigger validation
  - `dispose()`: Function to clean up resources

##### setupHoverProvider(options)

Sets up hover information for tokens in the editor.

Parameters:

- `options`: Configuration object containing:
  - `wordMap`: Function that takes a word and returns its description
  - `contentTemplate`: (Optional) Function that takes a word and its details and returns an array of markdown content objects

### Monaco Editor Setup

Before using our features directly in the browser, you need to properly set up Monaco Editor. You can do this either through CDN or by hosting the files yourself.

#### Option 1: Using CDN (Recommended for quick setup)

```html
<!DOCTYPE html>
<html>
<head>
    <title>JSON Editor</title>
</head>
<body>
    <div id="editor" style="height: 400px;"></div>

    <!-- Monaco Editor Configuration -->
    <script>
        self.MonacoEnvironment = {
            getWorkerUrl: function(moduleId, label) {
                const version = '0.45.0'; // Use the version you need
                if (label === 'json') {
                    return `https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/${version}/min/vs/language/json/json.worker.js`;
                }
                return `https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/${version}/min/vs/editor/editor.worker.js`;
            }
        };
    </script>

    <!-- Monaco Editor from CDN -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/loader.js"></script>
    <script>
        require.config({
            paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }
        });
    </script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/editor/editor.main.nls.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/editor/editor.main.js"></script>

    <!-- Then include our feature -->
    <script src="path/to/awesome-editor/vanilla/feature.js"></script>
</body>
</html>
```

#### Option 2: Self-hosted Files

1. Install Monaco Editor in your project:

   ```bash
   npm install monaco-editor
   ```

2. Copy Monaco Editor's files to your web server:
   - From: `node_modules/monaco-editor/min/vs`
   - To: Your public web directory (e.g., `/public/monaco-editor/min/vs`)

3. Configure Monaco's worker paths in your HTML:

   ```javascript
   self.MonacoEnvironment = {
       getWorkerUrl: function(moduleId, label) {
           if (label === 'json') {
               return '/monaco-editor/min/vs/language/json/json.worker.js';
           }
           return '/monaco-editor/min/vs/editor/editor.worker.js';
       }
   };
   ```

4. Include Monaco's scripts in the correct order:

   ```html
   <script src="/monaco-editor/min/vs/loader.js"></script>
   <script src="/monaco-editor/min/vs/editor/editor.main.nls.js"></script>
   <script src="/monaco-editor/min/vs/editor/editor.main.js"></script>
   <!-- Then include our features -->
   <script src="path/to/awesome-editor/vanilla/feature.js"></script>
   ```

This ensures that Monaco Editor and its workers are properly loaded and configured before our features are initialized.

## Development

### Building

```bash
# Install dependencies
npm install

# Build for production (minimized)
npm run build:prod

# Build for development
npm run build

# Both commands will generate:
# - dist/awesome-editor.js (bundled with dependencies)
# - dist/vanilla/*.js (standalone browser-ready files)
```

### Testing

```bash
npm test
```

## License

Released under the MIT License. See LICENSE file for details.
