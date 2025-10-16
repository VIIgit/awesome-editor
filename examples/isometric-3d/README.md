# Isometric 3D Navigation with Scroll Synchronization

A sophisticated 3D isometric visualization system with bidirectional scroll synchronization. Navigate through 3D content and have the page automatically scroll to matching descriptions, or scroll the page and watch the 3D view update accordingly.

## Features

- **Interactive 3D Navigation**: Click on 3D elements to navigate camera views
- **Bidirectional Scroll Sync**: Page scrolling updates 3D view, 3D navigation scrolls the page
- **SVG Connectors**: Visual connectors between 3D elements with automatic positioning
- **Highlighting System**: Programmable element highlighting with opacity-based visual feedback
- **Auto-Highlighting**: Automatic highlighting on navigation based on data attributes
- **Smooth Animations**: 1.8s easeInOutQuad animations for both scroll and camera movement
- **Anti-Flickering**: Debouncing and state management prevent visual glitches
- **User Override**: Manual scrolling immediately cancels programmatic animations
- **Sticky Layout**: Isometric scene stays visible while scrolling through content
- **Mobile Support**: Touch-friendly with responsive controls

## Files

- **`isometric-3d.js`** - Core 3D rendering and navigation controller
- **`scroll-sync.js`** - Bidirectional scroll synchronization system
- **`isometric-3d.css`** - Isometric perspective and 3D transform styles
- **`index.html`** - Example implementation

## Quick Start

```html
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="isometric-3d.css">
</head>
<body>
    <!-- Your isometric scene with content sections -->
    
    <script src="isometric-3d.js"></script>
    <script src="scroll-sync.js"></script>
    <script>
        const controller = createIsometric3D('scene-id', {
            defaultRotation: { x: 45, y: 0, z: -35 },
            defaultZoom: 1.0
        });
        
        const scrollSync = new ScrollSync(controller);
    </script>
</body>
</html>
```

## Isometric 3D Controller API

### `createIsometric3D(containerId, options)`

Creates and initializes an isometric 3D controller.

**Parameters:**

- `containerId` (string) - DOM element ID containing the isometric scene
- `options` (Object) - Configuration options:
  - `defaultRotation` (Object) - Initial camera rotation `{ x, y, z }` in degrees
  - `defaultZoom` (number) - Initial zoom level (default: 1.0)
  - `showCompactControls` (boolean) - Show UI controls (default: false)
  - `bookmarkPrefix` (string) - URL parameter prefix for saving state
  - `rotationLimits` (Object) - Rotation constraints:

    ```javascript
    {
      x: { min: 0, max: 180 },
      y: { min: -180, max: 180 },
      z: { min: -180, max: 180 }
    }
    ```

**Returns:** Controller instance with the following methods:

#### `controller.navigateToPosition(xyzString, zoomString)`

Smoothly animates camera to a specific position.

- `xyzString` (string) - Rotation in format "x.y.z" (e.g., "45.0.315")
- `zoomString` (string) - Zoom level (e.g., "1.5")

```javascript
controller.navigateToPosition("45.0.315", "1.5");
```

#### `controller.resetToDefault()`

Resets camera to default position and zoom (same as pressing Space key).

```javascript
controller.resetToDefault();
```

#### `controller.highlightByKey(keys)`

Highlights elements and connectors matching the specified key(s).

```javascript
controller.highlightByKey('A');           // Single key
controller.highlightByKey(['A', 'B']);    // Multiple keys
```

#### `controller.clearHighlights()`

Removes all highlights from elements and connectors.

```javascript
controller.clearHighlights();
```

#### `controller.toggleHighlight(key)`

Toggles the highlight state for elements matching the specified key.

```javascript
controller.toggleHighlight('A');
```

#### `controller.on(eventName, callback)`

Listens for controller events.

**Events:**

- `navigationChange` - Fired when 3D view changes
  
  ```javascript
  controller.on('navigationChange', (data) => {
      console.log('Navigated to:', data.element);
  });
  ```

## ScrollSync API

### `new ScrollSync(controller, options)`

Creates a scroll synchronization manager.

**Parameters:**

- `controller` (Object) - Isometric 3D controller instance
- `options` (Object) - Optional configuration:
  - `stickyThreshold` (number) - Top offset for active sections (default: 320)
  - `scrollDuration` (number) - Animation duration in ms (default: 1800)
  - `debounceDelay` (number) - Navigation debounce in ms (default: 100)
  - `sectionSelector` (string) - CSS selector for sections (default: '.description-section')
  - `dataIdAttribute` (string) - Linking attribute name (default: 'data-id')

**Example:**

```javascript
const scrollSync = new ScrollSync(controller, {
    stickyThreshold: 400,
    scrollDuration: 2000,
    debounceDelay: 150
});
```

### Methods

#### `scrollSync.scrollToSection(sectionId)`

Programmatically scroll to a specific section.

```javascript
scrollSync.scrollToSection('cube1-description');
```

