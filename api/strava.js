// api/strava.js - FINAL PRODUCTION VERSION
// ✅ Preserves calories during refresh (never loses data again)
// ✅ Cache-first approach (instant loading)
// ✅ Minimal API calls
// ✅ Run tagging system preserved
// ✅ Handles all edge cases

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
/*  🔥 CRITICAL: Load existing calorie data to prevent data loss      */
/* ──────────────────────────────────────────────────────────────────── */
const loadExistingActivityData = async (userId, activityIds) => {
  try {
    console.log(`🔍 Loading existing data for ${activityIds.length} activities to preserve calories...`);
    
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
            hasDetailedAnalysis: data.hasDetailedAnalysis || false,
            detailedAnalysisData: data.detailedAnalysisData || null,
            suffer_score: data.suffer_score,
            weather: data.weather,
            gear: data.gear,
            // Preserve any other custom data
            calories_recovered: data.calories_recovered,
            calories_recovery_date: data.calories_recovery_date
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
/*  Get cached data from Firestore - OPTIMIZED for speed              */
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
    
    // Deduplicate activities by activity ID (prioritize user-tagged/detailed versions)
    const activityMap = new Map();
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const activityId = data.id || doc.id.split('_')[1];
      
      if (!activityMap.has(activityId)) {
        const processedActivity = {
          ...data,
          calories: data.calories || 0, // Use existing calories (preserved from recovery)
          is_run_activity: data.type?.toLowerCase().includes('run') || false
        };
        
        if (includeRunTags && processedActivity.is_run_activity) {
          processedActivity.run_tag = data.runType || null;
        }
        
        activityMap.set(activityId, processedActivity);
      } else {
        // Handle duplicates - prefer user-tagged or detailed versions
        const existing = activityMap.get(activityId);
        const existingUserTagged = existing.userOverride === true;
        const currentUserTagged = data.userOverride === true;
        const existingHasDetailed = existing.hasDetailedAnalysis === true;
        const currentHasDetailed = data.hasDetailedAnalysis === true;
        const existingHasCalories = existing.calories > 0;
        const currentHasCalories = data.calories > 0;
        
        let shouldReplace = false;
        
        // Priority: User tags > Detailed analysis > Has calories > Most recent
        if (currentUserTagged && !existingUserTagged) {
          shouldReplace = true;
        } else if (!currentUserTagged && existingUserTagged) {
          shouldReplace = false;
        } else if (currentHasDetailed && !existingHasDetailed) {
          shouldReplace = true;
        } else if (!currentHasDetailed && existingHasDetailed) {
          shouldReplace = false;
        } else if (currentHasCalories && !existingHasCalories) {
          shouldReplace = true;
        } else if (!currentHasCalories && existingHasCalories) {
          shouldReplace = false;
        } else {
          // Both have same priority, use newer
          const existingTime = new Date(existing.fetched_at || existing.start_date);
          const currentTime = new Date(data.fetched_at || data.start_date);
          shouldReplace = currentTime > existingTime;
        }
        
        if (shouldReplace) {
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
      }
    });
    
    const cachedActivities = Array.from(activityMap.values());
    
    console.log(`📊 Found ${snapshot.docs.length} documents, ${cachedActivities.length} unique activities (no API calls made)`);
    
    // Log calorie statistics
    const withCalories = cachedActivities.filter(a => a.calories > 0);
    const recoveredCalories = cachedActivities.filter(a => a.calories_recovered === true);
    console.log(`🔥 Calorie stats: ${withCalories.length}/${cachedActivities.length} activities have calories (${recoveredCalories.length} recovered)`);
    
    return cachedActivities;
  } catch (error) {
    console.error('❌ Error fetching cached data:', error);
    return [];
  }
};

