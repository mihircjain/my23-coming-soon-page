// Enhanced LetsJam.tsx with Marathon Training Features & Run Tagging
// Hardcoded userId for consistency
const userId = "mihir_jain";

import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, RefreshCw, Activity, Utensils, Heart, TrendingUp, Target, Zap, Calendar, BarChart3, ArrowLeft, User, MessageSquare, Flame, Droplet, Clock, Tag, CheckCircle, AlertCircle, PlayCircle, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { db } from '@/lib/firebaseConfig';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';

// Types matching your 24h code structure
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
  runType?: string; // NEW: Tagged run type
  taggedAt?: string;
  userOverride?: boolean;
  autoSuggestion?: string;
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

interface UserData {
  nutrition: NutritionData;
  activity: ActivityData;
  bloodMarkers: Record<string, any>;
  nutritionDetails?: any[];
}

// NEW: Run classification algorithm
const classifyRun = (activity: RecentActivity) => {
  if (!activity.distance || !activity.duration) {
    return { type: 'easy', confidence: 0.3, reason: 'Insufficient data' };
  }
  
  const pace = (activity.duration / 60) / activity.distance; // min/km
  const hr = activity.average_heartrate || 0;
  const distance = activity.distance;
  
  // Long run detection
  if (distance >= 15) {
    return { type: 'long', confidence: 0.9, reason: `${distance.toFixed(1)}km indicates long run` };
  }
  
  // Speed/Interval detection
  if (pace < 4.5 || hr > 175) {
    return { type: 'interval', confidence: 0.8, reason: `Fast pace (${pace.toFixed(2)} min/km) or high HR` };
  }
  
  // Tempo detection
  if (pace >= 4.3 && pace <= 5.5 && hr >= 160 && hr <= 180) {
    return { type: 'tempo', confidence: 0.75, reason: `Moderate-hard effort (${pace.toFixed(2)} min/km, ${hr} bpm)` };
  }
  
  // Recovery detection
  if (pace > 6.5 || hr < 140) {
    return { type: 'recovery', confidence: 0.7, reason: `Very easy effort (${pace.toFixed(2)} min/km)` };
  }
  
  // Default to easy
  return { type: 'easy', confidence: 0.6, reason: `Moderate effort (${pace.toFixed(2)} min/km)` };
};

