// /api/oura-sleep.js
const OURA_API_BASE = 'https://api.ouraring.com/v2/usercollection';
const OURA_ACCESS_TOKEN = '5YE626QELLKRDLY45QJXLEUIWTWGQJIH'; // Your token

export default async function handler(req, res) {
  const { userId = 'mihir_jain', mode = 'cached', days = 7 } = req.query;
  
  try {
    // Cache-first approach
    if (mode === 'cached') {
      const cachedData = await getCachedSleepData(userId, days);
      if (cachedData && cachedData.length > 0) {
        console.log(`📊 Serving cached sleep data: ${cachedData.length} days`);
        res.setHeader('X-Data-Source', 'cache');
        res.setHeader('X-API-Calls', '0');
        return res.status(200).json(cachedData);
      }
      
      // No cache, recommend refresh
      return res.status(404).json({
        message: 'No cached sleep data available',
        recommendRefresh: true
      });
    }
    
    // Fresh data from Oura API
    if (mode === 'refresh') {
      console.log(`🔄 Fetching fresh sleep data from Oura API`);
      
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));
      const startDateStr = startDate.toISOString().split('T')[0];
      
      // Fetch both sleep and readiness data in parallel
      const [sleepData, readinessData] = await Promise.all([
        fetchOuraSleepData(startDateStr, endDate),
        fetchOuraReadinessData(startDateStr, endDate)
      ]);
      
      // Combine data by date
      const combinedData = combineSleepAndReadinessData(sleepData, readinessData);
      
      // Save to cache
      await saveSleepDataToCache(userId, combinedData);
      
      res.setHeader('X-Data-Source', 'oura-api');
      res.setHeader('X-API-Calls', '2'); // Sleep + Readiness calls
      
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

// Fetch sleep data from Oura API
async function fetchOuraSleepData(startDate, endDate) {
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
    throw new Error(`Oura Sleep API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.data || [];
}

// Fetch readiness data from Oura API
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

// Combine sleep and readiness data by date
function combineSleepAndReadinessData(sleepData, readinessData) {
  const combinedByDate = new Map();
  
  // Add sleep data
  sleepData.forEach(sleep => {
    combinedByDate.set(sleep.day, {
      date: sleep.day,
      sleep: {
        id: sleep.id,
        sleep_score: sleep.score,
        total_sleep_duration: sleep.contributors?.total_sleep * 60 || 0, // Convert to seconds
        deep_sleep_duration: sleep.contributors?.deep_sleep * 60 || 0,
        light_sleep_duration: sleep.contributors?.light_sleep * 60 || 0,
        rem_sleep_duration: sleep.contributors?.rem_sleep * 60 || 0,
        awake_time: sleep.contributors?.awake_time * 60 || 0,
        sleep_efficiency: sleep.contributors?.efficiency || 0,
        sleep_latency: sleep.contributors?.latency * 60 || 0,
        bedtime_start: sleep.contributors?.bedtime_start || null,
        bedtime_end: sleep.contributors?.bedtime_end || null,
        average_heart_rate: sleep.contributors?.average_heart_rate || null,
        lowest_heart_rate: sleep.contributors?.lowest_heart_rate || null,
        temperature_deviation: sleep.contributors?.temperature_deviation || 0,
        respiratory_rate: sleep.contributors?.respiratory_rate || null
      },
      readiness: null
    });
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
