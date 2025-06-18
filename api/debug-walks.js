// api/debug-walks.js - Debug why walk calories aren't being restored

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
    const userId = 'mihir_jain';
    
    console.log(`🚶‍♂️ Debugging walk calorie recovery for ${userId}`);

    // Find walk activities with 0 calories
    const snapshot = await db
      .collection('strava_data')
      .where('userId', '==', userId)
      .where('type', '==', 'Walk')
      .where('calories', '==', 0)
      .orderBy('start_date', 'desc')
      .limit(20)
      .get();

    console.log(`📊 Found ${snapshot.docs.length} walks with 0 calories`);

    if (snapshot.empty) {
      // Check if there are any walks at all
      const allWalksSnapshot = await db
        .collection('strava_data')
        .where('userId', '==', userId)
        .where('type', '==', 'Walk')
        .orderBy('start_date', 'desc')
        .limit(10)
        .get();

      const allWalks = allWalksSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: data.id,
          name: data.name,
          date: data.start_date?.split('T')[0],
          calories: data.calories,
          distance: data.distance,
          moving_time: data.moving_time
        };
      });

      return res.json({
        success: true,
        message: 'No walks found with 0 calories',
        totalWalks: allWalks.length,
        allWalks,
        summary: {
          walksWithCalories: allWalks.filter(w => w.calories > 0).length,
          walksWithoutCalories: allWalks.filter(w => w.calories === 0).length
        }
      });
    }

    // Get Strava access token
    const { 
      VITE_STRAVA_CLIENT_ID: clientId,
      VITE_STRAVA_CLIENT_SECRET: clientSecret,
      VITE_STRAVA_REFRESH_TOKEN: refreshToken 
    } = process.env;

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

    // Test walk activities specifically
    const walkTests = [];
    let apiCallsUsed = 1; // Token refresh

    const walksToTest = snapshot.docs.slice(0, 5); // Test up to 5 walks

    for (const doc of walksToTest) {
      const data = doc.data();
      
      if (apiCallsUsed >= 10) {
        console.log(`⚠️ Stopping at ${apiCallsUsed} API calls for debugging`);
        break;
      }

      try {
        console.log(`🚶‍♂️ Testing walk ${data.id}: ${data.name}`);

        // Test detailed endpoint for this walk
        const detailResp = await fetch(
          `https://www.strava.com/api/v3/activities/${data.id}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        
        apiCallsUsed++;

        if (!detailResp.ok) {
          walkTests.push({
            activityId: data.id,
            name: data.name,
            date: data.start_date?.split('T')[0],
            error: `API Error: ${detailResp.status}`,
            reason: detailResp.status === 404 ? 'Activity not found or private' : 'API error'
          });
          continue;
        }

        const detailData = await detailResp.json();

        // Analyze the walk data
        const walkAnalysis = {
          activityId: data.id,
          name: detailData.name || data.name,
          type: detailData.type,
          date: data.start_date?.split('T')[0],
          
          // Current state
          cachedCalories: data.calories || 0,
          
          // Strava detailed endpoint data
          stravaCalories: detailData.calories || 0,
          hasCaloriesInStrava: !!(detailData.calories && detailData.calories > 0),
          
          // Walk characteristics
          distance: (detailData.distance || 0) / 1000, // km
          movingTime: detailData.moving_time || 0,
          elapsedTime: detailData.elapsed_time || 0,
          pace: detailData.moving_time && detailData.distance ? 
                ((detailData.moving_time / 60) / (detailData.distance / 1000)).toFixed(2) : null,
          
          // Device/source info
          isManual: detailData.manual || false,
          hasHeartrate: detailData.has_heartrate || false,
          averageHeartrate: detailData.average_heartrate,
          deviceName: detailData.device_name || 'Unknown',
          uploadSource: detailData.upload_id ? 'App/Device' : 'Manual',
          
          // Additional calorie-related fields
          kilojoules: detailData.kilojoules || 0,
          averageWatts: detailData.average_watts || 0,
          
          // What Strava detailed endpoint actually contains
          detailedFields: {
            calories: detailData.calories,
            kilojoules: detailData.kilojoules,
            manual: detailData.manual,
            device_name: detailData.device_name,
            has_heartrate: detailData.has_heartrate,
            average_heartrate: detailData.average_heartrate,
            upload_id: detailData.upload_id
          }
        };

        // Determine why calories might be missing
        if (!walkAnalysis.hasCaloriesInStrava) {
          if (walkAnalysis.isManual) {
            walkAnalysis.reason = 'Manual walk entry - no device data for calorie calculation';
          } else if (!walkAnalysis.hasHeartrate) {
            walkAnalysis.reason = 'No heart rate data for calorie calculation';
          } else if (walkAnalysis.distance === 0) {
            walkAnalysis.reason = 'Zero distance walk - insufficient data for calories';
          } else {
            walkAnalysis.reason = 'Unknown - device/app may not have provided calorie data';
          }
        } else {
          walkAnalysis.reason = 'Calories available in Strava detailed endpoint!';
          walkAnalysis.recoverable = true;
        }

        walkTests.push(walkAnalysis);

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        walkTests.push({
          activityId: data.id,
          name: data.name,
          error: error.message,
          reason: 'Debug error'
        });
      }
    }

    // Summary of walk calorie issues
    const summary = {
      totalWalksWithZeroCalories: snapshot.docs.length,
      walksTestable: walksToTest.length,
      walksTested: walkTests.length,
      walksWithRecoverableCalories: walkTests.filter(w => w.recoverable).length,
      walksManual: walkTests.filter(w => w.isManual).length,
      walksWithHeartRate: walkTests.filter(w => w.hasHeartrate).length,
      walksWithoutHeartRate: walkTests.filter(w => !w.hasHeartrate).length,
      apiCallsUsed,
      
      // Device breakdown for walks
      walkDevices: walkTests.reduce((acc, w) => {
        if (w.deviceName) {
          acc[w.deviceName] = (acc[w.deviceName] || 0) + 1;
        }
        return acc;
      }, {}),
      
      // Reason breakdown
      reasonBreakdown: walkTests.reduce((acc, w) => {
        acc[w.reason] = (acc[w.reason] || 0) + 1;
        return acc;
      }, {})
    };

    return res.json({
      success: true,
      message: `Walk calorie analysis complete: ${summary.walksWithRecoverableCalories}/${summary.walksTested} walks have recoverable calories`,
      summary,
      walkTests,
      recommendations: [
        summary.walksWithRecoverableCalories > 0 ? 
          `${summary.walksWithRecoverableCalories} walks have calories in Strava - recovery script should work` :
          'No walks have calories in Strava detailed endpoint',
        summary.walksManual > 0 ?
          `${summary.walksManual} walks are manual entries - these typically don\'t have calories` :
          'No manual walk entries detected',
        summary.walksWithoutHeartRate > 0 ?
          `${summary.walksWithoutHeartRate} walks missing heart rate data - may affect calorie calculation` :
          'All walks have heart rate data',
        summary.walksWithRecoverableCalories === 0 ?
          'Consider using a fitness tracker that provides calorie data for walks' :
          'Run recovery script specifically for walks',
        'Check if your walking device/app is properly syncing calorie data to Strava'
      ],
      nextSteps: summary.walksWithRecoverableCalories > 0 ? [
        'Run recovery script specifically for walks:',
        'https://my23.ai/api/recover-calories?skip_auth=true&mode=live&type=Walk&max=20'
      ] : [
        'Walks don\'t have calorie data in Strava',
        'Check device/app settings for calorie tracking',
        'Consider using Apple Watch, Garmin, or Fitbit for walk tracking'
      ]
    });

  } catch (error) {
    console.error('❌ Walk debug failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
