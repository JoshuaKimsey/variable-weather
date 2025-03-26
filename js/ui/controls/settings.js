/**
 * API Settings functionality with tab interface
 * 
 * This module handles all settings UI operations and makes no assumptions 
 * about specific providers. All provider information is retrieved from 
 * the API registry.
 */

// Import API registry functions from api.js
import {
    getAvailableRegions,
    getRegionDisplayName,
    hasRegionSpecificProviders,
    getProvidersByRegion,
    getProviderById,
    getAllProviders,
    getNowcastProviders
} from '../../api.js';

// DOM elements
let apiSettingsModal, apiSettingsBackdrop, openSettingsBtn;
let saveApiKeyBtn, removeApiKeyBtn, apiKeyStatus;
let imperialUnitsRadio, metricUnitsRadio;
let settingsTabButtons, settingsTabContents;
let isSettingsModalOpen = false;

// New DOM elements for dynamic API key handling
let apiKeysSection, noApiKeysNeeded;
let dataSourcesContainer;

// Local storage keys
const UNITS_STORAGE = 'weather_app_units';
const ACTIVE_SETTINGS_TAB = 'weather_app_settings_tab';
const GLOBAL_PROVIDER_STORAGE = 'weather_app_weather_provider';
const NOWCAST_SOURCE_STORAGE = 'weather_app_nowcast_source';

/**
 * Initialize API settings functionality
 */
export function initApiSettings() {
    // Your existing element references
    apiSettingsModal = document.getElementById('api-settings-modal');
    apiSettingsBackdrop = document.getElementById('api-settings-backdrop');
    openSettingsBtn = document.getElementById('open-settings');

    // API key fields
    saveApiKeyBtn = document.getElementById('save-api-key');
    removeApiKeyBtn = document.getElementById('remove-api-key');
    apiKeyStatus = document.getElementById('api-key-status');

    // New API key section elements
    apiKeysSection = document.getElementById('api-keys-section');
    noApiKeysNeeded = document.getElementById('no-api-keys-needed');

    // Data sources container
    dataSourcesContainer = document.getElementById('data-sources-container');

    // Unit settings
    imperialUnitsRadio = document.getElementById('imperial-units');
    metricUnitsRadio = document.getElementById('metric-units');

    // Get tab elements
    settingsTabButtons = document.querySelectorAll('.settings-tab-btn');
    settingsTabContents = document.querySelectorAll('.settings-tab-content');

    // Set up main event listeners
    openSettingsBtn.addEventListener('click', openApiSettings);
    apiSettingsBackdrop.addEventListener('click', closeApiSettings);

    // API key buttons
    saveApiKeyBtn.addEventListener('click', saveAllApiKeys);
    removeApiKeyBtn.addEventListener('click', removeAllApiKeys);

    // Unit settings
    imperialUnitsRadio.addEventListener('change', updateUnits);
    metricUnitsRadio.addEventListener('change', updateUnits);

    // Tab event listeners
    settingsTabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            switchTab(tabName);
        });
    });

    // Initialize history API listener
    initHistoryListener();

    // Load saved units
    loadSavedUnits();
}

/**
 * Initialize data sources section with dynamic region-specific dropdowns
 */
function initDataSourcesSection() {
    if (!dataSourcesContainer) return;

    // Clear the existing content
    dataSourcesContainer.innerHTML = '';

    // Always add the global weather source dropdown
    const globalSection = createProviderSection(
        'Global Weather:',
        'weather-provider',
        'global',
        'Select your preferred source for global weather data'
    );
    dataSourcesContainer.appendChild(globalSection);

    // Add region-specific dropdowns for any regions with dedicated providers
    const regions = getAvailableRegions();

    regions.forEach(region => {
        // Skip 'global' as we already have that dropdown
        if (region === 'global') return;

        // Only create region dropdowns if there are providers specifically for this region
        if (hasRegionSpecificProviders(region)) {
            const regionName = getRegionDisplayName(region);
            const regionId = `${region.toLowerCase()}-weather-provider`;

            const regionSection = createProviderSection(
                `${regionName} Weather:`,
                regionId,
                region,
                `Select your preferred source for ${regionName} locations`
            );

            dataSourcesContainer.appendChild(regionSection);

            // Initialize the region dropdown with saved values
            initRegionDropdown(region, regionId);
        }
    });

    // Add precipitation forecast dropdown if nowcast providers exist
    const nowcastProviders = getNowcastProviders();
    if (nowcastProviders && nowcastProviders.length > 0) {
        const nowcastSection = createProviderSection(
            'Precipitation Forecast:',
            'nowcast-source',
            'nowcast',
            'Select your preferred source for short-term precipitation forecasts'
        );
        dataSourcesContainer.appendChild(nowcastSection);
    }

    // Update API key section
    updateApiKeySection();
}

