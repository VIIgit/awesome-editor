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
    <!-- First include Monaco Editor -->
    <script src="path/to/monaco-editor.js"></script>
    <!-- Then include our feature -->
    <script src="path/to/json-schema-validation.js"></script>
</head>
<body>
    <div id="editor" style="height: 400px;"></div>
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
