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

    const normalizedMarkers = {};
    for (const [key, param] of Object.entries(parameters)) {
      normalizedMarkers[key] = param.value;
    }

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
