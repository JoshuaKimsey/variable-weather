/**
 * Hourly Curve Chart
 *
 * Renders a temperature curve with precipitation bars, dots, gridlines,
 * axis labels, and an interactive hover tooltip. Shared between the main
 * page's "next 12 hours" chart and the per-day chart in the daily detail modal.
 */

import { getDisplayUnits } from '../../utils/units.js';
import { setForecastIcon } from '../visuals/dynamicIcons.js';

// Chart geometry — SVG viewBox is stretched to container width via
// preserveAspectRatio="none"; vector-effect on the line keeps stroke uniform.
const VIEWBOX_W = 1200;
const VIEWBOX_H = 200;
const PRECIP_BAR_MAX_HEIGHT_PCT = 100;
// Horizontal data inset: the first/last data points sit X_INSET_PCT in from
// each edge of the chart. The left gutter holds the axis labels; the right
// gutter keeps the final hour's icon/label from hanging off the card.
const X_INSET_PCT = 10;

/**
 * Render the curve into a container.
 * @param {HTMLElement} container - destination DOM element (contents will be replaced)
 * @param {Array}      hours      - hourly forecast objects (chronological)
 * @param {Object}     [options]
 * @param {number}     [options.iconStride=1]  - render icon + label every Nth hour
 * @param {string}     [options.idPrefix]      - unique id prefix for elements
 *                                               (required when multiple charts share a page)
 * @param {string}     [options.timezone]      - IANA timezone for hour labels;
 *                                               defaults to user's local TZ if absent
 */
