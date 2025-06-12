// Hardcoded userId for consistency
const userId = "mihir_jain";

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
  onRefresh: () => void,
  isRefreshing: boolean,
  loading: boolean
}> = ({ userData, recentActivities, onRefresh, isRefreshing, loading }) => {
  
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
        
        {/* FIXED: Running card with running-specific heart rate */}
        <Card className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-blue-200 shadow-sm">
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
                    <div className="text-sm font-medium text-cyan-800 truncate">{activity.name}</div>
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

// Smart Prompt Suggestions Component with enhanced colors
const SmartPromptSuggestions: React.FC<{ 
  onPromptSelect: (prompt: string) => void,
  userData: UserData | null,
  recentActivities: RecentActivity[]
}> = ({ onPromptSelect, userData, recentActivities }) => {
  const hasNutritionData = userData?.nutrition.avgCalories > 0;
  const hasRunData = recentActivities.some(a => a.type && a.type.toLowerCase().includes('run'));
  const hasActivityData = userData?.activity.workoutsPerWeek > 0;
  
  const promptCategories = [
    {
      title: 'Performance',
      icon: Target,
      color: 'from-orange-100 via-amber-100 to-yellow-100 border-orange-300',
      textColor: 'text-orange-700',
      iconColor: 'text-orange-600',
      prompts: hasRunData ? [
        'Analyze my running performance this week',
        'Should I do a long run tomorrow?',
        'How hard have I trained this week?',
        'What type of runs should I focus on?'
      ] : [
        'How can I start running?',
        'What running plan would you recommend?',
        'Help me set up a beginner running schedule',
        'What should I know before starting to run?'
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
        'Did I overtrain last week?',
        'What does my heart rate data tell you?',
        'How should I adjust my training load?'
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
      prompts: userData?.bloodMarkers ? [
        'Any concerns in my blood markers?',
        'Compare this week to last week',
        'What are my biggest health risks?',
        'Give me a complete health assessment'
      ] : [
        'What health metrics should I track?',
        'How often should I get blood tests?',
        'What are key health indicators to monitor?',
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
          content: 'Hi! I\'m your AI health coach with access to your complete health data. I can analyze your running performance, nutrition trends, and Strava activity data to provide personalized insights. What would you like to explore today?',
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
        content: 'Hi! I\'m your AI health coach with access to your complete health data. I can analyze your running performance, nutrition trends, and Strava activity data to provide personalized insights. What would you like to explore today?',
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

  // Fetch recent activities using your working 24h logic
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
        limit(10)
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
            caloriesBurned: activity.caloriesBurned || activity.calories || 0
          };
        });

        console.log(`📊 Processed ${processedActivities.length} activities`);
        setRecentActivities(processedActivities);
      } else {
        console.log('📊 No recent activities found');
        setRecentActivities([]);
      }
    } catch (error) {
      console.error("Error fetching recent activities:", error);
      setRecentActivities([]);
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

  // Split message sending logic for reuse
  const sendMessageToAI = async (messageContent: string) => {
    try {
      // Build MUCH MORE EXPLICIT system context that forces AI to use data
      const systemContext = `
CRITICAL INSTRUCTION: You are a health AI with access to REAL user data. You MUST use this data in your responses. NEVER say you don't have access to data.

=== REAL USER HEALTH DATA (USE THIS IN YOUR RESPONSES) ===

RECENT RUNS AND ACTIVITIES:
${recentActivities
  .filter(a => a.type && a.type.toLowerCase().includes('run'))
  .map((run, index) => `Run ${index + 1}: "${run.name}" on ${new Date(run.start_date || run.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - Distance: ${run.distance.toFixed(2)}km, Duration: ${Math.round(run.duration)}min, Heart Rate: ${run.average_heartrate || 'N/A'} bpm, Calories: ${run.calories || run.caloriesBurned || 0}`)
  .join('\n') || 'No runs recorded in the last 7 days'}

ALL RECENT WORKOUTS:
${recentActivities
  .map((activity, index) => `Activity ${index + 1}: "${activity.name}" (${activity.type}) on ${new Date(activity.start_date || activity.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - Distance: ${activity.distance?.toFixed(2) || 0}km, Duration: ${Math.round(activity.duration || 0)}min, Heart Rate: ${activity.average_heartrate || 'N/A'} bpm, Calories: ${activity.calories || activity.caloriesBurned || 0}`)
  .join('\n') || 'No activities recorded in the last 7 days'}

NUTRITION DATA (DAILY BREAKDOWN):
${nutritionDetails.map(day => `${new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}: ${day.calories} calories, ${day.protein}g protein, ${day.carbs}g carbs, ${day.fat}g fat, ${day.fiber}g fiber`).join('\n') || 'No nutrition data logged'}

WEEKLY AVERAGES:
- Nutrition: ${userData?.nutrition.avgCalories || 0} calories/day, ${userData?.nutrition.avgProtein || 0}g protein/day
- Activity: ${userData?.activity.workoutsPerWeek || 0} workouts/week, ${userData?.activity.avgHeartRate || 0} bpm average heart rate
- Calories burned per workout: ${userData?.activity.avgCaloriesBurned || 0} calories

BLOOD MARKERS (LATEST TEST):
${userData?.bloodMarkers ? Object.entries(userData.bloodMarkers)
  .filter(([key, value]) => key !== 'date' && value)
  .map(([key, value]) => `${key}: ${value}`)
  .join('\n') : 'No blood marker data available'}

=== RESPONSE REQUIREMENTS ===
1. ALWAYS reference specific numbers from the data above
2. NEVER say "I don't have access to your data" - you DO have access
3. Use **bold** for key metrics like heart rates, distances, calories
4. Give specific insights based on the ACTUAL data patterns
5. When discussing performance, use their REAL workout data
6. When discussing nutrition, use their REAL calorie/macro data
7. Be conversational but data-driven

EXAMPLE: "Looking at your recent runs, I can see you did **${recentActivities.filter(a => a.type?.toLowerCase().includes('run')).length} runs** this week. Your best run was **${recentActivities.filter(a => a.type?.toLowerCase().includes('run'))[0]?.distance?.toFixed(1) || 0}km** with an average heart rate of **${recentActivities.filter(a => a.type?.toLowerCase().includes('run'))[0]?.average_heartrate || 'N/A'} bpm**."

Remember: Use the REAL data above. Be specific. Give actual numbers.`;

      // Build messages array with explicit system context
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

      console.log('📤 Sending EXPLICIT data to AI:', {
        systemContextLength: systemContext.length,
        totalMessages: conversationMessages.length,
        runCount: recentActivities.filter(a => a.type && a.type.toLowerCase().includes('run')).length,
        totalActivities: recentActivities.length,
        nutritionDays: nutritionDetails.length,
        avgCalories: userData?.nutrition.avgCalories || 0,
        workoutsPerWeek: userData?.activity.workoutsPerWeek || 0,
        bloodMarkers: userData?.bloodMarkers ? Object.keys(userData.bloodMarkers).length : 0
      });
      
      // Call chat API with explicit instructions
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          source: "smart_health_chat_v4_fixed",
          userData: { systemContext },
          messages: conversationMessages.slice(-8), // Keep more context
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
      
      // Check if AI actually used the data
      const usesRealData = assistantContent && (
        assistantContent.includes('bpm') ||
        assistantContent.includes('calories') ||
        assistantContent.includes('protein') ||
        assistantContent.includes('km') ||
        assistantContent.includes('g ') ||
        /\d+\.\d+/.test(assistantContent) ||
        /\*\*\d+/.test(assistantContent) ||
        assistantContent.toLowerCase().includes('your run') ||
        assistantContent.toLowerCase().includes('your workout')
      );
      
      console.log(`🤖 AI response uses real data: ${usesRealData}`);
      console.log(`🤖 Response preview: ${assistantContent.substring(0, 200)}...`);
      
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
      console.error('❌ Error getting AI response:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, I\'m having trouble connecting right now. Please try again in a moment. 🤖💭',
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
            🤖 Let's Jam
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Your AI health coach with complete access to your health data
          </p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <Badge variant="secondary" className="text-xs">
              Real Data Connected
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Session: {sessionId.slice(-8)}
            </Badge>
            <Badge variant={recentActivities.length > 0 ? "default" : "secondary"} className="text-xs">
              {recentActivities.length} Activities
            </Badge>
            <Badge variant={nutritionDetails.length > 0 ? "default" : "secondary"} className="text-xs">
              {nutritionDetails.length} Nutrition Days
            </Badge>
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
            
            {/* Left Column - Chat Interface (Larger) */}
            <div className="lg:col-span-3 space-y-4">
              
              {/* Smart Prompt Suggestions */}
              <SmartPromptSuggestions 
                onPromptSelect={handlePromptSelect}
                userData={userData}
                recentActivities={recentActivities}
              />
              
              {/* Chat Container - Dynamic Full Height */}
              <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                <CardHeader className="border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                      <Bot className="h-5 w-5 text-orange-500" />
                      AI Health Coach
                      <Badge variant="secondary" className="ml-2 text-xs">
                        Session Active
                      </Badge>
                      <Badge variant={userData ? "default" : "secondary"} className="text-xs">
                        {userData ? 'Data Loaded' : 'Loading Data'}
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
                    
                    {/* Typing indicator */}
                    {isTyping && (
                      <div className="flex justify-start">
                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4 shadow-sm">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-purple-500" />
                            <span className="text-sm text-purple-700">AI is analyzing your data</span>
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
                      <Button
                        onClick={handleSendMessage}
                        disabled={!input.trim() || isTyping}
                        className="bg-orange-500 hover:bg-orange-600 text-white px-4"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
                      <span>{messages.length} messages in this session</span>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${userData ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
                          {userData ? 'Real data connected' : 'Loading data...'}
                        </span>
                        <span className="text-xs text-gray-400">
                          {messages.length > 1 ? 'Session restored' : 'New session'}
                        </span>
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
          
          {/* Bottom Action Cards */}
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
                <div className="text-xs text-gray-600">Workout & fitness analytics</div>
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
                <div className="text-xs text-gray-600">Food & macro tracking</div>
              </div>
            </Button>
          </div>
          
          {/* Data Status Display */}
          <div className="mt-8">
            <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Zap className="h-5 w-5 text-orange-500" />
                  Live Data Status
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-orange-500" />
                      <span className="font-medium text-gray-700">Activities</span>
                      <Badge variant={recentActivities.length > 0 ? "default" : "secondary"} className="text-xs">
                        {recentActivities.length}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      {recentActivities.length > 0 
                        ? `${recentActivities.filter(a => a.type?.toLowerCase().includes('run')).length} runs, ${recentActivities.length} total workouts`
                        : 'No recent activities found'
                      }
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Utensils className="h-4 w-4 text-green-500" />
                      <span className="font-medium text-gray-700">Nutrition</span>
                      <Badge variant={nutritionDetails.length > 0 ? "default" : "secondary"} className="text-xs">
                        {nutritionDetails.length} days
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      {nutritionDetails.length > 0 
                        ? `${userData?.nutrition.avgCalories || 0} avg calories/day`
                        : 'No nutrition data logged'
                      }
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-red-500" />
                      <span className="font-medium text-gray-700">Heart Rate</span>
                      <Badge variant={userData?.activity.avgHeartRate > 0 ? "default" : "secondary"} className="text-xs">
                        {userData?.activity.avgHeartRate || 0} bpm
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      {userData?.activity.avgHeartRate > 0 
                        ? 'Average from all activities'
                        : 'No heart rate data available'
                      }
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Droplet className="h-4 w-4 text-blue-500" />
                      <span className="font-medium text-gray-700">Blood Markers</span>
                      <Badge variant={userData?.bloodMarkers && Object.keys(userData.bloodMarkers).length > 0 ? "default" : "secondary"} className="text-xs">
                        {userData?.bloodMarkers ? Object.keys(userData.bloodMarkers).length : 0}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      {userData?.bloodMarkers && Object.keys(userData.bloodMarkers).length > 0
                        ? 'Latest blood test results available'
                        : 'No blood marker data available'
                      }
                    </p>
                  </div>
                </div>
                
                <div className="mt-6 p-4 bg-white/60 rounded-lg border border-white/30">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Bot className="h-4 w-4 text-orange-500" />
                    AI Data Access
                  </h4>
                  <div className="text-xs text-gray-600">
                    <p>✅ The AI can see ALL your real data: {recentActivities.length} activities, {nutritionDetails.length} nutrition days, {userData?.bloodMarkers ? Object.keys(userData.bloodMarkers).length : 0} blood markers</p>
                    <p>✅ Specific numbers, dates, and metrics are passed to the AI</p>
                    <p>✅ Ask specific questions about your performance, nutrition, or health trends</p>
                    <p>💾 Your conversation is automatically saved and restored when you return</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="relative z-10 py-6 px-6 md:px-12 text-center text-sm text-gray-500">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <span>AI-powered health coaching with real-time data</span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <Bot className="h-4 w-4" />
              Session: {sessionId.slice(-8)}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>Powered by Gemini 2.0 Flash</span>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full animate-pulse ${userData ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
              <span className="text-xs">{userData ? 'Live Data Connected' : 'Loading Data'}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LetsJam;
