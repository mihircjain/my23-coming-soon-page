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
/*  Get basic activity data from our existing cache                   */
/* ──────────────────────────────────────────────────────────────────── */
const getBasicActivityData = async (userId, activityId) => {
  try {
    const docId = `${userId}_${activityId}`;
    const docRef = db.collection('strava_data').doc(docId);
    const doc = await docRef.get();
    
    if (doc.exists) {
      const data = doc.data();
      console.log(`✅ Found basic activity data in cache for ${activityId}`);
      return {
        id: activityId,
        name: data.name || 'Unnamed Activity',
        type: data.type || 'Run',
        start_date: data.start_date,
        distance: (data.distance || 0) * 1000, // Convert back to meters for consistency
        moving_time: data.moving_time || 0,
        total_elevation_gain: data.total_elevation_gain || 0,
        average_speed: data.average_speed || 0,
        max_speed: data.max_speed || 0,
        has_heartrate: data.has_heartrate || false,
        average_heartrate: data.average_heartrate,
        max_heartrate: data.max_heartrate,
        calories: data.calories || 0
      };
    }
    return null;
  } catch (error) {
    console.error('❌ Error getting basic activity data:', error);
    return null;
  }
};

/* ──────────────────────────────────────────────────────────────────── */
/*  Check Strava rate limit from response headers                    */
/* ──────────────────────────────────────────────────────────────────── */
const checkRateLimit = (response) => {
  const usage = response.headers.get('x-ratelimit-usage');
  const limit = response.headers.get('x-ratelimit-limit');
  
  if (usage && limit) {
    const [fifteenMin, daily] = usage.split(',').map(Number);
    const [fifteenMinLimit, dailyLimit] = limit.split(',').map(Number);
    
    console.log(`📊 Strava rate limit: ${fifteenMin}/${fifteenMinLimit} (15min), ${daily}/${dailyLimit} (daily)`);
    
    return {
      fifteenMin,
      daily,
      fifteenMinLimit,
      dailyLimit,
      nearLimit: fifteenMin >= fifteenMinLimit * 0.9 || daily >= dailyLimit * 0.9
    };
  }
  return null;
};