export function renderHourlyCurve(container, hours, options = {}) {
    const { iconStride = 1, idPrefix = 'hourly-curve', timezone } = options;
    const tzForLabels = (timezone && timezone !== 'auto') ? timezone : undefined;

    if (!container) return;

    if (!hours || hours.length === 0) {
        container.innerHTML = '<div class="no-forecast">No hourly forecast data available</div>';
        return;
    }

    const metric = getDisplayUnits() === 'metric';
    const tempsDisplay = hours.map(h => metric ? (h.temperature - 32) * (5 / 9) : h.temperature);

    const tMin = Math.min(...tempsDisplay);
    const tMax = Math.max(...tempsDisplay);
    let tMinPad = tMin;
    let tMaxPad = tMax;
    // Guard against a zero range (all hours rounded to the same temperature)
    if (tMaxPad - tMinPad < 1) {
        const mid = (tMaxPad + tMinPad) / 2;
        tMinPad = mid - 0.5;
        tMaxPad = mid + 0.5;
    }
    const yScale = (t) => VIEWBOX_H * (1 - (t - tMinPad) / (tMaxPad - tMinPad));

    // Inset the data area so the first/last points don't collide with the
    // axis labels (left) or hang off the chart edge (right).
    const xLeft = VIEWBOX_W * (X_INSET_PCT / 100);
    const xUsable = VIEWBOX_W - 2 * xLeft;
    const xStep = xUsable / hours.length;
    const points = tempsDisplay.map((t, i) => ({
        x: xLeft + xStep * (i + 0.5),
        y: yScale(t)
    }));

    const linePath = smoothPath(points);
    const firstP = points[0];
    const lastP = points[points.length - 1];
    const areaPath = `${linePath} L ${lastP.x.toFixed(1)} ${VIEWBOX_H} L ${firstP.x.toFixed(1)} ${VIEWBOX_H} Z`;

    const tMid = (tMin + tMax) / 2;
    const highYPct = (yScale(tMax) / VIEWBOX_H) * 100;
    const midYPct = (yScale(tMid) / VIEWBOX_H) * 100;
    const lowYPct = (yScale(tMin) / VIEWBOX_H) * 100;

    const pointsMarkup = points.map((p) => {
        const xPct = (p.x / VIEWBOX_W) * 100;
        const yPct = (p.y / VIEWBOX_H) * 100;
        return `<div class="hourly-curve-point" style="left: ${xPct.toFixed(2)}%; top: ${yPct.toFixed(2)}%;"></div>`;
    }).join('');

    const precipBarsMarkup = hours.map((h, i) => {
        const chance = h.precipChance != null ? h.precipChance : 0;
        if (chance <= 0) return '';
        const intensity = h.precipIntensity != null ? h.precipIntensity : 0;
        const heightPct = (chance / 100) * PRECIP_BAR_MAX_HEIGHT_PCT;
        // Cap alpha so the temperature curve stays visible through tall bars.
        const alpha = Math.max(0.30, Math.min(0.55, 0.30 + intensity / 12));
        // Match the data-point x positions (insetted) so bars line up with dots.
        const xPct = (points[i].x / VIEWBOX_W) * 100;
        return `<div class="hourly-curve-precip-bar"
                     style="left: ${xPct.toFixed(2)}%;
                            height: ${heightPct.toFixed(2)}%;
                            background-color: rgba(41, 182, 246, ${alpha.toFixed(2)});"></div>`;
    }).join('');

    // Columns row. With stride > 1, icons + labels render at every Nth hour
    // (and always at the last hour so the chart's right edge is anchored).
    // gap stays 0 so column centers exactly match the curve's data-point x
    // positions; visual separation comes from the icons + labels themselves.
    const gridGap = '0';
    const columnsMarkup = hours.map((h, i) => {
        const showIcon = shouldShowMarker(i, hours.length, iconStride);
        const chance = h.precipChance != null ? h.precipChance : 0;
        // Always format from the timestamp using location's TZ — ignore
        // formattedTime since legacy parsers used the user's TZ.
        const timeString = formatHourLabel(h.time, tzForLabels);
        const tempStr = `${Math.round(tempsDisplay[i])}°`;
        const precipAria = chance > 0 ? `, ${chance}% chance of precipitation` : '';
        return `
            <div class="hourly-curve-col" data-hour-index="${i}"
                 role="button" tabindex="0"
                 aria-label="${timeString}: ${tempStr}${precipAria}">
                ${showIcon ? `<div class="hourly-curve-icon" id="${idPrefix}-icon-${i}" aria-hidden="true"></div>` : ''}
                ${showIcon ? `<div class="hourly-curve-time">${timeString}</div>` : ''}
            </div>`;
    }).join('');

    container.innerHTML = `
        <div class="hourly-curve">
            <div class="hourly-curve-chart">
                <div class="hourly-curve-precip-bars" aria-hidden="true">${precipBarsMarkup}</div>
                <div class="hourly-curve-gridline" style="top: ${highYPct.toFixed(2)}%;" aria-hidden="true"></div>
                <div class="hourly-curve-gridline" style="top: ${midYPct.toFixed(2)}%;" aria-hidden="true"></div>
                <div class="hourly-curve-gridline" style="top: ${lowYPct.toFixed(2)}%;" aria-hidden="true"></div>
                <div class="hourly-curve-axis" aria-hidden="true">
                    <span class="hourly-curve-axis-label" style="top: ${highYPct.toFixed(2)}%;">${Math.round(tMax)}°</span>
                    <span class="hourly-curve-axis-label" style="top: ${midYPct.toFixed(2)}%;">${Math.round(tMid)}°</span>
                    <span class="hourly-curve-axis-label" style="top: ${lowYPct.toFixed(2)}%;">${Math.round(tMin)}°</span>
                </div>
                <svg class="hourly-curve-svg" viewBox="0 0 ${VIEWBOX_W} ${VIEWBOX_H}" preserveAspectRatio="none" aria-hidden="true">
                    <defs>
                        <linearGradient id="${idPrefix}-fill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="rgba(255, 167, 38, 0.55)" />
                            <stop offset="100%" stop-color="rgba(255, 167, 38, 0)" />
                        </linearGradient>
                    </defs>
                    <path class="hourly-curve-area" d="${areaPath}" fill="url(#${idPrefix}-fill)" />
                    <path class="hourly-curve-line" d="${linePath}"
                          fill="none" stroke="#ffa726" stroke-width="3"
                          stroke-linecap="round" stroke-linejoin="round"
                          vector-effect="non-scaling-stroke" />
                </svg>
                <div class="hourly-curve-points" aria-hidden="true">${pointsMarkup}</div>
                <div class="hourly-curve-marker" hidden>
                    <div class="hourly-curve-marker-dot"></div>
                    <div class="hourly-curve-tooltip">
                        <div class="hourly-curve-tooltip-time"></div>
                        <div class="hourly-curve-tooltip-temp"></div>
                        <div class="hourly-curve-tooltip-precip"></div>
                    </div>
                </div>
            </div>
            <div class="hourly-curve-columns" style="grid-template-columns: repeat(${hours.length}, 1fr); gap: ${gridGap}; padding-left: ${X_INSET_PCT}%; padding-right: ${X_INSET_PCT}%; box-sizing: border-box;">${columnsMarkup}</div>
        </div>`;

    hours.forEach((h, i) => {
        if (!shouldShowMarker(i, hours.length, iconStride)) return;
        const el = container.querySelector(`#${idPrefix}-icon-${i}`);
        if (el) setForecastIcon(h.icon || 'cloudy', el, h.isDaytime);
    });

    wireInteractions(container, hours, points, tempsDisplay, metric, tzForLabels);
}

