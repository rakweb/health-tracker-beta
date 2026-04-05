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

/* ---------------- Modal (beta IDs preserved) ---------------- */
function openModal(id = null) {
  state.editingId = id;
  $("#entryModal").hidden = false;

  $("#modalTitle").textContent = id ? "Edit Entry" : "Add Entry";
  $("#deleteEntry").hidden = !id;

  if (!id) {
    $("#fDate").value = todayISO();
    for (const m of CONFIG.metrics) {
      if (m.inputId) $(`#${m.inputId}`).value = "";
    }
    $("#fNotes").value = "";
    return;
  }

  const entry = state.entries.find((x) => x.id === id);
  if (!entry) {
    closeModal();
    toast("Error", "Entry not found.");
    return;
  }

  $("#fDate").value = entry.date;
  for (const m of CONFIG.metrics) {
    if (m.inputId) $(`#${m.inputId}`).value = entry[m.key] ?? "";
  }
  $("#fNotes").value = entry.notes ?? "";
}

function closeModal() {
  $("#entryModal").hidden = true;
  state.editingId = null;
}

function wireModal() {
  $("#closeModal").addEventListener("click", closeModal);
  $("#modalX").addEventListener("click", closeModal);

  $("#entryModal").addEventListener("click", (e) => {
    if (e.target?.dataset?.close) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#entryModal").hidden) closeModal();
  });

  $("#deleteEntry").addEventListener("click", () => {
    if (!state.editingId) return;
    state.entries = state.entries.filter((x) => x.id !== state.editingId);
    saveEntries();
    closeModal();
    renderAll();
    toast("Deleted", "Entry removed.");
  });

  $("#entryForm").addEventListener("submit", (e) => {
    e.preventDefault();
    saveFromForm();
  });
}

function saveFromForm() {
  const date = $("#fDate").value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    toast("Invalid", "Please choose a valid date.");
    return;
  }

  const entry = {
    id: state.editingId || crypto.randomUUID(),
    date,
    notes: $("#fNotes").value || "",
  };

  for (const m of CONFIG.metrics) {
    if (!m.inputId) continue;
    entry[m.key] = numOrNull($(`#${m.inputId}`).value);
  }

  const idx = state.entries.findIndex((x) => x.id === entry.id);
  if (idx >= 0) state.entries[idx] = entry;
  else state.entries.push(entry);

  state.entries.sort((a, b) => (a.date < b.date ? 1 : -1));

  saveEntries();
  closeModal();
  renderAll();
  toast("Saved", "Entry saved.");
}

/* ---------------- CSV ---------------- */
function csvHeader() {
  return ["date", ...CONFIG.metrics.map((m) => m.key), "notes"];
}

function exportCSV() {
  const header = csvHeader();
  const esc = (s) => {
    const str = String(s ?? "");
    if (/[,"\n]/.test(str)) return `"${str.replaceAll('"', '""')}"`;
    return str;
  };

  const rows = [header.join(",")];
  const ordered = [...state.entries].slice().sort((a, b) => (a.date > b.date ? 1 : -1));

  for (const e of ordered) {
    rows.push([e.date, ...CONFIG.metrics.map((m) => e[m.key] ?? ""), esc(e.notes ?? "")].join(","));
  }

  downloadText(`health-tracker-${todayISO()}.csv`, rows.join("\n"), "text/csv");
  toast("Export", "CSV downloaded.");
}

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];

  const parseLine = (line) => {
    const out = [];
    let cur = "";
    let inQ = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const next = line[i + 1];

      if (inQ) {
        if (ch === '"' && next === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQ = false;
        } else {
          cur += ch;
        }
      } else {
        if (ch === '"') inQ = true;
        else if (ch === ",") {
          out.push(cur);
          cur = "";
        } else cur += ch;
      }
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };

  const header = parseLine(lines[0]).map((h) => h.toLowerCase());
  const need = csvHeader();
  const idx = Object.fromEntries(need.map((k) => [k, header.indexOf(k)]));

  if (idx.date < 0) throw new Error("CSV must include a 'date' column.");

  const imported = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const date = cols[idx.date] || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    const e = { id: crypto.randomUUID(), date, notes: "" };
    for (const m of CONFIG.metrics) {
      const j = idx[m.key];
      e[m.key] = j >= 0 ? numOrNull(cols[j]) : null;
    }
    e.notes = idx.notes >= 0 ? cols[idx.notes] ?? "" : "";
    imported.push(e);
  }
  return imported;
}

function importCSVFile(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const imported = parseCSV(String(r.result || ""));
      if (!imported.length) return toast("Import", "No valid rows found.");

      const byDate = new Map(state.entries.map((e) => [e.date, e]));
      for (const e of imported) byDate.set(e.date, e);

      state.entries = [...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
      saveEntries();
      renderAll();
      toast("Import", `Imported ${imported.length} row(s).`);
    } catch (e) {
      toast("Import failed", e.message || "Could not parse CSV.");
    }
  };
  r.readAsText(file);
}

/* ---------------- PDF ---------------- */
function exportPDF() {
  const lib = window.jspdf;
  if (!lib?.jsPDF) return toast("PDF", "PDF library not available.");

  const doc = new lib.jsPDF({ unit: "pt", format: "letter" });
  const left = 40;
  let y = 48;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(CONFIG.pdfTitle, left, y);

  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, left, y);

  y += 22;

  const headers = ["Date", ...CONFIG.metrics.map((m) => m.label), "Notes"];
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(headers.join("   |   "), left, y);
  y += 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const ordered = [...state.entries].slice().sort((a, b) => (a.date > b.date ? 1 : -1));
  for (const e of ordered) {
    const line = [
      e.date,
      ...CONFIG.metrics.map((m) => (e[m.key] == null ? "" : fmt(m, e[m.key]))),
      (e.notes || "").slice(0, 60),
    ].join("   |   ");

    doc.text(line, left, y);
    y += 12;
    if (y > 740) {
      doc.addPage();
      y = 48;
    }
  }

  doc.save(`health-tracker-${todayISO()}.pdf`);
  toast("Export", "PDF downloaded.");
}

/* ---------------- Download helper ---------------- */
function downloadText(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ---------------- PWA SW registration ---------------- */
function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./sw.js", { scope: "./" });
    } catch {
      // ignore
    }
  });
}

/* ---------------- Wire buttons (beta IDs) ---------------- */
function wireActions() {
  $("#btnResetZoom").addEventListener("click", resetZoom);
  $("#btnAdd").addEventListener("click", () => openModal(null));
  $("#btnExportCSV").addEventListener("click", exportCSV);
  $("#btnImportCSV").addEventListener("click", () => $("#fileInput").click());
  $("#btnExportPDF").addEventListener("click", exportPDF);

  $("#fileInput").addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (f) importCSVFile(f);
    e.target.value = "";
  });
}

/* ---------------- Render all ---------------- */
function renderAll() {
  renderLegend();
  buildTableHead();
  renderTable();
  renderChart();
}

/* ---------------- Init ---------------- */
function init() {
  state.entries = loadEntries();
  $("#fDate").value = todayISO();

  wireModal();
  wireActions();
  registerSW();

  renderAll();
}

document.addEventListener("DOMContentLoaded", init);