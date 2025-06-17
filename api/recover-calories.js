// api/recover-calories.js - Quick calorie recovery you can run via URL

import admin from 'firebase-admin';

// Initialize Firebase Admin (same as your other files)
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
  try {
    // Simple auth check (temporarily disabled for testing)
    const secret = req.query.secret;
    if (secret !== process.env.ADMIN_SECRET && !req.query.skip_auth) {
      return res.status(401).json({ error: 'Unauthorized - check ADMIN_SECRET' });
    }

    const mode = req.query.mode || 'dry'; // 'dry' or 'live'
    const maxActivities = parseInt(req.query.max) || 20;
    const userId = 'mihir_jain';

    console.log(`🔥 Calorie recovery: mode=${mode}, max=${maxActivities}`);

    // Find activities with 0 calories (no orderBy to avoid index requirement)
    const snapshot = await db
      .collection('strava_data')
      .where('userId', '==', userId)
      .where('calories', '==', 0)
      .limit(maxActivities * 3)
      .get();

    if (snapshot.empty) {
      return res.json({
        success: true,
        message: 'No activities with 0 calories found',
        recoveredCount: 0
      });
    }

    // Prioritize runs and recent activities
    let activities = snapshot.docs.map(doc => ({
      docRef: doc.ref,
      data: doc.data()
    }));

    // Sort: runs first, then by date
    activities.sort((a, b) => {
      const aIsRun = a.data.type?.toLowerCase().includes('run') ? 1 : 0;
      const bIsRun = b.data.type?.toLowerCase().includes('run') ? 1 : 0;
      
      if (aIsRun !== bIsRun) return bIsRun - aIsRun;
      return new Date(b.data.start_date) - new Date(a.data.start_date);
    });

    activities = activities.slice(0, maxActivities);

    console.log(`🔍 Found ${activities.length} activities to check`);

    if (mode === 'dry') {
      // Dry run - just return what we would check
      const summary = activities.map(({ data }) => ({
        id: data.id,
        name: data.name,
        type: data.type,
        date: data.start_date?.split('T')[0],
        isRun: data.type?.toLowerCase().includes('run')
      }));

      return res.json({
        success: true,
        mode: 'dry',
        message: `Dry run: Found ${activities.length} activities to check for calories`,
        activitiesToCheck: summary,
        nextStep: `Run with mode=live to actually recover calories`,
        estimatedApiCalls: activities.length + 1
      });
    }

    // Live mode - actually recover calories
    const { 
      VITE_STRAVA_CLIENT_ID: clientId,
      VITE_STRAVA_CLIENT_SECRET: clientSecret,
      VITE_STRAVA_REFRESH_TOKEN: refreshToken 
    } = process.env;

    // Get access token
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
      throw new Error(`Token refresh failed: ${tokenResp.status}`);
    }

    const { access_token: accessToken } = await tokenResp.json();
    
    let recoveredCount = 0;
    let apiCallsUsed = 1; // Token refresh
    let skippedCount = 0;
    const recoveredActivities = [];

    // Process activities
    for (const { docRef, data } of activities) {
      if (apiCallsUsed >= 80) {
        console.log(`⚠️ Rate limit protection: stopping at ${apiCallsUsed} calls`);
        break;
      }

      try {
        console.log(`🔍 Checking ${data.type}: ${data.name} (${data.id})`);
        
        const detailResp = await fetch(
          `https://www.strava.com/api/v3/activities/${data.id}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        
        apiCallsUsed++;
        
        if (!detailResp.ok) {
          if (detailResp.status === 429) {
            console.log(`⚠️ Rate limited, stopping`);
            break;
          }
          console.log(`❌ Failed to fetch ${data.id}: ${detailResp.status}`);
          skippedCount++;
          continue;
        }
        
        const detailData = await detailResp.json();
        
        if (detailData.calories && detailData.calories > 0) {
          console.log(`🔥 FOUND calories for ${data.id}: ${detailData.calories}`);
          
          await docRef.update({
            calories: detailData.calories,
            calories_recovered: true,
            calories_recovery_date: new Date().toISOString()
          });
          
          recoveredActivities.push({
            id: data.id,
            name: data.name,
            type: data.type,
            calories: detailData.calories,
            date: data.start_date?.split('T')[0]
          });
          
          recoveredCount++;
        } else {
          console.log(`❌ No calories in Strava for ${data.id}`);
          skippedCount++;
        }
        
        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 150));
        
      } catch (error) {
        console.error(`❌ Error with ${data.id}:`, error);
        skippedCount++;
      }
    }

    console.log(`✅ Recovery complete: ${recoveredCount} recovered, ${skippedCount} skipped, ${apiCallsUsed} API calls`);

    return res.json({
      success: true,
      mode: 'live',
      recoveredCount,
      skippedCount,
      apiCallsUsed,
      recoveredActivities,
      summary: {
        message: `Successfully recovered calories for ${recoveredCount} activities`,
        apiUsage: `${apiCallsUsed}/600 (${Math.round(apiCallsUsed/600*100)}%)`,
        nextSteps: recoveredCount > 0 ? 'Refresh your app to see updated calories' : 'No calories were found to recover'
      }
    });

  } catch (error) {
    console.error('❌ Recovery failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
