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
  heartRateRuns: number | null;
  caloriesBurned: number;
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

// FIXED: Better data processing with real validation
const processHealthDataForAI = (healthData: HealthData[], recentRuns: RunActivity[], bloodMarkers: any): StructuredHealthData => {
  console.log('🔍 Processing health data - Raw runs:', recentRuns.length);
  console.log('🔍 Processing health data - Health data days:', healthData.length);
  
  const validDays = healthData.filter(d => d.caloriesConsumed > 0 || d.caloriesBurned > 0);
  const workoutDays = healthData.filter(d => d.caloriesBurned > 0);
  const runDays = healthData.filter(d => d.runCount > 0 && d.heartRateRuns);
  
  const BMR = 1479;
  
  // FIXED: Only calculate averages if we have actual data
  const nutrition = {
    type: 'nutrition_averages_7_days',
    avgCaloriesPerDay: validDays.length > 0 ? validDays.reduce((sum, d) => sum + d.caloriesConsumed, 0) / validDays.length : 0,
    avgProteinPerDay: validDays.length > 0 ? validDays.reduce((sum, d) => sum + d.protein, 0) / validDays.length : 0,
    avgCarbsPerDay: validDays.length > 0 ? validDays.reduce((sum, d) => sum + d.carbs, 0) / validDays.length : 0,
    avgFatPerDay: validDays.length > 0 ? validDays.reduce((sum, d) => sum + d.fat, 0) / validDays.length : 0,
    avgFiberPerDay: validDays.length > 0 ? validDays.reduce((sum, d) => sum + d.fiber, 0) / validDays.length : 0,
    calorieDeficitAvg: validDays.length > 0 ? validDays.reduce((sum, d) => sum + (d.caloriesBurned + BMR - d.caloriesConsumed), 0) / validDays.length : 0
  };
  
  // FIXED: Calculate total distance properly
  const totalRunDistance = recentRuns.reduce((sum, r) => {
    const distance = r.distance || 0;
    console.log(`🏃 Adding run distance: ${distance}km from "${r.name}"`);
    return sum + distance;
  }, 0);
  
  console.log(`📊 Total calculated distance: ${totalRunDistance}km from ${recentRuns.length} runs`);
  
  const activity = {
    type: 'activity_summary_7_days',
    workoutsPerWeek: (workoutDays.length / 7) * 7,
    avgHeartRateRuns: runDays.length > 0 ? runDays.reduce((sum, d) => sum + (d.heartRateRuns || 0), 0) / runDays.length : null,
    avgCaloriesBurned: workoutDays.length > 0 ? workoutDays.reduce((sum, d) => sum + d.caloriesBurned, 0) / workoutDays.length : 0,
    avgDurationMin: workoutDays.length > 0 ? workoutDays.reduce((sum, d) => sum + d.workoutDuration, 0) / workoutDays.length / 60 : 0,
    totalRunDistance: totalRunDistance
  };
  
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
    recentRuns: recentRuns.slice(0, 5),
    bloodMarkers,
    trends
  };
};

// FIXED: Message Component with better rendering
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

