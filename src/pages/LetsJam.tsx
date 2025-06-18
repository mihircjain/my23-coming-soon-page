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

// Helper functions for date range checking and formatting
const isWithinDays = (date: Date, days: number): boolean => {
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= days;
};

const isDateInRange = (date: Date, days: number, offset: number): boolean => {
  const now = new Date();
  const startRange = new Date(now.getTime() - (offset + days) * 24 * 60 * 60 * 1000);
  const endRange = new Date(now.getTime() - offset * 24 * 60 * 60 * 1000);
  return date >= startRange && date <= endRange;
};

const formatPace = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

const getRunTagDescription = (tag: string): string => {
  const descriptions = {
    'easy': 'conversational pace, base building',
    'tempo': 'comfortably hard, sustained effort',
    'intervals': 'high intensity with rest periods',
    'long': 'extended duration, aerobic base',
    'recovery': 'very easy pace, active recovery',
    'hill-repeats': 'uphill intervals for strength',
    'race': 'race effort or time trial',
    'untagged': 'no specific training type assigned'
  };
  return descriptions[tag] || 'unknown training type';
};

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
      console.log(`🏃 Fetching run data for ${days} days...`);
      
      const params = new URLSearchParams({
        userId: userId,
        mode: 'cached'
      });
      
      const response = await fetch(`/api/strava?${params.toString()}`);
      if (!response.ok) {
        console.warn('Failed to fetch Strava data:', response.status);
        return [];
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data) || data.length === 0) {
        console.log('No Strava activities found');
        return [];
      }
      
      // Filter for actual run activities with real data
      const runActivities = data
        .filter((activity: any) => 
          activity.type && 
          activity.type.toLowerCase().includes('run') &&
          activity.distance > 0 &&
          activity.moving_time > 0 &&
          activity.start_date
        )
        .map((activity: any) => ({
          id: activity.id?.toString() || Math.random().toString(),
          name: activity.name || 'Unnamed Run',
          type: activity.type,
          start_date: activity.start_date,
          distance: Number(activity.distance) || 0,
          moving_time: Number(activity.moving_time) || 0,
          total_elevation_gain: Number(activity.total_elevation_gain) || 0,
          average_speed: Number(activity.average_speed) || 0,
          average_heartrate: activity.average_heartrate ? Number(activity.average_heartrate) : undefined,
          max_heartrate: activity.max_heartrate ? Number(activity.max_heartrate) : undefined,
          calories: activity.calories ? Number(activity.calories) : undefined,
          is_run_activity: true,
          run_tag: activity.run_tag || 'easy'
        }))
        .filter(run => {
          // Additional validation - only include runs within the time range
          const runDate = new Date(run.start_date);
          const now = new Date();
          const diffDays = Math.ceil((now.getTime() - runDate.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays >= 0 && diffDays <= days;
        })
        .slice(0, 10); // Limit to recent 10 runs max
      
      // Load detailed data for recent runs only if we have run activities
      if (runActivities.length === 0) {
        console.log('No valid run activities found in date range');
        return [];
      }
      
      const runsWithDetails = await Promise.all(
        runActivities.slice(0, 3).map(async (run: RunData) => { // Only load details for 3 most recent
          try {
            const detailResponse = await fetch(`/api/strava-detail?activityId=${run.id}&userId=${userId}`);
            if (detailResponse.ok) {
              const detail = await detailResponse.json();
              
              // Only include valid detailed data
              return {
                ...run,
                splits_metric: detail.splits_metric && detail.splits_metric.length > 0 ? detail.splits_metric : undefined,
                best_efforts: detail.best_efforts && detail.best_efforts.length > 0 ? detail.best_efforts : undefined,
                zones: detail.zones && detail.zones.length > 0 ? detail.zones : undefined
              };
            }
          } catch (error) {
            console.warn(`Failed to load details for run ${run.id}:`, error);
          }
          return run;
        })
      );
      
      // Merge detailed runs with basic runs
      const finalRuns = [
        ...runsWithDetails,
        ...runActivities.slice(3) // Basic data for remaining runs
      ];
      
      console.log(`✅ Loaded ${finalRuns.length} valid runs (${runsWithDetails.filter(r => r.splits_metric).length} with detailed splits)`);
      return finalRuns;
      
    } catch (error) {
      console.error('Error fetching runs:', error);
      return [];
    }
  });
};