/**
 * Create a provider dropdown section
 * @param {string} labelText - Text for the label
 * @param {string} selectId - ID for the select element
 * @param {string} region - Region code this dropdown is for
 * @param {string} helpText - Help text to display
 * @returns {HTMLElement} The created section element
 */
function createProviderSection(labelText, selectId, region, helpText) {
    // Create main container
    const section = document.createElement('div');
    section.className = 'settings-section-item';

    // Create label
    const label = document.createElement('label');
    label.className = 'settings-label';
    label.setAttribute('for', selectId);
    label.textContent = labelText;

    // Create select element
    const select = document.createElement('select');
    select.id = selectId;
    select.className = 'settings-select';

    // Populate select options based on region
    populateProviderOptions(select, region);

    // Create help text
    const helpDiv = document.createElement('div');
    helpDiv.className = 'settings-help-text';
    helpDiv.textContent = helpText;

    // Add note about immediate application
    const noteSpan = document.createElement('span');
    noteSpan.className = 'settings-note';
    noteSpan.textContent = 'Note: Changing this setting will apply immediately.';
    helpDiv.appendChild(document.createElement('br'));
    helpDiv.appendChild(noteSpan);

    // Assemble the section
    section.appendChild(label);
    section.appendChild(select);
    section.appendChild(helpDiv);

    return section;
}

/**
 * Populate a select dropdown with providers for a specific region
 * @param {HTMLSelectElement} selectElement - The select element to populate
 * @param {string} region - Region code to get providers for
 */
function populateProviderOptions(selectElement, region) {
    // Clear existing options
    selectElement.innerHTML = '';

    // Add "Automatic" option for all dropdowns
    const automaticOption = document.createElement('option');
    automaticOption.value = 'automatic';

    if (region === 'global') {
        automaticOption.textContent = 'Automatic';

        // Try to find the default provider (typically Open-Meteo)
        const defaultProvider = getProviderById('open-meteo');
        if (defaultProvider) {
            automaticOption.textContent = `Automatic (${defaultProvider.name})`;
        }
    } else if (region === 'nowcast') {
        // For nowcast, find the default provider
        const defaultProvider = getProviderById('open-meteo');
        if (defaultProvider) {
            automaticOption.textContent = defaultProvider.name;
        } else {
            automaticOption.textContent = 'Default';
        }
    } else {
        automaticOption.textContent = 'Same as Global Setting';
    }

    selectElement.appendChild(automaticOption);

    // Get providers for this region or nowcast providers
    let providers = [];
    if (region === 'nowcast') {
        providers = getNowcastProviders();
    } else {
        providers = getProvidersByRegion(region);
    }

    // Add options for each provider
    providers.forEach(provider => {
        // Skip the provider if it's the same as the automatic option for nowcast
        if (region === 'nowcast' && provider.id === 'open-meteo' && automaticOption.textContent.includes('Open-Meteo')) {
            return;
        }

        const option = document.createElement('option');
        option.value = provider.id;

        let displayText = provider.name;

        // Check if the provider requires an API key
        if (provider.requiresApiKey) {
            // Use the provider's hasApiKey method if available
            const hasKey = typeof provider.hasApiKey === 'function' ?
                provider.hasApiKey() :
                !!localStorage.getItem(provider.apiKeyConfig?.storageKey || `weather_app_${provider.id}_api_key`);

            // Show additional info based on API key status
            if (!hasKey) {
                displayText += ' (requires API key)';
            }
        }

        // Add feature info for nowcast providers
        if (region === 'nowcast') {
            // Add timing info if provided in the metadata
            if (provider.nowcastInterval) {
                displayText += ` (${provider.nowcastInterval}-minute intervals)`;
            } else {
                // Default for other providers
                displayText += ' (forecast)';
            }
        }

        option.textContent = displayText;
        selectElement.appendChild(option);
    });

    // Add event listener based on select element ID
    if (selectElement.id === 'nowcast-source') {
        selectElement.addEventListener('change', updateNowcastSource);
    } else if (selectElement.id === 'weather-provider') {
        selectElement.addEventListener('change', updateWeatherProvider);
    } else if (selectElement.id.endsWith('-weather-provider')) {
        // For region-specific providers
        const region = selectElement.id.replace('-weather-provider', '');
        selectElement.addEventListener('change', () => {
            updateRegionWeatherProvider(region);
        });
    }

    // Set initial value from localStorage
    try {
        if (selectElement.id === 'weather-provider') {
            const savedValue = localStorage.getItem(GLOBAL_PROVIDER_STORAGE) || 'automatic';
            selectElement.value = savedValue;
        } else if (selectElement.id === 'nowcast-source') {
            const savedValue = localStorage.getItem(NOWCAST_SOURCE_STORAGE) || 'open-meteo';
            selectElement.value = savedValue;
        }
    } catch (error) {
        console.warn('Error setting initial dropdown value:', error);
    }
}

