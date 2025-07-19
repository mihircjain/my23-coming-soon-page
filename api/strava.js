// api/strava.js - COMPREHENSIVE: Fetches calories for ALL activities
// ✅ Summary endpoint for activity list (1 API call)
// ✅ Detailed endpoint for EVERY activity to get calories (N API calls)
// ✅ Rate-limit aware with batching
// ✅ Comprehensive logging

import admin from 'firebase-admin';

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

// Auto-classify runs
const autoTagRun = (activity) => {
  if (!activity.type?.toLowerCase().includes('run')) return null;
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
          userOverride: data.userOverride === true,
          taggedBy: data.taggedBy || 'auto',
          taggedAt: data.taggedAt
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

// Load existing calories to avoid re-fetching
const loadExistingCalories = async (userId, activityIds) => {
  try {
    console.log(`🔍 Loading existing calories for ${activityIds.length} activities...`);
    
    const existingCalories = new Map();
    
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
          existingCalories.set(activityId, {
            calories: data.calories || 0,
            calorie_source: data.calorie_source || 'unknown',
            last_calorie_fetch: data.last_calorie_fetch,
            hasCalories: data.calories > 0
          });
        }
      });
    }
    
    console.log(`✅ Loaded existing calories for ${existingCalories.size} activities`);
    return existingCalories;
  } catch (error) {
    console.error('❌ Error loading existing calories:', error);
    return new Map();
  }
};

// Check rate limits
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
      nearLimit: fifteenMin >= fifteenMinLimit * 0.85 || daily >= dailyLimit * 0.85,
      remaining15min: fifteenMinLimit - fifteenMin,
      remainingDaily: dailyLimit - daily
    };
  }
  return null;
};

