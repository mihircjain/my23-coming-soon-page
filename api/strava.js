// api/strava.js - OPTIMIZED: Cache-first approach, minimal API calls, no calorie estimation
// Serves cached data by default, only refreshes when explicitly requested

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
/*  Load existing run tags to preserve user modifications             */
/* ──────────────────────────────────────────────────────────────────── */
const loadExistingRunTags = async (userId) => {
  try {
    console.log('🏷️ Loading existing run tags...');
    
    const snapshot = await db
      .collection('strava_data')
      .where('userId', '==', userId)
      .where('is_run_activity', '==', true)
      .get();
    
    const existingTags = new Map();
    let userModifiedCount = 0;
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const activityId = data.id?.toString();
      
      if (activityId && data.runType) {
        existingTags.set(activityId, {
          runType: data.runType,
          run_tag: data.run_tag || data.runType,
          userOverride: data.userOverride === true,
          taggedBy: data.taggedBy || 'auto',
          taggedAt: data.taggedAt,
          originalSuggestion: data.originalSuggestion,
          hasDetailedAnalysis: data.hasDetailedAnalysis === true
        });
        
        if (data.userOverride === true) {
          userModifiedCount++;
        }
      }
    });
    
    console.log(`✅ Loaded ${existingTags.size} existing run tags (${userModifiedCount} user-modified)`);
    return existingTags;
    
  } catch (error) {
    console.error('❌ Error loading existing run tags:', error);
    return new Map();
  }
};

/* ──────────────────────────────────────────────────────────────────── */
/*  Get cached data from Firestore - OPTIMIZED for speed              */
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
    
    // Deduplicate activities by activity ID (prioritize user-tagged versions)
    const activityMap = new Map();
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const activityId = data.id || doc.id.split('_')[1];
      
      if (!activityMap.has(activityId)) {
        // Process the activity data - use calories as-is from Strava
        const processedActivity = {
          ...data,
          calories: data.calories || 0, // Use Strava calories directly, 0 if none
          is_run_activity: data.type?.toLowerCase().includes('run') || false
        };
        
        if (includeRunTags && processedActivity.is_run_activity) {
          processedActivity.run_tag = data.runType || null; // Map runType to run_tag for frontend
        }
        
        activityMap.set(activityId, processedActivity);
      } else {
        // If duplicate found, prefer user-tagged version, then most recent
        const existing = activityMap.get(activityId);
        const existingUserTagged = existing.userOverride === true;
        const currentUserTagged = data.userOverride === true;
        const existingHasDetailed = existing.hasDetailedAnalysis === true;
        const currentHasDetailed = data.hasDetailedAnalysis === true;
        
        let shouldReplace = false;
        
        if (currentUserTagged && !existingUserTagged) {
          shouldReplace = true;
        } else if (!currentUserTagged && existingUserTagged) {
          shouldReplace = false;
        } else if (currentHasDetailed && !existingHasDetailed) {
          shouldReplace = true;
        } else if (!currentHasDetailed && existingHasDetailed) {
          shouldReplace = false;
        } else {
          // Both have same tag/detailed status, use newer fetch time
          const existingTime = new Date(existing.fetched_at || existing.start_date);
          const currentTime = new Date(data.fetched_at || data.start_date);
          shouldReplace = currentTime > existingTime;
        }
        
        if (shouldReplace) {
          const processedActivity = {
            ...data,
            calories: data.calories || 0, // Use Strava calories directly, 0 if none
            is_run_activity: data.type?.toLowerCase().includes('run') || false
          };
          
          if (includeRunTags && processedActivity.is_run_activity) {
            processedActivity.run_tag = data.runType || null;
          }
          
          activityMap.set(activityId, processedActivity);
        }
      }
    });
    
    const cachedActivities = Array.from(activityMap.values());
    
    console.log(`📊 Found ${snapshot.docs.length} documents, ${cachedActivities.length} unique activities (no API calls made)`);
    
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
/*  Check cache freshness - determines if refresh is needed           */
/* ──────────────────────────────────────────────────────────────────── */
const shouldRefreshCache = async (userId, maxAgeHours = 2) => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const todayStart = `${today}T00:00:00.000Z`;
    const todayEnd = `${today}T23:59:59.999Z`;
    
    // Check if we have recent data from today
    const snapshot = await db
      .collection('strava_data')
      .where('userId', '==', userId)
      .where('start_date', '>=', todayStart)
      .where('start_date', '<=', todayEnd)
      .orderBy('fetched_at', 'desc')
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      console.log('📅 No activities found for today - recommend refresh');
      return true;
    }
    
    const latestDoc = snapshot.docs[0].data();
    const lastFetched = new Date(latestDoc.fetched_at || latestDoc.start_date);
    const hoursAgo = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    
    if (lastFetched < hoursAgo) {
      console.log(`📅 Data is ${Math.round((Date.now() - lastFetched.getTime()) / 60000)} minutes old - recommend refresh`);
      return true;
    }
    
    console.log(`📅 Data is fresh (${Math.round((Date.now() - lastFetched.getTime()) / 60000)} minutes old) - no refresh needed`);
    return false;
    
  } catch (error) {
    console.error('Error checking cache freshness:', error);
    return false; // Default to not refreshing on error
  }
};

