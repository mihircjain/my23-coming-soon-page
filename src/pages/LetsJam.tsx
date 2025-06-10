import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Send, RefreshCw, Heart, Activity, Utensils, Target, TrendingUp, Flame, Bot, Sparkles, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

// Daily Health Box Component with Health Score
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
    const burnedScore = Math.min(40, (data.caloriesBurned / 300) * 40);
    
    // Protein Score (30% of total) - Target: 140g+ 
    const proteinScore = Math.min(30, (data.protein / 140) * 30);
    
    // Calorie Deficit Score (30% of total) - Progressive scoring
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
          ? "bg-gradient-to-br from-blue-50 to-green-50 border-blue-200 hover:shadow-blue-100" 
          : "bg-gray-50 border-gray-200 hover:shadow-gray-100"
      } ${isToday ? "ring-2 ring-purple-500" : ""}`}
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
              <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded-full font-medium">
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
                    className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full transition-all duration-300"
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
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Hardcoded userId for consistency
  const userId = "mihir_jain";

  // Fetch combined health data for last 7 days
  const fetchLast7DaysData = async () => {
    try {
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

      // Fetch Strava data
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

  // Fetch user data from Firebase
  const fetchUserData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      if (forceRefresh) {
        setRefreshing(true);
      }

      console.log(`🔄 Fetching user data (forceRefresh: ${forceRefresh})...`);
      
      // Fetch both summary data and 7-day data in parallel
      const [nutritionData, activityData, bloodMarkers] = await Promise.all([
        fetchNutritionData(),
        fetchActivityData(),
        fetchBloodMarkers()
      ]);

      // Also fetch 7-day data
      await fetchLast7DaysData();
      
      // Set user data
      const newUserData = {
        nutrition: nutritionData,
        activity: activityData,
        bloodMarkers: bloodMarkers
      };

      setUserData(newUserData);
      setLastUpdate(new Date().toLocaleTimeString());

      console.log('📊 Updated user data:', newUserData);
      
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Manual refresh function
  const handleRefresh = async () => {
    await fetchUserData(true);
  };

  // Fetch nutrition data from Firebase
  const fetchNutritionData = async (): Promise<NutritionData> => {
    try {
      // Get the last 30 days
      const today = new Date();
      const dates = [];
      
      for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(today.getDate() - i);
        dates.push(date.toISOString().split('T')[0]);
      }
      
      // Initialize totals
      let totalCalories = 0;
      let totalProtein = 0;
      let totalFat = 0;
      let totalCarbs = 0;
      let totalFiber = 0;
      let daysWithData = 0;
      
      console.log(`🥗 Fetching nutrition data for ${dates.length} days...`);
      
      // Fetch data for each day
      for (const date of dates) {
        try {
          const logRef = doc(db, "nutritionLogs", date);
          const logSnapshot = await getDoc(logRef);
          
          if (logSnapshot.exists()) {
            const logData = logSnapshot.data();
            
            // Check if we have actual nutrition data (not just empty entries)
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
            
            // Only count days with actual food data (calories > 0)
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
      
      // Calculate averages - ONLY divide by days that actually had food data
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

  // Fetch activity data from Strava API or cached data
  const fetchActivityData = async (): Promise<ActivityData> => {
    try {
      console.log('🏃 Fetching activity data...');
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const stravaDataRef = collection(db, "strava_data");
      const stravaQuery = query(
        stravaDataRef,
        where("userId", "==", userId),
        where("start_date", ">=", thirtyDaysAgo.toISOString()),
        orderBy("start_date", "desc"),
        limit(100)
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
        
        // Calculate averages and stats
        const avgHeartRate = activitiesWithHeartRate > 0 ? Math.round(totalHeartRate / activitiesWithHeartRate) : 0;
        const avgCaloriesBurned = activityCount > 0 ? Math.round(totalCaloriesBurned / activityCount) : 0;
        const avgDuration = activityCount > 0 ? Math.round(totalDuration / activityCount) : 0;
        const workoutsPerWeek = Math.round((activityCount / 30) * 7);
        
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

  // Fetch blood markers from Firebase
  const fetchBloodMarkers = async () => {
    try {
      console.log('🩸 Fetching blood markers...');
      
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

  // Calculate averages from 7-day data
  const calculateAvgMetric = (metric: keyof HealthData) => {
    const validData = Object.values(last7DaysData).filter(d => d[metric] !== null && (d[metric] as number) > 0);
    if (validData.length === 0) return 0;
    const sum = validData.reduce((total, d) => total + ((d[metric] as number) || 0), 0);
    return Math.round(sum / validData.length);
  };

  // Calculate average calorie deficit
  const calculateAvgCalorieDeficit = () => {
    const BMR = 1479;
    const validData = Object.values(last7DaysData).filter(d => d.caloriesConsumed > 0 || d.caloriesBurned > 0);
    if (validData.length === 0) return 0;
    const sum = validData.reduce((total, d) => total + (d.caloriesBurned + BMR - d.caloriesConsumed), 0);
    return Math.round(sum / validData.length);
  };

  // Generate last 7 days dates for the daily boxes
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date.toISOString().split('T')[0];
  }).reverse();

  // Send message to chat API
  const sendMessage = async () => {
    if (!input.trim()) return;
    
    try {
      setSending(true);
      
      // Add user message to chat
      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: input,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, userMessage]);
      const currentInput = input;
      setInput("");
      
      // Structure user data for API
      const structuredUserData = {
        nutrition: {
          type: "nutrition_averages_30_days",
          avgCaloriesPerDay: userData?.nutrition?.avgCalories || 0,
          avgProteinPerDay: userData?.nutrition?.avgProtein || 0,
          avgCarbsPerDay: userData?.nutrition?.avgCarbs || 0,
          avgFatPerDay: userData?.nutrition?.avgFat || 0,
          avgFiberPerDay: userData?.nutrition?.avgFiber || 0
        },
        
        activity: {
          type: "activity_averages_30_days", 
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
        }
      };
      
      // Build messages array with conversation history
      const conversationMessages = [
        ...messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        { role: "user", content: currentInput }
      ];
      
      // Call chat API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
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
      
      // Add assistant response to chat
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: assistantResponse,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
    } catch (error) {
      console.error("Error sending message:", error);
      
      // Add error message
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

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch user data on component mount
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

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex flex-col">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 to-green-400/10 animate-pulse"></div>
      <div className="absolute top-20 left-20 w-32 h-32 bg-blue-200/30 rounded-full blur-xl animate-bounce"></div>
      <div className="absolute bottom-20 right-20 w-24 h-24 bg-green-200/30 rounded-full blur-xl animate-bounce delay-1000"></div>
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
        
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-green-600 bg-clip-text text-transparent">
            🤖 Let's Jam
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Chat with your personal health assistant powered by real data ✨
          </p>
          {lastUpdate && (
            <p className="mt-1 text-sm text-gray-500">
              Last updated: {lastUpdate}
            </p>
          )}
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-grow relative z-10 px-6 md:px-12 py-8">
        
        {/* 7-Day Health Overview */}
        <section className="mb-8">
          <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-red-500" />
                Last 7 Days Health Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
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
              
              {/* Health Score Explanation Footer */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-500" />
                  Health Score Calculation (100 points total)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-600">
                  <div className="space-y-1">
                    <div className="font-medium text-orange-600">Calories Burned (40 pts)</div>
                    <div>🎯 Target: 300+ cal = 40 pts</div>
                    <div>📈 Below: (burned/300) × 40</div>
                  </div>
                  <div className="space-y-1">
                    <div className="font-medium text-purple-600">Protein Intake (30 pts)</div>
                    <div>🎯 Target: 140g+ = 30 pts</div>
                    <div>📈 Below: (protein/140) × 30</div>
                  </div>
                  <div className="space-y-1">
                    <div className="font-medium text-green-600">Calorie Deficit (30 pts)</div>
                    <div>🎯 Progressive scoring:</div>
                    <div>• 0 cal = 0 pts</div>
                    <div>• 1-99 cal = 5 pts</div>
                    <div>• 100+ cal = 10 pts</div>
                    <div>• 200+ cal = 15 pts</div>
                    <div>• 300+ cal = 20 pts</div>
                    <div>• 400+ cal = 25 pts</div>
                    <div>• 500+ cal = 30 pts</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-500 border-t pt-2">
                  <strong>BMR (Basal Metabolic Rate):</strong> 1479 calories/day
                  <br />
                  <strong>Perfect Day Example:</strong> 300+ cal burned (40 pts) + 140g protein (30 pts) + 500+ cal deficit (30 pts) = 100 points 🎉
                  <br />
                  <strong>Deficit Formula:</strong> (Calories Burned + 1479 BMR) - Calories Consumed
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Weekly Averages Section */}
        <section className="mb-8">
          <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Weekly Averages
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Calories In Card */}
            <div className="bg-gradient-to-br from-green-400 to-green-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Calories In</h3>
                <div className="w-10 h-10 bg-white/30 rounded-lg flex items-center justify-center">
                  <Utensils className="h-5 w-5 text-gray-700" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-3xl font-bold text-gray-800">{calculateAvgMetric('caloriesConsumed')}</p>
                <p className="text-sm text-gray-700">cal/day</p>
              </div>
            </div>

            {/* Calories Out Card */}
            <div className="bg-gradient-to-br from-amber-200 to-orange-300 rounded-xl p-6 text-gray-800 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Calories Out</h3>
                <div className="w-10 h-10 bg-white/30 rounded-lg flex items-center justify-center">
                  <Flame className="h-5 w-5 text-gray-700" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-3xl font-bold text-gray-800">{calculateAvgMetric('caloriesBurned')}</p>
                <p className="text-sm text-gray-700">cal/day</p>
              </div>
            </div>

            {/* Protein Card */}
            <div className="bg-gradient-to-br from-purple-200 to-violet-300 rounded-xl p-6 text-gray-800 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Protein</h3>
                <div className="w-10 h-10 bg-white/30 rounded-lg flex items-center justify-center">
                  <Target className="h-5 w-5 text-gray-700" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-3xl font-bold text-gray-800">{calculateAvgMetric('protein')}</p>
                <p className="text-sm text-gray-700">g/day</p>
              </div>
            </div>

            {/* Calorie Deficit Card */}
            <div className="bg-gradient-to-br from-emerald-200 to-blue-300 rounded-xl p-6 text-gray-800 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Cal Deficit</h3>
                <div className="w-10 h-10 bg-white/30 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-gray-700" />
                </div>
              </div>
              <div className="space-y-2">
                <p className={`text-3xl font-bold ${calculateAvgCalorieDeficit() >= 0 ? 'text-gray-800' : 'text-red-700'}`}>
                  {calculateAvgCalorieDeficit() >= 0 ? '+' : ''}{calculateAvgCalorieDeficit()}
                </p>
                <p className="text-sm text-gray-700">cal/day</p>
              </div>
            </div>
          </div>
        </section>

        {/* AI Chat Section */}
        <section className="mb-8">
          <Card className="bg-gradient-to-br from-indigo-100 to-purple-100 border-indigo-200 shadow-lg">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-full flex items-center justify-center mb-4">
                <Bot className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                🤖 AI Health Assistant
              </CardTitle>
              <p className="text-sm text-gray-600 mt-2">
                Ask about your recent activities, food, and health patterns based on real data ✨
              </p>
            </CardHeader>
            <CardContent>
              {/* Messages */}
              <div className="bg-white/60 rounded-lg p-4 h-80 overflow-y-auto mb-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 my-8">
                    <div className="mb-4">
                      <Sparkles className="h-12 w-12 mx-auto text-purple-400 mb-2" />
                      <p className="text-lg font-medium">Ask me about your health! 🌟</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                        <p className="font-medium text-purple-700 mb-1">📊 Data Analysis</p>
                        <ul className="space-y-1 text-purple-600">
                          <li>"How's my nutrition this week?"</li>
                          <li>"Analyze my workout patterns"</li>
                          <li>"What's my calorie deficit trend?"</li>
                        </ul>
                      </div>
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                        <p className="font-medium text-blue-700 mb-1">🩸 Health Insights</p>
                        <ul className="space-y-1 text-blue-600">
                          <li>"Review my blood markers"</li>
                          <li>"How's my protein intake?"</li>
                          <li>"Health recommendations?"</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-4 py-3 ${
                          message.role === "user"
                            ? "bg-indigo-500 text-white"
                            : "bg-white text-gray-800 border border-gray-200 shadow-sm"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        <p
                          className={`text-xs mt-2 ${
                            message.role === "user"
                              ? "text-indigo-100"
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
                  ))
                )}
                {sending && (
                  <div className="flex justify-start">
                    <div className="bg-white text-gray-800 border border-gray-200 p-3 rounded-lg">
                      <div className="flex gap-2 items-center">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-100"></div>
                          <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-200"></div>
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
                  placeholder="Ask about your health data... 💬"
                  disabled={sending}
                  className="flex-grow border-indigo-200 focus:border-indigo-400 focus:ring-indigo-400"
                />
                <Button 
                  type="submit" 
                  disabled={sending || !input.trim()}
                  className="bg-gradient-to-r from-indigo-400 to-purple-400 hover:from-indigo-500 hover:to-purple-500 text-white px-6"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {sending ? "Sending..." : "Send"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>

        {/* Health Stats Summary for AI Context */}
        <section className="mb-8">
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-500" />
                Your Health Summary (30-day averages)
              </CardTitle>
              <p className="text-sm text-gray-600">This data powers your AI assistant's insights</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Nutrition Summary */}
                <div className="bg-white/50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Utensils className="h-4 w-4 text-green-500" />
                    Nutrition
                  </h3>
                  {userData ? (
                    <ul className="space-y-2 text-sm">
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
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  )}
                </div>
                
                {/* Activity Summary */}
                <div className="bg-white/50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-500" />
                    Activity
                  </h3>
                  {userData ? (
                    <ul className="space-y-2 text-sm">
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
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  )}
                </div>
                
                {/* Blood Markers Summary */}
                <div className="bg-white/50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Heart className="h-4 w-4 text-red-500" />
                    Blood Markers
                  </h3>
                  {userData && userData.bloodMarkers && Object.keys(userData.bloodMarkers).length > 0 ? (
                    <ul className="space-y-2 text-sm">
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
                    <p className="text-sm text-gray-500">No blood marker data available</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
      
      {/* Enhanced Footer */}
      <footer className="relative z-10 py-6 px-6 md:px-12 text-center text-sm text-gray-500">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center gap-4 mb-2 md:mb-0">
            <span>Powered by Groq AI with your real health data</span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <Bot className="h-4 w-4" />
              Intelligent health insights
            </span>
          </div>
          <div className="flex items-center gap-4">
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
