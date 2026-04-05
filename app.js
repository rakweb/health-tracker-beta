/* =========================================================
   Health Tracker — app.js (beta-compatible IDs)
   - Chart + Entries + CSV/PDF + PWA
   - Add metrics by editing CONFIG.metrics
   ========================================================= */

const CONFIG = {
  storageKey: "healthTracker.entries.v1",

  // Metrics are the single source of truth:
  // - Table columns
  // - Chart datasets
  // - Modal read/write
  // - CSV/PDF export/import
  metrics: [
    {
      key: "glucose",
      label: "Glucose",
      unit: "mg/dL",
      color: "#4ba3ff",
      axis: "y",
      decimals: 0,
      inputId: "fGlucose",
    },
    {
      key: "weight",
      label: "Weight",
      unit: "",
      color: "#27d79b",
      axis: "y1",
      decimals: 1,
      inputId: "fWeight",
    },
    {
      key: "sys",
      label: "BP",
      unit: "",
      color: "#ffcc66",
      axis: "y",
      decimals: 0,
      inputId: "fSys",
    },
    {
      key: "dia",
      label: "Dia",
      unit: "",
      color: "#ffa24d",
      axis: "y",
      decimals: 0,
      inputId: "fDia",
    },
    {
      key: "spo2",
      label: "SpO₂",
      unit: "%",
      color: "#ff5c5c",
      axis: "y",
      decimals: 0,
      inputId: "fSpo2",
    },
  ],

  // Which metrics show on chart by default
  defaultVisible: ["glucose", "weight", "sys", "dia", "spo2"],

  pdfTitle: "Health Tracker Export",
};

const state = {
  entries: [],
  editingId: null,
  chart: null,
  visible: new Set(CONFIG.defaultVisible),
};

/* ---------------- DOM helpers ---------------- */
const $ = (sel) => document.querySelector(sel);
const el = (tag, attrs = {}, children = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k.startsWith("on") && typeof v === "function")
      n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, "");
    else if (v !== false && v != null) n.setAttribute(k, String(v));
  }
  for (const c of children) n.append(c);
  return n;
};

function toast(title, message) {
  const host = $("#toasts");
  const t = el("div", { class: "toast" }, [
    el("strong", { text: title }),
    el("div", { text: message }),
  ]);
  host.append(t);
  setTimeout(() => t.remove(), 4200);
}

