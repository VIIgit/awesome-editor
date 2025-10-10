/**
 * ScrollSync - Bidirectional Scroll Synchronization for Isometric 3D Navigation
 * 
 * Synchronizes scroll position with 3D navigation state:
 * - When user scrolls through content sections, the 3D view updates to match
 * - When user navigates the 3D view, the page scrolls to the corresponding section
 * 
 * @class ScrollSync
 * @param {Object} controller - The isometric 3D controller instance
 * @param {Object} options - Configuration options
 * @param {number} options.stickyThreshold - Top offset where sections become "active" (default: 320)
 * @param {number} options.scrollDuration - Scroll animation duration in ms (default: 1800)
 * @param {number} options.debounceDelay - Debounce delay for navigation updates in ms (default: 100)
 * @param {string} options.sectionSelector - CSS selector for content sections (default: '.description-section')
 * @param {string} options.dataIdAttribute - Attribute name for linking 3D elements to sections (default: 'data-id')
 */
class ScrollSync {
    constructor(controller, options = {}) {
        this.controller = controller;
        this.options = {
            stickyThreshold: 320,
            scrollDuration: 1800,
            debounceDelay: 100,
            sectionSelector: '.description-section',
            dataIdAttribute: 'data-id',
            ...options
        };
        
        this.programmaticScroll = false;
        this.lastScrollY = window.scrollY;
        this.scrollAnimationFrame = null;
        this.navigationDebounceTimer = null;
        this.currentNavigationTarget = null;
        
        this.setupBidirectionalSync();
    }

    /**
     * Sets up bidirectional synchronization between 3D navigation and page scrolling
     * @private
     */
    setupBidirectionalSync() {
        // 1. Navigation → Scroll: When 3D navigation changes, scroll to description
        this.controller.on('navigationChange', (data) => {
            const sectionId = data.element.getAttribute(this.options.dataIdAttribute);
            if (sectionId && !this.programmaticScroll) {
                this.scrollToSection(sectionId);
            }
        });

        // 2. Scroll → Navigation: When scrolling, detect which section is in focus
        this.setupScrollDetection();
    }

    /**
     * Sets up IntersectionObserver to detect which content section is currently visible
     * @private
     */
    setupScrollDetection() {
        const sections = document.querySelectorAll(this.options.sectionSelector);

        // Build a map from section IDs to their corresponding 3D elements
        const sectionToNavElement = {};
        sections.forEach(section => {
            const sectionId = section.id;
            const navElement = document.querySelector(`[${this.options.dataIdAttribute}="${sectionId}"]`);
            if (navElement) {
                sectionToNavElement[sectionId] = navElement;
            }
        });

        // Detect manual user scroll to cancel programmatic scrolling
        const detectUserScroll = () => {
            if (this.programmaticScroll) {
                // User is manually scrolling during programmatic scroll - cancel it
                if (this.scrollAnimationFrame) {
                    cancelAnimationFrame(this.scrollAnimationFrame);
                    this.scrollAnimationFrame = null;
                }
                this.programmaticScroll = false;
            }
        };

        // Listen for wheel and touch events to detect manual scrolling
        window.addEventListener('wheel', detectUserScroll, { passive: true });
        window.addEventListener('touchmove', detectUserScroll, { passive: true });

        // Store intersection state for debounced processing
        const intersectionState = new Map();

        // Use IntersectionObserver with the sticky threshold as the trigger point
        const observer = new IntersectionObserver((entries) => {
            if (this.programmaticScroll) return;

            const currentScrollY = window.scrollY;
            this.lastScrollY = currentScrollY;

            // Update intersection state for all entries
            entries.forEach(entry => {
                intersectionState.set(entry.target.id, {
                    isIntersecting: entry.isIntersecting,
                    intersectionRatio: entry.intersectionRatio
                });
            });

            // Debounce navigation to prevent flickering during fast scrolling
            if (this.navigationDebounceTimer) {
                clearTimeout(this.navigationDebounceTimer);
            }

            this.navigationDebounceTimer = setTimeout(() => {
                // Process current intersection state
                const sortedEntries = Array.from(intersectionState.entries())
                    .filter(([id, state]) => state.isIntersecting)
                    .sort((a, b) => b[1].intersectionRatio - a[1].intersectionRatio);

                // Use the most visible section
                if (sortedEntries.length > 0) {
                    const [sectionId, state] = sortedEntries[0];
                    const navElement = sectionToNavElement[sectionId];
                    
                    if (navElement) {
                        // Get navigation data from element
                        const xyz = navElement.getAttribute('data-nav-xyz');
                        const zoom = navElement.getAttribute('data-nav-zoom');
                        const navigationKey = `${xyz}|${zoom}`;

                        // Only navigate if target has changed
                        if (xyz || zoom) {
                            if (this.currentNavigationTarget !== navigationKey) {
                                this.currentNavigationTarget = navigationKey;
                                this.controller.navigateToPosition(xyz, zoom);
                                
                                // Check for auto-highlight keys on the navigation element or its parent scene
                                const autoHighlightKeys = navElement.getAttribute('data-auto-highlight-key') || 
                                                         navElement.closest('.scene')?.getAttribute('data-auto-highlight-key');
                                
                                if (autoHighlightKeys) {
                                    // Split by comma and highlight all keys
                                    const keys = autoHighlightKeys.split(',').map(k => k.trim());
                                    this.controller.highlightByKey(keys);
                                } else {
                                    // No auto-highlight defined, clear any existing highlights
                                    this.controller.clearHighlights();
                                }
                            }
                        }
                    }
                } else {
                    // No sections are intersecting - reset to default view
                    if (this.currentNavigationTarget !== null) {
                        this.currentNavigationTarget = null;
                        this.controller.resetToDefault();
                        this.controller.clearHighlights();
                    }
                }
            }, this.options.debounceDelay);
        }, {
            // Trigger when section crosses the sticky threshold
            rootMargin: `-${this.options.stickyThreshold}px 0px -50% 0px`,
            threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
        });

        sections.forEach(section => observer.observe(section));
    }

    /**
     * Smoothly scrolls to a specific content section
     * @param {string} sectionId - The ID of the section to scroll to
     * @public
     */
    scrollToSection(sectionId) {
        const section = document.getElementById(sectionId);
        if (!section) return;

        // Cancel any in-progress scroll animation
        if (this.scrollAnimationFrame) {
            cancelAnimationFrame(this.scrollAnimationFrame);
        }

        this.programmaticScroll = true;

        // Custom smooth scroll with configurable duration
        const targetPosition = section.offsetTop;
        const startPosition = window.scrollY;
        const distance = targetPosition - startPosition;
        const duration = this.options.scrollDuration;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Use easeInOutQuad for smooth scrolling
            const eased = progress < 0.5
                ? 2 * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;

            window.scrollTo(0, startPosition + distance * eased);

            if (progress < 1) {
                this.scrollAnimationFrame = requestAnimationFrame(animate);
            } else {
                // Reset flag after scroll completes
                this.programmaticScroll = false;
                this.scrollAnimationFrame = null;
            }
        };

        this.scrollAnimationFrame = requestAnimationFrame(animate);
    }

    /**
     * Destroys the ScrollSync instance and cleans up event listeners
     * @public
     */
    destroy() {
        if (this.scrollAnimationFrame) {
            cancelAnimationFrame(this.scrollAnimationFrame);
        }
        if (this.navigationDebounceTimer) {
            clearTimeout(this.navigationDebounceTimer);
        }
    }
}
