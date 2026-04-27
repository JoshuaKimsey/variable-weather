// radar.js — modal radar controller with complete radar functionality

import { loadComponentCSS } from '../../utils/cssLoader.js';
import { log, warn, error as logError } from '../../utils/logger.js';

const MODAL_STATE_ID = 'weather_radar_modal_open';

const RADAR_API_URL = 'api.librewxr.net';
const RAINVIEWER_API_URL = 'https://' + RADAR_API_URL + '/public/weather-maps.json';
const DEFAULT_COLOR_SCHEME = 7; // Rainbow SELEX-IS
const SMOOTHING = 1;
const SNOW_VIEW = 1;
const DEFAULT_OPACITY = 0.8;
const ANIMATION_SPEED = 800;
const NOWCAST_BOUNDARY_PAUSE = 400; // extra delay when crossing past->nowcast boundary
const ALERT_FETCH_THROTTLE = 3000;

class RadarController {
    constructor() {
        this.modalMap = null;
        this.radarModalOpen = false;
        this.radarFrames = [];
        this.animationPosition = 0;
        this.currentOverlay = null;
        this.animationTimer = null;
        this.isPlaying = false;
        this.lastSuccessfulAlerts = [];
        this.alertLayers = [];
        this.timestampDisplay = null;
        this.alertFetchInProgress = false;
        this.lastAlertFetchTime = 0;
        this.historyStateAdded = false;
        this.isProgrammaticMove = false;
        this.ignoreNextMoveEnd = false;
        this.lastClickedAlertId = null;
        this.preloadedLayers = [];
        this.pendingTimers = new Set();
        this.initialCenter = null;
        this.initialZoom = 7;
        this.nowcastStartIndex = -1;
    }

    isNowcastFrame(position) {
        return this.nowcastStartIndex >= 0 && position >= this.nowcastStartIndex;
    }

    schedule(fn, delay) {
        const id = setTimeout(() => {
            this.pendingTimers.delete(id);
            fn();
        }, delay);
        this.pendingTimers.add(id);
        return id;
    }

    cancelPending() {
        this.pendingTimers.forEach(id => clearTimeout(id));
        this.pendingTimers.clear();
    }

