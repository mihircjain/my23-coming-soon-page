import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Zap, 
  MessageCircle, 
  Send, 
  RefreshCw, 
  Heart, 
  Activity, 
  Target, 
  TrendingUp,
  Bot,
  User,
  Apple,
  Dumbbell,
  Calendar,
  Clock
} from 'lucide-react';

// Import Firestore utilities
import { getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

// Type definitions
interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

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
  run_tag: string;
  splits_metric?: Array<{
    distance: number;
    elapsed_time: number;
    elevation_difference: number;
    moving_time: number;
    pace_zone: number;
    split: number;
    average_speed: number;
    average_heartrate?: number;
  }>;
  best_efforts?: any[];
  zones?: any[];
}

interface FoodEntry {
  foodId: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
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

interface TimeRange {
  label: string;
  days: number;
  description: string;
  offset?: number;
}

// Initialize Firebase
let db: any = null;

const initializeFirebase = () => {
  if (db) return db;
  
  try {
    const app = getApps().length > 0 ? getApps()[0] : null;
    if (app) {
      db = getFirestore(app);
      return db;
    } else {
      console.log('⚠️ Firebase app not initialized - nutrition data will be unavailable');
      return null;
    }
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    return null;
  }
};

// Cache for data
const dataCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const getCachedData = async <T extends unknown>(key: string, fetchFn: () => Promise<T>): Promise<T> => {
  const cached = dataCache.get(key);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    console.log(`📋 Using cached data for ${key}`);
    return cached.data;
  }
  
  console.log(`🔄 Fetching fresh data for ${key}`);
  const data = await fetchFn();
  dataCache.set(key, { data, timestamp: now });
  return data;
};

// Utility functions
const formatPace = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const formatTime = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.round(totalSeconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Time range extraction
const extractTimeRange = (query: string): TimeRange => {
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('today')) {
    return { label: 'today', days: 1, description: 'Today only', offset: 0 };
  }
  if (lowerQuery.includes('yesterday')) {
    return { label: 'yesterday', days: 1, description: 'Yesterday only', offset: 1 };
  }
  if (lowerQuery.includes('this week')) {
    return { label: 'this week', days: 7, description: 'This week' };
  }
  if (lowerQuery.includes('last week')) {
    return { label: 'last week', days: 7, description: 'Last week', offset: 7 };
  }
  if (lowerQuery.includes('this month')) {
    return { label: 'this month', days: 30, description: 'This month' };
  }
  if (lowerQuery.includes('last month')) {
    return { label: 'last month', days: 30, description: 'Last month', offset: 30 };
  }
  
  return { label: 'recent', days: 7, description: 'Recent data (last 7 days)' };
};

// Date utilities
const isWithinDays = (date: Date, days: number): boolean => {
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= days;
};

const isDateInRange = (date: Date, days: number, offset: number): boolean => {
  const now = new Date();
  const startOffset = offset;
  const endOffset = offset + days;
  const diffTime = now.getTime() - date.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays >= startOffset && diffDays <= endOffset;
};

