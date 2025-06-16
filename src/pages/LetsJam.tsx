// Enhanced LetsJam with FIXED Issues - Updated with Current Body Data
// FIXES: 1) No detailed km-by-km data for runs 2) Configurable date ranges 3) Updated body parameters
const userId = "mihir_jain";

import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, RefreshCw, Activity, Utensils, Heart, TrendingUp, Target, Zap, Calendar, BarChart3, ArrowLeft, User, MessageSquare, Flame, Droplet, Clock, Tag, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { db } from '@/lib/firebaseConfig';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';

// Enhanced types with run tags
interface HealthData {
  date: string;
  heartRate: number | null;
  caloriesBurned: number;
  caloriesConsumed: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  workoutDuration: number;
  activityTypes: string[];
}

interface RecentActivity {
  id: string;
  name: string;
  type: string;
  start_date: string;
  date: string;
  distance: number;
  moving_time: number;
  duration: number;
  total_elevation_gain: number;
  average_speed: number;
  max_speed: number;
  has_heartrate: boolean;
  average_heartrate?: number;
  max_heartrate?: number;
  calories?: number;
  caloriesBurned?: number;
  run_tag?: string;
  is_run_activity?: boolean;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface NutritionData {
  avgCalories: number;
  avgProtein: number;
  avgFat: number;
  avgCarbs: number;
  avgFiber: number;
}

interface ActivityData {
  workoutsPerWeek: number;
  avgHeartRate: number;
  avgCaloriesBurned: number;
  avgDuration: number;
}

// Enhanced training analysis interface
interface TrainingAnalysis {
  totalRuns: number;
  weeklyDistance: number;
  hardVsEasyRatio: number;
  trainingStress: 'low' | 'moderate' | 'high' | 'overreaching';
  recoveryScore: number;
  runTagDistribution: Record<string, number>;
  recommendations: string[];
  dateRange: string; // Added date range info
}

// UPDATED: Current body composition data from latest BodyJam
interface CurrentBodyData {
  weight: number;
  bodyFat: number;
  fatMass: number;
  leanMass: number;
  boneMass: number;
  visceralFatMass: number;
  rmr: number;
  // Blood markers
  hdl: number;
  ldl: number;
  totalCholesterol: number;
  hba1c: number;
  glucose: number;
  tsh: number;
  vitaminD: number;
  vitaminB12: number;
  hemoglobin: number;
  // Date range for data
  lastUpdated: string;
}

interface UserData {
  nutrition: NutritionData;
  activity: ActivityData;
  bloodMarkers: Record<string, any>;
  nutritionDetails?: any[];
  trainingAnalysis?: TrainingAnalysis;
  currentBody?: CurrentBodyData; // Added current body data
  dataDateRange?: string; // Added date range tracking
}

// Run tag configuration with colors and intensities - Updated with green/blue theme
const RUN_TAG_CONFIG = {
  'easy': { label: 'Easy', emoji: '🚶', intensity: 1, color: 'green' },
  'recovery': { label: 'Recovery', emoji: '💙', intensity: 0.5, color: 'blue' },
  'long': { label: 'Long', emoji: '🏃', intensity: 2, color: 'emerald' },
  'tempo': { label: 'Tempo', emoji: '⚡', intensity: 3, color: 'teal' },
  'intervals': { label: 'Intervals', emoji: '🔥', intensity: 4, color: 'cyan' },
  'hill-repeats': { label: 'Hill Repeats', emoji: '⛰️', intensity: 3.5, color: 'lime' }
};

// Generate session ID
const generateSessionId = () => {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

// Session storage utilities
const SESSION_STORAGE_KEY = 'letsJam_chatSession';
const MESSAGES_STORAGE_KEY = 'letsJam_messages';

const saveSessionToStorage = (sessionId: string, messages: ChatMessage[]) => {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messages));
    console.log('💾 Saved session to localStorage:', sessionId.slice(-8));
  } catch (error) {
    console.error('Failed to save session:', error);
  }
};

const loadSessionFromStorage = (): { sessionId: string | null, messages: ChatMessage[] } => {
  try {
    const savedSessionId = localStorage.getItem(SESSION_STORAGE_KEY);
    const savedMessages = localStorage.getItem(MESSAGES_STORAGE_KEY);
    
    if (savedSessionId && savedMessages) {
      const parsedMessages = JSON.parse(savedMessages);
      const messagesWithDates = parsedMessages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
      console.log('📂 Loaded session from localStorage:', savedSessionId.slice(-8), 'with', messagesWithDates.length, 'messages');
      return { sessionId: savedSessionId, messages: messagesWithDates };
    }
  } catch (error) {
    console.error('Failed to load session:', error);
  }
  
  return { sessionId: null, messages: [] };
};

const clearSessionStorage = () => {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(MESSAGES_STORAGE_KEY);
    console.log('🗑️ Cleared session storage');
  } catch (error) {
    console.error('Failed to clear session:', error);
  }
};

// Message Component with better rendering
const MessageContent: React.FC<{ content: string }> = ({ content }) => {
  const formatContent = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^\d+\.\s+(.*)$/gm, '<li>$1</li>')
      .replace(/^[-•]\s+(.*)$/gm, '<li>$1</li>')
      .replace(/\n/g, '<br>');
  };

  return (
    <div 
      className="text-sm whitespace-pre-wrap leading-relaxed"
      dangerouslySetInnerHTML={{ __html: formatContent(content) }}
    />
  );
};

// Enhanced function to analyze training load and patterns
const analyzeTrainingLoad = (recentActivities: RecentActivity[], dateRange: string): TrainingAnalysis => {
  const runActivities = recentActivities.filter(activity => 
    activity.is_run_activity || (activity.type && activity.type.toLowerCase().includes('run'))
  );

  // Calculate run tag distribution
  const runTagDistribution: Record<string, number> = {};
  Object.keys(RUN_TAG_CONFIG).forEach(tag => {
    runTagDistribution[tag] = 0;
  });

  let totalTrainingStress = 0;
  let weeklyDistance = 0;
  let hardRuns = 0;
  let easyRuns = 0;

  runActivities.forEach(run => {
    weeklyDistance += run.distance || 0;
    
    const runTag = run.run_tag || 'easy';
    if (runTagDistribution[runTag] !== undefined) {
      runTagDistribution[runTag]++;
    }

    // Calculate training stress based on run type and distance
    const tagConfig = RUN_TAG_CONFIG[runTag as keyof typeof RUN_TAG_CONFIG] || RUN_TAG_CONFIG.easy;
    const runStress = (run.distance || 0) * tagConfig.intensity;
    totalTrainingStress += runStress;

    // Categorize hard vs easy
    if (tagConfig.intensity >= 3) {
      hardRuns++;
    } else {
      easyRuns++;
    }
  });

  // Calculate hard vs easy ratio (ideal is 20:80)
  const totalRuns = runActivities.length;
  const hardVsEasyRatio = totalRuns > 0 ? (hardRuns / totalRuns) * 100 : 0;

  // Determine training stress level
  let trainingStress: 'low' | 'moderate' | 'high' | 'overreaching' = 'low';
  if (totalTrainingStress > 50) trainingStress = 'overreaching';
  else if (totalTrainingStress > 30) trainingStress = 'high';
  else if (totalTrainingStress > 15) trainingStress = 'moderate';

  // Calculate recovery score (0-100)
  const recoveryScore = Math.max(0, 100 - (hardVsEasyRatio > 30 ? 30 : 0) - (totalTrainingStress > 30 ? 20 : 0));

  // Generate smart recommendations
  const recommendations: string[] = [];
  
  if (hardVsEasyRatio > 30) {
    recommendations.push("⚠️ High intensity ratio detected. Consider adding more easy runs for better recovery.");
  }
  
  if (totalTrainingStress > 40) {
    recommendations.push("🔥 High training stress. Schedule a recovery week or reduce intensity.");
  }
  
  if (runTagDistribution.recovery === 0 && totalRuns > 3) {
    recommendations.push("💙 No recovery runs detected. Add 1-2 easy recovery runs per week.");
  }
  
  if (runTagDistribution.long === 0 && totalRuns > 2) {
    recommendations.push("🟦 Consider adding a long run to build endurance.");
  }
  
  if (weeklyDistance < 10 && totalRuns > 0) {
    recommendations.push("📈 Gradually increase weekly distance for better fitness gains.");
  }

  if (recommendations.length === 0 && totalRuns > 0) {
    recommendations.push("✅ Good training balance! Keep up the consistent work.");
  }

  return {
    totalRuns,
    weeklyDistance: Math.round(weeklyDistance * 10) / 10,
    hardVsEasyRatio: Math.round(hardVsEasyRatio),
    trainingStress,
    recoveryScore: Math.round(recoveryScore),
    runTagDistribution,
    recommendations,
    dateRange
  };
};

