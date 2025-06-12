// Simple LetsJam.tsx - Health coach with existing run tags sent to LLM
// No tagging UI - just pure health coaching

import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, RefreshCw, Activity, Utensils, Heart, TrendingUp, Target, Zap, Calendar, BarChart3, ArrowLeft, User, MessageSquare, Flame, Droplet, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { db } from '@/lib/firebaseConfig';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';

// Hardcoded userId for consistency
const userId = "mihir_jain";

// Types
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
  runType?: string;
  taggedAt?: string;
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

// Generate session ID and storage utilities
const generateSessionId = () => {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

const SESSION_STORAGE_KEY = 'letsJam_chatSession';
const MESSAGES_STORAGE_KEY = 'letsJam_messages';

const saveSessionToStorage = (sessionId: string, messages: ChatMessage[]) => {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messages));
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
  } catch (error) {
    console.error('Failed to clear session:', error);
  }
};

// Message Component
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

// Health Summary Component
const SmartHealthSummary: React.FC<{ 
  userData: UserData | null,
  recentActivities: RecentActivity[], 
  onRefresh: () => void,
  isRefreshing: boolean,
  loading: boolean
}> = ({ userData, recentActivities, onRefresh, isRefreshing, loading }) => {
  
  const totalRunDistance = React.useMemo(() => {
    const runActivities = recentActivities.filter(activity => 
      activity.type && activity.type.toLowerCase().includes('run')
    );
    return runActivities.reduce((sum, run) => sum + (run.distance || 0), 0);
  }, [recentActivities]);
  
  const averageRunningHeartRate = React.useMemo(() => {
    const runActivities = recentActivities.filter(activity => 
      activity.type && activity.type.toLowerCase().includes('run')
    );
    
    const runActivitiesWithHR = runActivities.filter(run => 
      run.average_heartrate && run.average_heartrate > 0
    );
    
    if (runActivitiesWithHR.length === 0) return 0;
    
    const totalHR = runActivitiesWithHR.reduce((sum, run) => 
      sum + (run.average_heartrate || 0), 0
    );
    
    return Math.round(totalHR / runActivitiesWithHR.length);
  }, [recentActivities]);
  
  const runActivities = React.useMemo(() => 
    recentActivities.filter(activity => 
      activity.type && activity.type.toLowerCase().includes('run')
    ), [recentActivities]
  );
  
  const taggedRuns = React.useMemo(() => 
    runActivities.filter(run => run.runType), [runActivities]
  );
  
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
        {taggedRuns.length > 0 && (
          <Badge variant="outline" className="text-xs border-green-300 text-green-600">
            {taggedRuns.length} Tagged
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
        
        <Card className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-blue-200 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-700">Running</span>
              {taggedRuns.length > 0 && (
                <Badge variant="outline" className="text-xs border-blue-300 text-blue-600">
                  {taggedRuns.length} tagged
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
    </div>
  );
};

// Smart Prompt Suggestions Component
const SmartPromptSuggestions: React.FC<{ 
  onPromptSelect: (prompt: string) => void,
  userData: UserData | null,
  recentActivities: RecentActivity[]
}> = ({ onPromptSelect, userData, recentActivities }) => {
  const hasNutritionData = userData?.nutrition.avgCalories > 0;
  const hasRunData = recentActivities.some(a => a.type && a.type.toLowerCase().includes('run'));
  const hasActivityData = userData?.activity.workoutsPerWeek > 0;
  const hasTaggedRuns = recentActivities.some(a => a.runType);
  const hasBloodMarkers = userData?.bloodMarkers && Object.keys(userData.bloodMarkers).length > 0;
  
  const promptCategories = [
    {
      title: 'Training',
      icon: Target,
      color: 'from-orange-100 via-amber-100 to-yellow-100 border-orange-300',
      textColor: 'text-orange-700',
      iconColor: 'text-orange-600',
      prompts: hasTaggedRuns ? [
        'Analyze my run type distribution this week',
        'Create a marathon training plan for me',
        'What should I eat before my long run?',
        'How is my training balance looking?'
      ] : hasRunData ? [
        'Create a training plan for me',
        'How can I improve my running performance?',
        'What types of runs should I be doing?',
        'Help me with my workout schedule'
      ] : [
        'How should I start training?',
        'What\'s a good beginner running plan?',
        'Help me set fitness goals',
        'Create a workout schedule for me'
      ]
    },
    {
      title: 'Nutrition',
      icon: Utensils,
      color: 'from-emerald-100 via-green-100 to-teal-100 border-emerald-300',
      textColor: 'text-emerald-700',
      iconColor: 'text-emerald-600',
      prompts: hasNutritionData ? [
        'Is my protein intake adequate?',
        'Am I eating enough for my workouts?',
        'What should I eat on rest days?',
        'How is my calorie balance trending?'
      ] : [
        'Help me start tracking nutrition',
        'What should I eat to support my goals?',
        'How many calories should I consume daily?',
        'What are good protein sources?'
      ]
    },
    {
      title: 'Recovery',
      icon: Heart,
      color: 'from-purple-100 via-pink-100 to-rose-100 border-purple-300',
      textColor: 'text-purple-700',
      iconColor: 'text-purple-600',
      prompts: hasActivityData ? [
        'Am I recovering well from my workouts?',
        'What does my heart rate data tell you?',
        'How should I adjust my training load?',
        'Create a recovery plan for me'
      ] : [
        'How important is recovery for fitness?',
        'What are signs of overtraining?',
        'How much sleep should I get?',
        'What recovery activities do you recommend?'
      ]
    },
    {
      title: 'Health Analysis',
      icon: BarChart3,
      color: 'from-blue-100 via-indigo-100 to-cyan-100 border-blue-300',
      textColor: 'text-blue-700',
      iconColor: 'text-blue-600',
      prompts: hasBloodMarkers ? [
        'Analyze my blood markers',
        'Any health concerns in my data?',
        'Compare this week to last week',
        'Give me a complete health assessment'
      ] : [
        'What health metrics should I track?',
        'How often should I get blood tests?',
        'What are key health indicators?',
        'Help me create a health monitoring plan'
      ]
    }
  ];

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        Quick Questions
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
  
  // Initialize session
  const initializeSession = () => {
    const { sessionId: savedSessionId, messages: savedMessages } = loadSessionFromStorage();
    
    if (savedSessionId && savedMessages.length > 0) {
      return { sessionId: savedSessionId, messages: savedMessages };
    } else {
      const newSessionId = generateSessionId();
      const welcomeMessages = [
        {
          role: 'assistant' as const,
          content: 'Hi! I\'m your AI health coach with access to your complete health data. I can analyze your activities, nutrition, and provide personalized training advice. What would you like to explore today?',
          timestamp: new Date()
        }
      ];
      saveSessionToStorage(newSessionId, welcomeMessages);
      return { sessionId: newSessionId, messages: welcomeMessages };
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
  
  // Save messages when they change
  useEffect(() => {
    if (messages.length > 0) {
      saveSessionToStorage(sessionId, messages);
    }
  }, [messages, sessionId]);

  // Data fetching functions (simplified versions)
  const fetchNutritionData = async (): Promise<{ data: NutritionData, dailyDetails: any[] }> => {
    // Implementation from your existing code
    return { data: { avgCalories: 0, avgProtein: 0, avgFat: 0, avgCarbs: 0, avgFiber: 0 }, dailyDetails: [] };
  };

  const fetchActivityData = async (): Promise<ActivityData> => {
    // Implementation from your existing code
    return { workoutsPerWeek: 0, avgHeartRate: 0, avgCaloriesBurned: 0, avgDuration: 0 };
  };

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
            // Include existing run tags from Firestore
            runType: activity.runType || null,
            taggedAt: activity.taggedAt || null
          };
        });

        setRecentActivities(processedActivities);
        
      } else {
        setRecentActivities([]);
      }
    } catch (error) {
      console.error("Error fetching recent activities:", error);
      setRecentActivities([]);
    }
  };

  const fetchUserData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      if (forceRefresh) setIsRefreshing(true);

      const [nutritionResult, activityData] = await Promise.all([
        fetchNutritionData(),
        fetchActivityData()
      ]);

      await fetchRecentActivities();
      
      setNutritionDetails(nutritionResult.dailyDetails);
      setUserData({
        nutrition: nutritionResult.data,
        activity: activityData,
        bloodMarkers: {},
        nutritionDetails: nutritionResult.dailyDetails
      });

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

  // Send message to AI with complete context including run tags
  const sendMessageToAI = async (messageContent: string) => {
    try {
      // Build system context with run tags included
      const runActivities = recentActivities.filter(a => a.type && a.type.toLowerCase().includes('run'));
      const taggedRuns = runActivities.filter(r => r.runType);
      
      const systemContext = `
You are a health AI coach with access to REAL user data. Use this data in your responses.

=== REAL USER DATA ===

RECENT ACTIVITIES:
${recentActivities.map((activity, index) => 
  `${activity.type} ${index + 1}: "${activity.name}" on ${new Date(activity.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${activity.distance?.toFixed(1) || 0}km, ${Math.round(activity.duration || 0)}min, HR: ${activity.average_heartrate || 'N/A'} bpm, Calories: ${activity.calories || 0}${activity.runType ? ` (${activity.runType} run)` : ''}`
).join('\n') || 'No recent activities'}

TAGGED RUNS (for training analysis):
${taggedRuns.map((run, index) => 
  `${run.runType?.toUpperCase()} RUN: "${run.name}" on ${new Date(run.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${run.distance.toFixed(1)}km in ${Math.round(run.duration)}min, HR: ${run.average_heartrate || 'N/A'} bpm`
).join('\n') || 'No runs have been tagged yet - user can tag runs in Activity Jam'}

NUTRITION DATA:
${nutritionDetails.map(day => 
  `${new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}: ${day.calories} cal, ${day.protein}g protein, ${day.carbs}g carbs, ${day.fat}g fat`
).join('\n') || 'No nutrition data available'}

WEEKLY AVERAGES:
- Nutrition: ${userData?.nutrition.avgCalories || 0} cal/day, ${userData?.nutrition.avgProtein || 0}g protein/day
- Activity: ${userData?.activity.workoutsPerWeek || 0} workouts/week, ${userData?.activity.avgHeartRate || 0} bpm average

=== INSTRUCTIONS ===
- Use specific numbers from the data above
- Reference actual workout names, dates, and metrics
- For training questions, use the tagged run types if available
- Be specific and actionable
- If asked about run types and user has untagged runs, suggest they tag runs in Activity Jam
- Use **bold** for key metrics and recommendations
`;

      const conversationMessages = [
        { role: "system", content: systemContext },
        ...messages.map(msg => ({ role: msg.role, content: msg.content })),
        { role: "user", content: messageContent }
      ];

      console.log('📤 Sending context with run tags to AI:', {
        runCount: runActivities.length,
        taggedRuns: taggedRuns.length,
        totalActivities: recentActivities.length,
        nutritionDays: nutritionDetails.length
      });
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          source: "simple_health_coach_v1",
          userData: { systemContext },
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

  const startNewSession = () => {
    const newSessionId = generateSessionId();
    const welcomeMessages = [
      {
        role: 'assistant' as const,
        content: 'Hi! I\'m your AI health coach with access to your complete health data. I can analyze your activities, nutrition, and provide personalized training advice. What would you like to explore today?',
        timestamp: new Date()
      }
    ];
    
    setSessionId(newSessionId);
    setMessages(welcomeMessages);
    setInput('');
    setIsTyping(false);
    
    clearSessionStorage();
    saveSessionToStorage(newSessionId, welcomeMessages);
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
    fetchUserData(false);
  }, []);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-orange-400/10 to-red-400/10 animate-pulse"></div>
      
      {/* Header */}
      <header className="relative z-10 pt-8 px-6 md:px-12">
        <div className="flex items-center justify-between mb-6">
          <Button onClick={() => navigate('/')} variant="ghost" className="hover:bg-white/20">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </div>
        
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-600 via-red-600 to-pink-600 bg-clip-text text-transparent">
            🤖 Let's Jam
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Your AI health coach with complete access to your health data
          </p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <Badge variant="secondary" className="text-xs">Simple Health Coach</Badge>
            <Badge variant="secondary" className="text-xs">Session: {sessionId.slice(-8)}</Badge>
            <Badge variant={recentActivities.length > 0 ? "default" : "secondary"} className="text-xs">
              {recentActivities.length} Activities
            </Badge>
            <Badge variant={nutritionDetails.length > 0 ? "default" : "secondary"} className="text-xs">
              {nutritionDetails.length} Nutrition Days
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
                recentActivities={recentActivities}
              />
              
              {/* Chat Container */}
              <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                <CardHeader className="border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                      <Bot className="h-5 w-5 text-orange-500" />
                      AI Health Coach
                      <Badge variant="secondary" className="ml-2 text-xs">Active</Badge>
                      <Badge variant={userData ? "default" : "secondary"} className="text-xs">
                        {userData ? 'Data Loaded' : 'Loading Data'}
                      </Badge>
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        Session: {sessionId.slice(-8)}
                      </Badge>
                      <Button onClick={startNewSession} variant="outline" size="sm" className="text-xs" disabled={isTyping}>
                        <Bot className="h-3 w-3 mr-1" />
                        New Session
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div ref={messagesContainerRef} className="p-4 space-y-4" style={{ minHeight: '400px' }}>
                    {messages.map((message, index) => (
                      <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] ${
                          message.role === 'user' 
                            ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md' 
                            : 'bg-gradient-to-r from-blue-50 to-indigo-50 text-gray-800 border border-blue-200 shadow-sm'
                        } rounded-lg p-4`}>
                          <MessageContent content={message.content} />
                          <div className={`text-xs mt-2 ${message.role === 'user' ? 'text-orange-100' : 'text-blue-500'}`}>
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {isTyping && (
                      <div className="flex justify-start">
                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4 shadow-sm">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-purple-500" />
                            <span className="text-sm text-purple-700">Analyzing your health data</span>
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
                  
                  {/* Input Area */}
                  <div className="border-t border-gray-100 p-4">
                    <div className="flex gap-3">
                      <Input
                        placeholder="Ask about your health, training, nutrition, or recovery..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="flex-1 border-gray-200 focus:border-orange-400 focus:ring-orange-400"
                        disabled={isTyping}
                      />
                      <Button onClick={handleSendMessage} disabled={!input.trim() || isTyping} className="bg-orange-500 hover:bg-orange-600 text-white px-4">
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
                      <span>{messages.length} messages • Includes run tags if available</span>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${userData ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
                          {userData ? 'Health data ready' : 'Loading health data...'}
                        </span>
                        <Button 
                          onClick={() => navigate('/activity-jam')} 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          Tag runs →
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Right Column - Health Summary */}
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
        </div>
      </main>
    </div>
  );
};

export default LetsJam;
