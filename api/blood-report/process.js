// pages/api/blood-report/process.js
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export default async function handler(req, res) {
  console.log('🔍 Process API called, method:', req.method);
  
  if (req.method !== 'POST') {
    console.log('❌ Wrong method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('📋 Request body:', req.body);
    
    const { fileId, userId } = req.body;
    
    console.log('🔍 Processing request:', { fileId, userId });
    
    if (!fileId || !userId) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ 
        error: 'fileId and userId are required',
        received: { fileId, userId }
      });
    }

    const tempDir = '/tmp';
    
    // Look for the file and metadata using the fileId
    const storedFilePath = path.join(tempDir, `${fileId}.data`);
    const metadataPath = path.join(tempDir, `${fileId}.meta`);
    
    console.log('🔍 Looking for file at:', storedFilePath);
    console.log('🔍 Looking for metadata at:', metadataPath);
    
    // Check if files exist
    const fileExists = existsSync(storedFilePath);
    const metadataExists = existsSync(metadataPath);
    
    console.log('📄 File exists:', fileExists);
    console.log('📄 Metadata exists:', metadataExists);
    
    if (!fileExists) {
      // List all files in /tmp for debugging
      const fs = require('fs');
      try {
        const tmpFiles = fs.readdirSync(tempDir);
        console.log('📁 Files in /tmp:', tmpFiles);
        
        // Look for any files containing our fileId
        const relatedFiles = tmpFiles.filter(f => f.includes(fileId));
        console.log('📁 Related files:', relatedFiles);
      } catch (listError) {
        console.log('❌ Could not list /tmp directory:', listError.message);
      }
      
      return res.status(404).json({ 
        error: 'File not found in storage',
        fileId,
        searchedPaths: {
          filePath: storedFilePath,
          metadataPath: metadataPath,
          fileExists,
          metadataExists
        }
      });
    }

    // Read the file content
    console.log('📄 Reading file content...');
    const fileBuffer = await readFile(storedFilePath);
    console.log('📄 File read successfully, size:', fileBuffer.length);
    
    // Read metadata if available
    let metadata = null;
    if (metadataExists) {
      try {
        const metadataContent = await readFile(metadataPath, 'utf8');
        metadata = JSON.parse(metadataContent);
        console.log('📄 Metadata loaded:', metadata);
      } catch (metadataError) {
        console.log('⚠️ Could not read metadata:', metadataError.message);
      }
    }

    // Get file content as text for analysis
    let fileContent = '';
    try {
      fileContent = fileBuffer.toString('utf8');
      console.log('📄 File content preview (first 200 chars):', fileContent.substring(0, 200));
    } catch (error) {
      console.log('⚠️ Could not convert file to text:', error.message);
      fileContent = '[Binary file - could not convert to text]';
    }

    // Simulate AI processing delay
    console.log('🤖 Starting AI processing...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Enhanced mock extracted parameters with realistic values
    const extractedParameters = {
      hemoglobin: {
        value: 15.2,
        unit: 'g/dL',
        normalRange: '13.5-17.5 g/dL (men); 12.0-15.5 (women)',
        displayName: 'Hemoglobin',
        confidence: 0.95,
        status: 'normal'
      },
      rbc: {
        value: 4.85,
        unit: 'mill/mm³',
        normalRange: '4.5-5.9 million cells/mcL (men); 4.1-5.1 (women)',
        displayName: 'RBC Count',
        confidence: 0.92,
        status: 'normal'
      },
      wbc: {
        value: 7200,
        unit: 'cells/mm³',
        normalRange: '4,500-11,000 cells/mcL',
        displayName: 'WBC Count',
        confidence: 0.88,
        status: 'normal'
      },
      platelets: {
        value: 285,
        unit: '10³/µL',
        normalRange: '150,000-450,000 platelets/mcL',
        displayName: 'Platelet Count',
        confidence: 0.90,
        status: 'normal'
      },
      glucose: {
        value: 94,
        unit: 'mg/dL',
        normalRange: '70-140 mg/dL (random); 70-99 mg/dL (fasting)',
        displayName: 'Glucose',
        confidence: 0.93,
        status: 'normal'
      },
      total_cholesterol: {
        value: 168,
        unit: 'mg/dL',
        normalRange: 'Less than 200 mg/dL',
        displayName: 'Total Cholesterol',
        confidence: 0.89,
        status: 'normal'
      },
      hdl: {
        value: 42,
        unit: 'mg/dL',
        normalRange: '40 mg/dL or higher (men); 50 or higher (women)',
        displayName: 'HDL Cholesterol',
        confidence: 0.91,
        status: 'normal'
      },
      ldl: {
        value: 108,
        unit: 'mg/dL',
        normalRange: 'Less than 100 mg/dL',
        displayName: 'LDL Cholesterol',
        confidence: 0.87,
        status: 'attention'
      },
      triglycerides: {
        value: 89,
        unit: 'mg/dL',
        normalRange: 'Less than 150 mg/dL',
        displayName: 'Triglycerides',
        confidence: 0.94,
        status: 'normal'
      },
      creatinine: {
        value: 0.9,
        unit: 'mg/dL',
        normalRange: '0.7-1.3 mg/dL (men); 0.6-1.1 mg/dL (women)',
        displayName: 'Creatinine',
        confidence: 0.86,
        status: 'normal'
      },
      hba1c: {
        value: 5.4,
        unit: '%',
        normalRange: 'Below 5.7%',
        displayName: 'HbA1C',
        confidence: 0.92,
        status: 'normal'
      },
      tsh: {
        value: 1.8,
        unit: 'µIU/mL',
        normalRange: '0.4-4.0 µIU/mL',
        displayName: 'TSH',
        confidence: 0.88,
        status: 'normal'
      },
      vitamin_d: {
        value: 32.5,
        unit: 'ng/mL',
        normalRange: '20-50 ng/mL',
        displayName: 'Vitamin D',
        confidence: 0.90,
        status: 'normal'
      },
      vitamin_b12: {
        value: 485,
        unit: 'pg/mL',
        normalRange: '200-900 pg/mL',
        displayName: 'Vitamin B12',
        confidence: 0.85,
        status: 'normal'
      },
      uric_acid: {
        value: 5.2,
        unit: 'mg/dL',
        normalRange: '3.5-7.2 mg/dL (men); 2.5-6.0 mg/dL (women)',
        displayName: 'Uric Acid',
        confidence: 0.89,
        status: 'normal'
      },
      sodium: {
        value: 138,
        unit: 'mmol/L',
        normalRange: '135-145 mmol/L',
        displayName: 'Sodium',
        confidence: 0.83,
        status: 'normal'
      },
      potassium: {
        value: 4.2,
        unit: 'mmol/L',
        normalRange: '3.5-5.0 mmol/L',
        displayName: 'Potassium',
        confidence: 0.91,
        status: 'normal'
      },
      calcium: {
        value: 9.8,
        unit: 'mg/dL',
        normalRange: '8.5-10.5 mg/dL',
        displayName: 'Calcium',
        confidence: 0.87,
        status: 'normal'
      }
    };

    const response = {
      success: true,
      reportId: fileId,
      userId,
      parameters: extractedParameters,
      reportDate: new Date().toISOString().split('T')[0],
      extractedAt: new Date().toISOString(),
      totalParameters: Object.keys(extractedParameters).length,
      averageConfidence: Object.values(extractedParameters)
        .reduce((sum, param) => sum + param.confidence, 0) / Object.keys(extractedParameters).length,
      fileInfo: {
        originalName: metadata?.originalName || 'Unknown',
        size: fileBuffer.length,
        uploadedAt: metadata?.uploadedAt || new Date().toISOString(),
        contentPreview: fileContent.substring(0, 300) + (fileContent.length > 300 ? '...' : '')
      },
      debug: {
        fileExists,
        metadataExists,
        storedFilePath,
        metadataPath
      }
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
