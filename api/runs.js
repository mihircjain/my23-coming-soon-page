// /api/runs.js - Final working version that handles complex stream data properly

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
db.settings({ ignoreUndefinedProperties: true });

/* ──────────────────────────────────────────────────────────────────── */
/*  Helper to clean and simplify complex objects                      */
/* ──────────────────────────────────────────────────────────────────── */
const cleanObject = (obj) => {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    const cleaned = obj.map(cleanObject).filter(item => item !== null && item !== undefined);
    return cleaned.length > 0 ? cleaned : null;
  }
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
/*  Simplify streams data for Firestore storage                       */
/* ──────────────────────────────────────────────────────────────────── */
const simplifyStreams = (streams) => {
  if (!streams) return null;
  
  try {
    const simplified = {};
    
    // Extract just the data arrays and basic info, not the complex objects
    Object.keys(streams).forEach(key => {
      const stream = streams[key];
      if (stream && stream.data && Array.isArray(stream.data)) {
        simplified[key] = {
          type: stream.type || key,
          data_points: stream.data.length,
          sample_data: stream.data.slice(0, 10), // First 10 points as sample
          resolution: stream.resolution || 'high',
          series_type: stream.series_type || 'time'
        };
      }
    });
    
    return Object.keys(simplified).length > 0 ? simplified : null;
  } catch (error) {
    console.warn('Error simplifying streams:', error);
    return null;
  }
};

/* ──────────────────────────────────────────────────────────────────── */
/*  Get last week's date range                                        */
/* ──────────────────────────────────────────────────────────────────── */