// 🔥 COMPREHENSIVE: Fetch calories for ALL activities
const fetchAllCalories = async (accessToken, activities, existingCalories) => {
  console.log(`🔥 COMPREHENSIVE CALORIE FETCHING for ${activities.length} activities`);
  
  // Identify activities that need calorie fetching
  const activitiesNeedingCalories = [];
  const activitiesWithCalories = [];
  
  activities.forEach(activity => {
    const activityId = activity.id?.toString();
    const existing = existingCalories.get(activityId);
    
    if (existing && existing.hasCalories) {
      activitiesWithCalories.push({
        id: activityId,
        name: activity.name,
        type: activity.type,
        calories: existing.calories,
        source: existing.calorie_source
      });
    } else {
      activitiesNeedingCalories.push({
        id: activityId,
        name: activity.name,
        type: activity.type,
        date: activity.start_date?.split('T')[0]
      });
    }
  });
  
  console.log(`📊 CALORIE STATUS:`);
  console.log(`   - ${activitiesWithCalories.length} activities already have calories`);
  console.log(`   - ${activitiesNeedingCalories.length} activities need calories`);
  
  // Log activities with existing calories
  activitiesWithCalories.forEach(activity => {
    console.log(`✅ HAS CALORIES: ${activity.type} "${activity.name}" = ${activity.calories} (${activity.source})`);
  });
  
  // Log activities needing calories
  activitiesNeedingCalories.forEach(activity => {
    console.log(`❓ NEEDS CALORIES: ${activity.type} "${activity.name}" (${activity.date})`);
  });
  
  if (activitiesNeedingCalories.length === 0) {
    console.log('✅ All activities already have calories!');
    return { calorieData: new Map(), fetched: 0, rateLimited: false };
  }
  
  const results = {
    calorieData: new Map(),
    fetched: 0,
    failed: 0,
    rateLimited: false,
    details: []
  };
  
  // Be more aggressive with fetching - try to get all missing calories
  const maxRequests = Math.min(activitiesNeedingCalories.length, 30); // Increase limit
  const activitiesToFetch = activitiesNeedingCalories.slice(0, maxRequests);
  
  console.log(`🔄 FETCHING CALORIES: ${activitiesToFetch.length} activities (max ${maxRequests})`);
  
  for (let i = 0; i < activitiesToFetch.length; i++) {
    const activity = activitiesToFetch[i];
    
    try {
      console.log(`📡 [${i+1}/${activitiesToFetch.length}] Fetching: ${activity.type} "${activity.name}" (${activity.date})`);
      
      const detailedUrl = `https://www.strava.com/api/v3/activities/${activity.id}`;
      const response = await fetch(detailedUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      const rateLimitInfo = checkRateLimit(response);
      
      if (!response.ok) {
        if (response.status === 429) {
          console.log('🚫 RATE LIMITED - stopping calorie fetching');
          results.rateLimited = true;
          break;
        }
        throw new Error(`HTTP ${response.status}`);
      }
      
      const detailedActivity = await response.json();
      const calories = detailedActivity.calories || 0;
      
      if (calories > 0) {
        results.calorieData.set(activity.id, {
          calories: calories,
          calorie_source: 'strava_detailed_api',
          last_calorie_fetch: new Date().toISOString()
        });
        
        console.log(`✅ FOUND CALORIES: ${activity.type} "${activity.name}" = ${calories} calories`);
        results.fetched++;
      } else {
        console.log(`⚠️ NO CALORIES: ${activity.type} "${activity.name}" - Strava returned 0`);
        // Still save that we checked, to avoid re-checking
        results.calorieData.set(activity.id, {
          calories: 0,
          calorie_source: 'strava_detailed_api_no_calories',
          last_calorie_fetch: new Date().toISOString()
        });
        results.failed++;
      }
      
      results.details.push({
        id: activity.id,
        name: activity.name,
        type: activity.type,
        calories: calories,
        success: calories > 0
      });
      
      // Rate limiting protection
      if (rateLimitInfo?.nearLimit) {
        console.log(`⚠️ Near rate limit - remaining: ${rateLimitInfo.remaining15min} (15min), ${rateLimitInfo.remainingDaily} (daily)`);
        
        if (rateLimitInfo.remaining15min < 5) {
          console.log('🚫 Stopping due to rate limit proximity');
          results.rateLimited = true;
          break;
        }
      }
      
      // Add delay between requests to be nice to API
      if (i < activitiesToFetch.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 150)); // 150ms delay
      }
      
    } catch (error) {
      console.error(`❌ Failed to fetch calories for ${activity.id}: ${error.message}`);
      results.failed++;
      results.details.push({
        id: activity.id,
        name: activity.name,
        type: activity.type,
        calories: 0,
        success: false,
        error: error.message
      });
    }
  }
  
  console.log(`🎯 CALORIE FETCHING COMPLETE:`);
  console.log(`   - ${results.fetched} activities got calories`);
  console.log(`   - ${results.failed} activities had no calories`);
  console.log(`   - Rate limited: ${results.rateLimited ? 'Yes' : 'No'}`);
  
  return results;
};

// Get cached data
const getCachedData = async (userId, daysBack = 30) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    cutoffDate.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    const snapshot = await db
      .collection('strava_data')
      .where('userId', '==', userId)
      .where('start_date', '>=', cutoffDate.toISOString())
      .where('start_date', '<=', today.toISOString())
      .orderBy('start_date', 'desc')
      .limit(200)
      .get();
    
    const activities = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        calories: data.calories || 0,
        is_run_activity: data.type?.toLowerCase().includes('run') || false,
        run_tag: data.runType || null
      };
    });
    
    console.log(`📦 Cached: ${activities.length} activities`);
    return activities;
  } catch (error) {
    console.error('❌ Error fetching cached data:', error);
    return [];
  }
};

// Save edited calories to Firestore
const saveEditedCalories = async (userId, activityId, calories) => {
  try {
    console.log(`💾 Saving edited calories: ${activityId} = ${calories}`);
    
    const docRef = db.collection('strava_data').doc(`${userId}_${activityId}`);
    await docRef.update({
      calories: parseInt(calories),
      calorie_source: 'user_edited',
      last_calorie_fetch: new Date().toISOString(),
      edited_at: new Date().toISOString()
    });
    
    console.log(`✅ Calories saved successfully for ${activityId}`);
    return { success: true, calories: parseInt(calories) };
  } catch (error) {
    console.error('❌ Error saving edited calories:', error);
    throw error;
  }
};

