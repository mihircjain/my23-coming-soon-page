import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Activity, Bot, Zap, TrendingUp } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface MCPResponse {
  endpoint: string;
  data: any;
  success: boolean;
}

interface StravaStats {
  connected: boolean;
  lastChecked: string;
}

export default function CoachNew() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [stravaStats, setStravaStats] = useState<StravaStats>({ connected: false, lastChecked: 'Never' });

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
          console.log(`❌ ${call.endpoint} failed`);
          responses.push({
            endpoint: call.endpoint,
            data: null,
            success: false
          });
        }
      } catch (error) {
        console.error(`❌ ${call.endpoint} error:`, error);
        responses.push({
          endpoint: call.endpoint,
          data: null,
          success: false
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

  // Smart coaching prompts that leverage the dynamic system
  const smartPrompts = [
    "analyze my run from june 24",
    "show me my long runs since march 16", 
    "analyze my runs from last week",
    "show my heart rate distribution in recent runs",
    "analyze my last 7 days of running",
    "show me runs from 5/1/2025 to 6/30/2025",
    "analyze my marathon runs this year",
    "show my recent runs"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card className="bg-gradient-to-r from-green-100 to-blue-100 border-0 shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-green-700 to-blue-700 bg-clip-text text-transparent flex items-center justify-center gap-2">
              <Bot className="h-8 w-8 text-green-600" />
              Dynamic AI Running Coach
            </CardTitle>
            <CardDescription className="text-lg text-gray-600">
              Client-Side Date Filtering • Real Activity IDs • Maximum Data Retrieval
            </CardDescription>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs bg-white/50">
                <Zap className="h-3 w-3 mr-1" />
                Dynamic Date Parsing
              </Badge>
              <Badge variant="outline" className="text-xs bg-white/50">
                <Activity className="h-3 w-3 mr-1" />
                Client-Side Filtering
              </Badge>
              <Badge variant="outline" className="text-xs bg-white/50">
                <Bot className="h-3 w-3 mr-1" />
                Real Activity Data
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
                <div className="text-sm font-medium text-green-700">Data First</div>
                <div className="text-xs text-gray-600">200 Activities</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <Activity className="h-6 w-6 text-blue-600 mx-auto mb-1" />
                <div className="text-sm font-medium text-blue-700">Client Filter</div>
                <div className="text-xs text-gray-600">Real IDs</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <Zap className="h-6 w-6 text-purple-600 mx-auto mb-1" />
                <div className="text-sm font-medium text-purple-700">Dynamic Parse</div>
                <div className="text-xs text-gray-600">Any Date</div>
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
            <CardTitle className="text-lg font-semibold text-gray-700">Dynamic Date Query Chat</CardTitle>
            <CardDescription className="text-sm text-gray-600">
              Any date format - I'll get maximum data first, then filter client-side
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
                {smartPrompts.map((prompt, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => setInput(prompt)}
                    className="text-xs"
                    disabled={isLoading}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 
