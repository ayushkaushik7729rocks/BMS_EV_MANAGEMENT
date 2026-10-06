// EV Guardian AI demo UI. Edit the values below to change the sample telemetry.
const telemetry = {
  soc: 78,
  soh: 96.4,
  voltage: 3.86,
  current: 4.2,
  power: 16.2,
  temperature: 37.2,
  fan: 42,
  threshold: 55,
  minutes: 18,
  cells: [{
      name: 'Cell 01',
      temp: 36.8,
      status: 'normal'
    },
    {
      name: 'Cell 02',
      temp: 37.2,
      status: 'watch'
    },
    {
      name: 'Cell 03',
      temp: 36.5,
      status: 'normal'
    },
    {
      name: 'Cell 04',
      temp: 37.0,
      status: 'normal'
    }],
  alerts: [ {
      title: 'Temperature trending upward',
      detail: 'Cell 02 is warming faster than the pack average.',
      time: '2 min ago',
      severity: 'warning',
      ack: false
    },
    {
      title: 'Cooling fan activated',
      detail: 'Fan started automatically at 36°C.',
      time: '8 min ago',
      severity: 'info',
      ack: false
    },
    {
      title: 'Telemetry connection restored',
      detail: 'ESP32 reconnected to the local network.',
      time: '24 min ago',
      severity: 'info',
      ack: true
    }]
};
const observed = [31.2,
  31.5,
  31.4,
  31.9,
  32.2,
  32.1,
  32.7,
  33.1,
  33.4,
  33.3,
  34,
  34.4,
  34.7,
  35.1,
  35.5,
  36,
  36.3,
  36.8,
  37.2];
const labels = ['09:00',
  '09:05',
  '09:10',
  '09:15',
  '09:20',
  '09:25',
  '09:30',
  '09:35',
  '09:40',
  '09:45',
  '09:50',
  '09:55',
  '10:00',
  '10:05',
  '10:10',
  '10:15',
  '10:20',
  '10:25',
  '10:30',
  '10:35',
  '10:40',
  '10:45',
  '10:50',
  '10:55',
  '11:00',
  '11:05',
  '11:10'];
const predicted = [...observed.slice(15),
  38.1,
  39,
  40,
  41.1,
  42.3,
  43.6,
  45,
  46.5];
