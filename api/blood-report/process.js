// pages/api/blood-report/process.js
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

export default async function handler(req, res) {
  console.log('🔍 Process API called, method:', req.method);
  
  if (req.method !== 'POST') {
    console.log('❌ Wrong method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('📋 Request body:', req.body);
    
    const { fileId, userId, filePath } = req.body;
    
    console.log('🔍 Processing request:', { fileId, userId, filePath });
    
    if (!fileId || !userId) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ 
        error: 'fileId and userId are required',
        received: { fileId, userId, filePath }
      });
    }

    // Check if file exists using the filePath from upload response
    let actualFilePath = filePath;
    
    if (!actualFilePath || !existsSync(actualFilePath)) {
      console.log('❌ File not found at:', actualFilePath);
      return res.status(404).json({ 
        error: 'Uploaded file not found',
        filePath: actualFilePath
      });
    }

    console.log('📄 Reading file from:', actualFilePath);
    const fileBuffer = await readFile(actualFilePath);
    console.log('📄 File read successfully, size:', fileBuffer.length);

    // Simulate AI processing delay
    console.log('🤖 Starting AI processing...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Mock extracted parameters (replace with actual AI processing)
    const extractedParameters = {
      hemoglobin: {
        value: 16.3,
        unit: 'g/dL',
        normalRange: '13.5-17.5 g/dL (men); 12.0-15.5 (women)',
        displayName: 'Hemoglobin',
        confidence: 0.95,
        status: 'normal'
      },
      rbc: {
        value: 5.80,
        unit: 'mill/mm³',
        normalRange: '4.5-5.9 million cells/mcL (men); 4.1-5.1 (women)',
        displayName: 'RBC Count',
        confidence: 0.92,
        status: 'normal'
      },
      wbc: {
        value: 5560,
        unit: 'cells/mm³',
        normalRange: '4,500-11,000 cells/mcL',
        displayName: 'WBC Count',
        confidence: 0.88,
        status: 'normal'
      },
      platelets: {
        value: 309,
        unit: '10³/µL',
        normalRange: '150,000-450,000 platelets/mcL',
        displayName: 'Platelet Count',
        confidence: 0.90,
        status: 'normal'
      },
      glucose: {
        value: 89,
        unit: 'mg/dL',
        normalRange: '70-140 mg/dL (random); 70-99 mg/dL (fasting)',
        displayName: 'Glucose',
        confidence: 0.93,
        status: 'normal'
      },
      total_cholesterol: {
        value: 144,
        unit: 'mg/dL',
        normalRange: 'Less than 200 mg/dL',
        displayName: 'Total Cholesterol',
        confidence: 0.89,
        status: 'normal'
      },
      hdl: {
        value: 38,
        unit: 'mg/dL',
        normalRange: '40 mg/dL or higher (men); 50 or higher (women)',
        displayName: 'HDL Cholesterol',
        confidence: 0.91,
        status: 'low'
      },
      ldl: {
        value: 96,
        unit: 'mg/dL',
        normalRange: 'Less than 100 mg/dL',
        displayName: 'LDL Cholesterol',
        confidence: 0.87,
        status: 'normal'
      },
      triglycerides: {
        value: 50,
        unit: 'mg/dL',
        normalRange: 'Less than 150 mg/dL',
        displayName: 'Triglycerides',
        confidence: 0.94,
        status: 'normal'
      },
      creatinine: {
        value: 0.7,
        unit: 'mg/dL',
        normalRange: '0.7-1.3 mg/dL (men); 0.6-1.1 mg/dL (women)',
        displayName: 'Creatinine',
        confidence: 0.86,
        status: 'normal'
      },
      hba1c: {
        value: 5.1,
        unit: '%',
        normalRange: 'Below 5.7%',
        displayName: 'HbA1C',
        confidence: 0.92,
        status: 'normal'
      },
      tsh: {
        value: 2.504,
        unit: 'µIU/mL',
        normalRange: '0.4-4.0 µIU/mL',
        displayName: 'TSH',
        confidence: 0.88,
        status: 'normal'
      },
      vitamin_d: {
        value: 48.2,
        unit: 'ng/mL',
        normalRange: '20-50 ng/mL',
        displayName: 'Vitamin D',
        confidence: 0.90,
        status: 'normal'
      },
      vitamin_b12: {
        value: 405,
        unit: 'pg/mL',
        normalRange: '200-900 pg/mL',
        displayName: 'Vitamin B12',
        confidence: 0.85,
        status: 'normal'
      },
      uric_acid: {
        value: 4.4,
        unit: 'mg/dL',
        normalRange: '3.5-7.2 mg/dL (men); 2.5-6.0 mg/dL (women)',
        displayName: 'Uric Acid',
        confidence: 0.89,
        status: 'normal'
      }
    };

    const response = {
      success: true,
      reportId: fileId,
      userId,
      parameters: extractedParameters,
      reportDate: new Date().toISOString().split('T')[0], // Today's date as fallback
      extractedAt: new Date().toISOString(),
      totalParameters: Object.keys(extractedParameters).length,
      averageConfidence: Object.values(extractedParameters)
        .reduce((sum, param) => sum + param.confidence, 0) / Object.keys(extractedParameters).length
    };

    console.log('✅ Processing completed successfully');
    console.log('📊 Extracted', Object.keys(extractedParameters).length, 'parameters');
    
    return res.status(200).json(response);

  } catch (error) {
    console.error('❌ Processing error:', error);
    return res.status(500).json({ 
      error: 'Processing failed: ' + error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
