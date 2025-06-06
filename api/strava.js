// api/strava.js
// Vercel serverless function – fetch Strava activities and cache to Firestore

import admin from 'firebase-admin';

/* ──────────────────────────────────────────────────────────────────── */
/*  Firebase Admin init                                               */
/* ──────────────────────────────────────────────────────────────────── */
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.VITE_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}
const db = admin.firestore();

/* ──────────────────────────────────────────────────────────────────── */
/*  Helper – fetch detail activity (may contain calories)             */
/* ──────────────────────────────────────────────────────────────────── */
const fetchActivityDetail = async (id, token) => {
  const r = await fetch(`https://www.strava.com/api/v3/activities/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  return await r.json();
};

/* ──────────────────────────────────────────────────────────────────── */
/*  Main handler                                                      */
/* ──────────────────────────────────────────────────────────────────── */
export default async function handler(req, res) {
  try {
    if (req.method !== 'GET')
      return res.status(405).json({ error: 'Method not allowed' });
    const userId = req.query.userId || 'mihir_jain';
    
    /* ––– Strava creds ––– */
    const { VITE_STRAVA_CLIENT_ID:     clientId,
            VITE_STRAVA_CLIENT_SECRET: clientSecret,
            VITE_STRAVA_REFRESH_TOKEN: refreshToken } = process.env;
    if (!clientId || !clientSecret || !refreshToken)
      return res.status(500).json({ error: 'Missing Strava credentials' });

    /* ––– Refresh access-token ––– */
    const tokenResp = await fetch('https://www.strava.com/oauth/token', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        client_id    : clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type   : 'refresh_token',
      }),
    });
    if (!tokenResp.ok) {
      const txt = await tokenResp.text();
      console.error('Strava token error:', txt);
      return res.status(tokenResp.status).json({ error: txt });
    }
    const { access_token: accessToken } = await tokenResp.json();

    /* ––– List last 50 activities ––– */
     const listResp = await fetch(
   'https://www.strava.com/api/v3/athlete/activities?per_page=50',
   { headers: { Authorization: `Bearer ${accessToken}` } }
 );

 /* ─── Short-term rate-limit guard (100 calls / 15 min) ─── */
 const usageHdr   = listResp.headers.get('x-ratelimit-usage') || '0,0';
 const [shortUse] = usageHdr.split(',').map(Number);        // e.g. "98,440"
 if (shortUse >= 98) {
   console.warn('Strava 15-min bucket full; serving cached Firestore data');
   const snapshot = await db
     .collection('strava_data')
     .where('userId', '==', userId)
     .orderBy('start_date', 'desc')
     .limit(50)
     .get();
   return res.status(200).json(snapshot.docs.map(d => d.data()));
 }
 if (!listResp.ok) {
   const txt = await listResp.text();
   console.error('Strava list error:', txt);
      return res.status(listResp.status).json({ error: txt });
 }
 const activitiesData = await listResp.json();
 const summaries      = [];           /* cleaned objects we’ll return */

    /* ––– Write / update each activity ––– */
    const batch = db.batch();

    for (const a of activitiesData) {
      const minutes  = Math.round(a.moving_time / 60);
      /* calories: list value → detail value → fallback */
      let calories = a.calories;
      if (calories == null) {
        const detail = await fetchActivityDetail(a.id, accessToken);
        if (detail && detail.calories != null) calories = detail.calories;
      }
      if (calories == null) calories = Math.round(minutes * 7);

      const summary = {
        userId,
        start_date    : a.start_date,
        date          : a.start_date.split('T')[0],        // yyyy-mm-dd
        type          : a.type,
        heart_rate    : a.has_heartrate ? a.average_heartrate : null,
        distance      : a.distance / 1000,                 // km
        duration      : minutes,                           // minutes
        caloriesBurned: calories,
        elevation_gain: a.total_elevation_gain,
        name          : a.name,
        fetched_at    : new Date().toISOString(),
      };

      summaries.push(summary);  
      

      const docRef = db.collection('strava_data')
                       .doc(`${userId}_${a.id}`);          // unique ID
      batch.set(docRef, summary, { merge: true });
    }

    await batch.commit();
    console.log(`Saved ${activitiesData.length} activities to Firestore`);
    

    return res.status(200).json(summaries);          // frontend uses this
  } catch (err) {
    console.error('Strava handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
