/**
 * Daily Forecast Detail Modal
 *
 * Click a 7-day forecast card to open a popup with comprehensive
 * conditions for that day (feels-like, wind, UV, humidity, sun, etc.).
 * Reads from window.currentWeatherData.daily.data — no extra API calls.
 */

import { loadComponentCSS } from '../../utils/cssLoader.js';
import { getDisplayUnits } from '../../utils/units.js';
import { setForecastIcon } from '../visuals/dynamicIcons.js';
import { renderHourlyCurve } from './hourlyCurve.js';
import { log, warn, error as logError } from '../../utils/logger.js';

const MODAL_STATE_ID = 'weather_daily_detail_modal_open';

let modalEl, backdropEl, contentEl, titleEl, backBtnEl;
let isOpen = false;
let historyStateAdded = false;
let cssLoaded = false;

export function initDailyDetail() {
    modalEl = document.getElementById('daily-detail-modal');
    backdropEl = document.getElementById('daily-detail-backdrop');
    contentEl = document.getElementById('daily-detail-content');
    titleEl = document.getElementById('daily-detail-title');
    backBtnEl = document.getElementById('daily-detail-back-button');

    if (!modalEl || !backdropEl || !contentEl) {
        logError('Daily detail modal elements not found');
        return;
    }

    if (!cssLoaded) {
        loadComponentCSS('./styles/dailyDetail.css').catch(err =>
            warn('Failed to load daily detail styles:', err));
        cssLoaded = true;
    }

    if (backBtnEl) backBtnEl.addEventListener('click', () => closeDailyDetail());
    backdropEl.addEventListener('click', () => closeDailyDetail());

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && isOpen) closeDailyDetail();
    });

    window.addEventListener('popstate', () => {
        if (isOpen) closeDailyDetail(true);
    });
}

export function openDailyDetail(dayIndex) {
    const data = window.currentWeatherData;
    const day = data?.daily?.data?.[dayIndex];
    if (!day) {
        warn('No day data for index', dayIndex);
        return;
    }

    contentEl.innerHTML = buildContent(day, data.timezone, dayIndex);
    titleEl.textContent = formatTitle(day.time, data.timezone);

    // Render icon after innerHTML is in place
    const iconEl = contentEl.querySelector('.daily-detail-icon');
    if (iconEl) setForecastIcon(day.icon || 'cloudy', iconEl, true);

    // Render the 24-hour chart for the selected day (or partial for day 0)
    const chartSlot = contentEl.querySelector('.daily-detail-chart-slot');
    if (chartSlot) {
        const dayHours = sliceHoursForDay(data?.hourly?.data || [], day.time, dayIndex);
        if (dayHours.length >= 2) {
            renderHourlyCurve(chartSlot, dayHours, {
                iconStride: 3,
                idPrefix: `daily-detail-curve-${dayIndex}`,
                timezone: data.timezone
            });
        } else {
            chartSlot.remove();
        }
    }

    isOpen = true;
    modalEl.style.display = 'block';
    backdropEl.style.display = 'block';
    document.body.classList.add('modal-open');

    // Defer the class toggle one frame so the CSS transition runs
    requestAnimationFrame(() => {
        modalEl.classList.add('open');
        backdropEl.classList.add('open');
    });

    try {
        history.pushState({ modalId: MODAL_STATE_ID }, document.title, window.location.href);
        historyStateAdded = true;
    } catch (e) {
        logError('Failed to push history state:', e);
    }
}

export function closeDailyDetail(fromPopState = false) {
    if (!isOpen) return;

    if (historyStateAdded && !fromPopState) {
        historyStateAdded = false;
        history.back();
        return;
    }

    historyStateAdded = false;
    isOpen = false;

    modalEl.classList.remove('open');
    backdropEl.classList.remove('open');
    document.body.classList.remove('modal-open');

    setTimeout(() => {
        if (!isOpen) {
            modalEl.style.display = 'none';
            backdropEl.style.display = 'none';
        }
    }, 250);
}

//==============================================================================
// CONTENT BUILDERS
//==============================================================================