// Load run tags from Firestore
const loadRunTags = async (activityIds: string[]): Promise<Record<string, string>> => {
  try {
    const response = await fetch('/api/run-tags', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load run tags');
    }

    const data = await response.json();
    console.log('📥 Loaded run tags from API:', data);
    return data;
  } catch (error) {
    console.error('❌ Error loading run tags:', error);
    return {};
  }
};

// UPDATED: Get current body composition data
const getCurrentBodyData = (): CurrentBodyData => {
  return {
    // Latest body composition (June 15, 2025)
    weight: 68.2, // kg (was 72.9)
    bodyFat: 21.2, // % (was 25.7)
    fatMass: 14.5, // kg (was 18.7)
    leanMass: 50.7, // kg (was 51.1)
    boneMass: 3.0, // kg (was 3.1)
    visceralFatMass: 349, // g (was 580)
    rmr: 1472, // kcal/day (was 1479)
    
    // Latest blood markers (June 15, 2025)
    hdl: 52, // mg/dL (was 38) - IMPROVED
    ldl: 87, // mg/dL (was 96) - IMPROVED
    totalCholesterol: 149, // mg/dL (was 144)
    hba1c: 5.4, // % (was 5.1)
    glucose: 84, // mg/dL (was 89) - IMPROVED
    tsh: 2.530, // µIU/mL (was 2.504)
    vitaminD: 55.4, // ng/mL (was 48.2) - IMPROVED
    vitaminB12: 450, // pg/mL (was 405) - IMPROVED
    hemoglobin: 16.8, // g/dL (was 16.3) - IMPROVED
    
    lastUpdated: "June 15, 2025"
  };
};

