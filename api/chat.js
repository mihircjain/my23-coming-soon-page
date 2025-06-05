// API endpoint for OpenAI chat completions
// This file handles secure communication with OpenAI API

import { db } from "../src/lib/firebaseConfig";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, userId = "mihir_jain", source = "lets-jam-chatbot" } = req.body;
    
    // Validate request body
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }
    
    // Get API key from environment variable
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OpenAI API key not found in environment variables');
      return res.status(500).json({ 
        error: 'Server configuration error',
        message: 'The server is not properly configured. Please try again later.'
      });
    }

    // Extract system prompt and user prompt for logging
    let systemPrompt = "";
    let userPrompt = "";
    
    messages.forEach(msg => {
      if (msg.role === "system") {
        systemPrompt = msg.content;
      } else if (msg.role === "user") {
        userPrompt = msg.content;
      }
    });
    
    // Log the prompt to Firestore
    try {
      await logPrompt(userId, systemPrompt, userPrompt, source);
    } catch (logError) {
      console.error('Error logging prompt:', logError);
      // Continue with the API call even if logging fails
    }
    
    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: messages,
        temperature: 0.7,
        max_tokens: 500
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI API error:', error);
      
      // Provide more specific error messages based on status code
      if (response.status === 429) {
        return res.status(503).json({ 
          error: 'Service temporarily unavailable',
          message: 'The AI service is currently busy. Please try again in a few moments.'
        });
      } else if (response.status === 400) {
        return res.status(400).json({ 
          error: 'Invalid request to AI service',
          message: 'I couldn\'t process your question. Please try asking in a different way.'
        });
      } else {
        return res.status(502).json({ 
          error: 'Error from AI service',
          message: 'I encountered an issue while processing your request. Please try again later.'
        });
      }
    }
    
    const data = await response.json();
    return res.status(200).json(data);
    
  } catch (error) {
    console.error('Error in chat API:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Something went wrong. Please try again later.'
    });
  }
}

// Function to log prompts to Firestore
async function logPrompt(userId, systemPrompt, userPrompt, source) {
  try {
    const promptLogsRef = collection(db, "ai_prompt_logs");
    await addDoc(promptLogsRef, {
      userId: "mihir_jain", // Hardcoded to ensure consistency
      timestamp: serverTimestamp(),
      systemPrompt,
      userPrompt,
      model: "gpt-4",
      source
    });
    console.log("Prompt logged successfully");
  } catch (error) {
    console.error("Error logging prompt:", error);
    // Don't throw, just log the error
  }
}
