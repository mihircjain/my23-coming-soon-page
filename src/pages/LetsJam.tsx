import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Send, RefreshCw } from "lucide-react";
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

const LetsJam = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [userData, setUserData] = useState<UserData | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Hardcoded userId for consistency
  const userId = "mihir_jain";

  // Fetch user data from Firebase
  const fetchUserData = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
      }

      console.log(`🔄 Fetching user data (forceRefresh: ${forceRefresh})...`);
      
      // Fetch nutrition data
      const nutritionData = await fetchNutritionData();
      
      // Fetch activity data
      const activityData = await fetchActivityData();
      
      // Fetch blood markers
      const bloodMarkers = await fetchBloodMarkers();
      
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
      setRefreshing(false);
    }
  };

  // Manual refresh function
  const handleRefresh = async () => {
    await fetchUserData(true); // Force refresh
  };

  // Fetch nutrition data from Firebase
  const fetchNutritionData = async () => {
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
              
              console.log(`📅 ${date}: ${dayCalories} cal, ${dayProtein}g protein (counted)`);
            } else {
              console.log(`📅 ${date}: No food data (skipped)`);
            }
          }
        } catch (dayError) {
          console.error(`Error fetching nutrition data for ${date}:`, dayError);
        }
      }
      
      console.log(`🥗 Nutrition summary: ${daysWithData} days with data out of ${dates.length} days checked`);
      console.log(`🥗 Totals: ${totalCalories} calories, ${totalProtein}g protein`);
      
      // Calculate averages - ONLY divide by days that actually had food data
      const avgCalories = daysWithData > 0 ? Math.round(totalCalories / daysWithData) : 0;
      const avgProtein = daysWithData > 0 ? Math.round(totalProtein / daysWithData) : 0;
      const avgFat = daysWithData > 0 ? Math.round(totalFat / daysWithData) : 0;
      const avgCarbs = daysWithData > 0 ? Math.round(totalCarbs / daysWithData) : 0;
      const avgFiber = daysWithData > 0 ? Math.round(totalFiber / daysWithData) : 0;
      
      console.log(`🥗 Final averages: ${avgCalories} cal/day, ${avgProtein}g protein/day`);
      
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
  const fetchActivityData = async () => {
    try {
      console.log('🏃 Fetching activity data...');
      
      // First try to get cached data from strava_data collection
      try {
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
            
            totalCaloriesBurned += activity.caloriesBurned || 0;
            totalDuration += activity.duration || 0;
          });
          
          console.log(`🏃 Found ${activityCount} activities, ${activitiesWithHeartRate} with heart rate`);
          
          // Calculate averages and stats
          const avgHeartRate = activitiesWithHeartRate > 0 ? Math.round(totalHeartRate / activitiesWithHeartRate) : 0;
          const avgCaloriesBurned = activityCount > 0 ? Math.round(totalCaloriesBurned / activityCount) : 0;
          const avgDuration = activityCount > 0 ? Math.round(totalDuration / activityCount) : 0;
          const workoutsPerWeek = Math.round((activityCount / 30) * 7); // Approximate workouts per week
          
          return {
            workoutsPerWeek,
            avgHeartRate,
            avgCaloriesBurned,
            avgDuration
          };
        }
        
        // If no cached data, try to fetch from Strava API via our backend
        console.log('🏃 No cached data found, trying API...');
        const activitiesResponse = await fetch('/api/strava?days=30');
        
        if (!activitiesResponse.ok) {
          throw new Error(`Failed to fetch Strava data: ${activitiesResponse.status}`);
        }
        
        const activitiesData = await activitiesResponse.json();
        
        let totalHeartRate = 0;
        let totalCaloriesBurned = 0;
        let totalDuration = 0;
        let activitiesWithHeartRate = 0;
        
        activitiesData.forEach(activity => {
          if (activity.has_heartrate && activity.average_heartrate) {
            totalHeartRate += activity.average_heartrate;
            activitiesWithHeartRate++;
          }
          
          totalCaloriesBurned += activity.calories || Math.round(activity.moving_time / 60 * 7); // Estimate if not available
          totalDuration += Math.round(activity.moving_time / 60); // Convert seconds to minutes
        });
        
        // Calculate averages and stats
        const avgHeartRate = activitiesWithHeartRate > 0 ? Math.round(totalHeartRate / activitiesWithHeartRate) : 0;
        const avgCaloriesBurned = activitiesData.length > 0 ? Math.round(totalCaloriesBurned / activitiesData.length) : 0;
        const avgDuration = activitiesData.length > 0 ? Math.round(totalDuration / activitiesData.length) : 0;
        const workoutsPerWeek = Math.round((activitiesData.length / 30) * 7); // Approximate workouts per week
        
        return {
          workoutsPerWeek,
          avgHeartRate,
          avgCaloriesBurned,
          avgDuration
        };
      } catch (stravaError) {
        console.error("Error fetching Strava data:", stravaError);
        // Return default values if both cached and API data fail
        return {
          workoutsPerWeek: 0,
          avgHeartRate: 0,
          avgCaloriesBurned: 0,
          avgDuration: 0
        };
      }
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

  // FIXED: Fetch blood markers from Firebase with correct structure
  const fetchBloodMarkers = async () => {
    try {
      console.log('🩸 Fetching blood markers...');
      
      // Based on your Firestore structure: blood_markers/mihir_jain
      const bloodMarkersRef = doc(db, "blood_markers", "mihir_jain");
      const bloodMarkersSnapshot = await getDoc(bloodMarkersRef);
      
      if (bloodMarkersSnapshot.exists()) {
        const data = bloodMarkersSnapshot.data();
        console.log('🩸 Blood markers found:', data);
        
        // Return the data directly since it's already structured correctly
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
        console.log("🩸 No blood markers data found");
        return {};
      }
    } catch (error) {
      console.error("Error fetching blood markers:", error);
      return {};
    }
  };

  // FIXED: Send message to chat API with better structured user data
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
      
      console.log('=== SENDING TO CHAT API ===');
      console.log('User message:', currentInput);
      console.log('Previous messages count:', messages.length);
      
      // FIXED: Better structure the userData for clarity
      const structuredUserData = {
        // Clearly separate different data types
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
            // Organize blood markers clearly
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
      
      console.log('Structured user data being sent:', structuredUserData);
      
      // Build messages array with conversation history
      const conversationMessages = [
        ...messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        { role: "user", content: currentInput }
      ];
      
      console.log('Total messages being sent:', conversationMessages.length);
      
      // Call chat API with better structured data
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          source: "lets-jam-chatbot",
          userData: structuredUserData, // ✅ FIXED: Better structured data
          messages: conversationMessages
        })
      });
      
      console.log('API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error(`Chat API error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('API response:', data);
      
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

  // Fetch user data on component mount and add auto-refresh
  useEffect(() => {
    fetchUserData(false); // Don't force refresh on initial load
    
    // Also refresh when window becomes focused (user switches back to tab)
    const handleFocus = () => {
      console.log('🔄 Window focused, checking for data refresh...');
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
            Let's Jam
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Chat with your personal health assistant powered by real data
          </p>
          {lastUpdate && (
            <p className="mt-1 text-sm text-gray-500">
              Last updated: {lastUpdate}
            </p>
          )}
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-grow relative z-10 px-6 md:px-12 py-8 flex flex-col">
     // Updated Health Stats Summary section for LetsJam
// Replace your existing Health Stats Summary section with this:

{/* Health Stats Summary - Improved UI */}
<section className="mb-8">
  <div className="text-center mb-6">
    <h2 className="text-2xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
      Your Health Dashboard
    </h2>
    <p className="text-gray-600 mt-1">30-day averages • Real-time insights</p>
  </div>

  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    {/* Nutrition Card */}
    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-green-700 flex items-center">
          <Utensils className="mr-3 h-6 w-6 text-green-600" />
          Nutrition Averages
        </CardTitle>
      </CardHeader>
      <CardContent>
        {userData ? (
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-white/70 rounded-lg">
              <span className="text-gray-700 font-medium">Daily Calories</span>
              <span className="text-xl font-bold text-green-700">{userData.nutrition.avgCalories}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-2 bg-white/50 rounded-lg">
                <div className="text-lg font-bold text-green-600">{userData.nutrition.avgProtein}g</div>
                <div className="text-xs text-gray-600">Protein</div>
              </div>
              <div className="text-center p-2 bg-white/50 rounded-lg">
                <div className="text-lg font-bold text-green-600">{userData.nutrition.avgCarbs}g</div>
                <div className="text-xs text-gray-600">Carbs</div>
              </div>
              <div className="text-center p-2 bg-white/50 rounded-lg">
                <div className="text-lg font-bold text-green-600">{userData.nutrition.avgFat}g</div>
                <div className="text-xs text-gray-600">Fat</div>
              </div>
              <div className="text-center p-2 bg-white/50 rounded-lg">
                <div className="text-lg font-bold text-green-600">{userData.nutrition.avgFiber}g</div>
                <div className="text-xs text-gray-600">Fiber</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-lg" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
    
    {/* Activity Card */}
    <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-blue-700 flex items-center">
          <Activity className="mr-3 h-6 w-6 text-blue-600" />
          Activity Averages
        </CardTitle>
      </CardHeader>
      <CardContent>
        {userData ? (
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-white/70 rounded-lg">
              <span className="text-gray-700 font-medium">Weekly Workouts</span>
              <span className="text-xl font-bold text-blue-700">{userData.activity.workoutsPerWeek}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-2 bg-white/50 rounded-lg">
                <div className="text-lg font-bold text-blue-600">{userData.activity.avgDuration}</div>
                <div className="text-xs text-gray-600">Avg Minutes</div>
              </div>
              <div className="text-center p-2 bg-white/50 rounded-lg">
                <div className="text-lg font-bold text-blue-600">{userData.activity.avgHeartRate}</div>
                <div className="text-xs text-gray-600">Avg HR (bpm)</div>
              </div>
              <div className="text-center p-2 bg-white/50 rounded-lg">
                <div className="text-lg font-bold text-blue-600">{userData.activity.avgCaloriesBurned}</div>
                <div className="text-xs text-gray-600">Calories/Workout</div>
              </div>
              <div className="text-center p-2 bg-white/50 rounded-lg">
                <div className="text-xs text-gray-600 flex items-center justify-center">
                  <Heart className="h-3 w-3 mr-1 text-red-500" />
                  Cardio Focus
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-lg" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
    
    {/* Blood Markers Card */}
    <Card className="bg-gradient-to-br from-red-50 to-pink-50 border border-red-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-red-700 flex items-center">
          <Droplet className="mr-3 h-6 w-6 text-red-600" />
          Latest Blood Work
        </CardTitle>
      </CardHeader>
      <CardContent>
        {userData && userData.bloodMarkers && Object.keys(userData.bloodMarkers).length > 0 ? (
          <div className="space-y-3">
            {userData.bloodMarkers.date && (
              <div className="text-center p-2 bg-white/70 rounded-lg mb-3">
                <div className="text-sm font-medium text-gray-700">Test Date</div>
                <div className="text-xs text-gray-600">{new Date(userData.bloodMarkers.date).toLocaleDateString()}</div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {userData.bloodMarkers.total_cholesterol && (
                <div className="text-center p-2 bg-white/50 rounded-lg">
                  <div className="text-sm font-bold text-red-600">{userData.bloodMarkers.total_cholesterol}</div>
                  <div className="text-xs text-gray-600">Total Chol</div>
                </div>
              )}
              {userData.bloodMarkers.ldl && (
                <div className="text-center p-2 bg-white/50 rounded-lg">
                  <div className="text-sm font-bold text-red-600">{userData.bloodMarkers.ldl}</div>
                  <div className="text-xs text-gray-600">LDL</div>
                </div>
              )}
              {userData.bloodMarkers.hdl && (
                <div className="text-center p-2 bg-white/50 rounded-lg">
                  <div className="text-sm font-bold text-red-600">{userData.bloodMarkers.hdl}</div>
                  <div className="text-xs text-gray-600">HDL</div>
                </div>
              )}
              {userData.bloodMarkers.calcium && (
                <div className="text-center p-2 bg-white/50 rounded-lg">
                  <div className="text-sm font-bold text-red-600">{userData.bloodMarkers.calcium}</div>
                  <div className="text-xs text-gray-600">Calcium</div>
                </div>
              )}
              {userData.bloodMarkers.glucose && (
                <div className="text-center p-2 bg-white/50 rounded-lg">
                  <div className="text-sm font-bold text-red-600">{userData.bloodMarkers.glucose}</div>
                  <div className="text-xs text-gray-600">Glucose</div>
                </div>
              )}
              {userData.bloodMarkers.hemoglobin && (
                <div className="text-center p-2 bg-white/50 rounded-lg">
                  <div className="text-sm font-bold text-red-600">{userData.bloodMarkers.hemoglobin}</div>
                  <div className="text-xs text-gray-600">Hemoglobin</div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <Droplet className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No blood marker data available</p>
            <p className="text-xs text-gray-400 mt-1">Upload your latest lab results</p>
          </div>
        )}
      </CardContent>
    </Card>
  </div>
</section>
        
        {/* Chat Section */}
        <section className="flex-grow flex flex-col">
          <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm flex-grow flex flex-col">
            <CardHeader>
              <CardTitle className="text-xl">Chat with Your Health Assistant</CardTitle>
              <p className="text-sm text-gray-600">
                Ask about your recent activities, food, and health patterns based on real data
              </p>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col">
              {/* Messages */}
              <div className="flex-grow overflow-y-auto mb-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 my-8">
                    <p>Ask me about your recent food and activities!</p>
                    <p className="text-sm mt-2">Examples:</p>
                    <ul className="text-sm mt-1 space-y-1">
                      <li>"What did I eat yesterday?"</li>
                      <li>"How was my run today?"</li>
                      <li>"What activities did I do this week?"</li>
                      <li>"How many calories did I burn yesterday?"</li>
                      <li>"What about my calcium levels?"</li>
                      <li>"Analyze my blood markers"</li>
                    </ul>
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
                        className={`max-w-[80%] rounded-lg px-4 py-2 ${
                          message.role === "user"
                            ? "bg-blue-500 text-white"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        <p
                          className={`text-xs mt-1 ${
                            message.role === "user"
                              ? "text-blue-100"
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
                <div ref={messagesEndRef} />
              </div>
              
              {/* Input */}
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about your recent food and activities..."
                  disabled={sending}
                  className="flex-grow"
                />
                <Button type="submit" disabled={sending || !input.trim()}>
                  <Send className="h-4 w-4 mr-2" />
                  {sending ? "Sending..." : "Send"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>
      </main>
      
      {/* Footer */}
      <footer className="relative z-10 py-6 px-6 md:px-12 text-center text-sm text-gray-500">
        <p>Powered by Groq AI with your real health data</p>
      </footer>
    </div>
  );
};

export default LetsJam;
