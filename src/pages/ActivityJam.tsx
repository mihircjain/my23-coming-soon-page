// ActivityJam.tsx - FULLY OPTIMIZED: Cache-first, minimal API calls, chart caching, no calorie estimation

import { useState, useEffect, useRef } from "react";
import { ArrowLeft, RefreshCw, Calendar, Clock, Zap, Heart, Activity, BarChart3, Tag, Edit3, Check, X, TrendingUp, MapPin, Timer, Target, Route, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  is_run_activity: boolean;
  run_tag?: RunTag;
}

// Detailed run analysis interface
interface RunDetail {
  id: string;
  summary: ActivityData;
  splits_metric?: Array<{
    distance: number;
    elapsed_time: number;
    elevation_difference: number;
    moving_time: number;
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
    pr_rank?: number;
  }>;
  zones?: Array<{
    type: string;
    distribution_buckets: Array<{
      min: number;
      max: number;
      time: number;
    }>;
  }>;
  gear?: {
    id: string;
    name: string;
    distance: number;
    brand_name?: string;
    model_name?: string;
  };
  streams?: {
    time?: number[];
    distance?: number[];
    heartrate?: number[];
    velocity_smooth?: number[];
    altitude?: number[];
    grade_smooth?: number[];
  };
}

// Detailed Run Analysis Modal Component
const RunDetailModal = ({ activity, onClose }: { activity: ActivityData; onClose: () => void }) => {
  const [runDetail, setRunDetail] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState("overview");
  
  // Chart refs for detailed analysis
  const paceChartRef = useRef<HTMLCanvasElement>(null);
  const hrChartRef = useRef<HTMLCanvasElement>(null);
  const elevationChartRef = useRef<HTMLCanvasElement>(null);
  
  const chartInstances = useRef<{ [key: string]: Chart | null }>({
    pace: null,
    hr: null,
    elevation: null
  });

  // Load detailed run data
  const loadRunDetail = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log(`🏃 Loading detailed analysis for run ${activity.id}`);
      
      const response = await fetch(`/api/strava-detail?activityId=${activity.id}&userId=mihir_jain`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 429 || errorData.isRateLimit) {
          throw new Error('Strava API rate limit reached. Detailed analysis temporarily unavailable. Please try again in 15 minutes.');
        }
        
        throw new Error(errorData.message || `Failed to load run details: ${response.status}`);
      }
      
      const detail = await response.json();
      
      // Check if this is rate-limited basic data
      if (detail.rate_limited) {
        console.log('⚠️ Received rate-limited data - showing basic analysis only');
        setError('⚠️ Showing basic analysis - detailed data temporarily unavailable due to API limits');
      }
      
      setRunDetail(detail);
      
      // Create charts with a small delay
      setTimeout(() => {
        createDetailCharts(detail);
      }, 100);
      
    } catch (error) {
      console.error('❌ Error loading run detail:', error);
      setError(error instanceof Error ? error.message : 'Failed to load run details');
    } finally {
      setLoading(false);
    }
  };

  // Destroy all detail charts
  const destroyDetailCharts = () => {
    Object.values(chartInstances.current).forEach(chart => {
      if (chart) {
        chart.destroy();
      }
    });
    chartInstances.current = {
      pace: null,
      hr: null,
      elevation: null
    };
  };

  // Create detailed analysis charts
  const createDetailCharts = (detail: RunDetail) => {
    destroyDetailCharts();
    
    if (detail.splits_metric && detail.splits_metric.length > 0) {
      createPaceChart(detail.splits_metric);
      createHRChart(detail.splits_metric);
    }
    
    if (detail.streams && detail.streams.distance && detail.streams.altitude) {
      createElevationChart(detail.streams);
    }
  };

  // Create km-by-km pace chart
  const createPaceChart = (splits: any[]) => {
    if (!paceChartRef.current) return;
    
    const ctx = paceChartRef.current.getContext('2d');
    if (!ctx) return;

    const labels = splits.map((_, index) => `km ${index + 1}`);
    const paces = splits.map(split => {
      const paceSeconds = split.moving_time;
      const minutes = Math.floor(paceSeconds / 60);
      const seconds = paceSeconds % 60;
      return parseFloat(`${minutes}.${(seconds / 60 * 100).toFixed(0)}`);
    });

    try {
      chartInstances.current.pace = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Pace (min/km)',
            data: paces,
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6
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
                  const minutes = Math.floor(value);
                  const seconds = Math.round((value - minutes) * 60);
                  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
                }
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('❌ Error creating pace chart:', error);
    }
  };

  // Create km-by-km heart rate chart
  const createHRChart = (splits: any[]) => {
    if (!hrChartRef.current || !splits.some(s => s.average_heartrate)) return;
    
    const ctx = hrChartRef.current.getContext('2d');
    if (!ctx) return;

    const labels = splits.map((_, index) => `km ${index + 1}`);
    const heartRates = splits.map(split => split.average_heartrate || 0);

    try {
      chartInstances.current.hr = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Heart Rate (bpm)',
            data: heartRates,
            borderColor: 'rgb(20, 184, 166)',
            backgroundColor: 'rgba(20, 184, 166, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6
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
              grid: { color: 'rgba(0,0,0,0.1)' }
            }
          }
        }
      });
    } catch (error) {
      console.error('❌ Error creating HR chart:', error);
    }
  };

  // Create elevation profile chart
  const createElevationChart = (streams: any) => {
    if (!elevationChartRef.current) return;
    
    const ctx = elevationChartRef.current.getContext('2d');
    if (!ctx) return;

    const distances = streams.distance.map((d: number) => d / 1000);
    const elevations = streams.altitude;

    try {
      chartInstances.current.elevation = new Chart(ctx, {
        type: 'line',
        data: {
          labels: distances.map((d: number) => `${d.toFixed(1)}km`),
          datasets: [{
            label: 'Elevation (m)',
            data: elevations,
            borderColor: 'rgb(34, 197, 94)',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.1,
            pointRadius: 0,
            pointHoverRadius: 4
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
              grid: { display: false },
              ticks: { maxTicksLimit: 8 }
            },
            y: {
              grid: { color: 'rgba(0,0,0,0.1)' }
            }
          }
        }
      });
    } catch (error) {
      console.error('❌ Error creating elevation chart:', error);
    }
  };

  // Helper functions
  const formatPace = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Load data when modal opens
  useEffect(() => {
    loadRunDetail();
    
    return () => {
      destroyDetailCharts();
    };
  }, [activity.id]);

  if (loading) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loading Run Analysis...</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Error Loading Run Details</DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={loadRunDetail}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            Detailed Run Analysis: {activity.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="splits">Km Splits</TabsTrigger>
            <TabsTrigger value="charts">Charts</TabsTrigger>
            <TabsTrigger value="efforts">Best Efforts</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {(activity.distance).toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-600">Distance (km)</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {formatTime(activity.moving_time)}
                  </div>
                  <div className="text-sm text-gray-600">Moving Time</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-teal-50 to-teal-100 border-teal-200">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-teal-600">
                    {formatPace(activity.moving_time / activity.distance)}
                  </div>
                  <div className="text-sm text-gray-600">Avg Pace</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-emerald-50 to-emerald-100 border-emerald-200">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-600">
                    {activity.average_heartrate || 'N/A'}
                  </div>
                  <div className="text-sm text-gray-600">Avg HR</div>
                </CardContent>
              </Card>
            </div>

            {/* Additional Details */}
            {runDetail && (
              <Card>
                <CardHeader>
                  <CardTitle>Run Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Elevation Gain:</span>
                      <span className="font-medium">{activity.total_elevation_gain}m</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Max Speed:</span>
                      <span className="font-medium">{((activity.max_speed || 0) * 3.6).toFixed(1)} km/h</span>
                    </div>
                    {activity.max_heartrate && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Max HR:</span>
                        <span className="font-medium">{activity.max_heartrate} bpm</span>
                      </div>
                    )}
                    {activity.calories > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Calories:</span>
                        <span className="font-medium">{activity.calories}</span>
                      </div>
                    )}
                    {runDetail.gear && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Shoes:</span>
                        <span className="font-medium">{runDetail.gear.name}</span>
                      </div>
                    )}
                    {runDetail.gear && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Shoe Mileage:</span>
                        <span className="font-medium">{(runDetail.gear.distance / 1000).toFixed(0)} km</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="splits" className="space-y-4">
            {runDetail?.splits_metric && runDetail.splits_metric.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Kilometre Splits</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {runDetail.splits_metric.map((split, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="font-medium">Km {index + 1}</div>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Timer className="h-3 w-3 text-blue-500" />
                            <span>{formatPace(split.moving_time)}</span>
                          </div>
                          {split.average_heartrate && (
                            <div className="flex items-center gap-1">
                              <Heart className="h-3 w-3 text-red-500" />
                              <span>{Math.round(split.average_heartrate)} bpm</span>
                            </div>
                          )}
                          {split.elevation_difference !== undefined && (
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3 text-green-500" />
                              <span>{split.elevation_difference > 0 ? '+' : ''}{split.elevation_difference}m</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-gray-500">
                  <Activity className="h-8 w-8 mx-auto mb-2" />
                  <p>No split data available for this run</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="charts" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Pace Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Timer className="h-4 w-4 mr-2 text-blue-500" />
                    Pace per Kilometre
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <canvas ref={paceChartRef} className="w-full h-full"></canvas>
                  </div>
                </CardContent>
              </Card>

              {/* Heart Rate Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Heart className="h-4 w-4 mr-2 text-teal-500" />
                    Heart Rate per Kilometre
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <canvas ref={hrChartRef} className="w-full h-full"></canvas>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Elevation Profile */}
            {runDetail?.streams?.altitude && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <TrendingUp className="h-4 w-4 mr-2 text-green-500" />
                    Elevation Profile
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <canvas ref={elevationChartRef} className="w-full h-full"></canvas>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="efforts" className="space-y-4">
            {runDetail?.best_efforts && runDetail.best_efforts.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Best Efforts / Personal Records</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {runDetail.best_efforts.map((effort, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-orange-500" />
                          <span className="font-medium">{effort.name}</span>
                          {effort.pr_rank && effort.pr_rank <= 3 && (
                            <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                              PR #{effort.pr_rank}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span>{formatTime(effort.moving_time)}</span>
                          <span className="text-gray-500">
                            {formatPace(effort.moving_time / (effort.distance / 1000))} pace
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-gray-500">
                  <Target className="h-8 w-8 mx-auto mb-2" />
                  <p>No best efforts data available for this run</p>
                </CardContent>
              </Card>
            )}

            {/* Heart Rate Zones */}
            {runDetail?.zones && runDetail.zones.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Heart Rate Zones</CardTitle>
                </CardHeader>
                <CardContent>
                  {runDetail.zones.map((zone, zoneIndex) => (
                    <div key={zoneIndex} className="space-y-2">
                      <h4 className="font-medium">{zone.type} Zones</h4>
                      <div className="space-y-1">
                        {zone.distribution_buckets.map((bucket, bucketIndex) => (
                          <div key={bucketIndex} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                            <span>Zone {bucketIndex + 1} ({bucket.min}-{bucket.max})</span>
                            <span>{formatTime(bucket.time)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

const ActivityJam = () => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshType, setRefreshType] = useState<'today' | '30days' | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [selectedRunDetail, setSelectedRunDetail] = useState<ActivityData | null>(null);

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

  // Get run tag option
  const getRunTagOption = (tag: RunTag): RunTagOption => {
    return RUN_TAG_OPTIONS.find(option => option.value === tag) || RUN_TAG_OPTIONS[0];
  };

  // Handle run click for detailed analysis
  const handleRunClick = (activity: ActivityData) => {
    if (activity.is_run_activity) {
      setSelectedRunDetail(activity);
    }
  };

// Process activities data for charts
  const processChartData = (activities: ActivityData[]) => {
    console.log('📊 PROCESSING CHART DATA from', activities.length, 'activities');
    
    if (activities.length === 0) {
      console.log('📊 No activities to process');
      return null;
    }

    // 🔥 DEBUG: Check for May/June activities specifically  
    const mayJuneActivities = activities.filter(a => {
      const date = a.start_date.split('T')[0];
      return (date >= '2025-05-18' && date <= '2025-05-22') || date === '2025-06-18';
    });

    console.log('🔥 MAY/JUNE ACTIVITIES found:', mayJuneActivities.length);
    mayJuneActivities.forEach(activity => {
      const date = activity.start_date.split('T')[0];
      console.log(`   ${date}: ${activity.type} "${activity.name}" - ${activity.calories} cal, ${activity.distance} km`);
    });

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
      dayData.calories += activity.calories || 0;
      dayData.distance += activity.distance || 0;
      
      // Heart rate ONLY from runs
      if (activity.is_run_activity && activity.has_heartrate && activity.average_heartrate) {
        dayData.heartRateTotal += activity.average_heartrate;
        dayData.heartRateCount += 1;
      }

      // 🔥 DEBUG: Log May/June processing
      if ((date >= '2025-05-18' && date <= '2025-05-22') || date === '2025-06-18') {
        console.log(`🔄 Adding ${date}: ${activity.type} "${activity.name}" → +${activity.calories} cal, +${activity.distance} km`);
        console.log(`   Day total now: ${dayData.calories} cal, ${dayData.distance.toFixed(2)} km`);
      }
    });

    // Convert to arrays
    const dates = Array.from(dailyData.keys()).sort();
    const labels = dates.map(date => new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    }));

    const chartData = {
      labels,
      calories: dates.map(date => dailyData.get(date).calories),
      distance: dates.map(date => Math.round(dailyData.get(date).distance * 10) / 10),
      heartRate: dates.map(date => {
        const dayData = dailyData.get(date);
        return dayData.heartRateCount > 0 ? Math.round(dayData.heartRateTotal / dayData.heartRateCount) : 0;
      })
    };

    // 🔥 DEBUG: Check final chart data for May/June
    console.log('🔥 FINAL CHART DATA for May/June:');
    dates.forEach((date, index) => {
      if ((date >= '2025-05-18' && date <= '2025-05-22') || date === '2025-06-18') {
        const label = labels[index];
        const calories = chartData.calories[index];
        const distance = chartData.distance[index];
        const heartRate = chartData.heartRate[index];
        console.log(`   ${date} (${label}): ${calories} cal, ${distance} km, ${heartRate} bpm`);
      }
    });

    console.log('📊 Chart data summary:', {
      totalDataPoints: chartData.labels.length,
      totalCalories: chartData.calories.reduce((sum, cal) => sum + cal, 0),
      daysWithCalories: chartData.calories.filter(cal => cal > 0).length,
      daysWithDistance: chartData.distance.filter(dist => dist > 0).length
    });

    return chartData;
  };

  // Destroy all charts
  const destroyCharts = () => {
    console.log('🗑️ Destroying existing charts');
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
    if (!caloriesChartRef.current || !data) return;

    const ctx = caloriesChartRef.current.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart
    if (chartInstances.current.calories) {
      chartInstances.current.calories.destroy();
    }

    console.log('📊 Creating calories chart with', data.calories.length, 'data points');

    try {
      chartInstances.current.calories = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.labels,
          datasets: [{
            label: 'Calories Burned',
            data: data.calories,
            borderColor: 'rgb(34, 197, 94)',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            pointHoverRadius: 5
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
              grid: { display: false },
              ticks: { maxTicksLimit: 6 }
            },
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(0,0,0,0.1)' }
            }
          }
        }
      });
      
      console.log('✅ Calories chart created successfully');
    } catch (error) {
      console.error('❌ Error creating calories chart:', error);
    }
  };

  // Create distance chart
  const createDistanceChart = (data: any) => {
    if (!distanceChartRef.current || !data) return;

    const ctx = distanceChartRef.current.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart
    if (chartInstances.current.distance) {
      chartInstances.current.distance.destroy();
    }

    console.log('📊 Creating distance chart with', data.distance.length, 'data points');

    try {
      chartInstances.current.distance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: data.labels,
          datasets: [{
            label: 'Distance (km)',
            data: data.distance,
            backgroundColor: 'rgba(59, 130, 246, 0.8)',
            borderColor: 'rgb(59, 130, 246)',
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
              grid: { display: false },
              ticks: { maxTicksLimit: 6 }
            },
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(0,0,0,0.1)' }
            }
          }
        }
      });
      
      console.log('✅ Distance chart created successfully');
    } catch (error) {
      console.error('❌ Error creating distance chart:', error);
    }
  };

  // Create heart rate chart
  const createHeartRateChart = (data: any) => {
    if (!heartRateChartRef.current || !data) return;

    const ctx = heartRateChartRef.current.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart
    if (chartInstances.current.heartRate) {
      chartInstances.current.heartRate.destroy();
    }

    console.log('📊 Creating heart rate chart with', data.heartRate.length, 'data points');

    try {
      chartInstances.current.heartRate = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.labels,
          datasets: [{
            label: 'Heart Rate (bpm)',
            data: data.heartRate,
            borderColor: 'rgb(20, 184, 166)',
            backgroundColor: 'rgba(20, 184, 166, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            pointHoverRadius: 5
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
              grid: { display: false },
              ticks: { maxTicksLimit: 6 }
            },
            y: {
              beginAtZero: false,
              grid: { color: 'rgba(0,0,0,0.1)' }
            }
          }
        }
      });
      
      console.log('✅ Heart rate chart created successfully');
    } catch (error) {
      console.error('❌ Error creating heart rate chart:', error);
    }
  };

  // OPTIMIZED: Load cached chart data or create new charts
  const loadOrCreateCharts = async (activities: ActivityData[], forceRecreate = false) => {
    console.log('📊 Loading or creating charts...');
    
    if (!forceRecreate) {
      // Try to load cached chart data first
      try {
        const chartCacheResponse = await fetch('/api/chart-cache?userId=mihir_jain');
        
        if (chartCacheResponse.ok) {
          const cachedChartData = await chartCacheResponse.json();
          console.log(`📊 Using cached chart data (${cachedChartData.age})`);
          
          setChartData(cachedChartData);
          
          // Create charts with cached data immediately
          setTimeout(() => {
            if (cachedChartData) {
              createCaloriesChart(cachedChartData);
              createDistanceChart(cachedChartData);
              createHeartRateChart(cachedChartData);
            }
          }, 100);
          
          return; // Use cached charts
        }
      } catch (cacheError) {
        console.log('📊 No cached chart data available, creating fresh charts');
      }
    }
    
    // Create fresh charts and cache them
    console.log('📊 Creating fresh charts...');
    const processedData = processChartData(activities);
    
    if (processedData) {
      setChartData(processedData);
      
      // Create charts
      setTimeout(() => {
        createCaloriesChart(processedData);
        createDistanceChart(processedData);
        createHeartRateChart(processedData);
      }, 100);
      
      // Cache the chart data for future use
      try {
        await fetch('/api/chart-cache', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chartData: processedData,
            generatedAt: new Date().toISOString()
          })
        });
        console.log('📊 Chart data cached successfully');
      } catch (cacheError) {
        console.error('❌ Failed to cache chart data:', cacheError);
      }
    }
  };

  // Fetch activities with OPTIMIZED cache-first approach
  const fetchActivities = async (refreshMode: 'cached' | 'today' | 'refresh' = 'cached') => {
    try {
      if (refreshMode !== 'cached') {
        setRefreshing(true);
        setRefreshType(refreshMode === 'today' ? 'today' : '30days');
      } else {
        setLoading(true);
      }

      setError('');
      
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
      
      const apiUrl = `/api/strava?${params.toString()}`;
      console.log('📡 Making API request to:', apiUrl);
      
      const response = await fetch(apiUrl);
      
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
      
      // Log performance info from headers
      const dataSource = response.headers.get('X-Data-Source');
      const apiCalls = response.headers.get('X-API-Calls');
      const isRateLimited = response.headers.get('X-Rate-Limited');
      
      console.log(`📈 Performance: Source=${dataSource}, API calls=${apiCalls}${isRateLimited ? ', Rate Limited' : ''}`);
      
      if (!Array.isArray(data)) {
        console.error('❌ Expected array but got:', typeof data, data);
        throw new Error('Invalid data format received from API');
      }
      
      // Process activities
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
          calories: activity.calories || 0, // Use Strava calories directly
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
        runActivities: sortedActivities.filter(a => a.is_run_activity).length,
        dataSource,
        apiCallsUsed: apiCalls || '0'
      });

      setActivities(sortedActivities);
      setLastUpdate(new Date().toLocaleTimeString());
      
      // Try to load cached chart data first, then create if needed
      await loadOrCreateCharts(sortedActivities, refreshMode !== 'cached' || dataSource?.includes('strava'));

    } catch (error) {
      console.error('❌ Error fetching activities:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch activities');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setRefreshType(null);
    }
  };

  const handleRefreshToday = async () => {
    await fetchActivities('today');
  };

  const handleRefresh30Days = async () => {
    await fetchActivities('refresh');
  };

  const handleRefresh = async () => {
    await fetchActivities('refresh');
  };

  // Load on mount - OPTIMIZED: Cache-first for instant loading
  useEffect(() => {
    fetchActivities('cached'); // Start with cached data for instant loading
    
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
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex flex-col">
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      {/* Detailed Run Analysis Modal */}
      {selectedRunDetail && (
        <RunDetailModal
          activity={selectedRunDetail}
          onClose={() => setSelectedRunDetail(null)}
        />
      )}

      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-green-400/10 to-blue-400/10 animate-pulse"></div>
      <div className="absolute top-20 left-20 w-32 h-32 bg-green-200/30 rounded-full blur-xl animate-bounce"></div>
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
              onClick={handleRefreshToday}
              variant="outline"
              disabled={refreshing}
              className="hover:bg-white/20"
              title="Quick refresh - only checks for today's new activities (1 API call)"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing && refreshType === 'today' ? 'animate-spin' : ''}`} />
              {refreshing && refreshType === 'today' ? 'Checking Today...' : 'Refresh Today'}
            </Button>
            
            <Button 
              onClick={handleRefresh30Days}
              variant="outline"
              disabled={refreshing}
              className="hover:bg-white/20"
              title="Full refresh - fetches all activities from last 30 days (1 API call)"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing && refreshType === '30days' ? 'animate-spin' : ''}`} />
              {refreshing && refreshType === '30days' ? 'Refreshing All...' : 'Refresh 30 Days'}
            </Button>
          </div>
        </div>
        
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-green-600 via-blue-600 to-teal-600 bg-clip-text text-transparent">
            Activity Jam
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Your recent workouts and activities from Strava with optimized loading, smart run tagging and detailed analysis
          </p>
          {lastUpdate && (
            <p className="mt-1 text-sm text-gray-500">
              Last updated: {lastUpdate} • Instant cache-first loading • Click runs for detailed analysis
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
                      <Heart className="h-5 w-5 mr-2 text-teal-500" />
                      Run Heart Rate
                    </CardTitle>
                    <p className="text-xs text-gray-600">Average from running activities only</p>
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
              
              <div className="mobile-grid-4 gap-4">
                <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-green-600 mb-1">
                      {activities.reduce((sum, a) => sum + (a.calories || 0), 0).toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Total Calories</div>
                    <div className="text-xs text-gray-500 mt-1">From Strava (when available)</div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-blue-600 mb-1">
                      {Math.round(activities.reduce((sum, a) => sum + a.distance, 0) * 10) / 10}
                    </div>
                    <div className="text-sm text-gray-600">Total Distance (km)</div>
                    <div className="text-xs text-gray-500 mt-1">All activities</div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-teal-50 to-teal-100 border-teal-200">
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-teal-600 mb-1">
                      {activities.filter(a => a.is_run_activity).length}
                    </div>
                    <div className="text-sm text-gray-600">Running Activities</div>
                    <div className="text-xs text-gray-500 mt-1">Click for details</div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-emerald-50 to-emerald-100 border-emerald-200">
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-emerald-600 mb-1">
                      {activities.length}
                    </div>
                    <div className="text-sm text-gray-600">Total Activities</div>
                    <div className="text-xs text-gray-500 mt-1">Last 30 days</div>
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
                    <span>Click run tags to edit • Click runs for detailed analysis</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {RUN_TAG_OPTIONS.map(option => (
                      <Badge key={option.value} variant="outline" className={`text-xs ${option.color} ${option.bgColor}`}>
                        {option.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activities.map((activity) => (
                  <Card 
                    key={activity.id} 
                    className={`bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm transition-all duration-200 ${
                      activity.is_run_activity 
                        ? 'hover:shadow-lg hover:scale-105 cursor-pointer hover:border-blue-300' 
                        : 'hover:shadow-md'
                    }`}
                    onClick={() => activity.is_run_activity && handleRunClick(activity)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg font-semibold text-gray-800 leading-tight flex items-center gap-2">
                          {activity.name}
                          {activity.is_run_activity && (
                            <ChevronRight className="h-4 w-4 text-blue-500" />
                          )}
                        </CardTitle>
                        <div className="flex flex-col gap-1">
                          <Badge variant="secondary" className="ml-2 shrink-0">
                            {activity.type}
                          </Badge>
                          {activity.is_run_activity && (
                            <Badge variant="outline" className="ml-2 shrink-0 text-xs bg-blue-50 text-blue-700 border-blue-200">
                              Click for analysis
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
                                  className={`text-xs cursor-pointer transition-all duration-200 ${getRunTagOption(activity.run_tag).color} ${getRunTagOption(activity.run_tag).bgColor} hover:bg-opacity-80`}
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
            <span>⚡ Optimized cache-first loading</span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <Tag className="h-4 w-4" />
              Smart run tagging with manual editing
            </span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <Route className="h-4 w-4" />
              Click runs for detailed km-by-km analysis
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>Updated: {new Date().toLocaleDateString()}</span>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${chartData ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`}></div>
              <span className="text-xs">{chartData ? 'Charts Ready' : 'Loading Charts'}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-xs">Minimal API Usage</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ActivityJam;