function buildContent(day, timezone, dayIndex) {
    return [
        buildHero(day),
        buildTemps(day),
        buildChartSlot(),
        buildDetailGrid(day),
        buildSunRow(day, timezone)
    ].filter(Boolean).join('');
}

function buildChartSlot() {
    // Placeholder; renderHourlyCurve fills it in after innerHTML is set.
    return `<div class="daily-detail-chart-slot"></div>`;
}

/**
 * Slice the hourly array for a specific day.
 * - Day 0: from the current hour to end-of-day (partial; past hours not in array
 *   for Pirate Weather and not shown for Open-Meteo either, for parity).
 * - Day 1+: full 24-hour window using the day's midnight timestamp as the anchor.
 */
function sliceHoursForDay(allHours, dayStartSec, dayIndex) {
    if (!Array.isArray(allHours) || allHours.length === 0) return [];
    const dayEndSec = dayStartSec + 24 * 3600;
    const nowSec = Date.now() / 1000;
    const startCutoff = dayIndex === 0 ? Math.max(dayStartSec, nowSec - 1800) : dayStartSec;
    return allHours.filter(h => h.time >= startCutoff && h.time < dayEndSec);
}

function buildHero(day) {
    const summary = escapeHtml(day.summary || '');
    return `
        <div class="daily-detail-hero">
            <div class="daily-detail-icon"></div>
            ${summary ? `<div class="daily-detail-summary">${summary}</div>` : ''}
        </div>`;
}

function buildTemps(day) {
    const metric = getDisplayUnits() === 'metric';
    const high = formatTempBare(day.temperatureHigh, metric);
    const low = formatTempBare(day.temperatureLow, metric);

    let feelsLike = '';
    if (day.apparentTemperatureHigh != null && day.apparentTemperatureLow != null) {
        const highDiff = Math.abs(day.apparentTemperatureHigh - day.temperatureHigh);
        const lowDiff = Math.abs(day.apparentTemperatureLow - day.temperatureLow);
        // Only show feels-like when meaningfully different
        if (highDiff >= 3 || lowDiff >= 3) {
            const ahigh = formatTempBare(day.apparentTemperatureHigh, metric);
            const alow = formatTempBare(day.apparentTemperatureLow, metric);
            feelsLike = `<div class="daily-detail-feels">Feels like ${ahigh} / ${alow}</div>`;
        }
    }

    return `
        <div class="daily-detail-temps">
            <div class="daily-detail-temp-main">
                <span class="temp-high">${high}</span>
                <span class="temp-sep">/</span>
                <span class="temp-low">${low}</span>
            </div>
            ${feelsLike}
        </div>`;
}

