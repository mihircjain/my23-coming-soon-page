import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Send, Bot, Activity, TrendingUp, Heart, Trophy, Calendar, MapPin, Zap, Users, Route } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface StravaStats {
  connected: boolean;
  lastChecked: string;
}

interface QueryAnalysis {
  intent: 'specific_activity' | 'date_range' | 'general_stats' | 'training_zones' | 'segments' | 'routes';
  dateReference?: string;
  dateRange?: { days: number };
  dataTypes: string[];
  mcpCalls: Array<{ endpoint: string; params: any }>;
  reasoning: string;
}

interface MCPResponse {
  endpoint: string;
  data: any;
  success: boolean;
}

// Available MCP endpoints with their capabilities
const MCP_ENDPOINTS = {
  'get-recent-activities': {
    description: 'Get recent activities list',
    params: ['per_page', 'before', 'after']
  },
  'get-activity-details': {
    description: 'Get detailed activity information',
    params: ['activityId'],
    requires: ['activityId']
  },
  'get-activity-streams': {
    description: 'Get activity data streams (HR, pace, power, etc.)',
    params: ['id', 'types', 'resolution', 'points_per_page'],
    requires: ['id']
  },
  'get-activity-laps': {
    description: 'Get activity lap data',
    params: ['id'],
    requires: ['id']
  },
  'get-athlete-profile': {
    description: 'Get athlete profile information',
    params: []
  },
  'get-athlete-stats': {
    description: 'Get athlete statistics and totals',
    params: []
  },
  'get-athlete-zones': {
    description: 'Get heart rate and power zones',
    params: []
  },
  'explore-segments': {
    description: 'Explore segments in an area',
    params: ['bounds', 'activity_type']
  },
  'list-starred-segments': {
    description: 'Get starred segments',
    params: []
  },
  'list-athlete-routes': {
    description: 'Get athlete routes',
    params: []
  }
};

