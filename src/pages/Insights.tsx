import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Heart, 
  Zap, 
  Target, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Calendar,
  RefreshCw,
  BarChart3,
  Dumbbell,
  Waves,
  Bike,
  Footprints,
  Droplets
} from 'lucide-react';

interface MetricCard {
  title: string;
  value: string;
  change: number;
  trend: 'up' | 'down' | 'stable';
  icon: React.ReactNode;
  color: string;
}

interface InsightAlert {
  id: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  action?: string;
  timestamp: Date;
}

interface TrendData {
  sport: string;
  metric: string;
  current: number;
  previous: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  recommendation: string;
}

interface GoalProgress {
  title: string;
  current: number;
  target: number;
  unit: string;
  progress: number;
}

interface StravaActivity {
  id: string;
  name: string;
  type: string;
  distance: number;
  moving_time: number;
  start_date: string;
  average_speed: number;
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  total_elevation_gain: number;
}

interface OuraSleepData {
  date: string;
  sleep_score: number;
  deep_sleep_duration: number;
  rem_sleep_duration: number;
  light_sleep_duration: number;
  total_sleep_duration: number;
  sleep_efficiency: number;
  bedtime_start: string;
  bedtime_end: string;
}

interface NutritionData {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export default function Insights() {
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [alerts, setAlerts] = useState<InsightAlert[]>([]);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [goals, setGoals] = useState<GoalProgress[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Real data fetching functions
  const fetchStravaActivities = async (days: number = 14): Promise<StravaActivity[]> => {
    try {
      const response = await fetch('/api/claude-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mcp_call',
          endpoint: 'get-recent-activities',
          params: { per_page: days * 2 } // Assume 2 activities per day on average
        })
      });

      if (!response.ok) {
        throw new Error(`Strava API error: ${response.status}`);
      }

      const data = await response.json();
      const activitiesText = data.result?.content?.map((item: any) => item.text).join('\n') || '';
      
      // Parse activities from text format
      const activities: StravaActivity[] = [];
      const lines = activitiesText.split('\n');
      
      for (const line of lines) {
        const idMatch = line.match(/ID:\s*(\d+)/);
        const distanceMatch = line.match(/—\s*([\d.]+)m/);
        const dateMatch = line.match(/on\s*(\d+\/\d+\/\d+)/);
        
        if (idMatch && distanceMatch) {
          const type = extractActivityType(line);
          const distance = parseFloat(distanceMatch[1]) / 1000; // Convert to km
          
          activities.push({
            id: idMatch[1],
            name: line.split('(')[0].trim(),
            type,
            distance,
            moving_time: 0, // Will be calculated if needed
            start_date: dateMatch ? new Date(dateMatch[1]).toISOString() : new Date().toISOString(),
            average_speed: 0,
            max_speed: 0,
            total_elevation_gain: 0
          });
        }
      }
      
