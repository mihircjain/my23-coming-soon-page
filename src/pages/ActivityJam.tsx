// ActivityJam.tsx - Activity tracking without detailed analysis

import { useState, useEffect, useRef } from "react";
import { ArrowLeft, RefreshCw, Calendar, Clock, Zap, Heart, Activity, BarChart3, Tag, Edit3, Check, X, TrendingUp, MapPin, Timer, Target, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Chart from 'chart.js/auto';

// Run tag types
type RunTag = 'easy' | 'tempo' | 'long' | 'recovery' | 'intervals' | 'hill-repeats';

interface RunTagOption {
  value: RunTag;
  label: string;
  color: string;
  bgColor: string;
}

const RUN_TAG_OPTIONS: RunTagOption[] = [
  { value: 'easy', label: 'Easy', color: 'text-green-600', bgColor: 'bg-green-50 border-green-200' },
  { value: 'tempo', label: 'Tempo', color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200' },
  { value: 'long', label: 'Long', color: 'text-emerald-600', bgColor: 'bg-emerald-50 border-emerald-200' },
  { value: 'recovery', label: 'Recovery', color: 'text-teal-600', bgColor: 'bg-teal-50 border-teal-200' },
  { value: 'intervals', label: 'Intervals', color: 'text-cyan-600', bgColor: 'bg-cyan-50 border-cyan-200' },
  { value: 'hill-repeats', label: 'Hill Repeats', color: 'text-lime-600', bgColor: 'bg-lime-50 border-lime-200' }
];

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
  calorie_source?: string;
  is_run_activity: boolean;
  run_tag?: RunTag;
}

const ActivityJam = () => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshType, setRefreshType] = useState<'today' | '30days' | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editingCalories, setEditingCalories] = useState<string | null>(null);
  const [caloriesInput, setCaloriesInput] = useState<string>('');

  // Chart refs
  const caloriesChartRef = useRef<HTMLCanvasElement>(null);
  const distanceChartRef = useRef<HTMLCanvasElement>(null);
  const heartRateChartRef = useRef<HTMLCanvasElement>(null);

  // Chart instances
  const chartInstances = useRef<{ [key: string]: Chart | null }>({
    calories: null,
    distance: null,
    heartRate: null
  });

  // Chart data state
  const [chartData, setChartData] = useState<{
    calories: number[];
    distance: number[];
    heartRate: number[];
    labels: string[];
  } | null>(null);

  // Helper function to determine if activity is a run
  const isRunActivity = (activityType: string): boolean => {
    const runTypes = ['run', 'virtualrun', 'treadmill', 'trail'];
    return runTypes.some(type => 
      activityType.toLowerCase().includes(type.toLowerCase())
    );
  };

  // Auto-tag runs based on distance, pace, and heart rate
  const autoTagRun = (activity: ActivityData): RunTag => {
    if (!activity.is_run_activity) return 'easy';

    const distance = activity.distance;
    const timeInMinutes = activity.moving_time / 60;
    const paceMinPerKm = timeInMinutes / distance;
    const avgHR = activity.average_heartrate;
    const elevation = activity.total_elevation_gain;

    // Long run detection
    if (distance >= 15) return 'long';
    if (distance >= 10 && paceMinPerKm > 5.5) return 'long';

    // Hill repeats detection
    if (elevation && distance > 0) {
      const elevationPerKm = elevation / distance;
      if (elevationPerKm > 80 && distance <= 8) return 'hill-repeats';
      if (elevation > 300 && distance <= 10 && paceMinPerKm < 5.5) return 'hill-repeats';
    }

    // Recovery run detection
    if (distance <= 5 && paceMinPerKm > 6.5) return 'recovery';
    if (avgHR && avgHR < 140 && distance <= 8) return 'recovery';

    // Intervals detection
    if (paceMinPerKm < 4.0 && distance <= 10) return 'intervals';
    if (avgHR && avgHR > 170 && distance <= 8) return 'intervals';

    // Tempo detection
    if (paceMinPerKm < 5.0 && distance >= 5 && distance <= 12) return 'tempo';
    if (avgHR && avgHR >= 155 && avgHR <= 170 && distance >= 5) return 'tempo';

    return 'easy';
  };

  // Save run tag to API
  const saveRunTag = async (activityId: string, tag: RunTag) => {
    try {
      console.log(`💾 Saving run tag: ${activityId} -> ${tag}`);
      
      const response = await fetch('/api/run-tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          activityId,
          tag,
          userId: 'mihir_jain',
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Save run tag API error:', response.status, errorText);
        throw new Error('Failed to save run tag');
      }

      const result = await response.json();
      console.log('✅ Run tag saved successfully:', result);
      return result;
    } catch (error) {
      console.error('❌ Error saving run tag:', error);
      throw error;
    }
  };

  // Save edited calories to API
  const saveEditedCalories = async (activityId: string, calories: number) => {
    try {
      console.log(`💾 Saving edited calories: ${activityId} -> ${calories}`);
      
      const response = await fetch('/api/strava', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 'mihir_jain',
          activityId,
          calories
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Save calories API error:', response.status, errorText);
        throw new Error('Failed to save calories');
      }

      const result = await response.json();
      console.log('✅ Calories saved successfully:', result);
      return result;
    } catch (error) {
      console.error('❌ Error saving calories:', error);
      throw error;
    }
  };

  // Handle tag change
  const handleTagChange = async (activityId: string, newTag: RunTag) => {
    console.log(`🏷️ Changing tag for ${activityId}: ${newTag}`);
    
    try {
      // Update local state immediately
      setActivities(prev => prev.map(activity => 
        activity.id === activityId 
          ? { ...activity, run_tag: newTag }
          : activity
      ));

      // Save to API
      await saveRunTag(activityId, newTag);
      
      console.log(`✅ Tag change completed for ${activityId}: ${newTag}`);
      setEditingTag(null);
      setLastUpdate(new Date().toLocaleTimeString());
      
    } catch (error) {
      console.error('❌ Failed to save tag change:', error);
      
      // Revert local state on error
      setActivities(prev => prev.map(activity => {
        if (activity.id === activityId) {
          const originalActivity = activities.find(a => a.id === activityId);
          return { ...activity, run_tag: originalActivity?.run_tag };
        }
        return activity;
      }));
      
      setError('Failed to save tag change. Please try again.');
      setEditingTag(null);
    }
  };

  // Handle calorie change
  const handleCalorieChange = async (activityId: string, newCalories: number) => {
    console.log(`🔥 Changing calories for ${activityId}: ${newCalories}`);
    
    try {
      // Update local state immediately
      setActivities(prev => prev.map(activity => 
        activity.id === activityId 
          ? { ...activity, calories: newCalories }
          : activity
      ));

      // Save to API
      await saveEditedCalories(activityId, newCalories);
      
      console.log(`✅ Calorie change completed for ${activityId}: ${newCalories}`);
      setEditingCalories(null);
      setCaloriesInput('');
      setLastUpdate(new Date().toLocaleTimeString());
      
    } catch (error) {
      console.error('❌ Failed to save calorie change:', error);
      
      // Revert local state on error
      setActivities(prev => prev.map(activity => {
        if (activity.id === activityId) {
          const originalActivity = activities.find(a => a.id === activityId);
          return { ...activity, calories: originalActivity?.calories || 0 };
        }
        return activity;
      }));
      
      setError('Failed to save calorie change. Please try again.');
      setEditingCalories(null);
      setCaloriesInput('');
    }
  };

  // Get run tag option
  const getRunTagOption = (tag: RunTag): RunTagOption => {
    return RUN_TAG_OPTIONS.find(option => option.value === tag) || RUN_TAG_OPTIONS[0];
  };

  // Process activities data for charts
  const processChartData = (activities: ActivityData[]) => {
    console.log('📊 PROCESSING CHART DATA from', activities.length, 'activities');
    
    if (activities.length === 0) {
      console.log('📊 No activities to process');
      return null;
    }

    // Sort activities by date
    const sortedActivities = [...activities].sort((a, b) => 
      new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    );

    console.log(`📊 Date range: ${sortedActivities[0]?.start_date?.split('T')[0]} to ${sortedActivities[sortedActivities.length-1]?.start_date?.split('T')[0]}`);

    // Group by date
    const dailyData = new Map();

    sortedActivities.forEach(activity => {
      const date = activity.start_date.split('T')[0];
      
      if (!dailyData.has(date)) {
        dailyData.set(date, {
          calories: 0,
          distance: 0,
          heartRateTotal: 0,
          heartRateCount: 0
        });
      }

      const dayData = dailyData.get(date);
      
      // Add calories (if available)
      if (activity.calories && activity.calories > 0) {
        dayData.calories += activity.calories;
      }
      
      // Add distance
      dayData.distance += activity.distance;
      
      // Add heart rate for averaging
      if (activity.has_heartrate && activity.average_heartrate) {
        dayData.heartRateTotal += activity.average_heartrate;
        dayData.heartRateCount += 1;
      }
    });

    // Convert to arrays for charts
    const labels: string[] = [];
    const calories: number[] = [];
    const distance: number[] = [];
    const heartRate: number[] = [];

    // Sort by date and build arrays
    Array.from(dailyData.entries())
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .forEach(([date, data]) => {
        labels.push(new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        calories.push(data.calories);
        distance.push(data.distance);
        heartRate.push(data.heartRateCount > 0 ? data.heartRateTotal / data.heartRateCount : 0);
      });

    console.log('📊 Chart data processed:', { labels: labels.length, calories: calories.length, distance: distance.length, heartRate: heartRate.length });
    
    return { labels, calories, distance, heartRate };
  };

  // Destroy all charts
  const destroyCharts = () => {
    Object.values(chartInstances.current).forEach(chart => {
      if (chart) {
        chart.destroy();
      }
    });
    chartInstances.current = {
      calories: null,
      distance: null,
      heartRate: null
    };
  };

  // Create calories chart
  const createCaloriesChart = (data: any) => {
    if (!caloriesChartRef.current) return;
    
    const ctx = caloriesChartRef.current.getContext('2d');
    if (!ctx) return;

    try {
      chartInstances.current.calories = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: data.labels,
          datasets: [{
            label: 'Calories Burned',
            data: data.calories,
            backgroundColor: 'rgba(34, 197, 94, 0.6)',
            borderColor: 'rgb(34, 197, 94)',
            borderWidth: 1
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
              grid: { color: 'rgba(0,0,0,0.1)' }
            }
          }
        }
      });
    } catch (error) {
      console.error('❌ Error creating calories chart:', error);
    }
  };

  // Create distance chart
  const createDistanceChart = (data: any) => {
    if (!distanceChartRef.current) return;
    
    const ctx = distanceChartRef.current.getContext('2d');
    if (!ctx) return;

    try {
      chartInstances.current.distance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.labels,
          datasets: [{
            label: 'Distance (km)',
            data: data.distance,
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4
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
              grid: { color: 'rgba(0,0,0,0.1)' }
            }
          }
        }
      });
    } catch (error) {
      console.error('❌ Error creating distance chart:', error);
    }
  };

  // Create heart rate chart
  const createHeartRateChart = (data: any) => {
    if (!heartRateChartRef.current) return;
    
    const ctx = heartRateChartRef.current.getContext('2d');
    if (!ctx) return;

    // Filter out zero values for heart rate
    const filteredData = data.heartRate.map((hr: number, index: number) => 
      hr > 0 ? hr : null
    );

    try {
      chartInstances.current.heartRate = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.labels,
          datasets: [{
            label: 'Average Heart Rate (bpm)',
            data: filteredData,
            borderColor: 'rgb(239, 68, 68)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            spanGaps: true
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
              min: 120,
              grid: { color: 'rgba(0,0,0,0.1)' }
            }
          }
        }
      });
    } catch (error) {
      console.error('❌ Error creating heart rate chart:', error);
    }
  };

  // Load or create charts
  const loadOrCreateCharts = async (activities: ActivityData[], forceRecreate = false) => {
    console.log('📊 loadOrCreateCharts called with', activities.length, 'activities, forceRecreate:', forceRecreate);
    
    try {
      if (forceRecreate) {
        console.log('📊 Force recreating charts...');
        destroyCharts();
        setChartData(null);
      }

      if (!chartData || forceRecreate) {
        console.log('📊 Processing new chart data...');
        const newChartData = processChartData(activities);
        
        if (newChartData) {
          setChartData(newChartData);
          
          // Small delay to ensure canvas elements are ready
          setTimeout(() => {
            console.log('📊 Creating charts with processed data...');
            createCaloriesChart(newChartData);
            createDistanceChart(newChartData);
            createHeartRateChart(newChartData);
          }, 100);
        }
      } else {
        console.log('📊 Using existing chart data');
        // Recreate charts with existing data if canvas elements are missing
        setTimeout(() => {
          if (chartData && (!chartInstances.current.calories || !chartInstances.current.distance || !chartInstances.current.heartRate)) {
            console.log('📊 Recreating missing charts...');
            createCaloriesChart(chartData);
            createDistanceChart(chartData);
            createHeartRateChart(chartData);
          }
        }, 100);
      }
    } catch (error) {
      console.error('❌ Error in loadOrCreateCharts:', error);
    }
  };

  // Fetch activities from API
  const fetchActivities = async (refreshMode: 'cached' | 'today' | 'refresh' = 'cached') => {
    try {
      setError('');
      console.log(`📡 Fetching activities (mode: ${refreshMode})`);
      
      const params = new URLSearchParams({
        userId: 'mihir_jain',
        mode: refreshMode
      });
      
      // Different refresh strategies
      if (refreshMode === 'today') {
        params.set('timestamp', Date.now().toString());
        console.log('📅 Today refresh mode');
      } else if (refreshMode === 'refresh') {
        params.set('refresh', 'true');
        params.set('days', '30');
        params.set('preserveTags', 'true');
        params.set('timestamp', Date.now().toString());
        console.log('🔄 Full refresh mode');
      } else {
        console.log('⚡ Cache-first mode (instant loading)');
      }
      
      const response = await fetch(`/api/strava?${params.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 404 && errorData.recommendRefresh) {
          console.log('📦 No cached data - need initial refresh');
          setError('No data available. Click "Refresh 30 Days" to load your activities.');
          return;
        }
        
        throw new Error(errorData.message || `Failed to fetch activities: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📊 Data received:', data?.length, 'activities');
      
      if (!Array.isArray(data)) {
        console.error('❌ Expected array but got:', typeof data, data);
        throw new Error('Invalid data format received from API');
      }
      
      // Process activities - add run detection and auto-tagging
      const processedActivities = data.map((activity: any) => {
        const activityType = activity.type || 'Activity';
        const isRun = isRunActivity(activityType);

        const processedActivity: ActivityData = {
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

        if (isRun) {
          processedActivity.run_tag = activity.run_tag || activity.runType || autoTagRun(processedActivity);
        }

        return processedActivity;
      });
      
      const sortedActivities = processedActivities.sort((a: ActivityData, b: ActivityData) => 
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
      );

      console.log('🏃 Processing complete:', {
        mode: refreshMode,
        totalActivities: sortedActivities.length,
        runActivities: sortedActivities.filter(a => a.is_run_activity).length
      });

      setActivities(sortedActivities);
      setLastUpdate(new Date().toLocaleTimeString());
      
      // Load charts after setting activities
      await loadOrCreateCharts(sortedActivities, refreshMode !== 'cached');
      
      console.log('✅ Activities loaded and charts updated');
      
    } catch (error) {
      console.error('❌ Failed to fetch activities:', error);
      setError(error instanceof Error ? error.message : 'Failed to load activities');
    }
  };

  // Refresh handlers
  const handleRefreshToday = async () => {
    setRefreshing(true);
    setRefreshType('today');
    try {
      await fetchActivities('today');
    } finally {
      setRefreshing(false);
      setRefreshType(null);
    }
  };

  const handleRefresh30Days = async () => {
    setRefreshing(true);
    setRefreshType('30days');
    try {
      await fetchActivities('refresh');
    } finally {
      setRefreshing(false);
      setRefreshType(null);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchActivities('cached');
    } finally {
      setRefreshing(false);
    }
  };

  // Load cached activities on mount
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        await fetchActivities('cached');
      } finally {
        setLoading(false);
      }
    };
    
    loadInitialData();
    
    // Cleanup charts on unmount
    return () => {
      destroyCharts();
    };
  }, []);

  // Format helper functions
  const formatDistance = (distance: number) => {
    return distance.toFixed(1);
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatPace = (distance: number, time: number) => {
    if (distance === 0) return '--:--';
    const paceSeconds = time / distance;
    const minutes = Math.floor(paceSeconds / 60);
    const seconds = Math.floor(paceSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-green-400/10 to-blue-400/10 animate-pulse"></div>
      <div className="absolute top-20 left-20 w-32 h-32 bg-green-200/30 rounded-full blur-xl animate-bounce"></div>
      <div className="absolute bottom-20 right-20 w-24 h-24 bg-blue-200/30 rounded-full blur-xl animate-bounce delay-1000"></div>
      
      {/* Header */}
      <header className="relative z-10 pt-8 px-6 md:px-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <Button onClick={() => navigate('/')} variant="ghost" className="hover:bg-white/20">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
          
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button 
              onClick={handleRefreshToday}
              variant="outline"
              disabled={refreshing}
              className="hover:bg-white/20 w-full sm:w-auto mobile-button"
              title="Quick refresh - only checks for today's new activities (1 API call)"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing && refreshType === 'today' ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">
                {refreshing && refreshType === 'today' ? 'Checking Today...' : 'Refresh Today'}
              </span>
              <span className="sm:hidden">
                {refreshing && refreshType === 'today' ? 'Today...' : 'Today'}
              </span>
            </Button>
            
            <Button 
              onClick={handleRefresh30Days}
              variant="outline"
              disabled={refreshing}
              className="hover:bg-white/20 w-full sm:w-auto mobile-button"
              title="Full refresh - fetches all activities from last 30 days (1 API call)"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing && refreshType === '30days' ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">
                {refreshing && refreshType === '30days' ? 'Refreshing All...' : 'Refresh 30 Days'}
              </span>
              <span className="sm:hidden">
                {refreshing && refreshType === '30days' ? 'Loading...' : '30 Days'}
              </span>
            </Button>
          </div>
        </div>
        
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-green-600 via-blue-600 to-teal-600 bg-clip-text text-transparent">
            Activity Jam
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Your recent workouts and activities from Strava with optimized loading and smart run tagging
          </p>
          {lastUpdate && (
            <p className="mt-1 text-sm text-gray-500">
              Last updated: {lastUpdate} • Instant cache-first loading
            </p>
          )}
        </div>
      </header>
      
      {/* Main content */}
      <main className="relative z-10 px-6 md:px-12 py-8">
        {loading ? (
          <div className="space-y-8">
            {/* Chart skeletons */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
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
            
            {/* Loading message */}
            <div className="text-center py-4">
              <p className="text-gray-600">Loading your cached activities...</p>
              <p className="text-sm text-gray-500 mt-1">This should be fast! ⚡</p>
            </div>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Calendar className="h-16 w-16 mx-auto" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Activities Found</h3>
            <p className="text-gray-600 mb-4">
              {error 
                ? "Unable to load your activities. Please try refreshing." 
                : "No cached activities available. Load your activities from Strava to get started."
              }
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button onClick={handleRefreshToday} disabled={refreshing} variant="outline">
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing && refreshType === 'today' ? 'animate-spin' : ''}`} />
                {refreshing && refreshType === 'today' ? 'Loading Today...' : 'Load Today'}
              </Button>
              <Button onClick={handleRefresh30Days} disabled={refreshing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing && refreshType === '30days' ? 'animate-spin' : ''}`} />
                {refreshing && refreshType === '30days' ? 'Loading 30 Days...' : 'Load 30 Days'}
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
                  <h2 className="text-2xl font-semibold text-gray-800">Activity Trends</h2>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className={`w-2 h-2 rounded-full ${chartData ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                  <span>{chartData ? 'Charts ready (cached)' : 'Loading charts...'}</span>
                </div>
              </div>
              
              <div className="mobile-grid-3 gap-6">
                {/* Calories Chart */}
                <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
                      <Zap className="h-5 w-5 mr-2 text-green-500" />
                      Calories Burned
                    </CardTitle>
                    <p className="text-xs text-gray-600">Daily totals from Strava (when available)</p>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 relative">
                      {chartData ? (
                        <canvas ref={caloriesChartRef} className="w-full h-full"></canvas>
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

                {/* Distance Chart */}
                <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
                      <Activity className="h-5 w-5 mr-2 text-blue-500" />
                      Distance Covered
                    </CardTitle>
                    <p className="text-xs text-gray-600">Daily distance (km)</p>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 relative">
                      {chartData ? (
                        <canvas ref={distanceChartRef} className="w-full h-full"></canvas>
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
                      <Heart className="h-5 w-5 mr-2 text-red-500" />
                      Heart Rate
                    </CardTitle>
                    <p className="text-xs text-gray-600">Daily average (when available)</p>
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

            {/* Activities List */}
            <section>
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <div className="flex items-center">
                  <Activity className="h-6 w-6 mr-3 text-gray-600" />
                  <h2 className="text-2xl font-semibold text-gray-800">Recent Activities</h2>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <Tag className="h-4 w-4" />
                    <span className="hidden sm:inline">Click run tags to edit</span>
                    <span className="sm:hidden">Tap to edit tags</span>
                  </div>
                </div>
              </div>
              
              <div className="mobile-grid-3 gap-6">
                {activities.map((activity) => (
                  <Card 
                    key={activity.id} 
                    className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm hover:bg-white/90 hover:shadow-md transition-all duration-300"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg font-semibold text-gray-800 leading-tight">
                          {activity.name}
                        </CardTitle>
                        <Badge variant="secondary" className="ml-2 shrink-0">
                          {activity.type}
                        </Badge>
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
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">
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
                              <Heart className="h-3 w-3 mr-1 text-teal-500" />
                              {activity.average_heartrate} bpm
                              <Badge variant="outline" className="ml-1 text-xs border-teal-300 text-teal-600">
                                Run
                              </Badge>
                            </span>
                          </div>
                        )}
                        {!activity.is_run_activity && activity.has_heartrate && activity.average_heartrate && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Avg HR:</span>
                            <span className="font-medium flex items-center text-gray-500">
                              <Heart className="h-3 w-3 mr-1 text-gray-400" />
                              {activity.average_heartrate} bpm
                              <Badge variant="outline" className="ml-1 text-xs border-gray-300 text-gray-500">
                                Not tracked
                              </Badge>
                            </span>
                          </div>
                        )}
                        {/* Calories Display/Edit */}
                        <div className="flex justify-between">
                          <span className="text-gray-600">Calories:</span>
                          {editingCalories === activity.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={caloriesInput}
                                onChange={(e) => setCaloriesInput(e.target.value)}
                                className="w-16 h-6 text-sm border border-gray-300 rounded px-2 text-center"
                                placeholder={activity.calories?.toString() || "0"}
                                min="0"
                                max="9999"
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => {
                                  const newCalories = parseInt(caloriesInput) || 0;
                                  handleCalorieChange(activity.id, newCalories);
                                }}
                              >
                                <Check className="h-3 w-3 text-green-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => {
                                  setEditingCalories(null);
                                  setCaloriesInput('');
                                }}
                              >
                                <X className="h-3 w-3 text-red-600" />
                              </Button>
                            </div>
                          ) : (
                            <span className="font-medium flex items-center">
                              <Zap className="h-3 w-3 mr-1 text-green-500" />
                              {activity.calories !== undefined && activity.calories !== null ? (
                                <>
                                  {activity.calories > 0 ? activity.calories : '0'}
                                  <Badge variant="outline" className="ml-1 text-xs border-green-300 text-green-600">
                                    {activity.calorie_source === 'user_edited' ? 'Edited' : 'Strava'}
                                  </Badge>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 ml-1"
                                    onClick={() => {
                                      setEditingCalories(activity.id);
                                      setCaloriesInput(activity.calories.toString());
                                    }}
                                  >
                                    <Edit3 className="h-3 w-3 text-gray-500" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <span className="text-gray-400">No data</span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 ml-1"
                                    onClick={() => {
                                      setEditingCalories(activity.id);
                                      setCaloriesInput('');
                                    }}
                                  >
                                    <Edit3 className="h-3 w-3 text-gray-500" />
                                  </Button>
                                </>
                              )}
                            </span>
                          )}
                        </div>
                        {/* Run Type Tag - Mobile Optimized */}
                        {activity.is_run_activity && activity.run_tag && (
                          <div className="pt-2 border-t border-gray-100">
                            <div className="flex flex-col gap-2">
                              <span className="text-gray-600 text-xs">Run Type:</span>
                              {editingTag === activity.id ? (
                                <div className="flex items-center gap-2">
                                  <Select value={activity.run_tag} onValueChange={(value) => handleTagChange(activity.id, value as RunTag)}>
                                    <SelectTrigger className="w-full h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {RUN_TAG_OPTIONS.map(option => (
                                        <SelectItem key={option.value} value={option.value}>
                                          <span className={option.color}>{option.label}</span>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-8 w-8 p-0 shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingTag(null);
                                    }}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs cursor-pointer transition-all duration-200 w-fit ${getRunTagOption(activity.run_tag).color} ${getRunTagOption(activity.run_tag).bgColor} hover:bg-opacity-80`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingTag(activity.id);
                                  }}
                                >
                                  <Tag className="h-3 w-3 mr-1" />
                                  {getRunTagOption(activity.run_tag).label}
                                  <Edit3 className="h-3 w-3 ml-1 opacity-60" />
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* Summary Stats */}
            <section>
              <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
                    <BarChart3 className="h-5 w-5 mr-2 text-green-600" />
                    Activity Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="p-3 bg-white/60 rounded-lg text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {activities.filter(a => a.calories && a.calories > 0).length}
                      </div>
                      <div className="text-xs text-gray-600">Activities with calories</div>
                    </div>
                    <div className="p-3 bg-white/60 rounded-lg text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {activities.reduce((sum, a) => sum + (a.calories || 0), 0).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-600">Total calories (from Strava)</div>
                    </div>
                    <div className="p-3 bg-white/60 rounded-lg text-center">
                      <div className="text-2xl font-bold text-emerald-600">
                        {activities.filter(a => a.is_run_activity).length}
                      </div>
                      <div className="text-xs text-gray-600">Running activities</div>
                    </div>
                    <div className="p-3 bg-white/60 rounded-lg text-center">
                      <div className="text-2xl font-bold text-teal-600">
                        {activities.filter(a => a.is_run_activity && a.has_heartrate).length}
                      </div>
                      <div className="text-xs text-gray-600">Runs with HR data</div>
                    </div>
                  </div>
                  
                  {/* Run Tag Distribution */}
                  {activities.filter(a => a.is_run_activity).length > 0 && (
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                        <Tag className="h-4 w-4 mr-2" />
                        Run Type Distribution
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                        {RUN_TAG_OPTIONS.map(option => {
                          const count = activities.filter(a => a.is_run_activity && a.run_tag === option.value).length;
                          return (
                            <div key={option.value} className={`p-3 rounded-lg text-center ${option.bgColor}`}>
                              <div className={`text-lg font-bold ${option.color}`}>
                                {count}
                              </div>
                              <div className="text-xs text-gray-600">{option.label} runs</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Footer info */}
                  <div className="border-t pt-4 mt-4 text-center">
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {activities.length} total activities
                      </span>
                      <span className="flex items-center gap-1">
                        <Route className="h-4 w-4" />
                        View your running activities and performance metrics
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};

export default ActivityJam;