#### `scrollSync.destroy()`

Clean up event listeners and timers.

```javascript
scrollSync.destroy();
```

## HTML Structure Requirements

### 1. Sticky Section Wrapper

Wrap your isometric scene and content sections together:

```html
<div class="sticky-section-wrapper">
    <!-- Isometric scene -->
    <div id="scene-id" class="isometric-container">
        <!-- 3D content -->
    </div>
    
    <!-- Content sections -->
    <div class="content-sections">
        <div id="section1" class="description-section">...</div>
        <div id="section2" class="description-section">...</div>
    </div>
</div>
```

### 2. Required CSS

```css
.sticky-section-wrapper {
    position: relative;
}

.isometric-container {
    position: sticky;
    top: 20px;
    height: 300px;
    z-index: 100;
}

.description-section {
    scroll-margin-top: 320px; /* 20px + 300px container height */
    position: relative;
}

.description-section h2 {
    position: sticky;
    top: 320px; /* Must match scroll-margin-top */
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    z-index: 50;
}
```

### 3. Data Attributes for Linking

Link 3D elements to content sections using `data-id`:

**3D Element:**

```html
<div class="face top" 
     data-nav-xyz="45.0.315" 
     data-nav-zoom="1.5"
     data-id="cube1-description">
    Top Face
</div>
```

**Content Section:**

```html
<div id="cube1-description" class="description-section">
    <h2>Cube 1 Description</h2>
    <p>Content...</p>
</div>
```

**Required Attributes:**

