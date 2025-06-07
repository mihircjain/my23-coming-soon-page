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

async function getSystemPrompt() {
  const firestore = initializeFirebase();
  
  if (!firestore) {
    console.log('Firestore not available, using default system prompt');
    return 'You are a helpful AI assistant with access to the user\'s recent food and activity data. Please respond to the user\'s message.';
  }

  try {
    console.log('Attempting to fetch from Firestore...');
    
    // Get last 10 days of data
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    tenDaysAgo.setHours(0, 0, 0, 0);
    
    console.log(`Fetching data from ${tenDaysAgo.toISOString()} onwards`);
    
    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Firestore query timeout')), 8000); // Increased timeout for more data
    });
    
    let foodData = [];
    let activityData = [];
    
    const queryPromise = (async () => {
      // Fetch Strava activities from last 7 days
      try {
        console.log('Fetching from strava_data collection...');
        const stravaRef = collection(firestore, 'strava_data');
        const stravaQuery = query(
          stravaRef,
          where('userId', '==', 'mihir_jain'),
          where('start_date', '>=', tenDaysAgo.toISOString()),
          orderBy('start_date', 'desc'),
          limit(30)
        );
        
        const stravaSnapshot = await getDocs(stravaQuery);
        console.log(`Found ${stravaSnapshot.size} Strava activities`);
        
        stravaSnapshot.forEach(doc => {
          const data = doc.data();
          
          // Debug: Log all fields to see what's available
          console.log(`=== RAW STRAVA DOCUMENT ===`);
          console.log(`Document ID: ${doc.id}`);
          console.log(`Raw start_date:`, data.start_date);
          console.log(`Parsed date:`, new Date(data.start_date));
          console.log(`Today is:`, new Date());
          console.log(`10 days ago cutoff:`, tenDaysAgo);
          console.log(`Raw distance value:`, data.distance, typeof data.distance);
          console.log(`Raw duration value:`, data.duration, typeof data.duration);
          console.log(`Raw calories value:`, data.caloriesBurned, typeof data.caloriesBurned);
          console.log(`Raw name:`, data.name);
          
          // Check if this activity is actually within our date range
          const activityDate = new Date(data.start_date);
          const isWithinRange = activityDate >= tenDaysAgo;
          console.log(`Activity date: ${activityDate.toISOString()}`);
          console.log(`Is within range (>= ${tenDaysAgo.toISOString()}): ${isWithinRange}`);
          
          // Convert distance properly
          let distanceKm = null;
          if (data.distance !== undefined && data.distance !== null) {
            // Your distance appears to be in km already based on the values (2.4181)
            distanceKm = data.distance.toFixed(2) + ' km';
            console.log(`Distance processed: ${data.distance} -> ${distanceKm}`);
          }
          
          const activity = {
            id: doc.id,
            date: activityDate,
            content: data.name || 'Workout',
            type: data.type || 'activity',
            details: {
              duration: data.duration || (data.moving_time ? Math.round(data.moving_time / 60) : null),
              distance: distanceKm,
              calories: data.caloriesBurned || data.calories,
              heartRate: data.heart_rate || data.average_heartrate,
              elevationGain: data.elevation_gain
            }
          };
          
          console.log(`=== PROCESSED ACTIVITY ===`);
          console.log(`Final activity:`, {
            name: activity.content,
            date: activity.date.toDateString(),
            distance: activity.details.distance,
            duration: activity.details.duration,
            calories: activity.details.calories,
            heartRate: activity.details.heartRate
          });
          console.log(`=== END ACTIVITY DEBUG ===`);
          
          activityData.push(activity);
        });
      } catch (stravaError) {
        console.log('Error fetching Strava data:', stravaError.message);
      }
      
      // Fetch nutrition data from last 7 days
      try {
        console.log('Fetching from nutritionLogs collection...');
        
        // Get date strings for last 10 days
        const dates = [];
        for (let i = 0; i < 10; i++) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          dates.push(date.toISOString().split('T')[0]); // YYYY-MM-DD format
        }
        
        console.log('Looking for nutrition dates:', dates);
        
        for (const dateStr of dates) {
          try {
            const nutritionRef = doc(firestore, 'nutritionLogs', dateStr);
            const nutritionDoc = await getDoc(nutritionRef);
            
            if (nutritionDoc.exists()) {
              const data = nutritionDoc.data();
              console.log(`Found nutrition data for ${dateStr}:`, Object.keys(data));
              console.log(`Raw nutrition document for ${dateStr}:`, data);
              
              // Check if there are entries (array of food items)
              if (data.entries && Array.isArray(data.entries)) {
                console.log(`Processing ${data.entries.length} food entries for ${dateStr}`);
                
                data.entries.forEach((entry, index) => {
                  console.log(`Processing entry ${index}:`, entry);
                  
                  const foodItem = {
                    id: `${dateStr}-${index}`,
                    date: new Date(dateStr + 'T12:00:00'), // Add time to avoid timezone issues
                    content: entry.foodId || entry.name || 'Food item',
                    type: 'food',
                    details: {
                      quantity: entry.quantity,
                      calories: entry.calories,
                      protein: entry.protein,
                      carbs: entry.carbs,
                      fat: entry.fat,
                      fiber: entry.fiber
                    }
                  };
                  
                  console.log(`Created food item: ${foodItem.content} for ${foodItem.date.toDateString()}`);
                  foodData.push(foodItem);
                });
              } else {
                console.log(`No entries array found for ${dateStr}`);
              }
              
              // Also log daily totals if available
              if (data.totals) {
                console.log(`Daily totals for ${dateStr}:`, data.totals);
              } else {
                console.log(`No totals found for ${dateStr}`);
              }
            } else {
              console.log(`No nutrition document found for ${dateStr}`);
            }
          } catch (dateError) {
            console.log(`Error fetching nutrition for ${dateStr}:`, dateError.message);
          }
        }
      } catch (nutritionError) {
        console.log('Error fetching nutrition data:', nutritionError.message);
      }
      
      return { foodData, activityData };
    })();
    
    // Race between query and timeout
    const { foodData: foods, activityData: activities } = await Promise.race([queryPromise, timeoutPromise]);
    
    console.log(`Successfully fetched ${foods.length} food items and ${activities.length} activities`);
    
    // Build system prompt with actual data
    if (foods.length > 0 || activities.length > 0) {
      let systemContent = `You have access to the user's actual food and activity data from the past 10 days:\n\n`;
      
      if (activities.length > 0) {
        systemContent += `RECENT ACTIVITIES (Last 10 days):\n`;
        activities.slice(0, 20).forEach(activity => { // Show more activities
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
        // Group foods by day for better organization
        const foodsByDay = {};
        foods.forEach(food => {
          const dateKey = food.date.toDateString();
          if (!foodsByDay[dateKey]) {
            foodsByDay[dateKey] = [];
          }
          foodsByDay[dateKey].push(food);
        });
        
        systemContent += `RECENT FOOD/MEALS (Last 10 days):\n`;
        Object.entries(foodsByDay)
          .sort(([a], [b]) => new Date(b) - new Date(a)) // Sort by date descending
          .slice(0, 8) // Show last 8 days with food data
          .forEach(([dateKey, dayFoods]) => {
            systemContent += `\n${dateKey}:\n`;
            dayFoods.slice(0, 8).forEach(food => { // Limit to 8 items per day
              const quantity = food.details.quantity ? ` (${food.details.quantity})` : '';
              systemContent += `  - ${food.content}${quantity}\n`;
            });
          });
        systemContent += '\n';
      }
      
      systemContent += `Based on this actual food and activity data, answer questions about the user's recent eating habits, workouts, runs, health patterns, and provide personalized insights. Be specific and reference the actual data when possible. When discussing distances, use the correct values (distance is stored in meters in raw data but should be converted to km for display).`;
      
      console.log(`=== BUILT SYSTEM PROMPT WITH REAL DATA (${systemContent.length} characters) ===`);
      console.log(systemContent);
      console.log(`=== END SYSTEM PROMPT ===`);
      
      return systemContent;
    } else {
      console.log('No recent food or activity data found in Firestore');
      return 'You are a helpful AI assistant. The user asked about their recent food and activities, but no recent data was found in the system for the past 10 days. Please let them know that no recent data is available and suggest they check their data tracking.';
    }
    
  } catch (error) {
    console.error('Error fetching system prompt from Firestore:', error.message);
    return 'You are a helpful AI assistant. There was an issue accessing the user\'s recent food and activity data. Please respond helpfully and suggest they try again.';
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