// 🔥 MAIN: Fetch fresh data with comprehensive calorie fetching
const fetchFreshDataFromStrava = async (userId, daysBack = 30) => {
  console.log('🚀 COMPREHENSIVE STRAVA FETCH with calorie fetching for ALL activities');
  
  // Get credentials
  const { 
    VITE_STRAVA_CLIENT_ID: clientId,
    VITE_STRAVA_CLIENT_SECRET: clientSecret,
    VITE_STRAVA_REFRESH_TOKEN: refreshToken 
  } = process.env;
  
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing Strava credentials');
  }

  // Get access token
  console.log('🔑 Getting Strava access token...');
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

  // 1. Get activities from summary endpoint (fast)
  const today = new Date();
  const startDate = new Date();
  startDate.setDate(today.getDate() - daysBack);
  startDate.setHours(0, 0, 0, 0);
  
  const after = Math.floor(startDate.getTime() / 1000);
  const before = Math.floor(today.getTime() / 1000);
  
  const stravaUrl = `https://www.strava.com/api/v3/athlete/activities?per_page=200&after=${after}&before=${before}`;
  
  console.log(`📡 Fetching activities from ${startDate.toDateString()} to ${today.toDateString()}`);
  const listResp = await fetch(stravaUrl, { 
    headers: { Authorization: `Bearer ${accessToken}` } 
  });
  
  if (!listResp.ok) {
    throw new Error(`Strava API error: ${listResp.status}`);
  }
  
  const activitiesData = await listResp.json();
  console.log(`✅ Got ${activitiesData.length} activities from summary endpoint`);

  // 2. Load existing data
  const activityIds = activitiesData.map(a => a.id.toString());
  const existingRunTags = await loadExistingRunTags(userId);
  const existingCalories = await loadExistingCalories(userId, activityIds);

  // 3. Fetch calories for ALL activities
  const calorieResults = await fetchAllCalories(accessToken, activitiesData, existingCalories);

  // 4. Build final activities with all data
  const summaries = [];
  const batch = db.batch();
  const now = new Date().toISOString();

  for (const activity of activitiesData) {
    const activityId = activity.id.toString();
    const isRun = activity.type?.toLowerCase().includes('run');
    
    // Get calories (priority: new fetch > existing > 0)
    const fetchedCalories = calorieResults.calorieData.get(activityId);
    const existingCalorieData = existingCalories.get(activityId);
    
    let calories = 0;
    let calorieSource = 'none';
    
    if (fetchedCalories) {
      calories = fetchedCalories.calories;
      calorieSource = fetchedCalories.calorie_source;
    } else if (existingCalorieData && existingCalorieData.hasCalories) {
      calories = existingCalorieData.calories;
      calorieSource = existingCalorieData.calorie_source;
    }

    // Handle run tags
    let runTagInfo = null;
    if (isRun) {
      if (existingRunTags.has(activityId)) {
        runTagInfo = existingRunTags.get(activityId);
      } else {
        const autoTag = autoTagRun(activity);
        runTagInfo = {
          runType: autoTag,
          run_tag: autoTag,
          userOverride: false,
          taggedBy: 'auto',
          taggedAt: now
        };
      }
    }

    // Build activity summary
    const summary = {
      userId,
      id: activityId,
      start_date: activity.start_date,
      date: activity.start_date.split('T')[0],
      name: activity.name,
      type: activity.type,
      distance: activity.distance / 1000,
      moving_time: activity.moving_time,
      elapsed_time: activity.elapsed_time,
      total_elevation_gain: activity.total_elevation_gain || 0,
      average_speed: activity.average_speed || null,
      max_speed: activity.max_speed || null,
      has_heartrate: activity.has_heartrate || false,
      average_heartrate: activity.average_heartrate || null,
      max_heartrate: activity.max_heartrate || null,
      calories: calories, // 🔥 CALORIES FROM COMPREHENSIVE FETCHING
      calorie_source: calorieSource,
      fetched_at: now,
      is_run_activity: isRun
    };

    // Add calorie fetch metadata
    if (fetchedCalories) {
      summary.last_calorie_fetch = fetchedCalories.last_calorie_fetch || null;
    }

    // Add run tags
    if (isRun && runTagInfo) {
      summary.run_tag = runTagInfo.run_tag || null;
      summary.runType = runTagInfo.runType || null;
      summary.userOverride = runTagInfo.userOverride || false;
      summary.taggedBy = runTagInfo.taggedBy || null;
      summary.taggedAt = runTagInfo.taggedAt || null;
    }

    summaries.push(summary);

    // Save to Firestore
    const docRef = db.collection('strava_data').doc(`${userId}_${activityId}`);
    batch.set(docRef, summary, { merge: true });
  }

  // Commit all data
  if (summaries.length > 0) {
    await batch.commit();
    
    const activitiesWithCalories = summaries.filter(a => a.calories > 0);
    const totalCalories = summaries.reduce((sum, a) => sum + (a.calories || 0), 0);
    
    console.log(`💾 FINAL RESULTS:`);
    console.log(`   - ${summaries.length} total activities processed`);
    console.log(`   - ${activitiesWithCalories.length} activities have calories`);
    console.log(`   - ${totalCalories.toLocaleString()} total calories`);
    console.log(`   - ${calorieResults.fetched} new calories fetched`);
    console.log(`   - API calls: ${1 + calorieResults.fetched + calorieResults.failed} (1 summary + ${calorieResults.fetched + calorieResults.failed} detailed)`);
  }

  return summaries.sort((a, b) => 
    new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
  );
};

