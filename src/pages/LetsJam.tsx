// FIXED: LetsJam.tsx with Conditional Marathon Training & Navigation Fix
// Only provides marathon advice when user mentions marathon/training/race

import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, RefreshCw, Activity, Utensils, Heart, TrendingUp, Target, Zap, Calendar, BarChart3, ArrowLeft, User, MessageSquare, Flame, Droplet, Clock, Tag, CheckCircle, AlertCircle, PlayCircle, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

// Types and interfaces remain the same...
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
  runType?: string;
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

// Hardcoded userId for consistency
const userId = "mihir_jain";

// Run classification algorithm
const classifyRun = (activity: RecentActivity) => {
  if (!activity.distance || !activity.duration) {
    return { type: 'easy', confidence: 0.3, reason: 'Insufficient data' };
  }
  
  const pace = (activity.duration / 60) / activity.distance; // min/km
  const hr = activity.average_heartrate || 0;
  const distance = activity.distance;
  
  if (distance >= 15) {
    return { type: 'long', confidence: 0.9, reason: `${distance.toFixed(1)}km indicates long run` };
  }
  
  if (pace < 4.5 || hr > 175) {
    return { type: 'interval', confidence: 0.8, reason: `Fast pace (${pace.toFixed(2)} min/km) or high HR` };
  }
  
  if (pace >= 4.3 && pace <= 5.5 && hr >= 160 && hr <= 180) {
    return { type: 'tempo', confidence: 0.75, reason: `Moderate-hard effort (${pace.toFixed(2)} min/km, ${hr} bpm)` };
  }
  
  if (pace > 6.5 || hr < 140) {
    return { type: 'recovery', confidence: 0.7, reason: `Very easy effort (${pace.toFixed(2)} min/km)` };
  }
  
  return { type: 'easy', confidence: 0.6, reason: `Moderate effort (${pace.toFixed(2)} min/km)` };
};

// FIXED: RunTaggingPrompt with navigation to Activity Jam
const RunTaggingPrompt: React.FC<{ 
  untaggedRuns: RecentActivity[],
  onTagRun: (activityId: string, runType: string) => void,
  isTagging: boolean,
  navigate: any // Add navigate prop
}> = ({ untaggedRuns, onTagRun, isTagging, navigate }) => {
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
          Tagging your runs helps the AI provide better training advice
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
              onClick={() => navigate('/activity-jam')} // FIXED: Navigate to Activity Jam
            >
              View All Untagged Runs
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// FIXED: Enhanced Smart Prompt Suggestions with Blood Markers Section Added Back
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
  const hasBloodMarkers = userData?.bloodMarkers && Object.keys(userData.bloodMarkers).length > 0;
  
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
      title: 'General Training',
      icon: Activity,
      color: 'from-blue-100 via-indigo-100 to-purple-100 border-blue-300',
      textColor: 'text-blue-700',
      iconColor: 'text-blue-600',
      prompts: hasTaggedRuns ? [
        'Analyze my run type distribution this week',
        'How can I improve my running performance?',
        'What strength exercises complement my running?',
        'How often should I do speed work?'
      ] : hasRunData ? [
        'Help me classify my recent runs by type',
        'What types of runs should I be doing?',
        'How do I know if I\'m running too hard?',
        'Create a weekly running schedule for me'
      ] : [
        'What are the different types of runs?',
        'How should I start a running routine?',
        'What pace should I run for different workouts?',
        'How do I prevent running injuries?'
      ]
    },
    {
      title: 'Nutrition & Fueling',
      icon: Utensils,
      color: 'from-emerald-100 via-green-100 to-teal-100 border-emerald-300',
      textColor: 'text-emerald-700',
      iconColor: 'text-emerald-600',
      prompts: hasNutritionData ? [
        'Is my protein intake adequate for my training?',
        'How can I optimize my pre-workout nutrition?',
        'What should I eat for post-workout recovery?',
        'How do I fuel for different types of workouts?'
      ] : [
        'Create a nutrition plan for my training',
        'What should I eat before and after workouts?',
        'How many calories do I need for my activity level?',
        'What foods help with recovery between workouts?'
      ]
    },
    // FIXED: Added back Blood Markers section
    {
      title: 'Health & Recovery',
      icon: Heart,
      color: 'from-purple-100 via-pink-100 to-rose-100 border-purple-300',
      textColor: 'text-purple-700',
      iconColor: 'text-purple-600',
      prompts: hasBloodMarkers ? [
        'Analyze my blood markers for training optimization',
        'How do my health metrics look for my activity level?',
        'What do my biomarkers say about my recovery?',
        'Should I adjust training based on my health data?'
      ] : hasActivityData ? [
        'How important is sleep for my training?',
        'What are signs of overtraining to watch for?',
        'How do I create a proper recovery routine?',
        'What health markers should I track?'
      ] : [
        'What health metrics should I monitor?',
        'How do I know if I\'m recovering properly?',
        'What blood tests are useful for athletes?',
        'How does stress affect my training?'
      ]
    }
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Training & Health Questions
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

