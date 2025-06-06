// CurrentJamCharts.js
// This file contains the chart rendering logic for the CurrentJam page

import Chart from 'chart.js/auto';

// Initialize charts when data is available
export function initializeCharts(heartRateData, distanceData, activityTypeData, weightTrainingData, caloriesData) {
  // Destroy existing charts if they exist
  destroyCharts();
  
  // Render heart rate chart
  if (heartRateData && document.getElementById('heart-rate-chart')) {
    renderHeartRateChart(heartRateData);
  }
  
  // Render distance chart
  if (distanceData && document.getElementById('distance-chart')) {
    renderDistanceChart(distanceData);
  }
  
  // Render activity type chart
  if (activityTypeData && document.getElementById('activity-type-chart')) {
    renderActivityTypeChart(activityTypeData);
  }
  
  // Render weight training time chart
  if (weightTrainingData && document.getElementById('weight-training-chart')) {
    renderWeightTrainingChart(weightTrainingData);
  }
  
  // Render calories burned chart
  if (caloriesData && document.getElementById('calories-chart')) {
    renderCaloriesBurnedChart(caloriesData);
  }
}

// Destroy existing charts to prevent memory leaks
function destroyCharts() {
  const chartIds = ['heart-rate-chart', 'distance-chart', 'activity-type-chart', 'weight-training-chart', 'calories-chart'];
  
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

// Render heart rate trend chart
function renderHeartRateChart(data) {
  const container = document.getElementById('heart-rate-chart');
  
  // Create canvas if it doesn't exist
  let canvas = container.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    container.appendChild(canvas);
  }
  
  // Simplify the data for a cleaner look
  const simplifiedData = simplifyChartData(data,50);
  
  // Create the chart with minimal styling
  new Chart(canvas, {
    type: 'line',
    data: simplifiedData,
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
          cornerRadius: 6,
          displayColors: false,
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
            maxTicksLimit: 5,
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
          beginAtZero: false
        }
      },
      elements: {
        line: {
          tension: 0.3,
          borderWidth: 2,
          borderColor: 'rgba(239, 68, 68, 0.8)',
          fill: true,
          backgroundColor: 'rgba(239, 68, 68, 0.1)'
        },
        point: {
          radius: 0,
          hitRadius: 10,
          hoverRadius: 4
        }
      }
    }
  });
}

// Render distance by day chart
function renderDistanceChart(data) {
  const container = document.getElementById('distance-chart');
  
  // Create canvas if it doesn't exist
  let canvas = container.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    container.appendChild(canvas);
  }
  
  // Simplify the data for a cleaner look
  const simplifiedData = simplifyChartData(data, 50);
  
  // Create gradient for bars
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
  gradient.addColorStop(1, 'rgba(16, 185, 129, 0.8)');
  
  // Update dataset colors
  simplifiedData.datasets[0].backgroundColor = gradient;
  
  // Create the chart with minimal styling
  new Chart(canvas, {
    type: 'bar',
    data: simplifiedData,
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
          cornerRadius: 6,
          displayColors: false,
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
            maxTicksLimit: 5,
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

// Render activity type distribution chart
function renderActivityTypeChart(data) {
  const container = document.getElementById('activity-type-chart');
  
  // Create canvas if it doesn't exist
  let canvas = container.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    container.appendChild(canvas);
  }
  
  // Create the chart with minimal styling
  new Chart(canvas, {
    type: 'doughnut',
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'right',
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
            label: function(context) {
              const label = context.label || '';
              const value = context.raw || 0;
              const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
              const percentage = Math.round((value / total) * 100);
              return `${label}: ${value} (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

// Helper function to simplify chart data for cleaner visualization
function simplifyChartData(data, maxPoints) {
  // If we have fewer points than maxPoints, return the original data
  if (data.labels.length <= maxPoints) {
    return data;
  }
  
  // Otherwise, sample the data to reduce the number of points
  const step = Math.ceil(data.labels.length / maxPoints);
  
  const simplifiedLabels = [];
  const simplifiedDatasets = data.datasets.map(dataset => {
    const simplifiedData = [];
    return {
      ...dataset,
      data: simplifiedData
    };
  });
  
  for (let i = 0; i < data.labels.length; i += step) {
    simplifiedLabels.push(data.labels[i]);
    
    data.datasets.forEach((dataset, datasetIndex) => {
      simplifiedDatasets[datasetIndex].data.push(dataset.data[i]);
    });
  }
  
  return {
    labels: simplifiedLabels,
    datasets: simplifiedDatasets
  };
}

// Render weight training time chart
function renderWeightTrainingChart(data) {
  const container = document.getElementById('weight-training-chart');
  
  // Create canvas if it doesn't exist
  let canvas = container.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    container.appendChild(canvas);
  }
  
  // Simplify the data for a cleaner look
  const simplifiedData = simplifyChartData(data, 30);
  
  // Create the chart with minimal styling
  new Chart(canvas, {
    type: 'line',
    data: simplifiedData,
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
          cornerRadius: 6,
          displayColors: false,
          callbacks: {
            title: function(tooltipItems) {
              return new Date(tooltipItems[0].label).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              });
            },
            label: function(context) {
              const value = context.parsed.y || 0;
              return `Weight Training: ${value} minutes`;
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
            maxTicksLimit: 5,
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
          beginAtZero: true,
          title: {
            display: true,
            text: 'Minutes'
          }
        }
      },
      elements: {
        line: {
          tension: 0.3,
          borderWidth: 2,
          borderColor: 'rgba(139, 92, 246, 0.8)', // Purple
          fill: true,
          backgroundColor: 'rgba(139, 92, 246, 0.1)'
        },
        point: {
          radius: 3,
          hitRadius: 10,
          hoverRadius: 5,
          backgroundColor: 'rgba(139, 92, 246, 1)'
        }
      }
    }
  });
}

// Render calories burned chart
function renderCaloriesBurnedChart(data) {
  const container = document.getElementById('calories-burned-chart');
  
  // Create canvas if it doesn't exist
  let canvas = container.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    container.appendChild(canvas);
  }
  
  // Simplify the data for a cleaner look
  const simplifiedData = simplifyChartData(data, 30);
  
  // Create the chart with minimal styling
  new Chart(canvas, {
    type: 'line',
    data: simplifiedData,
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
          cornerRadius: 6,
          displayColors: false,
          callbacks: {
            title: function(tooltipItems) {
              return new Date(tooltipItems[0].label).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              });
            },
            label: function(context) {
              const value = context.parsed.y || 0;
              return `Calories Burned: ${value}`;
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
            maxTicksLimit: 5,
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
          beginAtZero: true,
          title: {
            display: true,
            text: 'Calories'
          }
        }
      },
      elements: {
        line: {
          tension: 0.3,
          borderWidth: 2,
          borderColor: 'rgba(245, 158, 11, 0.8)', // Amber
          fill: true,
          backgroundColor: 'rgba(245, 158, 11, 0.1)'
        },
        point: {
          radius: 3,
          hitRadius: 10,
          hoverRadius: 5,
          backgroundColor: 'rgba(245, 158, 11, 1)'
        }
      }
    }
  });
}
