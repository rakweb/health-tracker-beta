'use strict';

/**
 * app.js — Health Tracker core logic
 *
 * Notes:
 * - This file is intended to replace the large inline <script> block in index.html.
 * - It preserves global names used by inline onclick handlers: window.UI and window.Actions.
 * - Metrics Chart is recoded to display DATE ONLY on the x-axis (no hour).
 */


/* ==================== PWA: SW Register, Install, Updates, labels ==================== */
let deferredPrompt = null, swReg = null;

const installBtn = document.getElementById('btnInstall');
const checkBtn = document.getElementById('btnCheckUpdates');
const installHint = document.getElementById('installHint');
const buildNumberSpan = document.getElementById('buildNumber');

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js')
    .then(reg => {
      swReg = reg;
      navigator.serviceWorker.addEventListener('message', (evt) => {
        if (evt.data?.type === 'VERSION' && evt.data?.cache && swVersionSpan) swVersionSpan.textContent = evt.data.cache;
      });
      (reg.active ? Promise.resolve() : navigator.serviceWorker.ready).then(sendGetVersion);
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing; if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdateToast(reg);
        });
      });
    })
  
  navigator.serviceWorker.addEventListener('controllerchange', () => { window.location.reload(); });
}

// Update toast
const toast = document.getElementById('updateToast');
const btnReloadNow = document.getElementById('btnReloadNow');
const btnDismissToast = document.getElementById('btnDismissToast');
function showUpdateToast(reg) {
  if (!toast) return;
  toast.classList.add('show');
  if (btnReloadNow) btnReloadNow.onclick = () => { reg.waiting?.postMessage({ type: 'SKIP_WAITING' }); };
  if (btnDismissToast) btnDismissToast.onclick = () => toast.classList.remove('show');
}
if (checkBtn) {
  checkBtn.addEventListener('click', async () => {
    try {
      if (installHint) installHint.textContent = 'Checking…';
      if (swReg?.update) await swReg.update();
      if (swReg?.waiting) showUpdateToast(swReg); else if (installHint) installHint.textContent = 'No updates found.';
      setTimeout(() => { if (installHint) installHint.textContent = ''; }, 2000);
    } catch {
      if (installHint) installHint.textContent = 'Update check failed.';
      setTimeout(() => { if (installHint) installHint.textContent = ''; }, 2000);
    }
  });
}

// A2HS (custom button flow)
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); deferredPrompt = e;
  if (installBtn) installBtn.style.display = 'inline-block';
  if (installHint) installHint.textContent = 'Click Install to add to your device.';
});
if (installBtn) {
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (installHint) installHint.textContent = (outcome === 'accepted') ? 'Installing…' : 'Install dismissed.';
    deferredPrompt = null; installBtn.style.display = 'none';
    setTimeout(() => { if (installHint) installHint.textContent = ''; }, 2000);
  });
}
window.addEventListener('appinstalled', () => {
  if (installHint) installHint.textContent = 'Installed!';
  if (installBtn) installBtn.style.display = 'none';
  setTimeout(() => { if (installHint) installHint.textContent = ''; }, 2000);
});

/* ==================== Chart.js annotation plugin safe register ==================== */
(function () {
  try {
    const ann = (window && (window['chartjs-plugin-annotation'] || window.ChartAnnotation || window.chartjsPluginAnnotation));
    if (window.Chart && ann && typeof Chart.register === 'function') Chart.register(ann);
  } catch (e) {
    console.warn('Annotation plugin not registered:', e);
  }
})();

/* ==================== App data & defaults ==================== */
// NOTE: Symptoms is included as a full metric.
const METRICS = [
  { key: 'glucose', label: 'Glucose (mg/dL)', unit: 'mg/dL', type: 'number' },
  { key: 'bodyBattery', label: 'Body Battery', unit: '', type: 'number' },
  { key: 'stress', label: 'Stress', unit: '', type: 'number' },
  { key: 'weightLbs', label: 'Weight (lbs)', unit: 'lbs', type: 'number' },
  { key: 'heightIn', label: 'Height (in)', unit: 'in', type: 'number' },
  { key: 'waistIn', label: 'Waist (in)', unit: 'in', type: 'number' },
  { key: 'tempF', label: 'Temperature (°F)', unit: '°F', type: 'number' },
  { key: 'lungFluidCc', label: 'Lung Fluid (cc)', unit: 'cc', type: 'number' },
  { key: 'sys', label: 'Systolic (mmHg)', unit: 'mmHg', type: 'number' },
  { key: 'dia', label: 'Diastolic (mmHg)', unit: 'mmHg', type: 'number' },
  { key: 'spo2', label: 'SpO₂ (%)', unit: '%', type: 'number' },
  { key: 'hr', label: 'Heart Rate (bpm)', unit: 'bpm', type: 'number' },
  { key: 'resp', label: 'Respiration (br/min)', unit: '/min', type: 'number' },
  { key: 'sleep', label: 'Sleep (hrs)', unit: 'hrs', type: 'number' },
  { key: 'steps', label: 'Steps', unit: '', type: 'number' },
  { key: 'pain', label: 'Pain (0-10)', unit: '', type: 'number' },
  { key: 'symptoms', label: 'Symptoms (0-10)', unit: '', type: 'number' },
  { key: 'emotions', label: 'Emotions', unit: '', type: 'text' },
  { key: 'comments', label: 'Comments', unit: '', type: 'text' },
  { key: 'meds', label: 'Medicines', unit: '', type: 'list' },
];

const CORE_FIELDS = ['date', 'time', ...METRICS.map(m => m.key)];

// IMPORTANT: This file does not decide what you want visible-by-default.
// Keep your existing DEFAULT_FIELDS_VISIBLE values in index.html or set them here.
const DEFAULT_FIELDS_VISIBLE = [
  'date', 'time', 'glucose', 'sys', 'dia', 'spo2', 'hr',
  'weightLbs', 'heightIn', 'waistIn', 'sleep', 'steps',
  'pain', 'emotions', 'comments'
];

const DEFAULT_THRESHOLDS = {
  glucose: { warnLow: 70, bandLow: 80, bandHigh: 140, warnHigh: 180 },
  sys: { warnLow: 90, bandLow: 100, bandHigh: 129, warnHigh: 140 },
  dia: { warnLow: 60, bandLow: 60, bandHigh: 79, warnHigh: 90 },
  spo2: { warnLow: 92, bandLow: 95, bandHigh: 100, warnHigh: 101 },
  hr: { warnLow: 45, bandLow: 50, bandHigh: 90, warnHigh: 120 },
  tempF: { warnLow: 95, bandLow: 97, bandHigh: 99, warnHigh: 101 },
  stress: { warnLow: 0, bandLow: 0, bandHigh: 40, warnHigh: 75 },
  bodyBattery: { warnLow: 15, bandLow: 20, bandHigh: 100, warnHigh: 999 },
  lungFluidCc: { warnLow: -1, bandLow: 0, bandHigh: 50, warnHigh: 200 },
  weightLbs: { warnLow: 0, bandLow: 0, bandHigh: 999, warnHigh: 9999 },
  resp: { warnLow: 8, bandLow: 10, bandHigh: 20, warnHigh: 24 },
  sleep: { warnLow: 4, bandLow: 7, bandHigh: 9, warnHigh: 14 },
  steps: { warnLow: 0, bandLow: 5000, bandHigh: 10000, warnHigh: 20000 },
  pain: { warnLow: 0, bandLow: 0, bandHigh: 3, warnHigh: 7 },
  // symptoms defaults mirror pain (0–10)
  symptoms: { warnLow: 0, bandLow: 0, bandHigh: 3, warnHigh: 7 },
  bmi: { warnLow: 18.5, bandLow: 18.5, bandHigh: 24.9, warnHigh: 30 },
  whtr: { warnLow: 0.34, bandLow: 0.34, bandHigh: 0.49, warnHigh: 0.6 },
};

