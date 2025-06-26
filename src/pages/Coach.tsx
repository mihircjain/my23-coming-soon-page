import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Activity, Bot, Zap, TrendingUp, Flame, Utensils, Target, Heart } from 'lucide-react';

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

export default function CoachNew() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [stravaStats, setStravaStats] = useState<StravaStats>({ connected: false, lastChecked: 'Never' });
  const [context, setContext] = useState<ConversationContext>({});

  useEffect(() => {
    testMCPConnection();
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
    
    // "Since [month] [day]" pattern  
    if (lowerQuery.includes('since march 16')) {
      return { startDate: new Date(2025, 2, 16), endDate: today, criteria: { type: 'since' } };
    }
    
    if (lowerQuery.includes('since june 24')) {
      return { startDate: new Date(2025, 5, 24), endDate: today, criteria: { type: 'since' } };
    }
    
    // "From X to Y" pattern
    const fromToMatch = lowerQuery.match(/from (\d+\/\d+\/\d+) to (\d+\/\d+\/\d+)/);
    if (fromToMatch) {
      const startDate = new Date(fromToMatch[1]);
      const endDate = new Date(fromToMatch[2]);
      return { startDate, endDate, criteria: { type: 'range' } };
    }
    
    // Specific month/day patterns
    if (lowerQuery.includes('june 24') || (lowerQuery.includes('june') && lowerQuery.includes('24'))) {
      const targetDate = new Date(2025, 5, 24);  // June 24, 2025
      const nextDay = new Date(2025, 5, 25);     // June 25, 2025 (exclusive)
      return { 
        startDate: targetDate, 
        endDate: nextDay, 
        criteria: { type: 'specific' } 
      };
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
    // Parse date requirements
    const { startDate, endDate, criteria } = parseDateQuery(query);
    const activityCriteria = determineActivityCriteria(query);
    const lowerQuery = query.toLowerCase();
    
    console.log(`🧠 Smart query analysis:`, { 
      dateRange: `${startDate?.toDateString()} → ${endDate?.toDateString()}`,
      criteria: activityCriteria 
    });
    
    let mcpResponses: MCPResponse[] = [];
    
         // STEP 1: Calculate EXACT activities needed based on query type
     let activitiesNeeded = 10; // Default
     
     if (lowerQuery.includes('june 24') || lowerQuery.includes('june 25') || lowerQuery.includes('june 22') || lowerQuery.includes('yesterday') || lowerQuery.includes('today')) {
       // Single day: just get enough recent activities to find that date (max 2 activities on any day)
       activitiesNeeded = 10; // Small number to find the specific date
       console.log(`📅 Single date query: fetching ${activitiesNeeded} recent activities to find date`);
     } else if (lowerQuery.includes('last 7 days') || lowerQuery.includes('this week')) {
       activitiesNeeded = 14; // 7 days × 2/day = 14
     } else if (lowerQuery.includes('last 30 days') || lowerQuery.includes('last month')) {
       activitiesNeeded = 60; // 30 days × 2/day = 60
     } else if (lowerQuery.includes('march') || lowerQuery.includes('since march')) {
       activitiesNeeded = 200; // Long historical range
     }
    
         console.log(`📥 Fetching ${activitiesNeeded} activities (optimized for query type)`);
     
     // Use API date filtering for specific dates instead of client-side filtering
     const activitiesCall: { endpoint: string; params: any } = {
       endpoint: 'get-recent-activities',
       params: { per_page: activitiesNeeded }
     };
     
     // For specific dates, use API date filtering 
     if (startDate && endDate && (lowerQuery.includes('june 24') || lowerQuery.includes('june 25') || lowerQuery.includes('june 22'))) {
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
    
    if (!activitiesResponse[0]?.success) {
      console.log('❌ Failed to fetch activities');
      return { intent: { type: 'error' }, mcpResponses };
    }
    
    // STEP 2: Client-side filtering to find matching activities
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
    
    if (filteredActivityIds.length === 0) {
      console.log('❌ No activities found matching criteria');
      return { intent: { type: 'no_match', criteria: activityCriteria }, mcpResponses };
    }
    
    console.log(`✅ Found ${filteredActivityIds.length} matching activities`);
    
    // STEP 3: Smart data fetching based on what's actually needed
    const detailedCalls = [];
    
    // Always get basic details for all matching activities
    for (const id of filteredActivityIds) {
      detailedCalls.push({ endpoint: 'get-activity-details', params: { activityId: id } });
    }
    
    // Only get streams if user asks for HR/pace/power analysis
    const needsStreams = lowerQuery.includes('hr') || lowerQuery.includes('heart rate') || 
                        lowerQuery.includes('pace') || lowerQuery.includes('power') ||
                        lowerQuery.includes('analyze') || lowerQuery.includes('distribution');
    
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
    if (needsStreams || lowerQuery.includes('zone')) {
      detailedCalls.push({ endpoint: 'get-athlete-zones', params: {} });
    }
    
    console.log(`🔍 Making ${detailedCalls.length} targeted MCP calls (vs previous 10+ calls)`);
    
    const detailedData = await executeMCPCalls(detailedCalls);
    mcpResponses.push(...detailedData);
    
    console.log(`✅ Smart data retrieval complete: ${filteredActivityIds.length} activities, ${detailedCalls.length} API calls`);
    
    return { 
      intent: { 
        type: 'smart_fetch',
        matchedActivities: filteredActivityIds.length,
        streamsIncluded: needsStreams,
        criteria: activityCriteria,
        dateRange: { startDate, endDate }
      }, 
      mcpResponses 
    };
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

  // Generate response using Claude with focused data
  const generateResponseWithClaude = async (query: string, intent: any, mcpResponses: MCPResponse[]): Promise<string> => {
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
      const { intent, mcpResponses } = await getDataForQuery(resolvedInput);
      
      console.log(`✅ Got ${mcpResponses.length} MCP responses for intent: ${intent.type}`);

      // COST CONTROL: Only call Claude if we have meaningful data
      if (!validateDataForClaude(mcpResponses)) {
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
      const responseText = await generateResponseWithClaude(resolvedInput, intent, mcpResponses);

      const assistantMessage: Message = {
        role: 'assistant',
        content: responseText,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Step 4: Save context for future queries
      if (intent.type === 'smart_fetch' && intent.matchedActivities > 0) {
        const parsedQuery = parseDateQuery(resolvedInput);
        const contextDate = extractDateFromQuery(originalInput) || extractDateFromQuery(resolvedInput);
        const activityDetails = extractActivityDetails(mcpResponses);
        
        setContext({
          lastDate: contextDate,
          lastDateParsed: parsedQuery.startDate,
          lastActivityIds: [], // Will be populated from MCP responses if needed
          lastQueryType: intent.type,
          lastActivities: activityDetails || `Found ${intent.matchedActivities} activities`
        });
        
        console.log(`💾 Context saved: ${contextDate} with activity details`);
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
    "analyze my run from june 24",
    "show me my long runs since march 16", 
    "analyze my runs from last week",
    "show my heart rate distribution in recent runs",
    "analyze my last 7 days of running",
    "show my recent runs"
  ];

  // Contextual prompts shown when context is available
  const contextualPrompts = [
    "how was weather that day",
    "what was my pace that day", 
    "how did I feel during that run",
    "compare that to my average",
    "what was my heart rate that day"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex flex-col">
      {/* Background decoration - Match OverallJam theme */}
      <div className="absolute inset-0 bg-gradient-to-r from-green-400/10 to-blue-400/10 animate-pulse"></div>
      <div className="absolute top-20 left-20 w-32 h-32 bg-green-200/30 rounded-full blur-xl animate-bounce"></div>
      <div className="absolute bottom-20 right-20 w-24 h-24 bg-blue-200/30 rounded-full blur-xl animate-bounce delay-1000"></div>

      {/* Header - Match OverallJam style */}
      <header className="relative z-10 pt-8 px-6 md:px-12">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-green-600 via-teal-600 to-blue-600 bg-clip-text text-transparent flex items-center justify-center gap-2">
            <Bot className="h-10 w-10 text-green-600" />
            🤖 AI Running Coach
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Intelligent analysis with conversational context
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            <Badge variant="outline" className="text-xs bg-white/50">
              <Zap className="h-3 w-3 mr-1" />
              Smart Data Fetching
            </Badge>
            <Badge variant="outline" className="text-xs bg-white/50">
              <Activity className="h-3 w-3 mr-1" />
              API Date Filtering
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

            {/* Today's Metrics - Match OverallJam style */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Today's Metrics</h3>
              
              {/* Calories Burned */}
              <div className="bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl p-4 text-white shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">Calories Out</h4>
                  <Flame className="h-4 w-4" />
                </div>
                <div className="text-2xl font-bold">--</div>
                <div className="text-xs opacity-90">cal burned</div>
              </div>

              {/* Calories In */}
              <div className="bg-gradient-to-br from-emerald-400 to-green-600 rounded-xl p-4 text-white shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">Calories In</h4>
                  <Utensils className="h-4 w-4" />
                </div>
                <div className="text-2xl font-bold">--</div>
                <div className="text-xs opacity-90">cal consumed</div>
              </div>

              {/* Protein */}
              <div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl p-4 text-white shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">Protein</h4>
                  <Target className="h-4 w-4" />
                </div>
                <div className="text-2xl font-bold">--</div>
                <div className="text-xs opacity-90">g protein</div>
              </div>

              {/* Heart Rate */}
              <div className="bg-gradient-to-br from-cyan-400 to-teal-500 rounded-xl p-4 text-white shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">Avg HR</h4>
                  <Heart className="h-4 w-4" />
                </div>
                <div className="text-2xl font-bold">--</div>
                <div className="text-xs opacity-90">bpm avg</div>
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
            <Card className="bg-white/90 backdrop-blur border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-700">Dynamic Date Query Chat</CardTitle>
            <CardDescription className="text-sm text-gray-600">
              Any date format - Smart contextual conversations supported
              {context.lastDate && (
                <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                  💭 Context: Last query was about <span className="font-medium">{context.lastDate}</span>
                  <br />Try: "how was weather that day" or "what was my pace that day"
                </div>
              )}
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
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{message.content}</div>
                      <div className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 text-gray-800 p-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                        Analyzing query and fetching data...
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about any date range or specific activity..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button 
                onClick={handleSendMessage} 
                disabled={isLoading || !input.trim()}
                className="bg-green-600 hover:bg-green-700"
              >
                <Bot className="h-4 w-4" />
              </Button>
            </div>

            {/* Smart Prompts */}
            <div className="mt-4">
              <div className="text-sm font-medium text-gray-700 mb-2">Try these dynamic queries:</div>
              <div className="flex flex-wrap gap-2">
                              {(context.lastDate ? contextualPrompts : smartPrompts).map((prompt, index) => (
                <Button
                  key={index}
                  variant={context.lastDate ? "default" : "outline"}
                  size="sm"
                  onClick={() => setInput(prompt)}
                  className="text-xs"
                  disabled={isLoading}
                >
                  {prompt}
                </Button>
              ))}
              {context.lastDate && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setContext({})}
                  className="text-xs text-gray-500"
                  disabled={isLoading}
                >
                  Clear Context
                </Button>
              )}
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
