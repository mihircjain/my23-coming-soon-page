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

// Enhanced session storage for maintaining context across requests
// In production, use Redis, DynamoDB, or a proper database
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

// Enhanced system prompt with session awareness and better formatting instructions
async function getEnhancedSystemPrompt(userData = null, sessionContext = null) {
  const firestore = initializeFirebase();
  
  let systemContent = '';
  
  // Add session context if available
  if (sessionContext && sessionContext.conversationSummary) {
    systemContent += `=== CONVERSATION CONTEXT ===\n`;
    systemContent += `Session Age: ${Math.round(sessionContext.conversationSummary.conversationAge / (1000 * 60))} minutes\n`;
    systemContent += `Topics Previously Discussed: ${sessionContext.conversationSummary.topics.join(', ')}\n`;
    systemContent += `Message Count: ${sessionContext.conversationSummary.messageCount}\n`;
    
    if (sessionContext.conversationSummary.recentQuestions.length > 0) {
      systemContent += `Recent Questions:\n`;
      sessionContext.conversationSummary.recentQuestions.forEach((q, i) => {
        systemContent += `  ${i + 1}. ${q}\n`;
      });
    }
    systemContent += '\n';
  }
  
  // Add user preferences from session
  if (sessionContext && sessionContext.userPreferences && Object.keys(sessionContext.userPreferences).length > 0) {
    systemContent += `=== USER PREFERENCES ===\n`;
    Object.entries(sessionContext.userPreferences).forEach(([key, value]) => {
      systemContent += `${key}: ${value}\n`;
    });
    systemContent += '\n';
  }
  
  // Use structured userData if available (from LetsJam)
  if (userData) {
    console.log('Building system prompt with structured userData...');
    
    systemContent += `You are a personal health assistant with access to comprehensive health data and conversation history:\n\n`;
    
    // Add structured nutrition data
    if (userData.nutrition) {
      systemContent += `=== NUTRITION AVERAGES (7-day) ===\n`;
      systemContent += `- Daily calories: ${userData.nutrition.avgCaloriesPerDay}\n`;
      systemContent += `- Daily protein: ${userData.nutrition.avgProteinPerDay}g\n`;
      systemContent += `- Daily carbs: ${userData.nutrition.avgCarbsPerDay}g\n`;
      systemContent += `- Daily fat: ${userData.nutrition.avgFatPerDay}g\n`;
      systemContent += `- Daily fiber: ${userData.nutrition.avgFiberPerDay}g\n\n`;
    }
    
    // Add structured activity data
    if (userData.activity) {
      systemContent += `=== ACTIVITY AVERAGES (7-day) ===\n`;
      systemContent += `- Workouts per week: ${userData.activity.workoutsPerWeek}\n`;
      systemContent += `- Average workout heart rate: ${userData.activity.avgHeartRatePerWorkout} bpm\n`;
      systemContent += `- Average calories burned per workout: ${userData.activity.avgCaloriesBurnedPerWorkout}\n`;
      systemContent += `- Average workout duration: ${userData.activity.avgWorkoutDurationMinutes} minutes\n\n`;
    }
    
    // Add structured blood markers
    if (userData.bloodMarkers && userData.bloodMarkers.values) {
      systemContent += `=== BLOOD TEST RESULTS (Latest) ===\n`;
      systemContent += `Test Date: ${userData.bloodMarkers.testDate}\n\n`;
      
      const values = userData.bloodMarkers.values;
      
      if (values.cholesterol) {
        systemContent += `Cholesterol Panel:\n`;
        systemContent += `- Total: ${values.cholesterol.total}\n`;
        systemContent += `- LDL: ${values.cholesterol.ldl}\n`;
        systemContent += `- HDL: ${values.cholesterol.hdl}\n\n`;
      }
      
      if (values.metabolic) {
        systemContent += `Metabolic Markers:\n`;
        systemContent += `- Glucose: ${values.metabolic.glucose}\n`;
        systemContent += `- HbA1C: ${values.metabolic.hba1c}\n\n`;
      }
      
      if (values.minerals) {
        systemContent += `Minerals:\n`;
        systemContent += `- Calcium: ${values.minerals.calcium}\n`;
        systemContent += `- Sodium: ${values.minerals.sodium}\n`;
        systemContent += `- Potassium: ${values.minerals.potassium}\n\n`;
      }
      
      if (values.kidneyFunction) {
        systemContent += `Kidney Function:\n`;
        systemContent += `- Creatinine: ${values.kidneyFunction.creatinine}\n\n`;
      }
      
      if (values.bloodCells) {
        systemContent += `Blood Cells:\n`;
        systemContent += `- Hemoglobin: ${values.bloodCells.hemoglobin}\n`;
        systemContent += `- RBC: ${values.bloodCells.rbc}\n`;
        systemContent += `- Platelet Count: ${values.bloodCells.plateletCount}\n\n`;
      }
      
      if (values.hormones) {
        systemContent += `Hormones:\n`;
        systemContent += `- TSH: ${values.hormones.tsh}\n\n`;
      }
    }
    
    systemContent += `=== RESPONSE FORMATTING GUIDELINES ===\n`;
    systemContent += `CRITICAL: Follow these formatting rules strictly:\n`;
    systemContent += `- Use **bold text** SPARINGLY - only for key metrics, important findings, or section headers\n`;
    systemContent += `- Write in clear, conversational paragraphs - avoid excessive bullet points\n`;
    systemContent += `- Break long responses into digestible paragraphs with natural flow\n`;
    systemContent += `- When listing items, use natural language like "Your key areas include: X, Y, and Z" rather than bullet points\n`;
    systemContent += `- Use line breaks between main ideas for better readability\n`;
    systemContent += `- Be warm, personal, and encouraging in tone\n`;
    systemContent += `- Reference previous conversation context when relevant\n`;
    systemContent += `- Provide specific, actionable insights based on the data\n`;
    systemContent += `- Keep responses focused and concise while being thorough\n\n`;
    
    systemContent += `=== IMPORTANT INSTRUCTIONS ===\n`;
    systemContent += `When answering questions about:\n`;
    systemContent += `- BLOOD MARKERS: Use ONLY the blood test results above and provide context about normal ranges\n`;
    systemContent += `- NUTRITION: Use ONLY the nutrition averages above and compare to recommended daily values\n`;
    systemContent += `- ACTIVITY/WORKOUTS: Use ONLY the activity averages above and provide fitness context\n`;
    systemContent += `- CONTEXT: Remember and build upon previous conversations in this session\n`;
    systemContent += `- PERSONALIZATION: Tailor responses to user's specific data and previous discussions\n\n`;
  }
  
  // Add recent detailed data from Firestore (if available)
  if (!firestore) {
    console.log('Firestore not available, using userData only or default prompt');
    if (!userData) {
      return 'You are a helpful AI assistant with access to conversation history. Please respond conversationally and remember our previous interactions in this session. Use clear, natural formatting with minimal bold text.';
    }
    systemContent += `Respond based on the health data provided above and our conversation history. Be conversational, remember what we've discussed, and provide actionable insights with clear, natural formatting.`;
    return systemContent;
  }

  try {
    console.log('Fetching recent detailed data from Firestore...');
    
    // Get last 10 days of detailed data
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    tenDaysAgo.setHours(0, 0, 0, 0);
    
    console.log(`Fetching detailed data from ${tenDaysAgo.toISOString()} onwards`);
    
    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Firestore query timeout')), 8000);
    });
    
    let foodData = [];
    let activityData = [];
    
    const queryPromise = (async () => {
      // Fetch recent Strava activities for detailed view
      try {
        console.log('Fetching recent activities from strava_data collection...');
        const stravaRef = collection(firestore, 'strava_data');
        const stravaQuery = query(
          stravaRef,
          where('userId', '==', 'mihir_jain'),
          where('start_date', '>=', tenDaysAgo.toISOString()),
          orderBy('start_date', 'desc'),
          limit(15)
        );
        
        const stravaSnapshot = await getDocs(stravaQuery);
        console.log(`Found ${stravaSnapshot.size} recent Strava activities`);
        
        stravaSnapshot.forEach(doc => {
          const data = doc.data();
          
          console.log(`Activity: ${data.name} on ${data.start_date} - ${data.distance}km - ${data.caloriesBurned}cal`);
          
          const activity = {
            id: doc.id,
            date: new Date(data.start_date),
            content: data.name || 'Workout',
            type: data.type || 'activity',
            details: {
              duration: data.duration || (data.moving_time ? Math.round(data.moving_time / 60) : null),
              distance: data.distance ? data.distance.toFixed(2) + ' km' : null,
              calories: data.caloriesBurned || data.calories,
              heartRate: data.heart_rate || data.average_heartrate,
              elevationGain: data.elevation_gain
            }
          };
          
          activityData.push(activity);
        });
      } catch (stravaError) {
        console.log('Error fetching Strava data:', stravaError.message);
      }
      
      // Fetch recent nutrition data for detailed view
      try {
        console.log('Fetching recent nutrition data...');
        
        // Get date strings for last 5 days
        const dates = [];
        for (let i = 0; i < 5; i++) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          dates.push(date.toISOString().split('T')[0]);
        }
        
        console.log('Looking for recent nutrition dates:', dates);
        
        for (const dateStr of dates) {
          try {
            const nutritionRef = doc(firestore, 'nutritionLogs', dateStr);
            const nutritionDoc = await getDoc(nutritionRef);
            
            if (nutritionDoc.exists()) {
              const data = nutritionDoc.data();
              
              if (data.totals) {
                const totals = data.totals;
                
                const nutritionDay = {
                  date: new Date(dateStr),
                  totals: {
                    calories: Math.round(totals.calories || 0),
                    protein: Math.round((totals.protein || 0) * 10) / 10,
                    fat: Math.round((totals.fat || 0) * 10) / 10,
                    carbs: Math.round((totals.carbs || 0) * 10) / 10,
                    fiber: Math.round((totals.fiber || 0) * 10) / 10
                  }
                };
                
                console.log(`✅ Added recent nutrition: ${dateStr} = ${nutritionDay.totals.calories} cal`);
                foodData.push(nutritionDay);
              }
            }
          } catch (error) {
            console.log(`Error fetching ${dateStr}:`, error.message);
          }
        }
      } catch (nutritionError) {
        console.log('Error fetching nutrition data:', nutritionError.message);
      }
      
      return { foodData, activityData };
    })();
    
    // Race between query and timeout
    const { foodData: foods, activityData: activities } = await Promise.race([queryPromise, timeoutPromise]);
    
    console.log(`Successfully fetched ${foods.length} recent nutrition days and ${activities.length} recent activities`);
    
    // Add recent detailed data to system prompt
    if (foods.length > 0 || activities.length > 0) {
      systemContent += `=== RECENT DETAILED DATA (Last 10 days) ===\n\n`;
      
      if (activities.length > 0) {
        systemContent += `RECENT ACTIVITIES:\n`;
        activities.slice(0, 10).forEach(activity => {
          const date = activity.date.toLocaleDateString();
          const time = activity.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
          const duration = activity.details.duration ? ` (${activity.details.duration} min)` : '';
          const distance = activity.details.distance ? ` - ${activity.details.distance}` : '';
          const calories = activity.details.calories ? ` - ${activity.details.calories} cal` : '';
          const heartRate = activity.details.heartRate ? ` - HR: ${activity.details.heartRate} bpm` : '';
          systemContent += `${date} ${time}: ${activity.content}${duration}${distance}${calories}${heartRate}\n`;
        });
        systemContent += '\n';
      }
      
      if (foods.length > 0) {
        systemContent += `RECENT NUTRITION (Daily totals):\n`;
        foods.sort((a, b) => new Date(b.date) - new Date(a.date));
        foods.forEach(nutritionDay => {
          if (nutritionDay.totals) {
            const date = nutritionDay.date.toLocaleDateString();
            const totals = nutritionDay.totals;
            systemContent += `${date}: ${totals.calories} cal | ${totals.protein}g protein | ${totals.fat}g fat | ${totals.carbs}g carbs | ${totals.fiber}g fiber\n`;
          }
        });
        systemContent += '\n';
      }
    }
    
    systemContent += `Based on both the 7-day averages and recent detailed data above, along with our conversation history, provide personalized insights. When asked about blood markers, reference ONLY the blood test results. When asked about recent activities or food, you can reference both the averages and specific recent entries. Use natural, conversational formatting with minimal bold text. Remember and build upon previous discussions in this session.`;
    
    console.log(`=== BUILT ENHANCED SYSTEM PROMPT WITH SESSION CONTEXT (${systemContent.length} characters) ===`);
    console.log(systemContent.substring(0, 500) + '...');
    console.log(`=== END SYSTEM PROMPT ===`);
    
    return systemContent;
    
  } catch (error) {
    console.error('Error fetching detailed data from Firestore:', error.message);
    if (userData) {
      systemContent += `Respond based on the health data provided above and our conversation history. There was an issue accessing recent detailed activity data, but the averages above are still available. Use natural formatting and remember our previous discussions.`;
      return systemContent;
    }
    return 'You are a helpful AI assistant. There was an issue accessing health data, but please continue our conversation based on what we\'ve discussed before. Use clear, natural formatting.';
  }
}

