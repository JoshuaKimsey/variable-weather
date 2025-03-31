/**
 * Nowcasting UI Component
 * Handles the display of short-term precipitation forecasts
 */

//==============================================================================
// 1. IMPORTS AND DOM ELEMENTS
//==============================================================================

import { loadComponentCSS } from '../../utils/cssLoader.js';
import { getDisplayUnits } from '../../utils/units.js';
import { PRECIP_INTENSITY } from '../../standardWeatherFormat.js';

//==============================================================================
// 2. PUBLIC FUNCTIONS
//==============================================================================

/**
 * Initialize the nowcast component
 */
export function initNowcast() {

    // No initialization needed at the moment
    // console.log('Nowcast component initialized');
}

/**
 * Display nowcast data in the UI
 * @param {Object} nowcastData - Nowcast data from the standardized weather data format
 */
export function displayNowcast(nowcastData) {
    loadComponentCSS('./styles/nowcast.css').catch(error => console.warn('Failed to load nowcast styles:', error));

    const nowcastContainer = document.getElementById('nowcast-container');

    if (!nowcastContainer) {
        console.error('Nowcast container not found in DOM');
        return;
    }

    // Always show the container
    nowcastContainer.style.display = 'block';
    
    // Remove any previous collapsed state
    nowcastContainer.classList.remove('nowcast-collapsed');

    // Get the nowcast elements
    const nowcastDescription = document.getElementById('nowcast-description');
    const nowcastChart = document.getElementById('nowcast-chart');
    const nowcastTimeline = document.getElementById('nowcast-timeline');

    // Handle case when no data is available
    if (!nowcastData || !nowcastData.data || nowcastData.data.length === 0) {
        if (nowcastDescription) {
            nowcastDescription.textContent = nowcastData?.description || 'No precipitation forecast available';
        }

        // Clear previous chart and timeline
        if (nowcastChart) {
            nowcastChart.innerHTML = '<div class="nowcast-no-data">No precipitation data available</div>';
        }

        if (nowcastTimeline) {
            nowcastTimeline.innerHTML = '';
        }

        // Set generic attribution
        updateNowcastAttribution(nowcastData);

        return;
    }

    // Check if there is actual precipitation data to render
    // IMPORTANT: Look for probability > 0, not just intensity > 0
    const hasPrecipData = nowcastData.data.some(point => point.precipProbability > 0.10);

    if (!hasPrecipData) {
        // No precipitation expected - use collapsed view
        renderCollapsedNowcast(nowcastData);
        return;
    }

    // Update the description
    if (nowcastDescription) {
        nowcastDescription.textContent = nowcastData.description || 'No precipitation expected';
    }

    // Clear previous chart and timeline
    if (nowcastChart) {
        nowcastChart.innerHTML = '';
    }

    if (nowcastTimeline) {
        nowcastTimeline.innerHTML = '';
    }

    // Build the chart and timeline with precipitation data
    renderNowcastChart(nowcastData, nowcastChart, nowcastTimeline);

    // Add data attribution
    updateNowcastAttribution(nowcastData);
}

//==============================================================================
// 3. PRIVATE FUNCTIONS
//==============================================================================

/**
 * Render an empty timeline with just time markers
 * @param {Object} nowcastData - Nowcast data
 * @param {HTMLElement} timelineElement - The timeline container
 */
