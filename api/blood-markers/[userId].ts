// =============================================================================
// 4. BLOOD MARKERS RETRIEVAL API - /api/blood-markers/[userId]
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    console.log(`📊 Fetching blood markers for user: ${userId}`);

    const bloodMarkersRef = doc(db, 'blood_markers', userId);
    const bloodMarkersDoc = await getDoc(bloodMarkersRef);

    if (!bloodMarkersDoc.exists()) {
      return NextResponse.json({
        markers: {},
        lastUpdated: null,
        message: 'No blood markers found'
      });
    }

    const data = bloodMarkersDoc.data();
    
    return NextResponse.json({
      markers: data.markers || {},
      lastUpdated: data.lastUpdated,
      source: data.source,
      reportDate: data.reportDate
    });

  } catch (error) {
    console.error('Retrieval error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch blood markers: ' + error.message },
      { status: 500 }
    );
  }
}
