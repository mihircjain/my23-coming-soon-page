// Fixed ActivityJam.tsx - Proper Firestore tagging + Charts + Better colors

import { useState, useEffect, useRef } from "react";
import { ArrowLeft, RefreshCw, Calendar, Clock, Zap, Heart, Activity, BarChart3, Tag, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import Chart from 'chart.js/auto';
import { db } from '@/lib/firebaseConfig';
import { collection, query, where, orderBy, limit, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';

const userId = "mihir_jain";

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
  runType?: string;
  taggedAt?: string;
  userOverride?: boolean;
}

// Chart refs
const caloriesChartRef = useRef<HTMLCanvasElement>(null);
const distanceChartRef = useRef<HTMLCanvasElement>(null);
const heartRateChartRef = useRef<HTMLCanvasElement>(null);
const chartInstances = useRef<{ [key: string]: Chart }>({});

// Run classification algorithm
const classifyRun = (activity: ActivityData) => {
  if (!activity.distance || !activity.moving_time) {
    return { type: 'easy', confidence: 0.3, reason: 'Insufficient data - suggesting easy run' };
  }
  
  const pace = (activity.moving_time / 60) / activity.distance; // min/km
  const hr = activity.average_heartrate || 0;
  const distance = activity.distance;
  
  if (distance >= 15) {
    return { type: 'long', confidence: 0.9, reason: `${distance.toFixed(1)}km indicates long run distance` };
  }
  
  if (pace < 4.5 || hr > 175) {
    return { type: 'interval', confidence: 0.8, reason: `Fast pace (${pace.toFixed(2)} min/km)${hr > 175 ? ` and high HR (${hr} bpm)` : ''}` };
  }
  
  if (pace >= 4.3 && pace <= 5.5 && hr >= 160 && hr <= 180) {
    return { type: 'tempo', confidence: 0.75, reason: `Sustained moderate-hard effort (${pace.toFixed(2)} min/km, ${hr} bpm)` };
  }
  
  if (pace > 6.5 || (hr > 0 && hr < 140)) {
    return { type: 'recovery', confidence: 0.7, reason: `Very easy effort (${pace.toFixed(2)} min/km${hr > 0 ? `, ${hr} bpm` : ''})` };
  }
  
  return { type: 'easy', confidence: 0.6, reason: `Moderate effort (${pace.toFixed(2)} min/km) - typical easy run` };
};

// Run tagging component with better colors matching the site theme
const RunTaggingWidget: React.FC<{
  activity: ActivityData,
  onTagRun: (activityId: string, runType: string) => void,
  isTagging: boolean
}> = ({ activity, onTagRun, isTagging }) => {
  const [showTagging, setShowTagging] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('');
  
  // Better colors matching the site theme
  const runTypes = [
    { 
      value: 'easy', 
      label: 'Easy', 
      color: 'bg-emerald-100 text-emerald-800 border-emerald-300', 
      hoverColor: 'hover:bg-emerald-200',
      icon: '🟢' 
    },
    { 
      value: 'tempo', 
      label: 'Tempo', 
      color: 'bg-orange-100 text-orange-800 border-orange-300', 
      hoverColor: 'hover:bg-orange-200',
      icon: '🟠' 
    },
    { 
      value: 'interval', 
      label: 'Intervals', 
      color: 'bg-red-100 text-red-800 border-red-300', 
      hoverColor: 'hover:bg-red-200',
      icon: '🔴' 
    },
    { 
      value: 'long', 
      label: 'Long', 
      color: 'bg-blue-100 text-blue-800 border-blue-300', 
      hoverColor: 'hover:bg-blue-200',
      icon: '🔵' 
    },
    { 
      value: 'recovery', 
      label: 'Recovery', 
      color: 'bg-gray-100 text-gray-800 border-gray-300', 
      hoverColor: 'hover:bg-gray-200',
      icon: '⚪' 
    },
    { 
      value: 'race', 
      label: 'Race', 
      color: 'bg-purple-100 text-purple-800 border-purple-300', 
      hoverColor: 'hover:bg-purple-200',
      icon: '🟣' 
    }
  ];
  
  const suggestion = classifyRun(activity);
  const suggestedType = runTypes.find(t => t.value === suggestion.type);
  
  const handleTag = async (runType: string) => {
    setSelectedType(runType);
    try {
      await onTagRun(activity.id, runType);
      setShowTagging(false);
    } catch (error) {
      console.error('Failed to tag run:', error);
    }
  };
  
  if (activity.runType) {
    // Already tagged - show the tag
    const taggedType = runTypes.find(t => t.value === activity.runType);
    return (
      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="h-3 w-3 text-green-600" />
            <span className="text-xs text-gray-600">Run Type:</span>
            <Badge variant="outline" className={`text-xs ${taggedType?.color} border`}>
              {taggedType?.icon} {taggedType?.label}
            </Badge>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs text-gray-500 hover:text-gray-700"
            onClick={() => setShowTagging(true)}
          >
            Change
          </Button>
        </div>
        
        {showTagging && (
          <div className="mt-2 p-3 bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg border border-orange-200">
            <div className="text-xs text-gray-600 mb-2">
              <span className="font-medium">AI suggests:</span> {suggestion.reason}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {runTypes.map((type) => (
                <Button
                  key={type.value}
                  size="sm"
                  variant="outline"
                  className={`text-xs h-auto p-2 ${type.color} ${type.hoverColor} border transition-all duration-150 ${
                    suggestion.type === type.value ? 'ring-2 ring-orange-300' : ''
                  }`}
                  onClick={() => handleTag(type.value)}
                  disabled={isTagging && selectedType === type.value}
                >
                  <div className="text-center">
                    <div className="text-sm mb-1">{type.icon}</div>
                    <div className="font-medium">{type.label}</div>
                    {isTagging && selectedType === type.value && (
                      <div className="text-xs text-blue-600 mt-1">Saving...</div>
                    )}
                  </div>
                </Button>
              ))}
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="w-full mt-2 text-xs"
              onClick={() => setShowTagging(false)}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    );
  }
  
  // Not tagged yet - show tagging interface
  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      {!showTagging ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="h-3 w-3 text-orange-600" />
            <span className="text-xs text-gray-600">Tag this run:</span>
            <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">
              {suggestedType?.icon} AI: {suggestedType?.label}
            </Badge>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-xs border-orange-300 text-orange-700 hover:bg-orange-50"
            onClick={() => setShowTagging(true)}
          >
            Tag Run
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-gray-600 p-2 bg-orange-50 rounded border border-orange-200">
            <span className="font-medium">AI suggests:</span> {suggestion.reason}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {runTypes.map((type) => (
              <Button
                key={type.value}
                size="sm"
                variant="outline"
                className={`text-xs h-auto p-2 ${type.color} ${type.hoverColor} border transition-all duration-150 ${
                  suggestion.type === type.value ? 'ring-2 ring-orange-300' : ''
                }`}
                onClick={() => handleTag(type.value)}
                disabled={isTagging && selectedType === type.value}
              >
                <div className="text-center">
                  <div className="text-sm mb-1">{type.icon}</div>
                  <div className="font-medium">{type.label}</div>
                  {isTagging && selectedType === type.value && (
                    <div className="text-xs text-blue-600 mt-1">Saving...</div>
                  )}
                </div>
              </Button>
            ))}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="w-full text-xs"
            onClick={() => setShowTagging(false)}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
};

const ActivityJam = () => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isTagging, setIsTagging] = useState(false);

  const isRunActivity = (activityType: string): boolean => {
    const runTypes = ['run', 'virtualrun', 'treadmill', 'trail'];
    return runTypes.some(type => 
      activityType.toLowerCase().includes(type.toLowerCase())
    );
  };

  // Process chart data
  const processChartData = (activities: ActivityData[]) => {
    const sortedActivities = [...activities].sort((a, b) => 
      new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    );

    const dailyData = new Map();

    sortedActivities.forEach(activity => {
      const date = activity.start_date.split('T')[0];
      
      if (!dailyData.has(date)) {
        dailyData.set(date, {
          calories: 0,
          distance: 0,
          runHeartRateCount: 0,
          totalRunHeartRate: 0
        });
      }

      const dayData = dailyData.get(date);
      
      dayData.calories += activity.calories || 0;
      dayData.distance += activity.distance || 0;

      if (activity.is_run_activity && activity.has_heartrate && activity.average_heartrate) {
        dayData.totalRunHeartRate += activity.average_heartrate;
        dayData.runHeartRateCount += 1;
      }
    });

    const dates = Array.from(dailyData.keys()).sort();
    const labels = dates.map(date => new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    }));

    return {
      labels: dates,
      displayLabels: labels,
      calories: dates.map(date => dailyData.get(date).calories),
      distance: dates.map(date => Math.round(dailyData.get(date).distance * 10) / 10),
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

  // Create charts
  const createCharts = (activities: ActivityData[]) => {
    if (activities.length === 0) return;

    destroyCharts();
    
    const chartData = processChartData(activities);
    
    setTimeout(() => {
      createCaloriesChart(chartData);
      createDistanceChart(chartData);
      createRunHeartRateChart(chartData);
    }, 100);
  };

  // Create calories chart
  const createCaloriesChart = (chartData: any) => {
    if (!caloriesChartRef.current) return;

    const ctx = caloriesChartRef.current.getContext('2d');
    if (!ctx) return;

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

  // Create run heart rate chart
  const createRunHeartRateChart = (chartData: any) => {
    if (!heartRateChartRef.current) return;

    const ctx = heartRateChartRef.current.getContext('2d');
    if (!ctx) return;

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

  // FIXED: Better Firestore tagging with proper activity lookup
  const handleTagRun = async (activityId: string, runType: string) => {
    setIsTagging(true);
    try {
      console.log(`🏷️ Tagging run ${activityId} as ${runType}`);
      
      // Try multiple approaches to find the activity in Firestore
      const stravaDataRef = collection(db, "strava_data");
      
      // First try: exact ID match as string
      let activityQuery = query(
        stravaDataRef,
        where("userId", "==", userId),
        where("id", "==", activityId)
      );
      
      let querySnapshot = await getDocs(activityQuery);
      
      // Second try: ID as number
      if (querySnapshot.empty) {
        console.log('Trying ID as number...');
        activityQuery = query(
          stravaDataRef,
          where("userId", "==", userId),
          where("id", "==", parseInt(activityId))
        );
        querySnapshot = await getDocs(activityQuery);
      }
      
      // Third try: find by activity name and date (fallback)
      if (querySnapshot.empty) {
        console.log('Trying name and date lookup...');
        const activity = activities.find(a => a.id === activityId);
        if (activity) {
          activityQuery = query(
            stravaDataRef,
            where("userId", "==", userId),
            where("name", "==", activity.name),
            where("start_date", "==", activity.start_date)
          );
          querySnapshot = await getDocs(activityQuery);
        }
      }
      
      if (!querySnapshot.empty) {
        const activityDoc = querySnapshot.docs[0];
        await updateDoc(activityDoc.ref, {
          runType: runType,
          taggedAt: new Date().toISOString(),
          userOverride: true
        });
        
        console.log('✅ Run tagged successfully in Firestore');
        
        // Update local state
        setActivities(prev => 
          prev.map(activity => 
            activity.id === activityId 
              ? { ...activity, runType, taggedAt: new Date().toISOString(), userOverride: true }
              : activity
          )
        );
      } else {
        // If still not found, let's debug what we have
        console.log('🔍 Activity not found. Debug info:');
        console.log('Looking for ID:', activityId, 'Type:', typeof activityId);
        console.log('Available activities:', activities.slice(0, 3).map(a => ({ id: a.id, name: a.name })));
        throw new Error('Activity not found in Firestore. Please refresh and try again.');
      }
      
    } catch (error) {
      console.error('❌ Error tagging run in Firestore:', error);
      alert(`Failed to tag run: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTagging(false);
    }
  };

  // Fetch activities from Firestore
  const fetchActivities = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');
      
      console.log('🏃 Fetching activities from Firestore...');
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const stravaDataRef = collection(db, "strava_data");
      const stravaQuery = query(
        stravaDataRef,
        where("userId", "==", userId),
        where("start_date", ">=", thirtyDaysAgo.toISOString()),
        orderBy("start_date", "desc"),
        limit(50)
      );
      
      const stravaSnapshot = await getDocs(stravaQuery);
      
      if (!stravaSnapshot.empty) {
        const processedActivities = stravaSnapshot.docs.map(doc => {
          const activity = doc.data();
          const activityType = activity.type || 'Activity';
          const isRun = isRunActivity(activityType);

          return {
            id: activity.id?.toString() || doc.id, // Use doc.id as fallback
            name: activity.name || 'Unnamed Activity',
            type: activityType,
            start_date: activity.start_date,
            distance: activity.distance || 0,
            moving_time: activity.moving_time || activity.duration * 60 || 0,
            total_elevation_gain: activity.total_elevation_gain || activity.elevation_gain || 0,
            average_speed: activity.average_speed || 0,
            max_speed: activity.max_speed || 0,
            has_heartrate: activity.has_heartrate || false,
            average_heartrate: activity.average_heartrate || activity.heart_rate,
            max_heartrate: activity.max_heartrate,
            calories: activity.calories || 0,
            is_run_activity: isRun,
            runType: activity.runType || null,
            taggedAt: activity.taggedAt || null,
            userOverride: activity.userOverride || false
          };
        });

        const sortedActivities = processedActivities.sort((a: ActivityData, b: ActivityData) => 
          new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
        );

        console.log('🏃 Activities loaded:', {
          total: sortedActivities.length,
          runs: sortedActivities.filter(a => a.is_run_activity).length,
          tagged: sortedActivities.filter(a => a.is_run_activity && a.runType).length
        });

        setActivities(sortedActivities);
        setLastUpdate(new Date().toLocaleTimeString());
        
        // Create charts
        createCharts(sortedActivities);

      } else {
        setActivities([]);
      }

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

  useEffect(() => {
    fetchActivities(false);
    
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
            🏃‍♂️ Activity Jam
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Your training activities with run tagging for better analysis
          </p>
          {lastUpdate && (
            <div className="mt-2 flex items-center justify-center gap-2">
              <Badge variant="secondary" className="text-xs">Last updated: {lastUpdate}</Badge>
              <Badge variant="secondary" className="text-xs">Firestore Connected</Badge>
              <Badge variant="secondary" className="text-xs">
                {activities.filter(a => a.is_run_activity && a.runType).length}/{activities.filter(a => a.is_run_activity).length} runs tagged
              </Badge>
            </div>
          )}
        </div>
      </header>
      
      {/* Main content */}
      <main className="relative z-10 px-6 md:px-12 py-8">
        {loading ? (
          <div className="space-y-8">
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="bg-white/80 backdrop-blur-sm border border-white/20">
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                      </div>
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-8 w-full" />
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
                <Badge variant="outline" className="ml-3 text-xs">
                  Enhanced with run tagging
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                      <canvas ref={heartRateChartRef} className="w-full h-full"></canvas>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Quick Stats */}
            <section>
              <div className="flex items-center mb-6">
                <Target className="h-6 w-6 mr-3 text-gray-600" />
                <h2 className="text-2xl font-semibold text-gray-800">Training Overview</h2>
                <Badge variant="outline" className="ml-3 text-xs">
                  Run tagging enabled
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {activities.length}
                    </div>
                    <div className="text-xs text-gray-600">Total Activities</div>
                  </CardContent>
                </Card>
                
                <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {activities.filter(a => a.is_run_activity).length}
                    </div>
                    <div className="text-xs text-gray-600">Running Activities</div>
                  </CardContent>
                </Card>
                
                <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {activities.filter(a => a.is_run_activity && a.runType).length}
                    </div>
                    <div className="text-xs text-gray-600">Tagged Runs</div>
                  </CardContent>
                </Card>
                
                <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {activities.filter(a => a.is_run_activity && !a.runType).length}
                    </div>
                    <div className="text-xs text-gray-600">Need Tagging</div>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Activities List */}
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
                        <div className="flex flex-col gap-1">
                          <Badge variant="secondary" className="ml-2 shrink-0">
                            {activity.type}
                          </Badge>
                          {activity.is_run_activity && (
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
                        {activity.has_heartrate && activity.average_heartrate && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Avg HR:</span>
                            <span className="font-medium flex items-center">
                              <Heart className="h-3 w-3 mr-1 text-red-500" />
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
                      </div>
                      
                      {/* Run Tagging Widget - Only for runs */}
                      {activity.is_run_activity && (
                        <RunTaggingWidget
                          activity={activity}
                          onTagRun={handleTagRun}
                          isTagging={isTagging}
                        />
                      )}
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
                    30-Day Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                    <div className="p-3 bg-white/60 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {activities.filter(a => a.calories && a.calories > 0).length}
                      </div>
                      <div className="text-xs text-gray-600">Activities with calories</div>
                    </div>
                    <div className="p-3 bg-white/60 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">
                        {activities.reduce((sum, a) => sum + (a.calories || 0), 0).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-600">Total calories burned</div>
                    </div>
                    <div className="p-3 bg-white/60 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {activities.filter(a => a.is_run_activity).length}
                      </div>
                      <div className="text-xs text-gray-600">Running activities</div>
                    </div>
                    <div className="p-3 bg-white/60 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {activities.filter(a => a.is_run_activity && a.has_heartrate).length}
                      </div>
                      <div className="text-xs text-gray-600">Runs with HR data</div>
                    </div>
                  </div>
                  
                  <div className="mt-6 p-4 bg-white/60 rounded-lg border border-white/30">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <Tag className="h-4 w-4 text-orange-500" />
                      Run Tagging Status
                    </h4>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p>✅ Run tagging available in each running activity card</p>
                      <p>✅ AI suggestions based on pace, distance, and heart rate</p>
                      <p>✅ All tags automatically saved to Firestore</p>
                      <p>💡 Tag your runs to get better training analysis in Let's Jam</p>
                      {activities.filter(a => a.is_run_activity && !a.runType).length > 0 && (
                        <p className="text-orange-600 font-medium">
                          🏷️ {activities.filter(a => a.is_run_activity && !a.runType).length} runs still need tagging
                        </p>
                      )}
                    </div>
                  </div>
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
            <span>🏷️ Tag runs for better training analysis</span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <Heart className="h-4 w-4" />
              HR data from runs only
            </span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Firestore storage
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>
              {activities.filter(a => a.is_run_activity && a.runType).length}/{activities.filter(a => a.is_run_activity).length} runs tagged
            </span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs">Charts + Tags Ready</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ActivityJam;
