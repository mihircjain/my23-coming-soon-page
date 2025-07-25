import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft,
  Bot,
  Sparkles,
  Mic,
  MicOff
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  doc, 
  getDoc 
} from 'firebase/firestore';
import { db } from '../lib/firebase';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  context: ConversationContext;
  lastUpdated: Date;
  createdAt: Date;
}

interface MCPResponse {
  endpoint: string;
  data: any;
  success: boolean;
  error?: string;
}

interface NutritionResponse {
  success: boolean;
  data: any;
  error?: string;
}

interface SleepResponse {
  success: boolean;
  data: any;
  error?: string;
}

interface StravaStats {
  connected: boolean;
  lastChecked: string;
}

interface ConversationContext {
  lastDate?: string;        // "june 24", "yesterday" 
  lastDateParsed?: Date;    // Actual date object
  lastActivityIds?: string[]; // Activity IDs from last query
  lastQueryType?: string;   // "single_date", "date_range", etc.
  lastActivities?: string;  // Activity descriptions for reference
  // Enhanced context preservation
  cachedData?: {
    mcpResponses?: MCPResponse[];
    nutritionData?: any;
    sleepData?: any;
    dateRange?: { startDate: Date; endDate: Date };
    fetchedAt?: Date;
  };
  conversationHistory?: Array<{
    query: string;
    intent: string;
    dateRange?: { startDate: Date; endDate: Date };
    timestamp: Date;
  }>;
}

interface WeeklyMetrics {
  caloriesBurned: number;
  caloriesConsumed: number;
  protein: number;
  activities: string[];
  lastUpdated: string;
}

interface QueryIntent {
  type: 'nutrition_only' | 'running_only' | 'cycling_only' | 'swimming_only' | 'nutrition_and_running' | 'nutrition_and_cycling' | 'nutrition_and_swimming' | 'sleep_only' | 'sleep_and_running' | 'sleep_and_cycling' | 'sleep_and_swimming' | 'sleep_and_nutrition' | 'all_data' | 'general';
  needsNutrition: boolean;
  needsRunning: boolean;
  needsCycling: boolean;
  needsSwimming: boolean;
  needsSleep: boolean;
  dateRange?: { startDate: Date; endDate: Date };
  nutritionDataTypes?: string[];
  runningDataTypes?: string[];
  cyclingDataTypes?: string[];
  swimmingDataTypes?: string[];
  sleepDataTypes?: string[];
  isSmartTiming?: boolean;
  primarySport?: 'running' | 'cycling' | 'swimming' | 'all';
}