// Enhanced Health Summary with training analysis - Updated with green/blue theme
const SmartHealthSummary: React.FC<{ 
  userData: UserData | null,
  recentActivities: RecentActivity[], 
  onRefresh: () => void,
  isRefreshing: boolean,
  loading: boolean
}> = ({ userData, recentActivities, onRefresh, isRefreshing, loading }) => {
  
  const totalRunDistance = React.useMemo(() => {
    const runActivities = recentActivities.filter(activity => 
      activity.is_run_activity || (activity.type && activity.type.toLowerCase().includes('run'))
    );
    return runActivities.reduce((sum, run) => sum + (run.distance || 0), 0);
  }, [recentActivities]);
  
  const averageRunningHeartRate = React.useMemo(() => {
    const runActivities = recentActivities.filter(activity => 
      (activity.is_run_activity || (activity.type && activity.type.toLowerCase().includes('run'))) &&
      activity.average_heartrate && activity.average_heartrate > 0
    );
    
    if (runActivities.length === 0) return 0;
    
    const totalHR = runActivities.reduce((sum, run) => sum + (run.average_heartrate || 0), 0);
    return Math.round(totalHR / runActivities.length);
  }, [recentActivities]);
  
  const runActivities = React.useMemo(() => 
    recentActivities.filter(activity => 
      activity.is_run_activity || (activity.type && activity.type.toLowerCase().includes('run'))
    ), [recentActivities]
  );

  // Get training analysis
  const trainingAnalysis = userData?.trainingAnalysis;
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-green-500" />
          Training Analysis
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
      
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs px-2 py-1 rounded-md bg-green-100 text-green-800 border border-green-200">
          Smart Analysis
        </span>

        <span className={`text-xs px-2 py-1 rounded-md border ${
          userData?.nutrition.avgCalories > 0
            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
            : 'bg-gray-100 text-gray-500 border-gray-200'
        }`}>
          {userData?.nutrition.avgCalories > 0 ? 'Nutrition: Active' : 'Nutrition: No Data'}
        </span>

        <span className={`text-xs px-2 py-1 rounded-md border ${
          runActivities.length > 0
            ? 'bg-blue-100 text-blue-800 border-blue-200'
            : 'bg-gray-100 text-gray-500 border-gray-200'
        }`}>
          {runActivities.length > 0 ? 'Runs: Active' : 'Runs: No Data'}
        </span>

        {userData?.dataDateRange && (
          <span className="text-xs px-2 py-1 rounded-md bg-cyan-100 text-cyan-800 border border-cyan-200">
            {userData.dataDateRange}
          </span>
        )}
      </div>

      {/* Current Body Stats - NEW ADDITION */}
      {userData?.currentBody && (
        <Card className="bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 border-purple-200 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-medium text-purple-700">Current Body Metrics</span>
              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
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

      {/* Training Load Analysis Card - Updated with green/blue theme */}
      {trainingAnalysis && trainingAnalysis.totalRuns > 0 && (
        <Card className="bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50 border-teal-200 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-teal-600" />
              <span className="text-xs font-medium text-teal-700">Training Load</span>
              <Badge variant={trainingAnalysis.trainingStress === 'high' || trainingAnalysis.trainingStress === 'overreaching' ? 'destructive' : 'default'} className="text-xs">
                {trainingAnalysis.trainingStress}
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-bold text-teal-800">
                {trainingAnalysis.hardVsEasyRatio}% Hard
              </div>
              <div className="text-xs text-teal-600">
                Hard:Easy ratio (ideal: 20:80)
              </div>
              <div className="text-xs text-gray-600 truncate">
                Recovery score: {trainingAnalysis.recoveryScore}/100
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Run Tags Distribution - Updated with green/blue theme */}
      {trainingAnalysis && trainingAnalysis.totalRuns > 0 && (
        <Card className="bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 border-emerald-200 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Tag className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-medium text-emerald-700">Run Types</span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-xs">
              {Object.entries(trainingAnalysis.runTagDistribution).map(([tag, count]) => {
                const config = RUN_TAG_CONFIG[tag as keyof typeof RUN_TAG_CONFIG];
                if (!config || count === 0) return null;
                return (
                  <div key={tag} className="text-center p-1 bg-white/60 rounded border">
                    <div className="font-semibold text-gray-800">
                      {config.emoji} {count}
                    </div>
                    <div className="text-xs text-gray-600">{config.label}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="grid grid-cols-1 gap-3">
        <Card className="bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 border-emerald-200 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Utensils className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-medium text-emerald-700">Nutrition</span>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-bold text-emerald-800">
                {loading ? '...' : userData?.nutrition.avgCalories || 'No Data'}
              </div>
              <div className="text-xs text-emerald-600">
                {userData?.nutrition.avgCalories > 0 ? 'cal/day' : 'Add nutrition logs'}
              </div>
              <div className="text-xs text-gray-600 truncate">
                {userData?.nutrition.avgProtein > 0 ? `${userData.nutrition.avgProtein}g protein` : 'Track your meals'}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-50 via-lime-50 to-emerald-50 border-green-200 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium text-green-700">Activity</span>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-bold text-green-800">
                {loading ? '...' : userData?.activity.workoutsPerWeek || '0'}
              </div>
              <div className="text-xs text-green-600">workouts/wk</div>
              <div className="text-xs text-gray-600 truncate">
                {userData?.activity.avgCaloriesBurned > 0 ? `${userData.activity.avgCaloriesBurned} cal avg` : 'No workouts yet'}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 border-blue-200 shadow-sm">
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
                {totalRunDistance > 0 ? 'total distance' : 'Start running!'}
              </div>
              <div className="text-xs text-gray-600 truncate">
                {averageRunningHeartRate > 0 
                  ? `${averageRunningHeartRate} bpm avg (runs only)` 
                  : totalRunDistance > 0 
                    ? 'No heart rate data for runs'
                    : 'Add heart rate data'}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50 border-teal-200 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="h-4 w-4 text-teal-600" />
              <span className="text-xs font-medium text-teal-700">Health</span>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-bold text-green-800">
                {loading ? '...' : userData?.nutrition.avgCalories > 0 ? 'Good' : 'No Data'}
              </div>
              <div className="text-xs text-teal-600">
                {userData?.nutrition.avgCalories > 0 ? 'tracking active' : 'Track nutrition'}
              </div>
              <div className="text-xs text-gray-600 truncate">
                {userData?.activity.workoutsPerWeek > 3 ? 'High activity' : 
                 userData?.activity.workoutsPerWeek > 1 ? 'Moderate activity' : 'Low activity'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Smart Recommendations - Updated with green/blue theme */}
      {trainingAnalysis && trainingAnalysis.recommendations.length > 0 && (
        <Card className="bg-gradient-to-br from-lime-50 via-green-50 to-emerald-50 border-lime-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-lime-700 flex items-center gap-2">
              <Target className="h-4 w-4" />
              Smart Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="space-y-2">
              {trainingAnalysis.recommendations.slice(0, 3).map((rec, index) => (
                <div key={index} className="text-xs p-2 bg-white/60 rounded border border-lime-200">
                  {rec}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {recentActivities.length > 0 && (
        <Card className="bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-50 border-cyan-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-cyan-700 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Recent Activities ({recentActivities.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="space-y-2">
              {recentActivities.slice(0, 5).map((activity, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-cyan-100 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-cyan-800 truncate flex items-center gap-2">
                      {activity.name}
                      {activity.run_tag && (
                        <span className="text-xs">
                          {RUN_TAG_CONFIG[activity.run_tag as keyof typeof RUN_TAG_CONFIG]?.emoji}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-cyan-600">
                      <span className="bg-cyan-100 px-2 py-0.5 rounded text-cyan-700 font-medium">
                        {activity.type}
                      </span>
                      <span>
                        {new Date(activity.start_date || activity.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <div className="text-sm font-semibold text-blue-600">
                      {activity.distance > 0 ? `${activity.distance.toFixed(1)}km` : `${Math.round(activity.duration)}min`}
                    </div>
                    <div className="text-xs text-cyan-500">
                      {activity.average_heartrate ? `${activity.average_heartrate} bpm` : 
                       activity.calories || activity.caloriesBurned ? `${activity.calories || activity.caloriesBurned} cal` : 'No data'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {recentActivities.length > 5 && (
              <div className="text-center mt-2 pt-2 border-t border-cyan-100">
                <span className="text-xs text-cyan-500">+{recentActivities.length - 5} more activities</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {userData?.bloodMarkers && Object.keys(userData.bloodMarkers).length > 0 && (
        <Card className="bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50 border-teal-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-teal-700 flex items-center gap-2">
              <Droplet className="h-4 w-4 text-teal-500" />
              Blood Markers
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(userData.bloodMarkers).slice(0, 4).map(([key, value]) => (
                <div key={key} className="text-center bg-teal-50/50 p-2 rounded border border-teal-100">
                  <div className="text-xs font-medium text-teal-600 uppercase truncate">{key}</div>
                  <div className="text-sm font-semibold text-teal-800">{value}</div>
                </div>
              ))}
            </div>
            {Object.keys(userData.bloodMarkers).length > 4 && (
              <div className="text-center mt-2">
                <span className="text-xs text-teal-500">+{Object.keys(userData.bloodMarkers).length - 4} more</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Enhanced Smart Prompt Suggestions with training-specific prompts - Updated with green/blue theme
const SmartPromptSuggestions: React.FC<{ 
  onPromptSelect: (prompt: string) => void,
  userData: UserData | null,
  recentActivities: RecentActivity[]
}> = ({ onPromptSelect, userData, recentActivities }) => {
  const hasNutritionData = userData?.nutrition.avgCalories > 0;
  const hasRunData = recentActivities.some(a => a.is_run_activity || (a.type && a.type.toLowerCase().includes('run')));
  const hasActivityData = userData?.activity.workoutsPerWeek > 0;
  const trainingAnalysis = userData?.trainingAnalysis;
  const currentBody = userData?.currentBody;
  
  const promptCategories = [
    {
      title: 'Training Analysis',
      icon: Target,
      color: 'from-teal-100 via-cyan-100 to-blue-100 border-teal-300',
      textColor: 'text-teal-700',
      iconColor: 'text-teal-600',
      prompts: hasRunData ? [
        `Analyze my ${trainingAnalysis?.hardVsEasyRatio || 0}% hard vs easy run ratio`,
        'Is my training load too high this week?',
        'What run type should I do tomorrow?',
        'Am I overtraining based on my run tags?',
        'How can I improve my training balance?'
      ] : [
        'Help me create a structured running plan',
        'What run types should I include in training?',
        'How do I balance hard and easy runs?',
        'What is polarized training?'
      ]
    },
    {
      title: 'Body Progress',
      icon: Heart,
      color: 'from-purple-100 via-pink-100 to-blue-100 border-purple-300',
      textColor: 'text-purple-700',
      iconColor: 'text-purple-600',
      prompts: currentBody ? [
        'How significant is my recent body fat change?',
        'What do my latest blood markers tell me?',
        'Analyze my body composition progress',
        'Is my current weight healthy for running?',
        'How are my health markers trending?'
      ] : [
        'Help me understand body composition',
        'What are important health markers to track?',
        'How do I interpret blood test results?',
        'What body fat percentage is healthy?',
        'How often should I check body composition?'
      ]
    },
    {
      title: 'Performance',
      icon: TrendingUp,
      color: 'from-green-100 via-emerald-100 to-teal-100 border-green-300',
      textColor: 'text-green-700',
      iconColor: 'text-green-600',
      prompts: hasRunData ? [
        'Analyze my running performance this week',
        'Compare my tempo vs long run performances',
        'How are my heart rate zones looking?',
        'What does my pace progression tell you?'
      ] : [
        'How can I start running?',
        'What running plan would you recommend?',
        'Help me set up a beginner running schedule',
        'What should I know before starting to run?'
      ]
    },
    {
      title: 'Smart Examples',
      icon: MessageSquare,
      color: 'from-indigo-100 via-purple-100 to-blue-100 border-indigo-300',
      textColor: 'text-indigo-700',
      iconColor: 'text-indigo-600',
      prompts: [
        'What stretching exercises should I do?', // Generic - minimal data
        'How was my pace in yesterday\'s run?', // Run-specific - detailed data
        'What should I eat before a long run?', // Nutrition-focused
        'Am I losing weight too fast?', // Body-focused  
        'How do I prevent running injuries?' // General advice
      ]
    },
  ];

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        Smart Training Questions
        {trainingAnalysis && (
          <Badge variant="outline" className="text-xs">
            Analysis Ready
          </Badge>
        )}
        {currentBody && (
          <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
            Body Data Current
          </Badge>
        )}
      </h4>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {promptCategories.map((category, categoryIndex) => (
          <Card key={categoryIndex} className={`bg-gradient-to-br ${category.color} cursor-pointer hover:shadow-md transition-all duration-200 shadow-sm`}>
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
                    className={`w-full text-left text-xs p-2 bg-white/60 hover:bg-white/90 rounded border transition-all duration-150 ${category.textColor} hover:text-gray-900 hover:shadow-sm`}
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

// Main Component
const LetsJam: React.FC = () => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [nutritionDetails, setNutritionDetails] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(7); // CONFIGURABLE: Default 7 days, can be changed
  
  // Initialize with saved session or default welcome message
  const initializeSession = () => {
    const { sessionId: savedSessionId, messages: savedMessages } = loadSessionFromStorage();
    
    if (savedSessionId && savedMessages.length > 0) {
      return {
        sessionId: savedSessionId,
        messages: savedMessages
      };
    } else {
      const newSessionId = generateSessionId();
      const welcomeMessages = [
        {
          role: 'assistant' as const,
          content: 'Hi! I\'m your AI health coach with access to your training data, body metrics, and nutrition logs. I can analyze your runs, track your progress, and provide personalized recommendations. What would you like to know?',
          timestamp: new Date()
        }
      ];
      
      saveSessionToStorage(newSessionId, welcomeMessages);
      
      return {
        sessionId: newSessionId,
        messages: welcomeMessages
      };
    }
  };
  
  const initialSession = initializeSession();
  const [messages, setMessages] = useState<ChatMessage[]>(initialSession.messages);
  const [sessionId, setSessionId] = useState<string>(initialSession.sessionId);
  
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (messages.length > 0) {
      saveSessionToStorage(sessionId, messages);
    }
  }, [messages, sessionId]);

  const startNewSession = () => {
    const newSessionId = generateSessionId();
    const welcomeMessages = [
      {
        role: 'assistant' as const,
        content: 'Hi! I\'m your AI health coach with complete access to your detailed training data, including km-by-km pace analysis, heart rate zones, elevation profiles, run tags, and your latest body composition data. I can analyze your pacing strategy, heart rate distribution across kilometers, effort consistency, and track your amazing body fat improvements (from 25.7% to 21.2%). What specific aspect of your training or progress would you like to explore?',
        timestamp: new Date()
      }
    ];
    
    setSessionId(newSessionId);
    setMessages(welcomeMessages);
    setInput('');
    setIsTyping(false);
    
    clearSessionStorage();
    saveSessionToStorage(newSessionId, welcomeMessages);
    
    console.log('🆕 Started new session:', newSessionId.slice(-8));
  };
  
  const scrollToLatestMessage = () => {
    if (messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      if (latestMessage.role === 'assistant') {
        const messageElements = messagesContainerRef.current?.querySelectorAll('[data-message-role="assistant"]');
        if (messageElements && messageElements.length > 0) {
          const latestAIMessage = messageElements[messageElements.length - 1];
          latestAIMessage.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
          });
          return;
        }
      }
    }
    
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end'
      });
    }
  };
  
  useEffect(() => {
    scrollToLatestMessage();
    const timer1 = setTimeout(scrollToLatestMessage, 100);
    const timer2 = setTimeout(scrollToLatestMessage, 300);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [messages, isTyping]);

  useEffect(() => {
    if (!isTyping && messages.length > 1) {
      setTimeout(scrollToLatestMessage, 200);
    }
  }, [isTyping]);

  // UPDATED: Configurable date range for nutrition data
  const fetchNutritionData = async (days: number = dateRange): Promise<{ data: NutritionData, dailyDetails: any[] }> => {
    try {
      const today = new Date();
      const dates = [];
      
      console.log(`🥗 Fetching nutrition data for ${days} days...`);
      
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(today.getDate() - i);
        dates.push(date.toISOString().split('T')[0]);
      }
      
      let totalCalories = 0;
      let totalProtein = 0;
      let totalFat = 0;
      let totalCarbs = 0;
      let totalFiber = 0;
      let daysWithData = 0;
      const dailyDetails: any[] = [];
      
      for (const date of dates) {
        try {
          const logRef = doc(db, "nutritionLogs", date);
          const logSnapshot = await getDoc(logRef);
          
          if (logSnapshot.exists()) {
            const logData = logSnapshot.data();
            
            let dayCalories = 0;
            let dayProtein = 0;
            let dayFat = 0;
            let dayCarbs = 0;
            let dayFiber = 0;
            let dayEntries: any[] = [];
            
            if (logData.totals) {
              dayCalories = logData.totals.calories || 0;
              dayProtein = logData.totals.protein || 0;
              dayFat = logData.totals.fat || 0;
              dayCarbs = logData.totals.carbs || 0;
              dayFiber = logData.totals.fiber || 0;
            } else if (Array.isArray(logData.entries) && logData.entries.length) {
              logData.entries.forEach((e: any) => {
                dayCalories += e.calories || 0;
                dayProtein += e.protein || 0;
                dayFat += e.fat || 0;
                dayCarbs += e.carbs || 0;
                dayFiber += e.fiber || 0;
              });
              dayEntries = logData.entries;
            }
            
            if (dayCalories > 0) {
              dailyDetails.push({
                date,
                calories: Math.round(dayCalories),
                protein: Math.round(dayProtein),
                carbs: Math.round(dayCarbs),
                fat: Math.round(dayFat),
                fiber: Math.round(dayFiber),
                entries: dayEntries.slice(0, 5)
              });
              
              daysWithData++;
              totalCalories += dayCalories;
              totalProtein += dayProtein;
              totalFat += dayFat;
              totalCarbs += dayCarbs;
              totalFiber += dayFiber;
              
              console.log(`✅ Nutrition data for ${date}: ${dayCalories} cal`);
            }
          }
        } catch (dayError) {
          console.error(`Error fetching nutrition data for ${date}:`, dayError);
        }
      }
      
      const avgCalories = daysWithData > 0 ? Math.round(totalCalories / daysWithData) : 0;
      const avgProtein = daysWithData > 0 ? Math.round(totalProtein / daysWithData) : 0;
      const avgFat = daysWithData > 0 ? Math.round(totalFat / daysWithData) : 0;
      const avgCarbs = daysWithData > 0 ? Math.round(totalCarbs / daysWithData) : 0;
      const avgFiber = daysWithData > 0 ? Math.round(totalFiber / daysWithData) : 0;
      
      console.log(`📊 Nutrition averages (${days} days): ${avgCalories} cal, ${avgProtein}g protein from ${daysWithData} days`);
      
      return {
        data: {
          avgCalories,
          avgProtein,
          avgFat,
          avgCarbs,
          avgFiber
        },
        dailyDetails: dailyDetails.reverse()
      };
    } catch (error) {
      console.error("Error fetching nutrition data:", error);
      return {
        data: {
          avgCalories: 0,
          avgProtein: 0,
          avgFat: 0,
          avgCarbs: 0,
          avgFiber: 0
        },
        dailyDetails: []
      };
    }
  };

  // UPDATED: Configurable date range for activity data
  const fetchActivityData = async (days: number = dateRange): Promise<ActivityData> => {
    try {
      console.log(`🏃 Fetching activity data for last ${days} days from Firestore cache...`);
      
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - days);
      
      const stravaDataRef = collection(db, "strava_data");
      const stravaQuery = query(
        stravaDataRef,
        where("userId", "==", userId),
        where("start_date", ">=", daysAgo.toISOString()),
        orderBy("start_date", "desc"),
        limit(50)
      );
      
      const stravaSnapshot = await getDocs(stravaQuery);
      
      if (!stravaSnapshot.empty) {
        let totalHeartRate = 0;
        let totalCaloriesBurned = 0;
        let totalDuration = 0;
        let activitiesWithHeartRate = 0;
        let activityCount = 0;
        
        stravaSnapshot.forEach(doc => {
          const activity = doc.data();
          activityCount++;
          
          if (activity.average_heartrate || activity.heart_rate) {
            totalHeartRate += activity.average_heartrate || activity.heart_rate;
            activitiesWithHeartRate++;
          }
          
          totalCaloriesBurned += activity.calories || activity.caloriesBurned || 0;
          totalDuration += activity.duration || 0;
          
          console.log(`📊 Activity: ${activity.name} - ${activity.calories || activity.caloriesBurned || 0} cal`);
        });
        
        const avgHeartRate = activitiesWithHeartRate > 0 ? Math.round(totalHeartRate / activitiesWithHeartRate) : 0;
        const avgCaloriesBurned = activityCount > 0 ? Math.round(totalCaloriesBurned / activityCount) : 0;
        const avgDuration = activityCount > 0 ? Math.round(totalDuration / activityCount) : 0;
        const workoutsPerWeek = Math.round(activityCount);
        
        console.log(`📊 Activity averages (${days} days): ${workoutsPerWeek} workouts, ${avgHeartRate} bpm, ${avgCaloriesBurned} cal`);
        
        return {
          workoutsPerWeek,
          avgHeartRate,
          avgCaloriesBurned,
          avgDuration
        };
      }
      
      return {
        workoutsPerWeek: 0,
        avgHeartRate: 0,
        avgCaloriesBurned: 0,
        avgDuration: 0
      };
    } catch (error) {
      console.error("Error fetching activity data:", error);
      return {
        workoutsPerWeek: 0,
        avgHeartRate: 0,
        avgCaloriesBurned: 0,
        avgDuration: 0
      };
    }
  };

  // Enhanced function to determine if activity is a run
  const isRunActivity = (activityType: string): boolean => {
    const runTypes = ['run', 'virtualrun', 'treadmill', 'trail'];
    return runTypes.some(type => 
      activityType.toLowerCase().includes(type.toLowerCase())
    );
  };

  // UPDATED: Configurable date range for recent activities
  const fetchRecentActivities = async (days: number = dateRange) => {
    try {
      console.log(`🏃 Fetching recent activities for last ${days} days from Firestore cache...`);
      
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - days);
      
      const stravaDataRef = collection(db, "strava_data");
      const stravaQuery = query(
        stravaDataRef,
        where("userId", "==", userId),
        where("start_date", ">=", daysAgo.toISOString()),
        orderBy("start_date", "desc"),
        limit(20)
      );
      
      const stravaSnapshot = await getDocs(stravaQuery);
      
      if (!stravaSnapshot.empty) {
        const activities = stravaSnapshot.docs.map(doc => {
          const activity = doc.data();
          
          console.log(`📊 Processing activity: ${activity.name} - Distance: ${activity.distance}`);
          
          return {
            id: activity.id?.toString() || Math.random().toString(),
            name: activity.name || 'Unnamed Activity',
            type: activity.type || 'Activity',
            start_date: activity.start_date,
            date: activity.date || activity.start_date?.substring(0, 10),
            distance: activity.distance || 0,
            moving_time: activity.moving_time || activity.duration * 60 || 0,
            duration: activity.duration || 0,
            total_elevation_gain: activity.total_elevation_gain || activity.elevation_gain || 0,
            average_speed: activity.average_speed || 0,
            max_speed: activity.max_speed || 0,
            has_heartrate: activity.has_heartrate || false,
            average_heartrate: activity.average_heartrate || activity.heart_rate,
            max_heartrate: activity.max_heartrate,
            calories: activity.calories || activity.caloriesBurned || 0,
            caloriesBurned: activity.caloriesBurned || activity.calories || 0,
            is_run_activity: isRunActivity(activity.type || ''),
            run_tag: activity.run_tag || 'easy' // Default to easy if no tag
          };
        });

        // Load run tags from API and apply them
        const runActivities = activities.filter(a => a.is_run_activity);
        if (runActivities.length > 0) {
          console.log(`🏷️ Loading run tags for ${runActivities.length} run activities`);
          const savedTags = await loadRunTags(runActivities.map(a => a.id));
          
          // Apply saved tags
          activities.forEach(activity => {
            if (activity.is_run_activity && savedTags[activity.id]) {
              activity.run_tag = savedTags[activity.id];
              console.log(`🔄 Applied saved tag for ${activity.id}: ${savedTags[activity.id]}`);
            }
          });
          
          console.log(`✅ Applied ${Object.keys(savedTags).length} saved run tags`);
        }

        console.log(`📊 Processed ${activities.length} activities (${days} days) with run tags`);
        setRecentActivities(activities);
      } else {
        console.log(`📊 No recent activities found for ${days} days`);
        setRecentActivities([]);
      }
    } catch (error) {
      console.error("Error fetching recent activities:", error);
      setRecentActivities([]);
    }
  };

  const fetchBloodMarkers = async () => {
    try {
      console.log('🩸 Fetching blood markers...');
      
      const bloodMarkersRef = doc(db, "blood_markers", "mihir_jain");
      const bloodMarkersSnapshot = await getDoc(bloodMarkersRef);
      
      if (bloodMarkersSnapshot.exists()) {
        const data = bloodMarkersSnapshot.data();
        
        return {
          calcium: data.Calcium || data.calcium,
          creatinine: data.Creatinine || data.creatinine,
          glucose: data["Glucose (Random)"] || data.glucose,
          hdl: data["HDL Cholesterol"] || data.hdl,
          hba1c: data.HbA1C || data.hba1c,
          hemoglobin: data.Hemoglobin || data.hemoglobin,
          ldl: data["LDL Cholesterol"] || data.ldl,
          platelet_count: data["Platelet Count"] || data.platelet_count,
          potassium: data.Potassium || data.potassium,
          rbc: data.RBC || data.rbc,
          sodium: data.Sodium || data.sodium,
          tsh: data.TSH || data.tsh,
          total_cholesterol: data["Total Cholesterol"] || data.total_cholesterol,
          date: data.date || "unknown"
        };
      } else {
        return {};
      }
    } catch (error) {
      console.error("Error fetching blood markers:", error);
      return {};
    }
  };

  const fetchUserData = async (forceRefresh = false, customDateRange?: number) => {
    try {
      setLoading(true);
      if (forceRefresh) {
        setIsRefreshing(true);
      }

      const daysToFetch = customDateRange || dateRange;
      console.log(`🔄 Fetching user data for ${daysToFetch} days (forceRefresh: ${forceRefresh})...`);
      
      const [nutritionResult, activityData, bloodMarkers] = await Promise.all([
        fetchNutritionData(daysToFetch),
        fetchActivityData(daysToFetch),
        fetchBloodMarkers()
      ]);

      await fetchRecentActivities(daysToFetch);
      
      setNutritionDetails(nutritionResult.dailyDetails);
      
      // Generate training analysis after activities are loaded
      const trainingAnalysis = analyzeTrainingLoad(recentActivities, `${daysToFetch} days`);
      
      // Get current body data
      const currentBody = getCurrentBodyData();
      
      const newUserData = {
        nutrition: nutritionResult.data,
        activity: activityData,
        bloodMarkers: bloodMarkers,
        nutritionDetails: nutritionResult.dailyDetails,
        trainingAnalysis: trainingAnalysis,
        currentBody: currentBody, // ADDED: Current body data
        dataDateRange: `${daysToFetch} days` // ADDED: Date range tracking
      };

      setUserData(newUserData);

      console.log(`📊 Updated user data (${daysToFetch} days) with training analysis and current body data:`, newUserData);
      
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    await fetchUserData(true);
  };

  // Smart query analysis and conditional data sending
  const sendMessageToAI = async (messageContent: string) => {
    try {
      const query = messageContent.toLowerCase();
      
      // Analyze what type of query this is - ENHANCED detection for immediate detailed response
      const isRunQuery = /\b(run|running|pace|km|kilometer|tempo|easy|interval|jog|sprint|marathon|5k|10k|today|yesterday|last|recent|this morning|this week|14th|june|from)\b/i.test(query) ||
                        /\b(how was|how did|analyze|tell me|splits|heart rate|hr|bpm)\b/i.test(query);
      const needsDetailedAnalysis = /\b(analyze|detailed|breakdown|splits|how did|performance|km by km)\b/i.test(query) || isRunQuery; // ALWAYS detailed for run queries
      const isNutritionQuery = /\b(eat|food|nutrition|calorie|protein|carb|fat|meal|diet|macro)\b/i.test(query);
      const isBodyQuery = /\b(body|weight|fat|composition|muscle|lean|mass|hdl|ldl|cholesterol|blood|marker)\b/i.test(query);
      const isTrainingQuery = /\b(train|training|workout|exercise|fitness|recovery|load|stress|overtraining)\b/i.test(query);
      const isSpecificDateQuery = /\b(yesterday|today|this week|last week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|14th|june|from)\b/i.test(query);
      const isGenericQuery = !isRunQuery && !isNutritionQuery && !isBodyQuery && !isTrainingQuery;
      
      console.log('🔍 Query analysis:', {
        query: messageContent.substring(0, 50) + '...',
        isRunQuery,
        isNutritionQuery, 
        isBodyQuery,
        isTrainingQuery,
        isSpecificDateQuery,
        isGenericQuery
      });

      const runActivities = recentActivities.filter(a => a.is_run_activity);
      const trainingAnalysis = userData?.trainingAnalysis;
      const currentBody = userData?.currentBody;
      
      // Conditionally load detailed run data only if needed
      let detailedRunData: any[] = [];
      if (isRunQuery || isTrainingQuery) {
        const runsToAnalyze = isSpecificDateQuery ? runActivities.slice(0, 2) : runActivities.slice(0, 5);
        detailedRunData = await Promise.all(
          runsToAnalyze.map(async (run) => {
            try {
              const response = await fetch(`/api/strava-detail?activityId=${run.id}&userId=mihir_jain`);
              if (response.ok) {
                const detail = await response.json();
                return { ...run, detail };
              }
            } catch (error) {
              console.log(`Could not load detailed data for run ${run.id}`);
            }
            return { ...run, detail: null };
          })
        );
        console.log(`📊 Loaded detailed data for ${detailedRunData.length} runs`);
      }
      
      // Build conditional system context based on query type
      let systemContext = `
CRITICAL INSTRUCTION: You are an advanced AI running and health coach. Answer the user's specific question using only relevant data provided below.

USER QUERY TYPE: ${isGenericQuery ? 'General/Generic' : [
  isRunQuery && 'Running/Performance',
  isNutritionQuery && 'Nutrition', 
  isBodyQuery && 'Body/Health',
  isTrainingQuery && 'Training/Fitness'
].filter(Boolean).join(', ')}`;

      // Add body data for body/health queries or when relevant
      if (isBodyQuery || isTrainingQuery || isRunQuery) {
        systemContext += `

=== CURRENT BODY COMPOSITION & HEALTH (June 15, 2025) ===
Weight: ${currentBody?.weight}kg (was 72.9kg in April - SIGNIFICANT IMPROVEMENT)
Body Fat: ${currentBody?.bodyFat}% (was 25.7% in April - EXCELLENT PROGRESS)
Fat Mass: ${currentBody?.fatMass}kg (was 18.7kg - MAJOR REDUCTION)
Lean Mass: ${currentBody?.leanMass}kg (maintained from 51.1kg - GOOD)
Visceral Fat: ${currentBody?.visceralFatMass}g (was 580g - HUGE IMPROVEMENT)
RMR: ${currentBody?.rmr} kcal/day

LATEST BLOOD MARKERS (June 15, 2025):
HDL Cholesterol: ${currentBody?.hdl} mg/dL (was 38 - DRAMATIC IMPROVEMENT)
LDL Cholesterol: ${currentBody?.ldl} mg/dL (was 96 - IMPROVED)
HbA1c: ${currentBody?.hba1c}% (was 5.1% - slight increase, monitor)
Glucose: ${currentBody?.glucose} mg/dL (was 89 - IMPROVED)
Vitamin D: ${currentBody?.vitaminD} ng/mL (was 48.2 - GREAT IMPROVEMENT)
Hemoglobin: ${currentBody?.hemoglobin} g/dL (was 16.3 - IMPROVED)`;
      }

      // Add detailed run data only for run/training queries
      if ((isRunQuery || isTrainingQuery) && detailedRunData.length > 0) {
        systemContext += `

=== DETAILED RUN ANALYSIS WITH KM-BY-KM DATA ===

RECENT RUNS WITH DETAILED METRICS:
${detailedRunData
  .map((run, index) => {
    const tagConfig = RUN_TAG_CONFIG[run.run_tag as keyof typeof RUN_TAG_CONFIG] || RUN_TAG_CONFIG.easy;
    let runAnalysis = `Run ${index + 1}: "${run.name}" on ${new Date(run.start_date || run.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
- Tag: ${tagConfig.emoji} ${tagConfig.label} (Intensity: ${tagConfig.intensity}/4)
- Distance: ${run.distance.toFixed(2)}km
- Duration: ${Math.round(run.duration)}min
- Overall Avg HR: ${run.average_heartrate || 'N/A'} bpm
- Max HR: ${run.max_heartrate || 'N/A'} bpm
- Avg Speed: ${(run.average_speed * 3.6).toFixed(1)} km/h
- Elevation Gain: ${run.total_elevation_gain}m
- Calories: ${run.calories || run.caloriesBurned || 0}`;

    // Add detailed km-by-km splits if available
    if (run.detail && run.detail.splits_metric && run.detail.splits_metric.length > 0) {
      runAnalysis += `\n\nKM-BY-KM SPLITS:`;
      run.detail.splits_metric.forEach((split: any, kmIndex: number) => {
        const paceMinutes = Math.floor(split.moving_time / 60);
        const paceSeconds = split.moving_time % 60;
        const pace = `${paceMinutes}:${paceSeconds.toString().padStart(2, '0')}`;
        const speed = split.average_speed ? `${(split.average_speed * 3.6).toFixed(1)} km/h` : 'N/A';
        const hr = split.average_heartrate ? `${Math.round(split.average_heartrate)} bpm` : 'N/A';
        const elevation = split.elevation_difference !== undefined ? `${split.elevation_difference > 0 ? '+' : ''}${split.elevation_difference}m` : 'N/A';
        
        runAnalysis += `\n  Km ${kmIndex + 1}: ${pace} pace, ${speed}, HR: ${hr}, Elevation: ${elevation}`;
      });
    }

    // Add heart rate zones if available
    if (run.detail && run.detail.zones && run.detail.zones.length > 0) {
      const hrZone = run.detail.zones.find((z: any) => z.type === 'heartrate');
      if (hrZone && hrZone.distribution_buckets) {
        runAnalysis += `\n\nHEART RATE ZONES:`;
        hrZone.distribution_buckets.forEach((bucket: any, zoneIndex: number) => {
          if (bucket.time > 0) {
            const minutes = Math.floor(bucket.time / 60);
            const seconds = bucket.time % 60;
            runAnalysis += `\n  Zone ${zoneIndex + 1} (${bucket.min}-${bucket.max} bpm): ${minutes}:${seconds.toString().padStart(2, '0')}`;
          }
        });
      }
    }

    // Add best efforts if available
    if (run.detail && run.detail.best_efforts && run.detail.best_efforts.length > 0) {
      runAnalysis += `\n\nBEST EFFORTS:`;
      run.detail.best_efforts.slice(0, 3).forEach((effort: any) => {
        const minutes = Math.floor(effort.moving_time / 60);
        const seconds = effort.moving_time % 60;
        const prNote = effort.pr_rank ? ` (PR #${effort.pr_rank})` : '';
        runAnalysis += `\n  ${effort.name}: ${minutes}:${seconds.toString().padStart(2, '0')}${prNote}`;
      });
    }

    return runAnalysis;
  })
  .join('\n\n')}`;
      }

      // Add training analysis for training queries
      if (isTrainingQuery && trainingAnalysis) {
        systemContext += `

=== TRAINING LOAD ANALYSIS ===
Total Runs (${trainingAnalysis.dateRange}): ${trainingAnalysis.totalRuns}
Weekly Distance: ${trainingAnalysis.weeklyDistance}km
Hard vs Easy Ratio: ${trainingAnalysis.hardVsEasyRatio}% hard (ideal: ~20%)
Training Stress Level: ${trainingAnalysis.trainingStress.toUpperCase()}
Recovery Score: ${trainingAnalysis.recoveryScore}/100

RUN TYPE DISTRIBUTION:
${Object.entries(trainingAnalysis.runTagDistribution)
  .filter(([, count]) => count > 0)
  .map(([tag, count]) => {
    const config = RUN_TAG_CONFIG[tag as keyof typeof RUN_TAG_CONFIG];
    return `${config.emoji} ${config.label}: ${count} runs (${config.intensity} intensity)`;
  })
  .join('\n')}

SMART RECOMMENDATIONS:
${trainingAnalysis.recommendations.join('\n')}`;
      }

      // Add nutrition data for nutrition queries AND training/run queries (since nutrition affects performance)
      if ((isNutritionQuery || isTrainingQuery || isRunQuery) && nutritionDetails.length > 0) {
        systemContext += `

=== NUTRITION DATA (${userData?.dataDateRange || '7 days'}) ===
${nutritionDetails.map(day => `${new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}: ${day.calories} calories, ${day.protein}g protein, ${day.carbs}g carbs, ${day.fat}g fat, ${day.fiber}g fiber`).join('\n')}

NUTRITION AVERAGES:
- Calories: ${userData?.nutrition.avgCalories || 0}/day
- Protein: ${userData?.nutrition.avgProtein || 0}g/day
- Carbs: ${userData?.nutrition.avgCarbs || 0}g/day
- Fat: ${userData?.nutrition.avgFat || 0}g/day`;
      }

      // Add basic activity summary for training queries
      if (isTrainingQuery) {
        const nonRunActivities = recentActivities.filter(a => !a.is_run_activity);
        if (nonRunActivities.length > 0) {
          systemContext += `

=== OTHER ACTIVITIES (${userData?.dataDateRange || '7 days'}) ===
${nonRunActivities.slice(0, 3).map((activity, index) => 
  `${activity.name} (${activity.type}) - ${activity.distance?.toFixed(2) || 0}km, ${Math.round(activity.duration || 0)}min, ${activity.calories || 0} cal`
).join('\n')}`;
        }
      }

      // Add conditional response requirements based on query type
      if (!isGenericQuery) {
        systemContext += `

=== RESPONSE REQUIREMENTS ===
1. Answer ONLY what the user specifically asks about
2. Use data from relevant sections above to provide specific, accurate information
3. Do NOT mention body composition changes unless directly asked about weight/body fat
4. Do NOT suggest additional training modalities (weight training, etc.) unless requested
5. Keep response focused and concise - stick to the question asked
6. Use **bold** for key metrics that directly answer the user's question`;

        if (isRunQuery) {
          systemContext += `
7. For ANY run query, IMMEDIATELY provide detailed km-by-km analysis without asking for clarification
8. If user asks "analyze my runs from [date]" - show ALL runs from that date with full km-by-km breakdown
9. ALWAYS include: run tag, distance, duration, HR data, pace per km, elevation per km
10. NEVER ask "which run?" or "need more direction" - just provide the analysis
11. NEVER provide advice about: weight training, nutrition timing, hydration strategies, form tips, recovery protocols
12. Focus ONLY on analyzing the actual performance data from the specific run(s)
13. End analysis after performance insights - no recommendations unless specifically asked`;
        }
        
        if (isNutritionQuery) {
          systemContext += `
7. Focus on nutrition/diet aspects as asked
8. Use nutrition data to answer specific dietary questions`;
        }
        
        if (isBodyQuery) {
          systemContext += `
7. Focus on body composition/health markers as asked
8. Reference relevant body metrics only when directly related to the question`;
        }
        
        if (isTrainingQuery) {
          systemContext += `
7. Focus on training load, recovery, or program structure as asked
8. Use training analysis to answer questions about workout balance`;
        }

        systemContext += `

EXAMPLES OF FOCUSED RESPONSES:
- Q: "analyze my runs from 14th june" A: "Your 🏃 Long run on June 14th: **18.01km** in **95min**, avg HR **152.5bpm**

**KM-BY-KM BREAKDOWN:**
Km1: 5:38, 132bpm, -4.4m | Km2: 5:30, 139bpm, +5.4m | Km3: 5:26, 141bpm, -6.6m
Km4: 5:33, 146bpm, -0.2m | Km5: 5:19, 150bpm, -1.4m | Km6: 5:20, 153bpm, -0.4m
[...continue for all 18km...]

**PERFORMANCE ANALYSIS:** 
Excellent pace consistency (5:08-5:30 range) for majority of run. Heart rate progression 132→157bpm shows controlled effort distribution. Strong finish with negative splits in final 4km."

IMPORTANT: End response here - provide NO additional advice, recommendations, or training suggestions.

- Q: "how was my run" A: "Your run was a **5.33km Recovery run** in **31min**. You maintained consistent **5:45 avg pace** with **149bpm avg HR**. Good controlled effort for recovery."`;

      } else {
        systemContext += `

=== RESPONSE REQUIREMENTS ===
1. Answer the general question helpfully without referencing specific personal data
2. Keep response relevant to the query asked
3. Provide practical, actionable advice for the topic
4. Do NOT mention personal metrics unless directly relevant to the general question`;
      }

      const conversationMessages = [
        { 
          role: "system", 
          content: systemContext
        },
        ...messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        { role: "user", content: messageContent }
      ];

      console.log('📤 Sending SMART context based on query analysis:', {
        queryType: isGenericQuery ? 'Generic' : [
          isRunQuery && 'Running',
          isNutritionQuery && 'Nutrition', 
          isBodyQuery && 'Body',
          isTrainingQuery && 'Training'
        ].filter(Boolean).join('+'),
        systemContextLength: systemContext.length,
        totalMessages: conversationMessages.length,
        detailedRunsLoaded: detailedRunData.length,
        bodyDataIncluded: isBodyQuery || isTrainingQuery || isRunQuery,
        nutritionDataIncluded: isNutritionQuery || isTrainingQuery || isRunQuery,
        runDataIncluded: isRunQuery || isTrainingQuery,
        trainingAnalysisIncluded: isTrainingQuery
      });
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          source: "smart_health_chat_v7_conditional_data",
          userData: { 
            systemContext, 
            trainingAnalysis, 
            currentBody,
            queryAnalysis: {
              type: isGenericQuery ? 'generic' : 'specific',
              categories: [
                isRunQuery && 'running',
                isNutritionQuery && 'nutrition', 
                isBodyQuery && 'body',
                isTrainingQuery && 'training'
              ].filter(Boolean),
              dataIncluded: {
                detailedRuns: detailedRunData.length,
                bodyData: isBodyQuery || isTrainingQuery || isRunQuery,
                nutrition: isNutritionQuery || isTrainingQuery || isRunQuery,
                training: isTrainingQuery
              }
            }
          },
          messages: conversationMessages.slice(-10),
          sessionId: sessionId,
          useSystemContext: true
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const assistantContent = data.choices?.[0]?.message?.content || 
                              data.response || 
                              data.message || 
                              'Sorry, I could not process that request.';
      
      // Enhanced check for body data usage
      const usesBodyData = assistantContent && (
        assistantContent.includes('21.2') || assistantContent.includes('25.7') ||
        assistantContent.includes('68.2') || assistantContent.includes('72.9') ||
        assistantContent.includes('body fat') || assistantContent.includes('HDL') ||
        assistantContent.includes('visceral fat') || assistantContent.includes('improvement') ||
        assistantContent.toLowerCase().includes('body composition') ||
        assistantContent.toLowerCase().includes('progress')
      );
      
      console.log(`🤖 AI response uses body data: ${usesBodyData}`);
      console.log(`🤖 Response preview: ${assistantContent.substring(0, 200)}...`);
      
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      setTimeout(() => {
        scrollToLatestMessage();
      }, 150);
      
    } catch (error) {
      console.error('❌ Error getting AI response:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, I\'m having trouble connecting right now. Please try again in a moment. 🤖💭',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      
      setTimeout(() => {
        scrollToLatestMessage();
      }, 150);
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

  // Update training analysis whenever activities change
  useEffect(() => {
    if (recentActivities.length > 0 && userData) {
      const trainingAnalysis = analyzeTrainingLoad(recentActivities, userData.dataDateRange || `${dateRange} days`);
      setUserData(prev => prev ? { ...prev, trainingAnalysis } : null);
    }
  }, [recentActivities, dateRange]);

  useEffect(() => {
    fetchUserData(false);
    
    const handleFocus = () => {
      fetchUserData(false);
    };
    
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      {/* Background decoration - Updated with green/blue theme */}
      <div className="absolute inset-0 bg-gradient-to-r from-green-400/10 to-blue-400/10 animate-pulse"></div>
      <div className="absolute top-20 left-20 w-32 h-32 bg-green-200/30 rounded-full blur-xl animate-bounce"></div>
      <div className="absolute bottom-20 right-20 w-24 h-24 bg-blue-200/30 rounded-full blur-xl animate-bounce delay-1000"></div>
      
      {/* Header - Updated with green/blue theme */}
      <header className="relative z-10 pt-8 px-6 md:px-12">
        <div className="flex items-center justify-between mb-6">
          <Button
            onClick={() => navigate('/')}
            variant="ghost"
            className="hover:bg-white/20"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </div>
        
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-green-600 via-teal-600 to-blue-600 bg-clip-text text-transparent">
            🤖 Let's Jam
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            AI running coach with smart query detection & conditional data loading
          </p>
          <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs">
              Current Body Data
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Session: {sessionId.slice(-8)}
            </Badge>
            <Badge variant={recentActivities.length > 0 ? "default" : "secondary"} className="text-xs">
              {recentActivities.filter(a => a.is_run_activity).length} Tagged Runs
            </Badge>
            <Badge variant={nutritionDetails.length > 0 ? "default" : "secondary"} className="text-xs">
              {nutritionDetails.length} Nutrition Days
            </Badge>
            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
              Body Fat: 21.2% (was 25.7%)
            </Badge>
            {userData?.trainingAnalysis && (
              <Badge variant={userData.trainingAnalysis.trainingStress === 'high' || userData.trainingAnalysis.trainingStress === 'overreaching' ? 'destructive' : 'default'} className="text-xs">
                {userData.trainingAnalysis.trainingStress} Load
              </Badge>
            )}
            {messages.length > 1 && (
              <Badge variant="outline" className="text-xs">
                {messages.length} Messages Restored
              </Badge>
            )}
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
                recentActivities={recentActivities}
              />
              
              {/* Chat Container - Updated with green/blue theme */}
              <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                <CardHeader className="border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                      <Bot className="h-5 w-5 text-green-500" />
                      AI Running Coach
                      <Badge variant="secondary" className="ml-2 text-xs">
                        Enhanced
                      </Badge>
                      <Badge variant={userData?.currentBody ? "default" : "secondary"} className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                        {userData?.currentBody ? 'Body Data Current' : 'Loading Body Data'}
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
                  <div 
                    ref={messagesContainerRef}
                    className="p-4 space-y-4" 
                    style={{
                      minHeight: '400px',
                      maxHeight: 'none'
                    }}
                  >
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        data-message-role={message.role}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[85%] ${
                          message.role === 'user' 
                            ? 'bg-gradient-to-r from-green-500 to-teal-500 text-white shadow-md' 
                            : 'bg-gradient-to-r from-blue-50 to-cyan-50 text-gray-800 border border-blue-200 shadow-sm'
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
                    
                    {/* Concise typing indicator */}
                    {isTyping && (
                      <div className="flex justify-start">
                        <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-lg p-3 shadow-sm">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-teal-500" />
                            <span className="text-sm text-teal-700">Analyzing...</span>
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
                  
                  {/* Input Area - Updated with green/blue theme */}
                  <div className="border-t border-gray-100 p-4">
                    <div className="flex gap-3">
                      <Input
                        placeholder="Ask me about your runs, nutrition, body metrics, or training..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="flex-1 border-gray-200 focus:border-green-400 focus:ring-green-400"
                        disabled={isTyping}
                      />
                      <Button
                        onClick={handleSendMessage}
                        disabled={!input.trim() || isTyping}
                        className="bg-green-500 hover:bg-green-600 text-white px-4"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
                      <span>{messages.length} messages in this session</span>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${userData?.currentBody ? 'bg-purple-400' : 'bg-blue-400'}`}></div>
                          {userData?.currentBody ? 'Body data: June 15, 2025' : 'Loading body data...'}
                        </span>
                        <span className="text-xs text-gray-400">
                          Data range: {userData?.dataDateRange || '7 days'}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Right Column - Enhanced Health Summary */}
            <div className="lg:col-span-1">
              <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm sticky top-6">
                <CardContent className="p-4">
                  <SmartHealthSummary
                    userData={userData}
                    recentActivities={recentActivities}
                    onRefresh={handleRefresh}
                    isRefreshing={isRefreshing}
                    loading={loading}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
          
          {/* Bottom Action Cards - Updated with green/blue theme */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              onClick={() => navigate('/overall-jam')} 
              variant="outline"
              className="bg-white/80 backdrop-blur-sm border-green-200 hover:bg-green-50 text-green-700 px-6 py-4 h-auto flex-col gap-2"
            >
              <BarChart3 className="h-6 w-6" />
              <div>
                <div className="font-medium">Overall Jam</div>
                <div className="text-xs text-gray-600">Complete health dashboard</div>
              </div>
            </Button>
            
            <Button 
              onClick={() => navigate('/activity-jam')} 
              variant="outline"
              className="bg-white/80 backdrop-blur-sm border-teal-200 hover:bg-teal-50 text-teal-700 px-6 py-4 h-auto flex-col gap-2"
            >
              <Activity className="h-6 w-6" />
              <div>
                <div className="font-medium">Activity Jam</div>
                <div className="text-xs text-gray-600">Workout & fitness analytics</div>
              </div>
            </Button>
            
            <Button 
              onClick={() => navigate('/body-jam')} 
              variant="outline"
              className="bg-white/80 backdrop-blur-sm border-purple-200 hover:bg-purple-50 text-purple-700 px-6 py-4 h-auto flex-col gap-2"
            >
              <Heart className="h-6 w-6" />
              <div>
                <div className="font-medium">Body Jam</div>
                <div className="text-xs text-gray-600">Current body metrics & progress</div>
              </div>
            </Button>
          </div>
          
          {/* Enhanced Data Status Display - Updated with current body data */}
          <div className="mt-8">
            <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Target className="h-5 w-5 text-green-500" />
                  Enhanced Training Analysis Status
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-purple-500" />
                      <span className="font-medium text-gray-700">Body Progress</span>
                      <Badge variant="default" className="text-xs bg-purple-100 text-purple-700 border-purple-200">
                        Excellent
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      Body fat: 25.7% → {userData?.currentBody?.bodyFat}% (-4.5%)
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-teal-500" />
                      <span className="font-medium text-gray-700">Training</span>
                      <Badge variant={userData?.trainingAnalysis?.trainingStress === 'high' || userData?.trainingAnalysis?.trainingStress === 'overreaching' ? 'destructive' : 'default'} className="text-xs">
                        {userData?.trainingAnalysis?.trainingStress || 'none'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      {userData?.trainingAnalysis 
                        ? `${userData.trainingAnalysis.hardVsEasyRatio}% hard runs (ideal: ~20%)`
                        : 'No training analysis available'
                      }
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Droplet className="h-4 w-4 text-blue-500" />
                      <span className="font-medium text-gray-700">Health Markers</span>
                      <Badge variant="default" className="text-xs bg-green-100 text-green-700 border-green-200">
                        Improved
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      HDL: 38 → {userData?.currentBody?.hdl} mg/dL (+37%)
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-cyan-500" />
                      <span className="font-medium text-gray-700">Data Range</span>
                      <Badge variant="outline" className="text-xs">
                        {userData?.dataDateRange || '7 days'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      Configurable analysis period
                    </p>
                  </div>
                </div>
                
                <div className="mt-6 p-4 bg-white/60 rounded-lg border border-white/30">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Bot className="h-4 w-4 text-green-500" />
                    Updated AI Capabilities
                  </h4>
                  <div className="text-xs text-gray-600 space-y-1">
                    <p>🧠 **Smart Query Detection**: Only loads relevant data based on what you ask</p>
                    <p>🏃 **Detailed Run Analysis**: Km-by-km pace, HR, elevation when needed</p>
                    <p>🎯 **Conditional Data Loading**: Efficient, targeted responses</p>
                    <p>📊 **Current Body Data**: Weight, body fat, blood markers from June 15, 2025</p>
                    <p>🏷️ **Run Tag Analysis**: 🚶 Easy, 💙 Recovery, 🏃 Long, ⚡ Tempo, 🔥 Intervals, ⛰️ Hill-repeats</p>
                    <p>💾 **Session Persistence**: Conversations saved and restored automatically</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      
      {/* Footer - Updated with green/blue theme */}
      <footer className="relative z-10 py-6 px-6 md:px-12 text-center text-sm text-gray-500">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <span>            AI health coach with smart data analysis</span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <Heart className="h-4 w-4 text-purple-500" />
              Body fat: 25.7% → {userData?.currentBody?.bodyFat}%
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>Data: {userData?.currentBody?.lastUpdated || 'Loading...'}</span>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full animate-pulse ${userData?.currentBody ? 'bg-purple-500' : 'bg-blue-500'}`}></div>
              <span className="text-xs">{userData?.currentBody ? 'Body Data Current' : 'Loading Body Data'}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LetsJam;
