// ====================== HEALTH TRACKER - MATCHING ORIGINAL FORMAT ======================

let entries = [];
let chartInstance = null;
let currentEditIndex = -1;

// Toast
function showToast(msg) {
  const toast = document.getElementById('updateToast');
  if (toast) {
    toast.innerHTML = `<span>${msg}</span>`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2800);
  }
}

window.UI = {
  closeEntry: () => document.getElementById('entryModal').classList.remove('show'),
  closeFields: () => document.getElementById('fieldsModal').classList.remove('show'),
  closeBulkRemove: () => document.getElementById('bulkRemoveModal').classList.remove('show'),
  closeThresholds: () => document.getElementById('thModal').classList.remove('show'),
  closeOptions: () => document.getElementById('optModal').classList.remove('show')
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
    showToast('Entry deleted');
  }
};

// Render Chart
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

// ==================== ALL BUTTONS ====================
document.addEventListener('DOMContentLoaded', () => {

  // Add Entry
  document.getElementById('btnAdd').addEventListener('click', () => {
    currentEditIndex = -1;
    document.getElementById('entryModalTitle').textContent = 'Add Entry';
    document.getElementById('entryModal').classList.add('show');
  });

  // Save Entry
  document.getElementById('btnSaveEntry').addEventListener('click', () => {
    const entry = {
      date: document.getElementById('f_date').value || new Date().toISOString().slice(0,10),
      glucose: parseFloat(document.getElementById('f_glucose').value) || null,
      sys: parseFloat(document.getElementById('f_sys').value) || null,
      dia: parseFloat(document.getElementById('f_dia').value) || null,
      weightLbs: parseFloat(document.getElementById('f_weightLbs').value) || null
    };

    if (currentEditIndex >= 0) {
      entries[currentEditIndex] = entry;
      currentEditIndex = -1;
    } else {
      entries.unshift(entry);
    }

    renderTable();
    renderChart();
    showToast('✅ Entry Saved');
    UI.closeEntry();
  });

  // Refresh
  document.getElementById('btnRefresh').addEventListener('click', () => {
    renderTable();
    renderChart();
    showToast('✅ Refreshed');
  });

  // Save CSV
  document.getElementById('btnSaveCSV').addEventListener('click', () => {
    if (!entries.length) return showToast('No data');
    let csv = "Date,Glucose,Sys,Dia,Weight\n";
    entries.forEach(e => csv += `${e.date||''},${e.glucose||''},${e.sys||''},${e.dia||''},${e.weightLbs||''}\n`);
    const blob = new Blob([csv], {type: 'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'health_tracker.csv';
    a.click();
    showToast('✅ CSV Exported');
  });

  // Save PDF
  document.getElementById('btnSavePDF').addEventListener('click', () => {
    if (typeof jspdf === "undefined") return showToast('PDF library not loaded');
    const { jsPDF } = jspdf;
    const doc = new jsPDF();
    doc.text("Health Tracker Report", 20, 20);
    doc.text(`Total Entries: ${entries.length}`, 20, 30);
    doc.save("health_report.pdf");
    showToast('✅ PDF Exported');
  });

  // Other Modals
  document.getElementById('btnFields').addEventListener('click', () => 
    document.getElementById('fieldsModal').classList.add('show'));

  document.getElementById('btnThresholds').addEventListener('click', () => 
    document.getElementById('thModal').classList.add('show'));

  document.getElementById('btnOptions').addEventListener('click', () => 
    document.getElementById('optModal').classList.add('show'));

  // Sample Data
  if (entries.length === 0) {
    entries = [
      {date:"2026-04-17", glucose:98, sys:118, dia:76, weightLbs:185},
      {date:"2026-04-16", glucose:105, sys:122, dia:80, weightLbs:186}
    ];
  }

  renderTable();
  renderChart();
  showToast('✅ App Loaded - Buttons Active');
});