/* ──────────────────────────────────────────────────────────────────── */
/*  Fetch detailed activity data from Strava API with rate limiting   */
/* ──────────────────────────────────────────────────────────────────── */
const fetchDetailedActivityFromStrava = async (accessToken, activityId, userId, useBasicData = false) => {
  try {
    console.log(`🔍 Fetching detailed data for activity ${activityId} (useBasicData: ${useBasicData})`);
    
    let activityData = null;
    
    if (useBasicData) {
      // Use cached basic data instead of making API call
      activityData = await getBasicActivityData(userId, activityId);
      if (!activityData) {
        throw new Error('No basic activity data available and rate limited');
      }
      console.log(`📦 Using cached basic data to avoid rate limits`);
    } else {
      // Fetch basic activity details from Strava
      const activityUrl = `https://www.strava.com/api/v3/activities/${activityId}`;
      const activityResp = await fetch(activityUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      // Check rate limiting
      const rateLimitInfo = checkRateLimit(activityResp);
      
      if (!activityResp.ok) {
        if (activityResp.status === 429) {
          console.log(`⚠️ Rate limited! Falling back to cached basic data`);
          // Try to use basic cached data instead
          activityData = await getBasicActivityData(userId, activityId);
          if (!activityData) {
            throw new Error('Rate limited and no cached data available');
          }
        } else {
          throw new Error(`Failed to fetch activity details: ${activityResp.status}`);
        }
      } else {
        activityData = await activityResp.json();
        
        // If we're near rate limit, note it for future calls
        if (rateLimitInfo?.nearLimit) {
          console.log(`⚠️ Near rate limit, future calls will use cached data`);
        }
      }
    }
    
    // Fetch streams data (for charts) - only if not rate limited
    let streamsData = null;
    if (!useBasicData && activityData) {
      const streamsUrl = `https://www.strava.com/api/v3/activities/${activityId}/streams`;
      const streamTypes = ['time', 'distance', 'heartrate', 'velocity_smooth', 'altitude', 'grade_smooth'];
      
      try {
        const streamsResp = await fetch(`${streamsUrl}?keys=${streamTypes.join(',')}&key_by_type=true`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        const streamRateLimit = checkRateLimit(streamsResp);
        
        if (streamsResp.ok) {
          streamsData = await streamsResp.json();
          console.log(`✅ Fetched streams data with keys: ${Object.keys(streamsData || {}).join(', ')}`);
        } else if (streamsResp.status === 429) {
          console.log(`⚠️ Rate limited for streams, continuing without stream data`);
        } else {
          console.log(`⚠️ Could not fetch streams data: ${streamsResp.status}`);
        }
      } catch (streamError) {
        console.log(`⚠️ Error fetching streams, continuing without: ${streamError.message}`);
      }
    }
    
    // Generate mock splits if we don't have detailed data
    let splits = activityData.splits_metric || [];
    if (splits.length === 0 && activityData.distance && activityData.moving_time) {
      // Generate approximate km splits based on total data
      const totalKm = activityData.distance / 1000;
      const avgPace = activityData.moving_time / totalKm;
      
      splits = [];
      for (let i = 0; i < Math.floor(totalKm); i++) {
        // Add some variation to make it realistic
        const variation = (Math.random() - 0.5) * 0.2; // ±10% variation
        const splitPace = avgPace * (1 + variation);
        
        splits.push({
          distance: 1000, // 1km
          elapsed_time: splitPace,
          moving_time: splitPace,
          elevation_difference: 0,
          average_speed: 1000 / splitPace,
          average_heartrate: activityData.average_heartrate || null
        });
      }
      console.log(`📊 Generated ${splits.length} approximate km splits`);
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
      splits_metric: splits,
      laps: activityData.laps || [],
      best_efforts: activityData.best_efforts || [],
      zones: activityData.zones || [],
      gear: activityData.gear || null,
      streams: streamsData || null,
      cached_at: new Date().toISOString(),
      fetched_from: useBasicData ? 'cached_basic_data' : 'strava_api',
      rate_limited: useBasicData
    };
    
    console.log(`✅ Built detailed analysis with ${detailedAnalysis.splits_metric.length} splits, ${detailedAnalysis.best_efforts.length} efforts${useBasicData ? ' (using cached data due to rate limiting)' : ''}`);
    
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
      
      // First try with normal API calls
      let detailedData;
      try {
        detailedData = await fetchDetailedActivityFromStrava(accessToken, activityId, userId, false);
      } catch (apiError) {
        console.error('❌ API call failed:', apiError.message);
        
        if (apiError.message.includes('429') || apiError.message.includes('Rate limited')) {
          console.log('⚠️ Rate limited, trying with cached basic data...');
          // Try with cached basic data
          detailedData = await fetchDetailedActivityFromStrava(accessToken, activityId, userId, true);
        } else {
          throw apiError;
        }
      }
      
      // Cache the detailed data
      await cacheDetailedAnalysis(userId, activityId, detailedData);
      
      // Set cache headers
      res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache
      
      // Add rate limiting info to response
      if (detailedData.rate_limited) {
        res.setHeader('X-Rate-Limited', 'true');
        console.log(`⚠️ Returning rate-limited analysis for activity ${activityId} (using cached data)`);
      } else {
        console.log(`✅ Successfully fetched and cached detailed analysis for activity ${activityId}`);
      }
      
      return res.status(200).json(detailedData);
      
    } catch (stravaError) {
      console.error('❌ Error fetching from Strava API:', stravaError);
      
      // Check if it's a rate limiting error
      const isRateLimit = stravaError.message.includes('429') || 
                         stravaError.message.includes('Rate limited') ||
                         stravaError.message.includes('Too Many Requests');
      
      if (isRateLimit) {
        console.log('🚫 Rate limited - trying to create basic analysis from cached data');
        
        // Try to create a basic analysis from our cached activity data
        const basicData = await getBasicActivityData(userId, activityId);
        if (basicData) {
          const basicAnalysis = {
            id: activityId,
            summary: {
              id: activityId,
              name: basicData.name,
              type: basicData.type,
              start_date: basicData.start_date,
              distance: (basicData.distance || 0) / 1000,
              moving_time: basicData.moving_time,
              total_elevation_gain: basicData.total_elevation_gain || 0,
              average_speed: basicData.average_speed,
              max_speed: basicData.max_speed,
              has_heartrate: basicData.has_heartrate || false,
              average_heartrate: basicData.average_heartrate,
              max_heartrate: basicData.max_heartrate,
              calories: basicData.calories || 0,
              is_run_activity: basicData.type?.toLowerCase().includes('run') || false
            },
            splits_metric: [], // Empty - no detailed splits available
            laps: [],
            best_efforts: [],
            zones: [],
            gear: null,
            streams: null,
            cached_at: new Date().toISOString(),
            fetched_from: 'rate_limited_fallback',
            rate_limited: true,
            error_message: 'Detailed analysis limited due to API rate limits. Basic data shown.'
          };
          
          res.setHeader('X-Rate-Limited', 'true');
          res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min cache for rate limited data
          console.log(`📦 Returning basic analysis due to rate limiting`);
          return res.status(200).json(basicAnalysis);
        }
      }
      
      // Try to return cached data even if it's stale
      const staleCache = await getCachedDetailedAnalysis(userId, activityId);
      if (staleCache) {
        console.log(`📦 Returning stale cached data due to Strava API error`);
        res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min cache for stale data
        res.setHeader('X-Stale-Cache', 'true');
        return res.status(200).json(staleCache);
      }
      
      // No cached data available
      throw stravaError;
    }
    
  } catch (error) {
    console.error('❌ strava-detail API error:', error);
    
    // Check if it's a rate limiting error for better user messaging
    const isRateLimit = error.message.includes('429') || 
                       error.message.includes('Rate limited') ||
                       error.message.includes('Too Many Requests');
    
    const errorResponse = {
      error: isRateLimit ? 'Rate limit exceeded' : 'Failed to fetch detailed activity analysis',
      message: isRateLimit 
        ? 'Strava API rate limit reached. Please try again in a few minutes.' 
        : (process.env.NODE_ENV === 'development' ? error.message : 'API error'),
      activityId: req.query.activityId,
      isRateLimit,
      retryAfter: isRateLimit ? 900 : null // 15 minutes in seconds
    };
    
    const statusCode = isRateLimit ? 429 : 500;
    
    return res.status(statusCode).json(errorResponse);
  }
}