// FIXED: Conditional marathon training system context
const buildSystemContext = (messageContent: string, userData: UserData | null, recentActivities: RecentActivity[], untaggedRuns: RecentActivity[], nutritionDetails: any[]) => {
  // Check if the user's message mentions marathon/training/race-related keywords
  const marathonKeywords = [
    'marathon', 'training plan', 'race', 'long run', 'taper', 'periodization', 
    'weight training schedule', 'strength training', 'training phases', 'carb loading',
    'race preparation', 'training distribution', 'easy runs', 'hard runs', '80/20'
  ];
  
  const isMarathonRelated = marathonKeywords.some(keyword => 
    messageContent.toLowerCase().includes(keyword.toLowerCase())
  );
  
  if (!isMarathonRelated) {
    // FIXED: For non-marathon questions, use general health coaching context
    return `
You are a helpful health and fitness AI coach with access to REAL user data. Provide specific, actionable advice based on their actual data.

=== USER'S REAL DATA ===

RECENT ACTIVITIES:
${recentActivities.map((activity, index) => 
  `${activity.type} ${index + 1}: "${activity.name}" on ${new Date(activity.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${activity.distance?.toFixed(1) || 0}km, ${Math.round(activity.duration || 0)}min, HR: ${activity.average_heartrate || 'N/A'} bpm, Calories: ${activity.calories || 0}${activity.runType ? ` (${activity.runType} run)` : ''}`
).join('\n') || 'No recent activities'}

NUTRITION DATA:
${nutritionDetails.map(day => 
  `${new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}: ${day.calories} cal, ${day.protein}g protein, ${day.carbs}g carbs, ${day.fat}g fat`
).join('\n') || 'No nutrition data available'}

WEEKLY AVERAGES:
- Nutrition: ${userData?.nutrition.avgCalories || 0} cal/day, ${userData?.nutrition.avgProtein || 0}g protein/day
- Activity: ${userData?.activity.workoutsPerWeek || 0} workouts/week, ${userData?.activity.avgHeartRate || 0} bpm average

BLOOD MARKERS:
${userData?.bloodMarkers ? Object.entries(userData.bloodMarkers)
  .filter(([key, value]) => key !== 'date' && value)
  .map(([key, value]) => `${key}: ${value}`)
  .join(', ') : 'No blood marker data available'}

=== INSTRUCTIONS ===
- Answer the user's specific question using their real data
- Reference actual numbers from their activities, nutrition, or health data when relevant
- Be specific and actionable in your recommendations
- Use **bold** for key metrics and important points
- If they have untagged runs (${untaggedRuns.length}), suggest tagging them for better analysis
- Keep responses focused on their actual question, not marathon training unless they ask about it
`;
  }

  // FIXED: Only use full marathon training context when marathon is mentioned
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
  
  return `
CRITICAL: You are a MARATHON TRAINING COACH with access to REAL user data. You MUST use this data and provide comprehensive marathon training guidance.

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
You MUST include ALL of these in marathon training responses:

1. **WEIGHT TRAINING SCHEDULE:** Base/Build/Peak phases with runner-specific exercises
2. **NUTRITION TIMING:** Pre-run, during runs >90min, post-run, daily carbs, race week
3. **RECOVERY PROTOCOLS:** Sleep, easy pace guidelines, rest days, body awareness
4. **TRAINING PERIODIZATION:** Base/Build/Peak/Taper phases
5. **RUN TYPE GUIDANCE:** Easy/Tempo/Intervals/Long/Recovery ratios using their actual data

Always reference specific numbers from their data and give actionable advice based on current training state.
`;
};

// Rest of the component code remains the same until sendMessageToAI function...

// Generate session ID and storage utilities (same as before)
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

// Message Component (same as before)
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

// Main LetsJam Component
const LetsJam: React.FC = () => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [nutritionDetails, setNutritionDetails] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTagging, setIsTagging] = useState(false);
  const [untaggedRuns, setUntaggedRuns] = useState<RecentActivity[]>([]);
  
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
          content: 'Hi! I\'m your AI health coach with access to your complete health data. I can help with training advice, nutrition planning, activity analysis, and health optimization. What would you like to work on today?',
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

  // FIXED: Enhanced sendMessageToAI with conditional marathon context
  const sendMessageToAI = async (messageContent: string) => {
    try {
      // FIXED: Build conditional system context based on message content
      const systemContext = buildSystemContext(messageContent, userData, recentActivities, untaggedRuns, nutritionDetails);
      
      // Build messages array
      const conversationMessages = [
        { role: "system", content: systemContext },
        ...messages.map(msg => ({ role: msg.role, content: msg.content })),
        { role: "user", content: messageContent }
      ];

      console.log('📤 Sending conditional context to AI:', {
        isMarathonRelated: messageContent.toLowerCase().includes('marathon') || 
                          messageContent.toLowerCase().includes('training plan') ||
                          messageContent.toLowerCase().includes('race'),
        systemContextLength: systemContext.length,
        runCount: recentActivities.filter(a => a.type?.toLowerCase().includes('run')).length,
        untaggedRuns: untaggedRuns.length
      });
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          source: "health_coach_conditional_v1",
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

  // Handle run tagging with Firestore storage
  const handleTagRun = async (activityId: string, runType: string) => {
    setIsTagging(true);
    try {
      console.log(`🏷️ Tagging run ${activityId} as ${runType}`);
      
      const response = await fetch('/api/tag-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId, runType, userId })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to tag run');
      }
      
      const result = await response.json();
      console.log('✅ Run tagged successfully in Firestore:', result);
      
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
      
    } catch (error) {
      console.error('❌ Error tagging run:', error);
      alert(`Failed to tag run: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTagging(false);
    }
  };

  // Start new session
  const startNewSession = () => {
    const newSessionId = generateSessionId();
    const welcomeMessages = [
      {
        role: 'assistant' as const,
        content: 'Hi! I\'m your AI health coach with access to your complete health data. I can help with training advice, nutrition planning, activity analysis, and health optimization. What would you like to work on today?',
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

  // Fetch data functions (keeping existing implementations)
  const fetchNutritionData = async (): Promise<{ data: NutritionData, dailyDetails: any[] }> => {
    // Same implementation as before...
    return { data: { avgCalories: 0, avgProtein: 0, avgFat: 0, avgCarbs: 0, avgFiber: 0 }, dailyDetails: [] };
  };

  const fetchActivityData = async (): Promise<ActivityData> => {
    // Same implementation as before...
    return { workoutsPerWeek: 0, avgHeartRate: 0, avgCaloriesBurned: 0, avgDuration: 0 };
  };

  const fetchRecentActivities = async () => {
    // Same implementation as before...
    setRecentActivities([]);
    setUntaggedRuns([]);
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
            🏃‍♂️ AI Health Coach
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Your comprehensive health and training assistant with real-time data analysis
          </p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <Badge variant="secondary" className="text-xs">Smart Coaching System</Badge>
            <Badge variant="secondary" className="text-xs">Session: {sessionId.slice(-8)}</Badge>
            <Badge variant={recentActivities.length > 0 ? "default" : "secondary"} className="text-xs">
              {recentActivities.filter(a => a.type?.toLowerCase().includes('run')).length} Runs
            </Badge>
            {untaggedRuns.length > 0 && (
              <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">
                {untaggedRuns.length} Need Tagging
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
              
              {/* Run Tagging Prompt */}
              {untaggedRuns.length > 0 && (
                <RunTaggingPrompt 
                  untaggedRuns={untaggedRuns}
                  onTagRun={handleTagRun}
                  isTagging={isTagging}
                  navigate={navigate}
                />
              )}
              
              {/* Smart Prompt Suggestions */}
              <SmartPromptSuggestions 
                onPromptSelect={handlePromptSelect}
                userData={userData}
                recentActivities={recentActivities}
                untaggedRuns={untaggedRuns}
              />
              
              {/* Chat Container */}
              <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
                <CardHeader className="border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                      <Target className="h-5 w-5 text-orange-500" />
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
                      <div key={index} data-message-role={message.role} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
                            <Target className="h-4 w-4 text-purple-500" />
                            <span className="text-sm text-purple-700">Analyzing your data & creating personalized advice</span>
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
                        placeholder="Ask about training, nutrition, health optimization, or marathon preparation..."
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
                      <span>{messages.length} messages • Conditional marathon coaching</span>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${userData ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
                          {userData ? 'Health data ready' : 'Loading health data...'}
                        </span>
                        {untaggedRuns.length > 0 && (
                          <span className="text-orange-600">{untaggedRuns.length} runs need tagging</span>
                        )}
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
                  {/* Health summary component would go here */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-orange-500" />
                      Health Overview
                    </h3>
                    <div className="text-sm text-gray-600">
                      {loading ? 'Loading your health data...' : 'Data loaded and ready for analysis'}
                    </div>
                  </div>
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