// Health Summary Component - Display real data with fallbacks
const SmartHealthSummary: React.FC<{ 
  healthData: HealthData[], 
  recentRuns: RunActivity[], 
  bloodMarkers: any,
  onRefresh: () => void,
  isRefreshing: boolean 
}> = ({ healthData, recentRuns, bloodMarkers, onRefresh, isRefreshing }) => {
  const structuredData = processHealthDataForAI(healthData, recentRuns, bloodMarkers);
  
  console.log('🔍 SmartHealthSummary received runs:', recentRuns.length);
  console.log('🔍 Structured data total distance:', structuredData.activity.totalRunDistance);
  
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
        <Badge variant={structuredData.nutrition.avgCaloriesPerDay > 0 ? "default" : "secondary"} className="text-xs">
          {structuredData.nutrition.avgCaloriesPerDay > 0 ? 'Nutrition: Active' : 'Nutrition: No Data'}
        </Badge>
        <Badge variant={structuredData.activity.totalRunDistance > 0 ? "default" : "secondary"} className="text-xs">
          {structuredData.activity.totalRunDistance > 0 ? 'Runs: Active' : 'Runs: No Data'}
        </Badge>
      </div>
      
      <div className="grid grid-cols-1 gap-3">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Utensils className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium text-green-700">Nutrition</span>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-bold text-green-800">
                {structuredData.nutrition.avgCaloriesPerDay || 'No Data'}
              </div>
              <div className="text-xs text-green-600">
                {structuredData.nutrition.avgCaloriesPerDay > 0 ? 'cal/day' : 'Add nutrition logs'}
              </div>
              <div className="text-xs text-gray-600 truncate">
                {structuredData.nutrition.avgProteinPerDay > 0 ? `${structuredData.nutrition.avgProteinPerDay}g protein` : 'Track your meals'}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-orange-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-orange-600" />
              <span className="text-xs font-medium text-orange-700">Activity</span>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-bold text-orange-800">
                {structuredData.activity.workoutsPerWeek || '0'}
              </div>
              <div className="text-xs text-orange-600">workouts/wk</div>
              <div className="text-xs text-gray-600 truncate">
                {structuredData.activity.avgCaloriesBurned > 0 ? `${structuredData.activity.avgCaloriesBurned} cal avg` : 'No workouts yet'}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-700">Running</span>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-bold text-blue-800">
                {structuredData.activity.totalRunDistance > 0 ? `${structuredData.activity.totalRunDistance}km` : 'No runs'}
              </div>
              <div className="text-xs text-blue-600">
                {structuredData.activity.totalRunDistance > 0 ? 'total distance' : 'Start running!'}
              </div>
              <div className="text-xs text-gray-600 truncate">
                {structuredData.activity.avgHeartRateRuns ? `${structuredData.activity.avgHeartRateRuns} bpm avg` : 'Add heart rate data'}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-medium text-purple-700">Health</span>
            </div>
            <div className="space-y-1">
              <div className={`text-lg font-bold ${
                structuredData.nutrition.calorieDeficitAvg >= 0 ? 'text-green-800' : 
                structuredData.nutrition.calorieDeficitAvg < -500 ? 'text-red-800' : 'text-orange-800'
              }`}>
                {structuredData.nutrition.avgCaloriesPerDay > 0 ? 
                  (structuredData.nutrition.calorieDeficitAvg >= 0 ? '+' : '') + structuredData.nutrition.calorieDeficitAvg :
                  'No Data'
                }
              </div>
              <div className="text-xs text-purple-600">
                {structuredData.nutrition.avgCaloriesPerDay > 0 ? 'cal deficit' : 'Track nutrition'}
              </div>
              <div className="text-xs text-gray-600 truncate">
                {structuredData.trends.recoveryStatus === 'well_rested' ? 'Well rested' : 
                 structuredData.trends.recoveryStatus === 'moderate' ? 'Moderate load' : 
                 structuredData.trends.recoveryStatus === 'high_load' ? 'High load' : 'Unknown status'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {recentRuns.length > 0 && (
        <Card className="bg-white/80 border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Recent Runs ({recentRuns.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="space-y-2">
              {recentRuns.slice(0, 3).map((run, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{run.name}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(run.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <div className="text-sm font-semibold text-blue-600">
                      {run.distance ? `${run.distance.toFixed(1)}km` : 'No distance'}
                    </div>
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
      
      {bloodMarkers && Object.keys(bloodMarkers).length > 0 && (
        <Card className="bg-white/80 border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Droplet className="h-4 w-4 text-red-500" />
              Blood Markers
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(bloodMarkers).slice(0, 4).map(([key, value]) => (
                <div key={key} className="text-center bg-gray-50 p-2 rounded">
                  <div className="text-xs font-medium text-gray-500 uppercase truncate">{key}</div>
                  <div className="text-sm font-semibold text-gray-800">{value}</div>
                </div>
              ))}
            </div>
            {Object.keys(bloodMarkers).length > 4 && (
              <div className="text-center mt-2">
                <span className="text-xs text-gray-500">+{Object.keys(bloodMarkers).length - 4} more</span>
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
  healthData: StructuredHealthData 
}> = ({ onPromptSelect, healthData }) => {
  const hasNutritionData = healthData.nutrition.avgCaloriesPerDay > 0;
  const hasRunData = healthData.activity.totalRunDistance > 0;
  const hasActivityData = healthData.activity.workoutsPerWeek > 0;
  
  const promptCategories = [
    {
      title: 'Performance',
      icon: Target,
      color: 'from-orange-100 to-red-100 border-orange-300',
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
      color: 'from-green-100 to-green-200 border-green-300',
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
      color: 'from-purple-100 to-purple-200 border-purple-300',
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
      color: 'from-orange-100 to-orange-200 border-orange-300',
      prompts: healthData.bloodMarkers ? [
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

// Main Component
const LetsJam: React.FC = () => {
  const navigate = useNavigate();
  const [healthData, setHealthData] = useState<HealthData[]>([]);
  const [recentRuns, setRecentRuns] = useState<RunActivity[]>([]);
  const [bloodMarkers, setBloodMarkers] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Hi! I\'m your AI health coach with access to your complete health data. I can analyze your running performance, nutrition trends, and Strava activity data to provide personalized insights. What would you like to explore today?',
      timestamp: new Date()
    }
  ]);
  
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId] = useState(() => generateSessionId());
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // FIXED: Better scroll refs and behavior
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  // FIXED: More reliable auto-scroll
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end'
      });
    }
  };
  
  // FIXED: Scroll on message changes with delay to ensure DOM updates
  useEffect(() => {
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, [messages, isTyping]);

  // FIXED: Better data fetching with your actual Firestore structure
  const fetchHealthData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Starting health data fetch...');
      
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const dateString = sevenDaysAgo.toISOString().split('T')[0];

      // Initialize empty data structure
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

      const [nutritionSnapshot, stravaSnapshot, bloodMarkersSnapshot] = await Promise.all([
        getDocs(query(
          collection(db, "nutritionLogs"),
          where("date", ">=", dateString),
          orderBy("date", "desc")
        )).catch((error) => {
          console.log('Nutrition query failed:', error.message);
          return { docs: [] };
        }),
        
        getDocs(query(
          collection(db, "strava_data"),
          where("userId", "==", "mihir_jain"),
          orderBy("start_date", "desc"),
          limit(20)
        )).catch((error) => {
          console.log('Strava query failed:', error.message);
          return { docs: [] };
        }),
        
        getDocs(query(
          collection(db, "blood_markers"),
          where("userId", "==", "mihir_jain"),
          orderBy("date", "desc"),
          limit(1)
        )).catch((error) => {
          console.log('Blood markers query failed:', error.message);
          return { docs: [] };
        })
      ]);

      console.log('📊 Raw data counts:', {
        nutrition: nutritionSnapshot.docs.length,
        strava: stravaSnapshot.docs.length,
        bloodMarkers: bloodMarkersSnapshot.docs.length
      });

      // Process nutrition data
      nutritionSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (tempData[data.date] && data.totals) {
          tempData[data.date].caloriesConsumed = data.totals.calories || 0;
          tempData[data.date].protein = data.totals.protein || 0;
          tempData[data.date].carbs = data.totals.carbs || 0;
          tempData[data.date].fat = data.totals.fat || 0;
          tempData[data.date].fiber = data.totals.fiber || 0;
          console.log(`✅ Nutrition data for ${data.date}:`, data.totals.calories, 'cal');
        }
      });

      const runs: RunActivity[] = [];

      // FIXED: Handle your actual Firestore structure
      stravaSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const activityDate = data.date || (data.start_date ? data.start_date.substring(0, 10) : undefined);
        
        if (!activityDate) {
          console.log('⚠️ Skipping activity with no date:', data.name || 'Unknown activity');
          return;
        }

        const isRunActivity = data.type && (
          data.type.toLowerCase().includes('run') || 
          data.type === 'Run' || 
          data.type === 'VirtualRun'
        );

        if (isRunActivity) {
          // FIXED: Handle your actual Firestore structure where distance is already in km
          const distance = data.distance || 0; // Distance is already in km in your DB
          const duration = data.duration || 0; // Duration in minutes
          const heartRate = data.average_heartrate || null;
          const calories = data.calories || data.caloriesBurned || 0;
          const activityName = data.name || data.activity_name || `${data.type || 'Run'}`;

          // Only add runs with valid distance
          if (distance > 0) {
            const run = {
              date: activityDate,
              name: activityName,
              distance: distance, // Already in km
              duration: duration * 60, // Convert minutes to seconds for consistency
              average_speed: data.average_speed || 0,
              average_heartrate: heartRate,
              type: data.type || 'Run',
              calories: calories
            };
            
            runs.push(run);
            console.log(`🏃 Added run: ${run.name} - ${run.distance.toFixed(2)}km on ${activityDate} (HR: ${heartRate || 'N/A'})`);
          } else {
            console.log(`⚠️ Skipping run with no distance: ${activityName}`);
          }
        }

        // Process all activities for daily summaries
        if (tempData[activityDate]) {
          // Add heart rate data for runs only
          if (isRunActivity && heartRate != null) {
            const currentHR = tempData[activityDate].heartRateRuns || 0;
            const currentRunCount = tempData[activityDate].runCount;
            tempData[activityDate].heartRateRuns = currentRunCount === 0 
              ? heartRate 
              : ((currentHR * currentRunCount) + heartRate) / (currentRunCount + 1);
            tempData[activityDate].runCount += 1;
          }

          // Add calories from any activity
          const activityCalories = data.calories || data.caloriesBurned || 0;
          tempData[activityDate].caloriesBurned += activityCalories;
          
          // Add duration (convert to seconds if needed)
          const activityDuration = data.duration || 0;
          tempData[activityDate].workoutDuration += (activityDuration * 60); // Convert minutes to seconds

          // Track activity types
          if (data.type && !tempData[activityDate].activityTypes.includes(data.type)) {
            tempData[activityDate].activityTypes.push(data.type);
          }
          
          console.log(`📊 Updated ${activityDate}: +${activityCalories} cal, +${activityDuration} min`);
        }
      });

      // Process blood markers
      if (bloodMarkersSnapshot.docs.length > 0) {
        const latestDoc = bloodMarkersSnapshot.docs[0];
        const markersData = latestDoc.data().markers || {};
        setBloodMarkers(markersData);
        console.log('🩸 Blood markers loaded:', Object.keys(markersData));
      }

      // Final data processing
      const sortedData = Object.values(tempData).sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const sortedRuns = runs.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      console.log(`📊 Final data summary:`);
      console.log(`  - Health data days: ${sortedData.length}`);
      console.log(`  - Total runs: ${sortedRuns.length}`);
      console.log(`  - Total run distance: ${sortedRuns.reduce((sum, r) => sum + r.distance, 0).toFixed(2)}km`);
      console.log(`  - Recent runs:`, sortedRuns.slice(0, 3).map(r => `${r.name} (${r.distance}km)`));

      setHealthData(sortedData);
      setRecentRuns(sortedRuns.slice(0, 10)); // Keep more runs for context

    } catch (error) {
      console.error("❌ Error fetching health data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
  }, []);
  
  const structuredHealthData = processHealthDataForAI(healthData, recentRuns, bloodMarkers);
  
  // FIXED: Enhanced message sending with REAL data validation
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
      // ENHANCED: Build comprehensive real data context
      const enhancedData = {
        ...structuredHealthData,
        rawHealthData: healthData.map(day => ({
          date: day.date,
          nutrition: {
            calories: day.caloriesConsumed,
            protein: day.protein,
            carbs: day.carbs,
            fat: day.fat,
            fiber: day.fiber
          },
          activity: {
            caloriesBurned: day.caloriesBurned,
            workoutDuration: Math.round(day.workoutDuration / 60), // Convert to minutes
            heartRateRuns: day.heartRateRuns,
            runCount: day.runCount,
            activityTypes: day.activityTypes
          }
        })),
        
        // REAL run data with actual values
        actualRunData: recentRuns.map(run => ({
          name: run.name,
          date: run.date,
          distance: run.distance,
          duration: Math.round(run.duration / 60), // Convert to minutes
          heartRate: run.average_heartrate,
          calories: run.calories,
          type: run.type,
          pace: run.duration > 0 ? (run.duration / 60) / run.distance : null // min/km
        })),
        
        userProfile: {
          name: "Mihir",
          BMR: 1479,
          goals: "weight_loss_and_fitness",
          dataQuality: {
            nutritionDays: healthData.filter(d => d.caloriesConsumed > 0).length,
            activityDays: healthData.filter(d => d.caloriesBurned > 0).length,
            runDays: recentRuns.length,
            heartRateDays: healthData.filter(d => d.heartRateRuns > 0).length,
            hasBloodMarkers: bloodMarkers !== null && Object.keys(bloodMarkers).length > 0
          }
        },
        
        // Comprehensive run summary with REAL calculations
        runSummary: {
          totalRuns: recentRuns.length,
          totalDistance: Math.round(recentRuns.reduce((sum, run) => sum + run.distance, 0) * 10) / 10,
          averageDistance: recentRuns.length > 0 ? Math.round((recentRuns.reduce((sum, run) => sum + run.distance, 0) / recentRuns.length) * 10) / 10 : 0,
          averageHeartRate: recentRuns.filter(r => r.average_heartrate > 0).length > 0 
            ? Math.round(recentRuns.filter(r => r.average_heartrate > 0).reduce((sum, run) => sum + run.average_heartrate, 0) / recentRuns.filter(r => r.average_heartrate > 0).length) 
            : null,
          lastRunDate: recentRuns.length > 0 ? recentRuns[0].date : null,
          weeklyDistance: Math.round(recentRuns.filter(run => {
            const runDate = new Date(run.date);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return runDate >= weekAgo;
          }).reduce((sum, run) => sum + run.distance, 0) * 10) / 10
        },
        
        // Nutrition summary with REAL data
        nutritionSummary: {
          avgDailyCalories: structuredHealthData.nutrition.avgCaloriesPerDay,
          avgDailyProtein: structuredHealthData.nutrition.avgProteinPerDay,
          avgDailyCarbs: structuredHealthData.nutrition.avgCarbsPerDay,
          avgDailyFat: structuredHealthData.nutrition.avgFatPerDay,
          avgCalorieDeficit: structuredHealthData.nutrition.calorieDeficitAvg,
          daysWithData: healthData.filter(d => d.caloriesConsumed > 0).length,
          proteinPercentage: structuredHealthData.nutrition.avgCaloriesPerDay > 0 ? 
            Math.round((structuredHealthData.nutrition.avgProteinPerDay * 4 / structuredHealthData.nutrition.avgCaloriesPerDay) * 100) : 0
        }
      };

      console.log('📤 Sending enhanced data to AI:', {
        totalRuns: enhancedData.runSummary.totalRuns,
        totalDistance: enhancedData.runSummary.totalDistance,
        nutritionDays: enhancedData.userProfile.dataQuality.nutritionDays,
        avgCalories: enhancedData.nutritionSummary.avgDailyCalories
      });

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].slice(-10),
          userData: enhancedData,
          userId: 'mihir_jain',
          source: 'smart_health_chat',
          sessionId: sessionId,
          context: {
            hasRealData: true,
            dataQuality: enhancedData.userProfile.dataQuality,
            instruction: "CRITICAL: Use the REAL data provided. Never use placeholder text. All numbers come from actual user data in Firestore. Provide specific insights based on the actual values."
          }
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
      console.error('❌ Error getting AI response:', error);
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
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="relative z-10 px-6 md:px-12 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column - Chat Interface */}
            <div className="lg:col-span-2 space-y-4">
              
              {/* Smart Prompt Suggestions */}
              <SmartPromptSuggestions 
                onPromptSelect={handlePromptSelect}
                healthData={structuredHealthData}
              />
              
              {/* FIXED: Bigger chat container that grows */}
              <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                <CardHeader className="border-b border-gray-100">
                  <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <Bot className="h-5 w-5 text-orange-500" />
                    AI Health Coach
                    <Badge variant="secondary" className="ml-2 text-xs">
                      Session Active
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {/* FIXED: Dynamic height chat container */}
                  <div 
                    ref={messagesContainerRef}
                    className="min-h-[500px] max-h-[800px] overflow-y-auto p-4 space-y-4" 
                    style={{
                      height: `${Math.min(800, Math.max(500, messages.length * 80 + 200))}px`
                    }}
                  >
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[85%] ${
                          message.role === 'user' 
                            ? 'bg-orange-500 text-white' 
                            : 'bg-gray-100 text-gray-800 border border-gray-200'
                        } rounded-lg p-4`}>
                          <MessageContent content={message.content} />
                          <div className={`text-xs mt-2 ${
                            message.role === 'user' ? 'text-orange-100' : 'text-gray-500'
                          }`}>
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Typing indicator */}
                    {isTyping && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-orange-500" />
                            <span className="text-sm text-gray-600">AI is analyzing your data</span>
                            <div className="flex gap-1">
                              <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce delay-100"></div>
                              <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce delay-200"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* FIXED: Scroll anchor */}
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
                    
                    {/* Message count and status */}
                    <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
                      <span>{messages.length} messages in this session</span>
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        Real data connected
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Right Column - Health Summary */}
            <div className="lg:col-span-1">
              <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm sticky top-6">
                <CardContent className="p-4">
                  {loading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-6 w-32" />
                      <div className="grid grid-cols-1 gap-3">
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
          
          {/* Feature Highlights */}
          <div className="mt-8">
            <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Zap className="h-5 w-5 text-orange-500" />
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
                    <Target className="h-4 w-4 text-orange-500" />
                    Live Data Sources
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-600">
                    <div>
                      <div className="font-medium text-red-600">Heart Rate:</div>
                      <div>Real data from your running activities for accurate cardiovascular insights</div>
                    </div>
                    <div>
                      <div className="font-medium text-orange-600">Distance & Calories:</div>
                      <div>Direct from your Strava activities with precise measurements</div>
                    </div>
                    <div>
                      <div className="font-medium text-green-600">Nutrition:</div>
                      <div>Your logged meals and macro breakdowns for dietary analysis</div>
                    </div>
                    <div>
                      <div className="font-medium text-blue-600">Health Markers:</div>
                      <div>Your blood test results for comprehensive health assessment</div>
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
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs">Live Data Connected</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LetsJam;
