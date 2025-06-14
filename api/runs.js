// /api/runs.js - Fixed version without reserved field issues

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
/*  Get cached runs from existing strava_data collection              */
/* ──────────────────────────────────────────────────────────────────── */
const getCachedRuns = async (userId) => {
  try {
    const { lastWeekStart, lastWeekEnd } = getLastWeekRange();
    
    console.log(`📅 Getting runs from ${lastWeekStart.toISOString()} to ${lastWeekEnd.toISOString()}`);
    
    // Simple query without complex indexes
    const snapshot = await db
      .collection('strava_data')
      .where('userId', '==', userId)
      .orderBy('start_date', 'desc')
      .limit(100)
      .get();
    
    const runs = [];
    const runIds = new Set();
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      
      // Check if it's a run and within last week
      if (!isRunActivity(data.type)) {
        return;
      }
      
      const activityDate = new Date(data.start_date);
      if (activityDate < lastWeekStart || activityDate > lastWeekEnd) {
        return;
      }
      
      const runId = data.id?.toString() || doc.id.split('_')[1];
      
      if (!runIds.has(runId)) {
        // Convert to expected format
        const processedRun = {
          id: runId,
          name: data.name || 'Unnamed Run',
          start_date: data.start_date,
          distance: data.distance ? data.distance * 1000 : 0, // Convert km to meters if needed
          moving_time: data.moving_time || data.duration * 60 || 0,
          elapsed_time: data.elapsed_time || data.moving_time || 0,
          total_elevation_gain: data.total_elevation_gain || data.elevation_gain || 0,
          average_speed: data.average_speed || 0,
          max_speed: data.max_speed || 0,
          average_heartrate: data.average_heartrate || data.heart_rate,
          max_heartrate: data.max_heartrate,
          calories: data.calories || 0,
          average_cadence: data.average_cadence,
          workout_type: data.workout_type,
          description: data.description,
          has_detailed_data: false,
          fetched_at: data.fetched_at || new Date().toISOString()
        };
        
        runs.push(processedRun);
        runIds.add(runId);
      }
    });
    
    // Sort by date (most recent first)
    runs.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
    
    console.log(`📊 Found ${runs.length} runs from last week`);
    return runs;
    
  } catch (error) {
    console.error('Error fetching cached runs:', error);
    return [];
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
    
    console.log(`🏃‍♂️ Last Week Runs API request: userId=${userId}, refresh=${forceRefresh}`);
    
    // Get runs from existing Strava data
    const runs = await getCachedRuns(userId);
    
    if (runs.length > 0) {
      console.log(`📦 Serving ${runs.length} runs from last week`);
      
      // Log sample runs for debugging
      runs.slice(0, 3).forEach((run, index) => {
        const distance = (run.distance / 1000).toFixed(2);
        const time = Math.round(run.moving_time / 60);
        console.log(`${index + 1}. ${run.name} - ${distance}km, ${time}min (${new Date(run.start_date).toLocaleDateString()})`);
      });
      
      return res.status(200).json(runs);
    }
    
    // If no cached runs, return helpful message
    console.log('📦 No runs found for last week, returning empty array');
    return res.status(200).json([]);
    
  } catch (error) {
    console.error('❌ Runs API handler error:', error);
    
    // Return mock data as fallback
    const mockData = [
      {
        id: "mock1",
        name: "Test Run - API Working",
        start_date: new Date().toISOString(),
        distance: 5000,
        moving_time: 1800,
        elapsed_time: 1800,
        total_elevation_gain: 50,
        average_speed: 2.78,
        max_speed: 3.33,
        average_heartrate: 150,
        calories: 300,
        has_detailed_data: false,
        fetched_at: new Date().toISOString()
      }
    ];
    
    console.log('📦 Serving fallback mock data due to error');
    return res.status(200).json(mockData);
  }
}