// Simple in-memory rate limiting (use Redis in production)
const rateLimitMap = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxRequests = 15; // Max 15 requests per minute per IP (increased for better UX)
  
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return false;
  }
  
  const limit = rateLimitMap.get(ip);
  
  if (now > limit.resetTime) {
    limit.count = 1;
    limit.resetTime = now + windowMs;
    return false;
  }
  
  if (limit.count >= maxRequests) {
    return true;
  }
  
  limit.count++;
  return false;
}

// Convert OpenAI-style messages to Gemini format
function convertMessagesToGeminiFormat(messages) {
  const contents = [];
  let systemMessage = null;
  
  for (const message of messages) {
    if (message.role === 'system') {
      systemMessage = message.content;
      continue;
    }
    
    let role;
    if (message.role === 'user') {
      role = 'user';
    } else if (message.role === 'assistant') {
      role = 'model';
    } else {
      continue; // Skip unknown roles
    }
    
    contents.push({
      role: role,
      parts: [{ text: message.content }]
    });
  }
  
  // Handle system message by prepending it to the first user message
  if (systemMessage && contents.length > 0 && contents[0].role === 'user') {
    contents[0].parts[0].text = systemMessage + '\n\nUser: ' + contents[0].parts[0].text;
  } else if (systemMessage && contents.length === 0) {
    // If no user messages, create one with just the system prompt
    contents.push({
      role: 'user',
      parts: [{ text: systemMessage }]
    });
  }
  
  return contents;
}

