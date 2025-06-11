// ActivityJam.tsx - Ultra-fast loading with minimal chart rendering

import { useState, useEffect, useRef } from "react";
import { ArrowLeft, RefreshCw, Calendar, Clock, Zap, Heart, Activity, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import Chart from 'chart.js/auto';

interface ActivityData {
  id: string;
  name: string;
  type: string;
  start_date: string;
  distance: number;
  moving_time: number;
  total_elevation_gain: number;
  average_speed: number;
  max_speed: number;
  has_heartrate: boolean;
  average_heartrate?: number;
  max_heartrate?: number;
  calories: number;
  is_run_activity: boolean;
}

interface CachedData {
  activities: ActivityData[];
  summaryStats: any;
  timestamp: number;
  lastUpdate: string;
}

const ActivityJam = () => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [usingCache, setUsingCache] = useState(false);
  const [showAllActivities, setShowAllActivities] = useState(false);

  // Chart refs - restore these
  const caloriesChartRef = useRef<HTMLCanvasElement>(null);
  const distanceChartRef = useRef<HTMLCanvasElement>(null);
  const weightTrainingChartRef = useRef<HTMLCanvasElement>(null);
  const heartRateRunsChartRef = useRef<HTMLCanvasElement>(null);

  // Chart instances - restore these  
  const chartInstances = useRef<{ [key: string]: Chart }>({});

  // Cache configuration - back to original key to use existing cache
  const CACHE_KEY = 'activity_jam_data';
  const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

  // Helper function to determine if activity is a run
  const isRunActivity = (activityType: string): boolean => {
    const runTypes = ['run', 'virtualrun', 'treadmill', 'trail'];
    return runTypes.some(type => 
      activityType.toLowerCase().includes(type.toLowerCase())
    );
  };

  // Pre-calculate summary stats for instant display
  const calculateSummaryStats = (activities: ActivityData[]) => {
    console.log('📊 Pre-calculating summary stats...');
    
    const stats = {
      totalActivities: activities.length,
      activitiesWithCalories: activities.filter(a => a.calories && a.calories > 0).length,
      totalCalories: activities.reduce((sum, a) => sum + (a.calories || 0), 0),
      runActivities: activities.filter(a => a.is_run_activity).length,
      runsWithHR: activities.filter(a => a.is_run_activity && a.has_heartrate).length,
      totalDistance: activities.reduce((sum, a) => sum + (a.distance || 0), 0),
      totalTime: activities.reduce((sum, a) => sum + (a.moving_time || 0), 0),
      avgHeartRate: 0,
      recentActivities: activities.slice(0, 6), // First 6 for quick display
      chartData: generateMiniChartData(activities)
    };

    // Calculate average heart rate from runs only
    const runsWithHR = activities.filter(a => 
      a.is_run_activity && a.has_heartrate && a.average_heartrate
    );
    if (runsWithHR.length > 0) {
      stats.avgHeartRate = Math.round(
        runsWithHR.reduce((sum, a) => sum + a.average_heartrate!, 0) / runsWithHR.length
      );
    }

    console.log('✅ Summary stats calculated:', stats);
    return stats;
  };

  // Process activities data for charts
  const processChartData = (activities: ActivityData[]) => {
    // Sort activities by date
    const sortedActivities = [...activities].sort((a, b) => 
      new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    );

    // Group by date and aggregate data
    const dailyData = new Map();

    sortedActivities.forEach(activity => {
      const date = activity.start_date.split('T')[0]; // Get YYYY-MM-DD
      
      if (!dailyData.has(date)) {
        dailyData.set(date, {
          calories: 0,
          distance: 0,
          weightTrainingTime: 0,
          runHeartRateCount: 0,
          totalRunHeartRate: 0
        });
      }

      const dayData = dailyData.get(date);
      
      // Simple direct calories
      dayData.calories += activity.calories || 0;
      dayData.distance += activity.distance || 0;
      
      // Weight training time
      if (activity.type?.toLowerCase().includes('weight') || 
          activity.type?.toLowerCase().includes('strength')) {
        dayData.weightTrainingTime += Math.round(activity.moving_time / 60); // Convert to minutes
      }

      // Heart rate ONLY from runs
      if (activity.is_run_activity && activity.has_heartrate && activity.average_heartrate) {
        dayData.totalRunHeartRate += activity.average_heartrate;
        dayData.runHeartRateCount += 1;
      }
    });

    // Convert to arrays for charts
    const dates = Array.from(dailyData.keys()).sort();
    const labels = dates.map(date => new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    }));

    return {
      labels: dates,
      displayLabels: labels,
      calories: dates.map(date => dailyData.get(date).calories),
      distance: dates.map(date => Math.round(dailyData.get(date).distance * 100) / 100),
      weightTraining: dates.map(date => dailyData.get(date).weightTrainingTime),
      runHeartRate: dates.map(date => {
        const dayData = dailyData.get(date);
        return dayData.runHeartRateCount > 0 ? Math.round(dayData.totalRunHeartRate / dayData.runHeartRateCount) : 0;
      })
    };
  };

  // Destroy existing charts
  const destroyCharts = () => {
    Object.values(chartInstances.current).forEach(chart => {
      if (chart) {
        chart.destroy();
      }
    });
    chartInstances.current = {};
  };

  // Create charts quickly with cached data
  const createCharts = (activities: ActivityData[]) => {
    if (activities.length === 0) return;

    destroyCharts();
    
    const chartData = processChartData(activities);
    
    console.log('📊 Creating charts with data:', {
      totalDays: chartData.labels.length,
      totalCalories: chartData.calories.reduce((a, b) => a + b, 0),
      totalDistance: chartData.distance.reduce((a, b) => a + b, 0),
      totalWeightTraining: chartData.weightTraining.reduce((a, b) => a + b, 0),
      runHeartRateDays: chartData.runHeartRate.filter(hr => hr > 0).length
    });

    // Small delay to ensure refs are ready
    setTimeout(() => {
      createCaloriesChart(chartData);
      createDistanceChart(chartData);
      createWeightTrainingChart(chartData);
      createRunHeartRateChart(chartData);
    }, 50); // Reduced delay for faster rendering
  };

  // Simple chart creation functions
  const createCaloriesChart = (chartData: any) => {
    if (!caloriesChartRef.current) return;
    const ctx = caloriesChartRef.current.getContext('2d');
    if (!ctx) return;

    chartInstances.current.calories = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartData.displayLabels,
        datasets: [{
          label: 'Calories',
          data: chartData.calories,
          borderColor: 'rgba(245, 158, 11, 1)',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, grid: { color: 'rgba(156, 163, 175, 0.2)' } }
        }
      }
    });
  };

  const createDistanceChart = (chartData: any) => {
    if (!distanceChartRef.current) return;
    const ctx = distanceChartRef.current.getContext('2d');
    if (!ctx) return;

    chartInstances.current.distance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: chartData.displayLabels,
        datasets: [{
          label: 'Distance',
          data: chartData.distance,
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, grid: { color: 'rgba(156, 163, 175, 0.2)' } }
        }
      }
    });
  };

  const createWeightTrainingChart = (chartData: any) => {
    if (!weightTrainingChartRef.current) return;
    const ctx = weightTrainingChartRef.current.getContext('2d');
    if (!ctx) return;

    chartInstances.current.weightTraining = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartData.displayLabels,
        datasets: [{
          label: 'Weight Training',
          data: chartData.weightTraining,
          borderColor: 'rgba(139, 92, 246, 1)',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, grid: { color: 'rgba(156, 163, 175, 0.2)' } }
        }
      }
    });
  };

  const createRunHeartRateChart = (chartData: any) => {
    if (!heartRateRunsChartRef.current) return;
    const ctx = heartRateRunsChartRef.current.getContext('2d');
    if (!ctx) return;

    chartInstances.current.runHeartRate = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartData.displayLabels,
        datasets: [{
          label: 'Run Heart Rate',
          data: chartData.runHeartRate,
          borderColor: 'rgba(239, 68, 68, 1)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: false, grid: { color: 'rgba(156, 163, 175, 0.2)' } }
        }
      }
    });
  };
  const generateMiniChartData = (activities: ActivityData[]) => {
    // Group by week for mini charts (much faster than daily)
    const weeklyData = new Map();
    
    activities.forEach(activity => {
      const date = new Date(activity.start_date);
      const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weeklyData.has(weekKey)) {
        weeklyData.set(weekKey, {
          calories: 0,
          distance: 0,
          activities: 0,
          runHR: []
        });
      }

      const week = weeklyData.get(weekKey);
      week.calories += activity.calories || 0;
      week.distance += activity.distance || 0;
      week.activities += 1;
      
      if (activity.is_run_activity && activity.has_heartrate && activity.average_heartrate) {
        week.runHR.push(activity.average_heartrate);
      }
    });

    // Convert to simple arrays (last 8 weeks max)
    const weeks = Array.from(weeklyData.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8);

    return {
      weeks: weeks.map(([date]) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
      calories: weeks.map(([, data]) => data.calories),
      distance: weeks.map(([, data]) => Math.round(data.distance * 10) / 10),
      activities: weeks.map(([, data]) => data.activities),
      avgHR: weeks.map(([, data]) => data.runHR.length > 0 
        ? Math.round(data.runHR.reduce((a, b) => a + b) / data.runHR.length) 
        : 0
      )
    };
  };

  // Cache management - now caches everything including stats
  const getCachedData = (): CachedData | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;
      
      const data: CachedData = JSON.parse(cached);
      const now = Date.now();
      
      if (now - data.timestamp > CACHE_DURATION) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Error reading cache:', error);
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
  };

  const setCachedData = (activities: ActivityData[], summaryStats: any, lastUpdate: string) => {
    try {
      const cacheData: CachedData = {
        activities,
        summaryStats,
        timestamp: Date.now(),
        lastUpdate
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
      console.log('⚡ Ultra-fast cache saved');
    } catch (error) {
      console.error('Error caching data:', error);
    }
  };

  const clearCache = () => {
    localStorage.removeItem(CACHE_KEY);
    console.log('🗑️ Cache cleared');
  };

  // Ultra-fast cache loading
  const loadFromCache = (): boolean => {
    const cached = getCachedData();
    if (cached) {
      console.log('⚡⚡⚡ INSTANT LOAD FROM CACHE');
      setActivities(cached.activities);
      setSummaryStats(cached.summaryStats);
      setLastUpdate(cached.lastUpdate);
      setUsingCache(true);
      setLoading(false);
      
      // Create charts with cached data
      createCharts(cached.activities);
      return true;
    }
    return false;
  };

  // Simplified fetch without heavy chart processing
  const fetchActivities = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
        setUsingCache(false);
        clearCache();
      } else {
        setLoading(true);
      }

      setError('');
      
      const params = new URLSearchParams({
        days: '30',
        userId: 'mihir_jain'
      });
      
      if (forceRefresh) {
        params.set('refresh', 'true');
        params.set('timestamp', Date.now().toString());
      }
      
      console.log('🌐 Fetching from API...');
      const startTime = performance.now();
      
      const response = await fetch(`/api/strava?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch activities: ${response.status}`);
      }

      const data = await response.json();
      const apiTime = performance.now() - startTime;
      console.log(`📡 API took: ${apiTime.toFixed(0)}ms`);
      
      // Quick processing without heavy chart calculations
      const processStart = performance.now();
      const processedActivities = data.map((activity: any) => {
        const activityType = activity.type || 'Activity';
        const isRun = isRunActivity(activityType);

        return {
          id: activity.id?.toString() || Math.random().toString(),
          name: activity.name || 'Unnamed Activity',
          type: activityType,
          start_date: activity.start_date,
          distance: typeof activity.distance === 'number' 
            ? activity.distance 
            : (activity.distance || 0) / 1000,
          moving_time: activity.moving_time || activity.duration * 60 || 0,
          total_elevation_gain: activity.total_elevation_gain || activity.elevation_gain || 0,
          average_speed: activity.average_speed || 0,
          max_speed: activity.max_speed || 0,
          has_heartrate: activity.has_heartrate || false,
          average_heartrate: activity.average_heartrate || activity.heart_rate,
          max_heartrate: activity.max_heartrate,
          calories: activity.calories || 0,
          is_run_activity: isRun
        };
      });

      const sortedActivities = processedActivities.sort((a: ActivityData, b: ActivityData) => 
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
      );

      const processTime = performance.now() - processStart;
      console.log(`⚙️ Processing took: ${processTime.toFixed(0)}ms`);

      // Pre-calculate stats
      const statsStart = performance.now();
      const stats = calculateSummaryStats(sortedActivities);
      const statsTime = performance.now() - statsStart;
      console.log(`📊 Stats calculation took: ${statsTime.toFixed(0)}ms`);

      const updateTime = new Date().toLocaleTimeString();

      setActivities(sortedActivities);
      setSummaryStats(stats);
      setLastUpdate(updateTime);
      setUsingCache(false);

      // Cache everything for next time
      setCachedData(sortedActivities, stats, updateTime);

      // Create charts after activities are set
      createCharts(sortedActivities);

      const totalTime = performance.now() - startTime;
      console.log(`🎯 Total load time: ${totalTime.toFixed(0)}ms`);

    } catch (error) {
      console.error('❌ Error fetching activities:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch activities');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    await fetchActivities(true);
  };

  // Ultra-fast initial load
  useEffect(() => {
    const loadStart = performance.now();
    
    // Try cache first
    const cacheLoaded = loadFromCache();
    
    if (cacheLoaded) {
      const cacheTime = performance.now() - loadStart;
      console.log(`⚡ Cache load time: ${cacheTime.toFixed(0)}ms`);
    } else {
      fetchActivities(false);
    }
    
    // Cleanup charts on unmount
    return () => {
      destroyCharts();
    };
  }, []);

  // Helper functions
  const formatDistance = (distance: number) => {
    if (distance === 0) return '0.00';
    if (distance < 0.1) return distance.toFixed(3);
    return distance.toFixed(2);
  };

  const formatTime = (seconds: number) => {
    if (!seconds) return '0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const formatPace = (distance: number, time: number) => {
    if (distance === 0 || time === 0) return 'N/A';
    const paceSeconds = time / distance;
    const minutes = Math.floor(paceSeconds / 60);
    const seconds = Math.floor(paceSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  };

  // Mini chart component (super simple bars)
  const MiniChart = ({ data, color, max }: { data: number[], color: string, max?: number }) => {
    if (!data || data.length === 0) return <div className="h-8 bg-gray-100 rounded"></div>;
    
    const maxValue = max || Math.max(...data);
    if (maxValue === 0) return <div className="h-8 bg-gray-100 rounded"></div>;
    
    return (
      <div className="flex items-end h-8 gap-1">
        {data.slice(-8).map((value, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm opacity-80 hover:opacity-100 transition-opacity"
            style={{
              backgroundColor: color,
              height: `${Math.max(2, (value / maxValue) * 100)}%`
            }}
          />
        ))}
      </div>
    );
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 flex flex-col">
        <header className="pt-8 px-6 md:px-12">
          <div className="flex items-center justify-between mb-6">
            <Button onClick={() => navigate('/')} variant="ghost">
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
              <h3 className="text-lg font-semibold mb-2">Unable to Load Activities</h3>
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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-orange-400/10 to-red-400/10 animate-pulse"></div>
      <div className="absolute top-20 left-20 w-32 h-32 bg-orange-200/30 rounded-full blur-xl animate-bounce"></div>
      <div className="absolute bottom-20 right-20 w-24 h-24 bg-red-200/30 rounded-full blur-xl animate-bounce delay-1000"></div>
      
      {/* Header */}
      <header className="relative z-10 pt-8 px-6 md:px-12">
        <div className="flex items-center justify-between mb-6">
          <Button onClick={() => navigate('/')} variant="ghost" className="hover:bg-white/20">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
          
          <div className="flex items-center gap-3">
            {usingCache && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                ⚡ Instant Load
              </Badge>
            )}
            <Button 
              onClick={handleRefresh}
              variant="outline"
              disabled={refreshing}
              className="hover:bg-white/20"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh Data'}
            </Button>
          </div>
        </div>
        
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-600 via-red-600 to-pink-600 bg-clip-text text-transparent">
            Activity Jam
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Your recent workouts and activities from Strava
            {usingCache && <span className="text-green-600"> (ultra-fast cached)</span>}
          </p>
          {lastUpdate && (
            <p className="mt-1 text-sm text-gray-500">
              Last updated: {lastUpdate} • 
              {usingCache && <span className="text-green-600"> ⚡ Cached</span>} • 
              Showing last 30 days
            </p>
          )}
        </div>
      </header>
      
      {/* Main content */}
      <main className="relative z-10 px-6 md:px-12 py-8">
        {loading ? (
          <div className="space-y-8">
            {/* Quick summary skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="bg-white/80 backdrop-blur-sm border border-white/20">
                  <CardContent className="p-6">
                    <Skeleton className="h-8 w-16 mb-2" />
                    <Skeleton className="h-4 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {/* Activity card skeletons */}
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
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Calendar className="h-16 w-16 mx-auto" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Recent Activities</h3>
            <p className="text-gray-600 mb-4">
              No activities found in the last 30 days. Try refreshing or check your Strava connection.
            </p>
            <Button onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh Activities'}
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Quick Summary with Mini Charts */}
            {summaryStats && (
              <section>
                <div className="flex items-center mb-6">
                  <BarChart3 className="h-6 w-6 mr-3 text-gray-600" />
                  <h2 className="text-2xl font-semibold text-gray-800">Quick Overview</h2>
                  {usingCache && (
                    <Badge variant="outline" className="ml-3 bg-green-50 text-green-700 border-green-300 text-xs">
                      ⚡ Pre-calculated
                    </Badge>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Calories with mini chart */}
                  <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <Zap className="h-5 w-5 mr-2 text-orange-500" />
                          <span className="text-sm font-medium text-gray-600">Calories</span>
                        </div>
                        <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">
                          Strava
                        </Badge>
                      </div>
                      <div className="text-2xl font-bold text-orange-600 mb-3">
                        {summaryStats.totalCalories.toLocaleString()}
                      </div>
                      <MiniChart 
                        data={summaryStats.chartData.calories} 
                        color="rgba(245, 158, 11, 0.7)"
                      />
                    </CardContent>
                  </Card>

                  {/* Distance with mini chart */}
                  <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <Activity className="h-5 w-5 mr-2 text-blue-500" />
                          <span className="text-sm font-medium text-gray-600">Distance</span>
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-blue-600 mb-3">
                        {summaryStats.totalDistance.toFixed(1)} km
                      </div>
                      <MiniChart 
                        data={summaryStats.chartData.distance} 
                        color="rgba(59, 130, 246, 0.7)"
                      />
                    </CardContent>
                  </Card>

                  {/* Run HR with mini chart */}
                  <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <Heart className="h-5 w-5 mr-2 text-red-500" />
                          <span className="text-sm font-medium text-gray-600">Run HR</span>
                        </div>
                        <Badge variant="outline" className="text-xs border-red-300 text-red-600">
                          Runs only
                        </Badge>
                      </div>
                      <div className="text-2xl font-bold text-red-600 mb-3">
                        {summaryStats.avgHeartRate || 'N/A'} 
                        {summaryStats.avgHeartRate && <span className="text-sm font-normal"> bpm</span>}
                      </div>
                      <MiniChart 
                        data={summaryStats.chartData.avgHR} 
                        color="rgba(239, 68, 68, 0.7)"
                        max={200}
                      />
                    </CardContent>
                  </Card>

                  {/* Activities count */}
                  <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <Calendar className="h-5 w-5 mr-2 text-purple-500" />
                          <span className="text-sm font-medium text-gray-600">Activities</span>
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-purple-600 mb-3">
                        {summaryStats.totalActivities}
                      </div>
                      <MiniChart 
                        data={summaryStats.chartData.activities} 
                        color="rgba(139, 92, 246, 0.7)"
                      />
                    </CardContent>
                  </Card>
                </div>
              </section>
            )}

            {/* Charts Section - RESTORED */}
            <section>
              <div className="flex items-center mb-6">
                <BarChart3 className="h-6 w-6 mr-3 text-gray-600" />
                <h2 className="text-2xl font-semibold text-gray-800">Activity Trends</h2>
                {usingCache && (
                  <Badge variant="outline" className="ml-3 bg-green-50 text-green-700 border-green-300 text-xs">
                    ⚡ Fast Load
                  </Badge>
                )}
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Calories Chart */}
                <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
                      <Zap className="h-5 w-5 mr-2 text-green-500" />
                      Calories Burned
                    </CardTitle>
                    <p className="text-xs text-gray-600">Direct from Strava API</p>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <canvas ref={caloriesChartRef} className="w-full h-full"></canvas>
                    </div>
                  </CardContent>
                </Card>

                {/* Distance Chart */}
                <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
                      <Activity className="h-5 w-5 mr-2 text-blue-500" />
                      Distance Covered
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <canvas ref={distanceChartRef} className="w-full h-full"></canvas>
                    </div>
                  </CardContent>
                </Card>

                {/* Weight Training Chart */}
                <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
                      <Activity className="h-5 w-5 mr-2 text-purple-500" />
                      Weight Training Time
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <canvas ref={weightTrainingChartRef} className="w-full h-full"></canvas>
                    </div>
                  </CardContent>
                </Card>

                {/* Run Heart Rate Chart */}
                <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
                      <Heart className="h-5 w-5 mr-2 text-red-500" />
                      Run Heart Rate
                    </CardTitle>
                    <p className="text-xs text-gray-600">Only from running activities</p>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <canvas ref={heartRateRunsChartRef} className="w-full h-full"></canvas>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Recent Activities List */}
            <section>
              <div className="flex items-center mb-6">
                <Calendar className="h-6 w-6 mr-3 text-gray-600" />
                <h2 className="text-2xl font-semibold text-gray-800">Recent Activities</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(showAllActivities ? activities : (summaryStats?.recentActivities || activities.slice(0, 9))).map((activity) => (
                  <Card key={activity.id} className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm hover:shadow-md transition-all duration-200">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg font-semibold text-gray-800 leading-tight">
                          {activity.name}
                        </CardTitle>
                        <div className="flex flex-col gap-1">
                          <Badge variant="secondary" className="ml-2 shrink-0">
                            {activity.type}
                          </Badge>
                          {activity.is_run_activity && activity.type.toLowerCase() !== 'run' && (
                            <Badge variant="outline" className="ml-2 shrink-0 text-xs border-red-300 text-red-600">
                              Run
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="h-4 w-4 mr-2" />
                        {new Date(activity.start_date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="text-center p-3 bg-orange-50 rounded-lg">
                          <div className="text-2xl font-bold text-orange-600">
                            {formatDistance(activity.distance)}
                          </div>
                          <div className="text-xs text-gray-600">km</div>
                        </div>
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">
                            {formatTime(activity.moving_time)}
                          </div>
                          <div className="text-xs text-gray-600">duration</div>
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Pace:</span>
                          <span className="font-medium">{formatPace(activity.distance, activity.moving_time)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Elevation:</span>
                          <span className="font-medium">{activity.total_elevation_gain}m</span>
                        </div>
                        {activity.is_run_activity && activity.has_heartrate && activity.average_heartrate && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Avg HR:</span>
                            <span className="font-medium flex items-center">
                              <Heart className="h-3 w-3 mr-1 text-red-500" />
                              {activity.average_heartrate} bpm
                              <Badge variant="outline" className="ml-1 text-xs border-red-300 text-red-600">
                                Run
                              </Badge>
                            </span>
                          </div>
                        )}
                        {activity.calories && activity.calories > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Calories:</span>
                            <span className="font-medium flex items-center">
                              <Zap className="h-3 w-3 mr-1 text-green-500" />
                              {activity.calories}
                              <Badge variant="outline" className="ml-1 text-xs border-green-300 text-green-600">
                                Strava
                              </Badge>
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {!showAllActivities && activities.length > 9 && (
                <div className="text-center mt-6">
                  <Button variant="outline" onClick={() => setShowAllActivities(true)}>
                    View All {activities.length} Activities
                  </Button>
                </div>
              )}

              {showAllActivities && (
                <div className="text-center mt-6">
                  <Button variant="outline" onClick={() => setShowAllActivities(false)}>
                    Show Recent Only
                  </Button>
                </div>
              )}
            </section>

            {/* Summary Stats */}
            {summaryStats && (
              <section>
                <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
                      <BarChart3 className="h-5 w-5 mr-2 text-green-600" />
                      30-Day Summary
                      {usingCache && (
                        <Badge variant="outline" className="ml-3 bg-green-50 text-green-700 border-green-300 text-xs">
                          ⚡ Instant
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div className="p-3 bg-white/60 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {summaryStats.activitiesWithCalories}
                        </div>
                        <div className="text-xs text-gray-600">Activities with calories</div>
                      </div>
                      <div className="p-3 bg-white/60 rounded-lg">
                        <div className="text-2xl font-bold text-orange-600">
                          {summaryStats.totalCalories.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-600">Total calories burned</div>
                      </div>
                      <div className="p-3 bg-white/60 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">
                          {summaryStats.runActivities}
                        </div>
                        <div className="text-xs text-gray-600">Running activities</div>
                      </div>
                      <div className="p-3 bg-white/60 rounded-lg">
                        <div className="text-2xl font-bold text-red-600">
                          {summaryStats.runsWithHR}
                        </div>
                        <div className="text-xs text-gray-600">Runs with HR data</div>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-white/40">
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Total Distance: <strong>{summaryStats.totalDistance.toFixed(1)} km</strong></span>
                        <span>Total Time: <strong>{formatTime(summaryStats.totalTime)}</strong></span>
                        {summaryStats.avgHeartRate > 0 && (
                          <span>Avg Run HR: <strong>{summaryStats.avgHeartRate} bpm</strong></span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>
            )}
          </div>
        )}
      </main>
      
      {/* Footer */}
      <footer className="relative z-10 py-6 px-6 md:px-12 text-center text-sm text-gray-500">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center gap-4 mb-2 md:mb-0">
            <span>⚡ Ultra-fast loading with smart caching</span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <Heart className="h-4 w-4" />
              HR from runs only
            </span>
            {usingCache && (
              <>
                <span className="hidden md:inline">•</span>
                <span className="flex items-center gap-1 text-green-600">
                  📊 Pre-calculated charts
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span>Cache: {usingCache ? '15min' : 'Fresh'}</span>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full animate-pulse ${usingCache ? 'bg-green-500' : 'bg-blue-500'}`}></div>
              <span className="text-xs">{usingCache ? 'Cached' : 'Live'}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ActivityJam;
