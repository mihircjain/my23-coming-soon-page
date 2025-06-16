// /api/strava-detail.js - Detailed Strava activity analysis API for Vercel
// Fetches comprehensive activity data including splits, streams, zones, and gear info

import admin from 'firebase-admin';

/* ──────────────────────────────────────────────────────────────────── */
/*  Firebase Admin init                                               */
/* ──────────────────────────────────────────────────────────────────── */
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

/* ──────────────────────────────────────────────────────────────────── */
/*  Get cached detailed analysis                                      */
/* ──────────────────────────────────────────────────────────────────── */
const getCachedDetailedAnalysis = async (userId, activityId) => {
  try {
    const docId = `${userId}_${activityId}`;
    const docRef = db.collection('strava_detailed').doc(docId);
    const doc = await docRef.get();
    
    if (doc.exists) {
      const data = doc.data();
      const cachedAt = new Date(data.cached_at);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      // Return cached data if it's less than 24 hours old
      if (cachedAt > oneDayAgo) {
        console.log(`📦 Serving cached detailed analysis for ${activityId} (cached ${Math.round((Date.now() - cachedAt.getTime()) / 60000)} mins ago)`);
        return data;
      } else {
        console.log(`⏰ Cached detailed analysis for ${activityId} is stale (${Math.round((Date.now() - cachedAt.getTime()) / 60000)} mins old)`);
      }
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error getting cached detailed analysis:', error);
    return null;
  }
};

/* ──────────────────────────────────────────────────────────────────── */
/*  Fetch detailed activity data from Strava API                     */
/* ──────────────────────────────────────────────────────────────────── */
const fetchDetailedActivityFromStrava = async (accessToken, activityId) => {
  try {
    console.log(`🔍 Fetching detailed data for activity ${activityId}`);
    
    // Fetch basic activity details
    const activityUrl = `https://www.strava.com/api/v3/activities/${activityId}`;
    const activityResp = await fetch(activityUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!activityResp.ok) {
      throw new Error(`Failed to fetch activity details: ${activityResp.status}`);
    }
    
    const activityData = await activityResp.json();
    
    // Fetch streams data (for charts)
    const streamsUrl = `https://www.strava.com/api/v3/activities/${activityId}/streams`;
    const streamTypes = ['time', 'distance', 'heartrate', 'velocity_smooth', 'altitude', 'grade_smooth'];
    const streamsResp = await fetch(`${streamsUrl}?keys=${streamTypes.join(',')}&key_by_type=true`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    let streamsData = null;
    if (streamsResp.ok) {
      streamsData = await streamsResp.json();
      console.log(`✅ Fetched streams data with keys: ${Object.keys(streamsData || {}).join(', ')}`);
    } else {
      console.log(`⚠️ Could not fetch streams data: ${streamsResp.status}`);
    }
    
    // Construct detailed analysis object
    const detailedAnalysis = {
      id: activityId,
      summary: {
        id: activityId,
        name: activityData.name,
        type: activityData.type,
        start_date: activityData.start_date,
        distance: (activityData.distance || 0) / 1000, // Convert to km
        moving_time: activityData.moving_time,
        total_elevation_gain: activityData.total_elevation_gain || 0,
        average_speed: activityData.average_speed,
        max_speed: activityData.max_speed,
        has_heartrate: activityData.has_heartrate || false,
        average_heartrate: activityData.average_heartrate,
        max_heartrate: activityData.max_heartrate,
        calories: activityData.calories || 0,
        is_run_activity: activityData.type?.toLowerCase().includes('run') || false
      },
      splits_metric: activityData.splits_metric || [],
      laps: activityData.laps || [],
      best_efforts: activityData.best_efforts || [],
      zones: activityData.zones || [],
      gear: activityData.gear || null,
      streams: streamsData || null,
      cached_at: new Date().toISOString(),
      fetched_from: 'strava_api'
    };
    
    console.log(`✅ Built detailed analysis with ${detailedAnalysis.splits_metric.length} splits, ${detailedAnalysis.best_efforts.length} efforts`);
    
    return detailedAnalysis;
    
  } catch (error) {
    console.error('❌ Error fetching detailed activity from Strava:', error);
    throw error;
  }
};

/* ──────────────────────────────────────────────────────────────────── */
/*  Cache detailed analysis to Firestore                             */
/* ──────────────────────────────────────────────────────────────────── */
const cacheDetailedAnalysis = async (userId, activityId, detailedData) => {
  try {
    const docId = `${userId}_${activityId}`;
    const docRef = db.collection('strava_detailed').doc(docId);
    
    await docRef.set(detailedData, { merge: true });
    
    // Also update the main activity record to indicate detailed analysis is available
    const activityDocRef = db.collection('strava_data').doc(docId);
    await activityDocRef.set({
      hasDetailedAnalysis: true,
      lastDetailedAnalysis: new Date().toISOString()
    }, { merge: true });
    
    console.log(`💾 Cached detailed analysis for activity ${activityId}`);
    
  } catch (error) {
    console.error('❌ Error caching detailed analysis:', error);
    // Don't throw - we can still return the data even if caching fails
  }
};

/* ──────────────────────────────────────────────────────────────────── */
/*  Get Strava access token                                           */
/* ──────────────────────────────────────────────────────────────────── */
const getStravaAccessToken = async () => {
  const { 
    VITE_STRAVA_CLIENT_ID: clientId,
    VITE_STRAVA_CLIENT_SECRET: clientSecret,
    VITE_STRAVA_REFRESH_TOKEN: refreshToken 
  } = process.env;
  
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing Strava credentials');
  }
  
  console.log('🔑 Refreshing Strava access token for detailed analysis...');
  
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
  
  const { access_token } = await tokenResp.json();
  return access_token;
};

/* ──────────────────────────────────────────────────────────────────── */
/*  Main handler                                                      */
/* ──────────────────────────────────────────────────────────────────── */
export default async function handler(req, res) {
  console.log(`🔗 strava-detail API called: ${req.method} ${req.url}`);
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { activityId, userId = 'mihir_jain', forceRefresh = 'false' } = req.query;
    
    if (!activityId) {
      return res.status(400).json({ error: 'activityId is required' });
    }
    
    console.log(`🏃 Detailed analysis request: activityId=${activityId}, userId=${userId}, forceRefresh=${forceRefresh}`);
    
    // Check cache first (unless force refresh)
    if (forceRefresh !== 'true') {
      const cachedData = await getCachedDetailedAnalysis(userId, activityId);
      if (cachedData) {
        res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache
        return res.status(200).json(cachedData);
      }
    }
    
    // Get fresh data from Strava
    try {
      const accessToken = await getStravaAccessToken();
      const detailedData = await fetchDetailedActivityFromStrava(accessToken, activityId);
      
      // Cache the detailed data
      await cacheDetailedAnalysis(userId, activityId, detailedData);
      
      // Set cache headers
      res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache
      
      console.log(`✅ Successfully fetched and cached detailed analysis for activity ${activityId}`);
      return res.status(200).json(detailedData);
      
    } catch (stravaError) {
      console.error('❌ Error fetching from Strava API:', stravaError);
      
      // Try to return cached data even if it's stale
      const staleCache = await getCachedDetailedAnalysis(userId, activityId);
      if (staleCache) {
        console.log(`📦 Returning stale cached data due to Strava API error`);
        res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min cache for stale data
        return res.status(200).json(staleCache);
      }
      
      // No cached data available
      throw stravaError;
    }
    
  } catch (error) {
    console.error('❌ strava-detail API error:', error);
    
    return res.status(500).json({
      error: 'Failed to fetch detailed activity analysis',
      message: process.env.NODE_ENV === 'development' ? error.message : 'API error',
      activityId: req.query.activityId
    });
  }
}