function renderEmptyTimeline(nowcastData, timelineElement) {
    if (!nowcastData.data || nowcastData.data.length === 0 || !timelineElement) {
        return;
    }

    const data = nowcastData.data;
    const source = nowcastData.source;

    // Create the timeline
    const timeMarkers = document.createElement('div');
    timeMarkers.className = 'nowcast-time-markers';

    // Determine how many points to display based on data source
    // Show fewer markers to prevent crowding
    const skipFactor = source === 'pirate' ? 15 : 2; // Show fewer markers for pirate (1-min data)
    const totalMarkers = Math.min(5, Math.floor(data.length / skipFactor)); // Limit to max 5 markers

    // Calculate positions to spread markers evenly
    const positions = [];
    if (totalMarkers > 1) {
        for (let i = 0; i <= totalMarkers; i++) {
            positions.push(Math.floor(i * (data.length - 1) / totalMarkers));
        }
    } else {
        // If only one marker, show first and last
        positions.push(0);
        positions.push(data.length - 1);
    }

    // Add time markers at calculated positions
    positions.forEach((index) => {
        if (index < data.length) {
            const marker = document.createElement('div');
            marker.className = 'nowcast-time-marker';
            marker.setAttribute('data-index', index);
            marker.textContent = data[index].formattedTime;

            // Position marker relative to chart
            marker.style.left = `${(index / (data.length - 1)) * 100}%`;

            timeMarkers.appendChild(marker);
        }
    });

    // Add to DOM
    timelineElement.appendChild(timeMarkers);

    // Add the current time indicator
    addCurrentTimeIndicator(timelineElement.parentNode, data);
}

// Add this improved function to nowcast.js
function renderCollapsedNowcast(nowcastData) {
    const nowcastContainer = document.getElementById('nowcast-container');
    const nowcastDescription = document.getElementById('nowcast-description');
    const nowcastChart = document.getElementById('nowcast-chart');
    const nowcastTimeline = document.getElementById('nowcast-timeline');
    
    // Ensure container is visible and add collapsed class
    nowcastContainer.style.display = 'block';
    nowcastContainer.classList.add('nowcast-collapsed');
    
    // Clear previous content
    if (nowcastChart) nowcastChart.innerHTML = '';
    if (nowcastTimeline) nowcastTimeline.innerHTML = '';
    
    // Update the description
    if (nowcastDescription) {
        nowcastDescription.innerHTML = `
            <div class="nowcast-no-precip">
                <span>No precipitation expected in the near-future</span>
                <button id="nowcast-toggle-btn" class="nowcast-expand-btn" aria-label="Show details">
                    <i class="bi bi-chevron-down"></i>
                </button>
            </div>`;
        
        // Add event listener to toggle button using a better approach
        const toggleBtn = document.getElementById('nowcast-toggle-btn');
        if (toggleBtn) {
            // Remove any existing listeners (important for re-rendering)
            const newToggleBtn = toggleBtn.cloneNode(true);
            toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);
            
            // Add toggle functionality
            newToggleBtn.addEventListener('click', function toggleNowcast(e) {
                e.preventDefault();
                
                const isCollapsed = nowcastContainer.classList.contains('nowcast-collapsed');
                
                if (isCollapsed) {
                    // Expand
                    nowcastContainer.classList.remove('nowcast-collapsed');
                    // Render empty timeline only when expanding
                    if (nowcastTimeline.innerHTML === '') {
                        renderEmptyTimeline(nowcastData, nowcastTimeline);
                    }
                    this.innerHTML = '<i class="bi bi-chevron-up"></i>';
                    this.setAttribute('aria-label', 'Hide details');
                } else {
                    // Collapse
                    nowcastContainer.classList.add('nowcast-collapsed');
                    this.innerHTML = '<i class="bi bi-chevron-down"></i>';
                    this.setAttribute('aria-label', 'Show details');
                }
            });
        }
    }
    
    // Update attribution
    updateNowcastAttribution(nowcastData);
}

/**
 * Render the nowcast chart with special handling for probability-based bars
 * @param {Object} nowcastData - Nowcast data from the standardized weather data format
 * @param {HTMLElement} chartElement - The chart container element
 * @param {HTMLElement} timelineElement - The timeline container element
 */
