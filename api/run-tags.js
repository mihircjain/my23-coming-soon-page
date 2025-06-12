// /api/run-tags.js - Simple run tagging API that works with existing strava.js

import admin from 'firebase-admin';

// Initialize Firebase (same as your strava.js)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.VITE_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}
const db = admin.firestore();

// Valid run types
const validRunTypes = ['easy', 'tempo', 'intervals', 'long', 'recovery'];

// GET handler - Load existing run tags
async function handleGetRequest(req, res) {
  try {
    const { userId = 'mihir_jain' } = req.query;
    
    console.log(`📥 Loading run tags for user: ${userId}`);

    // Query activities with run tags for this user
    const snapshot = await db
      .collection('strava_data')
      .where('userId', '==', userId)
      .get();
    
    const tags = {};
    let taggedCount = 0;
    
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      // Check if activity has a run tag
      if (data.runType && validRunTypes.includes(data.runType)) {
        tags[data.id || doc.id.split('_')[1]] = data.runType;
        taggedCount++;
      }
    });

    console.log(`✅ Loaded ${taggedCount} run tags from ${snapshot.docs.length} activities`);
    
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
  try {
    const { activityId, tag, userId = 'mihir_jain', timestamp } = req.body;
    
    console.log(`🏷️ Tagging request: activityId=${activityId}, tag=${tag}, userId=${userId}`);
    
    // Validate required fields
    if (!activityId || !tag) {
      return res.status(400).json({
        error: 'Missing required fields: activityId and tag are required'
      });
    }
    
    // Validate run type
    if (!validRunTypes.includes(tag)) {
      return res.status(400).json({
        error: `Invalid run type: ${tag}. Valid types: ${validRunTypes.join(', ')}`
      });
    }
    
    console.log(`🔍 Looking for activity document: ${userId}_${activityId}`);
    
    // Find the activity document using the correct naming pattern
    const activityRef = db.collection('strava_data').doc(`${userId}_${activityId}`);
    const activitySnapshot = await activityRef.get();
    
    if (!activitySnapshot.exists()) {
      console.log(`❌ Activity not found: ${userId}_${activityId}`);
      
      // If document doesn't exist, create a minimal one for tagging
      console.log(`📝 Creating minimal activity record for tagging: ${activityId}`);
      
      const minimalActivityData = {
        userId,
        id: activityId,
        type: 'Run', // Assume it's a run since we're tagging it
        runType: tag,
        run_tag: tag,
        taggedAt: timestamp || new Date().toISOString(),
        taggedBy: 'user',
        userOverride: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await activityRef.set(minimalActivityData);
      
      return res.status(200).json({
        success: true,
        activityId,
        runType: tag,
        message: `Run successfully tagged as ${tag}`,
        created: true
      });
    }
    
    const activityData = activitySnapshot.data();
    console.log(`✅ Found activity: ${activityData.name} (${activityData.type})`);
    
    // Verify it's a run activity
    if (!activityData.type?.toLowerCase().includes('run')) {
      return res.status(400).json({
        error: 'Can only tag running activities'
      });
    }
    
    // Update the activity with the run tag
    const updateData = {
      ...activityData, // Keep existing data
      runType: tag,
      run_tag: tag, // For frontend compatibility
      taggedAt: timestamp || new Date().toISOString(),
      taggedBy: 'user',
      userOverride: true,
      updatedAt: new Date().toISOString()
    };
    
    // Use setDoc with merge to handle both existing and new documents
    await activityRef.set(updateData, { merge: true });
    
    console.log(`✅ Successfully tagged activity ${activityId} as ${tag}`);
    
    return res.status(200).json({
      success: true,
      activityId,
      runType: tag,
      message: `Run successfully tagged as ${tag}`,
      activityInfo: {
        name: activityData.name,
        distance: activityData.distance,
        duration: activityData.moving_time || activityData.duration,
        date: activityData.start_date
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
