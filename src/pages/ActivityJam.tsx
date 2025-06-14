// ActivityJam.tsx - OPTIMIZED for Fast Loading

import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, RefreshCw, Calendar, Clock, Zap, Heart, Activity, BarChart3, Tag, Edit3, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Lightweight chart component using CSS for visualization
const SimpleChart = ({ data, type = 'line', color = '#22c55e', label }) => {
  if (!data || data.length === 0) return null;
  
  const maxValue = Math.max(...data);
  const minValue = Math.min(...data);
  const range = maxValue - minValue || 1;
  
  return (
    <div className="h-64 flex flex-col">
      <div className="flex-1 flex items-end gap-1 px-2">
        {data.map((value, index) => {
          const height = ((value - minValue) / range) * 100;
          return (
            <div
              key={index}
              className="flex-1 flex flex-col justify-end"
              style={{ height: '100%' }}
            >
              <div
                className={`w-full rounded-t transition-all duration-300 ${
                  type === 'bar' ? 'bg-blue-500' : 'bg-green-500'
                }`}
                style={{ 
                  height: `${Math.max(height, 2)}%`,
                  backgroundColor: color
                }}
                title={`${label}: ${value}`}
              />
            </div>
          );
        })}
      </div>
      <div className="text-xs text-gray-500 text-center mt-2">
        Range: {minValue.toFixed(1)} - {maxValue.toFixed(1)}
      </div>
    </div>
  );
};

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
  is_run_activity: boolean;
  run_tag?: RunTag;
  fetched_at?: string;
}