/**
 * Initialize a region-specific dropdown with saved settings
 * @param {string} region - Region code
 * @param {string} selectId - ID of the select element
 */
function initRegionDropdown(region, selectId) {
    const selectElement = document.getElementById(selectId);
    if (!selectElement) return;

    // Get saved value or default to automatic
    const storageKey = `weather_app_${region}_weather_provider`;
    const savedValue = localStorage.getItem(storageKey) || 'automatic';

    // Set the saved value
    try {
        selectElement.value = savedValue;
    } catch (e) {
        console.warn(`Could not set value ${savedValue} for ${region} dropdown`);
    }
}

/**
 * Event handler for selecting a region-specific provider
 * Add this to settings.js to help debug problems with settings storage
 */
function updateRegionWeatherProvider(region) {
    const selectId = `${region}-weather-provider`;
    const selectElement = document.getElementById(selectId);
    if (!selectElement) {
        console.error(`Select element not found for region: ${region}`);
        return;
    }
    
    const provider = selectElement.value;
    const storageKey = `weather_app_${region}_weather_provider`;
    
    console.log(`Setting ${storageKey} to ${provider}`);
    
    // Save to local storage
    localStorage.setItem(storageKey, provider);
    
    // Log all region provider settings for debugging
    const regionKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('weather_app') && key.includes('provider')) {
            regionKeys.push({
                key: key,
                value: localStorage.getItem(key)
            });
        }
    }
    console.log('Updated provider settings:', regionKeys);
    
    // Show status message
    let statusMessage = '';
    if (provider === 'automatic') {
        statusMessage = `${getRegionDisplayName(region)} weather source set to Same as Global Setting`;
    } else {
        const providerObj = getProviderById(provider);
        if (providerObj) {
            statusMessage = `${getRegionDisplayName(region)} weather source set to ${providerObj.name}`;
        }
    }
    
    showApiKeyStatus(statusMessage, 'status-success');
    
    // Update API key section
    updateApiKeySection();
    
    // Refresh weather data
    refreshWeatherData();
}

/**
 * Update API key section based on current provider selections
 */
