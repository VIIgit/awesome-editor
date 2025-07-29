# Query Language Feature Documentation

## Suggestions and Validations

### Completion Provider Use Cases

The completion provider offers context-aware suggestions based on the current cursor position and query structure.

#### Field Name Suggestions

- At the start of a query
- After a logical operator (`AND`/`OR`)
- While typing a field name (filtered suggestions)
- Not shown after a complete field name is typed
- Each suggestion includes field type and possible values in documentation

#### Operator Suggestions

- After a valid field name
- Operators are context-aware based on field type:
  - All fields: `=`, `!=`
  - Number fields: Additional `>`, `<`, `>=`, `<=`
  - String/Number fields: `IN` operator with snippet for list
- Proper spacing is automatically handled
- Each operator includes documentation

#### Value Suggestions

- After an operator
- Values are type-specific:
  - Boolean fields: `true`, `false`
  - String fields with enum values: All possible values with quotes
  - Number fields:
    - Default value `0`
    - Range values if defined (min, max)
    - Midpoint value if both min/max are defined
- All suggestions include documentation

#### List Value Suggestions (for IN operator)

- Inside square brackets after `IN`
- Suggests unused values only
- For string fields: Remaining enum values
- For number fields: Range values if defined
- Automatically adds commas between values
- Triggers new suggestions after comma

#### Logical Operator Suggestions

- After a complete expression (e.g., `field = value`)
- After a closing bracket/parenthesis
- After a complete value (number, quoted string, boolean)
- Suggests `AND`, `OR` with proper spacing

### Expression Context Detection

The provider intelligently detects the current context:

1. Empty query → Field names
2. Partial word → Filtered field names if alphabetical
3. Complete field → Operators
4. After operator → Type-specific values
5. Inside `IN` list → List values and commas
6. Complete expression → Logical operators

### Smart Formatting Features

1. **Automatic Spacing**
   - Adds spaces around operators when needed
   - No double spaces
   - Proper spacing around logical operators

2. **Smart Insertions**
   - Field names end with a space
   - Operators end with a space
   - `IN` operator creates `[]` with snippet placeholder
   - Values in lists get proper quote handling

3. **Documentation**
   - Fields show type and possible values
   - Operators show descriptions
   - Values show type-specific information
   - List values show string/number context

### Sorting and Presentation

Items are consistently sorted in this order:

1. Field names
2. Operators (with specific operator ordering)
3. Values
4. Logical operators
5. List-related items (commas, etc.)

### Examples

```sql
// Field name suggestions
grou[Ctrl+Space] → groupName, groupType, etc.

// Operator suggestions
groupName[Space] → =, !=, IN

// Value suggestions
groupName = [Ctrl+Space] → "Admin", "User", etc.

// List suggestions
groupName IN [ → "Admin", "User", etc.
groupName IN ["Admin", → "User", etc.

// Logical operator suggestions
groupName = "Admin"[Space] → AND, OR

// Complete expression
groupName = "Admin" AND groupType = "System"
```

### Validation Support

Through the validation provider, the following checks are enforced:

1. Field names must be valid
2. Operators must be appropriate for field type
3. Values must match field type
4. List values must be valid for field type
5. Expressions must be complete
6. Logical operators must connect valid expressions
7. Parentheses and brackets must be balanced
8. No duplicate values in IN lists
