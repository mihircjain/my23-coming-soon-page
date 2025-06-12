// /api/run-tags.js - Complete run tagging API with GET and POST support

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, updateDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

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

// Validate run type - Updated to match frontend
const validRunTypes = ['easy', 'tempo', 'intervals', 'long', 'recovery']; // Note: 'intervals' not 'interval'

function validateRunType(runType) {
  return validRunTypes.includes(runType);
}

// Auto-classify run for confidence scoring
function autoClassifyRun(activityData) {
  if (!activityData.distance || !activityData.moving_time) {
    return { type: 'easy', confidence: 0.3 };
  }
  
  const timeInMinutes = activityData.moving_time / 60;
  const paceMinPerKm = timeInMinutes / activityData.distance;
  const avgHR = activityData.average_heartrate || 0;
  const distance = activityData.distance;
  
  // Long run detection (distance-based)
  if (distance >= 15) return { type: 'long', confidence: 0.9 };
  if (distance >= 10 && paceMinPerKm > 5.5) return { type: 'long', confidence: 0.8 };

  // Recovery run detection (very easy pace or low HR)
  if (distance <= 5 && paceMinPerKm > 6.5) return { type: 'recovery', confidence: 0.8 };
  if (avgHR && avgHR < 140 && distance <= 8) return { type: 'recovery', confidence: 0.7 };

  // Intervals detection (fast pace with moderate distance)
  if (paceMinPerKm < 4.0 && distance <= 10) return { type: 'intervals', confidence: 0.8 };
  if (avgHR && avgHR > 170 && distance <= 8) return { type: 'intervals', confidence: 0.7 };

  // Tempo detection (moderately fast pace, moderate distance)
  if (paceMinPerKm < 5.0 && distance >= 5 && distance <= 12) return { type: 'tempo', confidence: 0.8 };
  if (avgHR && avgHR >= 155 && avgHR <= 170 && distance >= 5) return { type: 'tempo', confidence: 0.7 };

  // Default to easy
  return { type: 'easy', confidence: 0.6 };
}

// GET handler - Load existing run tags
async function handleGetRequest(req, res) {
  try {
    const { userId = 'mihir_jain' } = req.query;
    
    const firestore = initializeFirebase();
    if (!firestore) {
      return res.status(500).json({ error: 'Database connection failed' });
    }

    console.log(`📥 Loading run tags for user: ${userId}`);

    // Query activities with run tags for this user
    const activitiesRef = collection(firestore, "strava_data");
    const q = query(
      activitiesRef, 
      where("userId", "==", userId),
      where("runType", "!=", null) // Only get activities that have been tagged
    );
    
    const querySnapshot = await getDocs(q);
    const tags = {};
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.runType && validRunTypes.includes(data.runType)) {
        tags[doc.id] = data.runType;
      }
    });

    console.log(`✅ Loaded ${Object.keys(tags).length} run tags`);
    
    return res.status(200).json(tags);
    
  } catch (error) {
    console.error('❌ Error loading run tags:', error);
    return res.status(500).json({
      error: 'Failed to load run tags',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Database error'
    });
  }
}

// POST handler - Save run tag
async function handlePostRequest(req, res) {
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
    const { activityId, tag, userId = 'mihir_jain', timestamp } = req.body; // Note: 'tag' not 'runType' to match frontend
    
    // Validate required fields
    if (!activityId || !tag) {
      return res.status(400).json({
        error: 'Missing required fields: activityId and tag are required'
      });
    }
    
    // Validate run type
    if (!validateRunType(tag)) {
      return res.status(400).json({
        error: `Invalid run type: ${tag}. Valid types: ${validRunTypes.join(', ')}`
      });
    }
    
    // Initialize Firebase
    const firestore = initializeFirebase();
    if (!firestore) {
      return res.status(500).json({
        error: 'Database connection failed'
      });
    }
    
    console.log(`🏷️ Tagging run ${activityId} as ${tag} for user ${userId}`);
    
    // Check if the activity exists
    const activityRef = doc(firestore, "strava_data", activityId);
    const activitySnapshot = await getDoc(activityRef);
    
    if (!activitySnapshot.exists()) {
      // If activity doesn't exist, create a minimal record for tagging
      console.log(`📝 Creating new activity record for tagging: ${activityId}`);
      
      const newActivityData = {
        id: activityId,
        userId,
        runType: tag,
        taggedAt: timestamp || new Date().toISOString(),
        taggedBy: 'user',
        autoClassified: false,
        userOverride: true, // Since we don't have activity data to auto-classify
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await updateDoc(activityRef, newActivityData);
      
      return res.status(200).json({
        success: true,
        activityId,
        runType: tag,
        message: `Run successfully tagged as ${tag}`,
        created: true
      });
    }
    
    const activityData = activitySnapshot.data();
    
    // Verify ownership if userId is provided in activity data
    if (activityData.userId && activityData.userId !== userId) {
      return res.status(403).json({
        error: 'Access denied: Activity does not belong to user'
      });
    }
    
    // Get auto-classification for comparison (if we have activity data)
    let autoClassification = { type: 'easy', confidence: 0.5 };
    let isUserOverride = true;
    
    if (activityData.distance && activityData.moving_time) {
      autoClassification = autoClassifyRun(activityData);
      isUserOverride = autoClassification.type !== tag;
    }
    
    // Update the activity with the run type
    const updateData = {
      runType: tag, // Store as runType in database
      taggedAt: timestamp || new Date().toISOString(),
      taggedBy: 'user',
      autoClassified: false,
      userOverride: isUserOverride,
      originalSuggestion: autoClassification.type,
      confidenceScore: autoClassification.confidence,
      updatedAt: new Date().toISOString()
    };
    
    await updateDoc(activityRef, updateData);
    
    console.log(`✅ Successfully tagged run ${activityId} as ${tag}`);
    console.log(`📊 Auto-suggested: ${autoClassification.type}, User chose: ${tag}, Override: ${isUserOverride}`);
    
    // Return success response
    return res.status(200).json({
      success: true,
      activityId,
      runType: tag,
      message: `Run successfully tagged as ${tag}`,
      activityInfo: {
        name: activityData.name || 'Unknown Activity',
        distance: activityData.distance || 0,
        duration: activityData.moving_time || activityData.duration || 0,
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

// Main handler
export default async function handler(req, res) {
  // Enable CORS if needed
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'GET') {
    return handleGetRequest(req, res);
  }
  
  if (req.method === 'POST') {
    return handlePostRequest(req, res);
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}