function updateApiKeySection() {
    // Collect all selected providers
    const selectedProviders = new Set();

    // Add global provider if not automatic
    const globalProviderElement = document.getElementById('weather-provider');
    if (globalProviderElement && globalProviderElement.value !== 'automatic') {
        selectedProviders.add(globalProviderElement.value);
    }

    // Add region-specific providers
    const regions = getAvailableRegions();
    regions.forEach(region => {
        if (region === 'global') return;

        const selectId = `${region}-weather-provider`;
        const selectElement = document.getElementById(selectId);
        if (selectElement && selectElement.value !== 'automatic') {
            selectedProviders.add(selectElement.value);
        }
    });

    // Add nowcast provider
    const nowcastElement = document.getElementById('nowcast-source');
    if (nowcastElement && nowcastElement.value !== 'automatic') {
        selectedProviders.add(nowcastElement.value);
    }

    // Get a set of all providers that need API keys
    const providersNeedingKeys = new Set();

    // Check which selected providers need API keys
    selectedProviders.forEach(providerId => {
        const provider = getProviderById(providerId);
        if (provider && provider.requiresApiKey) {
            providersNeedingKeys.add(providerId);
        }
    });

    // If no providers need keys, hide the section
    if (providersNeedingKeys.size === 0) {
        if (apiKeysSection) {
            apiKeysSection.style.display = 'none';
        }
        return;
    }

    // Show the API keys section
    if (apiKeysSection) {
        apiKeysSection.style.display = 'block';
    }

    // Clear existing API key containers
    const apiKeysContainer = document.querySelector('.api-keys-container');
    if (!apiKeysContainer) return;

    const existingContainers = apiKeysContainer.querySelectorAll('.api-key-container');
    existingContainers.forEach(container => {
        if (container.id !== 'no-api-keys-needed') {
            container.remove();
        }
    });

    // Hide the "no keys needed" message
    if (noApiKeysNeeded) {
        noApiKeysNeeded.style.display = 'none';
    }

    // Create API key inputs for each provider that needs a key
    providersNeedingKeys.forEach(providerId => {
        const provider = getProviderById(providerId);
        if (!provider) return;

        // Create API key container
        const container = document.createElement('div');
        container.id = `${providerId}-api-key-container`;
        container.className = 'api-key-container';

        // Create label
        const label = document.createElement('label');
        label.className = 'settings-label';
        label.setAttribute('for', `${providerId}-api-key`);
        label.textContent = `${provider.name} API Key:`;

        // Create form group
        const formGroup = document.createElement('div');
        formGroup.className = 'settings-form-group';

        // Create input
        const input = document.createElement('input');
        input.type = 'text';
        input.id = `${providerId}-api-key`;
        input.placeholder = `Enter your ${provider.name} API key`;

        // Get storage key from provider's apiKeyConfig or use default
        const storageKey = provider.apiKeyConfig?.storageKey || `weather_app_${providerId}_api_key`;

        // Set value if available
        const savedKey = localStorage.getItem(storageKey);
        if (savedKey) {
            input.value = savedKey;
        }

        // Create API key info
        const apiKeyInfo = document.createElement('div');
        apiKeyInfo.className = 'api-key-info';

        // Add "Get a free key" link if URL is available
        if (provider.apiKeyUrl) {
            const link = document.createElement('a');
            link.href = provider.apiKeyUrl;
            link.target = '_blank';
            link.className = 'settings-link';
            link.textContent = 'Get a free key';
            apiKeyInfo.appendChild(link);
        }

        // Assemble form group
        formGroup.appendChild(input);
        formGroup.appendChild(apiKeyInfo);

        // Assemble container
        container.appendChild(label);
        container.appendChild(formGroup);

        // Add to API keys container
        apiKeysContainer.appendChild(container);
    });

    // Check if any provider has a saved key
    let hasAnyKey = false;
    providersNeedingKeys.forEach(providerId => {
        const provider = getProviderById(providerId);
        if (!provider) return;

        // Get storage key from provider's apiKeyConfig or use default
        const storageKey = provider.apiKeyConfig?.storageKey || `weather_app_${providerId}_api_key`;

        if (localStorage.getItem(storageKey)) {
            hasAnyKey = true;
        }
    });

    // Show/hide remove button
    if (removeApiKeyBtn) {
        removeApiKeyBtn.style.display = hasAnyKey ? 'block' : 'none';
    }

    // Update save button text
    if (saveApiKeyBtn) {
        saveApiKeyBtn.textContent = hasAnyKey ? 'Update Keys' : 'Save Keys';
    }
}

/**
 * Save all API keys to local storage
 */
