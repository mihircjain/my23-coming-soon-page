// Serverless function to handle Strava API calls securely
// This will be deployed as a Vercel serverless function
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
  try {
    // Only allow GET requests
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get Strava credentials from environment variables
    const clientId = process.env.VITE_STRAVA_CLIENT_ID;
    const clientSecret = process.env.VITE_STRAVA_CLIENT_SECRET;
    const refreshToken = process.env.VITE_STRAVA_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      return res.status(500).json({ error: 'Missing Strava credentials' });
    }

    // First, get a new access token using the refresh token
    const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });
    
    if (!tokenResponse.ok) {
      const tokenError = await tokenResponse.text();
      console.error('Error refreshing Strava token:', tokenError);
      return res.status(tokenResponse.status).json({ error: 'Failed to refresh Strava token' });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    
    // Now use the access token to fetch activities
    const activitiesResponse = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=50', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!activitiesResponse.ok) {
      const activitiesError = await activitiesResponse.text();
      console.error('Error fetching Strava activities:', activitiesError);
      return res.status(activitiesResponse.status).json({ error: 'Failed to fetch Strava activities' });
    }
    
    const activitiesData = await activitiesResponse.json();
    const userId = req.query.userId || 'mihir_jain';

// Write each activity to Firestore under 'strava_data' collection
const batch = db.batch();

activitiesData.forEach((activity) => {
  const docId = activity.id.toString(); // unique Strava activity ID
  const docRef = db.collection('strava_data').doc(`${userId}_${docId}`);

  batch.set(docRef, {
    userId,
    name: activity.name,
    type: activity.type,
    distance: activity.distance,
    duration: activity.moving_time,
    heart_rate: activity.has_heartrate ? activity.average_heartrate : null,
    elevation_gain: activity.total_elevation_gain,
    calories: activity.calories || null,
    start_date: activity.start_date,
    fetched_at: new Date().toISOString(),
  });
});

await batch.commit();
console.log(`Saved ${activitiesData.length} Strava activities to Firestore`);

 
    // Return the activities data
    return res.status(200).json(activitiesData);
  } catch (error) {
    console.error('Error in Strava API handler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