// Main handler
export default async function handler(req, res) {
  try {
    console.log('🚀 COMPREHENSIVE Strava API with calorie fetching for ALL activities');
    
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // Handle POST requests for saving edited calories
    if (req.method === 'POST') {
      const { userId, activityId, calories } = req.body;
      
      if (!userId || !activityId || calories === undefined) {
        return res.status(400).json({ error: 'Missing required fields: userId, activityId, calories' });
      }
      
      const result = await saveEditedCalories(userId, activityId, calories);
      return res.status(200).json(result);
    }
    
    // Handle GET requests (existing functionality)
    const userId = req.query.userId || 'mihir_jain';
    const forceRefresh = req.query.refresh === 'true';
    const daysBack = parseInt(req.query.days) || 30;
    const mode = req.query.mode || 'cached';
    
    console.log(`📊 Request: userId=${userId}, mode=${mode}, daysBack=${daysBack}`);
    
    // Cache-first mode
    if (!forceRefresh && mode === 'cached') {
      const cachedData = await getCachedData(userId, daysBack);
      
      if (cachedData.length > 0) {
        console.log(`📦 Serving ${cachedData.length} cached activities`);
        res.setHeader('X-Data-Source', 'firestore-cache');
        res.setHeader('X-API-Calls', '0');
        return res.status(200).json(cachedData);
      } else {
        return res.status(404).json({ 
          error: 'No cached data available',
          recommendRefresh: true
        });
      }
    }
    
    // Refresh modes
    if (forceRefresh || mode === 'refresh' || mode === 'today') {
      const refreshDays = mode === 'today' ? 1 : daysBack;
      const freshData = await fetchFreshDataFromStrava(userId, refreshDays);
      
      res.setHeader('X-Data-Source', 'strava-comprehensive-calories');
      res.setHeader('X-API-Calls', '1+');
      
      return res.status(200).json(freshData);
    }
    
    // Default fallback
    const cachedData = await getCachedData(userId, daysBack);
    res.setHeader('X-Data-Source', 'default-cache');
    res.setHeader('X-API-Calls', '0');
    return res.status(200).json(cachedData);
    
  } catch (error) {
    console.error('❌ Comprehensive Strava API error:', error);
    
    // Fallback to cached data
    try {
      const userId = req.query.userId || 'mihir_jain';
      const daysBack = parseInt(req.query.days) || 30;
      const fallbackData = await getCachedData(userId, daysBack);
      
      if (fallbackData.length > 0) {
        res.setHeader('X-Data-Source', 'error-fallback');
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
