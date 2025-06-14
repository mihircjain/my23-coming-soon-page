import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, RefreshCw, Activity, TrendingUp, Target, ArrowLeft, User, MessageSquare, Clock, Trophy, Zap, Heart, BarChart3, Calendar, Timer, MapPin, Footprints, Award, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useNavigate } from 'react-router-dom';

// Enhanced run data interface
interface RunData {
  id: string;
  name: string;
  start_date: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  average_speed: number;
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  calories?: number;
  average_cadence?: number;
  splits_metric?: Array<{
    distance: number;
    elapsed_time: number;
    elevation_difference: number;
    moving_time: number;
    split: number;
    average_speed: number;
    average_heartrate?: number;
  }>;
  best_efforts?: Array<{
    name: string;
    distance: number;
    moving_time: number;
    elapsed_time: number;
  }>;
  gear?: {
    id: string;
    name: string;
    distance_km: number;
    brand_name?: string;
  };
  has_detailed_data: boolean;
  weather?: {
    temperature?: number;
    humidity?: number;
    wind_speed?: number;
  };
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  category?: 'recognition' | 'improvement' | 'analysis' | 'fueling' | 'subjective';
}

interface SubjectiveInput {
  runId: string;
  perceivedEffort: number;
  energyLevel: number;
  sleepHours: number;
  stressLevel: number;
  fuelingRating: number;
  notes: string;
  weatherImpact: string;
  injuryFeedback: string;
  timestamp: Date;
}

interface RunAnalysis {
  totalRuns: number;
  totalDistance: number;
  totalTime: number;
  avgPace: number;
  avgHeartRate: number;
  consistencyScore: number;
  improvementTrend: 'improving' | 'stable' | 'declining';
  strengthAreas: string[];
  improvementAreas: string[];
  weeklyPattern: {
    [key: string]: { distance: number; runs: number };
  };
  paceProgression: number[];
  heartRateEfficiency: number;
}

