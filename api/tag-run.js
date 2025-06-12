// /api/tag-run.js - Complete run tagging API endpoint

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';

// Initialize Firebase
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
    console.warn('Firebase configuration incomplete');
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

// Rate limiting for tagging
const tagRequests = new Map();
const TAG_RATE_LIMIT = 20; // Max 20 tags per minute per IP
const TAG_WINDOW = 60 * 1000; // 1 minute

function isTagRateLimited(clientIP) {
  const now = Date.now();
  const windowStart = now - TAG_WINDOW;
  
  if (!tagRequests.has(clientIP)) {
    tagRequests.set(clientIP, []);
  }
  
  const requests = tagRequests.get(clientIP);
  const recentRequests = requests.filter(timestamp => timestamp > windowStart);
  tagRequests.set(clientIP, recentRequests);
  
  if (recentRequests.length >= TAG_RATE_LIMIT) {
    return true;
  }
  
  recentRequests.push(now);
  return false;
}

// Validate run type
const validRunTypes = ['easy', 'tempo', 'interval', 'long', 'recovery', 'race'];

function validateRunType(runType) {
  return validRunTypes.includes(runType);
}

// Auto-classify run for confidence scoring
function autoClassifyRun(activityData) {
  if (!activityData.distance || !activityData.duration) {
    return { type: 'easy', confidence: 0.3 };
  }
  
  const pace = (activityData.duration / 60) / activityData.distance; // min/km
  const hr = activityData.average_heartrate || 0;
  const distance = activityData.distance;
  
  if (distance >= 16) {
    return { type: 'long', confidence: 0.9 };
  }
  
  if (pace < 4.5 || hr > 175) {
    return { type: 'interval', confidence: 0.8 };
  }
  
  if (pace >= 4.5 && pace <= 5.5 && hr >= 150 && hr <= 170) {
    return { type: 'tempo', confidence: 0.75 };
  }
  
  if (pace > 6.5 || hr < 140) {
    return { type: 'recovery', confidence: 0.7 };
  }
  
  return { type: 'easy', confidence: 0.6 };
}

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get client IP for rate limiting
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  
  // Check rate limit
  if (isTagRateLimited(clientIP)) {
    console.log(`Tag rate limit exceeded for IP: ${clientIP}`);
    return res.status(429).json({ 
      error: 'Too many tagging requests. Please wait a moment.',
      retryAfter: 60
    });
  }

  try {
    const { activityId, runType, userId } = req.body;
    
    // Validate required fields
    if (!activityId || !runType || !userId) {
      return res.status(400).json({
        error: 'Missing required fields: activityId, runType, and userId are required'
      });
    }
    
    // Validate run type
    if (!validateRunType(runType)) {
      return res.status(400).json({
        error: `Invalid run type: ${runType}. Valid types: ${validRunTypes.join(', ')}`
      });
    }
    
    // Initialize Firebase
    const firestore = initializeFirebase();
    if (!firestore) {
      return res.status(500).json({
        error: 'Database connection failed'
      });
    }
    
    console.log(`🏷️ Tagging run ${activityId} as ${runType} for user ${userId}`);
    
    // Check if the activity exists and belongs to the user
    const activityRef = doc(firestore, "strava_data", activityId);
    const activitySnapshot = await getDoc(activityRef);
    
    if (!activitySnapshot.exists()) {
      return res.status(404).json({
        error: 'Activity not found'
      });
    }
    
    const activityData = activitySnapshot.data();
    
    // Verify ownership
    if (activityData.userId !== userId) {
      return res.status(403).json({
        error: 'Access denied: Activity does not belong to user'
      });
    }
    
    // Verify it's a running activity
    if (!activityData.type?.toLowerCase().includes('run')) {
      return res.status(400).json({
        error: 'Can only tag running activities'
      });
    }
    
    // Get auto-classification for comparison
    const autoClassification = autoClassifyRun(activityData);
    const isUserOverride = autoClassification.type !== runType;
    
    // Update the activity with the run type
    const updateData = {
      runType,
      taggedAt: new Date().toISOString(),
      taggedBy: 'user',
      autoClassified: false,
      userOverride: isUserOverride,
      originalSuggestion: autoClassification.type,
      confidenceScore: autoClassification.confidence,
      updatedAt: new Date().toISOString()
    };
    
    await updateDoc(activityRef, updateData);
    
    console.log(`✅ Successfully tagged run ${activityId} as ${runType}`);
    console.log(`📊 Auto-suggested: ${autoClassification.type}, User chose: ${runType}, Override: ${isUserOverride}`);
    
    // Return success response with activity info
    return res.status(200).json({
      success: true,
      activityId,
      runType,
      message: `Run successfully tagged as ${runType}`,
      activityInfo: {
        name: activityData.name,
        distance: activityData.distance,
        duration: activityData.duration,
        date: activityData.start_date,
        autoSuggestion: autoClassification.type,
        userOverride: isUserOverride,
        confidence: autoClassification.confidence
      }
    });
    
  } catch (error) {
    console.error('❌ Error tagging run:', error);
    
    // Handle Firestore-specific errors
    if (error.code === 'not-found') {
      return res.status(404).json({
        error: 'Activity not found in database'
      });
    }
    
    if (error.code === 'permission-denied') {
      return res.status(403).json({
        error: 'Permission denied: Cannot update this activity'
      });
    }
    
    if (error.code === 'unavailable') {
      return res.status(503).json({
        error: 'Database temporarily unavailable. Please try again.'
      });
    }
    
    return res.status(500).json({
      error: 'Internal server error while tagging run',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
  }
}

// Bulk tagging function for future use
export async function bulkTagRuns(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { tags, userId } = req.body; // tags = [{ activityId, runType }, ...]
    
    if (!Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({
        error: 'Tags array is required and must not be empty'
      });
    }
    
    if (tags.length > 20) {
      return res.status(400).json({
        error: 'Maximum 20 activities can be tagged at once'
      });
    }
    
    const firestore = initializeFirebase();
    if (!firestore) {
      return res.status(500).json({ error: 'Database connection failed' });
    }
    
    const results = [];
    const errors = [];
    
    // Process each tag
    for (const tag of tags) {
      try {
        const { activityId, runType } = tag;
        
        if (!validateRunType(runType)) {
          errors.push({ activityId, error: `Invalid run type: ${runType}` });
          continue;
        }
        
        const activityRef = doc(firestore, "strava_data", activityId);
        const activitySnapshot = await getDoc(activityRef);
        
        if (!activitySnapshot.exists()) {
          errors.push({ activityId, error: 'Activity not found' });
          continue;
        }
        
        const activityData = activitySnapshot.data();
        
        if (activityData.userId !== userId) {
          errors.push({ activityId, error: 'Access denied' });
          continue;
        }
        
        const autoClassification = autoClassifyRun(activityData);
        
        await updateDoc(activityRef, {
          runType,
          taggedAt: new Date().toISOString(),
          taggedBy: 'user',
          autoClassified: false,
          userOverride: autoClassification.type !== runType,
          originalSuggestion: autoClassification.type,
          confidenceScore: autoClassification.confidence,
          updatedAt: new Date().toISOString()
        });
        
        results.push({ 
          activityId, 
          runType, 
          success: true,
          activityName: activityData.name 
        });
        
      } catch (error) {
        errors.push({ activityId: tag.activityId, error: error.message });
      }
    }
    
    console.log(`📊 Bulk tagging completed: ${results.length} successful, ${errors.length} errors`);
    
    return res.status(200).json({
      success: true,
      tagged: results.length,
      errors: errors.length,
      results,
      errors
    });
    
  } catch (error) {
    console.error('❌ Error in bulk tagging:', error);
    return res.status(500).json({
      error: 'Internal server error during bulk tagging'
    });
  }
}