function saveAllApiKeys() {
    let allKeysValid = true;
    let saveCount = 0;

    // Go through all visible API key inputs
    const apiKeyInputs = document.querySelectorAll('input[id$="-api-key"]');

    apiKeyInputs.forEach(input => {
        const key = input.value.trim();
        if (!key) return; // Skip empty inputs

        // Get provider ID from input ID
        const providerId = input.id.split('-api-key')[0];
        const provider = getProviderById(providerId);

        if (!provider) {
            console.warn(`Provider not found: ${providerId}`);
            return;
        }

        // Get key config from provider if available
        const keyConfig = provider.apiKeyConfig || {};

        // Basic validation
        let isValid = true;

        // Use provider's validator if available
        if (keyConfig.validator && typeof keyConfig.validator === 'function') {
            isValid = keyConfig.validator(key);
        } else {
            // Basic length check if no validator is available
            isValid = key.length >= 8;
        }

        if (!isValid) {
            showApiKeyStatus(`Invalid ${provider.name} API key format`, 'status-error');
            allKeysValid = false;
            return;
        }

        // Get storage key from provider's apiKeyConfig or use default
        const storageKey = keyConfig.storageKey || `weather_app_${providerId}_api_key`;

        // Save to local storage
        localStorage.setItem(storageKey, key);
        saveCount++;

        // Call provider's updateFn if provided
        if (keyConfig.updateFn) {
            // Check if it's a function reference or a string
            if (typeof keyConfig.updateFn === 'function') {
                keyConfig.updateFn(key);
            } else if (typeof keyConfig.updateFn === 'string' && typeof window[keyConfig.updateFn] === 'function') {
                window[keyConfig.updateFn](key);
            }
        }
    });

    if (!allKeysValid) return;

    if (saveCount === 0) {
        showApiKeyStatus('No API keys entered', 'status-error');
        return;
    }

    // Update UI
    showApiKeyStatus('API key(s) saved successfully!', 'status-success');

    // Reinitialize the data sources section with updated options
    initDataSourcesSection();

    // Refresh weather data
    refreshWeatherData();
}

/**
 * Remove all API keys from local storage
 */
function removeAllApiKeys() {
    // Find all API key inputs
    const apiKeyInputs = document.querySelectorAll('input[id$="-api-key"]');

    apiKeyInputs.forEach(input => {
        // Get provider ID from input ID
        const providerId = input.id.split('-api-key')[0];
        const provider = getProviderById(providerId);

        if (!provider) {
            console.warn(`Provider not found: ${providerId}`);
            return;
        }

        // Get key config from provider if available
        const keyConfig = provider.apiKeyConfig || {};

        // Get storage key from provider's apiKeyConfig or use default
        const storageKey = keyConfig.storageKey || `weather_app_${providerId}_api_key`;

        // Clear from localStorage
        localStorage.removeItem(storageKey);

        // Clear input
        input.value = '';

        // Call provider's resetFn if provided
        if (keyConfig.resetFn) {
            // Check if it's a function reference or a string
            if (typeof keyConfig.resetFn === 'function') {
                keyConfig.resetFn();
            } else if (typeof keyConfig.resetFn === 'string' && typeof window[keyConfig.resetFn] === 'function') {
                window[keyConfig.resetFn]();
            }
        }
    });

    showApiKeyStatus('All API keys removed', 'status-success');

    // Reset provider selections that require API keys
    resetProvidersRequiringKeys();

    // Reinitialize the data sources section with updated options
    initDataSourcesSection();
}

/**
 * Reset any provider selections that require API keys
 */
