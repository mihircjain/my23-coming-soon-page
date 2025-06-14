// =============================================================================
// 3. BLOOD REPORT CONFIRMATION API - /api/blood-report/confirm
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebaseConfig';
import { doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const { userId, reportId, parameters, reportDate } = await request.json();

    if (!userId || !reportId || !parameters) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log(`💾 Saving blood parameters for user: ${userId}`);

    // Save to blood_markers collection
    const bloodMarkersRef = doc(db, 'blood_markers', userId);
    
    // Convert parameters to the format expected by BodyJam
    const normalizedMarkers: Record<string, number | string> = {};
    
    for (const [key, param] of Object.entries(parameters)) {
      normalizedMarkers[key] = (param as any).value;
    }

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

    console.log('✅ Blood parameters saved successfully');

    return NextResponse.json({
      success: true,
      parameters: normalizedMarkers,
      savedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Confirmation error:', error);
    return NextResponse.json(
      { error: 'Failed to save parameters: ' + error.message },
      { status: 500 }
    );
  }
}

