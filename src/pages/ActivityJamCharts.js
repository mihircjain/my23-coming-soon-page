// ActivityJamCharts.js - UPDATED with HR from runs only & Strava calories
// This file contains the chart rendering logic for the ActivityJam page

import Chart from 'chart.js/auto';

// Enhanced date formatting utility for consistent spacing
class DateFormatter {
  static formatDateForChart(dateString, totalDataPoints, index) {
    const date = new Date(dateString);
    const dayOfMonth = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
    
    // Determine display strategy based on data range
    if (totalDataPoints <= 7) {
      // Weekly view: Show all weekdays
      return weekday;
    } else if (totalDataPoints <= 30) {
      // Monthly view: Show every 3rd day or month boundaries
      if (dayOfMonth === 1 || index % 3 === 0 || index === 0 || index === totalDataPoints - 1) {
        return `${month} ${dayOfMonth}`;
      }
      return dayOfMonth.toString();
    } else if (totalDataPoints <= 90) {
      // Quarterly view: Show weekly markers
      if (dayOfMonth === 1 || index % 7 === 0 || index === 0 || index === totalDataPoints - 1) {
        return `${month} ${dayOfMonth}`;
      }
      return '';
    } else {
      // Yearly view: Show monthly markers
      if (dayOfMonth === 1 || index % 30 === 0 || index === 0 || index === totalDataPoints - 1) {
        return month;
      }
      return '';
    }
  }

  static formatTooltipDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  static getUniformTickCount(totalDataPoints) {
    if (totalDataPoints <= 7) return totalDataPoints;
    if (totalDataPoints <= 30) return 8;
    if (totalDataPoints <= 90) return 10;
    return 12;
  }
}

// Enhanced data simplification with intelligent sampling
class DataSimplifier {
  static simplifyChartData(data, maxPoints = 50) {
    console.log('📊 Original data length:', data.labels.length);
    console.log('📅 Date range:', data.labels[0], 'to', data.labels[data.labels.length - 1]);
    
    if (data.labels.length <= maxPoints) {
      return this.addFormattedLabels(data);
    }

    const totalPoints = data.labels.length;
    const step = Math.max(1, Math.floor(totalPoints / maxPoints));
    
    const simplifiedLabels = [];
    const simplifiedDatasets = data.datasets.map(dataset => ({
      ...dataset,
      data: []
    }));

    // Intelligent sampling: always include first, last, and evenly spaced points
    const indices = this.generateSamplingIndices(totalPoints, maxPoints);
    
    indices.forEach(i => {
      simplifiedLabels.push(data.labels[i]);
      data.datasets.forEach((dataset, datasetIndex) => {
        simplifiedDatasets[datasetIndex].data.push(dataset.data[i]);
      });
    });

    console.log('✨ Simplified to:', simplifiedLabels.length, 'points');
    
    return this.addFormattedLabels({
      labels: simplifiedLabels,
      datasets: simplifiedDatasets
    });
  }

  static generateSamplingIndices(totalPoints, maxPoints) {
    const indices = new Set();
    
    // Always include first and last
    indices.add(0);
    if (totalPoints > 1) indices.add(totalPoints - 1);
    
    // Add evenly spaced points
    const step = Math.max(1, Math.floor(totalPoints / maxPoints));
    for (let i = step; i < totalPoints - 1; i += step) {
      indices.add(i);
    }
    
    // Add month/week boundaries for better context
    for (let i = 0; i < totalPoints; i++) {
      if (indices.size >= maxPoints) break;
      // Add points that fall on month start (simplified heuristic)
      if (i % 30 === 0 || i % 7 === 0) {
        indices.add(i);
      }
    }
    
    return Array.from(indices).sort((a, b) => a - b);
  }

  static addFormattedLabels(data) {
    // Add formatted labels for display
    data.formattedLabels = data.labels.map((label, index) => 
      DateFormatter.formatDateForChart(label, data.labels.length, index)
    );
    return data;
  }
}

// Enhanced chart configuration factory
class ChartConfigFactory {
  static getCommonConfig(chartType = 'line') {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          titleColor: '#1e293b',
          bodyColor: '#475569',
          borderColor: '#e2e8f0',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          displayColors: false,
          titleFont: { weight: 'bold', size: 14 },
          bodyFont: { size: 13 },
          callbacks: {
            title: function(tooltipItems) {
              return DateFormatter.formatTooltipDate(tooltipItems[0].label);
            }
          }
        }
      },
      scales: this.getScaleConfig(chartType)
    };
  }

  static getScaleConfig(chartType) {
    return {
      x: {
        grid: {
          display: false,
          drawBorder: false
        },
        ticks: {
          maxRotation: 0,
          autoSkip: false, // We'll handle skipping manually
          maxTicksLimit: 12,
          padding: 8,
          font: { size: 11 },
          callback: function(value, index) {
            // Use our pre-formatted labels
            const chart = this.chart;
            const data = chart.data;
            return data.formattedLabels ? data.formattedLabels[index] : '';
          }
        },
        border: {
          display: false
        }
      },
      y: {
        grid: {
          color: 'rgba(226, 232, 240, 0.6)',
          drawBorder: false
        },
        ticks: {
          padding: 12,
          font: { size: 11 }
        },
        beginAtZero: chartType === 'bar',
        border: {
          display: false
        }
      }
    };
  }

  static getLineStyle(color, fillAlpha = 0.1) {
    return {
      tension: 0.4,
      borderWidth: 3,
      borderColor: color,
      fill: true,
      backgroundColor: color.replace(/[\d\.]+\)$/g, `${fillAlpha})`),
      pointRadius: 0,
      pointHoverRadius: 6,
      pointHoverBorderWidth: 2,
      pointHoverBackgroundColor: '#ffffff',
      pointHoverBorderColor: color
    };
  }
}

