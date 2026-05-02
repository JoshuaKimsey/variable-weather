// radarPreview.js — mini radar preview card on the front page
// Opens the full radar modal when clicked.

import { loadComponentCSS } from '../../utils/cssLoader.js';
import { log, warn, error as logError } from '../../utils/logger.js';
import {
    RADAR_API_URL,
    RAINVIEWER_API_URL,
    DEFAULT_COLOR_SCHEME,
    SMOOTHING,
    SNOW_VIEW,
    DEFAULT_OPACITY,
    ensureLeafletCSS,
    loadLeafletScript,
    processRadarApiResponse,
    openRadarModal
} from './radar.js';

let previewMap = null;
let previewOverlay = null;
let previewRadarData = null;
let previewMarker = null;

/**
 * Initialize the radar preview card.
 */
export function initRadarPreview() {
    const previewEl = document.getElementById('radar-preview');
    const mapEl = document.getElementById('radar-preview-map');
    if (!previewEl || !mapEl) {
        warn('Radar preview elements not found');
        return;
    }

    previewEl.classList.add('loading');

    // Click opens the full modal
    previewEl.addEventListener('click', (e) => {
        // Don't trigger if the user is selecting text or dragging
        if (e.target.closest('.leaflet-control-attribution')) return;
        openRadarModal();
    });

    // Watch for the parent container becoming visible so we can size the map
    observeVisibilityAndInit(previewEl, mapEl);
}

/**
 * Wait for the preview element to become visible (its parent starts hidden),
 * then load Leaflet and create the map.
 */
function observeVisibilityAndInit(previewEl, mapEl) {
    const weatherData = document.getElementById('weather-data');

    function isVisible(el) {
        return el && el.offsetParent !== null;
    }

    function start() {
        ensureLeafletCSS();
        loadLeafletScript()
            .then(() => {
                if (!window.L) throw new Error('Leaflet not available');
                createPreviewMap(mapEl);
                return fetchPreviewRadarData();
            })
            .then(() => {
                previewEl.classList.remove('loading');
            })
            .catch(err => {
                logError('Radar preview initialization failed:', err);
                previewEl.classList.remove('loading');
                previewEl.classList.add('error');
            });
    }

    if (isVisible(previewEl)) {
        start();
    } else if (weatherData) {
        const observer = new MutationObserver(() => {
            if (isVisible(previewEl)) {
                observer.disconnect();
                start();
            }
        });
        observer.observe(weatherData, { attributes: true, attributeFilter: ['style'] });
    } else {
        // Fallback: try anyway
        start();
    }

    // Refresh size when the modal closes (the preview may have been hidden)
    window.addEventListener('radar-modal-closed', () => {
        if (previewMap) {
            // Allow a tick for the DOM to settle
            requestAnimationFrame(() => {
                previewMap.invalidateSize(true);
            });
        }
    });

    // Recenter the map when the user changes location
    window.addEventListener('location-changed', (e) => {
        const { lat, lon } = e.detail;
        recenterPreview(lat, lon);
    });

    // Refresh radar data when weather data auto-updates
    window.addEventListener('weather-data-updated', () => {
        if (previewMap) {
            fetchPreviewRadarData();
        }
    });
}

function createPreviewMap(container) {
    const urlParams = new URLSearchParams(window.location.search);
    const lat = parseFloat(urlParams.get('lat')) || 39.8283;
    const lon = parseFloat(urlParams.get('lon')) || -98.5795;

    previewMap = L.map(container, {
        zoomControl: false,
        attributionControl: true,
        fadeAnimation: false,
        preferCanvas: true,
        scrollWheelZoom: false,
        dragging: false,
        touchZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false
    });

    previewMap.setView([lat, lon], 7);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | &copy; <a href="https://carto.com/">CARTO</a> | Radar: <a href="https://librewxr.net">LibreWXR</a>',
        subdomains: 'abcd',
        maxZoom: 19,
        opacity: 0.8
    }).addTo(previewMap);

    previewMarker = L.marker([lat, lon]).addTo(previewMap);

    return previewMap;
}

async function fetchPreviewRadarData() {
    if (!previewMap) return;

    try {
        const cacheBuster = Date.now();
        const response = await fetch(`${RAINVIEWER_API_URL}?t=${cacheBuster}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        previewRadarData = processRadarApiResponse(data);

        if (!previewRadarData || previewRadarData.radarFrames.length === 0) {
            throw new Error('No radar frames available');
        }

        const frameIndex = previewRadarData.nowcastStartIndex >= 0
            ? previewRadarData.nowcastStartIndex - 1
            : previewRadarData.radarFrames.length - 1;

        showPreviewFrame(frameIndex);
    } catch (err) {
        logError('Error fetching preview radar data:', err);
        throw err;
    }
}

function showPreviewFrame(index) {
    if (!previewMap || !previewRadarData) return;

    const frame = previewRadarData.radarFrames[index];
    if (!frame) return;

    if (previewOverlay) {
        previewMap.removeLayer(previewOverlay);
    }

    const tileUrl = `https://${RADAR_API_URL}/v2/radar/${frame.time}/512/{z}/{x}/{y}/${DEFAULT_COLOR_SCHEME}/${SMOOTHING}_${SNOW_VIEW}.webp`;

    previewOverlay = L.tileLayer(tileUrl, {
        opacity: DEFAULT_OPACITY,
        zIndex: 11,
        tileSize: 256,
        className: 'radar-frame-layer'
    });

    previewOverlay.addTo(previewMap);
}

function recenterPreview(lat, lon) {
    if (!previewMap) return;

    log('Recentering preview radar to', lat, lon);

    if (previewMarker) {
        previewMap.removeLayer(previewMarker);
    }
    previewMarker = L.marker([lat, lon]).addTo(previewMap);

    previewMap.flyTo([lat, lon], 7, { animate: true, duration: 0.8 });

    fetchPreviewRadarData();
}