    init() {
        loadComponentCSS('./styles/radar.css').catch(err => warn('Failed to load radar styles:', err));

        const openRadarBtn = document.getElementById('open-radar');
        const backRadarBtn = document.getElementById('radar-back-button');
        const radarModal = document.getElementById('radar-modal');
        const radarBackdrop = document.getElementById('radar-modal-backdrop');

        if (openRadarBtn && radarModal && radarBackdrop) {
            openRadarBtn.addEventListener('click', () => this.open());

            if (backRadarBtn) {
                backRadarBtn.addEventListener('click', () => this.close());
            }

            radarBackdrop.addEventListener('click', () => this.close());

            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && this.radarModalOpen) {
                    this.close();
                }
            });

            window.addEventListener('popstate', (event) => {
                log('History navigation detected', event.state);
                if (this.radarModalOpen) {
                    this.close(true);
                }
            });
        } else {
            logError('Could not find radar modal elements');
        }
    }

    open() {
        this.radarModalOpen = true;

        document.body.classList.add('radar-modal-open');

        hideWeatherElements(true);

        const radarModal = document.getElementById('radar-modal');
        const radarBackdrop = document.getElementById('radar-modal-backdrop');

        if (!radarModal || !radarBackdrop) {
            logError('Modal elements not found');
            return;
        }

        radarModal.style.visibility = 'visible';
        radarModal.style.pointerEvents = 'auto';
        radarModal.style.zIndex = '2000';

        radarBackdrop.style.visibility = 'visible';
        radarBackdrop.style.pointerEvents = 'auto';
        radarBackdrop.style.zIndex = '1999';

        try {
            const currentUrl = window.location.href;
            history.pushState({ modalId: MODAL_STATE_ID }, document.title, currentUrl);
            this.historyStateAdded = true;
        } catch (e) {
            logError('Failed to add history state:', e);
        }

        radarModal.style.display = 'block';
        radarBackdrop.style.display = 'block';

        if (window.innerWidth <= 480) {
            document.body.classList.add('radar-modal-open');
        }

        this.schedule(() => {
            radarModal.classList.add('open');
            radarBackdrop.classList.add('open');
            document.body.classList.add('modal-open');

            this.schedule(() => {
                this.initMap();
            }, 300);
        }, 10);
    }

    close(fromPopState = false) {
        if (this.historyStateAdded && !fromPopState) {
            log('Manually going back in history');
            history.back();
            return;
        }

        this.historyStateAdded = false;
        this.radarModalOpen = false;

        document.body.classList.remove('radar-modal-open');

        this.cancelPending();

        if (this.animationTimer) {
            clearTimeout(this.animationTimer);
            this.animationTimer = null;
        }
        this.isPlaying = false;

        const radarModal = document.getElementById('radar-modal');
        const radarBackdrop = document.getElementById('radar-modal-backdrop');

        if (!radarModal || !radarBackdrop) return;

        radarModal.classList.remove('open');
        radarBackdrop.classList.remove('open');
        document.body.classList.remove('modal-open');
        document.body.classList.remove('radar-modal-open');

        // Untracked: must run to completion even after close
        setTimeout(() => {
            radarModal.style.display = 'none';
            radarModal.style.visibility = 'hidden';
            radarModal.style.pointerEvents = 'none';
            radarModal.style.zIndex = '-1';

            radarBackdrop.style.display = 'none';
            radarBackdrop.style.visibility = 'hidden';
            radarBackdrop.style.pointerEvents = 'none';
            radarBackdrop.style.zIndex = '-1';

            hideWeatherElements(false);
        }, 300);
    }

    initMap() {
        const container = document.getElementById('modal-radar-view');
        if (!container) {
            logError('Modal radar container not found');
            return;
        }

        container.style.position = 'absolute';
        container.style.top = '0';
        container.style.left = '0';
        container.style.right = '0';
        container.style.bottom = '0';
        container.style.overflow = 'hidden';
        container.style.width = '100%';
        container.style.height = '100%';

        if (this.modalMap) {
            log('Map exists, refreshing');

            this.modalMap.invalidateSize(true);

            [100, 300, 800].forEach(delay => {
                this.schedule(() => {
                    if (this.modalMap) {
                        log(`Invalidating map size after ${delay}ms`);
                        this.modalMap.invalidateSize(true);
                    }
                }, delay);
            });

            this.fetchRadarData();
            this.fetchAlerts(true);

            return;
        }

        container.innerHTML = `
    <div class="radar-loading" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; background: rgba(0,0,0,0.5); z-index: 1000;">
        <div class="radar-loading-spinner"><div></div><div></div><div></div></div>
        <div class="radar-loading-text">Loading radar data...</div>
    </div>
    <div style="width: 100%; height: 100%; position: relative; overflow: hidden;">
        <!-- Map Container -->
        <div id="modal-map-container" style="width: 100%; height: calc(100% - 60px); position: absolute; top: 0; left: 0;"></div>

        <!-- Timestamp Display -->
        <div id="timestamp-display" class="timestamp-display" style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.7); color: white; padding: 6px 10px; border-radius: 4px; font-size: 14px; z-index: 1000;"></div>

        <!-- Control Bar -->
        <div id="radar-controls" class="radar-controls" style="position: absolute; bottom: 0; left: 0; right: 0; height: 60px; padding: 10px 15px; background-color: #222222; border-top: 1px solid rgba(255,255,255,0.2); box-shadow: 0 -2px 10px rgba(0,0,0,0.3); z-index: 1001;">
            <div class="radar-timeline-wrapper" style="display: flex; align-items: flex-start; gap: 12px; width: 100%;">
                <button id="radar-play-pause" class="radar-play-pause" style="width: 36px; height: 36px; min-width: 36px; border-radius: 50%; background-color: #1e88e5; color: white; border: none; display: flex; justify-content: center; align-items: center; cursor: pointer; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);">
                    <i class="bi bi-play-fill"></i>
                </button>
                <div class="radar-timeline-controls" style="flex: 1; min-width: 0;">
                    <div id="radar-timestamps-row" class="radar-timestamps-row" style="position: relative; height: 20px; width: 100%; margin-bottom: 4px;"></div>
                    <div id="radar-timeline" class="radar-timeline" style="height: 6px; background-color: rgba(0, 0, 0, 0.3); border-radius: 3px; position: relative; overflow: visible; width: 100%; margin: 5px 0;"></div>
                </div>
            </div>
        </div>
    </div>
`;

        const mapContainer = document.getElementById('modal-map-container');
        if (!mapContainer) {
            logError('Map container element not created');
            return;
        }

        mapContainer.style.width = '100%';
        mapContainer.style.height = 'calc(100% - 60px)';
        mapContainer.style.position = 'absolute';
        mapContainer.style.top = '0';
        mapContainer.style.left = '0';

        const playPauseButton = document.getElementById('radar-play-pause');

        this.timestampDisplay = document.getElementById('timestamp-display');

        if (playPauseButton) {
            playPauseButton.addEventListener('click', () => this.toggleAnimation());
        }

        ensureLeafletCSS();

        const urlParams = new URLSearchParams(window.location.search);
        const lat = parseFloat(urlParams.get('lat')) || 39.8283;
        const lon = parseFloat(urlParams.get('lon')) || -98.5795;
        this.initialCenter = [lat, lon];

        loadLeafletScript()
            .then(() => {
                if (!window.L) {
                    throw new Error('Leaflet not available after loading');
                }

                try {
                    log('Creating Leaflet map instance');

                    mapContainer.style.width = '100%';
                    mapContainer.style.height = 'calc(100% - 60px)';

                    this.modalMap = L.map(mapContainer, {
                        zoomControl: true,
                        attributionControl: true,
                        fadeAnimation: false,
                        preferCanvas: true
                    });

                    this.modalMap.setView([lat, lon], 7);
                    log('Map view set');

                    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | &copy; <a href="https://carto.com/">CARTO</a> | Radar: <a href="https://librewxr.net">LibreWXR</a>',
                        subdomains: 'abcd',
                        maxZoom: 19,
                        opacity: 0.8
                    }).addTo(this.modalMap);
                    log('Tile layer added');

                    L.marker([lat, lon]).addTo(this.modalMap);
                    log('Marker added');

                    this.addRecenterControl();

                    this.modalMap.invalidateSize(true);

                    [100, 300, 600, 1000, 2000].forEach(delay => {
                        this.schedule(() => {
                            if (this.modalMap) {
                                this.modalMap.invalidateSize(true);
                            }
                        }, delay);
                    });

                    this.fetchRadarData();

                    this.schedule(() => {
                        this.fetchAlerts(true);
                    }, 1000);

                    this.modalMap.on('moveend', debounce(() => {
                        if (this.ignoreNextMoveEnd) {
                            this.ignoreNextMoveEnd = false;
                            return;
                        }

                        if (this.radarModalOpen) {
                            this.fetchAlerts();
                        }
                    }, 500));

                    this.modalMap.on('moveend', () => {
                        if (this.isProgrammaticMove) {
                            this.isProgrammaticMove = false;
                            return;
                        }

                        if (this.lastClickedAlertId != null) {
                            this.lastClickedAlertId = null;
                        }
                    });
                } catch (err) {
                    logError('Error initializing modal map:', err);
                    showModalMapError('Error initializing map: ' + err.message);
                }
            })
            .catch(err => {
                logError('Failed to load Leaflet:', err);
                showModalMapError('Failed to load map library: ' + err.message);
            });
    }

    addRecenterControl() {
        if (!this.modalMap || !window.L) return;

        const RecenterControl = L.Control.extend({
            options: { position: 'topleft' },
            onAdd: () => {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control radar-recenter-control');
                const button = L.DomUtil.create('a', 'radar-recenter-button', container);
                button.href = '#';
                button.title = 'Recenter map';
                button.setAttribute('role', 'button');
                button.setAttribute('aria-label', 'Recenter map');
                button.innerHTML = '<i class="bi bi-crosshair"></i>';

                L.DomEvent.on(button, 'click', (e) => {
                    L.DomEvent.preventDefault(e);
                    L.DomEvent.stopPropagation(e);
                    if (this.modalMap && this.initialCenter) {
                        this.modalMap.flyTo(this.initialCenter, this.initialZoom);
                    }
                });
                L.DomEvent.disableClickPropagation(container);

                return container;
            }
        });

        new RecenterControl().addTo(this.modalMap);
    }

    async fetchAlerts(forceRefresh = false) {
        if (!this.modalMap) {
            warn('Cannot fetch map alerts - map not initialized');
            return false;
        }

        if (!this.radarModalOpen && !forceRefresh) {
            return false;
        }

        const now = Date.now();

        if (this.alertFetchInProgress) {
            return false;
        }

        if (!forceRefresh && now - this.lastAlertFetchTime < ALERT_FETCH_THROTTLE) {
            if (this.lastSuccessfulAlerts.length > 0) {
                this.updateAlertPolygons(this.lastSuccessfulAlerts);
            }
            return false;
        }

        this.lastAlertFetchTime = now;
        this.alertFetchInProgress = true;

        showMapLoadingIndicator('Fetching alerts...');

        const bounds = this.modalMap.getBounds();
        const mapBounds = {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest()
        };

        try {
            const { fetchMapAreaAlerts } = await import('../../api/alerts/alertsApi.js');
            const alerts = await fetchMapAreaAlerts(mapBounds);

            if (!alerts || !Array.isArray(alerts)) {
                warn('Invalid response from alert API');
                throw new Error('Invalid alert API response');
            }

            const alertsWithGeometry = alerts.filter(alert => alert.geometry);

            if (alertsWithGeometry.length > 0) {
                this.lastSuccessfulAlerts = [...alertsWithGeometry];
                this.updateAlertPolygons(alertsWithGeometry);
                return true;
            } else if (this.lastSuccessfulAlerts.length > 0) {
                this.updateAlertPolygons(this.lastSuccessfulAlerts);
                return false;
            } else {
                this.clearAlertLayers();
                return false;
            }
        } catch (err) {
            logError('Error fetching alerts:', err);
            showMapErrorMessage('Failed to load alerts');

            if (this.lastSuccessfulAlerts.length > 0) {
                this.updateAlertPolygons(this.lastSuccessfulAlerts);
            }
            return false;
        } finally {
            this.alertFetchInProgress = false;
            hideMapLoadingIndicator();
        }
    }

    updateAlertPolygons(alerts) {
        if (!this.modalMap) {
            warn('Cannot update alert polygons - map not initialized');
            return;
        }

        let clickedAlert = null;
        if (this.lastClickedAlertId && this.alertLayers.length > 0) {
            clickedAlert = alerts.find(alert =>
                alert.id === this.lastClickedAlertId ||
                (alert.properties && alert.properties.id === this.lastClickedAlertId)
            );
        }

        this.clearAlertLayers();

        if (!alerts || alerts.length === 0) return;

        addAlertAnimationCSS();

        const severityZIndex = {
            'extreme': 1000,
            'severe': 800,
            'moderate': 600,
            'minor': 400
        };

        const sortedAlerts = [...alerts].sort((a, b) => {
            const severityA = (a.properties && a.properties.severity) ? a.properties.severity.toLowerCase() :
                (a.severity ? a.severity.toLowerCase() : 'minor');
            const severityB = (b.properties && b.properties.severity) ? b.properties.severity.toLowerCase() :
                (b.severity ? b.severity.toLowerCase() : 'minor');

            return (severityZIndex[severityA] || 0) - (severityZIndex[severityB] || 0);
        });

        sortedAlerts.forEach(alert => {
            const alertId = alert.id || (alert.properties && alert.properties.id);

            let severity = 'moderate';
            if (alert.properties && alert.properties.severity) {
                severity = alert.properties.severity.toLowerCase();
            } else if (alert.severity) {
                severity = alert.severity.toLowerCase();
            }

            const isExtreme = severity === 'extreme';
            const isSevere = severity === 'severe';

            const alertColor = getAlertTypeColor(alert);

            const alertStyle = {
                color: alertColor.color,
                weight: isExtreme ? 3 : (isSevere ? 2.5 : 2),
                opacity: alertColor.borderOpacity || 0.9,
                fillColor: alertColor.color,
                fillOpacity: alertColor.fillOpacity || 0.2,
                className: isExtreme ? 'extreme-alert-polygon' : (isSevere ? 'severe-alert-polygon' : '')
            };

            try {
                const alertLayer = L.geoJSON(alert.geometry, {
                    style: alertStyle,
                    onEachFeature: (feature, layer) => {
                        if (alert.title || (alert.properties && alert.properties.event)) {
                            const title = alert.title || alert.properties.event || 'Weather Alert';
                            const description = alert.description || (alert.properties && alert.properties.headline) || '';

                            let popupContent = `
                <div class="alert-popup-content">
                  <h3 style="margin-top: 0; color: ${alertColor.color}; ${isExtreme ? 'animation: pulse-text 1.5s infinite;' : ''}">
                    ${isExtreme ? '⚠️ ' : ''}${title}${isExtreme ? ' ⚠️' : ''}
                  </h3>`;

                            let severityText = '';
                            if (isExtreme) {
                                severityText = 'EXTREME';
                            } else if (isSevere) {
                                severityText = 'SEVERE';
                            } else if (severity === 'moderate') {
                                severityText = 'MODERATE';
                            } else {
                                severityText = 'MINOR';
                            }

                            const urgency = alert.urgency || (alert.properties && alert.properties.urgency) || '';
                            popupContent += `<div style="display: flex; gap: 5px; margin-bottom: 8px; flex-wrap: wrap;">
                <span class="alert-severity ${severity}" style="background-color: ${alertColor.color};">
                  ${severityText}
                </span>`;

                            if (urgency) {
                                popupContent += `
                  <span style="background-color: #424242; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.8em;">
                    ${urgency.toUpperCase()}
                  </span>`;
                            }
                            popupContent += `</div>`;

                            popupContent += `<p style="margin-bottom: 12px;">${description}</p>`;

                            const expires = alert.expires || (alert.properties && alert.properties.expires);
                            if (expires) {
                                let expiresDate;
                                if (typeof expires === 'number') {
                                    expiresDate = new Date(expires * 1000);
                                } else {
                                    expiresDate = new Date(expires);
                                }

                                const expiresFormatted = expiresDate.toLocaleString(undefined, {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit'
                                });

                                popupContent += `<p style="margin-bottom: 8px; font-size: 0.9em;"><strong>Expires:</strong> ${expiresFormatted}</p>`;
                            }

                            const hazardTypes = alert.hazardTypes ||
                                (alert.properties && alert.properties.hazardTypes) ||
                                [];

                            if (hazardTypes && hazardTypes.length > 0) {
                                popupContent += `<div style="margin-bottom: 10px;">
                  <p style="margin-bottom: 5px; font-size: 0.9em;"><strong>Hazards:</strong></p>
                  <div class="hazard-tags" style="display: flex; flex-wrap: wrap; gap: 5px;">`;

                                hazardTypes.forEach(hazard => {
                                    const hazardName = hazard.charAt(0).toUpperCase() + hazard.slice(1);
                                    popupContent += `<span class="hazard-tag" style="background-color: #616161; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.8em;">
                    ${hazardName}
                  </span>`;
                                });

                                popupContent += `</div></div>`;
                            }

                            if (isExtreme) {
                                popupContent += `<p class="action-guidance" style="padding: 8px; background-color: rgba(183, 28, 28, 0.1); border-left: 3px solid #B71C1C; font-size: 0.9em; margin: 10px 0;">
                  <strong>TAKE ACTION NOW:</strong> This is an EXTREME alert. Seek shelter or follow official instructions immediately.
                </p>`;
                            } else if (isSevere) {
                                popupContent += `<p class="action-guidance" style="padding: 8px; background-color: rgba(198, 40, 40, 0.1); border-left: 3px solid #C62828; font-size: 0.9em; margin: 10px 0;">
                  <strong>BE PREPARED:</strong> This is a SEVERE alert. Prepare to take action if in the affected area.
                </p>`;
                            } else if (severity === 'moderate') {
                                popupContent += `<p class="action-guidance" style="padding: 8px; background-color: rgba(239, 108, 0, 0.1); border-left: 3px solid #EF6C00; font-size: 0.9em; margin: 10px 0;">
                  <strong>STAY AWARE:</strong> Monitor conditions and follow updates.
                </p>`;
                            }

                            const fullText = alert.fullText || (alert.properties && alert.properties.fullText);
                            if (fullText) {
                                const processedText = fullText.replace(/\n/g, '<br>');

                                popupContent += `
                  <details>
                    <summary style="cursor: pointer; background-color: #424242; color: white; padding: 6px; border-radius: 4px; font-size: 0.9em; outline: none;">
                      View Full Alert
                    </summary>
                    <div class="full-text" style="margin-top: 8px; max-height: 200px; overflow-y: auto; padding: 8px; background-color: #f5f5f5; border-radius: 4px; font-size: 0.85em; line-height: 1.4;">
                      ${processedText}
                    </div>
                  </details>`;
                            }

                            popupContent += `</div>`;

                            layer.bindPopup(popupContent, {
                                maxWidth: 320,
                                autoPan: true,
                                autoPanPadding: [20, 20],
                                closeOnClick: true,
                            });

                            layer.on('click', (e) => {
                                this.ignoreNextMoveEnd = true;
                                this.lastClickedAlertId = alertId;
                                L.DomEvent.stopPropagation(e);
                            });
                        }
                    }
                });

                alertLayer.setZIndex(severityZIndex[severity] || 500);

                alertLayer.addTo(this.modalMap);
                this.alertLayers.push(alertLayer);

                if (clickedAlert && alertId === this.lastClickedAlertId) {
                    for (const key in alertLayer._layers) {
                        alertLayer._layers[key].openPopup();
                        break;
                    }
                }
            } catch (err) {
                logError('Error adding alert polygon:', err, alert);
            }
        });
    }

    clearAlertLayers() {
        this.alertLayers.forEach(layer => {
            if (this.modalMap) this.modalMap.removeLayer(layer);
        });
        this.alertLayers = [];
    }

    fetchRadarData() {
        const loadingIndicator = document.querySelector('.radar-loading');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'flex';
        }

        const urlWithTimestamp = `${RAINVIEWER_API_URL}?t=${Date.now()}`;

        fetch(urlWithTimestamp)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (!data || !data.radar || !data.radar.past || data.radar.past.length === 0) {
                    throw new Error('Invalid radar data format received');
                }

                this.processRadarData(data);

                if (this.radarFrames.length > 0) {
                    this.animationPosition = this.nowcastStartIndex >= 0
                        ? this.nowcastStartIndex - 1
                        : this.radarFrames.length - 1;

                    this.showFrame(this.animationPosition);

                    const playPauseButton = document.getElementById('radar-play-pause');
                    if (playPauseButton) {
                        playPauseButton.innerHTML = '<i class="bi bi-play-fill"></i>';
                    }
                    this.isPlaying = false;

                    this.preloadFrames().then(() => {
                        log('All radar frames preloaded');
                        if (loadingIndicator) {
                            loadingIndicator.style.display = 'none';
                        }
                    });
                } else {
                    warn('No radar frames available after processing');
                    if (loadingIndicator) {
                        loadingIndicator.style.display = 'none';
                    }
                }
            })
            .catch(err => {
                logError('Error fetching radar data:', err);

                if (loadingIndicator) {
                    loadingIndicator.style.display = 'none';
                }

                showModalMapError('Failed to load radar data: ' + err.message);
            });
    }

    async preloadFrames() {
        if (!this.modalMap || this.radarFrames.length === 0) {
            return;
        }

        this.preloadedLayers.forEach(layer => {
            if (layer && this.modalMap.hasLayer(layer)) {
                this.modalMap.removeLayer(layer);
            }
        });
        this.preloadedLayers = [];

        log(`Preloading ${this.radarFrames.length} radar frames...`);

        const loadPromises = this.radarFrames.map((frame, index) => {
            return new Promise((resolve) => {
                const tileUrl = `https://${RADAR_API_URL}/v2/radar/${frame.time}/512/{z}/{x}/{y}/${DEFAULT_COLOR_SCHEME}/${SMOOTHING}_${SNOW_VIEW}.png`;

                const layer = L.tileLayer(tileUrl, {
                    opacity: 0,
                    zIndex: 5,
                    tileSize: 256,
                });

                let loadTimeout;

                const onLoad = () => {
                    clearTimeout(loadTimeout);
                    resolve(layer);
                };

                layer.on('load', onLoad);

                layer.addTo(this.modalMap);

                this.preloadedLayers[index] = layer;

                loadTimeout = setTimeout(() => {
                    resolve(layer);
                }, 5000);
            });
        });

        await Promise.all(loadPromises);

        this.preloadedLayers.forEach(layer => {
            if (layer) {
                layer.setOpacity(0);
                this.modalMap.removeLayer(layer);
            }
        });

        log('Radar frame preloading complete');
    }

    processRadarData(data) {
        if (!data || !data.radar || !data.radar.past) {
            logError('Invalid radar data format');
            return;
        }

        const pastFrames = [...data.radar.past];

        const nowcastFrames = (data.radar.nowcast && data.radar.nowcast.length > 0)
            ? [...data.radar.nowcast]
            : [];

        this.nowcastStartIndex = nowcastFrames.length > 0 ? pastFrames.length : -1;

        this.radarFrames = pastFrames.concat(nowcastFrames).map(frame => ({
            time: frame.time,
            timestamp: new Date(frame.time * 1000)
        }));

        this.updateTimeline();
    }

    updateTimeline() {
        const timelineContainer = document.getElementById('radar-timeline');
        const timestampsRow = document.getElementById('radar-timestamps-row');
        if (!timelineContainer || !timestampsRow) return;

        timelineContainer.innerHTML = '';
        timestampsRow.innerHTML = '';

        if (this.radarFrames.length > 0) {
            const containerWidth = timelineContainer.offsetWidth;
            const minSpaceBetweenTimestamps = 60;
            const maxTimestamps = Math.max(5, Math.floor(containerWidth / minSpaceBetweenTimestamps));

            let step = Math.ceil(this.radarFrames.length / maxTimestamps);

            if (this.radarFrames.length <= 6) {
                step = 1;
            } else if (this.radarFrames.length <= 20) {
                step = 5;
            }

            for (let i = 0; i < this.radarFrames.length; i += step) {
                if (i !== 0 && i !== this.radarFrames.length - 1 && i % (step * 2) !== 0 && this.radarFrames.length > 12) {
                    continue;
                }

                const timeLabel = document.createElement('div');
                timeLabel.className = 'radar-timestamp';
                timeLabel.style.position = 'absolute';
                timeLabel.style.fontSize = '11px';
                timeLabel.style.color = 'rgba(255, 255, 255, 0.9)';
                timeLabel.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
                timeLabel.style.padding = '1px 4px';
                timeLabel.style.borderRadius = '3px';
                timeLabel.style.whiteSpace = 'nowrap';
                timeLabel.style.overflow = 'hidden';
                timeLabel.style.textOverflow = 'ellipsis';
                timeLabel.style.transform = 'translateX(-50%)';

                const timeString = this.radarFrames[i].timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                });

                timeLabel.textContent = timeString;

                const position = (i / (this.radarFrames.length - 1)) * 100;
                timeLabel.style.left = `${position}%`;

                timestampsRow.appendChild(timeLabel);
            }

            if (step > 1 && this.radarFrames.length > 1) {
                const lastIndex = this.radarFrames.length - 1;

                if (lastIndex % step !== 0) {
                    const lastTimeLabel = document.createElement('div');
                    lastTimeLabel.className = 'radar-timestamp';
                    lastTimeLabel.style.position = 'absolute';
                    lastTimeLabel.style.fontSize = '11px';
                    lastTimeLabel.style.color = 'rgba(255, 255, 255, 0.9)';
                    lastTimeLabel.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
                    lastTimeLabel.style.padding = '1px 4px';
                    lastTimeLabel.style.borderRadius = '3px';
                    lastTimeLabel.style.whiteSpace = 'nowrap';
                    lastTimeLabel.style.overflow = 'hidden';
                    lastTimeLabel.style.textOverflow = 'ellipsis';
                    lastTimeLabel.style.right = '0';
                    lastTimeLabel.style.transform = 'translateX(0)';

                    const timeString = this.radarFrames[lastIndex].timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    });

                    lastTimeLabel.textContent = timeString;
                    timestampsRow.appendChild(lastTimeLabel);
                }
            }
        }

        if (this.nowcastStartIndex >= 1 && this.radarFrames.length > 1) {
            const boundaryIndex = this.nowcastStartIndex - 1;
            const boundaryPercent = (boundaryIndex / (this.radarFrames.length - 1)) * 100;
            const nowcastRail = document.createElement('div');
            nowcastRail.className = 'radar-nowcast-rail';
            nowcastRail.style.left = `${boundaryPercent}%`;
            nowcastRail.style.right = '0';
            timelineContainer.appendChild(nowcastRail);

            const boundaryDivider = document.createElement('div');
            boundaryDivider.className = 'radar-nowcast-boundary';
            boundaryDivider.style.left = `${boundaryPercent}%`;
            timelineContainer.appendChild(boundaryDivider);
        }

        this.radarFrames.forEach((frame, index) => {
            const marker = document.createElement('div');
            marker.className = 'radar-frame-marker';
            if (this.isNowcastFrame(index)) {
                marker.classList.add('nowcast');
            }
            marker.style.position = 'absolute';
            marker.style.width = '2px';
            marker.style.height = '6px';
            marker.style.top = '0';
            marker.style.cursor = 'pointer';
            marker.style.transition = 'background-color 0.2s ease';
            marker.setAttribute('data-index', index);

            marker.style.left = `${(index / (this.radarFrames.length - 1)) * 100}%`;

            const timeString = frame.timestamp.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });

            marker.title = timeString;

            marker.addEventListener('click', () => {
                this.stopAnimation();
                this.animationPosition = index;
                this.showFrame(index);
                this.updateTimelineSelection();
            });

            timelineContainer.appendChild(marker);
        });

        const positionIndicator = document.createElement('div');
        positionIndicator.id = 'radar-position-indicator';
        positionIndicator.className = 'radar-position-indicator';
        positionIndicator.style.position = 'absolute';
        positionIndicator.style.width = '12px';
        positionIndicator.style.height = '12px';
        positionIndicator.style.backgroundColor = 'white';
        positionIndicator.style.borderRadius = '50%';
        positionIndicator.style.top = '50%';
        positionIndicator.style.transform = 'translate(-50%, -50%)';
        positionIndicator.style.boxShadow = '0 0 4px rgba(0, 0, 0, 0.5)';
        positionIndicator.style.zIndex = '10';
        positionIndicator.style.pointerEvents = 'none';
        positionIndicator.style.transition = 'left 0.2s ease-out';
        timelineContainer.appendChild(positionIndicator);

        if (this.animationPosition === 0 && this.radarFrames.length > 0) {
            this.animationPosition = this.nowcastStartIndex >= 0
                ? this.nowcastStartIndex - 1
                : this.radarFrames.length - 1;
        }

        this.updateTimelineSelection();
    }

    updateTimelineSelection() {
        const timelineContainer = document.getElementById('radar-timeline');
        if (!timelineContainer) return;

        const markers = timelineContainer.querySelectorAll('.radar-frame-marker');
        if (!markers.length) return;

        markers.forEach((marker, index) => {
            marker.classList.toggle('active', index === this.animationPosition);
        });

        const positionIndicator = document.getElementById('radar-position-indicator');
        if (positionIndicator && this.radarFrames.length > 1) {
            const position = (this.animationPosition / (this.radarFrames.length - 1)) * 100;
            positionIndicator.style.left = `${position}%`;
        }
    }

    showFrame(index) {
        if (!this.modalMap || !this.radarFrames.length || index >= this.radarFrames.length) {
            return;
        }

        const frame = this.radarFrames[index];

        const oldOverlay = this.currentOverlay;

        const tileUrl = `https://${RADAR_API_URL}/v2/radar/${frame.time}/512/{z}/{x}/{y}/${DEFAULT_COLOR_SCHEME}/${SMOOTHING}_${SNOW_VIEW}.png`;

        const newOverlay = L.tileLayer(tileUrl, {
            opacity: DEFAULT_OPACITY,
            zIndex: 11,
            tileSize: 256,
        });

        newOverlay.addTo(this.modalMap);

        this.currentOverlay = newOverlay;

        // Untracked: short crossfade should run even if controller state shifts
        if (oldOverlay) {
            setTimeout(() => {
                if (this.modalMap && this.modalMap.hasLayer(oldOverlay)) {
                    this.modalMap.removeLayer(oldOverlay);
                }
            }, 50);
        }

        this.updateTimestampDisplay(frame.timestamp, this.isNowcastFrame(index));

        this.updateTimelineSelection();
    }

    updateTimestampDisplay(timestamp, isNowcast = false) {
        if (!this.timestampDisplay) return;

        try {
            const timeString = timestamp.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });

            const dateString = timestamp.toLocaleDateString([], {
                month: 'short',
                day: 'numeric'
            });

            this.timestampDisplay.innerHTML = `<strong>${timeString}</strong><span class="date-display">${dateString}</span><span class="radar-forecast-badge">Forecast</span>`;
            this.timestampDisplay.classList.toggle('is-forecast', isNowcast);
        } catch (err) {
            logError('Error updating timestamp display:', err);
            this.timestampDisplay.textContent = 'Time data unavailable';
        }
    }

    startAnimation() {
        this.stopAnimation();

        if (this.animationPosition === this.radarFrames.length - 1) {
            this.animationPosition = 0;
            this.showFrame(this.animationPosition);
        }

        const playPauseButton = document.getElementById('radar-play-pause');
        if (playPauseButton) {
            playPauseButton.innerHTML = '<i class="bi bi-pause-fill"></i>';
        }

        this.isPlaying = true;
        this.scheduleNextFrame();
    }

    scheduleNextFrame() {
        const delay = this.getFrameDelay(this.animationPosition);
        this.animationTimer = setTimeout(() => {
            if (!this.isPlaying) return;
            this.animationPosition = (this.animationPosition + 1) % this.radarFrames.length;
            this.showFrame(this.animationPosition);
            this.scheduleNextFrame();
        }, delay);
    }

    getFrameDelay(position) {
        // Brief pause when about to cross from last past frame into nowcast
        if (this.nowcastStartIndex >= 0 && position === this.nowcastStartIndex - 1) {
            return ANIMATION_SPEED + NOWCAST_BOUNDARY_PAUSE;
        }
        return ANIMATION_SPEED;
    }

    stopAnimation() {
        if (this.animationTimer) {
            clearTimeout(this.animationTimer);
            this.animationTimer = null;
        }

        const playPauseButton = document.getElementById('radar-play-pause');
        if (playPauseButton) {
            playPauseButton.innerHTML = '<i class="bi bi-play-fill"></i>';
        }

        this.isPlaying = false;

        if (this.radarFrames.length > 0) {
            this.animationPosition = this.nowcastStartIndex >= 0
                ? this.nowcastStartIndex - 1
                : this.radarFrames.length - 1;

            this.showFrame(this.animationPosition);

            this.updateTimelineSelection();
        }
    }

    toggleAnimation() {
        if (this.isPlaying) {
            this.stopAnimation();
        } else {
            this.startAnimation();
        }
    }
}