// Debug function to log chart data with updated data sources
export function debugChartData(runHeartRateData, distanceData, activityTypeData, weightTrainingData, stravaCaloriesData) {
  console.log('=== 📊 CHART DATA DEBUG (UPDATED SOURCES) ===');
  
  const datasets = {
    'Run Heart Rate (Runs Only)': runHeartRateData,
    'Distance': distanceData,
    'Activity Type': activityTypeData,
    'Weight Training': weightTrainingData,
    'Strava Calories (Direct)': stravaCaloriesData
  };

  Object.entries(datasets).forEach(([name, data]) => {
    if (data) {
      console.log(`${name} Data:`);
      console.log(`  📏 Labels: ${data.labels?.length || 0} points`);
      console.log(`  📅 Range: ${data.labels?.[0]} → ${data.labels?.[data.labels.length - 1]}`);
      console.log(`  📈 Data: ${data.datasets?.[0]?.data?.length || 0} points`);
      
      // Log data source specifics
      if (name.includes('Heart Rate')) {
        console.log(`  💓 Data Source: Only from running activities (excludes weight training, cycling)`);
        const validHRPoints = data.datasets?.[0]?.data?.filter(hr => hr > 0).length || 0;
        console.log(`  💓 Valid HR Points: ${validHRPoints} (non-zero values)`);
      }
      
      if (name.includes('Calories')) {
        console.log(`  🔥 Data Source: Direct from Strava API (no estimates)`);
        const totalCalories = data.datasets?.[0]?.data?.reduce((sum, cal) => sum + (cal || 0), 0) || 0;
        console.log(`  🔥 Total Calories: ${totalCalories.toLocaleString()}`);
      }
      
      // Check for date consistency
      if (data.labels?.length > 1) {
        const dates = data.labels.map(label => new Date(label));
        const intervals = [];
        for (let i = 1; i < dates.length; i++) {
          intervals.push(dates[i] - dates[i-1]);
        }
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const avgDays = Math.round(avgInterval / (1000 * 60 * 60 * 24));
        console.log(`  ⏱️  Avg interval: ${avgDays} days`);
      }
    }
  });
  
  console.log('=== ✅ END DEBUG ===');
}

// Enhanced chart initialization with updated data sources
export function initializeCharts(runHeartRateData, distanceData, activityTypeData, weightTrainingData, stravaCaloriesData) {
  console.log('🚀 Initializing ActivityJam charts with updated data sources...');
  console.log('💓 Heart Rate: Runs only | 🔥 Calories: Strava direct');
  
  debugChartData(runHeartRateData, distanceData, activityTypeData, weightTrainingData, stravaCaloriesData);
  
  // Destroy existing charts
  destroyCharts();
  
  // Render charts with updated data sources
  const chartConfigs = [
    { data: runHeartRateData, id: 'run-heart-rate-chart', renderer: renderRunHeartRateChart },
    { data: distanceData, id: 'distance-chart', renderer: renderDistanceChart },
    { data: activityTypeData, id: 'activity-type-chart', renderer: renderActivityTypeChart },
    { data: weightTrainingData, id: 'weight-training-chart', renderer: renderWeightTrainingChart },
    { data: stravaCaloriesData, id: 'strava-calories-chart', renderer: renderStravaCaloriesChart }
  ];

  chartConfigs.forEach(({ data, id, renderer }) => {
    if (data && document.getElementById(id)) {
      try {
        renderer(data);
        console.log(`✅ ${id} rendered successfully`);
      } catch (error) {
        console.error(`❌ Error rendering ${id}:`, error);
      }
    }
  });
}

