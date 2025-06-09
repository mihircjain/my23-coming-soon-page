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
  calories?: number;
  caloriesBurned?: number;
}

const ActivityJam = () => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Chart refs
  const caloriesChartRef = useRef<HTMLCanvasElement>(null);
  const distanceChartRef = useRef<HTMLCanvasElement>(null);
  const weightTrainingChartRef = useRef<HTMLCanvasElement>(null);
  const heartRateChartRef = useRef<HTMLCanvasElement>(null);

  // Chart instances
  const chartInstances = useRef<{ [key: string]: Chart }>({});

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
          heartRateCount: 0,
          totalHeartRate: 0
        });
      }

      const dayData = dailyData.get(date);
      dayData.calories += activity.calories || activity.caloriesBurned || 0;
      dayData.distance += activity.distance || 0;
      
      // Weight training time
      if (activity.type?.toLowerCase().includes('weight') || 
          activity.type?.toLowerCase().includes('strength')) {
        dayData.weightTrainingTime += Math.round(activity.moving_time / 60); // Convert to minutes
      }

      // Heart rate
      if (activity.has_heartrate && activity.average_heartrate) {
        dayData.totalHeartRate += activity.average_heartrate;
        dayData.heartRateCount += 1;
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
      distance: dates.map(date => Math.round(dailyData.get(date).distance * 100) / 100), // Round to 2 decimals
      weightTraining: dates.map(date => dailyData.get(date).weightTrainingTime),
      heartRate: dates.map(date => {
        const dayData = dailyData.get(date);
        return dayData.heartRateCount > 0 ? Math.round(dayData.totalHeartRate / dayData.heartRateCount) : 0;
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

  // Create heart rate chart
  const createHeartRateChart = (chartData: any) => {
    if (!heartRateChartRef.current) return;

    const ctx = heartRateChartRef.current.getContext('2d');
    if (!ctx) return;

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(239, 68, 68, 0.8)');
    gradient.addColorStop(1, 'rgba(239, 68, 68, 0.1)');

    chartInstances.current.heartRate = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartData.displayLabels,
        datasets: [{
          label: 'Average Heart Rate (bpm)',
          data: chartData.heartRate,
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
              label: (context) => `${context.parsed.y} bpm`
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
      totalWeightTraining: chartData.weightTraining.reduce((a, b) => a + b, 0)
    });

    // Small delay to ensure refs are ready
    setTimeout(() => {
      createCaloriesChart(chartData);
      createDistanceChart(chartData);
      createWeightTrainingChart(chartData);
      createHeartRateChart(chartData);
    }, 100);
  };

  // Fetch activities
  const fetchActivities = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
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
      
      const response = await fetch(`/api/strava?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch activities: ${response.status}`);
      }

      const data = await response.json();
      
      // Process activities
      const processedActivities = data.map((activity: any) => ({
        id: activity.id?.toString() || Math.random().toString(),
        name: activity.name || 'Unnamed Activity',
        type: activity.type || 'Activity',
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
        calories: activity.calories || activity.caloriesBurned || 0,
        caloriesBurned: activity.caloriesBurned || activity.calories || 0
      }));

      const sortedActivities = processedActivities.sort((a: ActivityData, b: ActivityData) => 
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
      );

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

  // Load on mount
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
            {refreshing ? 'Refreshing...' : 'Refresh Data'}
          </Button>
        </div>
        
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-600 via-red-600 to-pink-600 bg-clip-text text-transparent">
            Activity Jam
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Your recent workouts and activities from Strava
          </p>
          {lastUpdate && (
            <p className="mt-1 text-sm text-gray-500">
              Last updated: {lastUpdate} • Showing last 30 days
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
              No activities found in the last 30 days. Try refreshing or check your Strava connection.
            </p>
            <Button onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh Activities'}
            </Button>
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
                      <Zap className="h-5 w-5 mr-2 text-amber-500" />
                      Calories Burned
                    </CardTitle>
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

                {/* Heart Rate Chart */}
                <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
                      <Heart className="h-5 w-5 mr-2 text-red-500" />
                      Average Heart Rate
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <canvas ref={heartRateChartRef} className="w-full h-full"></canvas>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Activities List Section */}
            <section>
              <div className="flex items-center mb-6">
                <Calendar className="h-6 w-6 mr-3 text-gray-600" />
                <h2 className="text-2xl font-semibold text-gray-800">Recent Activities</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activities.map((activity) => (
                  <Card key={activity.id} className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm hover:shadow-md transition-all duration-200">
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
                        {activity.has_heartrate && activity.average_heartrate && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Avg HR:</span>
                            <span className="font-medium flex items-center">
                              <Heart className="h-3 w-3 mr-1 text-red-500" />
                              {activity.average_heartrate} bpm
                            </span>
                          </div>
                        )}
                        {(activity.calories || activity.caloriesBurned) && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Calories:</span>
                            <span className="font-medium flex items-center">
                              <Zap className="h-3 w-3 mr-1 text-yellow-500" />
                              {activity.calories || activity.caloriesBurned}
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};

export default ActivityJam;
