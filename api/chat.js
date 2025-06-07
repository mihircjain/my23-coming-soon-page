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

// UPDATED: Enhanced system prompt that incorporates both Firestore data AND structured userData
async function getSystemPrompt(userData = null) {
  const firestore = initializeFirebase();
  
  let systemContent = '';
  
  // SECTION 1: Use structured userData if available (from LetsJam)
  if (userData) {
    console.log('Building system prompt with structured userData...');
    
    systemContent += `You are a personal health assistant with access to comprehensive health data:\n\n`;
    
    // Add structured nutrition data
    if (userData.nutrition) {
      systemContent += `=== NUTRITION AVERAGES (30-day) ===\n`;
      systemContent += `- Daily calories: ${userData.nutrition.avgCaloriesPerDay}\n`;
      systemContent += `- Daily protein: ${userData.nutrition.avgProteinPerDay}g\n`;
      systemContent += `- Daily carbs: ${userData.nutrition.avgCarbsPerDay}g\n`;
      systemContent += `- Daily fat: ${userData.nutrition.avgFatPerDay}g\n`;
      systemContent += `- Daily fiber: ${userData.nutrition.avgFiberPerDay}g\n\n`;
    }
    
    // Add structured activity data
    if (userData.activity) {
      systemContent += `=== ACTIVITY AVERAGES (30-day) ===\n`;
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
    
    systemContent += `=== IMPORTANT INSTRUCTIONS ===\n`;
    systemContent += `When answering questions about:\n`;
    systemContent += `- BLOOD MARKERS (calcium, cholesterol, glucose, etc.): Use ONLY the blood test results above\n`;
    systemContent += `- NUTRITION (calories, protein, etc.): Use ONLY the nutrition averages above\n`;
    systemContent += `- ACTIVITY/WORKOUTS (heart rate, exercise, etc.): Use ONLY the activity averages above\n`;
    systemContent += `- Be specific about values and provide context about normal ranges when relevant\n\n`;
  }
  
  // SECTION 2: Add recent detailed activity/food data from Firestore (if available)
  if (!firestore) {
    console.log('Firestore not available, using userData only or default prompt');
    if (!userData) {
      return 'You are a helpful AI assistant with access to the user\'s recent food and activity data. Please respond to the user\'s message.';
    }
    systemContent += `Respond based on the health data provided above. Be conversational and provide actionable insights.`;
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
    
    systemContent += `Based on both the 30-day averages and recent detailed data above, provide personalized insights. When asked about blood markers, reference ONLY the blood test results. When asked about recent activities or food, you can reference both the averages and specific recent entries. Be conversational and specific.`;
    
    console.log(`=== BUILT ENHANCED SYSTEM PROMPT WITH BOTH STRUCTURED + DETAILED DATA (${systemContent.length} characters) ===`);
    console.log(systemContent.substring(0, 500) + '...');
    console.log(`=== END SYSTEM PROMPT ===`);
    
    return systemContent;
    
  } catch (error) {
    console.error('Error fetching detailed data from Firestore:', error.message);
    if (userData) {
      systemContent += `Respond based on the health data provided above. There was an issue accessing recent detailed activity data, but the averages above are still available.`;
      return systemContent;
    }
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

    if (response.status === 429 && retryCount < maxRetries) {
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

    // UPDATED: Get both messages and userData from request body
    const { messages, userData, userId, source } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ 
        error: 'Invalid request: messages array is required' 
      });
    }

    console.log('=== INCOMING REQUEST ===');
    console.log('Source:', source);
    console.log('User ID:', userId);
    console.log('Messages count:', messages.length);
    console.log('Has userData:', !!userData);
    if (userData) {
      console.log('UserData keys:', Object.keys(userData));
    }

    // UPDATED: Get enhanced system prompt with both structured userData and Firestore data
    console.log('Fetching enhanced system prompt...');
    const systemPromptPromise = getSystemPrompt(userData);
    const systemPromptTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('System prompt fetch timeout')), 10000); // Increased timeout
    });
    
    let systemPrompt;
    try {
      systemPrompt = await Promise.race([systemPromptPromise, systemPromptTimeout]);
    } catch (timeoutError) {
      console.error('System prompt fetch timed out, using fallback');
      if (userData) {
        systemPrompt = `You are a helpful health assistant. The user has provided some health data, but there was an issue accessing detailed recent data. Use the information available and respond helpfully.`;
      } else {
        systemPrompt = 'You are a helpful AI assistant. The user may ask about their recent activities, but there was an issue accessing their data. Please respond helpfully.';
      }
    }

    console.log(`=== PREPARING GROQ REQUEST ===`);
    console.log(`User messages count: ${messages.length}`);
    console.log(`System prompt length: ${systemPrompt.length} characters`);
    
    // Build full messages array with enhanced system prompt
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

    // Make request to Groq API with retry logic
    const groqResponse = await makeGroqRequest(apiKey, fullMsgs);

    console.log(`=== GROQ RESPONSE ===`);
    console.log(`Status: ${groqResponse.status}`);

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
