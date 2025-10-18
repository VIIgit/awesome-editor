// Isometric 3D Bird's Eye View JavaScript - Modular Class

class Isometric3D {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);

    if (!this.container) {
      throw new Error(`Container with id "${containerId}" not found`);
    }

    // Instance-specific state - Center is now (0,0,0)
    this.defaultRotation = {
      x: options.defaultRotation?.x || 45,
      y: options.defaultRotation?.y || 0,
      z: options.defaultRotation?.z || -35
    };
    this.currentRotation = { ...this.defaultRotation };

    this.defaultZoom = options.defaultZoom || 1.0;
    this.currentZoom = this.defaultZoom;

    // Translation for centering on elements
    this.currentTranslation = { x: 0, y: 0, z: 0 };
    this.defaultTranslation = { x: 0, y: 0, z: 0 };

    this.urlUpdateTimeout = null;
    this.isDragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.dragButton = null;
    this.lastUpdateTime = 0; // For throttling mouse events
    this.mouseMoveThrottle = 16; // ~60fps (16ms between updates)
    this.isAnimating = false; // Track when navigation animation is running
    this.animationFrameId = null; // Track requestAnimationFrame for smooth dragging
    this.keyboardAnimationFrameId = null; // Track requestAnimationFrame for smooth keyboard navigation
    this.translationAnimationId = null; // Track requestAnimationFrame for translation animations
    this.lastKeyTime = 0; // For throttling keyboard events

    // Mouse sensitivity settings
    this.mouseSensitivity = {
      x: options.mouseSensitivity?.x || 0.5,
      z: options.mouseSensitivity?.z || 0.5,
      y: options.mouseSensitivity?.y || 0.3
    };

    // Rotation limits configuration (per instance)
    this.rotationLimits = {
      x: {
        min: options.rotationLimits?.x?.min ?? 0,
        max: options.rotationLimits?.x?.max ?? 90
      },
      y: {
        min: options.rotationLimits?.y?.min ?? -180,
        max: options.rotationLimits?.y?.max ?? 180
      },
      z: {
        min: options.rotationLimits?.z?.min ?? -180,
        max: options.rotationLimits?.z?.max ?? 180
      }
    };

    // URL parameter prefix for this instance
    this.urlPrefix = options.bookmarkPrefix || containerId + '_';

    // Compact controls option
    this.showCompactControls = options.showCompactControls || false;

    // Event listeners for custom events
    this.eventListeners = {
      navigationChange: []
    };

    // Bind methods to preserve 'this' context
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onFocus = this.onFocus.bind(this);
    this.onBlur = this.onBlur.bind(this);

    this.init();
  }

  init() {
    // Make container focusable
    if (!this.container.hasAttribute('tabindex')) {
      this.container.setAttribute('tabindex', '0');
    }

    // Setup navigation glass effects
    this.setupNavigationEffects();

    // Create compact controls if enabled
    if (this.showCompactControls) {
      this.createCompactControls();
    }

    // Add event listeners
    this.addEventListeners();

    // Wait for DOM to be fully loaded, then start three-phase initialization
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.initializeThreePhase();
      });
    } else {
      // DOM already loaded
      this.initializeThreePhase();
    }
  }

  configureScenes() {
    // Find all scenes with cube faces within this container OR scenes with data-depth
    const scenes = this.container.querySelectorAll('.scene[data-width], .scene[data-depth]');

    scenes.forEach(scene => {
      const width = parseInt(scene.getAttribute('data-width')) || 100;
      const height = parseInt(scene.getAttribute('data-height')) || 100;
      const depth = parseInt(scene.getAttribute('data-depth')) || 100;

      scene.style.width = `${width}px`;
      scene.style.height = `${depth}px`;

      // Configure each face - corrected dimensions
      const faces = scene.querySelectorAll('.face');
      faces.forEach(face => {
        const classList = face.classList;

        if (classList.contains('front') || classList.contains('back')) {
          face.style.width = `${width}px`;
          face.style.height = `${height}px`;
        } else if (classList.contains('left') || classList.contains('right')) {
          face.style.width = `${depth}px`;
          face.style.height = `${height}px`;
        } else if (classList.contains('top') || classList.contains('bottom')) {
          face.style.width = `${width}px`;
          face.style.height = `${depth}px`;
        }
      });

      // Update transforms based on dimensions
      const halfWidth = width / 2;
      const halfHeight = height / 2;
      const halfDepth = depth / 2;
      // Get Z-axis offset from data attribute or use default
      const zAxisOffset = parseInt(scene.getAttribute('data-z-axis')) || 10;

      // Create shadow div if z-axis offset exists
      if (zAxisOffset > 0) {
        this.createShadowDiv(scene, width, depth, zAxisOffset);
      }

      // Update scene positioning - position scene at center of its height range
      scene.style.transform = `translateZ(${zAxisOffset + halfHeight}px)`;

      //scene.style.transformOrigin = `${halfWidth}px ${halfHeight}px ${halfDepth}px`; 



      const front = scene.querySelector('.face.front');
      const back = scene.querySelector('.face.back');
      const left = scene.querySelector('.face.left');
      const right = scene.querySelector('.face.right');
      const top = scene.querySelector('.face.top');
      const bottom = scene.querySelector('.face.bottom');




      const padding = 10;


      if (front) front.style.transform = `translate(-50%,-50%) rotateY(0deg) rotateX(-90deg)  translateZ(${halfDepth}px)`;
      if (back) back.style.transform = `translate(-50%,-50%) rotateY(180deg) rotateX(90deg) translateZ(${halfDepth}px)`;
      if (left) left.style.transform = `translate(-50%,-50%) rotateY(-90deg) rotateZ(90deg) translateZ(${halfWidth}px)`;
      if (right) right.style.transform = `translate(-50%,-50%) rotateY(90deg) rotateZ(-90deg) translateZ(${halfWidth}px)`;
      if (top) top.style.transform = `translate(-50%,-50%) rotateX(0deg) translateZ(${halfHeight}px)`;
      if (bottom) bottom.style.transform = `translate(-50%,-50%) rotateX(-180deg) translateZ(${halfHeight}px)`;

    });

    // Find all flat scenes (without faces) within this container and apply z-axis positioning
    const flatScenes = this.container.querySelectorAll('.scene:not([data-width])');

    flatScenes.forEach(flatScene => {
      // Get Z-axis offset from data attribute or use default
      const zAxisOffset = parseInt(flatScene.getAttribute('data-z-axis')) || 0;

      if (zAxisOffset > 0) {
        // Get dimensions from the scene's computed style or default values
        const computedStyle = window.getComputedStyle(flatScene);
        const width = parseInt(computedStyle.width) || 100;
        const height = parseInt(computedStyle.height) || 100;

        // Create shadow div for flat scene (using height as depth for 2D elements)
        this.createShadowDiv(flatScene, width, height);

        // Apply z-axis positioning to flat scene
        flatScene.style.transform = `translateZ(${zAxisOffset}px)`;

      }
    });
  }

  createShadowDiv(scene, width, depth) {
    // Get z-axis offset for shadow calculations
    const zAxisOffset = parseInt(scene.getAttribute('data-z-axis')) || 0;

    // Don't create shadow if zAxisOffset is 0
    if (zAxisOffset === 0) {
      return;
    }

    // Check if shadow already exists to avoid duplicates
    const existingShadow = scene.parentNode.querySelector(`[data-shadow-for="${scene.id || 'scene'}"]`);
    if (existingShadow) {
      existingShadow.remove();
    }

    // Create shadow div positioned at negative coordinates
    const shadowDiv = document.createElement('div');
    shadowDiv.className = 'scene-shadow';
    shadowDiv.setAttribute('data-shadow-for', scene.id || 'scene');

    // Copy all relevant positioning and styling from the original scene
    const sceneStyle = window.getComputedStyle(scene);

    // Set dimensions (using width and depth as shadow represents ground footprint)
    shadowDiv.style.width = `${width}px`;
    shadowDiv.style.height = `${depth}px`;

    // Copy positioning properties but override for centering
    shadowDiv.style.position = 'absolute';

    // Copy grid properties if they exist to maintain layout positioning
    shadowDiv.style.gridArea = sceneStyle.gridArea || 'auto';
    shadowDiv.style.gridColumn = sceneStyle.gridColumn || 'auto';
    shadowDiv.style.gridRow = sceneStyle.gridRow || 'auto';

    // Position the invisible div at the center and use box-shadow to create the shadow
    shadowDiv.style.left = `-${width / 2 - 5}px`;
    shadowDiv.style.top = `-${depth / 2 - 5}px`;
    shadowDiv.style.transform = 'translateZ(0px) translate(-50%, -50%)';
    shadowDiv.style.transformOrigin = 'center center';

    // Calculate shadow properties based on zAxisOffset
    let shadowBlur, shadowOpacity;
    const shadowSpread = -5; // Always use -5px spread to stay within boundaries

    if (zAxisOffset <= 3) {
      // Up to 20px: blur 5px, opacity 0.7
      shadowBlur = 3;
      shadowOpacity = 0.5;
    } else {
      shadowBlur = Math.min(35, zAxisOffset);
      shadowOpacity = Math.max(0.3, Math.min(zAxisOffset / 4, 50) / 100);
    }

    // Create the shadow using box-shadow with negative offset positioning
    shadowDiv.style.boxShadow = `${width}px ${depth}px ${shadowBlur}px ${shadowSpread}px rgba(0, 0, 0, ${shadowOpacity})`;

    // Insert shadow before the scene element
    scene.parentNode.insertBefore(shadowDiv, scene);
  }

  setupNavigationEffects() {
    // Find all elements with navigation data within this container
    const navElements = this.container.querySelectorAll('[data-nav-xyz], [data-nav-zoom]');

    // Only create navigation bar if there are navigation elements
    if (navElements.length > 0) {
      this.createNavigationBarHTML();
      this.createNavigationBar(navElements);
    }

    navElements.forEach((element, index) => {
      // Add navigation clickable class for glass effect
      element.classList.add('nav-clickable');

      // Add click event listener for navigation
      element.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const xyz = element.getAttribute('data-nav-xyz');
        const zoom = element.getAttribute('data-nav-zoom');

        if (xyz || zoom) {
          // Update navigation bar active state
          this.setActiveNavPoint(index);
          
          // Navigate to position with the element for auto-highlighting
          this.navigateToPosition(xyz, zoom, element);
        }
      });
    });

  }

  createNavigationBarHTML() {
    // Check if nav-bar already exists
    if (this.container.querySelector('.nav-bar')) return;

    // Create the navigation bar HTML structure
    const navBar = document.createElement('div');
    navBar.className = 'nav-bar';
    
    const navPointsContainer = document.createElement('div');
    navPointsContainer.className = 'nav-points-container';
    navPointsContainer.id = 'nav-points-container';
    
    navBar.appendChild(navPointsContainer);
    this.container.appendChild(navBar);
  }

  createNavigationBar(navElements) {
    const navPointsContainer = this.container.querySelector('#nav-points-container');
    if (!navPointsContainer) return;

    // Clear existing points
    navPointsContainer.innerHTML = '';

    // Create default starting position circle first
    const defaultPoint = document.createElement('div');
    defaultPoint.className = 'nav-point active';
    defaultPoint.setAttribute('data-nav-index', -1);
    defaultPoint.setAttribute('tabindex', '0');
    
    defaultPoint.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.setActiveNavPoint(-1);
      this.resetToDefault();
    });

    // Add keyboard handler for default point
    defaultPoint.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        defaultPoint.click();
      }
    });
    
    navPointsContainer.appendChild(defaultPoint);

    // Create simple navigation circles for each element with navigation data
    navElements.forEach((element, index) => {
      const xyz = element.getAttribute('data-nav-xyz');
      const zoom = element.getAttribute('data-nav-zoom');
      
      if (xyz || zoom) {
        const navPoint = document.createElement('div');
        navPoint.className = 'nav-point';
        navPoint.setAttribute('data-nav-index', index);
        navPoint.setAttribute('tabindex', '0');
        
        // Add click handler
        navPoint.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // Update active state
          this.setActiveNavPoint(index);
          
          // Navigate to position with the element for auto-highlighting
          this.navigateToPosition(xyz, zoom, element);
        });

        // Add keyboard handler for Enter/Space
        navPoint.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navPoint.click();
          }
        });
        
        navPointsContainer.appendChild(navPoint);
      }
    });

    // Add keyboard navigation for tab key
    this.setupTabNavigation();
  }

  setupTabNavigation() {
    const navPoints = this.container.querySelectorAll('.nav-point');
    
    navPoints.forEach((point, index) => {
      point.addEventListener('keydown', (e) => {
        let targetIndex = index;
        
        if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
          e.preventDefault();
          targetIndex = index > 0 ? index - 1 : navPoints.length - 1;
        } else if (e.key === 'ArrowRight' || e.key === 'Tab') {
          e.preventDefault();
          targetIndex = index < navPoints.length - 1 ? index + 1 : 0;
        }
        
        if (targetIndex !== index) {
          navPoints[targetIndex].focus();
        }
      });
    });
  }

  resetToDefault() {
    // Use resetView for core functionality, then update URL
    this.resetView();
    this.updateUrlWithRotation();
  }

  setActiveNavPoint(activeIndex) {
    const navPoints = this.container.querySelectorAll('.nav-point');
    navPoints.forEach((point, index) => {
      const pointIndex = parseInt(point.getAttribute('data-nav-index'));
      if (pointIndex === activeIndex) {
        point.classList.add('active');
      } else {
        point.classList.remove('active');
      }
    });
    
    // Update nav-selected class on navigable elements
    this.updateNavSelectedElements(activeIndex);
  }
  
  updateNavSelectedElements(activeIndex) {
    // Get all navigable elements (scenes and faces with nav attributes)
    const navigableElements = this.container.querySelectorAll('[data-nav-xyz], [data-nav-zoom]');
    
    // Remove nav-selected from all scenes and faces
    const allScenesAndFaces = this.container.querySelectorAll('.scene, .face');
    allScenesAndFaces.forEach(el => {
      el.classList.remove('nav-selected');
    });
    
    // If activeIndex is valid, add nav-selected only to the active element
    if (activeIndex >= 0 && activeIndex < navigableElements.length) {
      const activeElement = navigableElements[activeIndex];
      activeElement.classList.add('nav-selected');
      
      // Emit navigation change event
      this.emit('navigationChange', {
        index: activeIndex,
        element: activeElement,
        id: activeElement.id || null,
        key: activeElement.getAttribute('data-id') || activeElement.id || null
      });
    }
  }

  // Event system methods
  on(eventName, callback) {
    if (!this.eventListeners[eventName]) {
      this.eventListeners[eventName] = [];
    }
    this.eventListeners[eventName].push(callback);
  }

  off(eventName, callback) {
    if (!this.eventListeners[eventName]) return;
    this.eventListeners[eventName] = this.eventListeners[eventName].filter(cb => cb !== callback);
  }

  emit(eventName, data) {
    if (!this.eventListeners[eventName]) return;
    this.eventListeners[eventName].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${eventName} event listener:`, error);
      }
    });
  }

  // Navigate to element by ID or data-id attribute
  navigateByKey(key) {
    const navigableElements = this.container.querySelectorAll('[data-nav-xyz], [data-nav-zoom]');
    
    // Try to find element by ID first
    let targetElement = this.container.querySelector(`#${key}`);
    
    // If not found by ID, try data-id attribute
    if (!targetElement || (!targetElement.hasAttribute('data-nav-xyz') && !targetElement.hasAttribute('data-nav-zoom'))) {
      targetElement = this.container.querySelector(`[data-id="${key}"]`);
    }
    
    // If still not found, try to find a child with nav attributes
    if (targetElement && !targetElement.hasAttribute('data-nav-xyz') && !targetElement.hasAttribute('data-nav-zoom')) {
      const childElement = targetElement.querySelector('[data-nav-xyz], [data-nav-zoom]');
      if (childElement) {
        targetElement = childElement;
      }
    }
    
    if (targetElement && (targetElement.hasAttribute('data-nav-xyz') || targetElement.hasAttribute('data-nav-zoom'))) {
      // Get navigation data from element
      const xyz = targetElement.getAttribute('data-nav-xyz');
      const zoom = targetElement.getAttribute('data-nav-zoom');
      
      // Find index for updating nav bar
      const index = Array.from(navigableElements).indexOf(targetElement);
      if (index !== -1) {
        this.setActiveNavPoint(index);
      }
      
      // Navigate to the position with the element for auto-highlighting
      this.navigateToPosition(xyz, zoom, targetElement);
      return true;
    }
    
    console.warn(`Navigation target not found for key: ${key}`);
    return false;
  }

  addEventListeners() {
    // Mouse events - only add mousemove when dragging
    this.container.addEventListener('mousedown', this.onMouseDown);
    this.container.addEventListener('mouseup', this.onMouseUp);

    // Store mousemove handler for dynamic attachment
    this.mouseMoveHandler = this.onMouseMove.bind(this);

    // Wheel event for zoom
    this.container.addEventListener('wheel', this.onWheel);

    // Touch events for mobile
    this.container.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.container.addEventListener('touchmove', this.onTouchMove, { passive: false });
    this.container.addEventListener('touchend', this.onTouchEnd, { passive: false });

    // Keyboard events - only when focused!
    this.container.addEventListener('keydown', this.onKeyDown);
    this.container.addEventListener('focus', this.onFocus);
    this.container.addEventListener('blur', this.onBlur);

    // Prevent context menu on right click
    this.container.addEventListener('contextmenu', e => e.preventDefault());

    // Click events - focus container and handle non-navigation clicks
    this.container.addEventListener('click', (e) => {
      // Don't focus if clicking on compact controls or navigation elements
      if (!e.target.closest('.compact-controls') && !e.target.closest('.nav-clickable')) {
        this.container.focus();
      }

      // Check if clicked element or its parent scene has data-focus="center"
      const clickedElement = e.target;
      let focusElement = null;

      // Check if the clicked element itself has data-focus="center"
      if (clickedElement.getAttribute('data-focus') === 'center') {
        focusElement = clickedElement;
      } else {
        // Check if it's a face inside a scene with data-focus="center"
        const parentScene = clickedElement.closest('.scene');
        if (parentScene && parentScene.getAttribute('data-focus') === 'center') {
          focusElement = parentScene;
        }
      }

      // Center on the element if it has the focus attribute
      if (focusElement) {
        this.centerOnElement(focusElement);
      }

      // The navigation clicks are now handled directly by setupNavigationEffects
      // This handler is only for focusing the container and handling focus centering
    });

    // Window resize listener for label repositioning
    window.addEventListener('resize', () => {
      setTimeout(() => this.updateLabelPositions(), 100);
    });
  }

  createCompactControls() {
    // Create compact controls element
    const compactControls = document.createElement('div');
    compactControls.className = 'compact-controls';

    // Create control items with specific IDs for this instance - modern spherical controller
    compactControls.innerHTML = `
      <div class="control-sphere">
        <div class="sphere-container">
          <div class="direction-indicator up" id="${this.containerId}-indicator-up"></div>
          <div class="direction-indicator down" id="${this.containerId}-indicator-down"></div>
          <div class="direction-indicator left" id="${this.containerId}-indicator-left"></div>
          <div class="direction-indicator right" id="${this.containerId}-indicator-right"></div>
          <div class="center-dot" id="${this.containerId}-center-dot"></div>
        </div>
        <div class="zoom-controls">
          <button class="zoom-button zoom-in" id="${this.containerId}-zoom-in">+</button>
          <button class="zoom-button zoom-out" id="${this.containerId}-zoom-out">−</button>
        </div>
        <button class="help-button">?</button>
      </div>
      <div class="keyboard-help">
        <h3>Controls</h3>
        <div class="key-mapping">
          <span>🖱️ <strong>Left drag</strong></span>
          <span>X/Z-Axis rotation</span>
        </div>
        <div class="key-mapping">
          <span>🖱️ <strong>Right drag</strong></span>
          <span>Y-Axis rotation + zoom</span>
        </div>
        <div class="key-mapping">
          <span>🖱️ <strong>Wheel</strong></span>
          <span>Zoom in/out</span>
        </div>
        <div class="key-mapping">
          <span><span class="key">←</span> <span class="key">→</span></span>
          <span>Z-Axis rotation</span>
        </div>
        <div class="key-mapping">
          <span><span class="key">↑</span> <span class="key">↓</span></span>
          <span>X-Axis rotation</span>
        </div>
        <div class="key-mapping">
          <span><span class="key">Shift</span>+<span class="key">←</span> <span class="key">→</span></span>
          <span>Y-Axis rotation</span>
        </div>
        <div class="key-mapping">
          <span><span class="key">Shift</span>+<span class="key">↑</span> <span class="key">↓</span></span>
          <span>Zoom in/out</span>
        </div>
        <div class="key-mapping">
          <span><span class="key">Space</span></span>
          <span>Reset to default view</span>
        </div>
        <div class="key-mapping">
          <span><span class="key">+</span> <span class="key">−</span></span>
          <span>Zoom controls</span>
        </div>
      </div>
    `;

    // Append to the container
    this.container.appendChild(compactControls);

    // Add event listener for help button
    const helpButton = compactControls.querySelector('.help-button');
    const keyboardHelp = compactControls.querySelector('.keyboard-help');

    if (helpButton && keyboardHelp) {
      helpButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        keyboardHelp.classList.toggle('show');
      });

      // Also add pointer events to ensure button is clickable
      helpButton.style.pointerEvents = 'auto';
    } else {
      console.error('❌ Failed to find help button or keyboard help panel in:', this.containerId);
    }

    // Add click event listeners to spherical controller elements
    const upIndicator = compactControls.querySelector(`#${this.containerId}-indicator-up`);
    const downIndicator = compactControls.querySelector(`#${this.containerId}-indicator-down`);
    const leftIndicator = compactControls.querySelector(`#${this.containerId}-indicator-left`);
    const rightIndicator = compactControls.querySelector(`#${this.containerId}-indicator-right`);
    const centerDot = compactControls.querySelector(`#${this.containerId}-center-dot`);

    // Make elements clickable with pointer cursor
    [upIndicator, downIndicator, leftIndicator, rightIndicator, centerDot].forEach(element => {
      if (element) {
        element.style.cursor = 'pointer';
        element.style.pointerEvents = 'auto';
      }
    });

    // Up arrow - navigate to negative X rotation (looking up)
    if (upIndicator) {
      upIndicator.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const targetX = Math.max(this.rotationLimits.x.min, this.currentRotation.x - 15);
        this.smoothAnimateTo({ ...this.currentRotation, x: targetX }, this.currentZoom, 500);
      });
    }

    // Down arrow - navigate to positive X rotation (looking down)
    if (downIndicator) {
      downIndicator.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const targetX = Math.min(this.rotationLimits.x.max, this.currentRotation.x + 15);
        this.smoothAnimateTo({ ...this.currentRotation, x: targetX }, this.currentZoom, 500);
      });
    }

    // Left arrow - navigate to negative Z rotation (turning left)
    if (leftIndicator) {
      leftIndicator.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const targetZ = Math.max(this.rotationLimits.z.min, this.currentRotation.z - 15);
        this.smoothAnimateTo({ ...this.currentRotation, z: targetZ }, this.currentZoom, 500);
      });
    }

    // Right arrow - navigate to positive Z rotation (turning right)
    if (rightIndicator) {
      rightIndicator.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const targetZ = Math.min(this.rotationLimits.z.max, this.currentRotation.z + 15);
        this.smoothAnimateTo({ ...this.currentRotation, z: targetZ }, this.currentZoom, 500);
      });
    }

    // Center dot - navigate to (0,0,0)
    if (centerDot) {
      centerDot.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Reset translation to center the scene in the container
        this.animateTranslation(0, 0, 0);
        
        // Reset all rotations to 0 (no x, y, or z rotation)
        const targetRotation = {
          x: 0,
          y: 0,
          z: 0
        };
        
        // Animate rotation change
        this.smoothAnimateTo(targetRotation, this.currentZoom, 500);
      });
    }

    // Zoom controls
    const zoomInButton = compactControls.querySelector(`#${this.containerId}-zoom-in`);
    const zoomOutButton = compactControls.querySelector(`#${this.containerId}-zoom-out`);

    // Make zoom buttons clickable
    [zoomInButton, zoomOutButton].forEach(element => {
      if (element) {
        element.style.cursor = 'pointer';
        element.style.pointerEvents = 'auto';
      }
    });

    // Zoom In button
    if (zoomInButton) {
      zoomInButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const targetZoom = Math.min(3.0, this.currentZoom * 1.2);
        this.smoothAnimateTo(this.currentRotation, targetZoom, 300);
      });
    }

    // Zoom Out button
    if (zoomOutButton) {
      zoomOutButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const targetZoom = Math.max(0.2, this.currentZoom / 1.2);
        this.smoothAnimateTo(this.currentRotation, targetZoom, 300);
      });
    }
  }

  removeEventListeners() {
    this.container.removeEventListener('mousedown', this.onMouseDown);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);

    this.container.removeEventListener('wheel', this.onWheel);

    this.container.removeEventListener('touchstart', this.onTouchStart);
    this.container.removeEventListener('touchmove', this.onTouchMove);
    this.container.removeEventListener('touchend', this.onTouchEnd);

    this.container.removeEventListener('keydown', this.onKeyDown);
    this.container.removeEventListener('focus', this.onFocus);
    this.container.removeEventListener('blur', this.onBlur);

    this.container.removeEventListener('contextmenu', e => e.preventDefault());

    // Cancel any pending animation frames
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.keyboardAnimationFrameId) {
      cancelAnimationFrame(this.keyboardAnimationFrameId);
      this.keyboardAnimationFrameId = null;
    }
  }

  onFocus() {
    this.container.style.borderColor = '#0078d4';
  }

  onBlur() {
    this.container.style.borderColor = '';

    // Cancel any pending keyboard animation frames when focus is lost
    if (this.keyboardAnimationFrameId) {
      cancelAnimationFrame(this.keyboardAnimationFrameId);
      this.keyboardAnimationFrameId = null;
    }
  }

  updateScene() {
    const scene = this.container.querySelector('.isometric-perspective');
    if (!scene) return;

    // Batch DOM updates to prevent flicker
    const transform = `translate(-50%, -50%) translate3d(${this.currentTranslation.x}px, ${this.currentTranslation.y}px, ${this.currentTranslation.z}px) scale(${this.currentZoom}) rotateX(${this.currentRotation.x}deg) rotateY(${this.currentRotation.y}deg) rotateZ(${this.currentRotation.z}deg)`;

    // Use will-change CSS property for better performance during dragging
    if (this.isDragging && scene.style.willChange !== 'transform') {
      scene.style.willChange = 'transform';
    } else if (!this.isDragging && scene.style.willChange === 'transform') {
      scene.style.willChange = 'auto';
    }

    // Update transform only if it has changed
    if (scene.style.transform !== transform) {
      scene.style.transform = transform;
    }

    // Set positioning properties only if not already set
    if (scene.style.left !== '50%') scene.style.left = '50%';
    if (scene.style.top !== '50%') scene.style.top = '50%';
    if (scene.style.position !== 'absolute') scene.style.position = 'absolute';

    // Update display values
    this.updateDisplayValues();

    // Update label positions only if not animating and not dragging (to avoid flicker)
    if (!this.isAnimating && !this.isDragging) {
      setTimeout(() => this.updateLabelPositions(), 50); // Small delay to ensure transforms are applied
    }

    // Queue URL update to avoid too frequent updates
    clearTimeout(this.urlUpdateTimeout);
    this.urlUpdateTimeout = setTimeout(() => this.updateUrlWithRotation(), 3000);
  }

  updateDisplayValues() {
    // Update arrow indicators based on current rotation position
    const upIndicator = this.container.querySelector(`#${this.containerId}-indicator-up`);
    const downIndicator = this.container.querySelector(`#${this.containerId}-indicator-down`);
    const leftIndicator = this.container.querySelector(`#${this.containerId}-indicator-left`);
    const rightIndicator = this.container.querySelector(`#${this.containerId}-indicator-right`);

    if (upIndicator && downIndicator && leftIndicator && rightIndicator) {
      // Calculate normalized positions (-1 to 1) from center
      const xNorm = (this.currentRotation.x) / Math.max(Math.abs(this.rotationLimits.x.min), Math.abs(this.rotationLimits.x.max));
      const zNorm = (this.currentRotation.z) / Math.max(Math.abs(this.rotationLimits.z.min), Math.abs(this.rotationLimits.z.max));

      // Reset all indicators
      [upIndicator, downIndicator, leftIndicator, rightIndicator].forEach(indicator => {
        indicator.classList.remove('active', 'partial');
      });

      // X-axis indicators (up/down arrows for pitch)
      if (Math.abs(xNorm) > 0.1) { // Only show if significantly off center
        if (xNorm > 0) {
          downIndicator.classList.add(Math.abs(xNorm) > 0.5 ? 'active' : 'partial');
        } else {
          upIndicator.classList.add(Math.abs(xNorm) > 0.5 ? 'active' : 'partial');
        }
      }

      // Z-axis indicators (left/right arrows for yaw)
      if (Math.abs(zNorm) > 0.1) { // Only show if significantly off center
        if (zNorm > 0) {
          rightIndicator.classList.add(Math.abs(zNorm) > 0.5 ? 'active' : 'partial');
        } else {
          leftIndicator.classList.add(Math.abs(zNorm) > 0.5 ? 'active' : 'partial');
        }
      }
    }
  }

  updateLabelPositions() {
    // Update label positions based on cube and rectangle positions within this container
    const labels = this.container.querySelectorAll('.label[data-cube]');

    labels.forEach((label) => {
      const cubeId = label.getAttribute('data-cube');
      const position = label.getAttribute('data-position') || 'right'; // default to right

      // Try to find element by ID (could be cube, rectangle, or any element)
      let targetElement = document.getElementById(cubeId);

      // If not found by ID, try to find within this container
      if (!targetElement) {
        targetElement = this.container.querySelector(`#${cubeId}, .cube#${cubeId}, .rectangle#${cubeId}, [id="${cubeId}"]`);
      }

      if (targetElement) {
        const containerRect = this.container.getBoundingClientRect();
        const elementRect = targetElement.getBoundingClientRect();

        // Make sure label is visible first by setting a temporary position
        label.style.visibility = 'visible';
        label.style.display = 'block';

        // Get label dimensions after making it visible
        const labelRect = label.getBoundingClientRect();

        let newLeft, newTop;
        const offset = 10; // Small gap between element and label

        // Calculate position relative to container (not global viewport)
        const elementLeftRelative = elementRect.left - containerRect.left;
        const elementTopRelative = elementRect.top - containerRect.top;

        switch (position) {
          case 'left':
            // Position label to the left of element with gap
            newLeft = elementLeftRelative - labelRect.width - offset;
            newTop = elementTopRelative + (elementRect.height / 2) - (labelRect.height / 2);
            break;

          case 'right':
            // Position label to the right of element with gap
            newLeft = elementLeftRelative + elementRect.width + offset;
            newTop = elementTopRelative + (elementRect.height / 2) - (labelRect.height / 2);
            break;

          case 'top':
            // Position label above element with gap
            newLeft = elementLeftRelative + (elementRect.width / 2) - (labelRect.width / 2);
            newTop = elementTopRelative - labelRect.height - offset;
            break;

          case 'bottom':
            // Position label below element with gap
            newLeft = elementLeftRelative + (elementRect.width / 2) - (labelRect.width / 2);
            newTop = elementTopRelative + elementRect.height + offset;
            break;

          default:
            // Default to right positioning
            newLeft = elementLeftRelative + elementRect.width + offset;
            newTop = elementTopRelative + (elementRect.height / 2) - (labelRect.height / 2);
        }

        label.style.left = `${newLeft}px`;
        label.style.top = `${newTop}px`;
      }
    });
  }

  handleNavigationClick(element) {
    // Look for navigation data on the clicked element or its parents
    let targetElement = element;
    let navData = null;
    let autoHighlightKeys = null;

    // Search up the DOM tree for navigation data
    while (targetElement && targetElement !== this.container) {
      const xyz = targetElement.getAttribute('data-nav-xyz');
      const zoom = targetElement.getAttribute('data-nav-zoom');
      const autoHighlight = targetElement.getAttribute('data-auto-highlight-key');

      if (xyz || zoom) {
        navData = { xyz, zoom, element: targetElement };
        autoHighlightKeys = autoHighlight;
        break;
      }

      targetElement = targetElement.parentElement;
    }

    if (navData) {
      this.navigateToPosition(navData.xyz, navData.zoom, navData.element);
    }
    // Removed default reset behavior - only navigate if navigation data is found
  }

  navigateToPosition(xyzString, zoomString, sourceElement = null) {
    const targetRotation = { ...this.currentRotation };
    let targetZoom = this.currentZoom;

    // Parse xyz string (e.g., "35.00.15")
    if (xyzString) {
      const [x, y, z] = xyzString.split('.').map(v => parseFloat(v) || 0);
      targetRotation.x = x;
      targetRotation.y = y;
      targetRotation.z = z;
    }

    // Parse zoom string (e.g., "2.3")
    if (zoomString) {
      targetZoom = parseFloat(zoomString) || this.defaultZoom;
    }


    // Update navigation bar to match the target position
    this.syncNavigationBar(xyzString, zoomString);

    // Handle auto-highlighting if source element is provided
    if (sourceElement) {
      // Check face first, then parent scene for auto-highlight-key
      let autoHighlightKeys = sourceElement.getAttribute('data-auto-highlight-key');
      let sourceScene = sourceElement.closest('.scene');
      
      // If not found on the element itself, check parent scene
      if (!autoHighlightKeys && sourceScene) {
        autoHighlightKeys = sourceScene.getAttribute('data-auto-highlight-key');
      }
      
      if (autoHighlightKeys) {
        const keys = autoHighlightKeys.split(',').map(k => k.trim());
        this.highlightByKey(keys);
        
        // Also ensure the source scene itself is highlighted
        if (sourceScene) {
          sourceScene.classList.add('highlight');
        }
      } else {
        // No auto-highlight-key found, clear all highlights
        this.clearHighlights();
      }
    } else {
      // No source element provided, clear highlights
      this.clearHighlights();
    }

    // Perform smooth animation
    this.smoothAnimateTo(targetRotation, targetZoom);
  }

  syncNavigationBar(xyzString, zoomString) {
    // Find the navigation element that matches this position
    const navElements = this.container.querySelectorAll('[data-nav-xyz], [data-nav-zoom]');
    let matchingIndex = -1;

    // Check if this matches the default position (no xyz or zoom)
    if (!xyzString && !zoomString) {
      matchingIndex = -1; // Default position
    } else {
      // Find matching navigation element
      navElements.forEach((element, index) => {
        const elementXyz = element.getAttribute('data-nav-xyz');
        const elementZoom = element.getAttribute('data-nav-zoom');
        
        const xyzMatch = !xyzString || elementXyz === xyzString;
        const zoomMatch = !zoomString || elementZoom === zoomString;
        
        if (xyzMatch && zoomMatch) {
          matchingIndex = index;
        }
      });
    }

    // Update the active navigation point
    this.setActiveNavPoint(matchingIndex);
  }

  smoothAnimateTo(targetRotation, targetZoom, duration = 1200) {
    this.isAnimating = true; // Set animation flag to prevent premature label updates

    const startTime = performance.now();
    const startRotation = { ...this.currentRotation };
    const startZoom = this.currentZoom;

    // Clamp target rotation to limits before animating
    const clampedTarget = {
      x: Math.max(this.rotationLimits.x.min, Math.min(this.rotationLimits.x.max, targetRotation.x)),
      y: Math.max(this.rotationLimits.y.min, Math.min(this.rotationLimits.y.max, targetRotation.y)),
      z: Math.max(this.rotationLimits.z.min, Math.min(this.rotationLimits.z.max, targetRotation.z))
    };

    const clampedZoom = Math.max(0.2, Math.min(3.0, targetZoom));

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Use easeInOutQuad for smoother, more gentle animation
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      // Interpolate rotation values
      this.currentRotation.x = startRotation.x + (clampedTarget.x - startRotation.x) * eased;
      this.currentRotation.y = startRotation.y + (clampedTarget.y - startRotation.y) * eased;
      this.currentRotation.z = startRotation.z + (clampedTarget.z - startRotation.z) * eased;

      // Interpolate zoom
      this.currentZoom = startZoom + (clampedZoom - startZoom) * eased;

      // Update the scene
      this.updateScene();

      // Continue animation if not complete
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Ensure final values are exactly the target
        this.currentRotation = { ...clampedTarget };
        this.currentZoom = clampedZoom;
        this.updateScene();

        // Animation finished - now update labels
        this.isAnimating = false;
        setTimeout(() => this.updateLabelPositions(), 100); // Update labels after animation completes
      }
    };

    requestAnimationFrame(animate);
  }

  normalizeAngle(angle) {
    angle = angle % 360;
    if (angle < 0) angle += 360;
    return Math.round(angle);
  }

  updateUrlWithRotation() {
    const url = new URL(window.location);

    // Check if current values match defaults
    const isDefaultRotation = (
      this.currentRotation.x === this.defaultRotation.x &&
      this.currentRotation.y === this.defaultRotation.y &&
      this.currentRotation.z === this.defaultRotation.z
    );
    const isDefaultZoom = Math.abs(this.currentZoom - this.defaultZoom) < 0.01;

    // Use simplified parameters: "prefixXYZ" and "prefixZoom" (no dashes to keep it shorter)
    const rotationParam = `${this.urlPrefix.replace('_', '')}xyz`;
    const zoomParam = `${this.urlPrefix.replace('_', '')}zoom`;

    if (isDefaultRotation) {
      url.searchParams.delete(rotationParam);
    } else {
      // Format: x.y.z with dots as separators, preserving actual angle values
      const x = Math.round(this.currentRotation.x);
      const y = Math.round(this.currentRotation.y);
      const z = Math.round(this.currentRotation.z);

      // Format numbers with leading zero only for single digits, preserve negative signs
      const formatAngle = (angle) => {
        if (angle < 0) {
          const abs = Math.abs(angle);
          return abs < 10 ? `-0${abs}` : angle.toString();
        } else if (angle < 10) {
          return `0${angle}`; // Add leading zero for single digits
        } else {
          return angle.toString();
        }
      };

      const rotationValue = `${formatAngle(x)}.${formatAngle(y)}.${formatAngle(z)}`;
      url.searchParams.set(rotationParam, rotationValue);
    }

    if (isDefaultZoom) {
      url.searchParams.delete(zoomParam);
    } else {
      url.searchParams.set(zoomParam, this.currentZoom.toFixed(1));
    }

    window.history.replaceState({}, '', url);
  }

  rotateScene(deltaX, deltaY, deltaZ) {
    this.currentRotation.x = this.currentRotation.x + deltaX;
    this.currentRotation.y = this.currentRotation.y + deltaY;
    this.currentRotation.z = this.currentRotation.z + deltaZ;
    this.clampRotation();
    this.updateScene();
  }

  clampRotation() {
    // Clamp rotation values within configured limits for this instance
    this.currentRotation.x = Math.max(
      this.rotationLimits.x.min,
      Math.min(this.rotationLimits.x.max, this.currentRotation.x)
    );

    this.currentRotation.y = Math.max(
      this.rotationLimits.y.min,
      Math.min(this.rotationLimits.y.max, this.currentRotation.y)
    );

    this.currentRotation.z = Math.max(
      this.rotationLimits.z.min,
      Math.min(this.rotationLimits.z.max, this.currentRotation.z)
    );
  }

  enableTransition() {
    const perspective = this.container.querySelector('.isometric-perspective');
    if (perspective) {
      perspective.classList.add('smooth-transition');
    }
  }

  disableTransition() {
    const perspective = this.container.querySelector('.isometric-perspective');
    if (perspective) {
      perspective.classList.remove('smooth-transition');
    }
  }

  zoomScene(factor) {
    this.currentZoom = Math.max(0.2, Math.min(3.0, this.currentZoom * factor));
    this.updateScene();
  }

  resetView() {
    // Reset to default rotation values
    this.currentRotation = { ...this.defaultRotation };
    this.currentZoom = this.defaultZoom;
    this.currentTranslation = { ...this.defaultTranslation };
    
    // Update navigation bar to show default position as active
    this.setActiveNavPoint(-1);
    
    // Clear all highlights when resetting to default position
    this.clearHighlights();
    
    this.clampRotation();
    this.updateScene();
  }

  centerOnElement(element) {
    // Get the element's geometric center relative to the isometric container
    const scene = this.container.querySelector('.isometric-perspective');
    if (!scene || !element) return;

    // Get container center - this is where we want the element to appear
    const containerRect = this.container.getBoundingClientRect();
    const containerCenterX = containerRect.width / 2;
    const containerCenterY = containerRect.height / 2;

    // Get current element position (affected by current transforms)
    const elementRect = element.getBoundingClientRect();
    const elementCenterX = elementRect.left - containerRect.left + (elementRect.width / 2);
    const elementCenterY = elementRect.top - containerRect.top + (elementRect.height / 2);

    // Calculate how much we need to translate to center the element
    // The translation should move the element from its current position to the container center
    const neededTranslateX = (containerCenterX - elementCenterX) / this.currentZoom;
    const neededTranslateY = (containerCenterY - elementCenterY) / this.currentZoom;

    // Add this translation to our current translation (don't replace it)
    const targetTranslateX = this.currentTranslation.x + neededTranslateX;
    const targetTranslateY = this.currentTranslation.y + neededTranslateY;

    // Animate to the new position
    this.animateTranslation(targetTranslateX, targetTranslateY, this.currentTranslation.z);
  }

  project3DTo2D(x, y, z) {
    // Apply the current rotation transformations to get the projected position
    const rad = Math.PI / 180;
    const rx = this.currentRotation.x * rad;
    const ry = this.currentRotation.y * rad;
    const rz = this.currentRotation.z * rad;

    // Apply rotation matrices in the same order as CSS: rotateX, rotateY, rotateZ
    // Rotate around X axis
    let x1 = x;
    let y1 = y * Math.cos(rx) - z * Math.sin(rx);
    let z1 = y * Math.sin(rx) + z * Math.cos(rx);

    // Rotate around Y axis
    let x2 = x1 * Math.cos(ry) + z1 * Math.sin(ry);
    let y2 = y1;
    let z2 = -x1 * Math.sin(ry) + z1 * Math.cos(ry);

    // Rotate around Z axis
    let x3 = x2 * Math.cos(rz) - y2 * Math.sin(rz);
    let y3 = x2 * Math.sin(rz) + y2 * Math.cos(rz);

    // For isometric projection, we use the X and Y coordinates directly
    // The Z coordinate affects the apparent position but in our isometric view,
    // we mainly care about the X,Y projection
    return {
      x: x3,
      y: y3
    };
  }

  animateTranslation(targetX, targetY, targetZ) {
    // Cancel any existing translation animation
    if (this.translationAnimationId) {
      cancelAnimationFrame(this.translationAnimationId);
      this.translationAnimationId = null;
    }

    const startX = this.currentTranslation.x;
    const startY = this.currentTranslation.y;
    const startZ = this.currentTranslation.z;
    
    const duration = 500; // 500ms animation
    const startTime = performance.now();

    // Set animation flag to prevent label updates during animation
    this.isAnimating = true;

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Use easeInOutCubic for smooth animation
      const easeProgress = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      this.currentTranslation.x = startX + (targetX - startX) * easeProgress;
      this.currentTranslation.y = startY + (targetY - startY) * easeProgress;
      this.currentTranslation.z = startZ + (targetZ - startZ) * easeProgress;

      this.updateScene();

      if (progress < 1) {
        this.translationAnimationId = requestAnimationFrame(animate);
      } else {
        // Animation complete - reset flag and update labels
        this.translationAnimationId = null;
        this.isAnimating = false;
        setTimeout(() => this.updateLabelPositions(), 50);
      }
    };

    this.translationAnimationId = requestAnimationFrame(animate);
  }

  // Mouse event handlers
  onMouseDown(e) {
    this.isDragging = true;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
    this.dragButton = e.button; // 0 = left, 1 = middle, 2 = right

    // Disable transition for immediate mouse response
    this.disableTransition();

    // Add mousemove listener only when dragging starts
    document.addEventListener('mousemove', this.mouseMoveHandler);
    document.addEventListener('mouseup', this.onMouseUp);

    // Change cursor to indicate dragging mode
    if (e.button === 0) { // Left mouse button - rotation
      this.container.style.cursor = 'grabbing';
    } else if (e.button === 2) { // Right mouse button - zoom/Y rotation
      this.container.style.cursor = 'move';
    }

    // Focus this container
    this.container.focus();

    // Prevent default to avoid context menu on right click
    if (e.button === 2) {
      e.preventDefault();
    }
  }

  onMouseMove(e) {
    if (!this.isDragging) return;

    // Throttle mouse move events to reduce excessive updates
    const now = performance.now();
    if (now - this.lastUpdateTime < this.mouseMoveThrottle) {
      return;
    }
    this.lastUpdateTime = now;

    const deltaX = e.clientX - this.lastMouseX;
    const deltaY = e.clientY - this.lastMouseY;

    // Use requestAnimationFrame for smooth updates and prevent flicker
    if (!this.animationFrameId) {
      this.animationFrameId = requestAnimationFrame(() => {
        if (this.dragButton === 0) { // Left mouse button - X and Z rotation
          this.rotateScene(
            -deltaY * this.mouseSensitivity.x,  // Vertical mouse = X rotation
            0,
            -deltaX * this.mouseSensitivity.z   // Horizontal mouse = Z rotation (reversed for intuitive direction)
          );
        } else if (this.dragButton === 2) { // Right mouse button - Y rotation and zoom
          this.rotateScene(
            0,
            -deltaX * this.mouseSensitivity.y,  // Horizontal mouse = Y rotation (reversed for intuitive direction)
            0
          );

          // Zoom with vertical mouse movement
          const zoomFactor = 1 + (deltaY * 0.01);
          this.zoomScene(zoomFactor);
        }

        // Clear the animation frame ID
        this.animationFrameId = null;
      });
    }

    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
  }

  onMouseUp(e) {
    this.isDragging = false;
    this.dragButton = null;

    // Cancel any pending animation frame to prevent flicker
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Restore default cursor
    this.container.style.cursor = 'default';

    // Remove mousemove listener when dragging stops
    document.removeEventListener('mousemove', this.mouseMoveHandler);
    document.removeEventListener('mouseup', this.onMouseUp);
  }

  // Touch event handlers for mobile support
  onTouchStart(e) {
    if (e.touches.length === 1) {
      this.isDragging = true;
      this.lastMouseX = e.touches[0].clientX;
      this.lastMouseY = e.touches[0].clientY;
      this.dragButton = 0; // Treat single touch as left mouse button
      this.container.focus();
    }
    e.preventDefault();
  }

  onTouchMove(e) {
    if (!this.isDragging || e.touches.length !== 1) return;

    const deltaX = e.touches[0].clientX - this.lastMouseX;
    const deltaY = e.touches[0].clientY - this.lastMouseY;

    this.rotateScene(
      -deltaY * this.mouseSensitivity.x,
      0,
      deltaX * this.mouseSensitivity.z
    );

    this.lastMouseX = e.touches[0].clientX;
    this.lastMouseY = e.touches[0].clientY;
    e.preventDefault();
  }

  onTouchEnd(e) {
    this.isDragging = false;
    this.dragButton = null;
    e.preventDefault();
  }

  onWheel(e) {
    // Check if the mouse is over the help panel - if so, allow natural scrolling
    const helpPanel = e.target.closest('.keyboard-help');
    if (helpPanel && helpPanel.classList.contains('show')) {
      // Allow natural scrolling within help panel
      return;
    }

    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    this.zoomScene(zoomFactor);
  }

  onKeyDown(e) {
    // Only respond if this container has focus
    if (document.activeElement !== this.container) return;

    // Handle Tab navigation through navigation points
    if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      
      const navPoints = this.container.querySelectorAll('.nav-point');
      if (navPoints.length > 0) {
        // Find currently active nav point or default to first one
        let activeIndex = 0;
        const activePoint = this.container.querySelector('.nav-point.active');
        if (activePoint) {
          activeIndex = Array.from(navPoints).indexOf(activePoint);
        }
        
        // Calculate next index based on Tab direction
        let nextIndex;
        if (e.shiftKey) {
          // Shift+Tab: go backwards
          nextIndex = activeIndex > 0 ? activeIndex - 1 : navPoints.length - 1;
        } else {
          // Tab: go forwards
          nextIndex = activeIndex < navPoints.length - 1 ? activeIndex + 1 : 0;
        }
        
        // Click the navigation point to activate it
        navPoints[nextIndex].click();
      }
      return;
    }

    // Prevent default behavior for arrow keys and other navigation keys immediately
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', '+', '=', '-', ' ', 'r', 'R'].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Throttle keyboard input to prevent too rapid firing
    const now = performance.now();
    if (now - this.lastKeyTime < 100) {
      return;
    }
    this.lastKeyTime = now;

    const step = 5;
    const zoomStep = e.shiftKey ? 1.1 : 1.1;

    // Enable smooth transition for keyboard navigation
    this.enableTransition();

    switch (e.key) {
      case 'ArrowUp':
        if (e.shiftKey) {
          this.zoomScene(zoomStep);
        } else {
          this.rotateScene(-step, 0, 0);
        }
        break;
      case 'ArrowDown':
        if (e.shiftKey) {
          this.zoomScene(1 / zoomStep);
        } else {
          this.rotateScene(step, 0, 0);
        }
        break;
      case 'ArrowLeft':
        if (e.shiftKey) {
          this.rotateScene(0, -step, 0);
        } else {
          this.rotateScene(0, 0, -step);
        }
        break;
      case 'ArrowRight':
        if (e.shiftKey) {
          this.rotateScene(0, step, 0);
        } else {
          this.rotateScene(0, 0, step);
        }
        break;
      case '+':
      case '=':
        this.zoomScene(zoomStep);
        break;
      case '-':
        this.zoomScene(1 / zoomStep);
        break;
      case 'r':
      case 'R':
      case ' ':
        this.resetToDefault();
        break;
    }
  }  loadFromUrl() {
    const url = new URL(window.location);

    // Load simplified rotation parameter (e.g., "azurexyz=45.10.315")
    const rotationParam = url.searchParams.get(`${this.urlPrefix.replace('_', '')}xyz`);
    if (rotationParam) {
      const [x, y, z] = rotationParam.split('.').map(v => parseFloat(v) || 0);
      this.currentRotation.x = x;
      this.currentRotation.y = y;
      this.currentRotation.z = z;
      this.clampRotation();
    }

    // Load simplified zoom parameter (e.g., "azurezoom=1.1")
    const zoomParam = url.searchParams.get(`${this.urlPrefix.replace('_', '')}zoom`);
    if (zoomParam) {
      this.currentZoom = parseFloat(zoomParam);
    }
  }

  // Public methods for external control
  setRotation(x, y, z) {
    this.currentRotation = { x, y, z };
    this.clampRotation();
    this.updateScene();
  }

  setZoom(zoom) {
    this.currentZoom = Math.max(0.2, Math.min(3.0, zoom));
    this.updateScene();
  }

  getState() {
    return {
      rotation: { ...this.currentRotation },
      zoom: this.currentZoom
    };
  }

  // Three-phase initialization for SVG overlay (called automatically in init)
  initializeThreePhase() {
    const perspective = this.container.querySelector('.isometric-perspective');
    
    // Create SVG overlay if connectors are defined
    if (perspective && perspective.hasAttribute('data-connectors')) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.classList.add('scene-overlay');
      svg.style.position = 'absolute';
      svg.style.top = '0';
      svg.style.left = '0';
      svg.style.width = '100%';
      svg.style.height = '100%';
      svg.style.pointerEvents = 'none';
      svg.style.zIndex = '1000';
      perspective.insertBefore(svg, perspective.firstChild);
    }
    
    const scenes = this.container.querySelectorAll('.scene[data-height], .scene[data-z-axis]');
    
    // Store original scene data attributes
    this.sceneOriginalData = new Map();
    scenes.forEach(scene => {
      const original = {
        height: scene.dataset.height || '0',
        zAxis: scene.dataset.zAxis || '0'
      };
      this.sceneOriginalData.set(scene, original);
      // set to inital value 
      scene.dataset.height = '0';
      scene.dataset.zAxis = '0';
    });
    
    // Check for URL parameters (highest priority)
    const url = new URL(window.location);
    const rotationParam = url.searchParams.get(`${this.urlPrefix.replace('_', '')}xyz`);
    const zoomParam = url.searchParams.get(`${this.urlPrefix.replace('_', '')}zoom`);
    
    let finalRotation, finalZoom;
    
    // Priority: URL parameters > defaults
    if (rotationParam) {
      const [x, y, z] = rotationParam.split('.').map(v => parseFloat(v) || 0);
      finalRotation = { x, y, z };
    } else {
      finalRotation = { ...this.defaultRotation };
    }
    
    if (zoomParam) {
      finalZoom = parseFloat(zoomParam);
    } else {
      finalZoom = this.defaultZoom;
    }

    // Apply completely flat state - ignore all stored values
    this.currentRotation = { x: 0, y: 0, z: 0 };
    this.currentZoom = 1.0;
    
    this.configureScenes();
    this.captureCoordinatesAndDrawSvg();
    // Phase 2: Capture coordinates and draw SVG, then restore scene data (after DOM updates)
    setTimeout(() => {
      
      // Restore scene data (data-height, data-z-axis)
      scenes.forEach(scene => {
        const original = this.sceneOriginalData.get(scene);
        if (original) {
          scene.dataset.height = original.height;
          scene.dataset.zAxis = original.zAxis;
        }
      });
      
      // Apply final rotation and zoom (URL params have priority over defaults)
      this.currentRotation = { ...finalRotation };
      this.currentZoom = finalZoom;
      
      // Clamp rotation to ensure it's within limits
      this.clampRotation();
      
      // Reconfigure scenes with restored data
      this.configureScenes();
      this.updateScene();

      // Make the perspective visible after 3D transforms are applied
      setTimeout(() => {
        const perspective = this.container.querySelector('.isometric-perspective');
        if (perspective) {
        perspective.classList.add('ready');
        }
      }, 50); // Small delay to ensure updateScene has completed

    }, 300);
  }

  // Helper function to get transformed corners using getBoundingClientRect
  getTransformedCorners(element, perspectiveRect) {
    // Get the element's bounding box after all transforms are applied
    const rect = element.getBoundingClientRect();
    
    // Calculate relative to perspective container
    const offsetX = rect.left - perspectiveRect.left;
    const offsetY = rect.top - perspectiveRect.top;
    
    // Return the four corners relative to the perspective container
    return {
      tl: { x: offsetX, y: offsetY },
      tr: { x: offsetX + rect.width, y: offsetY },
      br: { x: offsetX + rect.width, y: offsetY + rect.height },
      bl: { x: offsetX, y: offsetY + rect.height }
    };
  }

  // Phase 2: Capture coordinates and draw SVG connectors
  captureCoordinatesAndDrawSvg() {
    const perspective = this.container.querySelector('.isometric-perspective');
    const svg = perspective.querySelector('.scene-overlay');
    
    if (!svg) return;
    
    // Clear existing SVG content
    svg.innerHTML = '';
    
    // Get the perspective container's position for reference
    const perspectiveRect = perspective.getBoundingClientRect();
    
    // Parse connector metadata from data attribute
    const connectorsData = perspective.getAttribute('data-connectors');
    if (!connectorsData) {
      return;
    }
    
    let connectors;
    try {
      connectors = JSON.parse(connectorsData);
    } catch (e) {
      return;
    }
    
    // Create defs for arrow markers (one per color)
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const usedColors = new Set(connectors.map(c => c.color || '#4CAF50'));
    
    usedColors.forEach(color => {
      const markerId = `arrowhead-${color.replace('#', '')}`;
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', markerId);
      marker.setAttribute('markerWidth', '10');
      marker.setAttribute('markerHeight', '10');
      marker.setAttribute('refX', '9');
      marker.setAttribute('refY', '3');
      marker.setAttribute('orient', 'auto');
      marker.setAttribute('markerUnits', 'strokeWidth');
      
      const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      arrowPath.setAttribute('d', 'M0,0 L0,6 L9,3 z');
      arrowPath.setAttribute('fill', color);
      marker.appendChild(arrowPath);
      defs.appendChild(marker);
    });
    
    svg.appendChild(defs);
    
    // Draw each connector
    connectors.forEach((connector, index) => {
      const fromElement = document.getElementById(connector.from);
      const toElement = document.getElementById(connector.to);
      
      if (!fromElement || !toElement) {
        console.warn(`  ⚠ Connector ${index}: Could not find elements ${connector.from} -> ${connector.to}`);
        return;
      }
      
      const fromCorners = this.getTransformedCorners(fromElement, perspectiveRect);
      const toCorners = this.getTransformedCorners(toElement, perspectiveRect);
      
      if (!fromCorners || !toCorners) {
        console.warn(`  ⚠ Connector ${index}: Could not get corners`);
        return;
      }
      
      // Calculate start point based on fromPoint
      const startPoint = this.getConnectionPoint(fromCorners, connector.fromPoint);
      
      // Calculate end point based on toPoint
      const endPoint = this.getConnectionPoint(toCorners, connector.toPoint);
      
      // Determine routing direction based on connection points
      // left/right → horizontal first, top/bottom → vertical first, center → depends on opposite end
      const startOrientation = this.getPointOrientation(connector.fromPoint, connector.toPoint, startPoint, endPoint);
      const endOrientation = this.getPointOrientation(connector.toPoint, connector.fromPoint, endPoint, startPoint);
      
      // Draw connector line with rounded corners
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const color = connector.color || '#4CAF50';
      const cornerRadius = 10;
      
      // Calculate direction and distance
      const deltaY = endPoint.y - startPoint.y;
      const deltaX = endPoint.x - startPoint.x;
      
      // Determine the direction for corner calculation
      const xDir = Math.sign(deltaX) || 1; // Left-to-right (1) or right-to-left (-1)
      const yDir = Math.sign(deltaY) || 1; // Top-to-bottom (1) or bottom-to-top (-1)
      
      let pathData;
      
      // Parse edgeAt parameter if provided: "startOffset,endOffset" in pixels
      // e.g., "50,40" = edge after 50px from start, edge 40px before end
      // e.g., ",60" = no edge at start, edge 60px before end (single corner)
      let edgeStart = null;
      let edgeEnd = null;
      
      if (connector.edgeAt) {
        const edges = connector.edgeAt.split(',');
        edgeStart = edges[0] ? parseFloat(edges[0]) : null;
        edgeEnd = edges[1] ? parseFloat(edges[1]) : null;
      }
      
      // Check if a straight line is possible
      if (Math.abs(deltaY) < 1) {
        // Case: Straight horizontal line (same Y)
        pathData = `M ${startPoint.x},${startPoint.y} L ${endPoint.x},${endPoint.y}`;
      } else if (Math.abs(deltaX) < 1) {
        // Case: Straight vertical line (same X)
        pathData = `M ${startPoint.x},${startPoint.y} L ${endPoint.x},${endPoint.y}`;
      } else if (edgeStart !== null && edgeEnd !== null) {
        // Case: Two edges at specified pixel offsets
        // Route based on start orientation
        if (startOrientation === 'horizontal') {
          // Start → horizontal(edgeStart px) → corner1 ↓ vertical ↓ corner2 → horizontal(edgeEnd px) → End
          // edgeStart/edgeEnd are always positive pixel values
          const corner1X = startPoint.x + xDir * edgeStart;
          const corner2X = endPoint.x - xDir * edgeEnd;
          
          pathData = `
            M ${startPoint.x},${startPoint.y}
            L ${corner1X - xDir * cornerRadius},${startPoint.y}
            Q ${corner1X},${startPoint.y} ${corner1X},${startPoint.y + yDir * cornerRadius}
            L ${corner2X},${endPoint.y - yDir * cornerRadius}
            Q ${corner2X},${endPoint.y} ${corner2X + xDir * cornerRadius},${endPoint.y}
            L ${endPoint.x},${endPoint.y}
          `.trim();
        } else {
          // Start ↓ vertical(edgeStart px) ↓ corner1 → horizontal → corner2 ↓ vertical(edgeEnd px) ↓ End
          const corner1Y = startPoint.y + yDir * edgeStart;
          const corner2Y = endPoint.y - yDir * edgeEnd;
          
          const corner1BeforeY = corner1Y - yDir * cornerRadius;
          const corner1AfterX = startPoint.x + xDir * cornerRadius;
          
          const corner2BeforeX = endPoint.x - xDir * cornerRadius;
          const corner2AfterY = corner2Y + yDir * cornerRadius;
          
          pathData = `
            M ${startPoint.x},${startPoint.y}
            L ${startPoint.x},${corner1BeforeY}
            Q ${startPoint.x},${corner1Y} ${corner1AfterX},${corner1Y}
            L ${corner2BeforeX},${corner2Y}
            Q ${endPoint.x},${corner2Y} ${endPoint.x},${corner2AfterY}
            L ${endPoint.x},${endPoint.y}
          `.trim();
        }
      } else if (edgeEnd !== null && edgeStart === null) {
        // Case: Single edge at end only (",60")
        if (startOrientation === 'horizontal') {
          // Start → horizontal → Corner ↓ vertical → corner ↓ End
          const cornerX = endPoint.x - xDir * edgeEnd;
          
          pathData = `
            M ${startPoint.x},${startPoint.y}
            L ${cornerX - xDir * cornerRadius},${startPoint.y}
            Q ${cornerX},${startPoint.y} ${cornerX},${startPoint.y + yDir * cornerRadius}
            L ${cornerX},${endPoint.y - yDir * cornerRadius}
            Q ${cornerX},${endPoint.y} ${cornerX + xDir * cornerRadius},${endPoint.y}
            L ${endPoint.x},${endPoint.y}
          `.trim();
        } else {
          // Start ↓ Vertical ↓ Corner → horizontal → End
          const cornerX = endPoint.x - xDir * edgeEnd;
          
          pathData = `
            M ${startPoint.x},${startPoint.y}
            L ${startPoint.x},${endPoint.y - yDir * cornerRadius}
            Q ${startPoint.x},${endPoint.y} ${startPoint.x + xDir * cornerRadius},${endPoint.y}
            L ${endPoint.x},${endPoint.y}
          `.trim();
        }
      } else if (edgeStart !== null && edgeEnd === null) {
        // Case: Single edge at start only ("50,")
        if (startOrientation === 'horizontal') {
          // Start → horizontal(edgeStart px) → Corner ↓ Vertical ↓ Corner → End
          const cornerX = startPoint.x + xDir * edgeStart;
          
          pathData = `
            M ${startPoint.x},${startPoint.y}
            L ${cornerX - xDir * cornerRadius},${startPoint.y}
            Q ${cornerX},${startPoint.y} ${cornerX},${startPoint.y + yDir * cornerRadius}
            L ${cornerX},${endPoint.y - yDir * cornerRadius}
            Q ${cornerX},${endPoint.y} ${cornerX + xDir * cornerRadius},${endPoint.y}
            L ${endPoint.x},${endPoint.y}
          `.trim();
        } else {
          // Start ↓ vertical(edgeStart px) ↓ Corner → horizontal → corner ↓ End
          const cornerY = startPoint.y + yDir * edgeStart;
          
          pathData = `
            M ${startPoint.x},${startPoint.y}
            L ${startPoint.x},${cornerY - yDir * cornerRadius}
            Q ${startPoint.x},${cornerY} ${startPoint.x + xDir * cornerRadius},${cornerY}
            L ${endPoint.x - xDir * cornerRadius},${cornerY}
            Q ${endPoint.x},${cornerY} ${endPoint.x},${cornerY + yDir * cornerRadius}
            L ${endPoint.x},${endPoint.y}
          `.trim();
        }
      } else {
        // Case: No edgeAt specified - use default based on orientation
        if (startOrientation === 'horizontal') {
          // Default horizontal routing: 25%/75% of horizontal distance
          const corner1X = startPoint.x + deltaX * 0.25;
          const corner2X = startPoint.x + deltaX * 0.75;
          
          pathData = `
            M ${startPoint.x},${startPoint.y}
            L ${corner1X - xDir * cornerRadius},${startPoint.y}
            Q ${corner1X},${startPoint.y} ${corner1X},${startPoint.y + yDir * cornerRadius}
            L ${corner2X},${endPoint.y - yDir * cornerRadius}
            Q ${corner2X},${endPoint.y} ${corner2X + xDir * cornerRadius},${endPoint.y}
            L ${endPoint.x},${endPoint.y}
          `.trim();
        } else {
          // Default vertical routing: 25%/75% of vertical distance
          const corner1Y = startPoint.y + deltaY * 0.25;
          const corner2Y = startPoint.y + deltaY * 0.75;
          
          pathData = `
            M ${startPoint.x},${startPoint.y}
            L ${startPoint.x},${corner1Y - yDir * cornerRadius}
            Q ${startPoint.x},${corner1Y} ${startPoint.x + xDir * cornerRadius},${corner1Y}
            L ${endPoint.x - xDir * cornerRadius},${corner2Y}
            Q ${endPoint.x},${corner2Y} ${endPoint.x},${corner2Y + yDir * cornerRadius}
            L ${endPoint.x},${endPoint.y}
          `.trim();
        }
      }
      
      path.setAttribute('d', pathData);
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', '3');
      path.setAttribute('fill', 'none');
      path.setAttribute('marker-end', `url(#arrowhead-${color.replace('#', '')})`);
      path.setAttribute('stroke-linecap', 'round');
      
      // Add data attributes and class for highlighting
      path.setAttribute('data-connector-from', connector.from);
      path.setAttribute('data-connector-to', connector.to);
      
      // Support both 'key' (single) and 'keys' (array) for flexibility
      const keys = connector.key ? [connector.key] : (connector.keys || []);
      if (keys.length > 0) {
        path.setAttribute('data-connector-keys', keys.join(','));
      }
      path.classList.add('connector-path');
      
      svg.appendChild(path);
      
      // Add start and end markers for debugging
      const startCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      startCircle.setAttribute('cx', startPoint.x);
      startCircle.setAttribute('cy', startPoint.y);
      startCircle.setAttribute('r', '5');
      startCircle.setAttribute('fill', color);
      startCircle.setAttribute('opacity', '0.5');
      startCircle.classList.add('connector-marker');
      if (keys.length > 0) {
        startCircle.setAttribute('data-connector-keys', keys.join(','));
      }
      svg.appendChild(startCircle);
      
      const endCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      endCircle.setAttribute('cx', endPoint.x);
      endCircle.setAttribute('cy', endPoint.y);
      endCircle.setAttribute('r', '5');
      endCircle.setAttribute('fill', color);
      endCircle.classList.add('connector-marker');
      if (keys.length > 0) {
        endCircle.setAttribute('data-connector-keys', keys.join(','));
      }
      svg.appendChild(endCircle);
      
    });
  }
  
  // Helper to determine routing orientation based on connection point
  getPointOrientation(point, oppositePoint, thisPoint, oppositeCoord) {
    // left/right → horizontal first
    if (point === 'left' || point === 'right') {
      return 'horizontal';
    }
    
    // top/bottom → vertical first
    if (point === 'top' || point === 'bottom') {
      return 'vertical';
    }
    
    // center → orient based on opposite end
    if (point === 'center') {
      // If opposite is left/right, we should go horizontal first
      if (oppositePoint === 'left' || oppositePoint === 'right') {
        return 'horizontal';
      }
      // If opposite is top/bottom, we should go vertical first
      if (oppositePoint === 'top' || oppositePoint === 'bottom') {
        return 'vertical';
      }
      // If opposite is also center, decide based on which direction has more distance
      const deltaX = Math.abs(oppositeCoord.x - thisPoint.x);
      const deltaY = Math.abs(oppositeCoord.y - thisPoint.y);
      return deltaX > deltaY ? 'horizontal' : 'vertical';
    }
    
    // corner points → default to horizontal
    return 'horizontal';
  }
  
  // Helper to calculate connection point on a scene
  getConnectionPoint(corners, point) {
    const { tl, tr, br, bl } = corners;
    
    switch (point) {
      case 'center':
        return {
          x: (tl.x + br.x) / 2,
          y: (tl.y + br.y) / 2
        };
      case 'top':
        return {
          x: (tl.x + tr.x) / 2,
          y: (tl.y + tr.y) / 2
        };
      case 'bottom':
        return {
          x: (bl.x + br.x) / 2,
          y: (bl.y + br.y) / 2
        };
      case 'left':
        return {
          x: (tl.x + bl.x) / 2,
          y: (tl.y + bl.y) / 2
        };
      case 'right':
        return {
          x: (tr.x + br.x) / 2,
          y: (tr.y + br.y) / 2
        };
      case 'top-left':
        return { x: tl.x, y: tl.y };
      case 'top-right':
        return { x: tr.x, y: tr.y };
      case 'bottom-left':
        return { x: bl.x, y: bl.y };
      case 'bottom-right':
        return { x: br.x, y: br.y };
      default:
        // Default to center if unknown point
        return {
          x: (tl.x + br.x) / 2,
          y: (tl.y + br.y) / 2
        };
    }
  }

  // Update existing SVG overlay without redrawing
  updateSceneDimensions() {
    const perspective = this.container.querySelector('.isometric-perspective');
    const svg = perspective.querySelector('.scene-overlay');
    const perspectiveRect = perspective.getBoundingClientRect();
    
    if (!svg) return;
    
    
    // Update each polygon with new corner positions
    const polygons = svg.querySelectorAll('polygon[data-scene-id]');
    polygons.forEach(polygon => {
      const sceneId = polygon.getAttribute('data-scene-id');
      const scene = document.getElementById(sceneId) || document.querySelector(`.${sceneId}`);
      
      if (scene) {
        const corners = this.getTransformedCorners(scene, perspectiveRect);
        if (corners) {
          const { tl, tr, br, bl } = corners;
          const points = `${tl.x},${tl.y} ${tr.x},${tr.y} ${br.x},${br.y} ${bl.x},${bl.y}`;
          polygon.setAttribute('points', points);
        }
      }
    });
    
  }

  // Highlight elements by key(s)
  highlightByKey(keys) {
    // Ensure keys is an array
    const keyArray = Array.isArray(keys) ? keys : [keys];
    
    
    // First, remove all existing highlights
    this.clearHighlights();
    
    keyArray.forEach(key => {
      // Highlight connectors with matching key (check comma-separated list)
      const allConnectors = this.container.querySelectorAll('[data-connector-keys]');
      allConnectors.forEach(el => {
        const elementKeys = el.getAttribute('data-connector-keys').split(',');
        if (elementKeys.includes(key)) {
          el.classList.add('highlight');
        }
      });
      
      // Highlight scenes with matching key (check comma-separated list in data-keys)
      const scenes = this.container.querySelectorAll(`.scene[data-keys]`);
      scenes.forEach(scene => {
        const elementKeys = scene.getAttribute('data-keys').split(',').map(k => k.trim());
        if (elementKeys.includes(key)) {
          scene.classList.add('highlight');
        }
      });
      
      // Highlight faces with matching key (check comma-separated list in data-keys) - but highlight the parent scene instead
      const faces = this.container.querySelectorAll(`.face[data-keys]`);
      faces.forEach(face => {
        const elementKeys = face.getAttribute('data-keys').split(',').map(k => k.trim());
        if (elementKeys.includes(key)) {
          const parentScene = face.closest('.scene');
          if (parentScene) {
            parentScene.classList.add('highlight');
          }
        }
      });
      
      const connectorCount = this.container.querySelectorAll(`.connector-path.highlight, .connector-marker.highlight`).length;
      const sceneCount = this.container.querySelectorAll(`.scene.highlight`).length;
    });
  }
  
  // Clear all highlights
  clearHighlights() {
    const highlighted = this.container.querySelectorAll('.highlight');
    highlighted.forEach(el => el.classList.remove('highlight'));
  }
  
  // Toggle highlight for specific key
  toggleHighlight(key) {
    // Find all elements with this key
    const allElements = this.container.querySelectorAll('[data-connector-keys], [data-key]');
    const matchingElements = Array.from(allElements).filter(el => {
      const connectorKeys = el.getAttribute('data-connector-keys');
      const dataKey = el.getAttribute('data-key');
      
      if (connectorKeys && connectorKeys.split(',').includes(key)) return true;
      if (dataKey === key) return true;
      return false;
    });
    
    if (matchingElements.length === 0) return;
    
    const isHighlighted = matchingElements[0].classList.contains('highlight');
    
    if (isHighlighted) {
      matchingElements.forEach(el => el.classList.remove('highlight'));
    } else {
      matchingElements.forEach(el => el.classList.add('highlight'));
    }
  }

  destroy() {
    this.removeEventListeners();
    clearTimeout(this.urlUpdateTimeout);

    // Clean up compact controls if they exist
    const compactControls = this.container.querySelector('.compact-controls');
    if (compactControls) {
      compactControls.remove();
    }
  }
}

