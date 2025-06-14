// /api/runs.js - Fixed version that handles undefined values properly

import admin from 'firebase-admin';

/* ──────────────────────────────────────────────────────────────────── */
/*  Firebase Admin init with ignoreUndefinedProperties                */
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

// Configure Firestore to ignore undefined values
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

/* ──────────────────────────────────────────────────────────────────── */
/*  Helper to clean undefined values                                  */
/* ──────────────────────────────────────────────────────────────────── */
const cleanObject = (obj) => {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(cleanObject).filter(item => item !== null && item !== undefined);
  if (typeof obj === 'object') {
    const cleaned = {};
    Object.keys(obj).forEach(key => {
      const value = cleanObject(obj[key]);
      if (value !== null && value !== undefined) {
        cleaned[key] = value;
      }
    });
    return Object.keys(cleaned).length > 0 ? cleaned : null;
  }
  return obj;
};

/* ──────────────────────────────────────────────────────────────────── */
/*  Get last week's date range                                        */
/* ──────────────────────────────────────────────────────────────────── */
const getLastWeekRange = () => {
  const now = new Date();
  const lastWeekEnd = new Date(now.getTime() - (now.getDay() * 24 * 60 * 60 * 1000));
  lastWeekEnd.setHours(23, 59, 59, 999);
  
  const lastWeekStart = new Date(lastWeekEnd.getTime() - (6 * 24 * 60 * 60 * 1000));
  lastWeekStart.setHours(0, 0, 0, 0);
  
  return { lastWeekStart, lastWeekEnd };
};

/* ──────────────────────────────────────────────────────────────────── */
/*  Check if activity is a run                                        */
/* ──────────────────────────────────────────────────────────────────── */
const isRunActivity = (activityType) => {
  if (!activityType) return false;
  const runTypes = ['run', 'virtualrun', 'treadmill', 'trail'];
  return runTypes.some(type => 
    activityType.toLowerCase().includes(type.toLowerCase())
  );
};

/* ──────────────────────────────────────────────────────────────────── */
/*  Get cached detailed runs - simplified query to avoid index issues */
/* ──────────────────────────────────────────────────────────────────── */
const getCachedDetailedRuns = async (userId) => {
  try {
    console.log(`📅 Getting cached detailed runs for ${userId}`);
    
    // Simple query without date filtering to avoid index issues
    const snapshot = await db
      .collection('detailed_runs')
      .where('userId', '==', userId)
      .limit(20)
      .get();
    
    const { lastWeekStart, lastWeekEnd } = getLastWeekRange();
    const runs = [];
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      
      // Filter by date in JavaScript
      const activityDate = new Date(data.start_date);
      if (activityDate >= lastWeekStart && activityDate <= lastWeekEnd) {
        runs.push(data);
      }
    });
    
    // Sort by date
    runs.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
    
    console.log(`📊 Found ${runs.length} cached detailed runs from last week`);
    return runs;
    
  } catch (error) {
    console.error('Error fetching cached detailed runs:', error);
    return [];
  }
};

/* ──────────────────────────────────────────────────────────────────── */
/*  Fetch detailed activity data from Strava                          */
/* ──────────────────────────────────────────────────────────────────── */
const fetchDetailedActivity = async (accessToken, activityId) => {
  try {
    console.log(`🔍 Fetching detailed data for activity ${activityId}`);
    
    const response = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!response.ok) {
      console.error(`❌ Failed to fetch activity ${activityId}: ${response.status}`);
      return null;
    }
    
    const detailed = await response.json();
    console.log(`✅ Got detailed data for ${activityId}: ${detailed.name} with ${detailed.splits_metric?.length || 0} splits`);
    
    return detailed;
    
  } catch (error) {
    console.error(`❌ Error fetching detailed activity ${activityId}:`, error);
    return null;
  }
};

