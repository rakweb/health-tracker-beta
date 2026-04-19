// ====================== HEALTH TRACKER - chart.js (with IndexedDB) ======================

const DB_NAME = "HealthTrackerDB";
const DB_VERSION = 1;
const STORE_NAME = "entries";

let entries = [];
let chartInstance = null;
let currentEditIndex = -1;
let db;

// Open IndexedDB
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = (e) => {
      db = e.target.result;
      loadEntriesFromDB().then(resolve);
    };
    request.onerror = (e) => reject(e);
  });
}

// Load all entries from IndexedDB
async function loadEntriesFromDB() {
  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      entries = request.result || [];
      renderTable();
      renderChart();
      resolve();
    };
  });
}

// Save all entries to IndexedDB
function saveToDB() {
  const transaction = db.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  store.clear(); // Simple full replace
  entries.forEach(entry => store.put(entry));
}

// Show toast
const showToast = (msg) => {
  const toast = document.getElementById('updateToast');
  if (toast) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }
};

window.UI = {
  closeEntry: () => document.getElementById('entryModal').classList.remove('show')
};

// Render Table
function renderTable() {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;
  tbody.innerHTML = entries.map((e, i) => `
    <tr>
      <td>${e.date || '—'}</td>
      <td>${e.glucose || '—'}</td>
      <td>${e.sys || '—'}/${e.dia || '—'}</td>
      <td>${e.weightLbs || '—'}</td>
      <td>
        <button class="btn" onclick="editEntry(${i})">Edit</button>
        <button class="btn danger" onclick="deleteEntry(${i})">Delete</button>
      </td>
    </tr>
  `).join('');
}

window.editEntry = function(i) {
  currentEditIndex = i;
  const e = entries[i];
  document.getElementById('entryModalTitle').textContent = 'Edit Entry';
  document.getElementById('f_date').value = e.date || '';
  document.getElementById('f_glucose').value = e.glucose || '';
  document.getElementById('f_sys').value = e.sys || '';
  document.getElementById('f_dia').value = e.dia || '';
  document.getElementById('f_weightLbs').value = e.weightLbs || '';
  document.getElementById('entryModal').classList.add('show');
};

window.deleteEntry = function(i) {
  if (confirm('Delete this entry?')) {
    entries.splice(i, 1);
    renderTable();
    renderChart();
    saveToDB();
    showToast('Entry deleted');
  }
};

// Save Entry
document.getElementById('btnSaveEntry').addEventListener('click', () => {
  const entry = {
    date: document.getElementById('f_date').value || new Date().toISOString().slice(0,10),
    glucose: parseFloat(document.getElementById('f_glucose').value),
    sys: parseFloat(document.getElementById('f_sys').value),
    dia: parseFloat(document.getElementById('f_dia').value),
    weightLbs: parseFloat(document.getElementById('f_weightLbs').value)
  };

  if (currentEditIndex >= 0) {
    entries[currentEditIndex] = entry;
    currentEditIndex = -1;
  } else {
    entries.unshift(entry);
  }

  renderTable();
  renderChart();
  saveToDB();
  showToast('✅ Entry saved');
  UI.closeEntry();
});

// Render Trend Chart
function renderChart() {
  if (chartInstance) chartInstance.destroy();
  const ctx = document.getElementById('metricsChart');
  if (!ctx) return;

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: entries.map(e => e.date),
      datasets: [
        { label: 'Glucose', data: entries.map(e => e.glucose), borderColor: '#4ba3ff', tension: 0.3 },
        { label: 'Systolic BP', data: entries.map(e => e.sys), borderColor: '#ff5c5c', tension: 0.3 },
        { label: 'Weight (lbs)', data: entries.map(e => e.weightLbs), borderColor: '#27d79b', tension: 0.3 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

// Export Functions
document.getElementById('btnSaveCSV').addEventListener('click', () => {
  if (!entries.length) return showToast('No data to export');
  let csv = "Date,Glucose,Sys,Dia,Weight\n";
  entries.forEach(e => csv += `${e.date},${e.glucose || ''},${e.sys || ''},${e.dia || ''},${e.weightLbs || ''}\n`);
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'health_tracker.csv';
  a.click();
  showToast('✅ CSV downloaded');
});

document.getElementById('btnSavePDF').addEventListener('click', () => {
  if (typeof jspdf === 'undefined') return showToast('PDF library not loaded');
  const { jsPDF } = jspdf;
  const doc = new jsPDF();
  doc.text("Health Tracker Report", 20, 20);
  doc.text(`Total Entries: ${entries.length}`, 20, 30);
  doc.save("health_report.pdf");
  showToast('✅ PDF downloaded');
});

// Initialize everything
document.addEventListener('DOMContentLoaded', async () => {
  await initDB();

  // Activate all buttons
  document.getElementById('btnAdd').addEventListener('click', () => {
    currentEditIndex = -1;
    document.getElementById('entryModalTitle').textContent = 'Add Entry';
    document.getElementById('entryModal').classList.add('show');
  });

  document.getElementById('btnRefresh').addEventListener('click', () => {
    renderTable();
    renderChart();
    showToast('✅ Refreshed');
  });

  document.getElementById('btnImportCSV').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });

  // Sample data only on first run
  if (entries.length === 0) {
    entries = [
      { date: "2026-04-17", glucose: 98, sys: 118, dia: 76, weightLbs: 185 },
      { date: "2026-04-16", glucose: 105, sys: 122, dia: 80, weightLbs: 186 }
    ];
    saveToDB();
  }

  renderTable();
  renderChart();
  showToast('✅ Health Tracker loaded with persistence');
});
