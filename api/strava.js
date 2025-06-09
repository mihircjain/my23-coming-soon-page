// api/strava.js
// Vercel serverless function – fetch Strava activities with smart caching

import admin from 'firebase-admin';

/* ──────────────────────────────────────────────────────────────────── */
/*  Firebase Admin init                                               */
/* ──────────────────────────────────────────────────────────────────── */
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

/* ──────────────────────────────────────────────────────────────────── */
/*  Check if we can refresh data (twice daily limit)                 */
/* ──────────────────────────────────────────────────────────────────── */
const canRefreshData = async (userId) => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const metadataRef = db.collection('strava_metadata').doc(`${userId}_${today}`);
    const metadataDoc = await metadataRef.get();
    
    if (!metadataDoc.exists()) {
      // First refresh of the day
      await metadataRef.set({ refreshCount: 1, lastRefresh: new Date().toISOString() });
      return true;
    }
    
    const data = metadataDoc.data();
    if (data.refreshCount < 2) {
      // Second refresh allowed
      await metadataRef.update({ 
        refreshCount: data.refreshCount + 1, 
        lastRefresh: new Date().toISOString() 
      });
      return true;
    }
    
    return false; // Already refreshed twice today
  } catch (error) {
    console.error('Error checking refresh limit:', error);
    return true; // Default to allowing refresh on error
  }
};

/* ──────────────────────────────────────────────────────────────────── */
/*  Get cached data from Firestore - FIXED DATE LOGIC                */
/* ──────────────────────────────────────────────────────────────────── */
const getCachedData = async (userId, daysBack = 30) => {
  try {
    // FIXED: Calculate cutoff date from TODAY, not some fixed date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    cutoffDate.setHours(0, 0, 0, 0); // Start of day
    
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    
    console.log(`📅 Getting cached data from ${cutoffDate.toISOString()} to ${today.toISOString()}`);
    
    const snapshot = await db
      .collection('strava_data')
      .where('userId', '==', userId)
      .where('start_date', '>=', cutoffDate.toISOString())
      .where('start_date', '<=', today.toISOString()) // FIXED: Add upper bound
      .orderBy('start_date', 'desc')
      .limit(100) // Increased limit
      .get();
    
    const cachedActivities = snapshot.docs.map(doc => doc.data());
    console.log(`📊 Found ${cachedActivities.length} cached activities`);
    
    // Log date range of cached data for debugging
    if (cachedActivities.length > 0) {
      const oldest = cachedActivities[cachedActivities.length - 1].start_date;
      const newest = cachedActivities[0].start_date;
      console.log(`📅 Cached data range: ${oldest} to ${newest}`);
    }
    
    return cachedActivities;
  } catch (error) {
    console.error('Error fetching cached data:', error);
    return [];
  }
};

/* ──────────────────────────────────────────────────────────────────── */
/*  Fast calorie estimation (no individual API calls)                */
/* ──────────────────────────────────────────────────────────────────── */
const estimateCalories = (activity) => {
  // If calories are provided, use them
  if (activity.calories) return activity.calories;
  
  const minutes = Math.round(activity.moving_time / 60);
  const type = activity.type?.toLowerCase() || '';
  
  // Improved calorie estimation based on activity type and duration
  if (type.includes('run')) {
    return Math.round(minutes * 12); // Higher burn rate for running
  } else if (type.includes('weighttraining') || type.includes('strength')) {
    return Math.round(minutes * 8); // Moderate burn for weight training
  } else if (type.includes('walk')) {
    return Math.round(minutes * 5); // Lower burn for walking
  } else if (type.includes('bike') || type.includes('cycling')) {
    return Math.round(minutes * 10); // Moderate burn for cycling
  }
  
  return Math.round(minutes * 7); // Default fallback
};