const fetchRecentNutrition = async (days: number = 7): Promise<DailyNutrition[]> => {
  return getCachedData(`nutrition_${days}`, async () => {
    try {
      console.log(`📊 Fetching nutrition data for ${days} days...`);
      const nutritionData: DailyNutrition[] = [];
      const today = new Date();
      
      for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateString = date.toISOString().split('T')[0];
        
        try {
          // Try to get actual Firestore nutrition data
          const response = await fetch(`/api/nutrition?date=${dateString}&userId=${userId}`);
          if (response.ok) {
            const dayData = await response.json();
            
            // Only include if we have real entries with actual food data
            if (dayData && dayData.entries && dayData.entries.length > 0) {
              // Validate entries have real food data
              const validEntries = dayData.entries.filter(entry => 
                entry.foodId && 
                entry.foodId !== 'Unknown Food' && 
                entry.calories > 0
              );
              
              if (validEntries.length > 0) {
                nutritionData.push({
                  date: dateString,
                  entries: validEntries,
                  totals: dayData.totals || {
                    calories: validEntries.reduce((sum, e) => sum + (e.calories * e.quantity), 0),
                    protein: validEntries.reduce((sum, e) => sum + (e.protein * e.quantity), 0),
                    carbs: validEntries.reduce((sum, e) => sum + (e.carbs * e.quantity), 0),
                    fat: validEntries.reduce((sum, e) => sum + (e.fat * e.quantity), 0),
                    fiber: validEntries.reduce((sum, e) => sum + (e.fiber * e.quantity), 0)
                  }
                });
                console.log(`✅ Valid nutrition data found for ${dateString}: ${validEntries.length} food items`);
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to load nutrition for ${dateString}:`, error);
        }
      }
      
      console.log(`📊 Final nutrition data: ${nutritionData.length} days with real food entries`);
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

// Extract time range from user query
const extractTimeRange = (query: string) => {
  const lowercaseQuery = query.toLowerCase();
  const today = new Date();
  
  // Today/yesterday
  if (lowercaseQuery.includes('today') || lowercaseQuery.includes('this morning')) {
    return { days: 1, label: 'today', description: 'today\'s data' };
  }
  
  if (lowercaseQuery.includes('yesterday')) {
    return { days: 2, label: 'yesterday', description: 'yesterday\'s data', offset: 1 };
  }
  
  // This week/last week
  if (lowercaseQuery.includes('this week') || lowercaseQuery.includes('past week')) {
    return { days: 7, label: 'this week', description: 'this week\'s data' };
  }
  
  if (lowercaseQuery.includes('last week')) {
    return { days: 7, label: 'last week', description: 'last week\'s data', offset: 7 };
  }
  
  // Month ranges
  if (lowercaseQuery.includes('this month') || lowercaseQuery.includes('past month')) {
    return { days: 30, label: 'this month', description: 'this month\'s data' };
  }
  
  // Specific number patterns
  const dayMatches = lowercaseQuery.match(/(?:last|past)\s+(\d+)\s+days?/);
  if (dayMatches) {
    const days = parseInt(dayMatches[1]);
    return { days, label: `last ${days} days`, description: `last ${days} days of data` };
  }
  
  const weekMatches = lowercaseQuery.match(/(?:last|past)\s+(\d+)\s+weeks?/);
  if (weekMatches) {
    const weeks = parseInt(weekMatches[1]);
    const days = weeks * 7;
    return { days, label: `last ${weeks} weeks`, description: `last ${weeks} weeks of data` };
  }
  
  // Recent activity patterns
  if (lowercaseQuery.includes('recent') || lowercaseQuery.includes('latest')) {
    return { days: 3, label: 'recent', description: 'recent data (3 days)' };
  }
  
  // Default based on data type
  if (/\b(run|running|pace|workout|exercise)\b/.test(lowercaseQuery)) {
    return { days: 7, label: 'recent runs', description: 'last 7 days of running data' };
  }
  
  if (/\b(food|eat|nutrition|meal)\b/.test(lowercaseQuery)) {
    return { days: 3, label: 'recent nutrition', description: 'last 3 days of nutrition data' };
  }
  
  // Default fallback
  return { days: 7, label: 'recent activity', description: 'last 7 days of data' };
};

// Smart context building based on query analysis and time range
const buildContextForQuery = async (query: string, userData: UserData) => {
  const lowercaseQuery = query.toLowerCase();
  
  // Extract time range from query
  const timeRange = extractTimeRange(query);
  
  // Determine what data is relevant
  const needsRunData = /\b(run|running|pace|km|tempo|easy|interval|split|heart rate|hr|bpm)\b/i.test(query);
  const needsNutritionData = /\b(food|eat|nutrition|calorie|protein|carb|meal|diet)\b/i.test(query);
  const needsBodyData = /\b(body|weight|fat|composition|muscle|hdl|ldl|glucose|blood)\b/i.test(query);
  
  console.log(`🎯 Query analysis: needs runs=${needsRunData}, nutrition=${needsNutritionData}, body=${needsBodyData}, timeRange=${timeRange.label}`);
  
  let context = `You are a helpful health coach. Answer ONLY what the user asks. DO NOT give unsolicited advice.

CRITICAL RULES:
1. Answer the specific question asked - nothing more
2. Use ONLY the real data provided below
3. NEVER make up or fabricate data
4. NO unsolicited training advice, nutrition timing, sleep advice, or recovery protocols
5. Keep responses concise and focused
6. If no data is available, say "No data available" instead of making something up

QUERY: "${query}"
TIME RANGE: ${timeRange.description}

`;
  
  // Add relevant data sections ONLY if real data exists
  if (needsRunData && userData.recentRuns.length > 0) {
    const relevantRuns = userData.recentRuns.filter(run => {
      const runDate = new Date(run.start_date);
      return timeRange.offset ? 
        isDateInRange(runDate, timeRange.days, timeRange.offset) :
        isWithinDays(runDate, timeRange.days);
    });
    
    if (relevantRuns.length > 0) {
      context += `=== ACTUAL RUNNING DATA (${timeRange.label.toUpperCase()}) ===\n`;
      relevantRuns.forEach((run, index) => {
        const runDate = new Date(run.start_date);
        context += `"${run.name}" - ${runDate.toLocaleDateString()}\n`;
        context += `Distance: ${run.distance.toFixed(2)}km, Duration: ${Math.round(run.moving_time / 60)}min\n`;
        context += `Run Type: ${run.run_tag}\n`;
        context += `Avg HR: ${run.average_heartrate || 'N/A'} bpm\n`;
        context += `Avg Pace: ${formatPace(run.moving_time / run.distance)}/km\n`;
        
        if (run.splits_metric && run.splits_metric.length > 0) {
          context += `KM SPLITS:\n`;
          run.splits_metric.forEach((split, kmIndex) => {
            const pace = split.moving_time;
            const minutes = Math.floor(pace / 60);
            const seconds = pace % 60;
            const hr = split.average_heartrate ? ` (${Math.round(split.average_heartrate)}bpm)` : '';
            context += `  Km ${kmIndex + 1}: ${minutes}:${seconds.toString().padStart(2, '0')}/km${hr}\n`;
          });
        }
        context += '\n';
      });
    } else {
      context += `=== NO RUNNING DATA AVAILABLE for ${timeRange.label} ===\n\n`;
    }
  }
  
  if (needsNutritionData && userData.recentNutrition.length > 0) {
    const relevantNutrition = userData.recentNutrition.filter(day => {
      const dayDate = new Date(day.date);
      return timeRange.offset ?
        isDateInRange(dayDate, timeRange.days, timeRange.offset) :
        isWithinDays(dayDate, timeRange.days);
    });
    
    if (relevantNutrition.length > 0) {
      context += `=== ACTUAL NUTRITION DATA (${timeRange.label.toUpperCase()}) ===\n`;
      relevantNutrition.forEach((day) => {
        context += `${new Date(day.date).toLocaleDateString()}: ${day.totals.calories} cal, ${day.totals.protein}g protein\n`;
        if (day.entries.length > 0) {
          context += `ACTUAL FOODS EATEN:\n`;
          day.entries.forEach((food) => {
            const totalCals = Math.round(food.calories * food.quantity);
            context += `- ${food.foodId}: ${food.quantity} ${food.unit} (${totalCals}cal)\n`;
          });
        }
        context += '\n';
      });
    } else {
      context += `=== NO NUTRITION DATA AVAILABLE for ${timeRange.label} ===\n\n`;
    }
  }
  
  if (needsBodyData && userData.currentBody) {
    context += `=== CURRENT BODY METRICS ===\n`;
    context += `Weight: ${userData.currentBody.weight}kg\n`;
    context += `Body Fat: ${userData.currentBody.bodyFat}%\n`;
    context += `HDL: ${userData.currentBody.hdl} mg/dL\n`;
    context += `LDL: ${userData.currentBody.ldl} mg/dL\n`;
    context += `Glucose: ${userData.currentBody.glucose} mg/dL\n`;
    context += `Last updated: ${userData.currentBody.lastUpdated}\n\n`;
  }
  
  // Add response format instructions
  context += `RESPONSE FORMAT:
- Be direct and concise
- Answer only what was asked
- Use **bold** for key metrics
- NO training advice unless specifically requested
- NO nutrition timing advice unless asked
- NO recovery protocols unless asked
- End your response after answering the question

`;
  
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
        'How was my run today?',
        'Analyze my pace from yesterday\'s run',
        'Show me this week\'s running performance',
        'Compare my easy runs vs tempo runs this month',
        'What do my km splits tell me from my last 3 runs?'
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
        'What did I eat today?',
        'Analyze my protein intake this week',
        'Recommend foods similar to what I ate yesterday',
        'Am I eating enough calories this week?',
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
        'Is my current weight healthy for running?',
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
      title: 'Time-Based Questions',
      icon: Clock,
      color: 'from-teal-100 to-cyan-100 border-teal-300',
      textColor: 'text-teal-700',
      iconColor: 'text-teal-600',
      prompts: [
        'What should I focus on today?',
        'How was my week compared to last week?',
        'Show me my progress over the last month',
        'What did I do differently yesterday?',
        'Am I improving over the past 2 weeks?'
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

  // Send message to AI with smart context and dynamic data fetching
  const sendMessageToAI = async (messageContent: string) => {
    try {
      // Extract time range from user query
      const timeRange = extractTimeRange(messageContent);
      console.log(`🎯 Detected time range: ${timeRange.label} (${timeRange.days} days)`);
      
      // Determine what data types are needed
      const needsRunData = /\b(run|running|pace|km|tempo|easy|interval|split|heart rate|hr|bpm)\b/i.test(messageContent);
      const needsNutritionData = /\b(food|eat|nutrition|calorie|protein|carb|meal|diet)\b/i.test(messageContent);
      const needsBodyData = /\b(body|weight|fat|composition|muscle|hdl|ldl|glucose|blood)\b/i.test(messageContent);
      
      // Fetch only the data we need for this specific time range
      const [dynamicRunData, dynamicNutritionData] = await Promise.all([
        needsRunData ? fetchRecentRuns(timeRange.days) : Promise.resolve([]),
        needsNutritionData ? fetchRecentNutrition(timeRange.days) : Promise.resolve([])
      ]);
      
      // Build context with fresh, targeted data
      const context = await buildContextForQuery(messageContent, {
        recentRuns: dynamicRunData,
        recentNutrition: dynamicNutritionData,
        currentBody: needsBodyData ? userData?.currentBody || null : null,
        weeklyStats: userData?.weeklyStats || { totalDistance: 0, totalRuns: 0, avgPace: 0, avgCalories: 0 }
      });
      
      const conversationMessages = [
        { role: "system", content: context },
        ...messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        { role: "user", content: messageContent }
      ];

      console.log(`📤 Sending message with dynamic context (${timeRange.label})`);
      
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
            <span>Smart time-based analysis (today, yesterday, this week, last month)</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
              Dynamic Date Ranges
            </span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
              Run Tags Maintained
            </span>
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
