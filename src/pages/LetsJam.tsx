import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Send, RefreshCw, Heart, Activity, Utensils, Target, TrendingUp, Flame, Bot, Sparkles, MessageSquare, Calendar, Zap, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/lib/firebaseConfig";
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from "firebase/firestore";

// Define types
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

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
}

interface RecentActivity {
  id: string;
  name: string;
  type: string;
  start_date: string;
  distance: number;
  moving_time: number;
  total_elevation_gain: number;
  average_speed: number;
  max_speed: number;
  has_heartrate: boolean;
  average_heartrate?: number;
  max_heartrate?: number;
  calories?: number;
  caloriesBurned?: number;
}

// Enhanced Message Content Component with safe formatting
const MessageContent: React.FC<{ content: string }> = ({ content }) => {
  const formatContent = (text: string) => {
    const lines = text.split('\n');
    
    return lines.map((line, lineIndex) => {
      if (!line.trim()) {
        return <div key={lineIndex} className="h-3" />;
      }
      
      let processedLine = line;
      
      // Handle bullet points
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        processedLine = line.replace(/^[\s]*[-*]\s*/, '• ');
      }
      
      // Handle bold text with safe approach
      const boldMarker = '**';
      const parts = [];
      let currentText = processedLine;
      let index = 0;
      
      while (currentText.length > 0) {
        const boldStart = currentText.indexOf(boldMarker);
        if (boldStart === -1) {
          // No more bold text
          parts.push({ text: currentText, bold: false });
          break;
        }
        
        // Add text before bold
        if (boldStart > 0) {
          parts.push({ text: currentText.substring(0, boldStart), bold: false });
        }
        
        // Find end of bold text
        const boldEnd = currentText.indexOf(boldMarker, boldStart + 2);
        if (boldEnd === -1) {
          // No closing marker, treat as regular text
          parts.push({ text: currentText.substring(boldStart), bold: false });
          break;
        }
        
        // Add bold text
        const boldText = currentText.substring(boldStart + 2, boldEnd);
        parts.push({ text: boldText, bold: true });
        
        // Continue with remaining text
        currentText = currentText.substring(boldEnd + 2);
      }
      
      const formattedParts = parts.map((part, partIndex) => {
        if (part.bold) {
          return (
            <strong key={partIndex} className="font-semibold text-gray-900">
              {part.text}
            </strong>
          );
        }
        return part.text;
      });
      
      return (
        <div key={lineIndex} className="mb-2 last:mb-0 leading-relaxed">
          {formattedParts}
        </div>
      );
    });
  };

  return <div className="text-sm leading-relaxed">{formatContent(content)}</div>;
};

