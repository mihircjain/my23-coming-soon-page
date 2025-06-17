// api/strava.js - Simple working version that matches your existing files

import admin from 'firebase-admin';

// Initialize Firebase Admin (same as your other files)
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

// Auto-tag runs
const autoTagRun = (activity) => {
  if (!activity.type?.toLowerCase().includes('run')) {
    return null;
  }

  const distance = activity.distance || 0;
  const timeInMinutes = (activity.moving_time || 0) / 60;
  const paceMinPerKm = distance > 0 ? timeInMinutes / distance : 999;
  const avgHR = activity.average_heartrate || 0;

  if (distance >= 15) return 'long';
  if (distance >= 10 && paceMinPerKm > 5.5) return 'long';
  if (distance <= 5 && paceMinPerKm > 6.5) return 'recovery';
  if (avgHR && avgHR < 140 && distance <= 8) return 'recovery';
  if (paceMinPerKm < 4.0 && distance <= 10) return 'intervals';
  if (avgHR && avgHR > 170 && distance <= 8) return 'intervals';
  if (paceMinPerKm < 5.0 && distance >= 5 && distance <= 12) return 'tempo';
  if (avgHR && avgHR >= 155 && avgHR <= 170 && distance >= 5) return 'tempo';

  return 'easy';
};

// Load existing run tags
const loadExistingRunTags = async (userId) => {
  try {
    console.log('🏷️ Loading existing run tags...');
    
    const snapshot = await db
      .collection('strava_data')
      .where('userId', '==', userId)
      .where('is_run_activity', '==', true)
      .get();
    
    const existingTags = new Map();
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const activityId = data.id?.toString();
      
      if (activityId && data.runType) {
        existingTags.set(activityId, {
          runType: data.runType,
          run_tag: data.run_tag || data.runType,
          userOverride: data.userOverride === true
        });
      }
    });
    
    console.log(`✅ Loaded ${existingTags.size} existing run tags`);
    return existingTags;
    
  } catch (error) {
    console.error('❌ Error loading existing run tags:', error);
    return new Map();
  }
};

// FIXED: Load existing activity data to preserve calories
const loadExistingActivityData = async (userId, activityIds) => {
  try {
    console.log(`🔍 Loading existing data for ${activityIds.length} activities...`);
    
    const existingData = new Map();
    
    // Process in batches of 10 (Firestore limit)
    for (let i = 0; i < activityIds.length; i += 10) {
      const batch = activityIds.slice(i, i + 10);
      if (batch.length === 0) continue;
      
      const snapshot = await db
        .collection('strava_data')
        .where('userId', '==', userId)
        .where('id', 'in', batch)
        .get();
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const activityId = data.id?.toString();
        if (activityId) {
          existingData.set(activityId, {
            calories: data.calories || 0,
            hasDetailedAnalysis: data.hasDetailedAnalysis || false
          });
        }
      });
    }
    
    console.log(`✅ Loaded existing data for ${existingData.size} activities`);
    return existingData;
    
  } catch (error) {
    console.error('❌ Error loading existing activity data:', error);
    return new Map();
  }
};

// Get cached data
const getCachedData = async (userId, daysBack = 30) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    cutoffDate.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    console.log(`📅 Getting cached data from ${cutoffDate.toISOString()}`);
    
    const snapshot = await db
      .collection('strava_data')
      .where('userId', '==', userId)
      .where('start_date', '>=', cutoffDate.toISOString())
      .where('start_date', '<=', today.toISOString())
      .orderBy('start_date', 'desc')
      .limit(200)
      .get();
    
    const activityMap = new Map();
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const activityId = data.id || doc.id.split('_')[1];
      
      if (!activityMap.has(activityId)) {
        const processedActivity = {
          ...data,
          calories: data.calories || 0,
          is_run_activity: data.type?.toLowerCase().includes('run') || false
        };
        
        if (processedActivity.is_run_activity) {
          processedActivity.run_tag = data.runType || null;
        }
        
        activityMap.set(activityId, processedActivity);
      }
    });
    
    const cachedActivities = Array.from(activityMap.values());
    console.log(`📊 Found ${cachedActivities.length} cached activities`);
    
    return cachedActivities;
  } catch (error) {
    console.error('❌ Error fetching cached data:', error);
    return [];
  }
};

