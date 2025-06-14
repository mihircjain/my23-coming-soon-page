import { useState, useEffect, useRef } from "react";
import { ArrowLeft, RefreshCw, MapPin, Clock, Zap, Heart, Activity, BarChart3, Target, Gauge, Mountain, Footprints, Calendar, TrendingUp, Award } from "lucide-react";
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
  gear_name?: string;
  gear_distance?: number;
  fetched_at: string;
  has_detailed_data: boolean;
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
  const heartRateChartRef = useRef<HTMLCanvasElement>(null);
  const elevationChartRef = useRef<HTMLCanvasElement>(null);
  const splitsChartRef = useRef<HTMLCanvasElement>(null);

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
    const paceSeconds = time / distance;
    const minutes = Math.floor(paceSeconds / 60);
    const seconds = Math.floor(paceSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  };

  const formatDistance = (distance: number) => {
    if (distance === 0) return '0.00';
    if (distance < 0.1) return distance.toFixed(3);
    return distance.toFixed(2);
  };

  const formatSpeed = (speed: number) => {
    if (!speed) return 'N/A';
    return (speed * 3.6).toFixed(1); // Convert m/s to km/h
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

  // Create weekly distance chart (now daily for last week)
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
        day.distance += run.distance;
        day.runs += 1;
      }
    });

    const days = Array.from(dailyData.keys()).sort();
    const distances = days.map(day => dailyData.get(day).distance);
    const labels = days.map(day => {
      const date = new Date(day);
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

  // Fetch runs from API (last week only)
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
        detailed: 'true'
      });

      if (forceRefresh) {
        params.set('refresh', 'true');
        params.set('timestamp', Date.now().toString());
      }

      const response = await fetch(`/api/runs?${params.toString()}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', errorText);
        throw new Error(`Failed to fetch last week's runs: ${response.status}`);
      }

      const data = await response.json();
      console.log('📊 Last week runs data received:', data?.length, 'runs');

      if (!Array.isArray(data)) {
        throw new Error('Invalid data format received from API');
      }('Invalid data format received from API');
      }

      const processedRuns = data.map((run: any) => ({
        id: run.id?.toString() || Math.random().toString(),
        name: run.name || 'Unnamed Run',
        start_date: run.start_date,
        distance: run.distance ? run.distance / 1000 : 0, // Convert to km
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
        polyline: run.map?.polyline,
        splits_metric: run.splits_metric,
        laps: run.laps,
        best_efforts: run.best_efforts,
        gear_name: run.gear_name,
        gear_distance: run.gear_distance,
        fetched_at: run.fetched_at || new Date().toISOString(),
        has_detailed_data: run.has_detailed_data || false
      }));

      const sortedRuns = processedRuns.sort((a: RunData, b: RunData) => 
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
      );

      setRuns(sortedRuns);
      setLastUpdate(new Date().toLocaleTimeString());
      
      // Create charts after data is loaded
      setTimeout(() => createWeeklyChart(), 100);

    } catch (error) {
      console.error('❌ Error fetching last week runs:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch last week runs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Select run and create detailed charts
  const selectRun = (run: RunData) => {
    setSelectedRun(run);
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
            🏃‍♂️ Last Week's Runs
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Detailed analysis of your running activities from last week
          </p>
          {lastUpdate && (
            <p className="mt-1 text-sm text-gray-500">
              Last updated: {lastUpdate} • {runs.length} runs from last week
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
                      <div className="text-xs text-gray-500 mt-1">Last week</div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
                    <CardContent className="p-6 text-center">
                      <div className="text-3xl font-bold text-green-600 mb-1">
                        {formatDistance(runs.reduce((sum, run) => sum + run.distance, 0))}
                      </div>
                      <div className="text-sm text-gray-600">Total Distance</div>
                      <div className="text-xs text-gray-500 mt-1">Kilometers</div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
                    <CardContent className="p-6 text-center">
                      <div className="text-3xl font-bold text-purple-600 mb-1">
                        {formatTime(runs.reduce((sum, run) => sum + run.moving_time, 0))}
                      </div>
                      <div className="text-sm text-gray-600">Total Time</div>
                      <div className="text-xs text-gray-500 mt-1">Moving time</div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200">
                    <CardContent className="p-6 text-center">
                      <div className="text-3xl font-bold text-orange-600 mb-1">
                        {runs.reduce((sum, run) => sum + (run.calories || 0), 0).toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600">Total Calories</div>
                      <div className="text-xs text-gray-500 mt-1">Burned</div>
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

              {/* Recent Runs Grid */}
              <section>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center">
                    <Footprints className="h-6 w-6 mr-3 text-gray-600" />
                    <h2 className="text-2xl font-semibold text-gray-800">Last Week's Runs</h2>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => setActiveTab("details")}
                    className="text-sm"
                  >
                    View All Details
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
                          <Badge variant="secondary" className="ml-2 shrink-0">
                            {new Date(run.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </Badge>
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
                          {run.calories && (
                            <div className="flex justify-between">
                              <span className="text-gray-600 flex items-center">
                                <Zap className="h-3 w-3 mr-1" />
                                Calories:
                              </span>
                              <span className="font-medium">{run.calories}</span>
                            </div>
                          )}
                          {run.has_detailed_data && (
                            <div className="flex justify-center pt-2">
                              <Badge variant="outline" className="text-xs border-green-300 text-green-600">
                                <Award className="h-3 w-3 mr-1" />
                                Detailed Data Available
                              </Badge>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-8">
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <BarChart3 className="h-16 w-16 mx-auto" />
                </div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Advanced Analytics</h3>
                <p className="text-gray-600 mb-4">
                  Detailed charts and performance analysis coming soon...
                </p>
              </div>
            </TabsContent>

            <TabsContent value="details" className="space-y-8">
              {selectedRun ? (
                <div className="space-y-6">
                  {/* Selected Run Details */}
                  <Card className="bg-white/90 backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{selectedRun.name}</span>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedRun(null)}
                        >
                          Back to List
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">
                            {formatDistance(selectedRun.distance)}
                          </div>
                          <div className="text-sm text-gray-600">Distance (km)</div>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">
                            {formatTime(selectedRun.moving_time)}
                          </div>
                          <div className="text-sm text-gray-600">Moving Time</div>
                        </div>
                        <div className="text-center p-4 bg-purple-50 rounded-lg">
                          <div className="text-2xl font-bold text-purple-600">
                            {formatPace(selectedRun.distance, selectedRun.moving_time)}
                          </div>
                          <div className="text-sm text-gray-600">Average Pace</div>
                        </div>
                        <div className="text-center p-4 bg-orange-50 rounded-lg">
                          <div className="text-2xl font-bold text-orange-600">
                            {formatSpeed(selectedRun.average_speed)}
                          </div>
                          <div className="text-sm text-gray-600">Speed (km/h)</div>
                        </div>
                      </div>

                      {/* Additional metrics */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        {selectedRun.average_heartrate && (
                          <div className="p-4 bg-red-50 rounded-lg text-center">
                            <Heart className="h-8 w-8 mx-auto mb-2 text-red-500" />
                            <div className="text-xl font-bold text-red-600">
                              {selectedRun.average_heartrate}
                            </div>
                            <div className="text-sm text-gray-600">Avg Heart Rate (bpm)</div>
                            {selectedRun.max_heartrate && (
                              <div className="text-xs text-gray-500 mt-1">
                                Max: {selectedRun.max_heartrate} bpm
                              </div>
                            )}
                          </div>
                        )}
                        
                        {selectedRun.total_elevation_gain > 0 && (
                          <div className="p-4 bg-yellow-50 rounded-lg text-center">
                            <Mountain className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
                            <div className="text-xl font-bold text-yellow-600">
                              {selectedRun.total_elevation_gain}
                            </div>
                            <div className="text-sm text-gray-600">Elevation Gain (m)</div>
                          </div>
                        )}
                        
                        {selectedRun.calories && (
                          <div className="p-4 bg-green-50 rounded-lg text-center">
                            <Zap className="h-8 w-8 mx-auto mb-2 text-green-600" />
                            <div className="text-xl font-bold text-green-600">
                              {selectedRun.calories}
                            </div>
                            <div className="text-sm text-gray-600">Calories Burned</div>
                          </div>
                        )}
                      </div>

                      {/* Splits Chart */}
                      {selectedRun.splits_metric && selectedRun.splits_metric.length > 0 && (
                        <div className="mb-6">
                          <h4 className="text-lg font-semibold mb-4 flex items-center">
                            <BarChart3 className="h-5 w-5 mr-2" />
                            Kilometer Splits
                          </h4>
                          <div className="h-64 bg-gray-50 rounded-lg p-4">
                            <canvas ref={splitsChartRef} className="w-full h-full"></canvas>
                          </div>
                        </div>
                      )}

                      {/* Best Efforts */}
                      {selectedRun.best_efforts && selectedRun.best_efforts.length > 0 && (
                        <div className="mb-6">
                          <h4 className="text-lg font-semibold mb-4 flex items-center">
                            <Award className="h-5 w-5 mr-2" />
                            Best Efforts
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {selectedRun.best_efforts.slice(0, 6).map((effort, index) => (
                              <div key={index} className="p-4 bg-gray-50 rounded-lg">
                                <div className="font-semibold text-gray-800">{effort.name}</div>
                                <div className="text-sm text-gray-600 mt-1">
                                  Distance: {formatDistance(effort.distance / 1000)} km
                                </div>
                                <div className="text-sm text-gray-600">
                                  Time: {formatTime(effort.moving_time)}
                                </div>
                                <div className="text-sm text-gray-600">
                                  Pace: {formatPace(effort.distance / 1000, effort.moving_time)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Laps */}
                      {selectedRun.laps && selectedRun.laps.length > 0 && (
                        <div className="mb-6">
                          <h4 className="text-lg font-semibold mb-4 flex items-center">
                            <Target className="h-5 w-5 mr-2" />
                            Laps
                          </h4>
                          <div className="space-y-3">
                            {selectedRun.laps.map((lap, index) => (
                              <div key={index} className="p-4 bg-gray-50 rounded-lg">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="font-semibold text-gray-800">
                                      {lap.name || `Lap ${index + 1}`}
                                    </div>
                                    <div className="text-sm text-gray-600 mt-1">
                                      {formatDistance(lap.distance / 1000)} km • {formatTime(lap.moving_time)}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-sm font-medium">
                                      {formatPace(lap.distance / 1000, lap.moving_time)}
                                    </div>
                                    {lap.average_heartrate && (
                                      <div className="text-xs text-gray-500">
                                        HR: {lap.average_heartrate} bpm
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Additional Details */}
                      <div className="border-t pt-4">
                        <h4 className="text-lg font-semibold mb-4">Additional Details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Start Date:</span>
                                <span className="font-medium">
                                  {new Date(selectedRun.start_date).toLocaleString()}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Elapsed Time:</span>
                                <span className="font-medium">{formatTime(selectedRun.elapsed_time)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Max Speed:</span>
                                <span className="font-medium">{formatSpeed(selectedRun.max_speed)} km/h</span>
                              </div>
                              {selectedRun.average_cadence && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Avg Cadence:</span>
                                  <span className="font-medium">{selectedRun.average_cadence} spm</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div>
                            <div className="space-y-2">
                              {selectedRun.temperature && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Temperature:</span>
                                  <span className="font-medium">{selectedRun.temperature}°C</span>
                                </div>
                              )}
                              {selectedRun.gear_name && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Gear:</span>
                                  <span className="font-medium">{selectedRun.gear_name}</span>
                                </div>
                              )}
                              {selectedRun.workout_type && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Workout Type:</span>
                                  <span className="font-medium">Type {selectedRun.workout_type}</span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span className="text-gray-600">Data Quality:</span>
                                <Badge 
                                  variant={selectedRun.has_detailed_data ? "default" : "secondary"}
                                  className="text-xs"
                                >
                                  {selectedRun.has_detailed_data ? "Detailed" : "Summary"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {selectedRun.description && (
                          <div className="mt-4">
                            <div className="text-gray-600 text-sm mb-2">Description:</div>
                            <div className="p-3 bg-gray-50 rounded text-sm text-gray-700">
                              {selectedRun.description}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                /* All Runs List */
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-gray-800">All Last Week's Runs</h3>
                    <div className="text-sm text-gray-600">
                      {runs.length} runs • Click any run for detailed analysis
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {runs.map((run) => (
                      <Card 
                        key={run.id} 
                        className="bg-white/80 backdrop-blur-sm hover:shadow-md transition-all duration-200 cursor-pointer"
                        onClick={() => selectRun(run)}
                      >
                        <CardContent className="p-6">
                          <div className="flex flex-col md:flex-row md:items-center justify-between">
                            <div className="flex-1 mb-4 md:mb-0">
                              <h4 className="font-semibold text-gray-800 mb-2">{run.name}</h4>
                              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                                <span className="flex items-center">
                                  <Calendar className="h-4 w-4 mr-1" />
                                  {new Date(run.start_date).toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </span>
                                <span className="flex items-center">
                                  <Clock className="h-4 w-4 mr-1" />
                                  {new Date(run.start_date).toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                                {run.has_detailed_data && (
                                  <Badge variant="outline" className="text-xs border-green-300 text-green-600">
                                    <Award className="h-3 w-3 mr-1" />
                                    Detailed
                                  </Badge>
                                )}
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                              <div>
                                <div className="font-bold text-blue-600">{formatDistance(run.distance)}</div>
                                <div className="text-xs text-gray-500">km</div>
                              </div>
                              <div>
                                <div className="font-bold text-green-600">{formatTime(run.moving_time)}</div>
                                <div className="text-xs text-gray-500">time</div>
                              </div>
                              <div>
                                <div className="font-bold text-purple-600">{formatPace(run.distance, run.moving_time)}</div>
                                <div className="text-xs text-gray-500">pace</div>
                              </div>
                              {run.average_heartrate && (
                                <div>
                                  <div className="font-bold text-red-600">{run.average_heartrate}</div>
                                  <div className="text-xs text-gray-500">avg hr</div>
                                </div>
                              )}
                              {run.total_elevation_gain > 0 && (
                                <div>
                                  <div className="font-bold text-yellow-600">{run.total_elevation_gain}</div>
                                  <div className="text-xs text-gray-500">elev (m)</div>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>
      
      {/* Footer */}
      <footer className="relative z-10 py-6 px-6 md:px-12 text-center text-sm text-gray-500">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center gap-4 mb-2 md:mb-0">
            <span>🏃‍♂️ Last week's running analytics</span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <BarChart3 className="h-4 w-4" />
              Detailed Strava integration
            </span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <Award className="h-4 w-4" />
              Performance tracking
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

export default runsdashboard;