const ActivityJam = () => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [editingTag, setEditingTag] = useState<string | null>(null);
  
  // Simplified chart data state
  const [chartData, setChartData] = useState<{
    calories: number[];
    distance: number[];
    heartRate: number[];
    labels: string[];
  } | null>(null);

  // OPTIMIZATION: Memoized chart data processing
  const processChartData = useCallback((activities: ActivityData[]) => {
    if (activities.length === 0) return null;

    // Sort activities by date
    const sortedActivities = [...activities].sort((a, b) => 
      new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    );

    // Group by date (limit to last 14 days for performance)
    const last14Days = sortedActivities.slice(-14);
    const dailyData = new Map();

    last14Days.forEach(activity => {
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
      dayData.calories += activity.calories || 0;
      dayData.distance += activity.distance || 0;
      
      // Heart rate ONLY from runs
      if (activity.is_run_activity && activity.has_heartrate && activity.average_heartrate) {
        dayData.heartRateTotal += activity.average_heartrate;
        dayData.heartRateCount += 1;
      }
    });

    // Convert to arrays
    const dates = Array.from(dailyData.keys()).sort();
    const labels = dates.map(date => new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    }));

    return {
      labels,
      calories: dates.map(date => dailyData.get(date).calories),
      distance: dates.map(date => Math.round(dailyData.get(date).distance * 10) / 10),
      heartRate: dates.map(date => {
        const dayData = dailyData.get(date);
        return dayData.heartRateCount > 0 ? Math.round(dayData.heartRateTotal / dayData.heartRateCount) : 0;
      })
    };
  }, []);

  // OPTIMIZATION: Save run tag with optimistic updates
  const saveRunTag = async (activityId: string, tag: RunTag) => {
    try {
      const response = await fetch('/api/run-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId,
          tag,
          userId: 'mihir_jain',
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save run tag');
      }

      return await response.json();
    } catch (error) {
      console.error('Error saving run tag:', error);
      throw error;
    }
  };

  // OPTIMIZATION: Optimistic tag update
  const handleTagChange = async (activityId: string, newTag: RunTag) => {
    // Update UI immediately (optimistic update)
    setActivities(prev => prev.map(activity => 
      activity.id === activityId 
        ? { ...activity, run_tag: newTag }
        : activity
    ));
    
    setEditingTag(null);
    
    try {
      await saveRunTag(activityId, newTag);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (error) {
      // Revert on error
      setActivities(prev => prev.map(activity => {
        if (activity.id === activityId) {
          const originalActivity = activities.find(a => a.id === activityId);
          return { ...activity, run_tag: originalActivity?.run_tag };
        }
        return activity;
      }));
      setError('Failed to save tag change. Please try again.');
    }
  };

  // Get run tag option
  const getRunTagOption = (tag: RunTag): RunTagOption => {
    return RUN_TAG_OPTIONS.find(option => option.value === tag) || RUN_TAG_OPTIONS[0];
  };

  // OPTIMIZATION: Use incremental loading strategy
  const fetchActivities = async (mode: 'quick' | 'today' | 'full' = 'quick') => {
    try {
      if (mode === 'full') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');
      
      const params = new URLSearchParams({
        userId: 'mihir_jain'
      });

      // OPTIMIZATION: Use different loading strategies
      if (mode === 'quick') {
        // Fast initial load - get cached data only
        params.set('mode', 'incremental');
        params.set('maxAge', '2'); // 2 hours cache
      } else if (mode === 'today') {
        // Refresh today's data only
        params.set('mode', 'incremental');
        params.set('refresh', 'true');
      } else {
        // Full refresh
        params.set('days', '30');
        params.set('refresh', 'true');
        params.set('preserveTags', 'true');
      }
      
      const apiUrl = `/api/strava?${params.toString()}`;
      console.log(`Making ${mode} API request to:`, apiUrl);
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch activities: ${response.status}`);
      }

      const data = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error('Invalid data format received from API');
      }
      
      // OPTIMIZATION: Process activities in batches for large datasets
      const processedActivities = data.map((activity: any) => {
        const activityType = activity.type || 'Activity';
        const isRun = activityType.toLowerCase().includes('run');

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
          is_run_activity: isRun,
          fetched_at: activity.fetched_at
        };

        if (isRun) {
          processedActivity.run_tag = activity.run_tag || activity.runType;
        }

        return processedActivity;
      });

      const sortedActivities = processedActivities.sort((a: ActivityData, b: ActivityData) => 
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
      );

      setActivities(sortedActivities);
      setLastUpdate(new Date().toLocaleTimeString());
      
      // OPTIMIZATION: Process charts asynchronously
      setTimeout(() => {
        const chartData = processChartData(sortedActivities);
        setChartData(chartData);
      }, 100);

    } catch (error) {
      console.error('Error fetching activities:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch activities');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // OPTIMIZATION: Different refresh strategies
  const handleRefreshToday = () => fetchActivities('today');
  const handleRefreshFull = () => fetchActivities('full');

  // OPTIMIZATION: Fast initial load on mount
  useEffect(() => {
    fetchActivities('quick');
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

  // OPTIMIZATION: Loading state with progressive disclosure
  if (loading && activities.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
        <header className="pt-8 px-6 md:px-12">
          <div className="flex items-center justify-between mb-6">
            <Button onClick={() => navigate('/')} variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading activities...
            </div>
          </div>
          
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-green-600 via-blue-600 to-teal-600 bg-clip-text text-transparent">
              Activity Jam
            </h1>
            <p className="mt-3 text-lg text-gray-600">
              Loading your recent workouts and activities...
            </p>
          </div>
        </header>
        
        <main className="px-6 md:px-12 py-8">
          {/* Quick loading skeletons */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="bg-white/80 backdrop-blur-sm">
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
        </main>
      </div>
    );
  }

  if (error && activities.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex flex-col">
        <header className="pt-8 px-6 md:px-12">
          <div className="flex items-center justify-between mb-6">
            <Button onClick={() => navigate('/')} variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
            <Button onClick={handleRefreshFull} variant="outline" disabled={refreshing}>
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
              <Button onClick={handleRefreshFull} disabled={refreshing}>
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-green-400/10 to-blue-400/10"></div>
      <div className="absolute top-20 left-20 w-32 h-32 bg-green-200/30 rounded-full blur-xl"></div>
      <div className="absolute bottom-20 right-20 w-24 h-24 bg-blue-200/30 rounded-full blur-xl"></div>
      
      {/* Header */}
      <header className="relative z-10 pt-8 px-6 md:px-12">
        <div className="flex items-center justify-between mb-6">
          <Button onClick={() => navigate('/')} variant="ghost" className="hover:bg-white/20">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
          
          <div className="flex items-center gap-2">
            <Button 
              onClick={handleRefreshToday}
              variant="outline"
              disabled={refreshing}
              size="sm"
              className="hover:bg-white/20"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Today
            </Button>
            
            <Button 
              onClick={handleRefreshFull}
              variant="outline"
              disabled={refreshing}
              size="sm"
              className="hover:bg-white/20"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Full Refresh
            </Button>
          </div>
        </div>
        
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-green-600 via-blue-600 to-teal-600 bg-clip-text text-transparent">
            Activity Jam
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Your recent workouts and activities with fast loading
          </p>
          {lastUpdate && (
            <p className="mt-1 text-sm text-gray-500">
              Last updated: {lastUpdate} • 
              {activities.length > 0 && (
                <span className="ml-1">
                  {activities.length} activities • 
                  {activities.filter(a => a.is_run_activity).length} runs
                </span>
              )}
            </p>
          )}
          {refreshing && (
            <div className="mt-2 flex items-center justify-center gap-2 text-blue-600">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="text-sm">Refreshing activities...</span>
            </div>
          )}
        </div>
      </header>
      
      {/* Main content */}
      <main className="relative z-10 px-6 md:px-12 py-8">
        {activities.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Calendar className="h-16 w-16 mx-auto" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Recent Activities</h3>
            <p className="text-gray-600 mb-4">
              No activities found. Try a full refresh to load recent data.
            </p>
            <Button onClick={handleRefreshFull} disabled={refreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh Activities'}
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Lightweight Charts Section */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <BarChart3 className="h-6 w-6 mr-3 text-gray-600" />
                  <h2 className="text-2xl font-semibold text-gray-800">Activity Trends</h2>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className={`w-2 h-2 rounded-full ${chartData ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                  <span>{chartData ? 'Charts ready' : 'Loading charts...'}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Lightweight Calories Chart */}
                <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
                      <Zap className="h-5 w-5 mr-2 text-green-500" />
                      Calories Burned
                    </CardTitle>
                    <p className="text-xs text-gray-600">Last 14 days</p>
                  </CardHeader>
                  <CardContent>
                    {chartData ? (
                      <SimpleChart 
                        data={chartData.calories} 
                        type="line" 
                        color="#22c55e"
                        label="Calories"
                      />
                    ) : (
                      <div className="h-64 flex items-center justify-center">
                        <div className="text-gray-400">
                          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                          <p className="text-sm">Loading...</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Lightweight Distance Chart */}
                <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
                      <Activity className="h-5 w-5 mr-2 text-blue-500" />
                      Distance (km)
                    </CardTitle>
                    <p className="text-xs text-gray-600">Last 14 days</p>
                  </CardHeader>
                  <CardContent>
                    {chartData ? (
                      <SimpleChart 
                        data={chartData.distance} 
                        type="bar" 
                        color="#3b82f6"
                        label="Distance"
                      />
                    ) : (
                      <div className="h-64 flex items-center justify-center">
                        <div className="text-gray-400">
                          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                          <p className="text-sm">Loading...</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Lightweight Heart Rate Chart */}
                <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
                      <Heart className="h-5 w-5 mr-2 text-teal-500" />
                      Run Heart Rate
                    </CardTitle>
                    <p className="text-xs text-gray-600">Running activities only</p>
                  </CardHeader>
                  <CardContent>
                    {chartData ? (
                      <SimpleChart 
                        data={chartData.heartRate.filter(hr => hr > 0)} 
                        type="line" 
                        color="#14b8a6"
                        label="Heart Rate"
                      />
                    ) : (
                      <div className="h-64 flex items-center justify-center">
                        <div className="text-gray-400">
                          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                          <p className="text-sm">Loading...</p>
                        </div>
                      </div>
                    )}
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
                <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-green-600 mb-1">
                      {activities.reduce((sum, a) => sum + (a.calories || 0), 0).toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Total Calories</div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-blue-600 mb-1">
                      {Math.round(activities.reduce((sum, a) => sum + a.distance, 0) * 10) / 10}
                    </div>
                    <div className="text-sm text-gray-600">Total Distance (km)</div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-teal-50 to-teal-100 border-teal-200">
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-teal-600 mb-1">
                      {activities.filter(a => a.is_run_activity).length}
                    </div>
                    <div className="text-sm text-gray-600">Running Activities</div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-emerald-50 to-emerald-100 border-emerald-200">
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-emerald-600 mb-1">
                      {activities.length}
                    </div>
                    <div className="text-sm text-gray-600">Total Activities</div>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Activities List */}
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
                            </span>
                          </div>
                        )}
                        {activity.calories && activity.calories > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Calories:</span>
                            <span className="font-medium flex items-center">
                              <Zap className="h-3 w-3 mr-1 text-green-500" />
                              {activity.calories}
                            </span>
                          </div>
                        )}
                        {/* Run Type Tag */}
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
                    Activity Summary with Fast Loading
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
                      <div className="text-xs text-gray-600">Total calories burned</div>
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
            <span>⚡ Optimized for fast loading</span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <Tag className="h-4 w-4" />
              Smart run tagging with quick editing
            </span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <Heart className="h-4 w-4" />
              Lightweight charts and caching
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>Activities: {activities.length}</span>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${chartData ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
              <span className="text-xs">{chartData ? 'Charts Ready' : 'Loading Charts'}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ActivityJam;