const titles = {
  dashboard: 'Dashboard',
  health: 'Battery health',
  thermal: 'Thermal analysis',
  alerts: 'Alerts & events',
  system: 'Device & system'
};
const footer = '<footer class="page-footer"><span>EV GUARDIAN AI <i>·</i> SMART PREDICTIVE BMS</span><span><i class="footer-live"></i> DEMO DATA <i>·</i> UI PREVIEW</span></footer>';
const heading = (eyebrow, title, text)=>`<div class="page-heading detail-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${text}</p></div></div>`;
const metric = (icon, label, value, unit, note, color = '')=>`<article class="metric-card"><div class="metric-icon ${color}">${icon}</div><div class="metric-label">${label}</div><div class="metric-value">${value}<small>${unit}</small></div><div class="metric-note">${note}</div></article>`;
function batteryHealthBand(soh) {
  if (soh >= 90) return { key: 'healthy', label: 'Healthy', color: '#4bd2a4' };
  if (soh >= 75) return { key: 'watch', label: 'Watch', color: '#efb261' };
  return { key: 'critical', label: 'Critical', color: '#ee716b' };
}
function batteryPositionMarker(band) {
  return `<div class="battery-position-marker" aria-label="Battery pack position: ${band.label}, ${telemetry.soh.toFixed(1)} percent state of health"><span class="battery-position-pulse"></span><span class="battery-position-icon">?</span><span class="battery-position-label">PACK ? ${telemetry.soh.toFixed(1)}%</span></div>`;
}
const alertsList = (items)=>`<div class="alerts-list">${items.map(a=>`<div class="alert-row"><div class="alert-icon ${a.severity}">${a.severity==='warning'?'⚠': 'i'}</div><div class="alert-copy"><b>${a.title}</b><span>${a.detail}</span></div><time>${a.time}</time>${a.ack?'<span class="ack-check">✓</span>': ''}</div>`).join('')}</div>`;
const legend = `<div class="chart-legend"><span><i class="legend-observed"></i>Observed</span><span><i class="legend-predicted"></i>Model projection</span><span class="legend-limit"><i></i>Safe limit</span></div>`;
const chart = `<div class="chart-wrap"><canvas id="temperature-chart" aria-label="Observed and projected pack temperature chart"></canvas><div class="chart-tooltip" hidden></div></div>`;
function dashboard() {
  const band = batteryHealthBand(telemetry.soh);
  return `<div class="page-heading"><div><div class="eyebrow">OVERVIEW <span>·</span> PACK MONITORING</div><h1>Good morning, Alex <span class="wave">✳</span></h1><p>Here’s the latest from your battery system.</p></div><div class="greeting-model health-${band.key}"><model-viewer src="assets/tesla-model-s.glb" alt="Interactive 3D model of a Tesla Model S" camera-controls auto-rotate auto-rotate-delay="0" rotation-per-second="5deg" camera-orbit="90deg 70deg 5.5m" loading="eager" interaction-prompt="none" shadow-intensity="0.7"></model-viewer>${batteryPositionMarker(band)}</div><button class="outline-button" data-go="thermal">♨ &nbsp;View thermal analysis</button></div>
<section class="hero-card"><div class="hero-copy"><div class="hero-kicker"><span class="pulse-dot"></span> SYSTEM OPERATIONAL</div><h2>Your battery is<br>performing <span>normally.</span></h2><p>Monitoring pack health and thermal behavior in real time.</p><div class="hero-meta"><div><span>PACK CONFIGURATION</span><b>1S4P <i>·</i> Li-ion</b></div><div><span>DEVICE STATUS</span><b><i class="green-dot"></i>Connected</b></div></div></div><div class="battery-art"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="battery-glow"></div><div class="battery-body"><div class="battery-cap"></div><div class="battery-cell c1"></div><div class="battery-cell c2"></div><div class="battery-cell c3"></div><div class="battery-cell c4"></div><div class="battery-lightning">ϟ</div></div><div class="battery-label">PACK SOC <b>${telemetry.soc}%</b></div></div><div class="hero-status"><div class="status-ring">♨</div><div><b>Thermal watch</b><span>Trend is being monitored</span></div><span>···</span></div></section>
<section class="metric-grid">${metric('–£',
  'State of charge',
  telemetry.soc,
  '%',
  'Estimated remaining capacity')}${metric('ϟ',
  'Pack voltage',
  telemetry.voltage.toFixed(2),
  'V',
  'Nominal 1S Li-ion range',
  'blue')}${metric('↘',
  'Current draw',
  telemetry.current.toFixed(1),
  'A',
  'Discharging · steady load',
  'amber')}${metric('◉',
  'Power output',
  telemetry.power.toFixed(1),
  'W',
  'Voltage × current',
  'violet')}</section>
<div class="content-grid"><section class="panel chart-panel"><div class="panel-header"><div><div class="panel-title">Thermal behavior</div><div class="panel-subtitle">Observed temperature and near-term projection</div></div><button class="period-select">Last 90 min ⌄</button></div>${legend}${chart}<div class="chart-footer"><div><small>CURRENT PACK TEMP</small><b>${telemetry.temperature.toFixed(1)}<i>°C</i> <span class="trend-up">↗ +1.8°</span></b></div><div class="chart-callout">◷ &nbsp;At current trend, threshold in <b>~${telemetry.minutes} min</b></div></div></section>
<section class="panel cell-panel"><div class="panel-header"><div><div class="panel-title">Cell temperatures</div><div class="panel-subtitle">4 sensors · 1S4P pack</div></div><button class="dots">···</button></div><div class="cell-visual"><div class="cell-pack">${telemetry.cells.map((c,
  i)=>`<div class="cell-bar ${c.status}"><div class="cell-fill" style="height:${Math.max(20,
  (c.temp-20)*2.9)}%"></div><span>${String(i+1).padStart(2,
  '0')}</span></div>`).join('')}</div><div class="cell-scale"><span>COOL</span><span>WARM</span></div></div><div class="cell-list">${telemetry.cells.map(c=>`<div class="cell-row"><span><i class="cell-status ${c.status}"></i>${c.name}</span><b>${c.temp.toFixed(1)}°<small>C</small></b></div>`).join('')}</div><div class="cell-foot"><span>Cell delta</span><b>0.7°C <small>within range</small></b></div></section></div>
<div class="bottom-grid"><section class="panel risk-panel"><div class="panel-title">Thermal risk assessment</div><div class="risk-body"><div class="risk-meter"><div class="risk-meter-center"><b>LOW</b><span>RISK</span></div></div><div class="risk-copy"><span class="risk-tag">● WATCHING</span><h3>Stable, with a rising trend</h3><p>Current conditions are within the operating range. Keep monitoring as temperature climbs.</p><button class="text-link" data-go="thermal">Explore thermal insights ↗</button></div></div><div class="risk-scale"><span>LOW RISK</span><div><i></i></div><span>HIGH RISK</span></div></section><section class="panel cooling-panel"><div class="panel-header"><div><div class="panel-title">Cooling system</div><div class="panel-subtitle">Automatic thermal response</div></div><span class="active-label">● ACTIVE</span></div><div class="fan-row"><div class="fan-icon">✥</div><div><b>Cooling fan</b><span>Responding to temperature</span></div><strong>${telemetry.fan}<small>%</small></strong></div><div class="fan-track"><i style="width:${telemetry.fan}%"></i></div><div class="cooling-foot"><span>Current speed</span><b>${telemetry.fan}% PWM</b></div></section></div>
<div class="bottom-grid last-row"><section class="panel"><div class="panel-header"><div><div class="panel-title">Recent alerts</div><div class="panel-subtitle">Latest events from this device</div></div><button class="text-link" data-go="alerts">View all ↗</button></div>${alertsList(telemetry.alerts.slice(0,
  2))}</section><section class="panel condition-panel"><div class="panel-title">System condition</div><div class="condition-line"><span><i></i> ESP32 controller</span><b>Online</b></div><div class="condition-line"><span><i></i> Sensors</span><b>4 / 4 active</b></div><div class="condition-line"><span><i></i> Data link</span><b>Stable</b></div></section></div>`;
}

