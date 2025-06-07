import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, query, orderBy, limit, where, Timestamp } from 'firebase/firestore';

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

async function getSystemPrompt() {
  const firestore = initializeFirebase();
  
  if (!firestore) {
    console.log('Firestore not available, using default system prompt');
    return 'You are a helpful AI assistant with access to the user\'s recent food and activity data. Please respond to the user\'s message.';
  }

  try {
    console.log('Attempting to fetch from Firestore...');
    
    // Get last 2 days of data from Firestore with timeout
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    twoDaysAgo.setHours(0, 0, 0, 0); // Start of day 2 days ago
    const twoDaysAgoTimestamp = Timestamp.fromDate(twoDaysAgo);
    
    console.log(`Fetching data from ${twoDaysAgo.toISOString()} onwards`);
    
    // Create a promise that will timeout after 3 seconds
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Firestore query timeout')), 3000);
    });
    
    // Look for food and activity collections specifically
    const targetCollections = [
      { name: 'food', types: ['meal', 'snack', 'drink', 'food'] },
      { name: 'foods', types: ['meal', 'snack', 'drink', 'food'] },
      { name: 'meals', types: ['breakfast', 'lunch', 'dinner', 'snack'] },
      { name: 'activities', types: ['exercise', 'workout', 'walk', 'activity'] },
      { name: 'workouts', types: ['exercise', 'workout', 'training', 'fitness'] },
      { name: 'events', types: ['activity', 'event', 'exercise'] }
    ];
    
    let foodData = [];
    let activityData = [];
    
    const queryPromise = (async () => {
      for (const collection_info of targetCollections) {
        try {
          console.log(`Trying collection: ${collection_info.name}`);
          
          // Try with timestamp filter first
          const timestampFields = ['timestamp', 'createdAt', 'created_at', 'date', 'dateTime'];
          
          for (const timestampField of timestampFields) {
            try {
              const q = query(
                collection(firestore, collection_info.name),
                where(timestampField, '>=', twoDaysAgoTimestamp),
                orderBy(timestampField, 'desc'),
                limit(15) // Limit per collection
              );
              
              const snapshot = await getDocs(q);
              
              if (!snapshot.empty) {
                console.log(`Found ${snapshot.size} recent documents in ${collection_info.name}`);
                
                snapshot.forEach((doc) => {
                  const data = doc.data();
                  
                  // Extract relevant data
                  const item = {
                    id: doc.id,
                    date: data[timestampField]?.toDate?.() || new Date(data[timestampField]),
                    content: data.content || data.description || data.title || data.name || data.food || data.activity,
                    type: data.type || data.category || 'unknown',
                    details: {
                      calories: data.calories,
                      duration: data.duration,
                      location: data.location,
                      quantity: data.quantity,
                      notes: data.notes
                    }
                  };
                  
                  console.log(`Found item: ${item.type} - ${item.content} at ${item.date}`);
                  
                  // Categorize into food or activity
                  if (item.content) {
                    const itemType = item.type?.toLowerCase() || '';
                    const itemContent = item.content?.toLowerCase() || '';
                    
                    if (collection_info.types.some(type => 
                      itemType.includes(type) || 
                      itemContent.includes(type) ||
                      collection_info.name.includes('food') ||
                      collection_info.name.includes('meal')
                    )) {
                      if (collection_info.name.includes('food') || collection_info.name.includes('meal') || 
                          ['meal', 'snack', 'drink', 'food'].some(t => itemType.includes(t))) {
                        foodData.push(item);
                      } else {
                        activityData.push(item);
                      }
                    }
                  }
                });
                
                if (foodData.length + activityData.length >= 20) {
                  break; // We have enough data
                }
              }
            } catch (fieldError) {
              console.log(`Field ${timestampField} not available in ${collection_info.name}`);
              continue;
            }
          }
          
          if (foodData.length + activityData.length >= 20) {
            break; // We have enough data
          }
          
        } catch (collectionError) {
          console.log(`Collection ${collection_info.name} not accessible:`, collectionError.message);
          continue;
        }
      }
      
      return { foodData, activityData };
    })();
    
    // Race between the query and timeout
    const { foodData: foods, activityData: activities } = await Promise.race([queryPromise, timeoutPromise]);
    
    console.log(`Found ${foods.length} food items and ${activities.length} activities`);
    
    // Build concise system prompt focused on food and activities
    if (foods.length > 0 || activities.length > 0) {
      // Sort by date (most recent first)
      foods.sort((a, b) => new Date(b.date) - new Date(a.date));
      activities.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      let systemContent = `You have access to the user's food and activity data from the past 2 days:\n\n`;
      
      if (foods.length > 0) {
        systemContent += `RECENT FOOD/MEALS:\n`;
        foods.slice(0, 10).forEach(food => {
          const date = new Date(food.date).toLocaleDateString();
          const time = new Date(food.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
          const details = food.details.calories ? ` (${food.details.calories} cal)` : '';
          systemContent += `${date} ${time}: ${food.content}${details}\n`;
        });
        systemContent += '\n';
      }
      
      if (activities.length > 0) {
        systemContent += `RECENT ACTIVITIES:\n`;
        activities.slice(0, 10).forEach(activity => {
          const date = new Date(activity.date).toLocaleDateString();
          const time = new Date(activity.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
          const details = activity.details.duration ? ` (${activity.details.duration})` : '';
          systemContent += `${date} ${time}: ${activity.content}${details}\n`;
        });
        systemContent += '\n';
      }
      
      systemContent += `Based on this food and activity context, answer questions about the user's recent eating habits, workouts, health patterns, and provide personalized recommendations.`;
      
      console.log(`=== BUILT SYSTEM PROMPT (${systemContent.length} characters) ===`);
      console.log(systemContent);
      console.log(`=== END SYSTEM PROMPT ===`);
      
      return systemContent;
    } else {
      console.log('No recent food or activity data found');
      return 'You are a helpful AI assistant. The user may ask about their recent food and activities, but no recent data is currently available. Please respond helpfully and suggest they check their data tracking setup.';
    }
    
  } catch (error) {
    console.error('Error fetching system prompt from Firestore:', error.message);
    
    if (error.message === 'Firestore query timeout') {
      console.error('Firestore query took too long - using fallback');
    }
    
    // Fallback system prompt
    return 'You are a helpful AI assistant. The user may ask about their recent food and activities, but there was an issue accessing their data. Please respond helpfully and suggest they try again.';
  }
}