function shouldShowMarker(i, total, stride) {
    if (stride <= 1) return true;
    return (i % stride === 0) || i === total - 1;
}

// Catmull-Rom-to-Bezier smoothing
function smoothPath(pts) {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[i + 2] || pts[i + 1];
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
}

function wireInteractions(container, hours, points, tempsDisplay, metric, tzForLabels) {
    const root = container.querySelector('.hourly-curve');
    if (!root) return;
    const marker = root.querySelector('.hourly-curve-marker');
    const tipTime = marker?.querySelector('.hourly-curve-tooltip-time');
    const tipTemp = marker?.querySelector('.hourly-curve-tooltip-temp');
    const tipPrecip = marker?.querySelector('.hourly-curve-tooltip-precip');
    if (!marker) return;

    const tempSuffix = metric ? '°C' : '°F';

    const showMarker = (index) => {
        if (index < 0 || index >= hours.length) return;
        const p = points[index];
        const xPct = (p.x / VIEWBOX_W) * 100;
        const yPct = (p.y / VIEWBOX_H) * 100;
        marker.style.left = `${xPct}%`;
        marker.style.top = `${yPct}%`;
        marker.hidden = false;

        const hour = hours[index];
        const timeString = formatHourLabel(hour.time, tzForLabels);
        tipTime.textContent = timeString;
        tipTemp.textContent = `${Math.round(tempsDisplay[index])}${tempSuffix}`;
        const chance = hour.precipChance != null ? hour.precipChance : 0;
        tipPrecip.textContent = chance > 0 ? `${chance}% precip` : 'No precip';

        marker.classList.toggle('flip-left', xPct > 70);
        marker.classList.toggle('flip-right', xPct < 30);
    };

    const hideMarker = () => {
        marker.hidden = true;
    };

    const cols = root.querySelectorAll('.hourly-curve-col');
    cols.forEach((col) => {
        const index = parseInt(col.dataset.hourIndex, 10);
        col.addEventListener('mouseenter', () => showMarker(index));
        col.addEventListener('focus', () => showMarker(index));
        col.addEventListener('click', () => showMarker(index));
        col.addEventListener('blur', hideMarker);
    });
    root.addEventListener('mouseleave', hideMarker);
}

/**
 * Format a Unix-seconds timestamp as a short hour label ("9 AM", "12 PM").
 * Uses the supplied IANA timezone when provided; falls back to user-local.
 */
export function formatHourLabel(unixSec, timezone) {
    const date = new Date(unixSec * 1000);
    const opts = { hour: 'numeric', hour12: true };
    if (timezone) opts.timeZone = timezone;
    try {
        return date.toLocaleTimeString('en-US', opts);
    } catch (e) {
        // Invalid timeZone — fall back to user-local
        return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
    }
}