// NEW: Run tagging prompt component
const RunTaggingPrompt: React.FC<{ 
  untaggedRuns: RecentActivity[],
  onTagRun: (activityId: string, runType: string) => void,
  isTagging: boolean
}> = ({ untaggedRuns, onTagRun, isTagging }) => {
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('');
  
  const runTypes = [
    { value: 'easy', label: 'Easy Run', color: 'bg-green-100 text-green-800', description: '70-80% of runs' },
    { value: 'tempo', label: 'Tempo Run', color: 'bg-orange-100 text-orange-800', description: 'Comfortably hard' },
    { value: 'interval', label: 'Intervals', color: 'bg-red-100 text-red-800', description: 'High intensity' },
    { value: 'long', label: 'Long Run', color: 'bg-blue-100 text-blue-800', description: 'Weekly long effort' },
    { value: 'recovery', label: 'Recovery', color: 'bg-gray-100 text-gray-800', description: 'Very easy' },
    { value: 'race', label: 'Race', color: 'bg-purple-100 text-purple-800', description: 'Race effort' }
  ];
  
  if (untaggedRuns.length === 0) return null;
  
  return (
    <Card className="bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-orange-800 flex items-center gap-2">
          <Tag className="h-5 w-5" />
          Tag Your Runs for Better Analysis
          <Badge variant="outline" className="ml-2 text-xs border-orange-300 text-orange-700">
            {untaggedRuns.length} untagged
          </Badge>
        </CardTitle>
        <p className="text-sm text-orange-700">
          Tagging your runs helps the AI provide better marathon training advice
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {untaggedRuns.slice(0, 3).map((run) => {
          const suggestion = classifyRun(run);
          const suggestedType = runTypes.find(t => t.value === suggestion.type);
          
          return (
            <div key={run.id} className="p-3 bg-white/70 rounded-lg border border-orange-200">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800 text-sm">{run.name}</h4>
                  <div className="text-xs text-gray-600 flex items-center gap-3">
                    <span>{run.distance.toFixed(1)}km</span>
                    <span>{Math.round(run.duration)}min</span>
                    <span>{new Date(run.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    {run.average_heartrate && <span>{run.average_heartrate} bpm</span>}
                  </div>
                </div>
                <Badge 
                  variant="outline" 
                  className={`${suggestedType?.color} border-0 text-xs`}
                >
                  AI: {suggestedType?.label}
                </Badge>
              </div>
              
              <div className="text-xs text-gray-600 mb-3">
                <span className="font-medium">AI Reasoning:</span> {suggestion.reason}
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                {runTypes.slice(0, 6).map((type) => (
                  <Button
                    key={type.value}
                    size="sm"
                    variant={selectedRun === run.id && selectedType === type.value ? "default" : "outline"}
                    className={`text-xs p-2 h-auto ${
                      suggestion.type === type.value 
                        ? 'ring-2 ring-orange-300 bg-orange-50' 
                        : ''
                    }`}
                    onClick={() => {
                      setSelectedRun(run.id);
                      setSelectedType(type.value);
                      onTagRun(run.id, type.value);
                    }}
                    disabled={isTagging}
                  >
                    <div className="text-center">
                      <div className="font-medium">{type.label}</div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          );
        })}
        
        {untaggedRuns.length > 3 && (
          <div className="text-center pt-2 border-t border-orange-200">
            <p className="text-sm text-orange-600">
              +{untaggedRuns.length - 3} more runs to tag
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2 text-xs border-orange-300 text-orange-700 hover:bg-orange-50"
              onClick={() => {/* Could navigate to full tagging interface */}}
            >
              View All Untagged Runs
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
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
      // Convert timestamp strings back to Date objects
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

// Health Summary with enhanced colors - FIXED HEART RATE CALCULATION
const SmartHealthSummary: React.FC<{ 
  userData: UserData | null,
  recentActivities: RecentActivity[], 
  untaggedRuns: RecentActivity[],
  onRefresh: () => void,
  isRefreshing: boolean,
  loading: boolean
}> = ({ userData, recentActivities, untaggedRuns, onRefresh, isRefreshing, loading }) => {
  
  // Calculate total distance from recent activities
  const totalRunDistance = React.useMemo(() => {
    const runActivities = recentActivities.filter(activity => 
      activity.type && activity.type.toLowerCase().includes('run')
    );
    
    const distance = runActivities.reduce((sum, run) => sum + (run.distance || 0), 0);
    
    console.log('🔍 SmartHealthSummary - Run activities:', runActivities.length);
    console.log('🔍 SmartHealthSummary - Total run distance:', distance);
    
    return distance;
  }, [recentActivities]);
  
  // NEW: Calculate average heart rate specifically for running activities
  const averageRunningHeartRate = React.useMemo(() => {
    const runActivities = recentActivities.filter(activity => 
      activity.type && activity.type.toLowerCase().includes('run')
    );
    
    const runActivitiesWithHR = runActivities.filter(run => 
      run.average_heartrate && run.average_heartrate > 0
    );
    
    if (runActivitiesWithHR.length === 0) {
      return 0;
    }
    
    const totalHR = runActivitiesWithHR.reduce((sum, run) => 
      sum + (run.average_heartrate || 0), 0
    );
    
    const avgHR = Math.round(totalHR / runActivitiesWithHR.length);
    
    console.log('🔍 SmartHealthSummary - Running HR calculation:', {
      totalRunActivities: runActivities.length,
      runActivitiesWithHR: runActivitiesWithHR.length,
      averageHR: avgHR
    });
    
    return avgHR;
  }, [recentActivities]);
  
  const runActivities = React.useMemo(() => 
    recentActivities.filter(activity => 
      activity.type && activity.type.toLowerCase().includes('run')
    ), [recentActivities]
  );
  
  // NEW: Calculate run type distribution
  const runTypeDistribution = React.useMemo(() => {
    const taggedRuns = runActivities.filter(run => run.runType);
    const distribution = {
      easy: taggedRuns.filter(r => r.runType === 'easy').length,
      tempo: taggedRuns.filter(r => r.runType === 'tempo').length,
      interval: taggedRuns.filter(r => r.runType === 'interval').length,
      long: taggedRuns.filter(r => r.runType === 'long').length,
      recovery: taggedRuns.filter(r => r.runType === 'recovery').length,
      race: taggedRuns.filter(r => r.runType === 'race').length
    };
    
    const totalTagged = Object.values(distribution).reduce((a, b) => a + b, 0);
    const easyPercentage = totalTagged > 0 ? Math.round((distribution.easy / totalTagged) * 100) : 0;
    
    return { ...distribution, totalTagged, easyPercentage };
  }, [runActivities]);
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-orange-500" />
          Last 7 Days Summary
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
        <Badge variant="secondary" className="text-xs">Real Data</Badge>
        <Badge variant={userData?.nutrition.avgCalories > 0 ? "default" : "secondary"} className="text-xs">
          {userData?.nutrition.avgCalories > 0 ? 'Nutrition: Active' : 'Nutrition: No Data'}
        </Badge>
        <Badge variant={runActivities.length > 0 ? "default" : "secondary"} className="text-xs">
          {runActivities.length > 0 ? 'Runs: Active' : 'Runs: No Data'}
        </Badge>
        {untaggedRuns.length > 0 && (
          <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">
            {untaggedRuns.length} Untagged
          </Badge>
        )}
      </div>
      
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
        
        <Card className="bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 border-orange-200 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-orange-600" />
              <span className="text-xs font-medium text-orange-700">Activity</span>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-bold text-orange-800">
                {loading ? '...' : userData?.activity.workoutsPerWeek || '0'}
              </div>
              <div className="text-xs text-orange-600">workouts/wk</div>
              <div className="text-xs text-gray-600 truncate">
                {userData?.activity.avgCaloriesBurned > 0 ? `${userData.activity.avgCaloriesBurned} cal avg` : 'No workouts yet'}
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* ENHANCED: Running card with training analysis */}
        <Card className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-blue-200 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-700">Running</span>
              {runTypeDistribution.totalTagged > 0 && (
                <Badge variant="outline" className="text-xs border-blue-300 text-blue-600">
                  {runTypeDistribution.easyPercentage}% easy
                </Badge>
              )}
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
              {runTypeDistribution.totalTagged > 0 && (
                <div className="text-xs text-gray-600">
                  {runTypeDistribution.totalTagged}/{runActivities.length} runs tagged
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 border-purple-200 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-medium text-purple-700">Health</span>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-bold text-green-800">
                {loading ? '...' : userData?.nutrition.avgCalories > 0 ? 'Good' : 'No Data'}
              </div>
              <div className="text-xs text-purple-600">
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
      
      {/* NEW: Training Balance Card */}
      {runTypeDistribution.totalTagged > 2 && (
        <Card className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 border-indigo-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-indigo-700 flex items-center gap-2">
              <Target className="h-4 w-4" />
              Training Balance
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="grid grid-cols-3 gap-2 mb-2">
              <div className="text-center bg-green-50/50 p-2 rounded border border-green-100">
                <div className="text-sm font-semibold text-green-700">{runTypeDistribution.easy}</div>
                <div className="text-xs text-green-600">Easy</div>
              </div>
              <div className="text-center bg-orange-50/50 p-2 rounded border border-orange-100">
                <div className="text-sm font-semibold text-orange-700">{runTypeDistribution.tempo + runTypeDistribution.interval}</div>
                <div className="text-xs text-orange-600">Hard</div>
              </div>
              <div className="text-center bg-blue-50/50 p-2 rounded border border-blue-100">
                <div className="text-sm font-semibold text-blue-700">{runTypeDistribution.long}</div>
                <div className="text-xs text-blue-600">Long</div>
              </div>
            </div>
            <div className="text-xs text-gray-600">
              {runTypeDistribution.easyPercentage >= 70 
                ? '✅ Good easy run percentage'
                : runTypeDistribution.easyPercentage < 60 
                  ? '⚠️ Need more easy runs'
                  : '📊 Moderate balance'
              }
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
                      {activity.runType && (
                        <Badge variant="outline" className="text-xs border-green-300 text-green-600">
                          {activity.runType}
                        </Badge>
                      )}
                      {activity.type?.toLowerCase().includes('run') && !activity.runType && (
                        <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">
                          Untagged
                        </Badge>
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
        <Card className="bg-gradient-to-br from-red-50 via-pink-50 to-rose-50 border-red-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-700 flex items-center gap-2">
              <Droplet className="h-4 w-4 text-red-500" />
              Blood Markers
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(userData.bloodMarkers).slice(0, 4).map(([key, value]) => (
                <div key={key} className="text-center bg-red-50/50 p-2 rounded border border-red-100">
                  <div className="text-xs font-medium text-red-600 uppercase truncate">{key}</div>
                  <div className="text-sm font-semibold text-red-800">{value}</div>
                </div>
              ))}
            </div>
            {Object.keys(userData.bloodMarkers).length > 4 && (
              <div className="text-center mt-2">
                <span className="text-xs text-red-500">+{Object.keys(userData.bloodMarkers).length - 4} more</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Enhanced Smart Prompt Suggestions Component with Marathon Training Focus
const SmartPromptSuggestions: React.FC<{ 
  onPromptSelect: (prompt: string) => void,
  userData: UserData | null,
  recentActivities: RecentActivity[],
  untaggedRuns: RecentActivity[]
}> = ({ onPromptSelect, userData, recentActivities, untaggedRuns }) => {
  const hasNutritionData = userData?.nutrition.avgCalories > 0;
  const hasRunData = recentActivities.some(a => a.type && a.type.toLowerCase().includes('run'));
  const hasActivityData = userData?.activity.workoutsPerWeek > 0;
  const hasTaggedRuns = recentActivities.some(a => a.runType);
  
  const promptCategories = [
    {
      title: 'Marathon Training',
      icon: Target,
      color: 'from-orange-100 via-amber-100 to-yellow-100 border-orange-300',
      textColor: 'text-orange-700',
      iconColor: 'text-orange-600',
      prompts: hasRunData ? [
        'Create my marathon training plan for next 16 weeks',
        'Analyze my training load and suggest weight training',
        'What should I eat before my long run this weekend?',
        'How should I periodize my training phases?'
      ] : [
        'Help me start training for my first marathon',
        'What\'s a good beginner marathon training schedule?',
        'How should I combine running with weight training?',
        'What nutrition plan do I need for marathon training?'
      ]
    },
    {
      title: 'Run Analysis',
      icon: Activity,
      color: 'from-blue-100 via-indigo-100 to-purple-100 border-blue-300',
      textColor: 'text-blue-700',
      iconColor: 'text-blue-600',
      prompts: hasTaggedRuns ? [
        'Analyze my run type distribution this week',
        'Am I doing too many hard runs?',
        'How\'s my easy run percentage looking?',
        'Should I add more tempo runs to my training?'
      ] : hasRunData ? [
        'Help me classify my recent runs by type',
        'What types of runs should I be doing?',
        'How do I know if I\'m running too hard?',
        'Explain the 80/20 rule for running'
      ] : [
        'What are the different types of runs?',
        'How should I structure my weekly runs?',
        'What pace should I run for different workouts?',
        'How do I prevent overtraining in running?'
      ]
    },
    {
      title: 'Nutrition & Fueling',
      icon: Utensils,
      color: 'from-emerald-100 via-green-100 to-teal-100 border-emerald-300',
      textColor: 'text-emerald-700',
      iconColor: 'text-emerald-600',
      prompts: hasNutritionData ? [
        'Is my protein intake adequate for marathon training?',
        'Create a carb loading plan for race week',
        'What should I eat during long runs over 90 minutes?',
        'How should I fuel for tomorrow\'s tempo run?'
      ] : [
        'Create a marathon nutrition plan for me',
        'What should I eat before, during, and after runs?',
        'How many carbs do I need for endurance training?',
        'What foods help with recovery between workouts?'
      ]
    },
    {
      title: 'Recovery & Strength',
      icon: Heart,
      color: 'from-purple-100 via-pink-100 to-rose-100 border-purple-300',
      textColor: 'text-purple-700',
      iconColor: 'text-purple-600',
      prompts: hasActivityData ? [
        'Create a strength training plan for marathon runners',
        'Am I recovering well between my workouts?',
        'What exercises prevent running injuries?',
        'How should I taper for my upcoming race?'
      ] : [
        'What strength exercises should runners do?',
        'How important is sleep for endurance training?',
        'What are signs of overtraining to watch for?',
        'How do I create a proper recovery routine?'
      ]
    }
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Marathon Training Questions
        </h4>
        {untaggedRuns.length > 0 && (
          <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">
            Tag {untaggedRuns.length} runs first
          </Badge>
        )}
      </div>
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
  
  // NEW: State for run tagging
  const [isTagging, setIsTagging] = useState(false);
  const [untaggedRuns, setUntaggedRuns] = useState<RecentActivity[]>([]);
  
  // Initialize with saved session or default welcome message
  const initializeSession = () => {
    const { sessionId: savedSessionId, messages: savedMessages } = loadSessionFromStorage();
    
    if (savedSessionId && savedMessages.length > 0) {
      // Restore previous session
      return {
        sessionId: savedSessionId,
        messages: savedMessages
      };
    } else {
      // Create new session
      const newSessionId = generateSessionId();
      const welcomeMessages = [
        {
          role: 'assistant' as const,
          content: 'Hi! I\'m your marathon training AI coach with access to your complete health data. I can analyze your running performance, create training plans, provide nutrition timing advice, and suggest weight training schedules. What would you like to work on today?',
          timestamp: new Date()
        }
      ];
      
      // Save new session immediately
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
  
  // Better scroll refs and behavior
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  // Save messages to localStorage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      saveSessionToStorage(sessionId, messages);
    }
  }, [messages, sessionId]);

  // Function to start a new session
  const startNewSession = () => {
    const newSessionId = generateSessionId();
    const welcomeMessages = [
      {
        role: 'assistant' as const,
        content: 'Hi! I\'m your marathon training AI coach with access to your complete health data. I can analyze your running performance, create training plans, provide nutrition timing advice, and suggest weight training schedules. What would you like to work on today?',
        timestamp: new Date()
      }
    ];
    
    setSessionId(newSessionId);
    setMessages(welcomeMessages);
    setInput('');
    setIsTyping(false);
    
    // Clear old session and save new one
    clearSessionStorage();
    saveSessionToStorage(newSessionId, welcomeMessages);
    
    console.log('🆕 Started new session:', newSessionId.slice(-8));
  };
  
  // NEW: Tag run function
  const handleTagRun = async (activityId: string, runType: string) => {
    setIsTagging(true);
    try {
      console.log(`🏷️ Tagging run ${activityId} as ${runType}`);
      
      const response = await fetch('/api/tag-run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          activityId,
          runType,
          userId
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to tag run');
      }
      
      const result = await response.json();
      console.log('✅ Run tagged successfully:', result);
      
      // Update local state
      setRecentActivities(prev => 
        prev.map(activity => 
          activity.id === activityId 
            ? { ...activity, runType, taggedAt: new Date().toISOString() }
            : activity
        )
      );
      
      // Update untagged runs
      setUntaggedRuns(prev => prev.filter(run => run.id !== activityId));
      
      // Auto-send analysis message
      const analysisPrompt = `I just tagged my run "${result.activityInfo?.name}" as a ${runType} run. Can you analyze my recent training and give me specific advice about my run distribution and upcoming workouts?`;
      
      setTimeout(() => {
        const userMessage: ChatMessage = {
          role: 'user',
          content: analysisPrompt,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, userMessage]);
        setIsTyping(true);
        sendMessageToAI(analysisPrompt);
      }, 1000);
      
    } catch (error) {
      console.error('❌ Error tagging run:', error);
      // Could show toast notification here
    } finally {
      setIsTagging(false);
    }
  };
  
  // Scroll to show START of new AI message instead of bottom
  const scrollToLatestMessage = () => {
    if (messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      if (latestMessage.role === 'assistant') {
        // Find the latest AI message element and scroll to its TOP
        const messageElements = messagesContainerRef.current?.querySelectorAll('[data-message-role="assistant"]');
        if (messageElements && messageElements.length > 0) {
          const latestAIMessage = messageElements[messageElements.length - 1];
          latestAIMessage.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start' // Show START of the message
          });
          return;
        }
      }
    }
    
    // Fallback: scroll to bottom for user messages
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end'
      });
    }
  };
  
  // Scroll on message changes - show start of AI responses
  useEffect(() => {
    // Immediate scroll
    scrollToLatestMessage();
    
    // Delayed scroll to ensure DOM updates
    const timer1 = setTimeout(scrollToLatestMessage, 100);
    const timer2 = setTimeout(scrollToLatestMessage, 300);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [messages, isTyping]);

  // Force scroll when typing stops (message received) - show START of response
  useEffect(() => {
    if (!isTyping && messages.length > 1) {
      setTimeout(scrollToLatestMessage, 200);
    }
  }, [isTyping]);

  // Fetch nutrition data with daily details for AI
  const fetchNutritionData = async (): Promise<{ data: NutritionData, dailyDetails: any[] }> => {
    try {
      // Get the last 7 days instead of 30
      const today = new Date();
      const dates = [];
      
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(today.getDate() - i);
        dates.push(date.toISOString().split('T')[0]);
      }
      
      // Initialize totals
      let totalCalories = 0;
      let totalProtein = 0;
      let totalFat = 0;
      let totalCarbs = 0;
      let totalFiber = 0;
      let daysWithData = 0;
      const dailyDetails: any[] = [];
      
      console.log(`🥗 Fetching nutrition data for ${dates.length} days...`);
      
      // Fetch data for each day
      for (const date of dates) {
        try {
          const logRef = doc(db, "nutritionLogs", date);
          const logSnapshot = await getDoc(logRef);
          
          if (logSnapshot.exists()) {
            const logData = logSnapshot.data();
            
            // Check if we have actual nutrition data (not just empty entries)
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
            
            // Store daily details for AI
            if (dayCalories > 0) {
              dailyDetails.push({
                date,
                calories: Math.round(dayCalories),
                protein: Math.round(dayProtein),
                carbs: Math.round(dayCarbs),
                fat: Math.round(dayFat),
                fiber: Math.round(dayFiber),
                entries: dayEntries.slice(0, 5) // Top 5 foods for context
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
      
      // Calculate averages - ONLY divide by days that actually had food data
      const avgCalories = daysWithData > 0 ? Math.round(totalCalories / daysWithData) : 0;
      const avgProtein = daysWithData > 0 ? Math.round(totalProtein / daysWithData) : 0;
      const avgFat = daysWithData > 0 ? Math.round(totalFat / daysWithData) : 0;
      const avgCarbs = daysWithData > 0 ? Math.round(totalCarbs / daysWithData) : 0;
      const avgFiber = daysWithData > 0 ? Math.round(totalFiber / daysWithData) : 0;
      
      console.log(`📊 Nutrition averages: ${avgCalories} cal, ${avgProtein}g protein from ${daysWithData} days`);
      
      return {
        data: {
          avgCalories,
          avgProtein,
          avgFat,
          avgCarbs,
          avgFiber
        },
        dailyDetails: dailyDetails.reverse() // Most recent first
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

  // Fetch activity data using your working 24h logic
  const fetchActivityData = async (): Promise<ActivityData> => {
    try {
      console.log('🏃 Fetching activity data for last 7 days from Firestore cache...');
      
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const stravaDataRef = collection(db, "strava_data");
      const stravaQuery = query(
        stravaDataRef,
        where("userId", "==", userId),
        where("start_date", ">=", sevenDaysAgo.toISOString()),
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
        
        // Calculate averages and stats for 7 days
        const avgHeartRate = activitiesWithHeartRate > 0 ? Math.round(totalHeartRate / activitiesWithHeartRate) : 0;
        const avgCaloriesBurned = activityCount > 0 ? Math.round(totalCaloriesBurned / activityCount) : 0;
        const avgDuration = activityCount > 0 ? Math.round(totalDuration / activityCount) : 0;
        const workoutsPerWeek = Math.round(activityCount); // Since we're looking at 7 days, this is workouts per week
        
        console.log(`📊 Activity averages: ${workoutsPerWeek} workouts, ${avgHeartRate} bpm, ${avgCaloriesBurned} cal`);
        
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

  // ENHANCED: Fetch recent activities with run type detection
  const fetchRecentActivities = async () => {
    try {
      console.log('🏃 Fetching recent activities from Firestore cache...');
      
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const stravaDataRef = collection(db, "strava_data");
      const stravaQuery = query(
        stravaDataRef,
        where("userId", "==", userId),
        where("start_date", ">=", sevenDaysAgo.toISOString()),
        orderBy("start_date", "desc"),
        limit(20)
      );
      
      const stravaSnapshot = await getDocs(stravaQuery);
      
      if (!stravaSnapshot.empty) {
        const processedActivities = stravaSnapshot.docs.map(doc => {
          const activity = doc.data();
          
          console.log(`📊 Processing activity: ${activity.name} - Distance: ${activity.distance}`);
          
          return {
            id: activity.id?.toString() || Math.random().toString(),
            name: activity.name || 'Unnamed Activity',
            type: activity.type || 'Activity',
            start_date: activity.start_date,
            date: activity.date || activity.start_date?.substring(0, 10),
            distance: activity.distance || 0, // Your distance is already in km
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
            // NEW: Run tagging fields
            runType: activity.runType || null,
            taggedAt: activity.taggedAt || null,
            userOverride: activity.userOverride || false,
            autoSuggestion: activity.originalSuggestion || null
          };
        });

        console.log(`📊 Processed ${processedActivities.length} activities`);
        setRecentActivities(processedActivities);
        
        // NEW: Find untagged runs
        const runActivities = processedActivities.filter(activity => 
          activity.type && activity.type.toLowerCase().includes('run')
        );
        const untagged = runActivities.filter(run => !run.runType);
        
        console.log(`🏷️ Found ${untagged.length} untagged runs out of ${runActivities.length} total runs`);
        setUntaggedRuns(untagged);
        
      } else {
        console.log('📊 No recent activities found');
        setRecentActivities([]);
        setUntaggedRuns([]);
      }
    } catch (error) {
      console.error("Error fetching recent activities:", error);
      setRecentActivities([]);
      setUntaggedRuns([]);
    }
  };

  // Fetch blood markers using your working 24h logic
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

  // Main fetch function using your working 24h logic
  const fetchUserData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      if (forceRefresh) {
        setIsRefreshing(true);
      }

      console.log(`🔄 Fetching user data (forceRefresh: ${forceRefresh})...`);
      
      // Fetch both summary data and recent activities in parallel
      const [nutritionResult, activityData, bloodMarkers] = await Promise.all([
        fetchNutritionData(),
        fetchActivityData(),
        fetchBloodMarkers()
      ]);

      // Also fetch recent activities
      await fetchRecentActivities();
      
      // Set nutrition details for AI
      setNutritionDetails(nutritionResult.dailyDetails);
      
      // Set user data
      const newUserData = {
        nutrition: nutritionResult.data,
        activity: activityData,
        bloodMarkers: bloodMarkers,
        nutritionDetails: nutritionResult.dailyDetails
      };

      setUserData(newUserData);

      console.log('📊 Updated user data:', newUserData);
      
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Manual refresh function
  const handleRefresh = async () => {
    await fetchUserData(true);
  };

  // ENHANCED: Split message sending logic with marathon training context
  const sendMessageToAI = async (messageContent: string) => {
    try {
      // Build MARATHON TRAINING system context that forces AI to use data
      const runActivities = recentActivities.filter(a => a.type && a.type.toLowerCase().includes('run'));
      const taggedRuns = runActivities.filter(r => r.runType);
      const runTypeDistribution = {
        easy: taggedRuns.filter(r => r.runType === 'easy').length,
        tempo: taggedRuns.filter(r => r.runType === 'tempo').length,
        interval: taggedRuns.filter(r => r.runType === 'interval').length,
        long: taggedRuns.filter(r => r.runType === 'long').length,
        recovery: taggedRuns.filter(r => r.runType === 'recovery').length,
        race: taggedRuns.filter(r => r.runType === 'race').length
      };
      const totalTagged = Object.values(runTypeDistribution).reduce((a, b) => a + b, 0);
      const easyPercentage = totalTagged > 0 ? Math.round((runTypeDistribution.easy / totalTagged) * 100) : 0;
      
      const systemContext = `
CRITICAL: You are a MARATHON TRAINING COACH with access to REAL user data. You MUST use this data and ALWAYS include marathon training guidance for questions related to training for marathons.

=== REAL USER MARATHON TRAINING DATA ===

RECENT RUNS (CLASSIFIED BY TYPE):
${taggedRuns.length > 0 ? taggedRuns.map((run, index) => 
  `${run.runType?.toUpperCase()} RUN ${index + 1}: "${run.name}" on ${new Date(run.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${run.distance.toFixed(1)}km in ${Math.round(run.duration)}min, HR: ${run.average_heartrate || 'N/A'} bpm, Calories: ${run.calories || 0}`
).join('\n') : 'No tagged runs yet - encourage user to tag their runs for better analysis'}

UNTAGGED RUNS (NEED CLASSIFICATION):
${untaggedRuns.map((run, index) => 
  `UNTAGGED RUN ${index + 1}: "${run.name}" on ${new Date(run.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${run.distance.toFixed(1)}km in ${Math.round(run.duration)}min, HR: ${run.average_heartrate || 'N/A'} bpm`
).join('\n') || 'All runs are properly tagged'}

RUN TYPE DISTRIBUTION:
- Easy Runs: ${runTypeDistribution.easy} (${easyPercentage}% of tagged runs)
- Tempo Runs: ${runTypeDistribution.tempo}
- Interval/Speed: ${runTypeDistribution.interval}
- Long Runs: ${runTypeDistribution.long}
- Recovery Runs: ${runTypeDistribution.recovery}
- Race Efforts: ${runTypeDistribution.race}
- TOTAL TAGGED: ${totalTagged}/${runActivities.length} runs
- TRAINING BALANCE: ${easyPercentage >= 70 ? 'EXCELLENT (70%+ easy)' : easyPercentage >= 60 ? 'GOOD' : easyPercentage < 50 ? 'TOO HARD - Need more easy runs' : 'NEEDS IMPROVEMENT'}

ALL RECENT WORKOUTS:
${recentActivities.map((activity, index) => 
  `${activity.type} ${index + 1}: "${activity.name}" on ${new Date(activity.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${activity.distance?.toFixed(1) || 0}km, ${Math.round(activity.duration || 0)}min, HR: ${activity.average_heartrate || 'N/A'} bpm, Calories: ${activity.calories || 0}`
).join('\n') || 'No activities recorded'}

NUTRITION DATA (MARATHON FUELING):
${nutritionDetails.map(day => 
  `${new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}: ${day.calories} cal, ${day.protein}g protein, ${day.carbs}g carbs, ${day.fat}g fat`
).join('\n') || 'No nutrition data - create fueling plan'}

WEEKLY AVERAGES:
- Nutrition: ${userData?.nutrition.avgCalories || 0} cal/day, ${userData?.nutrition.avgProtein || 0}g protein/day, ${userData?.nutrition.avgCarbs || 0}g carbs/day
- Activity: ${userData?.activity.workoutsPerWeek || 0} workouts/week, ${userData?.activity.avgHeartRate || 0} bpm average heart rate
- Calories burned per workout: ${userData?.activity.avgCaloriesBurned || 0} calories

BLOOD MARKERS (HEALTH MONITORING):
${userData?.bloodMarkers ? Object.entries(userData.bloodMarkers)
  .filter(([key, value]) => key !== 'date' && value)
  .map(([key, value]) => `${key}: ${value}`)
  .join(', ') : 'No blood marker data - recommend getting baseline tests'}

=== MARATHON TRAINING COACH REQUIREMENTS ===
You MUST include ALL of these in responses around marathon:

1. **WEIGHT TRAINING SCHEDULE:**
   - Base Phase: 
   - Build Phase: 
   - Peak Phase: 
   - KEY EXERCISES: 
   - RUNNER-SPECIFIC: 

2. **NUTRITION TIMING (BE SPECIFIC):**
   - Pre-run 
   - During runs >90min:
   - Post-run 
   - Daily carbs: 
   - Race week: 

3. **RECOVERY PROTOCOLS:**
   - Sleep: 
   - Easy pace: 
   - Rest days: 
   - Listen to body: 

4. **TRAINING PERIODIZATION:**
   - Base Phase 
   - Build Phase
   - Peak Phase 
   - Taper 

5. **RUN TYPE GUIDANCE (USE THEIR ACTUAL DATA):**
   - Easy: 
   - Tempo: 
   - Intervals: 
   - Long: 
   - Recovery: 

=== CRITICAL INSTRUCTIONS ===
- ALWAYS reference specific numbers from their data (distances, times, heart rates)
- If they have untagged runs, ENCOURAGE tagging for better analysis
- Use **bold** for key metrics and recommendations
- Give specific, actionable advice based on their current training state
- NEVER say "I don't have access to data" - you DO have access
- Include phase-appropriate advice based on their current training volume

TRAINING ANALYSIS PRIORITIES:
${untaggedRuns.length > 0 ? `⚠️ URGENT: User has ${untaggedRuns.length} untagged runs - encourage tagging` : '✅ All runs properly tagged'}
${easyPercentage < 70 && totalTagged > 3 ? `⚠️ TRAINING IMBALANCE: Only ${easyPercentage}% easy runs - recommend more easy volume` : ''}
${userData?.nutrition.avgCalories < 2000 ? `⚠️ LOW CALORIE INTAKE: ${userData.nutrition.avgCalories} cal/day may be insufficient for training` : ''}
${runActivities.length === 0 ? `⚠️ NO RUNNING DATA: Help user start running program` : ''}

Remember: You are their complete marathon coach. Always include weight training, nutrition timing, and recovery protocols when user asks about training!`;

      // Build messages array with explicit marathon training context
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

      console.log('📤 Sending MARATHON TRAINING context to AI:', {
        systemContextLength: systemContext.length,
        totalMessages: conversationMessages.length,
        runCount: runActivities.length,
        taggedRuns: totalTagged,
        untaggedRuns: untaggedRuns.length,
        easyPercentage,
        trainingBalance: easyPercentage >= 70 ? 'EXCELLENT' : easyPercentage >= 60 ? 'GOOD' : 'NEEDS IMPROVEMENT',
        totalActivities: recentActivities.length,
        nutritionDays: nutritionDetails.length,
        avgCalories: userData?.nutrition.avgCalories || 0,
        workoutsPerWeek: userData?.activity.workoutsPerWeek || 0
      });
      
      // Call enhanced chat API with marathon training context
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          source: "marathon_training_coach_v5",
          userData: { systemContext },
          messages: conversationMessages.slice(-10), // Keep more context for marathon training
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
      
      // Check if AI used marathon training concepts
      const usesMarathonGuidance = assistantContent && (
        assistantContent.toLowerCase().includes('weight training') ||
        assistantContent.toLowerCase().includes('strength') ||
        assistantContent.toLowerCase().includes('nutrition timing') ||
        assistantContent.toLowerCase().includes('carb loading') ||
        assistantContent.toLowerCase().includes('recovery') ||
        assistantContent.toLowerCase().includes('easy run') ||
        assistantContent.toLowerCase().includes('tempo') ||
        assistantContent.toLowerCase().includes('interval') ||
        assistantContent.toLowerCase().includes('marathon pace') ||
        assistantContent.toLowerCase().includes('periodization')
      );
      
      // Check if response uses real data
      const usesRealData = assistantContent && (
        assistantContent.includes('bpm') ||
        assistantContent.includes('km') ||
        assistantContent.includes('cal') ||
        assistantContent.includes('protein') ||
        /\d+\.\d+/.test(assistantContent) ||
        /\*\*\d+/.test(assistantContent) ||
        assistantContent.toLowerCase().includes('your run') ||
        assistantContent.toLowerCase().includes('your workout')
      );
      
      console.log(`🏃 Marathon AI response analysis:`, {
        usesMarathonGuidance,
        usesRealData,
        responseLength: assistantContent.length,
        containsWeightTraining: assistantContent.toLowerCase().includes('weight'),
        containsNutritionTiming: assistantContent.toLowerCase().includes('carb'),
        containsRecovery: assistantContent.toLowerCase().includes('recovery')
      });
      
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Force scroll after message is added - show START of AI response
      setTimeout(() => {
        scrollToLatestMessage();
      }, 150);
      
    } catch (error) {
      console.error('❌ Error getting marathon AI response:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, I\'m having trouble connecting right now. Please try again in a moment. In the meantime, remember to focus on easy runs (70-80% of your training), include weight training 2-3x per week, and fuel properly with carbs before runs! 🏃‍♂️💪',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      
      // Force scroll after error message - show START  
      setTimeout(() => {
        scrollToLatestMessage();
      }, 150);
    } finally {
      setIsTyping(false);
    }
  };

  // Enhanced message sending with auto-send for preset questions
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
    // Auto-send the selected prompt
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
        
        // Send to AI
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

  // Fetch user data on component mount
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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-orange-400/10 to-red-400/10 animate-pulse"></div>
      <div className="absolute top-20 left-20 w-32 h-32 bg-orange-200/30 rounded-full blur-xl animate-bounce"></div>
      <div className="absolute bottom-20 right-20 w-24 h-24 bg-red-200/30 rounded-full blur-xl animate-bounce delay-1000"></div>
      
      {/* Header */}
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
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-600 via-red-600 to-pink-600 bg-clip-text text-transparent">
            🏃‍♂️ Marathon Coach AI
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Your comprehensive marathon training coach with real-time data analysis
          </p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <Badge variant="secondary" className="text-xs">
              Marathon Training System
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Session: {sessionId.slice(-8)}
            </Badge>
            <Badge variant={recentActivities.length > 0 ? "default" : "secondary"} className="text-xs">
              {recentActivities.filter(a => a.type?.toLowerCase().includes('run')).length} Runs
            </Badge>
            <Badge variant={nutritionDetails.length > 0 ? "default" : "secondary"} className="text-xs">
              {nutritionDetails.length} Nutrition Days
            </Badge>
            {untaggedRuns.length > 0 && (
              <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">
                {untaggedRuns.length} Need Tagging
              </Badge>
            )}
            {messages.length > 1 && (
              <Badge variant="outline" className="text-xs">
                Session Restored
              </Badge>
            )}
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="relative z-10 px-6 md:px-12 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Left Column - Chat Interface (Larger) */}
            <div className="lg:col-span-3 space-y-4">
              
              {/* NEW: Run Tagging Prompt */}
              {untaggedRuns.length > 0 && (
                <RunTaggingPrompt 
                  untaggedRuns={untaggedRuns}
                  onTagRun={handleTagRun}
                  isTagging={isTagging}
                />
              )}
              
              {/* Enhanced Smart Prompt Suggestions */}
              <SmartPromptSuggestions 
                onPromptSelect={handlePromptSelect}
                userData={userData}
                recentActivities={recentActivities}
                untaggedRuns={untaggedRuns}
              />
              
              {/* Chat Container - Dynamic Full Height */}
              <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                <CardHeader className="border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                      <Target className="h-5 w-5 text-orange-500" />
                      Marathon Training Coach
                      <Badge variant="secondary" className="ml-2 text-xs">
                        Active
                      </Badge>
                      <Badge variant={userData ? "default" : "secondary"} className="text-xs">
                        {userData ? 'Data Loaded' : 'Loading Data'}
                      </Badge>
                      {untaggedRuns.length > 0 && (
                        <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">
                          {untaggedRuns.length} to tag
                        </Badge>
                      )}
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
                      maxHeight: 'none' // Remove height restrictions
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
                            ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md' 
                            : 'bg-gradient-to-r from-blue-50 to-indigo-50 text-gray-800 border border-blue-200 shadow-sm'
                        } rounded-lg p-4`}>
                          <MessageContent content={message.content} />
                          <div className={`text-xs mt-2 ${
                            message.role === 'user' ? 'text-orange-100' : 'text-blue-500'
                          }`}>
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Enhanced typing indicator */}
                    {isTyping && (
                      <div className="flex justify-start">
                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4 shadow-sm">
                          <div className="flex items-center gap-2">
                            <Target className="h-4 w-4 text-purple-500" />
                            <span className="text-sm text-purple-700">Analyzing your training data & creating marathon plan</span>
                            <div className="flex gap-1">
                              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-100"></div>
                              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-200"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div ref={messagesEndRef} />
                  </div>
                  
                  {/* Enhanced Input Area */}
                  <div className="border-t border-gray-100 p-4">
                    <div className="flex gap-3">
                      <Input
                        placeholder="Ask about training plans, nutrition timing, weight training, recovery..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="flex-1 border-gray-200 focus:border-orange-400 focus:ring-orange-400"
                        disabled={isTyping}
                      />
                      <Button
                        onClick={handleSendMessage}
                        disabled={!input.trim() || isTyping}
                        className="bg-orange-500 hover:bg-orange-600 text-white px-4"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
                      <span>{messages.length} messages • Always includes weight training + nutrition timing</span>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${userData ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
                          {userData ? 'Marathon data ready' : 'Loading training data...'}
                        </span>
                        {untaggedRuns.length > 0 && (
                          <span className="text-orange-600">
                            {untaggedRuns.length} runs need tagging
                          </span>
                        )}
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
                    untaggedRuns={untaggedRuns}
                    onRefresh={handleRefresh}
                    isRefreshing={isRefreshing}
                    loading={loading}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
          
          {/* Enhanced Bottom Action Cards */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              onClick={() => navigate('/overall-jam')} 
              variant="outline"
              className="bg-white/80 backdrop-blur-sm border-orange-200 hover:bg-orange-50 text-orange-700 px-6 py-4 h-auto flex-col gap-2"
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
              className="bg-white/80 backdrop-blur-sm border-red-200 hover:bg-red-50 text-red-700 px-6 py-4 h-auto flex-col gap-2"
            >
              <Activity className="h-6 w-6" />
              <div>
                <div className="font-medium">Activity Jam</div>
                <div className="text-xs text-gray-600">Enhanced with run tagging</div>
              </div>
            </Button>
            
            <Button 
              onClick={() => navigate('/nutrition-jam')} 
              variant="outline"
              className="bg-white/80 backdrop-blur-sm border-orange-200 hover:bg-orange-50 text-orange-700 px-6 py-4 h-auto flex-col gap-2"
            >
              <Utensils className="h-6 w-6" />
              <div>
                <div className="font-medium">Nutrition Jam</div>
                <div className="text-xs text-gray-600">Marathon fueling plans</div>
              </div>
            </Button>
          </div>
          
          {/* Enhanced Data Status Display */}
          <div className="mt-8">
            <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Target className="h-5 w-5 text-orange-500" />
                  Marathon Training System Status
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-orange-500" />
                      <span className="font-medium text-gray-700">Run Training</span>
                      <Badge variant={recentActivities.filter(a => a.type?.toLowerCase().includes('run')).length > 0 ? "default" : "secondary"} className="text-xs">
                        {recentActivities.filter(a => a.type?.toLowerCase().includes('run')).length} runs
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      {recentActivities.filter(a => a.runType).length}/{recentActivities.filter(a => a.type?.toLowerCase().includes('run')).length} tagged runs
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Utensils className="h-4 w-4 text-green-500" />
                      <span className="font-medium text-gray-700">Fueling</span>
                      <Badge variant={nutritionDetails.length > 0 ? "default" : "secondary"} className="text-xs">
                        {nutritionDetails.length} days
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      {nutritionDetails.length > 0 
                        ? `${userData?.nutrition.avgCarbs || 0}g carbs/day`
                        : 'Set up marathon nutrition plan'
                      }
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Timer className="h-4 w-4 text-blue-500" />
                      <span className="font-medium text-gray-700">Training Load</span>
                      <Badge variant={userData?.activity.workoutsPerWeek > 0 ? "default" : "secondary"} className="text-xs">
                        {userData?.activity.workoutsPerWeek || 0}/week
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      {userData?.activity.workoutsPerWeek > 4 ? 'High volume training' : 
                       userData?.activity.workoutsPerWeek > 2 ? 'Moderate training' : 'Building base'}
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-red-500" />
                      <span className="font-medium text-gray-700">Recovery</span>
                      <Badge variant={userData?.bloodMarkers && Object.keys(userData.bloodMarkers).length > 0 ? "default" : "secondary"} className="text-xs">
                        {userData?.bloodMarkers ? Object.keys(userData.bloodMarkers).length : 0} markers
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      Health monitoring active
                    </p>
                  </div>
                </div>
                
                <div className="mt-6 p-4 bg-white/60 rounded-lg border border-white/30">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4 text-orange-500" />
                    Marathon Coach AI Features
                  </h4>
                  <div className="text-xs text-gray-600 space-y-1">
                    <p>✅ Complete training analysis: {recentActivities.length} activities, {nutritionDetails.length} nutrition days, {userData?.bloodMarkers ? Object.keys(userData.bloodMarkers).length : 0} health markers</p>
                    <p>✅ Always includes: Weight training schedules, nutrition timing, carb loading, recovery protocols for marathon training questions </p>
                    <p>✅ Run type classification: Easy, tempo, interval, long, recovery, race efforts</p>
                    <p>✅ Training periodization: Base phase, build phase, peak phase, taper guidance</p>
                    <p>🏃‍♂️ Ask about: Training plans, race preparation, fueling strategies, injury prevention</p>
                    {untaggedRuns.length > 0 && (
                      <p className="text-orange-600">⚠️ Tag your {untaggedRuns.length} untagged runs for better training analysis!</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      
      {/* Enhanced Footer */}
      <footer className="relative z-10 py-6 px-6 md:px-12 text-center text-sm text-gray-500">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <span>Marathon training AI with comprehensive coaching</span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <Target className="h-4 w-4" />
              Session: {sessionId.slice(-8)}
            </span>
          </div>
          <div className="flex items-center gap-4">
              <span className="text-xs">{userData ? 'Marathon Coach Ready' : 'Loading Training Data'}</span>
            </div>
          </div>
     
      </footer>
    </div>
  );
};

export default LetsJam;
