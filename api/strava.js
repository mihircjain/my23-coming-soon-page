// api/strava.js - ENHANCED with incremental mode and run tagging support
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
/*  Auto-classify runs for tagging system                            */
/* ──────────────────────────────────────────────────────────────────── */
const autoTagRun = (activity) => {
  if (!activity.type?.toLowerCase().includes('run')) {
    return null; // Not a run
  }

  const distance = activity.distance || 0;
  const timeInMinutes = (activity.moving_time || 0) / 60;
  const paceMinPerKm = distance > 0 ? timeInMinutes / distance : 999;
  const avgHR = activity.average_heartrate || 0;

  // Long run detection (distance-based)
  if (distance >= 15) return 'long';
  if (distance >= 10 && paceMinPerKm > 5.5) return 'long';

  // Recovery run detection (very easy pace or low HR)
  if (distance <= 5 && paceMinPerKm > 6.5) return 'recovery';
  if (avgHR && avgHR < 140 && distance <= 8) return 'recovery';

  // Intervals detection (fast pace with moderate distance)
  if (paceMinPerKm < 4.0 && distance <= 10) return 'intervals';
  if (avgHR && avgHR > 170 && distance <= 8) return 'intervals';

  // Tempo detection (moderately fast pace, moderate distance)
  if (paceMinPerKm < 5.0 && distance >= 5 && distance <= 12) return 'tempo';
  if (avgHR && avgHR >= 155 && avgHR <= 170 && distance >= 5) return 'tempo';

  // Default to easy
  return 'easy';
};

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
    
    // Remove duplicates from deletion list
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
/*  Check if we can refresh data (rate limiting)                     */
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
      // Allow more refreshes
      await metadataRef.update({ 
        refreshCount: data.refreshCount + 1, 
        lastRefresh: new Date().toISOString() 
      });
      return true;
    }
    
    return false; // Rate limit reached
  } catch (error) {
    console.error('Error checking refresh limit:', error);
    return true; // Default to allowing refresh on error
  }
};

