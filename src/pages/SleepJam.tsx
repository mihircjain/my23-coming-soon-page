// SleepJam.tsx - Oura Ring Sleep & Readiness Tracking with Cache-First Loading

import { useState, useEffect, useRef } from "react";
import { ArrowLeft, RefreshCw, Calendar, Moon, Zap, Heart, BarChart3, TrendingUp, Eye, Brain, Battery, Timer, Thermometer, Bed, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Chart from 'chart.js/auto';

interface SleepData {
  id: string;
  day: string; // YYYY-MM-DD format
  bedtime_start: string;
  bedtime_end: string;
  sleep_score: number;
  total_sleep_duration: number; // in seconds
  deep_sleep_duration: number;
  light_sleep_duration: number;
  rem_sleep_duration: number;
  awake_time: number;
  restless_periods: number;
  sleep_efficiency: number; // percentage
  sleep_latency: number; // time to fall asleep in seconds
  sleep_timing: number; // score for sleep timing
  average_heart_rate: number;
  lowest_heart_rate: number;
  average_hrv: number;
  temperature_deviation: number;
  respiratory_rate: number;
}

interface ReadinessData {
  id: string;
  day: string;
  readiness_score: number;
  temperature_deviation: number;
  activity_balance: number;
  body_temperature: number;
  hrv_balance: number;
  previous_day_activity: number;
  previous_night_score: number;
  recovery_index: number;
  resting_heart_rate: number;
  sleep_balance: number;
}

interface CombinedDayData {
  date: string;
  sleep: SleepData | null;
  readiness: ReadinessData | null;
}

const SleepJam = () => {
  const [sleepData, setSleepData] = useState<CombinedDayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Chart refs
  const sleepScoreChartRef = useRef<HTMLCanvasElement>(null);
  const readinessChartRef = useRef<HTMLCanvasElement>(null);
  const sleepDurationChartRef = useRef<HTMLCanvasElement>(null);
  const heartRateChartRef = useRef<HTMLCanvasElement>(null);

  // Chart instances
  const chartInstances = useRef<{ [key: string]: Chart | null }>({
    sleepScore: null,
    readiness: null,
    duration: null,
    heartRate: null
  });

  // Chart data state
  const [chartData, setChartData] = useState<{
    sleepScores: number[];
    readinessScores: number[];
    sleepDurations: number[];
    heartRates: number[];
    labels: string[];
  } | null>(null);

  // Destroy all charts
  const destroyCharts = () => {
    console.log('🗑️ Destroying existing sleep charts');
    Object.values(chartInstances.current).forEach(chart => {
      if (chart) {
        chart.destroy();
      }
    });
    chartInstances.current = {
      sleepScore: null,
      readiness: null,
      duration: null,
      heartRate: null
    };
  };

  // Create sleep score chart
  const createSleepScoreChart = (data: any) => {
    if (!sleepScoreChartRef.current || !data) return;

    const ctx = sleepScoreChartRef.current.getContext('2d');
    if (!ctx) return;

    if (chartInstances.current.sleepScore) {
      chartInstances.current.sleepScore.destroy();
    }

    try {
      chartInstances.current.sleepScore = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.labels,
          datasets: [{
            label: 'Sleep Score',
            data: data.sleepScores,
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: 'rgb(59, 130, 246)',
            pointBorderColor: 'white',
            pointBorderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: {
              grid: { display: false }
            },
            y: {
              beginAtZero: true,
              max: 100,
              grid: { color: 'rgba(0,0,0,0.1)' },
              ticks: {
                callback: function(value: any) {
                  return value + '%';
                }
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('❌ Error creating sleep score chart:', error);
    }
  };

  // Create readiness chart
  const createReadinessChart = (data: any) => {
    if (!readinessChartRef.current || !data) return;

    const ctx = readinessChartRef.current.getContext('2d');
    if (!ctx) return;

    if (chartInstances.current.readiness) {
      chartInstances.current.readiness.destroy();
    }

    try {
      chartInstances.current.readiness = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.labels,
          datasets: [{
            label: 'Readiness Score',
            data: data.readinessScores,
            borderColor: 'rgb(34, 197, 94)',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: 'rgb(34, 197, 94)',
            pointBorderColor: 'white',
            pointBorderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: {
              grid: { display: false }
            },
            y: {
              beginAtZero: true,
              max: 100,
              grid: { color: 'rgba(0,0,0,0.1)' },
              ticks: {
                callback: function(value: any) {
                  return value + '%';
                }
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('❌ Error creating readiness chart:', error);
    }
  };

  // Create sleep duration chart
  const createSleepDurationChart = (data: any) => {
    if (!sleepDurationChartRef.current || !data) return;

    const ctx = sleepDurationChartRef.current.getContext('2d');
    if (!ctx) return;

    if (chartInstances.current.duration) {
      chartInstances.current.duration.destroy();
    }

    try {
      chartInstances.current.duration = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: data.labels,
          datasets: [{
            label: 'Sleep Duration (hours)',
            data: data.sleepDurations,
            backgroundColor: 'rgba(147, 51, 234, 0.8)',
            borderColor: 'rgb(147, 51, 234)',
            borderWidth: 1,
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: {
              grid: { display: false }
            },
            y: {
              beginAtZero: true,
              max: 12,
              grid: { color: 'rgba(0,0,0,0.1)' },
              ticks: {
                callback: function(value: any) {
                  return value + 'h';
                }
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('❌ Error creating sleep duration chart:', error);
    }
  };

  // Create heart rate chart
  const createHeartRateChart = (data: any) => {
    if (!heartRateChartRef.current || !data) return;

    const ctx = heartRateChartRef.current.getContext('2d');
    if (!ctx) return;

    if (chartInstances.current.heartRate) {
      chartInstances.current.heartRate.destroy();
    }

    try {
      chartInstances.current.heartRate = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.labels,
          datasets: [{
            label: 'Avg Sleep Heart Rate (bpm)',
            data: data.heartRates,
            borderColor: 'rgb(20, 184, 166)',
            backgroundColor: 'rgba(20, 184, 166, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: 'rgb(20, 184, 166)',
            pointBorderColor: 'white',
            pointBorderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: {
              grid: { display: false }
            },
            y: {
              beginAtZero: false,
              grid: { color: 'rgba(0,0,0,0.1)' },
              ticks: {
                callback: function(value: any) {
                  return value + ' bpm';
                }
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('❌ Error creating heart rate chart:', error);
    }
  };

  // Process sleep data for charts
  const processChartData = (sleepData: CombinedDayData[]) => {
    console.log('📊 Processing sleep chart data from', sleepData.length, 'days');
    
    if (sleepData.length === 0) {
      return null;
    }

    const sortedData = [...sleepData].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const labels = sortedData.map(day => 
      new Date(day.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })
    );

    const chartData = {
      labels,
      sleepScores: sortedData.map(day => day.sleep?.sleep_score || 0),
      readinessScores: sortedData.map(day => day.readiness?.readiness_score || 0),
      sleepDurations: sortedData.map(day => 
        day.sleep ? Math.round((day.sleep.total_sleep_duration / 3600) * 10) / 10 : 0
      ),
      heartRates: sortedData.map(day => day.sleep?.average_heart_rate || 0)
    };

    console.log('📊 Sleep chart data processed:', {
      totalDays: chartData.labels.length,
      avgSleepScore: Math.round(chartData.sleepScores.reduce((a, b) => a + b, 0) / chartData.sleepScores.length),
      avgReadiness: Math.round(chartData.readinessScores.reduce((a, b) => a + b, 0) / chartData.readinessScores.length)
    });

    return chartData;
  };

  // Load or create charts
  const loadOrCreateCharts = async (sleepData: CombinedDayData[], forceRecreate = false) => {
    console.log('📊 Loading or creating sleep charts...');
    
    if (!forceRecreate) {
      // Try to load cached chart data first
      try {
        const chartCacheResponse = await fetch('/api/sleep-chart-cache?userId=mihir_jain');
        
        if (chartCacheResponse.ok) {
          const cachedChartData = await chartCacheResponse.json();
          console.log(`📊 Using cached sleep chart data (${cachedChartData.age})`);
          
          setChartData(cachedChartData);
          
          // Create charts with cached data immediately
          setTimeout(() => {
            if (cachedChartData) {
              createSleepScoreChart(cachedChartData);
              createReadinessChart(cachedChartData);
              createSleepDurationChart(cachedChartData);
              createHeartRateChart(cachedChartData);
            }
          }, 100);
          
          return;
        }
      } catch (cacheError) {
        console.log('📊 No cached sleep chart data available, creating fresh charts');
      }
    }
    
    // Create fresh charts and cache them
    console.log('📊 Creating fresh sleep charts...');
    const processedData = processChartData(sleepData);
    
    if (processedData) {
      setChartData(processedData);
      
      // Create charts
      setTimeout(() => {
        createSleepScoreChart(processedData);
        createReadinessChart(processedData);
        createSleepDurationChart(processedData);
        createHeartRateChart(processedData);
      }, 100);
      
      // Cache the chart data for future use
      try {
        await fetch('/api/sleep-chart-cache', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chartData: processedData,
            generatedAt: new Date().toISOString()
          })
        });
        console.log('📊 Sleep chart data cached successfully');
      } catch (cacheError) {
        console.error('❌ Failed to cache sleep chart data:', cacheError);
      }
    }
  };

  // Fetch sleep data with cache-first approach
  const fetchSleepData = async (refreshMode: 'cached' | 'refresh' = 'cached') => {
    try {
      if (refreshMode !== 'cached') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');
      
      const params = new URLSearchParams({
        userId: 'mihir_jain',
        mode: refreshMode
      });

      if (refreshMode === 'refresh') {
        params.set('refresh', 'true');
        params.set('days', '7');
        params.set('timestamp', Date.now().toString());
        console.log('🔄 Full refresh mode for sleep data');
      } else {
        console.log('⚡ Cache-first mode for sleep data');
      }
      
      const apiUrl = `/api/oura-sleep?${params.toString()}`;
      console.log('📡 Making sleep API request to:', apiUrl);
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 404 && errorData.recommendRefresh) {
          console.log('📦 No cached sleep data - need initial refresh');
          setError('No sleep data available. Click "Refresh Sleep Data" to load from Oura.');
          return;
        }
        
        throw new Error(errorData.message || `Failed to fetch sleep data: ${response.status}`);
      }

      const data = await response.json();
      console.log('📊 Sleep data received:', data?.length, 'days');
      
      // Log performance info from headers
      const dataSource = response.headers.get('X-Data-Source');
      const apiCalls = response.headers.get('X-API-Calls');
      const isRateLimited = response.headers.get('X-Rate-Limited');
      
      console.log(`📈 Sleep Performance: Source=${dataSource}, API calls=${apiCalls}${isRateLimited ? ', Rate Limited' : ''}`);
      
      if (!Array.isArray(data)) {
        console.error('❌ Expected array but got:', typeof data, data);
        throw new Error('Invalid sleep data format received from API');
      }
      
      // Sort data by date
      const sortedData = data.sort((a: CombinedDayData, b: CombinedDayData) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      console.log('😴 Sleep processing complete:', {
        mode: refreshMode,
        totalDays: sortedData.length,
        daysWithSleep: sortedData.filter(d => d.sleep).length,
        daysWithReadiness: sortedData.filter(d => d.readiness).length,
        dataSource,
        apiCallsUsed: apiCalls || '0'
      });

      setSleepData(sortedData);
      setLastUpdate(new Date().toLocaleTimeString());
      
      // Load or create charts
      await loadOrCreateCharts(sortedData, refreshMode !== 'cached' || dataSource?.includes('oura'));

    } catch (error) {
      console.error('❌ Error fetching sleep data:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch sleep data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    await fetchSleepData('refresh');
  };

  // Load on mount - cache-first for instant loading
  useEffect(() => {
    fetchSleepData('cached');
    
    // Cleanup charts on unmount
    return () => {
      destroyCharts();
    };
  }, []);

  // Helper functions
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatSleepTime = (timeString: string) => {
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 70) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (score >= 55) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 85) return '🔥';
    if (score >= 70) return '💪';
    if (score >= 55) return '👍';
    return '😴';
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex flex-col">
        <header className="pt-8 px-6 md:px-12">
          <div className="flex items-center justify-between mb-6">
            <Button onClick={() => window.location.href = '/'} variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
            <Button onClick={handleRefresh} variant="outline" disabled={refreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Try Again
            </Button>
          </div>
        </header>
        
        <main className="flex-grow flex items-center justify-center px-6">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 text-center">
              <div className="text-red-500 mb-4">⚠️</div>
              <h3 className="text-lg font-semibold mb-2">Unable to Load Sleep Data</h3>
              <p className="text-gray-600 text-sm mb-4">{error}</p>
              <Button onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Retrying...' : 'Try Again'}
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-400/10 to-blue-400/10 animate-pulse"></div>
      <div className="absolute top-20 left-20 w-32 h-32 bg-purple-200/30 rounded-full blur-xl animate-bounce"></div>
      <div className="absolute bottom-20 right-20 w-24 h-24 bg-blue-200/30 rounded-full blur-xl animate-bounce delay-1000"></div>
      
      {/* Header */}
      <header className="relative z-10 pt-8 px-6 md:px-12">
        <div className="flex items-center justify-between mb-6">
          <Button onClick={() => navigate('/')} variant="ghost" className="hover:bg-white/20">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
          
          <div className="flex items-center gap-2">
            <Button 
              onClick={handleRefresh}
              variant="outline"
              disabled={refreshing}
              className="hover:bg-white/20"
              title="Refresh - fetches latest 7 days from Oura Ring"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh Sleep Data'}
            </Button>
          </div>
        </div>
        
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Sleep Jam
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Your sleep and recovery insights from Oura Ring with optimized loading and daily caching
          </p>
          {lastUpdate && (
            <p className="mt-1 text-sm text-gray-500">
              Last updated: {lastUpdate} • Cache-first loading • Data refreshes once daily
            </p>
          )}
        </div>
      </header>
      
      {/* Main content */}
      <main className="relative z-10 px-6 md:px-12 py-8">
        {loading ? (
          <div className="space-y-8">
            {/* Chart skeletons */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="bg-white/80 backdrop-blur-sm border border-white/20">
                  <CardHeader>
                    <Skeleton className="h-6 w-32" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-64 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {/* Sleep card skeletons */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="bg-white/80 backdrop-blur-sm border border-white/20">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <div className="grid grid-cols-2 gap-4">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                      </div>
                      <Skeleton className="h-4 w-full" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {/* Loading message */}
            <div className="text-center py-4">
              <p className="text-gray-600">Loading your cached sleep data...</p>
              <p className="text-sm text-gray-500 mt-1">This should be fast! ⚡</p>
            </div>
          </div>
        ) : sleepData.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Moon className="h-16 w-16 mx-auto" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Sleep Data Found</h3>
            <p className="text-gray-600 mb-4">
              {error 
                ? "Unable to load your sleep data. Please try refreshing." 
                : "No cached sleep data available. Load your sleep data from Oura Ring to get started."
              }
            </p>
            <div className="flex justify-center">
              <Button onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Loading Sleep Data...' : 'Load Sleep Data'}
              </Button>
            </div>
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg max-w-md mx-auto">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {/* Charts Section */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <BarChart3 className="h-6 w-6 mr-3 text-gray-600" />
                  <h2 className="text-2xl font-semibold text-gray-800">Sleep & Recovery Trends</h2>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className={`w-2 h-2 rounded-full ${chartData ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                  <span>{chartData ? 'Charts ready (cached)' : 'Loading charts...'}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sleep Score Chart */}
                <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
                      <Moon className="h-5 w-5 mr-2 text-blue-500" />
                      Sleep Score
                    </CardTitle>
                    <p className="text-xs text-gray-600">Overall sleep quality (0-100)</p>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 relative">
                      {chartData ? (
                        <canvas ref={sleepScoreChartRef} className="w-full h-full"></canvas>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-gray-400">
                            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                            <p className="text-sm">Loading chart...</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Readiness Score Chart */}
                <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
                      <Zap className="h-5 w-5 mr-2 text-green-500" />
                      Readiness Score
                    </CardTitle>
                    <p className="text-xs text-gray-600">Recovery & readiness (0-100)</p>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 relative">
                      {chartData ? (
                        <canvas ref={readinessChartRef} className="w-full h-full"></canvas>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-gray-400">
                            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                            <p className="text-sm">Loading chart...</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Sleep Duration Chart */}
                <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
                      <Timer className="h-5 w-5 mr-2 text-purple-500" />
                      Sleep Duration
                    </CardTitle>
                    <p className="text-xs text-gray-600">Total sleep time (hours)</p>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 relative">
                      {chartData ? (
                        <canvas ref={sleepDurationChartRef} className="w-full h-full"></canvas>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-gray-400">
                            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                            <p className="text-sm">Loading chart...</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Heart Rate Chart */}
                <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
                      <Heart className="h-5 w-5 mr-2 text-teal-500" />
                      Sleep Heart Rate
                    </CardTitle>
                    <p className="text-xs text-gray-600">Average during sleep (bpm)</p>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 relative">
                      {chartData ? (
                        <canvas ref={heartRateChartRef} className="w-full h-full"></canvas>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-gray-400">
                            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                            <p className="text-sm">Loading chart...</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Quick Stats */}
            <section>
              <div className="flex items-center mb-6">
                <BarChart3 className="h-6 w-6 mr-3 text-gray-600" />
                <h2 className="text-2xl font-semibold text-gray-800">Quick Overview</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-blue-600 mb-1">
                      {Math.round(sleepData.filter(d => d.sleep).reduce((sum, d) => sum + (d.sleep?.sleep_score || 0), 0) / sleepData.filter(d => d.sleep).length) || 0}
                    </div>
                    <div className="text-sm text-gray-600">Avg Sleep Score</div>
                    <div className="text-xs text-gray-500 mt-1">Last 7 days</div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-green-600 mb-1">
                      {Math.round(sleepData.filter(d => d.readiness).reduce((sum, d) => sum + (d.readiness?.readiness_score || 0), 0) / sleepData.filter(d => d.readiness).length) || 0}
                    </div>
                    <div className="text-sm text-gray-600">Avg Readiness</div>
                    <div className="text-xs text-gray-500 mt-1">Last 7 days</div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-purple-600 mb-1">
                      {Math.round((sleepData.filter(d => d.sleep).reduce((sum, d) => sum + (d.sleep?.total_sleep_duration || 0), 0) / sleepData.filter(d => d.sleep).length / 3600) * 10) / 10 || 0}h
                    </div>
                    <div className="text-sm text-gray-600">Avg Sleep Duration</div>
                    <div className="text-xs text-gray-500 mt-1">Last 7 days</div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-teal-50 to-teal-100 border-teal-200">
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-teal-600 mb-1">
                      {Math.round(sleepData.filter(d => d.sleep?.average_heart_rate).reduce((sum, d) => sum + (d.sleep?.average_heart_rate || 0), 0) / sleepData.filter(d => d.sleep?.average_heart_rate).length) || 0}
                    </div>
                    <div className="text-sm text-gray-600">Avg Sleep HR</div>
                    <div className="text-xs text-gray-500 mt-1">BPM during sleep</div>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Daily Sleep Cards */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <Calendar className="h-6 w-6 mr-3 text-gray-600" />
                  <h2 className="text-2xl font-semibold text-gray-800">Daily Sleep & Recovery</h2>
                </div>
                <div className="text-sm text-gray-600">
                  Last 7 days • Swipe for more details
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sleepData.map((day) => (
                  <Card 
                    key={day.date} 
                    className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm hover:shadow-lg transition-all duration-200"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg font-semibold text-gray-800 leading-tight">
                          {new Date(day.date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </CardTitle>
                        <div className="flex flex-col gap-1">
                          {day.sleep && (
                            <Badge 
                              variant="outline" 
                              className={`shrink-0 text-xs ${getScoreColor(day.sleep.sleep_score)}`}
                            >
                              {getScoreIcon(day.sleep.sleep_score)} Sleep {day.sleep.sleep_score}
                            </Badge>
                          )}
                          {day.readiness && (
                            <Badge 
                              variant="outline" 
                              className={`shrink-0 text-xs ${getScoreColor(day.readiness.readiness_score)}`}
                            >
                              ⚡ Ready {day.readiness.readiness_score}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {day.sleep ? (
                        <>
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="text-center p-3 bg-purple-50 rounded-lg">
                              <div className="text-2xl font-bold text-purple-600">
                                {formatTime(day.sleep.total_sleep_duration)}
                              </div>
                              <div className="text-xs text-gray-600">Total Sleep</div>
                            </div>
                            <div className="text-center p-3 bg-blue-50 rounded-lg">
                              <div className="text-2xl font-bold text-blue-600">
                                {Math.round(day.sleep.sleep_efficiency)}%
                              </div>
                              <div className="text-xs text-gray-600">Efficiency</div>
                            </div>
                          </div>
                          
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Sleep Time:</span>
                              <span className="font-medium">
                                {formatSleepTime(day.sleep.bedtime_start)} - {formatSleepTime(day.sleep.bedtime_end)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Deep Sleep:</span>
                              <span className="font-medium">{formatTime(day.sleep.deep_sleep_duration)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">REM Sleep:</span>
                              <span className="font-medium">{formatTime(day.sleep.rem_sleep_duration)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Avg HR:</span>
                              <span className="font-medium flex items-center">
                                <Heart className="h-3 w-3 mr-1 text-teal-500" />
                                {day.sleep.average_heart_rate} bpm
                              </span>
                            </div>
                            {day.sleep.temperature_deviation !== 0 && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Temp Deviation:</span>
                                <span className="font-medium flex items-center">
                                  <Thermometer className="h-3 w-3 mr-1 text-orange-500" />
                                  {day.sleep.temperature_deviation > 0 ? '+' : ''}{day.sleep.temperature_deviation.toFixed(1)}°C
                                </span>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <Moon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No sleep data available</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* Summary Stats */}
            <section>
              <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
                    <BarChart3 className="h-5 w-5 mr-2 text-purple-600" />
                    Sleep Summary with Recovery Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="p-3 bg-white/60 rounded-lg text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {sleepData.filter(d => d.sleep).length}
                      </div>
                      <div className="text-xs text-gray-600">Days with sleep data</div>
                    </div>
                    <div className="p-3 bg-white/60 rounded-lg text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {sleepData.filter(d => d.readiness).length}
                      </div>
                      <div className="text-xs text-gray-600">Days with readiness data</div>
                    </div>
                    <div className="p-3 bg-white/60 rounded-lg text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {sleepData.filter(d => d.sleep && d.sleep.sleep_score >= 85).length}
                      </div>
                      <div className="text-xs text-gray-600">Excellent sleep days (85+)</div>
                    </div>
                    <div className="p-3 bg-white/60 rounded-lg text-center">
                      <div className="text-2xl font-bold text-teal-600">
                        {sleepData.filter(d => d.readiness && d.readiness.readiness_score >= 85).length}
                      </div>
                      <div className="text-xs text-gray-600">High readiness days (85+)</div>
                    </div>
                  </div>
                  
                  {/* Sleep Stage Breakdown */}
                  {sleepData.some(d => d.sleep) && (
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                        <Bed className="h-4 w-4 mr-2" />
                        Average Sleep Stage Distribution
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { 
                            name: 'Deep Sleep', 
                            value: Math.round(sleepData.filter(d => d.sleep).reduce((sum, d) => sum + (d.sleep?.deep_sleep_duration || 0), 0) / sleepData.filter(d => d.sleep).length / 60),
                            color: 'bg-blue-50 text-blue-600 border-blue-200'
                          },
                          { 
                            name: 'REM Sleep', 
                            value: Math.round(sleepData.filter(d => d.sleep).reduce((sum, d) => sum + (d.sleep?.rem_sleep_duration || 0), 0) / sleepData.filter(d => d.sleep).length / 60),
                            color: 'bg-purple-50 text-purple-600 border-purple-200'
                          },
                          { 
                            name: 'Light Sleep', 
                            value: Math.round(sleepData.filter(d => d.sleep).reduce((sum, d) => sum + (d.sleep?.light_sleep_duration || 0), 0) / sleepData.filter(d => d.sleep).length / 60),
                            color: 'bg-green-50 text-green-600 border-green-200'
                          },
                          { 
                            name: 'Awake Time', 
                            value: Math.round(sleepData.filter(d => d.sleep).reduce((sum, d) => sum + (d.sleep?.awake_time || 0), 0) / sleepData.filter(d => d.sleep).length / 60),
                            color: 'bg-gray-50 text-gray-600 border-gray-200'
                          }
                        ].map((stage) => (
                          <div key={stage.name} className={`p-3 rounded-lg text-center border ${stage.color}`}>
                            <div className="text-lg font-bold">
                              {stage.value}m
                            </div>
                            <div className="text-xs">{stage.name}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </div>
        )}
      </main>
      
      {/* Footer */}
      <footer className="relative z-10 py-6 px-6 md:px-12 text-center text-sm text-gray-500">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center gap-4 mb-2 md:mb-0">
            <span>😴 Cache-first sleep tracking</span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              Oura Ring integration with daily sync
            </span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <Brain className="h-4 w-4" />
              Sleep + recovery insights
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>Updated: {new Date().toLocaleDateString()}</span>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${chartData ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`}></div>
              <span className="text-xs">{chartData ? 'Charts Ready' : 'Loading Charts'}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              <span className="text-xs">Oura API Optimized</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default SleepJam;
