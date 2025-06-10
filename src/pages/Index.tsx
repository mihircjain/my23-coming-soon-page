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

// Daily Health Box Component with Health Score (Calorie Deficit + Protein + Calories Burned)
const DailyHealthBox: React.FC<{
  data: HealthData;
  date: string;
  isToday: boolean;
  onClick: () => void;
}> = ({ data, date, isToday, onClick }) => {
  const hasData = data.caloriesConsumed > 0 || data.caloriesBurned > 0 || data.heartRate > 0;
  
  // Calculate calorie deficit: calories burned + BMR - calories consumed
  const BMR = 1479;
  const calorieDeficit = data.caloriesBurned + BMR - data.caloriesConsumed;
  
  // Calculate health score based on calories burned, protein, and calorie deficit
  const calculateHealthScore = () => {
    let score = 0;
    
    // Calories Burned Score (40% of total) - Target: 300+ calories burned
    // Perfect score at 300+, proportional below that
    const burnedScore = Math.min(40, (data.caloriesBurned / 300) * 40);
    
    // Protein Score (30% of total) - Target: 140g+ 
    // Perfect score at 140g+, proportional below that
    const proteinScore = Math.min(30, (data.protein / 140) * 30);
    
    // Calorie Deficit Score (30% of total) - New progressive scoring
    // 0 cal = 5 pts, 100 cal = 10 pts, 200 cal = 15 pts, 300 cal = 20 pts, 400 cal = 25 pts, 500+ cal = 30 pts
    const deficitScore = (() => {
      if (calorieDeficit <= 0) return 0;
      if (calorieDeficit >= 500) return 30;
      if (calorieDeficit >= 400) return 25;
      if (calorieDeficit >= 300) return 20;
      if (calorieDeficit >= 200) return 15;
      if (calorieDeficit >= 100) return 10;
      return 5; // 1-99 calorie deficit gets 5 points
    })();
    
    score = burnedScore + proteinScore + deficitScore;
    return Math.min(Math.round(score), 100);
  };

  const healthScore = calculateHealthScore();

  return (
    <Card 
      className={`cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg group ${
        hasData 
          ? "bg-gradient-to-br from-orange-50 to-red-50 border-orange-200 hover:shadow-orange-100" 
          : "bg-gray-50 border-gray-200 hover:shadow-gray-100"
      } ${isToday ? "ring-2 ring-red-500" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Date Header */}
          <div className="flex justify-between items-center">
            <div className="text-sm font-medium text-gray-600">
              {new Date(date).toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
              })}
            </div>
            {isToday && (
              <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium">
                Today
              </span>
            )}
          </div>

          {hasData ? (
            <>
              {/* Health Score with progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1">
                    <Heart className="h-4 w-4 text-red-500" />
                    <span className="text-base font-bold text-gray-800">
                      {healthScore}%
                    </span>
                    <span className="text-xs text-gray-500">health</span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-orange-400 to-red-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${healthScore}%` }}
                  />
                </div>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-center">
                  <div className="font-semibold text-green-600">{Math.round(data.caloriesConsumed)}</div>
                  <div className="text-gray-500">Cal In</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-orange-600">{Math.round(data.caloriesBurned)}</div>
                  <div className="text-gray-500">Cal Out</div>
                </div>
              </div>

              {/* Additional metrics */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-center">
                  <div className="font-semibold text-orange-600">{Math.round(data.protein)}g</div>
                  <div className="text-gray-500">Protein</div>
                </div>
                <div className="text-center">
                  <div className={`font-semibold ${calorieDeficit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {calorieDeficit >= 0 ? '+' : ''}{Math.round(calorieDeficit)}
                  </div>
                  <div className="text-gray-500">Cal Deficit</div>
                </div>
              </div>

              {/* Activity types */}
              {data.activityTypes.length > 0 && (
                <div className="flex items-center justify-center gap-1 text-xs text-gray-500">
                  <Activity className="h-3 w-3" />
                  <span>{data.activityTypes.join(', ')}</span>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-6">
              <div className="text-gray-400 text-sm mb-1">No data</div>
              <div className="text-xs text-gray-400">Rest day</div>
              <Heart className="h-6 w-6 mx-auto mt-2 text-gray-300 group-hover:text-red-500 transition-colors" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Combined Email Signup and Feedback Component
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
    <Card className="bg-gradient-to-br from-orange-100 to-red-100 border-orange-200 shadow-lg hover:shadow-xl transition-all duration-300">
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

// Health Overview Component with Health Score
const HealthOverviewCard: React.FC = () => {
  const [healthData, setHealthData] = useState<HealthData[]>([]);
  const [bloodMarkers, setBloodMarkers] = useState<BloodMarkerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [last7DaysData, setLast7DaysData] = useState<Record<string, HealthData>>({});

  const fetchHealthData = () => {
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

    const nutritionQuery = query(
      collection(db, "nutritionLogs"),
      where("date", ">=", dateString),
      orderBy("date", "desc")
    );

    const stravaQuery = query(
      collection(db, "strava_data"),
      where("userId", "==", "mihir_jain"),
      orderBy("start_date", "desc"),
      limit(20)
    );

    const bloodQuery = query(
      collection(db, "blood_markers"),
      where("userId", "==", "mihir_jain"),
      orderBy("date", "desc"),
      limit(1)
    );

    Promise.all([
      getDocs(nutritionQuery).catch(() => ({ docs: [] })),
      getDocs(stravaQuery).catch(() => ({ docs: [] })),
      getDocs(bloodQuery).catch(() => ({ docs: [] }))
    ]).then(([nutritionSnapshot, stravaSnapshot, bloodMarkersSnapshot]) => {
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

      if (bloodMarkersSnapshot.docs.length > 0) {
        const latestDoc = bloodMarkersSnapshot.docs[0];
        setBloodMarkers(latestDoc.data() as BloodMarkerData);
      }

      const sortedData = Object.values(tempData).sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      setHealthData(sortedData);
      setLast7DaysData(tempData);
    }).catch((error) => {
      console.error("Error fetching health data:", error);
    }).finally(() => {
      setLoading(false);
    });
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
      <Card className="bg-gradient-to-r from-orange-200 to-red-200 rounded-2xl p-6 text-gray-800 shadow-xl">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-orange-700 to-red-700 bg-clip-text text-transparent">
            📊 Last 7 Days Health Overview
          </CardTitle>
          <p className="text-sm text-gray-700 mt-2">
            Mihir's complete health overview with health scores for the last 7 days
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
              {generateLast7Days().map((date) => {
                const dayData = last7DaysData[date] || {
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
                  <DailyHealthBox
                    key={date}
                    data={dayData}
                    date={date}
                    isToday={isToday}
                    onClick={() => {
                      console.log(`Clicked on ${date}`);
                    }}
                  />
                );
              })}
            </div>
          )}
          
          {/* Health Score Explanation Footer */}
          <div className="mt-6 p-4 bg-white/50 rounded-lg border border-white/30">
            <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Target className="h-4 w-4 text-orange-500" />
              Health Score Overview
            </h4>
            <div className="text-xs text-gray-600">
              <p>Health scores are calculated based on calories burned, protein intake, and calorie deficit.</p>
              <div className="mt-2 text-xs text-gray-500 border-t pt-2">
                <strong>For detailed scoring breakdown,</strong> visit the Overall Jam page 📊
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {bloodMarkers && (
        <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Droplet className="h-5 w-5 text-red-500" />
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

// Chatbot Card Component
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

    console.log('Sending message to API:', userMessage.content);

    fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [...messages, userMessage].slice(-10),
        userId: 'homepage_user',
        source: 'homepage_chat'
      }),
    })
    .then(response => {
      console.log('API Response status:', response.status);
      if (!response.ok) {
        return response.text().then(errorText => {
          console.error('API Error response:', errorText);
          let errorData = {};
          try {
            errorData = JSON.parse(errorText);
          } catch (e) {
            console.log('Error response is not JSON');
          }
          throw new Error(errorData.error || 'HTTP ' + response.status + ': ' + response.statusText);
        });
      }
      return response.json();
    })
    .then(data => {
      console.log('API Response data:', data);
      const assistantContent = data.choices?.[0]?.message?.content || 
                              data.response || 
                              data.message || 
                              'Sorry, I could not process that request.';
      
      const aiResponse = { role: 'assistant', content: assistantContent };
      setMessages(prev => [...prev, aiResponse]);
    })
    .catch(error => {
      console.error('Error getting AI response:', error);
      const errorResponse = { 
        role: 'assistant', 
        content: 'Sorry, I am having trouble connecting right now. Please try again in a moment. 🤖💭' 
      };
      setMessages(prev => [...prev, errorResponse]);
      toast.error('Failed to get AI response: ' + error.message);
    })
    .finally(() => {
      setIsTyping(false);
    });
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
        className="bg-gradient-to-br from-orange-100 to-red-100 border-orange-200 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer" 
        onClick={() => window.location.href = '/lets-jam'}
      >
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-12 h-12 bg-gradient-to-br from-orange-400 to-red-400 rounded-full flex items-center justify-center mb-3">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-lg font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
            🤖 AI Health Chat
          </CardTitle>
          <p className="text-sm text-gray-600">
            Get personalized health insights
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="bg-white/60 rounded-lg p-3 border border-orange-200">
              <div className="text-xs text-gray-600 mb-1">
                "How's my nutrition this week?"
              </div>
            </div>
            <Button
              className="w-full bg-gradient-to-r from-orange-400 to-red-400 hover:from-orange-500 hover:to-red-500 text-white py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 text-sm"
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
    <Card className="bg-gradient-to-br from-orange-100 to-red-100 border-orange-200 shadow-lg">
      <CardHeader className="text-center pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-red-400 rounded-full flex items-center justify-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
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
                  className="text-xs p-2 bg-white/60 hover:bg-white/80 border border-orange-200 rounded text-orange-700 transition-all duration-200"
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
                      ? 'bg-orange-500 text-white'
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
              className="text-sm border-orange-200 focus:border-orange-400"
              disabled={isTyping}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!input.trim() || isTyping}
              size="sm"
              className="bg-gradient-to-r from-orange-400 to-red-400 hover:from-orange-500 hover:to-red-500 text-white px-3"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {/* Footer */}
          <div className="text-center">
            <button
              onClick={() => window.location.href = '/lets-jam'}
              className="text-xs text-orange-600 hover:text-orange-700 underline"
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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 relative overflow-hidden">
      <Toaster position="top-right" />
      
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-orange-400/10 to-red-400/10 animate-pulse"></div>
      
      {/* Floating elements for visual interest */}
      <div className="absolute top-20 left-20 w-32 h-32 bg-orange-200/30 rounded-full blur-xl animate-bounce"></div>
      <div className="absolute bottom-20 right-20 w-24 h-24 bg-red-200/30 rounded-full blur-xl animate-bounce delay-1000"></div>
      <div className="absolute top-1/2 right-1/4 w-16 h-16 bg-pink-200/30 rounded-full blur-xl animate-bounce delay-500"></div>
      
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        {/* Main heading section */}
        <div className="text-center mb-12">
          <div className="space-y-6 mb-8">
            <h1 className="text-4xl md:text-6xl font-black bg-gradient-to-r from-orange-600 via-red-600 to-pink-600 bg-clip-text text-transparent animate-fade-in leading-tight">
              🩺 MY HEALTH.<br />
              🗄️ MY DATA.<br />
              🧬 MY 23.
            </h1>
            
            <div className="space-y-4">
              <p className="text-xl md:text-2xl font-medium text-orange-600 animate-slide-up delay-200">
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
        </div>

        {/* Interactive Cards Grid - Updated layout with new order */}
        <div className="space-y-8 mb-12">
          {/* 1. Health Overview - Full width */}
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
                className="bg-white/80 backdrop-blur-sm border border-red-200 hover:bg-white text-red-600 px-6 py-4 text-lg font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105"
              >
                <BarChart2 className="mr-3 h-5 w-5" />
                Overall Jam
              </Button>
              
              <Button 
                onClick={() => window.location.href = '/lets-jam'} 
                className="bg-white/80 backdrop-blur-sm border border-orange-200 hover:bg-white text-orange-600 px-6 py-4 text-lg font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105"
              >
                <MessageSquare className="mr-3 h-5 w-5" />
                Lets Jam
              </Button>
            </div>
            
            {/* Second row - Activity, Nutrition, Body */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Button 
                onClick={() => window.location.href = '/activity-jam'} 
                className="bg-white/80 backdrop-blur-sm border border-orange-200 hover:bg-white text-orange-600 px-6 py-4 text-lg font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105"
              >
                <Activity className="mr-3 h-5 w-5" />
                Activity Jam
              </Button>
              
              <Button 
                onClick={() => window.location.href = '/nutrition-jam'} 
                className="bg-white/80 backdrop-blur-sm border border-red-200 hover:bg-white text-red-600 px-6 py-4 text-lg font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105"
              >
                <Utensils className="mr-3 h-5 w-5" />
                Nutrition Jam
              </Button>
              
              <Button 
                onClick={() => window.location.href = '/body-jam'} 
                className="bg-white/80 backdrop-blur-sm border border-red-200 hover:bg-white text-red-600 px-6 py-4 text-lg font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105"
              >
                <Heart className="mr-3 h-5 w-5" />
                Body Jam
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
            className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white px-8 py-4 text-lg font-medium rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
          >
            <Mail className="mr-3 h-5 w-5" />
            mihir@my23.ai
          </Button>
        </div>
        
        {/* Coming soon indicator */}
        <div className="text-center animate-slide-up delay-900">
          <div className="inline-flex items-center space-x-2 bg-white/50 backdrop-blur-sm rounded-full px-6 py-3 border border-white/20">
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600 font-medium">📬 Building the future of personalized health</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
