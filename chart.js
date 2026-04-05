<!-- Chart.js -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js" integrity="sha384-3kqC6/..." crossorigin="anonymous"></script>

<!-- (Optional) Annotation plugin -->
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3.1.0/dist/chartjs-plugin-annotation.min.js" integrity="sha384-..." crossorigin="anonymous"></script>

<script>
  // Optional: register annotation plugin safely
  if (window.Chart && window['chartjs-plugin-annotation']) {
    Chart.register(window['chartjs-plugin-annotation']);
  }

  // Your chart code AFTER the libraries load
  const ctx = document.getElementById('myChart')?.getContext('2d');
  if (ctx && window.Chart) {
    new Chart(ctx, {
      type: 'line',
      data: { labels: ['Mon','Tue','Wed','Thu','Fri'],
        datasets: [{ label: 'Demo', data: [12,8,14,10,16], borderColor: '#4ba3ff', tension: .25 }] }
    });
  }
 </script>
