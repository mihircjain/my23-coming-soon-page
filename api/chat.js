// API endpoint for OpenAI chat completions
// This file handles secure communication with OpenAI API with proper error handling

import admin from 'firebase-admin';

/* ──────────────────────────────────────────────────────────────────── */
/*  Firebase Admin init                                               */
/* ──────────────────────────────────────────────────────────────────── */
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.VITE_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}
const db = admin.firestore();

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, userId = "mihir_jain", source = "lets-jam-chatbot" } = req.body;
    
    // Validate request body
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid request body: messages must be an array' });
    }

    // Safely load and validate OpenAI API key
    const rawApiKey = process.env.OPENAI_API_KEY;
    if (!rawApiKey) {
      console.error('OPENAI_API_KEY environment variable not found');
      return res.status(500).json({ 
        error: 'Server configuration error',
        message: 'OpenAI API key not configured'
      });
    }

    // Trim the API key to remove any whitespace/newlines
    const apiKey = rawApiKey.trim();
    if (!apiKey) {
      console.error('OPENAI_API_KEY is empty after trimming');
      return res.status(500).json({ 
        error: 'Server configuration error',
        message: 'Invalid OpenAI API key configuration'
      });
    }

    // Validate API key format (should start with sk-)
    if (!apiKey.startsWith('sk-')) {
      console.error('OPENAI_API_KEY does not appear to be valid (should start with sk-)');
      return res.status(500).json({ 
        error: 'Server configuration error',
        message: 'Invalid OpenAI API key format'
      });
    }

    // Build 7-day system prompt from Firestore
    let systemPrompt = "";
    try {
      systemPrompt = await build7DaySystemPrompt(userId);
    } catch (firestoreError) {
      console.error('Error building system prompt from Firestore:', firestoreError);
      // Use a fallback system prompt
      systemPrompt = "You are a helpful AI assistant focused on health and fitness.";
    }

    // Prepare full messages array with system prompt
    const fullMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ];

    // Extract user prompt for logging
    const userPrompt = messages.find(msg => msg.role === "user")?.content || "";
    
    // Log the prompt to Firestore (non-blocking)
    logPrompt(userId, systemPrompt, userPrompt, source).catch(logError => {
      console.error('Error logging prompt:', logError);
    });
    
    // Call OpenAI API with proper error handling
    console.log('Calling OpenAI API with model: gpt-4o-mini');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'Vercel-Function/1.0'
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Using the supported model
        messages: fullMessages,
        temperature: 0.7,
        max_tokens: 500,
        stream: false
      })
    });
    
    // Log response status for debugging
    console.log(`OpenAI API response status: ${response.status}`);
    
    if (!response.ok) {
      // Get the error response text
      const errorText = await response.text();
      console.error(`OpenAI API error: ${response.status} - ${errorText}`);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (parseError) {
        console.error('Failed to parse OpenAI error response as JSON:', parseError);
        errorData = { error: { message: errorText } };
      }
      
      // Provide more specific error messages based on status code
      if (response.status === 401) {
        return res.status(500).json({ 
          error: 'Authentication error',
          message: 'Invalid API key configuration'
        });
      } else if (response.status === 429) {
        // Check if it's a quota issue specifically
        if (errorData.error?.code === 'insufficient_quota') {
          return res.status(503).json({ 
            error: 'Quota exceeded',
            message: 'The AI service has reached its usage limit. Please try again later or contact support.',
            userMessage: 'I\'m temporarily unavailable due to high usage. Please try again in a few minutes!',
            code: 'insufficient_quota'
          });
        } else {
          return res.status(503).json({ 
            error: 'Rate limit exceeded',
            message: 'The AI service is currently busy. Please try again in a few moments.',
            userMessage: 'I\'m getting a lot of requests right now. Please wait a moment and try again!'
          });
        }
      } else if (response.status === 400) {
        return res.status(400).json({ 
          error: 'Invalid request to AI service',
          message: errorData.error?.message || 'I couldn\'t process your question. Please try asking in a different way.',
          userMessage: 'I had trouble understanding your question. Could you try rephrasing it?'
        });
      } else {
        return res.status(502).json({ 
          error: 'Error from AI service',
          message: 'I encountered an issue while processing your request. Please try again later.',
          userMessage: 'I\'m experiencing technical difficulties. Please try again in a few minutes.',
          details: errorData.error?.message || 'Unknown error'
        });
      }
    }
    
    const data = await response.json();
    console.log('OpenAI API call successful');
    return res.status(200).json(data);
    
  } catch (error) {
    console.error('Error in chat API:', error);
    
    // Handle specific fetch errors
    if (error.code === 'ENOTFOUND') {
      return res.status(500).json({ 
        error: 'Network error: Could not reach OpenAI API',
        userMessage: 'I\'m having trouble connecting to my AI service. Please try again in a moment.'
      });
    }
    
    if (error.name === 'AbortError') {
      return res.status(500).json({ 
        error: 'Request timeout: OpenAI API did not respond in time',
        userMessage: 'My response is taking too long. Please try asking again.'
      });
    }
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Something went wrong. Please try again later.',
      userMessage: 'I encountered an unexpected error. Please try again in a few minutes.',
      details: error.message
    });
  }
}