function buildDetailGrid(day) {
    const metric = getDisplayUnits() === 'metric';
    const cells = [];

    // Precipitation chance — always shown to keep grid layout stable.
    // Use day.precipChance (max) so this matches the value shown on the daily card.
    const precipChance = day.precipChance != null ? day.precipChance : 0;
    cells.push(detailCell('bi-droplet-half', 'Chance of Precip', `${Math.round(precipChance)}%`));

    // Precipitation amount
    if (day.precipSum != null && day.precipSum > 0) {
        const value = metric ? `${day.precipSum.toFixed(1)} mm` : `${(day.precipSum * 0.0393701).toFixed(2)} in`;
        cells.push(detailCell('bi-cloud-rain', 'Precip Amount', value));
    }

    // Precip hours
    if (day.precipHours != null && day.precipHours > 0) {
        cells.push(detailCell('bi-clock', 'Precip Hours', `${Math.round(day.precipHours)} h`));
    }

    // Snowfall
    if (day.snowfallSum != null && day.snowfallSum > 0) {
        const value = metric ? `${day.snowfallSum.toFixed(1)} cm` : `${(day.snowfallSum * 0.393701).toFixed(1)} in`;
        cells.push(detailCell('bi-snow', 'Snowfall', value));
    }

    // Wind speed + direction (combined when both available)
    if (day.windMax != null) {
        const speed = metric ? `${Math.round(day.windMax * 1.60934)} km/h` : `${Math.round(day.windMax)} mph`;
        const dir = day.windDirection != null
            ? ` ${degreesToCardinal(day.windDirection)}`
            : '';
        cells.push(detailCell('bi-wind', 'Max Wind', speed + dir));
    }

    if (day.windGustsMax != null) {
        const gusts = metric ? `${Math.round(day.windGustsMax * 1.60934)} km/h` : `${Math.round(day.windGustsMax)} mph`;
        cells.push(detailCell('bi-wind', 'Max Gusts', gusts));
    }

    if (day.uvIndex != null) {
        cells.push(detailCell('bi-sun', 'UV Index', `${Math.round(day.uvIndex)} (${uvLabel(day.uvIndex)})`));
    }

    if (day.humidity != null) {
        cells.push(detailCell('bi-moisture', 'Humidity', `${Math.round(day.humidity * 100)}%`));
    }

    if (day.dewPoint != null) {
        const dp = metric
            ? `${Math.round((day.dewPoint - 32) * (5 / 9))}°C`
            : `${Math.round(day.dewPoint)}°F`;
        cells.push(detailCell('bi-thermometer-half', 'Dew Point', dp));
    }

    if (day.cloudCover != null) {
        cells.push(detailCell('bi-clouds', 'Cloud Cover', `${Math.round(day.cloudCover)}%`));
    }

    if (day.visibility != null) {
        const vis = metric
            ? `${(day.visibility * 1.60934).toFixed(1)} km`
            : `${day.visibility.toFixed(1)} mi`;
        cells.push(detailCell('bi-eye', 'Visibility', vis));
    }

    if (cells.length === 0) return '';

    return `<div class="daily-detail-grid">${cells.join('')}</div>`;
}

function detailCell(iconClass, label, value) {
    return `
        <div class="daily-detail-cell">
            <i class="bi ${iconClass}"></i>
            <div class="daily-detail-cell-text">
                <div class="daily-detail-cell-label">${label}</div>
                <div class="daily-detail-cell-value">${value}</div>
            </div>
        </div>`;
}

function buildSunRow(day, timezone) {
    if (day.sunrise == null && day.sunset == null) return '';

    const sunrise = day.sunrise != null ? formatTime(day.sunrise, timezone) : '—';
    const sunset = day.sunset != null ? formatTime(day.sunset, timezone) : '—';

    return `
        <div class="daily-detail-sun">
            <div class="daily-detail-sun-item">
                <i class="bi bi-sunrise"></i>
                <div class="daily-detail-sun-text">
                    <div class="daily-detail-sun-label">Sunrise</div>
                    <div class="daily-detail-sun-value">${sunrise}</div>
                </div>
            </div>
            <div class="daily-detail-sun-item">
                <i class="bi bi-sunset"></i>
                <div class="daily-detail-sun-text">
                    <div class="daily-detail-sun-label">Sunset</div>
                    <div class="daily-detail-sun-value">${sunset}</div>
                </div>
            </div>
        </div>`;
}

//==============================================================================
// HELPERS
//==============================================================================

function formatTempBare(tempF, metric) {
    if (tempF == null) return '—';
    const value = metric ? (tempF - 32) * (5 / 9) : tempF;
    return `${Math.round(value)}°`;
}

function formatTitle(unixSeconds, timezone) {
    const date = new Date(unixSeconds * 1000);
    const opts = {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    };
    if (timezone && timezone !== 'auto') opts.timeZone = timezone;
    try {
        return date.toLocaleDateString('en-US', opts);
    } catch (e) {
        return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    }
}

function formatTime(unixSeconds, timezone) {
    const date = new Date(unixSeconds * 1000);
    const opts = {
        hour: 'numeric',
        minute: '2-digit'
    };
    if (timezone && timezone !== 'auto') opts.timeZone = timezone;
    try {
        return date.toLocaleTimeString('en-US', opts);
    } catch (e) {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
}

function degreesToCardinal(deg) {
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return dirs[Math.round(deg / 22.5) % 16];
}

function uvLabel(uv) {
    if (uv < 3) return 'Low';
    if (uv < 6) return 'Moderate';
    if (uv < 8) return 'High';
    if (uv < 11) return 'Very High';
    return 'Extreme';
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
