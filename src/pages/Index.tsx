import React, { useState, useEffect } from 'react';
import { Mail, Activity, Utensils, Heart, BarChart2, Flask, MessageSquare, Send, TrendingUp, Flame, Target, Droplet, Calendar, Bot, Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast, Toaster } from 'sonner';
import { db } from '@/lib/firebaseConfig';
import { collection, addDoc, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import Chart from 'chart.js/auto';

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

// Email Signup Component
const EmailSignupCard: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      toast.success('🎉 Thanks for signing up! We\'ll keep you updated.');
      setEmail('');
    } catch (error) {
      console.error('Error saving email:', error);
      toast.error('Failed to sign up. Please try again.');
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
          Get notified about new features & health insights
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
          />
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
                Subscribe
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

// Feedback Component
const FeedbackCard: React.FC = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'suggestion' | 'feature_request' | 'feedback'>('suggestion');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error('Please enter your feedback or suggestion');
      return;
    }

    setIsSubmitting(true);
    try {
      const feedbackData: UserFeedback = {
        email: email || undefined,
        message: message.trim(),
        type,
        timestamp: new Date().toISOString()
      };

      await addDoc(collection(db, 'user_feedback'), feedbackData);
      toast.success('🙏 Thank you for your feedback!');
      setEmail('');
      setMessage('');
    } catch (error) {
      console.error('Error saving feedback:', error);
      toast.error('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-blue-100 to-cyan-100 border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="text-center pb-4">
        <div className="mx-auto w-12 h-12 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-full flex items-center justify-center mb-3">
          <MessageSquare className="h-6 w-6 text-white" />
        </div>
        <CardTitle className="text-lg font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
          💭 Share Ideas
        </CardTitle>
        <p className="text-sm text-gray-600">
          Help us build better health tracking
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleFeedbackSubmit} className="space-y-3">
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
                    ? 'bg-blue-200 text-blue-700 border border-blue-300'
                    : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                {option.icon} {option.label}
              </button>
            ))}
          </div>
          
          <Input
            type="email"
            placeholder="Email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border-blue-200 focus:border-blue-400 focus:ring-blue-400 text-sm"
            disabled={isSubmitting}
          />
          
          <Textarea
            placeholder="What would you like to see in My23.ai?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="rounded-lg border-blue-200 focus:border-blue-400 focus:ring-blue-400 resize-none text-sm"
            disabled={isSubmitting}
          />
          
          <Button
            type="submit"
            disabled={isSubmitting || !message.trim()}
            className="w-full bg-gradient-to-r from-blue-400 to-cyan-400 hover:from-blue-500 hover:to-cyan-500 text-white py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 text-sm"
          >
            {isSubmitting ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

// Health Overview Component
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
      
      // Render chart after data is loaded
      setTimeout(() => {
        renderHealthChart(sortedData);
      }, 100);

    } catch (error) {
      console.error("Error fetching health data:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderHealthChart = (data: HealthData[]) => {
    const container = document.getElementById('mini-health-chart');
    if (!container) return;

    let canvas = container.querySelector('canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      container.appendChild(canvas);
    } else {
      const chartInstance = Chart.getChart(canvas);
      if (chartInstance) {
        chartInstance.destroy();
      }
    }

    const dateLabels = data.map(d => {
      const date = new Date(d.date);
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    });

    new Chart(canvas, {
      type: 'line',
      data: {
        labels: dateLabels,
        datasets: [
          {
            label: 'Calories In',
            data: data.map(d => d.caloriesConsumed),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: false,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 3
          },
          {
            label: 'Calories Out',
            data: data.map(d => d.caloriesBurned),
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            fill: false,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 3
          },
          {
            label: 'Protein',
            data: data.map(d => d.protein),
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            fill: false,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 3,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            display: true,
            grid: { display: false },
            ticks: { font: { size: 10 } }
          },
          y: {
            display: true,
            position: 'left',
            grid: { color: 'rgba(226, 232, 240, 0.3)' },
            ticks: { font: { size: 10 } }
          },
          y1: {
            type: 'linear',
            display: false,
            position: 'right'
          }
        }
      }
    });
  };

  const calculateAverage = (metric: keyof HealthData) => {
    const validData = healthData.filter(d => d[metric] !== null && (d[metric] as number) > 0);
    if (validData.length === 0) return 0;
    const sum = validData.reduce((total, d) => total + ((d[metric] as number) || 0), 0);
    return Math.round(sum / validData.length);
  };

  useEffect(() => {
    fetchHealthData();
  }, []);

  return (
    <Card className="bg-gradient-to-br from-green-100 to-blue-100 border-green-200 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="text-center pb-4">
        <div className="mx-auto w-12 h-12 bg-gradient-to-br from-green-400 to-blue-400 rounded-full flex items-center justify-center mb-3">
          <BarChart2 className="h-6 w-6 text-white" />
        </div>
        <CardTitle className="text-lg font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
          📊 Health Overview
        </CardTitle>
        <p className="text-sm text-gray-600">
          Your last 7 days at a glance
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Mini Chart */}
            <div className="h-24 w-full bg-white/50 rounded-lg p-2" id="mini-health-chart"></div>
            
            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center bg-white/60 rounded-lg py-2 border border-green-200">
                <div className="font-bold text-green-600">{calculateAverage('caloriesConsumed')}</div>
                <div className="text-green-700">Avg Cal In</div>
              </div>
              <div className="text-center bg-white/60 rounded-lg py-2 border border-orange-200">
                <div className="font-bold text-orange-600">{calculateAverage('caloriesBurned')}</div>
                <div className="text-orange-700">Avg Cal Out</div>
              </div>
              <div className="text-center bg-white/60 rounded-lg py-2 border border-purple-200">
                <div className="font-bold text-purple-600">{calculateAverage('protein')}g</div>
                <div className="text-purple-700">Avg Protein</div>
              </div>
            </div>

            {/* Blood Markers */}
            {bloodMarkers && (
              <div className="mt-3 p-3 bg-white/60 rounded-lg border border-red-200">
                <div className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1">
                  <Droplet className="h-3 w-3" />
                  Latest Blood Work
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(bloodMarkers.markers).slice(0, 4).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-gray-600">{key}:</span>
                      <span className="font-medium text-gray-800">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Chatbot Card Component
const ChatbotCard: React.FC = () => {
  const handleChatClick = () => {
    window.location.href = '/lets-jam';
  };

  return (
    <Card className="bg-gradient-to-br from-indigo-100 to-purple-100 border-indigo-200 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer" onClick={handleChatClick}>
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
            <div className="text-xs text-gray-600 mb-1">Try asking:</div>
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

        {/* Interactive Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <HealthOverviewCard />
          <ChatbotCard />
          <EmailSignupCard />
          <FeedbackCard />
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