// ---- Module-level helpers (no controller state) ----

function hideWeatherElements(hide) {
    const weatherIcon = document.getElementById('weather-icon');
    if (weatherIcon) {
        weatherIcon.style.display = hide ? 'none' : 'block';
    }

    const weatherBackground = document.getElementById('weather-background');
    if (weatherBackground) {
        weatherBackground.style.visibility = hide ? 'hidden' : 'visible';
    }

    const forecastIcons = document.querySelectorAll('.forecast-icon');
    forecastIcons.forEach(icon => {
        icon.style.visibility = hide ? 'hidden' : 'visible';
    });

    const hourlyIcons = document.querySelectorAll('.hourly-forecast-card .forecast-icon');
    hourlyIcons.forEach(icon => {
        icon.style.visibility = hide ? 'hidden' : 'visible';
    });
}

function getAlertTypeColor(alert) {
    if (!alert || !alert.title) {
        return { color: '#757575', borderOpacity: 0.9, fillOpacity: 0.2 };
    }

    const eventType = alert.title.toLowerCase();
    const severity = (alert.severity || '').toLowerCase();

    let intensityLevel = 1;

    if (severity === 'extreme') {
        intensityLevel = 3;
    } else if (severity === 'severe') {
        intensityLevel = 2;
    } else if (severity === 'minor') {
        intensityLevel = 0;
    }

    const borderOpacity = 0.7 + (intensityLevel * 0.1);
    const fillOpacity = 0.15 + (intensityLevel * 0.05);

    const hazardType = alert.primaryHazard || getDefaultHazardType(alert.title);

    if (hazardType === 'flood') {
        const greenShades = ['#81C784', '#66BB6A', '#4CAF50', '#2E7D32'];
        return {
            color: greenShades[intensityLevel],
            borderOpacity: borderOpacity,
            fillOpacity: fillOpacity
        };
    }

    if (hazardType === 'thunderstorm' || eventType.includes('special weather')) {
        const yellowShades = ['#FFD54F', '#FFC107', '#FF9800', '#F57C00'];
        return {
            color: yellowShades[intensityLevel],
            borderOpacity: borderOpacity,
            fillOpacity: fillOpacity
        };
    }

    if (hazardType === 'tornado' || hazardType === 'dust') {
        const redShades = ['#EF9A9A', '#EF5350', '#E53935', '#B71C1C'];
        return {
            color: redShades[intensityLevel],
            borderOpacity: borderOpacity,
            fillOpacity: fillOpacity
        };
    }

    if (hazardType === 'snow' || hazardType === 'ice' || hazardType === 'cold') {
        const blueShades = ['#9FA8DA', '#7986CB', '#3F51B5', '#283593'];
        return {
            color: blueShades[intensityLevel],
            borderOpacity: borderOpacity,
            fillOpacity: fillOpacity
        };
    }

    if (hazardType === 'fire' || hazardType === 'smoke' || hazardType === 'heat') {
        const orangeShades = ['#FFAB91', '#FF7043', '#F4511E', '#BF360C'];
        return {
            color: orangeShades[intensityLevel],
            borderOpacity: borderOpacity,
            fillOpacity: fillOpacity
        };
    }

    if (hazardType === 'fog') {
        const grayShades = ['#B0BEC5', '#90A4AE', '#607D8B', '#37474F'];
        return {
            color: grayShades[intensityLevel],
            borderOpacity: borderOpacity,
            fillOpacity: fillOpacity
        };
    }

    if (hazardType === 'wind' || hazardType === 'hurricane') {
        const tealShades = ['#80CBC4', '#4DB6AC', '#009688', '#00695C'];
        return {
            color: tealShades[intensityLevel],
            borderOpacity: borderOpacity,
            fillOpacity: fillOpacity
        };
    }

    const purpleShades = ['#B39DDB', '#9575CD', '#673AB7', '#4527A0'];
    return {
        color: purpleShades[intensityLevel],
        borderOpacity: borderOpacity,
        fillOpacity: fillOpacity
    };
}

