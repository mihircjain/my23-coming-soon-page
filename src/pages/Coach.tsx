import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Activity, Bot, Zap, TrendingUp, Flame, Utensils, Target, Heart, ArrowLeft, Sparkles, Trophy, Calendar, Users, Moon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/lib/firebaseConfig';
import { collection, query, where, orderBy, getDocs, limit, getDoc, doc } from 'firebase/firestore';

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
}

interface WeeklyMetrics {
  caloriesBurned: number;
  caloriesConsumed: number;
  protein: number;
  activities: string[];
  lastUpdated: string;
}

interface QueryIntent {
  type: 'nutrition_only' | 'running_only' | 'nutrition_and_running' | 'sleep_only' | 'sleep_and_running' | 'sleep_and_nutrition' | 'all_data' | 'general';
  needsNutrition: boolean;
  needsRunning: boolean;
  needsSleep: boolean;
  dateRange?: { startDate: Date; endDate: Date };
  nutritionDataTypes?: string[];
  runningDataTypes?: string[];
  sleepDataTypes?: string[];
  isSmartTiming?: boolean;
}

export default function CoachNew() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [stravaStats, setStravaStats] = useState<StravaStats>({ connected: false, lastChecked: 'Never' });
  const [context, setContext] = useState<ConversationContext>({});
  const [weeklyMetrics, setWeeklyMetrics] = useState<WeeklyMetrics>({
    caloriesBurned: 0,
    caloriesConsumed: 0,
    protein: 0,
    activities: [],
    lastUpdated: 'Never'
  });
  const [metricsLoading, setMetricsLoading] = useState(true);

  useEffect(() => {
    testMCPConnection();
    fetchWeeklyMetrics();
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
    
    // Keywords that indicate sleep-related queries
    const sleepKeywords = [
      'sleep', 'sleeping', 'slept', 'bedtime', 'wake', 'woke', 'rest', 'recovery',
      'tired', 'fatigue', 'readiness', 'oura', 'sleep score', 'sleep quality',
      'deep sleep', 'rem sleep', 'light sleep', 'sleep duration', 'sleep efficiency'
    ];
    
    const hasNutritionKeywords = nutritionKeywords.some(keyword => lowerQuery.includes(keyword));
    const hasRunningKeywords = runningKeywords.some(keyword => lowerQuery.includes(keyword));
    const hasSleepKeywords = sleepKeywords.some(keyword => lowerQuery.includes(keyword));
    const isNutritionPerformanceQuery = detectNutritionPerformanceQuery(query);
    
    // Parse date range for data fetching
    const { startDate, endDate } = parseDateQuery(query);
    
    let intent: QueryIntent;
    
    // Determine data needs based on keyword combinations
    const needsNutrition = hasNutritionKeywords || isNutritionPerformanceQuery;
    const needsRunning = hasRunningKeywords || isNutritionPerformanceQuery;
    const needsSleep = hasSleepKeywords;
    
    // Determine query type based on combinations
    if (needsNutrition && needsRunning && needsSleep) {
      intent = {
        type: 'all_data',
        needsNutrition: true,
        needsRunning: true,
        needsSleep: true,
        dateRange: startDate && endDate ? { startDate, endDate } : undefined,
        nutritionDataTypes: ['calories', 'protein', 'carbs', 'fat', 'fiber'],
        runningDataTypes: ['activity_details', 'basic_stats'],
        sleepDataTypes: ['duration', 'scores', 'heart_rate'],
        isSmartTiming: isNutritionPerformanceQuery
      };
    } else if (needsSleep && needsRunning) {
      intent = {
        type: 'sleep_and_running',
        needsNutrition: false,
        needsRunning: true,
        needsSleep: true,
        dateRange: startDate && endDate ? { startDate, endDate } : undefined,
        runningDataTypes: ['activity_details', 'basic_stats'],
        sleepDataTypes: ['duration', 'scores', 'heart_rate']
      };
    } else if (needsSleep && needsNutrition) {
      intent = {
        type: 'sleep_and_nutrition',
        needsNutrition: true,
        needsRunning: false,
        needsSleep: true,
        dateRange: startDate && endDate ? { startDate, endDate } : undefined,
        nutritionDataTypes: ['calories', 'protein', 'carbs', 'fat', 'fiber'],
        sleepDataTypes: ['duration', 'scores', 'heart_rate']
      };
    } else if (needsSleep) {
      intent = {
        type: 'sleep_only',
        needsNutrition: false,
        needsRunning: false,
        needsSleep: true,
        dateRange: startDate && endDate ? { startDate, endDate } : undefined,
        sleepDataTypes: ['duration', 'scores', 'heart_rate']
      };
    } else if (isNutritionPerformanceQuery || (needsNutrition && needsRunning)) {
      intent = {
        type: 'nutrition_and_running',
        needsNutrition: true,
        needsRunning: true,
        needsSleep: false,
        dateRange: startDate && endDate ? { startDate, endDate } : undefined,
        nutritionDataTypes: ['calories', 'protein', 'carbs', 'fat', 'fiber'],
        runningDataTypes: ['activity_details', 'basic_stats'],
        isSmartTiming: isNutritionPerformanceQuery
      };
    } else if (needsNutrition) {
      intent = {
        type: 'nutrition_only',
        needsNutrition: true,
        needsRunning: false,
        needsSleep: false,
        dateRange: startDate && endDate ? { startDate, endDate } : undefined,
        nutritionDataTypes: ['calories', 'protein', 'carbs', 'fat', 'fiber']
      };
    } else if (needsRunning) {
      intent = {
        type: 'running_only',
        needsNutrition: false,
        needsRunning: true,
        needsSleep: false,
        dateRange: startDate && endDate ? { startDate, endDate } : undefined,
        runningDataTypes: determineRunningDataTypes(query)
      };
    } else {
      // General query - might need some data for context
      intent = {
        type: 'general',
        needsNutrition: true,
        needsRunning: true,
        needsSleep: false,
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
        const sleep = dayData.sleep || {};
        const readiness = dayData.readiness || {};
        
        const sleepDurationHours = sleep.total_sleep_duration ? sleep.total_sleep_duration / 3600 : 0;
        const avgHeartRate = sleep.average_heart_rate || null;
        
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
          bedtimeEnd: sleep.bedtime_end
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
      
      // Smart activity fetching - optimize based on query type and use precise API filtering
      const activitiesCall: { endpoint: string; params: any } = {
        endpoint: 'get-recent-activities',
        params: { per_page: 10 } // Default fallback
      };
      
      // For specific dates, use precise API date filtering 
      if (startDate && endDate && criteria.type === 'specific') {
        const startDateStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
        const endDateStr = endDate.toISOString().split('T')[0];     // YYYY-MM-DD
        
        // Same start/end date = single day query
        const isSingleDay = startDateStr === endDateStr;
        
        activitiesCall.params = {
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
    
    // Step 5: Fetch sleep data if needed
    let sleepResponse: SleepResponse | null = null;
    
    if (intent.needsSleep) {
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
    
    // Step 6: Return combined result
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
      const { intent, needsNutrition, needsRunning, needsSleep, nutritionData, sleepData, mcpResponses, dateRange } = dataResult;
      
      console.log(`✅ Data fetching complete:`, {
        intent,
        nutritionData: nutritionData ? `${nutritionData.totalDays} days` : 'none',
        sleepData: sleepData ? `${sleepData.totalDays} days` : 'none',
        mcpResponses: `${mcpResponses.length} responses`
      });

      // COST CONTROL: Only call Claude if we have meaningful data
      if (!validateDataForClaude(mcpResponses, nutritionData, sleepData)) {
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
        needsSleep,
        nutritionData,
        sleepData
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

  // Add useRef for auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Button
              onClick={() => navigate('/')}
              variant="ghost"
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            
            <h1 className="text-xl font-semibold text-gray-900">
              AI Health Coach
            </h1>
            
            <Badge variant={stravaStats.connected ? "default" : "destructive"} className="text-xs">
              {stravaStats.connected ? 'Connected' : 'Offline'}
            </Badge>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* Main Chat Area */}
          <div className="lg:col-span-3 space-y-4">
            
            {/* Smart Prompts */}
            <Card className="border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium text-gray-900 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  {context.lastDate ? 'Follow-up Questions' : 'Quick Start'}
                  {context.lastDate && (
                    <Badge variant="secondary" className="text-xs">
                      {context.lastDate}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {context.lastDate ? (
                  <div className="flex flex-wrap gap-2">
                    {contextualPrompts.map((prompt, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => setInput(prompt)}
                        className="text-sm h-8 px-3 border-gray-300 text-gray-700 hover:bg-gray-50"
                        disabled={isLoading}
                      >
                        {prompt}
                      </Button>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setContext({})}
                      className="text-sm h-8 px-3 text-gray-500"
                      disabled={isLoading}
                    >
                      Clear
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Running */}
                    <div>
                      <div className="text-sm font-medium text-blue-900 mb-2 flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Running
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {runningPrompts.map((prompt, index) => (
                          <Button
                            key={`running-${index}`}
                            variant="outline"
                            size="sm"
                            onClick={() => setInput(prompt)}
                            className="text-xs h-7 px-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                            disabled={isLoading}
                          >
                            {prompt}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Nutrition */}
                    <div>
                      <div className="text-sm font-medium text-green-900 mb-2 flex items-center gap-2">
                        <Utensils className="h-4 w-4" />
                        Nutrition
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {nutritionPrompts.map((prompt, index) => (
                          <Button
                            key={`nutrition-${index}`}
                            variant="outline"
                            size="sm"
                            onClick={() => setInput(prompt)}
                            className="text-xs h-7 px-2 border-green-200 text-green-700 hover:bg-green-50"
                            disabled={isLoading}
                          >
                            {prompt}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Sleep */}
                    <div>
                      <div className="text-sm font-medium text-purple-900 mb-2 flex items-center gap-2">
                        <Moon className="h-4 w-4" />
                        Sleep
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {sleepPrompts.map((prompt, index) => (
                          <Button
                            key={`sleep-${index}`}
                            variant="outline"
                            size="sm"
                            onClick={() => setInput(prompt)}
                            className="text-xs h-7 px-2 border-purple-200 text-purple-700 hover:bg-purple-50"
                            disabled={isLoading}
                          >
                            {prompt}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Combined */}
                    <div>
                      <div className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Combined Analysis
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {combinedPrompts.map((prompt, index) => (
                          <Button
                            key={`combined-${index}`}
                            variant="outline"
                            size="sm"
                            onClick={() => setInput(prompt)}
                            className="text-xs h-7 px-2 border-gray-300 text-gray-700 hover:bg-gray-50"
                            disabled={isLoading}
                          >
                            {prompt}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Chat Interface */}
            <Card className="border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium text-gray-900 flex items-center gap-2">
                  <Bot className="h-4 w-4 text-blue-600" />
                  Chat
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {/* Messages Container - Dynamic height based on content */}
                <div 
                  className="border border-gray-200 rounded-lg p-4 bg-gray-50 overflow-y-auto"
                  style={{ 
                    minHeight: messages.length === 0 ? '300px' : '400px',
                    maxHeight: '800px',
                    height: messages.length > 0 ? 'auto' : '300px'
                  }}
                >
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                      <Bot className="h-12 w-12 mb-3 text-gray-400" />
                      <p className="text-base font-medium">Ready to help with your health data</p>
                      <p className="text-sm mt-1">Ask about your running, nutrition, or sleep patterns</p>
                    </div>
                  )}
                  
                  <div className="space-y-4">
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] p-3 rounded-lg ${
                            message.role === 'user'
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-gray-900 border border-gray-200'
                          }`}
                        >
                          <div className="text-sm leading-relaxed whitespace-pre-wrap">
                            {message.content}
                          </div>
                          <div className={`text-xs mt-2 flex items-center gap-1 ${
                            message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                          }`}>
                            {message.role === 'user' ? <Users className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                            {message.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-white text-gray-900 p-3 rounded-lg border border-gray-200 max-w-[80%]">
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-100"></div>
                              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-200"></div>
                            </div>
                            <span className="text-sm">Analyzing your data...</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Invisible div for auto-scroll */}
                    <div ref={messagesEndRef} />
                  </div>
                </div>

                {/* Input */}
                <div className="mt-4 flex gap-3">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask about your health data..."
                    disabled={isLoading}
                    className="flex-1 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                  <Button 
                    onClick={handleSendMessage} 
                    disabled={isLoading || !input.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                  >
                    {isLoading ? (
                      <Zap className="h-4 w-4 animate-spin" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            
            {/* Weekly Metrics */}
            <Card className="border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-900 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  Last 7 Days
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                
                {/* Activities */}
                {weeklyMetrics.activities.length > 0 && (
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <div className="flex items-center gap-2 text-blue-700">
                      <Activity className="h-4 w-4" />
                      <span className="text-xs font-medium">
                        {weeklyMetrics.activities.join(', ')}
                      </span>
                    </div>
                  </div>
                )}
                
                {/* Metrics */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Calories out</span>
                    <span className="font-medium">{metricsLoading ? '...' : weeklyMetrics.caloriesBurned.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Calories in</span>
                    <span className="font-medium">{metricsLoading ? '...' : weeklyMetrics.caloriesConsumed.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Protein</span>
                    <span className="font-medium">{metricsLoading ? '...' : weeklyMetrics.protein}g</span>
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchWeeklyMetrics}
                  disabled={metricsLoading}
                  className="w-full text-xs h-8"
                >
                  {metricsLoading ? <Zap className="h-3 w-3 animate-spin mr-1" /> : <Zap className="h-3 w-3 mr-1" />}
                  Refresh
                </Button>
              </CardContent>
            </Card>

            {/* Context Display */}
            {context.lastDate && (
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-blue-700 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Context Active
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-xs text-blue-700 space-y-2">
                    <div><strong>Query:</strong> {context.lastDate}</div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setContext({})}
                      className="w-full text-xs h-7 border-blue-300"
                    >
                      Clear Context
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

        </div>
      </main>
    </div>
  );
} 
