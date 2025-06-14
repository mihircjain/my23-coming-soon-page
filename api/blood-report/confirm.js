import { db } from '../../../lib/firebaseConfig.js';
import { doc, setDoc } from 'firebase/firestore';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, reportId, parameters, reportDate } = req.body;

    if (!userId || !reportId || !parameters) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`💾 Saving blood parameters for user: ${userId}`);

    // Convert parameters to the format expected by BodyJam
    const normalizedMarkers = {};
    
    for (const [key, param] of Object.entries(parameters)) {
      normalizedMarkers[key] = param.value;
    }

    // Save to blood_markers collection
    const bloodMarkersRef = doc(db, 'blood_markers', userId);
    const bloodMarkersData = {
      userId,
      markers: normalizedMarkers,
      lastUpdated: new Date().toISOString(),
      source: 'ai_extracted',
      reportDate: reportDate || new Date().toISOString(),
      reportId
    };

    await setDoc(bloodMarkersRef, bloodMarkersData, { merge: true });

    // Also save the full report data for historical tracking
    const reportRef = doc(db, 'blood_reports', `${userId}_${reportId}`);
    const reportData = {
      userId,
      reportId,
      uploadDate: new Date().toISOString(),
      reportDate: reportDate || new Date().toISOString(),
      parameters,
      status: 'confirmed',
      confirmedAt: new Date().toISOString()
    };

    await setDoc(reportRef, reportData);

    console.log('✅ Blood parameters saved successfully for', userId);

    res.status(200).json({
      success: true,
      parameters: normalizedMarkers,
      savedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Confirmation error:', error);
    res.status(500).json({ error: 'Failed to save parameters: ' + error.message });
  }
}

// =============================================================================
// 4. /pages/api/blood-markers/[userId].js - NO CHANGES NEEDED  
// =============================================================================

import { db } from '../../../lib/firebaseConfig.js';
import { doc, getDoc } from 'firebase/firestore';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log(`📊 Fetching blood markers for user: ${userId}`);

    const bloodMarkersRef = doc(db, 'blood_markers', userId);
    const bloodMarkersDoc = await getDoc(bloodMarkersRef);

    if (!bloodMarkersDoc.exists()) {
      return res.status(200).json({
        markers: {},
        lastUpdated: null,
        message: 'No blood markers found'
      });
    }

    const data = bloodMarkersDoc.data();
    
    res.status(200).json({
      markers: data.markers || {},
      lastUpdated: data.lastUpdated,
      source: data.source,
      reportDate: data.reportDate
    });

  } catch (error) {
    console.error('Retrieval error:', error);
    res.status(500).json({ error: 'Failed to fetch blood markers: ' + error.message });
  }
}
