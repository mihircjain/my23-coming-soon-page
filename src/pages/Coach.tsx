import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Activity, Bot, Zap, TrendingUp, Flame, Utensils, Target, Heart, ArrowLeft, Sparkles, Trophy, Calendar, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/lib/firebaseConfig';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
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
}

interface TodayMetrics {
  caloriesBurned: number;
  caloriesConsumed: number;
  protein: number;
  heartRate: number | null;
  activities: string[];
  lastUpdated: string;
}

interface QueryIntent {
  type: 'nutrition_only' | 'running_only' | 'nutrition_and_running' | 'general';
  needsNutrition: boolean;
  needsRunning: boolean;
  dateRange?: { startDate: Date; endDate: Date };
  nutritionDataTypes?: string[];
  runningDataTypes?: string[];
  isSmartTiming?: boolean;  // Flag for intelligent nutrition timing based on activity time
}

export default function CoachNew() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [stravaStats, setStravaStats] = useState<StravaStats>({ connected: false, lastChecked: 'Never' });
  const [context, setContext] = useState<ConversationContext>({});
  const [todayMetrics, setTodayMetrics] = useState<TodayMetrics>({
    caloriesBurned: 0,
    caloriesConsumed: 0,
    protein: 0,
    heartRate: null,
    activities: [],
    lastUpdated: 'Never'
  });
  const [metricsLoading, setMetricsLoading] = useState(true);

  useEffect(() => {
    testMCPConnection();
    fetchTodayMetrics();
  }, []);

  const testMCPConnection = async () => {
    try {
      const response = await fetch('/api/claude-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_connection'
        })
      });
      
      if (response.ok) {
        setStravaStats({ connected: true, lastChecked: new Date().toLocaleTimeString() });
      }
    } catch (error) {
      console.log('MCP connection test failed');
    }
  };

  // Fetch minimal today's metrics (only when user clicks refresh)
  const fetchTodayMetrics = async (): Promise<void> => {
    try {
      setMetricsLoading(true);
      const today = new Date().toISOString().split('T')[0];
      
      console.log(`🔄 Fetching today's nutrition summary (${today})...`);

      // Fetch only today's nutrition data (not last 7 days)
      const nutritionQuery = query(
        collection(db, "nutritionLogs"),
        where("date", "==", today)
      );

      const nutritionSnapshot = await getDocs(nutritionQuery).catch((error) => {
        console.error("Error fetching today's nutrition:", error);
        return { docs: [] };
      });

      let todayNutrition = { calories: 0, protein: 0 };
      
      if (nutritionSnapshot.docs.length > 0) {
        const data = nutritionSnapshot.docs[0].data();
        todayNutrition = {
          calories: data.totals?.calories || 0,
          protein: data.totals?.protein || 0
        };
        console.log(`✅ Found today's nutrition: ${todayNutrition.calories} cal, ${todayNutrition.protein}g protein`);
      } else {
        console.log(`⚠️ No nutrition data found for ${today}`);
      }

      // Update state with minimal data
      setTodayMetrics({
        caloriesBurned: 0, // Will be populated from MCP queries when needed
        caloriesConsumed: todayNutrition.calories,
        protein: Math.round(todayNutrition.protein),
        heartRate: null, // Will be populated from MCP queries when needed
        activities: [], // Will be populated from MCP queries when needed
        lastUpdated: new Date().toLocaleTimeString()
      });
      
    } catch (error) {
      console.error('Error fetching today metrics:', error);
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

  const analyzeQueryIntent = (query: string): QueryIntent => {
    const lowerQuery = query.toLowerCase();
    
    // Keywords that indicate nutrition-related queries (including common misspellings)
    const nutritionKeywords = [
      'nutrition', 'nutriotn', 'nutriton', 'food', 'foods', 'calories', 'protein', 'carbs', 'fat', 'fiber',
      'macro', 'macros', 'diet', 'eating', 'meal', 'meals', 'consumed', 'intake', 'fueling', 'fuel'
    ];
    
    // Keywords that indicate running/activity-related queries
    const runningKeywords = [
      'run', 'pace', 'heart rate', 'hr', 'activity', 'workout', 'exercise',
      'training', 'distance', 'speed', 'power', 'zones', 'strava'
    ];
    
    const hasNutritionKeywords = nutritionKeywords.some(keyword => lowerQuery.includes(keyword));
    const hasRunningKeywords = runningKeywords.some(keyword => lowerQuery.includes(keyword));
    const isNutritionPerformanceQuery = detectNutritionPerformanceQuery(query);
    
    // Parse date range for data fetching
    const { startDate, endDate } = parseDateQuery(query);
    
    let intent: QueryIntent;
    
    if (isNutritionPerformanceQuery) {
      // Special case: nutrition-performance relationship query
      // Needs smart timing logic to fetch correct nutrition day
      intent = {
        type: 'nutrition_and_running',
        needsNutrition: true,
        needsRunning: true,
        dateRange: startDate && endDate ? { startDate, endDate } : undefined,
        nutritionDataTypes: ['calories', 'protein', 'carbs', 'fat', 'fiber'],
        runningDataTypes: ['activity_details', 'basic_stats'],
        isSmartTiming: true  // Flag for smart timing logic
      };
    } else if (hasNutritionKeywords && hasRunningKeywords) {
      // Both nutrition and running mentioned
      intent = {
        type: 'nutrition_and_running',
        needsNutrition: true,
        needsRunning: true,
        dateRange: startDate && endDate ? { startDate, endDate } : undefined,
        nutritionDataTypes: ['calories', 'protein', 'carbs', 'fat', 'fiber'],
        runningDataTypes: ['activity_details', 'basic_stats']
      };
    } else if (hasNutritionKeywords) {
      // Only nutrition mentioned
      intent = {
        type: 'nutrition_only',
        needsNutrition: true,
        needsRunning: false,
        dateRange: startDate && endDate ? { startDate, endDate } : undefined,
        nutritionDataTypes: ['calories', 'protein', 'carbs', 'fat', 'fiber']
      };
    } else if (hasRunningKeywords) {
      // Only running mentioned
      intent = {
        type: 'running_only',
        needsNutrition: false,
        needsRunning: true,
        dateRange: startDate && endDate ? { startDate, endDate } : undefined,
        runningDataTypes: determineRunningDataTypes(query)
      };
    } else {
      // General query - might need both for context
      intent = {
        type: 'general',
        needsNutrition: true,
        needsRunning: true,
        dateRange: startDate && endDate ? { startDate, endDate } : undefined,
        nutritionDataTypes: ['calories', 'protein'],
        runningDataTypes: ['activity_details']
      };
    }
    
    console.log(`🧠 Query intent analysis:`, {
      query: query.substring(0, 50) + '...',
      intent: intent.type,
      needsNutrition: intent.needsNutrition,
      needsRunning: intent.needsRunning,
      hasNutritionKeywords,
      hasRunningKeywords,
      isNutritionPerformanceQuery,
      dateRange: intent.dateRange ? 
        `${intent.dateRange.startDate.toDateString()} → ${intent.dateRange.endDate.toDateString()}` : 
        'default range'
    });
    
    return intent;
  };

  // Determine what running data types are needed based on query
  const determineRunningDataTypes = (query: string): string[] => {
    const lowerQuery = query.toLowerCase();
    const dataTypes = ['activity_details']; // Always include basic details
    
    if (lowerQuery.includes('heart rate') || lowerQuery.includes('hr') || 
        lowerQuery.includes('pace') || lowerQuery.includes('power') ||
        lowerQuery.includes('analyze') || lowerQuery.includes('distribution')) {
      dataTypes.push('activity_streams');
    }
    
    if (lowerQuery.includes('zone') || lowerQuery.includes('hr')) {
      dataTypes.push('athlete_zones');
    }
    
    if (lowerQuery.includes('stats') || lowerQuery.includes('total') || lowerQuery.includes('summary')) {
      dataTypes.push('athlete_stats', 'athlete_profile');
    }
    
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
        error: `Failed to fetch nutrition data: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  };

  // Context resolution - handle follow-up questions
  const resolveContextualQuery = (query: string): string => {
    const lowerQuery = query.toLowerCase();
    
    // Context references that should use previous context
    const contextualPhrases = [
      'that day', 'that run', 'that activity', 'that date',
      'the same day', 'how was weather', 'what was', 
      'during that', 'on that day', 'from that', 'compare that'
    ];
    
    const hasContextualReference = contextualPhrases.some(phrase => lowerQuery.includes(phrase));
    
    if (hasContextualReference && context.lastDate && context.lastActivities) {
      console.log(`🔗 Contextual query detected! Applying context: ${context.lastDate}`);
      
      // Replace contextual references with specific context
      let resolvedQuery = query;
      
      if (lowerQuery.includes('that day') || lowerQuery.includes('that date') || lowerQuery.includes('on that day')) {
        resolvedQuery = resolvedQuery.replace(/that day|that date|on that day/gi, context.lastDate || '');
      }
      
      if (lowerQuery.includes('how was weather')) {
        resolvedQuery = `weather on ${context.lastDate}`;
      }
      
      if (lowerQuery.includes('what was')) {
        resolvedQuery = resolvedQuery.replace(/what was/gi, `what was on ${context.lastDate}`);
      }
      
      // NEW: Handle "compare that" to maintain activity context
      if (lowerQuery.includes('compare that')) {
        resolvedQuery = `compare my run from ${context.lastDate} to my average`;
      }
      
      console.log(`🔗 Resolved query: "${query}" → "${resolvedQuery}"`);
      return resolvedQuery;
    }
    
    return query; // No context needed
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
  const determineActivityCriteria = (query: string) => {
    const lowerQuery = query.toLowerCase();
    
    let minDistance = 0;
    let activityType = 'Run';
    let analysisType = 'general';
    
    // Distance criteria
    if (lowerQuery.includes('long run')) minDistance = 15;
    if (lowerQuery.includes('marathon')) minDistance = 40;
    if (lowerQuery.includes('half marathon')) minDistance = 20;
    
    // Activity type
    if (lowerQuery.includes('weight') || lowerQuery.includes('strength')) activityType = 'Weight Training';
    if (lowerQuery.includes('walk')) activityType = 'Walk';
    if (lowerQuery.includes('swim')) activityType = 'Swim';
    
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

  // Smart data fetching - only get what the user actually asks for
  const getDataForQuery = async (query: string) => {
    // Step 1: Analyze query intent to determine what data to fetch
    const intent = analyzeQueryIntent(query);
    
    console.log(`🧠 Query analysis complete:`, { 
      intent: intent.type,
      needsNutrition: intent.needsNutrition,
      needsRunning: intent.needsRunning,
      dateRange: intent.dateRange ? 
        `${intent.dateRange.startDate.toDateString()} → ${intent.dateRange.endDate.toDateString()}` : 
        'default range'
    });
    
    let mcpResponses: MCPResponse[] = [];
    let nutritionResponse: NutritionResponse | null = null;
    
    // Step 2: Fetch running data first if smart timing is needed
    if (intent.needsRunning) {
      console.log(`🏃 Fetching MCP running data...`);
      
      // Parse date requirements for MCP calls
      const { startDate, endDate, criteria } = parseDateQuery(query);
      const activityCriteria = determineActivityCriteria(query);
      const lowerQuery = query.toLowerCase();
      
      // Calculate EXACT activities needed based on query type
      let activitiesNeeded = 10; // Default
      
      if (lowerQuery.includes('yesterday') || lowerQuery.includes('today') || 
          criteria.type === 'specific') {
        // Single day: just get enough recent activities to find that date
        activitiesNeeded = 10;
        console.log(`📅 Single date query: fetching ${activitiesNeeded} recent activities to find date`);
      } else if (lowerQuery.includes('last 7 days') || lowerQuery.includes('this week')) {
        activitiesNeeded = 14; // 7 days × 2/day = 14
      } else if (lowerQuery.includes('last 30 days') || lowerQuery.includes('last month')) {
        activitiesNeeded = 60; // 30 days × 2/day = 60
      } else if (lowerQuery.includes('since') || criteria.type === 'since') {
        activitiesNeeded = 200; // Long historical range
      }
      
      console.log(`📥 Fetching ${activitiesNeeded} activities (optimized for query type)`);
      
      // Use API date filtering for specific dates instead of client-side filtering
      const activitiesCall: { endpoint: string; params: any } = {
        endpoint: 'get-recent-activities',
        params: { per_page: activitiesNeeded }
      };
      
      // For specific dates, use API date filtering 
      if (startDate && endDate && criteria.type === 'specific') {
        const startDateStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
        const endDateStr = endDate.toISOString().split('T')[0];     // YYYY-MM-DD
        
        activitiesCall.params = {
          per_page: 5, // Max 2 activities per day + buffer
          after: startDateStr,
          before: endDateStr
        };
        console.log(`📅 Using API date filter: ${startDateStr} to ${endDateStr}`);
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
          
          // Smart data fetching based on what's actually needed
          const detailedCalls = [];
          
          // Always get basic details for all matching activities
          for (const id of filteredActivityIds) {
            detailedCalls.push({ endpoint: 'get-activity-details', params: { activityId: id } });
          }
          
          // Only get streams if user asks for HR/pace/power analysis
          const needsStreams = intent.runningDataTypes?.includes('activity_streams') || false;
          
          if (needsStreams) {
            console.log(`📊 Adding streams for HR/pace analysis (${filteredActivityIds.length} activities)`);
            for (const id of filteredActivityIds) {
              detailedCalls.push({ 
                endpoint: 'get-activity-streams', 
                params: { 
                  id, 
                  types: ['heartrate', 'velocity_smooth', 'watts'], // Only essential streams
                  resolution: filteredActivityIds.length > 3 ? 'medium' : 'high',
                  points_per_page: 100 // Limit data points to prevent overload
                }
              });
            }
          }
          
          // Only add zones if specifically needed
          if (intent.runningDataTypes?.includes('athlete_zones')) {
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

    // Step 4: Fetch nutrition data if needed
    if (intent.needsNutrition && nutritionDateRange) {
      console.log(`🥗 Fetching nutrition data for date range...`);
      nutritionResponse = await fetchNutritionDataForRange(nutritionDateRange.startDate, nutritionDateRange.endDate);
      
      if (!nutritionResponse.success) {
        console.log(`⚠️ Nutrition data fetch failed: ${nutritionResponse.error}`);
      } else {
        console.log(`✅ Nutrition data fetched successfully: ${nutritionResponse.data?.totalDays} days`);
      }
    }
    

    
    // Step 4: Return combined result
    return { 
      intent: intent.type,
      needsNutrition: intent.needsNutrition,
      needsRunning: intent.needsRunning,
      nutritionData: nutritionResponse?.success ? nutritionResponse.data : null,
      mcpResponses,
      dateRange: intent.dateRange
    };
  };

  // Validate if we have sufficient data before calling Claude
  const validateDataForClaude = (mcpResponses: MCPResponse[], nutritionData: any = null): boolean => {
    const successfulMcpResponses = mcpResponses.filter(r => r.success && r.data?.content?.[0]?.text);
    
    // Check MCP data quality
    const hasRealMcpData = successfulMcpResponses.some(r => {
      const text = r.data.content[0].text;
      return text.length > 100 && !text.includes('No activities found');
    });
    
    // Check nutrition data quality
    const hasNutritionData = nutritionData && nutritionData.totalDays > 0;
    
    // Need at least one type of meaningful data
    if (!hasRealMcpData && !hasNutritionData) {
      console.log('❌ No meaningful MCP or nutrition data - skip Claude call');
      return false;
    }
    
    console.log(`✅ Data validation passed:`, {
      mcpResponses: `${successfulMcpResponses.length} successful`,
      nutritionDays: hasNutritionData ? nutritionData.totalDays : 0
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
        nutritionDays: intent.nutritionData?.totalDays || 0,
        mcpResponseCount: mcpResponses.length,
        fullIntentObject: intent
      });

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
          nutritionData: intent.nutritionData  // Pass nutritionData separately
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
      
      // Fixed: Handle multiple content items properly for fallback display
      const contextData = mcpResponses
        .filter(r => r.success && r.data?.content?.length > 0)
        .map(r => {
          const allContentText = r.data.content
            .map((item: any) => item.text)
            .join('\n');
          return `\n🏃 ${r.endpoint.toUpperCase()}:\n${allContentText}`;
        })
        .join('\n');
      
      return `I can see your data but had trouble generating a detailed response. Here's what I found:\n\n${contextData}`;
    }
  };

  // Main message handler - DATA FIRST approach with context
  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const originalInput = input;
    setInput('');
    setIsLoading(true);

    try {
      // Step 1: Resolve contextual references from previous queries
      const resolvedInput = resolveContextualQuery(originalInput);
      console.log(`🔍 Processing query: "${resolvedInput}"`);
      
      // Step 2: Get the RIGHT data first (no Claude guessing)
      const dataResult = await getDataForQuery(resolvedInput);
      const { intent, needsNutrition, needsRunning, nutritionData, mcpResponses, dateRange } = dataResult;
      
      console.log(`✅ Data fetching complete:`, {
        intent,
        nutritionData: nutritionData ? `${nutritionData.totalDays} days` : 'none',
        mcpResponses: `${mcpResponses.length} responses`
      });

      // COST CONTROL: Only call Claude if we have meaningful data
      if (!validateDataForClaude(mcpResponses, nutritionData)) {
        // Check if it's a network error
        const networkError = mcpResponses.some(r => r.error?.includes('fetch') || r.error?.includes('network'));
        
        const errorMessage = networkError ? 
        `🌐 **Network Connection Issue**

Unable to connect to Strava data server for **"${originalInput}"**

**Network troubleshooting:**
- Check your internet connection
- Try refreshing the page (Cmd+Shift+R)
- Switch networks if you recently changed WiFi/cellular
- Wait a moment and try again

**Error details:** Network request failed (ERR_NETWORK_CHANGED)` :
        
        `❌ **Data Access Issue**

I couldn't find sufficient data to analyze for **"${originalInput}"**

**Possible reasons:**
- The requested activity/date wasn't found
- Data isn't available or properly synced  
- Privacy settings may be blocking access
- Date format issue (using 2025 for current year)

**Next Steps:**
1. Check if the activity exists in your Strava account
2. Try: "show my recent runs" to see what's available
3. Use a different date format
4. Verify Strava sync and privacy settings

**Cost-saving note:** Skipped expensive Claude API call since no meaningful data was found.`;

        const assistantMessage: Message = {
          role: 'assistant',
          content: errorMessage,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
        setIsLoading(false);
        return;
      }

      // Step 3: Generate comprehensive response with Claude (using real data)
      const responseText = await generateResponseWithClaude(resolvedInput, { 
        type: intent, 
        needsNutrition, 
        needsRunning, 
        nutritionData 
      }, mcpResponses);

      const assistantMessage: Message = {
        role: 'assistant',
        content: responseText,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Step 4: Save context for future queries
      if ((needsRunning || needsNutrition) && dateRange) {
        const contextDate = extractDateFromQuery(originalInput) || extractDateFromQuery(resolvedInput);
        const activityDetails = extractActivityDetails(mcpResponses);
        
        setContext({
          lastDate: contextDate,
          lastDateParsed: dateRange.startDate,
          lastActivityIds: [], // Will be populated from MCP responses if needed
          lastQueryType: intent,
          lastActivities: activityDetails || (nutritionData ? `Nutrition data: ${nutritionData.totalDays} days` : 'No data')
        });
        
        console.log(`💾 Context saved: ${contextDate} with ${intent} data`);
      }

    } catch (error) {
      console.error('❌ Coach error:', error);
      
      const errorMessage: Message = {
        role: 'assistant',
        content: `Sorry, I encountered an error processing your request. The MCP server is ${stravaStats.connected ? 'connected' : 'disconnected'}. Please try again or ask a different question.`,
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

  // Smart coaching prompts that leverage the dynamic system
  const smartPrompts = [
    "analyze my runs from last week",
    "show my nutrition for the last 7 days", 
    "how has my pace improved lately",
    "compare my nutrition and running for yesterday",
    "what's my protein intake this week",
    "analyze my calories and training balance last month"
  ];

  // Contextual prompts shown when context is available
  const contextualPrompts = [
    "what did I eat that day",
    "how was my nutrition that day", 
    "compare my calories to my activity",
    "analyze my protein intake that day",
    "was I fueled properly for that workout"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex flex-col relative overflow-hidden">
      {/* Background decoration - OverallJam style */}
      <div className="absolute inset-0 bg-gradient-to-r from-green-400/10 to-blue-400/10 animate-pulse"></div>
      <div className="absolute top-20 left-20 w-32 h-32 bg-green-200/30 rounded-full blur-xl animate-bounce"></div>
      <div className="absolute bottom-20 right-20 w-24 h-24 bg-blue-200/30 rounded-full blur-xl animate-bounce delay-1000"></div>

      {/* Header - OverallJam style */}
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
        </div>

        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-green-600 via-teal-600 to-blue-600 bg-clip-text text-transparent">
            🤖 AI Running Coach
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Intelligent analysis with conversational context powered by real Strava data
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            <Badge variant="outline" className="text-xs bg-white/50">
              <Zap className="h-3 w-3 mr-1" />
              Real-Time Data
            </Badge>
            <Badge variant="outline" className="text-xs bg-white/50">
              <Activity className="h-3 w-3 mr-1" />
              Strava Connected
            </Badge>
            <Badge variant="outline" className="text-xs bg-white/50">
              <Bot className="h-3 w-3 mr-1" />
              Contextual Memory
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content - Two Column Layout */}
      <main className="flex-grow relative z-10 px-6 md:px-12 py-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* Metrics Sidebar - Left Column */}
          <div className="lg:col-span-1 space-y-4">
            
            {/* Connection Status */}
            <Card className="bg-white/80 backdrop-blur border border-green-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-green-600" />
                  System Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant={stravaStats.connected ? "default" : "destructive"} className="w-full justify-center">
                  MCP: {stravaStats.connected ? "Connected" : "Disconnected"}
                </Badge>
                <div className="text-xs text-gray-600 mt-2 text-center">
                  Last check: {stravaStats.lastChecked}
                </div>
              </CardContent>
            </Card>

            {/* Today's Metrics - OverallJam Style */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-green-600" />
                  Today's Metrics
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchTodayMetrics}
                  disabled={metricsLoading}
                  className="text-xs hover:bg-white/50"
                >
                  {metricsLoading ? <Zap className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                </Button>
              </div>
              
              {/* Activities Status */}
              {todayMetrics.activities.length > 0 && (
                <div className="bg-green-50 rounded-lg p-2 border border-green-200">
                  <div className="flex items-center gap-2 text-green-800">
                    <Activity className="h-3 w-3" />
                    <span className="text-xs font-medium">
                      {todayMetrics.activities.join(', ')} Today
                    </span>
                  </div>
                </div>
              )}
              
              {/* Calories Burned - OverallJam green theme */}
              <div className="bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl p-4 text-white shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-white">Calories Out</h4>
                  <div className="w-8 h-8 bg-white/30 rounded-lg flex items-center justify-center">
                    <Flame className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-white">
                    {metricsLoading ? '...' : todayMetrics.caloriesBurned.toLocaleString()}
                  </p>
                  <p className="text-xs text-green-100">cal/day</p>
                  <p className="text-xs text-green-200">From Strava</p>
                </div>
              </div>

              {/* Calories In - OverallJam emerald theme */}
              <div className="bg-gradient-to-br from-emerald-400 to-green-600 rounded-xl p-4 text-white shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-white">Calories In</h4>
                  <div className="w-8 h-8 bg-white/30 rounded-lg flex items-center justify-center">
                    <Utensils className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-white">
                    {metricsLoading ? '...' : todayMetrics.caloriesConsumed.toLocaleString()}
                  </p>
                  <p className="text-xs text-emerald-100">cal/day</p>
                </div>
              </div>

              {/* Protein - OverallJam blue theme */}
              <div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl p-4 text-white shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-white">Protein</h4>
                  <div className="w-8 h-8 bg-white/30 rounded-lg flex items-center justify-center">
                    <Target className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-white">
                    {metricsLoading ? '...' : todayMetrics.protein}
                  </p>
                  <p className="text-xs text-blue-100">g/day</p>
                </div>
              </div>

              {/* Heart Rate - OverallJam cyan theme */}
              <div className="bg-gradient-to-br from-cyan-400 to-teal-500 rounded-xl p-4 text-white shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-white">Run HR</h4>
                  <div className="w-8 h-8 bg-white/30 rounded-lg flex items-center justify-center">
                    <Heart className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-white">
                    {metricsLoading ? '...' : (todayMetrics.heartRate || '--')}
                  </p>
                  <p className="text-xs text-cyan-100">bpm avg</p>
                  <p className="text-xs text-cyan-200">Runs only</p>
                </div>
              </div>

              {/* Data freshness indicator */}
              <div className="text-center pt-2">
                <Badge variant="outline" className="bg-white/60 text-gray-600 text-xs">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Updated: {todayMetrics.lastUpdated}
                </Badge>
              </div>
            </div>

            {/* Context Display */}
            {context.lastDate && (
              <Card className="bg-gradient-to-r from-blue-100 to-cyan-100 border border-blue-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-blue-700 flex items-center gap-2">
                    💭 Context Memory
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-blue-600 space-y-1">
                    <div><strong>Last query:</strong> {context.lastDate}</div>
                    <div className="text-xs text-blue-500">Try: "how was weather that day"</div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setContext({})}
                      className="w-full mt-2 text-xs h-7"
                    >
                      Clear Context
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Chat Interface - Right Column */}
          <div className="lg:col-span-3">
            <Card className="bg-white/95 backdrop-blur-sm border-0 shadow-2xl rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white">
                <CardTitle className="text-xl font-bold flex items-center gap-3">
                  <div className="relative">
                    <Bot className="h-6 w-6 animate-pulse" />
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-300 rounded-full animate-ping"></div>
                  </div>
                  AI Running Coach Chat
                  <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                    Live
                  </Badge>
                </CardTitle>
                <CardDescription className="text-emerald-100">
                  🏃‍♂️ Ask about any date, get instant insights • Powered by real Strava data
                  {context.lastDate && (
                    <div className="mt-3 p-3 bg-white/20 rounded-lg text-sm border border-white/30">
                      <div className="flex items-center gap-2 text-white">
                        <Sparkles className="h-4 w-4" />
                        <strong>Context Active:</strong> {context.lastDate}
                      </div>
                      <div className="text-emerald-100 text-xs mt-1">
                        Try: "how was weather that day" • "compare that to my average" • "what was my pace"
                      </div>
                    </div>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {/* Messages */}
                <div className="bg-gradient-to-b from-gray-50 to-white rounded-xl border border-gray-200">
                  <ScrollArea className="h-96 p-4">
                    <div className="space-y-4">
                      {messages.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          <Bot className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                          <p className="text-lg font-medium">Ready to analyze your runs! 🏃‍♂️</p>
                          <p className="text-sm">Ask me about any date or time period</p>
                        </div>
                      )}
                      
                      {messages.map((message, index) => (
                        <div
                          key={index}
                          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[85%] p-4 rounded-2xl shadow-lg ${
                              message.role === 'user'
                                ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white'
                                : 'bg-white text-gray-800 border border-gray-200'
                            }`}
                          >
                            <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
                            <div className={`text-xs mt-2 flex items-center gap-1 ${
                              message.role === 'user' ? 'text-emerald-100' : 'text-gray-500'
                            }`}>
                              {message.role === 'user' ? <Users className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                              {message.timestamp.toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {isLoading && (
                        <div className="flex justify-start">
                          <div className="bg-white text-gray-800 p-4 rounded-2xl shadow-lg border border-gray-200 max-w-[85%]">
                            <div className="flex items-center gap-3">
                              <div className="flex gap-1">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce delay-100"></div>
                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-200"></div>
                              </div>
                              <span className="text-sm font-medium">AI is analyzing your data...</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-2">Fetching Strava data • Processing insights</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                {/* Enhanced Input */}
                <div className="bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-200 p-4">
                  <div className="flex gap-3">
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Ask about any date... e.g., 'analyze my run from june 24' or 'last week's runs'"
                      disabled={isLoading}
                      className="flex-1 border-emerald-200 focus:border-emerald-400 focus:ring-emerald-400 rounded-xl"
                    />
                    <Button 
                      onClick={handleSendMessage} 
                      disabled={isLoading || !input.trim()}
                      className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      {isLoading ? (
                        <Zap className="h-4 w-4 animate-spin" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Smart Prompts */}
                <div className="bg-gradient-to-r from-emerald-50 to-cyan-50 rounded-xl border border-emerald-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-5 w-5 text-emerald-600" />
                    <h3 className="text-sm font-bold text-gray-800">
                      {context.lastDate ? '🔗 Contextual Questions' : '💡 Quick Start Prompts'}
                    </h3>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(context.lastDate ? contextualPrompts : smartPrompts).map((prompt, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => setInput(prompt)}
                        className={`text-xs justify-start transition-all duration-200 ${
                          context.lastDate 
                            ? 'border-blue-300 text-blue-700 hover:bg-blue-50 bg-blue-50/50' 
                            : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50 bg-emerald-50/50'
                        }`}
                        disabled={isLoading}
                      >
                        <Activity className="h-3 w-3 mr-2" />
                        {prompt}
                      </Button>
                    ))}
                    
                    {context.lastDate && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setContext({})}
                        className="text-xs border-gray-300 text-gray-600 hover:bg-gray-50 col-span-full"
                        disabled={isLoading}
                      >
                        <Zap className="h-3 w-3 mr-2" />
                        Clear Context & Start Fresh
                      </Button>
                    )}
                  </div>
                  
                  <div className="mt-3 text-xs text-gray-600 flex items-center gap-1">
                    <Trophy className="h-3 w-3" />
                    Pro tip: Be specific with dates for better insights!
                  </div>
                </div>
          </CardContent>
        </Card>
          </div>
        </div>
      </main>
    </div>
  );
} 
