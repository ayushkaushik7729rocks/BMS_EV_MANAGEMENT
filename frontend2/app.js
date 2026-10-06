// EV Guardian AI vanilla dashboard. All live values come from the FastAPI API.
const API_BASE = window.EV_GUARDIAN_API_BASE || 'http://127.0.0.1:8000';
const titles = {
  dashboard: 'Dashboard',
  health: 'Battery health',
  thermal: 'Thermal analysis',
  alerts: 'Alerts & events',
  system: 'Device & system'
};
let telemetry = null;
let currentPage = 'dashboard';
let apiOnline = false;
let apiError = null;
let chartLabels = [];
let chartObserved = [];
let chartPredicted = [];
let hoveredIndex = -1;

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const number = (value, digits = 1) => finite(value) ? Number(value).toFixed(digits) : 'N/A';
const timeAgo = value => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (!Number.isFinite(seconds)) return 'time unavailable';
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
};

function normalizeStatus(status) {
  const cells = Object.entries(status.temperatures || {}).map(([key, temp], index) => ({
    key,
    name: `Cell ${String(index + 1).padStart(2, '0')}`,
    temp: Number(temp)
  }));
  const alerts = (status.alerts || []).map(alert => ({
    id: alert.id,
    title: alert.title,
    detail: alert.detail,
    timestamp: alert.timestamp,
    time: timeAgo(alert.timestamp),
    severity: alert.severity,
    ack: Boolean(alert.acknowledged)
  }));
  return {
    deviceId: status.device_id,
    timestamp: status.timestamp,
    soc: Number(status.soc),
    soh: status.soh == null ? null : Number(status.soh),
    voltage: Number(status.voltage),
    current: Number(status.current),
    power: Number(status.power),
    temperature: Number(status.average_temperature_c),
    maxTemperature: Number(status.maximum_temperature_c),
    cells,
    threshold: status.thermal?.threshold_c == null ? null : Number(status.thermal.threshold_c),
    predictedTemperature: status.thermal?.predicted_temperature_10min == null ? null : Number(status.thermal.predicted_temperature_10min),
    predictionSource: status.thermal?.prediction_source || 'unavailable',
    risk: status.thermal?.risk || 'UNCONFIGURED',
    riskExplanation: status.thermal?.explanation || '',
    minutes: status.thermal?.estimated_time_to_threshold_minutes == null ? null : Number(status.thermal.estimated_time_to_threshold_minutes),
    temperatureHistory: status.temperature_history || [],
    alerts,
    connected: Boolean(status.device_connected),
    source: status.source || 'unknown',
    scenario: status.scenario || null,
    fan: Number(status.fan_speed_percent || 0),
    coolingActive: Boolean(status.cooling_active)
  };
}