function resetProvidersRequiringKeys() {
    // Reset global provider if it requires an API key
    const globalProvider = localStorage.getItem(GLOBAL_PROVIDER_STORAGE);
    const globalProviderObj = getProviderById(globalProvider);

    if (globalProviderObj && globalProviderObj.requiresApiKey) {
        localStorage.setItem(GLOBAL_PROVIDER_STORAGE, 'automatic');
        const weatherProviderSelect = document.getElementById('weather-provider');
        if (weatherProviderSelect) {
            weatherProviderSelect.value = 'automatic';
        }
        showApiKeyStatus('Global weather source reset to Automatic', 'status-info');
    }

    // Reset region-specific providers if they require API keys
    const regions = getAvailableRegions();
    regions.forEach(region => {
        if (region === 'global') return;

        const storageKey = `weather_app_${region}_weather_provider`;
        const provider = localStorage.getItem(storageKey);
        const providerObj = getProviderById(provider);

        if (providerObj && providerObj.requiresApiKey) {
            localStorage.setItem(storageKey, 'automatic');
            const selectElement = document.getElementById(`${region}-weather-provider`);
            if (selectElement) {
                selectElement.value = 'automatic';
            }
            showApiKeyStatus(`${getRegionDisplayName(region)} weather source reset to Same as Global Setting`, 'status-info');
        }
    });

    // Reset nowcast source if it requires an API key
    const nowcastSource = localStorage.getItem(NOWCAST_SOURCE_STORAGE);
    const nowcastProviderObj = getProviderById(nowcastSource);

    if (nowcastProviderObj && nowcastProviderObj.requiresApiKey) {
        // Find the first nowcast provider that doesn't require an API key
        const nowcastProviders = getNowcastProviders();
        const defaultProvider = nowcastProviders.find(p => !p.requiresApiKey) || { id: 'open-meteo' };

        localStorage.setItem(NOWCAST_SOURCE_STORAGE, defaultProvider.id);
        const nowcastSourceSelect = document.getElementById('nowcast-source');
        if (nowcastSourceSelect) {
            nowcastSourceSelect.value = defaultProvider.id;
        }
        showApiKeyStatus(`Precipitation forecast source reset to ${defaultProvider.name || defaultProvider.id}`, 'status-info');
    }
}

/**
 * Update nowcast source based on user selection
 */
function updateNowcastSource() {
    const nowcastSourceSelect = document.getElementById('nowcast-source');
    if (!nowcastSourceSelect) return;

    const source = nowcastSourceSelect.value;
    localStorage.setItem(NOWCAST_SOURCE_STORAGE, source);

    // Show status message
    const provider = getProviderById(source);
    const statusMessage = provider ?
        `Precipitation forecast changed to ${provider.name}` :
        `Precipitation forecast changed to ${source}`;

    showApiKeyStatus(statusMessage, 'status-success');

    // Always update the API key section when source changes
    updateApiKeySection();

    // Check if selected provider requires API key and if we have it
    if (provider) {
        const requiresKey = provider.requiresApiKey;
        const hasKey = requiresKey ?
            (typeof provider.hasApiKey === 'function' ? provider.hasApiKey() : false) :
            true;

        if (!requiresKey || hasKey) {
            // Refresh weather data
            refreshWeatherData();
        } else {
            // Prompt for API key
            showApiKeyStatus(`Please enter a ${provider.name} API key and click Save`, 'status-info');
        }
    } else {
        // Unknown provider, just refresh
        refreshWeatherData();
    }
}

/**
 * Update weather provider based on user selection
 */
function updateWeatherProvider() {
    const weatherProviderSelect = document.getElementById('weather-provider');
    if (!weatherProviderSelect) return;

    const provider = weatherProviderSelect.value;
    localStorage.setItem(GLOBAL_PROVIDER_STORAGE, provider);

    // Show status message
    let statusMessage = '';
    if (provider === 'automatic') {
        // Find the default provider that's used for automatic
        const defaultProvider = getProviderById('open-meteo');
        statusMessage = defaultProvider ?
            `Global weather source set to Automatic (${defaultProvider.name})` :
            'Global weather source set to Automatic';
    } else {
        const providerObj = getProviderById(provider);
        statusMessage = providerObj ?
            `Global weather source set to ${providerObj.name}` :
            `Global weather source set to ${provider}`;
    }

    showApiKeyStatus(statusMessage, 'status-success');

    // Always update the API key section when provider changes
    updateApiKeySection();

    // Check if selected provider requires API key and if we have it
    const providerObj = getProviderById(provider);
    if (providerObj) {
        const requiresKey = providerObj.requiresApiKey;
        const hasKey = requiresKey ?
            (typeof providerObj.hasApiKey === 'function' ? providerObj.hasApiKey() : false) :
            true;

        if (!requiresKey || hasKey) {
            // Refresh weather data
            refreshWeatherData();
        } else {
            // Prompt for API key
            showApiKeyStatus(`Please enter a ${providerObj.name} API key and click Save`, 'status-info');
        }
    } else if (provider === 'automatic') {
        // Automatic selection, just refresh
        refreshWeatherData();
    }
}

