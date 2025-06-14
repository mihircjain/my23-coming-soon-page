// /api/runs.js - Complete detailed runs API with full Strava integration

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
/*  Get cached detailed runs from new collection                      */
/* ──────────────────────────────────────────────────────────────────── */
const getCachedDetailedRuns = async (userId) => {
  try {
    const { lastWeekStart, lastWeekEnd } = getLastWeekRange();
    
    console.log(`📅 Getting detailed runs from ${lastWeekStart.toISOString()} to ${lastWeekEnd.toISOString()}`);
    
    // Query the new detailed_runs collection
    const snapshot = await db
      .collection('detailed_runs')
      .where('userId', '==', userId)
      .orderBy('start_date', 'desc')
      .limit(50)
      .get();
    
    const runs = [];
    const runIds = new Set();
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      
      // Filter to last week's runs
      const activityDate = new Date(data.start_date);
      if (activityDate < lastWeekStart || activityDate > lastWeekEnd) {
        return;
      }
      
      const runId = data.id?.toString();
      if (!runIds.has(runId)) {
        runs.push(data);
        runIds.add(runId);
      }
    });
    
    console.log(`📊 Found ${runs.length} detailed runs from cache`);
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
    
    return {
      id: gear.id,
      name: gear.name,
      distance: gear.distance, // Total distance in meters
      brand_name: gear.brand_name,
      model_name: gear.model_name,
      description: gear.description,
      primary: gear.primary,
      resource_state: gear.resource_state
    };
    
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
    
    // Create comprehensive run object
    const comprehensiveRun = {
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
      distance: detailed.distance, // meters
      moving_time: detailed.moving_time, // seconds
      elapsed_time: detailed.elapsed_time, // seconds
      total_elevation_gain: detailed.total_elevation_gain || 0,
      
      // Speed data
      average_speed: detailed.average_speed || 0, // m/s
      max_speed: detailed.max_speed || 0, // m/s
      
      // Heart rate data
      has_heartrate: detailed.has_heartrate || false,
      average_heartrate: detailed.average_heartrate,
      max_heartrate: detailed.max_heartrate,
      elev_high: detailed.elev_high,
      elev_low: detailed.elev_low,
      
      // Additional metrics
      calories: detailed.calories,
      average_cadence: detailed.average_cadence,
      max_cadence: detailed.max_cadence,
      average_temp: detailed.average_temp,
      
      // Workout classification
      workout_type: detailed.workout_type,
      type: detailed.type,
      sport_type: detailed.sport_type,
      
      // Equipment
      gear_id: detailed.gear_id,
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
      suffer_score: detailed.suffer_score,
      weighted_average_watts: detailed.weighted_average_watts,
      device_watts: detailed.device_watts,
      
      // Map data
      map: detailed.map ? {
        id: detailed.map.id,
        polyline: detailed.map.polyline,
        summary_polyline: detailed.map.summary_polyline,
        resource_state: detailed.map.resource_state
      } : null,
      
      // DETAILED RUNNING DATA
      
      // 1km auto-splits (key for pace analysis)
      splits_metric: detailed.splits_metric || [],
      splits_standard: detailed.splits_standard || [],
      
      // Device/manual laps
      laps: detailed.laps || [],
      
      // Best efforts (PRs for common distances)
      best_efforts: detailed.best_efforts || [],
      
      // Segment efforts
      segment_efforts: detailed.segment_efforts || [],
      
      // Per-second streams (if available)
      streams: streams || null,
      
      // HR/pace zones
      zones: zones || null,
      
      // Processing metadata
      fetched_at: new Date().toISOString(),
      has_detailed_data: true,
      has_streams: !!streams,
      has_zones: !!zones,
      processing_version: '1.0'
    };
    
    // Store in new detailed_runs collection
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
    if (data.apiCalls < 50) { // Conservative limit for detailed calls
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
      return res.status(200).json([]);
    }
    
    // Process each run with full detailed data
    const detailedRuns = [];
    let processed = 0;
    
    for (const run of runs) {
      try {
        const detailedRun = await processAndStoreDetailedRun(run, userId, accessToken);
        if (detailedRun) {
          detailedRuns.push(detailedRun);
          processed++;
        }
        
        // Rate limiting delay
        if (processed % 3 === 0) {
          console.log(`⏳ Processed ${processed}/${runs.length} runs, brief pause...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        console.error(`❌ Error processing run ${run.id}:`, error);
        continue;
      }
    }
    
    console.log(`✅ Processed ${processed} detailed runs with comprehensive data`);
    
    // Sort by date
    detailedRuns.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
    
    // Log summary
    const runsWithSplits = detailedRuns.filter(r => r.splits_metric && r.splits_metric.length > 0).length;
    const runsWithStreams = detailedRuns.filter(r => r.has_streams).length;
    const runsWithZones = detailedRuns.filter(r => r.has_zones).length;
    const runsWithBestEfforts = detailedRuns.filter(r => r.best_efforts && r.best_efforts.length > 0).length;
    
    console.log(`📊 Detailed runs summary:`);
    console.log(`   - ${detailedRuns.length} total runs`);
    console.log(`   - ${runsWithSplits} with km splits`);
    console.log(`   - ${runsWithStreams} with per-second streams`);
    console.log(`   - ${runsWithZones} with HR/pace zones`);
    console.log(`   - ${runsWithBestEfforts} with best efforts`);
    
    return res.status(200).json(detailedRuns);
    
  } catch (error) {
    console.error('❌ Detailed runs API error:', error);
    return res.status(500).json({ error: 'Failed to fetch detailed runs' });
  }
}