function getDefaultHazardType(title) {
    if (!title) return 'unknown';

    const lowerTitle = title.toLowerCase();

    if (lowerTitle.includes('tornado')) return 'tornado';
    if (lowerTitle.includes('flood')) return 'flood';
    if (lowerTitle.includes('thunder') || lowerTitle.includes('lightning')) return 'thunderstorm';
    if (lowerTitle.includes('snow') || lowerTitle.includes('winter')) return 'snow';
    if (lowerTitle.includes('ice') || lowerTitle.includes('freez')) return 'ice';
    if (lowerTitle.includes('wind')) return 'wind';
    if (lowerTitle.includes('heat')) return 'heat';
    if (lowerTitle.includes('cold')) return 'cold';
    if (lowerTitle.includes('fog')) return 'fog';
    if (lowerTitle.includes('hurricane')) return 'hurricane';

    return 'unknown';
}

function addAlertAnimationCSS() {
    if (document.getElementById('alert-animation-css')) return;

    const style = document.createElement('style');
    style.id = 'alert-animation-css';
    style.textContent = `
        /* Pulsing animation for extreme alert polygons */
        @keyframes extreme-alert-pulse {
            0%, 100% {
                stroke-opacity: 0.9;
                fill-opacity: 0.3;
                stroke-width: 3px;
            }
            50% {
                stroke-opacity: 1;
                fill-opacity: 0.5;
                stroke-width: 5px;
            }
        }

        /* Pulsing animation for severe alert polygons */
        @keyframes severe-alert-pulse {
            0%, 100% {
                stroke-opacity: 0.8;
                fill-opacity: 0.25;
                stroke-width: 2.5px;
            }
            50% {
                stroke-opacity: 0.9;
                fill-opacity: 0.35;
                stroke-width: 3.5px;
            }
        }

        /* Text pulsing for popups */
        @keyframes pulse-text {
            0%, 100% {
                opacity: 1;
            }
            50% {
                opacity: 0.7;
            }
        }

        /* Apply animation to extreme alert polygons */
        .extreme-alert-polygon {
            animation: extreme-alert-pulse 2s infinite ease-in-out;
        }

        /* Apply animation to severe alert polygons */
        .severe-alert-polygon {
            animation: severe-alert-pulse 3s infinite ease-in-out;
        }
    `;

    document.head.appendChild(style);
}

