import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Send } from "lucide-react";
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
  const [userData, setUserData] = useState<UserData | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Hardcoded userId for consistency
  const userId = "mihir_jain";

  // Fetch user data from Firebase
  const fetchUserData = async () => {
    try {
      // Fetch nutrition data
      const nutritionData = await fetchNutritionData();
      
      // Fetch activity data
      const activityData = await fetchActivityData();
      
      // Fetch blood markers
      const bloodMarkers = await fetchBloodMarkers();
      
      // Set user data
      setUserData({
        nutrition: nutritionData,
        activity: activityData,
        bloodMarkers: bloodMarkers
      });
      
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
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
      
      // Fetch data for each day
      for (const date of dates) {
        try {
          // Use flat structure: nutritionLogs/date
          const logRef = doc(db, "nutritionLogs", date);
          const logSnapshot = await getDoc(logRef);
          
          if (logSnapshot.exists()) {
            const logData = logSnapshot.data();
            
            // Check if entries exist and are valid
            if (logData.entries && Array.isArray(logData.entries)) {
              daysWithData++;
              
              // Sum up macros for the day
              logData.entries.forEach((entry: any) => {
                totalCalories += entry.calories || 0;
                totalProtein += entry.protein || 0;
                totalFat += entry.fat || 0;
                totalCarbs += entry.carbs || 0;
                totalFiber += entry.fiber || 0;
              });
            }
          }
        } catch (dayError) {
          console.error(`Error fetching nutrition data for ${date}:`, dayError);
          // Continue with next date
        }
      }
      
      // Calculate averages
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
  const fetchActivityData = async () => {
    try {
      // First try to get cached data from strava_data collection
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const stravaDataRef = collection(db, "strava_data");
        const stravaQuery = query(
          stravaDataRef,
          where("date", ">=", thirtyDaysAgo.toISOString().split('T')[0]),
          orderBy("date", "desc"),
          limit(30)
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
            
            if (activity.avgHR) {
              totalHeartRate += activity.avgHR;
              activitiesWithHeartRate++;
            }
            
            totalCaloriesBurned += activity.caloriesBurned || 0;
            totalDuration += activity.duration || 0;
          });
          
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

  // Fetch blood markers from Firebase
  const fetchBloodMarkers = async () => {
    try {
      // Use flat structure: blood_markers/mihir_jain
      const bloodMarkersRef = doc(db, "blood_markers", "mihir_jain");
      const bloodMarkersSnapshot = await getDoc(bloodMarkersRef);
      
      if (bloodMarkersSnapshot.exists()) {
        return bloodMarkersSnapshot.data();
      } else {
        console.log("No blood markers data found");
        // Return default values if no data exists
        return {
          ldl: null,
          hdl: null,
          triglycerides: null,
          total_cholesterol: null,
          creatinine: null,
          bun: null,
          egfr: null,
          test_date: null
        };
      }
    } catch (error) {
      console.error("Error fetching blood markers:", error);
      // Return default values on error
      return {
        ldl: null,
        hdl: null,
        triglycerides: null,
        total_cholesterol: null,
        creatinine: null,
        bun: null,
        egfr: null,
        test_date: null
      };
    }
  };

  // Send message to OpenAI API
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
      setInput("");
      
      // Construct system prompt with user data
      const systemPrompt = constructSystemPrompt(userData || {
        nutrition: {
          avgCalories: 0,
          avgProtein: 0,
          avgFat: 0,
          avgCarbs: 0,
          avgFiber: 0
        },
        activity: {
          workoutsPerWeek: 0,
          avgHeartRate: 0,
          avgCaloriesBurned: 0,
          avgDuration: 0
        },
        bloodMarkers: {}
      });
      
      // Call OpenAI API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId, // Use hardcoded userId
          source: "lets-jam-chatbot",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: input }
          ]
        })
      });
      
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }
      
      const data = await response.json();
      const assistantResponse = data.choices[0].message.content;
      
      // Add assistant response to chat
      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: assistantResponse,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
    } catch (error) {
      console.error("Error sending message:", error);
      
      // Add error message
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: "Sorry, I encountered an error processing your request. Please try again later.",
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setSending(false);
    }
  };

  // Construct system prompt with user data
  const constructSystemPrompt = (data: UserData) => {
    let prompt = `You are a personal health assistant. Use only the user's actual data below:\n\n`;
    
    // Add nutrition data
    prompt += `- Avg calories consumed: ${data.nutrition.avgCalories}/day\n`;
    prompt += `- Avg protein: ${data.nutrition.avgProtein}g/day\n`;
    prompt += `- Avg fat: ${data.nutrition.avgFat}g/day\n`;
    prompt += `- Avg carbs: ${data.nutrition.avgCarbs}g/day\n`;
    prompt += `- Avg fiber: ${data.nutrition.avgFiber}g/day\n\n`;
    
    // Add activity data
    prompt += `- Workouts: ${data.activity.workoutsPerWeek}/week\n`;
    prompt += `- Avg workout duration: ${data.activity.avgDuration} minutes\n`;
    prompt += `- Avg heart rate: ${data.activity.avgHeartRate} bpm\n`;
    prompt += `- Avg calories burned: ${data.activity.avgCaloriesBurned}/workout\n\n`;
    
    // Add blood markers if available
    if (data.bloodMarkers && Object.keys(data.bloodMarkers).length > 0) {
      prompt += "- Blood markers:\n";
      if (data.bloodMarkers.ldl) prompt += `  - LDL: ${data.bloodMarkers.ldl} mg/dL\n`;
      if (data.bloodMarkers.hdl) prompt += `  - HDL: ${data.bloodMarkers.hdl} mg/dL\n`;
      if (data.bloodMarkers.triglycerides) prompt += `  - Triglycerides: ${data.bloodMarkers.triglycerides} mg/dL\n`;
      if (data.bloodMarkers.total_cholesterol) prompt += `  - Total Cholesterol: ${data.bloodMarkers.total_cholesterol} mg/dL\n`;
      if (data.bloodMarkers.creatinine) prompt += `  - Creatinine: ${data.bloodMarkers.creatinine} mg/dL\n`;
      if (data.bloodMarkers.bun) prompt += `  - BUN: ${data.bloodMarkers.bun} mg/dL\n`;
      if (data.bloodMarkers.egfr) prompt += `  - eGFR: ${data.bloodMarkers.egfr} mL/min/1.73m²\n`;
      if (data.bloodMarkers.test_date) prompt += `  - Test date: ${data.bloodMarkers.test_date}\n`;
      prompt += "\n";
    } else {
      prompt += "- Blood markers: No data available\n\n";
    }
    
    prompt += `Answer concisely based only on this data. If data is missing or insufficient to answer the question, say so. Do not give medical advice beyond what can be directly inferred from this data. If unsure, say "not enough data".`;
    
    return prompt;
  };

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch user data on component mount
  useEffect(() => {
    fetchUserData();
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
        <Button 
          onClick={() => navigate('/')} 
          variant="ghost" 
          className="mb-6 hover:bg-white/20"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>
        
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-green-600 bg-clip-text text-transparent">
            Let's Jam
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Chat with your personal health assistant
          </p>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-grow relative z-10 px-6 md:px-12 py-8 flex flex-col">
        {/* Health Stats Summary */}
        <section className="mb-8">
          <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Your Health Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Nutrition Summary */}
                <div>
                  <h3 className="font-medium text-gray-800 mb-2">Nutrition (30-day avg)</h3>
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
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  )}
                </div>
                
                {/* Activity Summary */}
                <div>
                  <h3 className="font-medium text-gray-800 mb-2">Activity (30-day avg)</h3>
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
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  )}
                </div>
                
                {/* Blood Markers Summary */}
                <div>
                  <h3 className="font-medium text-gray-800 mb-2">Blood Markers</h3>
                  {userData && userData.bloodMarkers && Object.keys(userData.bloodMarkers).length > 0 ? (
                    <ul className="space-y-1 text-sm">
                      {userData.bloodMarkers.ldl && (
                        <li className="flex justify-between">
                          <span className="text-gray-600">LDL:</span>
                          <span className="font-medium">{userData.bloodMarkers.ldl} mg/dL</span>
                        </li>
                      )}
                      {userData.bloodMarkers.hdl && (
                        <li className="flex justify-between">
                          <span className="text-gray-600">HDL:</span>
                          <span className="font-medium">{userData.bloodMarkers.hdl} mg/dL</span>
                        </li>
                      )}
                      {userData.bloodMarkers.triglycerides && (
                        <li className="flex justify-between">
                          <span className="text-gray-600">Triglycerides:</span>
                          <span className="font-medium">{userData.bloodMarkers.triglycerides} mg/dL</span>
                        </li>
                      )}
                      {userData.bloodMarkers.test_date && (
                        <li className="flex justify-between">
                          <span className="text-gray-600">Test Date:</span>
                          <span className="font-medium">{userData.bloodMarkers.test_date}</span>
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
        
        {/* Chat Section */}
        <section className="flex-grow flex flex-col">
          <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm flex-grow flex flex-col">
            <CardHeader>
              <CardTitle className="text-xl">Chat with Your Health Assistant</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col">
              {/* Messages */}
              <div className="flex-grow overflow-y-auto mb-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 my-8">
                    <p>Ask me anything about your health data!</p>
                    <p className="text-sm mt-2">Examples:</p>
                    <ul className="text-sm mt-1 space-y-1">
                      <li>"How much protein am I eating on average?"</li>
                      <li>"What's my workout frequency?"</li>
                      <li>"How are my cholesterol levels?"</li>
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
                  placeholder="Type your message..."
                  disabled={sending || !userData}
                  className="flex-grow"
                />
                <Button type="submit" disabled={sending || !input.trim() || !userData}>
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>
      </main>
      
      {/* Footer */}
      <footer className="relative z-10 py-6 px-6 md:px-12 text-center text-sm text-gray-500">
        <p>Powered by OpenAI GPT-4</p>
      </footer>
    </div>
  );
};

export default LetsJam;