function detail(page) {
  if(page==='health')return `${heading('BATTERY INTELLIGENCE',
  'Battery health',
  'Track pack capacity, electrical behavior, and cell consistency.')}<div class="metric-grid">${metric('–£',
  'State of charge',
  telemetry.soc,
  '%',
  'Estimated remaining capacity')}${metric('–¤',
  'State of health',
  telemetry.soh,
  '%',
  'Model estimate · demo value',
  'blue')}${metric('ϟ',
  'Pack voltage',
  telemetry.voltage.toFixed(2),
  'V',
  '1S Li-ion pack',
  'amber')}${metric('◉',
  'Power output',
  telemetry.power.toFixed(1),
  'W',
  'Live operating point',
  'violet')}</div><div class="detail-cols"><section class="panel health-score"><div class="panel-title">Pack health score</div><div class="health-number">${telemetry.soh}<small>%</small></div><div class="health-status">✓ Excellent condition</div><div class="health-meter"><i style="width:${telemetry.soh}%"></i></div><p>State of health is a demo estimate. Replace with a validated estimator when the model is ready.</p></section><section class="panel"><div class="panel-title">Cell balance</div><div class="panel-subtitle">Temperature spread across four sensors</div>${telemetry.cells.map(c=>`<div class="balance-row"><span>${c.name}</span><div class="balance-track"><i style="width:${((c.temp-30)/12)*100}%"></i></div><b>${c.temp.toFixed(1)}°C</b><span class="ok-chip">${c.status==='watch'?'Watch': 'Balanced'}</span></div>`).join('')}</section></div>`;
  if(page==='thermal') {
    const band = batteryHealthBand(telemetry.soh);
    return `${heading('PREDICTIVE SAFETY', 'Thermal analysis', 'Review cell temperatures and the illustrative near-term projection.')}<section class="panel thermal-car-panel health-${band.key}" style="--battery-color:${band.color}"><div class="panel-header"><div><div class="panel-title">Vehicle battery location</div><div class="panel-subtitle">Interactive 3D car view &middot; pack color follows battery health</div></div><span class="health-band-badge"><i></i>${band.label} &middot; ${telemetry.soh.toFixed(1)}% SOH</span></div><div class="thermal-car-stage"><model-viewer src="assets/tesla-model-s.glb" alt="Interactive rotating 3D car with the battery pack position highlighted" camera-controls auto-rotate auto-rotate-delay="0" rotation-per-second="4deg" camera-orbit="90deg 70deg 5.5m" loading="eager" interaction-prompt="none" shadow-intensity="0.7"></model-viewer>${batteryPositionMarker(band)}<div class="thermal-car-caption">UNDERFLOOR BATTERY PACK</div></div><div class="battery-health-legend"><span><i class="legend-good"></i>Healthy <b>90&ndash;100%</b></span><span><i class="legend-watch"></i>Watch <b>75&ndash;89%</b></span><span><i class="legend-critical"></i>Critical <b>&lt;75%</b></span></div></section><section class="panel thermal-summary"><div class="thermal-summary-item"><span>PACK TEMPERATURE</span><b>${telemetry.temperature.toFixed(1)}&#176;<small>C</small></b><i>&rarr; +1.8&#176;C over 20 min</i></div><div class="thermal-summary-item"><span>RISK CLASSIFICATION</span><b class="watch-text">Watch</b><i>Trend under observation</i></div><div class="thermal-summary-item"><span>TIME TO ${telemetry.threshold}&#176;C THRESHOLD</span><b>~${telemetry.minutes}<small> min</small></b><i>Illustrative trend estimate</i></div></section><section class="panel thermal-chart-panel"><div class="panel-header"><div><div class="panel-title">Temperature trend &amp; projection</div><div class="panel-subtitle">Observed sensor values with a mock forward projection</div></div><span class="demo-badge">DEMO MODEL</span></div>${legend}${chart}</section><section class="panel cells-wide"><div class="panel-title">Sensor-by-sensor readings</div><div class="wide-cell-grid">${telemetry.cells.map(c=>`<div class="wide-cell"><div>&#9832; <span>${c.name}</span></div><b>${c.temp.toFixed(1)}&#176;<small>C</small></b><span class="status-word ${c.status}">${c.status==='watch'?'Elevated':'Normal range'}</span></div>`).join('')}</div></section>`;
  }
  if(page==='alerts')return `${heading('EVENT CENTER',
  'Alerts & events',
  'Review system notices and monitoring events.')}<section class="alert-overview"><div><b>2</b><span>Needs attention</span></div><div><b>${telemetry.alerts.length}</b><span>Total recent events</span></div><div><b>All systems</b><span>Connected now</span></div></section><section class="panel alerts-page-panel"><div class="panel-header"><div><div class="panel-title">Recent activity</div><div class="panel-subtitle">Newest first · local demo timeline</div></div><span class="demo-badge">MOCK EVENTS</span></div>${alertsList(telemetry.alerts)}</section><div class="inline-note">✓ &nbsp;Alerts shown here are sample UI data. Real acknowledgement and alert history will come from the backend.</div>`;
  return `${heading('HARDWARE & CONNECTIONS',
  'Device & system',
  'Check controller connectivity, sensor health, and cooling response.')}<section class="panel device-banner"><div class="device-avatar">⌘</div><div class="device-main"><div class="device-online">● ONLINE</div><h2>EV Guardian · Lab Unit 01</h2><p>ESP32-BMS-001 <span>·</span> Firmware v0.8.2 · prototype</p></div><div class="device-seen"><span>LAST TELEMETRY</span><b>Just now</b><small>Demo status</small></div></section><div class="detail-cols"><section class="panel device-details"><div class="panel-header"><div><div class="panel-title">Sensor connectivity</div><div class="panel-subtitle">Reported by the prototype controller</div></div><span class="active-label">● 4 / 4</span></div>${[['Voltage sensor',
      '3.86 V'],
      ['Current sensor',
      '4.20 A'],
      ['Temperature probes',
      '4 / 4 active'],
      ['Wi-Fi link',
      '−54 dBm']].map(([n,
    v])=>`<div class="sensor-row"><div class="sensor-icon">⌁</div><div><b>${n}</b><span>${v}</span></div><span class="sensor-state">● Connected</span></div>`).join('')}</section><section class="panel cooling-panel device-cooling"><div class="panel-title">Cooling response</div><div class="panel-subtitle">Fan controller output</div><div class="fan-row"><div class="fan-icon">✥</div><div><b>Cooling fan</b><span>Active · automatic mode</span></div><strong>${telemetry.fan}<small>%</small></strong></div><div class="fan-track"><i style="width:${telemetry.fan}%"></i></div><div class="cooling-foot"><span>Output level</span><b>${telemetry.fan}% PWM</b></div></section></div><div class="inline-note">⌁ &nbsp;Device and sensor states are currently illustrative mock data.</div>`;
}