export default function Coach() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [stravaStats, setStravaStats] = useState<StravaStats>({
    connected: false,
    lastChecked: ''
  });

  // Backend API for Claude calls (handles CORS properly)

  useEffect(() => {
    // Add welcome message
    setMessages([{
      role: 'assistant',
      content: '🏃‍♂️ Hey! I\'m your intelligent AI Running Coach. I analyze your queries and fetch exactly the Strava data you need for comprehensive coaching. Ask me anything - I\'ll figure out what data to get and provide detailed analysis!',
      timestamp: new Date()
    }]);

    // Test MCP connection
    testMCPConnection();
  }, []);

  const testMCPConnection = async () => {
    try {
      const response = await fetch('https://strava-mcp-server.onrender.com/health');
      setStravaStats({
        connected: response.ok,
        lastChecked: new Date().toLocaleTimeString()
      });
    } catch (error) {
      console.error('❌ MCP connection test failed:', error);
      setStravaStats({
        connected: false,
        lastChecked: new Date().toLocaleTimeString()
      });
    }
  };

  // Step 1: Analyze user query using Claude to determine what MCP calls to make
  const analyzeQueryWithClaude = async (query: string): Promise<QueryAnalysis> => {
    console.log(`🧠 Analyzing query: "${query}"`);

    try {
      const response = await fetch('/api/claude-coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'analyze_query',
          query
        })
      });

      if (!response.ok) {
        throw new Error(`Backend API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.fallback) {
        console.log('⚠️ Using fallback analysis mode');
      } else {
        console.log('✅ Claude query analysis:', data.analysis);
      }
      
      return data.analysis;
      
    } catch (error) {
      console.error('❌ Claude analysis failed, using local fallback:', error);
      return analyzeQueryRuleBased(query);
    }
  };

  // Fallback rule-based query analysis
  const analyzeQueryRuleBased = (query: string): QueryAnalysis => {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('yesterday') || lowerQuery.includes('today')) {
      return {
        intent: 'specific_activity',
        dateReference: lowerQuery.includes('yesterday') ? 'yesterday' : 'today',
        dataTypes: ['heartrate', 'pace', 'power'],
        mcpCalls: [
          { endpoint: 'get-recent-activities', params: { per_page: 5 } }
        ],
        reasoning: 'Date-specific query requires recent activities to find the right activity'
      };
    }
    
    if (lowerQuery.includes('last') && lowerQuery.includes('days')) {
      const daysMatch = lowerQuery.match(/(\d+)\s*days/);
      const days = daysMatch ? parseInt(daysMatch[1]) : 7;
      return {
        intent: 'date_range',
        dateRange: { days },
        dataTypes: ['overview'],
        mcpCalls: [
          { endpoint: 'get-recent-activities', params: { per_page: Math.min(50, days * 2) } },
          { endpoint: 'get-athlete-stats', params: {} }
        ],
        reasoning: `Multi-day analysis requires recent activities and stats`
      };
    }
    
    if (lowerQuery.includes('heart rate') || lowerQuery.includes('hr')) {
      return {
        intent: 'training_zones',
        dataTypes: ['heartrate'],
        mcpCalls: [
          { endpoint: 'get-recent-activities', params: { per_page: 5 } },
          { endpoint: 'get-athlete-zones', params: {} }
        ],
        reasoning: 'HR analysis requires recent activities and training zones'
      };
    }
    
    // Default
    return {
      intent: 'general_stats',
      dataTypes: ['overview'],
      mcpCalls: [
        { endpoint: 'get-recent-activities', params: { per_page: 10 } },
        { endpoint: 'get-athlete-profile', params: {} }
      ],
      reasoning: 'General query - showing recent activities and profile'
    };
  };

  // Step 2: Execute MCP calls based on analysis
  const executeMCPCalls = async (mcpCalls: Array<{ endpoint: string; params: any }>): Promise<MCPResponse[]> => {
    console.log(`🔄 Executing ${mcpCalls.length} MCP calls`);
    
    const responses = await Promise.all(
      mcpCalls.map(async ({ endpoint, params }) => {
        try {
          console.log(`🌐 Calling ${endpoint} with params:`, params);
          
          const response = await fetch(`https://strava-mcp-server.onrender.com/api/tools/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
          });
          
          if (!response.ok) {
            throw new Error(`${endpoint} failed: ${response.status}`);
          }
          
          const data = await response.json();
          console.log(`✅ ${endpoint} success`);
          
          return {
            endpoint,
            data,
            success: true
          };
        } catch (error) {
          console.error(`❌ ${endpoint} failed:`, error);
          return {
            endpoint,
            data: null,
            success: false
          };
        }
      })
    );
    
    return responses;
  };

  // Step 3: Find specific activity ID from date reference
  const findActivityByDate = async (dateRef: string, activities: any[]): Promise<string | null> => {
    if (!activities.length) return null;
    
    const today = new Date();
    let searchDate: Date;
    
    if (dateRef === 'today') {
      searchDate = today;
    } else if (dateRef === 'yesterday') {
      searchDate = new Date(today);
      searchDate.setDate(searchDate.getDate() - 1);
    } else if (dateRef.includes('june') && dateRef.includes('24')) {
      // Fixed: Use current year (2025) not default year
      searchDate = new Date(2025, 5, 24); // June = 5 (0-indexed)
    } else {
      console.log(`⚠️ Unrecognized date reference: ${dateRef}`);
      return null;
    }
    
    console.log(`🔍 Searching for activity on: ${searchDate.toDateString()}`);
    
    // Parse activities text to find matching date
    const activitiesText = activities[0]?.content?.[0]?.text || '';
    const lines = activitiesText.split('\n');
    
    console.log(`📋 Scanning ${lines.length} activity lines for ${searchDate.toDateString()}`);
    
    for (const line of lines) {
      const idMatch = line.match(/ID:\s*(\d+)/);
      const dateMatch = line.match(/on\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
      
      if (idMatch && dateMatch) {
        const [month, day, year] = dateMatch[1].split('/');
        const activityDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        
        console.log(`📅 Found activity ${idMatch[1]} on ${activityDate.toDateString()}`);
        
        if (activityDate.toDateString() === searchDate.toDateString()) {
          console.log(`🎯 ✅ MATCH! Found activity ID ${idMatch[1]} for ${dateRef}`);
          return idMatch[1];
        }
      }
    }
    
    console.log(`❌ No activity found for ${dateRef} (${searchDate.toDateString()})`);
    return null;
  };

  // Step 4: Get additional detailed data if needed
  const getDetailedActivityData = async (activityId: string, dataTypes: string[]): Promise<MCPResponse[]> => {
    const additionalCalls = [];
    
    // Add activity details
    additionalCalls.push({
      endpoint: 'get-activity-details',
      params: { activityId }
    });
    
    // Add streams if HR/pace analysis requested
    if (dataTypes.includes('heartrate') || dataTypes.includes('pace') || dataTypes.includes('power')) {
      additionalCalls.push({
        endpoint: 'get-activity-streams',
        params: {
          id: activityId,
          types: ['time', 'distance', 'heartrate', 'watts', 'velocity_smooth', 'altitude', 'cadence'],
          resolution: 'high',
          points_per_page: -1
        }
      });
    }
    
    // Add laps for pacing analysis
    if (dataTypes.includes('pace') || dataTypes.includes('heartrate')) {
      additionalCalls.push({
        endpoint: 'get-activity-laps',
        params: { id: activityId }
      });
    }
    
    return await executeMCPCalls(additionalCalls);
  };

  // Step 5: Generate response using Claude with focused data
  const generateResponseWithClaude = async (query: string, intent: any, mcpResponses: MCPResponse[]): Promise<string> => {
    const contextData = mcpResponses
      .filter(r => r.success && r.data?.content?.[0]?.text)
      .map(r => `\n🏃 ${r.endpoint.toUpperCase()}:\n${r.data.content[0].text}`)
      .join('\n');

    try {
      const response = await fetch('/api/claude-coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'generate_response',
          query,
          intent,
          mcpResponses
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
      return `I can see your data but had trouble generating a detailed response. Here's what I found:\n\n${contextData}`;
    }
  };

  // Extract activity IDs from recent activities text
  const extractActivityIds = (activitiesData: any, maxActivities: number = 5): string[] => {
    const activitiesText = activitiesData?.content?.[0]?.text || '';
    const lines = activitiesText.split('\n');
    const activityIds: string[] = [];
    
    for (const line of lines) {
      const idMatch = line.match(/ID:\s*(\d+)/);
      // More inclusive running detection
      const isRun = (line.toLowerCase().includes('run') || line.toLowerCase().includes('running')) 
                    && !line.toLowerCase().includes('weight') 
                    && !line.toLowerCase().includes('walk');
      
      if (idMatch && isRun && activityIds.length < maxActivities) {
        activityIds.push(idMatch[1]);
        console.log(`🏃 Extracted activity ID: ${idMatch[1]} from: ${line.split('—')[0]}`);
      }
    }
    
    // If we didn't find enough runs, log what we did find
    if (activityIds.length < 3) {
      console.log(`⚠️ Only found ${activityIds.length} runs. Recent activities:`);
      lines.slice(0, 10).forEach(line => {
        if (line.includes('ID:')) console.log(`  ${line}`);
      });
    }
    
    return activityIds;
  };

  // Get detailed streams for multiple activities
  const getDetailedStreamsForActivities = async (activityIds: string[], dataTypes: string[]): Promise<MCPResponse[]> => {
    console.log(`🔍 Getting detailed streams for ${activityIds.length} activities: ${activityIds.join(', ')}`);
    
    const streamCalls = activityIds.map(id => ({
      endpoint: 'get-activity-streams',
      params: {
        id,
        types: ['time', 'distance', 'heartrate', 'watts', 'velocity_smooth', 'altitude', 'cadence'],
        resolution: 'medium',
        points_per_page: -1
      }
    }));
    
    return await executeMCPCalls(streamCalls);
  };

  // Validate if we have sufficient data before calling Claude
  const validateDataForClaude = (mcpResponses: MCPResponse[]): boolean => {
    const successfulResponses = mcpResponses.filter(r => r.success && r.data?.content?.[0]?.text);
    
    if (successfulResponses.length === 0) {
      console.log('❌ No successful MCP responses - skip Claude call');
      return false;
    }
    
    // Check if we have meaningful data (not just empty lists)
    const hasRealData = successfulResponses.some(r => {
      const text = r.data.content[0].text;
      return text.length > 100 && !text.includes('No activities found');
    });
    
    if (!hasRealData) {
      console.log('❌ No meaningful data in MCP responses - skip Claude call');
      return false;
    }
    
    console.log(`✅ Data validation passed: ${successfulResponses.length} successful responses with real data`);
    return true;
  };

  // Smart rule-based query parsing (faster than Claude for simple cases)
  const parseQueryIntent = (query: string) => {
    const lowerQuery = query.toLowerCase();
    
    // Time range queries (NEW!)
    if (lowerQuery.includes('last week') || lowerQuery.includes('past week')) {
      return {
        type: 'time_range',
        range: 'last_week',
        needsDetailedAnalysis: true,
        needsStreams: true
      };
    }
    
    if (lowerQuery.includes('last month') || lowerQuery.includes('past month')) {
      return {
        type: 'time_range',
        range: 'last_month',
        needsDetailedAnalysis: true,
        needsStreams: true
      };
    }
    
    // Match "last X days" pattern
    const daysMatch = lowerQuery.match(/last (\d+) days?/);
    if (daysMatch) {
      return {
        type: 'time_range',
        range: 'custom_days',
        days: parseInt(daysMatch[1]),
        needsDetailedAnalysis: true,
        needsStreams: true
      };
    }
    
    // Date-specific queries (make more flexible)
    if (lowerQuery.includes('june 24') || (lowerQuery.includes('june') && lowerQuery.includes('24'))) {
      return {
        type: 'specific_date',
        date: 'june 24',
        needsDetailedAnalysis: true,
        flexibleMatching: true  // NEW: Allow nearby dates
      };
    }
    
    if (lowerQuery.includes('yesterday')) {
      return {
        type: 'specific_date', 
        date: 'yesterday',
        needsDetailedAnalysis: true,
        flexibleMatching: true
      };
    }
    
    if (lowerQuery.includes('today')) {
      return {
        type: 'specific_date',
        date: 'today', 
        needsDetailedAnalysis: true,
        flexibleMatching: true
      };
    }
    
    // Multiple runs analysis
    if (lowerQuery.includes('recent runs') || lowerQuery.includes('last runs') || lowerQuery.includes('show my runs')) {
      return {
        type: 'recent_runs',
        needsDetailedAnalysis: true,
        needsStreams: true
      };
    }
    
    // HR/zone analysis queries
    if (lowerQuery.includes('heart rate') || lowerQuery.includes('hr') || lowerQuery.includes('distribution') || lowerQuery.includes('zone')) {
      return {
        type: 'hr_analysis',
        needsDetailedAnalysis: true,
        needsStreams: true
      };
    }
    
    // General queries
    return {
      type: 'general',
      needsDetailedAnalysis: false
    };
  };

  // Get data FIRST, then analyze
  const getDataForQuery = async (query: string) => {
    const intent = parseQueryIntent(query);
    console.log(`🧠 Parsed intent:`, intent);
    
    let mcpResponses: MCPResponse[] = [];
    
    if (intent.type === 'specific_date') {
      console.log(`📅 Getting data for specific date: ${intent.date}`);
      
      // Step 1: Get recent activities around the date
      const dateRange = getDateRangeForQuery(intent.date);
      const recentActivitiesCall = {
        endpoint: 'get-recent-activities',
        params: {
          per_page: 30,
          after: dateRange.after,
          before: dateRange.before
        }
      };
      
      const recentActivities = await executeMCPCalls([recentActivitiesCall]);
      mcpResponses.push(...recentActivities);
      
            // Step 2: Find the specific activity ID for that date (or nearby)
      if (recentActivities[0]?.success) {
        const activityId = await findActivityByDate(intent.date, [recentActivities[0].data]);
        
        if (activityId) {
          console.log(`🎯 Found activity ${activityId}, getting detailed data...`);
          
          // Step 3: Get detailed data for the real activity ID
          const detailedCalls = [
            { endpoint: 'get-activity-details', params: { activityId } },
            { endpoint: 'get-activity-streams', params: { 
              id: activityId, 
              types: ['time', 'distance', 'heartrate', 'watts', 'velocity_smooth', 'altitude', 'cadence'],
              resolution: 'high'
            }},
            { endpoint: 'get-activity-laps', params: { id: activityId } },
            { endpoint: 'get-athlete-zones', params: {} }
          ];
          
          const detailedData = await executeMCPCalls(detailedCalls);
          mcpResponses.push(...detailedData);
        } else if (intent.flexibleMatching) {
          console.log(`❌ No exact match for ${intent.date}, looking for nearby activities...`);
          
          // If flexible matching enabled, get nearby activities anyway
          const activityIds = extractActivityIds(recentActivities[0].data, 3);
          
          if (activityIds.length > 0) {
            console.log(`🔍 Found ${activityIds.length} nearby activities: ${activityIds.join(', ')}`);
            
            const detailedCalls = activityIds.flatMap(id => [
              { endpoint: 'get-activity-details', params: { activityId: id } },
              { endpoint: 'get-activity-streams', params: { 
                id, 
                types: ['time', 'distance', 'heartrate', 'watts', 'velocity_smooth', 'altitude'],
                resolution: 'high'
              }}
            ]);
            
            // Add a flag to indicate this is flexible matching
            const detailedData = await executeMCPCalls(detailedCalls);
            mcpResponses.push(...detailedData);
            
            // Add a note about flexible matching
            mcpResponses.push({
              endpoint: 'flexible_match_note',
              success: true,
              data: {
                content: [{
                  text: `Note: No activity found for exact date "${intent.date}", showing ${activityIds.length} nearby activities instead.`
                }]
              }
            });
          } else {
            console.log(`❌ No activities found near ${intent.date}`);
          }
        } else {
          console.log(`❌ No activity found for ${intent.date}`);
        }
      }
       
     } else if (intent.type === 'time_range') {
       console.log(`📅 Getting data for time range: ${intent.range}`);
       
       // Calculate date range based on intent
       let dateRange;
       const today = new Date();
       
       if (intent.range === 'last_week') {
         const weekAgo = new Date(today);
         weekAgo.setDate(weekAgo.getDate() - 7);
         dateRange = {
           after: weekAgo.toISOString().split('T')[0],
           before: today.toISOString().split('T')[0]
         };
       } else if (intent.range === 'last_month') {
         const monthAgo = new Date(today);
         monthAgo.setMonth(monthAgo.getMonth() - 1);
         dateRange = {
           after: monthAgo.toISOString().split('T')[0],
           before: today.toISOString().split('T')[0]
         };
       } else if (intent.range === 'custom_days') {
         const daysAgo = new Date(today);
         daysAgo.setDate(daysAgo.getDate() - intent.days);
         dateRange = {
           after: daysAgo.toISOString().split('T')[0],
           before: today.toISOString().split('T')[0]
         };
       }
       
       console.log(`📅 Date range: ${dateRange.after} to ${dateRange.before}`);
       
       // Get activities in date range
       const timeRangeCall = [
         { endpoint: 'get-recent-activities', params: { 
           per_page: 50,
           after: dateRange.after,
           before: dateRange.before
         }},
         { endpoint: 'get-athlete-zones', params: {} },
         { endpoint: 'get-athlete-stats', params: {} }
       ];
       
       const timeRangeData = await executeMCPCalls(timeRangeCall);
       mcpResponses.push(...timeRangeData);
       
       // Get detailed data for all runs in range
       const activitiesResponse = timeRangeData.find(r => r.endpoint === 'get-recent-activities');
       if (activitiesResponse?.success) {
         const activityIds = extractActivityIds(activitiesResponse.data, 15); // Get up to 15 runs
         
         console.log(`🏃 Found ${activityIds.length} runs in ${intent.range}: ${activityIds.join(', ')}`);
         
         if (activityIds.length > 0) {
           const detailedCalls = activityIds.flatMap(id => [
             { endpoint: 'get-activity-details', params: { activityId: id } },
             { endpoint: 'get-activity-streams', params: { 
               id, 
               types: ['heartrate', 'time', 'distance', 'velocity_smooth', 'altitude'],
               resolution: 'low' // Use low res for bulk analysis
             }}
           ]);
           
           console.log(`📊 Getting detailed data for ${activityIds.length} runs (${detailedCalls.length} MCP calls)`);
           const detailedData = await executeMCPCalls(detailedCalls);
           mcpResponses.push(...detailedData);
         }
       }
       
     } else if (intent.type === 'recent_runs') {
       console.log(`🏃 Getting data for recent runs analysis...`);
       
       // Get MORE recent activities for multiple runs
       const recentActivitiesCall = [
         { endpoint: 'get-recent-activities', params: { per_page: 50 } },  // Increased from 20
         { endpoint: 'get-athlete-zones', params: {} },
         { endpoint: 'get-athlete-stats', params: {} }
       ];
       
       const basicData = await executeMCPCalls(recentActivitiesCall);
       mcpResponses.push(...basicData);
       
       // Get detailed data for MULTIPLE recent runs
       const recentActivitiesResponse = basicData.find(r => r.endpoint === 'get-recent-activities');
       if (recentActivitiesResponse?.success) {
         const activityIds = extractActivityIds(recentActivitiesResponse.data, 8); // Get 8 runs instead of 5
         
         console.log(`🏃 Found ${activityIds.length} recent runs: ${activityIds.join(', ')}`);
         
         if (activityIds.length > 0) {
           const detailedCalls = activityIds.flatMap(id => [
             { endpoint: 'get-activity-details', params: { activityId: id } },
             { endpoint: 'get-activity-streams', params: { 
               id, 
               types: ['heartrate', 'time', 'distance', 'velocity_smooth', 'altitude'],
               resolution: 'medium'
             }}
           ]);
           
           console.log(`📊 Getting detailed data for ${activityIds.length} runs (${detailedCalls.length} MCP calls)`);
           const detailedData = await executeMCPCalls(detailedCalls);
           mcpResponses.push(...detailedData);
         } else {
           console.log('⚠️ No running activities found in recent activities');
         }
       }
       
     } else if (intent.type === 'hr_analysis') {
       console.log(`❤️ Getting data for HR analysis...`);
       
       // Get recent activities and zones
       const basicCalls = [
         { endpoint: 'get-recent-activities', params: { per_page: 20 } },
         { endpoint: 'get-athlete-zones', params: {} }
       ];
       
       const basicData = await executeMCPCalls(basicCalls);
       mcpResponses.push(...basicData);
       
       // Get detailed streams for recent runs
       const recentActivitiesResponse = basicData.find(r => r.endpoint === 'get-recent-activities');
       if (recentActivitiesResponse?.success) {
         const activityIds = extractActivityIds(recentActivitiesResponse.data, 5);
         
         if (activityIds.length > 0) {
           const detailedCalls = activityIds.flatMap(id => [
             { endpoint: 'get-activity-details', params: { activityId: id } },
             { endpoint: 'get-activity-streams', params: { 
               id, 
               types: ['heartrate', 'time', 'distance', 'velocity_smooth'],
               resolution: 'medium'
             }}
           ]);
           
           const detailedData = await executeMCPCalls(detailedCalls);
           mcpResponses.push(...detailedData);
         }
       }
       
     } else {
      // General query - just get recent activities and profile
      const generalCalls = [
        { endpoint: 'get-recent-activities', params: { per_page: 10 } },
        { endpoint: 'get-athlete-profile', params: {} },
        { endpoint: 'get-athlete-stats', params: {} }
      ];
      
      const generalData = await executeMCPCalls(generalCalls);
      mcpResponses.push(...generalData);
    }
    
    return { intent, mcpResponses };
  };

  // Helper to get date range for queries
  const getDateRangeForQuery = (dateRef: string) => {
    const today = new Date();
    
    if (dateRef === 'today') {
      const todayStr = today.toISOString().split('T')[0];
      return {
        after: todayStr,
        before: todayStr
      };
    } else if (dateRef === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      return {
        after: yesterdayStr,
        before: yesterdayStr
      };
    } else if (dateRef === 'june 24') {
      return {
        after: '2025-06-23',
        before: '2025-06-25'
      };
    }
    
    // Default: last week
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return {
      after: weekAgo.toISOString().split('T')[0],
      before: today.toISOString().split('T')[0]
    };
  };

  // Main message handler - DATA FIRST approach
  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      // Step 1: Get the RIGHT data first (no Claude guessing)
      console.log('🔍 Getting data for query...');
      const { intent, mcpResponses } = await getDataForQuery(currentInput);
      
      console.log(`✅ Got ${mcpResponses.length} MCP responses for intent: ${intent.type}`);

      // COST CONTROL: Only call Claude if we have meaningful data
      if (!validateDataForClaude(mcpResponses)) {
        const errorMessage = `❌ **Data Access Issue**

I couldn't find sufficient data to analyze for **"${currentInput}"**

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

      // Step 2: Generate comprehensive response with Claude (using real data)
      const responseText = await generateResponseWithClaude(currentInput, intent, mcpResponses);

      const assistantMessage: Message = {
        role: 'assistant',
        content: responseText,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

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

  // Smart coaching prompts that leverage the intelligent system
  const smartPrompts = [
    "Analyze my run from yesterday with detailed HR and pace breakdown",
    "Show me my performance trends over the last 20 days",
    "How was my heart rate distribution in recent runs?",
    "Give me a detailed analysis of my pacing strategy",
    "What are my training zones and how should I use them?",
    "Tell me about June 24 run with full analysis",
    "Analyze my running consistency and suggest improvements",
    "Create a training plan based on my current fitness"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card className="bg-gradient-to-r from-green-100 to-blue-100 border-0 shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-green-700 to-blue-700 bg-clip-text text-transparent flex items-center justify-center gap-2">
              <Bot className="h-8 w-8 text-green-600" />
              Intelligent AI Running Coach
            </CardTitle>
            <CardDescription className="text-lg text-gray-600">
              Query-First Analysis • Claude AI • Smart MCP Integration
            </CardDescription>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs bg-white/50">
                <Zap className="h-3 w-3 mr-1" />
                Intelligent Query Analysis
              </Badge>
              <Badge variant="outline" className="text-xs bg-white/50">
                <Activity className="h-3 w-3 mr-1" />
                Targeted Data Fetching
              </Badge>
              <Badge variant="outline" className="text-xs bg-white/50">
                <Bot className="h-3 w-3 mr-1" />
                Claude AI Powered
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Connection Status */}
        <Card className="bg-white/80 backdrop-blur border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-700 flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-600" />
              System Status
              <Badge variant={stravaStats.connected ? "default" : "destructive"} className="ml-auto">
                MCP: {stravaStats.connected ? "Connected" : "Disconnected"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <Bot className="h-6 w-6 text-green-600 mx-auto mb-1" />
                <div className="text-sm font-medium text-green-700">Claude AI</div>
                <div className="text-xs text-gray-600">Backend API</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <Activity className="h-6 w-6 text-blue-600 mx-auto mb-1" />
                <div className="text-sm font-medium text-blue-700">MCP Server</div>
                <div className="text-xs text-gray-600">{stravaStats.connected ? 'Online' : 'Offline'}</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <Zap className="h-6 w-6 text-purple-600 mx-auto mb-1" />
                <div className="text-sm font-medium text-purple-700">Query Analysis</div>
                <div className="text-xs text-gray-600">Intelligent</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <TrendingUp className="h-6 w-6 text-orange-600 mx-auto mb-1" />
                <div className="text-sm font-medium text-orange-700">Last Check</div>
                <div className="text-xs text-gray-600">{stravaStats.lastChecked}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chat Interface */}
        <Card className="bg-white/90 backdrop-blur border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-700">Intelligent Coaching Chat</CardTitle>
            <CardDescription className="text-sm text-gray-600">
              Ask any question - I'll analyze it and fetch exactly the right Strava data
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Messages */}
            <ScrollArea className="h-96 mb-4 pr-4">
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-gradient-to-r from-green-500 to-blue-500 text-white'
                          : 'bg-white border border-gray-200 text-gray-800'
                      }`}
                    >
                      {message.role === 'assistant' && (
                        <div className="flex items-center gap-2 mb-2">
                          <Bot className="h-4 w-4 text-green-600" />
                          <span className="text-xs font-medium text-green-600">Intelligent Coach</span>
                        </div>
                      )}
                      <div className="whitespace-pre-wrap">{message.content}</div>
                      <div className={`text-xs mt-2 ${message.role === 'user' ? 'text-green-100' : 'text-gray-500'}`}>
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-gray-200 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Bot className="h-4 w-4 text-green-600" />
                        <span className="text-xs font-medium text-green-600">Analyzing & Fetching Data...</span>
                      </div>
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Smart Prompts */}
            <div className="mb-4">
              <div className="text-sm font-medium text-gray-600 mb-2">Smart coaching questions:</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {smartPrompts.map((prompt, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="text-xs bg-gradient-to-r from-green-50 to-blue-50 border-green-200 hover:from-green-100 hover:to-blue-100 text-left justify-start"
                    onClick={() => setInput(prompt)}
                  >
                    <Zap className="h-3 w-3 mr-2 text-green-600" />
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>

            {/* Input */}
            <div className="flex space-x-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask anything about your running - I'll figure out what data to get..."
                disabled={isLoading}
                className="flex-1 border-green-200 focus:border-green-400"
              />
              <Button
                onClick={handleSendMessage}
                disabled={isLoading || !input.trim()}
                className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
              ✅ Using Claude AI backend API for intelligent coaching analysis
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 