export default function CoachNew() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [context, setContext] = useState<ConversationContext>({});
  const [weeklyMetrics, setWeeklyMetrics] = useState<WeeklyMetrics>({
    caloriesBurned: 0,
    caloriesConsumed: 0,
    protein: 0,
    activities: [],
    lastUpdated: ''
  });
  const [metricsLoading, setMetricsLoading] = useState(false);
  
  // Chat history management
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Enhanced speech recognition state
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSending, setIsSending] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Chat session management functions
  const loadChatSessions = () => {
    try {
      const savedSessions = localStorage.getItem('healthCoachSessions');
      if (savedSessions) {
        const sessions: ChatSession[] = JSON.parse(savedSessions).map((session: any) => ({
          ...session,
          lastUpdated: new Date(session.lastUpdated),
          createdAt: new Date(session.createdAt),
          messages: session.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        }));
        setChatSessions(sessions);
        
        // Load the most recent session if no current session
        if (!currentSessionId && sessions.length > 0) {
          const mostRecent = sessions.sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime())[0];
          loadSession(mostRecent.id);
        }
      }
    } catch (error) {
      console.error('Error loading chat sessions:', error);
    }
  };

  const saveChatSessions = (sessions: ChatSession[]) => {
    try {
      localStorage.setItem('healthCoachSessions', JSON.stringify(sessions));
    } catch (error) {
      console.error('Error saving chat sessions:', error);
    }
  };

  const generateSessionTitle = (firstMessage: string): string => {
    // Generate a smart title from the first message
    const words = firstMessage.toLowerCase().split(' ');
    if (words.includes('nutrition') || words.includes('food') || words.includes('eat')) {
      return '🍽️ Nutrition Analysis';
    } else if (words.includes('sleep') || words.includes('rest')) {
      return '😴 Sleep Analysis';
    } else if (words.includes('run') || words.includes('activity') || words.includes('workout')) {
      return '🏃 Running Analysis';
    } else if (words.includes('last') && words.includes('days')) {
      const days = words.find(w => /\d+/.test(w));
      return `📊 Last ${days || '7'} Days`;
    } else {
      return `💬 ${firstMessage.substring(0, 30)}${firstMessage.length > 30 ? '...' : ''}`;
    }
  };

  const createNewSession = (): string => {
    const sessionId = Date.now().toString();
    const newSession: ChatSession = {
      id: sessionId,
      title: 'New Conversation',
      messages: [],
      context: {},
      lastUpdated: new Date(),
      createdAt: new Date()
    };
    
    setChatSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(sessionId);
    setMessages([]);
    setContext({});
    
    return sessionId;
  };

  const loadSession = (sessionId: string) => {
    const session = chatSessions.find(s => s.id === sessionId);
    if (session) {
      setCurrentSessionId(sessionId);
      setMessages(session.messages);
      setContext(session.context);
    }
  };

  const updateCurrentSession = () => {
    if (!currentSessionId) return;
    
    setChatSessions(prev => prev.map(session => {
      if (session.id === currentSessionId) {
        const updatedSession = {
          ...session,
          messages: [...messages],
          context: {...context},
          lastUpdated: new Date()
        };
        
        // Update title based on first message if it's still "New Conversation"
        if (session.title === 'New Conversation' && messages.length > 0) {
          const firstUserMessage = messages.find(m => m.role === 'user');
          if (firstUserMessage) {
            updatedSession.title = generateSessionTitle(firstUserMessage.content);
          }
        }
        
        return updatedSession;
      }
      return session;
    }));
  };

  const deleteSession = (sessionId: string) => {
    setChatSessions(prev => {
      const updated = prev.filter(s => s.id !== sessionId);
      saveChatSessions(updated);
      
      // If we deleted the current session, create a new one
      if (sessionId === currentSessionId) {
        createNewSession();
      }
      
      return updated;
    });
  };

  const renameSession = (sessionId: string, newTitle: string) => {
    setChatSessions(prev => prev.map(session => 
      session.id === sessionId 
        ? { ...session, title: newTitle, lastUpdated: new Date() }
        : session
    ));
  };

  useEffect(() => {
    loadChatSessions();
    fetchWeeklyMetrics();
    
    // Enhanced speech recognition setup
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      recognitionRef.current = new SpeechRecognition();
      
      // Enhanced settings for better real-time experience
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';
      recognitionRef.current.maxAlternatives = 3;
      
      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        // Process all results
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }
        
        // Update interim results in real-time
        if (interimTranscript) {
          const correctedInterim = correctHealthTerms(interimTranscript);
          setInterimTranscript(correctedInterim);
          // FIXED: Show interim results but don't overwrite existing typed text
          setInput(correctedInterim);
        }
        
        // Handle final result
        if (finalTranscript) {
          const correctedFinal = correctHealthTerms(finalTranscript);
          // FIXED: Use the corrected final transcript as the complete input
          setInput(correctedFinal);
          setInterimTranscript('');
          setIsRecording(false);
          
          // Auto-submit with slight delay
          setTimeout(() => {
            if (correctedFinal.trim()) {
              handleSendMessage();
            }
          }, 200);
        }
      };
      
      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
        setInterimTranscript('');
        
        // Provide user feedback for common errors
        if (event.error === 'no-speech') {
          setInput('(No speech detected - try speaking closer to microphone)');
        } else if (event.error === 'network') {
          setInput('(Network error - check your connection)');
        }
      };
      
      recognitionRef.current.onend = () => {
        setIsRecording(false);
        setInterimTranscript('');
      };
      
      recognitionRef.current.onstart = () => {
        setInterimTranscript('');
        // FIXED: Don't clear existing input on start
        console.log('🎤 Voice recording started');
      };
    }
  }, []);

  // Auto-save sessions when they change
  useEffect(() => {
    if (chatSessions.length > 0) {
      saveChatSessions(chatSessions);
    }
  }, [chatSessions]);

  // Update current session when messages or context change
  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
      updateCurrentSession();
    }
  }, [messages, context]);

  // Ensure we always have a current session
  useEffect(() => {
    if (!currentSessionId && chatSessions.length === 0) {
      createNewSession();
    }
  }, [currentSessionId, chatSessions]);

  const testMCPConnection = async () => {
    try {
      const response = await fetch('/api/runs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'test_connection'
        })
      });
    } catch (error) {
      console.log('MCP connection test failed');
    }
  };

  // Enhanced speech recognition functions with health context
  const correctHealthTerms = (transcript: string): string => {
    const corrections: Record<string, string> = {
      // Common speech recognition errors
      'wood': 'food',
      'would': 'food', // Another common misinterpretation
      'foot': 'food',
      'mood': 'food',
      'hood': 'food',
      
      // Health metrics
      'nutrition': 'nutrition',
      'nutriotn': 'nutrition',
      'protien': 'protein',
      'protean': 'protein',
      'protein': 'protein',
      'calorie': 'calorie',
      'calories': 'calories',
      'carbs': 'carbs',
      'carbohydrates': 'carbohydrates',
      'fiber': 'fiber',
      'fibre': 'fiber',
      
      // Food-related terms
      'food': 'food',
      'foods': 'foods',
      'meal': 'meal',
      'meals': 'meals',
      'ate': 'ate',
      'eating': 'eating',
      'breakfast': 'breakfast',
      'lunch': 'lunch',
      'dinner': 'dinner',
      'snack': 'snack',
      
      // Running terms
      'strava': 'Strava',
      'straava': 'Strava',
      'running': 'running',
      'runing': 'running',
      'workout': 'workout',
      'workouts': 'workouts',
      'exercise': 'exercise',
      'excercise': 'exercise',
      'ran': 'ran',
      'run': 'run',
      
      // Sleep terms
      'oura': 'Oura',
      'hora': 'Oura',
      'aura': 'Oura',
      'sleep': 'sleep',
      'slept': 'slept',
      'recovery': 'recovery',
      'rest': 'rest',
      'tired': 'tired',
      
      // Time references
      'yesterday': 'yesterday',
      'today': 'today',
      'this week': 'this week',
      'last week': 'last week',
      'past week': 'past week',
      'this morning': 'this morning',
      'tonight': 'tonight',
      
      // Common health questions
      'how has my': 'how has my',
      'what was my': 'what was my',
      'analyze my': 'analyze my',
      'tell me about': 'tell me about',
      'performance': 'performance',
      'performace': 'performance'
    };
    
    let corrected = transcript.toLowerCase();
    
    // Apply corrections
    Object.entries(corrections).forEach(([wrong, right]) => {
      const regex = new RegExp(wrong, 'gi');
      corrected = corrected.replace(regex, right);
    });
    
    // Capitalize first letter
    return corrected.charAt(0).toUpperCase() + corrected.slice(1);
  };

  const startRecording = () => {
    if (recognitionRef.current && speechSupported) {
      setIsRecording(true);
      setInterimTranscript('');
      // FIXED: Don't clear existing input, just show listening indicator
      if (!input || input.trim() === '') {
        setInput('🎤 Listening...');
      }
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Failed to start recording:', error);
        setIsRecording(false);
        setInput('(Failed to start recording - please try again)');
      }
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      setInterimTranscript('');
    }
  };

  // Fetch last 7 days average metrics using same logic as OverallJam
  const fetchWeeklyMetrics = async (): Promise<void> => {
    try {
      setMetricsLoading(true);
      
      console.log(`🔄 Fetching last 7 days metrics...`);

      // Get the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const dateString = sevenDaysAgo.toISOString().split('T')[0];

      // Fetch last 7 days nutrition data
      const nutritionQuery = query(
        collection(db, "nutritionLogs"),
        where("date", ">=", dateString),
        orderBy("date", "desc")
      );

      // Fetch last 7 days Strava data
      const stravaQuery = query(
        collection(db, "strava_data"),
        where("userId", "==", "mihir_jain"),
        orderBy("start_date", "desc"),
        limit(50)
      );

      const [nutritionSnapshot, stravaSnapshot] = await Promise.all([
        getDocs(nutritionQuery).catch((error) => {
          console.error("Error fetching nutrition data:", error);
          return { docs: [] };
        }),
        getDocs(stravaQuery).catch((error) => {
          console.error("Error fetching Strava data:", error);
          return { docs: [] };
        })
      ]);

      // Initialize data structure for 7 days
      const weekData: Record<string, { caloriesBurned: number; caloriesConsumed: number; protein: number; activities: Set<string> }> = {};
      
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        weekData[dateStr] = {
          caloriesBurned: 0,
          caloriesConsumed: 0,
          protein: 0,
          activities: new Set<string>()
        };
      }

      // Process nutrition data (same as OverallJam)
      nutritionSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (weekData[data.date]) {
          weekData[data.date].caloriesConsumed = data.totals?.calories || 0;
          weekData[data.date].protein = data.totals?.protein || 0;
        }
      });

      // Process Strava data (same logic as OverallJam)
      stravaSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const activityDate = data.date || (data.start_date ? data.start_date.substring(0, 10) : undefined);
        
        if (!activityDate || !weekData[activityDate]) return;

        // Use direct Strava calories field (same as OverallJam)
        const activityCalories = data.calories || data.activity?.calories || data.kilojoules_to_calories || 0;
        weekData[activityDate].caloriesBurned += activityCalories;
        
        // Track activity types
        const activityType = data.type || '';
        if (activityType) {
          weekData[activityDate].activities.add(activityType);
        }
      });

      // Calculate averages
      const validDays = Object.values(weekData).filter(day => 
        day.caloriesBurned > 0 || day.caloriesConsumed > 0 || day.protein > 0
      );
      
      const daysCount = validDays.length > 0 ? validDays.length : 7;
      
      const avgCaloriesBurned = validDays.reduce((sum, day) => sum + day.caloriesBurned, 0) / daysCount;
      const avgCaloriesConsumed = validDays.reduce((sum, day) => sum + day.caloriesConsumed, 0) / daysCount;
      const avgProtein = validDays.reduce((sum, day) => sum + day.protein, 0) / daysCount;
      
      // Collect all unique activities from the week
      const allActivities = new Set<string>();
      Object.values(weekData).forEach(day => {
        day.activities.forEach(activity => allActivities.add(activity));
      });

      console.log(`✅ 7-day averages: ${avgCaloriesBurned.toFixed(0)} cal burned, ${avgCaloriesConsumed.toFixed(0)} cal consumed, ${avgProtein.toFixed(0)}g protein`);

      // Update state with averaged data
      setWeeklyMetrics({
        caloriesBurned: Math.round(avgCaloriesBurned),
        caloriesConsumed: Math.round(avgCaloriesConsumed),
        protein: Math.round(avgProtein),
        activities: Array.from(allActivities),
        lastUpdated: new Date().toLocaleTimeString()
      });
      
    } catch (error) {
      console.error('Error fetching weekly metrics:', error);
    } finally {
      setMetricsLoading(false);
    }
  };

  // Analyze query to determine what data to fetch (nutrition, running, or both)
  // Detect nutrition-performance relationship queries and adjust timing intelligently
  const detectNutritionPerformanceQuery = (query: string) => {
    const lowerQuery = query.toLowerCase();
    
    // Patterns that indicate nutrition affected performance
    const nutritionPerformancePatterns = [
      'food affect', 'nutrition affect', 'nutriotn', 'fueled', 'fueling', 'energy for run',
      'pre run', 'post run', 'before run', 'after run', 'run performance',
      'food impact', 'nutrition impact', 'eating before', 'eating after',
      'nutrition been for', 'food been for', 'nutrition for the run', 'nutrition this week',
      'diet for run', 'eating for run', 'fuel for run', 'nutrition support'
    ];
    
    return nutritionPerformancePatterns.some(pattern => lowerQuery.includes(pattern));
  };

  // Extract activity timing to determine relevant nutrition day
  const determineNutritionDateForActivity = async (activityData: any, runDate: Date): Promise<Date> => {
    // If we have activity data, try to extract time
    let runTime = null;
    if (activityData && activityData.length > 0) {
      const timeMatch = activityData[0].match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (timeMatch) {
        let hour = parseInt(timeMatch[1]);
        const minute = parseInt(timeMatch[2]);
        const ampm = timeMatch[3].toUpperCase();
        
        if (ampm === 'PM' && hour !== 12) hour += 12;
        if (ampm === 'AM' && hour === 12) hour = 0;
        
        runTime = { hour, minute };
      }
    }
    
    // Smart timing logic
    if (runTime) {
      console.log(`🕐 Run detected at ${runTime.hour}:${runTime.minute}`);
      
      // Morning runs (5am-10am) → Use previous day's nutrition
      if (runTime.hour >= 5 && runTime.hour < 10) {
        const previousDay = new Date(runDate);
        previousDay.setDate(previousDay.getDate() - 1);
        console.log(`🌅 Morning run detected, using previous day's nutrition: ${previousDay.toDateString()}`);
        return previousDay;
      }
      
      // Afternoon/evening runs (12pm+) → Use same day's nutrition  
      if (runTime.hour >= 12) {
        console.log(`🌇 Afternoon/evening run detected, using same day's nutrition: ${runDate.toDateString()}`);
        return runDate;
      }
    }
    
    // Default: assume morning run if no time detected
    const previousDay = new Date(runDate);
    previousDay.setDate(previousDay.getDate() - 1);
    console.log(`⏰ No run time detected, defaulting to previous day's nutrition for safety: ${previousDay.toDateString()}`);
    return previousDay;
  };

  // Enhanced typo correction for all fitness keywords
  const correctTypos = (query: string): string => {
    let correctedQuery = query.toLowerCase();
    
    // Sleep-related typos
    const sleepCorrections = {
      'slepe': 'sleep',
      'slep': 'sleep', 
      'sleap': 'sleep',
      'sleeep': 'sleep',
      'sleeping': 'sleep',
      'slept': 'sleep',
      'sleeo': 'sleep',
      'slee': 'sleep'
    };
    
    // Running-related typos
    const runCorrections = {
      'runn': 'run',
      'runnign': 'running',
      'runign': 'running',
      'urn': 'run',
      'rnu': 'run',
      'runs': 'run',
      'raning': 'running',
      'jog': 'run',
      'jogging': 'running'
    };
    
    // Nutrition/food-related typos (only actual typos, not valid words)
    const nutritionCorrections = {
      'nutriotn': 'nutrition',
      'nutriton': 'nutrition',
      'nutritoin': 'nutrition',
      'nutrtion': 'nutrition',
      'protien': 'protein',
      'protean': 'protein',
      'carbz': 'carbs',
      'carbohydrates': 'carbs'
    };
    
    // Apply corrections
    const allCorrections = { ...sleepCorrections, ...runCorrections, ...nutritionCorrections };
    
    Object.entries(allCorrections).forEach(([typo, correct]) => {
      const regex = new RegExp(`\\b${typo}\\b`, 'gi');
      correctedQuery = correctedQuery.replace(regex, correct);
    });
    
    // Log if corrections were made
    if (correctedQuery !== query.toLowerCase()) {
      console.log(`🔧 Typo correction applied: "${query}" → "${correctedQuery}"`);
    }
    
    return correctedQuery;
  };

  // Extract date string from query for context saving
  const extractDateFromQuery = (query: string): string | null => {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('june 24')) return 'june 24';
    if (lowerQuery.includes('june 25')) return 'june 25';
    if (lowerQuery.includes('june 22')) return 'june 22';
    if (lowerQuery.includes('yesterday')) return 'yesterday';
    if (lowerQuery.includes('today')) return 'today';
    if (lowerQuery.includes('last week')) return 'last week';
    if (lowerQuery.includes('this week')) return 'this week';
    
    const daysMatch = lowerQuery.match(/last (\d+) days?/);
    if (daysMatch) return `last ${daysMatch[1]} days`;
    
    return null;
  };

  // Dynamic date parsing system (handles ANY date query format)
  const parseDateQuery = (query: string): { startDate: Date | null, endDate: Date | null, criteria: any } => {
    const lowerQuery = query.toLowerCase();
    const today = new Date();
    
    // Relative time ranges
    if (lowerQuery.includes('this week')) {
      const startOfWeek = new Date(today);
      const dayOfWeek = startOfWeek.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Adjust so Monday = 0
      startOfWeek.setDate(startOfWeek.getDate() - daysFromMonday);
      startOfWeek.setHours(0, 0, 0, 0); // Start of Monday
      return { startDate: startOfWeek, endDate: today, criteria: { type: 'range' } };
    }
    
    if (lowerQuery.includes('last week') || lowerQuery.includes('past week')) {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return { startDate: weekAgo, endDate: today, criteria: { type: 'range' } };
    }
    
    if (lowerQuery.includes('last month') || lowerQuery.includes('past month')) {
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return { startDate: monthAgo, endDate: today, criteria: { type: 'range' } };
    }
    
    if (lowerQuery.includes('this year')) {
      const yearStart = new Date(today.getFullYear(), 0, 1);
      return { startDate: yearStart, endDate: today, criteria: { type: 'range' } };
    }
    
    // "Last X days" pattern
    const daysMatch = lowerQuery.match(/last (\d+) days?/);
    if (daysMatch) {
      const daysAgo = new Date(today);
      daysAgo.setDate(daysAgo.getDate() - parseInt(daysMatch[1]));
      return { startDate: daysAgo, endDate: today, criteria: { type: 'range', days: parseInt(daysMatch[1]) } };
    }
    
    // "Since [month] [day]" pattern - dynamic parsing
    const sinceMatch = lowerQuery.match(/since (\w+) (\d{1,2})/);
    if (sinceMatch) {
      const monthName = sinceMatch[1].toLowerCase();
      const day = parseInt(sinceMatch[2]);
      const monthMap: { [key: string]: number } = {
        'january': 0, 'jan': 0, 'february': 1, 'feb': 1, 'march': 2, 'mar': 2,
        'april': 3, 'apr': 3, 'may': 4, 'june': 5, 'jun': 5,
        'july': 6, 'jul': 6, 'august': 7, 'aug': 7, 'september': 8, 'sep': 8,
        'october': 9, 'oct': 9, 'november': 10, 'nov': 10, 'december': 11, 'dec': 11
      };
      
      if (monthMap[monthName] !== undefined) {
        const year = today.getFullYear(); // Use current year
        return { startDate: new Date(year, monthMap[monthName], day), endDate: today, criteria: { type: 'since' } };
      }
    }
    
    // "From X to Y" pattern
    const fromToMatch = lowerQuery.match(/from (\d+\/\d+\/\d+) to (\d+\/\d+\/\d+)/);
    if (fromToMatch) {
      const startDate = new Date(fromToMatch[1]);
      const endDate = new Date(fromToMatch[2]);
      return { startDate, endDate, criteria: { type: 'range' } };
    }
    
    // Specific month/day patterns - dynamic parsing
    const monthDayMatch = lowerQuery.match(/(\w+) (\d{1,2})(?:\b|$)/);
    if (monthDayMatch) {
      const monthName = monthDayMatch[1].toLowerCase();
      const day = parseInt(monthDayMatch[2]);
      const monthMap: { [key: string]: number } = {
        'january': 0, 'jan': 0, 'february': 1, 'feb': 1, 'march': 2, 'mar': 2,
        'april': 3, 'apr': 3, 'may': 4, 'june': 5, 'jun': 5,
        'july': 6, 'jul': 6, 'august': 7, 'aug': 7, 'september': 8, 'sep': 8,
        'october': 9, 'oct': 9, 'november': 10, 'nov': 10, 'december': 11, 'dec': 11
      };
      
      if (monthMap[monthName] !== undefined && day >= 1 && day <= 31) {
        const year = today.getFullYear(); // Use current year
        const targetDate = new Date(year, monthMap[monthName], day);
        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);
        return { 
          startDate: targetDate, 
          endDate: nextDay, 
          criteria: { type: 'specific' } 
        };
      }
    }
    
    if (lowerQuery.includes('yesterday')) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const nextDay = new Date(yesterday);
      nextDay.setDate(nextDay.getDate() + 1);
      return { 
        startDate: yesterday, 
        endDate: nextDay, 
        criteria: { type: 'specific' } 
      };
    }
    
    if (lowerQuery.includes('today')) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return { 
        startDate: today, 
        endDate: tomorrow, 
        criteria: { type: 'specific' } 
      };
    }
    
    // Default: last 30 days
    const defaultStart = new Date(today);
    defaultStart.setDate(defaultStart.getDate() - 30);
    return { startDate: defaultStart, endDate: today, criteria: { type: 'default' } };
  };

  // Activity filtering criteria
  const determineActivityCriteria = (query: string, intent?: QueryIntent) => {
    const lowerQuery = query.toLowerCase();
    
    let minDistance = 0;
    let activityType = 'Run';
    let analysisType = 'general';
    
    // Distance criteria
    if (lowerQuery.includes('long run')) minDistance = 15;
    if (lowerQuery.includes('marathon')) minDistance = 40;
    if (lowerQuery.includes('half marathon')) minDistance = 20;
    
    // Activity type - use intent if available, otherwise fall back to keyword detection
    if (intent) {
      // Use intent analysis to determine activity type
      if (intent.needsSwimming) {
        activityType = 'Swim';
      } else if (intent.needsCycling) {
        activityType = 'Ride';
      } else if (intent.needsRunning) {
        activityType = 'Run';
      }
    } else {
      // Fallback to keyword detection
      if (lowerQuery.includes('weight') || lowerQuery.includes('strength')) activityType = 'Weight Training';
      if (lowerQuery.includes('walk')) activityType = 'Walk';
      if (lowerQuery.includes('swim')) activityType = 'Swim';
      if (lowerQuery.includes('cycle') || lowerQuery.includes('bike') || lowerQuery.includes('ride')) activityType = 'Ride';
    }
    
    // Analysis type
    if (lowerQuery.includes('heart rate') || lowerQuery.includes('hr')) analysisType = 'hr_analysis';
    if (lowerQuery.includes('pace')) analysisType = 'pace_analysis';
    if (lowerQuery.includes('power')) analysisType = 'power_analysis';
    
    return { minDistance, activityType, analysisType };
  };

  // Parse activity date from text (like Python function)
  const extractDateFromActivity = (activityText: string): Date | null => {
    const match = activityText.match(/on (\d+\/\d+\/\d+)/);
    if (match) {
      const [month, day, year] = match[1].split('/');
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    return null;
  };

  // Extract distance in km from activity text
  const extractDistanceFromActivity = (activityText: string): number => {
    const match = activityText.match(/— (\d+(?:\.\d+)?)m on/);
    if (match) {
      return parseFloat(match[1]) / 1000; // Convert meters to km
    }
    return 0;
  };

  // Extract activity type from text
  const extractActivityType = (activityText: string): string => {
    if (activityText.includes('Weight Training')) return 'Weight Training';
    if (activityText.includes('Run')) return 'Run';
    if (activityText.includes('Walk')) return 'Walk';
    if (activityText.includes('Swim')) return 'Swim';
    if (activityText.includes('Zwift') || activityText.includes('Ride') || activityText.includes('Bike') || activityText.includes('Cycling')) return 'Ride';
    return 'Other';
  };

  // Client-side activity filtering (core function like Python implementation)
  const filterActivitiesByDateAndCriteria = (
    activitiesText: string, 
    startDate: Date, 
    endDate: Date, 
    criteria: { minDistance: number, activityType: string }
  ): string[] => {
    const lines = activitiesText.split('\n');
    const filteredActivityIds: string[] = [];
    let activitiesScanned = 0;
    let activitiesInRange = 0;
    let stoppedEarly = false;

    console.log(`🔍 Filtering activities from ${startDate.toDateString()} to ${endDate.toDateString()}`);
    console.log(`📋 Criteria: ${criteria.activityType} ≥${criteria.minDistance}km`);

    for (const line of lines) {
      const idMatch = line.match(/ID:\s*(\d+)/);
      if (!idMatch) continue;

      activitiesScanned++;
      const activityId = idMatch[1];
      const activityDate = extractDateFromActivity(line);
      const activityDistance = extractDistanceFromActivity(line);
      const activityType = extractActivityType(line);

      // Early termination if we've gone too far back
      if (activityDate && activityDate < startDate) {
        console.log(`⏹️ Reached activities before ${startDate.toDateString()}, stopping search`);
        stoppedEarly = true;
        break;
      }

      // Debug logging for each activity processed
      console.log(`🔍 Processing: ${line.substring(0, 80)}...`);
      console.log(`   📅 Extracted date: ${activityDate?.toDateString()}`);
      console.log(`   📏 Distance: ${activityDistance.toFixed(2)}km`);
      console.log(`   🏃 Type: ${activityType}`);

      // Apply filters (use < for endDate to exclude activities on the end date for specific date queries)
      if (activityDate && 
          activityDate >= startDate && 
          activityDate < endDate &&
          activityDistance >= criteria.minDistance &&
          activityType === criteria.activityType) {
        
        activitiesInRange++;
        filteredActivityIds.push(activityId);
        console.log(`✅ Match: ${activityId} (${activityDistance.toFixed(2)}km on ${activityDate.toDateString()})`);
      } else {
        const reasons = [];
        if (!activityDate) reasons.push('no date');
        if (activityDate && activityDate < startDate) reasons.push('before start date');
        if (activityDate && activityDate >= endDate) reasons.push('after end date');
        if (activityDistance < criteria.minDistance) reasons.push(`distance too small (${activityDistance.toFixed(2)}km < ${criteria.minDistance}km)`);
        if (activityType !== criteria.activityType) reasons.push(`wrong type (${activityType} ≠ ${criteria.activityType})`);
        console.log(`❌ Excluded: ${reasons.join(', ')}`);
      }
    }

    console.log(`📊 Found ${activitiesInRange} matching activities out of ${activitiesScanned} scanned`);
    if (!stoppedEarly && activitiesScanned > 150) {
      console.log(`⚠️ Searched ${activitiesScanned} activities - older data might exist beyond API limit`);
    }

    return filteredActivityIds;
  };

  // Execute MCP calls
  const executeMCPCalls = async (mcpCalls: Array<{ endpoint: string; params: any }>): Promise<MCPResponse[]> => {
    const responses: MCPResponse[] = [];
    
    for (const call of mcpCalls) {
      try {
        console.log(`🌐 Calling ${call.endpoint} with params:`, call.params);
        
        const response = await fetch('/api/claude-coach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'mcp_call',
            endpoint: call.endpoint,
            params: call.params
          })
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`✅ ${call.endpoint} success`);
          responses.push({
            endpoint: call.endpoint,
            data: data.result,
            success: true
          });
        } else {
          console.log(`❌ ${call.endpoint} failed with status ${response.status}`);
          responses.push({
            endpoint: call.endpoint,
            data: null,
            success: false
          });
        }
      } catch (error) {
        console.error(`❌ ${call.endpoint} error:`, error);
        
        // Check if it's a network error
        if (error instanceof TypeError && error.message.includes('fetch')) {
          console.log(`🌐 Network error detected for ${call.endpoint} - check connectivity`);
        }
        
        responses.push({
          endpoint: call.endpoint,
          data: null,
          success: false,
          error: error.message
        });
      }
    }
    
    return responses;
  };

  // Enhanced context-aware query resolution
  const resolveContextualQuery = (query: string): string => {
    const correctedQuery = correctTypos(query);
    const lowerQuery = correctedQuery.toLowerCase();
    
    console.log(`🔍 DEBUG: Resolving query "${query}"`);
    console.log(`🔍 DEBUG: Corrected query "${correctedQuery}"`);
    console.log(`🔍 DEBUG: Lower query "${lowerQuery}"`);
    
    // Context references that should use previous context
    const contextualPhrases = [
      'that day', 'that run', 'that activity', 'that date',
      'the same day', 'how was weather', 'what was', 
      'during that', 'during that time', 'on that day', 'from that', 'compare that',
      'how did that affect', 'how did that impact', 'effect on',
      'impact on', 'because of that', 'due to that', 'that time',
      'that period', 'same time', 'same period'
    ];
    
    const hasContextualReference = contextualPhrases.some(phrase => lowerQuery.includes(phrase));
    console.log(`🔍 DEBUG: Has contextual reference: ${hasContextualReference}`);
    if (hasContextualReference) {
      console.log(`🔍 DEBUG: Found phrases: ${contextualPhrases.filter(phrase => lowerQuery.includes(phrase))}`);
    }
    
    // Check if this is a follow-up question (no specific date mentioned but conversational)
    const isFollowUpQuestion = !hasContextualReference && 
      context.conversationHistory && 
      context.conversationHistory.length > 0 &&
      !lowerQuery.includes('yesterday') && 
      !lowerQuery.includes('today') && 
      !lowerQuery.includes('june') && 
      !lowerQuery.includes('last week') &&
      !lowerQuery.includes('this week') &&
      !(/\d+/.test(lowerQuery)); // No numbers/dates in query
    
    console.log(`🔍 DEBUG: Is follow-up question: ${isFollowUpQuestion}`);
    console.log(`🔍 DEBUG: Conversation history length: ${context.conversationHistory?.length || 0}`);
    
    // 🚨 ADD WARNING IF CONVERSATION HISTORY IS UNEXPECTEDLY EMPTY
    if (!context.conversationHistory || context.conversationHistory.length === 0) {
      console.warn(`⚠️ WARNING: Conversation history is empty! This might explain why context is lost.`);
      console.warn(`⚠️ Context object:`, context);
    }
    
    // Smart contextual resolution with conversation history
    if ((hasContextualReference || isFollowUpQuestion) && context.conversationHistory && context.conversationHistory.length > 0) {
      const lastQuery = context.conversationHistory[context.conversationHistory.length - 1];
      
      console.log(`🔗 Contextual query detected! Type: ${hasContextualReference ? 'explicit' : 'follow-up'}`, {
        lastQuery: lastQuery.query.substring(0, 50),
        lastIntent: lastQuery.intent,
        lastDateRange: lastQuery.dateRange,
        hasContextualReference,
        isFollowUpQuestion
      });
      
      let resolvedQuery = correctedQuery;
      
      // For follow-up questions, inherit the date context from previous query
      if (isFollowUpQuestion && lastQuery.dateRange) {
        // Check if the last query was a multi-day range vs single day
        const startDate = lastQuery.dateRange.startDate;
        const endDate = lastQuery.dateRange.endDate;
        const isMultiDayRange = Math.abs(endDate.getTime() - startDate.getTime()) > 24 * 60 * 60 * 1000; // More than 1 day
        
        console.log(`🔍 DEBUG: Date range analysis:`, {
          startDate: startDate.toDateString(),
          endDate: endDate.toDateString(),
          isMultiDayRange,
          daysDifference: Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))
        });
        
        if (isMultiDayRange) {
          // For multi-day ranges, preserve the range context
          const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
          const rangeDescription = daysDiff <= 7 ? `last ${daysDiff} days` : 
                                  daysDiff <= 14 ? `last ${daysDiff} days` : 
                                  'recent period';
          
          resolvedQuery = `${correctedQuery} over the ${rangeDescription}`;
          console.log(`🎯 Follow-up context: Adding range context "${rangeDescription}" to query`);
        } else {
          // For single day queries, use the specific date
          const dateStr = startDate.toLocaleDateString('en-US', { 
            month: 'long', 
            day: 'numeric' 
          });
          
          // Add date context based on the query type
          if (lowerQuery.includes('run') || lowerQuery.includes('activity')) {
            resolvedQuery = `${correctedQuery} on ${dateStr}`;
          } else if (lowerQuery.includes('nutrition') || lowerQuery.includes('food')) {
            resolvedQuery = `${correctedQuery} on ${dateStr}`;
          } else if (lowerQuery.includes('sleep')) {
            resolvedQuery = `${correctedQuery} on ${dateStr}`;
          } else {
            // Generic follow-up
            resolvedQuery = `${correctedQuery} on ${dateStr}`;
          }
          
          console.log(`🎯 Follow-up context: Adding single date ${dateStr} to query`);
        }
      }
      
      // If the last query was about sleep and current is about running, infer same date
      if (lastQuery.intent.includes('sleep') && lowerQuery.includes('run')) {
        if (lastQuery.dateRange) {
          const dateStr = lastQuery.dateRange.startDate.toLocaleDateString('en-US', { 
            month: 'long', 
            day: 'numeric' 
          });
          resolvedQuery = `how did my run on ${dateStr} go`;
          console.log(`🎯 Smart context: Sleep query about ${dateStr} → Run query about same date`);
        }
      }
      
      // If asking about "that day/time/period" or similar, use the last date context - ENHANCED FOR RANGES
      if (lowerQuery.includes('that day') || lowerQuery.includes('that date') || lowerQuery.includes('on that day') ||
          lowerQuery.includes('that time') || lowerQuery.includes('during that time') || lowerQuery.includes('that period')) {
        if (lastQuery.dateRange) {
          const startDate = lastQuery.dateRange.startDate;
          const endDate = lastQuery.dateRange.endDate;
          const isMultiDayRange = Math.abs(endDate.getTime() - startDate.getTime()) > 24 * 60 * 60 * 1000;
          
          if (isMultiDayRange) {
            const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
            const rangeDescription = daysDiff <= 7 ? `last ${daysDiff} days` : 
                                    daysDiff <= 14 ? `last ${daysDiff} days` : 
                                    'recent period';
            
            // Replace temporal references with range descriptions
            resolvedQuery = resolvedQuery.replace(/that day|that date|on that day|that time|during that time|that period/gi, `over the ${rangeDescription}`);
            console.log(`🔍 DEBUG: Replaced temporal reference with range "${rangeDescription}"`);
            console.log(`🔍 DEBUG: New resolved query: "${resolvedQuery}"`);
          } else {
            const dateStr = startDate.toLocaleDateString('en-US', { 
              month: 'long', 
              day: 'numeric' 
            });
            resolvedQuery = resolvedQuery.replace(/that day|that date|on that day|that time|during that time|that period/gi, `on ${dateStr}`);
            console.log(`🔍 DEBUG: Replaced temporal reference with single date "${dateStr}"`);
            console.log(`🔍 DEBUG: New resolved query: "${resolvedQuery}"`);
          }
        } else {
          console.log(`🔍 DEBUG: No dateRange in last query to resolve temporal reference`);
        }
      }
      
      // Handle "how did that affect" type queries - ENHANCED FOR RANGE CONTEXTS
      if (lowerQuery.includes('how did that affect') || lowerQuery.includes('how did that impact')) {
        if (lastQuery.intent && lastQuery.intent.includes('sleep') && lastQuery.dateRange) {
          const startDate = lastQuery.dateRange.startDate;
          const endDate = lastQuery.dateRange.endDate;
          const isMultiDayRange = Math.abs(endDate.getTime() - startDate.getTime()) > 24 * 60 * 60 * 1000;
          
          if (isMultiDayRange) {
            const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
            const rangeDescription = daysDiff <= 7 ? `last ${daysDiff} days` : 
                                    daysDiff <= 14 ? `last ${daysDiff} days` : 
                                    'recent period';
            resolvedQuery = `how did my sleep patterns over the ${rangeDescription} affect my running performance, including correlations between sleep quality/duration and run performance metrics`;
            console.log(`🎯 Multi-day sleep correlation: Analyzing ${rangeDescription} sleep → running impact`);
          } else {
            const dateStr = startDate.toLocaleDateString('en-US', { 
              month: 'long', 
              day: 'numeric' 
            });
            resolvedQuery = `how did my sleep on ${dateStr} affect my run performance`;
            console.log(`🎯 Single-day sleep correlation: ${dateStr} sleep → run impact`);
          }
        }
      }
      
      console.log(`🔗 Resolved contextual query: "${query}" → "${resolvedQuery}"`);
      return resolvedQuery;
    }
    
    console.log(`🔍 DEBUG: No context resolution needed, returning corrected query: "${correctedQuery}"`);
    return correctedQuery;
  };

  // Check if we can reuse cached data for the same date range - ENHANCED WITH DATA TYPE CHECKING
  const canReuseCachedData = (intent: QueryIntent): boolean => {
    if (!context.cachedData || !context.cachedData.fetchedAt) {
      console.log('❌ No cached data available');
      return false;
    }
    
    // Extend cache timeout to 15 minutes for better conversation flow
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    if (context.cachedData.fetchedAt < fifteenMinutesAgo) {
      console.log('🕒 Cached data too old (>15 min), will refetch');
      return false;
    }
    
    // 🆕 CHECK IF CACHED DATA HAS ALL REQUIRED DATA TYPES WITH DETAILED VALIDATION
    const hasRequiredNutrition = !intent.needsNutrition || (context.cachedData.nutritionData && context.cachedData.nutritionData.totalDays > 0);
    const hasRequiredSleep = !intent.needsSleep || (context.cachedData.sleepData && context.cachedData.sleepData.totalDays > 0);
    
    // Enhanced running data validation - check for specific endpoint data if streams are needed
    let hasRequiredRunning = !intent.needsRunning;
    if (intent.needsRunning && context.cachedData.mcpResponses) {
      const cachedMcpResponses = context.cachedData.mcpResponses;
      const hasBasicRunning = cachedMcpResponses.some(r => r.success && r.endpoint === 'get-activity-details');
      
      // If streams data is needed, check specifically for streams endpoints
      if (intent.runningDataTypes?.includes('activity_streams')) {
        const hasStreamsData = cachedMcpResponses.some(r => r.success && r.endpoint === 'get-activity-streams');
        hasRequiredRunning = hasBasicRunning && hasStreamsData;
        console.log('🔍 Streams validation:', {
          needsStreams: true,
          hasBasicRunning,
          hasStreamsData,
          hasRequiredRunning,
          cachedEndpoints: cachedMcpResponses.map(r => r.endpoint)
        });
      } else {
        hasRequiredRunning = hasBasicRunning;
      }
    }
    
    if (!hasRequiredNutrition || !hasRequiredSleep || !hasRequiredRunning) {
      console.log('❌ Cached data missing required data types:', {
        needsNutrition: intent.needsNutrition,
        hasNutrition: !!context.cachedData.nutritionData,
        needsSleep: intent.needsSleep,
        hasSleep: !!context.cachedData.sleepData,
        needsRunning: intent.needsRunning,
        hasRunning: !!(context.cachedData.mcpResponses && context.cachedData.mcpResponses.length > 0)
      });
      return false;
    }
    
    // More flexible date range matching
    if (intent.dateRange && context.cachedData.dateRange) {
      const intentStart = intent.dateRange.startDate.getTime();
      const intentEnd = intent.dateRange.endDate.getTime();
      const cachedStart = context.cachedData.dateRange.startDate.getTime();
      const cachedEnd = context.cachedData.dateRange.endDate.getTime();
      
      // Check for exact match first
      if (intentStart === cachedStart && intentEnd === cachedEnd) {
        console.log('✅ Found exact cached data with all required data types, reusing...');
        return true;
      }
      
      // Check for overlapping ranges (more flexible)
      const hasOverlap = intentStart <= cachedEnd && intentEnd >= cachedStart;
      if (hasOverlap) {
        console.log('✅ Found overlapping cached data with all required data types, reusing...');
        return true;
      }
    }
    
    // If no date range in intent but we have cached data from recent conversation, use it
    if (!intent.dateRange && context.cachedData.dateRange && context.conversationHistory && context.conversationHistory.length > 0) {
      console.log('✅ No specific date in query, using recent cached data with all required data types...');
      return true;
    }
    
    console.log('❌ No suitable cached data found');
    return false;
  };

  // Enhanced analyzeQueryIntent with typo correction and context awareness
  const analyzeQueryIntent = (query: string): QueryIntent => {
    // First apply typo correction
    const correctedQuery = correctTypos(query);
    const lowerQuery = correctedQuery.toLowerCase();
    
    // Enhanced keywords with common variations and typos
    const nutritionKeywords = [
      'nutrition', 'nutriotn', 'nutriton', 'food', 'foods', 'calories', 'protein', 'carbs', 'fat', 'fiber',
      'macro', 'macros', 'diet', 'eating', 'meal', 'meals', 'consumed', 'intake', 'fueling', 'fuel',
      'ate', 'breakfast', 'lunch', 'dinner', 'snack'
    ];
    
    const runningKeywords = [
      'run', 'runs', 'running', 'runn', 'runnign', 'pace', 'heart rate', 'hr', 'activity', 'workout', 'exercise',
      'training', 'distance', 'speed', 'power', 'zones', 'strava', 'jog', 'jogging', 'marathon', '5k', '10k'
    ];

    const cyclingKeywords = [
      'cycle', 'cycling', 'bike', 'biking', 'ride', 'riding', 'road bike', 'mountain bike', 'ftp', 'power meter',
      'cadence', 'rpm', 'watts', 'power zones', 'cycling', 'bicycle', 'velodrome', 'time trial'
    ];

    const swimmingKeywords = [
      'swim', 'swimming', 'pool', 'freestyle', 'breaststroke', 'butterfly', 'backstroke', 'swolf', 'stroke rate',
      'swimming', 'aquatic', 'laps', 'swimming pool', 'open water', 'triathlon'
    ];
    
    const sleepKeywords = [
      'sleep', 'slepe', 'slep', 'sleap', 'sleeo', 'sleeping', 'slept', 'bedtime', 'wake', 'woke', 'rest', 'recovery',
      'tired', 'fatigue', 'readiness', 'oura', 'sleep score', 'sleep quality',
      'deep sleep', 'rem sleep', 'light sleep', 'sleep duration', 'sleep efficiency'
    ];
    
    const hasNutritionKeywords = nutritionKeywords.some(keyword => lowerQuery.includes(keyword));
    const hasRunningKeywords = runningKeywords.some(keyword => lowerQuery.includes(keyword));
    const hasCyclingKeywords = cyclingKeywords.some(keyword => lowerQuery.includes(keyword));
    const hasSwimmingKeywords = swimmingKeywords.some(keyword => lowerQuery.includes(keyword));
    const hasSleepKeywords = sleepKeywords.some(keyword => lowerQuery.includes(keyword));
    const isNutritionPerformanceQuery = detectNutritionPerformanceQuery(correctedQuery);
    
    // Parse date range for data fetching
    const { startDate, endDate } = parseDateQuery(correctedQuery);
    
    // 🆕 ENHANCED: Check conversation context for follow-up questions
    let contextNeedsSleep = false;
    let contextNeedsNutrition = false;
    let contextNeedsRunning = false;
    let contextNeedsCycling = false;
    let contextNeedsSwimming = false;
    
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      const lastQuery = context.conversationHistory[context.conversationHistory.length - 1];
      
      // If this is a follow-up question (contains "it", "that", "this", etc.), inherit context from previous query
      const followUpIndicators = ['it', 'that', 'this', 'those', 'them', 'they', 'how did', 'how does', 'what about', 'what was'];
      const isFollowUp = followUpIndicators.some(indicator => lowerQuery.includes(indicator));
      
      if (isFollowUp) {
        console.log(`🔍 CONTEXT INTENT: Follow-up question detected, inheriting context from previous query`);
        console.log(`🔍 CONTEXT INTENT: Last query intent: ${lastQuery.intent}`);
        
        // Inherit data needs from previous query
        if (lastQuery.intent.includes('sleep')) {
          contextNeedsSleep = true;
          console.log(`🔍 CONTEXT INTENT: Inheriting sleep data need from previous query`);
        }
        if (lastQuery.intent.includes('nutrition')) {
          contextNeedsNutrition = true;
          console.log(`🔍 CONTEXT INTENT: Inheriting nutrition data need from previous query`);
        }
        if (lastQuery.intent.includes('running')) {
          contextNeedsRunning = true;
          console.log(`🔍 CONTEXT INTENT: Inheriting running data need from previous query`);
        }
        if (lastQuery.intent.includes('cycling')) {
          contextNeedsCycling = true;
          console.log(`🔍 CONTEXT INTENT: Inheriting cycling data need from previous query`);
        }
        if (lastQuery.intent.includes('swimming')) {
          contextNeedsSwimming = true;
          console.log(`🔍 CONTEXT INTENT: Inheriting swimming data need from previous query`);
        }
      }
    }
    
    let intent: QueryIntent;
    
    // Determine data needs based on keyword combinations + context inheritance
    const needsNutrition = hasNutritionKeywords || isNutritionPerformanceQuery || contextNeedsNutrition;
    const needsRunning = hasRunningKeywords || isNutritionPerformanceQuery || contextNeedsRunning;
    const needsCycling = hasCyclingKeywords || contextNeedsCycling;
    const needsSwimming = hasSwimmingKeywords || contextNeedsSwimming;
    const needsSleep = hasSleepKeywords || contextNeedsSleep;
    
    // Detect primary sport for context
    const primarySport = detectPrimarySport(correctedQuery);
    
    // Determine query type based on combinations
    if (needsNutrition && needsRunning && needsSleep) {
      intent = {
        type: 'all_data',
        needsNutrition: true,
        needsRunning: true,
        needsCycling: needsCycling,
        needsSwimming: needsSwimming,
        needsSleep: true,
        dateRange: startDate && endDate ? { startDate, endDate } : undefined,
        nutritionDataTypes: ['calories', 'protein', 'carbs', 'fat', 'fiber'],
        runningDataTypes: ['activity_details', 'basic_stats'],
        cyclingDataTypes: needsCycling ? determineCyclingDataTypes(correctedQuery) : [],
        swimmingDataTypes: needsSwimming ? determineSwimmingDataTypes(correctedQuery) : [],
        sleepDataTypes: ['duration', 'scores', 'heart_rate'],
        isSmartTiming: isNutritionPerformanceQuery,
        primarySport: primarySport
      };
    } else if (needsSleep && needsRunning) {
      intent = {
        type: 'sleep_and_running',
        needsNutrition: false,
        needsRunning: true,
        needsCycling: needsCycling,
        needsSwimming: needsSwimming,
        needsSleep: true,
        dateRange: startDate && endDate ? { startDate, endDate } : undefined,
        runningDataTypes: ['activity_details', 'basic_stats'],
        cyclingDataTypes: needsCycling ? determineCyclingDataTypes(correctedQuery) : [],
        swimmingDataTypes: needsSwimming ? determineSwimmingDataTypes(correctedQuery) : [],
        sleepDataTypes: ['duration', 'scores', 'heart_rate'],
        primarySport: primarySport
      };
    } else if (needsSleep && needsNutrition) {
      intent = {
        type: 'sleep_and_nutrition',
        needsNutrition: true,
        needsRunning: false,
        needsCycling: needsCycling,
        needsSwimming: needsSwimming,
        needsSleep: true,
        dateRange: startDate && endDate ? { startDate, endDate } : undefined,
        nutritionDataTypes: ['calories', 'protein', 'carbs', 'fat', 'fiber'],
        cyclingDataTypes: needsCycling ? determineCyclingDataTypes(correctedQuery) : [],
        swimmingDataTypes: needsSwimming ? determineSwimmingDataTypes(correctedQuery) : [],
        sleepDataTypes: ['duration', 'scores', 'heart_rate'],
        primarySport: primarySport
      };
    } else if (needsSleep) {
      intent = {
        type: 'sleep_only',
        needsNutrition: false,
        needsRunning: false,
        needsCycling: needsCycling,
        needsSwimming: needsSwimming,
        needsSleep: true,
        dateRange: startDate && endDate ? { startDate, endDate } : undefined,
        cyclingDataTypes: needsCycling ? determineCyclingDataTypes(correctedQuery) : [],
        swimmingDataTypes: needsSwimming ? determineSwimmingDataTypes(correctedQuery) : [],
        sleepDataTypes: ['duration', 'scores', 'heart_rate'],
        primarySport: primarySport
      };
    } else if (isNutritionPerformanceQuery || (needsNutrition && needsRunning)) {
      intent = {
        type: 'nutrition_and_running',
        needsNutrition: true,
        needsRunning: true,
        needsCycling: needsCycling,
        needsSwimming: needsSwimming,
        needsSleep: false,
        dateRange: startDate && endDate ? { startDate, endDate } : undefined,
        nutritionDataTypes: ['calories', 'protein', 'carbs', 'fat', 'fiber'],
        runningDataTypes: ['activity_details', 'basic_stats'],
        cyclingDataTypes: needsCycling ? determineCyclingDataTypes(correctedQuery) : [],
        swimmingDataTypes: needsSwimming ? determineSwimmingDataTypes(correctedQuery) : [],
        isSmartTiming: isNutritionPerformanceQuery,
        primarySport: primarySport
      };
    } else if (needsNutrition) {
      intent = {
        type: 'nutrition_only',
        needsNutrition: true,
        needsRunning: false,
        needsCycling: needsCycling,
        needsSwimming: needsSwimming,
        needsSleep: false,
        dateRange: startDate && endDate ? { startDate, endDate } : undefined,
        nutritionDataTypes: ['calories', 'protein', 'carbs', 'fat', 'fiber'],
        cyclingDataTypes: needsCycling ? determineCyclingDataTypes(correctedQuery) : [],
        swimmingDataTypes: needsSwimming ? determineSwimmingDataTypes(correctedQuery) : [],
        primarySport: primarySport
      };
    } else if (needsRunning) {
      intent = {
        type: 'running_only',
        needsNutrition: false,
        needsRunning: true,
        needsCycling: needsCycling,
        needsSwimming: needsSwimming,
        needsSleep: false,
        dateRange: startDate && endDate ? { startDate, endDate } : undefined,
        runningDataTypes: determineRunningDataTypes(correctedQuery),
        cyclingDataTypes: needsCycling ? determineCyclingDataTypes(correctedQuery) : [],
        swimmingDataTypes: needsSwimming ? determineSwimmingDataTypes(correctedQuery) : [],
        primarySport: primarySport
      };
    } else if (needsCycling) {
      intent = {
        type: 'cycling_only',
        needsNutrition: false,
        needsRunning: false,
        needsCycling: true,
        needsSwimming: needsSwimming,
        needsSleep: false,
        dateRange: startDate && endDate ? { startDate, endDate } : undefined,
        cyclingDataTypes: determineCyclingDataTypes(correctedQuery),
        swimmingDataTypes: needsSwimming ? determineSwimmingDataTypes(correctedQuery) : [],
        primarySport: primarySport
      };
    } else if (needsSwimming) {
      intent = {
        type: 'swimming_only',
        needsNutrition: false,
        needsRunning: false,
        needsCycling: needsCycling,
        needsSwimming: true,
        needsSleep: false,
        dateRange: startDate && endDate ? { startDate, endDate } : undefined,
        cyclingDataTypes: needsCycling ? determineCyclingDataTypes(correctedQuery) : [],
        swimmingDataTypes: determineSwimmingDataTypes(correctedQuery),
        primarySport: primarySport
      };
    } else {
      // General query - might need some data for context
      intent = {
        type: 'general',
        needsNutrition: true,
        needsRunning: true,
        needsCycling: needsCycling,
        needsSwimming: needsSwimming,
        needsSleep: true,
        dateRange: startDate && endDate ? { startDate, endDate } : undefined,
        nutritionDataTypes: ['calories', 'protein'],
        runningDataTypes: ['activity_details'],
        cyclingDataTypes: needsCycling ? determineCyclingDataTypes(correctedQuery) : [],
        swimmingDataTypes: needsSwimming ? determineSwimmingDataTypes(correctedQuery) : [],
        sleepDataTypes: ['duration', 'scores', 'heart_rate'],
        primarySport: primarySport
      };
    }
    
    // 🆕 CONTEXT-AWARE ENHANCEMENT: Expand data needs for follow-up questions
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      const lastQuery = context.conversationHistory[context.conversationHistory.length - 1];
      const isFollowUpWithoutExplicitDate = !intent.dateRange && lastQuery.dateRange;
      
      // Check for cross-domain follow-up questions
      const askingAboutSleepAndRuns = lowerQuery.includes('sleep') && lowerQuery.includes('run');
      const askingAboutNutritionAndRuns = lowerQuery.includes('nutrition') || lowerQuery.includes('food') && lowerQuery.includes('run');
      const askingAboutAffectOrImpact = lowerQuery.includes('affect') || lowerQuery.includes('impact');
      
      console.log(`🔍 Context check:`, {
        lastQueryIntent: lastQuery.intent,
        currentQuery: lowerQuery,
        askingAboutSleepAndRuns,
        askingAboutNutritionAndRuns,
        askingAboutAffectOrImpact,
        isFollowUpWithoutExplicitDate
      });
      
      // If asking about how nutrition affected sleep/runs, expand to include all data
      if (lastQuery.intent.includes('nutrition') && (askingAboutSleepAndRuns || askingAboutAffectOrImpact)) {
        console.log(`🎯 CONTEXT EXPANSION: Nutrition query followed by sleep/run impact question - fetching all data types`);
        intent = {
          ...intent,
          type: 'all_data',
          needsNutrition: true,
          needsRunning: true,
          needsSleep: true,
          dateRange: intent.dateRange || lastQuery.dateRange, // Inherit date range
          nutritionDataTypes: ['calories', 'protein', 'carbs', 'fat', 'fiber'],
          runningDataTypes: ['activity_details', 'basic_stats'],
          sleepDataTypes: ['duration', 'scores', 'heart_rate'],
          isSmartTiming: true
        };
      }
      // If previous was nutrition-only and now asking about runs specifically
      else if (lastQuery.intent === 'nutrition_only' && lowerQuery.includes('run')) {
        console.log(`🎯 CONTEXT EXPANSION: Nutrition query followed by running question - adding running data`);
        intent = {
          ...intent,
          type: 'nutrition_and_running',
          needsRunning: true,
          needsNutrition: true,
          dateRange: intent.dateRange || lastQuery.dateRange,
          runningDataTypes: ['activity_details', 'basic_stats'],
          nutritionDataTypes: intent.nutritionDataTypes || ['calories', 'protein', 'carbs', 'fat', 'fiber']
        };
      }
      // If previous was nutrition-only and now asking about sleep specifically  
      else if (lastQuery.intent === 'nutrition_only' && lowerQuery.includes('sleep')) {
        console.log(`🎯 CONTEXT EXPANSION: Nutrition query followed by sleep question - adding sleep data`);
        intent = {
          ...intent,
          type: 'sleep_and_nutrition',
          needsSleep: true,
          needsNutrition: true,
          dateRange: intent.dateRange || lastQuery.dateRange,
          sleepDataTypes: ['duration', 'scores', 'heart_rate'],
          nutritionDataTypes: intent.nutritionDataTypes || ['calories', 'protein', 'carbs', 'fat', 'fiber']
        };
      }
      // Inherit date range from previous query if not specified
      else if (isFollowUpWithoutExplicitDate) {
        console.log(`🎯 CONTEXT: Inheriting date range from previous query: ${lastQuery.dateRange?.startDate.toDateString()} → ${lastQuery.dateRange?.endDate.toDateString()}`);
        intent = {
          ...intent,
          dateRange: lastQuery.dateRange
        };
      }
    }

    console.log(`🧠 Query intent analysis (with typo correction):`, {
      originalQuery: query.substring(0, 50) + '...',
      correctedQuery: correctedQuery.substring(0, 50) + '...',
      intent: intent.type,
      needsNutrition: intent.needsNutrition,
      needsRunning: intent.needsRunning,
      needsSleep: intent.needsSleep,
      hasNutritionKeywords,
      hasRunningKeywords,
      hasSleepKeywords,
      isNutritionPerformanceQuery,
      dateRange: intent.dateRange ? 
        `${intent.dateRange.startDate.toDateString()} → ${intent.dateRange.endDate.toDateString()}` : 
        'default range'
    });
    
    return intent;
  };

  const detectPrimarySport = (query: string): 'running' | 'cycling' | 'swimming' | 'all' => {
    const lowerQuery = query.toLowerCase();
    
    // Check for specific sport mentions
    if (lowerQuery.includes('run') || lowerQuery.includes('jog') || lowerQuery.includes('marathon') || lowerQuery.includes('5k') || lowerQuery.includes('10k') || lowerQuery.includes('half marathon')) {
      return 'running';
    }
    if (lowerQuery.includes('cycle') || lowerQuery.includes('bike') || lowerQuery.includes('ride') || lowerQuery.includes('cycling') || lowerQuery.includes('road bike') || lowerQuery.includes('mountain bike') || lowerQuery.includes('ftp') || lowerQuery.includes('power meter')) {
      return 'cycling';
    }
    if (lowerQuery.includes('swim') || lowerQuery.includes('pool') || lowerQuery.includes('freestyle') || lowerQuery.includes('breaststroke') || lowerQuery.includes('butterfly') || lowerQuery.includes('backstroke') || lowerQuery.includes('swolf') || lowerQuery.includes('stroke rate')) {
      return 'swimming';
    }
    
    // Check for general activity terms that might indicate all sports
    if (lowerQuery.includes('workout') || lowerQuery.includes('training') || lowerQuery.includes('exercise') || lowerQuery.includes('activity')) {
      return 'all';
    }
    
    return 'all'; // Default to all sports
  };

  // Determine what running data types are needed based on query
  const determineRunningDataTypes = (query: string): string[] => {
    const lowerQuery = query.toLowerCase();
    const dataTypes = ['activity_details']; // Always include basic details
    
    // Enhanced detection for detailed analysis requiring streams
    const needsStreams = 
      lowerQuery.includes('heart rate') || lowerQuery.includes('hr') || 
      lowerQuery.includes('pace') || lowerQuery.includes('power') ||
      lowerQuery.includes('analyze') || lowerQuery.includes('analysis') ||
      lowerQuery.includes('distribution') || lowerQuery.includes('speed') ||
      lowerQuery.includes('per km') || lowerQuery.includes('per kilometre') ||
      lowerQuery.includes('km by km') || lowerQuery.includes('kilometer') ||
      lowerQuery.includes('split') || lowerQuery.includes('breakdown') ||
      lowerQuery.includes('detailed') || lowerQuery.includes('segment');
    
    if (needsStreams) {
      dataTypes.push('activity_streams');
      console.log(`🎯 Query "${query}" requires streams data - adding activity_streams`);
    }
    
    if (lowerQuery.includes('zone') || lowerQuery.includes('hr')) {
      dataTypes.push('athlete_zones');
    }
    
    if (lowerQuery.includes('stats') || lowerQuery.includes('total') || lowerQuery.includes('summary')) {
      dataTypes.push('athlete_stats', 'athlete_profile');
    }
    
    console.log(`📊 Determined running data types for "${query}": [${dataTypes.join(', ')}]`);
    return dataTypes;
  };

  // Determine what cycling data types are needed based on query
  const determineCyclingDataTypes = (query: string): string[] => {
    const lowerQuery = query.toLowerCase();
    const dataTypes = ['activity_details']; // Always include basic details
    
    // Enhanced detection for detailed analysis requiring streams
    const needsStreams = 
      lowerQuery.includes('heart rate') || lowerQuery.includes('hr') || 
      lowerQuery.includes('power') || lowerQuery.includes('watts') || lowerQuery.includes('ftp') ||
      lowerQuery.includes('cadence') || lowerQuery.includes('rpm') ||
      lowerQuery.includes('analyze') || lowerQuery.includes('analysis') ||
      lowerQuery.includes('distribution') || lowerQuery.includes('speed') ||
      lowerQuery.includes('elevation') || lowerQuery.includes('gradient') ||
      lowerQuery.includes('split') || lowerQuery.includes('breakdown') ||
      lowerQuery.includes('detailed') || lowerQuery.includes('segment');
    
    if (needsStreams) {
      dataTypes.push('activity_streams');
      console.log(`🎯 Query "${query}" requires streams data - adding activity_streams`);
    }
    
    if (lowerQuery.includes('zone') || lowerQuery.includes('hr') || lowerQuery.includes('power zone')) {
      dataTypes.push('athlete_zones');
    }
    
    if (lowerQuery.includes('stats') || lowerQuery.includes('total') || lowerQuery.includes('summary')) {
      dataTypes.push('athlete_stats', 'athlete_profile');
    }
    
    console.log(`🚴 Determined cycling data types for "${query}": [${dataTypes.join(', ')}]`);
    return dataTypes;
  };

  // Determine what swimming data types are needed based on query
  const determineSwimmingDataTypes = (query: string): string[] => {
    const lowerQuery = query.toLowerCase();
    const dataTypes = ['activity_details']; // Always include basic details
    
    // Enhanced detection for detailed analysis requiring streams
    const needsStreams = 
      lowerQuery.includes('heart rate') || lowerQuery.includes('hr') || 
      lowerQuery.includes('pace') || lowerQuery.includes('speed') ||
      lowerQuery.includes('analyze') || lowerQuery.includes('analysis') ||
      lowerQuery.includes('distribution') || lowerQuery.includes('stroke') ||
      lowerQuery.includes('swolf') || lowerQuery.includes('efficiency') ||
      lowerQuery.includes('split') || lowerQuery.includes('breakdown') ||
      lowerQuery.includes('detailed') || lowerQuery.includes('segment');
    
    if (needsStreams) {
      dataTypes.push('activity_streams');
      console.log(`🎯 Query "${query}" requires streams data - adding activity_streams`);
    }
    
    if (lowerQuery.includes('zone') || lowerQuery.includes('hr')) {
      dataTypes.push('athlete_zones');
    }
    
    if (lowerQuery.includes('stats') || lowerQuery.includes('total') || lowerQuery.includes('summary')) {
      dataTypes.push('athlete_stats', 'athlete_profile');
    }
    
    console.log(`🏊 Determined swimming data types for "${query}": [${dataTypes.join(', ')}]`);
    return dataTypes;
  };

  // Fetch nutrition data for a specific date range
  const fetchNutritionDataForRange = async (startDate: Date, endDate: Date): Promise<NutritionResponse> => {
    try {
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      console.log(`🥗 Fetching nutrition data from ${startDateStr} to ${endDateStr}`);

      const nutritionQuery = query(
        collection(db, "nutritionLogs"),
        where("date", ">=", startDateStr),
        where("date", "<=", endDateStr),
        orderBy("date", "desc")
      );

      const snapshot = await getDocs(nutritionQuery);
      
      if (snapshot.empty) {
        console.log(`⚠️ No nutrition data found for date range ${startDateStr} to ${endDateStr}`);
        return {
          success: false,
          data: null,
          error: `No nutrition data found for the specified date range`
        };
      }

      // Process nutrition data into a structured format
      const nutritionData = {
        dateRange: { startDate: startDateStr, endDate: endDateStr },
        totalDays: snapshot.docs.length,
        dailyLogs: [] as any[],
        totals: {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0
        },
        averages: {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0
        }
      };

             // Process each day's data based on actual Firestore structure
       snapshot.docs.forEach(doc => {
         const dayData = doc.data();
         const totals = dayData.totals || {};
         const entries = dayData.entries || [];
         
         // Use document ID as date if not in data
         const dateValue = dayData.date || doc.id;
         
         nutritionData.dailyLogs.push({
           date: dateValue,
           calories: totals.calories || 0,
           protein: totals.protein || 0,
           carbs: totals.carbs || 0,
           fat: totals.fat || 0,
           fiber: totals.fiber || 0,
           entries: entries, // Include individual food entries
           lastUpdated: dayData.lastUpdated || null
         });
         
         // Add to totals
         nutritionData.totals.calories += totals.calories || 0;
         nutritionData.totals.protein += totals.protein || 0;
         nutritionData.totals.carbs += totals.carbs || 0;
         nutritionData.totals.fat += totals.fat || 0;
         nutritionData.totals.fiber += totals.fiber || 0;
       });

      // Calculate averages
      const dayCount = nutritionData.dailyLogs.length;
      if (dayCount > 0) {
        nutritionData.averages.calories = Math.round(nutritionData.totals.calories / dayCount);
        nutritionData.averages.protein = Math.round(nutritionData.totals.protein / dayCount);
        nutritionData.averages.carbs = Math.round(nutritionData.totals.carbs / dayCount);
        nutritionData.averages.fat = Math.round(nutritionData.totals.fat / dayCount);
        nutritionData.averages.fiber = Math.round(nutritionData.totals.fiber / dayCount);
      }

      console.log(`✅ Nutrition data processed: ${dayCount} days, avg ${nutritionData.averages.calories} cal/day`);

      return {
        success: true,
        data: nutritionData,
        error: undefined
      };
      
    } catch (error) {
      console.error('Error fetching nutrition data:', error);
      return {
        success: false,
        data: null,
        error: `Failed to fetch nutrition data: ${error.message}`
      };
    }
  };

  // Fetch sleep data for a specific date range from Firestore oura_sleep_data collection
  const fetchSleepDataForRange = async (startDate: Date, endDate: Date): Promise<SleepResponse> => {
    try {
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      console.log(`😴 Fetching sleep data from ${startDateStr} to ${endDateStr}`);

      // Generate array of dates to check
      const datesToCheck = [];
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        datesToCheck.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Fetch sleep documents using document IDs (mihir_jain_YYYY-MM-DD format)
      const sleepPromises = datesToCheck.map(async (dateStr) => {
        const docId = `mihir_jain_${dateStr}`;
        console.log(`🔍 Trying to fetch sleep document: ${docId}`);
        try {
          const sleepDoc = await getDoc(doc(db, 'oura_sleep_data', docId));
          console.log(`📄 Document ${docId} exists: ${sleepDoc.exists()}`);
          if (sleepDoc.exists()) {
            console.log(`✅ Found sleep data for ${dateStr}:`, sleepDoc.data());
            return { date: dateStr, ...sleepDoc.data() };
          }
          console.log(`❌ Document ${docId} does not exist`);
          return null;
        } catch (error) {
          console.error(`❌ Error fetching ${docId}:`, error);
          return null;
        }
      });

      const sleepResults = await Promise.all(sleepPromises);
      const validSleepData = sleepResults.filter(data => data !== null);
      
      if (validSleepData.length === 0) {
        console.log(`⚠️ No sleep data found for date range ${startDateStr} to ${endDateStr}`);
        return {
          success: false,
          data: null,
          error: `No sleep data found for the specified date range`
        };
      }

      // Process sleep data into a structured format
      const sleepData = {
        dateRange: { startDate: startDateStr, endDate: endDateStr },
        totalDays: validSleepData.length,
        dailyLogs: [] as any[],
        averages: {
          sleepDuration: 0,
          sleepScore: 0,
          averageHeartRate: 0,
          readinessScore: 0,
          deepSleep: 0,
          remSleep: 0,
          lightSleep: 0
        }
      };

      let totalSleepDuration = 0;
      let totalSleepScore = 0;
      let totalHeartRate = 0;
      let totalReadinessScore = 0;
      let totalDeepSleep = 0;
      let totalRemSleep = 0;
      let totalLightSleep = 0;
      let heartRateCount = 0;

      // Process each day's sleep data
      validSleepData.forEach(dayData => {
        const sleep = (dayData as any).sleep || {};
        const readiness = (dayData as any).readiness || {};
        
        const sleepDurationHours = sleep.total_sleep_duration ? sleep.total_sleep_duration / 3600 : 0;
        const avgHeartRate = sleep.average_heart_rate || null;
        
        console.log(`🔍 Processing sleep data for ${dayData.date}:`, {
          sleepDurationHours: sleepDurationHours.toFixed(1),
          sleepScore: sleep.sleep_score || 0,
          readinessScore: readiness.readiness_score || 0,
          hasValidData: sleepDurationHours > 0
        });
        
        sleepData.dailyLogs.push({
          date: dayData.date,
          sleepDuration: Math.round(sleepDurationHours * 10) / 10, // Hours, 1 decimal
          sleepScore: sleep.sleep_score || 0,
          averageHeartRate: avgHeartRate,
          readinessScore: readiness.readiness_score || 0,
          deepSleep: sleep.deep_sleep_duration ? Math.round(sleep.deep_sleep_duration / 3600 * 10) / 10 : 0,
          remSleep: sleep.rem_sleep_duration ? Math.round(sleep.rem_sleep_duration / 3600 * 10) / 10 : 0,
          lightSleep: sleep.light_sleep_duration ? Math.round(sleep.light_sleep_duration / 3600 * 10) / 10 : 0,
          sleepEfficiency: sleep.sleep_efficiency || 0,
          bedtimeStart: sleep.bedtime_start,
          bedtimeEnd: sleep.bedtime_end,
          awakeTime: sleep.awake_time ? Math.round(sleep.awake_time / 60) : 0, // Convert to minutes
          lowestHeartRate: sleep.lowest_heart_rate || 0,
          respiratoryRate: sleep.respiratory_rate || 0
        });
        
        // Add to totals for averaging
        totalSleepDuration += sleepDurationHours;
        totalSleepScore += sleep.sleep_score || 0;
        totalReadinessScore += readiness.readiness_score || 0;
        totalDeepSleep += sleep.deep_sleep_duration ? sleep.deep_sleep_duration / 3600 : 0;
        totalRemSleep += sleep.rem_sleep_duration ? sleep.rem_sleep_duration / 3600 : 0;
        totalLightSleep += sleep.light_sleep_duration ? sleep.light_sleep_duration / 3600 : 0;
        
        if (avgHeartRate && avgHeartRate > 0) {
          totalHeartRate += avgHeartRate;
          heartRateCount++;
        }
      });

      // Calculate averages
      const dayCount = validSleepData.length;
      if (dayCount > 0) {
        sleepData.averages.sleepDuration = Math.round(totalSleepDuration / dayCount * 10) / 10;
        sleepData.averages.sleepScore = Math.round(totalSleepScore / dayCount);
        sleepData.averages.readinessScore = Math.round(totalReadinessScore / dayCount);
        sleepData.averages.deepSleep = Math.round(totalDeepSleep / dayCount * 10) / 10;
        sleepData.averages.remSleep = Math.round(totalRemSleep / dayCount * 10) / 10;
        sleepData.averages.lightSleep = Math.round(totalLightSleep / dayCount * 10) / 10;
        sleepData.averages.averageHeartRate = heartRateCount > 0 ? Math.round(totalHeartRate / heartRateCount) : 0;
      }

      console.log(`✅ Sleep data processed: ${dayCount} days, avg ${sleepData.averages.sleepDuration}h sleep, ${sleepData.averages.sleepScore} score`);

      return {
        success: true,
        data: sleepData
      };
      
    } catch (error) {
      console.error('Error fetching sleep data:', error);
      return {
        success: false,
        data: null,
        error: `Failed to fetch sleep data: ${error.message}`
      };
    }
  };

  // Smart data fetching - enhanced with caching and context preservation
  const getDataForQuery = async (query: string) => {
    // Step 1: Analyze query intent to determine what data to fetch
    const intent = analyzeQueryIntent(query);
    
    console.log(`🧠 Query analysis complete:`, { 
      intent: intent.type,
      needsNutrition: intent.needsNutrition,
      needsRunning: intent.needsRunning,
      needsSleep: intent.needsSleep,
      dateRange: intent.dateRange ? 
        `${intent.dateRange.startDate.toDateString()} → ${intent.dateRange.endDate.toDateString()}` : 
        'default range'
    });
    
    // Step 1.5: Smart cache merging - reuse what we have, fetch what we need
    let mcpResponses: MCPResponse[] = [];
    let nutritionResponse: NutritionResponse | null = null;
    let sleepResponse: SleepResponse | null = null;
    
    // Check what data we can reuse from cache
    const canReuseCache = canReuseCachedData(intent);
    const hasValidCache = context.cachedData && context.cachedData.fetchedAt;
    
    if (hasValidCache) {
      console.log('🔍 Analyzing cached data for reuse...');
      
      // Reuse cached nutrition data if we have it and need it
      if (intent.needsNutrition && context.cachedData.nutritionData) {
        nutritionResponse = { success: true, data: context.cachedData.nutritionData };
        console.log('♻️ Reusing cached nutrition data');
      }
      
      // Reuse cached sleep data if we have it and need it
      if (intent.needsSleep && context.cachedData.sleepData) {
        sleepResponse = { success: true, data: context.cachedData.sleepData };
        console.log('♻️ Reusing cached sleep data');
      }
      
      // Reuse cached MCP data if we have it and need it
      if (intent.needsRunning && context.cachedData.mcpResponses && context.cachedData.mcpResponses.length > 0) {
        mcpResponses = context.cachedData.mcpResponses;
        console.log('♻️ Reusing cached MCP/running data');
      }
    }
    
    // If we have all required data from cache, return early
    if (canReuseCache) {
      console.log('✅ All required data available in cache, no additional fetching needed');
      return {
        intent: intent.type,
        needsNutrition: intent.needsNutrition,
        needsRunning: intent.needsRunning,
        needsSleep: intent.needsSleep,
        nutritionData: nutritionResponse?.data || null,
        sleepData: sleepResponse?.data || null,
        mcpResponses: mcpResponses,
        dateRange: intent.dateRange
      };
    }
    
    // Step 2: Fetch activity data if needed and not cached (LAZY LOADING)
    if ((intent.needsRunning || intent.needsCycling || intent.needsSwimming) && mcpResponses.length === 0) {
      const sportType = intent.primarySport || 'all';
      console.log(`🏃 Fetching MCP ${sportType} data based on query requirements...`);
      console.log(`📋 Required data types:`, {
        running: intent.runningDataTypes,
        cycling: intent.cyclingDataTypes,
        swimming: intent.swimmingDataTypes
      });

      // Only fetch what's specifically needed for this query
      const needsStreams = intent.runningDataTypes?.includes('activity_streams') || 
                          intent.cyclingDataTypes?.includes('activity_streams') || 
                          intent.swimmingDataTypes?.includes('activity_streams');
      const needsZones = intent.runningDataTypes?.includes('athlete_zones') || 
                        intent.cyclingDataTypes?.includes('athlete_zones') || 
                        intent.swimmingDataTypes?.includes('athlete_zones');
      
      console.log(`🎯 Lazy loading strategy: streams=${needsStreams}, zones=${needsZones}`);
      console.log(`🎯 Sport-specific data types:`, {
        running: intent.runningDataTypes,
        cycling: intent.cyclingDataTypes,
        swimming: intent.swimmingDataTypes
      });
      
      // Parse date requirements for MCP calls
      const { startDate, endDate, criteria } = parseDateQuery(query);
      const activityCriteria = determineActivityCriteria(query, intent);
      const lowerQuery = query.toLowerCase();
      
      // Smart activity fetching - optimize based on query type and use precise API filtering
      const activitiesCall: { endpoint: string; params: any } = {
        endpoint: 'get-recent-activities',
        params: { per_page: 10 } // Default fallback
      };
      
      // Add sport-specific filtering based on primary sport
      if (intent.primarySport && intent.primarySport !== 'all') {
        const sportMap = {
          'running': 'Run',
          'cycling': 'Ride', 
          'swimming': 'Swim'
        };
        activitiesCall.params.activityType = sportMap[intent.primarySport];
        console.log(`🎯 Filtering activities by sport: ${intent.primarySport} (${sportMap[intent.primarySport]})`);
      }
      
      // For specific dates, use precise API date filtering 
      if (startDate && endDate && criteria.type === 'specific') {
        const startDateStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
        const endDateStr = endDate.toISOString().split('T')[0];     // YYYY-MM-DD
        
        // Same start/end date = single day query
        const isSingleDay = startDateStr === endDateStr;
        
        activitiesCall.params = {
          ...activitiesCall.params,
          per_page: isSingleDay ? 3 : 5, // Single day: max 1-2 activities + buffer, Multi-day: 5
          after: startDateStr,
          before: endDateStr
        };
        console.log(`📅 Using precise API date filter: ${startDateStr} to ${endDateStr} (${isSingleDay ? 'single day' : 'date range'})`);
      } else {
        // Calculate activities needed for broader queries
        let activitiesNeeded = 10; // Default
        
        if (lowerQuery.includes('last 7 days') || lowerQuery.includes('this week')) {
          activitiesNeeded = 14; // 7 days × 2/day = 14
        } else if (lowerQuery.includes('last 30 days') || lowerQuery.includes('last month')) {
          activitiesNeeded = 60; // 30 days × 2/day = 60
        } else if (lowerQuery.includes('since') || criteria.type === 'since') {
          activitiesNeeded = 200; // Long historical range
        }
        
        activitiesCall.params.per_page = activitiesNeeded;
        console.log(`📥 Fetching ${activitiesNeeded} activities for broad query`);
      }
      
      const activitiesResponse = await executeMCPCalls([activitiesCall]);
      mcpResponses.push(...activitiesResponse);
      
      if (activitiesResponse[0]?.success) {
        // Client-side filtering to find matching activities
        const allContentItems = activitiesResponse[0].data?.content || [];
        const activitiesText = allContentItems
          .map(item => item.text)
          .filter(text => text && text.trim())
          .join('\n');
        
        console.log(`📋 Processing ${allContentItems.length} activity items from MCP server`);
        
        const filteredActivityIds = filterActivitiesByDateAndCriteria(
          activitiesText,
          startDate!,
          endDate!,
          activityCriteria
        );
        
        if (filteredActivityIds.length > 0) {
          console.log(`✅ Found ${filteredActivityIds.length} matching activities`);
          
          // LAZY LOADING: Only fetch what this specific query needs
          const detailedCalls = [];
          
          // Always get basic details for matching activities
          for (const id of filteredActivityIds) {
            detailedCalls.push({ endpoint: 'get-activity-details', params: { activityId: id } });
          }
          
          // CONDITIONAL FETCHING: Only fetch streams if user specifically asks for detailed analysis
          if (needsStreams) {
            console.log(`📊 User query requires streams data - fetching detailed HR/pace/speed data for ${filteredActivityIds.length} activities`);
            for (const id of filteredActivityIds) {
              detailedCalls.push({ 
                endpoint: 'get-activity-streams', 
                params: { 
                  id, 
                  types: ['heartrate', 'velocity_smooth', 'distance', 'time', 'watts'],
                  resolution: 'high', 
                  points_per_page: 500 // High resolution for km-by-km splits
                }
              });
            }
          } else {
            console.log(`📊 Basic query - skipping streams data to optimize performance`);
          }
          
          // CONDITIONAL FETCHING: Only fetch zones if user asks about heart rate zones
          if (needsZones) {
            console.log(`🎯 User query requires zone data - fetching athlete heart rate zones`);
            detailedCalls.push({ endpoint: 'get-athlete-zones', params: {} });
          }
          
          console.log(`🔍 Making ${detailedCalls.length} targeted MCP calls`);
          
          const detailedData = await executeMCPCalls(detailedCalls);
          mcpResponses.push(...detailedData);
          
          console.log(`✅ MCP data retrieval complete: ${filteredActivityIds.length} activities, ${detailedCalls.length} API calls`);
        } else {
          console.log('❌ No activities found matching criteria');
        }
      }
    }

    // Step 3: Smart nutrition timing if needed
    let nutritionDateRange = intent.dateRange;
    
    if (intent.isSmartTiming && intent.needsNutrition && mcpResponses.length > 0) {
      console.log(`🧠 Applying smart nutrition timing logic...`);
      
      // Extract activity data for timing analysis
      const activityDetails = mcpResponses
        .filter(r => r.success && r.endpoint === 'get-activity-details')
        .map(r => r.data?.content?.[0]?.text)
        .filter(text => text);
      
      if (activityDetails.length > 0 && intent.dateRange) {
        const runDate = intent.dateRange.startDate;
        const smartNutritionDate = await determineNutritionDateForActivity(activityDetails, runDate);
        
        // Update nutrition date range to use smart timing
        nutritionDateRange = {
          startDate: smartNutritionDate,
          endDate: smartNutritionDate  // Single day for nutrition-performance analysis
        };
        
        console.log(`🎯 Smart timing applied: nutrition from ${smartNutritionDate.toDateString()} for run on ${runDate.toDateString()}`);
      }
    }

    // Step 4: Fetch nutrition data if needed and not cached
    if (intent.needsNutrition && nutritionDateRange && !nutritionResponse) {
      console.log(`🥗 Fetching nutrition data for date range...`);
      nutritionResponse = await fetchNutritionDataForRange(nutritionDateRange.startDate, nutritionDateRange.endDate);
      
      if (!nutritionResponse.success) {
        console.log(`⚠️ Nutrition data fetch failed: ${nutritionResponse.error}`);
      } else {
        console.log(`✅ Nutrition data fetched successfully: ${nutritionResponse.data?.totalDays} days`);
      }
    }
    
    // Step 5: Fetch sleep data if needed and not cached
    if (intent.needsSleep && !sleepResponse) {
      const sleepDateRange = intent.dateRange || {
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        endDate: new Date()
      };
      
      console.log(`😴 Fetching sleep data for date range...`);
      sleepResponse = await fetchSleepDataForRange(sleepDateRange.startDate, sleepDateRange.endDate);
      
      if (!sleepResponse.success) {
        console.log(`⚠️ Sleep data fetch failed: ${sleepResponse.error}`);
      } else {
        console.log(`✅ Sleep data fetched successfully`);
      }
    }
    
    // Step 6: Cache the merged data (combine new fetches with existing cache)
    const cacheData = {
      mcpResponses,
      nutritionData: nutritionResponse?.success ? nutritionResponse.data : (hasValidCache ? context.cachedData.nutritionData : null),
      sleepData: sleepResponse?.success ? sleepResponse.data : (hasValidCache ? context.cachedData.sleepData : null),
      dateRange: intent.dateRange,
      fetchedAt: new Date()
    };
    
    setContext(prev => ({
      ...prev,
      cachedData: cacheData
    }));
    
    console.log('💾 Data cached for potential reuse');
    
    // Step 7: Return combined result
    return { 
      intent: intent.type,
      needsNutrition: intent.needsNutrition,
      needsRunning: intent.needsRunning,
      needsSleep: intent.needsSleep,
      nutritionData: nutritionResponse?.success ? nutritionResponse.data : null,
      sleepData: sleepResponse?.success ? sleepResponse.data : null,
      mcpResponses,
      dateRange: intent.dateRange
    };
  };

  // Validate if we have sufficient data before calling Claude
  const validateDataForClaude = (mcpResponses: MCPResponse[], nutritionData: any = null, sleepData: any = null): boolean => {
    const successfulMcpResponses = mcpResponses.filter(r => r.success && r.data?.content?.[0]?.text);
    
    // Check MCP data quality
    const hasRealMcpData = successfulMcpResponses.some(r => {
      const text = r.data.content[0].text;
      return text.length > 100 && !text.includes('No activities found');
    });
    
    // Check nutrition data quality
    const hasNutritionData = nutritionData && nutritionData.totalDays > 0;
    
    // Check sleep data quality
    const hasSleepData = sleepData && sleepData.totalDays > 0;
    
    // Need at least one type of meaningful data
    if (!hasRealMcpData && !hasNutritionData && !hasSleepData) {
      console.log('❌ No meaningful MCP, nutrition, or sleep data - skip Claude call');
      return false;
    }
    
    console.log(`✅ Data validation passed:`, {
      mcpResponses: `${successfulMcpResponses.length} successful`,
      nutritionDays: hasNutritionData ? nutritionData.totalDays : 0,
      sleepDays: hasSleepData ? sleepData.totalDays : 0
    });
    return true;
  };

  // Generate response using Claude with focused data
  const generateResponseWithClaude = async (query: string, intent: any, mcpResponses: MCPResponse[]): Promise<string> => {
    try {
      console.log('🔍 Sending to Claude API:', {
        query,
        intentType: intent.type,
        hasNutritionData: !!intent.nutritionData,
        hasSleepData: !!intent.sleepData,
        nutritionDays: intent.nutritionData?.totalDays || 0,
        sleepDays: intent.sleepData?.totalDays || 0,
        mcpResponseCount: mcpResponses.length,
        fullIntentObject: intent
      });

      // Get conversation context for better follow-up analysis
      const conversationContext = context.conversationHistory && context.conversationHistory.length > 1 
        ? context.conversationHistory.slice(-2) // Last 2 queries for context
        : [];

      const response = await fetch('/api/claude-coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'generate_response',
          query,
          analysis: intent,  // Backend expects 'analysis', not 'intent'
          mcpResponses,
          nutritionData: intent.nutritionData,  // Pass nutritionData separately
          sleepData: intent.sleepData,  // 🆕 Also pass sleepData separately
          conversationContext  // 🆕 Pass conversation history for context
        })
      });

      if (!response.ok) {
        throw new Error(`Backend API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.fallback) {
        console.log('⚠️ Using fallback response mode');
      }
      
      return data.response;
      
    } catch (error) {
      console.error('❌ Claude response generation failed:', error);
      
      // Show real error instead of fabricating data
      let errorMessage = "❌ **Claude AI Analysis Failed**\n\n";
      
      if (error.message.includes('500')) {
        errorMessage += "**Issue:** Claude AI service returned a 500 error\n\n";
        errorMessage += "**Likely causes:**\n";
        errorMessage += "• Your data payload is very large (lots of detailed nutrition/activity data)\n";
        errorMessage += "• Claude API rate limits or temporary service issues\n";
        errorMessage += "• Token limits exceeded due to comprehensive data\n\n";
        errorMessage += "**Your data collection was successful:**\n";
        
        // Show summary of what data we actually have
        const activities = mcpResponses.filter(r => r.endpoint === 'get-activity-details').length;
        if (activities > 0) {
          errorMessage += `• ✅ ${activities} detailed activities found\n`;
        }
        
        errorMessage += "\n**Solutions:**\n";
        errorMessage += "• Try asking about a shorter time range (e.g., 'last 3 days' instead of 'last 30 days')\n";
        errorMessage += "• Ask more specific questions\n";
        errorMessage += "• Wait a few minutes and try again\n";
      } else {
        errorMessage += `**Technical error:** ${error.message}\n\n`;
        errorMessage += "Please try again or contact support if the issue persists.";
      }
      
      return errorMessage;
    }
  };

  // Extract activity details from MCP responses for context
  const extractActivityDetails = (mcpResponses: MCPResponse[]) => {
    const activityDetails: any[] = [];
    
    mcpResponses.forEach(response => {
      if (response.success && response.endpoint === 'get-activity-details' && response.data?.content) {
        response.data.content.forEach((item: any) => {
          if (item.text && item.text.includes('km') && item.text.includes('bpm')) {
            activityDetails.push(item.text);
          }
        });
      }
    });
    
    return activityDetails.join('\n');
  };

  // Enhanced handleSendMessage with context preservation
  const handleSendMessage = async () => {
    if (!input.trim()) return;

    // Ensure we have a current session
    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = createNewSession();
    }

    const originalQuery = input.trim();
    const resolvedQuery = resolveContextualQuery(originalQuery);
    
    console.log(`🔗 Processing query: "${originalQuery}" → "${resolvedQuery}"`);

    const userMessage: Message = {
      role: 'user',
      content: originalQuery,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Get data for the resolved query
      const queryData = await getDataForQuery(resolvedQuery);
      
      // Save context for future queries
      const dateFromQuery = extractDateFromQuery(resolvedQuery);
      const activityDetails = extractActivityDetails(queryData.mcpResponses);
      
      // Update conversation history and context
      setContext(prev => {
        console.log(`📋 Current conversation history length: ${prev.conversationHistory?.length || 0}`);
        console.log(`🔄 Adding new query to history: "${resolvedQuery.substring(0, 50)}..." with intent: ${queryData.intent}`);
        
        // 🚨 TRACK CONVERSATION HISTORY CHANGES
        const prevHistoryLength = prev.conversationHistory?.length || 0;
        console.log(`🔍 CONTEXT UPDATE: Previous history length: ${prevHistoryLength}`);
        if (prevHistoryLength === 0) {
          console.warn(`⚠️ WARNING: Starting with empty conversation history - context may have been cleared!`);
        }
        
        const newHistory = [
          ...(prev.conversationHistory || []).slice(-9), // Keep last 10 entries
          {
            query: resolvedQuery,
            intent: queryData.intent,
            dateRange: queryData.dateRange,
            timestamp: new Date()
          }
        ];
        
        const updatedContext = {
          ...prev,
          lastDate: dateFromQuery,
          lastDateParsed: queryData.dateRange?.startDate,
          lastActivities: activityDetails,
          lastQueryType: queryData.intent,
          conversationHistory: newHistory
        };
        
        console.log(`📋 Updated conversation history length: ${newHistory.length}`);
        console.log(`🔍 Last 3 queries in history:`, newHistory.slice(-3).map(h => ({
          query: h.query.substring(0, 30) + '...',
          intent: h.intent,
          dateRange: h.dateRange ? `${h.dateRange.startDate.toDateString()}` : 'none'
        })));
        
        // 🚨 DETECT UNEXPECTED HISTORY DROPS
        if (prevHistoryLength > 0 && newHistory.length === 1) {
          console.error(`🚨 CRITICAL: Conversation history dropped from ${prevHistoryLength} to 1! Context was unexpectedly cleared.`);
          console.error(`🚨 Previous context:`, prev);
          console.error(`🚨 New context:`, updatedContext);
        }
        
        return updatedContext;
      });
      
      // Validate data and generate response
      if (validateDataForClaude(queryData.mcpResponses, queryData.nutritionData, queryData.sleepData)) {
        const response = await generateResponseWithClaude(resolvedQuery, queryData, queryData.mcpResponses);
        
        const assistantMessage: Message = {
          role: 'assistant',
          content: response,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        console.log('✅ Enhanced Coach response generated with context preservation');
      } else {
        const fallbackMessage: Message = {
          role: 'assistant',
          content: "❌ **No Sufficient Data Found**\n\nI couldn't find enough data to answer your question. This could mean:\n• No activities found for the specified date range\n• No nutrition data logged for those dates\n• Data sources not connected properly\n\nPlease try:\n• Asking about a different time period\n• Checking if your Strava/nutrition data is synced\n• Being more specific about what you want to analyze",
          timestamp: new Date()
        };
        setMessages(prev => [...prev, fallbackMessage]);
      }
      
    } catch (error) {
      console.error('❌ Enhanced Coach error:', error);
      
      const errorMessage: Message = {
        role: 'assistant',
        content: "I'm having trouble processing your request right now. Please try again in a moment.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Smart coaching prompts organized by category
  const runningPrompts = [
    "analyze my pace trends this month",
    "show my longest runs from last week", 
    "how has my running consistency been",
    "compare my run times this week vs last week",
    "what's my average heart rate during runs"
  ];

  const nutritionPrompts = [
    "show my protein intake for the last 7 days",
    "analyze my calorie patterns this week",
    "what foods am I eating most often",
    "compare my nutrition goals vs actual intake",
    "how balanced has my diet been lately"
  ];

  const sleepPrompts = [
    "how has my sleep quality been this week",
    "analyze my sleep duration patterns",
    "show my sleep scores and trends",
    "how does my sleep affect my running",
    "compare my deep sleep vs light sleep"
  ];

  const combinedPrompts = [
    "how does my nutrition affect my running performance",
    "compare my energy intake to calories burned this week",
    "analyze my pre-run fueling strategies",
    "show the relationship between my diet and recovery",
    "how does my sleep impact my running performance"
  ];

  // Contextual prompts shown when context is available
  const contextualPrompts = [
    "what did I eat that day",
    "how was my nutrition that day", 
    "compare my calories to my activity",
    "analyze my protein intake that day",
    "how was my sleep that night"
  ];

  // Chat area auto-expands naturally - no separate scrollbar needed

  // Format message content with bold titles
  const formatMessageContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, index) => {
      // Check if line is a title (starts with ##, #, or typical title patterns)
      const isTitle = line.match(/^(#{1,6}\s+)|^([A-Z][^:]*:)|^(\*\*[^*]+\*\*)/);
      const isBoldSection = line.match(/^\*\*([^*]+)\*\*/);
      
      if (isBoldSection) {
        const boldText = line.replace(/\*\*(.*?)\*\*/g, '$1');
        return (
          <div key={index} className="mb-3 font-bold text-gray-900 text-lg">
            {boldText}
          </div>
        );
      } else if (isTitle) {
        const cleanLine = line.replace(/^#+\s*/, '').replace(/\*\*/g, '');
        return (
          <div key={index} className="mb-3 font-bold text-gray-900 text-lg">
            {cleanLine}
          </div>
        );
      } else {
        return (
          <div key={index} className="mb-2">
            {line}
          </div>
        );
      }
    });
  };

  // Chat area auto-expands naturally - no manual scrolling needed

  // 🚨 DEBUG: Track context changes to detect when conversation history gets cleared
  useEffect(() => {
    const historyLength = context.conversationHistory?.length || 0;
    console.log(`🔍 CONTEXT EFFECT: Conversation history length changed to: ${historyLength}`);
    
    if (historyLength === 0 && messages.length > 2) {
      console.error(`🚨 CONTEXT CLEARED: History is empty but we have ${messages.length} messages - context was reset!`);
      console.error(`🚨 Current context:`, context);
    }
  }, [context.conversationHistory, messages.length]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/50 sticky top-0 z-10">
        <div className="mobile-container">
          <div className="flex items-center justify-between h-16">
            <Button
              onClick={() => navigate('/')}
              variant="ghost"
              className="text-slate-600 hover:text-slate-900 hover:bg-slate-100/50 font-medium touch-target rounded-xl transition-all duration-200"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent tracking-tight">
                AI Health Coach
              </h1>
            </div>
            
            <div className="w-16 sm:w-20"></div> {/* Spacer for balance */}
          </div>
        </div>
      </header>

      {/* Main Layout with Integrated Sidebar */}
      <div className="flex flex-col lg:flex-row max-w-7xl mx-auto">
        {/* Sidebar - Integrated design, positioned lower */}
        <aside className="hidden lg:block lg:w-80 bg-gradient-to-b from-slate-50/80 to-blue-50/60 backdrop-blur-sm border-r border-slate-200/30 h-screen sticky top-0">
          <div className="p-8 pt-12">
            {/* Subtle header */}
            <div className="mb-8">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-indigo-600/20 rounded-2xl flex items-center justify-center mb-4">
                <Sparkles className="h-5 w-5 text-blue-600" />
              </div>
              <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
                This Week's Metrics
              </h2>
            </div>
            
            {metricsLoading ? (
              <div className="space-y-4">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                </div>
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                </div>
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Calories Burned */}
                <div className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-2xl blur-sm group-hover:blur-md transition-all duration-300"></div>
                  <div className="relative bg-white/70 backdrop-blur-sm p-5 rounded-2xl border border-orange-200/50 hover:border-orange-300/70 transition-all duration-300 hover:shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                        <span className="text-white text-lg">🔥</span>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-slate-800">{weeklyMetrics?.caloriesBurned || 0}</p>
                        <p className="text-xs text-slate-500 font-medium">calories/day</p>
                      </div>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-700">Calories Burned</h3>
                  </div>
                </div>

                {/* Calories Consumed */}
                <div className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-green-500/10 rounded-2xl blur-sm group-hover:blur-md transition-all duration-300"></div>
                  <div className="relative bg-white/70 backdrop-blur-sm p-5 rounded-2xl border border-emerald-200/50 hover:border-emerald-300/70 transition-all duration-300 hover:shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-500 rounded-xl flex items-center justify-center">
                        <span className="text-white text-lg">🥗</span>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-slate-800">{weeklyMetrics?.caloriesConsumed || 0}</p>
                        <p className="text-xs text-slate-500 font-medium">calories/day</p>
                      </div>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-700">Calories Consumed</h3>
                  </div>
                </div>

                {/* Protein */}
                <div className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-2xl blur-sm group-hover:blur-md transition-all duration-300"></div>
                  <div className="relative bg-white/70 backdrop-blur-sm p-5 rounded-2xl border border-blue-200/50 hover:border-blue-300/70 transition-all duration-300 hover:shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
                        <span className="text-white text-lg">💪</span>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-slate-800">{weeklyMetrics?.protein || 0}g</p>
                        <p className="text-xs text-slate-500 font-medium">protein/day</p>
                      </div>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-700">Protein Intake</h3>
                  </div>
                </div>

                {/* Activities */}
                <div className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl blur-sm group-hover:blur-md transition-all duration-300"></div>
                  <div className="relative bg-white/70 backdrop-blur-sm p-5 rounded-2xl border border-purple-200/50 hover:border-purple-300/70 transition-all duration-300 hover:shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                        <span className="text-white text-lg">🏃</span>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-800">{weeklyMetrics?.activities?.length || 0}</p>
                        <p className="text-xs text-slate-500 font-medium">types</p>
                      </div>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Activity Types</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {weeklyMetrics?.activities?.length > 0 
                        ? weeklyMetrics.activities.join(', ')
                        : 'No activities recorded'
                      }
                    </p>
                  </div>
                </div>

                {/* Last Updated */}
                {weeklyMetrics?.lastUpdated && (
                  <div className="text-center pt-4">
                    <div className="inline-flex items-center gap-2 bg-slate-100/50 px-3 py-2 rounded-full">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <p className="text-xs text-slate-500 font-medium">
                        Updated {weeklyMetrics.lastUpdated}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Mobile Metrics Summary - Only visible on mobile */}
        <div className="lg:hidden bg-white border-b border-gray-200 mobile-container py-4">
          {metricsLoading ? (
            <div className="text-center">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="text-sm font-medium text-gray-600 mb-2">This Week</div>
              <div className="flex justify-center gap-4 text-xs">
                <span className="text-red-600">🔥 {weeklyMetrics?.caloriesBurned || 0}</span>
                <span className="text-green-600">🥗 {weeklyMetrics?.caloriesConsumed || 0}</span>
                <span className="text-blue-600">💪 {weeklyMetrics?.protein || 0}g</span>
              </div>
            </div>
          )}
        </div>

        {/* Main Chat Container */}
        <main className="flex-1">
        <div className="flex flex-col min-h-[calc(100vh-4rem)] lg:min-h-[calc(100vh-4rem)]">
          
          {/* Messages Area */}
          <div className="flex-1 mobile-container py-6 sm:py-8">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                {/* Animated background elements */}
                <div className="absolute top-20 left-20 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-20 right-20 w-24 h-24 bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
                
                <div className="relative">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center mb-8 shadow-2xl">
                    <Bot className="h-10 w-10 text-white" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full animate-ping"></div>
                </div>
                
                <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent mb-4 tracking-tight">
                  Welcome to your AI Health Coach
                </h2>
                <p className="text-slate-600 text-lg sm:text-xl max-w-lg leading-relaxed px-4 mb-8">
                  I can analyze your running, cycling, swimming, nutrition, and sleep data to provide personalized insights and recommendations.
                </p>
                
                {/* Elegant prompt suggestions */}
                <div className="mt-8 sm:mt-12 w-full max-w-2xl px-4">
                  <div className="grid gap-3">
                    <button 
                      onClick={() => {
                        setInput("how has my sleep, nutrition, running, cycling, and swimming been in the last 10 days and how have they impacted each other");
                        setTimeout(() => handleSendMessage(), 100);
                      }}
                      className="text-left p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200 group"
                    >
                                             <div className="font-medium text-sm sm:text-base text-gray-900 group-hover:text-blue-600 transition-colors">
                         📊 Comprehensive 10-day health analysis
                       </div>
                       <div className="text-xs sm:text-sm text-gray-600 mt-1">
                         Deep dive into your sleep, nutrition, running, cycling, and swimming patterns with correlation insights
                       </div>
                     </button>
                     
                     <button 
                       onClick={() => {
                         setInput("how does my nutrition affect my running performance and what can I optimize");
                         setTimeout(() => handleSendMessage(), 100);
                       }}
                       className="text-left p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200 group"
                     >
                       <div className="font-medium text-sm sm:text-base text-gray-900 group-hover:text-blue-600 transition-colors">
                         🍎 Nutrition-performance optimization
                       </div>
                       <div className="text-xs sm:text-sm text-gray-600 mt-1">
                         Discover how your diet impacts training and get personalized fueling strategies
                       </div>
                     </button>
                     
                     <button 
                       onClick={() => {
                         setInput("analyze my sleep patterns, recovery quality, and how they affect my athletic performance");
                         setTimeout(() => handleSendMessage(), 100);
                       }}
                       className="text-left p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200 group"
                     >
                       <div className="font-medium text-sm sm:text-base text-gray-900 group-hover:text-blue-600 transition-colors">
                         😴 Sleep & recovery mastery  
                       </div>
                       <div className="text-xs sm:text-sm text-gray-600 mt-1">
                         Understand your sleep quality, recovery patterns, and performance correlations
                       </div>
                     </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Message Thread */}
            <div className="space-y-4 sm:space-y-6 max-w-3xl mx-auto">
              {messages.map((message, index) => (
                <div key={index} className="group">
                  {message.role === 'user' ? (
                    // User message
                    <div className="flex justify-end">
                      <div className="max-w-[85%] sm:max-w-xs md:max-w-md lg:max-w-lg">
                        <div className="bg-blue-600 text-white rounded-3xl rounded-br-lg px-4 sm:px-6 py-3 sm:py-4 shadow-sm">
                          <div className="text-sm sm:text-[15px] leading-relaxed font-medium">
                            {message.content}
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 mt-2 px-3">
                          <span className="text-xs text-gray-500 font-medium">
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Assistant message
                    <div className="flex">
                      <div className="flex-shrink-0 mr-2 sm:mr-4">
                        <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                          <Bot className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                        </div>
                      </div>
                      <div className="flex-1 max-w-none">
                        <div className="prose prose-sm max-w-none">
                          <div className="text-sm sm:text-[15px] leading-relaxed text-gray-800 whitespace-pre-wrap font-normal">
                            {formatMessageContent(message.content)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <span className="text-xs text-gray-500 font-medium">
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-center">
                  <div className="flex items-center gap-3 text-slate-600">
                    {/* Elegant spinner */}
                    <div className="relative">
                      <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
                    </div>
                    
                    {/* Minimal text */}
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-700">🏁 Power, recovery, and performance — we're on it...</span>
                      <span className="text-xs text-slate-500">Please wait...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Input Area */}
          <div className="border-t border-slate-200/50 bg-white/80 backdrop-blur-md mt-auto">
            <div className="mobile-container py-4 sm:py-6">
              <div className="max-w-3xl mx-auto">
                {/* Context indicator */}
                {context.lastDate && (
                  <div className="mb-4 flex items-center justify-between">
                    <div className="text-xs text-slate-600 font-medium bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-2 rounded-full border border-blue-200/50 shadow-sm">
                      <Sparkles className="h-3 w-3 inline mr-2 text-blue-500" />
                      Context: {context.lastDate}
                    </div>
                    <button
                      onClick={() => setContext({})}
                      className="text-xs text-slate-500 hover:text-slate-700 font-medium px-3 py-1 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                )}
                
                {/* Input field */}
                <div className="relative">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={isRecording ? "🎤 Listening..." : "Ask about your health data..."}
                    disabled={isLoading}
                    className={`w-full px-4 sm:px-6 py-4 sm:py-5 pr-20 sm:pr-24 text-sm sm:text-[15px] border border-slate-300/50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent resize-none placeholder-slate-500 font-normal shadow-lg bg-white/90 backdrop-blur-sm transition-all duration-200 ${
                      isRecording ? 'bg-blue-50/90 border-blue-400/50 shadow-blue-100' : 'hover:shadow-xl'
                    }`}
                  />
                  
                  {/* Microphone button */}
                  {speechSupported && (
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isLoading}
                      className={`absolute right-10 sm:right-12 top-1/2 transform -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center transition-all duration-200 touch-target ${
                        isRecording 
                          ? 'bg-green-500 hover:bg-green-600 text-white' 
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                      } disabled:cursor-not-allowed`}
                    >
                      {isRecording ? (
                        <MicOff className="w-3 h-3 sm:w-4 sm:h-4" />
                      ) : (
                        <Mic className="w-3 h-3 sm:w-4 sm:h-4" />
                      )}
                    </button>
                  )}
                  
                  {/* Send button */}
                  <button
                    onClick={handleSendMessage}
                    disabled={isLoading || (!input.trim() && !isRecording)}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-xl flex items-center justify-center transition-colors duration-200 disabled:cursor-not-allowed touch-target"
                  >
                    {isLoading ? (
                      <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                      </svg>
                    )}
                  </button>
                </div>
                
                {/* Footer */}
                <div className="text-center mt-3">
                  <p className="text-xs text-gray-500 font-medium">
                    AI Health Coach can analyze your running, cycling, swimming, nutrition, and sleep data
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        </main>
      </div>
    </div>
  );
} 