function showMapLoadingIndicator(message = 'Loading...') {
    let loadingElement = document.getElementById('map-data-loading');

    if (!loadingElement) {
        loadingElement = document.createElement('div');
        loadingElement.id = 'map-data-loading';
        loadingElement.style.position = 'absolute';
        loadingElement.style.top = '10px';
        loadingElement.style.right = '10px';
        loadingElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        loadingElement.style.color = 'white';
        loadingElement.style.padding = '8px 12px';
        loadingElement.style.borderRadius = '4px';
        loadingElement.style.zIndex = '1000';
        loadingElement.style.display = 'flex';
        loadingElement.style.alignItems = 'center';
        loadingElement.style.fontSize = '12px';
        loadingElement.innerHTML = `
            <div style="display: flex; margin-right: 8px;">
                <div style="width: 6px; height: 6px; background-color: white; border-radius: 50%; margin: 0 2px; animation: map-loading-bounce 1.4s infinite ease-in-out both; animation-delay: -0.32s;"></div>
                <div style="width: 6px; height: 6px; background-color: white; border-radius: 50%; margin: 0 2px; animation: map-loading-bounce 1.4s infinite ease-in-out both; animation-delay: -0.16s;"></div>
                <div style="width: 6px; height: 6px; background-color: white; border-radius: 50%; margin: 0 2px; animation: map-loading-bounce 1.4s infinite ease-in-out both;"></div>
            </div>
            <div>${message}</div>
        `;

        if (!document.getElementById('map-loading-animation')) {
            const animStyle = document.createElement('style');
            animStyle.id = 'map-loading-animation';
            animStyle.textContent = `
                @keyframes map-loading-bounce {
                    0%, 80%, 100% { transform: scale(0); }
                    40% { transform: scale(1); }
                }
            `;
            document.head.appendChild(animStyle);
        }

        const mapContainer = document.getElementById('modal-map-container');
        if (mapContainer) {
            mapContainer.appendChild(loadingElement);
        }
    } else {
        const textElement = loadingElement.querySelector('div:last-child');
        if (textElement) {
            textElement.textContent = message;
        }

        loadingElement.style.display = 'flex';
    }
}

