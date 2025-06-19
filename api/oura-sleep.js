// /api/oura-sleep.js - FIXED: Use sleep periods API for detailed data
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
  return data.data || [];
}

// Combine all Oura data by date - FIXED mapping
function combineOuraData(sleepPeriods, dailySleep, readinessData) {
  const combinedByDate = new Map();
  
  // Add detailed sleep periods (this has the actual durations and heart rate!)
  sleepPeriods.forEach(sleep => {
    combinedByDate.set(sleep.day, {
      date: sleep.day,
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
  
  // Add sleep scores from daily_sleep
  dailySleep.forEach(dailyData => {
    const existing = combinedByDate.get(dailyData.day);
    if (existing && existing.sleep) {
      existing.sleep.sleep_score = dailyData.score;
    } else if (!existing) {
      // Sometimes we have daily score but no detailed sleep period
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
  
  // Add readiness data
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
  });
  
  return Array.from(combinedByDate.values()).sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
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
      console.log(`🔄 Fetching fresh sleep data from Oura API`);
      
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));
      const startDateStr = startDate.toISOString().split('T')[0];
      
      // Fetch ALL three endpoints in parallel
      const [sleepPeriods, dailySleep, readinessData] = await Promise.all([
        fetchOuraSleepPeriods(startDateStr, endDate),
        fetchOuraDailySleep(startDateStr, endDate), 
        fetchOuraReadinessData(startDateStr, endDate)
      ]);
      
      console.log(`✅ Fetched: ${sleepPeriods.length} sleep periods, ${dailySleep.length} daily scores, ${readinessData.length} readiness`);
      
      // Combine all data by date
      const combinedData = combineOuraData(sleepPeriods, dailySleep, readinessData);
      
      // Save to cache
      await saveSleepDataToCache(userId, combinedData);
      
      res.setHeader('X-Data-Source', 'oura-api');
      res.setHeader('X-API-Calls', '3'); // Sleep periods + Daily sleep + Readiness
      
      return res.status(200).json(combinedData);
    }
    
  } catch (error) {
    console.error('❌ Error in oura-sleep API:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch sleep data',
      error: error.message 
    });
  }
}
