// /api/debug-calories.js - Debug what calories exist for specific dates

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

export default async function handler(req, res) {
  console.log('🔍 DEBUG CALORIES API');
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = req.query.userId || 'mihir_jain';
    const startDate = req.query.startDate || '2024-05-18';
    const endDate = req.query.endDate || '2024-05-22';
    
    console.log(`🔍 Debugging calories for ${userId} from ${startDate} to ${endDate}`);
    
    // Query Firestore for activities in date range
    const snapshot = await db
      .collection('strava_data')
      .where('userId', '==', userId)
      .where('start_date', '>=', startDate + 'T00:00:00Z')
      .where('start_date', '<=', endDate + 'T23:59:59Z')
      .orderBy('start_date', 'asc')
      .get();
    
    const activities = [];
    const dailyBreakdown = new Map();
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const date = data.start_date?.split('T')[0];
      
      if (!dailyBreakdown.has(date)) {
        dailyBreakdown.set(date, []);
      }
      
      const activity = {
        id: data.id,
        name: data.name,
        type: data.type,
        date: date,
        start_date: data.start_date,
        calories: data.calories || 0,
        calorie_source: data.calorie_source || 'unknown',
        distance: data.distance || 0,
        moving_time: data.moving_time || 0,
        last_calorie_fetch: data.last_calorie_fetch,
        fetched_at: data.fetched_at
      };
      
      activities.push(activity);
      dailyBreakdown.get(date).push(activity);
    });
    
    // Calculate daily totals
    const dailyTotals = {};
    const targetDates = ['2024-05-18', '2024-05-19', '2024-05-20', '2024-05-21', '2024-05-22'];
    
    targetDates.forEach(date => {
      const dayActivities = dailyBreakdown.get(date) || [];
      dailyTotals[date] = {
        totalCalories: dayActivities.reduce((sum, a) => sum + (a.calories || 0), 0),
        activitiesCount: dayActivities.length,
        activitiesWithCalories: dayActivities.filter(a => a.calories > 0).length,
        activitiesWithoutCalories: dayActivities.filter(a => a.calories === 0).length,
        activities: dayActivities.map(a => ({
          id: a.id,
          name: a.name,
          type: a.type,
          calories: a.calories,
          calorie_source: a.calorie_source,
          distance: a.distance,
          time: Math.round(a.moving_time / 60) + 'min'
        }))
      };
    });
    
    console.log(`🔍 Found ${activities.length} activities in date range`);
    
    // Additional debugging - check for June 18th too
    const june18Snapshot = await db
      .collection('strava_data')
      .where('userId', '==', userId)
      .where('start_date', '>=', '2024-06-18T00:00:00Z')
      .where('start_date', '<=', '2024-06-18T23:59:59Z')
      .get();
    
    const june18Activities = june18Snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: data.id,
        name: data.name,
        type: data.type,
        calories: data.calories || 0,
        calorie_source: data.calorie_source || 'unknown',
        distance: data.distance || 0,
        start_date: data.start_date
      };
    });
    
    return res.status(200).json({
      userId,
      dateRange: { startDate, endDate },
      totalActivities: activities.length,
      
      // May 18-22 breakdown
      may18to22: {
        summary: {
          datesWithActivities: Array.from(dailyBreakdown.keys()).sort(),
          totalCaloriesInRange: activities.reduce((sum, a) => sum + (a.calories || 0), 0),
          activitiesWithCalories: activities.filter(a => a.calories > 0).length,
          activitiesWithoutCalories: activities.filter(a => a.calories === 0).length
        },
        dailyTotals
      },
      
      // June 18 comparison
      june18: {
        activitiesCount: june18Activities.length,
        totalCalories: june18Activities.reduce((sum, a) => sum + (a.calories || 0), 0),
        activities: june18Activities
      },
      
      // Raw data for inspection
      allActivitiesInRange: activities,
      
      // Recommendations
      recommendations: activities.length === 0 
        ? ['No activities found in date range - try refreshing data from Strava']
        : activities.filter(a => a.calories === 0).length > 0
        ? [`${activities.filter(a => a.calories === 0).length} activities have 0 calories - need to fetch from detailed API`]
        : ['All activities have calories - chart processing issue']
    });
    
  } catch (error) {
    console.error('❌ Debug calories API error:', error);
    return res.status(500).json({
      error: 'Debug failed',
      message: error.message
    });
  }
}
