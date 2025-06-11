// api/strava.js - FIXED with duplicate prevention and cleanup
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
/*  ENHANCED: Multiple cleanup strategies                             */
/* ──────────────────────────────────────────────────────────────────── */
const cleanupDuplicates = async (userId, strategy = 'activityId') => {
  try {
    console.log(`🧹 Running cleanup strategy: ${strategy}`);
    
    const snapshot = await db
      .collection('strava_data')
      .where('userId', '==', userId)
      .get();
    
    const duplicatesToDelete = [];
    
    if (strategy === 'activityId' || strategy === 'all') {
      // Strategy 1: Group by activity ID, keep newest
      const activityGroups = new Map();
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const activityId = data.id || doc.id.split('_')[1]?.split('_')[0];
        
        if (!activityId) return;
        
        if (!activityGroups.has(activityId)) {
          activityGroups.set(activityId, []);
        }
        
        activityGroups.get(activityId).push({
          docRef: doc.ref,
          docId: doc.id,
          fetchedAt: new Date(data.fetched_at || data.start_date || '1970-01-01')
        });
      });
      
      // Find duplicates and mark older ones for deletion
      activityGroups.forEach((docs, activityId) => {
        if (docs.length > 1) {
          docs.sort((a, b) => b.fetchedAt.getTime() - a.fetchedAt.getTime());
          const [keeper, ...toDelete] = docs;
          
          console.log(`🔍 Activity ${activityId}: keeping ${keeper.docId}, deleting ${toDelete.length} duplicates`);
          duplicatesToDelete.push(...toDelete.map(doc => doc.docRef));
        }
      });
    }
    
    if (strategy === 'dateAndName' || strategy === 'all') {
      // Strategy 2: Group by date + name, keep newest
      const dateNameGroups = new Map();
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const dateKey = data.start_date?.split('T')[0] || 'unknown';
        const nameKey = (data.name || 'unnamed').toLowerCase().trim();
        const compositeKey = `${dateKey}_${nameKey}`;
        
        if (!dateNameGroups.has(compositeKey)) {
          dateNameGroups.set(compositeKey, []);
        }
        
        dateNameGroups.get(compositeKey).push({
          docRef: doc.ref,
          docId: doc.id,
          fetchedAt: new Date(data.fetched_at || data.start_date || '1970-01-01')
        });
      });
      
      dateNameGroups.forEach((docs, key) => {
        if (docs.length > 1) {
          docs.sort((a, b) => b.fetchedAt.getTime() - a.fetchedAt.getTime());
          const [keeper, ...toDelete] = docs;
          
          console.log(`🔍 Date+Name ${key}: keeping ${keeper.docId}, deleting ${toDelete.length} duplicates`);
          duplicatesToDelete.push(...toDelete.map(doc => doc.docRef));
        }
      });
    }
    
    // Remove duplicates from deletion list (in case multiple strategies mark same doc)
    const uniqueDeletes = Array.from(new Set(duplicatesToDelete.map(ref => ref.path)))
      .map(path => duplicatesToDelete.find(ref => ref.path === path));
    
    console.log(`🗑️ Total unique documents to delete: ${uniqueDeletes.length}`);
    
    // Execute batch deletes
    if (uniqueDeletes.length > 0) {
      const batchSize = 500;
      let deletedCount = 0;
      
      for (let i = 0; i < uniqueDeletes.length; i += batchSize) {
        const batch = db.batch();
        const batchItems = uniqueDeletes.slice(i, i + batchSize);
        
        batchItems.forEach(docRef => {
          batch.delete(docRef);
        });
        
        await batch.commit();
        deletedCount += batchItems.length;
        
        console.log(`✅ Deleted batch ${Math.floor(i/batchSize) + 1}: ${deletedCount}/${uniqueDeletes.length} documents`);
      }
    }
    
    return uniqueDeletes.length;
  } catch (error) {
    console.error('❌ Error cleaning up duplicates:', error);
    return 0;
  }
};