// Simple in-memory rate limiting (use Redis in production)
const rateLimitMap = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxRequests = 10; // Max 10 requests per minute per IP
  
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

async function makeGroqRequest(apiKey, messages, retryCount = 0) {
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second
  
  try {
    const requestBody = {
      model: 'llama3-8b-8192',
      messages: messages,
      temperature: 0.7,
      max_tokens: 500,
      stream: false
    };

    console.log(`=== GROQ API REQUEST (Attempt ${retryCount + 1}) ===`);
    console.log(`URL: https://api.groq.com/openai/v1/chat/completions`);
    console.log(`Method: POST`);
    console.log(`Messages being sent: ${messages.length}`);
    console.log(`Request payload size: ${JSON.stringify(requestBody).length} bytes`);
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'Vercel-Function/1.0'
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`=== GROQ API RESPONSE (Attempt ${retryCount + 1}) ===`);
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Response headers:`, Object.fromEntries(response.headers.entries()));

    if (response.status === 429 && retryCount < maxRetries) {
      // Exponential backoff: wait longer each retry
      const delay = baseDelay * Math.pow(2, retryCount);
      console.log(`Rate limited. Retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return makeGroqRequest(apiKey, messages, retryCount + 1);
    }

    return response;
  } catch (error) {
    console.error(`=== GROQ REQUEST ERROR (Attempt ${retryCount + 1}) ===`);
    console.error(`Error type: ${error.name}`);
    console.error(`Error message: ${error.message}`);
    console.error(`Error code: ${error.code}`);
    
    if (retryCount < maxRetries && (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT')) {
      const delay = baseDelay * Math.pow(2, retryCount);
      console.log(`Network error. Retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return makeGroqRequest(apiKey, messages, retryCount + 1);
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
    // Validate and clean the Groq API key
    const apiKey = process.env.GROQ_API_KEY?.trim();
    
    if (!apiKey) {
      console.error('Groq API key is missing');
      return res.status(500).json({ 
        error: 'Server configuration error: Groq API key not found' 
      });
    }

    // Validate API key format (Groq keys start with gsk_)
    if (!apiKey.startsWith('gsk_') || apiKey.length < 40) {
      console.error('Invalid Groq API key format');
      return res.status(500).json({ 
        error: 'Server configuration error: Invalid API key format' 
      });
    }

    // Get messages from request body
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ 
        error: 'Invalid request: messages array is required' 
      });
    }

    // Get system prompt from Firestore (with timeout protection)
    console.log('Fetching system prompt from Firestore...');
    const systemPromptPromise = getSystemPrompt();
    const systemPromptTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('System prompt fetch timeout')), 5000);
    });
    
    let systemPrompt;
    try {
      systemPrompt = await Promise.race([systemPromptPromise, systemPromptTimeout]);
    } catch (timeoutError) {
      console.error('System prompt fetch timed out, using fallback');
      systemPrompt = 'You are a helpful AI assistant. The user may ask about their recent activities, but there was an issue accessing their data. Please respond helpfully.';
    }
    
    console.log(`=== PREPARING GROQ REQUEST ===`);
    console.log(`User messages count: ${messages.length}`);
    console.log(`System prompt length: ${systemPrompt.length} characters`);
    
    // Build full messages array with system prompt
    const fullMsgs = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    console.log(`=== FINAL MESSAGES ARRAY BEING SENT TO GROQ ===`);
    console.log(`Total messages: ${fullMsgs.length}`);
    fullMsgs.forEach((msg, index) => {
      console.log(`Message ${index}:`);
      console.log(`  Role: ${msg.role}`);
      console.log(`  Content length: ${msg.content?.length || 0} characters`);
      if (msg.role === 'system') {
        console.log(`  System content preview: ${msg.content.substring(0, 200)}...`);
      } else {
        console.log(`  Content: ${msg.content}`);
      }
    });
    console.log(`=== END MESSAGES ARRAY ===`);

    const requestBody = {
      model: 'llama3-8b-8192',
      messages: fullMsgs,
      temperature: 0.7,
      max_tokens: 500,
      stream: false
    };

    console.log(`=== GROQ REQUEST DETAILS ===`);
    console.log(`Model: ${requestBody.model}`);
    console.log(`Temperature: ${requestBody.temperature}`);
    console.log(`Max tokens: ${requestBody.max_tokens}`);
    console.log(`Request body size: ${JSON.stringify(requestBody).length} characters`);
    console.log(`=== SENDING TO GROQ ===`);

    // Make request to Groq API with retry logic
    const groqResponse = await makeGroqRequest(apiKey, fullMsgs);

    console.log(`=== GROQ RESPONSE ===`);
    console.log(`Status: ${groqResponse.status}`);
    console.log(`Status text: ${groqResponse.statusText}`);
    console.log(`Headers:`, Object.fromEntries(groqResponse.headers.entries()));

    // Check if response is OK
    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error(`Groq API error (${groqResponse.status}):`, errorText);
      
      // Parse error details if available
      let errorDetails = null;
      try {
        errorDetails = JSON.parse(errorText);
      } catch (e) {
        // Error text is not JSON
      }
      
      // Handle specific error codes
      switch (groqResponse.status) {
        case 401:
          return res.status(500).json({ 
            error: 'Authentication failed - check API key configuration' 
          });
        case 429:
          return res.status(429).json({ 
            error: 'Groq rate limit exceeded. Please try again in a moment.',
            details: errorDetails?.error?.message || 'Rate limit exceeded',
            retryAfter: 60
          });
        case 502:
          return res.status(502).json({ 
            error: 'Groq service temporarily unavailable - please try again' 
          });
        case 503:
          return res.status(503).json({ 
            error: 'Groq service overloaded - please try again in a few minutes' 
          });
        default:
          return res.status(500).json({ 
            error: `Groq API error: ${groqResponse.status}`,
            details: errorDetails?.error?.message || errorText
          });
      }
    }

    // Parse and return the response
    const responseData = await groqResponse.json();
    
    console.log(`=== GROQ RESPONSE DATA ===`);
    console.log(`Response object keys:`, Object.keys(responseData));
    if (responseData.choices && responseData.choices[0]) {
      console.log(`Response content: ${responseData.choices[0].message?.content?.substring(0, 200)}...`);
      console.log(`Finish reason: ${responseData.choices[0].finish_reason}`);
    }
    if (responseData.usage) {
      console.log(`Token usage:`, responseData.usage);
    }
    console.log('=== GROQ API CALL SUCCESSFUL ===');
    
    return res.status(200).json(responseData);

  } catch (error) {
    console.error('Handler error:', error);
    
    // Handle specific fetch errors
    if (error.code === 'ENOTFOUND') {
      return res.status(500).json({ 
        error: 'Network error: Could not reach Groq API' 
      });
    }
    
    if (error.name === 'AbortError') {
      return res.status(500).json({ 
        error: 'Request timeout: Groq API did not respond in time' 
      });
    }
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
