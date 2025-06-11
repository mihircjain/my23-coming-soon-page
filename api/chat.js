import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, query, orderBy, limit, where, Timestamp, doc, getDoc } from 'firebase/firestore';

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

  // Check if all required config is present
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
    
    // Nutrition topics
    if (content.includes('nutrition') || content.includes('food') || content.includes('calories') || 
        content.includes('protein') || content.includes('carbs') || content.includes('fat')) {
      topics.add('nutrition');
    }
    
    // Activity topics
    if (content.includes('workout') || content.includes('exercise') || content.includes('activity') || 
        content.includes('running') || content.includes('training') || content.includes('fitness')) {
      topics.add('activity');
    }
    
    // Health markers
    if (content.includes('blood') || content.includes('cholesterol') || content.includes('health markers') ||
        content.includes('ldl') || content.includes('hdl') || content.includes('glucose')) {
      topics.add('health-markers');
    }
    
    // Goals and recommendations
    if (content.includes('goal') || content.includes('recommend') || content.includes('improve') ||
        content.includes('target') || content.includes('plan')) {
      topics.add('goals-recommendations');
    }
    
    // Trends and analysis
    if (content.includes('trend') || content.includes('pattern') || content.includes('analyze') ||
        content.includes('compare') || content.includes('progress')) {
      topics.add('analysis-trends');
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
async function getEnhancedSystemPrompt(userData = null, sessionContext = null) {
  const firestore = initializeFirebase();
  
  let systemContent = '';
  
  // IMPORTANT: Check if userData contains systemContext from LetsJam v2
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
    
    // FIXED: More explicit instructions to use the data
    systemContent += `=== CRITICAL RESPONSE INSTRUCTIONS ===\n`;
    systemContent += `YOU MUST FOLLOW THESE RULES:\n`;
    systemContent += `1. ALWAYS use the REAL health data provided above in your responses\n`;
    systemContent += `2. NEVER say "I don't have access to your data" or similar phrases\n`;
    systemContent += `3. REFERENCE SPECIFIC numbers, dates, and metrics from the data\n`;
    systemContent += `4. If someone asks about their performance, use their ACTUAL workout data\n`;
    systemContent += `5. If someone asks about nutrition, use their ACTUAL calorie/macro data\n`;
    systemContent += `6. If someone asks about health, use their ACTUAL blood marker data\n`;
    systemContent += `7. Be specific and detailed using the real numbers provided\n`;
    systemContent += `8. Format responses naturally but use **bold** for key metrics\n`;
    systemContent += `9. Always acknowledge that you can see their real data\n`;
    systemContent += `10. Give actionable insights based on their ACTUAL data patterns\n\n`;
    
    systemContent += `EXAMPLE RESPONSE STYLE:\n`;
    systemContent += `"Looking at your recent data, I can see you ran **3.2km** yesterday with an average heart rate of **155 bpm** and burned **298 calories**. Your nutrition shows you consumed **2,240 calories** with **156g protein** - this is excellent recovery fuel for your training load."\n\n`;
    
    systemContent += `REMEMBER: You have access to REAL data. Use it. Be specific. Give numbers.\n\n`;
    
    console.log(`✅ Enhanced system context created (${systemContent.length} chars)`);
    return systemContent;
  }
  
  // Fallback system prompt if no systemContext provided
  if (!userData) {
    return 'You are a helpful AI health assistant with access to real user health data. Always use the specific data provided to give personalized insights. Never say you cannot access data - you can and should use it.';
  }
  
  // Build basic system prompt for other sources
  systemContent += `You are a personal health assistant with access to REAL health data. You MUST use this data in your responses:\n\n`;
  
  // Add basic health data structure if available
  if (userData.nutrition) {
    systemContent += `=== NUTRITION DATA (REAL) ===\n`;
    systemContent += `Daily calories: **${userData.nutrition.avgCalories}**\n`;
    systemContent += `Daily protein: **${userData.nutrition.avgProtein}g**\n`;
    systemContent += `Daily carbs: **${userData.nutrition.avgCarbs}g**\n`;
    systemContent += `Daily fat: **${userData.nutrition.avgFat}g**\n\n`;
  }
  
  if (userData.activity) {
    systemContent += `=== ACTIVITY DATA (REAL) ===\n`;
    systemContent += `Workouts per week: **${userData.activity.workoutsPerWeek}**\n`;
    systemContent += `Average heart rate: **${userData.activity.avgHeartRate} bpm**\n`;
    systemContent += `Average calories per workout: **${userData.activity.avgCaloriesBurned}**\n\n`;
  }
  
  if (userData.bloodMarkers && Object.keys(userData.bloodMarkers).length > 0) {
    systemContent += `=== BLOOD MARKERS (REAL) ===\n`;
    Object.entries(userData.bloodMarkers).forEach(([key, value]) => {
      if (key !== 'date' && value) {
        systemContent += `${key}: **${value}**\n`;
      }
    });
    systemContent += '\n';
  }
  
  systemContent += `CRITICAL: You MUST reference these specific numbers in your responses. Never say you don't have access to data.`;
  
  return systemContent;
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

// MAIN HANDLER with FIXED data processing
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
    if (userData) {
      console.log('UserData keys:', Object.keys(userData));
      if (userData.systemContext) {
        console.log('SystemContext length:', userData.systemContext.length);
        console.log('SystemContext preview:', userData.systemContext.substring(0, 300) + '...');
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

    // FIXED: Get enhanced system prompt with explicit data usage instructions
    console.log('🔄 Fetching enhanced system prompt...');
    const systemPromptPromise = getEnhancedSystemPrompt(userData, sessionContext?.context);
    const systemPromptTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('System prompt fetch timeout')), 8000);
    });
    
    let systemPrompt;
    try {
      systemPrompt = await Promise.race([systemPromptPromise, systemPromptTimeout]);
    } catch (timeoutError) {
      console.error('⏱️ System prompt fetch timed out, using fallback');
      if (userData && userData.systemContext) {
        systemPrompt = userData.systemContext + '\n\nCRITICAL: You MUST use the health data provided above. Reference specific numbers and metrics. Never say you cannot access data.';
      } else {
        systemPrompt = 'You are a helpful AI health assistant with access to real user health data. Always use the specific data provided to give personalized insights.';
      }
    }

    // FIXED: Handle system context from LetsJam v2 properly
    let allMessages = messages;
    if (useSystemContext && messages.length > 0 && messages[0].role === 'system') {
      // LetsJam v2 already includes system context in messages
      allMessages = messages;
      console.log('✅ Using system context from LetsJam messages');
      
      // FIXED: Enhance the system message to be more explicit
      if (allMessages[0].role === 'system') {
        allMessages[0].content += '\n\nIMPORTANT: You MUST use the health data provided above. When users ask questions, reference their ACTUAL numbers, dates, and metrics. Be specific and detailed using the real data.';
      }
    } else {
      // Combine session messages with current request for full context
      if (sessionContext && sessionContext.messages.length > 0) {
        // Merge with previous session messages (keep last 20 for context)
        const previousMessages = sessionContext.messages.slice(-20);
        const latestUserMessage = messages.filter(msg => msg.role === 'user').slice(-1);
        allMessages = [...previousMessages, ...latestUserMessage];
        
        console.log(`📚 Using conversation history: ${previousMessages.length} previous + ${latestUserMessage.length} new = ${allMessages.length} total messages`);
      }
    }

    console.log(`=== PREPARING GEMINI REQUEST ===`);
    console.log(`Total conversation messages: ${allMessages.length}`);
    console.log(`System prompt length: ${systemPrompt.length} characters`);
    
    // FIXED: Build full messages array with enhanced system prompt
    let fullMsgs;
    if (useSystemContext && allMessages.length > 0 && allMessages[0].role === 'system') {
      // System context already included in messages from LetsJam v2
      fullMsgs = allMessages;
    } else {
      // Add enhanced system prompt
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
      }
    });
    console.log(`=== END MESSAGES ARRAY ===`);

    // FIXED: Make request to Gemini API with enhanced prompting
    console.log('🚀 Making Gemini request with enhanced data usage instructions...');
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
      
      // FIXED: Check if response actually uses data
      const usesData = responseContent && (
        responseContent.includes('bpm') ||
        responseContent.includes('calories') ||
        responseContent.includes('protein') ||
        responseContent.includes('km') ||
        responseContent.includes('g ') ||
        /\d+\.\d+/.test(responseContent) ||
        /\*\*\d+/.test(responseContent)
      );
      console.log(`Response appears to use real data: ${usesData}`);
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
      
      // Update user preferences based on conversation patterns
      const userPreferences = { ...sessionContext.context.userPreferences };
      
      // Simple preference learning
      if (assistantContent.toLowerCase().includes('protein')) {
        userPreferences.interestedInProtein = true;
      }
      if (assistantContent.toLowerCase().includes('workout') || assistantContent.toLowerCase().includes('exercise')) {
        userPreferences.interestedInFitness = true;
      }
      if (assistantContent.toLowerCase().includes('blood') || assistantContent.toLowerCase().includes('cholesterol')) {
        userPreferences.interestedInBloodMarkers = true;
      }
      if (assistantContent.toLowerCase().includes('calorie')) {
        userPreferences.interestedInCalories = true;
      }
      
      updateSessionContext(sessionId, updatedMessages, {
        conversationSummary,
        userPreferences,
        lastDataFetch: new Date().toISOString(),
        questionCount: (sessionContext.context.questionCount || 0) + 1
      });
      
      console.log(`💾 Updated session ${sessionId.slice(-8)} with new conversation data`);
      console.log(`📊 Session stats: ${updatedMessages.length} messages, ${conversationSummary?.topics?.length || 0} topics discussed`);
    }
    
    console.log('=== GEMINI API CALL SUCCESSFUL ===');
    console.log(`✅ Response delivered for session ${sessionId?.slice(-8) || 'none'}`);
    
    return res.status(200).json({
      ...convertedResponse,
      sessionId: sessionId,
      sessionInfo: sessionContext ? {
        messageCount: sessionContext.messages.length + 1, // +1 for the new message
        topics: sessionContext.context.conversationSummary?.topics || [],
        sessionAge: Math.round((Date.now() - sessionContext.createdAt) / (1000 * 60)),
        preferences: Object.keys(sessionContext.context.userPreferences || {})
      } : null
    });

  } catch (error) {
    console.error('❌ Handler error:', error);
    
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