// Destroy existing charts to prevent memory leaks
function destroyCharts() {
  const chartIds = [
    'run-heart-rate-chart', 
    'distance-chart', 
    'activity-type-chart', 
    'weight-training-chart', 
    'strava-calories-chart',
    // Legacy IDs for backwards compatibility
    'heart-rate-chart',
    'calories-chart'
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

// UPDATED: Run Heart Rate Chart (runs only)
function renderRunHeartRateChart(data) {
  const container = document.getElementById('run-heart-rate-chart') || document.getElementById('heart-rate-chart');
  if (!container) return;
  
  let canvas = container.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    container.appendChild(canvas);
  }

  const simplifiedData = DataSimplifier.simplifyChartData(data, 30);
  const config = ChartConfigFactory.getCommonConfig('line');
  
  // Apply run heart rate specific styling
  simplifiedData.datasets[0] = {
    ...simplifiedData.datasets[0],
    ...ChartConfigFactory.getLineStyle('rgba(239, 68, 68, 0.8)', 0.15)
  };

  config.plugins.tooltip.callbacks.label = function(context) {
    return `Run Heart Rate: ${context.parsed.y} bpm (runs only)`;
  };

  config.scales.y.title = {
    display: true,
    text: 'BPM (Runs Only)',
    color: '#ef4444',
    font: { weight: 'bold' }
  };

  // Add note about data source
  config.plugins.annotation = {
    annotations: {
      dataSource: {
        type: 'label',
        xValue: 0,
        yValue: 'max',
        content: 'Only from running activities',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderColor: 'rgba(239, 68, 68, 0.3)',
        borderWidth: 1,
        borderRadius: 4,
        font: { size: 10 }
      }
    }
  };

  new Chart(canvas, {
    type: 'line',
    data: simplifiedData,
    options: config
  });
}

function renderDistanceChart(data) {
  const container = document.getElementById('distance-chart');
  if (!container) return;
  
  let canvas = container.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    container.appendChild(canvas);
  }

  const simplifiedData = DataSimplifier.simplifyChartData(data, 30);
  const config = ChartConfigFactory.getCommonConfig('bar');

  // Create gradient for bars
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
  gradient.addColorStop(1, 'rgba(16, 185, 129, 0.6)');
  
  simplifiedData.datasets[0].backgroundColor = gradient;
  simplifiedData.datasets[0].borderColor = 'rgba(59, 130, 246, 1)';
  simplifiedData.datasets[0].borderWidth = 1;
  simplifiedData.datasets[0].borderRadius = 4;

  config.plugins.tooltip.callbacks.label = function(context) {
    return `Distance: ${context.parsed.y.toFixed(2)} km`;
  };

  config.scales.y.title = {
    display: true,
    text: 'Distance (km)'
  };

  new Chart(canvas, {
    type: 'bar',
    data: simplifiedData,
    options: config
  });
}

function renderActivityTypeChart(data) {
  const container = document.getElementById('activity-type-chart');
  if (!container) return;
  
  let canvas = container.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    container.appendChild(canvas);
  }

  const config = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: {
        position: 'right',
        labels: {
          boxWidth: 14,
          padding: 20,
          font: { size: 12 },
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1e293b',
        bodyColor: '#475569',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: function(context) {
            const label = context.label || '';
            const value = context.raw || 0;
            const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
            const percentage = Math.round((value / total) * 100);
            return `${label}: ${value} activities (${percentage}%)`;
          }
        }
      }
    }
  };

  new Chart(canvas, {
    type: 'doughnut',
    data: data,
    options: config
  });
}

function renderWeightTrainingChart(data) {
  const container = document.getElementById('weight-training-chart');
  if (!container) return;
  
  let canvas = container.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    container.appendChild(canvas);
  }

  const simplifiedData = DataSimplifier.simplifyChartData(data, 25);
  const config = ChartConfigFactory.getCommonConfig('line');

  simplifiedData.datasets[0] = {
    ...simplifiedData.datasets[0],
    ...ChartConfigFactory.getLineStyle('rgba(139, 92, 246, 0.8)', 0.12)
  };

  config.plugins.tooltip.callbacks.label = function(context) {
    return `Weight Training: ${context.parsed.y} minutes`;
  };

  config.scales.y.title = {
    display: true,
    text: 'Minutes'
  };

  new Chart(canvas, {
    type: 'line',
    data: simplifiedData,
    options: config
  });
}

// UPDATED: Strava Calories Chart (direct from Strava)
function renderStravaCaloriesChart(data) {
  const container = document.getElementById('strava-calories-chart') || document.getElementById('calories-chart');
  if (!container) return;
  
  let canvas = container.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    container.appendChild(canvas);
  }

  const simplifiedData = DataSimplifier.simplifyChartData(data, 25);
  const config = ChartConfigFactory.getCommonConfig('line');

  simplifiedData.datasets[0] = {
    ...simplifiedData.datasets[0],
    ...ChartConfigFactory.getLineStyle('rgba(245, 158, 11, 0.8)', 0.12)
  };

  config.plugins.tooltip.callbacks.label = function(context) {
    return `Calories: ${Math.round(context.parsed.y).toLocaleString()} (Strava direct)`;
  };

  config.scales.y.title = {
    display: true,
    text: 'Calories (Strava)',
    color: '#f59e0b',
    font: { weight: 'bold' }
  };

  // Add thousands separator for y-axis
  config.scales.y.ticks.callback = function(value) {
    return value.toLocaleString();
  };

  new Chart(canvas, {
    type: 'line',
    data: simplifiedData,
    options: config
  });
}

// Legacy function names for backwards compatibility
export const renderHeartRateChart = renderRunHeartRateChart;
export const renderCaloriesBurnedChart = renderStravaCaloriesChart;
