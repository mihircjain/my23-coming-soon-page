// api/strava.js - FIXED: Preserve existing calorie data during refresh

/* ──────────────────────────────────────────────────────────────────── */
/*  Load existing activity data to preserve calories and other data    */
/* ──────────────────────────────────────────────────────────────────── */
const loadExistingActivityData = async (userId, activityIds) => {
  try {
    console.log(`🔍 Loading existing data for ${activityIds.length} activities to preserve calories...`);
    
    const existingData = new Map();
    
    // Batch fetch existing activities
    const batches = [];
    for (let i = 0; i < activityIds.length; i += 10) { // Firestore 'in' query limit is 10
      const batch = activityIds.slice(i, i + 10);
      batches.push(batch);
    }
    
    for (const batch of batches) {
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
            // Preserve any other data that might be lost
            suffer_score: data.suffer_score,
            weather: data.weather,
            gear: data.gear
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
/*  Fetch fresh data from Strava API (FIXED: preserve calories)       */
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

  /* ──── FIXED: Load existing activity data to preserve calories ──── */
  const activityIds = activitiesData.map(a => a.id.toString());
  const existingActivityData = await loadExistingActivityData(userId, activityIds);

  /* ──── Process activities WITHOUT individual API calls ──── */
  const summaries = [];
  const batch = db.batch();
  const now = new Date().toISOString();
  let preservedTagsCount = 0;
  let newTagsCount = 0;
  let preservedCaloriesCount = 0;
  let newCaloriesCount = 0;

  for (const activity of activitiesData) {
    const activityId = activity.id.toString();
    const minutes = Math.round(activity.moving_time / 60);
    
    // FIXED: Preserve existing calorie data if Strava doesn't provide it
    const existingActivity = existingActivityData.get(activityId);
    let calories = 0;
    
    if (activity.calories && activity.calories > 0) {
      // Use fresh calories from Strava if available
      calories = activity.calories;
      newCaloriesCount++;
    } else if (existingActivity && existingActivity.calories > 0) {
      // Preserve existing calorie data if Strava doesn't provide it
      calories = existingActivity.calories;
      preservedCaloriesCount++;
      console.log(`🔥 Preserving calories for ${activityId}: ${calories} (Strava didn't provide fresh data)`);
    } else {
      // No calories available from either source
      calories = 0;
    }

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
      calories: calories, // FIXED: Now preserves existing calories when Strava doesn't provide them
      achievement_count: activity.achievement_count,
      kudos_count: activity.kudos_count,
      comment_count: activity.comment_count,
      athlete_count: activity.athlete_count,
      photo_count: activity.photo_count,
      suffer_score: activity.suffer_score || (existingActivity?.suffer_score), // Preserve existing if available
      fetched_at: now,
      is_run_activity: isRun,
      hasDetailedAnalysis: existingActivity?.hasDetailedAnalysis || false, // Preserve detailed analysis
      detailedAnalysisAvailable: isRun
    };

    // Preserve other existing data if available
    if (existingActivity) {
      if (existingActivity.detailedAnalysisData) {
        summary.detailedAnalysisData = existingActivity.detailedAnalysisData;
      }
      if (existingActivity.weather) {
        summary.weather = existingActivity.weather;
      }
      if (existingActivity.gear) {
        summary.gear = existingActivity.gear;
      }
    }

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
    console.log(`   - ${activitiesWithCalories.length} activities with calories`);
    console.log(`   - ${newCaloriesCount} fresh calories from Strava`);
    console.log(`   - ${preservedCaloriesCount} calories preserved from cache`); // NEW: Track preserved calories
    console.log(`   - Total API calls used: 1 (token + list only)`);
  }

  return summaries.sort((a, b) => 
    new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
  );
};