- `data-id` - Links 3D element to section ID (must match section's `id`)
- `data-nav-xyz` - Camera rotation in "x.y.z" format
- `data-nav-zoom` - Target zoom level

### 4. Complete Example Structure

```html
<body>
    <!-- Content before sticky section -->
    <div id="intro">...</div>
    
    <div class="sticky-section-wrapper">
        <!-- Isometric 3D Scene -->
        <div id="my-scene" class="isometric-container">
            <div class="isometric-perspective">
                <!-- 3D cube with navigation data -->
                <div id="cube1" class="scene" 
                     data-width="100" data-height="100" data-depth="100">
                    <div class="face top" 
                         data-nav-xyz="45.0.315" 
                         data-nav-zoom="1.5"
                         data-id="cube1-description">
                        Top
                    </div>
                    <!-- Other faces... -->
                </div>
            </div>
        </div>
        
        <!-- Content Sections -->
        <div class="content-sections">
            <div id="cube1-description" class="description-section">
                <h2>Cube 1 Description</h2>
                <div>
                    <p>Content about cube 1...</p>
                </div>
            </div>
            
            <div id="cube2-description" class="description-section">
                <h2>Cube 2 Description</h2>
                <div>
                    <p>Content about cube 2...</p>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Content after sticky section -->
    <div id="outro">...</div>
    
    <script src="isometric-3d.js"></script>
    <script src="scroll-sync.js"></script>
    <script>
        const controller = createIsometric3D('my-scene', {
            defaultRotation: { x: 45, y: 0, z: -35 },
            defaultZoom: 1.0
        });
        
        const scrollSync = new ScrollSync(controller);
    </script>
</body>
```

## SVG Connectors

Visually connect 3D elements with automatically positioned SVG paths and arrows.

### Configuration

Define connectors using the `data-connectors` attribute on the isometric-perspective element:

```html
<div class="isometric-perspective" data-connectors='[
    {
        "from": "cube1",
        "fromPoint": "bottom",
        "edgeAt": "80",
        "to": "cube3",
        "toPoint": "top",
        "color": "#4CAF50",
        "keys": ["A"]
    },
    {
        "from": "cube2",
        "fromPoint": "right",
        "to": "cube4",
        "toPoint": "left",
        "color": "#2196F3",
        "keys": ["B", "C"]
    }
]'>
```

### Connector Properties

- `from` (string) - Source element ID
- `fromPoint` (string) - Connection point: "top", "bottom", "left", "right", "front", "back"
- `to` (string) - Target element ID
- `toPoint` (string) - Connection point on target
- `edgeAt` (string, optional) - Percentage along edge (0-100), default: "50"
- `color` (string, optional) - Line color, default: "#4CAF50"
- `keys` (array, optional) - Highlight keys for this connector

### Connector features

- **Automatic SVG Creation**: SVG overlay is created programmatically when connectors are defined
- **Dynamic Positioning**: Connectors update automatically during 3D rotations
- **Arrow Markers**: Automatic arrow heads matching connector colors
- **Highlight Support**: Connectors can be highlighted using the highlighting system

## Highlighting System

Programmatically control visual emphasis of elements and connectors.

### Data Attributes

#### `data-keys` - Define highlight keys on elements

```html
<div id="cube1" class="scene" data-keys="A,B">...</div>
<div class="face top" data-keys="C">...</div>
```

#### `data-auto-highlight-key` - Auto-highlight on navigation

```html
<!-- Auto-highlight when navigating to this element -->
<div class="face top" 
     data-nav-xyz="45.0.315"
     data-auto-highlight-key="A,B">
    Top Face
</div>

<!-- Auto-highlight from parent scene -->
<div id="cube1" class="scene" data-auto-highlight-key="C">
    ...
</div>
```

### Programmatic Usage

```javascript
// Highlight elements with key "A"
controller.highlightByKey('A');

// Highlight multiple keys
controller.highlightByKey(['A', 'B']);

// Clear all highlights
controller.clearHighlights();

// Toggle highlight
controller.toggleHighlight('A');
```

### Visual Behavior

- **Highlighted elements**: opacity 1.0 (full visibility)
- **Non-highlighted elements**: opacity 0.3 (dimmed)
- **Scene-level highlighting**: Entire scenes are highlighted, not individual faces
- **Face inheritance**: Faces of highlighted scenes remain fully visible
- **Connector highlighting**: Connectors with matching keys are highlighted
- **Smooth transitions**: 0.3s opacity transitions

### Auto-Highlighting

When navigating to an element with `data-auto-highlight-key`:

1. Elements and connectors with matching keys are highlighted
2. Non-matching elements are dimmed
3. Resetting to default position clears all highlights
4. Works with all navigation methods (click, tab, scroll, keyboard)

### Hierarchical Key Resolution

Keys are resolved in the following order:

1. Check navigation element for `data-auto-highlight-key`
2. If not found, check parent scene for `data-auto-highlight-key`
3. If still not found, clear all highlights

## How It Works

### Navigation → Scroll Flow

1. User clicks on 3D element with `data-id="cube1-description"`
2. Controller fires `navigationChange` event
3. ScrollSync detects the `data-id` attribute
4. Page smoothly scrolls to `<div id="cube1-description">`

### Scroll → Navigation Flow

1. User scrolls page manually
2. IntersectionObserver detects which `.description-section` is at `top: 320px`
3. ScrollSync finds 3D element with matching `data-id`
4. Extracts `data-nav-xyz` and `data-nav-zoom` attributes
5. Controller smoothly animates camera to that position

### Anti-Flickering Mechanisms

1. **Debouncing** (100ms) - Waits for scrolling to settle before updating 3D view
2. **Intersection State Map** - Tracks all sections to find most visible one
3. **Navigation Target Tracking** - Prevents redundant animations to same position
4. **User Override Detection** - Wheel/touch events cancel programmatic scrolling

## Customization

### Adjust Animation Speed

```javascript
const scrollSync = new ScrollSync(controller, {
    scrollDuration: 2500  // Slower (default: 1800ms)
});
```

In `isometric-3d.js`, modify `smoothAnimateTo` duration parameter (line 1062):

```javascript
smoothAnimateTo(targetRotation, targetZoom, duration = 2500) {
```

### Change Sticky Positioning

Update both CSS and ScrollSync options to match:

```css
.isometric-container {
    top: 40px;      /* New top position */
    height: 400px;  /* New height */
}

.description-section h2 {
    top: 440px;  /* 40px + 400px */
}
```

```javascript
const scrollSync = new ScrollSync(controller, {
    stickyThreshold: 440  // Must match h2 sticky top
});
```

### Custom Section Selector

```javascript
const scrollSync = new ScrollSync(controller, {
    sectionSelector: '.my-custom-section'
});
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers with touch support

## Keyboard Controls

When the isometric container has focus:

- **Arrow Keys** - Rotate camera
- **Shift + Arrows** - Adjust rotation on Y-axis or zoom
- **+/-** - Zoom in/out
- **Space / R** - Reset to default view
- **Tab** - Cycle through navigation points

## Performance Tips

1. **Limit Threshold Points**: The IntersectionObserver uses 11 thresholds for smooth detection. Reduce if performance is an issue:

   ```javascript
   threshold: [0, 0.25, 0.5, 0.75, 1.0]  // 5 instead of 11
   ```

2. **Adjust Debounce Delay**: Increase for better performance on slower devices:

   ```javascript
   debounceDelay: 200  // vs default 100ms
   ```

3. **Reduce Animation Duration**: Shorter animations use less CPU:

   ```javascript
   scrollDuration: 1200  // vs default 1800ms
   ```

## Troubleshooting

### Issue: Scroll sync not working

- ✅ Check that `data-id` on 3D element matches section `id`
- ✅ Verify sections have class `.description-section`
- ✅ Ensure `stickyThreshold` matches CSS `top` value

### Issue: Flickering during scroll

- ✅ Increase `debounceDelay` (default: 100ms)
- ✅ Reduce `threshold` array size
- ✅ Check for console errors

### Issue: Navigation doesn't scroll to section

- ✅ Verify `navigationChange` event fires (add console.log)
- ✅ Check section IDs are correct
- ✅ Ensure ScrollSync is initialized after controller

## License

MIT License - See LICENSE file for details

## Credits

Developed for smooth 3D navigation experiences with synchronized content.