function renderNowcastChart(nowcastData, chartElement, timelineElement) {
    if (!chartElement || !timelineElement || !nowcastData.data || nowcastData.data.length === 0) {
        return;
    }

    const data = nowcastData.data;
    const source = nowcastData.source;
    const interval = nowcastData.interval;

    // Create the chart
    const chartBars = document.createElement('div');
    chartBars.className = 'nowcast-chart-bars';

    // Create the timeline
    const timeMarkers = document.createElement('div');
    timeMarkers.className = 'nowcast-time-markers';

    // Determine how many time markers to show based on total duration
    // Show fewer markers to prevent crowding
    const totalMarkers = Math.min(5, data.length);

    // Calculate positions to spread markers evenly
    const positions = [];
    if (totalMarkers > 1) {
        for (let i = 0; i <= totalMarkers; i++) {
            positions.push(Math.floor(i * (data.length - 1) / totalMarkers));
        }
    } else {
        // If only one marker, show first and last
        positions.push(0);
        positions.push(data.length - 1);
    }

    // Add bars for each data point
    data.forEach((point, index) => {
        // Create a bar for each data point
        const bar = document.createElement('div');
        bar.className = 'nowcast-bar';

        // Add data-index attribute to each bar for reliable selection later
        bar.setAttribute('data-index', index);

        // Use precipitation probability to determine height
        // This ensures bars will display even if intensity is zero
        const heightPercent = calculateBarHeight(point.precipProbability);
        bar.style.height = `${heightPercent}%`;

        // Set color based on intensity and precipitation type
        // Default to light colors if there's probability but no intensity yet
        let color;
        if (point.precipIntensity <= 0 && point.precipProbability > 0.1) {
            // For probability-only cases (no intensity yet)
            color = point.precipType === 'snow' ?
                'rgba(225, 225, 251, 0.9)' :
                'rgba(197, 232, 255, 0.9)';
        } else {
            // For cases with both probability and intensity
            const colors = {
                'snow': {
                    [PRECIP_INTENSITY.NONE]: '#E1E1FB',
                    [PRECIP_INTENSITY.VERY_LIGHT]: '#E1E1FB',
                    [PRECIP_INTENSITY.LIGHT]: '#C5C6E8',
                    [PRECIP_INTENSITY.MODERATE]: '#9FA8DA',
                    [PRECIP_INTENSITY.HEAVY]: '#7986CB',
                    [PRECIP_INTENSITY.VIOLENT]: '#3F51B5'
                },
                'rain': {
                    [PRECIP_INTENSITY.NONE]: '#C5E8FF',
                    [PRECIP_INTENSITY.VERY_LIGHT]: '#C5E8FF',
                    [PRECIP_INTENSITY.LIGHT]: '#81D4FA',
                    [PRECIP_INTENSITY.MODERATE]: '#29B6F6',
                    [PRECIP_INTENSITY.HEAVY]: '#0288D1',
                    [PRECIP_INTENSITY.VIOLENT]: '#01579B'
                },
                'mix': {
                    [PRECIP_INTENSITY.NONE]: '#E0F2F7',
                    [PRECIP_INTENSITY.VERY_LIGHT]: '#E0F2F7',
                    [PRECIP_INTENSITY.LIGHT]: '#B2E5F8',
                    [PRECIP_INTENSITY.MODERATE]: '#8BC9F0',
                    [PRECIP_INTENSITY.HEAVY]: '#5E97F6',
                    [PRECIP_INTENSITY.VIOLENT]: '#3367D6'
                }
            };

            // Get the appropriate color map based on precipitation type
            const colorMap = colors[point.precipType] || colors['rain'];
            color = colorMap[point.intensityLabel] || colorMap[PRECIP_INTENSITY.NONE];
        }

        bar.style.backgroundColor = color;

        // Set opacity based on probability
        // For very low probability, make bars semi-transparent
        if (point.precipProbability < 0.2) {
            bar.style.opacity = 0.7;
        }

        // Add class based on precipitation type for additional styling
        if (point.precipType) {
            bar.classList.add(`precip-type-${point.precipType}`);
        }

        // Add tooltip with details including precipitation probability and intensity
        const probPercent = Math.round(point.precipProbability * 100);

        // Format the precipitation intensity based on current units
        const units = getDisplayUnits();
        let intensityDisplay = '';

        if (point.precipIntensity > 0) {
            if (units === 'metric') {
                // Display in mm/h for metric
                intensityDisplay = `, ${point.precipIntensity.toFixed(2)} mm/h`;
            } else {
                // Convert to inches/h for imperial
                const inchesPerHour = point.precipIntensity / 25.4;
                intensityDisplay = `, ${inchesPerHour.toFixed(2)} in/h`;
            }

            // Add precipitation type if available
            if (point.precipType && point.precipType !== 'none' && point.precipType !== 'rain') {
                intensityDisplay += ` (${point.precipType})`;
            }
        }

        const significantIndex = findMostSignificantPrecipitation(data);
        if (significantIndex !== -1) {
            // Use a small delay to ensure the DOM is ready
            setTimeout(() => {
                updateNowcastInfoPanel(data[significantIndex], significantIndex, true); // Pass true for isInitialSelection
            }, 100);
        }

        const tooltipText = `${point.formattedTime}: ${probPercent}% chance${intensityDisplay}`;
        bar.title = tooltipText;

        // Add click/tap event to show selected precipitation data
        bar.addEventListener('click', () => {
            updateNowcastInfoPanel(point, index);
        });

        // Add the hover events for desktop
        bar.addEventListener('mouseenter', () => {
            const marker = timelineElement.querySelector(`[data-index="${index}"]`);
            if (marker) marker.classList.add('active');
        });

        bar.addEventListener('mouseleave', () => {
            const marker = timelineElement.querySelector(`[data-index="${index}"]`);
            if (marker) marker.classList.remove('active');
        });

        // Add to chart
        chartBars.appendChild(bar);
    });

    // Add time markers at calculated positions
    positions.forEach((index) => {
        if (index < data.length) {
            const marker = document.createElement('div');
            marker.className = 'nowcast-time-marker';
            marker.setAttribute('data-index', index);
            marker.textContent = data[index].formattedTime;

            // Position marker relative to chart
            marker.style.left = `${(index / (data.length - 1)) * 100}%`;

            timeMarkers.appendChild(marker);
        }
    });

    // Add to DOM
    chartElement.appendChild(chartBars);
    timelineElement.appendChild(timeMarkers);

    // Add the current time indicator
    addCurrentTimeIndicator(chartElement, data);

    // Update the legend to include snow
    updatePrecipitationLegend(nowcastData);
}

