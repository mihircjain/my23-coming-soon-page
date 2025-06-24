// Enhanced chat.js - Marathon training focused AI with dynamic data fetching

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, query, orderBy, limit, where, Timestamp, doc, getDoc } from 'firebase/firestore';
import { createRequire } from 'module';

// Use require for problematic TypeScript module
const require = createRequire(import.meta.url);
let mcpClient, setMcpAccessToken;

// Lazy load MCP client to avoid import issues
async function getMcpClient() {
  if (!mcpClient) {
    try {
      // Try different import approaches
      const mcpModule = await import('../src/lib/mcpClient.js').catch(() => null);
      if (mcpModule) {
        mcpClient = mcpModule.default || mcpModule.mcpClient || mcpModule;
        setMcpAccessToken = mcpModule.setMcpAccessToken;
      } else {
        // Fallback: use direct HTTP calls to MCP server
        console.log('⚠️ Using direct HTTP fallback for MCP client');
        mcpClient = {
          async getRecentActivities(perPage = 30) {
            const response = await fetch(`https://strava-mcp-server.onrender.com/tools/get-recent-activities?per_page=${perPage}`, {
              headers: { 'Authorization': `Bearer ${process.env.STRAVA_ACCESS_TOKEN}` }
            });
            const data = await response.json();
            if (data.isError) throw new Error(data.content[0]?.text || 'MCP Error');
            // Parse activities from text response - simplified
            return [];
          }
        };
        setMcpAccessToken = () => {}; // No-op
      }
    } catch (error) {
      console.error('❌ Failed to load MCP client:', error);
      // Create dummy client
      mcpClient = { async getRecentActivities() { return []; } };
      setMcpAccessToken = () => {};
    }
  }
  return { mcpClient, setMcpAccessToken };
}

// Initialize Firebase only if environment variables are available
let db = null;

function initializeFirebase() {
  if (db) return db;
  
  const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
  };

  if (!firebaseConfig.projectId || !firebaseConfig.apiKey) {
    console.warn('Firebase configuration incomplete - skipping Firestore integration');
    return null;
  }

  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    db = getFirestore(app);
    return db;
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    return null;
  }
}

// Rate limiting
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // Max requests per window

function isRateLimited(clientIP) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  
  if (!requestCounts.has(clientIP)) {
    requestCounts.set(clientIP, []);
  }
  
  const requests = requestCounts.get(clientIP);
  
  // Remove old requests outside the window
  const recentRequests = requests.filter(timestamp => timestamp > windowStart);
  requestCounts.set(clientIP, recentRequests);
  
  // Check if limit exceeded
  if (recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }
  
  // Add current request
  recentRequests.push(now);
  return false;
}

// Enhanced session storage for maintaining context across requests
const sessionStorage = new Map();

