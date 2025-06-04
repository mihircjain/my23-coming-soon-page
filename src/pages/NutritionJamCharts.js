// NutritionJamCharts.js - Updated version with more comprehensive charts
import Chart from 'chart.js/auto';

// Initialize charts when data is available
export function initializeCharts(nutritionData, timeframe = '7day') {
  // Destroy existing charts if they exist
  destroyCharts();
  
  if (nutritionData && nutritionData.length > 0) {
    renderMacroCharts(nutritionData, timeframe);
  }
}

// Destroy existing charts to prevent memory leaks
function destroyCharts() {
  const chartIds = [
    'calories-chart', 
    'combined-macros-chart',
    'macro-distribution-chart'
  ];
  
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

// Render all macro charts
function renderMacroCharts(nutritionData, timeframe) {
  // Sort data by date (oldest to newest)
  const sortedData = [...nutritionData].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  // Format dates for display
  const dateLabels = sortedData.map(d => {
    const date = new Date(d.date);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  
  // Extract data for each macro
  const caloriesData = sortedData.map(d => d.totals.calories);
  const proteinData = sortedData.map(d => d.totals.protein);
  const carbsData = sortedData.map(d => d.totals.carbs);
  const fatData = sortedData.map(d => d.totals.fat);
  const fiberData = sortedData.map(d => d.totals.fiber);
  
  // Render calories chart
  renderCaloriesChart(dateLabels, caloriesData);
  
  // Render combined macros chart
  renderCombinedMacrosChart(dateLabels, proteinData, carbsData, fatData, fiberData);
  
  // Render macro distribution chart (average of the period)
  renderMacroDistributionChart(sortedData);
}

// Render calories chart
function renderCaloriesChart(labels, data) {
  const container = document.getElementById('calories-chart');
  if (!container) return;
  
  // Create canvas if it doesn't exist
  let canvas = container.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    container.appendChild(canvas);
  }
  
  // Create the chart
  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Calories',
        data: data,
        backgroundColor: 'rgba(239, 68, 68, 0.7)',
        borderColor: 'rgba(239, 68, 68, 1)',
        borderWidth: 1,
        borderRadius: 4,
        barThickness: 'flex',
        maxBarThickness: 35
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          titleColor: '#334155',
          bodyColor: '#334155',
          borderColor: '#e2e8f0',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 6
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(226, 232, 240, 0.5)'
          },
          ticks: {
            padding: 10
          }
        }
      }
    }
  });
}

// Render combined macros chart with all nutrients in one graph
function renderCombinedMacrosChart(labels, proteinData, carbsData, fatData, fiberData) {
  const container = document.getElementById('combined-macros-chart');
  if (!container) return;
  
  // Create canvas if it doesn't exist
  let canvas = container.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    container.appendChild(canvas);
  }
  
  // Create the chart with multiple datasets
  new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Protein',
          data: proteinData,
          borderColor: 'rgba(59, 130, 246, 1)', // Blue
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          tension: 0.3,
          fill: false,
          pointRadius: 3,
          pointHoverRadius: 5
        },
        {
          label: 'Carbs',
          data: carbsData,
          borderColor: 'rgba(139, 92, 246, 1)', // Purple
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          borderWidth: 2,
          tension: 0.3,
          fill: false,
          pointRadius: 3,
          pointHoverRadius: 5
        },
        {
          label: 'Fat',
          data: fatData,
          borderColor: 'rgba(16, 185, 129, 1)', // Green
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 2,
          tension: 0.3,
          fill: false,
          pointRadius: 3,
          pointHoverRadius: 5
        },
        {
          label: 'Fiber',
          data: fiberData,
          borderColor: 'rgba(245, 158, 11, 1)', // Amber
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          borderWidth: 2,
          tension: 0.3,
          fill: false,
          pointRadius: 3,
          pointHoverRadius: 5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 15,
            font: {
              size: 11
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          titleColor: '#334155',
          bodyColor: '#334155',
          borderColor: '#e2e8f0',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 6,
          usePointStyle: true,
          callbacks: {
            title: function(context) {
              return context[0].label || '';
            },
            label: function(context) {
              const label = context.dataset.label || '';
              const value = context.parsed.y || 0;
              return `${label}: ${value.toFixed(1)}g`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(226, 232, 240, 0.5)'
          },
          ticks: {
            padding: 10
          }
        }
      }
    }
  });
}

// Render macro distribution chart (pie chart)
function renderMacroDistributionChart(data) {
  const container = document.getElementById('macro-distribution-chart');
  if (!container) return;
  
  // Create canvas if it doesn't exist
  let canvas = container.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    container.appendChild(canvas);
  }
  
  // Calculate average macros
  const totalEntries = data.length;
  const avgProtein = data.reduce((sum, d) => sum + d.totals.protein, 0) / totalEntries;
  const avgCarbs = data.reduce((sum, d) => sum + d.totals.carbs, 0) / totalEntries;
  const avgFat = data.reduce((sum, d) => sum + d.totals.fat, 0) / totalEntries;
  
  // Calculate calories from each macro
  const proteinCal = avgProtein * 4;
  const carbsCal = avgCarbs * 4;
  const fatCal = avgFat * 9;
  const totalCal = proteinCal + carbsCal + fatCal;
  
  // Calculate percentages
  const proteinPct = totalCal > 0 ? Math.round((proteinCal / totalCal) * 100) : 0;
  const carbsPct = totalCal > 0 ? Math.round((carbsCal / totalCal) * 100) : 0;
  const fatPct = totalCal > 0 ? Math.round((fatCal / totalCal) * 100) : 0;
  
  // Create the chart
  new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: [`Protein (${proteinPct}%)`, `Carbs (${carbsPct}%)`, `Fat (${fatPct}%)`],
      datasets: [{
        data: [proteinCal, carbsCal, fatCal],
        backgroundColor: [
          'rgba(59, 130, 246, 0.7)',
          'rgba(139, 92, 246, 0.7)',
          'rgba(16, 185, 129, 0.7)'
        ],
        borderColor: [
          'rgba(59, 130, 246, 1)',
          'rgba(139, 92, 246, 1)',
          'rgba(16, 185, 129, 1)'
        ],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 20,
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
            label: function(context) {
              const label = context.label || '';
              const value = context.raw || 0;
              return `${label}: ${Math.round(value)} calories`;
            }
          }
        }
      },
      cutout: '70%'
    }
  });
}

// Export function to create chart data for 7-day and 30-day views
export function prepareChartData(logs, timeframe = '7day') {
  const days = timeframe === '30day' ? 30 : 7;
  const result = [];
  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(today.getDate() - i);
    const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    if (logs[dateString]) {
      result.push(logs[dateString]);
    } else {
      // Add empty log for missing dates
      result.push({
        date: dateString,
        entries: [],
        totals: {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0
        }
      });
    }
  }
  
  return result;
}