/**
 * Update the nowcast info panel with data from the selected bar
 * @param {Object} point - The data point for the selected bar
 * @param {number} index - The index of the selected bar
 */
function updateNowcastInfoPanel(point, index, isInitialSelection = false) {
    const infoPanel = document.getElementById('nowcast-info-panel');
    if (!infoPanel) return;

    const selectedTime = infoPanel.querySelector('.nowcast-selected-time');
    const probabilityEl = infoPanel.querySelector('.nowcast-probability');
    const intensityEl = infoPanel.querySelector('.nowcast-intensity');
    const typeEl = infoPanel.querySelector('.nowcast-type');

    // Update the time with special messaging for initial selection
    if (isInitialSelection) {
        // For the automatic selection, show a more explanatory message
        if (point.precipIntensity > 0) {
            selectedTime.innerHTML = `<strong>Peak precipitation at ${point.formattedTime}</strong> <span class="tap-hint">(tap bars for details)</span>`;
        } else if (point.precipProbability > 0.2) {
            selectedTime.innerHTML = `<strong>Highest chance at ${point.formattedTime}</strong> <span class="tap-hint">(tap bars for details)</span>`;
        } else {
            selectedTime.innerHTML = `<strong>${point.formattedTime}</strong> <span class="tap-hint">(tap any bar for details)</span>`;
        }
    } else {
        // For user selections, just show the time
        selectedTime.textContent = point.formattedTime;
    }

    // Update probability
    const probPercent = Math.round(point.precipProbability * 100);
    probabilityEl.innerHTML = `<i class="bi bi-percent"></i> ${probPercent}% chance`;

    // Update intensity if available
    const units = getDisplayUnits();
    if (point.precipIntensity > 0) {
        let intensityText;
        if (units === 'metric') {
            intensityText = `${point.precipIntensity.toFixed(2)} mm/h`;
        } else {
            const inchesPerHour = point.precipIntensity / 25.4;
            intensityText = `${inchesPerHour.toFixed(2)} in/h`;
        }
        intensityEl.innerHTML = `<i class="bi bi-droplet-fill"></i> ${intensityText}`;
        intensityEl.style.display = 'flex';
    } else {
        intensityEl.style.display = 'none';
    }

    // Update precipitation type if available
    if (point.precipType && point.precipType !== 'none') {
        let typeIcon = 'bi-cloud-rain-fill';
        if (point.precipType === 'snow') {
            typeIcon = 'bi-snow';
        } else if (point.precipType === 'mix' || point.precipType === 'sleet') {
            typeIcon = 'bi-cloud-sleet-fill';
        }

        typeEl.innerHTML = `<i class="bi ${typeIcon}"></i> ${capitalizeFirst(point.precipType)}`;
        typeEl.style.display = 'flex';
    } else {
        typeEl.style.display = 'none';
    }

    // Fix: Improved bar selection
    // First, remove 'selected' class from all bars
    const allBars = document.querySelectorAll('.nowcast-bar');
    allBars.forEach(bar => bar.classList.remove('selected'));

    // Then find the correct bar using the data-index attribute
    const selectedBar = document.querySelector(`.nowcast-bar[data-index="${index}"]`);
    if (selectedBar) {
        selectedBar.classList.add('selected');
    }
}