let currentPage = 'dashboard';
function paintChart() {
  const canvas = document.querySelector('#temperature-chart');
  if(!canvas)return;
  const box = canvas.getBoundingClientRect(),
  dpr = window.devicePixelRatio||1;
  canvas.width = box.width*dpr;
  canvas.height = box.height*dpr;
  const c = canvas.getContext('2d');
  c.scale(dpr,
  dpr);
  const w = box.width,
  h = box.height,
  p = {
    l: 36,
    r: 12,
    t: 12,
    b: 25
  },
  min = 28,
  max = 58,
  X = i=>p.l+i*(w-p.l-p.r)/(labels.length-1),
  Y = v=>p.t+(max-v)*(h-p.t-p.b)/(max-min);
  c.font = '9px DM Mono, monospace';
  c.lineWidth = 1;
  for(let v = 30; v<=55; v += 5) {
    const y = Y(v);
    c.strokeStyle = '#263239';
    c.beginPath();
    c.moveTo(p.l,
    y);
    c.lineTo(w-p.r,
    y);
    c.stroke();
    c.fillStyle = '#78878b';
    c.fillText(`${v}°`,
    2,
    y+3)
  }
  const yLimit = Y(telemetry.threshold);
  c.setLineDash([4,
    4]);
  c.strokeStyle = '#dc776d';
  c.beginPath();
  c.moveTo(p.l,
  yLimit);
  c.lineTo(w-p.r,
  yLimit);
  c.stroke();
  c.setLineDash([]);
  const fill = c.createLinearGradient(0,
  p.t,
  0,
  h-p.b);
  fill.addColorStop(0,
  '#49d6aa33');
  fill.addColorStop(1,
  '#49d6aa00');
  c.beginPath();
  observed.forEach((v,
  i)=>i?c.lineTo(X(i),
  Y(v)): c.moveTo(X(i),
  Y(v)));
  c.lineTo(X(observed.length-1),
  h-p.b);
  c.lineTo(X(0),
  h-p.b);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  c.lineWidth = 2;
  c.strokeStyle = '#50d5a9';
  c.beginPath();
  observed.forEach((v,
  i)=>i?c.lineTo(X(i),
  Y(v)): c.moveTo(X(i),
  Y(v)));
  c.stroke();
  c.setLineDash([5,
    4]);
  c.strokeStyle = '#edb16c';
  c.beginPath();
  predicted.forEach((v,
  i)=>i?c.lineTo(X(i+15),
  Y(v)): c.moveTo(X(i+15),
  Y(v)));
  c.stroke();
  c.setLineDash([]);
  labels.forEach((label,
  i)=> {
    if(i%4===0||i===labels.length-1) {
      c.fillStyle = '#78878b'; c.fillText(label,
      X(i)-13,
      h-6)
    }
  });
}