/* ──────────────────────────────────────────────────────────────────── */
/*  Get cached data from Firestore - ENHANCED for incremental mode   */
/* ──────────────────────────────────────────────────────────────────── */
const getCachedData = async (userId, daysBack = 30, includeRunTags = true) => {
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
      .limit(200)
      .get();
    
    // Deduplicate activities by activity ID
    const activityMap = new Map();
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const activityId = data.id || doc.id.split('_')[1];
      
      if (!activityMap.has(activityId)) {
        // Add run tag info if it's a run and has been tagged
        if (includeRunTags && data.type?.toLowerCase().includes('run')) {
          data.is_run_activity = true;
          data.run_tag = data.runType || null; // Map runType to run_tag for frontend
        }
        activityMap.set(activityId, data);
      } else {
        // If duplicate found, keep the one with more recent fetched_at
        const existing = activityMap.get(activityId);
        const existingTime = new Date(existing.fetched_at || existing.start_date);
        const currentTime = new Date(data.fetched_at || data.start_date);
        
        if (currentTime > existingTime) {
          if (includeRunTags && data.type?.toLowerCase().includes('run')) {
            data.is_run_activity = true;
            data.run_tag = data.runType || null;
          }
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
/*  Get only today's cached data (for incremental mode)              */
/* ──────────────────────────────────────────────────────────────────── */
const getTodaysCachedData = async (userId) => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const todayStart = `${today}T00:00:00.000Z`;
    const todayEnd = `${today}T23:59:59.999Z`;
    
    console.log(`📅 Getting today's cached data for ${today}`);
    
    const snapshot = await db
      .collection('strava_data')
      .where('userId', '==', userId)
      .where('start_date', '>=', todayStart)
      .where('start_date', '<=', todayEnd)
      .get();
    
    const todaysActivities = [];
    const activityIds = new Set();
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const activityId = data.id || doc.id.split('_')[1];
      
      if (!activityIds.has(activityId)) {
        if (data.type?.toLowerCase().includes('run')) {
          data.is_run_activity = true;
          data.run_tag = data.runType || null;
        }
        todaysActivities.push(data);
        activityIds.add(activityId);
      }
    });
    
    console.log(`📊 Found ${todaysActivities.length} unique activities for today`);
    return todaysActivities;
    
  } catch (error) {
    console.error('Error fetching today\'s cached data:', error);
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
/*  Main handler - ENHANCED with incremental mode                    */
/* ──────────────────────────────────────────────────────────────────── */
export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const userId = req.query.userId || 'mihir_jain';
    const forceRefresh = req.query.refresh === 'true' || req.query.forceRefresh === 'true';
    const daysBack = parseInt(req.query.days) || 30;
    const cleanup = req.query.cleanup === 'true';
    const cleanupStrategy = req.query.cleanupStrategy || 'activityId';
    const deepClean = req.query.deepClean === 'true';
    
    // NEW: Incremental mode - only fetch today's data + return cached older data
    const mode = req.query.mode || 'full'; // 'full' or 'incremental'
    
    console.log(`🚀 Strava API request: userId=${userId}, mode=${mode}, forceRefresh=${forceRefresh}, daysBack=${daysBack}`);
    console.log(`🧹 Cleanup options: cleanup=${cleanup}, strategy=${cleanupStrategy}, deepClean=${deepClean}`);
    
    // Run cleanup if requested
    if (cleanup || deepClean) {
      const strategy = deepClean ? 'all' : cleanupStrategy;
      const duplicatesRemoved = await cleanupDuplicates(userId, strategy);
      console.log(`🧹 Cleanup completed: ${duplicatesRemoved} duplicates removed (strategy: ${strategy})`);
    }
    
    // INCREMENTAL MODE: Fast loading for daily use
    if (mode === 'incremental' && !forceRefresh) {
      console.log('⚡ Incremental mode - fetching only today\'s new data');
      
      try {
        // 1. Get cached data for last 29 days (excluding today)
        const cachedData = await getCachedData(userId, daysBack - 1, true);
        
        // 2. Check if we have today's data cached already
        const todaysCached = await getTodaysCachedData(userId);
        
        // 3. If we have today's data and it's recent, return combined data
        if (todaysCached.length > 0) {
          const latestToday = todaysCached[0];
          const lastFetched = new Date(latestToday.fetched_at || latestToday.start_date);
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          
          if (lastFetched > oneHourAgo) {
            console.log(`📦 Serving cached data (today's data is fresh, fetched ${Math.round((Date.now() - lastFetched.getTime()) / 60000)} mins ago)`);
            const combinedData = [...todaysCached, ...cachedData]
              .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
            return res.status(200).json(combinedData);
          }
        }
        
        // 4. Fetch only today's activities from Strava
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
        
        const after = Math.floor(todayStart.getTime() / 1000);
        const before = Math.floor(todayEnd.getTime() / 1000);
        
        // Get Strava credentials
        const { 
          VITE_STRAVA_CLIENT_ID: clientId,
          VITE_STRAVA_CLIENT_SECRET: clientSecret,
          VITE_STRAVA_REFRESH_TOKEN: refreshToken 
        } = process.env;
        
        if (!clientId || !clientSecret || !refreshToken) {
          console.log('❌ Missing Strava credentials for incremental fetch, serving cached data');
          const combinedData = [...todaysCached, ...cachedData]
            .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
          return res.status(200).json(combinedData);
        }
        
        // Refresh access token
        console.log('🔑 Refreshing Strava access token for incremental fetch...');
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
          console.error('❌ Token refresh failed for incremental fetch, serving cached data');
          const combinedData = [...todaysCached, ...cachedData]
            .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
          return res.status(200).json(combinedData);
        }
        
        const { access_token: accessToken } = await tokenResp.json();
        
        // Fetch only today's activities
        console.log(`📅 Fetching only today's activities (${todayStart.toDateString()})`);
        const stravaUrl = `https://www.strava.com/api/v3/athlete/activities?per_page=50&after=${after}&before=${before}`;
        
        const listResp = await fetch(stravaUrl, { 
          headers: { Authorization: `Bearer ${accessToken}` } 
        });
        
        if (!listResp.ok) {
          console.error(`❌ Strava API error for incremental fetch (${listResp.status}), serving cached data`);
          const combinedData = [...todaysCached, ...cachedData]
            .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
          return res.status(200).json(combinedData);
        }
        
        const todaysActivitiesFromStrava = await listResp.json();
        console.log(`✅ Incremental fetch: ${todaysActivitiesFromStrava.length} activities found for today`);
        
        // Process and save today's activities
        const processedTodaysActivities = [];
        const batch = db.batch();
        const now = new Date().toISOString();
        
        for (const activity of todaysActivitiesFromStrava) {
          const minutes = Math.round(activity.moving_time / 60);
          let calories = typeof activity.calories === 'number' && activity.calories > 0 ? activity.calories : null;

          if (calories === null) {
            const detailedResp = await fetch(`https://www.strava.com/api/v3/activities/${activity.id}`, {
              headers: { Authorization: `Bearer ${accessToken}` }
            });

            if (detailedResp.ok) {
              const detailed = await detailedResp.json();
              calories = typeof detailed.calories === 'number' && detailed.calories > 0
                ? detailed.calories
                : 0;
            } else {
              console.warn(`⚠️ Could not fetch details for ${activity.id}, estimating calories`);
              calories = 0;
            }
          }
          
          const isRun = activity.type?.toLowerCase().includes('run');
          const autoTag = isRun ? autoTagRun(activity) : null;
          
          const summary = {
            userId,
            id: activity.id.toString(),
            start_date: activity.start_date,
            date: activity.start_date.split('T')[0],
            name: activity.name,
            type: activity.type,
            distance: activity.distance / 1000,
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
            fetched_at: now,
            // Run tagging fields
            is_run_activity: isRun,
            run_tag: autoTag,
            runType: autoTag, // Store in DB as runType
            autoClassified: autoTag ? true : false,
            taggedAt: autoTag ? now : null,
            taggedBy: autoTag ? 'auto' : null
          };

          processedTodaysActivities.push(summary);

          // Save to Firestore
          const docRef = db.collection('strava_data').doc(`${userId}_${activity.id}`);
          batch.set(docRef, summary, { merge: true });
        }
        
        // Commit today's activities
        if (processedTodaysActivities.length > 0) {
          await batch.commit();
          console.log(`💾 Cached ${processedTodaysActivities.length} new activities for today`);
        }
        
        // Combine today's data with cached data
        const allActivities = [...processedTodaysActivities, ...cachedData]
          .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
        
        console.log(`✅ Incremental mode complete: ${allActivities.length} total activities (${processedTodaysActivities.length} new today)`);
        
        // Set fast cache headers for incremental mode
        res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
        return res.status(200).json(allActivities);
        
      } catch (incrementalError) {
        console.error('❌ Incremental mode failed, falling back to cached data:', incrementalError);
        const fallbackData = await getCachedData(userId, daysBack, true);
        return res.status(200).json(fallbackData);
      }
    }
    
    // FULL MODE: Complete refresh (existing logic)
    console.log('🔄 Full mode - fetching all activities from Strava');
    
    // Rate limit check for full refresh
    if (forceRefresh) {
      console.log('🔄 Force refresh requested - bypassing cache checks');
      
      const canRefresh = await canRefreshData(userId);
      if (!canRefresh) {
        console.log('❌ Force refresh denied - daily limit reached');
        const cachedData = await getCachedData(userId, daysBack, true);
        return res.status(200).json(cachedData);
      }
    } else {
      const canRefresh = await canRefreshData(userId);
      
      if (!canRefresh) {
        console.log('📦 Serving cached data (refresh limit reached)');
        const cachedData = await getCachedData(userId, daysBack, true);
        return res.status(200).json(cachedData);
      }
    }
    
    // Try to get cached data first
    const cachedData = await getCachedData(userId, daysBack, true);
    
    // Better cache freshness logic
    if (!forceRefresh && cachedData.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      const hasRecentData = cachedData.some(activity => 
        activity.start_date.startsWith(today)
      );
      
      const lastActivityTime = new Date(cachedData[0].fetched_at || cachedData[0].start_date);
      const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
      
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

    /* ––– Process activities with run tagging support ––– */
    const summaries = [];
    const batch = db.batch();
    const now = new Date().toISOString();

    for (const activity of activitiesData) {
      const minutes = Math.round(activity.moving_time / 60);
      let calories = typeof activity.calories === 'number' && activity.calories > 0 ? activity.calories : null;

      if (calories === null) {
        const detailedResp = await fetch(`https://www.strava.com/api/v3/activities/${activity.id}`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (detailedResp.ok) {
          const detailed = await detailedResp.json();
          calories = typeof detailed.calories === 'number' && detailed.calories > 0
            ? detailed.calories
            : 0;
        } else {
          console.warn(`⚠️ Could not fetch details for ${activity.id}, estimating calories`);
          calories = 0;
        }
      }

      // Auto-tag runs
      const isRun = activity.type?.toLowerCase().includes('run');
      const autoTag = isRun ? autoTagRun(activity) : null;

      const summary = {
        userId,
        id: activity.id.toString(),
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
        fetched_at: now,
        // Enhanced: Run tagging fields
        is_run_activity: isRun,
        run_tag: autoTag, // For frontend compatibility
        runType: autoTag, // For database storage
        autoClassified: autoTag ? true : false,
        taggedAt: autoTag ? now : null,
        taggedBy: autoTag ? 'auto' : null,
        userOverride: false, // Will be set to true when user manually changes tag
        originalSuggestion: autoTag,
        confidenceScore: autoTag ? 0.8 : 0.0 // Default confidence for auto-classification
      };

      summaries.push(summary);

      // Use consistent document ID - userId_activityId
      const docRef = db.collection('strava_data').doc(`${userId}_${activity.id}`);
      batch.set(docRef, summary, { merge: true });
    }

    // Commit all writes at once
    if (summaries.length > 0) {
      await batch.commit();
      console.log(`💾 Cached ${summaries.length} activities to Firestore with run tagging`);
      
      // Log run tagging stats
      const runActivities = summaries.filter(a => a.is_run_activity);
      const taggedRuns = runActivities.filter(a => a.run_tag);
      console.log(`🏃 Run tagging stats: ${runActivities.length} runs found, ${taggedRuns.length} auto-tagged`);
      
      if (taggedRuns.length > 0) {
        const tagCounts = taggedRuns.reduce((acc, run) => {
          acc[run.run_tag] = (acc[run.run_tag] || 0) + 1;
          return acc;
        }, {});
        console.log(`🏷️ Tag distribution:`, tagCounts);
      }
    }

    // Sort by date (most recent first) before returning
    const sortedSummaries = summaries.sort((a, b) => 
      new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
    );

    // Log sample activities
    if (sortedSummaries.length > 0) {
      console.log('📋 Sample activities being returned:');
      sortedSummaries.slice(0, 3).forEach((activity, index) => {
        const runInfo = activity.is_run_activity ? ` (${activity.run_tag || 'untagged'} run)` : '';
        console.log(`${index + 1}. ${activity.name}${runInfo} - ${new Date(activity.start_date).toLocaleDateString()}`);
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
      const cachedData = await getCachedData(userId, daysBack, true);
      console.log(`📦 Serving ${cachedData.length} cached activities due to error`);
      return res.status(200).json(cachedData);
    } catch (cacheError) {
      console.error('❌ Failed to get cached data:', cacheError);
      return res.status(500).json({ error: 'Unable to fetch activity data' });
    }
  }
}
