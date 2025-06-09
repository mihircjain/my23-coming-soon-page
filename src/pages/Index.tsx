import React, { useState, useEffect } from 'react';
import { Mail, Activity, Utensils, Heart, BarChart2, MessageSquare, Send, TrendingUp, Flame, Target, Droplet, Bot, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast, Toaster } from 'sonner';
import { db } from '@/lib/firebaseConfig';
import { collection, addDoc, query, where, orderBy, getDocs, limit } from 'firebase/firestore';

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

// Combined Email Signup and Feedback Component
const EmailAndFeedbackCard: React.FC = () => {
  const [email, setEmail] = useState('');
  const [feedback, setFeedback] = useState('');
  const [type, setType] = useState<'suggestion' | 'feature_request' | 'feedback'>('suggestion');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFeedbackFields, setShowFeedbackFields] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    try {
      const signupData: EmailSignup = {
        email,
        timestamp: new Date().toISOString(),
        source: 'homepage_signup'
      };

      await addDoc(collection(db, 'email_signups'), signupData);

      // If feedback is provided, save it too
      if (feedback.trim()) {
        const feedbackData: UserFeedback = {
          email,
          message: feedback.trim(),
          type,
          timestamp: new Date().toISOString()
        };
        await addDoc(collection(db, 'user_feedback'), feedbackData);
      }

      toast.success('🎉 Thanks for signing up! We\'ll keep you updated.');
      setEmail('');
      setFeedback('');
      setShowFeedbackFields(false);
    } catch (error) {
      console.error('Error saving data:', error);
      toast.error('Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-purple-100 to-pink-100 border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="text-center pb-4">
        <div className="mx-auto w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center mb-3">
          <Mail className="h-6 w-6 text-white" />
        </div>
        <CardTitle className="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
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
            className="rounded-lg border-purple-200 focus:border-purple-400 focus:ring-purple-400 text-sm"
            disabled={isSubmitting}
            required
          />

          {/* Optional Feedback Toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFeedbackFields(!showFeedbackFields)}
              className="text-sm text-purple-600 hover:text-purple-700 font-medium"
            >
              {showFeedbackFields ? '📬 Just email signup' : '💭 + Add feedback/suggestions'}
            </button>
          </div>

          {/* Feedback Fields */}
          {showFeedbackFields && (
            <div className="space-y-3 border-t border-purple-200 pt-3">
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
                    className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-all duration-200 ${
                      type === option.value
                        ? 'bg-purple-200 text-purple-700 border border-purple-300'
                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                    }`}
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
                className="rounded-lg border-purple-200 focus:border-purple-400 focus:ring-purple-400 resize-none text-sm"
                disabled={isSubmitting}
              />
            </div>
          )}

          <Button
            type="submit"
            disabled={isSubmitting || !email}
            className="w-full bg-gradient-to-r from-purple-400 to-pink-400 hover:from-purple-500 hover:to-pink-500 text-white py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 text-sm"
          >
            {isSubmitting ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <>
                <Send className="h-4 w-4" />
                {showFeedbackFields && feedback.trim() ? 'Subscribe + Send Feedback' : 'Subscribe'}
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

// Health Overview Component with OverallJam-style boxes
const HealthOverviewCard: React.FC = () => {
  const [healthData, setHealthData] = useState<HealthData[]>([]);
  const [bloodMarkers, setBloodMarkers] = useState<BloodMarkerData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealthData = async () => {
    try {
      // Get the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const dateString = sevenDaysAgo.toISOString().split('T')[0];

      // Initialize data structure for 7 days
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

      // Fetch nutrition and activity data
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

      // Process Strava data
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

      // Process blood markers
      if (bloodMarkersSnapshot.docs.length > 0) {
        const latestDoc = bloodMarkersSnapshot.docs[0];
        setBloodMarkers(latestDoc.data() as BloodMarkerData);
      }

      const sortedData = Object.values(tempData).sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      setHealthData(sortedData);

    } catch (error) {
      console.error("Error fetching health data:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAverage = (metric: keyof HealthData) => {
    const validData = healthData.filter(d => d[metric] !== null && (d[metric] as number) > 0);
    if (validData.length === 0) return 0;
    const sum = validData.reduce((total, d) => total + ((d[metric] as number) || 0), 0);
    return Math.round(sum / validData.length);
  };

  const generateLast7Days = () => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date.toISOString().split('T')[0];
    });
  };

  useEffect(() => {
    fetchHealthData();
  }, []);

  return (
    <div className="space-y-6">
      {/* 7-Day Health Overview - Full width section */}
      <Card className="bg-gradient-to-r from-blue-200 to-emerald-200 rounded-2xl p-6 text-gray-800 shadow-xl">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-700 to-emerald-700 bg-clip-text text-transparent">
            📊 Last 7 Days Health Overview
          </CardTitle>
          <p className="text-sm text-gray-700 mt-2">
            Your complete health overview for the last 7 days
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
              {generateLast7Days().map((date) => {
                const dayData = healthData.find(d => d.date === date) || {
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
                  <div
                    key={date}
                    className="bg-white/40 backdrop-blur-sm rounded-lg p-4 border border-white/40 shadow-md"
                  >
                    <h3 className="font-semibold text-sm text-gray-700 mb-3 text-center">
                      {new Date(date).toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                      {isToday && (
                        <span className="block text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded-full font-medium mt-1">
                          Today
                        </span>
                      )}
                    </h3>
                    <div className="space-y-2 text-xs text-gray-700">
                      <div className="flex justify-between">
                        <span>Calories In:</span>
                        <span className="font-medium">{Math.round(dayData.caloriesConsumed)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Calories Out:</span>
                        <span className="font-medium">{Math.round(dayData.caloriesBurned)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Protein:</span>
                        <span className="font-medium">{Math.round(dayData.protein)}g</span>
                      </div>
                      {/* Activities - Fixed to show one per line with max 2 lines */}
                      <div className="mt-2">
                        <span className="text-gray-600">Activities:</span>
                        <div className="mt-1 text-gray-800 font-medium min-h-[32px]">
                          {dayData.activityTypes.length > 0 ? (
                            <div className="space-y-1">
                              {dayData.activityTypes.slice(0, 2).map((activity, index) => (
                                <div key={index} className="truncate text-xs">
                                  {activity}
                                </div>
                              ))}
                              {dayData.activityTypes.length > 2 && (
                                <div className="text-xs text-gray-500">
                                  +{dayData.activityTypes.length - 2} more
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500">Rest</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Averages Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            📈 Weekly Averages
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Calories In Card - Light Green Gradient */}
              <div className="bg-gradient-to-br from-green-200 to-emerald-300 rounded-xl p-4 text-gray-800 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-800">Calories In</h3>
                  <div className="w-8 h-8 bg-white/30 rounded-lg flex items-center justify-center">
                    <Utensils className="h-4 w-4 text-gray-700" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-gray-800">{calculateAverage('caloriesConsumed')}</p>
                  <p className="text-xs text-gray-700">cal/day</p>
                </div>
              </div>

              {/* Calories Out Card - Light Amber/Orange Gradient */}
              <div className="bg-gradient-to-br from-amber-200 to-orange-300 rounded-xl p-4 text-gray-800 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-800">Calories Out</h3>
                  <div className="w-8 h-8 bg-white/30 rounded-lg flex items-center justify-center">
                    <Flame className="h-4 w-4 text-gray-700" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-gray-800">{calculateAverage('caloriesBurned')}</p>
                  <p className="text-xs text-gray-700">cal/day</p>
                </div>
              </div>

              {/* Protein Card - Light Purple Gradient */}
              <div className="bg-gradient-to-br from-purple-200 to-violet-300 rounded-xl p-4 text-gray-800 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-800">Protein</h3>
                  <div className="w-8 h-8 bg-white/30 rounded-lg flex items-center justify-center">
                    <Target className="h-4 w-4 text-gray-700" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-gray-800">{calculateAverage('protein')}</p>
                  <p className="text-xs text-gray-700">g/day</p>
                </div>
              </div>

              {/* Heart Rate Card - Light Red Gradient */}
              <div className="bg-gradient-to-br from-red-200 to-pink-300 rounded-xl p-4 text-gray-800 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-800">Heart Rate</h3>
                  <div className="w-8 h-8 bg-white/30 rounded-lg flex items-center justify-center">
                    <Heart className="h-4 w-4 text-gray-700" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-gray-800">{calculateAverage('heartRate') || '-'}</p>
                  <p className="text-xs text-gray-700">{calculateAverage('heartRate') ? 'bpm' : 'avg'}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Blood Markers Section */}
      {bloodMarkers && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Droplet className="h-5 w-5 text-blue-500" />
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

// Chatbot Card Component with Gemini integration
const ChatbotCard: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I\'m your AI health assistant. How can I help you today? 🤖' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsTyping(true);

    try {
      // Use your existing Gemini setup - adjust the endpoint as needed
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: currentInput,
          context: 'health_assistant', // Add context for health-specific responses
          messages: messages.slice(-5) // Send last 5 messages for context
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();
      const aiResponse = { role: 'assistant', content: data.response || data.message || 'Sorry, I couldn\'t process that request.' };
      
      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error('Error getting AI response:', error);
      const errorResponse = { 
        role: 'assistant', 
        content: 'Sorry, I\'m having trouble connecting right now. Please try again in a moment. 🤖💭' 
      };
      setMessages(prev => [...prev, errorResponse]);
      toast.error('Failed to get AI response. Please try again.');
    } finally {
      setIsTyping(false);
    }
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
      <Card className="bg-gradient-to-br from-indigo-100 to-purple-100 border-indigo-200 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer" onClick={() => setIsOpen(true)}>
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-12 h-12 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-full flex items-center justify-center mb-3">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            🤖 AI Health Chat
          </CardTitle>
          <p className="text-sm text-gray-600">
            Get personalized health insights
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="bg-white/60 rounded-lg p-3 border border-indigo-200">
              <div className="text-xs text-gray-600 mb-1">Powered by Gemini AI</div>
              <div className="text-sm font-medium text-indigo-700">"How's my nutrition this week?"</div>
            </div>
            <Button className="w-full bg-gradient-to-r from-indigo-400 to-purple-400 hover:from-indigo-500 hover:to-purple-500 text-white py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 text-sm">
              <MessageSquare className="h-4 w-4" />
              Start Chatting
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-indigo-100 to-purple-100 border-indigo-200 shadow-lg">
      <CardHeader className="text-center pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-full flex items-center justify-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
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
          {/* Quick Prompts */}
          {messages.length <= 1 && (
            <div className="grid grid-cols-2 gap-1">
              {quickPrompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickPrompt(prompt)}
                  className="text-xs p-2 bg-white/60 hover:bg-white/80 border border-indigo-200 rounded text-indigo-700 transition-all duration-200"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Messages */}
          <div className="bg-white/60 rounded-lg p-3 h-48 overflow-y-auto space-y-2">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-2 rounded-lg text-xs ${
                    message.role === 'user'
                      ? 'bg-indigo-500 text-white'
                      : 'bg-white text-gray-800 border border-gray-200'
                  }`}
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
              className="text-sm border-indigo-200 focus:border-indigo-400"
              disabled={isTyping}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!input.trim() || isTyping}
              size="sm"
              className="bg-gradient-to-r from-indigo-400 to-purple-400 hover:from-indigo-500 hover:to-purple-500 text-white px-3"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {/* Footer */}
          <div className="text-center">
            <button
              onClick={() => window.location.href = '/lets-jam'}
              className="text-xs text-indigo-600 hover:text-indigo-700 underline"
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 relative overflow-hidden">
      <Toaster position="top-right" />
      
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 to-green-400/10 animate-pulse"></div>
      
      {/* Floating elements for visual interest */}
      <div className="absolute top-20 left-20 w-32 h-32 bg-blue-200/30 rounded-full blur-xl animate-bounce"></div>
      <div className="absolute bottom-20 right-20 w-24 h-24 bg-green-200/30 rounded-full blur-xl animate-bounce delay-1000"></div>
      <div className="absolute top-1/2 right-1/4 w-16 h-16 bg-purple-200/30 rounded-full blur-xl animate-bounce delay-500"></div>
      
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        {/* Main heading section */}
        <div className="text-center mb-12">
          <div className="space-y-6 mb-8">
            <h1 className="text-4xl md:text-6xl font-black bg-gradient-to-r from-blue-600 via-purple-600 to-green-600 bg-clip-text text-transparent animate-fade-in leading-tight">
              🩺 MY HEALTH.<br />
              🗄️ MY DATA.<br />
              🧬 MY 23.
            </h1>
            
            <div className="space-y-4">
              <p className="text-xl md:text-2xl font-medium text-blue-600 animate-slide-up delay-200">
                🚀 Coming Soon
              </p>
            </div>
          </div>
          
          <div className="mb-8 animate-slide-up delay-300">
            <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Your complete genetic blueprint lives in 23 pairs of chromosomes. 
              Take control of your health journey with AI-powered insights from your personal health data. 🔬✨
            </p>
          </div>
          
          <div className="animate-slide-up delay-500 mb-8">
            <Button 
              onClick={handleEmailClick}
              className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white px-8 py-4 text-lg font-medium rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              <Mail className="mr-3 h-5 w-5" />
              mihir@my23.ai
            </Button>
          </div>
        </div>

        {/* Interactive Cards Grid - Updated layout */}
        <div className="space-y-8 mb-12">
          {/* Health Overview - Full width */}
          <HealthOverviewCard />
          
          {/* Other cards in a row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ChatbotCard />
            <EmailAndFeedbackCard />
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          <Button 
            onClick={() => window.location.href = '/activity-jam'} 
            className="bg-white/80 backdrop-blur-sm border border-blue-200 hover:bg-white text-blue-600 px-6 py-4 text-lg font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105"
          >
            <Activity className="mr-3 h-5 w-5" />
            Activity Jam
          </Button>
          
          <Button 
            onClick={() => window.location.href = '/nutrition-jam'} 
            className="bg-white/80 backdrop-blur-sm border border-green-200 hover:bg-white text-green-600 px-6 py-4 text-lg font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105"
          >
            <Utensils className="mr-3 h-5 w-5" />
            Nutrition Jam
          </Button>
          
          <Button 
            onClick={() => window.location.href = '/body-jam'} 
            className="bg-white/80 backdrop-blur-sm border border-purple-200 hover:bg-white text-purple-600 px-6 py-4 text-lg font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105"
          >
            <Heart className="mr-3 h-5 w-5" />
            Body Jam
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