/**
 * Get the selected nowcast source
 * @returns {string} - Provider ID or 'automatic'
 */
export function getNowcastSource() {
    const storedProvider = localStorage.getItem(NOWCAST_SOURCE_STORAGE) || 'automatic';
    
    // When set to automatic, resolve to open-meteo
    if (storedProvider === 'automatic') {
        // console.log('Nowcast source set to automatic, using Open-Meteo');
        return 'open-meteo';
    }
    
    return storedProvider;
}

/**
 * Get the selected weather provider
 * @returns {string} - Provider ID or 'automatic'
 */
export function getWeatherProvider() {
    return localStorage.getItem(GLOBAL_PROVIDER_STORAGE) || 'automatic';
}

/**
 * Get the selected provider for a specific region
 * @param {string} region - Region code
 * @returns {string} - Provider ID or 'automatic'
 */
export function getRegionWeatherProvider(region) {
    const storageKey = `weather_app_${region}_weather_provider`;
    return localStorage.getItem(storageKey) || 'automatic';
}

/**
 * Update units based on user selection
 */
function updateUnits() {
    const units = document.querySelector('input[name="unit"]:checked')?.value || 'imperial';
    localStorage.setItem(UNITS_STORAGE, units);

    // Update the app to use the new units
    if (typeof window.setDisplayUnits === 'function') {
        window.setDisplayUnits(units);
    }

    // If weather data is currently displayed, refresh it to show the new units
    if (document.getElementById('weather-data').style.display !== 'none') {
        refreshWeatherDisplay();
    }

    showApiKeyStatus(`Units changed to ${units === 'metric' ? 'Metric (°C)' : 'Imperial (°F)'}`, 'status-success');
}

/**
 * Refresh the weather display with new units
 */
function refreshWeatherDisplay() {
    // Call the global refresh function defined in units.js
    if (typeof window.refreshWeatherWithCurrentUnits === 'function') {
        window.refreshWeatherWithCurrentUnits();
    }
}

/**
 * Trigger a full weather data refresh using current location
 */
function refreshWeatherData() {
    const urlParams = new URLSearchParams(window.location.search);
    const lat = urlParams.get('lat');
    const lon = urlParams.get('lon');
    const locationName = urlParams.get('location');

    // Only proceed if we have coordinates
    if (lat && lon) {
        // First, close the settings modal
        closeApiSettings();

        // Show loading indicator to give user feedback
        if (typeof window.showLoading === 'function') {
            window.showLoading();
        }

        // Check if the main fetchWeather function is available
        if (typeof window.fetchWeather === 'function') {
            // Call the main fetchWeather function to reload with new settings
            window.fetchWeather(lat, lon, locationName);
        } else {
            console.error('fetchWeather function not available for auto-refresh');

            // Fallback to manual refresh if we can't auto-refresh
            showApiKeyStatus('Please refresh the page to see changes', 'status-info');
        }
    } else {
        // If we don't have coordinates, prompt the user
        showApiKeyStatus('Please search for a location to see changes', 'status-info');
    }
}

/**
 * Load saved units preference from local storage
 */
function loadSavedUnits() {
    const savedUnits = localStorage.getItem(UNITS_STORAGE) || 'imperial';

    if (imperialUnitsRadio && metricUnitsRadio) {
        if (savedUnits === 'metric') {
            metricUnitsRadio.checked = true;
        } else {
            imperialUnitsRadio.checked = true;
        }
    }

    // Only set the units if the function is available
    // This ensures we don't try to call a function that hasn't been defined yet
    if (typeof window.setDisplayUnits === 'function') {
        window.setDisplayUnits(savedUnits);
    }
}

/**
 * Switch between settings tabs
 * @param {string} tabName - The name of the tab to switch to
 */
function switchTab(tabName) {
    // Update active tab button
    settingsTabButtons.forEach(button => {
        if (button.getAttribute('data-tab') === tabName) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });

    // Update active tab content
    settingsTabContents.forEach(content => {
        if (content.id === `tab-${tabName}`) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });

    // Store the active tab in local storage
    localStorage.setItem(ACTIVE_SETTINGS_TAB, tabName);
}