function updateChartData() {
  const points = telemetry?.temperatureHistory || [];
  chartLabels = points.map(point => new Date(point.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  chartObserved = points.map(point => Number(point.average_temperature_c));
  chartPredicted = Array(chartLabels.length).fill(null);
  if (chartLabels.length && Number.isFinite(telemetry.predictedTemperature)) {
    chartPredicted[chartLabels.length - 1] = chartObserved[chartObserved.length - 1];
    const future = new Date(points[points.length - 1].timestamp);
    future.setMinutes(future.getMinutes() + 10);
    chartLabels.push(future.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    chartObserved.push(null);
    chartPredicted.push(telemetry.predictedTemperature);
  }
}

async function refreshTelemetry() {
  try {
    const response = await fetch(`${API_BASE}/api/battery/status`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Backend returned HTTP ${response.status}`);
    telemetry = normalizeStatus(await response.json());
    apiOnline = true;
    apiError = null;
  } catch (error) {
    apiOnline = false;
    apiError = error.message || 'Could not reach the backend';
  }
  updateChartData();
  render(currentPage, true);
}

async function acknowledgeAlert(id) {
  try {
    const response = await fetch(`${API_BASE}/api/alerts/${encodeURIComponent(id)}/acknowledge`, { method: 'POST' });
    if (!response.ok) throw new Error(`Backend returned HTTP ${response.status}`);
    await refreshTelemetry();
  } catch (error) {
    apiError = error.message || 'Could not acknowledge alert';
    apiOnline = false;
    render(currentPage, true);
  }
}

const heading = (eyebrow, title, text) => `<div class="page-heading detail-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${text}</p></div></div>`;
const metric = (icon, label, value, unit, note, color = '') => `<article class="metric-card"><div class="metric-icon ${color}">${icon}</div><div class="metric-label">${label}</div><div class="metric-value">${value}<small>${unit}</small></div><div class="metric-note">${note}</div></article>`;
const chart = '<div class="chart-wrap"><canvas id="temperature-chart" aria-label="Observed and projected battery temperature chart"></canvas><div class="chart-tooltip" hidden></div></div>';
const legend = () => `<div class="chart-legend"><span><i class="legend-observed"></i>Observed average</span><span><i class="legend-predicted"></i>10 min estimate</span>${Number.isFinite(telemetry?.threshold) ? '<span class="legend-limit"><i></i>Configured limit</span>' : ''}</div>`;
const footer = () => `<footer class="page-footer"><span>EV GUARDIAN AI &middot; SMART PREDICTIVE BMS</span><span><i class="footer-live"></i> ${apiOnline ? `${telemetry.source.toUpperCase()} DATA` : 'API OFFLINE'} &middot; ${apiError ? 'UPDATE FAILED' : 'LIVE'}</span></footer>`;

function batteryHealthBand(soh) {
  if (!Number.isFinite(soh)) return { key: 'unknown', label: 'Not measured', color: '#94a3a8' };
  if (soh >= 90) return { key: 'healthy', label: 'Healthy', color: '#4bd2a4' };
  if (soh >= 75) return { key: 'watch', label: 'Watch', color: '#efb261' };
  return { key: 'critical', label: 'Critical', color: '#ee716b' };
}
function riskLabel(risk = 'UNCONFIGURED') {
  return risk.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}
function batteryPositionMarker(band) {
  const sohText = Number.isFinite(telemetry.soh) ? `${telemetry.soh.toFixed(1)}%` : 'SOH N/A';
  return `<div class="battery-position-marker" aria-label="Battery pack health: ${band.label}, ${sohText}"><span class="battery-position-pulse"></span><span class="battery-position-icon">&#9889;</span><span class="battery-position-label">PACK &middot; ${sohText}</span></div>`;
}
function alertsList(items) {
  if (!items.length) return '<div class="empty-state">No alerts have been recorded for this device.</div>';
  return `<div class="alerts-list">${items.map(alert => `<div class="alert-row"><div class="alert-icon ${escapeHtml(alert.severity)}">${alert.severity === 'warning' || alert.severity === 'critical' ? '&#9888;' : 'i'}</div><div class="alert-copy"><b>${escapeHtml(alert.title)}</b><span>${escapeHtml(alert.detail)}</span></div><time>${escapeHtml(alert.time)}</time>${alert.ack ? '<span class="ack-check">&#10003;</span>' : `<button class="ack-button" data-ack="${escapeHtml(alert.id)}" aria-label="Acknowledge ${escapeHtml(alert.title)}">Acknowledge</button>`}</div>`).join('')}</div>`;
}

function dashboard() {
  const band = batteryHealthBand(telemetry.soh);
  const risk = riskLabel(telemetry.risk);
  const delta = telemetry.cells.length ? Math.max(...telemetry.cells.map(cell => cell.temp)) - Math.min(...telemetry.cells.map(cell => cell.temp)) : null;
  const eta = Number.isFinite(telemetry.minutes) ? `~${telemetry.minutes} min` : 'N/A';
  const systemStatus = telemetry.connected ? 'CONNECTED' : 'STALE';
  return `<div class="page-heading"><div><div class="eyebrow">OVERVIEW &middot; PACK MONITORING</div><h1>Battery status <span class="wave">&#10033;</span></h1><p>Latest readings from ${escapeHtml(telemetry.deviceId)}.</p></div><div class="greeting-model health-${band.key}"><model-viewer src="assets/tesla-model-s.glb" alt="Interactive 3D car with battery health position highlighted" camera-controls auto-rotate auto-rotate-delay="0" rotation-per-second="5deg" camera-orbit="90deg 70deg 5.5m" loading="eager" interaction-prompt="none" shadow-intensity="0.7"></model-viewer>${batteryPositionMarker(band)}</div><button class="outline-button" data-go="thermal">View thermal analysis</button></div>
<section class="hero-card"><div class="hero-copy"><div class="hero-kicker"><span class="pulse-dot"></span> SYSTEM ${systemStatus}</div><h2>Battery risk<br><span>${risk}</span></h2><p>${escapeHtml(telemetry.riskExplanation || 'Thermal status is not configured.')}</p><div class="hero-meta"><div><span>PACK CONFIGURATION</span><b>1S4P &middot; Li-ion</b></div><div><span>DATA SOURCE</span><b><i class="green-dot"></i>${telemetry.source === 'mock' ? 'Backend mock' : 'Hardware telemetry'}</b></div></div></div><div class="battery-art"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="battery-glow"></div><div class="battery-body"><div class="battery-cap"></div><div class="battery-cell c1"></div><div class="battery-cell c2"></div><div class="battery-cell c3"></div><div class="battery-cell c4"></div><div class="battery-lightning">&#9889;</div></div><div class="battery-label">PACK SOC <b>${number(telemetry.soc, 0)}%</b></div></div><div class="hero-status"><div class="status-ring">&#9888;</div><div><b>${risk}</b><span>${escapeHtml(telemetry.predictionSource.replaceAll('_', ' '))}</span></div><span>&bull;&bull;&bull;</span></div></section>
<section class="metric-grid">${metric('SOC', 'State of charge', number(telemetry.soc, 1), '%', 'Reported telemetry')}${metric('V', 'Pack voltage', number(telemetry.voltage, 2), 'V', 'Measured voltage', 'blue')}${metric('A', 'Current draw', number(telemetry.current, 2), 'A', 'Measured current', 'amber')}${metric('W', 'Power output', number(telemetry.power, 2), 'W', 'Measured or V x A', 'violet')}</section>
<div class="content-grid"><section class="panel chart-panel"><div class="panel-header"><div><div class="panel-title">Thermal behavior</div><div class="panel-subtitle">Backend history and 10 minute temperature estimate</div></div><span class="demo-badge">${escapeHtml(telemetry.source.toUpperCase())}</span></div>${legend()}${chart}<div class="chart-footer"><div><small>AVERAGE PACK TEMP</small><b>${number(telemetry.temperature, 1)}<i>&deg;C</i></b></div><div class="chart-callout">Time to configured limit <b>${eta}</b></div></div></section>
<section class="panel cell-panel"><div class="panel-header"><div><div class="panel-title">Cell temperatures</div><div class="panel-subtitle">Four channels from the active telemetry source</div></div></div><div class="cell-visual"><div class="cell-pack">${telemetry.cells.map((cell, index) => `<div class="cell-bar ${cell.temp === telemetry.maxTemperature ? 'watch' : 'normal'}"><div class="cell-fill" style="height:${Math.max(0, Math.min(100, (cell.temp - 20) * 2.9))}%"></div><span>${String(index + 1).padStart(2, '0')}</span></div>`).join('')}</div><div class="cell-scale"><span>COOLER</span><span>HOTTER</span></div></div><div class="cell-list">${telemetry.cells.map(cell => `<div class="cell-row"><span><i class="cell-status ${cell.temp === telemetry.maxTemperature ? 'watch' : 'normal'}"></i>${cell.name}</span><b>${number(cell.temp)}&deg;<small>C</small></b></div>`).join('')}</div><div class="cell-foot"><span>Cell temperature spread</span><b>${number(delta)}&deg;C</b></div></section></div>
<div class="bottom-grid"><section class="panel risk-panel"><div class="panel-title">Thermal risk assessment</div><div class="risk-body"><div class="risk-meter"><div class="risk-meter-center"><b>${risk}</b><span>THERMAL RISK</span></div></div><div class="risk-copy"><span class="risk-tag">${risk.toUpperCase()}</span><h3>${escapeHtml(telemetry.riskExplanation)}</h3><p>The model is advisory; the hardware BMS remains the protection layer.</p><button class="text-link" data-go="thermal">Open thermal analysis</button></div></div><div class="risk-scale"><span>NORMAL</span><div><i></i></div><span>CRITICAL</span></div></section><section class="panel cooling-panel"><div class="panel-header"><div><div class="panel-title">Cooling system</div><div class="panel-subtitle">Development fan indicator from backend</div></div><span class="active-label">${telemetry.coolingActive ? 'ACTIVE' : 'STANDBY'}</span></div><div class="fan-row"><div class="fan-icon">&#10045;</div><div><b>Cooling output</b><span>Reported by API</span></div><strong>${telemetry.fan}<small>%</small></strong></div><div class="fan-track"><i style="width:${telemetry.fan}%"></i></div><div class="cooling-foot"><span>Current fan output</span><b>${telemetry.fan}%</b></div></section></div>
<div class="bottom-grid last-row"><section class="panel"><div class="panel-header"><div><div class="panel-title">Recent alerts</div><div class="panel-subtitle">Latest events from this device</div></div><button class="text-link" data-go="alerts">View all</button></div>${alertsList(telemetry.alerts.slice(0, 2))}</section><section class="panel condition-panel"><div class="panel-title">System condition</div><div class="condition-line"><span><i></i> Backend</span><b>${apiOnline ? 'Online' : 'Offline'}</b></div><div class="condition-line"><span><i></i> Temperature channels</span><b>${telemetry.cells.length} / 4</b></div><div class="condition-line"><span><i></i> Device feed</span><b>${telemetry.connected ? 'Fresh' : 'Stale'}</b></div></section></div>`;
}

function healthPage() {
  const band = batteryHealthBand(telemetry.soh);
  return `${heading('BATTERY INTELLIGENCE', 'Battery health', 'Track reported charge, pack readings, and four-channel temperature spread.')}<div class="metric-grid">${metric('SOC', 'State of charge', number(telemetry.soc), '%', 'Reported value')}${metric('SOH', 'State of health', number(telemetry.soh), Number.isFinite(telemetry.soh) ? '%' : '', 'Optional source estimate', 'blue')}${metric('V', 'Pack voltage', number(telemetry.voltage, 2), 'V', 'Measured voltage', 'amber')}${metric('W', 'Power output', number(telemetry.power, 2), 'W', 'Measured or V x A', 'violet')}</div><div class="detail-cols"><section class="panel health-score"><div class="panel-title">Pack health score</div><div class="health-number">${number(telemetry.soh)}<small>${Number.isFinite(telemetry.soh) ? '%' : ''}</small></div><div class="health-status">${band.label}</div><div class="health-meter"><i style="width:${Number.isFinite(telemetry.soh) ? telemetry.soh : 0}%;background:${band.color}"></i></div><p>SOH is displayed only when the active telemetry source reports it; it is not inferred by this dashboard.</p></section><section class="panel"><div class="panel-title">Cell temperature spread</div><div class="panel-subtitle">Four sensor channels</div>${telemetry.cells.map(cell => `<div class="balance-row"><span>${cell.name}</span><div class="balance-track"><i style="width:${Math.max(0, Math.min(100, (cell.temp - 20) * 2.9))}%"></i></div><b>${number(cell.temp)}&deg;C</b><span class="ok-chip">${cell.temp === telemetry.maxTemperature ? 'Hottest' : 'Measured'}</span></div>`).join('')}</section></div>`;
}

function thermalPage() {
  const band = batteryHealthBand(telemetry.soh);
  const sohLabel = Number.isFinite(telemetry.soh) ? `${telemetry.soh.toFixed(1)}%` : 'SOH not measured';
  const eta = Number.isFinite(telemetry.minutes) ? `~${telemetry.minutes}` : 'N/A';
  return `${heading('PREDICTIVE SAFETY', 'Thermal analysis', 'Review the hottest sensor, recent history, and the model estimate.')}<section class="panel thermal-car-panel health-${band.key}" style="--battery-color:${band.color}"><div class="panel-header"><div><div class="panel-title">Vehicle battery location</div><div class="panel-subtitle">Interactive 3D car; pack color follows reported state of health</div></div><span class="health-band-badge"><i></i>${band.label} &middot; ${sohLabel}</span></div><div class="thermal-car-stage"><model-viewer src="assets/tesla-model-s.glb" alt="Interactive rotating car with underfloor battery position highlighted" camera-controls auto-rotate auto-rotate-delay="0" rotation-per-second="4deg" camera-orbit="90deg 70deg 5.5m" loading="eager" interaction-prompt="none" shadow-intensity="0.7"></model-viewer>${batteryPositionMarker(band)}<div class="thermal-car-caption">UNDERFLOOR BATTERY PACK</div></div><div class="battery-health-legend"><span><i class="legend-good"></i>Healthy <b>90-100%</b></span><span><i class="legend-watch"></i>Watch <b>75-89%</b></span><span><i class="legend-critical"></i>Critical <b>&lt;75%</b></span></div></section><section class="panel thermal-summary"><div class="thermal-summary-item"><span>HOTTEST SENSOR</span><b>${number(telemetry.maxTemperature)}&deg;<small>C</small></b><i>Current maximum</i></div><div class="thermal-summary-item"><span>THERMAL RISK</span><b class="watch-text">${riskLabel(telemetry.risk)}</b><i>${escapeHtml(telemetry.riskExplanation)}</i></div><div class="thermal-summary-item"><span>TIME TO CONFIGURED LIMIT</span><b>${eta}<small>${Number.isFinite(telemetry.minutes) ? ' min' : ''}</small></b><i>Trend-based estimate</i></div></section><section class="panel thermal-chart-panel"><div class="panel-header"><div><div class="panel-title">Temperature history and projection</div><div class="panel-subtitle">Observed pack average and backend forecast</div></div><span class="demo-badge">${escapeHtml(telemetry.predictionSource.replaceAll('_', ' ').toUpperCase())}</span></div>${legend()}${chart}<div class="inline-note">The forecast is an advisory estimate. Hardware BMS protections remain authoritative.</div></section><section class="panel cells-wide"><div class="panel-title">Sensor-by-sensor readings</div><div class="wide-cell-grid">${telemetry.cells.map(cell => `<div class="wide-cell"><div>&#9832; <span>${cell.name}</span></div><b>${number(cell.temp)}&deg;<small>C</small></b><span class="status-word ${cell.temp === telemetry.maxTemperature ? 'watch' : 'normal'}">${cell.temp === telemetry.maxTemperature ? 'Hottest channel' : 'Measured'}</span></div>`).join('')}</div></section>`;
}

function alertsPage() {
  const pending = telemetry.alerts.filter(alert => !alert.ack).length;
  return `${heading('EVENT CENTER', 'Alerts & events', 'Review alerts saved by the backend for this device.')}<section class="alert-overview"><div><b>${pending}</b><span>Unacknowledged</span></div><div><b>${telemetry.alerts.length}</b><span>Recent events</span></div><div><b>${telemetry.connected ? 'Connected' : 'Stale'}</b><span>Telemetry feed</span></div></section><section class="panel alerts-page-panel"><div class="panel-header"><div><div class="panel-title">Recent activity</div><div class="panel-subtitle">Newest first &middot; persisted API alerts</div></div><span class="demo-badge">${escapeHtml(telemetry.source.toUpperCase())}</span></div>${alertsList(telemetry.alerts)}</section>`;
}

function systemPage() {
  const state = telemetry.connected ? 'CONNECTED' : 'STALE';
  const sourceLabel = telemetry.source === 'mock' ? 'Backend mock telemetry' : 'Hardware telemetry';
  const sensorRows = [
    ['Voltage', `${number(telemetry.voltage, 2)} V`],
    ['Current', `${number(telemetry.current, 2)} A`],
    ['Power', `${number(telemetry.power, 2)} W`],
    ['Temperature channels', `${telemetry.cells.length} / 4 reporting`]
  ];
  return `${heading('HARDWARE & CONNECTIONS', 'Device & system', 'Check telemetry source, sensor channels, and cooling output.')}<section class="panel device-banner"><div class="device-avatar">&#9881;</div><div class="device-main"><div class="device-online">${state}</div><h2>EV Guardian &middot; ${escapeHtml(telemetry.deviceId)}</h2><p>${escapeHtml(sourceLabel)}${telemetry.scenario ? ` &middot; scenario ${escapeHtml(telemetry.scenario)}` : ''}</p></div><div class="device-seen"><span>LAST TELEMETRY</span><b>${timeAgo(telemetry.timestamp)}</b><small>${apiOnline ? 'API reachable' : 'API offline'}</small></div></section><div class="detail-cols"><section class="panel device-details"><div class="panel-header"><div><div class="panel-title">Reported measurements</div><div class="panel-subtitle">Values in the latest telemetry payload</div></div><span class="active-label">${telemetry.cells.length} / 4</span></div>${sensorRows.map(([label, value]) => `<div class="sensor-row"><div class="sensor-icon">&#10003;</div><div><b>${label}</b><span>${value}</span></div><span class="sensor-state">${telemetry.connected ? 'Connected' : 'Stale'}</span></div>`).join('')}</section><section class="panel cooling-panel device-cooling"><div class="panel-title">Cooling response</div><div class="panel-subtitle">Development fan indicator</div><div class="fan-row"><div class="fan-icon">&#10045;</div><div><b>Fan output</b><span>${telemetry.coolingActive ? 'Active' : 'Standby'}</span></div><strong>${telemetry.fan}<small>%</small></strong></div><div class="fan-track"><i style="width:${telemetry.fan}%"></i></div><div class="cooling-foot"><span>Reported output</span><b>${telemetry.fan}%</b></div></section></div>`;
}

function detail(page) {
  if (page === 'health') return healthPage();
  if (page === 'thermal') return thermalPage();
  if (page === 'alerts') return alertsPage();
  return systemPage();
}

function paintChart() {
  const canvas = document.querySelector('#temperature-chart');
  if (!canvas || chartLabels.length < 2) return;
  const box = canvas.getBoundingClientRect();
  if (!box.width || !box.height) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(box.width * dpr);
  canvas.height = Math.round(box.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const width = box.width, height = box.height;
  const pad = { left: 38, right: 14, top: 14, bottom: 27 };
  const values = [...chartObserved, ...chartPredicted].filter(Number.isFinite);
  if (Number.isFinite(telemetry.threshold)) values.push(telemetry.threshold);
  let min = Math.floor(Math.min(...values) - 2);
  let max = Math.ceil(Math.max(...values) + 2);
  if (max - min < 8) { min -= 2; max += 2; }
  const x = index => pad.left + index * (width - pad.left - pad.right) / (chartLabels.length - 1);
  const y = value => pad.top + (max - value) * (height - pad.top - pad.bottom) / (max - min);
  ctx.clearRect(0, 0, width, height);
  ctx.font = '9px DM Mono, monospace';
  ctx.lineWidth = 1;
  const step = Math.max(1, Math.ceil((max - min) / 5));
  for (let value = Math.ceil(min / step) * step; value <= max; value += step) {
    const py = y(value);
    ctx.strokeStyle = '#263239'; ctx.beginPath(); ctx.moveTo(pad.left, py); ctx.lineTo(width - pad.right, py); ctx.stroke();
    ctx.fillStyle = '#78878b'; ctx.fillText(`${value}\u00b0`, 2, py + 3);
  }
  if (Number.isFinite(telemetry.threshold)) {
    ctx.setLineDash([4, 4]); ctx.strokeStyle = '#dc776d'; ctx.beginPath(); ctx.moveTo(pad.left, y(telemetry.threshold)); ctx.lineTo(width - pad.right, y(telemetry.threshold)); ctx.stroke(); ctx.setLineDash([]);
  }
  const drawLine = (series, color, dashed = false, fill = false) => {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash(dashed ? [5, 4] : []);
    ctx.beginPath(); let started = false;
    series.forEach((value, index) => {
      if (!Number.isFinite(value)) { started = false; return; }
      if (!started) { ctx.moveTo(x(index), y(value)); started = true; }
      else ctx.lineTo(x(index), y(value));
    });
    if (fill && !dashed) {
      const first = series.findIndex(Number.isFinite); let last = series.length - 1;
      while (last >= 0 && !Number.isFinite(series[last])) last--;
      if (first >= 0 && last > first) {
        ctx.lineTo(x(last), height - pad.bottom); ctx.lineTo(x(first), height - pad.bottom); ctx.closePath();
        const gradient = ctx.createLinearGradient(0, pad.top, 0, height - pad.bottom); gradient.addColorStop(0, '#49d6aa33'); gradient.addColorStop(1, '#49d6aa00'); ctx.fillStyle = gradient; ctx.fill();
      }
    }
    ctx.stroke(); ctx.restore();
  };
  drawLine(chartObserved, '#50d5a9', false, true);
  drawLine(chartPredicted, '#edb16c', true);
  chartLabels.forEach((label, index) => {
    if (index % Math.max(1, Math.floor(chartLabels.length / 6)) === 0 || index === chartLabels.length - 1) {
      ctx.fillStyle = '#78878b'; ctx.fillText(label, Math.max(pad.left, Math.min(width - 40, x(index) - 14)), height - 7);
    }
  });
  if (hoveredIndex >= 0 && hoveredIndex < chartLabels.length) {
    const index = hoveredIndex, px = x(index);
    ctx.save(); ctx.strokeStyle = '#9bada9aa'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(px, pad.top); ctx.lineTo(px, height - pad.bottom); ctx.stroke(); ctx.setLineDash([]);
    [[chartObserved[index], '#50d5a9'], [chartPredicted[index], '#edb16c']].forEach(([value, color]) => {
      if (!Number.isFinite(value)) return;
      ctx.beginPath(); ctx.arc(px, y(value), 4, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#10171d'; ctx.stroke();
    }); ctx.restore();
  }
  canvas.dataset.ymin = String(min); canvas.dataset.ymax = String(max);
}

function drawChart() {
  const canvas = document.querySelector('#temperature-chart');
  if (!canvas || chartLabels.length < 2) return;
  if (canvas.dataset.hoverReady) { paintChart(); return; }
  canvas.dataset.hoverReady = 'true';
  const tooltip = canvas.parentElement.querySelector('.chart-tooltip');
  canvas.addEventListener('pointermove', event => {
    const rect = canvas.getBoundingClientRect(), pad = 38;
    const plotWidth = rect.width - pad - 14;
    hoveredIndex = Math.max(0, Math.min(chartLabels.length - 1, Math.round((event.clientX - rect.left - pad) / Math.max(1, plotWidth) * (chartLabels.length - 1))));
    paintChart();
    const rows = [];
    if (Number.isFinite(chartObserved[hoveredIndex])) rows.push(['Observed average', chartObserved[hoveredIndex], '#50d5a9']);
    if (Number.isFinite(chartPredicted[hoveredIndex]) && hoveredIndex > 0) rows.push(['Model estimate', chartPredicted[hoveredIndex], '#edb16c']);
    if (!rows.length) { tooltip.hidden = true; return; }
    tooltip.innerHTML = `<b>${escapeHtml(chartLabels[hoveredIndex])}</b>${rows.map(([name, value, color]) => `<span><i style="background:${color}"></i>${name}<strong>${Number(value).toFixed(1)}&deg;C</strong></span>`).join('')}`;
    tooltip.hidden = false;
    const left = pad + hoveredIndex * plotWidth / Math.max(1, chartLabels.length - 1);
    tooltip.style.left = `${Math.max(42, Math.min(rect.width - 130, left + 12))}px`;
    tooltip.style.top = '8px'; canvas.style.cursor = 'crosshair';
  });
  canvas.addEventListener('pointerleave', () => { hoveredIndex = -1; paintChart(); tooltip.hidden = true; canvas.style.cursor = ''; });
  paintChart();
}

function render(page = currentPage, preserveScroll = false) {
  currentPage = page;
  const mainScroll = document.querySelector('.main-scroll');
  const oldScroll = mainScroll?.scrollTop || 0;
  document.querySelectorAll('.nav-item[data-page]').forEach(button => button.classList.toggle('active', button.dataset.page === page));
  const alertBadge = document.querySelector('.nav-item[data-page="alerts"] em');
  if (alertBadge && telemetry) alertBadge.textContent = String(telemetry.alerts.filter(alert => !alert.ack).length);
  document.querySelector('#crumb').textContent = titles[page] || titles.dashboard;
  const content = document.querySelector('#page-content');
  if (!telemetry) {
    content.innerHTML = `<section class="panel backend-wait"><div class="panel-title">${apiError ? 'Backend connection needed' : 'Connecting to EV Guardian AI'}</div><p>${escapeHtml(apiError || 'Waiting for a telemetry sample from the local API.')}</p><p>Start the FastAPI backend; its development mock supplies telemetry when no ESP32 is connected.</p><button class="outline-button" data-refresh>Retry connection</button></section>${footer()}`;
  } else {
    content.innerHTML = `${page === 'dashboard' ? dashboard() : detail(page)}${footer()}`;
    if (page === 'dashboard' || page === 'thermal') requestAnimationFrame(drawChart);
  }
  if (mainScroll) mainScroll.scrollTop = preserveScroll ? oldScroll : 0;
}

document.addEventListener('click', event => {
  const target = event.target.closest('[data-page],[data-go],[data-refresh],[data-ack]');
  if (!target) return;
  if (target.hasAttribute('data-refresh')) { refreshTelemetry(); return; }
  if (target.hasAttribute('data-ack')) { acknowledgeAlert(target.dataset.ack); return; }
  render(target.dataset.page || target.dataset.go);
});
window.addEventListener('resize', () => { if (currentPage === 'dashboard' || currentPage === 'thermal') drawChart(); });

function tick() {
  const clock = document.querySelector('#clock');
  if (clock) clock.textContent = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());
}

tick();
setInterval(tick, 1000);
render('dashboard');
refreshTelemetry();
setInterval(refreshTelemetry, 5000);
