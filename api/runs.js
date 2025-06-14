// /api/runs.js - Comprehensive running data API for Vercel
// Fetches ONLY running activities with full detailed data from Strava

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
/*  Check if activity is a run                                        */
/* ──────────────────────────────────────────────────────────────────── */
const isRunActivity = (activityType) => {
  const runTypes = ['run', 'virtualrun', 'treadmill', 'trail'];
  return runTypes.some(type => 
    activityType.toLowerCase().includes(type.toLowerCase())
  );
};

/* ──────────────────────────────────────────────────────────────────── */
/*  Get cached runs from Firestore                                    */
/* ──────────────────────────────────────────────────────────────────── */
const getCachedRuns = async (userId, daysBack = 365) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    cutoffDate.setHours(0, 0, 0, 0);
    
    console.log(`📅 Fetching runs from ${startDate.toDateString()} to ${today.toDateString()}`);
    
    // Fetch activities with pagination to get all runs
    let allActivities = [];
    let page = 1;
    const perPage = 200;
    
    while (true) {
      const stravaUrl = `https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}&page=${page}&after=${after}&before=${before}`;
      
      const listResp = await fetch(stravaUrl, { 
        headers: { Authorization: `Bearer ${accessToken}` } 
      });
      
      if (!listResp.ok) {
        console.error(`❌ Strava API error (${listResp.status}), serving cached data`);
        return res.status(200).json(cachedRuns);
      }
      
      const activities = await listResp.json();
      
      if (activities.length === 0) {
        break; // No more activities
      }
      
      // Filter to runs only
      const runs = activities.filter(activity => isRunActivity(activity.type));
      allActivities.push(...runs);
      
      console.log(`📄 Page ${page}: ${activities.length} activities, ${runs.length} runs`);
      
      if (activities.length < perPage) {
        break; // Last page
      }
      
      page++;
      
      // Safety limit to prevent infinite loops
      if (page > 20) {
        console.warn('⚠️ Reached page limit, stopping pagination');
        break;
      }
    }
    
    console.log(`🏃‍♂️ Found ${allActivities.length} running activities total`);
    
    if (allActivities.length === 0) {
      console.log('📦 No runs found, serving cached data');
      return res.status(200).json(cachedRuns);
    }
    
    /* ––– Process runs with detailed data ––– */
    const processedRuns = [];
    const batch = db.batch();
    let processed = 0;
    let skipped = 0;
    
    console.log(`🔄 Processing ${allActivities.length} runs with detailed data...`);
    
    for (const run of allActivities) {
      try {
        // Check if we already have recent detailed data
        const existingDocRef = db.collection('weekly_runs').doc(`${userId}_${run.id}`);
        const existingDoc = await existingDocRef.get();
        
        let shouldFetchDetailed = true;
        
        if (existingDoc.exists && !forceRefresh) {
          const existingData = existingDoc.data();
          if (existingData.has_detailed_data) {
            const lastDetailedFetch = new Date(existingData.detailed_fetch_date || existingData.fetched_at);
            const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000); // More frequent updates for last week
            
            if (lastDetailedFetch > sixHoursAgo) {
              shouldFetchDetailed = false;
              processedRuns.push(existingData);
              skipped++;
              console.log(`⏭️ Skipping ${run.id} (recent detailed data exists)`);
            }
          }
        }
        
        if (shouldFetchDetailed) {
          const processedRun = await processAndStoreRun(run, userId, accessToken);
          if (processedRun) {
            processedRuns.push(processedRun);
            processed++;
          }
          
          // Rate limiting delay between detailed API calls (shorter for last week)
          if (processed % 3 === 0) {
            console.log(`⏳ Processed ${processed} runs, brief pause...`);
            await new Promise(resolve => setTimeout(resolve, 500)); // Shorter delay for last week
          }
        }
        
        // Check rate limits periodically (more frequent for last week processing)
        if ((processed + skipped) % 5 === 0) {
          const usageHdr = await fetch(`https://www.strava.com/api/v3/athlete`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          }).then(r => r.headers.get('x-ratelimit-usage') || '0,0');
          
          const [shortUse, dailyUse] = usageHdr.split(',').map(Number);
          console.log(`📊 Rate limit usage: ${shortUse}/100 (15min), ${dailyUse}/1000 (daily)`);
          
          if (shortUse >= 85) { // More conservative for last week processing
            console.warn('⚠️ Approaching rate limit, stopping processing');
            break;
          }
        }
        
      } catch (error) {
        console.error(`❌ Error processing run ${run.id}:`, error);
        continue;
      }
    }
    
    console.log(`✅ Processing complete: ${processed} new/updated, ${skipped} skipped, ${processedRuns.length} total`);
    
    // Sort by date (most recent first)
    const sortedRuns = processedRuns.sort((a, b) => 
      new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
    );
    
    // Log comprehensive stats
    const detailedRuns = sortedRuns.filter(r => r.has_detailed_data);
    const runsWithHR = sortedRuns.filter(r => r.has_heartrate);
    const runsWithSplits = sortedRuns.filter(r => r.splits_metric && r.splits_metric.length > 0);
    const runsWithBestEfforts = sortedRuns.filter(r => r.best_efforts && r.best_efforts.length > 0);
    
    console.log(`📊 Last week runs data summary:`);
    console.log(`   - ${sortedRuns.length} total runs from last week`);
    console.log(`   - ${detailedRuns.length} with detailed data`);
    console.log(`   - ${runsWithHR.length} with heart rate data`);
    console.log(`   - ${runsWithSplits.length} with km splits`);
    console.log(`   - ${runsWithBestEfforts.length} with best efforts`);
    
    // Sample recent runs for debugging
    if (sortedRuns.length > 0) {
      console.log('📋 Last week runs:');
      sortedRuns.forEach((run, index) => {
        const distance = (run.distance / 1000).toFixed(2);
        const pace = run.moving_time && run.distance > 0 
          ? `${Math.floor(run.moving_time / (run.distance / 1000) / 60)}:${Math.floor((run.moving_time / (run.distance / 1000)) % 60).toString().padStart(2, '0')}/km`
          : 'N/A';
        const hr = run.average_heartrate ? `${run.average_heartrate}bpm` : 'No HR';
        const dataType = run.has_detailed_data ? 'Detailed' : 'Summary';
        const runDate = new Date(run.start_date).toLocaleDateString();
        
        console.log(`${index + 1}. ${run.name} - ${distance}km, ${pace}, ${hr} [${dataType}] (${runDate})`);
      });
    }
    
    // Set cache headers (shorter cache for last week)
    res.setHeader('Cache-Control', 'public, max-age=900'); // 15 minutes for last week data
    
    return res.status(200).json(sortedRuns);
    
  } catch (error) {
    console.error('❌ Runs API handler error:', error);
    
    // Fallback to cached data on any error
    try {
      const userId = req.query.userId || 'mihir_jain';
      const cachedRuns = await getCachedRuns(userId);
      console.log(`📦 Serving ${cachedRuns.length} cached runs from last week due to error`);
      return res.status(200).json(cachedRuns);
    } catch (cacheError) {
      console.error('❌ Failed to get cached runs:', cacheError);
      return res.status(500).json({ error: 'Unable to fetch last week runs data' });
    }
  }
}Getting cached runs from ${cutoffDate.toISOString()}`);
    
    const snapshot = await db
      .collection('runs_data')
      .where('userId', '==', userId)
      .where('start_date', '>=', cutoffDate.toISOString())
      .orderBy('start_date', 'desc')
      .limit(500)
      .get();
    
    const runs = [];
    const runIds = new Set();
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const runId = data.id || doc.id.split('_')[1];
      
      if (!runIds.has(runId)) {
        runs.push(data);
        runIds.add(runId);
      }
    });
    
    console.log(`📊 Found ${runs.length} cached runs`);
    return runs;
    
  } catch (error) {
    console.error('Error fetching cached runs:', error);
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
    console.log(`✅ Got detailed data for ${activityId}: ${detailed.name}`);
    
    return detailed;
    
  } catch (error) {
    console.error(`❌ Error fetching detailed activity ${activityId}:`, error);
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
    return {
      name: gear.name,
      distance: gear.distance,
      brand_name: gear.brand_name,
      model_name: gear.model_name
    };
    
  } catch (error) {
    console.error(`❌ Error fetching gear ${gearId}:`, error);
    return null;
  }
};

/* ──────────────────────────────────────────────────────────────────── */
/*  Process and store run data                                        */
/* ──────────────────────────────────────────────────────────────────── */
const processAndStoreRun = async (run, userId, accessToken) => {
  try {
    const runId = run.id.toString();
    
    // Get detailed activity data
    const detailed = await fetchDetailedActivity(accessToken, runId);
    if (!detailed) {
      console.warn(`⚠️ Skipping ${runId} - no detailed data`);
      return null;
    }
    
    // Get gear info if available
    let gearInfo = null;
    if (detailed.gear_id) {
      gearInfo = await fetchGearInfo(accessToken, detailed.gear_id);
    }
    
    // Process comprehensive run data
    const processedRun = {
      userId,
      id: runId,
      name: detailed.name || 'Unnamed Run',
      start_date: detailed.start_date,
      start_date_local: detailed.start_date_local,
      date: detailed.start_date.split('T')[0],
      
      // Basic metrics
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
      
      // Other metrics
      calories: detailed.calories,
      average_cadence: detailed.average_cadence,
      max_cadence: detailed.max_cadence,
      average_temp: detailed.average_temp,
      
      // Workout and gear
      workout_type: detailed.workout_type,
      gear_id: detailed.gear_id,
      gear_name: gearInfo?.name,
      gear_distance: gearInfo?.distance,
      gear_brand: gearInfo?.brand_name,
      gear_model: gearInfo?.model_name,
      
      // Activity details
      description: detailed.description,
      trainer: detailed.trainer || false,
      commute: detailed.commute || false,
      
      // Social metrics
      achievement_count: detailed.achievement_count || 0,
      kudos_count: detailed.kudos_count || 0,
      comment_count: detailed.comment_count || 0,
      athlete_count: detailed.athlete_count || 0,
      photo_count: detailed.photo_count || 0,
      
      // Performance data
      suffer_score: detailed.suffer_score,
      
      // Map data
      map: detailed.map ? {
        polyline: detailed.map.polyline,
        summary_polyline: detailed.map.summary_polyline
      } : null,
      
      // Splits (1km auto-splits)
      splits_metric: detailed.splits_metric || [],
      splits_standard: detailed.splits_standard || [],
      
      // Laps (device/manual laps)
      laps: detailed.laps || [],
      
      // Best efforts (PRs for common distances)
      best_efforts: detailed.best_efforts || [],
      
      // Segment efforts
      segment_efforts: detailed.segment_efforts || [],
      
      // Processing metadata
      fetched_at: new Date().toISOString(),
      has_detailed_data: true,
      detailed_fetch_date: new Date().toISOString()
    };
    
    // Store in Firestore (weekly_runs collection)
    const docRef = db.collection('weekly_runs').doc(`${userId}_${runId}`);
    await docRef.set(processedRun, { merge: true });
    
    console.log(`💾 Stored detailed run data for ${runId}: ${processedRun.name}`);
    return processedRun;
    
  } catch (error) {
    console.error(`❌ Error processing run ${run.id}:`, error);
    return null;
  }
};

/* ──────────────────────────────────────────────────────────────────── */
/*  Rate limit check                                                  */
/* ──────────────────────────────────────────────────────────────────── */
const canRefreshData = async (userId) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const metadataRef = db.collection('weekly_runs_metadata').doc(`${userId}_${today}`);
    const metadataDoc = await metadataRef.get();
    
    if (!metadataDoc.exists) {
      await metadataRef.set({ refreshCount: 1, lastRefresh: new Date().toISOString() });
      return true;
    }
    
    const data = metadataDoc.data();
    if (data.refreshCount < 20) { // Lower limit for last week only
      await metadataRef.update({ 
        refreshCount: data.refreshCount + 1, 
        lastRefresh: new Date().toISOString() 
      });
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking refresh limit:', error);
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
    const detailed = req.query.detailed === 'true';
    
    console.log(`🏃‍♂️ Last Week Runs API request: userId=${userId}, refresh=${forceRefresh}, detailed=${detailed}`);
    
    // Get last week's date range
    const { lastWeekStart, lastWeekEnd } = getLastWeekRange();
    console.log(`📅 Last week range: ${lastWeekStart.toDateString()} to ${lastWeekEnd.toDateString()}`);
    
    // Rate limit check for refresh
    if (forceRefresh) {
      const canRefresh = await canRefreshData(userId);
      if (!canRefresh) {
        console.log('❌ Refresh denied - daily limit reached');
        const cachedRuns = await getCachedRuns(userId);
        return res.status(200).json(cachedRuns);
      }
    }
    
    // Try cached data first
    const cachedRuns = await getCachedRuns(userId);
    
    if (!forceRefresh && cachedRuns.length > 0) {
      const latestRun = cachedRuns[0];
      const lastFetched = new Date(latestRun.fetched_at || latestRun.start_date);
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      
      if (lastFetched > threeHoursAgo) {
        console.log('📦 Serving cached runs data (< 3 hours old)');
        return res.status(200).json(cachedRuns);
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
      return res.status(200).json(cachedRuns);
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
      return res.status(200).json(cachedRuns);
    }
    
    const { access_token: accessToken } = await tokenResp.json();

    /* ––– Fetch activities (filtered to runs only) ––– */
    console.log('🏃‍♂️ Fetching running activities from Strava...');
    
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - daysBack);
    startDate.setHours(0, 0, 0, 0);
    
    const after = Math.floor(startDate.getTime() / 1000);
    const before = Math.floor(today.getTime() / 1000);
    
    console.log(`📅