/* ──────────────────────────────────────────────────────────────────── */
/*  Fetch fresh data from Strava API (only when explicitly requested) */
/* ──────────────────────────────────────────────────────────────────── */
const fetchFreshDataFromStrava = async (userId, daysBack = 30, preserveTags = true) => {
  console.log('🔄 Fetching fresh data from Strava API (this will use rate limit)');
  
  // Load existing run tags first
  let existingRunTags = new Map();
  if (preserveTags) {
    existingRunTags = await loadExistingRunTags(userId);
  }
  
  /* ––– Strava credentials ––– */
  const { 
    VITE_STRAVA_CLIENT_ID: clientId,
    VITE_STRAVA_CLIENT_SECRET: clientSecret,
    VITE_STRAVA_REFRESH_TOKEN: refreshToken 
  } = process.env;
  
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing Strava credentials');
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
    throw new Error(`Strava token refresh failed: ${tokenResp.status}`);
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
      Authorization: `Bearer ${accessToken}`
    } 
  });

  /* ─── Rate limit check ─── */
  const usageHdr = listResp.headers.get('x-ratelimit-usage') || '0,0';
  const [shortUse] = usageHdr.split(',').map(Number);
  console.log(`📊 Rate limit usage: ${shortUse}/600 (15min window)`);
  
  if (shortUse >= 550) {
    console.warn('⚠️ Approaching Strava rate limit');
  }
  
  if (!listResp.ok) {
    throw new Error(`Strava API error: ${listResp.status}`);
  }
  
  const activitiesData = await listResp.json();
  console.log(`✅ Fetched ${activitiesData.length} activities from Strava API (using 1 API call)`);

  /* ──── Process activities WITHOUT individual API calls ──── */
  const summaries = [];
  const batch = db.batch();
  const now = new Date().toISOString();
  let preservedTagsCount = 0;
  let newTagsCount = 0;

  for (const activity of activitiesData) {
    const activityId = activity.id.toString();
    const minutes = Math.round(activity.moving_time / 60);
    
    // Use Strava calories directly - NO ESTIMATION, NO ADDITIONAL API CALLS
    const calories = activity.calories || 0;

    const isRun = activity.type?.toLowerCase().includes('run');
    
    // Enhanced tag preservation logic
    let runTagInfo = null;
    if (isRun) {
      if (preserveTags && existingRunTags.has(activityId)) {
        // Use existing tag (preserve user modifications)
        runTagInfo = existingRunTags.get(activityId);
        preservedTagsCount++;
        console.log(`🏷️ Preserving tag for ${activityId}: ${runTagInfo.runType} (${runTagInfo.userOverride ? 'user-modified' : 'auto-tagged'})`);
      } else {
        // Generate new auto tag
        const autoTag = autoTagRun(activity);
        runTagInfo = {
          runType: autoTag,
          run_tag: autoTag,
          userOverride: false,
          taggedBy: 'auto',
          taggedAt: now,
          originalSuggestion: autoTag,
          autoClassified: true,
          confidenceScore: 0.8
        };
        newTagsCount++;
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
      duration: minutes,
      total_elevation_gain: activity.total_elevation_gain || 0,
      elevation_gain: activity.total_elevation_gain || 0,
      average_speed: activity.average_speed,
      max_speed: activity.max_speed,
      has_heartrate: activity.has_heartrate || false,
      heart_rate: activity.has_heartrate ? activity.average_heartrate : null,
      average_heartrate: activity.average_heartrate,
      max_heartrate: activity.max_heartrate,
      calories: calories, // Use Strava calories directly - no estimation
      achievement_count: activity.achievement_count,
      kudos_count: activity.kudos_count,
      comment_count: activity.comment_count,
      athlete_count: activity.athlete_count,
      photo_count: activity.photo_count,
      suffer_score: activity.suffer_score,
      fetched_at: now,
      is_run_activity: isRun,
      hasDetailedAnalysis: false,
      detailedAnalysisAvailable: isRun
    };

    // Add run tag info if it's a run
    if (isRun && runTagInfo) {
      summary.run_tag = runTagInfo.run_tag;
      summary.runType = runTagInfo.runType;
      summary.userOverride = runTagInfo.userOverride || false;
      summary.taggedBy = runTagInfo.taggedBy;
      summary.taggedAt = runTagInfo.taggedAt;
      summary.originalSuggestion = runTagInfo.originalSuggestion;
      summary.autoClassified = runTagInfo.autoClassified || false;
      summary.confidenceScore = runTagInfo.confidenceScore || 0.0;
      summary.hasDetailedAnalysis = runTagInfo.hasDetailedAnalysis || false;
    }

    summaries.push(summary);

    // Save to Firestore
    const docRef = db.collection('strava_data').doc(`${userId}_${activity.id}`);
    batch.set(docRef, summary, { merge: true });
  }

  // Commit all writes at once
  if (summaries.length > 0) {
    await batch.commit();
    console.log(`💾 Cached ${summaries.length} activities to Firestore (total API calls: 1)`);
    
    // Enhanced stats
    const runActivities = summaries.filter(a => a.is_run_activity);
    const taggedRuns = runActivities.filter(a => a.run_tag);
    const userModifiedRuns = taggedRuns.filter(a => a.userOverride === true);
    const activitiesWithCalories = summaries.filter(a => a.calories > 0);
    
    console.log(`🏃 Processing stats:`);
    console.log(`   - ${runActivities.length} runs found`);
    console.log(`   - ${taggedRuns.length} tagged runs`);
    console.log(`   - ${preservedTagsCount} tags preserved from existing data`);
    console.log(`   - ${newTagsCount} new auto-tags generated`);
    console.log(`   - ${userModifiedRuns.length} user-modified tags preserved`);
    console.log(`   - ${activitiesWithCalories.length} activities with Strava calories`);
    console.log(`   - Total API calls used: 1 (token + list only)`);
  }

  return summaries.sort((a, b) => 
    new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
  );
};