/* ---------------- Date/format ---------------- */
function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function numOrNull(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function fmt(metric, value) {
  if (value == null) return "";
  return Number(value).toFixed(metric.decimals ?? 0);
}

/* ---------------- Storage ---------------- */
function loadEntries() {
  try {
    const raw = localStorage.getItem(CONFIG.storageKey);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr
      .map(normalizeEntry)
      .filter(Boolean)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  } catch {
    return [];
  }
}
function saveEntries() {
  localStorage.setItem(CONFIG.storageKey, JSON.stringify(state.entries));
}
function normalizeEntry(e) {
  if (!e || typeof e !== "object") return null;
  const date = String(e.date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const out = {
    id: String(e.id || crypto.randomUUID()),
    date,
    notes: typeof e.notes === "string" ? e.notes : "",
  };

  for (const m of CONFIG.metrics) out[m.key] = e[m.key] == null ? null : Number(e[m.key]);
  return out;
}

/* ---------------- Table ---------------- */
function buildTableHead() {
  const tr = $("#tableHeadRow");
  tr.innerHTML = "";
  tr.append(el("th", { text: "Date" }));
  for (const m of CONFIG.metrics) tr.append(el("th", { text: m.label }));
  tr.append(el("th", { text: "Notes" }));
  tr.append(el("th", { text: "" }));
}

function renderTable() {
  const tbody = $("#tableBody");
  tbody.innerHTML = "";

  $("#emptyHint").hidden = state.entries.length !== 0;

  for (const entry of state.entries) {
    const tr = el("tr");

    tr.append(el("td", { text: entry.date }));
    for (const m of CONFIG.metrics) tr.append(el("td", { text: fmt(m, entry[m.key]) }));

    tr.append(el("td", { text: entry.notes || "" }));

    const tdA = el("td");
    tdA.append(
      el(
        "button",
        { class: "btn", type: "button", onclick: () => openModal(entry.id) },
        [document.createTextNode("Edit")]
      )
    );
    tr.append(tdA);

    tbody.append(tr);
  }
}

/* ---------------- Legend (metric toggles) ---------------- */
function renderLegend() {
  const host = $("#metricLegend");
  host.innerHTML = "";

  for (const m of CONFIG.metrics) {
    const id = `toggle_${m.key}`;
    const cb = el("input", { type: "checkbox", id, checked: state.visible.has(m.key) });
    cb.addEventListener("change", () => {
      if (cb.checked) state.visible.add(m.key);
      else state.visible.delete(m.key);
      renderChart();
    });

    host.append(
      el("label", { for: id }, [
        cb,
        el("span", { class: "swatch", style: `background:${m.color}` }),
        el("span", { text: m.label }),
      ])
    );
  }
}

/* ---------------- Chart ---------------- */
function makeChartConfig(labels, datasets) {
  const axisIds = [...new Set(datasets.map((d) => d.yAxisID || "y"))];
  const scales = {};

  axisIds.forEach((id, idx) => {
    scales[id] = {
      type: "linear",
      position: idx % 2 === 0 ? "left" : "right",
      grid: idx === 0 ? { color: "rgba(138,160,195,0.15)" } : { drawOnChartArea: false },
      ticks: { color: "rgba(230,238,252,0.75)" },
    };
  });

  return {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        zoom: {
          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: "x" },
          pan: { enabled: true, mode: "x" },
        },
      },
      scales,
    },
  };
}

function renderChart() {
  if (!window.Chart) return;

  const ordered = [...state.entries].slice().sort((a, b) => (a.date > b.date ? 1 : -1));
  const labels = ordered.map((e) => e.date);

  const datasets = [];
  for (const m of CONFIG.metrics) {
    if (!state.visible.has(m.key)) continue;

    datasets.push({
      label: m.label,
      data: ordered.map((e) => (e[m.key] == null ? null : Number(e[m.key]))),
      borderColor: m.color,
      backgroundColor: m.color,
      borderWidth: 2,
      pointRadius: 2.5,
      pointHoverRadius: 4,
      tension: 0.25,
      spanGaps: true,
      yAxisID: m.axis || "y",
    });
  }

  if (state.chart) state.chart.destroy();
  const ctx = $("#metricsChart").getContext("2d");
  state.chart = new window.Chart(ctx, makeChartConfig(labels, datasets));
}

function resetZoom() {
  if (state.chart && state.chart.resetZoom) state.chart.resetZoom();
}

/*# Metrics Chart: show DATE only (no hour)*/

## What this changes
- X-axis labels: `YYYY-MM-DD` only
- Tooltip title: `YYYY-MM-DD` only
- Keeps chronological ordering using your existing date+time sort

> Note: If you have multiple entries on the same date, the chart will show repeated date labels (one per entry). This preserves each entry as a separate point without using time text.

---

## Patch (copy/paste)

### 1) In `UI.refreshChart()` replace the `labels` line
**Find:**
```js
const labels=rows.map(r=> r.date + (r.time ? (' ' + r.time) : '') );
```

**Replace with:**
```js
// Date-only labels (no hour)
const labels = rows.map(r => r.date || '');
```

---

### 2) Add (or update) tooltip + tick formatting to enforce date-only display
In the `config` object inside `UI.refreshChart()`, replace your existing `config` with the block below **or** merge the indicated parts.

**Find your current config (starts with `const config={ type:'line'...`) and update to:**

```js
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
          // Ensure tooltip title is DATE only
          title: (items) => {
            const lab = items?.[0]?.label ?? '';
            // If label contains anything extra, keep only first token
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
            callback: function(value) {
              // Category scale provides the label via this.getLabelForValue
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