/* ──────────────────────────────────────────────────────────────────── */
/*  Check if we can refresh data (twice daily limit)                 */
/* ──────────────────────────────────────────────────────────────────── */
const canRefreshData = async (userId) => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const metadataRef = db.collection('strava_metadata').doc(`${userId}_${today}`);
    const metadataDoc = await metadataRef.get();
    
    if (!metadataDoc.exists) {
      // First refresh of the day
      await metadataRef.set({ refreshCount: 1, lastRefresh: new Date().toISOString() });
      return true;
    }
    
    const data = metadataDoc.data();
    if (data.refreshCount < 150) {
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
/*  Get cached data from Firestore - FIXED duplicate handling        */
/* ──────────────────────────────────────────────────────────────────── */
const getCachedData = async (userId, daysBack = 30) => {
  try {
    // Calculate cutoff date from TODAY
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    cutoffDate.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    console.log(`📅 Getting cached data from ${cutoffDate.toISOString()} to ${today.toISOString()}`);
    
    const snapshot = await db
      .collection('strava_data')
      .where('userId', '==', userId)
      .where('start_date', '>=', cutoffDate.toISOString())
      .where('start_date', '<=', today.toISOString())
      .orderBy('start_date', 'desc')
      .limit(200) // Increased to handle potential duplicates
      .get();
    
    // FIXED: Deduplicate activities by activity ID
    const activityMap = new Map();
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const activityId = data.id || doc.id.split('_')[1];
      
      if (!activityMap.has(activityId)) {
        activityMap.set(activityId, data);
      } else {
        // If duplicate found, keep the one with more recent fetched_at
        const existing = activityMap.get(activityId);
        const existingTime = new Date(existing.fetched_at || existing.start_date);
        const currentTime = new Date(data.fetched_at || data.start_date);
        
        if (currentTime > existingTime) {
          activityMap.set(activityId, data);
        }
      }
    });
    
    const cachedActivities = Array.from(activityMap.values());
    console.log(`📊 Found ${snapshot.docs.length} documents, ${cachedActivities.length} unique activities`);
    
    // Log if duplicates were found
    if (snapshot.docs.length > cachedActivities.length) {
      console.log(`⚠️ Found ${snapshot.docs.length - cachedActivities.length} duplicate documents`);
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
  if (activity.calories) return activity.calories;
  
  const minutes = Math.round(activity.moving_time / 60);
  const type = activity.type?.toLowerCase() || '';
  
  if (type.includes('run')) {
    return Math.round(minutes * 12);
  } else if (type.includes('weighttraining') || type.includes('strength')) {
    return Math.round(minutes * 8);
  } else if (type.includes('walk')) {
    return Math.round(minutes * 5);
  } else if (type.includes('bike') || type.includes('cycling')) {
    return Math.round(minutes * 10);
  }
  
  return Math.round(minutes * 7);
};

/* ──────────────────────────────────────────────────────────────────── */
/*  Main handler - FIXED with duplicate prevention                   */
/* ──────────────────────────────────────────────────────────────────── */
export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const userId = req.query.userId || 'mihir_jain';
    const forceRefresh = req.query.refresh === 'true' || req.query.forceRefresh === 'true';
    const daysBack = parseInt(req.query.days) || 30;
    const cleanup = req.query.cleanup === 'true'; // Basic cleanup
    const cleanupStrategy = req.query.cleanupStrategy || 'activityId'; // 'activityId', 'dateAndName', 'all'
    const deepClean = req.query.deepClean === 'true'; // More aggressive cleanup
    
    console.log(`🚀 Strava API request: userId=${userId}, forceRefresh=${forceRefresh}, daysBack=${daysBack}`);
    console.log(`🧹 Cleanup options: cleanup=${cleanup}, strategy=${cleanupStrategy}, deepClean=${deepClean}`);
    
    // ENHANCED: Run cleanup with specified strategy
    if (cleanup || deepClean) {
      const strategy = deepClean ? 'all' : cleanupStrategy;
      const duplicatesRemoved = await cleanupDuplicates(userId, strategy);
      console.log(`🧹 Cleanup completed: ${duplicatesRemoved} duplicates removed (strategy: ${strategy})`);
    }
    
    // For force refresh, bypass all cache checks
    if (forceRefresh) {
      console.log('🔄 Force refresh requested - bypassing all cache checks');
      
      const canRefresh = await canRefreshData(userId);
      if (!canRefresh) {
        console.log('❌ Force refresh denied - daily limit reached');
        const cachedData = await getCachedData(userId, daysBack);
        return res.status(200).json(cachedData);
      }
    } else {
      const canRefresh = await canRefreshData(userId);
      
      if (!canRefresh) {
        console.log('📦 Serving cached data (refresh limit reached)');
        const cachedData = await getCachedData(userId, daysBack);
        return res.status(200).json(cachedData);
      }
    }
    
    // Try to get cached data first
    const cachedData = await getCachedData(userId, daysBack);
    
    // Better cache freshness logic
    if (!forceRefresh && cachedData.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      const hasRecentData = cachedData.some(activity => 
        activity.start_date.startsWith(today)
      );
      
      const lastActivityTime = new Date(cachedData[0].fetched_at || cachedData[0].start_date);
      const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000); // REDUCED to 1 hour
      
      if (lastActivityTime > oneHourAgo || hasRecentData) {
        console.log('📦 Serving fresh cached data (< 1 hour old or has today\'s data)');
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

    /* ––– Fetch activities with proper date filtering ––– */
    console.log('📊 Fetching activities from Strava API...');
    
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - daysBack);
    startDate.setHours(0, 0, 0, 0);
    
    const after = Math.floor(startDate.getTime() / 1000);
    const before = Math.floor(today.getTime() / 1000);
    
    console.log(`📅 Fetching activities from ${startDate.toDateString()} to ${today.toDateString()}`);
    
    const stravaUrl = `https://www.strava.com/api/v3/athlete/activities?per_page=200&after=${after}&before=${before}`;
    
    const listResp = await fetch(stravaUrl, { 
      headers: { 
        Authorization: `Bearer ${accessToken}`,
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

    /* ––– FIXED: Process activities with consistent document IDs ––– */
    const summaries = [];
    const batch = db.batch();
    const now = new Date().toISOString();

    for (const activity of activitiesData) {
      const minutes = Math.round(activity.moving_time / 60);
      //const calories = typeof activity.calories === 'number' ? activity.calories : estimateCalories(activity);
      const calories  = activity.calories;
      const summary = {
        userId,
        id: activity.id.toString(), // ENSURE activity ID is stored
        start_date: activity.start_date,
        date: activity.start_date.split('T')[0],
        name: activity.name,
        type: activity.type,
        distance: activity.distance / 1000, // Convert to km
        moving_time: activity.moving_time,
        elapsed_time: activity.elapsed_time,
        duration: minutes,
        total_elevation_gain: activity.total_elevation_gain || 0,
        elevation_gain: activity.total_elevation_gain || 0,
        average_speed: activity.average_speed,
        max_speed: activity.max_speed,
        has_heartrate: activity.has_heartrate || false,
        heart_rate: activity.has_heartrate ? activity.average_heartrate : null,
        average_heartrate: activity.average_heartrate,
        max_heartrate: activity.max_heartrate,
        calories: calories,
        achievement_count: activity.achievement_count,
        kudos_count: activity.kudos_count,
        comment_count: activity.comment_count,
        athlete_count: activity.athlete_count,
        photo_count: activity.photo_count,
        suffer_score: activity.suffer_score,
        fetched_at: now
      };

      summaries.push(summary);

      // FIXED: Use consistent document ID - just userId_activityId
      const docRef = db.collection('strava_data').doc(`${userId}_${activity.id}`);
      batch.set(docRef, summary, { merge: true });
    }

    // Commit all writes at once
    if (summaries.length > 0) {
      await batch.commit();
      console.log(`💾 Cached ${summaries.length} activities to Firestore`);
    }

    // Sort by date (most recent first) before returning
    const sortedSummaries = summaries.sort((a, b) => 
      new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
    );

    // Log sample activities
    if (sortedSummaries.length > 0) {
      console.log('📋 Sample activities being returned:');
      sortedSummaries.slice(0, 3).forEach((activity, index) => {
        console.log(`${index + 1}. ${activity.name} - ${new Date(activity.start_date).toLocaleDateString()}`);
      });
    }

    // Set appropriate cache headers
    if (forceRefresh) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=300');
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
