// /api/oura-sleep.js - COMPLETE FIXED: Filter main sleep periods + real data mapping
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

const OURA_API_BASE = 'https://api.ouraring.com/v2/usercollection';
const OURA_ACCESS_TOKEN = process.env.OURA_ACCESS_TOKEN || '5YE626QELLKRDLY45QJXLEUIWTWGQJIH';

// Fetch DETAILED sleep data from sleep periods (not daily_sleep!)
async function fetchOuraSleepPeriods(startDate, endDate) {
  const response = await fetch(
    `${OURA_API_BASE}/sleep?start_date=${startDate}&end_date=${endDate}`,
    {
      headers: {
        'Authorization': `Bearer ${OURA_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  if (!response.ok) {
    throw new Error(`Oura Sleep Periods API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  console.log(`✅ Fetched ${data.data?.length || 0} sleep periods from Oura`);
  return data.data || [];
}

// Fetch daily sleep scores (summary scores)
async function fetchOuraDailySleep(startDate, endDate) {
  const response = await fetch(
    `${OURA_API_BASE}/daily_sleep?start_date=${startDate}&end_date=${endDate}`,
    {
      headers: {
        'Authorization': `Bearer ${OURA_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  if (!response.ok) {
    throw new Error(`Oura Daily Sleep API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  console.log(`✅ Fetched ${data.data?.length || 0} daily sleep scores from Oura`);
  return data.data || [];
}

// Fetch readiness data
async function fetchOuraReadinessData(startDate, endDate) {
  const response = await fetch(
    `${OURA_API_BASE}/daily_readiness?start_date=${startDate}&end_date=${endDate}`,
    {
      headers: {
        'Authorization': `Bearer ${OURA_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  if (!response.ok) {
    throw new Error(`Oura Readiness API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  console.log(`✅ Fetched ${data.data?.length || 0} readiness scores from Oura`);
  return data.data || [];
}

// FIXED: Combine all Oura data by date - Filter for MAIN sleep periods only
function combineOuraData(sleepPeriods, dailySleep, readinessData) {
  console.log('🔄 Processing Oura data and filtering for main sleep periods...');
  
  const combinedByDate = new Map();
  
  // STEP 1: Group sleep periods by day and find the MAIN sleep period (longest, >2 hours)
  const mainSleepByDay = new Map();
  
  console.log(`📊 Processing ${sleepPeriods.length} sleep periods...`);
  
  sleepPeriods.forEach(sleep => {
    const day = sleep.day;
    const duration = sleep.total_sleep_duration || 0;
    const durationHours = Math.round(duration / 3600 * 10) / 10;
    const durationMinutes = Math.round(duration / 60);
    
    // Only consider sleep periods longer than 2 hours (7200 seconds) to filter out naps
    if (duration < 7200) {
      console.log(`⏰ SKIPPING short sleep on ${day}: ${durationMinutes} minutes (likely a nap)`);
      return;
    }
    
    // Keep the longest sleep period for each day (main sleep vs multiple periods)
    const existing = mainSleepByDay.get(day);
    if (!existing || duration > existing.total_sleep_duration) {
      const bedtimeStart = sleep.bedtime_start ? new Date(sleep.bedtime_start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : 'N/A';
      const bedtimeEnd = sleep.bedtime_end ? new Date(sleep.bedtime_end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : 'N/A';
      
      console.log(`😴 MAIN SLEEP for ${day}: ${durationHours}h (${bedtimeStart} - ${bedtimeEnd}), HR: ${sleep.average_heart_rate || 'N/A'}`);
      mainSleepByDay.set(day, sleep);
    } else {
      console.log(`⏰ SKIPPING shorter sleep on ${day}: ${durationHours}h (main sleep is longer)`);
    }
  });
  
  console.log(`📊 Found ${mainSleepByDay.size} main sleep periods after filtering`);
  
  // STEP 2: Add main sleep periods to combined data
  mainSleepByDay.forEach((sleep, day) => {
    combinedByDate.set(day, {
      date: day,
      sleep: {
        id: sleep.id,
        sleep_score: null, // Will be filled from daily_sleep
        total_sleep_duration: sleep.total_sleep_duration || 0, // Already in seconds
        deep_sleep_duration: sleep.deep_sleep_duration || 0,   // Already in seconds
        light_sleep_duration: sleep.light_sleep_duration || 0, // Already in seconds
        rem_sleep_duration: sleep.rem_sleep_duration || 0,     // Already in seconds
        awake_time: sleep.awake_time || 0,                     // Already in seconds
        sleep_efficiency: sleep.efficiency || 0,
        sleep_latency: sleep.latency || 0,                     // Already in seconds
        bedtime_start: sleep.bedtime_start || null,
        bedtime_end: sleep.bedtime_end || null,
        average_heart_rate: sleep.average_heart_rate || null,
        lowest_heart_rate: sleep.lowest_heart_rate || null,
        temperature_deviation: sleep.temperature_deviation || 0,
        respiratory_rate: sleep.average_breath || null
      },
      readiness: null
    });
  });
  
  // STEP 3: Add sleep scores from daily_sleep
  console.log(`📊 Adding sleep scores from ${dailySleep.length} daily sleep records...`);
  dailySleep.forEach(dailyData => {
    const existing = combinedByDate.get(dailyData.day);
    if (existing && existing.sleep) {
      existing.sleep.sleep_score = dailyData.score;
      console.log(`✅ Added sleep score ${dailyData.score} for ${dailyData.day}`);
    } else if (!existing) {
      // Sometimes we have daily score but no detailed sleep period (rare)
      console.log(`⚠️ Daily sleep score for ${dailyData.day} but no main sleep period found`);
      combinedByDate.set(dailyData.day, {
        date: dailyData.day,
        sleep: {
          id: dailyData.id,
          sleep_score: dailyData.score,
          total_sleep_duration: 0,
          deep_sleep_duration: 0,
          light_sleep_duration: 0,
          rem_sleep_duration: 0,
          awake_time: 0,
          sleep_efficiency: 0,
          sleep_latency: 0,
          bedtime_start: null,
          bedtime_end: null,
          average_heart_rate: null,
          lowest_heart_rate: null,
          temperature_deviation: 0,
          respiratory_rate: null
        },
        readiness: null
      });
    }
  });
  
  // STEP 4: Add readiness data
  console.log(`📊 Adding readiness data from ${readinessData.length} readiness records...`);
  readinessData.forEach(readiness => {
    const existing = combinedByDate.get(readiness.day) || { 
      date: readiness.day, 
      sleep: null 
    };
    
    existing.readiness = {
      id: readiness.id,
      readiness_score: readiness.score,
      temperature_deviation: readiness.temperature_deviation || 0,
      activity_balance: readiness.contributors?.activity_balance || 0,
      hrv_balance: readiness.contributors?.hrv_balance || 0,
      previous_day_activity: readiness.contributors?.previous_day_activity || 0,
      previous_night_score: readiness.contributors?.previous_night || 0,
      recovery_index: readiness.contributors?.recovery_index || 0,
      resting_heart_rate: readiness.contributors?.resting_heart_rate || 0,
      sleep_balance: readiness.contributors?.sleep_balance || 0
    };
    
    combinedByDate.set(readiness.day, existing);
    console.log(`✅ Added readiness score ${readiness.score} for ${readiness.day}`);
  });
  
  const finalData = Array.from(combinedByDate.values()).sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  
  console.log(`🎯 FINAL COMBINED DATA: ${finalData.length} days processed`);
  finalData.forEach(day => {
    const sleepHours = day.sleep ? Math.round(day.sleep.total_sleep_duration / 3600 * 10) / 10 : 0;
    const sleepScore = day.sleep?.sleep_score || 'N/A';
    const readinessScore = day.readiness?.readiness_score || 'N/A';
    console.log(`   ${day.date}: Sleep ${sleepHours}h (score: ${sleepScore}), Readiness: ${readinessScore}`);
  });
  
  return finalData;
}

// Get cached sleep data from Firestore
async function getCachedSleepData(userId, days) {
  try {
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - days);
    const cutoffDate = daysAgo.toISOString().split('T')[0];
    
    const snapshot = await db
      .collection('oura_sleep_data')
      .where('userId', '==', userId)
      .where('date', '>=', cutoffDate)
      .orderBy('date', 'desc')
      .limit(days)
      .get();
    
    const data = [];
    snapshot.docs.forEach(doc => {
      const docData = doc.data();
      data.push({
        date: docData.date,
        sleep: docData.sleep || null,
        readiness: docData.readiness || null
      });
    });
    
    console.log(`📦 Retrieved ${data.length} days of cached sleep data`);
    return data;
  } catch (error) {
    console.error('❌ Error fetching cached sleep data:', error);
    return [];
  }
}

// Save sleep data to Firestore cache
async function saveSleepDataToCache(userId, combinedData) {
  try {
    const batch = db.batch();
    
    for (const dayData of combinedData) {
      const docRef = db.collection('oura_sleep_data').doc(`${userId}_${dayData.date}`);
      batch.set(docRef, {
        userId,
        date: dayData.date,
        sleep: dayData.sleep,
        readiness: dayData.readiness,
        synced_at: new Date().toISOString()
      }, { merge: true });
    }
    
    await batch.commit();
    console.log(`✅ Saved ${combinedData.length} days of sleep data to cache`);
  } catch (error) {
    console.error('❌ Error saving sleep data to cache:', error);
  }
}

// Main API handler
export default async function handler(req, res) {
  const { userId = 'mihir_jain', mode = 'cached', days = 7 } = req.query;
  
  try {
    console.log(`🌙 Oura Sleep API: mode=${mode}, days=${days}, userId=${userId}`);
    
    if (mode === 'cached') {
      const cachedData = await getCachedSleepData(userId, days);
      if (cachedData && cachedData.length > 0) {
        console.log(`📊 Serving cached sleep data: ${cachedData.length} days`);
        res.setHeader('X-Data-Source', 'cache');
        res.setHeader('X-API-Calls', '0');
        return res.status(200).json(cachedData);
      }
      
      return res.status(404).json({
        message: 'No cached sleep data available',
        recommendRefresh: true
      });
    }
    
    if (mode === 'refresh') {
      console.log(`🔄 Fetching fresh sleep data from Oura API for last ${days} days`);
      
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));
      const startDateStr = startDate.toISOString().split('T')[0];
      
      console.log(`📅 Date range: ${startDateStr} to ${endDate}`);
      
      // Fetch ALL three endpoints in parallel
      const [sleepPeriods, dailySleep, readinessData] = await Promise.all([
        fetchOuraSleepPeriods(startDateStr, endDate),
        fetchOuraDailySleep(startDateStr, endDate), 
        fetchOuraReadinessData(startDateStr, endDate)
      ]);
      
      console.log(`🎯 Raw data fetched:`);
      console.log(`   - ${sleepPeriods.length} sleep periods`);
      console.log(`   - ${dailySleep.length} daily sleep scores`);
      console.log(`   - ${readinessData.length} readiness scores`);
      
      // Combine all data by date and filter for main sleep periods
      const combinedData = combineOuraData(sleepPeriods, dailySleep, readinessData);
      
      // Save to cache
      await saveSleepDataToCache(userId, combinedData);
      
      res.setHeader('X-Data-Source', 'oura-api');
      res.setHeader('X-API-Calls', '3'); // Sleep periods + Daily sleep + Readiness
      
      console.log(`✅ Returning ${combinedData.length} days of processed sleep data`);
      return res.status(200).json(combinedData);
    }
    
    // Invalid mode
    return res.status(400).json({
      message: 'Invalid mode. Use "cached" or "refresh"'
    });
    
  } catch (error) {
    console.error('❌ Error in oura-sleep API:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch sleep data',
      error: error.message 
    });
  }
}
