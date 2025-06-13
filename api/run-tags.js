// /api/run-tags.js - Complete run tagging API for Vercel

import admin from 'firebase-admin';

// Initialize Firebase Admin (same pattern as your strava.js)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

// Valid run types (must match frontend)
const validRunTypes = ['easy', 'tempo', 'intervals', 'long', 'recovery', 'hill-repeats'];

// Main Vercel serverless function handler
export default async function handler(req, res) {
  console.log(`🔗 run-tags API called: ${req.method} ${req.url}`);
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    if (req.method === 'GET') {
      return await handleGetRequest(req, res);
    }
    
    if (req.method === 'POST') {
      return await handlePostRequest(req, res);
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('❌ run-tags API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'API error'
    });
  }
}

// GET handler - Load existing run tags
async function handleGetRequest(req, res) {
  const { userId = 'mihir_jain' } = req.query;
  
  console.log(`📥 Loading run tags for user: ${userId}`);

  try {
    // Query all activities for this user
    const snapshot = await db
      .collection('strava_data')
      .where('userId', '==', userId)
      .get();
    
    const tags = {};
    let taggedCount = 0;
    
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const activityId = data.id || doc.id.split('_')[1];
      
      // Check if activity has a valid run tag
      if (data.runType && validRunTypes.includes(data.runType)) {
        tags[activityId] = data.runType;
        taggedCount++;
      }
    });

    console.log(`✅ Loaded ${taggedCount} run tags from ${snapshot.docs.length} activities`);
    
    return res.status(200).json(tags);
    
  } catch (error) {
    console.error('❌ Error loading run tags:', error);
    throw error;
  }
}

// POST handler - Save run tag
async function handlePostRequest(req, res) {
  const { activityId, tag, userId = 'mihir_jain', timestamp } = req.body;
  
  console.log(`🏷️ Tagging request: activityId=${activityId}, tag=${tag}, userId=${userId}`);
  
  // Validate input
  if (!activityId || !tag) {
    return res.status(400).json({
      error: 'Missing required fields: activityId and tag are required'
    });
  }
  
  if (!validRunTypes.includes(tag)) {
    return res.status(400).json({
      error: `Invalid run type: ${tag}. Valid types: ${validRunTypes.join(', ')}`
    });
  }

  try {
    // Use the same document ID pattern as strava.js
    const docId = `${userId}_${activityId}`;
    const activityRef = db.collection('strava_data').doc(docId);
    
    console.log(`🔍 Looking for document: ${docId}`);
    
    const activitySnapshot = await activityRef.get();
    
    if (!activitySnapshot.exists) {
      console.log(`❌ Activity not found, creating minimal record: ${docId}`);
      
      // Create minimal activity record for tagging
      const minimalData = {
        userId,
        id: activityId,
        type: 'Run',
        name: `Activity ${activityId}`,
        runType: tag,
        run_tag: tag,
        taggedAt: timestamp || new Date().toISOString(),
        taggedBy: 'user',
        userOverride: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await activityRef.set(minimalData);
      
      console.log(`✅ Created and tagged activity ${activityId} as ${tag}`);
      
      return res.status(200).json({
        success: true,
        activityId,
        runType: tag,
        message: `Run successfully tagged as ${tag}`,
        created: true
      });
    }

    // Update existing activity
    const activityData = activitySnapshot.data();
    console.log(`✅ Found existing activity: ${activityData.name || 'Unnamed'}`);
    
    // Update with merge to preserve existing data
    const updateData = {
      runType: tag,
      run_tag: tag, // For frontend compatibility
      taggedAt: timestamp || new Date().toISOString(),
      taggedBy: 'user',
      userOverride: true,
      updatedAt: new Date().toISOString()
    };
    
    await activityRef.set(updateData, { merge: true });
    
    console.log(`✅ Successfully updated activity ${activityId} tag to ${tag}`);
    
    return res.status(200).json({
      success: true,
      activityId,
      runType: tag,
      message: `Run successfully tagged as ${tag}`,
      activityInfo: {
        name: activityData.name || 'Unnamed Activity',
        type: activityData.type,
        distance: activityData.distance,
        date: activityData.start_date
      }
    });
    
  } catch (error) {
    console.error('❌ Error saving run tag:', error);
    throw error;
  }
}
