// Enhanced ActivityJam.tsx with run tagging and optimized data fetching

import { useState, useEffect, useRef } from "react";
import { ArrowLeft, RefreshCw, Calendar, Clock, Zap, Heart, Activity, BarChart3, Tag, Edit3, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Chart from 'chart.js/auto';

// Run tag types
type RunTag = 'easy' | 'tempo' | 'long' | 'recovery' | 'intervals';

interface RunTagOption {
  value: RunTag;
  label: string;
  color: string;
  bgColor: string;
}

const RUN_TAG_OPTIONS: RunTagOption[] = [
  { value: 'easy', label: 'Easy', color: 'text-green-600', bgColor: 'bg-green-50 border-green-200' },
  { value: 'tempo', label: 'Tempo', color: 'text-orange-600', bgColor: 'bg-orange-50 border-orange-200' },
  { value: 'long', label: 'Long', color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200' },
  { value: 'recovery', label: 'Recovery', color: 'text-purple-600', bgColor: 'bg-purple-50 border-purple-200' },
  { value: 'intervals', label: 'Intervals', color: 'text-red-600', bgColor: 'bg-red-50 border-red-200' }
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
  is_run_activity: boolean;
  run_tag?: RunTag; // New field for run tagging
}

const ActivityJam = () => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [editingTag, setEditingTag] = useState<string | null>(null);

  // Chart refs
  const caloriesChartRef = useRef<HTMLCanvasElement>(null);
  const distanceChartRef = useRef<HTMLCanvasElement>(null);
  const weightTrainingChartRef = useRef<HTMLCanvasElement>(null);
  const heartRateRunsChartRef = useRef<HTMLCanvasElement>(null);

  // Chart instances
  const chartInstances = useRef<{ [key: string]: Chart }>({});

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

    // Long run detection (distance-based)
    if (distance >= 15) return 'long';
    if (distance >= 10 && paceMinPerKm > 5.5) return 'long';

    // Recovery run detection (very easy pace or low HR)
    if (distance <= 5 && paceMinPerKm > 6.5) return 'recovery';
    if (avgHR && avgHR < 140 && distance <= 8) return 'recovery';

    // Intervals detection (fast pace with moderate distance)
    if (paceMinPerKm < 4.0 && distance <= 10) return 'intervals';
    if (avgHR && avgHR > 170 && distance <= 8) return 'intervals';

    // Tempo detection (moderately fast pace, moderate distance)
    if (paceMinPerKm < 5.0 && distance >= 5 && distance <= 12) return 'tempo';
    if (avgHR && avgHR >= 155 && avgHR <= 170 && distance >= 5) return 'tempo';

    // Default to easy
    return 'easy';
  };

  // Load run tags from Firestore
  const loadRunTags = async (activityIds: string[]) => {
    try {
      const response = await fetch('/api/run-tags', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load run tags');
      }

      const data = await response.json();
      console.log('📥 Loaded run tags from API:', data);
      return data;
    } catch (error) {
      console.error('❌ Error loading run tags:', error);
      return {};
    }
  };

  // Save run tag to Firestore
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

  // Handle tag change with improved error handling and state management
  const handleTagChange = async (activityId: string, newTag: RunTag) => {
    console.log(`🏷️ Changing tag for ${activityId}: ${newTag}`);
    
    try {
      // Update local state immediately for responsive UI
      setActivities(prev => prev.map(activity => 
        activity.id === activityId 
          ? { ...activity, run_tag: newTag }
          : activity
      ));

      // Save to Firestore
      await saveRunTag(activityId, newTag);
      
      console.log(`✅ Tag change completed for ${activityId}: ${newTag}`);
      
      // Exit editing mode
      setEditingTag(null);
      
      // Show success feedback
      setLastUpdate(new Date().toLocaleTimeString());
      
    } catch (error) {
      console.error('❌ Failed to save tag change:', error);
      
      // Revert local state on error
      setActivities(prev => prev.map(activity => {
        if (activity.id === activityId) {
          // Find the original tag from when we loaded the data
          const originalActivity = activities.find(a => a.id === activityId);
          return { ...activity, run_tag: originalActivity?.run_tag };
        }
        return activity;
      }));
      
      setError('Failed to save tag change. Please try again.');
      setEditingTag(null);
    }
  };

  // Get run tag option
  const getRunTagOption = (tag: RunTag): RunTagOption => {
    return RUN_TAG_OPTIONS.find(option => option.value === tag) || RUN_TAG_OPTIONS[0];
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

  // Create calories chart
  const createCaloriesChart = (chartData: any) => {
    if (!caloriesChartRef.current) return;

    const ctx = caloriesChartRef.current.getContext('2d');
    if (!ctx) return;

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(245, 158, 11, 0.8)');
    gradient.addColorStop(1, 'rgba(245, 158, 11, 0.1)');

    chartInstances.current.calories = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartData.displayLabels,
        datasets: [{
          label: 'Calories Burned',
          data: chartData.calories,
          borderColor: 'rgba(245, 158, 11, 1)',
          backgroundColor: gradient,
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: 'rgba(245, 158, 11, 1)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            titleColor: '#374151',
            bodyColor: '#374151',
            borderColor: '#e5e7eb',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            displayColors: false,
            callbacks: {
              label: (context) => `${context.parsed.y} calories`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              maxTicksLimit: 6,
              color: '#6b7280'
            }
          },
          y: {
            grid: { color: 'rgba(156, 163, 175, 0.2)' },
            border: { display: false },
            beginAtZero: true,
            ticks: { color: '#6b7280' }
          }
        }
      }
    });
  };

  // Create distance chart
  const createDistanceChart = (chartData: any) => {
    if (!distanceChartRef.current) return;

    const ctx = distanceChartRef.current.getContext('2d');
    if (!ctx) return;

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.8)');

    chartInstances.current.distance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: chartData.displayLabels,
        datasets: [{
          label: 'Distance (km)',
          data: chartData.distance,
          backgroundColor: gradient,
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 0,
          borderRadius: 4,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            titleColor: '#374151',
            bodyColor: '#374151',
            borderColor: '#e5e7eb',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            displayColors: false,
            callbacks: {
              label: (context) => `${context.parsed.y} km`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              maxTicksLimit: 6,
              color: '#6b7280'
            }
          },
          y: {
            grid: { color: 'rgba(156, 163, 175, 0.2)' },
            border: { display: false },
            beginAtZero: true,
            ticks: { color: '#6b7280' }
          }
        }
      }
    });
  };

  // Create weight training chart
  const createWeightTrainingChart = (chartData: any) => {
    if (!weightTrainingChartRef.current) return;

    const ctx = weightTrainingChartRef.current.getContext('2d');
    if (!ctx) return;

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(139, 92, 246, 0.8)');
    gradient.addColorStop(1, 'rgba(139, 92, 246, 0.1)');

    chartInstances.current.weightTraining = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartData.displayLabels,
        datasets: [{
          label: 'Weight Training (minutes)',
          data: chartData.weightTraining,
          borderColor: 'rgba(139, 92, 246, 1)',
          backgroundColor: gradient,
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: 'rgba(139, 92, 246, 1)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            titleColor: '#374151',
            bodyColor: '#374151',
            borderColor: '#e5e7eb',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            displayColors: false,
            callbacks: {
              label: (context) => `${context.parsed.y} minutes`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              maxTicksLimit: 6,
              color: '#6b7280'
            }
          },
          y: {
            grid: { color: 'rgba(156, 163, 175, 0.2)' },
            border: { display: false },
            beginAtZero: true,
            ticks: { color: '#6b7280' }
          }
        }
      }
    });
  };

  // Create run heart rate chart
  const createRunHeartRateChart = (chartData: any) => {
    if (!heartRateRunsChartRef.current) return;

    const ctx = heartRateRunsChartRef.current.getContext('2d');
    if (!ctx) return;

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(239, 68, 68, 0.8)');
    gradient.addColorStop(1, 'rgba(239, 68, 68, 0.1)');

    chartInstances.current.runHeartRate = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartData.displayLabels,
        datasets: [{
          label: 'Run Heart Rate (bpm)',
          data: chartData.runHeartRate,
          borderColor: 'rgba(239, 68, 68, 1)',
          backgroundColor: gradient,
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: 'rgba(239, 68, 68, 1)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            titleColor: '#374151',
            bodyColor: '#374151',
            borderColor: '#e5e7eb',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            displayColors: false,
            callbacks: {
              label: (context) => `${context.parsed.y} bpm (runs only)`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              maxTicksLimit: 6,
              color: '#6b7280'
            }
          },
          y: {
            grid: { color: 'rgba(156, 163, 175, 0.2)' },
            border: { display: false },
            beginAtZero: false,
            ticks: { color: '#6b7280' }
          }
        }
      }
    });
  };

  // Create all charts
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
    }, 100);
  };

  // Optimized fetch activities - only today's data unless refreshing
  const fetchActivities = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');
      
      const params = new URLSearchParams({
        userId: 'mihir_jain'
      });

      // If refreshing, get all 30 days. Otherwise, only get today's data + cached data
      if (forceRefresh) {
        params.set('days', '30');
        params.set('refresh', 'true');
        params.set('timestamp', Date.now().toString());
        console.log('🔄 Full refresh - fetching all 30 days from Strava');
      } else {
        params.set('mode', 'incremental'); // Only today's data
        console.log('⚡ Incremental load - fetching only today\'s data');
      }
      
      const apiUrl = `/api/strava?${params.toString()}`;
      console.log('📡 Making API request to:', apiUrl);
      
      const response = await fetch(apiUrl);
      
      console.log('📡 API Response status:', response.status);
      console.log('📡 API Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);
        throw new Error(`Failed to fetch activities: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('📊 Raw API data received:', data);
      console.log('📊 Data length:', data?.length);
      
      if (!Array.isArray(data)) {
        console.error('❌ Expected array but got:', typeof data, data);
        throw new Error('Invalid data format received from API');
      }
      
      // Process activities with run tagging
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

        // Set run tag from API data (prioritize saved tags over auto-tags)
        if (isRun) {
          // Check if the activity already has a saved tag from the API
          processedActivity.run_tag = activity.run_tag || activity.runType || autoTagRun(processedActivity);
        }

        return processedActivity;
      });

      const sortedActivities = processedActivities.sort((a: ActivityData, b: ActivityData) => 
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
      );

      // Load existing run tags from Firestore and apply them
      const runActivities = sortedActivities.filter(a => a.is_run_activity);
      if (runActivities.length > 0) {
        console.log(`🏷️ Loading saved tags for ${runActivities.length} run activities`);
        const savedTags = await loadRunTags(runActivities.map(a => a.id));
        
        // Apply saved tags to activities
        sortedActivities.forEach(activity => {
          if (activity.is_run_activity && savedTags[activity.id]) {
            const savedTag = savedTags[activity.id];
            console.log(`🔄 Applying saved tag for ${activity.id}: ${activity.run_tag} -> ${savedTag}`);
            activity.run_tag = savedTag;
          }
        });
        
        console.log('📊 Tag application summary:', {
          totalRuns: runActivities.length,
          savedTags: Object.keys(savedTags).length,
          appliedTags: sortedActivities.filter(a => a.is_run_activity && a.run_tag).length
        });
      }

      console.log('🏃 Activity processing summary:', {
        totalActivities: sortedActivities.length,
        runActivities: sortedActivities.filter(a => a.is_run_activity).length,
        runActivitiesWithHR: sortedActivities.filter(a => a.is_run_activity && a.has_heartrate && a.average_heartrate).length,
        activitiesWithCalories: sortedActivities.filter(a => a.calories && a.calories > 0).length,
        totalCalories: sortedActivities.reduce((sum, a) => sum + (a.calories || 0), 0),
        taggedRuns: sortedActivities.filter(a => a.is_run_activity && a.run_tag).length
      });

      setActivities(sortedActivities);
      setLastUpdate(new Date().toLocaleTimeString());

      // Create charts after activities are set
      createCharts(sortedActivities);

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

  // Load on mount - incremental by default
  useEffect(() => {
    fetchActivities(false);
    
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
          
          <Button 
            onClick={handleRefresh}
            variant="outline"
            disabled={refreshing}
            className="hover:bg-white/20"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Full Refresh...' : 'Full Refresh (30 days)'}
          </Button>
        </div>
        
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-600 via-red-600 to-pink-600 bg-clip-text text-transparent">
            Activity Jam
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Your recent workouts and activities from Strava with smart run tagging
          </p>
          {lastUpdate && (
            <p className="mt-1 text-sm text-gray-500">
              Last updated: {lastUpdate} • Fast incremental loading • Auto-tagged runs
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
              No activities found in recent data. Try a full refresh to load all 30 days.
            </p>
            <Button onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Loading all activities...' : 'Full Refresh (30 days)'}
            </Button>
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {/* Charts Section */}
            <section>
              <div className="flex items-center mb-6">
                <BarChart3 className="h-6 w-6 mr-3 text-gray-600" />
                <h2 className="text-2xl font-semibold text-gray-800">Activity Trends</h2>
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

            {/* Activities List Section */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <Calendar className="h-6 w-6 mr-3 text-gray-600" />
                  <h2 className="text-2xl font-semibold text-gray-800">Recent Activities</h2>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Tag className="h-4 w-4" />
                    <span>Click run tags to edit</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {RUN_TAG_OPTIONS.slice(0, 3).map(option => (
                      <Badge key={option.value} variant="outline" className={`text-xs ${option.color} ${option.bgColor}`}>
                        {option.label}
                      </Badge>
                    ))}
                    <span className="text-gray-500">...</span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activities.map((activity) => (
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
                      
                      {/* No extra badges under header - keeping it clean */}
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
                        {/* Run Type Tag - Below Calories */}
                        {activity.is_run_activity && activity.run_tag && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Run Type:</span>
                            <div className="flex items-center">
                              {editingTag === activity.id ? (
                                <div className="flex items-center gap-2">
                                  <Select value={activity.run_tag} onValueChange={(value) => handleTagChange(activity.id, value as RunTag)}>
                                    <SelectTrigger className="w-24 h-6 text-xs">
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
                                    className="h-6 w-6 p-0"
                                    onClick={() => setEditingTag(null)}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs cursor-pointer transition-all duration-200 ${getRunTagOption(activity.run_tag).color} ${getRunTagOption(activity.run_tag).bgColor} hover:bg-opacity-80`}
                                  onClick={() => setEditingTag(activity.id)}
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
                    Activity Summary with Run Analysis
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
                      <div className="text-2xl font-bold text-orange-600">
                        {activities.reduce((sum, a) => sum + (a.calories || 0), 0).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-600">Total calories burned</div>
                    </div>
                    <div className="p-3 bg-white/60 rounded-lg text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {activities.filter(a => a.is_run_activity).length}
                      </div>
                      <div className="text-xs text-gray-600">Running activities</div>
                    </div>
                    <div className="p-3 bg-white/60 rounded-lg text-center">
                      <div className="text-2xl font-bold text-red-600">
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
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
            <span>⚡ Fast incremental loading</span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <Tag className="h-4 w-4" />
              Auto-tagged runs with manual editing
            </span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <Heart className="h-4 w-4" />
              HR from runs only for accuracy
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>Updated: {new Date().toLocaleDateString()}</span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs">Enhanced</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ActivityJam;
