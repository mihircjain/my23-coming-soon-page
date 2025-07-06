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
  Run,
  Swim
} from 'lucide-react';

interface MetricCard {
  title: string;
  value: string;
  change: number;
  trend: 'up' | 'down' | 'stable';
  icon: React.ReactNode;
  color: string;
}

interface Alert {
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

export default function Insights() {
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [goals, setGoals] = useState<GoalProgress[]>([]);

  // Simulate data loading and processing
  useEffect(() => {
    const loadInsights = async () => {
      setIsLoading(true);
      
      // Simulate API calls and data processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock data - in real implementation, this would come from your APIs
      setMetrics([
        {
          title: 'Weekly Volume',
          value: '85 km',
          change: 12,
          trend: 'up',
          icon: <Activity className="h-4 w-4" />,
          color: 'text-blue-600'
        },
        {
          title: 'Consistency Score',
          value: '78%',
          change: -3,
          trend: 'down',
          icon: <Target className="h-4 w-4" />,
          color: 'text-orange-600'
        },
        {
          title: 'Recovery Balance',
          value: '92%',
          change: 8,
          trend: 'up',
          icon: <Heart className="h-4 w-4" />,
          color: 'text-green-600'
        },
        {
          title: 'Nutrition Adherence',
          value: '85%',
          change: 5,
          trend: 'up',
          icon: <Zap className="h-4 w-4" />,
          color: 'text-purple-600'
        }
      ]);

      setAlerts([
        {
          id: '1',
          priority: 'high',
          title: 'Training Load Alert',
          message: 'You\'ve had 3 high-intensity days in a row. Consider a recovery day tomorrow.',
          action: 'Schedule Recovery',
          timestamp: new Date()
        },
        {
          id: '2',
          priority: 'medium',
          title: 'Nutrition Opportunity',
          message: 'Protein intake is 15g below target. Add a protein shake post-workout.',
          action: 'View Nutrition Plan',
          timestamp: new Date()
        },
        {
          id: '3',
          priority: 'low',
          title: 'Great Progress!',
          message: 'Your running pace improved 4% this week. Keep up the excellent work!',
          timestamp: new Date()
        }
      ]);

      setTrends([
        {
          sport: 'Running',
          metric: 'Average Pace',
          current: 5.02,
          previous: 5.15,
          change: 2.5,
          trend: 'up',
          recommendation: 'Consider adding tempo work to maintain improvement'
        },
        {
          sport: 'Cycling',
          metric: 'Power Output',
          current: 180,
          previous: 185,
          change: -2.7,
          trend: 'down',
          recommendation: 'Focus on recovery and consider FTP test'
        },
        {
          sport: 'Sleep',
          metric: 'Quality Score',
          current: 7.8,
          previous: 7.2,
          change: 8.3,
          trend: 'up',
          recommendation: 'Maintain current sleep schedule'
        }
      ]);

      setGoals([
        {
          title: 'Weekly Running',
          current: 32,
          target: 40,
          unit: 'km',
          progress: 80
        },
        {
          title: 'Cycling Volume',
          current: 150,
          target: 200,
          unit: 'km',
          progress: 75
        },
        {
          title: 'Swimming Distance',
          current: 3,
          target: 5,
          unit: 'km',
          progress: 60
        },
        {
          title: 'Sleep Consistency',
          current: 5,
          target: 7,
          unit: 'days',
          progress: 71
        }
      ]);

      setLastUpdated(new Date());
      setIsLoading(false);
    };

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
      case 'running': return <Run className="h-4 w-4" />;
      case 'cycling': return <Bike className="h-4 w-4" />;
      case 'swimming': return <Swim className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const handleRefresh = () => {
    setIsLoading(true);
    // Simulate refresh
    setTimeout(() => {
      setLastUpdated(new Date());
      setIsLoading(false);
    }, 1000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-700">Analyzing your data...</h2>
              <p className="text-gray-500 mt-2">Gathering insights and trends</p>
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

        {/* Trends & Analysis */}
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
                        <span className="font-bold">{trend.current}</span>
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
                    <span className="font-bold">7.8/10</span>
                  </div>
                  <Progress value={78} className="w-full" />
                  <p className="text-sm text-gray-600">
                    Improved 8.3% from last week. Maintain your 10pm bedtime routine.
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
                    <span className="font-bold">85% met</span>
                  </div>
                  <Progress value={85} className="w-full" />
                  <p className="text-sm text-gray-600">
                    Need 15g more protein daily. Consider adding a protein shake post-workout.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Goals Progress */}
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

        {/* Action Items */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Action Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <Dumbbell className="h-5 w-5 text-blue-600" />
                <div className="flex-1">
                  <h4 className="font-medium">Recovery Day</h4>
                  <p className="text-sm text-gray-600">Light stretching or yoga recommended</p>
                </div>
                <Button size="sm">Complete</Button>
              </div>
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <Waves className="h-5 w-5 text-blue-600" />
                <div className="flex-1">
                  <h4 className="font-medium">Swim Session</h4>
                  <p className="text-sm text-gray-600">30 minutes easy swimming</p>
                </div>
                <Button size="sm">Start</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 