/* ──────────────────────────────────────────────────────────────────── */
/*  Fetch activity streams (per-second data)                          */
/* ──────────────────────────────────────────────────────────────────── */
const fetchActivityStreams = async (accessToken, activityId) => {
  try {
    const keys = 'time,distance,latlng,altitude,velocity_smooth,heartrate,cadence,grade_smooth,moving';
    const response = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}/streams?keys=${keys}&key_by_type=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    if (!response.ok) {
      console.warn(`⚠️ Failed to fetch streams for ${activityId}: ${response.status}`);
      return null;
    }
    
    const streams = await response.json();
    console.log(`✅ Got streams for ${activityId} with ${Object.keys(streams).length} data types`);
    
    return streams;
    
  } catch (error) {
    console.warn(`⚠️ Error fetching streams for ${activityId}:`, error);
    return null;
  }
};

/* ──────────────────────────────────────────────────────────────────── */
/*  Fetch HR/pace zones                                               */
/* ──────────────────────────────────────────────────────────────────── */
const fetchActivityZones = async (accessToken, activityId) => {
  try {
    const response = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}/zones`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    if (!response.ok) {
      console.warn(`⚠️ Failed to fetch zones for ${activityId}: ${response.status}`);
      return null;
    }
    
    const zones = await response.json();
    console.log(`✅ Got zones for ${activityId}`);
    
    return zones;
    
  } catch (error) {
    console.warn(`⚠️ Error fetching zones for ${activityId}:`, error);
    return null;
  }
};

/* ──────────────────────────────────────────────────────────────────── */
/*  Fetch gear information                                             */
/* ──────────────────────────────────────────────────────────────────── */
const fetchGearInfo = async (accessToken, gearId) => {
  try {
    if (!gearId) return null;
    
    const response = await fetch(`https://www.strava.com/api/v3/gear/${gearId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!response.ok) {
      console.warn(`⚠️ Failed to fetch gear ${gearId}: ${response.status}`);
      return null;
    }
    
    const gear = await response.json();
    console.log(`✅ Got gear info: ${gear.name} (${(gear.distance / 1000).toFixed(0)}km)`);
    
    return cleanObject({
      id: gear.id,
      name: gear.name,
      distance: gear.distance,
      brand_name: gear.brand_name,
      model_name: gear.model_name,
      description: gear.description,
      primary: gear.primary
    });
    
  } catch (error) {
    console.error(`❌ Error fetching gear ${gearId}:`, error);
    return null;
  }
};

