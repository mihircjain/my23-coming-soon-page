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
