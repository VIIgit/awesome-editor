/**
 * @typedef {Object} PropertyConfig
 * @property {string} label - Display label for the property
 * @property {string} path - JSONPath-like string to locate the pattern in the schema
 * @property {string[]} jsonPath - Array of keys to navigate to the value in the JSON
 * @property {Object} schema - The JSON schema object
 */

/**
 * @typedef {Object} ValidationOptions
 * @property {PropertyConfig[]} properties - Array of property configurations
 * @property {Object} schema - The JSON schema to validate against
 */

export const Types = {}; // Placeholder for TypeScript-style types