/* ──────────────────────────────────────────────────────────────────── */
/*  Process and store comprehensive run data                          */
/* ──────────────────────────────────────────────────────────────────── */
const processAndStoreDetailedRun = async (run, userId, accessToken) => {
  try {
    const runId = run.id.toString();
    console.log(`🔄 Processing detailed run ${runId}: ${run.name}`);
    
    // Get detailed activity data
    const detailed = await fetchDetailedActivity(accessToken, runId);
    if (!detailed) {
      console.warn(`⚠️ Skipping ${runId} - no detailed data`);
      return null;
    }
    
    // Get additional data in parallel
    const [streams, zones, gearInfo] = await Promise.all([
      fetchActivityStreams(accessToken, runId),
      fetchActivityZones(accessToken, runId),
      detailed.gear_id ? fetchGearInfo(accessToken, detailed.gear_id) : null
    ]);
    
    // Create comprehensive run object with proper null handling
    const comprehensiveRun = cleanObject({
      // Basic info
      userId,
      id: runId,
      name: detailed.name || 'Unnamed Run',
      description: detailed.description || '',
      
      // Timing
      start_date: detailed.start_date,
      start_date_local: detailed.start_date_local,
      date: detailed.start_date.split('T')[0],
      timezone: detailed.timezone,
      
      // Core metrics
      distance: detailed.distance || 0,
      moving_time: detailed.moving_time || 0,
      elapsed_time: detailed.elapsed_time || 0,
      total_elevation_gain: detailed.total_elevation_gain || 0,
      
      // Speed data
      average_speed: detailed.average_speed || 0,
      max_speed: detailed.max_speed || 0,
      
      // Heart rate data
      has_heartrate: detailed.has_heartrate || false,
      average_heartrate: detailed.average_heartrate || null,
      max_heartrate: detailed.max_heartrate || null,
      elev_high: detailed.elev_high || null,
      elev_low: detailed.elev_low || null,
      
      // Additional metrics
      calories: detailed.calories || null,
      average_cadence: detailed.average_cadence || null,
      max_cadence: detailed.max_cadence || null,
      average_temp: detailed.average_temp || null,
      
      // Workout classification
      workout_type: detailed.workout_type || null,
      type: detailed.type || 'Run',
      sport_type: detailed.sport_type || null,
      
      // Equipment
      gear_id: detailed.gear_id || null,
      gear: gearInfo,
      
      // Activity flags
      trainer: detailed.trainer || false,
      commute: detailed.commute || false,
      manual: detailed.manual || false,
      private: detailed.private || false,
      
      // Social metrics
      achievement_count: detailed.achievement_count || 0,
      kudos_count: detailed.kudos_count || 0,
      comment_count: detailed.comment_count || 0,
      athlete_count: detailed.athlete_count || 0,
      photo_count: detailed.photo_count || 0,
      
      // Performance metrics
      suffer_score: detailed.suffer_score || null,
      weighted_average_watts: detailed.weighted_average_watts || null,
      device_watts: detailed.device_watts || false,
      
      // Map data
      map: detailed.map ? cleanObject({
        id: detailed.map.id,
        polyline: detailed.map.polyline,
        summary_polyline: detailed.map.summary_polyline
      }) : null,
      
      // DETAILED RUNNING DATA
      splits_metric: detailed.splits_metric || [],
      splits_standard: detailed.splits_standard || [],
      laps: detailed.laps || [],
      best_efforts: detailed.best_efforts || [],
      segment_efforts: detailed.segment_efforts || [],
      
      // Per-second streams
      streams: streams || null,
      
      // HR/pace zones
      zones: zones || null,
      
      // Processing metadata
      fetched_at: new Date().toISOString(),
      has_detailed_data: true,
      has_streams: !!streams,
      has_zones: !!zones,
      processing_version: '1.1'
    });
    
    // Store in detailed_runs collection
    const docRef = db.collection('detailed_runs').doc(`${userId}_${runId}`);
    await docRef.set(comprehensiveRun);
    
    console.log(`💾 Stored comprehensive run: ${runId} with ${detailed.splits_metric?.length || 0} splits, ${streams ? 'streams' : 'no streams'}, ${zones ? 'zones' : 'no zones'}`);
    
    return comprehensiveRun;
    
  } catch (error) {
    console.error(`❌ Error processing detailed run ${run.id}:`, error);
    return null;
  }
};

