import React, { useState, useEffect, useRef } from 'react';
import { 
  Heart, 
  Activity, 
  Utensils, 
  Send, 
  Bot, 
  User, 
  Settings, 
  MessageCircle,
  X,
  Target,
  Zap,
  Calendar,
  RefreshCw,
  Mail,
  BarChart2,
  MessageSquare,
  Info
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast, Toaster } from 'sonner';
import { db } from '@/lib/firebaseConfig';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc, addDoc } from 'firebase/firestore';

// Types
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

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface UserData {
  nutrition: {
    avgCalories: number;
    avgProtein: number;
    avgFat: number;
    avgCarbs: number;
    avgFiber: number;
  };
  activity: {
    workoutsPerWeek: number;
    avgHeartRate: number;
    avgCaloriesBurned: number;
    avgDuration: number;
  };
  bloodMarkers: Record<string, any>;
}

interface EmailSignup {
  email: string;
  timestamp: string;
  source: string;
}

interface UserFeedback {
  email?: string;
  message: string;
  type: 'suggestion' | 'feature_request' | 'feedback';
  timestamp: string;
}

// Header Component - ActivityJam style
const Header = () => (
  <header className="h-16 bg-gradient-to-r from-orange-600 via-red-600 to-pink-600 flex items-center justify-between px-6 sticky top-0 z-50">
    <div className="flex items-center space-x-4">
      <div className="text-2xl font-black text-white">
        🧬 my23.ai
      </div>
    </div>
    <div className="flex items-center space-x-3">
      <button className="p-2 hover:bg-white/20 rounded-full">
        <Settings className="h-4 w-4 text-white" />
      </button>
      <button className="p-2 hover:bg-white/20 rounded-full">
        <User className="h-4 w-4 text-white" />
      </button>
    </div>
  </header>
);