/**
 * Open the API settings modal with History API integration
 */
function openApiSettings() {
    if (!apiSettingsModal) return;

    apiSettingsModal.style.display = 'block';
    if (apiSettingsBackdrop) {
        apiSettingsBackdrop.style.display = 'block';
    }

    // Update back button visibility based on current screen width
    updateBackButtonVisibility();

    // Get current state information
    const currentState = history.state || {};

    // Check if settings modal is already in state to avoid duplicate entries
    if (!currentState.settingsOpen) {
        // Add state to browser history without changing the URL
        history.pushState(
            { ...currentState, settingsOpen: true },
            document.title,
            window.location.href
        );
    }

    isSettingsModalOpen = true;

    // Initialize data sources section when modal opens
    initDataSourcesSection();

    // Restore the last active tab
    const lastActiveTab = localStorage.getItem(ACTIVE_SETTINGS_TAB) || 'display';
    switchTab(lastActiveTab);

    // Reset any status messages
    if (apiKeyStatus) {
        apiKeyStatus.innerHTML = '';
        apiKeyStatus.className = '';
    }
}

/**
 * Close the API settings modal with History API integration
 */
function closeApiSettings() {
    if (!apiSettingsModal) return;

    apiSettingsModal.style.display = 'none';
    if (apiSettingsBackdrop) {
        apiSettingsBackdrop.style.display = 'none';
    }

    if (apiKeyStatus) {
        apiKeyStatus.innerHTML = '';
        apiKeyStatus.className = '';
    }

    isSettingsModalOpen = false;

    // Only pop state if we're closing programmatically (not from a browser back action)
    if (history.state && history.state.settingsOpen && !isHandlingPopState) {
        history.back();
    }
}

/**
 * Initialize settings back button
 */
function initSettingsBackButton() {
    const backButton = document.getElementById('settings-back-button');
    if (!backButton) return;
    
    // Add click event to call closeApiSettings
    backButton.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        closeApiSettings();
    });
    
    // Update visibility based on screen size (for initial load)
    updateBackButtonVisibility();
    
    // Listen for resize events to update visibility
    window.addEventListener('resize', updateBackButtonVisibility);
}

/**
 * Update back button visibility based on screen width
 */
function updateBackButtonVisibility() {
    const backButton = document.getElementById('settings-back-button');
    if (backButton) {
        backButton.style.display = window.innerWidth <= 480 ? 'flex' : 'none';
    }
}

// Initialize the back button when DOM is loaded 
if (document.readyState === 'complete') {
    initSettingsBackButton();
} else {
    document.addEventListener('DOMContentLoaded', initSettingsBackButton);
}

/**
 * Display status message for API key operations
 */
function showApiKeyStatus(message, className) {
    if (!apiKeyStatus) return;

    apiKeyStatus.textContent = message;
    apiKeyStatus.className = className;

    // Clear status after a delay
    setTimeout(() => {
        if (apiKeyStatus) {
            apiKeyStatus.className = '';
        }
    }, 3000);
}

// Flag to prevent recursion in popstate handling
let isHandlingPopState = false;

/**
 * Handle browser back button and swipe gestures
 */
function initHistoryListener() {
    // Listen for back button and swipe navigation
    window.addEventListener('popstate', (event) => {
        isHandlingPopState = true;

        try {
            // Check if settings modal was open
            if (isSettingsModalOpen) {
                // Close the settings modal
                if (apiSettingsModal) {
                    apiSettingsModal.style.display = 'none';
                }

                if (apiSettingsBackdrop) {
                    apiSettingsBackdrop.style.display = 'none';
                }

                if (apiKeyStatus) {
                    apiKeyStatus.innerHTML = '';
                    apiKeyStatus.className = '';
                }

                isSettingsModalOpen = false;
            }

            // Additional handling for when both modals might be open
            // If the history state indicates the modal radar was open, but settings was the last one closed
            if (event.state && event.state.radarModalOpen && !event.state.settingsOpen) {
                // We leave the radar modal open since it was opened first
                console.log('Back to radar modal');
            }
        } finally {
            isHandlingPopState = false;
        }
    });
}