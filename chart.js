// ====================== HEALTH TRACKER - chart.js (with Theme) ======================

let entries = [];
let chartInstance = null;
let currentEditIndex = -1;
let isDarkMode = true;

// Toast
function showToast(msg) {
  const toast = document.getElementById('updateToast');
  if (toast) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }
}

window.UI = {
  closeEntry: () => document.getElementById('entryModal').classList.remove('show')
};

// Render Table + Chart (same as before)
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

window.editEntry = function(i) { /* ... same as before */ };
window.deleteEntry = function(i) { /* ... same as before */ };

function renderChart() {
  if (chartInstance) chartInstance.destroy();
  const canvas = document.getElementById('metricsChart');
  if (!canvas) return;

  chartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels: entries.map(e => e.date),
      datasets: [
        { label: 'Glucose', data: entries.map(e => e.glucose), borderColor: '#4ba3ff', tension: 0.3 },
        { label: 'Systolic', data: entries.map(e => e.sys), borderColor: '#ff5c5c', tension: 0.3 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

// Theme Toggle
function toggleTheme() {
  isDarkMode = !isDarkMode;
  document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  showToast(isDarkMode ? '🌙 Dark Mode' : '☀️ Light Mode');
}

// ==================== BUTTONS ====================
document.addEventListener('DOMContentLoaded', () => {

  document.getElementById('btnAdd').addEventListener('click', () => {
    currentEditIndex = -1;
    document.getElementById('entryModalTitle').textContent = 'Add Entry';
    document.getElementById('entryModal').classList.add('show');
  });

  document.getElementById('btnSaveEntry').addEventListener('click', () => {
    const entry = {
      date: document.getElementById('f_date').value || new Date().toISOString().slice(0,10),
      glucose: parseFloat(document.getElementById('f_glucose').value) || null,
      sys: parseFloat(document.getElementById('f_sys').value) || null,
      dia: parseFloat(document.getElementById('f_dia').value) || null,
      weightLbs: parseFloat(document.getElementById('f_weightLbs').value) || null
    };

    if (currentEditIndex >= 0) entries[currentEditIndex] = entry;
    else entries.unshift(entry);

    renderTable();
    renderChart();
    showToast('✅ Entry Saved');
    UI.closeEntry();
  });

  document.getElementById('btnRefresh').addEventListener('click', () => {
    renderTable();
    renderChart();
    showToast('✅ Refreshed');
  });

  document.getElementById('btnToggleTheme').addEventListener('click', toggleTheme);

  // Other buttons (CSV, PDF, etc.) - add as needed

  // Sample Data
  if (entries.length === 0) {
    entries = [
      {date:"2026-04-17", glucose:98, sys:118, dia:76, weightLbs:185},
      {date:"2026-04-16", glucose:105, sys:122, dia:80, weightLbs:186}
    ];
  }

  renderTable();
  renderChart();
  showToast('✅ Theme button added');
});