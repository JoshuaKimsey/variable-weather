/**
 * API Settings functionality for managing API keys and units
 */

// DOM elements
let apiSettingsModal, apiSettingsBackdrop, openSettingsBtn, closeSettingsBtn;
let pirateApiKeyInput, saveApiKeyBtn, removeApiKeyBtn, apiKeyStatus;
let imperialUnitsRadio, metricUnitsRadio;

// Local storage keys
const PIRATE_API_KEY_STORAGE = 'weather_app_pirate_api_key';
const UNITS_STORAGE = 'weather_app_units';

/**
 * Initialize API settings functionality
 */
export function initApiSettings() {
    // Get DOM elements
    apiSettingsModal = document.getElementById('api-settings-modal');
    apiSettingsBackdrop = document.getElementById('api-settings-backdrop');
    openSettingsBtn = document.getElementById('open-settings');
    closeSettingsBtn = document.getElementById('close-settings-modal');
    pirateApiKeyInput = document.getElementById('pirate-api-key');
    saveApiKeyBtn = document.getElementById('save-api-key');
    removeApiKeyBtn = document.getElementById('remove-api-key');
    apiKeyStatus = document.getElementById('api-key-status');
    imperialUnitsRadio = document.getElementById('imperial-units');
    metricUnitsRadio = document.getElementById('metric-units');

    // Set up event listeners
    openSettingsBtn.addEventListener('click', openApiSettings);
    closeSettingsBtn.addEventListener('click', closeApiSettings);
    apiSettingsBackdrop.addEventListener('click', closeApiSettings);
    saveApiKeyBtn.addEventListener('click', saveApiKey);
    removeApiKeyBtn.addEventListener('click', removeApiKey);
    imperialUnitsRadio.addEventListener('change', updateUnits);
    metricUnitsRadio.addEventListener('change', updateUnits);

    // Load saved settings
    loadSavedApiKey();
    loadSavedUnits();
}

/**
 * Open the API settings modal
 */
function openApiSettings() {
    apiSettingsModal.style.display = 'block';
    apiSettingsBackdrop.style.display = 'block';

    // Check if key exists
    const hasKey = !!localStorage.getItem(PIRATE_API_KEY_STORAGE);
    removeApiKeyBtn.style.display = hasKey ? 'block' : 'none';
}

/**
 * Close the API settings modal
 */
function closeApiSettings() {
    apiSettingsModal.style.display = 'none';
    apiSettingsBackdrop.style.display = 'none';
    apiKeyStatus.innerHTML = '';
    apiKeyStatus.className = '';
}

/**
 * Save the API key to local storage
 */
function saveApiKey() {
    const apiKey = pirateApiKeyInput.value.trim();

    if (!apiKey) {
        showApiKeyStatus('Please enter an API key', 'status-error');
        return;
    }

    // Validate API key format (basic validation - adjust as needed)
    if (!validateApiKey(apiKey)) {
        showApiKeyStatus('Invalid API key format', 'status-error');
        return;
    }

    // Save to local storage
    localStorage.setItem(PIRATE_API_KEY_STORAGE, apiKey);

    // Update UI
    showApiKeyStatus('API key saved successfully!', 'status-success');
    removeApiKeyBtn.style.display = 'block';

    // Update the key in config
    updatePirateWeatherKey(apiKey);
}

/**
 * Remove the API key from local storage
 */
function removeApiKey() {
    localStorage.removeItem(PIRATE_API_KEY_STORAGE);
    pirateApiKeyInput.value = '';
    removeApiKeyBtn.style.display = 'none';
    showApiKeyStatus('API key removed', 'status-success');

    // Reset to default key in config
    resetPirateWeatherKey();
}

/**
 * Load saved API key from local storage
 */
function loadSavedApiKey() {
    const savedKey = localStorage.getItem(PIRATE_API_KEY_STORAGE);

    if (savedKey) {
        pirateApiKeyInput.value = savedKey;
        removeApiKeyBtn.style.display = 'block';

        // Update the key in config
        updatePirateWeatherKey(savedKey);
    }
}

/**
 * Load saved units preference from local storage
 */
function loadSavedUnits() {
    const savedUnits = localStorage.getItem(UNITS_STORAGE) || 'imperial';

    if (savedUnits === 'metric') {
        metricUnitsRadio.checked = true;
    } else {
        imperialUnitsRadio.checked = true;
    }

    // Only set the units if the function is available
    // This ensures we don't try to call a function that hasn't been defined yet
    if (typeof window.setDisplayUnits === 'function') {
        window.setDisplayUnits(savedUnits);
    }
}

/**
 * Update units based on user selection
 */
function updateUnits() {
    const units = document.querySelector('input[name="unit"]:checked')?.value || 'imperial';
    localStorage.setItem(UNITS_STORAGE, units);

    // Update the app to use the new units
    window.setDisplayUnits(units);

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
    if (window.refreshWeatherWithCurrentUnits) {
        window.refreshWeatherWithCurrentUnits();
    }
}

/**
 * Display status message for API key operations
 */
function showApiKeyStatus(message, className) {
    apiKeyStatus.textContent = message;
    apiKeyStatus.className = className;

    // Clear status after a delay
    setTimeout(() => {
        apiKeyStatus.className = '';
    }, 3000);
}

/**
 * Basic validation for API key format
 */
function validateApiKey(key) {
    // Most weather API keys are alphanumeric and have a specific length
    // Adjust this regex as needed for the specific format of Pirate Weather API keys
    return /^[a-zA-Z0-9]{20,}$/.test(key);
}

/**
 * Update the Pirate Weather API key in the config
 */
function updatePirateWeatherKey(key) {
    // This function will be different depending on how you've structured your app
    // If your config is imported as a module with constants:
    if (window.updatePirateWeatherApiKey) {
        window.updatePirateWeatherApiKey(key);
    }
}

/**
 * Reset to the default Pirate Weather API key
 */
function resetPirateWeatherKey() {
    // Reset to default key
    if (window.resetPirateWeatherApiKey) {
        window.resetPirateWeatherApiKey();
    }
}