import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

// Initialize Firebase (adjust config as needed)
const firebaseConfig = {
  // Your Firebase configuration
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// Initialize Firebase only if not already initialized
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

async function getSystemPrompt() {
  try {
    // Get last 7 days of data from Firestore
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // Adjust this query based on your Firestore structure
    const q = query(
      collection(db, 'prompts'), // Replace with your collection name
      orderBy('timestamp', 'desc'),
      limit(50) // Adjust limit as needed
    );
    
    const querySnapshot = await getDocs(q);
    const prompts = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Filter for last 7 days
      if (data.timestamp && data.timestamp.toDate() >= sevenDaysAgo) {
        prompts.push(data.content || data.prompt || data.text); // Adjust field names
      }
    });
    
    // Build system prompt from collected data
    const systemContent = prompts.length > 0 
      ? `System context from the last 7 days:\n${prompts.join('\n\n')}\n\nBased on this context, please respond helpfully to the user's message.`
      : 'You are a helpful AI assistant. Please respond to the user\'s message.';
    
    return systemContent;
  } catch (error) {
    console.error('Error fetching system prompt from Firestore:', error);
    // Fallback system prompt
    return 'You are a helpful AI assistant. Please respond to the user\'s message.';
  }
}

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Validate and clean the OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    
    if (!apiKey) {
      console.error('OpenAI API key is missing');
      return res.status(500).json({ 
        error: 'Server configuration error: OpenAI API key not found' 
      });
    }

    // Validate API key format (should start with sk- and be at least 40 chars)
    if (!apiKey.startsWith('sk-') || apiKey.length < 40) {
      console.error('Invalid OpenAI API key format');
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

    // Get system prompt from Firestore
    console.log('Fetching system prompt from Firestore...');
    const systemPrompt = await getSystemPrompt();
    
    // Build full messages array with system prompt
    const fullMsgs = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    console.log(`Sending request to OpenAI with ${fullMsgs.length} messages`);

    // Make request to OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'Vercel-Function/1.0'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // This is the correct model name
        messages: fullMsgs,
        temperature: 0.7,
        max_tokens: 500,
        stream: false
      })
    });

    console.log(`OpenAI API response status: ${openaiResponse.status}`);

    // Check if response is OK
    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error(`OpenAI API error (${openaiResponse.status}):`, errorText);
      
      // Handle specific error codes
      switch (openaiResponse.status) {
        case 401:
          return res.status(500).json({ 
            error: 'Authentication failed - check API key configuration' 
          });
        case 429:
          return res.status(429).json({ 
            error: 'Rate limit exceeded - please try again later' 
          });
        case 502:
          return res.status(502).json({ 
            error: 'OpenAI service temporarily unavailable - please try again' 
          });
        default:
          return res.status(500).json({ 
            error: `OpenAI API error: ${openaiResponse.status}` 
          });
      }
    }

    // Parse and return the response
    const responseData = await openaiResponse.json();
    console.log('OpenAI API call successful');
    
    return res.status(200).json(responseData);

  } catch (error) {
    console.error('Handler error:', error);
    
    // Handle specific fetch errors
    if (error.code === 'ENOTFOUND') {
      return res.status(500).json({ 
        error: 'Network error: Could not reach OpenAI API' 
      });
    }
    
    if (error.name === 'AbortError') {
      return res.status(500).json({ 
        error: 'Request timeout: OpenAI API did not respond in time' 
      });
    }
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
