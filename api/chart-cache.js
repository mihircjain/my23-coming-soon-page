// /api/chart-cache.js - Fast chart data caching for ActivityJam

import admin from 'firebase-admin';

// Initialize Firebase Admin
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
  console.log(`📊 Chart cache API: ${req.method} ${req.url}`);
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { userId = 'mihir_jain' } = req.query;

  try {
    if (req.method === 'GET') {
      // Load cached chart data
      const cacheRef = db.collection('chart_cache').doc(userId);
      const cacheDoc = await cacheRef.get();

      if (cacheDoc.exists) {
        const cacheData = cacheDoc.data();
        const cacheAge = Date.now() - new Date(cacheData.generatedAt).getTime();
        const hoursOld = Math.round(cacheAge / (1000 * 60 * 60));

        console.log(`📊 Found cached chart data, ${hoursOld} hours old`);

        // Return cache if less than 24 hours old
        if (cacheAge < 24 * 60 * 60 * 1000) {
          return res.status(200).json({
            ...cacheData.chartData,
            cached: true,
            generatedAt: cacheData.generatedAt,
            age: `${hoursOld}h old`
          });
        } else {
          console.log(`📊 Cache too old (${hoursOld}h), needs refresh`);
        }
      }

      return res.status(404).json({ 
        error: 'No fresh cache available',
        message: 'Chart data will be generated'
      });

    } else if (req.method === 'POST') {
      // Cache new chart data
      const { chartData, generatedAt } = req.body;

      if (!chartData) {
        return res.status(400).json({ error: 'Chart data required' });
      }

      console.log(`📊 Caching chart data for ${userId}:`, {
        labels: chartData.labels?.length || 0,
        calories: chartData.calories?.length || 0,
        distance: chartData.distance?.length || 0
      });

      const cacheRef = db.collection('chart_cache').doc(userId);
      await cacheRef.set({
        userId,
        chartData,
        generatedAt: generatedAt || new Date().toISOString(),
        cachedAt: new Date().toISOString()
      });

      console.log(`✅ Cached chart data for ${userId}`);
      
      return res.status(200).json({
        success: true,
        message: 'Chart data cached successfully',
        dataPoints: chartData.labels?.length || 0
      });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('❌ Chart cache error:', error);
    return res.status(500).json({
      error: 'Chart cache operation failed',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal error'
    });
  }
}
