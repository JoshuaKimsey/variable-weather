/**
 * Dynamically load a CSS file if not already loaded
 * @param {string} cssPath - Path to the CSS file
 * @returns {Promise} - Resolves when CSS is loaded
 */
export function loadComponentCSS(cssPath) {
    return new Promise((resolve, reject) => {
        // Check if already loaded
        if (document.querySelector(`link[href="${cssPath}"]`)) {
            resolve();
            return;
        }
        
        // Create link element
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = cssPath;
        
        // Handle load events
        link.onload = () => resolve();
        link.onerror = () => reject(new Error(`Failed to load CSS: ${cssPath}`));
        
        // Add to document head
        document.head.appendChild(link);
    });
}