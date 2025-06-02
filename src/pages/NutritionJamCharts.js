// NutritionJamCharts.js
// This file contains the chart rendering logic for the NutritionJam page

import Chart from 'chart.js/auto';

// Initialize charts when data is available
export function initializeCharts(proteinData, carbsData, fatData) {
  // Destroy existing charts if they exist
  destroyCharts();
  
  // Combine all datasets into one chart
  if (proteinData && carbsData && fatData && document.getElementById('nutrition-chart')) {
    renderNutritionChart(proteinData, carbsData, fatData);
  }
}

// Destroy existing charts to prevent memory leaks
function destroyCharts() {
  const chartIds = ['nutrition-chart'];
  
  chartIds.forEach(id => {
    const canvas = document.getElementById(id)?.querySelector('canvas');
    if (canvas) {
      const chartInstance = Chart.getChart(canvas);
      if (chartInstance) {
        chartInstance.destroy();
      }
    }
  });
}

// Render combined nutrition trend chart
function renderNutritionChart(proteinData, carbsData, fatData) {
  const container = document.getElementById('nutrition-chart');
  
  // Create canvas if it doesn't exist
  let canvas = container.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    container.appendChild(canvas);
  }
  
  // Combine datasets
  const combinedData = {
    labels: proteinData.labels,
    datasets: [
      {
        ...proteinData.datasets[0],
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 0,
        pointHitRadius: 10,
        pointHoverRadius: 4
      },
      {
        ...carbsData.datasets[0],
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 0,
        pointHitRadius: 10,
        pointHoverRadius: 4
      },
      {
        ...fatData.datasets[0],
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 0,
        pointHitRadius: 10,
        pointHoverRadius: 4
      }
    ]
  };
  
  // Create the chart with minimal styling
  new Chart(canvas, {
    type: 'line',
    data: combinedData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            boxWidth: 12,
            padding: 15,
            font: {
              size: 12
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          titleColor: '#334155',
          bodyColor: '#334155',
          borderColor: '#e2e8f0',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 6,
          callbacks: {
            title: function(tooltipItems) {
              return new Date(tooltipItems[0].label).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              });
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 7,
            callback: function(value, index, values) {
              const date = new Date(this.getLabelForValue(value));
              return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              });
            }
          }
        },
        y: {
          grid: {
            color: 'rgba(226, 232, 240, 0.5)'
          },
          ticks: {
            padding: 10
          },
          beginAtZero: true
        }
      }
    }
  });
}