// Function to build 7-day system prompt from Firestore
async function build7DaySystemPrompt(userId) {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateString = sevenDaysAgo.toISOString().split('T')[0];

    let prompt = "You are a helpful AI assistant focused on health and fitness. Here's the user's recent data:\n\n";

    // Fetch nutrition data from last 7 days
    try {
      const nutritionQuery = db.collection('nutritionLogs')
        .where('userId', '==', userId)
        .where('date', '>=', dateString)
        .orderBy('date', 'desc')
        .limit(7);
      
      const nutritionSnapshot = await nutritionQuery.get();
      
      if (!nutritionSnapshot.empty) {
        prompt += "Recent Nutrition (last 7 days):\n";
        nutritionSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.totals) {
            prompt += `  - ${data.date}: ${data.totals.calories || 0} calories, ${data.totals.protein || 0}g protein, ${data.totals.carbs || 0}g carbs, ${data.totals.fat || 0}g fat\n`;
          }
        });
        prompt += "\n";
      }
    } catch (nutritionError) {
      console.warn('Could not fetch nutrition data for system prompt:', nutritionError);
    }

    // Fetch activity data from last 7 days
    try {
      const activityQuery = db.collection('strava_data')
        .where('userId', '==', userId)
        .where('start_date', '>=', `${dateString}T00:00:00Z`)
        .orderBy('start_date', 'desc')
        .limit(10);
      
      const activitySnapshot = await activityQuery.get();
      
      if (!activitySnapshot.empty) {
        prompt += "Recent Activities (last 7 days):\n";
        activitySnapshot.forEach(doc => {
          const data = doc.data();
          const activityDate = data.start_date?.split('T')[0] || 'Unknown date';
          prompt += `  - ${activityDate}: ${data.type || 'Unknown'} - ${data.distance || 0}km, ${data.duration || 0} minutes`;
          if (data.caloriesBurned) {
            prompt += `, ${data.caloriesBurned} calories burned`;
          }
          if (data.heart_rate) {
            prompt += `, avg HR: ${Math.round(data.heart_rate)} bpm`;
          }
          prompt += "\n";
        });
        prompt += "\n";
      }
    } catch (activityError) {
      console.warn('Could not fetch activity data for system prompt:', activityError);
    }

    // Fetch latest blood markers
    try {
      const bloodMarkersQuery = db.collection('blood_markers')
        .where('userId', '==', userId)
        .orderBy('date', 'desc')
        .limit(1);
      
      const bloodMarkersSnapshot = await bloodMarkersQuery.get();
      
      if (!bloodMarkersSnapshot.empty) {
        const latestBloodMarkers = bloodMarkersSnapshot.docs[0].data();
        prompt += "Latest Blood Markers:\n";
        if (latestBloodMarkers.markers) {
          Object.entries(latestBloodMarkers.markers).forEach(([key, value]) => {
            prompt += `  - ${key}: ${value}\n`;
          });
        }
        prompt += `  - Test date: ${latestBloodMarkers.date}\n\n`;
      }
    } catch (bloodMarkersError) {
      console.warn('Could not fetch blood markers for system prompt:', bloodMarkersError);
    }

    prompt += "Please provide helpful, personalized advice based on this data. Be encouraging and focus on actionable insights.";
    
    return prompt;
  } catch (error) {
    console.error('Error building system prompt:', error);
    return "You are a helpful AI assistant focused on health and fitness.";
  }
}

// Function to log prompts to Firestore
async function logPrompt(userId, systemPrompt, userPrompt, source) {
  try {
    const promptLogsRef = db.collection("ai_prompt_logs");
    await promptLogsRef.add({
      userId: "mihir_jain", // Hardcoded to ensure consistency
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      systemPrompt,
      userPrompt,
      model: "gpt-4o-mini",
      source
    });
    console.log("Prompt logged successfully");
  } catch (error) {
    console.error("Error logging prompt:", error);
    // Don't throw, just log the error
  }
}

