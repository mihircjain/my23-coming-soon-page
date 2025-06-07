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
/*  Get cached data from Firestore                                   */
/* ──────────────────────────────────────────────────────────────────── */
const getCachedData = async (userId, daysBack = 30) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    
    const snapshot = await db
      .collection('strava_data')
      .where('userId', '==', userId)
      .where('start_date', '>=', cutoffDate.toISOString())
      .orderBy('start_date', 'desc')
      .limit(50)
      .get();
    
    return snapshot.docs.map(doc => doc.data());
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
/*  Main handler                                                      */
/* ──────────────────────────────────────────────────────────────────── */
export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const userId = req.query.userId || 'mihir_jain';
    const forceRefresh = req.query.refresh === 'true';
    const daysBack = parseInt(req.query.days) || 30;
    
    console.log(`Strava API request: userId=${userId}, forceRefresh=${forceRefresh}, daysBack=${daysBack}`);
    
    // Check if we can refresh data (twice daily limit)
    const canRefresh = await canRefreshData(userId);
    
    // If we can't refresh or don't want to, return cached data
    if (!forceRefresh && !canRefresh) {
      console.log('Serving cached data (refresh limit reached)');
      const cachedData = await getCachedData(userId, daysBack);
      return res.status(200).json(cachedData);
    }
    
    // Try to get cached data first anyway (for faster response)
    const cachedData = await getCachedData(userId, daysBack);
    const lastActivityDate = cachedData.length > 0 ? cachedData[0].start_date : null;
    
    // If we have recent cached data (less than 6 hours old) and no force refresh, use it
    if (!forceRefresh && lastActivityDate) {
      const lastActivity = new Date(lastActivityDate);
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
      
      if (lastActivity > sixHoursAgo) {
        console.log('Serving recent cached data (< 6 hours old)');
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
      console.log('Missing Strava credentials, serving cached data');
      return res.status(200).json(cachedData);
    }

    /* ––– Refresh access token ––– */
    console.log('Refreshing Strava access token...');
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
      console.error('Strava token refresh failed, serving cached data');
      return res.status(200).json(cachedData);
    }
    
    const { access_token: accessToken } = await tokenResp.json();

    /* ––– Fetch activities list (no individual detail calls) ––– */
    console.log('Fetching activities from Strava API...');
    const listResp = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?per_page=${Math.min(daysBack, 50)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    /* ─── Rate limit check ─── */
    const usageHdr = listResp.headers.get('x-ratelimit-usage') || '0,0';
    const [shortUse] = usageHdr.split(',').map(Number);
    
    if (shortUse >= 95) {
      console.warn('Strava rate limit nearly reached, serving cached data');
      return res.status(200).json(cachedData);
    }
    
    if (!listResp.ok) {
      console.error('Strava API error, serving cached data');
      return res.status(200).json(cachedData);
    }
    
    const activitiesData = await listResp.json();
    console.log(`Fetched ${activitiesData.length} activities from Strava`);

    /* ––– Process activities (no individual API calls) ––– */
    const summaries = [];
    const batch = db.batch();

    for (const activity of activitiesData) {
      const minutes = Math.round(activity.moving_time / 60);
      const calories = estimateCalories(activity); // Fast estimation, no API call
      
      const summary = {
        userId,
        start_date: activity.start_date,
        date: activity.start_date.split('T')[0],
        type: activity.type,
        heart_rate: activity.has_heartrate ? activity.average_heartrate : null,
        distance: activity.distance / 1000, // Convert to km
        duration: minutes,
        caloriesBurned: calories,
        elevation_gain: activity.total_elevation_gain || 0,
        name: activity.name,
        fetched_at: new Date().toISOString(),
      };

      summaries.push(summary);

      // Batch write to Firestore
      const docRef = db.collection('strava_data').doc(`${userId}_${activity.id}`);
      batch.set(docRef, summary, { merge: true });
    }

    // Commit all writes at once
    await batch.commit();
    console.log(`Cached ${activitiesData.length} activities to Firestore`);

    return res.status(200).json(summaries);
    
  } catch (error) {
    console.error('Strava API handler error:', error);
    
    // Fallback to cached data on any error
    try {
      const userId = req.query.userId || 'mihir_jain';
      const daysBack = parseInt(req.query.days) || 30;
      const cachedData = await getCachedData(userId, daysBack);
      console.log(`Serving ${cachedData.length} cached activities due to error`);
      return res.status(200).json(cachedData);
    } catch (cacheError) {
      console.error('Failed to get cached data:', cacheError);
      return res.status(500).json({ error: 'Unable to fetch activity data' });
    }
  }
}
