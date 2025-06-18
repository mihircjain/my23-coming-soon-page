// Improved LetsJam - Efficient Health Coach with Real Firestore Data
const userId = "mihir_jain";

import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, RefreshCw, Activity, Utensils, Heart, TrendingUp, Target, Zap, Calendar, BarChart3, ArrowLeft, MessageSquare, Flame, Droplet, Clock, Tag, AlertTriangle, CheckCircle, Coffee, Apple } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

// Interfaces for real Firestore data
interface RunData {
  id: string;
  name: string;
  type: string;
  start_date: string;
  distance: number;
  moving_time: number;
  total_elevation_gain: number;
  average_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  calories?: number;
  is_run_activity: boolean;
  run_tag?: string;
  splits_metric?: KmSplit[];
  best_efforts?: BestEffort[];
  zones?: HeartRateZone[];
}

interface KmSplit {
  distance: number;
  elapsed_time: number;
  elevation_difference: number;
  moving_time: number;
  average_speed: number;
  average_heartrate?: number;
}

interface BestEffort {
  name: string;
  distance: number;
  moving_time: number;
  pr_rank?: number;
}

interface HeartRateZone {
  type: string;
  distribution_buckets: Array<{
    min: number;
    max: number;
    time: number;
  }>;
}

interface FoodEntry {
  foodId: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  quantity: number;
  unit: string;
  timestamp: string;
}

interface DailyNutrition {
  date: string;
  entries: FoodEntry[];
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
}

interface BodyMetrics {
  weight: number;
  bodyFat: number;
  leanMass: number;
  hdl: number;
  ldl: number;
  glucose: number;
  hba1c: number;
  vitaminD: number;
  lastUpdated: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface UserData {
  recentRuns: RunData[];
  recentNutrition: DailyNutrition[];
  currentBody: BodyMetrics;
  weeklyStats: {
    totalDistance: number;
    totalRuns: number;
    avgPace: number;
    avgCalories: number;
  };
}

// Efficient data cache
const dataCache = new Map();
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

const getCachedData = async (key: string, fetchFn: () => Promise<any>) => {
  const cached = dataCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`📦 Using cached data for ${key}`);
    return cached.data;
  }
  
  console.log(`🔄 Fetching fresh data for ${key}`);
  const freshData = await fetchFn();
  dataCache.set(key, { data: freshData, timestamp: Date.now() });
  return freshData;
};

// Real data fetching functions using your Firestore patterns
const fetchRecentRuns = async (days: number = 7): Promise<RunData[]> => {
  return getCachedData(`runs_${days}`, async () => {
    try {
      const params = new URLSearchParams({
        userId: userId,
        mode: 'cached'
      });
      
      const response = await fetch(`/api/strava?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch runs');
      
      const data = await response.json();
      
      // Filter and process run activities
      const runActivities = data
        .filter((activity: any) => 
          activity.type && activity.type.toLowerCase().includes('run')
        )
        .map((activity: any) => ({
          id: activity.id?.toString() || Math.random().toString(),
          name: activity.name || 'Unnamed Run',
          type: activity.type,
          start_date: activity.start_date,
          distance: activity.distance || 0,
          moving_time: activity.moving_time || 0,
          total_elevation_gain: activity.total_elevation_gain || 0,
          average_speed: activity.average_speed || 0,
          average_heartrate: activity.average_heartrate,
          max_heartrate: activity.max_heartrate,
          calories: activity.calories || 0,
          is_run_activity: true,
          run_tag: activity.run_tag || 'easy'
        }))
        .slice(0, 5); // Recent 5 runs
      
      // Load detailed data for recent runs if needed
      const runsWithDetails = await Promise.all(
        runActivities.map(async (run: RunData) => {
          try {
            const detailResponse = await fetch(`/api/strava-detail?activityId=${run.id}&userId=${userId}`);
            if (detailResponse.ok) {
              const detail = await detailResponse.json();
              return {
                ...run,
                splits_metric: detail.splits_metric || [],
                best_efforts: detail.best_efforts || [],
                zones: detail.zones || []
              };
            }
          } catch (error) {
            console.warn(`Failed to load details for run ${run.id}`);
          }
          return run;
        })
      );
      
      console.log(`✅ Loaded ${runsWithDetails.length} runs with details`);
      return runsWithDetails;
      
    } catch (error) {
      console.error('Error fetching runs:', error);
      return [];
    }
  });
};

const fetchRecentNutrition = async (days: number = 7): Promise<DailyNutrition[]> => {
  return getCachedData(`nutrition_${days}`, async () => {
    try {
      // Get last 7 days of nutrition data
      const nutritionData: DailyNutrition[] = [];
      const today = new Date();
      
      for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateString = date.toISOString().split('T')[0];
        
        try {
          // Use your nutrition utility functions
          const response = await fetch(`/api/nutrition?date=${dateString}&userId=${userId}`);
          if (response.ok) {
            const dayData = await response.json();
            if (dayData && dayData.entries && dayData.entries.length > 0) {
              nutritionData.push({
                date: dateString,
                entries: dayData.entries,
                totals: dayData.totals || {
                  calories: 0,
                  protein: 0,
                  carbs: 0,
                  fat: 0,
                  fiber: 0
                }
              });
            }
          }
        } catch (error) {
          console.warn(`Failed to load nutrition for ${dateString}`);
        }
      }
      
      console.log(`✅ Loaded nutrition for ${nutritionData.length} days`);
      return nutritionData;
      
    } catch (error) {
      console.error('Error fetching nutrition:', error);
      return [];
    }
  });
};

const fetchCurrentBodyMetrics = async (): Promise<BodyMetrics | null> => {
  return getCachedData('body_metrics', async () => {
    try {
      // Using your body metrics pattern
      const response = await fetch(`/api/body-metrics?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Loaded current body metrics');
        return data;
      }
    } catch (error) {
      console.error('Error fetching body metrics:', error);
    }
    return null;
  });
};

