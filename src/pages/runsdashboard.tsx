import { useState, useEffect, useRef } from "react";
import { ArrowLeft, RefreshCw, MapPin, Clock, Zap, Heart, Activity, BarChart3, Target, Gauge, Mountain, Footprints, Calendar, TrendingUp, Award, Timer, Trophy, Zap as Shoe, Thermometer, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Chart from 'chart.js/auto';

// Run data interface with comprehensive fields
interface RunData {
  id: string;
  name: string;
  start_date: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  average_speed: number;
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  calories?: number;
  average_cadence?: number;
  max_cadence?: number;
  workout_type?: number;
  gear_id?: string;
  temperature?: number;
  description?: string;
  polyline?: string;
  splits_metric?: Array<{
    distance: number;
    elapsed_time: number;
    elevation_difference: number;
    moving_time: number;
    split: number;
    average_speed: number;
    pace_zone?: number;
    average_heartrate?: number;
  }>;
  laps?: Array<{
    name: string;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    average_speed: number;
    max_speed: number;
    average_heartrate?: number;
    max_heartrate?: number;
    total_elevation_gain: number;
  }>;
  best_efforts?: Array<{
    name: string;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    start_date_local: string;
    achievements?: any[];
  }>;
  gear?: {
    id: string;
    name: string;
    distance_km: number;
    brand_name?: string;
    model_name?: string;
    primary?: boolean;
  };
  fetched_at: string;
  has_detailed_data: boolean;
  has_streams?: boolean;
  streams_summary?: any;
}

const RunsDashboard = () => {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<RunData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>('');
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [selectedRun, setSelectedRun] = useState<RunData | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Chart refs
  const paceChartRef = useRef<HTMLCanvasElement>(null);
  const splitsChartRef = useRef<HTMLCanvasElement>(null);
  const weeklyAnalyticsRef = useRef<HTMLCanvasElement>(null);

  // Chart instances
  const chartInstances = useRef<{ [key: string]: Chart | null }>({});

  // Destroy charts helper
  const destroyCharts = () => {
    Object.values(chartInstances.current).forEach(chart => {
      if (chart) chart.destroy();
    });
    chartInstances.current = {};
  };

  // Format functions
  const formatTime = (seconds: number) => {
    if (!seconds) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return hours > 0 ? `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}` 
                     : `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPace = (distance: number, time: number) => {
    if (distance === 0 || time === 0) return 'N/A';
    // If distance is already in km, don't convert again
    const distanceKm = distance > 100 ? distance / 1000 : distance;
    const paceSeconds = time / distanceKm;
    const minutes = Math.floor(paceSeconds / 60);
    const seconds = Math.floor(paceSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  };

  const formatDistance = (distance: number) => {
    if (distance === 0) return '0.00';
    // Convert meters to kilometers
    const km = distance / 1000;
    if (km < 0.1) return km.toFixed(3);
    return km.toFixed(2);
  };

  const formatSpeed = (speed: number) => {
    if (!speed) return 'N/A';
    return (speed * 3.6).toFixed(1); // Convert m/s to km/h
  };

  // Create analytics charts
  const createAnalyticsCharts = () => {
    if (!weeklyAnalyticsRef.current || runs.length === 0) return;

    const ctx = weeklyAnalyticsRef.current.getContext('2d');
    if (!ctx) return;

    if (chartInstances.current.analytics) {
      chartInstances.current.analytics.destroy();
    }

    // Prepare data
    const labels = runs.map((run, index) => `Run ${runs.length - index}`).reverse();
    const distances = runs.map(run => run.distance / 1000).reverse(); // convert to km
    const paces = runs.map(run => run.moving_time / (run.distance / 1000) / 60).reverse(); // min/km
    const heartRates = runs.map(run => run.average_heartrate || 0).reverse();

    chartInstances.current.analytics = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Distance (km)',
            data: distances,
            borderColor: 'rgb(34, 197, 94)',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            yAxisID: 'y',
            tension: 0.4
          },
          {
            label: 'Pace (min/km)',
            data: paces,
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            yAxisID: 'y1',
            tension: 0.4
          },
          {
            label: 'Heart Rate (bpm)',
            data: heartRates,
            borderColor: 'rgb(239, 68, 68)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            yAxisID: 'y2',
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: { display: true, text: 'Distance (km)' }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: { display: true, text: 'Pace (min/km)' },
            grid: { drawOnChartArea: false }
          },
          y2: {
            type: 'linear',
            display: false,
            position: 'right'
          }
        }
      }
    });
  };

  // Create splits chart for selected run
  const createSplitsChart = (run: RunData) => {
    if (!splitsChartRef.current || !run.splits_metric) return;

    const ctx = splitsChartRef.current.getContext('2d');
    if (!ctx) return;

    if (chartInstances.current.splits) {
      chartInstances.current.splits.destroy();
    }

    const splits = run.splits_metric;
    const labels = splits.map((_, index) => `${index + 1} km`);
    const paceData = splits.map(split => split.moving_time / 60); // minutes per km
    const hrData = splits.map(split => split.average_heartrate || 0);

    chartInstances.current.splits = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Pace (min/km)',
            data: paceData,
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            yAxisID: 'y',
            tension: 0.4
          },
          {
            label: 'Heart Rate (bpm)',
            data: hrData,
            borderColor: 'rgb(239, 68, 68)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            yAxisID: 'y1',
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: { display: true, text: 'Pace (min/km)' }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: { display: true, text: 'Heart Rate (bpm)' },
            grid: { drawOnChartArea: false }
          }
        }
      }
    });
  };

  // Create weekly distance chart
  const createWeeklyChart = () => {
    if (!paceChartRef.current || runs.length === 0) return;

    const ctx = paceChartRef.current.getContext('2d');
    if (!ctx) return;

    if (chartInstances.current.weekly) {
      chartInstances.current.weekly.destroy();
    }

    // Group runs by day for last week
    const dailyData = new Map();
    
    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayKey = date.toISOString().split('T')[0];
      dailyData.set(dayKey, { distance: 0, runs: 0 });
    }

    runs.forEach(run => {
      const runDate = run.start_date.split('T')[0];
      if (dailyData.has(runDate)) {
        const day = dailyData.get(runDate);
        day.distance += run.distance / 1000; // convert to km
        day.runs += 1;
      }
    });

    const days = Array.from(dailyData.keys()).sort();
    const distances = days.map(day => dailyData.get(day).distance);
    const labels = days.map(day => {
      const date = new Date(day + 'T00:00:00'); // Add time to prevent timezone issues
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    });

    chartInstances.current.weekly = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Daily Distance (km)',
          data: distances,
          backgroundColor: 'rgba(34, 197, 94, 0.8)',
          borderColor: 'rgb(34, 197, 94)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Distance (km)' } }
        }
      }
    });
  };

  // Calculate analytics
  const calculateAnalytics = () => {
    if (runs.length === 0) return null;

    const totalDistance = runs.reduce((sum, run) => sum + run.distance, 0); // in meters
    const totalTime = runs.reduce((sum, run) => sum + run.moving_time, 0);
    const avgPace = totalTime / (totalDistance / 1000) / 60; // min/km
    
    const heartRates = runs.filter(run => run.average_heartrate).map(run => run.average_heartrate!);
    const avgHeartRate = heartRates.length > 0 ? Math.round(heartRates.reduce((sum, hr) => sum + hr, 0) / heartRates.length) : 0;
    
    const totalSplits = runs.reduce((sum, run) => sum + (run.splits_metric?.length || 0), 0);
    const totalPRs = runs.reduce((sum, run) => sum + (run.best_efforts?.length || 0), 0);
    const totalLaps = runs.reduce((sum, run) => sum + (run.laps?.length || 0), 0);
    
    const gear = runs.find(run => run.gear)?.gear;
    
    return {
      totalDistance: totalDistance / 1000, // convert to km for display
      totalTime,
      avgPace,
      avgHeartRate,
      totalSplits,
      totalPRs,
      totalLaps,
      gear,
      runsWithStreams: runs.filter(run => run.has_streams).length
    };
  };

  // Fetch runs from API (last 7 days by default)
  const fetchRuns = async (forceRefresh = false) => {
    try {
      setError('');
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const params = new URLSearchParams({
        userId: 'mihir_jain',
        detailed: 'true',
        days: '7' // Get last 7 days
      });

      if (forceRefresh) {
        params.set('refresh', 'true');
        params.set('timestamp', Date.now().toString());
      }

      console.log('🔄 Fetching runs from last 7 days...');
      const response = await fetch(`/api/runs?${params.toString()}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', errorText);
        throw new Error(`Failed to fetch runs: ${response.status}`);
      }

      const data = await response.json();
      console.log('📊 Runs data received:', data?.length, 'runs');

      if (!Array.isArray(data)) {
        throw new Error('Invalid data format received from API');
      }

      const processedRuns = data.map((run: any) => ({
        id: run.id?.toString() || Math.random().toString(),
        name: run.name || 'Unnamed Run',
        start_date: run.start_date,
        distance: run.distance || 0, // Keep in meters, convert in display
        moving_time: run.moving_time || 0,
        elapsed_time: run.elapsed_time || 0,
        total_elevation_gain: run.total_elevation_gain || 0,
        average_speed: run.average_speed || 0,
        max_speed: run.max_speed || 0,
        average_heartrate: run.average_heartrate,
        max_heartrate: run.max_heartrate,
        calories: run.calories,
        average_cadence: run.average_cadence,
        max_cadence: run.max_cadence,
        workout_type: run.workout_type,
        gear_id: run.gear_id,
        temperature: run.temperature,
        description: run.description,
        splits_metric: run.splits_metric,
        laps: run.laps,
        best_efforts: run.best_efforts,
        gear: run.gear,
        fetched_at: run.fetched_at || new Date().toISOString(),
        has_detailed_data: run.has_detailed_data || false,
        has_streams: run.has_streams || false,
        streams_summary: run.streams_summary
      }));

      const sortedRuns = processedRuns.sort((a: RunData, b: RunData) => 
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
      );

      setRuns(sortedRuns);
      setLastUpdate(new Date().toLocaleTimeString());
      
      console.log(`✅ Loaded ${sortedRuns.length} runs from last 7 days`);
      
      // Create charts after data is loaded
      setTimeout(() => {
        createWeeklyChart();
        createAnalyticsCharts();
      }, 100);

    } catch (error) {
      console.error('❌ Error fetching runs:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch runs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Select run and create detailed charts
  const selectRun = (run: RunData) => {
    setSelectedRun(run);
    setActiveTab("details");
    setTimeout(() => {
      if (run.splits_metric) {
        createSplitsChart(run);
      }
    }, 100);
  };

  useEffect(() => {
    fetchRuns();
    return () => destroyCharts();
  }, []);

  const analytics = calculateAnalytics();

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex flex-col">
        <header className="pt-8 px-6 md:px-12">
          <div className="flex items-center justify-between mb-6">
            <Button onClick={() => navigate('/')} variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
            <Button onClick={() => fetchRuns(true)} variant="outline" disabled={refreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Try Again
            </Button>
          </div>
        </header>
        
        <main className="flex-grow flex items-center justify-center px-6">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 text-center">
              <div className="text-red-500 mb-4">⚠️</div>
              <h3 className="text-lg font-semibold mb-2">Unable to Load Runs</h3>
              <p className="text-gray-600 text-sm mb-4">{error}</p>
              <Button onClick={() => fetchRuns(true)} disabled={refreshing}>
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 to-green-400/10 animate-pulse"></div>
      <div className="absolute top-20 left-20 w-32 h-32 bg-blue-200/30 rounded-full blur-xl animate-bounce"></div>
      <div className="absolute bottom-20 right-20 w-24 h-24 bg-green-200/30 rounded-full blur-xl animate-bounce delay-1000"></div>
      
      {/* Header */}
      <header className="relative z-10 pt-8 px-6 md:px-12">
        <div className="flex items-center justify-between mb-6">
          <Button onClick={() => navigate('/')} variant="ghost" className="hover:bg-white/20">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
          
          <Button 
            onClick={() => fetchRuns(true)}
            variant="outline"
            disabled={refreshing}
            className="hover:bg-white/20"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Runs'}
          </Button>
        </div>
        
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 via-green-600 to-teal-600 bg-clip-text text-transparent">
            🏃‍♂️ Last 7 Days Runs
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Detailed analysis of your running activities from the last 7 days
          </p>
          {lastUpdate && (
            <p className="mt-1 text-sm text-gray-500">
              Last updated: {lastUpdate} • {runs.length} runs from last 7 days
            </p>
          )}
        </div>
      </header>
      
      {/* Main content */}
      <main className="relative z-10 px-6 md:px-12 py-8">
        {loading ? (
          <div className="space-y-8">
            {/* Stats skeletons */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="bg-white/80 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <Skeleton className="h-8 w-16 mb-2" />
                    <Skeleton className="h-4 w-20" />
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {/* Chart skeleton */}
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
            
            {/* Run card skeletons */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="bg-white/80 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <Skeleton className="h-6 w-3/4 mb-4" />
                    <div className="grid grid-cols-3 gap-4">
                      {[...Array(3)].map((_, j) => (
                        <div key={j}>
                          <Skeleton className="h-8 w-full mb-1" />
                          <Skeleton className="h-3 w-full" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Footprints className="h-16 w-16 mx-auto" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Runs Found</h3>
            <p className="text-gray-600 mb-4">
              No running activities found from last week. Try refreshing or check if you have runs recorded in Strava.
            </p>
            <Button onClick={() => fetchRuns(true)} disabled={refreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh Runs'}
            </Button>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="details">Run Details</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-8">
              {/* Quick Stats */}
              <section>
                <div className="flex items-center mb-6">
                  <BarChart3 className="h-6 w-6 mr-3 text-gray-600" />
                  <h2 className="text-2xl font-semibold text-gray-800">Running Overview</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
                    <CardContent className="p-6 text-center">
                      <div className="text-3xl font-bold text-blue-600 mb-1">
                        {runs.length}
                      </div>
                      <div className="text-sm text-gray-600">Total Runs</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {analytics?.totalSplits} splits, {analytics?.totalPRs} PRs
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
                    <CardContent className="p-6 text-center">
                      <div className="text-3xl font-bold text-green-600 mb-1">
                        {formatDistance(runs.reduce((sum, run) => sum + run.distance, 0))}
                      </div>
                      <div className="text-sm text-gray-600">Total Distance</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Avg pace: {analytics ? `${Math.floor(analytics.avgPace)}:${Math.floor((analytics.avgPace % 1) * 60).toString().padStart(2, '0')}/km` : 'N/A'}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
                    <CardContent className="p-6 text-center">
                      <div className="text-3xl font-bold text-purple-600 mb-1">
                        {formatTime(runs.reduce((sum, run) => sum + run.moving_time, 0))}
                      </div>
                      <div className="text-sm text-gray-600">Total Time</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Avg HR: {analytics?.avgHeartRate || 'N/A'} bpm
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200">
                    <CardContent className="p-6 text-center">
                      <div className="text-3xl font-bold text-orange-600 mb-1">
                        {runs.reduce((sum, run) => sum + (run.calories || 0), 0).toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600">Total Calories</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {analytics?.runsWithStreams || 0} with streams
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </section>

              {/* Daily Distance Chart */}
              <section>
                <Card className="bg-white/80 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <TrendingUp className="h-5 w-5 mr-2 text-green-600" />
                      Daily Running Distance (Last Week)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <canvas ref={paceChartRef} className="w-full h-full"></canvas>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* Enhanced Runs Grid */}
              <section>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center">
                    <Footprints className="h-6 w-6 mr-3 text-gray-600" />
                    <h2 className="text-2xl font-semibold text-gray-800">Last Week's Runs</h2>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => setActiveTab("analytics")}
                    className="text-sm"
                  >
                    View Analytics
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {runs.map((run) => (
                    <Card 
                      key={run.id} 
                      className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
                      onClick={() => selectRun(run)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg font-semibold text-gray-800 leading-tight">
                            {run.name}
                          </CardTitle>
                          <div className="flex gap-1 ml-2 shrink-0">
                            <Badge variant="secondary">
                              {new Date(run.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </Badge>
                            {run.has_detailed_data && (
                              <Badge variant="outline" className="border-green-300 text-green-600">
                                <Award className="h-3 w-3 mr-1" />
                                Detailed
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div className="text-center p-3 bg-blue-50 rounded-lg">
                            <div className="text-xl font-bold text-blue-600">
                              {formatDistance(run.distance)}
                            </div>
                            <div className="text-xs text-gray-600">km</div>
                          </div>
                          <div className="text-center p-3 bg-green-50 rounded-lg">
                            <div className="text-xl font-bold text-green-600">
                              {formatTime(run.moving_time)}
                            </div>
                            <div className="text-xs text-gray-600">time</div>
                          </div>
                          <div className="text-center p-3 bg-purple-50 rounded-lg">
                            <div className="text-xl font-bold text-purple-600">
                              {formatPace(run.distance, run.moving_time)}
                            </div>
                            <div className="text-xs text-gray-600">pace</div>
                          </div>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          {run.average_heartrate && (
                            <div className="flex justify-between">
                              <span className="text-gray-600 flex items-center">
                                <Heart className="h-3 w-3 mr-1" />
                                Avg HR:
                              </span>
                              <span className="font-medium">{run.average_heartrate} bpm</span>
                            </div>
                          )}
                          {run.total_elevation_gain > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-600 flex items-center">
                                <Mountain className="h-3 w-3 mr-1" />
                                Elevation:
                              </span>
                              <span className="font-medium">{run.total_elevation_gain}m</span>
                            </div>
                          )}
                          {run.gear?.name && (
                            <div className="flex justify-between">
                              <span className="text-gray-600 flex items-center">
                                <Footprints className="h-3 w-3 mr-1" />
                                Shoes:
                              </span>
                              <span className="font-medium text-xs">{run.gear.name} ({run.gear.distance_km}km)</span>
                            </div>
                          )}
                          {run.best_efforts && run.best_efforts.length > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-600 flex items-center">
                                <Trophy className="h-3 w-3 mr-1" />
                                PRs:
                              </span>
                              <span className="font-medium">{run.best_efforts.length} personal records</span>
                            </div>
                          )}
                          {run.splits_metric && run.splits_metric.length > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-600 flex items-center">
                                <Target className="h-3 w-3 mr-1" />
                                Splits:
                              </span>
                              <span className="font-medium">{run.splits_metric.length} km splits available</span>
                            </div>
                          )}
                          {run.laps && run.laps.length > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-600 flex items-center">
                                <Timer className="h-3 w-3 mr-1" />
                                Laps:
                              </span>
                              <span className="font-medium">{run.laps.length} device laps</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex justify-center pt-3">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectRun(run);
                            }}
                            className="text-xs"
                          >
                            View Detailed Analysis
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-8">
              {runs.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-4">
                    <BarChart3 className="h-16 w-16 mx-auto" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">Advanced Analytics</h3>
                  <p className="text-gray-600 mb-4">
                    No running data available for analysis.
                  </p>
                </div>
              ) : (
                <>
                  {/* Performance Overview Cards */}
                  <section>
                    <div className="flex items-center mb-6">
                      <BarChart3 className="h-6 w-6 mr-3 text-gray-600" />
                      <h2 className="text-2xl font-semibold text-gray-800">Performance Analytics</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
                        <CardContent className="p-6 text-center">
                          <div className="text-2xl font-bold text-blue-600 mb-1">
                            {analytics ? `${Math.floor(analytics.avgPace)}:${Math.floor((analytics.avgPace % 1) * 60).toString().padStart(2, '0')}` : 'N/A'}
                          </div>
                          <div className="text-sm text-gray-600">Average Pace</div>
                          <div className="text-xs text-gray-500 mt-1">min/km across all runs</div>
                        </CardContent>
                      </Card>

                      <Card className="bg-gradient-to-r from-red-50 to-red-100 border-red-200">
                        <CardContent className="p-6 text-center">
                          <div className="text-2xl font-bold text-red-600 mb-1">
                            {analytics?.avgHeartRate || 'N/A'}
                          </div>
                          <div className="text-sm text-gray-600">Avg Heart Rate</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Max: {Math.max(...runs.filter(r => r.max_heartrate).map(r => r.max_heartrate!)) || 'N/A'} bpm
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
                        <CardContent className="p-6 text-center">
                          <div className="text-2xl font-bold text-green-600 mb-1">
                            {analytics?.totalSplits || 0}
                          </div>
                          <div className="text-sm text-gray-600">Total Splits</div>
                          <div className="text-xs text-gray-500 mt-1">Kilometer segments analyzed</div>
                        </CardContent>
                      </Card>

                      <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
                        <CardContent className="p-6 text-center">
                          <div className="text-2xl font-bold text-purple-600 mb-1">
                            {analytics?.totalPRs || 0}
                          </div>
                          <div className="text-sm text-gray-600">Personal Records</div>
                          <div className="text-xs text-gray-500 mt-1">Best efforts achieved</div>
                        </CardContent>
                      </Card>
                    </div>
                  </section>

                  {/* Gear Tracking */}
                  {analytics?.gear && (
                    <section>
                      <Card className="bg-white/80 backdrop-blur-sm">
                        <CardHeader>
                          <CardTitle className="flex items-center">
                            <Footprints className="h-5 w-5 mr-2 text-orange-600" />
                            Gear Tracking
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="text-center p-4 bg-orange-50 rounded-lg">
                              <div className="text-lg font-bold text-orange-600 mb-1">
                                {analytics.gear.name}
                              </div>
                              <div className="text-sm text-gray-600">Primary Running Shoe</div>
                              {analytics.gear.brand_name && (
                                <div className="text-xs text-gray-500 mt-1">{analytics.gear.brand_name}</div>
                              )}
                            </div>
                            <div className="text-center p-4 bg-orange-50 rounded-lg">
                              <div className="text-lg font-bold text-orange-600 mb-1">
                                {analytics.gear.distance_km}km
                              </div>
                              <div className="text-sm text-gray-600">Total Distance</div>
                              <div className="text-xs text-gray-500 mt-1">Lifetime mileage</div>
                            </div>
                            <div className="text-center p-4 bg-orange-50 rounded-lg">
                              <div className="text-lg font-bold text-orange-600 mb-1">
                                {Math.round((analytics.gear.distance_km / 800) * 100)}%
                              </div>
                              <div className="text-sm text-gray-600">Shoe Life</div>
                              <div className="text-xs text-gray-500 mt-1">Based on 800km lifespan</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </section>
                  )}

                  {/* Weekly Trends Chart */}
                  <section>
                    <Card className="bg-white/80 backdrop-blur-sm">
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <TrendingUp className="h-5 w-5 mr-2 text-blue-600" />
                          Weekly Training Trends
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-80">
                          <canvas ref={weeklyAnalyticsRef} className="w-full h-full"></canvas>
                        </div>
                      </CardContent>
                    </Card>
                  </section>

                  {/* Weekly Summary Stats */}
                  <section>
                    <Card className="bg-white/80 backdrop-blur-sm">
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <Calendar className="h-5 w-5 mr-2 text-purple-600" />
                          Weekly Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                          <div className="text-center p-4 bg-purple-50 rounded-lg">
                            <div className="text-xl font-bold text-purple-600 mb-1">
                              {analytics?.totalLaps || 0}
                            </div>
                            <div className="text-sm text-gray-600">Device Laps</div>
                            <div className="text-xs text-gray-500 mt-1">Interval training</div>
                          </div>
                          <div className="text-center p-4 bg-purple-50 rounded-lg">
                            <div className="text-xl font-bold text-purple-600 mb-1">
                              {analytics?.runsWithStreams || 0}
                            </div>
                            <div className="text-sm text-gray-600">With Stream Data</div>
                            <div className="text-xs text-gray-500 mt-1">Per-second metrics</div>
                          </div>
                          <div className="text-center p-4 bg-purple-50 rounded-lg">
                            <div className="text-xl font-bold text-purple-600 mb-1">
                              {runs.filter(r => r.average_cadence).length}
                            </div>
                            <div className="text-sm text-gray-600">With Cadence</div>
                            <div className="text-xs text-gray-500 mt-1">
                              Avg: {runs.filter(r => r.average_cadence).length > 0 
                                ? Math.round(runs.filter(r => r.average_cadence).reduce((sum, r) => sum + (r.average_cadence || 0), 0) / runs.filter(r => r.average_cadence).length)
                                : 'N/A'} spm
                            </div>
                          </div>
                          <div className="text-center p-4 bg-purple-50 rounded-lg">
                            <div className="text-xl font-bold text-purple-600 mb-1">
                              {Math.round(runs.reduce((sum, run) => sum + run.total_elevation_gain, 0))}m
                            </div>
                            <div className="text-sm text-gray-600">Total Elevation</div>
                            <div className="text-xs text-gray-500 mt-1">Climbed this week</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </section>
                </>
              )}
            </TabsContent>

            <TabsContent value="details" className="space-y-8">
              {!selectedRun ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-4">
                    <Footprints className="h-16 w-16 mx-auto" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">Select a Run</h3>
                  <p className="text-gray-600 mb-4">
                    Click any run from the Overview tab to see detailed analysis including splits, PRs, and performance metrics.
                  </p>
                  <Button onClick={() => setActiveTab("overview")} variant="outline">
                    Go to Overview
                  </Button>
                </div>
              ) : (
                <>
                  {/* Run Header */}
                  <section>
                    <Card className="bg-gradient-to-r from-blue-50 to-green-50 border-blue-200">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-2xl font-bold text-gray-800">
                              {selectedRun.name}
                            </CardTitle>
                            <p className="text-gray-600 mt-1">
                              {new Date(selectedRun.start_date).toLocaleDateString('en-US', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant="secondary" className="text-sm">
                              {formatDistance(selectedRun.distance)} km
                            </Badge>
                            <Badge variant="secondary" className="text-sm">
                              {formatTime(selectedRun.moving_time)}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                            <div className="text-lg font-bold text-blue-600">
                              {formatPace(selectedRun.distance, selectedRun.moving_time)}
                            </div>
                            <div className="text-xs text-gray-600">Average Pace</div>
                          </div>
                          <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                            <div className="text-lg font-bold text-red-600">
                              {selectedRun.average_heartrate ? Math.round(selectedRun.average_heartrate) : 'N/A'}
                            </div>
                            <div className="text-xs text-gray-600">Avg HR (bpm)</div>
                          </div>
                          <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                            <div className="text-lg font-bold text-green-600">
                              {selectedRun.total_elevation_gain}m
                            </div>
                            <div className="text-xs text-gray-600">Elevation Gain</div>
                          </div>
                          <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                            <div className="text-lg font-bold text-purple-600">
                              {selectedRun.calories || 'N/A'}
                            </div>
                            <div className="text-xs text-gray-600">Calories</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </section>

                  {/* Kilometer Splits Chart */}
                  {selectedRun.splits_metric && selectedRun.splits_metric.length > 0 && (
                    <section>
                      <Card className="bg-white/80 backdrop-blur-sm">
                        <CardHeader>
                          <CardTitle className="flex items-center">
                            <Target className="h-5 w-5 mr-2 text-blue-600" />
                            Kilometer Splits Analysis
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="h-80 mb-6">
                            <canvas ref={splitsChartRef} className="w-full h-full"></canvas>
                          </div>
                          
                          {/* Splits Table */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-200">
                                  <th className="text-left py-2 px-3">Split</th>
                                  <th className="text-right py-2 px-3">Time</th>
                                  <th className="text-right py-2 px-3">Pace</th>
                                  <th className="text-right py-2 px-3">HR</th>
                                  <th className="text-right py-2 px-3">Elev</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedRun.splits_metric.map((split, index) => (
                                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                                    <td className="py-2 px-3 font-medium">{index + 1} km</td>
                                    <td className="py-2 px-3 text-right">{formatTime(split.moving_time)}</td>
                                    <td className="py-2 px-3 text-right">{formatPace(1, split.moving_time)}</td>
                                    <td className="py-2 px-3 text-right">{split.average_heartrate ? Math.round(split.average_heartrate) : '-'}</td>
                                    <td className="py-2 px-3 text-right">{split.elevation_difference ? `${split.elevation_difference > 0 ? '+' : ''}${Math.round(split.elevation_difference)}m` : '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    </section>
                  )}

                  {/* Personal Records */}
                  {selectedRun.best_efforts && selectedRun.best_efforts.length > 0 && (
                    <section>
                      <Card className="bg-white/80 backdrop-blur-sm">
                        <CardHeader>
                          <CardTitle className="flex items-center">
                            <Trophy className="h-5 w-5 mr-2 text-yellow-600" />
                            Personal Records & Best Efforts
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {selectedRun.best_efforts.map((effort, index) => (
                              <div key={index} className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                                <div className="text-sm font-medium text-yellow-800 mb-1">
                                  {effort.name}
                                </div>
                                <div className="text-lg font-bold text-yellow-600 mb-1">
                                  {formatTime(effort.moving_time)}
                                </div>
                                <div className="text-xs text-gray-600">
                                  {formatPace(effort.distance / 1000, effort.moving_time)} • {formatDistance(effort.distance)} km
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </section>
                  )}

                  {/* Device Laps */}
                  {selectedRun.laps && selectedRun.laps.length > 0 && (
                    <section>
                      <Card className="bg-white/80 backdrop-blur-sm">
                        <CardHeader>
                          <CardTitle className="flex items-center">
                            <Timer className="h-5 w-5 mr-2 text-purple-600" />
                            Device Laps & Intervals
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-200">
                                  <th className="text-left py-2 px-3">Lap</th>
                                  <th className="text-right py-2 px-3">Distance</th>
                                  <th className="text-right py-2 px-3">Time</th>
                                  <th className="text-right py-2 px-3">Pace</th>
                                  <th className="text-right py-2 px-3">Avg HR</th>
                                  <th className="text-right py-2 px-3">Max HR</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedRun.laps.map((lap, index) => (
                                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                                    <td className="py-2 px-3 font-medium">{lap.name || `Lap ${index + 1}`}</td>
                                    <td className="py-2 px-3 text-right">{formatDistance(lap.distance)} km</td>
                                    <td className="py-2 px-3 text-right">{formatTime(lap.moving_time)}</td>
                                    <td className="py-2 px-3 text-right">{formatPace(lap.distance, lap.moving_time)}</td>
                                    <td className="py-2 px-3 text-right">{lap.average_heartrate ? Math.round(lap.average_heartrate) : '-'}</td>
                                    <td className="py-2 px-3 text-right">{lap.max_heartrate ? Math.round(lap.max_heartrate) : '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    </section>
                  )}

                  {/* Additional Metrics */}
                  <section>
                    <Card className="bg-white/80 backdrop-blur-sm">
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <Gauge className="h-5 w-5 mr-2 text-gray-600" />
                          Additional Metrics
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <div className="text-lg font-bold text-gray-600">
                              {formatSpeed(selectedRun.max_speed)} km/h
                            </div>
                            <div className="text-xs text-gray-600">Max Speed</div>
                          </div>
                          <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <div className="text-lg font-bold text-gray-600">
                              {selectedRun.average_cadence || 'N/A'}
                            </div>
                            <div className="text-xs text-gray-600">Avg Cadence (spm)</div>
                          </div>
                          <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <div className="text-lg font-bold text-gray-600">
                              {selectedRun.max_heartrate ? Math.round(selectedRun.max_heartrate) : 'N/A'}
                            </div>
                            <div className="text-xs text-gray-600">Max HR (bpm)</div>
                          </div>
                          <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <div className="text-lg font-bold text-gray-600">
                              {selectedRun.temperature ? `${selectedRun.temperature}°C` : 'N/A'}
                            </div>
                            <div className="text-xs text-gray-600">Temperature</div>
                          </div>
                        </div>
                        
                        {selectedRun.gear && (
                          <div className="mt-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <Footprints className="h-5 w-5 mr-2 text-orange-600" />
                                <div>
                                  <div className="font-medium text-orange-800">{selectedRun.gear.name}</div>
                                  {selectedRun.gear.brand_name && (
                                    <div className="text-sm text-orange-600">{selectedRun.gear.brand_name}</div>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-orange-600">{selectedRun.gear.distance_km}km</div>
                                <div className="text-xs text-orange-600">Total mileage</div>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {selectedRun.has_streams && (
                          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200 text-center">
                            <div className="text-sm text-blue-700">
                              <Activity className="h-4 w-4 inline mr-1" />
                              Per-second stream data available for advanced analysis
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </section>
                </>
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>
      
      {/* Footer */}
      <footer className="relative z-10 py-6 px-6 md:px-12 text-center text-sm text-gray-500">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center gap-4 mb-2 md:mb-0">
            <span>🏃‍♂️ Advanced running analytics</span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <BarChart3 className="h-4 w-4" />
              {analytics?.totalSplits || 0} splits analyzed
            </span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <Trophy className="h-4 w-4" />
              {analytics?.totalPRs || 0} personal records
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>Updated: {new Date().toLocaleDateString()}</span>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${runs.length > 0 ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`}></div>
              <span className="text-xs">{runs.length > 0 ? `${runs.length} Runs Loaded` : 'Loading Runs'}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default RunsDashboard;