/* ──────────────────────────────────────────────────────────────────── */
/*  Main handler - OPTIMIZED: Cache-first, minimal API usage         */
/* ──────────────────────────────────────────────────────────────────── */
export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const userId = req.query.userId || 'mihir_jain';
    const forceRefresh = req.query.refresh === 'true' || req.query.forceRefresh === 'true';
    const daysBack = parseInt(req.query.days) || 30;
    const mode = req.query.mode || 'cached'; // 'cached' (default) or 'refresh'
    const preserveTags = req.query.preserveTags !== 'false'; // Default to true
    
    console.log(`🚀 OPTIMIZED Strava API: userId=${userId}, mode=${mode}, daysBack=${daysBack}, forceRefresh=${forceRefresh}`);
    
    // CACHE-FIRST APPROACH: Default behavior is to serve cached data
    if (!forceRefresh && mode === 'cached') {
      console.log('⚡ Cache-first mode - serving cached data instantly');
      
      try {
        const cachedData = await getCachedData(userId, daysBack, true);
        
        if (cachedData.length > 0) {
          console.log(`📦 Serving ${cachedData.length} cached activities (0 API calls used)`);
          
          // Set fast cache headers
          res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
          res.setHeader('X-Data-Source', 'firestore-cache');
          res.setHeader('X-API-Calls', '0');
          
          return res.status(200).json(cachedData);
        } else {
          console.log('📦 No cached data found - recommend refresh');
          return res.status(404).json({ 
            error: 'No cached data available',
            message: 'Please refresh to load data from Strava',
            recommendRefresh: true
          });
        }
      } catch (cacheError) {
        console.error('❌ Cache retrieval failed:', cacheError);
        return res.status(500).json({ 
          error: 'Cache retrieval failed',
          message: 'Unable to load cached data'
        });
      }
    }
    
    // REFRESH MODE: Only when explicitly requested
    if (forceRefresh || mode === 'refresh') {
      console.log('🔄 Refresh mode - fetching fresh data from Strava');
      
      try {
        // Check cache freshness first
        const needsRefresh = await shouldRefreshCache(userId, 2); // 2 hours
        
        if (!forceRefresh && !needsRefresh) {
          console.log('📅 Data is fresh - serving cached data instead of API call');
          const cachedData = await getCachedData(userId, daysBack, true);
          
          res.setHeader('Cache-Control', 'public, max-age=600'); // 10 minutes
          res.setHeader('X-Data-Source', 'fresh-cache');
          res.setHeader('X-API-Calls', '0');
          
          return res.status(200).json(cachedData);
        }
        
        // Fetch fresh data (uses 1 API call)
        const freshData = await fetchFreshDataFromStrava(userId, daysBack, preserveTags);
        
        console.log(`✅ Fresh data fetched and cached: ${freshData.length} activities (1 API call used)`);
        
        // Set appropriate cache headers
        res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
        res.setHeader('X-Data-Source', 'strava-api');
        res.setHeader('X-API-Calls', '1');
        
        return res.status(200).json(freshData);
        
      } catch (refreshError) {
        console.error('❌ Refresh failed:', refreshError);
        
        // Fallback to cached data on refresh failure
        try {
          const fallbackData = await getCachedData(userId, daysBack, true);
          if (fallbackData.length > 0) {
            console.log(`📦 Refresh failed - serving ${fallbackData.length} cached activities as fallback`);
            
            res.setHeader('X-Data-Source', 'fallback-cache');
            res.setHeader('X-API-Calls', '0');
            res.setHeader('X-Refresh-Error', 'true');
            
            return res.status(200).json(fallbackData);
          }
        } catch (fallbackError) {
          console.error('❌ Fallback cache also failed:', fallbackError);
        }
        
        // Check if it's a rate limiting error
        const isRateLimit = refreshError.message.includes('429') || 
                           refreshError.message.includes('Too Many Requests');
        
        return res.status(isRateLimit ? 429 : 500).json({
          error: isRateLimit ? 'Rate limit exceeded' : 'Refresh failed',
          message: isRateLimit 
            ? 'Strava API rate limit reached. Using cached data.' 
            : 'Unable to refresh data from Strava',
          isRateLimit,
          retryAfter: isRateLimit ? 900 : null // 15 minutes
        });
      }
    }
    
    // TODAY MODE: Quick incremental refresh (minimal API usage)
    if (mode === 'today') {
      console.log('📅 Today mode - checking only for today\'s activities');
      
      try {
        // Get cached data from last 29 days
        const cachedData = await getCachedData(userId, daysBack - 1, true);
        
        // Check if we need to fetch today's data
        const needsTodayRefresh = await shouldRefreshCache(userId, 1); // 1 hour
        
        if (!needsTodayRefresh) {
          console.log('📅 Today\'s data is fresh - serving cached data');
          
          res.setHeader('Cache-Control', 'public, max-age=300');
          res.setHeader('X-Data-Source', 'today-cache');
          res.setHeader('X-API-Calls', '0');
          
          return res.status(200).json(cachedData);
        }
        
        // Fetch only today's activities (minimal API usage)
        console.log('📅 Fetching today\'s activities only');
        const todayData = await fetchFreshDataFromStrava(userId, 1, preserveTags); // Just today
        
        // Combine with cached data
        const combinedData = [...todayData, ...cachedData]
          .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
        
        // Remove duplicates by activity ID
        const uniqueData = Array.from(
          new Map(combinedData.map(activity => [activity.id, activity])).values()
        );
        
        console.log(`📅 Today mode complete: ${todayData.length} new + ${cachedData.length} cached = ${uniqueData.length} total (1 API call)`);
        
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.setHeader('X-Data-Source', 'today-refresh');
        res.setHeader('X-API-Calls', '1');
        
        return res.status(200).json(uniqueData);
        
      } catch (todayError) {
        console.error('❌ Today mode failed:', todayError);
        
        // Fallback to full cached data
        const fallbackData = await getCachedData(userId, daysBack, true);
        
        res.setHeader('X-Data-Source', 'today-fallback');
        res.setHeader('X-API-Calls', '0');
        
        return res.status(200).json(fallbackData);
      }
    }
    
    // Default fallback
    const cachedData = await getCachedData(userId, daysBack, true);
    
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('X-Data-Source', 'default-cache');
    res.setHeader('X-API-Calls', '0');
    
    return res.status(200).json(cachedData);
    
  } catch (error) {
    console.error('❌ Optimized Strava API error:', error);
    
    // Ultimate fallback to cached data
    try {
      const userId = req.query.userId || 'mihir_jain';
      const daysBack = parseInt(req.query.days) || 30;
      const fallbackData = await getCachedData(userId, daysBack, true);
      
      if (fallbackData.length > 0) {
        console.log(`📦 Error fallback: serving ${fallbackData.length} cached activities`);
        
        res.setHeader('X-Data-Source', 'error-fallback');
        res.setHeader('X-API-Calls', '0');
        
        return res.status(200).json(fallbackData);
      }
    } catch (fallbackError) {
      console.error('❌ Ultimate fallback failed:', fallbackError);
    }
    
    return res.status(500).json({ 
      error: 'Unable to fetch activity data',
      message: 'All data sources failed'
    });
  }
}