// Smart context building based on query analysis
const buildContextForQuery = (query: string, userData: UserData) => {
  const lowercaseQuery = query.toLowerCase();
  
  // Determine what data is relevant
  const needsRunData = /\b(run|running|pace|km|tempo|easy|interval|split|heart rate|hr|bpm)\b/i.test(query);
  const needsNutritionData = /\b(food|eat|nutrition|calorie|protein|carb|meal|diet)\b/i.test(query);
  const needsBodyData = /\b(body|weight|fat|composition|muscle|hdl|ldl|glucose|blood)\b/i.test(query);
  
  let context = `You are a helpful health coach. Answer the user's question directly using their real data.\n\n`;
  
  // Add relevant data sections
  if (needsRunData && userData.recentRuns.length > 0) {
    context += `=== RECENT RUNS ===\n`;
    userData.recentRuns.forEach((run, index) => {
      context += `Run ${index + 1}: "${run.name}" on ${new Date(run.start_date).toLocaleDateString()}\n`;
      context += `- Distance: ${run.distance.toFixed(2)}km\n`;
      context += `- Duration: ${Math.round(run.moving_time / 60)}min\n`;
      context += `- Avg HR: ${run.average_heartrate || 'N/A'} bpm\n`;
      context += `- Tag: ${run.run_tag}\n`;
      
      if (run.splits_metric && run.splits_metric.length > 0) {
        context += `- KM SPLITS:\n`;
        run.splits_metric.forEach((split, kmIndex) => {
          const pace = split.moving_time;
          const minutes = Math.floor(pace / 60);
          const seconds = pace % 60;
          const hr = split.average_heartrate ? ` HR:${Math.round(split.average_heartrate)}` : '';
          const elevation = split.elevation_difference ? ` ${split.elevation_difference > 0 ? '+' : ''}${split.elevation_difference}m` : '';
          context += `  Km ${kmIndex + 1}: ${minutes}:${seconds.toString().padStart(2, '0')}${hr}${elevation}\n`;
        });
      }
      context += '\n';
    });
  }
  
  if (needsNutritionData && userData.recentNutrition.length > 0) {
    context += `=== RECENT NUTRITION ===\n`;
    userData.recentNutrition.forEach((day) => {
      context += `${new Date(day.date).toLocaleDateString()}: ${day.totals.calories} cal, ${day.totals.protein}g protein\n`;
      if (day.entries.length > 0) {
        context += `Foods eaten:\n`;
        day.entries.forEach((food) => {
          context += `- ${food.foodId}: ${food.quantity} ${food.unit} (${Math.round(food.calories * food.quantity)} cal, ${Math.round(food.protein * food.quantity)}g protein)\n`;
        });
      }
      context += '\n';
    });
    
    // Extract common foods for recommendations
    const allFoods = userData.recentNutrition.flatMap(day => day.entries);
    const foodFrequency = allFoods.reduce((acc, food) => {
      acc[food.foodId] = (acc[food.foodId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const commonFoods = Object.entries(foodFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([food]) => food);
    
    if (commonFoods.length > 0) {
      context += `Common foods you eat: ${commonFoods.join(', ')}\n\n`;
    }
  }
  
  if (needsBodyData && userData.currentBody) {
    context += `=== CURRENT BODY METRICS ===\n`;
    context += `Weight: ${userData.currentBody.weight}kg\n`;
    context += `Body Fat: ${userData.currentBody.bodyFat}%\n`;
    context += `Lean Mass: ${userData.currentBody.leanMass}kg\n`;
    context += `HDL: ${userData.currentBody.hdl} mg/dL\n`;
    context += `LDL: ${userData.currentBody.ldl} mg/dL\n`;
    context += `Glucose: ${userData.currentBody.glucose} mg/dL\n`;
    context += `HbA1c: ${userData.currentBody.hba1c}%\n`;
    context += `Vitamin D: ${userData.currentBody.vitaminD} ng/mL\n`;
    context += `Last updated: ${userData.currentBody.lastUpdated}\n\n`;
  }
  
  return context;
};

// Session management
const generateSessionId = () => 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

const saveSessionToStorage = (sessionId: string, messages: ChatMessage[]) => {
  try {
    localStorage.setItem('letsJam_session', sessionId);
    localStorage.setItem('letsJam_messages', JSON.stringify(messages));
  } catch (error) {
    console.error('Failed to save session:', error);
  }
};

const loadSessionFromStorage = (): { sessionId: string | null, messages: ChatMessage[] } => {
  try {
    const savedSessionId = localStorage.getItem('letsJam_session');
    const savedMessages = localStorage.getItem('letsJam_messages');
    
    if (savedSessionId && savedMessages) {
      const parsedMessages = JSON.parse(savedMessages);
      const messagesWithDates = parsedMessages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
      return { sessionId: savedSessionId, messages: messagesWithDates };
    }
  } catch (error) {
    console.error('Failed to load session:', error);
  }
  
  return { sessionId: null, messages: [] };
};

// Smart Health Summary Component
const SmartHealthSummary: React.FC<{ 
  userData: UserData | null,
  onRefresh: () => void,
  isRefreshing: boolean,
  loading: boolean
}> = ({ userData, onRefresh, isRefreshing, loading }) => {
  
  const totalRunDistance = userData?.recentRuns.reduce((sum, run) => sum + run.distance, 0) || 0;
  const avgRunHeartRate = userData?.recentRuns.length > 0 
    ? Math.round(userData.recentRuns
        .filter(run => run.average_heartrate)
        .reduce((sum, run) => sum + (run.average_heartrate || 0), 0) / 
        userData.recentRuns.filter(run => run.average_heartrate).length) || 0
    : 0;
  
  const recentCalories = userData?.recentNutrition[0]?.totals.calories || 0;
  const avgDailyCalories = userData?.recentNutrition.length > 0
    ? Math.round(userData.recentNutrition.reduce((sum, day) => sum + day.totals.calories, 0) / userData.recentNutrition.length)
    : 0;
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-green-500" />
          Health Overview
        </h3>
        <Button 
          onClick={onRefresh}
          variant="outline"
          size="sm"
          disabled={isRefreshing}
          className="text-xs"
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      
      {/* Status Indicators */}
      <div className="flex items-center gap-2 mb-4">
        <Badge variant={userData?.recentRuns.length > 0 ? "default" : "secondary"} className="text-xs">
          {userData?.recentRuns.length || 0} Recent Runs
        </Badge>
        <Badge variant={userData?.recentNutrition.length > 0 ? "default" : "secondary"} className="text-xs">
          {userData?.recentNutrition.length || 0} Days Nutrition
        </Badge>
        <Badge variant={userData?.currentBody ? "default" : "secondary"} className="text-xs">
          {userData?.currentBody ? 'Body Data Current' : 'No Body Data'}
        </Badge>
      </div>

      {/* Current Body Metrics */}
      {userData?.currentBody && (
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-medium text-purple-700">Current Body</span>
              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                {userData.currentBody.lastUpdated}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="text-center p-1 bg-white/60 rounded border">
                <div className="font-semibold text-purple-800">{userData.currentBody.weight}kg</div>
                <div className="text-purple-600">Weight</div>
              </div>
              <div className="text-center p-1 bg-white/60 rounded border">
                <div className="font-semibold text-purple-800">{userData.currentBody.bodyFat}%</div>
                <div className="text-purple-600">Body Fat</div>
              </div>
              <div className="text-center p-1 bg-white/60 rounded border">
                <div className="font-semibold text-purple-800">{userData.currentBody.hdl}</div>
                <div className="text-purple-600">HDL</div>
              </div>
              <div className="text-center p-1 bg-white/60 rounded border">
                <div className="font-semibold text-purple-800">{userData.currentBody.hba1c}%</div>
                <div className="text-purple-600">HbA1c</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 gap-3">
        <Card className="bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Utensils className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-medium text-emerald-700">Nutrition</span>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-bold text-emerald-800">
                {loading ? '...' : recentCalories || 'No Data'}
              </div>
              <div className="text-xs text-emerald-600">
                {recentCalories > 0 ? 'calories today' : 'No recent data'}
              </div>
              <div className="text-xs text-gray-600">
                {avgDailyCalories > 0 ? `${avgDailyCalories} avg/day` : 'Start tracking'}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-700">Running</span>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-bold text-blue-800">
                {loading ? '...' : totalRunDistance > 0 ? `${totalRunDistance.toFixed(1)}km` : 'No runs'}
              </div>
              <div className="text-xs text-blue-600">
                {totalRunDistance > 0 ? 'recent distance' : 'Start running!'}
              </div>
              <div className="text-xs text-gray-600">
                {avgRunHeartRate > 0 ? `${avgRunHeartRate} bpm avg` : 'Add heart rate data'}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-teal-50 to-cyan-50 border-teal-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-teal-600" />
              <span className="text-xs font-medium text-teal-700">Activity</span>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-bold text-teal-800">
                {loading ? '...' : userData?.recentRuns.length || '0'}
              </div>
              <div className="text-xs text-teal-600">runs this week</div>
              <div className="text-xs text-gray-600">
                {userData?.recentRuns.length > 0 ? 'Active week' : 'Get moving!'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Recent Activities */}
      {userData?.recentRuns && userData.recentRuns.length > 0 && (
        <Card className="bg-gradient-to-br from-cyan-50 to-blue-50 border-cyan-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-cyan-700 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Recent Runs ({userData.recentRuns.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="space-y-2">
              {userData.recentRuns.slice(0, 3).map((run, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-cyan-100 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-cyan-800 truncate">
                      {run.name}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-cyan-600">
                      <span className="bg-cyan-100 px-2 py-0.5 rounded text-cyan-700 font-medium">
                        {run.run_tag}
                      </span>
                      <span>
                        {new Date(run.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <div className="text-sm font-semibold text-blue-600">
                      {run.distance.toFixed(1)}km
                    </div>
                    <div className="text-xs text-cyan-500">
                      {run.average_heartrate ? `${run.average_heartrate} bpm` : 
                       run.calories ? `${run.calories} cal` : 'No data'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Recent Foods */}
      {userData?.recentNutrition && userData.recentNutrition.length > 0 && (
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-700 flex items-center gap-2">
              <Utensils className="h-4 w-4" />
              Recent Foods
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="space-y-1">
              {userData.recentNutrition[0]?.entries.slice(0, 3).map((food, index) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <span className="text-green-800 truncate flex-1">{food.foodId}</span>
                  <span className="text-green-600 ml-2">{Math.round(food.calories * food.quantity)} cal</span>
                </div>
              ))}
              {userData.recentNutrition[0]?.entries.length > 3 && (
                <div className="text-center mt-2 pt-2 border-t border-green-100">
                  <span className="text-xs text-green-500">+{userData.recentNutrition[0].entries.length - 3} more items</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Smart Prompt Suggestions
const SmartPromptSuggestions: React.FC<{ 
  onPromptSelect: (prompt: string) => void,
  userData: UserData | null
}> = ({ onPromptSelect, userData }) => {
  const hasRunData = userData?.recentRuns && userData.recentRuns.length > 0;
  const hasNutritionData = userData?.recentNutrition && userData.recentNutrition.length > 0;
  const hasBodyData = userData?.currentBody;
  
  const promptCategories = [
    {
      title: 'Running Analysis',
      icon: Activity,
      color: 'from-blue-100 to-cyan-100 border-blue-300',
      textColor: 'text-blue-700',
      iconColor: 'text-blue-600',
      prompts: hasRunData ? [
        'Analyze my recent running performance',
        'How was my pace in my last run?',
        'Show me my heart rate zones from yesterday',
        'Compare my easy runs vs tempo runs',
        'What do my km splits tell me?'
      ] : [
        'How do I start a running routine?',
        'What pace should I run at?',
        'Help me understand heart rate training',
        'What are different types of runs?'
      ]
    },
    {
      title: 'Nutrition & Food',
      icon: Utensils,
      color: 'from-green-100 to-emerald-100 border-green-300',
      textColor: 'text-green-700',
      iconColor: 'text-green-600',
      prompts: hasNutritionData ? [
        'What foods should I eat more of?',
        'Analyze my protein intake this week',
        'Recommend foods similar to what I eat',
        'Am I eating enough calories?',
        'What should I eat before my next run?'
      ] : [
        'Help me plan a healthy meal',
        'What foods are good for runners?',
        'How much protein do I need?',
        'What should I eat for breakfast?'
      ]
    },
    {
      title: 'Body & Health',
      icon: Heart,
      color: 'from-purple-100 to-pink-100 border-purple-300',
      textColor: 'text-purple-700',
      iconColor: 'text-purple-600',
      prompts: hasBodyData ? [
        'How are my health markers trending?',
        'Is my current weight healthy?',
        'What do my blood test results mean?',
        'How can I improve my body composition?'
      ] : [
        'What health metrics should I track?',
        'How often should I check my weight?',
        'What blood tests are important?',
        'How do I improve my fitness?'
      ]
    },
    {
      title: 'Quick Questions',
      icon: MessageSquare,
      color: 'from-teal-100 to-cyan-100 border-teal-300',
      textColor: 'text-teal-700',
      iconColor: 'text-teal-600',
      prompts: [
        'What should I focus on this week?',
        'Am I making progress?',
        'What exercises should I do?',
        'How can I recover better?',
        'Is my training balanced?'
      ]
    }
  ];

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        Ask About Your Health Data
        {hasRunData && (
          <Badge variant="outline" className="text-xs">
            Run Data Ready
          </Badge>
        )}
        {hasNutritionData && (
          <Badge variant="outline" className="text-xs">
            Nutrition Tracked
          </Badge>
        )}
        {hasBodyData && (
          <Badge variant="outline" className="text-xs">
            Body Metrics Current
          </Badge>
        )}
      </h4>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {promptCategories.map((category, categoryIndex) => (
          <Card key={categoryIndex} className={`bg-gradient-to-br ${category.color} cursor-pointer hover:shadow-md transition-all duration-200`}>
            <CardHeader className="pb-2">
              <CardTitle className={`text-sm font-medium ${category.textColor} flex items-center gap-2`}>
                <category.icon className={`h-4 w-4 ${category.iconColor}`} />
                {category.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="space-y-1">
                {category.prompts.map((prompt, promptIndex) => (
                  <button
                    key={promptIndex}
                    onClick={() => onPromptSelect(prompt)}
                    className={`w-full text-left text-xs p-2 bg-white/60 hover:bg-white/90 rounded border transition-all duration-150 ${category.textColor} hover:text-gray-900`}
                  >
                    "{prompt}"
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

// Message Content Component
const MessageContent: React.FC<{ content: string }> = ({ content }) => {
  const formatContent = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  };

  return (
    <div 
      className="text-sm whitespace-pre-wrap leading-relaxed"
      dangerouslySetInnerHTML={{ __html: formatContent(content) }}
    />
  );
};

// Main Component
const LetsJam: React.FC = () => {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Chat state
  const initializeSession = () => {
    const { sessionId: savedSessionId, messages: savedMessages } = loadSessionFromStorage();
    
    if (savedSessionId && savedMessages.length > 0) {
      return { sessionId: savedSessionId, messages: savedMessages };
    } else {
      const newSessionId = generateSessionId();
      const welcomeMessages = [{
        role: 'assistant' as const,
        content: 'Hi! I\'m your AI health coach with access to your real running data, nutrition logs, and body metrics. I can analyze your performance, suggest foods based on what you eat, and help with your health goals. What would you like to know?',
        timestamp: new Date()
      }];
      
      saveSessionToStorage(newSessionId, welcomeMessages);
      return { sessionId: newSessionId, messages: welcomeMessages };
    }
  };
  
  const initialSession = initializeSession();
  const [messages, setMessages] = useState<ChatMessage[]>(initialSession.messages);
  const [sessionId, setSessionId] = useState<string>(initialSession.sessionId);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Save messages to storage
  useEffect(() => {
    if (messages.length > 0) {
      saveSessionToStorage(sessionId, messages);
    }
  }, [messages, sessionId]);

  // Auto-scroll to latest message
  const scrollToLatestMessage = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  useEffect(() => {
    scrollToLatestMessage();
  }, [messages, isTyping]);

  // Fetch all user data
  const fetchUserData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      if (forceRefresh) {
        setIsRefreshing(true);
      }

      console.log('🔄 Fetching user data...');
      
      const [recentRuns, recentNutrition, currentBody] = await Promise.all([
        fetchRecentRuns(7),
        fetchRecentNutrition(7),
        fetchCurrentBodyMetrics()
      ]);

      const weeklyStats = {
        totalDistance: recentRuns.reduce((sum, run) => sum + run.distance, 0),
        totalRuns: recentRuns.length,
        avgPace: recentRuns.length > 0 
          ? recentRuns.reduce((sum, run) => sum + (run.moving_time / run.distance), 0) / recentRuns.length
          : 0,
        avgCalories: recentNutrition.length > 0
          ? recentNutrition.reduce((sum, day) => sum + day.totals.calories, 0) / recentNutrition.length
          : 0
      };

      const newUserData: UserData = {
        recentRuns,
        recentNutrition,
        currentBody: currentBody || {
          weight: 0,
          bodyFat: 0,
          leanMass: 0,
          hdl: 0,
          ldl: 0,
          glucose: 0,
          hba1c: 0,
          vitaminD: 0,
          lastUpdated: ''
        },
        weeklyStats
      };

      setUserData(newUserData);
      console.log('✅ User data loaded successfully');
      
    } catch (error) {
      console.error('❌ Error fetching user data:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Send message to AI with smart context
  const sendMessageToAI = async (messageContent: string) => {
    try {
      if (!userData) {
        throw new Error('No user data available');
      }

      const context = buildContextForQuery(messageContent, userData);
      
      const conversationMessages = [
        { role: "system", content: context },
        ...messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        { role: "user", content: messageContent }
      ];

      console.log('📤 Sending message with smart context');
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          source: "improved_letsjam_v3",
          messages: conversationMessages,
          sessionId: sessionId
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const assistantContent = data.choices?.[0]?.message?.content || 
                              data.response || 
                              data.message || 
                              'Sorry, I could not process that request.';
      
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
    } catch (error) {
      console.error('❌ Error getting AI response:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, I\'m having trouble connecting right now. Please try again in a moment.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isTyping) return;
    
    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    const messageContent = input.trim();
    setInput('');
    setIsTyping(true);
    
    await sendMessageToAI(messageContent);
  };

  const handlePromptSelect = (prompt: string) => {
    setInput(prompt);
    setTimeout(() => {
      if (!isTyping) {
        const userMessage: ChatMessage = {
          role: 'user',
          content: prompt,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsTyping(true);
        
        sendMessageToAI(prompt);
      }
    }, 100);
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const startNewSession = () => {
    const newSessionId = generateSessionId();
    const welcomeMessages = [{
      role: 'assistant' as const,
      content: 'Hi! I\'m your AI health coach with access to your real data. I can analyze your running performance, suggest foods based on what you eat, and answer health questions. What would you like to explore?',
      timestamp: new Date()
    }];
    
    setSessionId(newSessionId);
    setMessages(welcomeMessages);
    setInput('');
    setIsTyping(false);
    
    localStorage.removeItem('letsJam_session');
    localStorage.removeItem('letsJam_messages');
    saveSessionToStorage(newSessionId, welcomeMessages);
  };

  // Load data on mount
  useEffect(() => {
    fetchUserData(false);
  }, []);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-green-400/10 to-blue-400/10 animate-pulse"></div>
      <div className="absolute top-20 left-20 w-32 h-32 bg-green-200/30 rounded-full blur-xl animate-bounce"></div>
      <div className="absolute bottom-20 right-20 w-24 h-24 bg-blue-200/30 rounded-full blur-xl animate-bounce delay-1000"></div>
      
      {/* Header */}
      <header className="relative z-10 pt-8 px-6 md:px-12">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" className="hover:bg-white/20">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </div>
        
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-green-600 via-teal-600 to-blue-600 bg-clip-text text-transparent">
            🤖 LetsJam
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            AI health coach with real data analysis
          </p>
          <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs">
              Real Firestore Data
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Session: {sessionId.slice(-8)}
            </Badge>
            <Badge variant={userData?.recentRuns.length > 0 ? "default" : "secondary"} className="text-xs">
              {userData?.recentRuns.length || 0} Runs
            </Badge>
            <Badge variant={userData?.recentNutrition.length > 0 ? "default" : "secondary"} className="text-xs">
              {userData?.recentNutrition.length || 0} Days Nutrition
            </Badge>
            <Badge variant={userData?.currentBody ? "default" : "secondary"} className="text-xs">
              {userData?.currentBody ? 'Body Data' : 'No Body Data'}
            </Badge>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="relative z-10 px-6 md:px-12 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Left Column - Chat Interface */}
            <div className="lg:col-span-3 space-y-4">
              
              {/* Smart Prompt Suggestions */}
              <SmartPromptSuggestions 
                onPromptSelect={handlePromptSelect}
                userData={userData}
              />
              
              {/* Chat Container */}
              <Card className="bg-white/80 backdrop-blur-sm border border-white/20">
                <CardHeader className="border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                      <Bot className="h-5 w-5 text-green-500" />
                      AI Health Coach
                      <Badge variant="secondary" className="ml-2 text-xs">
                        Smart Context
                      </Badge>
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        Session: {sessionId.slice(-8)}
                      </Badge>
                      <Button
                        onClick={startNewSession}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        disabled={isTyping}
                      >
                        <Bot className="h-3 w-3 mr-1" />
                        New Session
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="p-4 space-y-4 min-h-[400px] max-h-[600px] overflow-y-auto">
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[85%] ${
                          message.role === 'user' 
                            ? 'bg-gradient-to-r from-green-500 to-teal-500 text-white' 
                            : 'bg-gradient-to-r from-blue-50 to-cyan-50 text-gray-800 border border-blue-200'
                        } rounded-lg p-4`}>
                          <MessageContent content={message.content} />
                          <div className={`text-xs mt-2 ${
                            message.role === 'user' ? 'text-green-100' : 'text-blue-500'
                          }`}>
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {isTyping && (
                      <div className="flex justify-start">
                        <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-teal-500" />
                            <span className="text-sm text-teal-700">Analyzing your data...</span>
                            <div className="flex gap-1">
                              <div className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce"></div>
                              <div className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce delay-100"></div>
                              <div className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce delay-200"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div ref={messagesEndRef} />
                  </div>
                  
                  {/* Input Area */}
                  <div className="border-t border-gray-100 p-4">
                    <div className="flex gap-3">
                      <Input
                        placeholder="Ask about your runs, nutrition, body metrics, or health goals..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="flex-1 border-gray-200 focus:border-green-400"
                        disabled={isTyping}
                      />
                      <Button
                        onClick={handleSendMessage}
                        disabled={!input.trim() || isTyping}
                        className="bg-green-500 hover:bg-green-600 text-white"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
                      <span>{messages.length} messages in this session</span>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${userData ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
                          {userData ? 'Data loaded' : 'Loading data...'}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Right Column - Health Summary */}
            <div className="lg:col-span-1">
              <Card className="bg-white/80 backdrop-blur-sm border border-white/20 sticky top-6">
                <CardContent className="p-4">
                  <SmartHealthSummary
                    userData={userData}
                    onRefresh={() => fetchUserData(true)}
                    isRefreshing={isRefreshing}
                    loading={loading}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="relative z-10 py-6 px-6 md:px-12 text-center text-sm text-gray-500">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <span>AI health coach with real Firestore data</span>
            <span className="hidden md:inline">•</span>
            <span>Smart context loading based on your questions</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full animate-pulse ${userData ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
              <span className="text-xs">{userData ? 'Data Ready' : 'Loading Data'}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LetsJam;