function hideMapLoadingIndicator() {
    const loadingElement = document.getElementById('map-data-loading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

function showMapErrorMessage(message) {
    let errorElement = document.getElementById('map-data-error');

    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.id = 'map-data-error';
        errorElement.style.position = 'absolute';
        errorElement.style.top = '10px';
        errorElement.style.right = '10px';
        errorElement.style.backgroundColor = 'rgba(244, 67, 54, 0.8)';
        errorElement.style.color = 'white';
        errorElement.style.padding = '8px 12px';
        errorElement.style.borderRadius = '4px';
        errorElement.style.zIndex = '1000';
        errorElement.style.fontSize = '12px';
        errorElement.style.maxWidth = '80%';

        const mapContainer = document.getElementById('modal-map-container');
        if (mapContainer) {
            mapContainer.appendChild(errorElement);
        }
    }

    errorElement.textContent = message;
    errorElement.style.display = 'block';

    // Untracked: error toast auto-hide
    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 5000);
}

function ensureLeafletCSS() {
    if (!document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'resources/leaflet/leaflet.css';
        document.head.appendChild(link);
    }
}

function loadLeafletScript() {
    return new Promise((resolve, reject) => {
        if (window.L) {
            log('Leaflet already loaded');
            resolve();
            return;
        }

        try {
            const script = document.createElement('script');
            script.src = './resources/leaflet/leaflet.js';
            script.async = true;

            script.onload = () => {
                log('Leaflet script loaded successfully');
                resolve();
            };

            script.onerror = (e) => {
                logError('Failed to load Leaflet script:', e);
                reject(new Error('Failed to load Leaflet script'));
            };

            document.head.appendChild(script);
        } catch (err) {
            logError('Error setting up Leaflet script:', err);
            reject(err);
        }
    });
}

function showModalMapError(message) {
    const container = document.getElementById('modal-radar-view');
    if (!container) return;

    let errorElement = container.querySelector('.radar-error');
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'radar-error';
        errorElement.style.position = 'absolute';
        errorElement.style.top = '50%';
        errorElement.style.left = '50%';
        errorElement.style.transform = 'translate(-50%, -50%)';
        errorElement.style.background = 'rgba(0, 0, 0, 0.7)';
        errorElement.style.color = 'white';
        errorElement.style.padding = '15px 20px';
        errorElement.style.borderRadius = '8px';
        errorElement.style.textAlign = 'center';
        errorElement.style.maxWidth = '80%';
        errorElement.style.zIndex = '1000';
        container.appendChild(errorElement);
    }

    errorElement.textContent = message;
    errorElement.style.display = 'block';
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// ---- Singleton + public API ----

const controller = new RadarController();

export function initModalController() {
    controller.init();
}
