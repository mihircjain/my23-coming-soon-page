// Enhanced LetsJam - Clean Design with Tabbed Sidebar
// FIXES: 1) Better fonts 2) Softer colors 3) Tabbed sidebar 4) Chat-focused 5) Nutrition questions
const userId = "mihir_jain";

import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, RefreshCw, Activity, Utensils, Heart, TrendingUp, Target, Zap, Calendar, BarChart3, ArrowLeft, User, MessageSquare, Flame, Droplet, Clock, Tag, AlertTriangle, CheckCircle, Tabs } from 'lucide-react';
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
  dateRange: string;
}

// Current body composition data
interface CurrentBodyData {
  weight: number;
  bodyFat: number;
  fatMass: number;
  leanMass: number;
  boneMass: number;
  visceralFatMass: number;
  rmr: number;
  hdl: number;
  ldl: number;
  totalCholesterol: number;
  hba1c: number;
  glucose: number;
  tsh: number;
  vitaminD: number;
  vitaminB12: number;
  hemoglobin: number;
  lastUpdated: string;
}

interface UserData {
  nutrition: NutritionData;
  activity: ActivityData;
  bloodMarkers: Record<string, any>;
  nutritionDetails?: any[];
  trainingAnalysis?: TrainingAnalysis;
  currentBody?: CurrentBodyData;
  dataDateRange?: string;
}

