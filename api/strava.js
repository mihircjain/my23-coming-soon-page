// api/strava.js - FIXED: Proper calorie fetching from detailed endpoint
// ✅ Summary endpoint for activity list (fast)
// ✅ Detailed endpoint for missing calories (per activity)
// ✅ Rate-limit aware
// ✅ Preserves existing calories and run tags

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
/*  Auto-classify runs for tagging system                            */
/* ──────────────────────────────────────────────────────────────────── */
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
/*  Load existing activity data to preserve calories                  */
/* ──────────────────────────────────────────────────────────────────── */
const loadExistingActivityData = async (userId, activityIds) => {
  try {
    console.log(`🔍 Loading existing data for ${activityIds.length} activities...`);
    
    const existingData = new Map();
    
    // Process in batches of 10 (Firestore 'in' query limit)
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
            calorie_source: data.calorie_source || 'unknown',
            hasDetailedAnalysis: data.hasDetailedAnalysis || false,
            // Preserve other data
            suffer_score: data.suffer_score,
            gear: data.gear,
            calories_recovered: data.calories_recovered,
            last_calorie_fetch: data.last_calorie_fetch
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

/* ──────────────────────────────────────────────────────────────────── */
/*  Check Strava rate limit from response headers                    */
/* ──────────────────────────────────────────────────────────────────── */
const checkRateLimit = (response) => {
  const usage = response.headers.get('x-ratelimit-usage');
  const limit = response.headers.get('x-ratelimit-limit');
  
  if (usage && limit) {
    const [fifteenMin, daily] = usage.split(',').map(Number);
    const [fifteenMinLimit, dailyLimit] = limit.split(',').map(Number);
    
    console.log(`📊 Rate limit: ${fifteenMin}/${fifteenMinLimit} (15min), ${daily}/${dailyLimit} (daily)`);
    
    return {
      fifteenMin,
      daily,
      fifteenMinLimit,
      dailyLimit,
      nearLimit: fifteenMin >= fifteenMinLimit * 0.8 || daily >= dailyLimit * 0.8
    };
  }
  return null;
};

/* ──────────────────────────────────────────────────────────────────── */
/*  🔥 NEW: Fetch calories from detailed endpoint                     */
/* ──────────────────────────────────────────────────────────────────── */
const fetchCaloriesForActivity = async (accessToken, activityId) => {
  try {
    const detailedUrl = `https://www.strava.com/api/v3/activities/${activityId}`;
    
    const response = await fetch(detailedUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    const rateLimitInfo = checkRateLimit(response);
    
    if (!response.ok) {
      if (response.status === 429) {
        return { rateLimited: true, rateLimitInfo };
      }
      throw new Error(`Failed to fetch activity ${activityId}: ${response.status}`);
    }
    
    const detailedActivity = await response.json();
    
    return {
      id: activityId,
      calories: detailedActivity.calories || 0,
      rateLimited: false,
      rateLimitInfo
    };
    
  } catch (error) {
    console.error(`❌ Error fetching calories for ${activityId}:`, error);
    throw error;
  }
};

/* ──────────────────────────────────────────────────────────────────── */
/*  🔥 NEW: Fetch missing calories for activities                     */
/* ──────────────────────────────────────────────────────────────────── */
const fetchMissingCalories = async (accessToken, activities, existingData) => {
  // Find activities that need calories
  const activitiesNeedingCalories = activities.filter(activity => {
    const activityId = activity.id?.toString();
    const existing = existingData.get(activityId);
    
    // Skip if we already have calories
    if (existing && existing.calories > 0) {
      return false;
    }
    
    // Only fetch for activity types that Strava calculates calories for
    const activityType = (activity.type || '').toLowerCase();
    return activityType.includes('run') || 
           activityType.includes('walk') || 
           activityType.includes('hike') || 
           activityType.includes('ride') || 
           activityType.includes('bike');
  });
  
  console.log(`🔥 Found ${activitiesNeedingCalories.length} activities needing calories`);
  
  if (activitiesNeedingCalories.length === 0) {
    return { calorieData: new Map(), fetched: 0, rateLimited: false };
  }
  
  const results = {
    calorieData: new Map(),
    fetched: 0,
    failed: 0,
    rateLimited: false
  };
  
  // Limit to prevent rate limiting - be conservative
  const maxRequests = 15;
  const activitiesToFetch = activitiesNeedingCalories.slice(0, maxRequests);
  
  console.log(`🔄 Fetching calories for ${activitiesToFetch.length} activities (max ${maxRequests})`);
  
  for (const activity of activitiesToFetch) {
    try {
      const calorieData = await fetchCaloriesForActivity(accessToken, activity.id);
      
      if (calorieData.rateLimited) {
        console.log('🚫 Rate limited, stopping calorie fetching');
        results.rateLimited = true;
        break;
      }
      
      if (calorieData.calories > 0) {
        results.calorieData.set(activity.id?.toString(), {
          calories: calorieData.calories,
          calorie_source: 'strava_detailed_api',
          last_calorie_fetch: new Date().toISOString()
        });
        
        console.log(`✅ Found ${calorieData.calories} calories for activity ${activity.id}`);
        results.fetched++;
      } else {
        console.log(`⚠️ No calories for activity ${activity.id}`);
        results.failed++;
      }
      
      // Small delay to be nice to the API
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`❌ Failed to fetch calories for ${activity.id}:`, error);
      results.failed++;
    }
  }
  
  console.log(`🎯 Calorie fetching complete: ${results.fetched} found, ${results.failed} failed`);
  
  return results;
};

/* ──────────────────────────────────────────────────────────────────── */
/*  Get cached data from Firestore                                   */
/* ──────────────────────────────────────────────────────────────────── */
const getCachedData = async (userId, daysBack = 30, includeRunTags = true) => {
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
        
        if (includeRunTags && processedActivity.is_run_activity) {
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

/* ──────────────────────────────────────────────────────────────────── */
/*  🔥 ENHANCED: Fetch fresh data with calorie fetching               */
/* ──────────────────────────────────────────────────────────────────── */
const fetchFreshDataFromStrava = async (userId, daysBack = 30, preserveTags = true) => {
  console.log('🔄 Fetching fresh data from Strava API with calorie fetching');
  
  // Load existing run tags first
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

  // 1. Fetch activities from summary endpoint (fast, no calories)
  const today = new Date();
  const startDate = new Date();
  startDate.setDate(today.getDate() - daysBack);
  startDate.setHours(0, 0, 0, 0);
  
  const after = Math.floor(startDate.getTime() / 1000);
  const before = Math.floor(today.getTime() / 1000);
  
  const stravaUrl = `https://www.strava.com/api/v3/athlete/activities?per_page=200&after=${after}&before=${before}`;
  
  console.log('📡 Fetching activity list from summary endpoint...');
  const listResp = await fetch(stravaUrl, { 
    headers: { Authorization: `Bearer ${accessToken}` } 
  });
  
  if (!listResp.ok) {
    throw new Error(`Strava API error: ${listResp.status}`);
  }
  
  const activitiesData = await listResp.json();
  console.log(`✅ Fetched ${activitiesData.length} activities from summary endpoint`);

  // 2. Load existing calorie data
  const activityIds = activitiesData.map(a => a.id.toString());
  const existingActivityData = await loadExistingActivityData(userId, activityIds);

  // 3. Fetch missing calories from detailed endpoint
  const calorieResults = await fetchMissingCalories(accessToken, activitiesData, existingActivityData);

  // 4. Process activities with calorie data
  const summaries = [];
  const batch = db.batch();
  const now = new Date().toISOString();
  let preservedTagsCount = 0;
  let newTagsCount = 0;
  let preservedCaloriesCount = 0;
  let newCaloriesCount = 0;
  let detailedCaloriesCount = 0;

  for (const activity of activitiesData) {
    const activityId = activity.id.toString();
    const isRun = activity.type?.toLowerCase().includes('run');
    
    // Handle calories with priority: detailed API > existing > summary > 0
    const existingActivity = existingActivityData.get(activityId);
    const detailedCalories = calorieResults.calorieData.get(activityId);
    
    let calories = 0;
    let calorieSource = 'none';
    
    if (detailedCalories && detailedCalories.calories > 0) {
      // New calories from detailed API
      calories = detailedCalories.calories;
      calorieSource = 'strava_detailed_api';
      newCaloriesCount++;
      detailedCaloriesCount++;
      console.log(`🆕 Fresh calories from detailed API for ${activityId}: ${calories}`);
    } else if (activity.calories && activity.calories > 0) {
      // Calories from summary (rare)
      calories = activity.calories;
      calorieSource = 'strava_summary';
      newCaloriesCount++;
    } else if (existingActivity && existingActivity.calories > 0) {
      // Preserve existing calories
      calories = existingActivity.calories;
      calorieSource = existingActivity.calorie_source || 'preserved';
      preservedCaloriesCount++;
    }

    // Handle run tags
    let runTagInfo = null;
    if (isRun) {
      if (preserveTags && existingRunTags.has(activityId)) {
        runTagInfo = existingRunTags.get(activityId);
        preservedTagsCount++;
      } else {
        const autoTag = autoTagRun(activity);
        runTagInfo = {
          runType: autoTag,
          run_tag: autoTag,
          userOverride: false,
          taggedBy: 'auto',
          taggedAt: now
        };
        newTagsCount++;
      }
    }

    // Build summary
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
      calories: calories, // 🔥 CALORIES FROM DETAILED API OR PRESERVED
      calorie_source: calorieSource,
      achievement_count: activity.achievement_count,
      kudos_count: activity.kudos_count,
      comment_count: activity.comment_count,
      athlete_count: activity.athlete_count,
      photo_count: activity.photo_count,
      suffer_score: activity.suffer_score || (existingActivity?.suffer_score),
      fetched_at: now,
      is_run_activity: isRun,
      hasDetailedAnalysis: existingActivity?.hasDetailedAnalysis || false
    };

    // Add detailed calorie metadata if fetched
    if (detailedCalories) {
      summary.last_calorie_fetch = detailedCalories.last_calorie_fetch;
    }

    // Add run tag info
    if (isRun && runTagInfo) {
      summary.run_tag = runTagInfo.run_tag;
      summary.runType = runTagInfo.runType;
      summary.userOverride = runTagInfo.userOverride || false;
      summary.taggedBy = runTagInfo.taggedBy;
      summary.taggedAt = runTagInfo.taggedAt;
    }

    summaries.push(summary);

    // Save to Firestore
    const docRef = db.collection('strava_data').doc(`${userId}_${activity.id}`);
    batch.set(docRef, summary, { merge: true });
  }

  // Commit all writes
  if (summaries.length > 0) {
    await batch.commit();
    
    const activitiesWithCalories = summaries.filter(a => a.calories > 0);
    const runActivities = summaries.filter(a => a.is_run_activity);
    
    console.log(`💾 Cached ${summaries.length} activities to Firestore`);
    console.log(`🏃 FINAL STATS:`);
    console.log(`   - ${summaries.length} activities processed`);
    console.log(`   - ${runActivities.length} runs found`);
    console.log(`   - ${preservedTagsCount} run tags preserved`);
    console.log(`   - ${newTagsCount} new run tags generated`);
    console.log(`   - ${activitiesWithCalories.length} activities with calories`);
    console.log(`   - ${detailedCaloriesCount} calories fetched from detailed API`);
    console.log(`   - ${preservedCaloriesCount} calories preserved from cache`);
    console.log(`   - API calls used: ${1 + calorieResults.fetched} (1 summary + ${calorieResults.fetched} detailed)`);
    console.log(`   - Rate limited: ${calorieResults.rateLimited ? 'Yes' : 'No'}`);
  }

  return summaries.sort((a, b) => 
    new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
  );
};

/* ──────────────────────────────────────────────────────────────────── */
/*  Main handler                                                      */
/* ──────────────────────────────────────────────────────────────────── */
export default async function handler(req, res) {
  try {
    console.log('🚀 Enhanced Strava API handler with calorie fetching');
    
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const userId = req.query.userId || 'mihir_jain';
    const forceRefresh = req.query.refresh === 'true';
    const daysBack = parseInt(req.query.days) || 30;
    const mode = req.query.mode || 'cached';
    
    console.log(`📊 Request: userId=${userId}, mode=${mode}, daysBack=${daysBack}, forceRefresh=${forceRefresh}`);
    
    // CACHE-FIRST: Default mode for instant loading
    if (!forceRefresh && mode === 'cached') {
      console.log('⚡ Cache-first mode - serving cached data instantly');
      
      const cachedData = await getCachedData(userId, daysBack, true);
      
      if (cachedData.length > 0) {
        console.log(`📦 Serving ${cachedData.length} cached activities (0 API calls)`);
        
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
    
    // REFRESH MODES: Fetch fresh data with calories
    if (forceRefresh || mode === 'refresh' || mode === 'today') {
      console.log(`🔄 ${mode} mode - fetching fresh data with calories`);
      
      const refreshDays = mode === 'today' ? 1 : daysBack;
      const freshData = await fetchFreshDataFromStrava(userId, refreshDays, true);
      
      if (mode === 'today') {
        // Combine with cached data for today mode
        const cachedData = await getCachedData(userId, daysBack - 1, true);
        const combinedData = [...freshData, ...cachedData];
        const uniqueData = Array.from(
          new Map(combinedData.map(activity => [activity.id, activity])).values()
        ).sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
        
        res.setHeader('X-Data-Source', 'today-refresh-with-calories');
        res.setHeader('X-API-Calls', '1+');
        return res.status(200).json(uniqueData);
      }
      
      res.setHeader('X-Data-Source', 'strava-api-with-calories');
      res.setHeader('X-API-Calls', '1+');
      
      return res.status(200).json(freshData);
    }
    
    // DEFAULT FALLBACK
    const cachedData = await getCachedData(userId, daysBack, true);
    
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('X-Data-Source', 'default-cache');
    res.setHeader('X-API-Calls', '0');
    
    return res.status(200).json(cachedData);
    
  } catch (error) {
    console.error('❌ Enhanced Strava API error:', error);
    
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
      message: error.message
    });
  }
}