// Beautiful Day Widget Component
const DayWidget = ({ 
  data, 
  date, 
  isToday, 
  onClick 
}: {
  data: HealthData;
  date: string;
  isToday: boolean;
  onClick: () => void;
}) => {
  const hasData = data && (data.caloriesConsumed > 0 || data.caloriesBurned > 0);
  
  const calculateHealthScore = () => {
    if (!hasData) return 0;
    
    const BMR = 1479;
    const calorieDeficit = data.caloriesBurned + BMR - data.caloriesConsumed;
    
    let score = 0;
    const burnedScore = Math.min(40, (data.caloriesBurned / 300) * 40);
    const proteinScore = Math.min(30, (data.protein / 140) * 30);
    
    const deficitScore = (() => {
      if (calorieDeficit <= 0) return 0;
      if (calorieDeficit >= 500) return 30;
      if (calorieDeficit >= 400) return 25;
      if (calorieDeficit >= 300) return 20;
      if (calorieDeficit >= 200) return 15;
      if (calorieDeficit >= 100) return 10;
      return 5;
    })();
    
    score = burnedScore + proteinScore + deficitScore;
    return Math.min(Math.round(score), 100);
  };

  const healthScore = calculateHealthScore();
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'from-green-400 to-emerald-500';
    if (score >= 60) return 'from-yellow-400 to-amber-500';
    return 'from-red-400 to-pink-500';
  };

  return (
    <div 
      onClick={onClick}
      className={`group cursor-pointer transform transition-all duration-300 hover:scale-105 ${
        isToday ? 'scale-105' : ''
      }`}
    >
      <Card className={`bg-white/90 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 ${
        isToday ? 'ring-2 ring-orange-400 ring-offset-2' : ''
      }`}>
        <CardContent className="p-4">
          <div className="text-center space-y-3">
            {/* Date */}
            <div className="text-xs font-medium text-gray-500">
              {new Date(date).toLocaleDateString('en-US', { 
                weekday: 'short',
                day: 'numeric'
              })}
            </div>
            
            {/* Today Badge */}
            {isToday && (
              <div className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full font-medium">
                Today
              </div>
            )}

            {hasData ? (
              <>
                {/* Health Score Circle */}
                <div className="relative mx-auto w-16 h-16">
                  <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${getScoreColor(healthScore)} opacity-20`}></div>
                  <div className={`absolute inset-1 rounded-full bg-gradient-to-br ${getScoreColor(healthScore)} flex items-center justify-center`}>
                    <span className="text-white font-bold text-sm">{healthScore}%</span>
                  </div>
                  {healthScore >= 80 && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                      <span className="text-xs">🏆</span>
                    </div>
                  )}
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-orange-50 rounded-lg p-2">
                    <div className="font-semibold text-orange-600">{Math.round(data.caloriesBurned)}</div>
                    <div className="text-gray-500">burned</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-2">
                    <div className="font-semibold text-blue-600">{Math.round(data.protein)}g</div>
                    <div className="text-gray-500">protein</div>
                  </div>
                </div>

                {/* Activity Indicators */}
                {data.activityTypes.length > 0 && (
                  <div className="flex justify-center space-x-1">
                    {data.activityTypes.slice(0, 3).map((_, index) => (
                      <div key={index} className="w-2 h-2 bg-gradient-to-r from-orange-400 to-red-400 rounded-full"></div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-orange-50 transition-colors">
                  <Heart className="h-6 w-6 text-gray-400 group-hover:text-orange-400 transition-colors" />
                </div>
                <div className="text-xs text-gray-400 mt-2">Rest day</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Seven Day Strip Component
const SevenDayStrip = ({ 
  last7DaysData, 
  selectedDay, 
  setSelectedDay, 
  showDetailDrawer, 
  setShowDetailDrawer 
}: {
  last7DaysData: Record<string, HealthData>;
  selectedDay: string | null;
  setSelectedDay: (day: string | null) => void;
  showDetailDrawer: boolean;
  setShowDetailDrawer: (show: boolean) => void;
}) => {
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date.toISOString().split('T')[0];
  });

  const handleDayClick = (date: string) => {
    if (selectedDay === date && showDetailDrawer) {
      setShowDetailDrawer(false);
      setSelectedDay(null);
    } else {
      setSelectedDay(date);
      setShowDetailDrawer(true);
    }
  };

  const calculateHealthScore = (data: HealthData) => {
    if (!data || (data.caloriesConsumed === 0 && data.caloriesBurned === 0)) return 0;
    
    const BMR = 1479;
    const calorieDeficit = data.caloriesBurned + BMR - data.caloriesConsumed;
    
    let score = 0;
    const burnedScore = Math.min(40, (data.caloriesBurned / 300) * 40);
    const proteinScore = Math.min(30, (data.protein / 140) * 30);
    
    const deficitScore = (() => {
      if (calorieDeficit <= 0) return 0;
      if (calorieDeficit >= 500) return 30;
      if (calorieDeficit >= 400) return 25;
      if (calorieDeficit >= 300) return 20;
      if (calorieDeficit >= 200) return 15;
      if (calorieDeficit >= 100) return 10;
      return 5;
    })();
    
    score = burnedScore + proteinScore + deficitScore;
    return Math.min(Math.round(score), 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Last 7 Days</h3>
        <div className="text-sm text-gray-500">Click for details</div>
      </div>
      
      <div className="grid grid-cols-7 gap-3">
        {last7Days.map((date) => {
          const data = last7DaysData[date] || {
            date,
            heartRate: null,
            caloriesBurned: 0,
            caloriesConsumed: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            fiber: 0,
            workoutDuration: 0,
            activityTypes: []
          };
          
          const isToday = date === new Date().toISOString().split('T')[0];
          
          return (
            <DayWidget
              key={date}
              data={data}
              date={date}
              isToday={isToday}
              onClick={() => handleDayClick(date)}
            />
          );
        })}
      </div>

      {/* Detail Drawer */}
      {showDetailDrawer && selectedDay && last7DaysData[selectedDay] && (
        <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-orange-200 animate-slide-down">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-800 text-lg">
                {new Date(selectedDay).toLocaleDateString('en-US', { 
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric'
                })}
              </h4>
              <button 
                onClick={() => setShowDetailDrawer(false)}
                className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-white/50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/60 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {Math.round(last7DaysData[selectedDay].caloriesConsumed)}
                </div>
                <div className="text-sm text-gray-600">Calories In</div>
              </div>
              
              <div className="bg-white/60 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {Math.round(last7DaysData[selectedDay].caloriesBurned)}
                </div>
                <div className="text-sm text-gray-600">Calories Out</div>
              </div>
              
              <div className="bg-white/60 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {Math.round(last7DaysData[selectedDay].protein)}g
                </div>
                <div className="text-sm text-gray-600">Protein</div>
              </div>
              
              <div className="bg-white/60 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {calculateHealthScore(last7DaysData[selectedDay])}%
                </div>
                <div className="text-sm text-gray-600">Health Score</div>
              </div>
            </div>
            
            {last7DaysData[selectedDay].activityTypes.length > 0 && (
              <div className="mt-4">
                <div className="text-sm font-medium text-gray-700 mb-2">Activities:</div>
                <div className="flex flex-wrap gap-2">
                  {last7DaysData[selectedDay].activityTypes.map((activity, index) => (
                    <span 
                      key={index}
                      className="text-xs bg-orange-100 text-orange-700 px-3 py-1 rounded-full"
                    >
                      {activity}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Today's Health Card Component
const TodayHealthCard = ({ todayData }: { todayData: HealthData | null }) => {
  if (!todayData || (todayData.caloriesConsumed === 0 && todayData.caloriesBurned === 0)) {
    return (
      <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-lg">
        <CardContent className="p-8">
          <div className="text-center py-8">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-orange-100 to-red-100 flex items-center justify-center mb-4">
              <Heart className="h-10 w-10 text-orange-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Ready to start your day?</h3>
            <p className="text-gray-500">Log your first meal or workout to see your health score</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const BMR = 1479;
  const calorieDeficit = todayData.caloriesBurned + BMR - todayData.caloriesConsumed;
  
  const calculateHealthScore = () => {
    let score = 0;
    const burnedScore = Math.min(40, (todayData.caloriesBurned / 300) * 40);
    const proteinScore = Math.min(30, (todayData.protein / 140) * 30);
    
    const deficitScore = (() => {
      if (calorieDeficit <= 0) return 0;
      if (calorieDeficit >= 500) return 30;
      if (calorieDeficit >= 400) return 25;
      if (calorieDeficit >= 300) return 20;
      if (calorieDeficit >= 200) return 15;
      if (calorieDeficit >= 100) return 10;
      return 5;
    })();
    
    score = burnedScore + proteinScore + deficitScore;
    return Math.min(Math.round(score), 100);
  };

  const healthScore = calculateHealthScore();
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getGradientColor = (score: number) => {
    if (score >= 80) return 'from-green-400 to-emerald-500';
    if (score >= 60) return 'from-yellow-400 to-amber-500';
    return 'from-red-400 to-pink-500';
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-0 shadow-lg">
        <CardContent className="p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-gray-800">Today's Health</h3>
            <Calendar className="h-6 w-6 text-orange-500" />
          </div>
          
          {/* Health Score Circle */}
          <div className="flex items-center justify-center mb-8">
            <div className="relative w-32 h-32">
              <div className="absolute inset-0 rounded-full bg-gray-200"></div>
              <div 
                className={`absolute inset-0 rounded-full bg-gradient-to-br ${getGradientColor(healthScore)}`}
                style={{
                  background: `conic-gradient(from 0deg, ${
                    healthScore >= 80 ? '#10b981' : healthScore >= 60 ? '#f59e0b' : '#ef4444'
                  } ${healthScore * 3.6}deg, #e5e7eb ${healthScore * 3.6}deg)`
                }}
              ></div>
              <div className="absolute inset-4 rounded-full bg-white flex items-center justify-center">
                <div className="text-center">
                  <div className={`text-3xl font-bold ${getScoreColor(healthScore)}`}>
                    {healthScore}%
                  </div>
                  <div className="text-xs text-gray-500">health</div>
                </div>
              </div>
              {healthScore >= 80 && (
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center">
                  <span className="text-sm">🏆</span>
                </div>
              )}
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center bg-white/80 rounded-xl p-4 shadow-sm">
              <div className="text-3xl font-bold text-green-600 mb-1">
                {Math.round(todayData.caloriesConsumed)}
              </div>
              <div className="text-sm text-gray-600">Calories In</div>
            </div>
            
            <div className="text-center bg-white/80 rounded-xl p-4 shadow-sm">
              <div className="text-3xl font-bold text-orange-600 mb-1">
                {Math.round(todayData.caloriesBurned)}
              </div>
              <div className="text-sm text-gray-600">Calories Out</div>
            </div>
            
            <div className="text-center bg-white/80 rounded-xl p-4 shadow-sm">
              <div className="text-3xl font-bold text-blue-600 mb-1">
                {Math.round(todayData.protein)}g
              </div>
              <div className="text-sm text-gray-600">Protein</div>
            </div>
            
            <div className="text-center bg-white/80 rounded-xl p-4 shadow-sm">
              <div className={`text-3xl font-bold mb-1 ${calorieDeficit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {calorieDeficit >= 0 ? '+' : ''}{Math.round(calorieDeficit)}
              </div>
              <div className="text-sm text-gray-600">Cal Deficit</div>
            </div>
          </div>

          {/* Activity Types */}
          {todayData.activityTypes.length > 0 && (
            <div className="text-center">
              <div className="text-sm font-medium text-gray-700 mb-3">Today's Activities</div>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {todayData.activityTypes.map((activity, index) => (
                  <span 
                    key={index}
                    className="text-sm bg-orange-100 text-orange-700 px-4 py-2 rounded-full font-medium"
                  >
                    {activity}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Health Score Explanation */}
      <Card className="bg-orange-50 border-orange-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
            <Info className="h-5 w-5 mr-2 text-orange-600" />
            Health Score Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/60 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">🔥 Calories Burned</span>
                <span className="text-lg font-bold text-orange-600">
                  {Math.round(Math.min(40, (todayData.caloriesBurned / 300) * 40))} pts
                </span>
              </div>
              <div className="text-xs text-gray-500">
                Target: 300+ calories = 40 pts<br/>
                Current: {todayData.caloriesBurned} calories
              </div>
            </div>
            
            <div className="bg-white/60 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">🥩 Protein Intake</span>
                <span className="text-lg font-bold text-blue-600">
                  {Math.round(Math.min(30, (todayData.protein / 140) * 30))} pts
                </span>
              </div>
              <div className="text-xs text-gray-500">
                Target: 140g+ protein = 30 pts<br/>
                Current: {Math.round(todayData.protein)}g
              </div>
            </div>
            
            <div className="bg-white/60 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">📉 Calorie Deficit</span>
                <span className="text-lg font-bold text-green-600">
                  {(() => {
                    if (calorieDeficit <= 0) return 0;
                    if (calorieDeficit >= 500) return 30;
                    if (calorieDeficit >= 400) return 25;
                    if (calorieDeficit >= 300) return 20;
                    if (calorieDeficit >= 200) return 15;
                    if (calorieDeficit >= 100) return 10;
                    return 5;
                  })()} pts
                </span>
              </div>
              <div className="text-xs text-gray-500">
                Current deficit: {calorieDeficit >= 0 ? '+' : ''}{Math.round(calorieDeficit)} calories
              </div>
            </div>
          </div>
          
          <div className="bg-white/60 rounded-lg p-4 text-center">
            <div className="text-lg font-bold text-gray-800">
              Total Health Score: <span className="text-orange-600">{healthScore}%</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Quick Actions Component
const QuickActions = () => (
  <div className="space-y-4">
    <h3 className="text-lg font-semibold text-gray-800">Quick Actions</h3>
    <div className="grid grid-cols-2 gap-4">
      <Button 
        onClick={() => window.location.href = '/nutrition-jam'} 
        className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
      >
        <Utensils className="h-5 w-5 mr-2" />
        Log Food
      </Button>
      
      <Button 
        onClick={() => window.location.href = '/activity-jam'} 
        className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
      >
        <Activity className="h-5 w-5 mr-2" />
        Log Workout
      </Button>
    </div>
  </div>
);

// Chat Panel Component with EXACT LetsJam data structure
const ChatPanel = ({ 
  userData, 
  last7DaysData 
}: { 
  userData: UserData | null;
  last7DaysData: Record<string, HealthData>;
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hi Mihir! I can see your health data is ready. How can I help you optimize your health today?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const messageToSend = input.trim();
    if (!messageToSend) return;
    
    try {
      setSending(true);
      
      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: messageToSend,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, userMessage]);
      setInput("");
      
      // Structure user data for API (EXACTLY same as LetsJam)
      const structuredUserData = {
        nutrition: {
          type: "nutrition_averages_7_days",
          avgCaloriesPerDay: userData?.nutrition?.avgCalories || 0,
          avgProteinPerDay: userData?.nutrition?.avgProtein || 0,
          avgCarbsPerDay: userData?.nutrition?.avgCarbs || 0,
          avgFatPerDay: userData?.nutrition?.avgFat || 0,
          avgFiberPerDay: userData?.nutrition?.avgFiber || 0
        },
        
        activity: {
          type: "activity_averages_7_days", 
          workoutsPerWeek: userData?.activity?.workoutsPerWeek || 0,
          avgHeartRatePerWorkout: userData?.activity?.avgHeartRate || 0,
          avgCaloriesBurnedPerWorkout: userData?.activity?.avgCaloriesBurned || 0,
          avgWorkoutDurationMinutes: userData?.activity?.avgDuration || 0
        },
        
        bloodMarkers: {
          type: "latest_blood_test_results",
          testDate: userData?.bloodMarkers?.date || "unknown",
          values: {
            cholesterol: {
              total: userData?.bloodMarkers?.total_cholesterol || "not available",
              ldl: userData?.bloodMarkers?.ldl || "not available", 
              hdl: userData?.bloodMarkers?.hdl || "not available"
            },
            metabolic: {
              glucose: userData?.bloodMarkers?.glucose || "not available",
              hba1c: userData?.bloodMarkers?.hba1c || "not available"
            },
            minerals: {
              calcium: userData?.bloodMarkers?.calcium || "not available",
              sodium: userData?.bloodMarkers?.sodium || "not available", 
              potassium: userData?.bloodMarkers?.potassium || "not available"
            },
            kidneyFunction: {
              creatinine: userData?.bloodMarkers?.creatinine || "not available"
            },
            bloodCells: {
              hemoglobin: userData?.bloodMarkers?.hemoglobin || "not available",
              rbc: userData?.bloodMarkers?.rbc || "not available",
              plateletCount: userData?.bloodMarkers?.platelet_count || "not available"
            },
            hormones: {
              tsh: userData?.bloodMarkers?.tsh || "not available"
            }
          }
        },
        
        // Add 7-day data summary for context (SAME as LetsJam) - THIS WAS MISSING!
        last7DaysData: {
          type: "daily_health_data_7_days",
          summary: Object.entries(last7DaysData).map(([date, data]) => ({
            date,
            caloriesIn: data.caloriesConsumed,
            caloriesOut: data.caloriesBurned,
            protein: data.protein,
            activityTypes: data.activityTypes,
            heartRate: data.heartRate
          }))
        }
      };
      
      console.log('📤 Sending structured data to API:', structuredUserData);
      
      // Build messages array with conversation history
      const conversationMessages = [
        ...messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        { role: "user", content: messageToSend }
      ];
      
      // Call chat API (EXACTLY same as LetsJam)
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: "mihir_jain",
          source: "split-screen-dashboard",
          userData: structuredUserData,
          messages: conversationMessages
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Chat API error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      const assistantResponse = data.choices[0].message.content;
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: assistantResponse,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
    } catch (error) {
      console.error("Error sending message:", error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error processing your request. Please try again later.",
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const quickPrompts = [
    "How's my nutrition this week?",
    "Analyze my workout patterns",
    "What's my calorie deficit trend?",
    "Give me health recommendations"
  ];

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
    setTimeout(() => {
      sendMessage();
    }, 100);
  };

  return (
    <Card className="h-full flex flex-col bg-white/90 backdrop-blur-sm border-0 shadow-lg">
      <CardHeader className="pb-4 border-b border-orange-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-400 rounded-full flex items-center justify-center">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold text-gray-800">AI Health Assistant</CardTitle>
            <p className="text-sm text-gray-500">Powered by your real health data</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-6">
        {/* Quick Prompts */}
        {messages.length <= 1 && (
          <div className="grid grid-cols-1 gap-3 mb-6">
            {quickPrompts.map((prompt, index) => (
              <button
                key={index}
                onClick={() => handleQuickPrompt(prompt)}
                className="text-sm p-4 bg-gradient-to-r from-orange-50 to-red-50 hover:from-orange-100 hover:to-red-100 border border-orange-200 rounded-xl text-orange-700 transition-all duration-200 text-left font-medium shadow-sm hover:shadow-md"
              >
                "{prompt}"
              </button>
            ))}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  message.role === "user"
                    ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg"
                    : "bg-white text-gray-800 border border-gray-200 shadow-md"
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                <p
                  className={`text-xs mt-2 ${
                    message.role === "user" ? "text-orange-100" : "text-gray-500"
                  }`}
                >
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}
          
          {sending && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 p-4 rounded-2xl shadow-md">
                <div className="flex gap-2 items-center">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce delay-100"></div>
                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce delay-200"></div>
                  </div>
                  <span className="text-sm text-gray-500">AI is thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex gap-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your health..."
            disabled={sending}
            className="flex-1 border-orange-200 focus:border-orange-400 focus:ring-orange-400 rounded-xl py-3 px-4"
          />
          <Button 
            type="submit" 
            disabled={sending || !input.trim()}
            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

// Email Signup Component
const EmailAndFeedbackCard: React.FC = () => {
  const [email, setEmail] = useState('');
  const [feedback, setFeedback] = useState('');
  const [type, setType] = useState<'suggestion' | 'feature_request' | 'feedback'>('suggestion');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFeedbackFields, setShowFeedbackFields] = useState(false);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    
    const signupData: EmailSignup = {
      email,
      timestamp: new Date().toISOString(),
      source: 'homepage_signup'
    };

    addDoc(collection(db, 'email_signups'), signupData)
      .then(() => {
        if (feedback.trim()) {
          const feedbackData: UserFeedback = {
            email,
            message: feedback.trim(),
            type,
            timestamp: new Date().toISOString()
          };
          return addDoc(collection(db, 'user_feedback'), feedbackData);
        }
        return Promise.resolve();
      })
      .then(() => {
        toast.success('🎉 Thanks for signing up! We\'ll keep you updated.');
        setEmail('');
        setFeedback('');
        setShowFeedbackFields(false);
      })
      .catch((error) => {
        console.error('Error saving data:', error);
        toast.error('Failed to submit. Please try again.');
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  return (
    <Card className="bg-gradient-to-br from-orange-100 to-red-100 border-orange-200 shadow-lg">
      <CardHeader className="text-center pb-4">
        <div className="mx-auto w-12 h-12 bg-gradient-to-br from-orange-400 to-red-400 rounded-full flex items-center justify-center mb-3">
          <Mail className="h-6 w-6 text-white" />
        </div>
        <CardTitle className="text-lg font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
          📬 Stay Updated
        </CardTitle>
        <p className="text-sm text-gray-600">
          Get notified about new features & share your ideas
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleEmailSubmit} className="space-y-3">
          <Input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border-orange-200 focus:border-orange-400 focus:ring-orange-400 text-sm"
            disabled={isSubmitting}
            required
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFeedbackFields(!showFeedbackFields)}
              className="text-sm text-orange-600 hover:text-orange-700 font-medium"
            >
              {showFeedbackFields ? '📬 Just email signup' : '💭 + Add feedback/suggestions'}
            </button>
          </div>

          {showFeedbackFields && (
            <div className="space-y-3 border-t border-orange-200 pt-3">
              <div className="flex gap-1">
                {[
                  { value: 'suggestion', label: 'Idea', icon: '💡' },
                  { value: 'feature_request', label: 'Feature', icon: '✨' },
                  { value: 'feedback', label: 'Feedback', icon: '💬' }
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setType(option.value as any)}
                    className={'flex-1 px-2 py-1 rounded text-xs font-medium transition-all duration-200 ' + (
                      type === option.value
                        ? 'bg-orange-200 text-orange-700 border border-orange-300'
                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                    )}
                  >
                    {option.icon} {option.label}
                  </button>
                ))}
              </div>
              
              <Textarea
                placeholder="What would you like to see in My23.ai?"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                className="rounded-lg border-orange-200 focus:border-orange-400 focus:ring-orange-400 resize-none text-sm"
                disabled={isSubmitting}
              />
            </div>
          )}

          <Button
            type="submit"
            disabled={isSubmitting || !email}
            className="w-full bg-gradient-to-r from-orange-400 to-red-400 hover:from-orange-500 hover:to-red-500 text-white py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 text-sm"
          >
            {isSubmitting ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <React.Fragment>
                <Send className="h-4 w-4" />
                {showFeedbackFields && feedback.trim() ? 'Subscribe + Send Feedback' : 'Subscribe'}
              </React.Fragment>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

// Mobile Chat Toggle Button
const MobileChatButton = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    className="fixed bottom-6 right-6 lg:hidden bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white p-4 rounded-full shadow-lg z-40 transform hover:scale-110 transition-all duration-200"
  >
    <MessageCircle className="h-6 w-6" />
  </button>
);

// Main Index Component
const Index = () => {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [last7DaysData, setLast7DaysData] = useState<Record<string, HealthData>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const userId = "mihir_jain";

  // Fetch combined health data for last 7 days (from LetsJam)
  const fetchLast7DaysData = async () => {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const dateString = sevenDaysAgo.toISOString().split('T')[0];

      const tempData: Record<string, HealthData> = {};
      
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        tempData[dateStr] = {
          date: dateStr,
          heartRate: null,
          caloriesBurned: 0,
          caloriesConsumed: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
          workoutDuration: 0,
          activityTypes: []
        };
      }

      // Fetch nutrition data
      const nutritionSnapshot = await getDocs(query(
        collection(db, "nutritionLogs"),
        where("date", ">=", dateString),
        orderBy("date", "desc")
      )).catch(() => ({ docs: [] }));

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

      // Fetch Strava data from Firestore
      const stravaSnapshot = await getDocs(query(
        collection(db, "strava_data"),
        where("userId", "==", userId),
        orderBy("start_date", "desc"),
        limit(20)
      )).catch(() => ({ docs: [] }));

      stravaSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const activityDate = data.date || (data.start_date ? data.start_date.substring(0, 10) : undefined);
        
        if (!activityDate || !tempData[activityDate]) return;

        if (data.heart_rate != null) {
          const curHR = tempData[activityDate].heartRate || 0;
          const cnt = tempData[activityDate].activityTypes.length;
          tempData[activityDate].heartRate = cnt === 0 ? data.heart_rate : ((curHR * cnt) + data.heart_rate) / (cnt + 1);
        }

        const activityCalories = data.calories || data.activity?.calories || data.kilojoules_to_calories || 0;
        tempData[activityDate].caloriesBurned += activityCalories;
        tempData[activityDate].workoutDuration += data.duration || 0;

        if (data.type && !tempData[activityDate].activityTypes.includes(data.type)) {
          tempData[activityDate].activityTypes.push(data.type);
        }
      });

      setLast7DaysData(tempData);
    } catch (error) {
      console.error("Error fetching 7-day data:", error);
    }
  };

  // Fetch user data from Firebase (from LetsJam)
  const fetchUserData = async () => {
    try {
      const [nutritionData, activityData, bloodMarkers] = await Promise.all([
        fetchNutritionData(),
        fetchActivityData(),
        fetchBloodMarkers()
      ]);

      await fetchLast7DaysData();
      
      const newUserData = {
        nutrition: nutritionData,
        activity: activityData,
        bloodMarkers: bloodMarkers
      };

      setUserData(newUserData);
      console.log('📊 User data loaded:', newUserData);
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch nutrition data from Firebase (from LetsJam)
  const fetchNutritionData = async () => {
    try {
      const today = new Date();
      const dates = [];
      
      for (let i = 0; i < 7; i++) {
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
        avgCalories,
        avgProtein,
        avgFat,
        avgCarbs,
        avgFiber
      };
    } catch (error) {
      console.error("Error fetching nutrition data:", error);
      return {
        avgCalories: 0,
        avgProtein: 0,
        avgFat: 0,
        avgCarbs: 0,
        avgFiber: 0
      };
    }
  };

  // Fetch activity data from Firestore (from LetsJam)
  const fetchActivityData = async () => {
    try {
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
          
          if (activity.heart_rate) {
            totalHeartRate += activity.heart_rate;
            activitiesWithHeartRate++;
          }
          
          totalCaloriesBurned += activity.calories || 0;
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

  // Fetch blood markers from Firebase (from LetsJam)
  const fetchBloodMarkers = async () => {
    try {
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

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchUserData();
  };

  const handleEmailClick = () => {
    window.location.href = "mailto:mihir@my23.ai";
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const todayData = last7DaysData[new Date().toISOString().split('T')[0]] || null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 relative overflow-hidden">
      <Toaster position="top-right" />
      
      {/* Background decoration - ActivityJam style */}
      <div className="absolute inset-0 bg-gradient-to-r from-orange-400/10 to-red-400/10 animate-pulse"></div>
      <div className="absolute top-20 left-20 w-32 h-32 bg-orange-200/30 rounded-full blur-xl animate-bounce"></div>
      <div className="absolute bottom-20 right-20 w-24 h-24 bg-red-200/30 rounded-full blur-xl animate-bounce delay-1000"></div>
      <div className="absolute top-1/2 right-1/4 w-16 h-16 bg-pink-200/30 rounded-full blur-xl animate-bounce delay-500"></div>
      
      <Header />
      
      {/* Mobile Chat Overlay */}
      {mobileShowChat && (
        <div className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-50">
          <div className="absolute bottom-0 left-0 right-0 h-3/4 bg-white rounded-t-xl">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">AI Health Assistant</h3>
              <button 
                onClick={() => setMobileShowChat(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="h-full pb-16">
              <ChatPanel userData={userData} last7DaysData={last7DaysData} />
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <div className="relative z-10 text-center py-12 px-6">
        <h1 className="text-4xl md:text-6xl font-black bg-gradient-to-r from-orange-600 via-red-600 to-pink-600 bg-clip-text text-transparent animate-fade-in leading-tight mb-6">
          🩺 MY HEALTH.<br />
          🗄️ MY DATA.<br />
          🧬 MY 23.
        </h1>
        
        <p className="text-xl md:text-2xl font-medium text-orange-600 mb-4">
          🚀 Live Dashboard
        </p>
        
        <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed mb-8">
          Your complete genetic blueprint lives in 23 pairs of chromosomes. 
          Take control of your health journey with AI-powered insights from your personal health data. 🔬✨
        </p>
      </div>

      {/* Split Screen Dashboard - 50/50 Layout */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 pb-12">
        <div className="flex flex-col lg:flex-row gap-8 h-auto lg:h-[800px]">
          {/* Left Panel - Health Dashboard - 50% width */}
          <div className="w-full lg:w-1/2 space-y-6">
            {/* Refresh Button */}
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-bold text-gray-800">Health Dashboard</h2>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center space-x-2 px-4 py-2 bg-white/90 border border-orange-300 rounded-xl hover:bg-white transition-colors duration-200 shadow-lg hover:shadow-xl"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="text-sm font-medium">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>

            {/* Seven Day Strip */}
            <SevenDayStrip 
              last7DaysData={last7DaysData}
              selectedDay={selectedDay}
              setSelectedDay={setSelectedDay}
              showDetailDrawer={showDetailDrawer}
              setShowDetailDrawer={setShowDetailDrawer}
            />

            {/* Today's Health Card */}
            <TodayHealthCard todayData={todayData} />

            {/* Quick Actions */}
            <QuickActions />
          </div>

          {/* Right Panel - AI Chat - 50% width */}
          <div className="w-full lg:w-1/2">
            <div className="sticky top-20 h-full lg:h-[700px]">
              <ChatPanel userData={userData} last7DaysData={last7DaysData} />
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Section */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-8">
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-8">
            🚀 Explore Your Health Journey
          </h2>
          
          {/* Navigation Buttons */}
          <div className="space-y-4">
            {/* First row - Overall Jam and Lets Jam */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button 
                onClick={() => window.location.href = '/overall-jam'} 
                className="bg-white/90 backdrop-blur-sm border border-orange-200 hover:bg-white text-orange-600 px-6 py-4 text-lg font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                <BarChart2 className="mr-3 h-5 w-5" />
                Overall Jam
              </Button>
              
              <Button 
                onClick={() => window.location.href = '/lets-jam'} 
                className="bg-white/90 backdrop-blur-sm border border-red-200 hover:bg-white text-red-600 px-6 py-4 text-lg font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                <MessageSquare className="mr-3 h-5 w-5" />
                Lets Jam
              </Button>
            </div>
            
            {/* Second row - Activity, Nutrition, Body */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Button 
                onClick={() => window.location.href = '/activity-jam'} 
                className="bg-white/90 backdrop-blur-sm border border-orange-200 hover:bg-white text-orange-600 px-6 py-4 text-lg font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                <Activity className="mr-3 h-5 w-5" />
                Activity Jam
              </Button>
              
              <Button 
                onClick={() => window.location.href = '/nutrition-jam'} 
                className="bg-white/90 backdrop-blur-sm border border-green-200 hover:bg-white text-green-600 px-6 py-4 text-lg font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                <Utensils className="mr-3 h-5 w-5" />
                Nutrition Jam
              </Button>
              
              <Button 
                onClick={() => window.location.href = '/body-jam'} 
                className="bg-white/90 backdrop-blur-sm border border-red-200 hover:bg-white text-red-600 px-6 py-4 text-lg font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                <Heart className="mr-3 h-5 w-5" />
                Body Jam
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Email Signup Section */}
      <div className="relative z-10 max-w-2xl mx-auto px-6 py-8">
        <EmailAndFeedbackCard />
      </div>

      {/* Contact Email Button */}
      <div className="relative z-10 text-center py-8">
        <Button 
          onClick={handleEmailClick}
          className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white px-8 py-4 text-lg font-medium rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
        >
          <Mail className="mr-3 h-5 w-5" />
          mihir@my23.ai
        </Button>
      </div>
      
      {/* Coming soon indicator */}
      <div className="relative z-10 text-center pb-12">
        <div className="inline-flex items-center space-x-2 bg-white/50 backdrop-blur-sm rounded-full px-6 py-3 border border-white/20">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-gray-600 font-medium">📬 Building the future of personalized health</span>
        </div>
      </div>

      {/* Mobile Chat Button */}
      <MobileChatButton onClick={() => setMobileShowChat(true)} />

      {/* Custom Styles */}
      <style jsx>{`
        @keyframes slide-down {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-slide-down {
          animation: slide-down 0.2s ease-out;
        }
        
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 1s ease-out;
        }
      `}</style>
    </div>
  );
};

export default Index;