const OPTIONS = { autosave: 'on', csvSelectedOnly: 'yes', pdfIncludeChart: 'yes' };

/* ==================== IndexedDB ==================== */
const DB = {
  db: null,
  open() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) { console.warn('IndexedDB not supported'); resolve(); return; }
      const req = indexedDB.open('health-tracker-db', 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('entries')) {
          const s = db.createObjectStore('entries', { keyPath: 'id', autoIncrement: true });
          s.createIndex('by_date', 'date');
        }
        if (!db.objectStoreNames.contains('config')) {
          db.createObjectStore('config', { keyPath: 'key' });
        }
      };
      req.onsuccess = () => { DB.db = req.result; resolve(); };
      req.onerror = () => reject(req.error);
    });
  },
  putEntry(entry) {
    return new Promise((resolve, reject) => {
      if (!DB.db) { resolve(); return; }
      const tx = DB.db.transaction('entries', 'readwrite');
      const store = tx.objectStore('entries');
      const hasId = entry && entry.id != null;
      const req = hasId ? store.put(entry) : store.add(entry);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
  deleteEntry(id) {
    return new Promise((resolve, reject) => {
      if (!DB.db) { resolve(); return; }
      const tx = DB.db.transaction('entries', 'readwrite');
      tx.objectStore('entries').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  getAllEntries() {
    return new Promise((resolve, reject) => {
      if (!DB.db) { resolve([]); return; }
      const tx = DB.db.transaction('entries', 'readonly');
      const req = tx.objectStore('entries').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },
  putConfig(key, value) {
    return new Promise((resolve, reject) => {
      if (!DB.db) { resolve(); return; }
      const tx = DB.db.transaction('config', 'readwrite');
      tx.objectStore('config').put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  getConfig(key) {
    return new Promise((resolve, reject) => {
      if (!DB.db) { resolve(null); return; }
      const tx = DB.db.transaction('config', 'readonly');
      const req = tx.objectStore('config').get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => reject(req.error);
    });
  }
};

/* ==================== State & ISO Date/Time Utils ==================== */
const State = {
  entries: [],
  fieldsVisible: new Set(DEFAULT_FIELDS_VISIBLE),
  thresholds: JSON.parse(JSON.stringify(DEFAULT_THRESHOLDS)),
  options: { ...OPTIONS },
  ui: { chartEnabled: true, viewMode: 'both', collapsedChart: false },
  editId: null,
  medsBuffer: [],
};

const U = {
  toISODate(d) {
    if (!d) return null;
    const dt = (d instanceof Date) ? d : new Date(d);
    return isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
  },
  normalizeDateString(s) {
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  },
  normalizeTimeString(s) {
    if (!s) return null;
    const m = String(s).trim().match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
    if (m) return `${m[1]}:${m[2]}`;
    const probe = new Date(`1970-01-01T${s}`);
    return isNaN(probe.getTime()) ? null : probe.toISOString().slice(11, 16);
  },
  parseDateTime(isoDate, timeHHmm) {
    if (!isoDate) return null;
    const date = U.normalizeDateString(isoDate);
    const time = U.normalizeTimeString(timeHHmm || '00:00') || '00:00';
    if (!date) return null;
    const dt = new Date(`${date}T${time}`);
    return isNaN(dt.getTime()) ? null : dt;
  },
  fmt(n, dp = 0) { if (n == null || isNaN(n)) return '—'; return Number(n).toFixed(dp); },
  bmi(lbs, inches) { if (!lbs || !inches) return null; return 703 * (lbs / (inches * inches)); },
  whtr(waistIn, heightIn) { if (!waistIn || !heightIn) return null; return waistIn / heightIn; },
  csvEscape(v) {
    if (v == null) return '';
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  },
  dateInRange(dateStr, startStr, endStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr + 'T00:00');
    if (startStr && d < new Date(startStr + 'T00:00')) return false;
    if (endStr && d > new Date(endStr + 'T23:59')) return false;
    return true;
  }
};

/* ==================== UI ==================== */
const UI = {
  chart: null,

  initChartMetricSelector() {
    const sel = document.getElementById('chartMetrics'); if (!sel) return; sel.innerHTML = '';
    METRICS.forEach(m => {
      if (m.type === 'number') {
        const opt = document.createElement('option');
        opt.value = m.key;
        opt.textContent = m.label;
        // Preserve original preselect list exactly (no new assumptions)
        if (['glucose', 'sys', 'dia', 'spo2', 'hr', 'weightLbs'].includes(m.key)) opt.selected = true;
        sel.appendChild(opt);
      }
    });
  },

  buildTable() {
    const head = document.getElementById('tableHead');
    const body = document.getElementById('tableBody');
    if (!head || !body) return;

    head.innerHTML = '';
    const tr = document.createElement('tr');
    const vis = ['date', 'time', ...METRICS.map(m => m.key)].filter(k => State.fieldsVisible.has(k));
    vis.forEach(k => {
      const m = METRICS.find(x => x.key === k);
      const th = document.createElement('th');
      th.textContent = m ? m.label : (k === 'date' ? 'Date' : 'Time');
      tr.appendChild(th);
    });
    const thA = document.createElement('th'); thA.textContent = 'Actions'; tr.appendChild(thA);
    head.appendChild(tr);

    body.innerHTML = '';
    const start = document.getElementById('filterStart')?.value;
    const end = document.getElementById('filterEnd')?.value;

    const rows = State.entries
      .filter(en => U.dateInRange(en.date, start, end))
      .sort((a, b) => ((U.parseDateTime(b.date, b.time)?.getTime() || 0) - (U.parseDateTime(a.date, a.time)?.getTime() || 0)));

    for (const en of rows) {
      const trr = document.createElement('tr');
      for (const k of vis) {
        const td = document.createElement('td');
        if (k === 'date') td.textContent = en.date || '';
        else if (k === 'time') td.textContent = en.time || '';
        else {
          let val = en[k];
          if (k === 'meds' && Array.isArray(val)) val = val.map(m => `${m.name} ${m.dose}${m.units ? (' ' + m.units) : ''}`).join('; ');
          td.textContent = (val == null ? '' : val);
        }
        trr.appendChild(td);
      }
      const tdA = document.createElement('td'); tdA.className = 'actions';
      const bE = document.createElement('button'); bE.className = 'btn'; bE.textContent = 'Edit'; bE.onclick = () => UI.openEntry(en.id);
      const bD = document.createElement('button'); bD.className = 'btn danger'; bD.textContent = 'Delete';
      bD.onclick = async () => { await Actions.deleteEntry(en.id); await Actions.refreshAll(); };
      tdA.appendChild(bE); tdA.appendChild(bD);
      trr.appendChild(tdA);
      body.appendChild(trr);
    }
  },

  refreshKPIs() {
    const sorted = [...State.entries].sort((a, b) => ((U.parseDateTime(b.date, b.time)?.getTime() || 0) - (U.parseDateTime(a.date, a.time)?.getTime() || 0)));
    const latest = sorted[0], prev = sorted[1];
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    if (latest) {
      set('kpiGlucose', U.fmt(latest.glucose));
      set('kpiBP', (latest.sys != null && latest.dia != null) ? `${latest.sys}/${latest.dia}` : '—');
      const bmi = U.bmi(latest.weightLbs, latest.heightIn); set('kpiBMI', bmi ? U.fmt(bmi, 1) : '—');
      const whtr = U.whtr(latest.waistIn, latest.heightIn); set('kpiWHtR', whtr ? U.fmt(whtr, 2) : '—');
      set('kpiSpO2', U.fmt(latest.spo2));
      set('kpiHR', U.fmt(latest.hr));
    } else {
      set('kpiGlucose', '—'); set('kpiBP', '—'); set('kpiBMI', '—'); set('kpiWHtR', '—'); set('kpiSpO2', '—'); set('kpiHR', '—');
    }

    const trend = (cur, pre) => (cur != null && pre != null) ? (cur > pre ? '↑' : '↓') : '';
    const tg = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    tg('kpiGlucoseTrend', latest && prev ? trend(latest.glucose, prev.glucose) : '');
    tg('kpiBPTrend', latest && prev ? trend((latest.sys || 0) + (latest.dia || 0), (prev.sys || 0) + (prev.dia || 0)) : '');
    tg('kpiBMITrend', latest && prev ? trend(U.bmi(latest.weightLbs, latest.heightIn) || 0, U.bmi(prev.weightLbs, prev.heightIn) || 0) : '');
    tg('kpiVitalsTrend', latest && prev ? trend(latest.hr, prev.hr) : '');

    UI.refreshRiskChips(latest);
  },

  refreshRiskChips(latest) {
    const wrap = document.getElementById('riskChips'); if (!wrap) return;
    wrap.innerHTML = '';
    if (!latest) { wrap.innerHTML = '<span class="small">No data yet.</span>'; return; }

    const chip = (txt, level) => {
      const d = document.createElement('div');
      d.className = `chip ${level}`;
      const icon = level === 'danger' ? '⚠️' : (level === 'warn' ? '🟨' : '🟢');
      d.textContent = `${icon} ${txt}`;
      wrap.appendChild(d);
    };

    const T = State.thresholds;
    const assess = (key, val, label) => {
      if (val == null) return;
      const th = T[key];
      if (!th) return;
      if (val < th.warnLow || val > th.warnHigh) chip(`${label}: ${U.fmt(val)} (Critical)`, 'danger');
      else if (val < th.bandLow || val > th.bandHigh) chip(`${label}: ${U.fmt(val)} (Watch)`, 'warn');
      else chip(`${label}: ${U.fmt(val)} (OK)`, 'ok');
    };

    assess('glucose', latest.glucose, 'Glucose');
    assess('sys', latest.sys, 'Systolic');
    assess('dia', latest.dia, 'Diastolic');
    assess('spo2', latest.spo2, 'SpO₂');
    assess('tempF', latest.tempF, 'Temp');
    assess('hr', latest.hr, 'HR');
    assess('resp', latest.resp, 'Resp');
    assess('stress', latest.stress, 'Stress');
    assess('bodyBattery', latest.bodyBattery, 'Body Battery');
    assess('lungFluidCc', latest.lungFluidCc, 'Lung Fluid');
    assess('sleep', latest.sleep, 'Sleep');
    assess('steps', latest.steps, 'Steps');
    assess('pain', latest.pain, 'Pain');
    assess('symptoms', latest.symptoms, 'Symptoms');

    const bmi = U.bmi(latest.weightLbs, latest.heightIn); if (bmi != null) assess('bmi', bmi, 'BMI');
    const whtr = U.whtr(latest.waistIn, latest.heightIn); if (whtr != null) assess('whtr', whtr, 'WHtR');
  },

  refreshChart() {
    if (State.ui.chartEnabled === false) { if (UI.chart) { UI.chart.destroy(); UI.chart = null; } return; }
    if (!window.Chart) return;

    const metricSel = document.getElementById('chartMetrics');
    if (!metricSel) return;

    const metricKeys = Array.from(metricSel.selectedOptions).map(o => o.value);
    if (!metricKeys.length) { if (UI.chart) { UI.chart.destroy(); UI.chart = null; } return; }

    const canvas = document.getElementById('metricsChart');
    if (!canvas) return;

    const start = document.getElementById('filterStart')?.value;
    const end = document.getElementById('filterEnd')?.value;
    const axisMode = document.getElementById('axisMode')?.value || 'perMetric';

    // Keep ordering by date+time, but DISPLAY date only
    const rows = State.entries
      .filter(e => U.dateInRange(e.date, start, end))
      .sort((a, b) => ((U.parseDateTime(a.date, a.time)?.getTime() || 0) - (U.parseDateTime(b.date, b.time)?.getTime() || 0)));

    // DATE ONLY (no hour)
    const labels = rows.map(r => r.date || '');

    const palette = ['#60a5fa', '#34d399', '#f472b6', '#f59e0b', '#a78bfa', '#38bdf8',
      '#f87171', '#22d3ee', '#e879f9', '#fde047', '#fb7185', '#93c5fd',
      '#86efac', '#c084fc', '#fda4af'];

    const yAxes = {};
    const datasets = metricKeys.map((k, idx) => {
      const m = METRICS.find(x => x.key === k);
      const data = rows.map(r => r[k] ?? null);
      const color = palette[idx % palette.length];
      const yAxisID = axisMode === 'perMetric' ? `y_${k}` : 'y';
      if (!yAxes[yAxisID]) {
        yAxes[yAxisID] = {
          type: 'linear',
          display: true,
          position: (Object.keys(yAxes).length % 2 ? 'right' : 'left'),
          grid: { drawOnChartArea: (axisMode === 'single') },
          title: { display: true, text: (axisMode === 'single' ? 'Value' : (m?.label || k)) }
        };
      }
      return {
        label: (m?.label || k),
        data,
        borderColor: color,
        backgroundColor: color + '66',
        tension: .25,
        spanGaps: true,
        yAxisID
      };
    });

    const annotations = {};
    const hasAnn = !!(window.Chart?.registry?.plugins?.get?.('annotation') || window['chartjs-plugin-annotation']);
    if (hasAnn) {
      const addLine = (id, y, color, label) => {
        if (y == null || isNaN(y)) return;
        annotations[id] = {
          type: 'line', yMin: y, yMax: y,
          borderColor: color, borderWidth: 1,
          label: { display: true, content: label, position: 'start', color: '#cfe8ff', backgroundColor: '#0b1220cc' }
        };
      };
      const addBand = (id, y1, y2, color) => {
        if ([y1, y2].some(v => v == null || isNaN(v))) return;
        annotations[id] = { type: 'box', yMin: y1, yMax: y2, backgroundColor: color, borderWidth: 0 };
      };
      metricKeys.forEach(k => {
        const th = State.thresholds[k];
        if (!th) return;
        const yAxisID = axisMode === 'perMetric' ? `y_${k}` : 'y';
        const base = `${yAxisID}_${k}`;
        addBand(`${base}_band`, th.bandLow, th.bandHigh, 'rgba(39,215,155,0.08)');
        addLine(`${base}_warnLow`, th.warnLow, '#ffcc66', 'Warn Low');
        addLine(`${base}_warnHigh`, th.warnHigh, '#ffcc66', 'Warn High');
      });
    }

    const config = {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#dbeafe' } },
          annotation: { annotations },
          tooltip: {
            callbacks: {
              // Tooltip title DATE ONLY
              title: (items) => {
                const lab = items?.[0]?.label ?? '';
                return String(lab).split(' ')[0];
              }
            }
          }
        },
        scales: Object.assign(
          {
            x: {
              ticks: {
                color: '#9fb2d6',
                callback: function (value) {
                  const lab = this.getLabelForValue(value);
                  return String(lab).split(' ')[0];
                }
              },
              grid: { color: '#13213d' }
            },
            y: { ticks: { color: '#9fb2d6' }, grid: { color: '#13213d' } }
          },
          yAxes
        )
      }
    };

    if (UI.chart) UI.chart.destroy();
    UI.chart = new Chart(canvas.getContext('2d'), config);
  },

  openEntry(id = null) {
    State.editId = id;
    document.getElementById('entryModal')?.classList.add('show');
    const delBtn = document.getElementById('btnDeleteEntry');
    if (delBtn) delBtn.style.display = id ? '' : 'none';

    const title = document.getElementById('entryModalTitle');
    if (title) title.textContent = id ? 'Edit Entry' : 'Add Entry';

    State.medsBuffer = [];

    if (id != null) {
      const en = State.entries.find(x => x.id === id);
      if (!en) return;

      const map = (idk, v) => {
        const el = document.getElementById(idk);
        if (el) el.value = (v ?? '');
      };

      document.getElementById('f_date').value = en.date || '';
      document.getElementById('f_time').value = en.time || '';

      map('f_glucose', en.glucose);
      map('f_bodyBattery', en.bodyBattery);
      map('f_stress', en.stress);
      map('f_weightLbs', en.weightLbs);
      map('f_heightIn', en.heightIn);
      map('f_waistIn', en.waistIn);
      map('f_tempF', en.tempF);
      map('f_lungFluidCc', en.lungFluidCc);
      map('f_sys', en.sys);
      map('f_dia', en.dia);
      map('f_spo2', en.spo2);
      map('f_hr', en.hr);
      map('f_resp', en.resp);
      map('f_sleep', en.sleep);
      map('f_steps', en.steps);

      map('f_pain', en.pain ?? 0);
      const pval = document.getElementById('painVal');
      if (pval) pval.textContent = (en.pain ?? 0);

      // Symptoms (full metric)
      const sxEl = document.getElementById('f_symptoms');
      if (sxEl) sxEl.value = (en.symptoms ?? 0);
      const sxVal = document.getElementById('symptomsVal');
      if (sxVal) sxVal.textContent = (en.symptoms ?? 0);

      const emo = document.getElementById('f_emotions'); if (emo) emo.value = en.emotions || '';
      const com = document.getElementById('f_comments'); if (com) com.value = en.comments || '';

      State.medsBuffer = Array.isArray(en.meds) ? JSON.parse(JSON.stringify(en.meds)) : [];

      if (window.updateScoreRange) {
        window.updateScoreRange(document.getElementById('f_pain'));
        window.updateScoreRange(document.getElementById('f_symptoms'));
      }
    } else {
      const d = document.getElementById('f_date'); if (d) d.value = U.toISODate(new Date());
      const t = document.getElementById('f_time'); if (t) t.value = new Date().toTimeString().slice(0, 5);

      ['glucose', 'bodyBattery', 'stress', 'weightLbs', 'heightIn', 'waistIn', 'tempF', 'lungFluidCc', 'sys', 'dia', 'spo2', 'hr', 'resp', 'sleep', 'steps']
        .forEach(k => {
          const el = document.getElementById('f_' + k);
          if (el) el.value = '';
        });

      const p = document.getElementById('f_pain'); if (p) p.value = 0;
      const pval = document.getElementById('painVal'); if (pval) pval.textContent = '0';

      const sx = document.getElementById('f_symptoms'); if (sx) sx.value = 0;
      const sxVal = document.getElementById('symptomsVal'); if (sxVal) sxVal.textContent = '0';

      const emo = document.getElementById('f_emotions'); if (emo) emo.value = '';
      const com = document.getElementById('f_comments'); if (com) com.value = '';

      if (window.updateScoreRange) {
        window.updateScoreRange(document.getElementById('f_pain'));
        window.updateScoreRange(document.getElementById('f_symptoms'));
      }
    }

    UI.renderMedsBuffer();
  },

  closeEntry() { document.getElementById('entryModal')?.classList.remove('show'); },

  openFields() {
    document.getElementById('fieldsModal')?.classList.add('show');
    const grid = document.getElementById('fieldsGrid');
    if (!grid) return;

    grid.innerHTML = '';
    const all = ['date', 'time', ...METRICS.map(m => m.key)];
    for (const k of all) {
      const m = METRICS.find(x => x.key === k);
      const lab = m ? m.label : (k === 'date' ? 'Date' : 'Time');
      const id = 'fld_' + k;

      const wrap = document.createElement('div');
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.id = id; cb.checked = State.fieldsVisible.has(k);
      cb.onchange = () => { if (cb.checked) State.fieldsVisible.add(k); else State.fieldsVisible.delete(k); };

      const lb = document.createElement('label');
      lb.htmlFor = id;
      lb.textContent = lab;

      wrap.appendChild(cb);
      wrap.appendChild(lb);
      grid.appendChild(wrap);
    }
  },

  closeFields() { document.getElementById('fieldsModal')?.classList.remove('show'); },

  openThresholds() {
    const modal = document.getElementById('thModal');
    if (modal) modal.classList.add('show');

    const host = document.getElementById('thEditor');
    if (!host) return;

    host.innerHTML = '';

    const keys = ['glucose', 'sys', 'dia', 'spo2', 'hr', 'tempF', 'stress', 'bodyBattery', 'lungFluidCc', 'resp', 'sleep', 'steps', 'pain', 'symptoms', 'bmi', 'whtr'];

    let html = '';
    for (const k of keys) {
      const th = State.thresholds[k] || { warnLow: '', bandLow: '', bandHigh: '', warnHigh: '' };
      const title = (METRICS.find(m => m.key === k)?.label) || k.toUpperCase();
      html += `
        <div class="card" style="margin-bottom:10px">
          <h2>${title}</h2>
          <div class="row">
            <div><label>Warn Low</label><input type="number" id="t_${k}_warnLow" value="${th.warnLow}"></div>
            <div><label>Band Low</label><input type="number" id="t_${k}_bandLow" value="${th.bandLow}"></div>
            <div><label>Band High</label><input type="number" id="t_${k}_bandHigh" value="${th.bandHigh}"></div>
            <div><label>Warn High</label><input type="number" id="t_${k}_warnHigh" value="${th.warnHigh}"></div>
          </div>
        </div>
      `;
    }

    host.innerHTML = html;
    bindSaveThresholds();
  },

  closeThresholds() { document.getElementById('thModal')?.classList.remove('show'); },

  openOptions() {
    document.getElementById('optModal')?.classList.add('show');
    const a = document.getElementById('optAutosave'); if (a) a.value = State.options.autosave;
    const c = document.getElementById('optCsvSelected'); if (c) c.value = State.options.csvSelectedOnly;
    const p = document.getElementById('optPdfChart'); if (p) p.value = State.options.pdfIncludeChart;
  },

  closeOptions() { document.getElementById('optModal')?.classList.remove('show'); },

  openBulkRemove() {
    const wrap = document.getElementById('rm_range_wrap'); if (wrap) wrap.style.display = '';
    const ms = document.getElementById('rm_mode'); if (ms) ms.value = 'range';
    const s = document.getElementById('rm_start'); if (s) s.value = '';
    const e = document.getElementById('rm_end'); if (e) e.value = '';
    document.getElementById('bulkRemoveModal')?.classList.add('show');
  },

  closeBulkRemove() { document.getElementById('bulkRemoveModal')?.classList.remove('show'); },

  renderMedsBuffer() {
    const host = document.getElementById('medList');
    if (!host) return;

    host.innerHTML = '';
    State.medsBuffer.forEach((m, idx) => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.textContent = `${m.name} ${m.dose}${m.units ? (' ' + m.units) : ''}`;

      const btn = document.createElement('button');
      btn.className = 'btn danger';
      btn.style.padding = '2px 6px';
      btn.style.marginLeft = '6px';
      btn.textContent = 'x';
      btn.onclick = () => { State.medsBuffer.splice(idx, 1); UI.renderMedsBuffer(); };

      chip.appendChild(btn);
      host.appendChild(chip);
    });
  }
};

/* ==================== View mode + chart collapse helpers ==================== */
async function saveUI() { await DB.putConfig('ui', State.ui); }

function applyViewMode() {
  const entriesCard = document.getElementById('entriesCard');
  const chartCard = document.getElementById('chartCard');

  const vm = State.ui.viewMode || 'both';
  const showChart = State.ui.chartEnabled === true;

  const showEntriesByVM = (vm === 'both' || vm === 'table');
  const showChartByVM = (vm === 'both' || vm === 'chart');

  if (entriesCard) entriesCard.style.display = showEntriesByVM ? '' : 'none';
  if (chartCard) chartCard.style.display = (showChartByVM && showChart) ? '' : 'none';

  if (vm === 'chart' && !showChart) {
    State.ui.chartEnabled = true;
    const toggle = document.getElementById('toggleChart');
    if (toggle) toggle.value = 'on';
    if (chartCard) chartCard.style.display = '';
    saveUI();
  }

  if ((vm === 'both' || vm === 'chart') && State.ui.chartEnabled) setTimeout(() => UI.refreshChart?.(), 0);
}

function setChartCollapsed(collapsed) {
  const panel = document.getElementById('chartPanel');
  if (!panel) return;
  panel.style.display = collapsed ? 'none' : '';
}

function updateCollapseButton() {
  const btn = document.getElementById('btnCollapseChart');
  if (!btn) return;
  btn.textContent = State.ui.collapsedChart ? 'Expand' : 'Collapse';
  btn.title = State.ui.collapsedChart ? 'Expand chart area' : 'Collapse chart area';
}

/* ==================== CSV Import Helpers (ISO normalization) ==================== */
function parseCSV(text) {
  const rows = []; let row = [], cur = '', i = 0, inQuotes = false;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i += 2; continue; } inQuotes = false; i++; continue; }
      cur += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ',') { row.push(cur); cur = ''; i++; continue; }
    if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; i++; continue; }
    if (ch === '\r') { row.push(cur); rows.push(row); row = []; cur = ''; i++; if (text[i] === '\n') i++; continue; }
    cur += ch; i++;
  }
  row.push(cur); rows.push(row);
  if (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') rows.pop();
  return rows;
}

function normalizeHeader(h) {
  if (!h) return '';
  const s = String(h).trim().toLowerCase().replace(/\s+/g, '');
  const map = {
    'date': 'date', 'time': 'time', 'datetime': 'datetime',
    'glucose(mg/dl)': 'glucose', 'glucose': 'glucose',
    'bodybattery': 'bodyBattery', 'stress': 'stress',
    'weight(lbs)': 'weightLbs', 'weightlbs': 'weightLbs', 'weight': 'weightLbs',
    'height(in)': 'heightIn', 'heightin': 'heightIn', 'height': 'heightIn',
    'waist(in)': 'waistIn', 'waistin': 'waistIn', 'waist': 'waistIn',
    'temperature(°f)': 'tempF', 'temperature(f)': 'tempF', 'tempf': 'tempF', 'temperature': 'tempF', 'temp': 'tempF',
    'lungfluid(cc)': 'lungFluidCc', 'lungfluidcc': 'lungFluidCc', 'lungfluid': 'lungFluidCc',
    'systolic(mmhg)': 'sys', 'systolic': 'sys', 'sys': 'sys',
    'diastolic(mmhg)': 'dia', 'diastolic': 'dia', 'dia': 'dia',
    'spox(%)': 'spo2', 'spo2(%)': 'spo2', 'spo2': 'spo2',
    'heartrate(bpm)': 'hr', 'heartrate': 'hr', 'hr': 'hr', 'pulse': 'hr',
    'respiration(br/min)': 'resp', 'respiration': 'resp', 'resp': 'resp',
    'sleep(hrs)': 'sleep', 'sleephrs': 'sleep', 'sleep': 'sleep',
    'steps': 'steps',
    'pain(0-10)': 'pain', 'pain': 'pain',
    'symptoms(0-10)': 'symptoms', 'symptoms': 'symptoms', 'sx': 'symptoms',
    'emotions': 'emotions', 'mood': 'emotions',
    'comments': 'comments', 'notes': 'comments',
    'medicines': 'meds', 'meds': 'meds'
  };
  return map[s] || s;
}

function csvRowToEntry(row, headerIndex) {
  const e = {
    date: null, time: null,
    glucose: null, bodyBattery: null, stress: null,
    weightLbs: null, heightIn: null, waistIn: null,
    tempF: null, lungFluidCc: null, sys: null, dia: null,
    spo2: null, hr: null, resp: null, sleep: null, steps: null,
    pain: null, symptoms: null,
    emotions: '', comments: '', meds: []
  };

  const dtIdx = headerIndex['datetime'];
  const dateIdx = headerIndex['date'];
  const timeIdx = headerIndex['time'];

  if (dtIdx != null) {
    const raw = String(row[dtIdx] ?? '').trim();
    if (raw) {
      const parts = raw.replace('T', ' ').split(/\s+/);
      const d = U.normalizeDateString(parts[0]);
      const t = U.normalizeTimeString(parts[1] || '00:00') || '00:00';
      if (d) { e.date = d; e.time = t; }
      else {
        const probe = new Date(raw);
        if (!isNaN(probe.getTime())) {
          e.date = U.toISODate(probe);
          e.time = (U.normalizeTimeString(raw.slice(11, 16)) || '00:00');
        }
      }
    }
  }

  if (!e.date && dateIdx != null) e.date = U.normalizeDateString(String(row[dateIdx] ?? '').trim());
  if (!e.time && timeIdx != null) e.time = U.normalizeTimeString(String(row[timeIdx] ?? '').trim()) || '00:00';
  if (!e.date) return null;

  const numericKeys = ['glucose', 'bodyBattery', 'stress', 'weightLbs', 'heightIn', 'waistIn', 'tempF', 'lungFluidCc', 'sys', 'dia', 'spo2', 'hr', 'resp', 'sleep', 'steps', 'pain', 'symptoms'];
  for (const k of numericKeys) {
    const idx = headerIndex[k];
    if (idx != null) {
      const s = String(row[idx] ?? '').trim();
      e[k] = (s === '' ? null : (Number.isFinite(Number(s)) ? Number(s) : null));
    }
  }

  if (headerIndex['emotions'] != null) e.emotions = String(row[headerIndex['emotions']] ?? '').trim();
  if (headerIndex['comments'] != null) e.comments = String(row[headerIndex['comments']] ?? '').trim();

  if (headerIndex['meds'] != null) {
    const raw = String(row[headerIndex['meds']] ?? '').trim();
    if (raw) {
      const parts = raw.split(';').map(s => s.trim()).filter(Boolean);
      e.meds = parts.map(p => {
        const m = p.match(/^(.+?)\s+([\d.]+)\s*([a-zA-Z]+)?$/);
        return m ? { name: m[1], dose: m[2], units: m[3] || '' } : { name: p, dose: '', units: '' };
      });
    }
  }

  return e;
}

/* ==================== Actions ==================== */
const Actions = {
  async init() {
    await DB.open();

    const fields = await DB.getConfig('fieldsVisible'); if (fields) State.fieldsVisible = new Set(fields);
    const thresholds = await DB.getConfig('thresholds'); if (thresholds) State.thresholds = thresholds;
    const options = await DB.getConfig('options'); if (options) State.options = options;

    const ui = await DB.getConfig('ui');
    if (ui && typeof ui.chartEnabled === 'boolean') State.ui.chartEnabled = ui.chartEnabled;
    if (ui && typeof ui.viewMode === 'string') State.ui.viewMode = ui.viewMode;
    if (ui && typeof ui.collapsedChart === 'boolean') State.ui.collapsedChart = ui.collapsedChart;

    const chartToggle = document.getElementById('toggleChart'); if (chartToggle) chartToggle.value = State.ui.chartEnabled ? 'on' : 'off';
    const viewSel = document.getElementById('viewMode'); if (viewSel) viewSel.value = State.ui.viewMode || 'both';

    applyViewMode();
    setChartCollapsed(State.ui.collapsedChart);
    updateCollapseButton();

    State.entries = await DB.getAllEntries();

    UI.initChartMetricSelector();
    UI.buildTable();
    UI.refreshKPIs();
    UI.refreshChart();
  },

  async saveEntryFromForm() {
    const isEdit = State.editId != null;

    const rawDate = document.getElementById('f_date')?.value || '';
    const rawTime = document.getElementById('f_time')?.value || '';
    const normDate = U.normalizeDateString(rawDate);
    const normTime = U.normalizeTimeString(rawTime) || '00:00';
    if (!normDate) { alert('Date is required and must be valid (YYYY-MM-DD).'); return; }

    function num(id) {
      const el = document.getElementById(id);
      const v = el ? el.value : '';
      return v === '' ? null : Number(v);
    }

    const en = {
      date: normDate,
      time: normTime,
      glucose: num('f_glucose'),
      bodyBattery: num('f_bodyBattery'),
      stress: num('f_stress'),
      weightLbs: num('f_weightLbs'),
      heightIn: num('f_heightIn'),
      waistIn: num('f_waistIn'),
      tempF: num('f_tempF'),
      lungFluidCc: num('f_lungFluidCc'),
      sys: num('f_sys'),
      dia: num('f_dia'),
      spo2: num('f_spo2'),
      hr: num('f_hr'),
      resp: num('f_resp'),
      sleep: num('f_sleep'),
      steps: num('f_steps'),
      pain: num('f_pain'),
      symptoms: num('f_symptoms'),
      emotions: document.getElementById('f_emotions')?.value || '',
      comments: document.getElementById('f_comments')?.value || '',
      meds: JSON.parse(JSON.stringify(State.medsBuffer)),
    };

    if (isEdit) en.id = Number(State.editId);

    await DB.putEntry(en);
    State.editId = null;
    UI.closeEntry();
  },

  async deleteEntry(id) { await DB.deleteEntry(id); },

  async refreshAll() {
    State.entries = await DB.getAllEntries();
    UI.buildTable();
    UI.refreshKPIs();
    UI.refreshChart();
  },

  async saveFields() {
    await DB.putConfig('fieldsVisible', Array.from(State.fieldsVisible));
    UI.closeFields();
    UI.buildTable();
  },

  async saveThresholds() {
    try {
      const existing = State.thresholds || {};
      const merged = { ...existing };
      const editKeys = ['glucose', 'sys', 'dia', 'spo2', 'hr', 'tempF', 'stress', 'bodyBattery', 'lungFluidCc', 'resp', 'sleep', 'steps', 'pain', 'symptoms', 'bmi', 'whtr'];

      const getNum = (id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        const s = (el.value ?? '').trim();
        if (s === '') return null;
        const v = Number(s);
        return Number.isFinite(v) ? v : null;
      };

      let changedCount = 0;
      for (const k of editKeys) {
        const wl = getNum(`t_${k}_warnLow`);
        const bl = getNum(`t_${k}_bandLow`);
        const bh = getNum(`t_${k}_bandHigh`);
        const wh = getNum(`t_${k}_warnHigh`);
        if (wl === null && bl === null && bh === null && wh === null) continue;

        const cur = merged[k] || { warnLow: null, bandLow: null, bandHigh: null, warnHigh: null };
        const next = {
          warnLow: wl !== null ? wl : cur.warnLow,
          bandLow: bl !== null ? bl : cur.bandLow,
          bandHigh: bh !== null ? bh : cur.bandHigh,
          warnHigh: wh !== null ? wh : cur.warnHigh
        };

        if (next.bandLow != null && next.bandHigh != null && next.bandLow > next.bandHigh) {
          const tmp = next.bandLow; next.bandLow = next.bandHigh; next.bandHigh = tmp;
        }

        merged[k] = next;
        changedCount++;
      }

      if (changedCount > 0) {
        State.thresholds = merged;
        await DB.putConfig('thresholds', merged);
      }

      UI.closeThresholds?.();
      UI.refreshKPIs?.();
      UI.refreshChart?.();
      if (changedCount === 0) alert('No threshold values changed.');
    } catch (err) {
      console.error(err);
      alert('Failed to save thresholds. See console for details.');
    }
  },

  async saveOptions() {
    State.options = {
      autosave: document.getElementById('optAutosave')?.value,
      csvSelectedOnly: document.getElementById('optCsvSelected')?.value,
      pdfIncludeChart: document.getElementById('optPdfChart')?.value
    };

    await DB.putConfig('options', State.options);
    UI.closeOptions();
  },

  exportCSV() {
    try {
      const start = document.getElementById('filterStart')?.value;
      const end = document.getElementById('filterEnd')?.value;
      const rows = State.entries.filter(e => U.dateInRange(e.date, start, end));
      const fields = State.options.csvSelectedOnly === 'yes' ? [...State.fieldsVisible] : CORE_FIELDS;

      const headers = [];
      if (fields.includes('date')) headers.push('date');
      if (fields.includes('time')) headers.push('time');
      CORE_FIELDS.filter(f => !['date', 'time'].includes(f)).forEach(f => { if (fields.includes(f)) headers.push(f); });

      let csv = headers.join(',') + '\n';
      for (const r of rows) {
        const vals = headers.map(h => {
          let v = r[h];
          if (h === 'meds') v = Array.isArray(v) ? v.map(m => `${m.name} ${m.dose}${m.units ? (' ' + m.units) : ''}`).join('; ') : '';
          return U.csvEscape(v == null ? '' : v);
        });
        csv += vals.join(',') + '\n';
      }

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `health-tracker_${U.toISODate(new Date())}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error(err);
      alert('CSV export failed. See console for details.');
    }
  },

  async importCSVFromFile(file) {
    try {
      if (!file) return;
      const text = await file.text();
      if (!text.trim()) { alert('Selected CSV is empty.'); return; }

      const rows = parseCSV(text);
      if (!rows.length) { alert('No rows found in CSV.'); return; }

      const headersRaw = rows[0];
      const headerIndex = {};
      headersRaw.forEach((h, i) => {
        const key = normalizeHeader(h);
        if (key) headerIndex[key] = i;
      });

      if (headerIndex['date'] == null && headerIndex['datetime'] == null) {
        alert('CSV must include a "date" or "datetime" column.');
        return;
      }

      let imported = 0, skipped = 0;
      for (let r = 1; r < rows.length; r++) {
        const entry = csvRowToEntry(rows[r], headerIndex);
        if (!entry) { skipped++; continue; }
        await DB.putEntry(entry);
        imported++;
      }

      await Actions.refreshAll();
      alert(`Import complete.\nImported: ${imported}\nSkipped: ${skipped}`);
    } catch (err) {
      console.error(err);
      alert('Import failed. See console for details.');
    }
  },

  exportPDF: async function exportPDF() {
    try {
      if (!window.jspdf) { alert('jsPDF failed to load.'); return; }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });

      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 36;
      const contentW = pageW - margin * 2;
      const bottomLimit = pageH - margin;

      let y = margin;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(20);
      doc.text('Health Tracker Export', margin, y); y += 18;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(30);
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y); y += 16;

      const start = document.getElementById('filterStart')?.value;
      const end = document.getElementById('filterEnd')?.value;
      const parseDT = (d, t) => { const dt = U.parseDateTime(d, t); return dt ? dt.getTime() : 0; };

      const all = (State.entries || [])
        .filter(e => U.dateInRange(e.date, start, end))
        .sort((a, b) => parseDT(a.date, a.time) - parseDT(b.date, b.time));

      const visible = new Set(State.fieldsVisible || []);
      const baseHeaders = ['date', 'time', ...METRICS.map(m => m.key)].filter(k => visible.has(k));

      const headers = [];
      if (baseHeaders.includes('date')) headers.push('date');
      if (baseHeaders.includes('time')) headers.push('time');
      baseHeaders.forEach(h => { if (!['date', 'time'].includes(h)) headers.push(h); });
      if (!headers.length) headers.push('date', 'time');

      const wantChart = (State.options?.pdfIncludeChart === 'yes') && State.ui.chartEnabled === true;
      if (wantChart && UI.chart && typeof UI.chart.toBase64Image === 'function') {
        const hasAnyPoint = (UI.chart.data?.datasets || []).some(ds => (ds.data || []).some(v => v != null && v !== ''));
        if (hasAnyPoint) {
          try { UI.chart.update('none'); } catch { }
          const url = UI.chart.toBase64Image('image/png', 1.0);
          if (url && /^data:image\/png;base64,/.test(url)) {
            const chartH = 220;
            if (y + chartH + 10 > bottomLimit) { doc.addPage(); y = margin; }
            doc.addImage(url, 'PNG', margin, y, contentW, chartH, undefined, 'FAST');
            y += chartH + 12;
          }
        }
      }

      const rows = all.map(r => {
        const flat = { ...r };
        if (Array.isArray(flat.meds)) {
          flat.meds = flat.meds.map(m => `${m.name} ${m.dose}${m.units ? (' ' + m.units) : ''}`).join('; ');
        }
        return flat;
      });

      const LABEL_ABBR = {
        'Glucose (mg/dL)': 'Glucose', 'Systolic (mmHg)': 'Sys', 'Diastolic (mmHg)': 'Dia',
        'Temperature (°F)': 'Temp', 'Heart Rate (bpm)': 'HR', 'Respiration (br/min)': 'Resp',
        'Body Battery': 'BodyBat', 'SpO₂ (%)': 'SpO2', 'Lung Fluid (cc)': 'LungFl',
        'Weight (lbs)': 'Wt', 'Height (in)': 'Ht', 'Waist (in)': 'Waist',
        'Sleep (hrs)': 'Sleep', 'Medicines': 'Meds', 'Emotions': 'Mood', 'Comments': 'Notes',
        'Symptoms (0-10)': 'Sx'
      };

      const labelOf = (k) => (k === 'date' ? 'Date' : (k === 'time' ? 'Time' : (METRICS.find(x => x.key === k)?.label || k.toUpperCase())));

      function shortLabel(label, colW) {
        const abbr = LABEL_ABBR[label] || label;
        const maxChars = Math.max(3, Math.floor((colW - 8) / 6));
        return abbr.length > maxChars ? (abbr.slice(0, maxChars - 1) + '…') : abbr;
      }

      const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };
      const maxColsPerChunk = 6;
      const headerChunks = chunk(headers, maxColsPerChunk);

      const cellPadX = 4, cellPadY = 3;
      const headerH = 14, rowBaseH = 12;

      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(15);

      for (const cols of headerChunks) {
        const colW = Math.floor(contentW / Math.max(1, cols.length));
        if (y + headerH + 6 > bottomLimit) { doc.addPage(); y = margin; }

        let x = margin;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(20);
        cols.forEach(col => { const lbl = labelOf(col); doc.text(shortLabel(lbl, colW), x + cellPadX, y + 10); x += colW; });
        doc.setDrawColor(160); doc.setLineWidth(0.5);
        doc.line(margin, y + headerH, margin + contentW, y + headerH);
        y += headerH + 4;

        doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(15);
        for (const r of rows) {
          let rowH = rowBaseH;
          const wrapped = cols.map(col => {
            let v = r[col]; if (v == null) v = '';
            v = String(v);
            const lines = doc.splitTextToSize(v, colW - cellPadX * 2);
            const h = lines.length * 12 + cellPadY * 2;
            if (h > rowH) rowH = h;
            return lines;
          });

          if (y + rowH > bottomLimit) { doc.addPage(); y = margin; }

          let xCell = margin;
          for (let i = 0; i < cols.length; i++) {
            let lineY = y + 10;
            for (const ln of wrapped[i]) { doc.text(ln, xCell + cellPadX, lineY); lineY += 12; }
            xCell += colW;
          }
          y += rowH;
        }
        y += 10;
      }

      const stamp = new Date().toISOString().slice(0, 10);
      doc.save(`health-tracker_${stamp}.pdf`);
    } catch (err) {
      console.error(err);
      alert('PDF export failed. See console for details.');
    }
  }
};

/* ==================== Event Wiring ==================== */
function bindSaveThresholds() {
  const btn = document.getElementById('btnSaveThresholds');
  if (btn && !btn._bound) { btn.addEventListener('click', Actions.saveThresholds); btn._bound = true; }
}

// Core buttons
document.getElementById('btnAdd')?.addEventListener('click', () => UI.openEntry(null));
document.getElementById('btnFields')?.addEventListener('click', () => UI.openFields());
document.getElementById('btnThresholds')?.addEventListener('click', () => UI.openThresholds());
document.getElementById('btnOptions')?.addEventListener('click', () => UI.openOptions());
document.getElementById('btnSaveFields')?.addEventListener('click', Actions.saveFields);
document.getElementById('btnSaveOptions')?.addEventListener('click', Actions.saveOptions);

document.getElementById('btnSaveEntry')?.addEventListener('click', async () => {
  await Actions.saveEntryFromForm();
  await Actions.refreshAll();
});

document.getElementById('btnDeleteEntry')?.addEventListener('click', async () => {
  if (State.editId != null && confirm('Delete this entry?')) {
    await Actions.deleteEntry(State.editId);
    UI.closeEntry();
    await Actions.refreshAll();
  }
});

document.getElementById('btnRefresh')?.addEventListener('click', () => { UI.buildTable(); UI.refreshKPIs(); UI.refreshChart(); });
document.getElementById('btnSaveCSV')?.addEventListener('click', Actions.exportCSV);
document.getElementById('btnSavePDF')?.addEventListener('click', Actions.exportPDF);

// Medicines chip add
document.getElementById('btnAddMed')?.addEventListener('click', () => {
  const name = document.getElementById('med_name')?.value.trim();
  const dose = document.getElementById('med_dose')?.value.trim();
  const units = document.getElementById('med_units')?.value.trim();
  if (!name) return;
  State.medsBuffer.push({ name, dose, units });
  if (document.getElementById('med_name')) document.getElementById('med_name').value = '';
  if (document.getElementById('med_dose')) document.getElementById('med_dose').value = '';
  if (document.getElementById('med_units')) document.getElementById('med_units').value = '';
  UI.renderMedsBuffer();
});

// CSV import wiring
document.getElementById('btnImportCSV')?.addEventListener('click', () => document.getElementById('importFile')?.click());
document.getElementById('importFile')?.addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  await Actions.importCSVFromFile(file);
  e.target.value = '';
});

// Filters & chart controls
document.getElementById('chartMetrics')?.addEventListener('change', () => UI.refreshChart());
document.getElementById('axisMode')?.addEventListener('change', () => UI.refreshChart());
document.getElementById('filterStart')?.addEventListener('change', () => { UI.buildTable(); UI.refreshChart(); });
document.getElementById('filterEnd')?.addEventListener('change', () => { UI.buildTable(); UI.refreshChart(); });

// Chart toggle (persist) — respects viewMode
document.getElementById('toggleChart')?.addEventListener('change', async (e) => {
  State.ui.chartEnabled = (e.target.value === 'on');
  if (!State.ui.chartEnabled && State.ui.viewMode === 'chart') {
    State.ui.viewMode = 'table';
    const viewSel = document.getElementById('viewMode');
    if (viewSel) viewSel.value = 'table';
  }
  applyViewMode();
  if (!State.ui.chartEnabled && UI.chart) { UI.chart.destroy(); UI.chart = null; }
  await DB.putConfig('ui', State.ui);
  UI.refreshChart();
});

// “Select Fields” extra actions
document.getElementById('btnQuickAdd')?.addEventListener('click', () => UI.openEntry(null));
document.getElementById('btnBulkDelete')?.addEventListener('click', () => UI.openBulkRemove());
document.getElementById('rm_mode')?.addEventListener('change', (e) => {
  const wrap = document.getElementById('rm_range_wrap');
  if (wrap) wrap.style.display = (e.target.value === 'range') ? '' : 'none';
});

document.getElementById('btnConfirmBulkRemove')?.addEventListener('click', async () => {
  const mode = (document.getElementById('rm_mode')?.value) || 'range';
  const rmStart = document.getElementById('rm_start')?.value || '';
  const rmEnd = document.getElementById('rm_end')?.value || '';
  let targets = [];
  if (mode === 'all') targets = [...State.entries];
  else {
    const inRange = (dateStr) => U.dateInRange(dateStr, rmStart, rmEnd);
    targets = State.entries.filter(e => inRange(e.date));
  }
  if (!targets.length) { alert('No entries match the selected criteria.'); return; }
  const label = (mode === 'all') ? 'ALL entries' : `entries from ${rmStart || 'beginning'} to ${rmEnd || 'now'}`;
  if (!confirm(`This will permanently delete ${targets.length} ${label}.\n\nAre you sure?`)) return;
  try {
    for (const en of targets) {
      if (en && typeof en.id !== 'undefined') await DB.deleteEntry(en.id);
    }
    UI.closeBulkRemove?.();
    await Actions.refreshAll();
    alert(`Deleted ${targets.length} ${label}.`);
  } catch (err) {
    console.error(err);
    alert('Failed to remove entries. See console for details.');
  }
});

// View mode select
document.getElementById('viewMode')?.addEventListener('change', async (e) => {
  const val = e.target.value || 'both';
  State.ui.viewMode = (val === 'table' || val === 'chart') ? val : 'both';
  if (State.ui.viewMode === 'chart' && !State.ui.chartEnabled) {
    State.ui.chartEnabled = true;
    const toggle = document.getElementById('toggleChart');
    if (toggle) toggle.value = 'on';
  }
  applyViewMode();
  await DB.putConfig('ui', State.ui);
});

// Collapse button
document.getElementById('btnCollapseChart')?.addEventListener('click', async () => {
  State.ui.collapsedChart = !State.ui.collapsedChart;
  setChartCollapsed(State.ui.collapsedChart);
  updateCollapseButton();
  await DB.putConfig('ui', State.ui);
  if (!State.ui.collapsedChart && State.ui.chartEnabled) setTimeout(() => UI.refreshChart?.(), 0);
});

// Close modals by clicking backdrop
for (const id of ['entryModal', 'fieldsModal', 'thModal', 'optModal', 'bulkRemoveModal']) {
  document.getElementById(id)?.addEventListener('click', (ev) => {
    if (ev.target.classList?.contains('modal-backdrop')) ev.target.classList.remove('show');
  });
}

// Defer init until window 'load' so deferred libs are ready
window.addEventListener('load', async () => {
  registerSW();
 
  await Actions.init();
  // If range slider helper exists, init it (no dependency)
  if (window.initScoreRanges) window.initScoreRanges();
});

// Preserve global names for inline HTML handlers
window.UI = UI;
window.Actions = Actions;