/* ──────────────────────────────────────────────────────────────────── */
/*  Get last 7 days date range (from today backwards)                  */
/* ──────────────────────────────────────────────────────────────────── */
const getLastWeekRange = () => {
  const now = new Date();
  const lastWeekEnd = new Date(now); // Today
  const lastWeekStart = new Date(now.getTime() - (6 * 24 * 60 * 60 * 1000)); // 7 days ago
  
  console.log(`📅 Fetching runs from Strava: ${lastWeekStart.toDateString()} to ${lastWeekEnd.toDateString()}`);
  
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
/*  Get cached detailed runs                                           */
/* ──────────────────────────────────────────────────────────────────── */
const getCachedDetailedRuns = async (userId) => {
  try {
    console.log(`📅 Getting cached detailed runs for ${userId}`);
    
    const snapshot = await db
      .collection('detailed_runs')
      .where('userId', '==', userId)
      .limit(20)
      .get();
    
    const { lastWeekStart, lastWeekEnd } = getLastWeekRange();
    const runs = [];
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const activityDate = new Date(data.start_date);
      if (activityDate >= lastWeekStart && activityDate <= lastWeekEnd) {
        runs.push(data);
      }
    });
    
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
/*  Fetch activity streams (simplified)                               */
/* ──────────────────────────────────────────────────────────────────── */
const fetchActivityStreams = async (accessToken, activityId) => {
  try {
    const keys = 'time,distance,heartrate,velocity_smooth,altitude,cadence';
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
    
    return simplifyStreams(streams);
    
  } catch (error) {
    console.warn(`⚠️ Error fetching streams for ${activityId}:`, error);
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
      name: gear.name || 'Unknown Shoe',
      distance_km: Math.round(gear.distance / 1000),
      brand_name: gear.brand_name || null,
      model_name: gear.model_name || null,
      primary: gear.primary || false
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
    
    // Get additional data in parallel (skip zones for now to avoid complexity)
    const [streams, gearInfo] = await Promise.all([
      fetchActivityStreams(accessToken, runId),
      detailed.gear_id ? fetchGearInfo(accessToken, detailed.gear_id) : null
    ]);
    
    // Create comprehensive but Firestore-safe run object
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
      timezone: detailed.timezone || null,
      
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
      
      // Additional metrics
      calories: detailed.calories || null,
      average_cadence: detailed.average_cadence || null,
      max_cadence: detailed.max_cadence || null,
      average_temp: detailed.average_temp || null,
      
      // Workout classification
      workout_type: detailed.workout_type || null,
      type: detailed.type || 'Run',
      
      // Equipment (simplified)
      gear_id: detailed.gear_id || null,
      gear: gearInfo,
      
      // Activity flags
      trainer: detailed.trainer || false,
      commute: detailed.commute || false,
      manual: detailed.manual || false,
      
      // Social metrics
      achievement_count: detailed.achievement_count || 0,
      kudos_count: detailed.kudos_count || 0,
      comment_count: detailed.comment_count || 0,
      
      // Performance metrics
      suffer_score: detailed.suffer_score || null,
      
      // Map data (simplified)
      map_id: detailed.map?.id || null,
      has_map: !!detailed.map?.polyline,
      
      // DETAILED RUNNING DATA (the good stuff!)
      
      // Kilometer splits - This is the most important for runners
      splits_metric: detailed.splits_metric || [],
      
      // Device laps for interval training
      laps: detailed.laps ? detailed.laps.map(lap => cleanObject({
        name: lap.name || null,
        distance: lap.distance || 0,
        moving_time: lap.moving_time || 0,
        average_speed: lap.average_speed || 0,
        average_heartrate: lap.average_heartrate || null,
        total_elevation_gain: lap.total_elevation_gain || 0
      })) : [],
      
      // Best efforts (PRs)
      best_efforts: detailed.best_efforts ? detailed.best_efforts.map(effort => cleanObject({
        name: effort.name || 'Unknown Distance',
        distance: effort.distance || 0,
        moving_time: effort.moving_time || 0,
        elapsed_time: effort.elapsed_time || 0,
        start_date_local: effort.start_date_local || null
      })) : [],
      
      // Simplified streams info
      streams_summary: streams,
      
      // Processing metadata
      fetched_at: new Date().toISOString(),
      has_detailed_data: true,
      has_streams: !!streams,
      processing_version: '2.0'
    });
    
    // Store in detailed_runs collection
    const docRef = db.collection('detailed_runs').doc(`${userId}_${runId}`);
    await docRef.set(comprehensiveRun);
    
    console.log(`💾 ✅ Stored run ${runId}: ${detailed.splits_metric?.length || 0} splits, ${detailed.best_efforts?.length || 0} PRs, ${streams ? 'streams' : 'no streams'}`);
    
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
    if (data.apiCalls < 30) { // Conservative limit
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
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        console.error(`❌ Error processing run ${run.id}:`, error);
        errors++;
        continue;
      }
    }
    
    console.log(`✅ Successfully processed ${processed} detailed runs, ${errors} errors`);
    
    // Combine with cached runs and deduplicate
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
    
    // Log detailed summary
    const runsWithSplits = uniqueRuns.filter(r => r.splits_metric && r.splits_metric.length > 0).length;
    const runsWithStreams = uniqueRuns.filter(r => r.has_streams).length;
    const runsWithBestEfforts = uniqueRuns.filter(r => r.best_efforts && r.best_efforts.length > 0).length;
    const runsWithLaps = uniqueRuns.filter(r => r.laps && r.laps.length > 0).length;
    const runsWithGear = uniqueRuns.filter(r => r.gear && r.gear.name).length;
    
    console.log(`📊 Final detailed runs summary:`);
    console.log(`   - ${uniqueRuns.length} total runs`);
    console.log(`   - ${runsWithSplits} with km splits`);
    console.log(`   - ${runsWithBestEfforts} with best efforts (PRs)`);
    console.log(`   - ${runsWithLaps} with device laps`);
    console.log(`   - ${runsWithStreams} with stream data`);
    console.log(`   - ${runsWithGear} with gear info`);
    
    return res.status(200).json(uniqueRuns);
    
  } catch (error) {
    console.error('❌ Detailed runs API error:', error);
    return res.status(500).json({ error: 'Failed to fetch detailed runs' });
  }
}