/**
 * Find the index of the most significant precipitation in the nowcast data
 * @param {Array} data - Nowcast data points
 * @returns {number} - Index of the most significant point, or -1 if none
 */
function findMostSignificantPrecipitation(data) {
    // If there's no data, return -1
    if (!data || data.length === 0) {
        return -1;
    }
    
    // FIRST PRIORITY: Find the point with maximum precipitation intensity
    let maxIntensityIndex = -1;
    let maxIntensity = -1;
    
    for (let i = 0; i < data.length; i++) {
        // Check if this point has valid precipitation data
        if (data[i].precipIntensity > maxIntensity && data[i].precipProbability > 0.2) {
            maxIntensity = data[i].precipIntensity;
            maxIntensityIndex = i;
        }
    }
    
    // If we found a point with actual precipitation, use it
    if (maxIntensityIndex !== -1 && maxIntensity > 0) {
        // console.log(`Found peak precipitation at index ${maxIntensityIndex} with intensity ${maxIntensity}`);
        return maxIntensityIndex;
    }
    
    // SECOND PRIORITY: If no actual precipitation, find the point with highest probability
    let maxProbIndex = 0;
    let maxProb = 0;
    
    for (let i = 0; i < data.length; i++) {
        if (data[i].precipProbability > maxProb) {
            maxProb = data[i].precipProbability;
            maxProbIndex = i;
        }
    }
    
    // If we found a point with significant probability, use it
    if (maxProb > 0.1) {
        // console.log(`Found highest probability at index ${maxProbIndex} with probability ${maxProb}`);
        return maxProbIndex;
    }
    
    // FALLBACK: If nothing else, return the middle time point for a balanced display
    console.log("No significant precipitation found, using middle time point");
    return Math.floor(data.length / 2);
}

/**
 * Add a current time indicator to the chart
 * @param {HTMLElement} chartElement - The chart container element
 * @param {Array} data - Nowcast data points
 */
function addCurrentTimeIndicator(chartElement, data) {
    if (!chartElement || !data || data.length === 0) {
        return;
    }

    const now = new Date().getTime() / 1000;
    const startTime = data[0].time;
    const endTime = data[data.length - 1].time;
    const totalDuration = endTime - startTime;

    // If current time is within the forecast period
    if (now >= startTime && now <= endTime) {
        const indicator = document.createElement('div');
        indicator.className = 'nowcast-current-time';

        // Position indicator
        const positionPercent = ((now - startTime) / totalDuration) * 100;
        indicator.style.left = `${positionPercent}%`;

        chartElement.appendChild(indicator);
    }
}

/**
 * Calculate the height for a precipitation bar based on probability
 * @param {number} probability - Precipitation probability (0-1)
 * @returns {number} - Height as percentage (0-100)
 */
