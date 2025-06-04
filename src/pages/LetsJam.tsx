import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Send, User, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/firebaseConfig";
import { collection, doc, getDoc, getDocs, query, where, orderBy, limit } from "firebase/firestore";

// Define types for our data
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
  bloodMarkers: {
    ldl?: number;
    hdl?: number;
    triglycerides?: number;
    totalCholesterol?: number;
    creatinine?: number;
    testDate?: string;
  };
}

const LetsJam = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [userData, setUserData] = useState<UserData | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch user data from Firebase
  const fetchUserData = async () => {
    try {
      setLoading(true);
      
      // Fetch nutrition data
      const nutritionData = await fetchNutritionData();
      
      // Fetch activity data
      const activityData = await fetchActivityData();
      
      // Fetch blood markers
      const bloodMarkersData = await fetchBloodMarkers();
      
      // Combine all data
      setUserData({
        nutrition: nutritionData,
        activity: activityData,
        bloodMarkers: bloodMarkersData
      });
      
      // Add welcome message
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: "Hello! I'm your health assistant. I can answer questions about your nutrition, activity, and health markers based on your data. What would you like to know?",
          timestamp: new Date()
        }
      ]);
      
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch nutrition data from Firebase
  const fetchNutritionData = async () => {
    try {
      // Get the last 30 days of nutrition logs
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const nutritionLogsRef = collection(db, "nutrition_logs");
      const nutritionQuery = query(
        nutritionLogsRef,
        where("userId", "==", "mihir_jain"),
        where("date", ">=", thirtyDaysAgo.toISOString().split('T')[0]),
        orderBy("date", "desc")
      );
      
      const nutritionSnapshot = await getDocs(nutritionQuery);
      
      let totalCalories = 0;
      let totalProtein = 0;
      let totalFat = 0;
      let totalCarbs = 0;
      let totalFiber = 0;
      let daysWithData = 0;
      
      nutritionSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.totals) {
          totalCalories += data.totals.calories || 0;
          totalProtein += data.totals.protein || 0;
          totalFat += data.totals.fat || 0;
          totalCarbs += data.totals.carbs || 0;
          totalFiber += data.totals.fiber || 0;
          daysWithData++;
        }
      });
      
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

  // Fetch activity data from Firebase or Strava API
  const fetchActivityData = async () => {
    try {
      // Try to get cached Strava data from Firebase first
      const stravaDataRef = collection(db, "strava_data");
      const stravaQuery = query(
        stravaDataRef,
        where("userId", "==", "mihir_jain"),
        orderBy("date", "desc"),
        limit(30)
      );
      
      const stravaSnapshot = await getDocs(stravaQuery);
      
      // If we have cached data, use it
      if (!stravaSnapshot.empty) {
        let totalHeartRate = 0;
        let totalCaloriesBurned = 0;
        let totalDuration = 0;
        let activitiesWithHeartRate = 0;
        let totalActivities = 0;
        
        stravaSnapshot.forEach(doc => {
          const data = doc.data();
          totalActivities++;
          
          if (data.heart_rate) {
            totalHeartRate += data.heart_rate;
            activitiesWithHeartRate++;
          }
          
          totalCaloriesBurned += data.calories || 0;
          totalDuration += data.duration || 0;
        });
        
        // Calculate averages and stats
        const avgHeartRate = activitiesWithHeartRate > 0 ? Math.round(totalHeartRate / activitiesWithHeartRate) : 0;
        const avgCaloriesBurned = totalActivities > 0 ? Math.round(totalCaloriesBurned / totalActivities) : 0;
        const avgDuration = totalActivities > 0 ? Math.round(totalDuration / totalActivities) : 0;
        const workoutsPerWeek = Math.round((totalActivities / 30) * 7); // Approximate workouts per week
        
        return {
          workoutsPerWeek,
          avgHeartRate,
          avgCaloriesBurned,
          avgDuration
        };
      } else {
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
      const bloodMarkersRef = doc(db, "blood_markers", "mihir_jain");
      const bloodMarkersSnapshot = await getDoc(bloodMarkersRef);
      
      if (bloodMarkersSnapshot.exists()) {
        return bloodMarkersSnapshot.data();
      } else {
        console.log("No blood markers data found");
        return {};
      }
    } catch (error) {
      console.error("Error fetching blood markers:", error);
      return {};
    }
  };

  // Send message to OpenAI API
  const sendMessage = async () => {
    if (!input.trim() || !userData) return;
    
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
      const systemPrompt = constructSystemPrompt(userData);
      
      // Call OpenAI API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "gpt-4-turbo",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: input }
          ],
          temperature: 0.7,
          max_tokens: 500
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
    if (Object.keys(data.bloodMarkers).length > 0) {
      prompt += "- Blood markers:\n";
      if (data.bloodMarkers.ldl) prompt += `  - LDL: ${data.bloodMarkers.ldl} mg/dL\n`;
      if (data.bloodMarkers.hdl) prompt += `  - HDL: ${data.bloodMarkers.hdl} mg/dL\n`;
      if (data.bloodMarkers.triglycerides) prompt += `  - Triglycerides: ${data.bloodMarkers.triglycerides} mg/dL\n`;
      if (data.bloodMarkers.totalCholesterol) prompt += `  - Total Cholesterol: ${data.bloodMarkers.totalCholesterol} mg/dL\n`;
      if (data.bloodMarkers.creatinine) prompt += `  - Creatinine: ${data.bloodMarkers.creatinine} mg/dL\n`;
      if (data.bloodMarkers.testDate) prompt += `  - Test date: ${data.bloodMarkers.testDate}\n`;
      prompt += "\n";
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
            Ask your health assistant about your data
          </p>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-grow relative z-10 px-6 md:px-12 py-8 flex flex-col">
        <Card className="flex-grow bg-white/80 backdrop-blur-sm border border-white/20 shadow-sm flex flex-col">
          <CardHeader>
            <CardTitle className="text-xl">Chat with your health assistant</CardTitle>
          </CardHeader>
          
          <CardContent className="flex-grow flex flex-col">
            {/* Messages area */}
            <div className="flex-grow overflow-y-auto mb-4 space-y-4">
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-12 w-3/4" />
                  <Skeleton className="h-12 w-1/2 ml-auto" />
                  <Skeleton className="h-12 w-2/3" />
                </div>
              ) : (
                messages.map(message => (
                  <div 
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div 
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        message.role === 'user' 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      <div className="flex items-center mb-1">
                        {message.role === 'user' ? (
                          <User className="h-4 w-4 mr-2" />
                        ) : (
                          <Bot className="h-4 w-4 mr-2" />
                        )}
                        <span className="text-xs opacity-75">
                          {message.role === 'user' ? 'You' : 'Health Assistant'}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            
            {/* Input area */}
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your health data..."
                disabled={loading || sending}
                className="flex-grow"
              />
              <Button 
                type="submit" 
                disabled={loading || sending || !input.trim()}
              >
                <Send className="h-4 w-4 mr-2" />
                Send
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
      
      {/* Footer */}
      <footer className="relative z-10 py-6 px-6 md:px-12 text-center text-sm text-gray-500">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div>Powered by OpenAI</div>
          <div>Data from your health logs</div>
        </div>
      </footer>
    </div>
  );
};

export default LetsJam;