function drawChart() {
  const canvas = document.querySelector('#temperature-chart');
  if(!canvas)return;
  paintChart();
  if(canvas.dataset.hoverReady)return;
  canvas.dataset.hoverReady = 'true';
  const tooltip = canvas.parentElement.querySelector('.chart-tooltip');
  let activeIndex = -1;
  canvas.addEventListener('pointermove',
  event=> {
    const rect = canvas.getBoundingClientRect(),
    x = event.clientX-rect.left,
    pad = 36,
    plotWidth = rect.width-pad-12; activeIndex = Math.max(0,
    Math.min(labels.length-1,
    Math.round((x-pad)/plotWidth*(labels.length-1)))); paintChart(); const ctx = canvas.getContext('2d'),
    w = rect.width,
    h = rect.height,
    px = pad+activeIndex*plotWidth/(labels.length-1),
    Y = v=>12+(58-v)*(h-37)/30; ctx.save(); ctx.strokeStyle = '#9bada9aa'; ctx.setLineDash([3,
      4]); ctx.beginPath(); ctx.moveTo(px,
    12); ctx.lineTo(px,
    h-25); ctx.stroke(); ctx.setLineDash([]); const rows = []; if(activeIndex<observed.length)rows.push( {
      name: 'Observed',
      value: observed[activeIndex],
      color: '#50d5a9'
    }); if(activeIndex>=15)rows.push( {
      name: 'Projection',
      value: predicted[activeIndex-15],
      color: '#edb16c'
    }); rows.forEach(row=> {
      ctx.beginPath(); ctx.arc(px,
      Y(row.value),
      4,
      0,
      Math.PI*2); ctx.fillStyle = row.color; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#10171d'; ctx.stroke()
    }); ctx.restore(); tooltip.innerHTML = `<b>${labels[activeIndex]}</b>${rows.map(row=>`<span><i style="background:${row.color}"></i>${row.name}<strong>${row.value.toFixed(1)}°C</strong></span>`).join('')}`; tooltip.hidden = false; const left = Math.max(45,
    Math.min(rect.width-125,
    px+12)); tooltip.style.left = `${left}px`; tooltip.style.top = `${Math.max(4,
    Math.min(rect.height-68,
    Y(rows[rows.length-1].value)-50))}px`; canvas.style.cursor = 'crosshair';
  });
  canvas.addEventListener('pointerleave',
  ()=> {
    tooltip.hidden = true; canvas.style.cursor = ''
  });
}

function render(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item[data-page]').forEach(b=>b.classList.toggle('active',
  b.dataset.page===page));
  document.querySelector('#crumb').textContent = titles[page];
  document.querySelector('#page-content').innerHTML = (page==='dashboard'?dashboard(): detail(page))+footer;
  if(page==='dashboard'||page==='thermal')requestAnimationFrame(drawChart);
  document.querySelector('.main-scroll').scrollTop = 0;
}

document.addEventListener('click', e=> {
  const target = e.target.closest('[data-page],[data-go]'); if(target)render(target.dataset.page||target.dataset.go)
});
window.addEventListener('resize', ()=> {
  if(currentPage==='dashboard'||currentPage==='thermal')drawChart()
});
function tick() {
  document.querySelector('#clock').textContent = new Intl.DateTimeFormat('en-US',
  {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date())
}

tick();
setInterval(tick, 1000);
render('dashboard');
