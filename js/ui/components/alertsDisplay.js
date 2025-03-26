/**
 * Alerts Display Component
 * 
 * Handles the display of weather alerts
 */

//==============================================================================
// 1. IMPORTS
//==============================================================================

import { loadComponentCSS } from '../../utils/cssLoader.js';

//==============================================================================
// 2. DOM REFERENCES
//==============================================================================

// DOM element
let alertsContainer;

//==============================================================================
// 3. INITIALIZATION
//==============================================================================

/**
 * Initialize the alerts display component
 */
export function initAlertsDisplay() {
    alertsContainer = document.getElementById('alerts-container');
}

//==============================================================================
// 4. ALERT DISPLAY FUNCTIONS
//==============================================================================

/**
 * Display weather alerts
 * @param {Array} alerts - Array of alert objects
 */
export function displayAlerts(alerts) {

    loadComponentCSS('./styles/alerts.css').catch(error => console.warn('Failed to load radar styles:', error));

    try {
        // Clear previous alerts
        alertsContainer.innerHTML = '';

        // Check if alerts exist
        if (!alerts || !Array.isArray(alerts) || alerts.length === 0) {
            alertsContainer.style.display = 'none';
            return;
        }

        // Sort alerts by severity (extreme first, then severe, etc.)
        const sortedAlerts = [...alerts].sort((a, b) => {
            const severityOrder = {
                'extreme': 1,
                'severe': 2,
                'moderate': 3,
                'minor': 4
            };

            return severityOrder[a.severity] - severityOrder[b.severity];
        });

        // Process and display each alert
        sortedAlerts.forEach((alert, index) => {
            // Create alert element
            const alertElement = document.createElement('div');
            alertElement.className = `alert-item alert-${alert.severity}`;
            alertElement.id = `alert-${index}`;

            // Create the collapsed view (shown by default)
            alertElement.innerHTML = `
                <div class="alert-header">
                    <div class="alert-title-row">
                        <div class="alert-title-severity">
                            <span class="alert-severity alert-${alert.severity}">${capitalizeFirst(alert.severity)}</span>
                            <h3 class="alert-title">${alert.title}</h3>
                        </div>
                        <div class="alert-icon-container">
                            <img src="${getHazardIcon(alert.primaryHazard)}" alt="${alert.title} icon" class="alert-meteocon" />
                            ${alert.hazardTypes.filter(hazard => hazard !== alert.primaryHazard).map(hazard =>
                `<img src="${getHazardIcon(hazard)}" alt="${hazard} hazard" class="alert-meteocon" />`
            ).join('')}
                        </div>
                        <button class="alert-expand-btn" aria-label="Expand alert details">
                            <i class="bi bi-chevron-down"></i>
                        </button>
                    </div>
                    <div class="alert-subtitle">${alert.description}</div>
                </div>
                <div class="alert-content" style="display: none;">
                    <div class="alert-metadata">
                        ${alert.urgency ? `<div class="alert-urgency">Urgency: ${alert.urgency}</div>` : ''}
                        ${alert.expires ? `<div class="alert-expires">Expires: ${formatDate(new Date(alert.expires))}</div>` : ''}
                        ${alert.source ? `<div class="alert-source">Source: ${getSourceName(alert.source)}</div>` : ''}
                    </div>
                    <div class="alert-full-description">${formatAlertText(alert.fullText)}</div>
                </div>
            `;

            alertsContainer.appendChild(alertElement);

            // Add click event to the alert to toggle expansion
            const expandBtn = alertElement.querySelector('.alert-expand-btn');
            const alertContent = alertElement.querySelector('.alert-content');

            expandBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent the alert click event from firing

                const isExpanded = alertContent.style.display !== 'none';

                // Toggle the content visibility
                alertContent.style.display = isExpanded ? 'none' : 'block';

                // Toggle the icon
                expandBtn.innerHTML = isExpanded
                    ? '<i class="bi bi-chevron-down"></i>'
                    : '<i class="bi bi-chevron-up"></i>';

                // Add or remove expanded class
                alertElement.classList.toggle('alert-expanded', !isExpanded);
            });

            // Make the whole alert clickable for better mobile UX
            alertElement.addEventListener('click', () => {
                expandBtn.click();
            });
        });

        // Show alerts container
        alertsContainer.style.display = 'block';
    } catch (error) {
        console.error('Error displaying alerts:', error);
        alertsContainer.style.display = 'none';
    }
}

//==============================================================================
// 5. HELPER FUNCTIONS
//==============================================================================

/**
 * Get icon path for a specific hazard type
 * @param {string} hazardType - The hazard type
 * @returns {string} - Path to the icon
 */
function getHazardIcon(hazardType) {
    const baseIconPath = './resources/meteocons/all/';

    switch (hazardType) {
        case 'tornado': return `${baseIconPath}tornado.svg`;
        case 'hail': return `${baseIconPath}hail.svg`;
        case 'flood': return `${baseIconPath}raindrops.svg`;
        case 'thunderstorm': return `${baseIconPath}thunderstorms-rain.svg`;
        case 'snow': return `${baseIconPath}snow.svg`;
        case 'ice': return `${baseIconPath}sleet.svg`;
        case 'wind': return `${baseIconPath}wind.svg`;
        case 'dust': return `${baseIconPath}dust.svg`;
        case 'smoke': return `${baseIconPath}smoke.svg`;
        case 'fog': return `${baseIconPath}fog.svg`;
        case 'heat': return `${baseIconPath}thermometer-warmer.svg`;
        case 'cold': return `${baseIconPath}thermometer-colder.svg`;
        case 'rain': return `${baseIconPath}rain.svg`;
        case 'special-weather': return `${baseIconPath}code-yellow.svg`;
        case 'hurricane': return `${baseIconPath}hurricane.svg`;
        default: return `${baseIconPath}not-available.svg`; // Fallback icon
    }
}

/**
 * Format alert text for better readability
 * @param {string} text - Alert text
 * @returns {string} - Formatted alert text with HTML
 */
function formatAlertText(text) {
    if (!text) return '';

    try {
        // Replace * with bullet points
        text = text.replace(/\*/g, '•');

        // Replace double line breaks with paragraph breaks
        text = text.replace(/\n\n/g, '</p><p>');

        // Replace single line breaks with line breaks
        text = text.replace(/\n/g, '<br>');

        // Wrap the text in paragraphs
        text = `<p>${text}</p>`;

        return text;
    } catch (error) {
        console.error('Error formatting alert text:', error);
        return text; // Return original text if formatting fails
    }
}

/**
 * Format date for display in alerts
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date string
 */
function formatDate(date) {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        return 'Unknown date';
    }

    try {
        return date.toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    } catch (error) {
        console.error('Error formatting date:', error);
        return date.toString();
    }
}

/**
 * Capitalize first letter of a string
 * @param {string} str - Input string
 * @returns {string} - String with first letter capitalized
 */
function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Add this helper function to your alertsDisplay.js file
 * 
 * @param {string} source - Source identifier
 * @returns {string} - Source display name
 */
function getSourceName(source) {
    const sourceNames = {
      'nws': 'National Weather Service',
    };
    
    return sourceNames[source] || source;
  }

// Make displayAlerts available globally
window.displayAlerts = displayAlerts;