// Global registry for multiple instances
window.isometric3DInstances = window.isometric3DInstances || {};

// Helper function to create and manage instances
function createIsometric3D(containerId, options = {}) {
  // Clean up existing instance if it exists
  if (window.isometric3DInstances[containerId]) {
    window.isometric3DInstances[containerId].destroy();
  }

  // Create new instance
  const instance = new Isometric3D(containerId, options);
  window.isometric3DInstances[containerId] = instance;

  return instance;
}

// Helper function to get instance
function getIsometric3D(containerId) {
  return window.isometric3DInstances[containerId];
}

// Helper function to destroy instance
function destroyIsometric3D(containerId) {
  if (window.isometric3DInstances[containerId]) {
    window.isometric3DInstances[containerId].destroy();
    delete window.isometric3DInstances[containerId];
  }
}

// Legacy function for backward compatibility
function setupIsometric3D(containerId = 'isometric-container', options = {}) {
  return createIsometric3D(containerId, options);
}

// Auto-initialize if container exists (backward compatibility)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const defaultContainer = document.getElementById('isometric-container');
    if (defaultContainer && !window.isometric3DInstances['isometric-container']) {
      setupIsometric3D();
    }
  });
} else {
  const defaultContainer = document.getElementById('isometric-container');
  if (defaultContainer && !window.isometric3DInstances['isometric-container']) {
    setupIsometric3D();
  }
}