// Run tag configuration with simpler styling
const RUN_TAG_CONFIG = {
  'easy': { label: 'Easy', emoji: '🚶', intensity: 1 },
  'recovery': { label: 'Recovery', emoji: '💙', intensity: 0.5 },
  'long': { label: 'Long', emoji: '🏃', intensity: 2 },
  'tempo': { label: 'Tempo', emoji: '⚡', intensity: 3 },
  'intervals': { label: 'Intervals', emoji: '🔥', intensity: 4 },
  'hill-repeats': { label: 'Hill Repeats', emoji: '⛰️', intensity: 3.5 }
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
      className="text-sm whitespace-pre-wrap leading-relaxed font-inter"
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

// Get current body composition data
const getCurrentBodyData = (): CurrentBodyData => {
  return {
    weight: 68.2,
    bodyFat: 21.2,
    fatMass: 14.5,
    leanMass: 50.7,
    boneMass: 3.0,
    visceralFatMass: 349,
    rmr: 1472,
    hdl: 52,
    ldl: 87,
    totalCholesterol: 149,
    hba1c: 5.4,
    glucose: 84,
    tsh: 2.530,
    vitaminD: 55.4,
    vitaminB12: 450,
    hemoglobin: 16.8,
    lastUpdated: "June 15, 2025"
  };
};

// Clean Tabbed Sidebar Component
const TabbedSidebar: React.FC<{ 
  userData: UserData | null,
  recentActivities: RecentActivity[], 
  onRefresh: () => void,
  isRefreshing: boolean,
  loading: boolean
}> = ({ userData, recentActivities, onRefresh, isRefreshing, loading }) => {
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'training', label: 'Training', icon: Target },
    { id: 'nutrition', label: 'Nutrition', icon: Utensils },
    { id: 'body', label: 'Body', icon: Heart },
    { id: 'activities', label: 'Activities', icon: Activity }
  ];

  const totalRunDistance = React.useMemo(() => {
    const runActivities = recentActivities.filter(activity => 
      activity.is_run_activity || (activity.type && activity.type.toLowerCase().includes('run'))
    );
    return runActivities.reduce((sum, run) => sum + (run.distance || 0), 0);
  }, [recentActivities]);

  const trainingAnalysis = userData?.trainingAnalysis;
  
  return (
    <Card className="bg-white border border-gray-200 shadow-sm h-fit">
      <CardHeader className="pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium text-gray-900 font-inter">
            Health Data
          </CardTitle>
          <Button 
            onClick={onRefresh}
            variant="outline"
            size="sm"
            disabled={isRefreshing}
            className="text-xs h-7"
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        
        <div className="flex space-x-1 bg-gray-50 p-1 rounded-md">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium rounded transition-colors ${
                  activeTab === tab.id 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                }`}
              >
                <Icon className="h-3 w-3" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </CardHeader>
      
      <CardContent className="p-4">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 p-3 rounded-md">
                <div className="text-sm font-medium text-gray-600 mb-1">Calories/day</div>
                <div className="text-lg font-semibold text-gray-900">
                  {userData?.nutrition.avgCalories || 'No data'}
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded-md">
                <div className="text-sm font-medium text-gray-600 mb-1">Weekly distance</div>
                <div className="text-lg font-semibold text-gray-900">
                  {totalRunDistance > 0 ? `${totalRunDistance.toFixed(1)}km` : 'No runs'}
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded-md">
                <div className="text-sm font-medium text-gray-600 mb-1">Body fat</div>
                <div className="text-lg font-semibold text-gray-900">
                  {userData?.currentBody?.bodyFat}%
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded-md">
                <div className="text-sm font-medium text-gray-600 mb-1">Training load</div>
                <div className="text-lg font-semibold text-gray-900">
                  {userData?.trainingAnalysis?.trainingStress || 'Low'}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'training' && (
          <div className="space-y-4">
            {trainingAnalysis && trainingAnalysis.totalRuns > 0 ? (
              <>
                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="text-sm font-medium text-gray-600 mb-2">Training Balance</div>
                  <div className="text-2xl font-semibold text-gray-900">
                    {trainingAnalysis.hardVsEasyRatio}% Hard
                  </div>
                  <div className="text-xs text-gray-500">Ideal: ~20%</div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-600">Run Types</div>
                  {Object.entries(trainingAnalysis.runTagDistribution).map(([tag, count]) => {
                    const config = RUN_TAG_CONFIG[tag as keyof typeof RUN_TAG_CONFIG];
                    if (!config || count === 0) return null;
                    return (
                      <div key={tag} className="flex items-center justify-between py-1">
                        <span className="text-sm text-gray-700">
                          {config.emoji} {config.label}
                        </span>
                        <span className="text-sm font-medium text-gray-900">{count}</span>
                      </div>
                    );
                  })}
                </div>

                {trainingAnalysis.recommendations.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-600">Recommendations</div>
                    {trainingAnalysis.recommendations.slice(0, 2).map((rec, index) => (
                      <div key={index} className="text-xs p-2 bg-blue-50 rounded border text-gray-700">
                        {rec}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-gray-500 text-center py-4">
                No training data available
              </div>
            )}
          </div>
        )}

        {activeTab === 'nutrition' && (
          <div className="space-y-4">
            {userData?.nutrition.avgCalories > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 p-3 rounded-md">
                    <div className="text-xs text-gray-600 mb-1">Protein</div>
                    <div className="text-sm font-semibold text-gray-900">{userData.nutrition.avgProtein}g</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <div className="text-xs text-gray-600 mb-1">Carbs</div>
                    <div className="text-sm font-semibold text-gray-900">{userData.nutrition.avgCarbs}g</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <div className="text-xs text-gray-600 mb-1">Fat</div>
                    <div className="text-sm font-semibold text-gray-900">{userData.nutrition.avgFat}g</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <div className="text-xs text-gray-600 mb-1">Fiber</div>
                    <div className="text-sm font-semibold text-gray-900">{userData.nutrition.avgFiber}g</div>
                  </div>
                </div>
                
                {userData.nutritionDetails && userData.nutritionDetails.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-600">Recent Days</div>
                    {userData.nutritionDetails.slice(0, 3).map((day, index) => (
                      <div key={index} className="flex justify-between items-center py-1 border-b border-gray-100 last:border-0">
                        <span className="text-xs text-gray-600">
                          {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <span className="text-sm font-medium text-gray-900">{day.calories} cal</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-gray-500 text-center py-4">
                No nutrition data available
              </div>
            )}
          </div>
        )}

        {activeTab === 'body' && (
          <div className="space-y-4">
            {userData?.currentBody ? (
              <>
                <div className="bg-purple-50 p-3 rounded-md border border-purple-100">
                  <div className="text-xs text-purple-600 mb-2">Latest: {userData.currentBody.lastUpdated}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-xs text-gray-600">Weight</div>
                      <div className="text-sm font-semibold text-gray-900">{userData.currentBody.weight}kg</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">Body Fat</div>
                      <div className="text-sm font-semibold text-gray-900">{userData.currentBody.bodyFat}%</div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-600">Key Markers</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">HDL</span>
                      <span className="font-medium">{userData.currentBody.hdl}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">LDL</span>
                      <span className="font-medium">{userData.currentBody.ldl}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">HbA1c</span>
                      <span className="font-medium">{userData.currentBody.hba1c}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Glucose</span>
                      <span className="font-medium">{userData.currentBody.glucose}</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-500 text-center py-4">
                Loading body data...
              </div>
            )}
          </div>
        )}

        {activeTab === 'activities' && (
          <div className="space-y-4">
            {recentActivities.length > 0 ? (
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-600">Recent ({recentActivities.length})</div>
                {recentActivities.slice(0, 5).map((activity, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate flex items-center gap-1">
                        {activity.name}
                        {activity.run_tag && (
                          <span className="text-xs">
                            {RUN_TAG_CONFIG[activity.run_tag as keyof typeof RUN_TAG_CONFIG]?.emoji}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(activity.start_date || activity.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">
                        {activity.distance > 0 ? `${activity.distance.toFixed(1)}km` : `${Math.round(activity.duration)}min`}
                      </div>
                      <div className="text-xs text-gray-500">
                        {activity.average_heartrate ? `${activity.average_heartrate} bpm` : 'No HR'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500 text-center py-4">
                No recent activities
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Enhanced Smart Prompt Suggestions with nutrition focus
const SmartPromptSuggestions: React.FC<{ 
  onPromptSelect: (prompt: string) => void,
  userData: UserData | null,
  recentActivities: RecentActivity[]
}> = ({ onPromptSelect, userData, recentActivities }) => {
  const hasNutritionData = userData?.nutrition.avgCalories > 0;
  const hasRunData = recentActivities.some(a => a.is_run_activity || (a.type && a.type.toLowerCase().includes('run')));
  const currentBody = userData?.currentBody;
  
  const promptCategories = [
    {
      title: 'Nutrition Analysis',
      prompts: hasNutritionData ? [
        'Am I eating enough protein for my training?',
        'How do my calories compare to my activity level?',
        'What should I eat before my long run?',
        'Is my carb intake appropriate for running?',
        'Analyze my nutrition balance this week',
        'How can I improve my post-workout nutrition?'
      ] : [
        'How many calories should I eat for my training?',
        'What macros do I need as a runner?',
        'Best pre-run breakfast ideas?',
        'How to fuel during long runs?',
        'Post-workout recovery meal suggestions?',
        'What foods help with muscle recovery?'
      ]
    },
    {
      title: 'Running Performance',
      prompts: hasRunData ? [
        'Analyze my recent running performance',
        'How was my pacing in yesterday\'s run?',
        'Is my training load balanced?',
        'What run type should I do next?',
        'How are my heart rate zones?'
      ] : [
        'Help me start a running routine',
        'What\'s a good beginner training plan?',
        'How to build running endurance?',
        'What pace should I run at?'
      ]
    },
    {
      title: 'Body & Health',
      prompts: currentBody ? [
        'How significant is my body fat progress?',
        'What do my blood markers indicate?',
        'Is my weight loss rate healthy?',
        'How are my health markers trending?',
        'What does my HDL improvement mean?'
      ] : [
        'How to track body composition?',
        'What health markers should I monitor?',
        'Healthy weight loss for runners?',
        'How often to check blood work?'
      ]
    },
    {
      title: 'Quick Questions',
      prompts: [
        'Should I run today or rest?',
        'How to prevent running injuries?',
        'Best stretches for runners?',
        'How much water should I drink?',
        'When to take rest days?',
        'How to improve my running form?'
      ]
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 font-inter">
          Ask me anything about your health
        </h3>
        {currentBody && (
          <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
            Data Current
          </Badge>
        )}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {promptCategories.map((category, categoryIndex) => (
          <Card key={categoryIndex} className="bg-white border border-gray-200 hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-800 font-inter">
                {category.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              {category.prompts.map((prompt, promptIndex) => (
                <button
                  key={promptIndex}
                  onClick={() => onPromptSelect(prompt)}
                  className="w-full text-left text-sm p-2 bg-gray-50 hover:bg-gray-100 rounded border transition-colors text-gray-700 hover:text-gray-900"
                >
                  "{prompt}"
                </button>
              ))}
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
  const [dateRange, setDateRange] = useState(7);
  
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
          content: 'Hi! I\'m your AI health coach. I can analyze your training, nutrition, and body metrics. Ask me anything about your running performance, diet, or health progress!',
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
        content: 'Hi! I\'m your AI health coach. I can analyze your training, nutrition, and body metrics. Ask me anything about your running performance, diet, or health progress!',
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
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end'
      });
    }
  };
  
  useEffect(() => {
    scrollToLatestMessage();
    const timer = setTimeout(scrollToLatestMessage, 100);
    return () => clearTimeout(timer);
  }, [messages, isTyping]);

  // Fetch data functions (simplified versions of the originals)
  const fetchNutritionData = async (days: number = dateRange): Promise<{ data: NutritionData, dailyDetails: any[] }> => {
    try {
      const today = new Date();
      const dates = [];
      
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
            }
            
            if (dayCalories > 0) {
              dailyDetails.push({
                date,
                calories: Math.round(dayCalories),
                protein: Math.round(dayProtein),
                carbs: Math.round(dayCarbs),
                fat: Math.round(dayFat),
                fiber: Math.round(dayFiber)
              });
              
              daysWithData++;
              totalCalories += dayCalories;
              totalProtein += dayProtein;
              totalFat += dayFat;
              totalCarbs += dayCarbs;
              totalFiber += dayFiber;
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

  const fetchActivityData = async (days: number = dateRange): Promise<ActivityData> => {
    try {
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
        });
        
        const avgHeartRate = activitiesWithHeartRate > 0 ? Math.round(totalHeartRate / activitiesWithHeartRate) : 0;
        const avgCaloriesBurned = activityCount > 0 ? Math.round(totalCaloriesBurned / activityCount) : 0;
        const avgDuration = activityCount > 0 ? Math.round(totalDuration / activityCount) : 0;
        const workoutsPerWeek = Math.round(activityCount);
        
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

  const isRunActivity = (activityType: string): boolean => {
    const runTypes = ['run', 'virtualrun', 'treadmill', 'trail'];
    return runTypes.some(type => 
      activityType.toLowerCase().includes(type.toLowerCase())
    );
  };

  const fetchRecentActivities = async (days: number = dateRange) => {
    try {
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
            run_tag: activity.run_tag || 'easy'
          };
        });

        const runActivities = activities.filter(a => a.is_run_activity);
        if (runActivities.length > 0) {
          const savedTags = await loadRunTags(runActivities.map(a => a.id));
          
          activities.forEach(activity => {
            if (activity.is_run_activity && savedTags[activity.id]) {
              activity.run_tag = savedTags[activity.id];
            }
          });
        }

        setRecentActivities(activities);
      } else {
        setRecentActivities([]);
      }
    } catch (error) {
      console.error("Error fetching recent activities:", error);
      setRecentActivities([]);
    }
  };

  const fetchUserData = async (forceRefresh = false, customDateRange?: number) => {
    try {
      setLoading(true);
      if (forceRefresh) {
        setIsRefreshing(true);
      }

      const daysToFetch = customDateRange || dateRange;
      
      const [nutritionResult, activityData] = await Promise.all([
        fetchNutritionData(daysToFetch),
        fetchActivityData(daysToFetch)
      ]);

      await fetchRecentActivities(daysToFetch);
      
      setNutritionDetails(nutritionResult.dailyDetails);
      
      const trainingAnalysis = analyzeTrainingLoad(recentActivities, `${daysToFetch} days`);
      const currentBody = getCurrentBodyData();
      
      const newUserData = {
        nutrition: nutritionResult.data,
        activity: activityData,
        bloodMarkers: {},
        nutritionDetails: nutritionResult.dailyDetails,
        trainingAnalysis: trainingAnalysis,
        currentBody: currentBody,
        dataDateRange: `${daysToFetch} days`
      };

      setUserData(newUserData);
      
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

  // Simplified AI message sending (same smart logic but cleaner structure)
  const sendMessageToAI = async (messageContent: string) => {
    try {
      const query = messageContent.toLowerCase();
      
      const isRunQuery = /\b(run|running|pace|km|tempo|easy|interval|analyze.*run|how was.*run)\b/i.test(query);
      const isNutritionQuery = /\b(eat|food|nutrition|calorie|protein|carb|fat|meal|diet|macro)\b/i.test(query);
      const isBodyQuery = /\b(body|weight|fat|composition|muscle|hdl|ldl|cholesterol|blood|marker)\b/i.test(query);
      const isTrainingQuery = /\b(train|training|workout|exercise|fitness|recovery|load|stress)\b/i.test(query);
      
      const runActivities = recentActivities.filter(a => a.is_run_activity);
      let detailedRunData: any[] = [];
      
      if (isRunQuery || isTrainingQuery) {
        const runsToAnalyze = runActivities.slice(0, 3);
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
      }
      
      let systemContext = `You are an AI health coach. Answer the user's question using the relevant data below.

CRITICAL: NEVER FABRICATE OR HALLUCINATE DATA. Only use data explicitly provided.`;

      if (userData?.currentBody && (isBodyQuery || isTrainingQuery || isRunQuery)) {
        systemContext += `

CURRENT BODY DATA (${userData.currentBody.lastUpdated}):
Weight: ${userData.currentBody.weight}kg, Body Fat: ${userData.currentBody.bodyFat}%
HDL: ${userData.currentBody.hdl}, LDL: ${userData.currentBody.ldl}
HbA1c: ${userData.currentBody.hba1c}%, Glucose: ${userData.currentBody.glucose}`;
      }

      if ((isNutritionQuery || isTrainingQuery) && userData?.nutrition.avgCalories > 0) {
        systemContext += `

NUTRITION AVERAGES (${userData.dataDateRange}):
Calories: ${userData.nutrition.avgCalories}/day, Protein: ${userData.nutrition.avgProtein}g
Carbs: ${userData.nutrition.avgCarbs}g, Fat: ${userData.nutrition.avgFat}g`;
      }

      if ((isRunQuery || isTrainingQuery) && detailedRunData.length > 0) {
        const runsWithData = detailedRunData.filter(run => run.detail?.splits_metric);
        systemContext += `

RECENT RUNS:
${detailedRunData.map((run, i) => `
Run ${i+1}: ${run.name} - ${run.distance.toFixed(2)}km, ${Math.round(run.duration)}min
Tag: ${RUN_TAG_CONFIG[run.run_tag as keyof typeof RUN_TAG_CONFIG]?.emoji} ${run.run_tag}
HR: ${run.average_heartrate || 'N/A'} bpm avg${run.detail?.splits_metric ? ', Detailed splits available' : ', No detailed splits'}`).join('')}

WARNING: Only use actual run data provided above. Never make up pace or heart rate data.`;
      }

      const conversationMessages = [
        { role: "system", content: systemContext },
        ...messages.map(msg => ({ role: msg.role, content: msg.content })),
        { role: "user", content: messageContent }
      ];
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          source: "clean_health_chat",
          userData: { systemContext },
          messages: conversationMessages.slice(-10),
          sessionId: sessionId,
          useSystemContext: true
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
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
      
      setTimeout(() => {
        scrollToLatestMessage();
      }, 150);
      
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

  useEffect(() => {
    if (recentActivities.length > 0 && userData) {
      const trainingAnalysis = analyzeTrainingLoad(recentActivities, userData.dataDateRange || `${dateRange} days`);
      setUserData(prev => prev ? { ...prev, trainingAnalysis } : null);
    }
  }, [recentActivities, dateRange]);

  useEffect(() => {
    fetchUserData(false);
  }, []);
  
  return (
    <div className="min-h-screen bg-gray-50 font-inter">
      
      {/* Clean Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Button
            onClick={() => navigate('/')}
            variant="ghost"
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
          
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-gray-900">
              Let's Jam
            </h1>
            <p className="text-sm text-gray-600">AI Health Coach</p>
          </div>
          
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
              New
            </Button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Chat Interface - Takes up more space */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Smart Prompts */}
            <SmartPromptSuggestions 
              onPromptSelect={handlePromptSelect}
              userData={userData}
              recentActivities={recentActivities}
            />
            
            {/* Chat Container */}
            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardHeader className="border-b border-gray-100 pb-3">
                <CardTitle className="text-lg font-medium text-gray-900 flex items-center gap-2">
                  <Bot className="h-5 w-5 text-blue-500" />
                  AI Health Coach
                  {userData?.currentBody && (
                    <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                      Data Current
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              
              <CardContent className="p-0">
                <div 
                  ref={messagesContainerRef}
                  className="p-6 space-y-4 min-h-[500px] max-h-[600px] overflow-y-auto"
                >
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[85%] ${
                        message.role === 'user' 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-50 text-gray-900 border border-gray-200'
                      } rounded-lg p-4`}>
                        <MessageContent content={message.content} />
                        <div className={`text-xs mt-2 ${
                          message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-blue-500" />
                          <span className="text-sm text-gray-700">Analyzing...</span>
                          <div className="flex gap-1">
                            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></div>
                            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-100"></div>
                            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-200"></div>
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
                      placeholder="Ask about your nutrition, training, body metrics, or health..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="flex-1 border-gray-300 focus:border-blue-400 focus:ring-blue-400"
                      disabled={isTyping}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!input.trim() || isTyping}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-6"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
                    <span>{messages.length} messages in session</span>
                    <span>Data range: {userData?.dataDateRange || '7 days'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Tabbed Sidebar */}
          <div className="lg:col-span-1">
            <TabbedSidebar
              userData={userData}
              recentActivities={recentActivities}
              onRefresh={handleRefresh}
              isRefreshing={isRefreshing}
              loading={loading}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default LetsJam;
