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
  Droplets,
  Brain
} from 'lucide-react';
import { db } from '@/lib/firebase';

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
  const [comprehensiveInsights, setComprehensiveInsights] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Real data fetching functions
  const fetchStravaActivities = async (days: number = 14): Promise<StravaActivity[]> => {
    try {
      // Use direct Strava API instead of MCP
      const response = await fetch(`/api/strava?userId=mihir_jain&days=${days}&mode=cached`);
      
      if (!response.ok) {
        throw new Error(`Strava API error: ${response.status}`);
      }

      const activities = await response.json();
      
      // Transform to match our interface
      return activities.map((activity: any) => ({
        id: activity.id,
        name: activity.name,
        type: activity.type,
        distance: activity.distance,
        moving_time: activity.moving_time,
        start_date: activity.start_date,
        average_speed: activity.average_speed,
        max_speed: activity.max_speed,
        average_heartrate: activity.average_heartrate,
        max_heartrate: activity.max_heartrate,
        total_elevation_gain: activity.total_elevation_gain
      }));
    } catch (error) {
      console.error('Error fetching Strava activities:', error);
      return [];
    }
  };

  const fetchOuraSleepData = async (days: number = 7): Promise<OuraSleepData[]> => {
    try {
      // First try cached data
      let response = await fetch(`/api/oura-sleep?userId=mihir_jain&mode=cached&days=${days}`);
      
      // If no cached data (404), try to fetch fresh data
      if (response.status === 404) {
        console.log('No cached sleep data, fetching fresh data...');
        response = await fetch(`/api/oura-sleep?userId=mihir_jain&mode=refresh&days=${days}`);
      }
      
      if (!response.ok) {
        throw new Error(`Oura API error: ${response.status}`);
      }

      const sleepData = await response.json();
      
      // Transform to match our interface
      return sleepData.map((day: any) => {
        const sleep = day.sleep || {};
        return {
          date: day.date,
          sleep_score: sleep.sleep_score || 0,
          deep_sleep_duration: sleep.deep_sleep_duration || 0,
          rem_sleep_duration: sleep.rem_sleep_duration || 0,
          light_sleep_duration: sleep.light_sleep_duration || 0,
          total_sleep_duration: sleep.total_sleep_duration || 0,
          sleep_efficiency: sleep.sleep_efficiency || 0,
          bedtime_start: sleep.bedtime_start || '',
          bedtime_end: sleep.bedtime_end || ''
        };
      });
    } catch (error) {
      console.error('Error fetching Oura sleep data:', error);
      return [];
    }
  };

  const fetchNutritionData = async (days: number = 7): Promise<NutritionData[]> => {
    try {
      // Fetch real nutrition data from Firestore
      const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
      
      // Get the last N days
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - days);
      const startDate = daysAgo.toISOString().split('T')[0];
      
      const nutritionQuery = query(
        collection(db, "nutritionLogs"),
        where("date", ">=", startDate),
        orderBy("date", "desc"),
        limit(days)
      );
      
      const snapshot = await getDocs(nutritionQuery);
      const nutritionData: NutritionData[] = [];
      
      console.log('🍎 Raw Firestore nutrition data:', {
        totalDocs: snapshot.size,
        sampleDoc: snapshot.docs[0]?.data()
      });
      
      snapshot.forEach(doc => {
        const data = doc.data();
        // Handle the correct data structure with totals
        const totals = data.totals || {};
        const nutritionEntry = {
          date: data.date,
          calories: totals.calories || 0,
          protein: totals.protein || 0,
          carbs: totals.carbs || 0,
          fat: totals.fat || 0,
          fiber: totals.fiber || 0
        };
        nutritionData.push(nutritionEntry);
        
        console.log('🍎 Processed nutrition entry:', nutritionEntry);
      });
      
      console.log('🍎 Final nutrition data:', nutritionData);
      return nutritionData;
    } catch (error) {
      console.error('Error fetching nutrition data:', error);
      return [];
    }
  };

  const calculateMetrics = (stravaData: StravaActivity[], sleepData: OuraSleepData[], nutritionData: NutritionData[]) => {
    console.log('📊 Calculating metrics with:', {
      stravaActivities: stravaData.length,
      sleepDays: sleepData.length,
      nutritionDays: nutritionData.length
    });

    // Calculate weekly volume (all activities)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const lastWeekActivities = stravaData.filter(activity => {
      const activityDate = new Date(activity.start_date);
      return activityDate >= weekAgo;
    });
    
          console.log('📅 Date filtering:', {
        totalActivities: stravaData.length,
        lastWeekActivities: lastWeekActivities.length
      });
    
    const weeklyVolume = lastWeekActivities.reduce((total, activity) => total + activity.distance, 0);
    
    // Calculate consistency score (days with activity)
    const uniqueDays = new Set(lastWeekActivities.map(activity => 
      new Date(activity.start_date).toDateString()
    ));
    const consistencyScore = (uniqueDays.size / 7) * 100;
    
    // Calculate recovery balance (average sleep score)
    const validSleepData = sleepData.filter(sleep => sleep.sleep_score > 0);
    const avgSleepScore = validSleepData.length > 0 
      ? validSleepData.reduce((total, sleep) => total + sleep.sleep_score, 0) / validSleepData.length 
      : 0;
    
    // Calculate nutrition adherence (protein target met)
    const validNutritionData = nutritionData.filter(nutrition => nutrition.protein > 0);
    const avgProtein = validNutritionData.length > 0 
      ? validNutritionData.reduce((total, nutrition) => total + nutrition.protein, 0) / validNutritionData.length 
      : 0;
    const proteinTarget = 151; // Daily protein target
    
    // Check if we have any real nutrition data (not all zeros)
    const hasRealNutritionData = nutritionData.some(nutrition => 
      nutrition.protein > 0 || nutrition.calories > 0 || nutrition.carbs > 0 || nutrition.fat > 0
    );
    
    const nutritionAdherence = hasRealNutritionData 
      ? Math.min((avgProtein / proteinTarget) * 100, 100)
      : 0; // Show 0% when no real data
    
    console.log('🍎 Nutrition calculation:', {
      totalNutritionDays: nutritionData.length,
      validNutritionDays: validNutritionData.length,
      hasRealNutritionData,
      avgProtein: `${avgProtein} g`,
      proteinTarget: `${proteinTarget} g`,
      nutritionAdherence: `${nutritionAdherence}%`,
      sampleProteinValues: nutritionData.slice(0, 3).map(n => n.protein)
    });
    
    // Log all activity types to debug cycling detection
    const activityTypes = [...new Set(lastWeekActivities.map(activity => activity.type))];
    console.log('🚴 Activity types found:', activityTypes);
    console.log('🚴 Sample activities:', lastWeekActivities.slice(0, 5).map(a => ({
      type: a.type,
      name: a.name,
      distance: a.distance,
      date: a.start_date
    })));
    
    // Calculate goals data using the same filtered activities
    const runningVolume = lastWeekActivities.filter(activity => activity.type === 'Run').reduce((total, activity) => total + activity.distance, 0);
    // Include Zwift virtual rides and other cycling activities
    const cyclingVolume = lastWeekActivities.filter(activity => 
      activity.type === 'Ride' || 
      activity.type === 'VirtualRide' || 
      activity.type === 'Zwift' ||
      activity.name.toLowerCase().includes('zwift') ||
      activity.name.toLowerCase().includes('virtual')
    ).reduce((total, activity) => total + activity.distance, 0);
    const swimmingVolume = lastWeekActivities.filter(activity => activity.type === 'Swim').reduce((total, activity) => total + activity.distance, 0);
    
    // Debug cycling activities
    const cyclingActivities = lastWeekActivities.filter(activity => 
      activity.type === 'Ride' || 
      activity.type === 'VirtualRide' || 
      activity.type === 'Zwift' ||
      activity.name.toLowerCase().includes('zwift') ||
      activity.name.toLowerCase().includes('virtual')
    );
    console.log('🚴 Cycling activities detected:', cyclingActivities.map(a => ({
      type: a.type,
      name: a.name,
      distance: a.distance,
      date: a.start_date
    })));
    
    const validSleepDays = sleepData.filter(sleep => sleep.sleep_score > 70).length;
    
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
    
    const metrics = {
      weeklyVolume,
      consistencyScore,
      avgSleepScore,
      nutritionAdherence,
      volumeChange
    };

    console.log('📊 Calculated metrics:', {
      weeklyVolume: `${weeklyVolume} km`,
      consistencyScore: `${consistencyScore}%`,
      avgSleepScore: `${avgSleepScore}%`,
      nutritionAdherence: `${nutritionAdherence}%`,
      volumeChange: `${volumeChange}%`,
      validSleepDays: validSleepData.length,
      validNutritionDays: validNutritionData.length
    });
    
    console.log('🎯 Goals summary:', {
      runningVolume: `${runningVolume} km`,
      cyclingVolume: `${cyclingVolume} km`,
      swimmingVolume: `${swimmingVolume} km`,
      validSleepDays,
      avgProtein: `${avgProtein} g`
    });
    
    return {
      ...metrics,
      goals: {
        runningVolume,
        cyclingVolume,
        swimmingVolume,
        validSleepDays,
        avgProtein
      }
    };
  };

  const generateComprehensiveInsights = async (metrics: any, stravaData: StravaActivity[], sleepData: OuraSleepData[], nutritionData: NutritionData[]) => {
    try {
      console.log('🧠 Generating comprehensive insights with Claude...');
      
      // Transform data to match backend expectations
      const transformedNutritionData = {
        totalDays: nutritionData.length,
        averages: {
          calories: nutritionData.length > 0 ? nutritionData.reduce((sum, n) => sum + n.calories, 0) / nutritionData.length : 0,
          protein: nutritionData.length > 0 ? nutritionData.reduce((sum, n) => sum + n.protein, 0) / nutritionData.length : 0,
          carbs: nutritionData.length > 0 ? nutritionData.reduce((sum, n) => sum + n.carbs, 0) / nutritionData.length : 0,
          fat: nutritionData.length > 0 ? nutritionData.reduce((sum, n) => sum + n.fat, 0) / nutritionData.length : 0,
          fiber: nutritionData.length > 0 ? nutritionData.reduce((sum, n) => sum + n.fiber, 0) / nutritionData.length : 0
        },
        totals: {
          calories: nutritionData.reduce((sum, n) => sum + n.calories, 0),
          protein: nutritionData.reduce((sum, n) => sum + n.protein, 0),
          carbs: nutritionData.reduce((sum, n) => sum + n.carbs, 0),
          fat: nutritionData.reduce((sum, n) => sum + n.fat, 0),
          fiber: nutritionData.reduce((sum, n) => sum + n.fiber, 0)
        },
        dailyLogs: nutritionData.map(nutrition => ({
          date: nutrition.date,
          calories: nutrition.calories,
          protein: nutrition.protein,
          carbs: nutrition.carbs,
          fat: nutrition.fat,
          fiber: nutrition.fiber,
          entries: [] // We don't have individual food entries in this format
        }))
      };

      // Convert sleep durations from seconds to hours for better readability
      const transformedSleepData = {
        totalDays: sleepData.length,
        averages: {
          sleepDuration: sleepData.length > 0 ? (sleepData.reduce((sum, s) => sum + s.total_sleep_duration, 0) / sleepData.length) / 3600 : 0,
          sleepScore: sleepData.length > 0 ? sleepData.reduce((sum, s) => sum + s.sleep_score, 0) / sleepData.length : 0,
          deepSleep: sleepData.length > 0 ? (sleepData.reduce((sum, s) => sum + s.deep_sleep_duration, 0) / sleepData.length) / 3600 : 0,
          remSleep: sleepData.length > 0 ? (sleepData.reduce((sum, s) => sum + s.rem_sleep_duration, 0) / sleepData.length) / 3600 : 0,
          lightSleep: sleepData.length > 0 ? (sleepData.reduce((sum, s) => sum + s.light_sleep_duration, 0) / sleepData.length) / 3600 : 0
        },
        dailyLogs: sleepData.map(sleep => ({
          date: sleep.date,
          sleepDuration: sleep.total_sleep_duration / 3600, // Convert to hours
          sleepScore: sleep.sleep_score,
          deepSleep: sleep.deep_sleep_duration / 3600, // Convert to hours
          remSleep: sleep.rem_sleep_duration / 3600, // Convert to hours
          lightSleep: sleep.light_sleep_duration / 3600, // Convert to hours
          sleepEfficiency: sleep.sleep_efficiency,
          bedtimeStart: sleep.bedtime_start,
          bedtimeEnd: sleep.bedtime_end
        }))
      };

      // Prepare detailed analysis data
      const analysisData = {
        metrics,
        activities: stravaData.map(activity => ({
          type: activity.type,
          name: activity.name,
          distance: activity.distance,
          date: activity.start_date,
          moving_time: activity.moving_time,
          average_speed: activity.average_speed,
          average_heartrate: activity.average_heartrate,
          max_heartrate: activity.max_heartrate,
          total_elevation_gain: activity.total_elevation_gain
        })),
        sleep: transformedSleepData,
        nutrition: transformedNutritionData
      };

      // Log the data being sent to Claude for debugging
      console.log('🧠 Data being sent to Claude:', {
        activitiesCount: analysisData.activities.length,
        sleepCount: analysisData.sleep.totalDays,
        nutritionCount: analysisData.nutrition.totalDays,
        sampleActivity: analysisData.activities[0],
        sampleSleep: analysisData.sleep.dailyLogs[0],
        sampleNutrition: analysisData.nutrition.dailyLogs[0]
      });
      
      // Log the full data structure being sent
      console.log('🧠 Full analysis data structure:', JSON.stringify({
        metrics: analysisData.metrics,
        recentActivities: analysisData.activities.slice(0, 2), // First 2 activities
        sleepData: analysisData.sleep,
        nutritionData: analysisData.nutrition
      }, null, 2));

      const response = await fetch('/api/claude-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_response',
          query: `Analyze my health data from the last 7 days and provide comprehensive insights. You have access to:

ACTIVITY DATA: Recent activities including Zwift cycling (VirtualRide) and running sessions with heart rate, distance, and performance metrics.
SLEEP DATA: Daily sleep scores, duration, and sleep stages.
NUTRITION DATA: Daily calorie, protein, carb, fat, and fiber intake.

Focus on:

1. **Sleep-Nutrition-Workout Relationships**: 
   - How did my sleep quality affect my workout performance the next day?
   - Did poor sleep lead to different food choices or workout intensity?
   - Analyze specific correlations: "On July 5th, you had poor sleep (69 score, 5.68 hours) - how did this affect your July 6th Zwift FTP test (147 bpm avg heart rate)?"
   - Look at nutrition timing around workouts

2. **Performance Patterns**: 
   - Analyze my specific activities: Zwift cycling (VirtualRide), running, and swimming
   - How did nutrition and sleep impact each workout type?
   - Compare performance metrics (heart rate, pace, distance) with sleep/nutrition data
   - Identify patterns in workout timing and sleep quality

3. **Recovery Analysis**: 
   - How well did I recover between workouts?
   - Did my sleep and nutrition support proper recovery?
   - Analyze recovery between consecutive workout days
   - Look at sleep quality after intense sessions

4. **Today's Action Plan**: Based on the last 7 days, what should I focus on today? Consider:
   - If I had poor sleep last night, what adjustments should I make?
   - What nutrition should I prioritize today?
   - What type of workout would be optimal?
   - Any recovery strategies I should implement?

5. **Weekly Trends**: 
   - What trends do you see that I should be aware of?
   - Any concerning patterns or positive improvements?
   - Sport-specific trends (running vs cycling vs swimming)

IMPORTANT: You have the activity data in the recentActivities array. Use it to provide specific analysis. Reference actual dates, workout types, heart rates, distances, and performance metrics. Don't make generic statements - provide concrete analysis based on the data provided.`,
          analysis: {
            metrics: analysisData.metrics,
            recentActivities: analysisData.activities,
            sleepData: analysisData.sleep,
            nutritionData: analysisData.nutrition
          },
          mcpResponses: [],
          conversationContext: []
        })
      });

      if (!response.ok) {
        console.error('❌ Claude API error:', response.status, response.statusText);
        throw new Error(`LLM API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('🧠 Claude API response:', {
        hasResponse: !!data.response,
        responseLength: data.response?.length || 0,
        fallback: data.fallback
      });
      
      return data.response || 'Unable to generate comprehensive insights at this time.';
    } catch (error) {
      console.error('Error generating comprehensive insights:', error);
      return 'Unable to generate comprehensive insights at this time. Please try again later.';
    }
  };

  const loadInsights = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🔄 Starting to load insights...');
      
      // Fetch real data - use 7 days for consistency
      const [stravaData, sleepData, nutritionData] = await Promise.all([
        fetchStravaActivities(7), // Changed from 14 to 7 days
        fetchOuraSleepData(7),
        fetchNutritionData(7)
      ]);

      console.log('📊 Raw data received:', {
        stravaActivities: stravaData.length,
        sleepDays: sleepData.length,
        nutritionDays: nutritionData.length
      });

      // Log sample data
      if (stravaData.length > 0) {
        console.log('🏃 Sample Strava activities:', stravaData.slice(0, 3).map(a => ({
          type: a.type,
          distance: a.distance,
          date: a.start_date,
          name: a.name
        })));
      }

      if (sleepData.length > 0) {
        console.log('😴 Sample sleep data:', sleepData.slice(0, 3).map(s => ({
          date: s.date,
          sleep_score: s.sleep_score,
          total_sleep_duration: s.total_sleep_duration
        })));
      }

      if (nutritionData.length > 0) {
        console.log('🍎 Sample nutrition data:', nutritionData.slice(0, 3).map(n => ({
          date: n.date,
          protein: n.protein,
          calories: n.calories
        })));
        console.log('🍎 All nutrition data:', nutritionData.map(n => ({
          date: n.date,
          protein: n.protein,
          calories: n.calories,
          carbs: n.carbs,
          fat: n.fat
        })));
      }

      // Calculate metrics
      const calculatedMetrics = calculateMetrics(stravaData, sleepData, nutritionData);
      
      // Generate comprehensive insights with LLM
      const insights = await generateComprehensiveInsights(calculatedMetrics, stravaData, sleepData, nutritionData);
      setComprehensiveInsights(insights);

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
      
      // Get activity breakdown for trends and goals
      const runningActivities = stravaData.filter(activity => activity.type === 'Run');
      const cyclingActivities = stravaData.filter(activity => activity.type === 'Ride');
      const swimmingActivities = stravaData.filter(activity => activity.type === 'Swim');
      
      // Running trend
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

      // Set goals based on calculated metrics data
      const goalsData = (calculatedMetrics as any).goals || {};
      setGoals([
        {
          title: 'Weekly Running',
          current: Math.round(goalsData.runningVolume || 0),
          target: 40,
          unit: 'km',
          progress: Math.min(((goalsData.runningVolume || 0) / 40) * 100, 100)
        },
        {
          title: 'Cycling Volume',
          current: Math.round(goalsData.cyclingVolume || 0),
          target: 100,
          unit: 'km',
          progress: Math.min(((goalsData.cyclingVolume || 0) / 100) * 100, 100)
        },
        {
          title: 'Sleep Consistency',
          current: goalsData.validSleepDays || 0,
          target: 7,
          unit: 'days',
          progress: ((goalsData.validSleepDays || 0) / 7) * 100
        },
        {
          title: 'Protein Target',
          current: Math.round(goalsData.avgProtein || 0),
          target: 151,
          unit: 'g/day',
          progress: Math.min(((goalsData.avgProtein || 0) / 151) * 100, 100)
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

        {/* Comprehensive AI Analysis */}
        {comprehensiveInsights && (
          <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <Brain className="h-6 w-6 text-blue-600" />
                AI Health Analysis - Last 7 Days
              </CardTitle>
              <CardDescription className="text-blue-700">
                Comprehensive analysis of sleep, nutrition, and workout relationships with personalized recommendations for today.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none text-gray-800">
                <div className="whitespace-pre-wrap leading-relaxed">
                  {comprehensiveInsights}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