/* ──────────────────────────────────────────────────────────────────── */
/*  Rate limiting helper                                               */
/* ──────────────────────────────────────────────────────────────────── */
const checkRateLimit = async (userId) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const metadataRef = db.collection('detailed_runs_metadata').doc(`${userId}_${today}`);
    const metadataDoc = await metadataRef.get();
    
    if (!metadataDoc.exists) {
      await metadataRef.set({ apiCalls: 1, lastRefresh: new Date().toISOString() });
      return true;
    }
    
    const data = metadataDoc.data();
    if (data.apiCalls < 50) {
      await metadataRef.update({ 
        apiCalls: data.apiCalls + 1, 
        lastRefresh: new Date().toISOString() 
      });
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking rate limit:', error);
    return true;
  }
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
    
    console.log(`🏃‍♂️ Detailed Runs API: userId=${userId}, refresh=${forceRefresh}`);
    
    // Check cached detailed runs first
    const cachedRuns = await getCachedDetailedRuns(userId);
    
    if (!forceRefresh && cachedRuns.length > 0) {
      const latestRun = cachedRuns[0];
      const lastFetched = new Date(latestRun.fetched_at);
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
      
      if (lastFetched > sixHoursAgo) {
        console.log(`📦 Serving ${cachedRuns.length} cached detailed runs`);
        return res.status(200).json(cachedRuns);
      }
    }
    
    // Rate limit check
    if (forceRefresh && !(await checkRateLimit(userId))) {
      console.log('❌ Rate limit reached, serving cached data');
      return res.status(200).json(cachedRuns);
    }
    
    /* ––– Strava API Integration ––– */
    const { 
      VITE_STRAVA_CLIENT_ID: clientId,
      VITE_STRAVA_CLIENT_SECRET: clientSecret,
      VITE_STRAVA_REFRESH_TOKEN: refreshToken 
    } = process.env;
    
    if (!clientId || !clientSecret || !refreshToken) {
      console.log('❌ Missing Strava credentials, serving cached data');
      return res.status(200).json(cachedRuns);
    }

    // Refresh access token
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
      console.error('❌ Token refresh failed, serving cached data');
      return res.status(200).json(cachedRuns);
    }
    
    const { access_token: accessToken } = await tokenResp.json();

    // Get last week's runs from Strava
    const { lastWeekStart, lastWeekEnd } = getLastWeekRange();
    const after = Math.floor(lastWeekStart.getTime() / 1000);
    const before = Math.floor(lastWeekEnd.getTime() / 1000);
    
    console.log(`📅 Fetching runs from Strava: ${lastWeekStart.toDateString()} to ${lastWeekEnd.toDateString()}`);
    
    const activitiesResp = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${after}&before=${before}&per_page=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    if (!activitiesResp.ok) {
      console.error(`❌ Failed to fetch activities: ${activitiesResp.status}`);
      return res.status(200).json(cachedRuns);
    }
    
    const activities = await activitiesResp.json();
    const runs = activities.filter(activity => isRunActivity(activity.type));
    
    console.log(`🏃‍♂️ Found ${runs.length} runs to process with detailed data`);
    
    if (runs.length === 0) {
      return res.status(200).json(cachedRuns);
    }
    
    // Process each run with full detailed data
    const detailedRuns = [];
    let processed = 0;
    let errors = 0;
    
    for (const run of runs) {
      try {
        const detailedRun = await processAndStoreDetailedRun(run, userId, accessToken);
        if (detailedRun) {
          detailedRuns.push(detailedRun);
          processed++;
        } else {
          errors++;
        }
        
        // Rate limiting delay
        if (processed % 2 === 0) {
          console.log(`⏳ Processed ${processed}/${runs.length} runs (${errors} errors), brief pause...`);
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
      } catch (error) {
        console.error(`❌ Error processing run ${run.id}:`, error);
        errors++;
        continue;
      }
    }
    
    console.log(`✅ Processed ${processed} detailed runs, ${errors} errors`);
    
    // Combine with any existing cached runs and sort
    const allRuns = [...detailedRuns, ...cachedRuns];
    const uniqueRuns = [];
    const seenIds = new Set();
    
    allRuns.forEach(run => {
      if (!seenIds.has(run.id)) {
        uniqueRuns.push(run);
        seenIds.add(run.id);
      }
    });
    
    uniqueRuns.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
    
    // Log summary
    const runsWithSplits = uniqueRuns.filter(r => r.splits_metric && r.splits_metric.length > 0).length;
    const runsWithStreams = uniqueRuns.filter(r => r.has_streams).length;
    const runsWithZones = uniqueRuns.filter(r => r.has_zones).length;
    const runsWithBestEfforts = uniqueRuns.filter(r => r.best_efforts && r.best_efforts.length > 0).length;
    
    console.log(`📊 Final detailed runs summary:`);
    console.log(`   - ${uniqueRuns.length} total runs`);
    console.log(`   - ${runsWithSplits} with km splits`);
    console.log(`   - ${runsWithStreams} with per-second streams`);
    console.log(`   - ${runsWithZones} with HR/pace zones`);
    console.log(`   - ${runsWithBestEfforts} with best efforts`);
    
    return res.status(200).json(uniqueRuns);
    
  } catch (error) {
    console.error('❌ Detailed runs API error:', error);
    return res.status(500).json({ error: 'Failed to fetch detailed runs' });
  }
}
