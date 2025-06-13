import React, { useState, useEffect } from 'react';
import { Mail, Activity, Utensils, Heart, BarChart2, MessageSquare, Send, TrendingUp, Flame, Target, Droplet, Bot, Sparkles, Award, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast, Toaster } from 'sonner';
import { db } from '@/lib/firebaseConfig';
import { collection, addDoc, query, where, orderBy, getDocs, limit } from 'firebase/firestore';

// Weekly Goals Component
const WeeklyGoalsTracker: React.FC<{
  weekData: Record<string, any>;
  loading: boolean;
}> = ({ weekData, loading }) => {
  // Calculate weekly totals
  const calculateWeeklyTotals = () => {
    const totals = {
      caloriesBurned: 0,
      protein: 0,
      calorieDeficit: 0,
      activeDays: 0
    };

    const BMR = 1479;
    
    Object.values(weekData).forEach((day: any) => {
      totals.caloriesBurned += day.caloriesBurned || 0;
      totals.protein += day.protein || 0;
      
      const dailyDeficit = (day.caloriesBurned + BMR) - day.caloriesConsumed;
      totals.calorieDeficit += dailyDeficit;
      
      if (day.caloriesBurned > 0 || day.caloriesConsumed > 0) {
        totals.activeDays += 1;
      }
    });

    return totals;
  };

  const weeklyTotals = calculateWeeklyTotals();

  // Weekly Goals
  const goals = {
    caloriesBurned: { target: 3500, label: "Weekly Calories Burned", icon: Flame, color: "orange" },
    protein: { target: 980, label: "Weekly Protein (140g×7)", icon: Utensils, color: "blue" },
    calorieDeficit: { target: 1000, label: "Weekly Calorie Deficit", icon: Target, color: "green" }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return "bg-green-500";
    if (percentage >= 75) return "bg-yellow-500";
    if (percentage >= 50) return "bg-orange-500";
    return "bg-red-500";
  };

  const getWeeklyRating = () => {
    const scores = Object.keys(goals).map(key => {
      const goal = goals[key];
      const actual = weeklyTotals[key];
      return Math.min((actual / goal.target) * 100, 100);
    });
    
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    if (avgScore >= 90) return { rating: "🏆 CHAMPION", color: "text-yellow-600", description: "Crushing all goals!" };
    if (avgScore >= 75) return { rating: "🔥 STRONG", color: "text-orange-600", description: "Excellent progress!" };
    if (avgScore >= 50) return { rating: "💪 BUILDING", color: "text-blue-600", description: "Good momentum!" };
    return { rating: "🌱 STARTING", color: "text-green-600", description: "Every journey begins!" };
  };

  const weeklyRating = getWeeklyRating();

  if (loading) {
    return (
      <Card className="bg-gradient-to-r from-orange-200 to-red-200 rounded-2xl shadow-xl">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-white/30 rounded w-3/4"></div>
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-white/30 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-r from-orange-200 to-red-200 rounded-2xl shadow-xl">
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-orange-700 to-red-700 bg-clip-text text-transparent">
          📊 Weekly Health Goals
        </CardTitle>
        <div className="mt-2">
          <div className={`text-2xl font-bold ${weeklyRating.color}`}>
            {weeklyRating.rating}
          </div>
          <p className="text-sm text-gray-700 mt-1">{weeklyRating.description}</p>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Weekly Goals Progress */}
        <div className="space-y-4">
          {Object.entries(goals).map(([key, goal]) => {
            const actual = weeklyTotals[key];
            const percentage = Math.min((actual / goal.target) * 100, 100);
            const IconComponent = goal.icon;
            
            return (
              <div key={key} className="bg-white/60 rounded-lg p-4 border border-white/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <IconComponent className={`h-5 w-5 text-${goal.color}-600`} />
                    <span className="font-semibold text-gray-800">{goal.label}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-800">
                      {Math.round(actual).toLocaleString()} / {goal.target.toLocaleString()}
                      {key === 'protein' ? 'g' : key === 'calorieDeficit' ? ' cal' : ' cal'}
                    </div>
                    <div className={`text-sm font-semibold ${percentage >= 100 ? 'text-green-600' : percentage >= 75 ? 'text-yellow-600' : 'text-orange-600'}`}>
                      {Math.round(percentage)}%
                    </div>
                  </div>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all duration-500 ${getProgressColor(percentage)}`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
                
                {percentage >= 100 && (
                  <div className="text-xs text-green-600 font-semibold mt-1 flex items-center gap-1">
                    <Award className="h-3 w-3" />
                    Goal Achieved! 🎉
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Weekly Summary Stats */}
        <div className="bg-white/50 rounded-lg p-4 border border-white/30">
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-orange-500" />
            This Week's Summary
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="text-center">
              <div className="font-bold text-lg text-gray-800">{weeklyTotals.activeDays}</div>
              <div className="text-gray-600">Active Days</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-lg text-gray-800">
                {Math.round(weeklyTotals.caloriesBurned / 7)}
              </div>
              <div className="text-gray-600">Avg Daily Burn</div>
            </div>
          </div>
        </div>

        {/* Daily Breakdown - Simplified */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Daily Breakdown</h4>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }, (_, i) => {
              const date = new Date();
              date.setDate(date.getDate() - (6 - i));
              const dateStr = date.toISOString().split('T')[0];
              const dayData = weekData[dateStr] || {};
              const isToday = dateStr === new Date().toISOString().split('T')[0];
              
              const hasActivity = (dayData.caloriesBurned || 0) > 0;
              const BMR = 1479;
              const dailyDeficit = ((dayData.caloriesBurned || 0) + BMR) - (dayData.caloriesConsumed || 0);
              
              return (
                <div 
                  key={dateStr}
                  className={`p-2 rounded text-center text-xs border ${
                    isToday ? 'border-red-500 bg-white/80' : 'border-white/30 bg-white/60'
                  }`}
                >
                  <div className="font-semibold text-gray-600">
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className="mt-1">
                    {hasActivity ? (
                      <div className="space-y-1">
                        <div className={`text-xs font-semibold ${dailyDeficit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {dailyDeficit >= 0 ? '+' : ''}{Math.round(dailyDeficit)}
                        </div>
                        <div className="text-orange-600 font-semibold">
                          {Math.round(dayData.caloriesBurned || 0)}
                        </div>
                      </div>
                    ) : (
                      <div className="text-gray-400 text-xs">Rest</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-xs text-gray-600 text-center mt-2">
            Top: Daily deficit • Bottom: Calories burned
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Health Overview Component with Weekly Goals
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

  useEffect(() => {
    fetchHealthData();
  }, []);

  return (
    <div className="space-y-6">
      <WeeklyGoalsTracker weekData={last7DaysData} loading={loading} />

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
}; dateStr = date.toISOString().split('T')[0];
              const dayData = weekData[dateStr] || {};
              const isToday = dateStr === new Date().toISOString().split('T')[0];
              
              const hasActivity = (dayData.caloriesBurned || 0) > 0;
              const BMR = 1479;
              const dailyDeficit = ((dayData.caloriesBurned || 0) + BMR) - (dayData.caloriesConsumed || 0);
              
              return (
                <div 
                  key={dateStr}
                  className={`p-2 rounded text-center text-xs border ${
                    isToday ? 'border-red-500 bg-white/80' : 'border-white/30 bg-white/60'
                  }`}
                >
                  <div className="font-semibold text-gray-600">
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className="mt-1">
                    {hasActivity ? (
                      <div className="space-y-1">
                        <div className={`text-xs font-semibold ${dailyDeficit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {dailyDeficit >= 0 ? '+' : ''}{Math.round(dailyDeficit)}
                        </div>
                        <div className="text-orange-600 font-semibold">
                          {Math.round(dayData.caloriesBurned || 0)}
                        </div>
                      </div>
                    ) : (
                      <div className="text-gray-400 text-xs">Rest</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-xs text-gray-600 text-center mt-2">
            Top: Daily deficit • Bottom: Calories burned
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
