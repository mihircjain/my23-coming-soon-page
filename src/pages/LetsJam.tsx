import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, RefreshCw, Activity, Utensils, Heart, TrendingUp, Target, Zap, Calendar, BarChart3, ArrowLeft, User, MessageSquare, Flame, Droplet, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { db } from '@/lib/firebaseConfig';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';

// Types
interface HealthData {
  date: string;
  heartRateRuns: number | null; // Only from runs
  caloriesBurned: number; // From Strava direct
  caloriesConsumed: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  workoutDuration: number;
  activityTypes: string[];
  runCount: number;
}

interface RunActivity {
  date: string;
  distance: number;
  duration: number;
  average_speed: number;
  average_heartrate: number | null;
  type: string;
  calories: number;
  name: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface StructuredHealthData {
  nutrition: {
    type: string;
    avgCaloriesPerDay: number;
    avgProteinPerDay: number;
    avgCarbsPerDay: number;
    avgFatPerDay: number;
    avgFiberPerDay: number;
    calorieDeficitAvg: number;
  };
  activity: {
    type: string;
    workoutsPerWeek: number;
    avgHeartRateRuns: number | null;
    avgCaloriesBurned: number;
    avgDurationMin: number;
    totalRunDistance: number;
  };
  recentRuns: RunActivity[];
  bloodMarkers: Record<string, number | string> | null;
  trends: {
    weekOverWeek: string;
    recoveryStatus: string;
    trainingLoad: string;
  };
}

// Generate session ID
const generateSessionId = () => {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

// Process health data into structured format for AI
const processHealthDataForAI = (healthData: HealthData[], recentRuns: RunActivity[], bloodMarkers: any): StructuredHealthData => {
  const validDays = healthData.filter(d => d.caloriesConsumed > 0 || d.caloriesBurned > 0);
  const workoutDays = healthData.filter(d => d.caloriesBurned > 0);
  const runDays = healthData.filter(d => d.runCount > 0 && d.heartRateRuns);
  
  const BMR = 1479; // Base metabolic rate
  
  // Calculate nutrition averages
  const nutrition = {
    type: 'nutrition_averages_7_days',
    avgCaloriesPerDay: validDays.reduce((sum, d) => sum + d.caloriesConsumed, 0) / Math.max(validDays.length, 1),
    avgProteinPerDay: validDays.reduce((sum, d) => sum + d.protein, 0) / Math.max(validDays.length, 1),
    avgCarbsPerDay: validDays.reduce((sum, d) => sum + d.carbs, 0) / Math.max(validDays.length, 1),
    avgFatPerDay: validDays.reduce((sum, d) => sum + d.fat, 0) / Math.max(validDays.length, 1),
    avgFiberPerDay: validDays.reduce((sum, d) => sum + d.fiber, 0) / Math.max(validDays.length, 1),
    calorieDeficitAvg: validDays.reduce((sum, d) => sum + (d.caloriesBurned + BMR - d.caloriesConsumed), 0) / Math.max(validDays.length, 1)
  };
  
  // Calculate activity averages (only for runs regarding heart rate)
  const activity = {
    type: 'activity_summary_7_days',
    workoutsPerWeek: (workoutDays.length / 7) * 7, // Normalize to weekly
    avgHeartRateRuns: runDays.length > 0 ? runDays.reduce((sum, d) => sum + (d.heartRateRuns || 0), 0) / runDays.length : null,
    avgCaloriesBurned: workoutDays.length > 0 ? workoutDays.reduce((sum, d) => sum + d.caloriesBurned, 0) / workoutDays.length : 0,
    avgDurationMin: workoutDays.length > 0 ? workoutDays.reduce((sum, d) => sum + d.workoutDuration, 0) / workoutDays.length / 60 : 0,
    totalRunDistance: recentRuns.reduce((sum, r) => sum + r.distance, 0)
  };
  
  // Generate trends analysis
  const trends = {
    weekOverWeek: nutrition.calorieDeficitAvg > 200 ? 'positive' : nutrition.calorieDeficitAvg < 0 ? 'concerning' : 'stable',
    recoveryStatus: runDays.length > 3 ? 'high_load' : runDays.length > 1 ? 'moderate' : 'well_rested',
    trainingLoad: activity.workoutsPerWeek > 5 ? 'high' : activity.workoutsPerWeek > 3 ? 'moderate' : 'light'
  };
  
  return {
    nutrition: {
      ...nutrition,
      avgCaloriesPerDay: Math.round(nutrition.avgCaloriesPerDay),
      avgProteinPerDay: Math.round(nutrition.avgProteinPerDay * 10) / 10,
      avgCarbsPerDay: Math.round(nutrition.avgCarbsPerDay),
      avgFatPerDay: Math.round(nutrition.avgFatPerDay),
      avgFiberPerDay: Math.round(nutrition.avgFiberPerDay),
      calorieDeficitAvg: Math.round(nutrition.calorieDeficitAvg)
    },
    activity: {
      ...activity,
      workoutsPerWeek: Math.round(activity.workoutsPerWeek * 10) / 10,
      avgHeartRateRuns: activity.avgHeartRateRuns ? Math.round(activity.avgHeartRateRuns) : null,
      avgCaloriesBurned: Math.round(activity.avgCaloriesBurned),
      avgDurationMin: Math.round(activity.avgDurationMin),
      totalRunDistance: Math.round(activity.totalRunDistance * 10) / 10
    },
    recentRuns: recentRuns.slice(0, 5), // Last 5 runs
    bloodMarkers,
    trends
  };
};

// Smart Health Summary Component
const SmartHealthSummary: React.FC<{ 
  healthData: HealthData[], 
  recentRuns: RunActivity[], 
  bloodMarkers: any,
  onRefresh: () => void,
  isRefreshing: boolean 
}> = ({ healthData, recentRuns, bloodMarkers, onRefresh, isRefreshing }) => {
  const structuredData = processHealthDataForAI(healthData, recentRuns, bloodMarkers);
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-500" />
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
      
      {/* Data Source Info */}
      <div className="flex items-center gap-2 mb-4">
        <Badge variant="secondary" className="text-xs">
          HR: Runs Only
        </Badge>
        <Badge variant="secondary" className="text-xs">
          Cal: Strava Direct
        </Badge>
      </div>
      
      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Nutrition Card */}
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Utensils className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium text-green-700">Nutrition</span>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-bold text-green-800">{structuredData.nutrition.avgCaloriesPerDay}</div>
              <div className="text-xs text-green-600">cal/day avg</div>
              <div className="text-xs text-gray-600">{structuredData.nutrition.avgProteinPerDay}g protein</div>
            </div>
          </CardContent>
        </Card>
        
        {/* Activity Card */}
        <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-orange-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-orange-600" />
              <span className="text-xs font-medium text-orange-700">Activity</span>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-bold text-orange-800">{structuredData.activity.workoutsPerWeek}</div>
              <div className="text-xs text-orange-600">workouts/week</div>
              <div className="text-xs text-gray-600">{structuredData.activity.avgCaloriesBurned} cal avg</div>
            </div>
          </CardContent>
        </Card>
        
        {/* Running Card */}
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-700">Running</span>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-bold text-blue-800">{structuredData.activity.totalRunDistance}km</div>
              <div className="text-xs text-blue-600">total distance</div>
              <div className="text-xs text-gray-600">
                {structuredData.activity.avgHeartRateRuns ? `${structuredData.activity.avgHeartRateRuns} bpm avg` : 'No HR data'}
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Health Score Card */}
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-medium text-purple-700">Health</span>
            </div>
            <div className="space-y-1">
              <div className={`text-lg font-bold ${structuredData.nutrition.calorieDeficitAvg >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                {structuredData.nutrition.calorieDeficitAvg >= 0 ? '+' : ''}{structuredData.nutrition.calorieDeficitAvg}
              </div>
              <div className="text-xs text-purple-600">cal deficit avg</div>
              <div className="text-xs text-gray-600">
                {structuredData.trends.recoveryStatus === 'well_rested' ? 'Well rested' : 
                 structuredData.trends.recoveryStatus === 'moderate' ? 'Moderate load' : 'High load'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Recent Runs Timeline */}
      {recentRuns.length > 0 && (
        <Card className="bg-white/80 border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Recent Runs
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="space-y-2">
              {recentRuns.slice(0, 3).map((run, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-800">{run.name}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(run.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-blue-600">{run.distance}km</div>
                    <div className="text-xs text-gray-500">
                      {run.average_heartrate ? `${run.average_heartrate} bpm` : 'No HR'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Blood Markers */}
      {bloodMarkers && (
        <Card className="bg-white/80 border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Droplet className="h-4 w-4 text-red-500" />
              Latest Blood Markers
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {Object.entries(bloodMarkers).slice(0, 6).map(([key, value]) => (
                <div key={key} className="text-center bg-gray-50 p-2 rounded">
                  <div className="text-xs font-medium text-gray-500 uppercase">{key}</div>
                  <div className="text-sm font-semibold text-gray-800">{value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Smart Prompt Suggestions Component
const SmartPromptSuggestions: React.FC<{ 
  onPromptSelect: (prompt: string) => void,
  healthData: StructuredHealthData 
}> = ({ onPromptSelect, healthData }) => {
  const promptCategories = [
    {
      title: 'Performance',
      icon: Target,
      color: 'from-blue-100 to-blue-200 border-blue-300',
      prompts: [
        'Give me a running plan for this week',
        'Should I do a long run tomorrow?',
        'How hard have I trained this week?',
        'What type of runs should I focus on?'
      ]
    },
    {
      title: 'Nutrition',
      icon: Utensils,
      color: 'from-green-100 to-green-200 border-green-300',
      prompts: [
        'Is my protein intake adequate?',
        'Am I eating enough for my workouts?',
        'What should I eat on rest days?',
        'How is my calorie balance trending?'
      ]
    },
    {
      title: 'Recovery',
      icon: Heart,
      color: 'from-purple-100 to-purple-200 border-purple-300',
      prompts: [
        'Am I recovering well from my runs?',
        'Did I overtrain last week?',
        'What does my heart rate data tell you?',
        'How should I adjust my training load?'
      ]
    },
    {
      title: 'Health Analysis',
      icon: BarChart3,
      color: 'from-orange-100 to-orange-200 border-orange-300',
      prompts: [
        'Any concerns in my blood markers?',
        'Compare this week to last week',
        'What are my biggest health risks?',
        'Give me a complete health assessment'
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
          <Card key={categoryIndex} className={`bg-gradient-to-br ${category.color} cursor-pointer hover:shadow-md transition-all duration-200`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <category.icon className="h-4 w-4" />
                {category.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="space-y-1">
                {category.prompts.map((prompt, promptIndex) => (
                  <button
                    key={promptIndex}
                    onClick={() => onPromptSelect(prompt)}
                    className="w-full text-left text-xs p-2 bg-white/60 hover:bg-white/90 rounded border transition-all duration-150 text-gray-700 hover:text-gray-900"
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

// Main Smart Health Chatbot Component
const LetsJam: React.FC = () => {
  const navigate = useNavigate();
  const [healthData, setHealthData] = useState<HealthData[]>([]);
  const [recentRuns, setRecentRuns] = useState<RunActivity[]>([]);
  const [bloodMarkers, setBloodMarkers] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Hi! I\'m your AI health coach with access to your complete health data. I can analyze your running performance (heart rate from runs only), nutrition trends, and Strava activity data to provide personalized insights. What would you like to explore today?',
      timestamp: new Date()
    }
  ]);
  
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId] = useState(() => generateSessionId());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch health data from Firebase
  const fetchHealthData = async () => {
    try {
      setLoading(true);
      
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const dateString = sevenDaysAgo.toISOString().split('T')[0];

      // Initialize data structure
      const tempData: Record<string, HealthData> = {};
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        tempData[dateStr] = {
          date: dateStr,
          heartRateRuns: null,
          caloriesBurned: 0,
          caloriesConsumed: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
          workoutDuration: 0,
          activityTypes: [],
          runCount: 0
        };
      }

      // Fetch data in parallel
      const [nutritionSnapshot, stravaSnapshot, bloodMarkersSnapshot] = await Promise.all([
        getDocs(query(
          collection(db, "nutritionLogs"),
          where("date", ">=", dateString),
          orderBy("date", "desc")
        )).catch(() => ({ docs: [] })),
        
        getDocs(query(
          collection(db, "strava_data"),
          where("userId", "==", "mihir_jain"),
          orderBy("start_date", "desc"),
          limit(20)
        )).catch(() => ({ docs: [] })),
        
        getDocs(query(
          collection(db, "blood_markers"),
          where("userId", "==", "mihir_jain"),
          orderBy("date", "desc"),
          limit(1)
        )).catch(() => ({ docs: [] }))
      ]);

      // Process nutrition data
      nutritionSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (tempData[data.date]) {
          tempData[data.date].caloriesConsumed = data.totals?.calories || 0;
          tempData[data.date].protein = data.totals?.protein || 0;
          tempData[data.date].carbs = data.totals?.carbs || 0;
          tempData[data.date].fat = data.totals?.fat || 0;
          tempData[data.date].fiber = data.totals?.fiber || 0;
        }
      });

      // Process runs for recent runs list
      const runs: RunActivity[] = [];

      // Process Strava data - HR only from runs, use Strava calories
      stravaSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const activityDate = data.date || (data.start_date ? data.start_date.substring(0, 10) : undefined);
        
        if (!activityDate) return;

        // Check if this is a run activity
        const isRunActivity = data.type && (
          data.type.toLowerCase().includes('run') || 
          data.type === 'Run' || 
          data.type === 'VirtualRun'
        );

        // Add to runs list
        if (isRunActivity) {
          runs.push({
            date: activityDate,
            name: data.name || 'Run',
            distance: (data.distance || 0) / 1000, // Convert to km
            duration: data.moving_time || data.duration * 60 || 0,
            average_speed: data.average_speed || 0,
            average_heartrate: data.heart_rate || data.average_heartrate,
            type: data.type,
            calories: data.kilojoules || data.calories || data.activity?.calories || 0
          });
        }

        if (tempData[activityDate]) {
          // Heart rate only from runs
          if (isRunActivity && data.heart_rate != null) {
            const currentHR = tempData[activityDate].heartRateRuns || 0;
            const currentRunCount = tempData[activityDate].runCount;
            tempData[activityDate].heartRateRuns = currentRunCount === 0 
              ? data.heart_rate 
              : ((currentHR * currentRunCount) + data.heart_rate) / (currentRunCount + 1);
            tempData[activityDate].runCount += 1;
          }

          // Use Strava calories
          const stravaCalories = data.kilojoules || data.calories || data.activity?.calories || 0;
          tempData[activityDate].caloriesBurned += stravaCalories;
          tempData[activityDate].workoutDuration += data.duration || 0;

          if (data.type && !tempData[activityDate].activityTypes.includes(data.type)) {
            tempData[activityDate].activityTypes.push(data.type);
          }
        }
      });

      // Process blood markers
      if (bloodMarkersSnapshot.docs.length > 0) {
        const latestDoc = bloodMarkersSnapshot.docs[0];
        setBloodMarkers(latestDoc.data().markers || {});
      }

      // Sort and set data
      const sortedData = Object.values(tempData).sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const sortedRuns = runs.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setHealthData(sortedData);
      setRecentRuns(sortedRuns.slice(0, 5));

    } catch (error) {
      console.error("Error fetching health data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
  }, []);
  
  const structuredHealthData = processHealthDataForAI(healthData, recentRuns, bloodMarkers);
  
  const handleSendMessage = async () => {
    if (!input.trim() || isTyping) return;
    
    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].slice(-10), // Keep last 10 for context
          userData: structuredHealthData,
          userId: 'mihir_jain',
          source: 'smart_health_chat',
          sessionId: sessionId
        }),
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
      console.error('Error getting AI response:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, I\'m having trouble connecting right now. Please try again in a moment. 🤖💭',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };
  
  const handlePromptSelect = (prompt: string) => {
    setInput(prompt);
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchHealthData().finally(() => {
      setIsRefreshing(false);
    });
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-400/5 to-green-400/5"></div>
      <div className="absolute top-20 left-20 w-32 h-32 bg-blue-200/20 rounded-full blur-xl animate-bounce"></div>
      <div className="absolute bottom-20 right-20 w-24 h-24 bg-green-200/20 rounded-full blur-xl animate-bounce delay-1000"></div>
      
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
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-green-600 bg-clip-text text-transparent">
            🤖 Let's Jam
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Your AI health coach with complete access to your health data
          </p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <Badge variant="secondary" className="text-xs">
              HR: Runs Only
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Cal: Strava Direct
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Session: {sessionId.slice(-8)}
            </Badge>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="relative z-10 px-6 md:px-12 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column - Chat Interface */}
            <div className="lg:col-span-2 space-y-4">
              
              {/* Chat Messages */}
              <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                <CardHeader className="border-b border-gray-100">
                  <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <Bot className="h-5 w-5 text-blue-500" />
                    AI Health Coach
                    <Badge variant="secondary" className="ml-2 text-xs">
                      Session Active
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {/* Messages Container */}
                  <div className="h-96 overflow-y-auto p-4 space-y-4">
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[85%] ${
                          message.role === 'user' 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-gray-100 text-gray-800 border border-gray-200'
                        } rounded-lg p-3`}>
                          <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                          <div className={`text-xs mt-1 ${
                            message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                          }`}>
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Typing indicator */}
                    {isTyping && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center gap-1">
                            <Bot className="h-4 w-4 text-blue-500" />
                            <span className="text-sm text-gray-600">AI is thinking</span>
                            <div className="flex gap-1">
                              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-100"></div>
                              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-200"></div>
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
                        className="flex-1 border-gray-200 focus:border-blue-400 focus:ring-blue-400"
                        disabled={isTyping}
                      />
                      <Button
                        onClick={handleSendMessage}
                        disabled={!input.trim() || isTyping}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {/* Message count */}
                    <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
                      <span>{messages.length} messages in this session</span>
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        Connected to AI health coach
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Smart Prompt Suggestions */}
              <SmartPromptSuggestions 
                onPromptSelect={handlePromptSelect}
                healthData={structuredHealthData}
              />
            </div>
            
            {/* Right Column - Health Summary */}
            <div className="lg:col-span-1">
              <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm sticky top-6">
                <CardContent className="p-4">
                  {loading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-6 w-32" />
                      <div className="grid grid-cols-2 gap-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <Skeleton key={i} className="h-20 w-full" />
                        ))}
                      </div>
                      <Skeleton className="h-32 w-full" />
                    </div>
                  ) : (
                    <SmartHealthSummary
                      healthData={healthData}
                      recentRuns={recentRuns}
                      bloodMarkers={bloodMarkers}
                      onRefresh={handleRefresh}
                      isRefreshing={isRefreshing}
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
          
          {/* Bottom Action Cards */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              onClick={() => navigate('/overall-jam')} 
              variant="outline"
              className="bg-white/80 backdrop-blur-sm border-blue-200 hover:bg-blue-50 text-blue-700 px-6 py-4 h-auto flex-col gap-2"
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
              className="bg-white/80 backdrop-blur-sm border-orange-200 hover:bg-orange-50 text-orange-700 px-6 py-4 h-auto flex-col gap-2"
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
              className="bg-white/80 backdrop-blur-sm border-green-200 hover:bg-green-50 text-green-700 px-6 py-4 h-auto flex-col gap-2"
            >
              <Utensils className="h-6 w-6" />
              <div>
                <div className="font-medium">Nutrition Jam</div>
                <div className="text-xs text-gray-600">Food & macro tracking</div>
              </div>
            </Button>
          </div>
          
          {/* Feature Highlights */}
          <div className="mt-8">
            <Card className="bg-gradient-to-r from-blue-50 to-green-50 border-blue-200">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Zap className="h-5 w-5 text-blue-500" />
                  What Your AI Health Coach Can Do
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-orange-500" />
                      <span className="font-medium text-gray-700">Training Plans</span>
                    </div>
                    <p className="text-sm text-gray-600">Personalized workout recommendations based on your current fitness level and recovery status</p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Utensils className="h-4 w-4 text-green-500" />
                      <span className="font-medium text-gray-700">Nutrition Insights</span>
                    </div>
                    <p className="text-sm text-gray-600">Analyze your macro balance, calorie deficit, and meal timing for optimal performance</p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-red-500" />
                      <span className="font-medium text-gray-700">Recovery Analysis</span>
                    </div>
                    <p className="text-sm text-gray-600">Monitor heart rate trends (runs only), training load, and recommend rest or active recovery days</p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Droplet className="h-4 w-4 text-blue-500" />
                      <span className="font-medium text-gray-700">Health Markers</span>
                    </div>
                    <p className="text-sm text-gray-600">Interpret blood test results and suggest lifestyle changes for optimal health</p>
                  </div>
                </div>
                
                {/* Data Source Accuracy Notice */}
                <div className="mt-6 p-4 bg-white/60 rounded-lg border border-white/30">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4 text-blue-500" />
                    Accurate Data Sources
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-600">
                    <div>
                      <div className="font-medium text-red-600">Heart Rate:</div>
                      <div>Only from running activities for cardiovascular training accuracy</div>
                    </div>
                    <div>
                      <div className="font-medium text-orange-600">Calories:</div>
                      <div>Direct from Strava's proven algorithms (no estimates)</div>
                    </div>
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
            <span>AI-powered health coaching with accurate data</span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <Bot className="h-4 w-4" />
              Session: {sessionId.slice(-8)}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>Powered by Gemini 2.0 Flash</span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs">Live</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LetsJam;