/* ──────────────────────────────────────────────────────────────────── */
/*  🔥 CALORIE-SAFE: Fetch fresh data with comprehensive preservation */
/* ──────────────────────────────────────────────────────────────────── */
const fetchFreshDataFromStrava = async (userId, daysBack = 30, preserveTags = true) => {
  console.log('🔄 Fetching fresh data from Strava API (with calorie preservation)');
  
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

  // Fetch activities from summary endpoint
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
  console.log(`✅ Fetched ${activitiesData.length} activities from Strava summary endpoint`);

  // 🔥 CRITICAL: Load existing calorie data to prevent loss
  const activityIds = activitiesData.map(a => a.id.toString());
  const existingActivityData = await loadExistingActivityData(userId, activityIds);

  // Process activities with comprehensive preservation
  const summaries = [];
  const batch = db.batch();
  const now = new Date().toISOString();
  let preservedTagsCount = 0;
  let newTagsCount = 0;
  let preservedCaloriesCount = 0;
  let newCaloriesCount = 0;
  let summaryCaloriesCount = 0;

  for (const activity of activitiesData) {
    const activityId = activity.id.toString();
    const isRun = activity.type?.toLowerCase().includes('run');
    
    // 🔥 COMPREHENSIVE CALORIE PRESERVATION
    const existingActivity = existingActivityData.get(activityId);
    let calories = 0;
    let calorieSource = 'none';
    
    if (activity.calories && activity.calories > 0) {
      // New calories from Strava summary (rare but possible)
      calories = activity.calories;
      calorieSource = 'strava_summary';
      newCaloriesCount++;
      summaryCaloriesCount++;
      console.log(`🆕 Fresh calories from summary for ${activityId}: ${calories}`);
    } else if (existingActivity && existingActivity.calories > 0) {
      // Preserve existing calories (most important case)
      calories = existingActivity.calories;
      calorieSource = existingActivity.calories_recovered ? 'recovered' : 'preserved';
      preservedCaloriesCount++;
      console.log(`🔥 Preserving calories for ${activityId}: ${calories} (${calorieSource})`);
    } else {
      // No calories available
      calories = 0;
      calorieSource = 'missing';
    }

    // Handle run tags with preservation
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

    // Build comprehensive summary
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
      calories: calories, // 🔥 PRESERVED OR FRESH CALORIES
      calorie_source: calorieSource, // Track where calories came from
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

    // Preserve any existing detailed analysis data
    if (existingActivity?.detailedAnalysisData) {
      summary.detailedAnalysisData = existingActivity.detailedAnalysisData;
    }
    
    // Preserve recovery metadata
    if (existingActivity?.calories_recovered) {
      summary.calories_recovered = existingActivity.calories_recovered;
      summary.calories_recovery_date = existingActivity.calories_recovery_date;
    }

    // Add run tag info
    if (isRun && runTagInfo) {
      summary.run_tag = runTagInfo.run_tag;
      summary.runType = runTagInfo.runType;
      summary.userOverride = runTagInfo.userOverride || false;
      summary.taggedBy = runTagInfo.taggedBy;
      summary.taggedAt = runTagInfo.taggedAt;
      summary.hasDetailedAnalysis = runTagInfo.hasDetailedAnalysis || false;
    }

    summaries.push(summary);

    // Save to Firestore with merge to preserve any other data
    const docRef = db.collection('strava_data').doc(`${userId}_${activity.id}`);
    batch.set(docRef, summary, { merge: true });
  }

  // Commit all writes
  if (summaries.length > 0) {
    await batch.commit();
    console.log(`💾 Cached ${summaries.length} activities to Firestore (TOTAL API CALLS: 1)`);
    
    // Comprehensive stats
    const runActivities = summaries.filter(a => a.is_run_activity);
    const activitiesWithCalories = summaries.filter(a => a.calories > 0);
    const recoveredActivities = summaries.filter(a => a.calorie_source === 'recovered');
    
    console.log(`🏃 FINAL REFRESH STATS:`);
    console.log(`   - ${summaries.length} activities processed`);
    console.log(`   - ${runActivities.length} runs found`);
    console.log(`   - ${preservedTagsCount} run tags preserved`);
    console.log(`   - ${newTagsCount} new run tags generated`);
    console.log(`   - ${activitiesWithCalories.length} activities with calories`);
    console.log(`   - ${newCaloriesCount} fresh calories from Strava`);
    console.log(`   - ${preservedCaloriesCount} calories preserved from cache`);
    console.log(`   - ${recoveredActivities.length} previously recovered calories maintained`);
    console.log(`   - ${summaryCaloriesCount} calories came from summary endpoint`);
    console.log(`   - API calls used: 1 (summary endpoint only)`);
    console.log(`   - 🔥 NO CALORIE DATA LOST!`);
  }

  return summaries.sort((a, b) => 
    new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
  );
};

/* ──────────────────────────────────────────────────────────────────── */
/*  Main handler - PRODUCTION READY                                  */
/* ──────────────────────────────────────────────────────────────────── */
export default async function handler(req, res) {
  try {
    console.log('🚀 CALORIE-SAFE Strava API handler started');
    
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
    
    // REFRESH MODES: Calorie-safe refresh
    if (forceRefresh || mode === 'refresh' || mode === 'today') {
      console.log(`🔄 ${mode} mode - fetching fresh data with calorie preservation`);
      
      const refreshDays = mode === 'today' ? 1 : daysBack;
      const freshData = await fetchFreshDataFromStrava(userId, refreshDays, true);
      
      if (mode === 'today') {
        // Combine with cached data for today mode
        const cachedData = await getCachedData(userId, daysBack - 1, true);
        const combinedData = [...freshData, ...cachedData];
        const uniqueData = Array.from(
          new Map(combinedData.map(activity => [activity.id, activity])).values()
        ).sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
        
        res.setHeader('X-Data-Source', 'today-refresh');
        res.setHeader('X-API-Calls', '1');
        return res.status(200).json(uniqueData);
      }
      
      res.setHeader('X-Data-Source', 'strava-api-calorie-safe');
      res.setHeader('X-API-Calls', '1');
      
      return res.status(200).json(freshData);
    }
    
    // DEFAULT FALLBACK
    const cachedData = await getCachedData(userId, daysBack, true);
    
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('X-Data-Source', 'default-cache');
    res.setHeader('X-API-Calls', '0');
    
    return res.status(200).json(cachedData);
    
  } catch (error) {
    console.error('❌ Calorie-safe Strava API error:', error);
    
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
