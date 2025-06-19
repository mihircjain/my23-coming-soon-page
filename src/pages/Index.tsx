import React, { useState, useEffect } from 'react';
import { Mail, Activity, Utensils, Heart, BarChart2, MessageSquare, Send, TrendingUp, Flame, Target, Droplet, Bot, Sparkles, Award, Calendar, Footprints, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';

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

interface BloodMarkerData {
  date: string;
  markers: Record<string, number | string>;
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

// Weekly Goals Tracker Component - Updated with Green/Blue Theme
const WeeklyGoalsTracker: React.FC<{
  weekData: Record<string, HealthData>;
  loading: boolean;
}> = ({ weekData, loading }) => {
  // Calculate weekly totals
  const calculateWeeklyTotals = () => {
    const totals = {
      caloriesBurned: 0,
      protein: 0,
      calorieSurplus: 0,
      activeDays: 0
    };

    const BMR = 1479;
    
    Object.values(weekData).forEach((day: HealthData) => {
      totals.caloriesBurned += day.caloriesBurned || 0;
      totals.protein += day.protein || 0;
      
      const caloriesConsumed = day.caloriesConsumed || 0;
      const caloriesBurned = day.caloriesBurned || 0;
      const dailySurplus = caloriesConsumed - (caloriesBurned + BMR);
      totals.calorieSurplus += dailySurplus;
      
      if (day.caloriesBurned > 0 || day.caloriesConsumed > 0) {
        totals.activeDays += 1;
      }
    });

    return totals;
  };

  const weeklyTotals = calculateWeeklyTotals();

  // Weekly Goals - Updated colors
  const goals = {
    caloriesBurned: { target: 3500, label: "Calories Burned", icon: Flame, color: "green", shortLabel: "Cal Burn" },
    protein: { target: 1057, label: "Protein (151×7)", icon: Utensils, color: "blue", shortLabel: "Protein" },
    calorieSurplus: { target: 1000, label: "Calorie Surplus", icon: TrendingUp, color: "emerald", shortLabel: "Cal Surplus" }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return "bg-green-500";
    if (percentage >= 75) return "bg-blue-500";
    if (percentage >= 50) return "bg-emerald-500";
    return "bg-teal-500";
  };

  const getWeeklyRating = () => {
    const scores = Object.keys(goals).map(key => {
      const goal = goals[key as keyof typeof goals];
      const actual = weeklyTotals[key as keyof typeof weeklyTotals];
      return Math.min((actual / goal.target) * 100, 100);
    });
    
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    if (avgScore >= 90) return { rating: "🏆 CHAMPION", color: "text-green-600" };
    if (avgScore >= 75) return { rating: "🔥 STRONG", color: "text-blue-600" };
    if (avgScore >= 50) return { rating: "💪 BUILDING", color: "text-emerald-600" };
    return { rating: "🌱 STARTING", color: "text-teal-600" };
  };

  const weeklyRating = getWeeklyRating();

  if (loading) {
    return (
      <Card className="bg-gradient-to-r from-green-100 to-blue-100 rounded-xl shadow-lg">
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-6 bg-white/30 rounded w-1/2 mx-auto"></div>
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-white/30 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-r from-green-100 to-blue-100 rounded-xl shadow-lg">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-xl font-bold bg-gradient-to-r from-green-700 to-blue-700 bg-clip-text text-transparent">
          📊 Weekly Goals
        </CardTitle>
        <div className={`text-lg font-bold ${weeklyRating.color}`}>
          {weeklyRating.rating}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Compact Goal Widgets */}
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(goals).map(([key, goal]) => {
            const actual = weeklyTotals[key as keyof typeof weeklyTotals];
            const percentage = Math.min((actual / goal.target) * 100, 100);
            const IconComponent = goal.icon;
            
            return (
              <div key={key} className="bg-white/60 rounded-lg p-3 border border-white/30 text-center">
                <div className="flex items-center justify-center mb-2">
                  <IconComponent className={`h-4 w-4 text-${goal.color}-600`} />
                </div>
                
                <div className="text-xs font-semibold text-gray-700 mb-1">
                  {goal.shortLabel}
                </div>
                
                <div className="text-sm font-bold text-gray-800 mb-2">
                  {Math.round(actual).toLocaleString()}
                  {key === 'protein' ? 'g' : ' cal'}
                  <span className="text-xs text-gray-600">
                    /{goal.target.toLocaleString()}{key === 'protein' ? 'g' : ' cal'}
                  </span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                  <div 
                    className={`h-2 rounded-full transition-all duration-500 ${getProgressColor(percentage)}`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
                
                <div className={`text-xs font-semibold ${percentage >= 100 ? 'text-green-600' : percentage >= 75 ? 'text-blue-600' : 'text-emerald-600'}`}>
                  {Math.round(percentage)}%
                </div>
              </div>
            );
          })}
        </div>

        {/* Compact Daily Breakdown */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-700 text-center">This Week</h4>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }, (_, i) => {
              const date = new Date();
              date.setDate(date.getDate() - (6 - i));
              const dateStr = date.toISOString().split('T')[0];
              const dayData = weekData[dateStr] || {};
              const isToday = dateStr === new Date().toISOString().split('T')[0];
              
              const BMR = 1479;
              const caloriesConsumed = dayData.caloriesConsumed || 0;
              const caloriesBurned = dayData.caloriesBurned || 0;
              const dailySurplus = caloriesConsumed - (caloriesBurned + BMR);
              const protein = dayData.protein || 0;
              
              return (
                <div 
                  key={dateStr}
                  className={`p-1 rounded text-center text-xs border ${
                    isToday ? 'border-green-500 bg-white/80' : 'border-white/30 bg-white/60'
                  }`}
                >
                  <div className="font-semibold text-gray-600 text-xs mb-1">
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  
                  {/* Protein */}
                  <div className="text-xs text-blue-600 font-medium">
                    P: {Math.round(protein)}g
                  </div>
                  
                  {/* Calories Burned */}
                  <div className="text-xs text-green-600 font-medium">
                    Cal Burn: {Math.round(caloriesBurned)}
                  </div>
                  
                  {/* Surplus */}
                  <div className={`text-xs font-semibold ${dailySurplus >= 0 ? 'text-emerald-600' : 'text-teal-600'}`}>
                    Cal Surplus: {dailySurplus >= 0 ? '+' : ''}{Math.round(dailySurplus)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-xs text-gray-600 text-center">
            P: Protein (g) • Cal Burn: Burned (cal) • Cal Surplus: Surplus (cal)
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Combined Email Signup and Feedback Component - Updated with Green/Blue Theme
const EmailAndFeedbackCard: React.FC = () => {
  const [email, setEmail] = useState('');
  const [feedback, setFeedback] = useState('');
  const [type, setType] = useState<'suggestion' | 'feature_request' | 'feedback'>('suggestion');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFeedbackFields, setShowFeedbackFields] = useState(false);

  const handleEmailSubmit = () => {
    if (!email || !email.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    
    // Simulate API call
    setTimeout(() => {
      setEmail('');
      setFeedback('');
      setShowFeedbackFields(false);
      setIsSubmitting(false);
      alert('🎉 Thanks for signing up! We\'ll keep you updated.');
    }, 1000);
  };

  return (
    <Card className="bg-gradient-to-br from-green-50 to-blue-50 border-green-200 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="text-center pb-4">
        <div className="mx-auto w-12 h-12 bg-gradient-to-br from-green-400 to-blue-400 rounded-full flex items-center justify-center mb-3">
          <Mail className="h-6 w-6 text-white" />
        </div>
        <CardTitle className="text-lg font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
          📬 Stay Updated
        </CardTitle>
        <p className="text-sm text-gray-600">
          Get notified about new features & share your ideas
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border-green-200 focus:border-green-400 focus:ring-green-400 text-sm"
            disabled={isSubmitting}
            required
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFeedbackFields(!showFeedbackFields)}
              className="text-sm text-green-600 hover:text-green-700 font-medium"
            >
              {showFeedbackFields ? '📬 Just email signup' : '💭 + Add feedback/suggestions'}
            </button>
          </div>

          {showFeedbackFields && (
            <div className="space-y-3 border-t border-green-200 pt-3">
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
                        ? 'bg-green-100 text-green-700 border border-green-300'
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
                className="rounded-lg border-green-200 focus:border-green-400 focus:ring-green-400 resize-none text-sm"
                disabled={isSubmitting}
              />
            </div>
          )}

          <Button
            onClick={handleEmailSubmit}
            disabled={isSubmitting || !email}
            className="w-full bg-gradient-to-r from-green-400 to-blue-400 hover:from-green-500 hover:to-blue-500 text-white py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 text-sm"
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
        </div>
      </CardContent>
    </Card>
  );
};

// FIXED: Health Overview Component with REAL API Data (not fake data)
const HealthOverviewCard: React.FC = () => {
  const [healthData, setHealthData] = useState<HealthData[]>([]);
  const [bloodMarkers, setBloodMarkers] = useState<BloodMarkerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [last7DaysData, setLast7DaysData] = useState<Record<string, HealthData>>({});

  // FIXED: Real data fetching instead of fake random data
  const fetchHealthData = async () => {
    console.log('🔄 Fetching REAL health data from APIs...');
    setLoading(true);
    
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const dateString = sevenDaysAgo.toISOString().split('T')[0];

      const tempData: Record<string, HealthData> = {};
      
      // Initialize 7 days of data
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

      // 1. Fetch nutrition data from your real API
      try {
        console.log('📊 Fetching nutrition data...');
        const nutritionResponse = await fetch(`/api/nutrition-logs?date=${dateString}`);
        if (nutritionResponse.ok) {
          const nutritionData = await nutritionResponse.json();
          console.log(`✅ Got ${nutritionData.length} nutrition logs`);
          
          nutritionData.forEach((log: any) => {
            if (tempData[log.date]) {
              tempData[log.date].caloriesConsumed = log.totals?.calories || 0;
              tempData[log.date].protein = log.totals?.protein || 0;
              tempData[log.date].carbs = log.totals?.carbs || 0;
              tempData[log.date].fat = log.totals?.fat || 0;
              tempData[log.date].fiber = log.totals?.fiber || 0;
            }
          });
        }
      } catch (error) {
        console.error('❌ Error fetching nutrition data:', error);
      }

      // 2. Fetch Strava activity data from your real API
      try {
        console.log('🏃 Fetching Strava data...');
        const stravaResponse = await fetch(`/api/strava?userId=mihir_jain&mode=cached&days=7`);
        if (stravaResponse.ok) {
          const stravaData = await stravaResponse.json();
          console.log(`✅ Got ${stravaData.length} Strava activities`);
          
          stravaData.forEach((activity: any) => {
            const activityDate = activity.date || (activity.start_date ? activity.start_date.substring(0, 10) : undefined);
            
            if (!activityDate || !tempData[activityDate]) return;

            // Add heart rate data
            if (activity.heart_rate != null || activity.average_heartrate != null) {
              const hr = activity.heart_rate || activity.average_heartrate;
              const curHR = tempData[activityDate].heartRate || 0;
              const cnt = tempData[activityDate].activityTypes.length;
              tempData[activityDate].heartRate = cnt === 0 ? hr : ((curHR * cnt) + hr) / (cnt + 1);
            }

            // Add calories burned from Strava
            const activityCalories = activity.calories || 0;
            tempData[activityDate].caloriesBurned += activityCalories;
            
            // Add workout duration
            tempData[activityDate].workoutDuration += activity.duration || activity.moving_time || 0;

            // Add activity types
            if (activity.type && !tempData[activityDate].activityTypes.includes(activity.type)) {
              tempData[activityDate].activityTypes.push(activity.type);
            }
          });
        }
      } catch (error) {
        console.error('❌ Error fetching Strava data:', error);
      }

      // 3. Fetch blood markers from your real API
      try {
        console.log('🩸 Fetching blood markers...');
        const bloodResponse = await fetch('/api/blood-markers?userId=mihir_jain&limit=1');
        if (bloodResponse.ok) {
          const bloodData = await bloodResponse.json();
          if (bloodData.length > 0) {
            console.log('✅ Got blood markers');
            setBloodMarkers(bloodData[0]);
          }
        }
      } catch (error) {
        console.error('❌ Error fetching blood markers:', error);
      }

      // Convert to sorted array
      const sortedData = Object.values(tempData).sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      console.log('📊 Health data processing complete:', {
        totalDays: sortedData.length,
        daysWithCaloriesBurned: sortedData.filter(d => d.caloriesBurned > 0).length,
        daysWithNutrition: sortedData.filter(d => d.caloriesConsumed > 0).length,
        totalCaloriesBurned: sortedData.reduce((sum, d) => sum + d.caloriesBurned, 0),
        totalProtein: sortedData.reduce((sum, d) => sum + d.protein, 0)
      });

      setHealthData(sortedData);
      setLast7DaysData(tempData);
      
    } catch (error) {
      console.error('❌ Error fetching health data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
  }, []);

  return (
    <div className="space-y-6">
      <WeeklyGoalsTracker weekData={last7DaysData} loading={loading} />

      {bloodMarkers && (
        <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Droplet className="h-5 w-5 text-teal-500" />
              Latest Blood Markers
            </CardTitle>
            <p className="text-sm text-gray-600">
              As of {new Date(bloodMarkers.date).toLocaleDateString()}
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Object.entries(bloodMarkers.markers).map(([key, value]) => (
                <div key={key} className="text-center bg-white/50 p-3 rounded-lg">
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">{key}</p>
                  <p className="text-xl font-semibold text-gray-800">{value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Chatbot Card Component - Updated with Green/Blue Theme
const ChatbotCard: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I am your AI health assistant. How can I help you today? 🤖' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSendMessage = () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const responses = [
        "That's a great question! Based on your recent data, I can see some interesting patterns.",
        "Let me analyze your health metrics. Your protein intake looks good this week!",
        "I'd recommend focusing on consistency in your sleep schedule for better recovery.",
        "Your activity levels have been trending upward - keep up the great work!"
      ];
      
      const aiResponse = { 
        role: 'assistant', 
        content: responses[Math.floor(Math.random() * responses.length)]
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickPrompts = [
    "How's my nutrition this week?",
    "What's my calorie trend?",
    "Any health recommendations?",
    "Analyze my protein intake"
  ];

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
  };

  if (!isOpen) {
    return (
      <Card 
        className="bg-gradient-to-br from-green-50 to-blue-50 border-green-200 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer" 
        onClick={() => window.location.href = '/lets-jam'}
      >
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-12 h-12 bg-gradient-to-br from-green-400 to-blue-400 rounded-full flex items-center justify-center mb-3">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-lg font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
            🤖 AI Health Chat
          </CardTitle>
          <p className="text-sm text-gray-600">
            Get personalized health insights
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="bg-white/60 rounded-lg p-3 border border-green-200">
              <div className="text-xs text-gray-600 mb-1">
                "How's my nutrition this week?"
              </div>
            </div>
            <Button
              className="w-full bg-gradient-to-r from-green-400 to-blue-400 hover:from-green-500 hover:to-blue-500 text-white py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 text-sm"
            >
              <MessageSquare className="h-4 w-4" />
              Start Chatting
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-green-50 to-blue-50 border-green-200 shadow-lg">
      <CardHeader className="text-center pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-blue-400 rounded-full flex items-center justify-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                AI Health Chat
              </CardTitle>
              <p className="text-xs text-gray-500">Powered by Gemini</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700"
          >
            ×
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-3">
          {messages.length <= 1 && (
            <div className="grid grid-cols-2 gap-1">
              {quickPrompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickPrompt(prompt)}
                  className="text-xs p-2 bg-white/60 hover:bg-white/80 border border-green-200 rounded text-green-700 transition-all duration-200"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          <div className="bg-white/60 rounded-lg p-3 h-48 overflow-y-auto space-y-2">
            {messages.map((message, index) => (
              <div
                key={index}
                className={'flex ' + (message.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={'max-w-[80%] p-2 rounded-lg text-xs ' + (
                    message.role === 'user'
                      ? 'bg-green-500 text-white'
                      : 'bg-white text-gray-800 border border-gray-200'
                  )}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white text-gray-800 border border-gray-200 p-2 rounded-lg text-xs">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <Input
              placeholder="Ask about your health..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              className="text-sm border-green-200 focus:border-green-400"
              disabled={isTyping}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!input.trim() || isTyping}
              size="sm"
              className="bg-gradient-to-r from-green-400 to-blue-400 hover:from-green-500 hover:to-blue-500 text-white px-3"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {/* Footer */}
          <div className="text-center">
            <button
              onClick={() => window.location.href = '/lets-jam'}
              className="text-xs text-green-600 hover:text-green-700 underline"
            >
              Open full chat page →
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const Index = () => {
  const handleEmailClick = () => {
    window.location.href = "mailto:mihir@my23.ai";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 relative overflow-hidden">
      
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-green-400/10 to-blue-400/10 animate-pulse"></div>
      
      {/* Floating elements for visual interest */}
      <div className="absolute top-20 left-20 w-32 h-32 bg-green-200/30 rounded-full blur-xl animate-bounce"></div>
      <div className="absolute bottom-20 right-20 w-24 h-24 bg-blue-200/30 rounded-full blur-xl animate-bounce delay-1000"></div>
      <div className="absolute top-1/2 right-1/4 w-16 h-16 bg-teal-200/30 rounded-full blur-xl animate-bounce delay-500"></div>
      
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        {/* Main heading section */}
        <div className="text-center mb-12">
          <div className="space-y-6 mb-8">
            <h1 className="text-4xl md:text-6xl font-black bg-gradient-to-r from-green-600 via-blue-600 to-teal-600 bg-clip-text text-transparent animate-fade-in leading-tight">
              🩺 MY HEALTH.<br />
              🗄️ MY DATA.<br />
              🧬 MY 23.
            </h1>
          </div>
          
          <div className="mb-8 animate-slide-up delay-300">
            <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Your complete genetic blueprint lives in 23 pairs of chromosomes. 
              Take control of your health journey with AI-powered insights from your personal health data. 🔬✨
            </p>
          </div>
        </div>

        {/* Interactive Cards Grid - Updated layout with new order */}
        <div className="space-y-8 mb-12">
          {/* 1. Health Overview - Full width - FIXED with real data */}
          <HealthOverviewCard />
          
          {/* 2. AI Chat Bot - Full width alone */}
          <div className="grid grid-cols-1 gap-6">
            <ChatbotCard />
          </div>
          
          {/* 4. Navigation Buttons - Overall Jam and other jams */}
          <div className="space-y-4">
            {/* First row - Overall Jam and Lets Jam */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button 
                onClick={() => window.location.href = '/overall-jam'} 
                className="bg-white/80 backdrop-blur-sm border border-blue-200 hover:bg-white text-blue-600 px-6 py-4 text-lg font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105"
              >
                <BarChart2 className="mr-3 h-5 w-5" />
                Overall Jam
              </Button>
              
              <Button 
                onClick={() => window.location.href = '/lets-jam'} 
                className="bg-white/80 backdrop-blur-sm border border-green-200 hover:bg-white text-green-600 px-6 py-4 text-lg font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105"
              >
                <MessageSquare className="mr-3 h-5 w-5" />
                Lets Jam
              </Button>
            </div>
            
            {/* Second row - Activity, Nutrition, Body, Sleep */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button 
                onClick={() => window.location.href = '/activity-jam'} 
                className="bg-white/80 backdrop-blur-sm border border-green-200 hover:bg-white text-green-600 px-6 py-4 text-lg font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105"
              >
                <Footprints className="mr-3 h-5 w-5" />
                Activity Jam
              </Button>

              <Button 
                onClick={() => window.location.href = '/nutrition-jam'} 
                className="bg-white/80 backdrop-blur-sm border border-blue-200 hover:bg-white text-blue-600 px-6 py-4 text-lg font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105"
              >
                <Utensils className="mr-3 h-5 w-5" />
                Nutrition Jam
              </Button>
              
              <Button 
                onClick={() => window.location.href = '/body-jam'} 
                className="bg-white/80 backdrop-blur-sm border border-teal-200 hover:bg-white text-teal-600 px-6 py-4 text-lg font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105"
              >
                <Heart className="mr-3 h-5 w-5" />
                Body Jam
              </Button>

              <Button 
                onClick={() => window.location.href = '/sleep-jam'} 
                className="bg-white/80 backdrop-blur-sm border border-purple-200 hover:bg-white text-purple-600 px-6 py-4 text-lg font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105"
              >
                <Moon className="mr-3 h-5 w-5" />
                Sleep Jam
              </Button>
            </div>
          </div>
          
          {/* 5. Stay Updated Card - Full width alone */}
          <div className="grid grid-cols-1 gap-6">
            <EmailAndFeedbackCard />
          </div>
        </div>

        {/* Contact Email Button */}
        <div className="text-center mb-12 animate-slide-up delay-500">
          <Button 
            onClick={handleEmailClick}
            className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white px-8 py-4 text-lg font-medium rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
          >
            <Mail className="mr-3 h-5 w-5" />
            mihir@my23.ai
          </Button>
        </div>
        
        {/* Coming soon indicator */}
        <div className="text-center animate-slide-up delay-900">
          <div className="inline-flex items-center space-x-2 bg-white/50 backdrop-blur-sm rounded-full px-6 py-3 border border-white/20">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600 font-medium">📬 Building the future of personalized health</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