// Fetch fresh data with calorie preservation
const fetchFreshDataFromStrava = async (userId, daysBack = 30, preserveTags = true) => {
  console.log('🔄 Fetching fresh data from Strava API');
  
  let existingRunTags = new Map();
  if (preserveTags) {
    existingRunTags = await loadExistingRunTags(userId);
  }
  
  const { 
    VITE_STRAVA_CLIENT_ID: clientId,
    VITE_STRAVA_CLIENT_SECRET: clientSecret,
    VITE_STRAVA_REFRESH_TOKEN: refreshToken 
  } = process.env;
  
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing Strava credentials');
  }

  // Get access token
  console.log('🔑 Refreshing Strava access token...');
  const tokenResp = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  
  if (!tokenResp.ok) {
    throw new Error(`Token refresh failed: ${tokenResp.status}`);
  }
  
  const { access_token: accessToken } = await tokenResp.json();

  // Fetch activities
  const today = new Date();
  const startDate = new Date();
  startDate.setDate(today.getDate() - daysBack);
  startDate.setHours(0, 0, 0, 0);
  
  const after = Math.floor(startDate.getTime() / 1000);
  const before = Math.floor(today.getTime() / 1000);
  
  const stravaUrl = `https://www.strava.com/api/v3/athlete/activities?per_page=200&after=${after}&before=${before}`;
  
  const listResp = await fetch(stravaUrl, { 
    headers: { Authorization: `Bearer ${accessToken}` } 
  });
  
  if (!listResp.ok) {
    throw new Error(`Strava API error: ${listResp.status}`);
  }
  
  const activitiesData = await listResp.json();
  console.log(`✅ Fetched ${activitiesData.length} activities from Strava`);

  // FIXED: Load existing calorie data
  const activityIds = activitiesData.map(a => a.id.toString());
  const existingActivityData = await loadExistingActivityData(userId, activityIds);

  // Process activities
  const summaries = [];
  const batch = db.batch();
  const now = new Date().toISOString();
  let preservedCaloriesCount = 0;

  for (const activity of activitiesData) {
    const activityId = activity.id.toString();
    const isRun = activity.type?.toLowerCase().includes('run');
    
    // FIXED: Preserve existing calorie data
    const existingActivity = existingActivityData.get(activityId);
    let calories = 0;
    
    if (activity.calories && activity.calories > 0) {
      calories = activity.calories;
    } else if (existingActivity && existingActivity.calories > 0) {
      calories = existingActivity.calories;
      preservedCaloriesCount++;
      console.log(`🔥 Preserving calories for ${activityId}: ${calories}`);
    }

    // Handle run tags
    let runTagInfo = null;
    if (isRun) {
      if (preserveTags && existingRunTags.has(activityId)) {
        runTagInfo = existingRunTags.get(activityId);
      } else {
        const autoTag = autoTagRun(activity);
        runTagInfo = {
          runType: autoTag,
          run_tag: autoTag,
          userOverride: false
        };
      }
    }

    const summary = {
      userId,
      id: activityId,
      start_date: activity.start_date,
      date: activity.start_date.split('T')[0],
      name: activity.name,
      type: activity.type,
      distance: activity.distance / 1000, // Convert to km
      moving_time: activity.moving_time,
      elapsed_time: activity.elapsed_time,
      total_elevation_gain: activity.total_elevation_gain || 0,
      average_speed: activity.average_speed,
      max_speed: activity.max_speed,
      has_heartrate: activity.has_heartrate || false,
      average_heartrate: activity.average_heartrate,
      max_heartrate: activity.max_heartrate,
      calories: calories, // FIXED: Preserves existing calories
      fetched_at: now,
      is_run_activity: isRun
    };

    // Add run tag info
    if (isRun && runTagInfo) {
      summary.run_tag = runTagInfo.run_tag;
      summary.runType = runTagInfo.runType;
      summary.userOverride = runTagInfo.userOverride || false;
    }

    summaries.push(summary);

    // Save to Firestore
    const docRef = db.collection('strava_data').doc(`${userId}_${activity.id}`);
    batch.set(docRef, summary, { merge: true });
  }

  if (summaries.length > 0) {
    await batch.commit();
    console.log(`💾 Cached ${summaries.length} activities (${preservedCaloriesCount} calories preserved)`);
  }

  return summaries.sort((a, b) => 
    new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
  );
};

// Main handler
export default async function handler(req, res) {
  try {
    console.log('🚀 Strava API handler started');
    
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const userId = req.query.userId || 'mihir_jain';
    const forceRefresh = req.query.refresh === 'true';
    const daysBack = parseInt(req.query.days) || 30;
    const mode = req.query.mode || 'cached';
    
    console.log(`📊 Request: userId=${userId}, mode=${mode}, daysBack=${daysBack}`);
    
    // Cache-first mode
    if (!forceRefresh && mode === 'cached') {
      console.log('⚡ Cache-first mode');
      
      const cachedData = await getCachedData(userId, daysBack);
      
      if (cachedData.length > 0) {
        console.log(`📦 Serving ${cachedData.length} cached activities`);
        
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.setHeader('X-Data-Source', 'firestore-cache');
        res.setHeader('X-API-Calls', '0');
        
        return res.status(200).json(cachedData);
      } else {
        return res.status(404).json({ 
          error: 'No cached data available',
          message: 'Please refresh to load data from Strava',
          recommendRefresh: true
        });
      }
    }
    
    // Refresh modes
    if (forceRefresh || mode === 'refresh' || mode === 'today') {
      console.log(`🔄 ${mode} mode - fetching fresh data`);
      
      const refreshDays = mode === 'today' ? 1 : daysBack;
      const freshData = await fetchFreshDataFromStrava(userId, refreshDays, true);
      
      if (mode === 'today') {
        // Combine with cached data
        const cachedData = await getCachedData(userId, daysBack - 1);
        const combinedData = [...freshData, ...cachedData];
        const uniqueData = Array.from(
          new Map(combinedData.map(activity => [activity.id, activity])).values()
        ).sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
        
        res.setHeader('X-Data-Source', 'today-refresh');
        return res.status(200).json(uniqueData);
      }
      
      res.setHeader('X-Data-Source', 'strava-api');
      res.setHeader('X-API-Calls', '1');
      
      return res.status(200).json(freshData);
    }
    
    // Default fallback
    const cachedData = await getCachedData(userId, daysBack);
    return res.status(200).json(cachedData);
    
  } catch (error) {
    console.error('❌ Strava API error:', error);
    
    // Try fallback to cached data
    try {
      const userId = req.query.userId || 'mihir_jain';
      const daysBack = parseInt(req.query.days) || 30;
      const fallbackData = await getCachedData(userId, daysBack);
      
      if (fallbackData.length > 0) {
        console.log(`📦 Error fallback: serving ${fallbackData.length} cached activities`);
        return res.status(200).json(fallbackData);
      }
    } catch (fallbackError) {
      console.error('❌ Fallback failed:', fallbackError);
    }
    
    return res.status(500).json({ 
      error: 'Unable to fetch activity data',
      message: error.message
    });
  }
}