// Daily Health Box Component
const DailyHealthBox: React.FC<{
  data: HealthData;
  date: string;
  isToday: boolean;
  onClick: () => void;
}> = ({ data, date, isToday, onClick }) => {
  const hasData = data.caloriesConsumed > 0 || data.caloriesBurned > 0 || data.heartRate > 0;
  
  const BMR = 1479;
  const calorieDeficit = data.caloriesBurned + BMR - data.caloriesConsumed;
  
  const calculateHealthScore = () => {
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

  return (
    <Card 
      className={`cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg group ${
        hasData 
          ? "bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200 hover:shadow-purple-100" 
          : "bg-gray-50 border-gray-200 hover:shadow-gray-100"
      } ${isToday ? "ring-2 ring-orange-500" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <div className="text-sm font-medium text-gray-600">
              {new Date(date).toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
              })}
            </div>
            {isToday && (
              <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full font-medium">
                Today
              </span>
            )}
          </div>

          {hasData ? (
            <>
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
                    className="bg-gradient-to-r from-purple-400 to-pink-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${healthScore}%` }}
                  />
                </div>
              </div>

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

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-center">
                  <div className="font-semibold text-blue-600">{Math.round(data.protein)}g</div>
                  <div className="text-gray-500">Protein</div>
                </div>
                <div className="text-center">
                  <div className={`font-semibold ${calorieDeficit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {calorieDeficit >= 0 ? '+' : ''}{Math.round(calorieDeficit)}
                  </div>
                  <div className="text-gray-500">Cal Deficit</div>
                </div>
              </div>

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
              <Heart className="h-6 w-6 mx-auto mt-2 text-gray-300 group-hover:text-purple-500 transition-colors" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const LetsJam = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [last7DaysData, setLast7DaysData] = useState<Record<string, HealthData>>({});
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  
  // Session management
  const [sessionId, setSessionId] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('letsJam-chat-session-id');
      if (saved) {
        console.log('🔄 Restored existing session:', saved.slice(-8));
        return saved;
      }
      const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('letsJam-chat-session-id', newId);
      console.log('🆕 Created new session:', newId.slice(-8));
      return newId;
    }
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  });
  
  const userId = "mihir_jain";

  // Session management functions
  const createNewSession = () => {
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setSessionId(newSessionId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('letsJam-chat-session-id', newSessionId);
      localStorage.removeItem(`letsJam-chat-messages-${sessionId}`);
    }
    setMessages([]);
    console.log('🆕 Created new session and cleared chat:', newSessionId.slice(-8));
  };

  const clearCurrentSession = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`letsJam-chat-messages-${sessionId}`);
    }
    setMessages([]);
    console.log('🗑️ Cleared current session messages');
  };

  // Load previous messages
  useEffect(() => {
    if (typeof window !== 'undefined' && sessionId) {
      const loadPreviousMessages = () => {
        try {
          const saved = localStorage.getItem(`letsJam-chat-messages-${sessionId}`);
          if (saved) {
            const parsedMessages = JSON.parse(saved).map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            }));
            setMessages(parsedMessages);
            console.log(`💬 Loaded ${parsedMessages.length} previous messages for session ${sessionId.slice(-8)}`);
          }
        } catch (error) {
          console.error('Failed to load previous messages:', error);
        }
      };
      loadPreviousMessages();
    }
  }, [sessionId]);

  // Save messages
  useEffect(() => {
    if (typeof window !== 'undefined' && messages.length > 0 && sessionId) {
      try {
        localStorage.setItem(`letsJam-chat-messages-${sessionId}`, JSON.stringify(messages));
        console.log(`💾 Saved ${messages.length} messages for session ${sessionId.slice(-8)}`);
      } catch (error) {
        console.error('Failed to save messages:', error);
      }
    }
  }, [messages, sessionId]);

  // Smart scrolling
  useEffect(() => {
    if (messagesEndRef.current && messages.length > 0) {
      const container = messagesEndRef.current.closest('.overflow-y-auto');
      if (container) {
        const { scrollTop, scrollHeight, clientHeight } = container;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        
        if (isNearBottom || messages.length === 1) {
          messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
      } else {
        // If no scrollable container, just scroll to the message
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [messages.length]);

  // Mock data functions (replace with your actual implementations)
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

      // Add your Firebase queries here
      setLast7DaysData(tempData);
    } catch (error) {
      console.error("Error fetching 7-day data:", error);
    }
  };

  const fetchRecentActivities = async () => {
    try {
      console.log('🏃 Fetching recent activities...');
      setRecentActivities([]);
    } catch (error) {
      console.error("Error fetching recent activities:", error);
      setRecentActivities([]);
    }
  };

  const fetchUserData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      if (forceRefresh) {
        setRefreshing(true);
      }

      console.log(`🔄 Fetching user data (forceRefresh: ${forceRefresh})...`);
      
      await Promise.all([
        fetchLast7DaysData(),
        fetchRecentActivities()
      ]);
      
      // Mock user data
      setUserData({
        nutrition: {
          avgCalories: 2200,
          avgProtein: 120,
          avgFat: 80,
          avgCarbs: 250,
          avgFiber: 25
        },
        activity: {
          workoutsPerWeek: 4,
          avgHeartRate: 145,
          avgCaloriesBurned: 350,
          avgDuration: 45
        },
        bloodMarkers: {
          ldl: 95,
          hdl: 55,
          total_cholesterol: 180,
          calcium: 9.8
        }
      });
      
      setLastUpdate(new Date().toLocaleTimeString());
      
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    await fetchUserData(true);
  };

  const handleExampleClick = (exampleText: string) => {
    setInput(exampleText);
    setTimeout(() => {
      sendMessage(exampleText);
    }, 100);
  };

  const sendMessage = async (messageText?: string) => {
    const messageToSend = messageText || input.trim();
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
      if (!messageText) setInput("");
      
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
            }
          }
        }
      };
      
      const conversationMessages = [
        ...messages.slice(-10).map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        { role: "user", content: messageToSend }
      ];
      
      console.log(`🤖 Sending message with session ${sessionId.slice(-8)}, ${conversationMessages.length} messages in context`);
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          sessionId: sessionId,
          source: "lets-jam-chatbot",
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
      
      console.log(`✅ Received response for session ${sessionId.slice(-8)}`);
      
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

  const formatDistance = (distance: number) => {
    if (distance === 0) return '0.00';
    if (distance < 0.1) return distance.toFixed(3);
    return distance.toFixed(2);
  };

  const formatTime = (seconds: number) => {
    if (!seconds) return '0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const formatPace = (distance: number, time: number) => {
    if (distance === 0 || time === 0) return 'N/A';
    const paceSeconds = time / distance;
    const minutes = Math.floor(paceSeconds / 60);
    const seconds = Math.floor(paceSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  };

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date.toISOString().split('T')[0];
  }).reverse();

  return (
    <div ref={topRef} className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 flex flex-col">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-orange-400/10 to-pink-400/10 animate-pulse"></div>
      <div className="absolute top-20 left-20 w-32 h-32 bg-orange-200/30 rounded-full blur-xl animate-bounce"></div>
      <div className="absolute bottom-20 right-20 w-24 h-24 bg-pink-200/30 rounded-full blur-xl animate-bounce delay-1000"></div>
      <div className="absolute top-1/2 right-1/4 w-16 h-16 bg-purple-200/30 rounded-full blur-xl animate-bounce delay-500"></div>
      
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
          
          <div className="flex gap-2">
            <Button 
              onClick={() => createNewSession()}
              variant="outline"
              className="hover:bg-white/20 text-sm"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              New Session
            </Button>
            
            <Button 
              onClick={handleRefresh}
              variant="outline"
              disabled={refreshing}
              className="hover:bg-white/20"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh Data'}
            </Button>
          </div>
        </div>
        
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-600 via-red-600 to-pink-600 bg-clip-text text-transparent">
            🤖 Let's Jam
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Chat with your personal health assistant powered by real data ✨
          </p>
          {lastUpdate && (
            <p className="mt-1 text-sm text-gray-500">
              Last updated: {lastUpdate} • Session: {sessionId.slice(-8)} • Showing last 7 days
            </p>
          )}
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-grow relative z-10 px-4 md:px-8 py-6">
        
        {/* AI Chat Section */}
        <section className="mb-8">
          <Card className="bg-gradient-to-br from-purple-100 to-pink-100 border-purple-200 shadow-lg">
            <CardHeader className="text-center pb-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-gray-600">Session: {sessionId.slice(-8)}</div>
                    <div className="text-xs text-gray-400">{messages.length} messages</div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearCurrentSession}
                  className="text-gray-500 hover:text-gray-700"
                  title="Clear current chat (keep session)"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <CardTitle className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                🤖 AI Health Assistant
              </CardTitle>
              <p className="text-sm text-gray-600 mt-2">
                Ask about your recent activities, food, and health patterns ✨
              </p>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              {/* Messages - Free-flowing design */}
              <div className="space-y-6 mb-8">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 py-12">
                    <div className="mb-8">
                      <Sparkles className="h-12 w-12 mx-auto text-purple-400 mb-4" />
                      <p className="text-lg font-medium">Ask me about your health! 🌟</p>
                      <p className="text-sm text-gray-400 mt-2">Session {sessionId.slice(-8)} • Context preserved across visits</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm max-w-3xl mx-auto">
                      <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                        <p className="font-medium text-purple-700 mb-2">📊 Data Analysis</p>
                        <ul className="space-y-1 text-purple-600 text-left">
                          <li 
                            className="cursor-pointer hover:bg-purple-100 p-2 rounded transition-colors"
                            onClick={() => handleExampleClick("How's my nutrition this week?")}
                          >
                            "How's my nutrition this week?"
                          </li>
                          <li 
                            className="cursor-pointer hover:bg-purple-100 p-2 rounded transition-colors"
                            onClick={() => handleExampleClick("Analyze my workout patterns")}
                          >
                            "Analyze my workout patterns"
                          </li>
                          <li 
                            className="cursor-pointer hover:bg-purple-100 p-2 rounded transition-colors"
                            onClick={() => handleExampleClick("What's my calorie deficit trend?")}
                          >
                            "What's my calorie deficit trend?"
                          </li>
                        </ul>
                      </div>
                      <div className="bg-pink-50 p-4 rounded-lg border border-pink-200">
                        <p className="font-medium text-pink-700 mb-2">🩸 Health Insights</p>
                        <ul className="space-y-1 text-pink-600 text-left">
                          <li 
                            className="cursor-pointer hover:bg-pink-100 p-2 rounded transition-colors"
                            onClick={() => handleExampleClick("Review my blood markers")}
                          >
                            "Review my blood markers"
                          </li>
                          <li 
                            className="cursor-pointer hover:bg-pink-100 p-2 rounded transition-colors"
                            onClick={() => handleExampleClick("How's my protein intake?")}
                          >
                            "How's my protein intake?"
                          </li>
                          <li 
                            className="cursor-pointer hover:bg-pink-100 p-2 rounded transition-colors"
                            onClick={() => handleExampleClick("Give me health recommendations")}
                          >
                            "Give me health recommendations"
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.role === "user" ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[95%] rounded-lg px-5 py-4 ${
                            message.role === "user"
                              ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                              : "bg-white text-gray-800 border border-gray-200 shadow-sm"
                          }`}
                        >
                          <MessageContent content={message.content} />
                          <p
                            className={`text-xs mt-3 ${
                              message.role === "user"
                                ? "text-purple-100"
                                : "text-gray-500"
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
                        <div className="bg-white text-gray-800 border border-gray-200 p-4 rounded-lg">
                          <div className="flex gap-3 items-center">
                            <div className="flex gap-1">
                              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-100"></div>
                              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-200"></div>
                            </div>
                            <span className="text-sm text-gray-500">AI is thinking...</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
              
              {/* Input */}
              <form onSubmit={handleSubmit} className="flex gap-3">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about your health data... 💬"
                  disabled={sending}
                  className="flex-grow border-purple-200 focus:border-purple-400 focus:ring-purple-400"
                />
                <Button 
                  type="submit" 
                  disabled={sending || !input.trim()}
                  className="bg-gradient-to-r from-purple-400 to-pink-400 hover:from-purple-500 hover:to-pink-500 text-white px-6"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {sending ? "Sending..." : "Send"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>

        {/* 7-Day Health Overview */}
        <section className="mb-6">
          <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Heart className="h-4 w-4 text-red-500" />
                Last 7 Days Health Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {[...Array(7)].map((_, i) => (
                    <Skeleton key={i} className="h-32 w-full" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {last7Days.map((date) => (
                    <DailyHealthBox
                      key={date}
                      data={last7DaysData[date] || {
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
                      }}
                      date={date}
                      isToday={date === new Date().toISOString().split('T')[0]}
                      onClick={() => {
                        console.log(`Clicked on ${date}`);
                      }}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Recent Activities Section */}
        <section className="mb-6">
          <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-4 w-4 text-orange-500" />
                Recent Activities (Last 7 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-48 w-full" />
                  ))}
                </div>
              ) : recentActivities.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-4">
                    <Calendar className="h-12 w-12 mx-auto" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">No Recent Activities</h3>
                  <p className="text-gray-600">
                    No activities found in the last 7 days.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recentActivities.map((activity) => (
                    <Card key={activity.id} className="bg-gradient-to-br from-orange-50 to-red-50 border-orange-200 shadow-sm hover:shadow-md transition-all duration-200">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg font-semibold text-gray-800 leading-tight">
                            {activity.name}
                          </CardTitle>
                          <Badge variant="secondary" className="ml-2 shrink-0 bg-orange-100 text-orange-700">
                            {activity.type}
                          </Badge>
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <Calendar className="h-4 w-4 mr-2" />
                          {new Date(activity.start_date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="text-center p-3 bg-orange-100 rounded-lg">
                            <div className="text-2xl font-bold text-orange-600">
                              {formatDistance(activity.distance)}
                            </div>
                            <div className="text-xs text-gray-600">km</div>
                          </div>
                          <div className="text-center p-3 bg-red-100 rounded-lg">
                            <div className="text-2xl font-bold text-red-600">
                              {formatTime(activity.moving_time)}
                            </div>
                            <div className="text-xs text-gray-600">duration</div>
                          </div>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Pace:</span>
                            <span className="font-medium">{formatPace(activity.distance, activity.moving_time)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Elevation:</span>
                            <span className="font-medium">{activity.total_elevation_gain}m</span>
                          </div>
                          {activity.has_heartrate && activity.average_heartrate && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Avg HR:</span>
                              <span className="font-medium flex items-center">
                                <Heart className="h-3 w-3 mr-1 text-red-500" />
                                {activity.average_heartrate} bpm
                              </span>
                            </div>
                          )}
                          {(activity.calories || activity.caloriesBurned) && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Calories:</span>
                              <span className="font-medium flex items-center">
                                <Zap className="h-3 w-3 mr-1 text-yellow-500" />
                                {activity.calories || activity.caloriesBurned}
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Health Summary */}
        <section className="mt-6">
          <Card className="bg-gradient-to-r from-orange-50 to-pink-50 border-orange-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-orange-500" />
                Health Data Summary (7-day averages)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/50 p-3 rounded-lg">
                  <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2 text-sm">
                    <Utensils className="h-3 w-3 text-green-500" />
                    Nutrition (7-day avg)
                  </h3>
                  {userData ? (
                    <ul className="space-y-1 text-sm">
                      <li className="flex justify-between">
                        <span className="text-gray-600">Calories:</span>
                        <span className="font-medium">{userData.nutrition.avgCalories}/day</span>
                      </li>
                      <li className="flex justify-between">
                        <span className="text-gray-600">Protein:</span>
                        <span className="font-medium">{userData.nutrition.avgProtein}g/day</span>
                      </li>
                      <li className="flex justify-between">
                        <span className="text-gray-600">Carbs:</span>
                        <span className="font-medium">{userData.nutrition.avgCarbs}g/day</span>
                      </li>
                      <li className="flex justify-between">
                        <span className="text-gray-600">Fat:</span>
                        <span className="font-medium">{userData.nutrition.avgFat}g/day</span>
                      </li>
                    </ul>
                  ) : (
                    <div className="space-y-1">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  )}
                </div>
                
                <div className="bg-white/50 p-3 rounded-lg">
                  <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2 text-sm">
                    <Activity className="h-3 w-3 text-blue-500" />
                    Activity (7-day avg)
                  </h3>
                  {userData ? (
                    <ul className="space-y-1 text-sm">
                      <li className="flex justify-between">
                        <span className="text-gray-600">Workouts:</span>
                        <span className="font-medium">{userData.activity.workoutsPerWeek}/week</span>
                      </li>
                      <li className="flex justify-between">
                        <span className="text-gray-600">Duration:</span>
                        <span className="font-medium">{userData.activity.avgDuration} min</span>
                      </li>
                      <li className="flex justify-between">
                        <span className="text-gray-600">Heart Rate:</span>
                        <span className="font-medium">{userData.activity.avgHeartRate} bpm</span>
                      </li>
                      <li className="flex justify-between">
                        <span className="text-gray-600">Calories:</span>
                        <span className="font-medium">{userData.activity.avgCaloriesBurned}/workout</span>
                      </li>
                    </ul>
                  ) : (
                    <div className="space-y-1">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  )}
                </div>
                
                <div className="bg-white/50 p-3 rounded-lg">
                  <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2 text-sm">
                    <Heart className="h-3 w-3 text-red-500" />
                    Blood Markers
                  </h3>
                  {userData && userData.bloodMarkers && Object.keys(userData.bloodMarkers).length > 0 ? (
                    <ul className="space-y-1 text-sm">
                      {userData.bloodMarkers.ldl && (
                        <li className="flex justify-between">
                          <span className="text-gray-600">LDL:</span>
                          <span className="font-medium">{userData.bloodMarkers.ldl}</span>
                        </li>
                      )}
                      {userData.bloodMarkers.hdl && (
                        <li className="flex justify-between">
                          <span className="text-gray-600">HDL:</span>
                          <span className="font-medium">{userData.bloodMarkers.hdl}</span>
                        </li>
                      )}
                      {userData.bloodMarkers.total_cholesterol && (
                        <li className="flex justify-between">
                          <span className="text-gray-600">Total Chol:</span>
                          <span className="font-medium">{userData.bloodMarkers.total_cholesterol}</span>
                        </li>
                      )}
                      {userData.bloodMarkers.calcium && (
                        <li className="flex justify-between">
                          <span className="text-gray-600">Calcium:</span>
                          <span className="font-medium">{userData.bloodMarkers.calcium}</span>
                        </li>
                      )}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">No blood data available</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
      
      {/* Footer */}
      <footer className="relative z-10 py-6 px-6 md:px-12 text-center text-sm text-gray-500">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center gap-4 mb-2 md:mb-0">
            <span>Powered by Gemini AI with your real health data</span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <Bot className="h-4 w-4" />
              Intelligent health insights (7-day focus)
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>Session: {sessionId.slice(-8)}</span>
            <span>Last updated: {new Date().toLocaleDateString()}</span>
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