const RunningCoach: React.FC = () => {
  const navigate = useNavigate();
  
  // Core state
  const [runs, setRuns] = useState<RunData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>('');
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeTab, setActiveTab] = useState('recognition');
  
  // Subjective input state
  const [subjectiveInputs, setSubjectiveInputs] = useState<SubjectiveInput[]>([]);
  const [currentSubjective, setCurrentSubjective] = useState<Partial<SubjectiveInput>>({
    perceivedEffort: 5,
    energyLevel: 5,
    sleepHours: 7,
    stressLevel: 3,
    fuelingRating: 5,
    notes: '',
    weatherImpact: '',
    injuryFeedback: ''
  });
  const [selectedRunForFeedback, setSelectedRunForFeedback] = useState<RunData | null>(null);
  
  // Analysis state
  const [runAnalysis, setRunAnalysis] = useState<RunAnalysis | null>(null);
  const [timeFrame, setTimeFrame] = useState<'week' | 'month' | 'year'>('week');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Utility functions
  const formatTime = (seconds: number) => {
    if (!seconds) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return hours > 0 ? `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}` 
                     : `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPace = (distance: number, time: number) => {
    if (distance === 0 || time === 0) return 'N/A';
    const distanceKm = distance > 100 ? distance / 1000 : distance;
    const paceSeconds = time / distanceKm;
    const minutes = Math.floor(paceSeconds / 60);
    const seconds = Math.floor(paceSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  };

  const formatDistance = (distance: number) => {
    if (distance === 0) return '0.00';
    const km = distance > 100 ? distance / 1000 : distance;
    return km.toFixed(2);
  };

  // Calculate comprehensive run analysis
  const calculateRunAnalysis = (runsData: RunData[]): RunAnalysis => {
    if (runsData.length === 0) {
      return {
        totalRuns: 0,
        totalDistance: 0,
        totalTime: 0,
        avgPace: 0,
        avgHeartRate: 0,
        consistencyScore: 0,
        improvementTrend: 'stable',
        strengthAreas: [],
        improvementAreas: [],
        weeklyPattern: {},
        paceProgression: [],
        heartRateEfficiency: 0
      };
    }

    const totalDistance = runsData.reduce((sum, run) => sum + run.distance, 0) / 1000; // Convert to km
    const totalTime = runsData.reduce((sum, run) => sum + run.moving_time, 0);
    const avgPace = totalTime / totalDistance / 60; // min/km
    
    const heartRates = runsData.filter(run => run.average_heartrate).map(run => run.average_heartrate!);
    const avgHeartRate = heartRates.length > 0 ? Math.round(heartRates.reduce((sum, hr) => sum + hr, 0) / heartRates.length) : 0;
    
    // Calculate consistency score (0-100) based on regular running
    const daysSinceFirstRun = Math.max(1, Math.ceil((Date.now() - new Date(runsData[runsData.length - 1].start_date).getTime()) / (1000 * 60 * 60 * 24)));
    const runsPerDay = runsData.length / daysSinceFirstRun;
    const consistencyScore = Math.min(100, Math.round(runsPerDay * 100 * 7)); // Expect ~1 run every 7 days for 100%
    
    // Calculate pace progression (last 5 runs vs first 5 runs)
    const recentRuns = runsData.slice(0, 5);
    const oldRuns = runsData.slice(-5);
    const recentAvgPace = recentRuns.reduce((sum, run) => sum + (run.moving_time / (run.distance / 1000) / 60), 0) / recentRuns.length;
    const oldAvgPace = oldRuns.reduce((sum, run) => sum + (run.moving_time / (run.distance / 1000) / 60), 0) / oldRuns.length;
    
    let improvementTrend: 'improving' | 'stable' | 'declining';
    if (recentAvgPace < oldAvgPace - 0.1) improvementTrend = 'improving';
    else if (recentAvgPace > oldAvgPace + 0.1) improvementTrend = 'declining';
    else improvementTrend = 'stable';
    
    // Pace progression array for visualization
    const paceProgression = runsData.map(run => run.moving_time / (run.distance / 1000) / 60).reverse();
    
    // Calculate heart rate efficiency (lower HR at same pace = better efficiency)
    const heartRateEfficiency = heartRates.length > 0 ? 
      Math.round(100 - (avgHeartRate - 120) / 80 * 100) : 0; // Normalize around 120-200 bpm range
    
    // Weekly pattern analysis
    const weeklyPattern: { [key: string]: { distance: number; runs: number } } = {};
    runsData.forEach(run => {
      const week = new Date(run.start_date).toISOString().slice(0, 10); // YYYY-MM-DD
      if (!weeklyPattern[week]) weeklyPattern[week] = { distance: 0, runs: 0 };
      weeklyPattern[week].distance += run.distance / 1000;
      weeklyPattern[week].runs += 1;
    });
    
    // Identify strengths and improvement areas
    const strengthAreas: string[] = [];
    const improvementAreas: string[] = [];
    
    if (consistencyScore > 70) strengthAreas.push('Excellent consistency');
    else improvementAreas.push('Improve consistency');
    
    if (improvementTrend === 'improving') strengthAreas.push('Pace improvement');
    else if (improvementTrend === 'declining') improvementAreas.push('Pace maintenance');
    
    if (heartRateEfficiency > 70) strengthAreas.push('Good aerobic efficiency');
    else improvementAreas.push('Build aerobic base');
    
    if (runsData.some(run => run.total_elevation_gain > 100)) strengthAreas.push('Hill running capability');
    
    if (runsData.filter(run => run.distance > 10000).length > 0) strengthAreas.push('Endurance capacity');
    else improvementAreas.push('Build endurance');
    
    return {
      totalRuns: runsData.length,
      totalDistance,
      totalTime,
      avgPace,
      avgHeartRate,
      consistencyScore,
      improvementTrend,
      strengthAreas,
      improvementAreas,
      weeklyPattern,
      paceProgression,
      heartRateEfficiency
    };
  };

  // Generate AI running coach system prompt
  const generateRunningCoachPrompt = (category: string, analysis: RunAnalysis, runs: RunData[], subjectiveData: SubjectiveInput[]) => {
    const basePrompt = `You are an elite AI running coach with access to comprehensive running data. You must respond based on the specific category requested and use REAL data from the runner's activities.

RUNNING DATA SUMMARY:
- Total runs: ${analysis.totalRuns}
- Total distance: ${analysis.totalDistance.toFixed(1)}km
- Average pace: ${Math.floor(analysis.avgPace)}:${Math.floor((analysis.avgPace % 1) * 60).toString().padStart(2, '0')}/km
- Average heart rate: ${analysis.avgHeartRate} bpm
- Consistency score: ${analysis.consistencyScore}/100
- Improvement trend: ${analysis.improvementTrend}
- Heart rate efficiency: ${analysis.heartRateEfficiency}/100

RECENT RUNS DETAIL:
${runs.slice(0, 5).map((run, i) => `${i + 1}. "${run.name}" - ${formatDistance(run.distance)}km in ${formatTime(run.moving_time)} (${formatPace(run.distance, run.moving_time)}) on ${new Date(run.start_date).toLocaleDateString()}`).join('\n')}

STRENGTHS: ${analysis.strengthAreas.join(', ')}
IMPROVEMENT AREAS: ${analysis.improvementAreas.join(', ')}

SUBJECTIVE FEEDBACK:
${subjectiveData.slice(0, 3).map(data => `Run feedback: Effort ${data.perceivedEffort}/10, Energy ${data.energyLevel}/10, Sleep ${data.sleepHours}h, Stress ${data.stressLevel}/10. Notes: ${data.notes}`).join('\n')}
`;

    let categorySpecificPrompt = '';

    switch (category) {
      case 'recognition':
        categorySpecificPrompt = `
CATEGORY: WHAT ARE YOU DOING WELL (Recognition & Motivation)

Your task is to analyze the runner's data and provide specific, encouraging feedback on their achievements. Follow these guidelines:

1. SPECIFICITY: Use exact numbers from their data (distances, paces, heart rates, consistency metrics)
2. MOTIVATION: Connect achievements to proven training principles from elite coaches
3. FUTURE POTENTIAL: Project where their current trajectory leads
4. CELEBRATE SMALL WINS: Acknowledge progress even if incremental

RESPONSE STRUCTURE:
- Start with their most impressive recent achievement
- Reference specific training principles (Jack Daniels, Lydiard, etc.)
- Use their consistency score and improvement trend
- Project future capabilities based on current data
- End with anticipation for next breakthrough

EXAMPLE OPENING: "Your consistency score of 85/100 shows remarkable discipline that Olympic coach Arthur Lydiard would applaud. Your average pace has improved by 12 seconds per km over the last month..."

Keep distances in km and temperatures in Celsius.`;
        break;

      case 'improvement':
        categorySpecificPrompt = `
CATEGORY: HOW TO IMPROVE YOUR RUNNING (Performance Analysis & Coaching)

Analyze the runner's data patterns and provide constructive coaching advice. Channel the analytical precision of coaches like Alberto Salazar combined with the holistic approach of Nic Bideau.

1. IDENTIFY PATTERNS: Look for pacing issues, heart rate drift, consistency gaps
2. ROOT CAUSE ANALYSIS: Don't just treat symptoms - find underlying causes
3. PROGRESSIVE SOLUTIONS: Build from foundation up
4. MEASURABLE ACTIONS: Every suggestion must have clear success metrics

RESPONSE STRUCTURE:
- Identify the main limiting factor from the data
- Explain the physiological reasoning
- Provide specific, actionable training recommendations
- Include heart rate zones and pace targets based on their current fitness
- Give workout prescriptions with recovery guidelines

FOCUS AREAS:
- 80/20 easy/hard training ratio
- Heart rate efficiency improvements
- Pacing strategy corrections
- Recovery optimization
- Specific workout recommendations

Keep all recommendations metric (km, Celsius) and use their actual pace/HR data.`;
        break;

      case 'analysis':
        categorySpecificPrompt = `
CATEGORY: HOW YOUR RUNNING HAS CHANGED OVER TIME (Longitudinal Analysis)

Create a comprehensive narrative of the runner's journey using their historical data. Channel the wisdom of coaches like Joe Vigil who see running as lifelong practice.

1. PHASE IDENTIFICATION: Identify clear evolution stages in their data
2. BEHAVIORAL TRANSFORMATION: Show how habits and consistency have evolved
3. PERFORMANCE TRAJECTORY: Use data to show fitness progression
4. INSIGHTS AND PATTERNS: Reveal what the data tells about their running evolution

RESPONSE STRUCTURE:
- Identify training phases from their data timeline
- Show progression in fitness markers (pace, HR efficiency, consistency)
- Highlight behavioral changes (frequency, consistency patterns)
- Connect improvements to training principles
- Project future development based on current trajectory

Use their weekly pattern data, pace progression, and consistency metrics to tell their story.`;
        break;

      case 'fueling':
        categorySpecificPrompt = `
CATEGORY: PRE-RUN FUELING & STRATEGY (Race-Day Coaching)

Provide comprehensive pre-run consultation covering nutrition, pacing, mental preparation, and tactical execution based on their performance data.

1. PERSONALIZED CALCULATIONS: Use their pace data for fueling recommendations
2. PACING INTELLIGENCE: Base strategy on their actual performance patterns
3. TACTICAL DECISIONS: Account for their strengths/weaknesses from data
4. COMPLETE CONSULTATION: Cover nutrition, pacing, mental, and tactical elements

RESPONSE STRUCTURE:
- 3-hour fueling timeline based on their typical run duration
- Pacing strategy using their average pace and heart rate data
- Hydration plan based on their typical run conditions
- Mental preparation referencing their past successes
- Weather adjustments if needed

Base all recommendations on their actual performance data and training patterns.`;
        break;

      default:
        categorySpecificPrompt = `Provide comprehensive running coaching advice based on the runner's data, focusing on actionable insights and motivation.`;
    }

    return basePrompt + categorySpecificPrompt;
  };

  // Fetch runs data
  const fetchRuns = async (forceRefresh = false) => {
    try {
      setError('');
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);

      const params = new URLSearchParams({
        userId: 'mihir_jain',
        detailed: 'true',
        days: timeFrame === 'week' ? '7' : timeFrame === 'month' ? '30' : '365'
      });

      if (forceRefresh) {
        params.set('refresh', 'true');
        params.set('timestamp', Date.now().toString());
      }

      console.log(`🔄 Fetching runs data for ${timeFrame}...`);
      const response = await fetch(`/api/runs?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch runs: ${response.status}`);
      }

      const data = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error('Invalid data format received from API');
      }

      const processedRuns = data.map((run: any) => ({
        id: run.id?.toString() || Math.random().toString(),
        name: run.name || 'Unnamed Run',
        start_date: run.start_date,
        distance: run.distance || 0,
        moving_time: run.moving_time || 0,
        elapsed_time: run.elapsed_time || 0,
        total_elevation_gain: run.total_elevation_gain || 0,
        average_speed: run.average_speed || 0,
        max_speed: run.max_speed || 0,
        average_heartrate: run.average_heartrate,
        max_heartrate: run.max_heartrate,
        calories: run.calories,
        average_cadence: run.average_cadence,
        splits_metric: run.splits_metric,
        best_efforts: run.best_efforts,
        gear: run.gear,
        has_detailed_data: run.has_detailed_data || false,
        weather: run.weather
      }));

      const sortedRuns = processedRuns.sort((a: RunData, b: RunData) => 
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
      );

      setRuns(sortedRuns);
      
      // Calculate analysis
      const analysis = calculateRunAnalysis(sortedRuns);
      setRunAnalysis(analysis);
      
      console.log(`✅ Loaded ${sortedRuns.length} runs and calculated analysis`);

    } catch (error) {
      console.error('❌ Error fetching runs:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch runs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Send message to AI coach
  const sendMessage = async (message: string, category: string) => {
    if (!message.trim() || isTyping || !runAnalysis) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: message.trim(),
      timestamp: new Date(),
      category: category as any
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const systemPrompt = generateRunningCoachPrompt(category, runAnalysis, runs, subjectiveInputs);
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'mihir_jain',
          source: 'ai_running_coach',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ],
          sessionId: `running_coach_${Date.now()}`,
          useSystemContext: true
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to get response: ${response.status}`);
      }

      const data = await response.json();
      const assistantContent = data.choices?.[0]?.message?.content || 'Sorry, I could not process that request.';

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
        category: category as any
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('❌ Error getting AI response:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, I\'m having trouble connecting right now. Please try again in a moment.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  // Save subjective input
  const saveSubjectiveInput = () => {
    if (!selectedRunForFeedback || !currentSubjective.notes) return;

    const newInput: SubjectiveInput = {
      runId: selectedRunForFeedback.id,
      perceivedEffort: currentSubjective.perceivedEffort || 5,
      energyLevel: currentSubjective.energyLevel || 5,
      sleepHours: currentSubjective.sleepHours || 7,
      stressLevel: currentSubjective.stressLevel || 3,
      fuelingRating: currentSubjective.fuelingRating || 5,
      notes: currentSubjective.notes || '',
      weatherImpact: currentSubjective.weatherImpact || '',
      injuryFeedback: currentSubjective.injuryFeedback || '',
      timestamp: new Date()
    };

    setSubjectiveInputs(prev => [...prev, newInput]);
    setCurrentSubjective({
      perceivedEffort: 5,
      energyLevel: 5,
      sleepHours: 7,
      stressLevel: 3,
      fuelingRating: 5,
      notes: '',
      weatherImpact: '',
      injuryFeedback: ''
    });
    setSelectedRunForFeedback(null);
    
    console.log('✅ Saved subjective input for run:', selectedRunForFeedback.name);
  };

  // Smart prompt suggestions for each category
  const getSmartPrompts = (category: string) => {
    if (!runAnalysis || runs.length === 0) return [];

    switch (category) {
      case 'recognition':
        return [
          `Analyze my consistency score of ${runAnalysis.consistencyScore}/100 - what does this tell you?`,
          `My recent runs show ${runAnalysis.improvementTrend} trend - celebrate my achievements`,
          `I've completed ${runAnalysis.totalRuns} runs covering ${runAnalysis.totalDistance.toFixed(1)}km - recognize my progress`,
          `My heart rate efficiency is ${runAnalysis.heartRateEfficiency}/100 - what am I doing well?`
        ];
      
      case 'improvement':
        return [
          `My average pace is ${Math.floor(runAnalysis.avgPace)}:${Math.floor((runAnalysis.avgPace % 1) * 60).toString().padStart(2, '0')}/km - how can I improve?`,
          `Analyze my pacing strategy from recent splits data`,
          `My heart rate averages ${runAnalysis.avgHeartRate} bpm - is this optimal?`,
          `How can I improve my ${runAnalysis.improvementTrend} performance trend?`
        ];
      
      case 'analysis':
        return [
          `How has my running evolved over the ${timeFrame === 'week' ? 'last week' : timeFrame === 'month' ? 'month' : 'year'}?`,
          `Analyze patterns in my ${runAnalysis.totalRuns} runs`,
          `What does my pace progression tell you about my development?`,
          `How has my consistency and training load changed over time?`
        ];
      
      case 'fueling':
        return [
          `Plan fueling strategy for a ${Math.round(runAnalysis.totalDistance / runAnalysis.totalRuns)}km run`,
          `Pre-run nutrition advice for my ${Math.floor(runAnalysis.avgPace)}:${Math.floor((runAnalysis.avgPace % 1) * 60).toString().padStart(2, '0')}/km pace`,
          `Hydration strategy for runs at ${runAnalysis.avgHeartRate} bpm heart rate`,
          `Race day fueling plan based on my recent performance data`
        ];
      
      default:
        return [];
    }
  };

  // Auto-scroll chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  // Load data on mount
  useEffect(() => {
    fetchRuns();
  }, [timeFrame]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-6 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold mb-2">Loading Running Data</h3>
            <p className="text-gray-600">Analyzing your runs and preparing coaching insights...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex flex-col">
        <header className="pt-8 px-6 md:px-12">
          <Button onClick={() => navigate('/')} variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </header>
        <main className="flex-grow flex items-center justify-center px-6">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Unable to Load Running Data</h3>
              <p className="text-gray-600 text-sm mb-4">{error}</p>
              <Button onClick={() => fetchRuns(true)} disabled={refreshing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Retrying...' : 'Try Again'}
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex flex-col">
        <header className="pt-8 px-6 md:px-12">
          <Button onClick={() => navigate('/')} variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </header>
        <main className="flex-grow flex items-center justify-center px-6">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 text-center">
              <Footprints className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Running Data Found</h3>
              <p className="text-gray-600 text-sm mb-4">
                No running activities found for the selected time period. Try changing the time frame or check if you have runs recorded.
              </p>
              <Button onClick={() => fetchRuns(true)} disabled={refreshing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh Data'}
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-400/5 to-green-400/5"></div>
      <div className="absolute top-20 left-20 w-32 h-32 bg-blue-200/20 rounded-full blur-xl animate-pulse"></div>
      <div className="absolute bottom-20 right-20 w-24 h-24 bg-green-200/20 rounded-full blur-xl animate-pulse delay-1000"></div>

      {/* Header */}
      <header className="relative z-10 pt-8 px-6 md:px-12">
        <div className="flex items-center justify-between mb-6">
          <Button onClick={() => navigate('/')} variant="ghost" className="hover:bg-white/20">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
          
          <div className="flex items-center gap-3">
            <select 
              value={timeFrame} 
              onChange={(e) => setTimeFrame(e.target.value as 'week' | 'month' | 'year')}
              className="px-3 py-1 text-sm border border-gray-200 rounded-md bg-white"
            >
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
              <option value="year">Last Year</option>
            </select>
            
            <Button 
              onClick={() => fetchRuns(true)}
              variant="outline"
              disabled={refreshing}
              className="hover:bg-white/20"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>
        
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 via-green-600 to-teal-600 bg-clip-text text-transparent">
            🏃‍♂️ AI Running Coach
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Advanced coaching based on your running data analysis
          </p>
          {runAnalysis && (
            <div className="mt-4 flex items-center justify-center gap-4 flex-wrap">
              <Badge variant="secondary" className="text-sm">
                {runAnalysis.totalRuns} runs • {runAnalysis.totalDistance.toFixed(1)}km
              </Badge>
              <Badge variant={runAnalysis.improvementTrend === 'improving' ? 'default' : runAnalysis.improvementTrend === 'stable' ? 'secondary' : 'destructive'} className="text-sm">
                {runAnalysis.improvementTrend} trend
              </Badge>
              <Badge variant="outline" className="text-sm">
                {runAnalysis.consistencyScore}/100 consistency
              </Badge>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 px-6 md:px-12 py-8">
        <div className="max-w-7xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="recognition">What You're Doing Well</TabsTrigger>
              <TabsTrigger value="improvement">How to Improve</TabsTrigger>
              <TabsTrigger value="analysis">Progress Over Time</TabsTrigger>
              <TabsTrigger value="subjective">Post-Run Feedback</TabsTrigger>
              <TabsTrigger value="fueling">Pre-Run Strategy</TabsTrigger>
            </TabsList>

            {/* Tab content continues... */}
            <TabsContent value="recognition" className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recognition Chat Interface */}
                <div className="lg:col-span-2">
                  <Card className="bg-white/80 backdrop-blur-sm">
                    <CardHeader className="border-b border-gray-100">
                      <CardTitle className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-yellow-500" />
                        Recognition & Motivation Coach
                        <Badge variant="secondary" className="ml-2">What You're Doing Well</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                        {messages.filter(m => !m.category || m.category === 'recognition').map((message, index) => (
                          <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-lg p-4 ${
                              message.role === 'user' 
                                ? 'bg-gradient-to-r from-blue-500 to-green-500 text-white' 
                                : 'bg-gradient-to-r from-yellow-50 to-orange-50 text-gray-800 border border-yellow-200'
                            }`}>
                              <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                              <div className={`text-xs mt-2 ${message.role === 'user' ? 'text-blue-100' : 'text-yellow-600'}`}>
                                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {isTyping && (
                          <div className="flex justify-start">
                            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-4">
                              <div className="flex items-center gap-2">
                                <Bot className="h-4 w-4 text-yellow-600" />
                                <span className="text-sm text-yellow-700">Analyzing your achievements...</span>
                                <div className="flex gap-1">
                                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce"></div>
                                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce delay-100"></div>
                                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce delay-200"></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <div ref={messagesEndRef} />
                      </div>
                      
                      <div className="border-t border-gray-100 p-4">
                        <div className="flex gap-3">
                          <Input
                            placeholder="Ask about your achievements, consistency, improvements..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && sendMessage(input, 'recognition')}
                            className="flex-1"
                            disabled={isTyping}
                          />
                          <Button
                            onClick={() => sendMessage(input, 'recognition')}
                            disabled={!input.trim() || isTyping}
                            className="bg-yellow-500 hover:bg-yellow-600 text-white"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Recognition Stats & Smart Prompts */}
                <div className="space-y-6">
                  {/* Achievement Stats */}
                  {runAnalysis && (
                    <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-semibold text-yellow-800 flex items-center gap-2">
                          <Award className="h-5 w-5" />
                          Your Achievements
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="text-center p-3 bg-white/60 rounded-lg">
                            <div className="text-2xl font-bold text-yellow-600">{runAnalysis.consistencyScore}</div>
                            <div className="text-xs text-gray-600">Consistency Score</div>
                          </div>
                          <div className="text-center p-3 bg-white/60 rounded-lg">
                            <div className="text-2xl font-bold text-yellow-600">{runAnalysis.totalRuns}</div>
                            <div className="text-xs text-gray-600">Total Runs</div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <h4 className="font-medium text-yellow-800">Strengths:</h4>
                          {runAnalysis.strengthAreas.map((strength, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              <span>{strength}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Smart Prompts */}
                  <Card className="bg-white/80 backdrop-blur-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-gray-700">Smart Questions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {getSmartPrompts('recognition').map((prompt, index) => (
                        <button
                          key={index}
                          onClick={() => sendMessage(prompt, 'recognition')}
                          className="w-full text-left text-xs p-3 bg-yellow-50 hover:bg-yellow-100 rounded border transition-colors text-gray-700 hover:text-gray-900"
                        >
                          "{prompt}"
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Improvement Tab - Performance Analysis & Coaching */}
            <TabsContent value="improvement" className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Improvement Chat Interface */}
                <div className="lg:col-span-2">
                  <Card className="bg-white/80 backdrop-blur-sm">
                    <CardHeader className="border-b border-gray-100">
                      <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5 text-blue-500" />
                        Performance Analysis Coach
                        <Badge variant="secondary" className="ml-2">How to Improve</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                        {messages.filter(m => !m.category || m.category === 'improvement').map((message, index) => (
                          <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-lg p-4 ${
                              message.role === 'user' 
                                ? 'bg-gradient-to-r from-blue-500 to-teal-500 text-white' 
                                : 'bg-gradient-to-r from-blue-50 to-teal-50 text-gray-800 border border-blue-200'
                            }`}>
                              <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                              <div className={`text-xs mt-2 ${message.role === 'user' ? 'text-blue-100' : 'text-blue-600'}`}>
                                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {isTyping && (
                          <div className="flex justify-start">
                            <div className="bg-gradient-to-r from-blue-50 to-teal-50 border border-blue-200 rounded-lg p-4">
                              <div className="flex items-center gap-2">
                                <Bot className="h-4 w-4 text-blue-600" />
                                <span className="text-sm text-blue-700">Analyzing performance patterns...</span>
                                <div className="flex gap-1">
                                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-100"></div>
                                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-200"></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <div ref={messagesEndRef} />
                      </div>
                      
                      <div className="border-t border-gray-100 p-4">
                        <div className="flex gap-3">
                          <Input
                            placeholder="Ask about pacing, heart rate zones, training strategies..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && sendMessage(input, 'improvement')}
                            className="flex-1"
                            disabled={isTyping}
                          />
                          <Button
                            onClick={() => sendMessage(input, 'improvement')}
                            disabled={!input.trim() || isTyping}
                            className="bg-blue-500 hover:bg-blue-600 text-white"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Improvement Areas & Smart Prompts */}
                <div className="space-y-6">
                  {/* Improvement Areas */}
                  {runAnalysis && (
                    <Card className="bg-gradient-to-r from-blue-50 to-teal-50 border-blue-200">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-semibold text-blue-800 flex items-center gap-2">
                          <Target className="h-5 w-5" />
                          Improvement Areas
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 gap-3">
                          <div className="text-center p-3 bg-white/60 rounded-lg">
                            <div className="text-2xl font-bold text-blue-600">
                              {Math.floor(runAnalysis.avgPace)}:{Math.floor((runAnalysis.avgPace % 1) * 60).toString().padStart(2, '0')}
                            </div>
                            <div className="text-xs text-gray-600">Current Avg Pace</div>
                          </div>
                          <div className="text-center p-3 bg-white/60 rounded-lg">
                            <div className="text-2xl font-bold text-blue-600">{runAnalysis.heartRateEfficiency}</div>
                            <div className="text-xs text-gray-600">HR Efficiency</div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <h4 className="font-medium text-blue-800">Focus Areas:</h4>
                          {runAnalysis.improvementAreas.map((area, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm">
                              <AlertCircle className="h-4 w-4 text-orange-500" />
                              <span>{area}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Smart Prompts */}
                  <Card className="bg-white/80 backdrop-blur-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-gray-700">Smart Questions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {getSmartPrompts('improvement').map((prompt, index) => (
                        <button
                          key={index}
                          onClick={() => sendMessage(prompt, 'improvement')}
                          className="w-full text-left text-xs p-3 bg-blue-50 hover:bg-blue-100 rounded border transition-colors text-gray-700 hover:text-gray-900"
                        >
                          "{prompt}"
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Analysis Tab - Progress Over Time */}
            <TabsContent value="analysis" className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Analysis Chat Interface */}
                <div className="lg:col-span-2">
                  <Card className="bg-white/80 backdrop-blur-sm">
                    <CardHeader className="border-b border-gray-100">
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-green-500" />
                        Progress Analysis Coach
                        <Badge variant="secondary" className="ml-2">How You've Changed</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                        {messages.filter(m => !m.category || m.category === 'analysis').map((message, index) => (
                          <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-lg p-4 ${
                              message.role === 'user' 
                                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white' 
                                : 'bg-gradient-to-r from-green-50 to-emerald-50 text-gray-800 border border-green-200'
                            }`}>
                              <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                              <div className={`text-xs mt-2 ${message.role === 'user' ? 'text-green-100' : 'text-green-600'}`}>
                                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {isTyping && (
                          <div className="flex justify-start">
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                              <div className="flex items-center gap-2">
                                <Bot className="h-4 w-4 text-green-600" />
                                <span className="text-sm text-green-700">Analyzing your running evolution...</span>
                                <div className="flex gap-1">
                                  <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce"></div>
                                  <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce delay-100"></div>
                                  <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce delay-200"></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <div ref={messagesEndRef} />
                      </div>
                      
                      <div className="border-t border-gray-100 p-4">
                        <div className="flex gap-3">
                          <Input
                            placeholder="Ask about progress patterns, consistency evolution, performance trends..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && sendMessage(input, 'analysis')}
                            className="flex-1"
                            disabled={isTyping}
                          />
                          <Button
                            onClick={() => sendMessage(input, 'analysis')}
                            disabled={!input.trim() || isTyping}
                            className="bg-green-500 hover:bg-green-600 text-white"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Progress Stats & Smart Prompts */}
                <div className="space-y-6">
                  {/* Progress Stats */}
                  {runAnalysis && (
                    <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-semibold text-green-800 flex items-center gap-2">
                          <Calendar className="h-5 w-5" />
                          Progress Overview
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 gap-3">
                          <div className="text-center p-3 bg-white/60 rounded-lg">
                            <div className="text-2xl font-bold text-green-600">{runAnalysis.totalDistance.toFixed(1)}</div>
                            <div className="text-xs text-gray-600">Total Distance (km)</div>
                          </div>
                          <div className="text-center p-3 bg-white/60 rounded-lg">
                            <div className="text-2xl font-bold text-green-600 capitalize">{runAnalysis.improvementTrend}</div>
                            <div className="text-xs text-gray-600">Trend Direction</div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <h4 className="font-medium text-green-800">Time Period:</h4>
                          <div className="text-sm text-gray-600">
                            Analyzing {timeFrame === 'week' ? 'last 7 days' : timeFrame === 'month' ? 'last 30 days' : 'last year'} of running data
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Smart Prompts */}
                  <Card className="bg-white/80 backdrop-blur-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-gray-700">Smart Questions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {getSmartPrompts('analysis').map((prompt, index) => (
                        <button
                          key={index}
                          onClick={() => sendMessage(prompt, 'analysis')}
                          className="w-full text-left text-xs p-3 bg-green-50 hover:bg-green-100 rounded border transition-colors text-gray-700 hover:text-gray-900"
                        >
                          "{prompt}"
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Subjective Input Tab - Post-Run Feedback */}
            <TabsContent value="subjective" className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Run Selection and Feedback Form */}
                <Card className="bg-white/80 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5 text-purple-500" />
                      Post-Run Subjective Feedback
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Run Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Select Recent Run:</label>
                      <select 
                        className="w-full p-2 border border-gray-200 rounded-md"
                        value={selectedRunForFeedback?.id || ''}
                        onChange={(e) => {
                          const run = runs.find(r => r.id === e.target.value);
                          setSelectedRunForFeedback(run || null);
                        }}
                      >
                        <option value="">Choose a run to provide feedback...</option>
                        {runs.slice(0, 10).map(run => (
                          <option key={run.id} value={run.id}>
                            {run.name} - {formatDistance(run.distance)}km on {new Date(run.start_date).toLocaleDateString()}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedRunForFeedback && (
                      <>
                        {/* Run Summary */}
                        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                          <h4 className="font-medium text-purple-800 mb-2">{selectedRunForFeedback.name}</h4>
                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <div>
                              <span className="text-gray-600">Distance:</span>
                              <div className="font-medium">{formatDistance(selectedRunForFeedback.distance)}km</div>
                            </div>
                            <div>
                              <span className="text-gray-600">Time:</span>
                              <div className="font-medium">{formatTime(selectedRunForFeedback.moving_time)}</div>
                            </div>
                            <div>
                              <span className="text-gray-600">Pace:</span>
                              <div className="font-medium">{formatPace(selectedRunForFeedback.distance, selectedRunForFeedback.moving_time)}</div>
                            </div>
                          </div>
                        </div>

                        {/* Feedback Form */}
                        <div className="space-y-4">
                          {/* Rating Scales */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Perceived Effort (1-10): {currentSubjective.perceivedEffort}
                              </label>
                              <input
                                type="range"
                                min="1"
                                max="10"
                                value={currentSubjective.perceivedEffort}
                                onChange={(e) => setCurrentSubjective(prev => ({ ...prev, perceivedEffort: parseInt(e.target.value) }))}
                                className="w-full"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Energy Level (1-10): {currentSubjective.energyLevel}
                              </label>
                              <input
                                type="range"
                                min="1"
                                max="10"
                                value={currentSubjective.energyLevel}
                                onChange={(e) => setCurrentSubjective(prev => ({ ...prev, energyLevel: parseInt(e.target.value) }))}
                                className="w-full"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Sleep Hours: {currentSubjective.sleepHours}
                              </label>
                              <input
                                type="range"
                                min="3"
                                max="12"
                                value={currentSubjective.sleepHours}
                                onChange={(e) => setCurrentSubjective(prev => ({ ...prev, sleepHours: parseInt(e.target.value) }))}
                                className="w-full"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Stress Level (1-10): {currentSubjective.stressLevel}
                              </label>
                              <input
                                type="range"
                                min="1"
                                max="10"
                                value={currentSubjective.stressLevel}
                                onChange={(e) => setCurrentSubjective(prev => ({ ...prev, stressLevel: parseInt(e.target.value) }))}
                                className="w-full"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Fueling Rating (1-10): {currentSubjective.fuelingRating}
                            </label>
                            <input
                              type="range"
                              min="1"
                              max="10"
                              value={currentSubjective.fuelingRating}
                              onChange={(e) => setCurrentSubjective(prev => ({ ...prev, fuelingRating: parseInt(e.target.value) }))}
                              className="w-full"
                            />
                          </div>

                          {/* Text Inputs */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              How did the run feel? (Required)
                            </label>
                            <Textarea
                              placeholder="Describe how you felt during and after the run, what went well, what was challenging..."
                              value={currentSubjective.notes}
                              onChange={(e) => setCurrentSubjective(prev => ({ ...prev, notes: e.target.value }))}
                              className="w-full"
                              rows={3}
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Weather Impact
                            </label>
                            <Input
                              placeholder="How did weather conditions affect your run?"
                              value={currentSubjective.weatherImpact}
                              onChange={(e) => setCurrentSubjective(prev => ({ ...prev, weatherImpact: e.target.value }))}
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Injury/Discomfort Feedback
                            </label>
                            <Input
                              placeholder="Any pain, discomfort, or physical concerns?"
                              value={currentSubjective.injuryFeedback}
                              onChange={(e) => setCurrentSubjective(prev => ({ ...prev, injuryFeedback: e.target.value }))}
                            />
                          </div>

                          <Button
                            onClick={saveSubjectiveInput}
                            disabled={!currentSubjective.notes}
                            className="w-full bg-purple-500 hover:bg-purple-600 text-white"
                          >
                            Save Run Feedback
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Previous Feedback & Insights */}
                <Card className="bg-white/80 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-purple-500" />
                      Recent Feedback & Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {subjectiveInputs.length === 0 ? (
                      <div className="text-center py-8">
                        <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">No feedback recorded yet.</p>
                        <p className="text-sm text-gray-500 mt-2">Start by selecting a recent run and sharing how it felt.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {subjectiveInputs.slice(-5).reverse().map((feedback, index) => {
                          const run = runs.find(r => r.id === feedback.runId);
                          return (
                            <div key={index} className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="font-medium text-purple-800">
                                  {run?.name || 'Unknown Run'}
                                </h4>
                                <span className="text-xs text-purple-600">
                                  {feedback.timestamp.toLocaleDateString()}
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                                <span>Effort: {feedback.perceivedEffort}/10</span>
                                <span>Energy: {feedback.energyLevel}/10</span>
                                <span>Sleep: {feedback.sleepHours}h</span>
                              </div>
                              <p className="text-sm text-gray-700">{feedback.notes}</p>
                              {feedback.weatherImpact && (
                                <p className="text-xs text-gray-600 mt-1">Weather: {feedback.weatherImpact}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Fueling Tab - Pre-Run Strategy */}
            <TabsContent value="fueling" className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Fueling Chat Interface */}
                <div className="lg:col-span-2">
                  <Card className="bg-white/80 backdrop-blur-sm">
                    <CardHeader className="border-b border-gray-100">
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-orange-500" />
                        Pre-Run Strategy Coach
                        <Badge variant="secondary" className="ml-2">Fueling & Pacing</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                        {messages.filter(m => !m.category || m.category === 'fueling').map((message, index) => (
                          <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-lg p-4 ${
                              message.role === 'user' 
                                ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white' 
                                : 'bg-gradient-to-r from-orange-50 to-red-50 text-gray-800 border border-orange-200'
                            }`}>
                              <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                              <div className={`text-xs mt-2 ${message.role === 'user' ? 'text-orange-100' : 'text-orange-600'}`}>
                                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {isTyping && (
                          <div className="flex justify-start">
                            <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-lg p-4">
                              <div className="flex items-center gap-2">
                                <Bot className="h-4 w-4 text-orange-600" />
                                <span className="text-sm text-orange-700">Preparing fueling strategy...</span>
                                <div className="flex gap-1">
                                  <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce"></div>
                                  <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce delay-100"></div>
                                  <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce delay-200"></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <div ref={messagesEndRef} />
                      </div>
                      
                      <div className="border-t border-gray-100 p-4">
                        <div className="flex gap-3">
                          <Input
                            placeholder="Ask about nutrition timing, pacing strategy, hydration plans..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && sendMessage(input, 'fueling')}
                            className="flex-1"
                            disabled={isTyping}
                          />
                          <Button
                            onClick={() => sendMessage(input, 'fueling')}
                            disabled={!input.trim() || isTyping}
                            className="bg-orange-500 hover:bg-orange-600 text-white"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Fueling Guidelines & Smart Prompts */}
                <div className="space-y-6">
                  {/* Quick Fueling Guidelines */}
                  {runAnalysis && (
                    <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-semibold text-orange-800 flex items-center gap-2">
                          <Timer className="h-5 w-5" />
                          Quick Guidelines
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-3">
                          <div className="p-3 bg-white/60 rounded-lg">
                            <div className="text-sm font-medium text-orange-800 mb-1">Your Average Pace</div>
                            <div className="text-lg font-bold text-orange-600">
                              {Math.floor(runAnalysis.avgPace)}:{Math.floor((runAnalysis.avgPace % 1) * 60).toString().padStart(2, '0')}/km
                            </div>
                          </div>
                          <div className="p-3 bg-white/60 rounded-lg">
                            <div className="text-sm font-medium text-orange-800 mb-1">Typical Run Duration</div>
                            <div className="text-lg font-bold text-orange-600">
                              {formatTime(runAnalysis.totalTime / runAnalysis.totalRuns)}
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-xs text-gray-600 space-y-1">
                          <p>• 3h before: Main meal</p>
                          <p>• 1h before: Light snack</p>
                          <p>• 30min before: Final prep</p>
                          <p>• During: Fuel every 45-60min</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Smart Prompts */}
                  <Card className="bg-white/80 backdrop-blur-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-gray-700">Smart Questions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {getSmartPrompts('fueling').map((prompt, index) => (
                        <button
                          key={index}
                          onClick={() => sendMessage(prompt, 'fueling')}
                          className="w-full text-left text-xs p-3 bg-orange-50 hover:bg-orange-100 rounded border transition-colors text-gray-700 hover:text-gray-900"
                        >
                          "{prompt}"
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default RunningCoach;