/* ──────────────────────────────────────────────────────────────────── */
/*  Main handler - FIXED CACHE AND DATE LOGIC                        */
/* ──────────────────────────────────────────────────────────────────── */
export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const userId = req.query.userId || 'mihir_jain';
    const forceRefresh = req.query.refresh === 'true' || req.query.forceRefresh === 'true';
    const daysBack = parseInt(req.query.days) || 30;
    
    console.log(`🚀 Strava API request: userId=${userId}, forceRefresh=${forceRefresh}, daysBack=${daysBack}`);
    
    // FIXED: For force refresh, bypass all cache checks
    if (forceRefresh) {
      console.log('🔄 Force refresh requested - bypassing all cache checks');
      
      // Check refresh limit even for force refresh (to prevent abuse)
      const canRefresh = await canRefreshData(userId);
      if (!canRefresh) {
        console.log('❌ Force refresh denied - daily limit reached');
        const cachedData = await getCachedData(userId, daysBack);
        return res.status(200).json(cachedData);
      }
    } else {
      // Check if we can refresh data (twice daily limit)
      const canRefresh = await canRefreshData(userId);
      
      // If we can't refresh, return cached data
      if (!canRefresh) {
        console.log('📦 Serving cached data (refresh limit reached)');
        const cachedData = await getCachedData(userId, daysBack);
        return res.status(200).json(cachedData);
      }
    }
    
    // Try to get cached data first (for comparison and fallback)
    const cachedData = await getCachedData(userId, daysBack);
    
    // FIXED: Better cache freshness logic
    if (!forceRefresh && cachedData.length > 0) {
      // Check if we have data from today
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const hasRecentData = cachedData.some(activity => 
        activity.start_date.startsWith(today)
      );
      
      // Check last refresh time
      const lastActivityTime = new Date(cachedData[0].fetched_at || cachedData[0].start_date);
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000); // FIXED: Reduced from 6 to 2 hours
      
      if (lastActivityTime > twoHoursAgo || hasRecentData) {
        console.log('📦 Serving fresh cached data (< 2 hours old or has today\'s data)');
        return res.status(200).json(cachedData);
      }
    }
    
    /* ––– Strava credentials ––– */
    const { 
      VITE_STRAVA_CLIENT_ID: clientId,
      VITE_STRAVA_CLIENT_SECRET: clientSecret,
      VITE_STRAVA_REFRESH_TOKEN: refreshToken 
    } = process.env;
    
    if (!clientId || !clientSecret || !refreshToken) {
      console.log('❌ Missing Strava credentials, serving cached data');
      return res.status(200).json(cachedData);
    }

    /* ––– Refresh access token ––– */
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
      console.error('❌ Strava token refresh failed, serving cached data');
      return res.status(200).json(cachedData);
    }
    
    const { access_token: accessToken } = await tokenResp.json();

    /* ––– Fetch activities list with FIXED date filtering ––– */
    console.log('📊 Fetching activities from Strava API...');
    
    // FIXED: Calculate date range more precisely
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - daysBack);
    startDate.setHours(0, 0, 0, 0); // Start of day
    
    const after = Math.floor(startDate.getTime() / 1000); // Unix timestamp for Strava API
    const before = Math.floor(today.getTime() / 1000); // Current time
    
    console.log(`📅 Fetching activities from ${startDate.toDateString()} to ${today.toDateString()}`);
    console.log(`📅 Unix timestamps: after=${after}, before=${before}`);
    
    // FIXED: Add both after AND before parameters to Strava API
    const stravaUrl = `https://www.strava.com/api/v3/athlete/activities?per_page=200&after=${after}&before=${before}`;
    console.log(`🌐 Strava API URL: ${stravaUrl}`);
    
    const listResp = await fetch(stravaUrl, { 
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        // Add cache busting for force refresh
        ...(forceRefresh && {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        })
      } 
    });

    /* ─── Rate limit check ─── */
    const usageHdr = listResp.headers.get('x-ratelimit-usage') || '0,0';
    const [shortUse] = usageHdr.split(',').map(Number);
    
    if (shortUse >= 95) {
      console.warn('⚠️ Strava rate limit nearly reached, serving cached data');
      return res.status(200).json(cachedData);
    }
    
    if (!listResp.ok) {
      console.error(`❌ Strava API error (${listResp.status}), serving cached data`);
      return res.status(200).json(cachedData);
    }
    
    const activitiesData = await listResp.json();
    console.log(`✅ Fetched ${activitiesData.length} activities from Strava API`);

    /* ––– Process activities with improved data structure ––– */
    const summaries = [];
    const batch = db.batch();
    const now = new Date().toISOString();

    for (const activity of activitiesData) {
      const minutes = Math.round(activity.moving_time / 60);
      const calories = estimateCalories(activity);
      
      // FIXED: Improved data structure with all necessary fields
      const summary = {
        userId,
        id: activity.id.toString(), // Ensure ID is string
        start_date: activity.start_date,
        date: activity.start_date.split('T')[0],
        name: activity.name,
        type: activity.type,
        distance: activity.distance / 1000, // Convert to km
        moving_time: activity.moving_time,
        elapsed_time: activity.elapsed_time,
        duration: minutes, // Duration in minutes
        total_elevation_gain: activity.total_elevation_gain || 0,
        elevation_gain: activity.total_elevation_gain || 0, // Alias
        average_speed: activity.average_speed,
        max_speed: activity.max_speed,
        has_heartrate: activity.has_heartrate || false,
        heart_rate: activity.has_heartrate ? activity.average_heartrate : null,
        average_heartrate: activity.average_heartrate,
        max_heartrate: activity.max_heartrate,
        calories: calories,
        caloriesBurned: calories, // Alias for consistency
        achievement_count: activity.achievement_count,
        kudos_count: activity.kudos_count,
        comment_count: activity.comment_count,
        athlete_count: activity.athlete_count,
        photo_count: activity.photo_count,
        suffer_score: activity.suffer_score,
        fetched_at: now,
        // Add debugging info
        _debug: {
          api_fetch_time: now,
          days_back: daysBack,
          force_refresh: forceRefresh
        }
      };

      summaries.push(summary);

      // Batch write to Firestore with better document ID
      const docRef = db.collection('strava_data').doc(`${userId}_${activity.id}_${activity.start_date.split('T')[0]}`);
      batch.set(docRef, summary, { merge: true });
    }

    // Commit all writes at once
    if (summaries.length > 0) {
      await batch.commit();
      console.log(`💾 Cached ${summaries.length} activities to Firestore`);
    }

    // FIXED: Sort by date (most recent first) before returning
    const sortedSummaries = summaries.sort((a, b) => 
      new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
    );

    // Log sample activities for debugging
    if (sortedSummaries.length > 0) {
      console.log('📋 Sample activities being returned:');
      sortedSummaries.slice(0, 3).forEach((activity, index) => {
        console.log(`${index + 1}. ${activity.name} - ${new Date(activity.start_date).toLocaleDateString()}`);
      });
    }

    // FIXED: Set appropriate cache headers
    if (forceRefresh) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
    }

    return res.status(200).json(sortedSummaries);
    
  } catch (error) {
    console.error('❌ Strava API handler error:', error);
    
    // Fallback to cached data on any error
    try {
      const userId = req.query.userId || 'mihir_jain';
      const daysBack = parseInt(req.query.days) || 30;
      const cachedData = await getCachedData(userId, daysBack);
      console.log(`📦 Serving ${cachedData.length} cached activities due to error`);
      return res.status(200).json(cachedData);
    } catch (cacheError) {
      console.error('❌ Failed to get cached data:', cacheError);
      return res.status(500).json({ error: 'Unable to fetch activity data' });
    }
  }
}