// Data fetching functions
const fetchRecentRuns = async (days: number = 7): Promise<RunData[]> => {
  return getCachedData(`runs_${days}`, async () => {
    try {
      console.log(`🏃 Fetching run data for ${days} days...`);
      
      const params = new URLSearchParams({
        userId: "mihir_jain",
        mode: 'cached',
        days: days.toString()
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
          run_tag: activity.run_tag || activity.runType || 'easy'
        }))
        .filter(run => {
          const runDate = new Date(run.start_date);
          const now = new Date();
          const diffDays = Math.ceil((now.getTime() - runDate.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays >= 0 && diffDays <= days;
        })
        .slice(0, 10);
      
      if (runActivities.length === 0) {
        console.log('No valid run activities found in date range');
        return [];
      }
      
      const runsWithDetails = await Promise.all(
        runActivities.slice(0, 3).map(async (run: RunData) => {
          try {
            const detailResponse = await fetch(`/api/strava-detail?activityId=${run.id}&userId=mihir_jain`);
            if (detailResponse.ok) {
              const detail = await detailResponse.json();
              
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
      
      const finalRuns = [
        ...runsWithDetails,
        ...runActivities.slice(3)
      ];
      
      console.log(`✅ Loaded ${finalRuns.length} valid runs`);
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
      
      const firestore = initializeFirebase();
      if (!firestore) {
        console.log('⚠️ Firebase not available');
        return [];
      }
      
      const nutritionData: DailyNutrition[] = [];
      const today = new Date();
      
      for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateString = date.toISOString().split('T')[0];
        
        try {
          const logRef = doc(firestore, "nutritionLogs", dateString);
          const logSnapshot = await getDoc(logRef);
          
          if (logSnapshot.exists()) {
            const logData = logSnapshot.data();
            
            if (logData && logData.totals && logData.totals.calories > 0) {
              const entries = logData.entries || [];
              
              const validEntries = entries.filter((entry: any) => 
                entry && 
                entry.foodId && 
                typeof entry.foodId === 'string' &&
                entry.foodId.length > 0 &&
                entry.foodId !== 'Unknown Food' && 
                entry.quantity &&
                Number(entry.quantity) > 0
              );
              
              if (validEntries.length > 0) {
                const totals = {
                  calories: Number(logData.totals.calories) || 0,
                  protein: Number(logData.totals.protein) || 0,
                  carbs: Number(logData.totals.carbs) || 0,
                  fat: Number(logData.totals.fat) || 0,
                  fiber: Number(logData.totals.fiber) || 0
                };
                
                const entriesWithNutrition = validEntries.map((entry: any) => ({
                  foodId: entry.foodId,
                  quantity: Number(entry.quantity) || 1,
                  unit: entry.unit || 'serving',
                  calories: Math.round(totals.calories / validEntries.length),
                  protein: Math.round(totals.protein / validEntries.length),
                  carbs: Math.round(totals.carbs / validEntries.length),
                  fat: Math.round(totals.fat / validEntries.length),
                  fiber: Math.round(totals.fiber / validEntries.length),
                  timestamp: new Date().toISOString()
                }));
                
                nutritionData.push({
                  date: dateString,
                  entries: entriesWithNutrition,
                  totals: totals
                });
                
                console.log(`✅ Valid nutrition data found for ${dateString}: ${validEntries.length} foods, ${Math.round(totals.calories)} calories`);
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
      console.log('📊 Fetching body metrics from Firestore...');
      
      const firestore = initializeFirebase();
      if (!firestore) {
        console.log('⚠️ Firebase not available');
        return null;
      }
      
      const bloodMarkersRef = doc(firestore, "blood_markers", "mihir_jain");
      const bloodMarkersSnapshot = await getDoc(bloodMarkersRef);
      
      if (bloodMarkersSnapshot.exists()) {
        const data = bloodMarkersSnapshot.data();
        
        console.log('✅ Loaded body metrics from blood_markers collection');
        
        const parseValue = (value: string) => {
          if (!value) return 0;
          const match = value.toString().match(/^([0-9.]+)/);
          return match ? Number(match[1]) : 0;
        };
        
        return {
          weight: data.weight || 0,
          bodyFat: data.bodyFat || 0,
          leanMass: data.leanMass || 0,
          hdl: parseValue(data["HDL Cholesterol"]),
          ldl: parseValue(data["LDL Cholesterol"]),
          glucose: parseValue(data["Glucose (Random)"]),
          hba1c: parseValue(data["HbA1C"]),
          vitaminD: parseValue(data["Vitamin D"]),
          lastUpdated: data.date || 'Unknown'
        };
      }
      
      const today = new Date().toISOString().split('T')[0];
      const nutritionRef = doc(firestore, "nutritionLogs", today);
      const nutritionSnapshot = await getDoc(nutritionRef);
      
      if (nutritionSnapshot.exists()) {
        const data = nutritionSnapshot.data();
        
        if (data && Object.keys(data).some(key => key.includes('Cholesterol') || key.includes('Glucose'))) {
          console.log('✅ Found body metrics in nutritionLogs');
          
          const parseValue = (value: string) => {
            if (!value) return 0;
            const match = value.toString().match(/^([0-9.]+)/);
            return match ? Number(match[1]) : 0;
          };
          
          return {
            weight: data.weight || 0,
            bodyFat: data.bodyFat || 0,
            leanMass: data.leanMass || 0,
            hdl: parseValue(data["HDL Cholesterol"]),
            ldl: parseValue(data["LDL Cholesterol"]),
            glucose: parseValue(data["Glucose (Random)"]),
            hba1c: parseValue(data["HbA1C"]),
            vitaminD: parseValue(data["Vitamin D"]),
            lastUpdated: data.date || today
          };
        }
      }
      
      console.log('📭 No body metrics found in Firestore');
      return null;
      
    } catch (error) {
      console.error('Error fetching body metrics:', error);
      return null;
    }
  });
};

// Context building
const buildContextForQuery = async (query: string, userData: UserData) => {
  const lowercaseQuery = query.toLowerCase();
  const timeRange = extractTimeRange(query);
  
  const needsRunData = /\b(run|running|pace|km|tempo|easy|interval|split|heart rate|hr|bpm)\b/i.test(query);
  const needsNutritionData = /\b(food|eat|nutrition|calorie|protein|carb|meal|diet)\b/i.test(query);
  const needsBodyData = /\b(body|weight|fat|composition|muscle|hdl|ldl|glucose|blood)\b/i.test(query);
  
  console.log(`🎯 Query analysis: needs runs=${needsRunData}, nutrition=${needsNutritionData}, body=${needsBodyData}, timeRange=${timeRange.label}`);
  
  let context = `You are a data analyst. You can ONLY use the data provided below. DO NOT make up any information.

STRICT RULES:
1. Use ONLY the exact data provided in the sections below
2. If no data is provided for something, say "No data available"
3. NEVER fabricate food items, run splits, or any other data
4. NEVER give training advice, nutrition advice, or recommendations unless specifically asked
5. Be direct and factual only
6. If asked about food and no food data is provided, say "No nutrition data found for [time period]"
7. If asked about runs and no run data is provided, say "No run data found for [time period]"

USER QUERY: "${query}"
TIME RANGE REQUESTED: ${timeRange.description}

`;

  let hasAnyData = false;

  if (needsRunData) {
    const relevantRuns = userData.recentRuns.filter(run => {
      const runDate = new Date(run.start_date);
      return timeRange.offset ? 
        isDateInRange(runDate, timeRange.days, timeRange.offset) :
        isWithinDays(runDate, timeRange.days);
    });
    
    if (relevantRuns.length > 0) {
      hasAnyData = true;
      context += `=== ACTUAL RUN DATA (${timeRange.label}) ===\n`;
      relevantRuns.forEach((run, index) => {
        context += `RUN: "${run.name}" on ${new Date(run.start_date).toLocaleDateString()}\n`;
        context += `Distance: ${run.distance.toFixed(2)}km\n`;
        context += `Duration: ${Math.round(run.moving_time / 60)} minutes\n`;
        context += `Run Type: ${run.run_tag}\n`;
        if (run.average_heartrate) context += `Average HR: ${run.average_heartrate} bpm\n`;
        if (run.max_heartrate) context += `Max HR: ${run.max_heartrate} bpm\n`;
        context += `Average Pace: ${formatPace(run.moving_time / run.distance)}/km\n`;
        
        if (run.splits_metric && run.splits_metric.length > 0) {
          context += `KM SPLITS:\n`;
          run.splits_metric.forEach((split, kmIndex) => {
            const pace = split.moving_time;
            const minutes = Math.floor(pace / 60);
            const seconds = pace % 60;
            const hr = split.average_heartrate ? ` (HR: ${Math.round(split.average_heartrate)}bpm)` : '';
            const elev = split.elevation_difference !== undefined ? ` (${split.elevation_difference > 0 ? '+' : ''}${split.elevation_difference}m)` : '';
            context += `  Km ${kmIndex + 1}: ${minutes}:${seconds.toString().padStart(2, '0')}/km${hr}${elev}\n`;
          });
        }
        context += `\n`;
      });
    } else {
      context += `=== NO RUN DATA FOUND for ${timeRange.label} ===\n\n`;
    }
  }
  
  if (needsNutritionData) {
    const relevantNutrition = userData.recentNutrition.filter(day => {
      const dayDate = new Date(day.date);
      return timeRange.offset ?
        isDateInRange(dayDate, timeRange.days, timeRange.offset) :
        isWithinDays(dayDate, timeRange.days);
    });
    
    if (relevantNutrition.length > 0) {
      hasAnyData = true;
      context += `=== ACTUAL NUTRITION DATA (${timeRange.label}) ===\n`;
      relevantNutrition.forEach((day) => {
        context += `DATE: ${new Date(day.date).toLocaleDateString()}\n`;
        context += `Total Calories: ${Math.round(day.totals.calories)}\n`;
        context += `Total Protein: ${Math.round(day.totals.protein)}g\n`;
        context += `Total Carbs: ${Math.round(day.totals.carbs)}g\n`;
        context += `Total Fat: ${Math.round(day.totals.fat)}g\n`;
        
        if (day.entries.length > 0) {
          context += `ACTUAL FOODS EATEN:\n`;
          day.entries.forEach((food) => {
            const totalCals = Math.round(food.calories * food.quantity);
            const totalProtein = Math.round(food.protein * food.quantity);
            context += `- ${food.foodId}: ${food.quantity} ${food.unit} (${totalCals} calories, ${totalProtein}g protein)\n`;
          });
        } else {
          context += `No individual food items logged\n`;
        }
        context += `\n`;
      });
    } else {
      context += `=== NO NUTRITION DATA FOUND for ${timeRange.label} ===\n\n`;
    }
  }
  
  if (needsBodyData && userData.currentBody) {
    hasAnyData = true;
    context += `=== ACTUAL BODY METRICS ===\n`;
    context += `Weight: ${userData.currentBody.weight}kg\n`;
    context += `Body Fat: ${userData.currentBody.bodyFat}%\n`;
    context += `HDL: ${userData.currentBody.hdl} mg/dL\n`;
    context += `LDL: ${userData.currentBody.ldl} mg/dL\n`;
    context += `Glucose: ${userData.currentBody.glucose} mg/dL\n`;
    context += `Last Updated: ${userData.currentBody.lastUpdated}\n\n`;
  }
  
  if (!hasAnyData) {
    context += `=== NO RELEVANT DATA AVAILABLE ===\n`;
    context += `No data found for the requested time period and data type.\n\n`;
  }
  
  context += `RESPONSE INSTRUCTIONS:
- Answer ONLY using the data provided above
- If no data is shown, say "No data available for [requested time period]"
- Be direct and factual
- Use **bold** for key numbers
- Do NOT make up any information
- Do NOT give advice unless specifically requested

`;
  
  return context;
};

// AI Chat functionality
const chatWithAI = async (message: string, userData: UserData): Promise<string> => {
  try {
    console.log('🤖 Sending message to AI:', message);
    
    const context = await buildContextForQuery(message, userData);
    
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: context },
          { role: 'user', content: message }
        ],
        userData: {
          systemContext: context
        },
        userId: 'mihir_jain',
        source: 'LetsJam',
        sessionId: `letsjam_${Date.now()}`,
        useSystemContext: true,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ AI response received');
    
    const aiMessage = data.choices?.[0]?.message?.content || 
                     data.message || 
                     data.response || 
                     'Sorry, I couldn\'t process that request.';
    
    return aiMessage;
  } catch (error) {
    console.error('❌ Error chatting with AI:', error);
    return 'Sorry, I\'m having trouble connecting to the AI service right now. Please try again later.';
  }
};

// Message Content Component
const MessageContent: React.FC<{ content: string }> = ({ content }) => {
  const formatContent = (text: string) => {
    return text.split(/(\*\*.*?\*\*)/).map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="whitespace-pre-wrap">
      {formatContent(content)}
    </div>
  );
};

// Health Summary Component - FIXED LAYOUT
const SmartHealthSummary: React.FC<{
  userData: UserData;
  onRefresh: () => void;
  isRefreshing: boolean;
  loading: boolean;
}> = ({ userData, onRefresh, isRefreshing, loading }) => {
  const hasRunData = userData.recentRuns.length > 0;
  const hasNutritionData = userData.recentNutrition.length > 0;
  const hasBodyData = userData.currentBody.weight > 0;

  const PromptButton: React.FC<{ prompt: string; onClick: (prompt: string) => void }> = ({ prompt, onClick }) => (
    <Button
      variant="outline"
      size="sm"
      onClick={() => onClick(prompt)}
      className="text-xs p-2 h-auto text-left justify-start hover:bg-blue-50 border-blue-200 w-full"
    >
      {prompt}
    </Button>
  );

  const PromptSection: React.FC<{
    title: string;
    icon: React.ReactNode;
    prompts: string[];
    onPromptClick: (prompt: string) => void;
  }> = ({ title, icon, prompts, onPromptClick }) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        {icon}
        <span>{title}</span>
      </div>
      <div className="space-y-1">
        {prompts.map((prompt, index) => (
          <PromptButton
            key={index}
            prompt={prompt}
            onClick={onPromptClick}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900 flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Quick Actions
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="h-8 w-8 p-0"
        >
          <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-4">
          <div className="animate-pulse text-sm text-gray-500">Loading your data...</div>
        </div>
      ) : (
        <div className="space-y-4">
          <PromptSection
            title="Running"
            icon={<Dumbbell className="h-4 w-4 text-green-600" />}
            prompts={hasRunData ? [
              'How was my run today?',
              'Analyze my splits from yesterday',
              'Show me my heart rate data',
              'Was my pacing consistent?'
            ] : [
              'Connect Strava to see running prompts'
            ]}
            onPromptClick={(prompt) => {
              const event = new CustomEvent('sendPrompt', { detail: prompt });
              window.dispatchEvent(event);
            }}
          />

          <PromptSection
            title="Nutrition"
            icon={<Apple className="h-4 w-4 text-orange-600" />}
            prompts={hasNutritionData ? [
              'What did I eat today?',
              'How many calories yesterday?',
              'What foods do I eat most?',
              'Am I getting enough protein?'
            ] : [
              'No nutrition data available yet'
            ]}
            onPromptClick={(prompt) => {
              const event = new CustomEvent('sendPrompt', { detail: prompt });
              window.dispatchEvent(event);
            }}
          />

          <PromptSection
            title="General"
            icon={<Target className="h-4 w-4 text-blue-600" />}
            prompts={[
              'How was my week overall?',
              'Am I making progress?',
              'What should I focus on?',
              'Show me my recent activity'
            ]}
            onPromptClick={(prompt) => {
              const event = new CustomEvent('sendPrompt', { detail: prompt });
              window.dispatchEvent(event);
            }}
          />

          {/* Quick Stats - FIXED */}
          <div className="pt-3 border-t border-gray-200 space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Quick Stats</h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Runs this week:</span>
                <span className="font-medium">{userData.weeklyStats.totalRuns}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total distance:</span>
                <span className="font-medium">{userData.weeklyStats.totalDistance.toFixed(1)}km</span>
              </div>
              {hasNutritionData && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg calories:</span>
                  <span className="font-medium">{Math.round(userData.weeklyStats.avgCalories)}</span>
                </div>
              )}
              {hasBodyData && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Weight:</span>
                  <span className="font-medium">{userData.currentBody.weight}kg</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Main component
const LetsJam: React.FC = () => {
  const userId = "mihir_jain";
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [userData, setUserData] = useState<UserData>({
    recentRuns: [],
    recentNutrition: [],
    currentBody: {
      weight: 0, bodyFat: 0, leanMass: 0, hdl: 0, ldl: 0, 
      glucose: 0, hba1c: 0, vitaminD: 0, lastUpdated: ''
    },
    weeklyStats: { totalDistance: 0, totalRuns: 0, avgPace: 0, avgCalories: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to AI message start
  const scrollToLatestAIMessage = () => {
    const messagesContainer = messagesContainerRef.current;
    if (messagesContainer) {
      const aiMessages = messagesContainer.querySelectorAll('[data-role="assistant"]');
      if (aiMessages.length > 0) {
        const lastAIMessage = aiMessages[aiMessages.length - 1];
        lastAIMessage.scrollIntoView({ 
          behavior: 'smooth',
          block: 'start'
        });
        console.log('📍 Scrolled to start of AI response');
      }
    }
  };

  useEffect(() => {
    if (isTyping) {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    } else if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant') {
        setTimeout(() => {
          scrollToLatestAIMessage();
        }, 200);
      }
    }
  }, [messages, isTyping]);

  // Fetch user data
  const fetchUserData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      if (forceRefresh) {
        setIsRefreshing(true);
        dataCache.clear();
      }

      console.log('🔄 Fetching user data...');
      
      const [recentRuns, recentNutrition, currentBody] = await Promise.all([
        fetchRecentRuns(7),
        fetchRecentNutrition(7),
        fetchCurrentBodyMetrics()
      ]);

      console.log('📊 Data fetch results:', {
        runs: recentRuns.length,
        nutritionDays: recentNutrition.length,
        hasBodyData: !!currentBody,
        runsWithSplits: recentRuns.filter(r => r.splits_metric?.length > 0).length,
        totalFoodEntries: recentNutrition.reduce((sum, day) => sum + day.entries.length, 0)
      });

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
          weight: 0, bodyFat: 0, leanMass: 0, hdl: 0, ldl: 0, 
          glucose: 0, hba1c: 0, vitaminD: 0, lastUpdated: ''
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

  // Handle messages
  const handleSendMessage = async (message: string = inputMessage) => {
    if (!message.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: message.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    try {
      const aiResponse = await chatWithAI(message.trim(), userData);
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('❌ Error getting AI response:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error while processing your request. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  // Listen for prompt events
  useEffect(() => {
    const handlePromptEvent = (event: CustomEvent) => {
      handleSendMessage(event.detail);
    };

    window.addEventListener('sendPrompt', handlePromptEvent as EventListener);
    return () => {
      window.removeEventListener('sendPrompt', handlePromptEvent as EventListener);
    };
  }, [userData]);

  // Initial data load
  useEffect(() => {
    fetchUserData();
  }, []);

  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50">
      {/* Header */}
      <div className="border-b border-white/20 bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Zap className="h-8 w-8 text-blue-600" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">LetsJam</h1>
                <p className="text-sm text-gray-600">AI Health Coach</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 text-sm text-gray-600">
                <MessageCircle className="h-4 w-4" />
                <span>Ask me about your health data</span>
              </div>
            </div>
          </div>
          
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>AI health coach with validated real data only</span>
            <span className="hidden md:inline">•</span>
            <span>Smart scrolling to AI responses</span>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
              Validated Data Only
            </span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
              Auto-Scroll to AI Response
            </span>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
              Dynamic Chat Expansion
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          
          {/* Left Column - Chat Interface */}
          <div className="xl:col-span-3 space-y-4">
            
            <Card className="bg-white/90 backdrop-blur-sm border border-white/20 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Bot className="h-5 w-5 text-blue-600" />
                  Health Coach Chat
                  <Badge variant="secondary" className="ml-auto">
                    {userData.recentRuns.length} runs • {userData.recentNutrition.length} days nutrition
                  </Badge>
                </CardTitle>
              </CardHeader>
              
              <CardContent className="p-0">
                <div 
                  ref={messagesContainerRef}
                  className="p-4 space-y-4 min-h-[500px] overflow-y-auto"
                  style={{ 
                    maxHeight: 'calc(100vh - 400px)',
                    height: 'auto'
                  }}
                >
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      data-role={message.role}
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
                          <span className="text-sm text-teal-700">Analyzing your real data...</span>
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
              </CardContent>
              
              <div className="p-4 border-t border-gray-200 bg-gray-50/50">
                <div className="flex gap-2">
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask about your runs, nutrition, or health data..."
                    className="flex-1 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    disabled={isTyping}
                  />
                  <Button 
                    onClick={() => handleSendMessage()}
                    disabled={!inputMessage.trim() || isTyping}
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column - Health Summary */}
          <div className="xl:col-span-1">
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
    </div>
  );
};

export default LetsJam;