// Session cleanup - remove sessions older than 24 hours
function cleanupOldSessions() {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  let cleanedCount = 0;
  for (const [sessionId, sessionData] of sessionStorage.entries()) {
    if (now - sessionData.lastActivity > maxAge) {
      sessionStorage.delete(sessionId);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedCount} old sessions`);
  }
}

// Get or create session context
function getSessionContext(sessionId, userId) {
  cleanupOldSessions();
  
  if (!sessionStorage.has(sessionId)) {
    console.log(`🆕 Creating new session context for ${sessionId.slice(-8)}`);
    sessionStorage.set(sessionId, {
      userId,
      messages: [],
      createdAt: Date.now(),
      lastActivity: Date.now(),
      context: {
        userPreferences: {},
        lastDataFetch: null,
        conversationSummary: null,
        topicsDiscussed: new Set(),
        questionCount: 0
      }
    });
  } else {
    console.log(`🔄 Found existing session context for ${sessionId.slice(-8)}`);
  }
  
  const session = sessionStorage.get(sessionId);
  session.lastActivity = Date.now();
  
  return session;
}

// Update session with new messages and context
function updateSessionContext(sessionId, messages, context = {}) {
  if (sessionStorage.has(sessionId)) {
    const session = sessionStorage.get(sessionId);
    session.messages = messages.slice(-50); // Keep last 50 messages for memory efficiency
    session.lastActivity = Date.now();
    session.context = { ...session.context, ...context };
    
    console.log(`💾 Updated session ${sessionId.slice(-8)} with ${messages.length} messages`);
  }
}

// NEW: Extract time range from user query
function extractTimeRange(userQuery) {
  const query = userQuery.toLowerCase();
  const today = new Date();
  
  // Handle specific time ranges
  if (query.includes('today') || query.includes('this day')) {
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    return { days: 1, label: 'today', startDate: startOfDay };
  }
  
  if (query.includes('yesterday')) {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    return { days: 1, label: 'yesterday', startDate: yesterday };
  }
  
  if (query.includes('this week') || query.includes('past week')) {
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);
    return { days: 7, label: 'this week', startDate: weekAgo };
  }
  
  if (query.includes('last 2 weeks') || query.includes('past 2 weeks')) {
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(today.getDate() - 14);
    return { days: 14, label: 'last 2 weeks', startDate: twoWeeksAgo };
  }
  
  if (query.includes('this month') || query.includes('past month')) {
    const monthAgo = new Date(today);
    monthAgo.setDate(today.getDate() - 30);
    return { days: 30, label: 'this month', startDate: monthAgo };
  }
  
  // Check for specific number patterns
  const dayMatches = query.match(/(?:last|past)\s+(\d+)\s+days?/);
  if (dayMatches) {
    const days = parseInt(dayMatches[1]);
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - days);
    return { days, label: `last ${days} days`, startDate };
  }
  
  const weekMatches = query.match(/(?:last|past)\s+(\d+)\s+weeks?/);
  if (weekMatches) {
    const weeks = parseInt(weekMatches[1]);
    const days = weeks * 7;
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - days);
    return { days, label: `last ${weeks} weeks`, startDate };
  }
  
  // Default to 7 days if no specific range found
  const defaultStart = new Date(today);
  defaultStart.setDate(today.getDate() - 7);
  return { days: 7, label: 'last 7 days', startDate: defaultStart };
}

// NEW: Dynamic data fetching using MCP for Strava data
async function fetchDynamicData(userId, timeRange) {
  console.log(`📊 Fetching dynamic data via MCP for ${timeRange.label} (${timeRange.days} days)`);
  
  try {
    // Get MCP client (lazy loaded)
    const { mcpClient, setMcpAccessToken } = await getMcpClient();
    
    // Set access token for MCP requests
    const accessToken = process.env.STRAVA_ACCESS_TOKEN || process.env.VITE_STRAVA_ACCESS_TOKEN;
    if (accessToken) {
      setMcpAccessToken(accessToken);
    }

    // Fetch activities from MCP server instead of Firestore
    console.log('🚀 Fetching activities from MCP server...');
    const allActivities = await mcpClient.getRecentActivities(50); // Get more to filter properly
    
    if (!Array.isArray(allActivities) || allActivities.length === 0) {
      console.log('⚠️ No activities found from MCP server');
      return {
        timeRange,
        runs: [],
        activities: [],
        statistics: {
          totalRuns: 0,
          totalRunDistance: 0,
          totalRunTime: 0,
          avgRunDistance: 0,
          avgRunPace: 0,
          avgRunHeartRate: 0,
          weeklyDistance: 0,
          runsPerWeek: 0
        },
        runTypes: {
          easy: 0, tempo: 0, interval: 0, long: 0, recovery: 0, race: 0, untagged: 0
        },
        trainingQuality: {
          taggedRuns: 0,
          percentageTagged: 0,
          balanceScore: 'insufficient-data'
        }
      };
    }

    // Filter activities by time range
    const filteredActivities = allActivities.filter(activity => {
      const activityDate = new Date(activity.start_date);
      const now = new Date();
      const diffDays = Math.ceil((now.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (timeRange.offset) {
        // Handle specific time periods like "last week"
        return diffDays >= timeRange.offset && diffDays < (timeRange.offset + timeRange.days);
      } else {
        // Handle periods like "this week" or "recent"
        return diffDays >= 0 && diffDays <= timeRange.days;
      }
    });

    console.log(`📊 Filtered ${filteredActivities.length} activities from ${allActivities.length} total`);

    // Process activities data
    const activities = filteredActivities.map(activity => ({
      id: activity.id,
      name: activity.name,
      type: activity.type,
      start_date: activity.start_date,
      distance: (activity.distance || 0) / 1000, // Convert to km if needed
      duration: activity.moving_time || 0,
      moving_time: activity.moving_time || 0,
      average_heartrate: activity.average_heartrate,
      calories: activity.calories || 0,
      runType: activity.run_tag || null,
      taggedAt: null, // MCP doesn't provide tagging timestamps
      userOverride: false
    }));
    
    // Separate runs from other activities
    const runs = activities.filter(a => 
      a.type && a.type.toLowerCase().includes('run')
    );
    
    // Calculate run statistics
    const totalRunDistance = runs.reduce((sum, run) => sum + (run.distance || 0), 0);
    const totalRunTime = runs.reduce((sum, run) => sum + (run.duration || 0), 0);
    const avgRunDistance = runs.length > 0 ? totalRunDistance / runs.length : 0;
    const avgRunPace = totalRunDistance > 0 ? (totalRunTime / 60) / totalRunDistance : 0; // min/km
    
    // Analyze run types
    const runTypes = {
      easy: runs.filter(r => r.runType === 'easy').length,
      tempo: runs.filter(r => r.runType === 'tempo').length,
      interval: runs.filter(r => r.runType === 'interval' || r.runType === 'intervals').length,
      long: runs.filter(r => r.runType === 'long').length,
      recovery: runs.filter(r => r.runType === 'recovery').length,
      race: runs.filter(r => r.runType === 'race').length,
      untagged: runs.filter(r => !r.runType).length
    };
    
    // Calculate heart rate zones (running activities only)
    const runsWithHR = runs.filter(r => r.average_heartrate && r.average_heartrate > 0);
    const avgRunHeartRate = runsWithHR.length > 0 
      ? Math.round(runsWithHR.reduce((sum, r) => sum + r.average_heartrate, 0) / runsWithHR.length)
      : 0;
    
    // Analyze training load
    const weeklyDistance = timeRange.days >= 7 ? totalRunDistance / (timeRange.days / 7) : totalRunDistance;
    const runsPerWeek = timeRange.days >= 7 ? runs.length / (timeRange.days / 7) : runs.length;
    
    console.log(`📊 MCP Dynamic data summary: ${runs.length} runs, ${totalRunDistance.toFixed(1)}km total, ${runTypes.untagged} untagged`);
    
    return {
      timeRange,
      runs,
      activities,
      statistics: {
        totalRuns: runs.length,
        totalRunDistance: Math.round(totalRunDistance * 10) / 10,
        totalRunTime: Math.round(totalRunTime),
        avgRunDistance: Math.round(avgRunDistance * 10) / 10,
        avgRunPace: Math.round(avgRunPace * 10) / 10,
        avgRunHeartRate,
        weeklyDistance: Math.round(weeklyDistance * 10) / 10,
        runsPerWeek: Math.round(runsPerWeek * 10) / 10
      },
      runTypes,
      trainingQuality: {
        taggedRuns: runs.length - runTypes.untagged,
        percentageTagged: runs.length > 0 ? Math.round(((runs.length - runTypes.untagged) / runs.length) * 100) : 0,
        balanceScore: calculateTrainingBalance(runTypes)
      }
    };
    
  } catch (error) {
    console.error('❌ Error fetching dynamic data via MCP:', error);
    
    // Fallback to original Firestore method if MCP fails
    console.log('🔄 Falling back to original Firestore method...');
    
    const firestore = initializeFirebase();
    if (!firestore) return null;
    
    try {
      // Original Firestore query logic as fallback
      const stravaDataRef = collection(firestore, "strava_data");
      const stravaQuery = query(
        stravaDataRef,
        where("userId", "==", userId),
        where("start_date", ">=", timeRange.startDate.toISOString()),
        orderBy("start_date", "desc"),
        limit(100)
      );
      
      const stravaSnapshot = await getDocs(stravaQuery);
      const activities = [];
      
      stravaSnapshot.forEach(doc => {
        const activity = doc.data();
        activities.push({
          id: activity.id,
          name: activity.name,
          type: activity.type,
          start_date: activity.start_date,
          distance: activity.distance || 0,
          duration: activity.duration || 0,
          moving_time: activity.moving_time || 0,
          average_heartrate: activity.average_heartrate,
          calories: activity.calories || 0,
          runType: activity.runType || null,
          taggedAt: activity.taggedAt || null,
          userOverride: activity.userOverride || false
        });
      });
      
      // Process fallback data same as before...
      const runs = activities.filter(a => 
        a.type && a.type.toLowerCase().includes('run')
      );
      
      console.log(`📦 Fallback: Loaded ${runs.length} runs from Firestore`);
      
      // Return simplified fallback data structure
      return {
        timeRange,
        runs,
        activities,
        statistics: {
          totalRuns: runs.length,
          totalRunDistance: runs.reduce((sum, run) => sum + (run.distance || 0), 0),
          totalRunTime: runs.reduce((sum, run) => sum + (run.duration || 0), 0),
          avgRunDistance: 0,
          avgRunPace: 0,
          avgRunHeartRate: 0,
          weeklyDistance: 0,
          runsPerWeek: 0
        },
        runTypes: { easy: 0, tempo: 0, interval: 0, long: 0, recovery: 0, race: 0, untagged: runs.length },
        trainingQuality: {
          taggedRuns: 0,
          percentageTagged: 0,
          balanceScore: 'insufficient-data'
        }
      };
      
    } catch (fallbackError) {
      console.error('❌ Both MCP and Firestore fallback failed:', fallbackError);
      return null;
    }
  }
}

// NEW: Calculate training balance score
function calculateTrainingBalance(runTypes) {
  const totalTaggedRuns = runTypes.easy + runTypes.tempo + runTypes.interval + runTypes.long + runTypes.recovery + runTypes.race;
  
  if (totalTaggedRuns < 3) return 'insufficient-data';
  
  const easyPercentage = (runTypes.easy / totalTaggedRuns) * 100;
  const hardPercentage = ((runTypes.tempo + runTypes.interval + runTypes.race) / totalTaggedRuns) * 100;
  const longPercentage = (runTypes.long / totalTaggedRuns) * 100;
  
  // Ideal: 70-80% easy, 15-25% hard, 5-15% long
  if (easyPercentage >= 70 && easyPercentage <= 80 && hardPercentage >= 15 && hardPercentage <= 25) {
    return 'excellent';
  } else if (easyPercentage >= 60 && hardPercentage <= 30) {
    return 'good';
  } else if (hardPercentage > 40) {
    return 'too-hard';
  } else if (easyPercentage < 50) {
    return 'unbalanced';
  } else {
    return 'needs-improvement';
  }
}

// ENHANCED: Get comprehensive marathon training system prompt
async function getMarathonTrainingSystemPrompt(userData = null, sessionContext = null, dynamicData = null) {
  const firestore = initializeFirebase();
  
  let systemContent = '';
  
  // Check if userData contains systemContext from LetsJam v2
  if (userData && userData.systemContext) {
    console.log('✅ Using systemContext from LetsJam...');
    systemContent += userData.systemContext;
    systemContent += '\n\n';
    
    // Add session context if available
    if (sessionContext && sessionContext.conversationSummary) {
      systemContent += `=== CONVERSATION CONTEXT ===\n`;
      systemContent += `Session Age: ${Math.round(sessionContext.conversationSummary.conversationAge / (1000 * 60))} minutes\n`;
      systemContent += `Topics Previously Discussed: ${sessionContext.conversationSummary.topics.join(', ')}\n`;
      systemContent += `Message Count: ${sessionContext.conversationSummary.messageCount}\n\n`;
    }
    
    // NEW: Add dynamic data context if available
    if (dynamicData) {
      systemContent += `=== DYNAMIC TRAINING DATA (${dynamicData.timeRange.label.toUpperCase()}) ===\n`;
      systemContent += `Time Range: ${dynamicData.timeRange.label} (${dynamicData.timeRange.days} days)\n`;
      systemContent += `Total Runs: ${dynamicData.statistics.totalRuns}\n`;
      systemContent += `Total Distance: ${dynamicData.statistics.totalRunDistance}km\n`;
      systemContent += `Average Run Distance: ${dynamicData.statistics.avgRunDistance}km\n`;
      systemContent += `Average Pace: ${dynamicData.statistics.avgRunPace} min/km\n`;
      systemContent += `Average Heart Rate: ${dynamicData.statistics.avgRunHeartRate} bpm\n`;
      systemContent += `Weekly Distance: ${dynamicData.statistics.weeklyDistance}km\n`;
      systemContent += `Runs Per Week: ${dynamicData.statistics.runsPerWeek}\n\n`;
      
      systemContent += `RUN TYPE DISTRIBUTION:\n`;
      systemContent += `- Easy Runs: ${dynamicData.runTypes.easy}\n`;
      systemContent += `- Tempo Runs: ${dynamicData.runTypes.tempo}\n`;
      systemContent += `- Interval/Speed: ${dynamicData.runTypes.interval}\n`;
      systemContent += `- Long Runs: ${dynamicData.runTypes.long}\n`;
      systemContent += `- Recovery Runs: ${dynamicData.runTypes.recovery}\n`;
      systemContent += `- Race Efforts: ${dynamicData.runTypes.race}\n`;
      systemContent += `- Untagged Runs: ${dynamicData.runTypes.untagged}\n\n`;
      
      systemContent += `TRAINING QUALITY ANALYSIS:\n`;
      systemContent += `- Tagged Runs: ${dynamicData.trainingQuality.taggedRuns}/${dynamicData.statistics.totalRuns} (${dynamicData.trainingQuality.percentageTagged}%)\n`;
      systemContent += `- Training Balance: ${dynamicData.trainingQuality.balanceScore}\n\n`;
      
      if (dynamicData.runs.length > 0) {
        systemContent += `RECENT RUNS DETAIL:\n`;
        dynamicData.runs.slice(0, 10).forEach((run, index) => {
          systemContent += `${index + 1}. "${run.name}" (${run.runType || 'UNTAGGED'}) - ${new Date(run.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${run.distance.toFixed(1)}km in ${Math.round(run.duration)}min`;
          if (run.average_heartrate) systemContent += ` @ ${run.average_heartrate} bpm`;
          systemContent += '\n';
        });
        systemContent += '\n';
      }
    }
    
    // ENHANCED: Marathon training guidance system
    systemContent += `=== MARATHON TRAINING COACH INSTRUCTIONS ===\n`;
    systemContent += `YOU ARE A COMPREHENSIVE MARATHON COACH. In EVERY response around marathon questions, you MUST include:\n\n`;
    
    systemContent += `1. WEIGHT TRAINING SCHEDULE:\n`;
    
    systemContent += `2. NUTRITION TIMING:\n`;
    systemContent += `   - Pre-run (1-3 hours)\n`;
    systemContent += `   - During run: \n`;
    systemContent += `   - Post-run :\n`;
    systemContent += `   - Daily: \n`;
    systemContent += `   - Race week: \n`;
    
    systemContent += `3. RECOVERY PROTOCOLS:\n`;
    systemContent += `   - Sleep: \n`;
    systemContent += `   - Easy pace: \n`;
    systemContent += `   - Rest days: Complete rest or easy cross-training\n`;
    systemContent += `   - Listen to body: Fatigue, HR elevation, mood changes\n\n`;
    
    systemContent += `4. TRAINING PERIODIZATION:\n`;
    systemContent += `   - Base Phase \n`;
    systemContent += `   - Build Phase \n`;
    systemContent += `   - Peak Phase \n`;
    systemContent += `   - Taper (3 weeks): \n`;
    
    systemContent += `5. RUN TYPE GUIDANCE:\n`;
    systemContent += `   - Easy: 70-80% of weekly mileage, conversational\n`;
    systemContent += `   - Tempo: Comfortably hard, 15-30 min sustained\n`;
    systemContent += `   - Interval: 85-95% effort, with equal rest\n`;
    systemContent += `   - Long: Steady aerobic effort, 90-180 min\n`;
    systemContent += `   - Recovery: Very easy, shorter than easy runs\n\n`;
    
    if (dynamicData && dynamicData.runTypes.untagged > 0) {
      systemContent += `⚠️ URGENT: User has ${dynamicData.runTypes.untagged} UNTAGGED RUNS\n`;
      systemContent += `Encourage them to tag these runs for better training analysis!\n\n`;
    }
    
    if (dynamicData && dynamicData.trainingQuality.balanceScore === 'too-hard') {
      systemContent += `⚠️ TRAINING BALANCE WARNING: Too much hard running detected!\n`;
      systemContent += `Recommend more easy runs (70-80% of total volume).\n\n`;
    }
    
    systemContent += `ALWAYS use specific numbers from the user's data and provide actionable marathon training advice.\n\n`;
    
    console.log(`✅ Enhanced marathon training context created (${systemContent.length} chars)`);
    return systemContent;
  }
  
  // Fallback system prompt if no systemContext provided
  return 'You are a comprehensive marathon training coach with access to real user data. Always provide weight training schedules, nutrition timing, and recovery protocols in your responses. Use the specific data provided to give personalized marathon training insights.';
}

// Generate conversation summary for context preservation
function generateConversationSummary(messages) {
  if (messages.length < 4) return null;
  
  const recentMessages = messages.slice(-20); // Last 20 messages
  const topics = new Set();
  const userQuestions = [];
  const aiResponses = [];
  
  recentMessages.forEach(msg => {
    if (msg.role === 'user') {
      userQuestions.push(msg.content.substring(0, 150));
    } else if (msg.role === 'assistant') {
      aiResponses.push(msg.content.substring(0, 150));
    }
    
    // Extract potential topics (improved keyword matching)
    const content = msg.content.toLowerCase();
    
    // Marathon training topics
    if (content.includes('marathon') || content.includes('training plan') || content.includes('long run')) {
      topics.add('marathon-training');
    }
    
    // Run type analysis
    if (content.includes('easy run') || content.includes('tempo') || content.includes('interval') || 
        content.includes('run type') || content.includes('pace')) {
      topics.add('run-analysis');
    }
    
    // Weight training
    if (content.includes('weight') || content.includes('strength') || content.includes('squat') ||
        content.includes('deadlift') || content.includes('gym')) {
      topics.add('strength-training');
    }
    
    // Nutrition topics
    if (content.includes('nutrition') || content.includes('food') || content.includes('calories') || 
        content.includes('protein') || content.includes('carbs') || content.includes('fueling')) {
      topics.add('nutrition');
    }
    
    // Recovery and health
    if (content.includes('recovery') || content.includes('sleep') || content.includes('rest') ||
        content.includes('injury') || content.includes('fatigue')) {
      topics.add('recovery');
    }
    
    // Performance analysis
    if (content.includes('pace') || content.includes('heart rate') || content.includes('performance') ||
        content.includes('progress') || content.includes('improvement')) {
      topics.add('performance');
    }
  });
  
  return {
    topics: Array.from(topics),
    recentQuestions: userQuestions.slice(-5),
    recentResponses: aiResponses.slice(-3),
    messageCount: messages.length,
    lastInteraction: new Date().toISOString(),
    conversationAge: messages.length > 0 ? Date.now() - new Date(messages[0].timestamp).getTime() : 0
  };
}

// FIXED: Enhanced system prompt that forces AI to use the data
async function getEnhancedSystemPrompt(userData = null, sessionContext = null, dynamicData = null) {
  return await getMarathonTrainingSystemPrompt(userData, sessionContext, dynamicData);
}

// FIXED: Gemini API request function with better error handling
async function makeGeminiRequest(apiKey, messages, retryCount = 0) {
  const maxRetries = 2;
  const timeout = 45000; // 45 seconds
  
  try {
    console.log(`🚀 Making Gemini request (attempt ${retryCount + 1}/${maxRetries + 1})`);
    
    // FIXED: More specific request body that forces data usage
    const requestBody = {
      contents: messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      })),
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
        stopSequences: []
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH", 
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ]
    };

    console.log(`📤 Request body size: ${JSON.stringify(requestBody).length} characters`);
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      }
    );
    
    clearTimeout(timeoutId);
    
    console.log(`📥 Gemini response: ${response.status} ${response.statusText}`);
    
    return response;
    
  } catch (error) {
    console.error(`❌ Gemini request failed (attempt ${retryCount + 1}):`, error.message);
    
    // Retry logic for specific errors
    if (retryCount < maxRetries) {
      if (error.name === 'AbortError') {
        console.log('⏱️ Request timed out, retrying...');
      } else if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
        console.log('🌐 Network error, retrying...');
      } else {
        console.log('🔄 Retrying request...');
      }
      
      // Wait before retry (exponential backoff)
      const waitTime = Math.pow(2, retryCount) * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      return makeGeminiRequest(apiKey, messages, retryCount + 1);
    }
    
    throw error;
  }
}