function calculateBarHeight(probability) {
    // No precipitation or very low probability
    if (probability <= 0.05) return 0; // Minimal height for visibility

    // Map probability directly to percentage height with a slight curve for better visualization
    // Use a power curve to emphasize differences in lower probabilities
    return 5 + (Math.pow(probability, 0.8) * 95);
}

function updatePrecipitationLegend(nowcastData) {
    // Find the legend container
    const legendContainer = document.querySelector('.nowcast-legend');
    if (!legendContainer) return;

    // Clear the existing legend
    legendContainer.innerHTML = '';

    // Check if we have any snow in the forecast
    const hasSnow = nowcastData.data.some(point => point.precipType === 'snow' && point.precipIntensity > 0);
    const hasMix = nowcastData.data.some(point =>
        (point.precipType === 'mix' || point.precipType === 'sleet') && point.precipIntensity > 0);

    // Always add the intensity legend items
    const intensityItems = [
        { label: 'Very Light', color: '#C5E8FF', type: 'rain' },
        { label: 'Light', color: '#81D4FA', type: 'rain' },
        { label: 'Moderate', color: '#29B6F6', type: 'rain' },
        { label: 'Heavy', color: '#0288D1', type: 'rain' }
    ];

    // If we have snow, add snow items
    if (hasSnow) {
        intensityItems.push(
            { label: 'Light Snow', color: '#C5C6E8', type: 'snow' },
            { label: 'Heavy Snow', color: '#7986CB', type: 'snow' }
        );
    }

    // If we have mixed precipitation, add that too
    if (hasMix) {
        intensityItems.push(
            { label: 'Mixed', color: '#8BC9F0', type: 'mix' }
        );
    }

    // Limit the number of legend items based on available space
    const maxItems = hasSnow || hasMix ? 4 : 5;
    const legendItems = intensityItems.slice(0, maxItems);

    // Add the legend items
    legendItems.forEach(item => {
        const legendItem = document.createElement('div');
        legendItem.className = 'nowcast-legend-item';

        const colorBox = document.createElement('div');
        colorBox.className = 'nowcast-legend-color';
        colorBox.style.backgroundColor = item.color;

        const label = document.createElement('span');
        label.textContent = item.label;

        legendItem.appendChild(colorBox);
        legendItem.appendChild(label);
        legendContainer.appendChild(legendItem);
    });
}

/**
 * Update the nowcast data attribution
 * @param {Object} nowcastData - Nowcast data with attribution information
 */
function updateNowcastAttribution(nowcastData) {
    // Find the nowcast section
    const nowcastSection = document.querySelector('.nowcast-section');
    if (!nowcastSection) return;
    
    // Find or create the attribution element
    let attributionElement = document.getElementById('nowcast-attribution');
    
    if (!attributionElement) {
        attributionElement = document.createElement('div');
        attributionElement.id = 'nowcast-attribution';
        attributionElement.className = 'nowcast-attribution';
        
        // Always append to the nowcast section (not inside any other elements)
        nowcastSection.appendChild(attributionElement);
    } else {
        // Ensure it's a direct child of nowcast-section for consistent positioning
        if (attributionElement.parentNode !== nowcastSection) {
            nowcastSection.appendChild(attributionElement);
        }
    }
    
    // Handle different data formats for backward compatibility
    let source = '';
    let attribution = null;
    
    if (typeof nowcastData === 'string') {
        // Old format: just the source string
        source = nowcastData;
    } else if (nowcastData && typeof nowcastData === 'object') {
        // New format: full object with attribution
        source = nowcastData.source;
        attribution = nowcastData.attribution;
    }
    
    // Use the attribution object if available
    if (attribution && attribution.name) {
        let attributionText = `Precipitation nowcasting provided by <a href="${attribution.url}" target="_blank" class="attribution-link">${attribution.name}</a>`;
        
        if (attribution.license) {
            attributionText += ` (${attribution.license})`;
        }
        
        attributionElement.innerHTML = attributionText;
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