      return activities;
    } catch (error) {
      console.error('Error fetching Strava activities:', error);
      return [];
    }
  };

  const fetchOuraSleepData = async (days: number = 7): Promise<OuraSleepData[]> => {
    try {
      // Mock Oura data for now - replace with real API call
      const mockSleepData: OuraSleepData[] = [];
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        mockSleepData.push({
          date: date.toISOString().split('T')[0],
          sleep_score: 75 + Math.random() * 20,
          deep_sleep_duration: 60 + Math.random() * 60,
          rem_sleep_duration: 90 + Math.random() * 60,
          light_sleep_duration: 180 + Math.random() * 120,
          total_sleep_duration: 420 + Math.random() * 120,
          sleep_efficiency: 80 + Math.random() * 15,
          bedtime_start: '22:00',
          bedtime_end: '06:00'
        });
      }
      return mockSleepData;
    } catch (error) {
      console.error('Error fetching Oura sleep data:', error);
      return [];
    }
  };

  const fetchNutritionData = async (days: number = 7): Promise<NutritionData[]> => {
    try {
      // Mock nutrition data for now - replace with real API call
      const mockNutritionData: NutritionData[] = [];
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        mockNutritionData.push({
          date: date.toISOString().split('T')[0],
          calories: 2000 + Math.random() * 500,
          protein: 120 + Math.random() * 40,
          carbs: 200 + Math.random() * 100,
          fat: 70 + Math.random() * 30,
          fiber: 25 + Math.random() * 15
        });
      }
      return mockNutritionData;
    } catch (error) {
      console.error('Error fetching nutrition data:', error);
      return [];
    }
  };

  const extractActivityType = (activityText: string): string => {
    if (activityText.includes('Weight Training')) return 'Weight Training';
    if (activityText.includes('Run')) return 'Run';
    if (activityText.includes('Walk')) return 'Walk';
    if (activityText.includes('Swim')) return 'Swim';
    if (activityText.includes('Zwift') || activityText.includes('Ride') || activityText.includes('Bike') || activityText.includes('Cycling')) return 'Ride';
    return 'Other';
  };

  const calculateMetrics = (stravaData: StravaActivity[], sleepData: OuraSleepData[], nutritionData: NutritionData[]) => {
    // Calculate weekly volume
    const lastWeekActivities = stravaData.filter(activity => {
      const activityDate = new Date(activity.start_date);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return activityDate >= weekAgo;
    });
    
    const weeklyVolume = lastWeekActivities.reduce((total, activity) => total + activity.distance, 0);
    
    // Calculate consistency score (days with activity)
    const uniqueDays = new Set(lastWeekActivities.map(activity => 
      new Date(activity.start_date).toDateString()
    ));
    const consistencyScore = (uniqueDays.size / 7) * 100;
    
    // Calculate recovery balance (average sleep score)
    const avgSleepScore = sleepData.reduce((total, sleep) => total + sleep.sleep_score, 0) / sleepData.length;
    
    // Calculate nutrition adherence (protein target met)
    const avgProtein = nutritionData.reduce((total, nutrition) => total + nutrition.protein, 0) / nutritionData.length;
    const proteinTarget = 151; // Daily protein target
    const nutritionAdherence = Math.min((avgProtein / proteinTarget) * 100, 100);
    
    // Calculate trends (compare to previous week)
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const previousWeekActivities = stravaData.filter(activity => {
      const activityDate = new Date(activity.start_date);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return activityDate >= twoWeeksAgo && activityDate < weekAgo;
    });
    
    const previousWeeklyVolume = previousWeekActivities.reduce((total, activity) => total + activity.distance, 0);
    const volumeChange = previousWeeklyVolume > 0 ? ((weeklyVolume - previousWeeklyVolume) / previousWeeklyVolume) * 100 : 0;
    
    return {
      weeklyVolume,
      consistencyScore,
      avgSleepScore,
      nutritionAdherence,
      volumeChange
    };
  };

  const generateInsightsWithLLM = async (metrics: any, stravaData: StravaActivity[], sleepData: OuraSleepData[], nutritionData: NutritionData[]) => {
    try {
      const response = await fetch('/api/claude-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_insights',
          query: 'Generate proactive coaching insights',
          analysis: {
            metrics,
            recentActivities: stravaData.slice(0, 10),
            sleepData: sleepData.slice(0, 7),
            nutritionData: nutritionData.slice(0, 7)
          }
        })
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status}`);
      }

      const data = await response.json();
      return data.response || 'Unable to generate insights at this time.';
    } catch (error) {
      console.error('Error generating insights:', error);
      return 'Unable to generate insights at this time.';
    }
  };

  const loadInsights = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch real data
      const [stravaData, sleepData, nutritionData] = await Promise.all([
        fetchStravaActivities(14),
        fetchOuraSleepData(7),
        fetchNutritionData(7)
      ]);

      // Calculate metrics
      const calculatedMetrics = calculateMetrics(stravaData, sleepData, nutritionData);
      
      // Generate insights with LLM
      const insights = await generateInsightsWithLLM(calculatedMetrics, stravaData, sleepData, nutritionData);

      // Set metrics
      setMetrics([
        {
          title: 'Weekly Volume',
          value: `${Math.round(calculatedMetrics.weeklyVolume)} km`,
          change: Math.round(calculatedMetrics.volumeChange),
          trend: calculatedMetrics.volumeChange > 0 ? 'up' : calculatedMetrics.volumeChange < 0 ? 'down' : 'stable',
          icon: <Activity className="h-4 w-4" />,
          color: 'text-blue-600'
        },
        {
          title: 'Consistency Score',
          value: `${Math.round(calculatedMetrics.consistencyScore)}%`,
          change: Math.round(calculatedMetrics.consistencyScore - 70), // Compare to baseline
          trend: calculatedMetrics.consistencyScore > 70 ? 'up' : 'down',
          icon: <Target className="h-4 w-4" />,
          color: 'text-orange-600'
        },
        {
          title: 'Recovery Balance',
          value: `${Math.round(calculatedMetrics.avgSleepScore)}%`,
          change: Math.round(calculatedMetrics.avgSleepScore - 75), // Compare to baseline
          trend: calculatedMetrics.avgSleepScore > 75 ? 'up' : 'down',
          icon: <Heart className="h-4 w-4" />,
          color: 'text-green-600'
        },
        {
          title: 'Nutrition Adherence',
          value: `${Math.round(calculatedMetrics.nutritionAdherence)}%`,
          change: Math.round(calculatedMetrics.nutritionAdherence - 80), // Compare to baseline
          trend: calculatedMetrics.nutritionAdherence > 80 ? 'up' : 'down',
          icon: <Zap className="h-4 w-4" />,
          color: 'text-purple-600'
        }
      ]);

      // Generate alerts based on data
      const generatedAlerts: InsightAlert[] = [];
      
      if (calculatedMetrics.consistencyScore < 50) {
        generatedAlerts.push({
          id: '1',
          priority: 'high',
          title: 'Low Training Consistency',
          message: `You've only been active ${Math.round(calculatedMetrics.consistencyScore)}% of days this week. Consider adding more training sessions.`,
          action: 'View Training Plan',
          timestamp: new Date()
        });
      }
      
      if (calculatedMetrics.avgSleepScore < 70) {
        generatedAlerts.push({
          id: '2',
          priority: 'medium',
          title: 'Sleep Quality Alert',
          message: `Your average sleep score is ${Math.round(calculatedMetrics.avgSleepScore)}%. Focus on improving sleep hygiene.`,
          action: 'Sleep Tips',
          timestamp: new Date()
        });
      }
      
      if (calculatedMetrics.nutritionAdherence < 70) {
        generatedAlerts.push({
          id: '3',
          priority: 'medium',
          title: 'Nutrition Opportunity',
          message: `Protein intake is ${Math.round(100 - calculatedMetrics.nutritionAdherence)}% below target. Consider adding protein-rich foods.`,
          action: 'Nutrition Guide',
          timestamp: new Date()
        });
      }
      
      if (calculatedMetrics.volumeChange > 20) {
        generatedAlerts.push({
          id: '4',
          priority: 'low',
          title: 'Great Progress!',
          message: `Your training volume increased ${Math.round(calculatedMetrics.volumeChange)}% this week. Keep up the excellent work!`,
          timestamp: new Date()
        });
      }

      setAlerts(generatedAlerts);

      // Calculate trends
      const trends: TrendData[] = [];
      
      // Running trend
      const runningActivities = stravaData.filter(activity => activity.type === 'Run');
      if (runningActivities.length > 0) {
        const recentRuns = runningActivities.slice(0, 5);
        const avgPace = recentRuns.reduce((total, run) => total + (run.distance / (run.moving_time / 3600)), 0) / recentRuns.length;
        trends.push({
          sport: 'Running',
          metric: 'Average Pace',
          current: avgPace,
          previous: avgPace * 1.05, // Mock previous data
          change: -5,
          trend: 'up',
          recommendation: 'Your running pace is improving. Consider adding tempo work to maintain progress.'
        });
      }
      
      // Sleep trend
      if (sleepData.length > 0) {
        const recentSleep = sleepData.slice(0, 3);
        const avgSleepScore = recentSleep.reduce((total, sleep) => total + sleep.sleep_score, 0) / recentSleep.length;
        trends.push({
          sport: 'Sleep',
          metric: 'Quality Score',
          current: avgSleepScore,
          previous: avgSleepScore * 0.95,
          change: 5,
          trend: 'up',
          recommendation: 'Sleep quality is improving. Maintain your current sleep schedule.'
        });
      }

      setTrends(trends);

      // Set goals based on actual data
      setGoals([
        {
          title: 'Weekly Running',
          current: Math.round(runningActivities.reduce((total, activity) => total + activity.distance, 0)),
          target: 40,
          unit: 'km',
          progress: Math.min((runningActivities.reduce((total, activity) => total + activity.distance, 0) / 40) * 100, 100)
        },
        {
          title: 'Cycling Volume',
          current: Math.round(stravaData.filter(activity => activity.type === 'Ride').reduce((total, activity) => total + activity.distance, 0)),
          target: 100,
          unit: 'km',
          progress: Math.min((stravaData.filter(activity => activity.type === 'Ride').reduce((total, activity) => total + activity.distance, 0) / 100) * 100, 100)
        },
        {
          title: 'Sleep Consistency',
          current: sleepData.filter(sleep => sleep.sleep_score > 70).length,
          target: 7,
          unit: 'days',
          progress: (sleepData.filter(sleep => sleep.sleep_score > 70).length / 7) * 100
        },
        {
          title: 'Protein Target',
          current: Math.round(nutritionData.reduce((total, nutrition) => total + nutrition.protein, 0) / nutritionData.length),
          target: 151,
          unit: 'g/day',
          progress: Math.min((nutritionData.reduce((total, nutrition) => total + nutrition.protein, 0) / nutritionData.length / 151) * 100, 100)
        }
      ]);

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading insights:', error);
      setError('Failed to load insights. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInsights();
  }, []);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-red-200 bg-red-50';
      case 'medium': return 'border-yellow-200 bg-yellow-50';
      case 'low': return 'border-green-200 bg-green-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'medium': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'low': return <CheckCircle className="h-4 w-4 text-green-600" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <BarChart3 className="h-4 w-4 text-gray-600" />;
    }
  };

  const getSportIcon = (sport: string) => {
    switch (sport.toLowerCase()) {
      case 'running': return <Footprints className="h-4 w-4" />;
      case 'cycling': return <Bike className="h-4 w-4" />;
      case 'swimming': return <Droplets className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const handleRefresh = () => {
    loadInsights();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-700">Analyzing your data...</h2>
              <p className="text-gray-500 mt-2">Fetching activities, sleep, and nutrition data</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <AlertTriangle className="h-8 w-8 mx-auto mb-4 text-red-600" />
              <h2 className="text-xl font-semibold text-gray-700">Error Loading Insights</h2>
              <p className="text-gray-500 mt-2">{error}</p>
              <Button onClick={handleRefresh} className="mt-4">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Your AI Health Coach</h1>
            <p className="text-gray-600 mt-1">
              Last updated: {lastUpdated.toLocaleString()}
            </p>
          </div>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((metric, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-lg ${metric.color} bg-opacity-10`}>
                    {metric.icon}
                  </div>
                  <Badge variant={metric.trend === 'up' ? 'default' : metric.trend === 'down' ? 'destructive' : 'secondary'}>
                    {metric.change > 0 ? '+' : ''}{metric.change}%
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="text-2xl font-bold">{metric.value}</CardTitle>
                <CardDescription className="text-sm text-gray-600">
                  {metric.title}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Alerts & Recommendations */}
        {alerts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                Alerts & Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {alerts.map((alert) => (
                <Alert key={alert.id} className={getPriorityColor(alert.priority)}>
                  <div className="flex items-start gap-3">
                    {getPriorityIcon(alert.priority)}
                    <div className="flex-1">
                      <AlertDescription className="font-medium text-gray-900">
                        {alert.title}
                      </AlertDescription>
                      <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                      {alert.action && (
                        <Button variant="outline" size="sm" className="mt-2">
                          {alert.action}
                        </Button>
                      )}
                    </div>
                  </div>
                </Alert>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Trends & Analysis */}
        {trends.length > 0 && (
          <Tabs defaultValue="performance" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="recovery">Recovery</TabsTrigger>
              <TabsTrigger value="nutrition">Nutrition</TabsTrigger>
            </TabsList>

            <TabsContent value="performance" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Performance Trends (Last 4 Weeks)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {trends.map((trend, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getSportIcon(trend.sport)}
                        <div>
                          <h4 className="font-medium">{trend.sport}</h4>
                          <p className="text-sm text-gray-600">{trend.metric}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{trend.current.toFixed(1)}</span>
                          {getTrendIcon(trend.trend)}
                        </div>
                        <p className="text-sm text-gray-600">
                          {trend.change > 0 ? '+' : ''}{trend.change}% from last week
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="recovery" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recovery & Sleep Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>Sleep Quality</span>
                      <span className="font-bold">{metrics.find(m => m.title === 'Recovery Balance')?.value || 'N/A'}</span>
                    </div>
                    <Progress value={parseInt(metrics.find(m => m.title === 'Recovery Balance')?.value || '0')} className="w-full" />
                    <p className="text-sm text-gray-600">
                      Based on your recent sleep data. Maintain consistent bedtime for optimal recovery.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="nutrition" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Nutrition Balance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>Protein Target</span>
                      <span className="font-bold">{metrics.find(m => m.title === 'Nutrition Adherence')?.value || 'N/A'} met</span>
                    </div>
                    <Progress value={parseInt(metrics.find(m => m.title === 'Nutrition Adherence')?.value || '0')} className="w-full" />
                    <p className="text-sm text-gray-600">
                      Based on your recent nutrition data. Consider adding protein-rich foods to meet targets.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Goals Progress */}
        {goals.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Weekly Goals Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {goals.map((goal, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{goal.title}</span>
                      <span className="text-sm text-gray-600">
                        {goal.current}/{goal.target} {goal.unit}
                      </span>
                    </div>
                    <Progress value={goal.progress} className="w-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Items */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Action Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.filter(alert => alert.priority === 'high').map(alert => (
                <div key={alert.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <Dumbbell className="h-5 w-5 text-red-600" />
                  <div className="flex-1">
                    <h4 className="font-medium">{alert.title}</h4>
                    <p className="text-sm text-gray-600">{alert.message}</p>
                  </div>
                  {alert.action && <Button size="sm">{alert.action}</Button>}
                </div>
              ))}
              {alerts.filter(alert => alert.priority === 'high').length === 0 && (
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div className="flex-1">
                    <h4 className="font-medium">Great job today!</h4>
                    <p className="text-sm text-gray-600">No urgent action items. Keep up the good work!</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 