// Convert Gemini response to OpenAI-compatible format
function convertGeminiResponseToOpenAI(geminiResponse) {
  if (!geminiResponse.candidates || geminiResponse.candidates.length === 0) {
    throw new Error('No response candidates from Gemini API');
  }

  const candidate = geminiResponse.candidates[0];
  
  if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
    throw new Error('Invalid response structure from Gemini API');
  }

  const content = candidate.content.parts[0].text || '';
  
  return {
    choices: [
      {
        message: {
          role: 'assistant',
          content: content
        },
        finish_reason: candidate.finishReason || 'stop'
      }
    ],
    usage: geminiResponse.usageMetadata || {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    }
  };
}

// MAIN HANDLER with ENHANCED marathon training context
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get client IP for rate limiting
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  
  // Check rate limit
  if (isRateLimited(clientIP)) {
    console.log(`Rate limit exceeded for IP: ${clientIP}`);
    return res.status(429).json({ 
      error: 'Too many requests. Please wait a moment before trying again.',
      retryAfter: 60
    });
  }

  try {
    // Validate and clean the Gemini API key
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    
    if (!apiKey) {
      console.error('❌ Gemini API key is missing');
      return res.status(500).json({ 
        error: 'Server configuration error: Gemini API key not found' 
      });
    }

    // Validate API key format (Gemini keys start with AIza)
    if (!apiKey.startsWith('AIza') || apiKey.length < 35) {
      console.error('❌ Invalid Gemini API key format');
      return res.status(500).json({ 
        error: 'Server configuration error: Invalid API key format' 
      });
    }

    // Get request data including sessionId and new flags
    const { messages, userData, userId, source, sessionId, useSystemContext } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ 
        error: 'Invalid request: messages array is required' 
      });
    }

    console.log('=== INCOMING REQUEST ===');
    console.log('Source:', source);
    console.log('User ID:', userId);
    console.log('Session ID:', sessionId?.slice(-8) || 'none');
    console.log('Messages count:', messages.length);
    console.log('Has userData:', !!userData);
    console.log('Use system context:', !!useSystemContext);

    // NEW: Extract time range from latest user message
    const latestUserMessage = messages.filter(msg => msg.role === 'user').slice(-1)[0];
    let dynamicData = null;
    
    if (latestUserMessage && userId) {
      const timeRange = extractTimeRange(latestUserMessage.content);
      console.log(`🕐 Extracted time range: ${timeRange.label} (${timeRange.days} days)`);
      
      // Fetch dynamic data based on extracted time range
      dynamicData = await fetchDynamicData(userId, timeRange);
      
      if (dynamicData) {
        console.log(`📊 Dynamic data loaded: ${dynamicData.statistics.totalRuns} runs, ${dynamicData.statistics.totalRunDistance}km total`);
      }
    }

    // Get or create session context if sessionId provided
    let sessionContext = null;
    if (sessionId) {
      sessionContext = getSessionContext(sessionId, userId);
      console.log('📚 Session context:', {
        messageCount: sessionContext.messages.length,
        topics: sessionContext.context.conversationSummary?.topics || [],
        lastActivity: new Date(sessionContext.lastActivity).toLocaleTimeString(),
        age: Math.round((Date.now() - sessionContext.createdAt) / (1000 * 60)) + ' minutes'
      });
    }

    // ENHANCED: Get marathon training system prompt with dynamic data
    console.log('🔄 Fetching enhanced marathon training system prompt...');
    const systemPromptPromise = getEnhancedSystemPrompt(userData, sessionContext?.context, dynamicData);
    const systemPromptTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('System prompt fetch timeout')), 8000);
    });
    
    let systemPrompt;
    try {
      systemPrompt = await Promise.race([systemPromptPromise, systemPromptTimeout]);
    } catch (timeoutError) {
      console.error('⏱️ System prompt fetch timed out, using fallback');
      if (userData && userData.systemContext) {
        systemPrompt = userData.systemContext + '\n\nCRITICAL: You MUST use the health data provided above. Reference specific numbers and metrics. Always include marathon training guidance: weight training, nutrition timing, and recovery protocols.';
      } else {
        systemPrompt = 'You are a comprehensive marathon training coach with access to real user health data. Always include weight training schedules, nutrition timing, and recovery protocols in your responses.';
      }
    }

    // Add dynamic data context to system prompt if available
    if (dynamicData && systemPrompt) {
      systemPrompt += `\n\n=== CURRENT QUERY CONTEXT ===\n`;
      systemPrompt += `User asked about: "${latestUserMessage.content}"\n`;
      systemPrompt += `Data fetched for: ${dynamicData.timeRange.label}\n`;
      systemPrompt += `Focus your response on this specific time period.\n\n`;
    }

    // FIXED: Handle system context from LetsJam v2 properly
    let allMessages = messages;
    if (useSystemContext && messages.length > 0 && messages[0].role === 'system') {
      // LetsJam v2 already includes system context in messages
      allMessages = messages;
      console.log('✅ Using system context from LetsJam messages');
      
      // ENHANCED: Add marathon training context to existing system message
      if (allMessages[0].role === 'system') {
        allMessages[0].content += '\n\nIMPORTANT: You are now a MARATHON TRAINING COACH. Always include weight training schedules, nutrition timing, and recovery protocols. Use the ACTUAL run data, types, and training metrics provided above.';
        
        if (dynamicData) {
          allMessages[0].content += `\n\nCURRENT QUERY FOCUS: User asked about ${dynamicData.timeRange.label}. Use this specific time period data in your response.`;
        }
      }
    } else {
      // Combine session messages with current request for full context
      if (sessionContext && sessionContext.messages.length > 0) {
        // Merge with previous session messages (keep last 20 for context)
        const previousMessages = sessionContext.messages.slice(-20);
        const latestUserMessageArray = messages.filter(msg => msg.role === 'user').slice(-1);
        allMessages = [...previousMessages, ...latestUserMessageArray];
        
        console.log(`📚 Using conversation history: ${previousMessages.length} previous + ${latestUserMessageArray.length} new = ${allMessages.length} total messages`);
      }
    }

    console.log(`=== PREPARING GEMINI REQUEST ===`);
    console.log(`Total conversation messages: ${allMessages.length}`);
    console.log(`System prompt length: ${systemPrompt.length} characters`);
    console.log(`Dynamic data included: ${!!dynamicData}`);
    
    // ENHANCED: Build full messages array with marathon training system prompt
    let fullMsgs;
    if (useSystemContext && allMessages.length > 0 && allMessages[0].role === 'system') {
      // System context already included in messages from LetsJam v2
      fullMsgs = allMessages;
    } else {
      // Add enhanced marathon training system prompt
      fullMsgs = [
        { role: 'system', content: systemPrompt },
        ...allMessages
      ];
    }

    console.log(`=== FINAL MESSAGES ARRAY ===`);
    console.log(`Total messages: ${fullMsgs.length}`);
    fullMsgs.forEach((msg, index) => {
      console.log(`Message ${index}: ${msg.role} (${msg.content?.length || 0} chars)`);
      if (msg.role === 'system') {
        console.log(`  System content preview: ${msg.content.substring(0, 200)}...`);
        if (dynamicData) {
          console.log(`  Includes dynamic data for: ${dynamicData.timeRange.label}`);
        }
      }
    });
    console.log(`=== END MESSAGES ARRAY ===`);

    // ENHANCED: Make request to Gemini API with marathon training context
    console.log('🚀 Making Gemini request with enhanced marathon training context...');
    const geminiResponse = await makeGeminiRequest(apiKey, fullMsgs);

    console.log(`=== GEMINI RESPONSE ===`);
    console.log(`Status: ${geminiResponse.status}`);

    // Enhanced error handling
    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error(`❌ Gemini API error (${geminiResponse.status}):`, errorText);
      
      // Parse error details if available
      let errorDetails = null;
      try {
        errorDetails = JSON.parse(errorText);
      } catch (e) {
        // Error text is not JSON
      }
      
      // Handle specific error codes with better messages
      switch (geminiResponse.status) {
        case 400:
          return res.status(400).json({ 
            error: 'Invalid request format - please try a simpler question',
            details: errorDetails?.error?.message || 'Bad request'
          });
        case 401:
          return res.status(500).json({ 
            error: 'Authentication failed - server configuration issue' 
          });
        case 403:
          return res.status(403).json({ 
            error: 'Access denied - API key permissions issue',
            details: errorDetails?.error?.message || 'Forbidden'
          });
        case 429:
          return res.status(429).json({ 
            error: 'AI service is busy. Please try again in a moment.',
            details: 'Rate limit exceeded - too many requests',
            retryAfter: 30
          });
        case 500:
          return res.status(500).json({ 
            error: 'AI service internal error - please try again',
            details: 'Gemini API server error'
          });
        case 503:
          return res.status(503).json({ 
            error: 'AI service temporarily unavailable - please try again in a few minutes',
            details: 'Service overloaded'
          });
        default:
          return res.status(500).json({ 
            error: `AI service error (${geminiResponse.status}) - please try again`,
            details: errorDetails?.error?.message || errorText.substring(0, 200)
          });
      }
    }

    // Parse and return the response
    const responseData = await geminiResponse.json();
    
    console.log(`=== GEMINI RESPONSE DATA ===`);
    console.log(`Response object keys:`, Object.keys(responseData));
    if (responseData.candidates && responseData.candidates[0]) {
      const responseContent = responseData.candidates[0].content?.parts?.[0]?.text;
      console.log(`Response content preview: ${responseContent?.substring(0, 300)}...`);
      console.log(`Response length: ${responseContent?.length || 0} characters`);
      console.log(`Finish reason: ${responseData.candidates[0].finishReason}`);
      
      // ENHANCED: Check if response uses marathon training concepts
      const usesMarathonGuidance = responseContent && (
        responseContent.toLowerCase().includes('weight training') ||
        responseContent.toLowerCase().includes('strength') ||
        responseContent.toLowerCase().includes('nutrition timing') ||
        responseContent.toLowerCase().includes('carb') ||
        responseContent.toLowerCase().includes('recovery') ||
        responseContent.toLowerCase().includes('easy run') ||
        responseContent.toLowerCase().includes('tempo') ||
        responseContent.toLowerCase().includes('interval')
      );
      console.log(`Response includes marathon guidance: ${usesMarathonGuidance}`);
      
      // Check if response uses real data
      const usesRealData = responseContent && (
        responseContent.includes('bpm') ||
        responseContent.includes('calories') ||
        responseContent.includes('protein') ||
        responseContent.includes('km') ||
        responseContent.includes('g ') ||
        /\d+\.\d+/.test(responseContent) ||
        /\*\*\d+/.test(responseContent)
      );
      console.log(`Response uses real data: ${usesRealData}`);
    }
    if (responseData.usageMetadata) {
      console.log(`Token usage:`, responseData.usageMetadata);
    }
    
    // Convert Gemini response format to OpenAI-compatible format
    const convertedResponse = convertGeminiResponseToOpenAI(responseData);
    const assistantContent = convertedResponse.choices[0].message.content;
    
    // Update session context with new messages if session exists
    if (sessionContext && sessionId) {
      const newUserMessage = allMessages.slice(-1)[0]; // Get the latest user message
      const assistantMessage = { 
        role: 'assistant', 
        content: assistantContent, 
        timestamp: new Date() 
      };
      
      const updatedMessages = [...allMessages, assistantMessage];
      const conversationSummary = generateConversationSummary(updatedMessages);
      
      // Enhanced user preferences based on marathon training patterns
      const userPreferences = { ...sessionContext.context.userPreferences };
      
      // Marathon training preference learning
      if (assistantContent.toLowerCase().includes('marathon') || assistantContent.toLowerCase().includes('long run')) {
        userPreferences.interestedInMarathon = true;
      }
      if (assistantContent.toLowerCase().includes('weight training') || assistantContent.toLowerCase().includes('strength')) {
        userPreferences.interestedInStrength = true;
      }
      if (assistantContent.toLowerCase().includes('nutrition timing') || assistantContent.toLowerCase().includes('carb')) {
        userPreferences.interestedInNutritionTiming = true;
      }
      if (assistantContent.toLowerCase().includes('easy run') || assistantContent.toLowerCase().includes('pace')) {
        userPreferences.interestedInRunTypes = true;
      }
      if (assistantContent.toLowerCase().includes('recovery') || assistantContent.toLowerCase().includes('sleep')) {
        userPreferences.interestedInRecovery = true;
      }
      
      updateSessionContext(sessionId, updatedMessages, {
        conversationSummary,
        userPreferences,
        lastDataFetch: new Date().toISOString(),
        questionCount: (sessionContext.context.questionCount || 0) + 1,
        lastTimeRange: dynamicData?.timeRange.label || null
      });
      
      console.log(`💾 Updated session ${sessionId.slice(-8)} with marathon training conversation data`);
      console.log(`📊 Session stats: ${updatedMessages.length} messages, ${conversationSummary?.topics?.length || 0} topics discussed`);
      
      if (dynamicData) {
        console.log(`🕐 Last query time range: ${dynamicData.timeRange.label}`);
      }
    }
    
    console.log('=== MARATHON TRAINING AI CALL SUCCESSFUL ===');
    console.log(`✅ Response delivered for session ${sessionId?.slice(-8) || 'none'}`);
    
    return res.status(200).json({
      ...convertedResponse,
      sessionId: sessionId,
      dynamicData: dynamicData ? {
        timeRange: dynamicData.timeRange.label,
        totalRuns: dynamicData.statistics.totalRuns,
        totalDistance: dynamicData.statistics.totalRunDistance,
        untaggedRuns: dynamicData.runTypes.untagged,
        trainingBalance: dynamicData.trainingQuality.balanceScore
      } : null,
      sessionInfo: sessionContext ? {
        messageCount: sessionContext.messages.length + 1, // +1 for the new message
        topics: sessionContext.context.conversationSummary?.topics || [],
        sessionAge: Math.round((Date.now() - sessionContext.createdAt) / (1000 * 60)),
        preferences: Object.keys(sessionContext.context.userPreferences || {}),
        lastTimeRange: sessionContext.context.lastTimeRange || null
      } : null
    });

  } catch (error) {
    console.error('❌ Marathon training handler error:', error);
    
    // Handle specific fetch errors with better messages
    if (error.code === 'ENOTFOUND') {
      return res.status(500).json({ 
        error: 'Network error: Could not reach AI service. Please check your internet connection.' 
      });
    }
    
    if (error.name === 'AbortError') {
      return res.status(500).json({ 
        error: 'Request timeout: AI service did not respond in time. Please try again.' 
      });
    }
    
    if (error.message && error.message.includes('fetch')) {
      return res.status(500).json({ 
        error: 'Network error: Failed to connect to AI service. Please try again.' 
      });
    }
    
    return res.status(500).json({ 
      error: 'Internal server error - please try again',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
  }
}