// Convert Gemini response to OpenAI format
function convertGeminiResponseToOpenAI(geminiResponse) {
  const content = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const finishReason = geminiResponse.candidates?.[0]?.finishReason || 'STOP';
  
  // Map Gemini finish reasons to OpenAI format
  let mappedFinishReason = 'stop';
  switch (finishReason) {
    case 'STOP':
      mappedFinishReason = 'stop';
      break;
    case 'MAX_TOKENS':
      mappedFinishReason = 'length';
      break;
    case 'SAFETY':
      mappedFinishReason = 'content_filter';
      break;
    case 'RECITATION':
      mappedFinishReason = 'content_filter';
      break;
    default:
      mappedFinishReason = 'stop';
  }
  
  return {
    choices: [
      {
        message: {
          role: 'assistant',
          content: content
        },
        finish_reason: mappedFinishReason
      }
    ],
    usage: {
      prompt_tokens: geminiResponse.usageMetadata?.promptTokenCount || 0,
      completion_tokens: geminiResponse.usageMetadata?.candidatesTokenCount || 0,
      total_tokens: geminiResponse.usageMetadata?.totalTokenCount || 0
    }
  };
}

async function makeGeminiRequest(apiKey, messages, retryCount = 0) {
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second
  
  try {
    // Convert messages to Gemini format
    const contents = convertMessagesToGeminiFormat(messages);
    
    const requestBody = {
      contents: contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 800, // Increased for more detailed responses
        topP: 0.8,
        topK: 40
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_ONLY_HIGH"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_ONLY_HIGH"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_ONLY_HIGH"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_ONLY_HIGH"
        }
      ]
    };

    console.log(`=== GEMINI API REQUEST (Attempt ${retryCount + 1}) ===`);
    console.log(`Contents being sent: ${contents.length}`);
    console.log(`Request payload size: ${JSON.stringify(requestBody).length} bytes`);
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Vercel-Function/1.0'
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`=== GEMINI API RESPONSE (Attempt ${retryCount + 1}) ===`);
    console.log(`Status: ${response.status} ${response.statusText}`);

    if (response.status === 429 && retryCount < maxRetries) {
      const delay = baseDelay * Math.pow(2, retryCount);
      console.log(`Rate limited. Retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return makeGeminiRequest(apiKey, messages, retryCount + 1);
    }

    return response;
  } catch (error) {
    console.error(`=== GEMINI REQUEST ERROR (Attempt ${retryCount + 1}) ===`);
    console.error(`Error type: ${error.name}`);
    console.error(`Error message: ${error.message}`);
    
    if (retryCount < maxRetries && (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT')) {
      const delay = baseDelay * Math.pow(2, retryCount);
      console.log(`Network error. Retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return makeGeminiRequest(apiKey, messages, retryCount + 1);
    }
    throw error;
  }
}

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
      console.error('Gemini API key is missing');
      return res.status(500).json({ 
        error: 'Server configuration error: Gemini API key not found' 
      });
    }

    // Validate API key format (Gemini keys start with AIza)
    if (!apiKey.startsWith('AIza') || apiKey.length < 35) {
      console.error('Invalid Gemini API key format');
      return res.status(500).json({ 
        error: 'Server configuration error: Invalid API key format' 
      });
    }

    // Get request data including sessionId
    const { messages, userData, userId, source, sessionId } = req.body;
    
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
    if (userData) {
      console.log('UserData keys:', Object.keys(userData));
    }

    // Get or create session context if sessionId provided
    let sessionContext = null;
    if (sessionId) {
      sessionContext = getSessionContext(sessionId, userId);
      console.log('Session context:', {
        messageCount: sessionContext.messages.length,
        topics: sessionContext.context.conversationSummary?.topics || [],
        lastActivity: new Date(sessionContext.lastActivity).toLocaleTimeString(),
        age: Math.round((Date.now() - sessionContext.createdAt) / (1000 * 60)) + ' minutes'
      });
    }

    // Get enhanced system prompt with session context
    console.log('Fetching enhanced system prompt with session context...');
    const systemPromptPromise = getEnhancedSystemPrompt(userData, sessionContext?.context);
    const systemPromptTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('System prompt fetch timeout')), 12000); // Increased timeout
    });
    
    let systemPrompt;
    try {
      systemPrompt = await Promise.race([systemPromptPromise, systemPromptTimeout]);
    } catch (timeoutError) {
      console.error('System prompt fetch timed out, using fallback');
      if (userData) {
        systemPrompt = `You are a helpful health assistant with access to the user's health data. The user has provided health information, but there was an issue accessing detailed recent data. Use the available information and respond helpfully with natural formatting. Remember our conversation history when possible.`;
      } else {
        systemPrompt = 'You are a helpful AI assistant. The user may ask about their health data, but there was an issue accessing their information. Please respond helpfully and use natural, conversational formatting with minimal bold text.';
      }
    }

    // Combine session messages with current request for full context
    let allMessages = messages;
    if (sessionContext && sessionContext.messages.length > 0) {
      // Merge with previous session messages (keep last 30 for context, but not too many for API limits)
      const previousMessages = sessionContext.messages.slice(-30);
      // Only add the latest user message from the current request to avoid duplication
      const latestUserMessage = messages.filter(msg => msg.role === 'user').slice(-1);
      allMessages = [...previousMessages, ...latestUserMessage];
      
      console.log(`📚 Using conversation history: ${previousMessages.length} previous + ${latestUserMessage.length} new = ${allMessages.length} total messages`);
    }

    console.log(`=== PREPARING GEMINI REQUEST WITH SESSION CONTEXT ===`);
    console.log(`Total conversation messages: ${allMessages.length}`);
    console.log(`System prompt length: ${systemPrompt.length} characters`);
    
    // Build full messages array
    const fullMsgs = [
      { role: 'system', content: systemPrompt },
      ...allMessages
    ];

    console.log(`=== FINAL MESSAGES ARRAY BEING SENT TO GEMINI ===`);
    console.log(`Total messages: ${fullMsgs.length}`);
    fullMsgs.forEach((msg, index) => {
      console.log(`Message ${index}:`);
      console.log(`  Role: ${msg.role}`);
      console.log(`  Content length: ${msg.content?.length || 0} characters`);
      if (msg.role === 'system') {
        console.log(`  System content preview: ${msg.content.substring(0, 200)}...`);
      } else if (msg.content) {
        console.log(`  Content preview: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
      }
    });
    console.log(`=== END MESSAGES ARRAY ===`);

    // Make request to Gemini API with retry logic
    const geminiResponse = await makeGeminiRequest(apiKey, fullMsgs);

    console.log(`=== GEMINI RESPONSE ===`);
    console.log(`Status: ${geminiResponse.status}`);

    // Check if response is OK
    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error(`Gemini API error (${geminiResponse.status}):`, errorText);
      
      // Parse error details if available
      let errorDetails = null;
      try {
        errorDetails = JSON.parse(errorText);
      } catch (e) {
        // Error text is not JSON
      }
      
      // Handle specific error codes
      switch (geminiResponse.status) {
        case 400:
          return res.status(400).json({ 
            error: 'Bad request - check message format',
            details: errorDetails?.error?.message || 'Invalid request format'
          });
        case 401:
          return res.status(500).json({ 
            error: 'Authentication failed - check API key configuration' 
          });
        case 403:
          return res.status(403).json({ 
            error: 'Access denied - check API key permissions',
            details: errorDetails?.error?.message || 'Forbidden'
          });
        case 429:
          return res.status(429).json({ 
            error: 'AI service is busy. Please try again in a moment.',
            details: errorDetails?.error?.message || 'Rate limit exceeded',
            retryAfter: 30
          });
        case 500:
          return res.status(500).json({ 
            error: 'AI service internal error - please try again' 
          });
        case 503:
          return res.status(503).json({ 
            error: 'AI service overloaded - please try again in a few minutes' 
          });
        default:
          return res.status(500).json({ 
            error: `AI service error: ${geminiResponse.status}`,
            details: errorDetails?.error?.message || errorText
          });
      }
    }

    // Parse and return the response
    const responseData = await geminiResponse.json();
    
    console.log(`=== GEMINI RESPONSE DATA ===`);
    console.log(`Response object keys:`, Object.keys(responseData));
    if (responseData.candidates && responseData.candidates[0]) {
      const responseContent = responseData.candidates[0].content?.parts?.[0]?.text;
      console.log(`Response content preview: ${responseContent?.substring(0, 200)}...`);
      console.log(`Response length: ${responseContent?.length || 0} characters`);
      console.log(`Finish reason: ${responseData.candidates[0].finishReason}`);
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
      
      // Simple preference learning - could be enhanced
      if (assistantContent.toLowerCase().includes('protein')) {
        userPreferences.interestedInProtein = true;
      }
      if (assistantContent.toLowerCase().includes('workout') || assistantContent.toLowerCase().includes('exercise')) {
        userPreferences.interestedInFitness = true;
      }
      if (assistantContent.toLowerCase().includes('blood') || assistantContent.toLowerCase().includes('cholesterol')) {
        userPreferences.interestedInBloodMarkers = true;
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
    
    console.log('=== GEMINI API CALL SUCCESSFUL WITH SESSION CONTEXT ===');
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
    console.error('Handler error:', error);
    
    // Handle specific fetch errors
    if (error.code === 'ENOTFOUND') {
      return res.status(500).json({ 
        error: 'Network error: Could not reach AI service' 
      });
    }
    
    if (error.name === 'AbortError') {
      return res.status(500).json({ 
        error: 'Request timeout: AI service did not respond in time' 
      });
    }
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
  }
}
