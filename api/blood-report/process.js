// =============================================================================
// REAL OCR IMPLEMENTATION FOR VERCEL
// =============================================================================

// First, install the correct dependencies:
// npm install pdf-parse @google-cloud/vision multer

// =============================================================================
// 1. /pages/api/blood-report/upload.js - REAL FILE UPLOAD
// =============================================================================

import formidable from 'formidable';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Disable body parser for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = formidable({
      uploadDir: '/tmp', // Vercel's temporary directory
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
    });

    const [fields, files] = await form.parse(req);
    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    const userId = Array.isArray(fields.userId) ? fields.userId[0] : fields.userId;

    if (!file || !userId) {
      return res.status(400).json({ error: 'File and userId are required' });
    }

    // Validate file type
    if (!file.originalFilename?.endsWith('.pdf')) {
      return res.status(400).json({ error: 'Only PDF files are allowed' });
    }

    // Generate unique file ID
    const fileId = uuidv4();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${timestamp}_${fileId}.pdf`;

    // On Vercel, we store temporarily in /tmp and should upload to cloud storage
    // For now, we'll keep it in /tmp for processing
    const tempPath = `/tmp/${fileName}`;
    await fs.copyFile(file.filepath, tempPath);

    console.log(`📄 File uploaded for ${userId}: ${fileName} (${file.size} bytes)`);

    res.status(200).json({
      success: true,
      fileId,
      fileName,
      filePath: tempPath,
      fileSize: file.size,
      uploadedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'File upload failed: ' + error.message });
  }
}

// =============================================================================
// 2. /pages/api/blood-report/process.js - REAL OCR WITH PDF-PARSE
// =============================================================================

import pdf from 'pdf-parse';
import { promises as fs } from 'fs';

// Blood parameter mappings (same as before)
const PARAMETER_MAPPINGS = {
  rbc: {
    patterns: ['rbc', 'red blood cell', 'erythrocyte', 'red cell count'],
    displayName: 'RBC',
    unit: 'mill/mm³',
    normalRange: '4.5-5.9 million cells/mcL (men); 4.1-5.1 (women)'
  },
  hemoglobin: {
    patterns: ['hemoglobin', 'haemoglobin', 'hgb', 'hb'],
    displayName: 'Hemoglobin',
    unit: 'g/dL',
    normalRange: '13.5-17.5 g/dL (men); 12.0-15.5 (women)'
  },
  wbc: {
    patterns: ['wbc', 'white blood cell', 'leukocyte', 'white cell count'],
    displayName: 'WBC',
    unit: 'cells/mm³',
    normalRange: '4,500-11,000 cells/mcL'
  },
  platelets: {
    patterns: ['platelet', 'plt', 'thrombocyte'],
    displayName: 'Platelet Count',
    unit: '10³/µL',
    normalRange: '150,000-450,000 platelets/mcL'
  },
  hdl: {
    patterns: ['hdl', 'hdl cholesterol', 'high density lipoprotein'],
    displayName: 'HDL Cholesterol',
    unit: 'mg/dL',
    normalRange: '40 mg/dL or higher (men); 50 or higher (women)'
  },
  ldl: {
    patterns: ['ldl', 'ldl cholesterol', 'low density lipoprotein'],
    displayName: 'LDL Cholesterol',
    unit: 'mg/dL',
    normalRange: 'Less than 100 mg/dL'
  },
  total_cholesterol: {
    patterns: ['total cholesterol', 'cholesterol total', 'cholesterol'],
    displayName: 'Total Cholesterol',
    unit: 'mg/dL',
    normalRange: 'Less than 200 mg/dL'
  },
  glucose: {
    patterns: ['glucose', 'blood sugar', 'blood glucose', 'fasting glucose'],
    displayName: 'Glucose (Random)',
    unit: 'mg/dL',
    normalRange: '70-140 mg/dL (random); 70-99 mg/dL (fasting)'
  },
  hba1c: {
    patterns: ['hba1c', 'a1c', 'glycated hemoglobin', 'glycosylated hemoglobin'],
    displayName: 'HbA1C',
    unit: '%',
    normalRange: 'Below 5.7%'
  },
  creatinine: {
    patterns: ['creatinine', 'creat', 'cr'],
    displayName: 'Creatinine',
    unit: 'mg/dL',
    normalRange: '0.7-1.3 mg/dL (men); 0.6-1.1 mg/dL (women)'
  },
  calcium: {
    patterns: ['calcium', 'ca', 'serum calcium'],
    displayName: 'Calcium',
    unit: 'mg/dL',
    normalRange: '8.5-10.5 mg/dL'
  },
  sodium: {
    patterns: ['sodium', 'na', 'serum sodium'],
    displayName: 'Sodium',
    unit: 'mmol/L',
    normalRange: '135-145 mmol/L'
  },
  potassium: {
    patterns: ['potassium', 'k', 'serum potassium'],
    displayName: 'Potassium',
    unit: 'mmol/L',
    normalRange: '3.5-5.0 mmol/L'
  }
};

// Extract text from PDF using pdf-parse (works on Vercel)
async function extractTextFromPDF(filePath) {
  try {
    console.log('🔍 Extracting text from PDF...');
    
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdf(dataBuffer);
    
    console.log('✅ PDF text extraction completed, length:', data.text.length);
    return data.text;

  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

// Extract blood parameters from text
function extractBloodParameters(text) {
  const extractedParams = {};
  const lines = text.toLowerCase().split('\n');
  
  console.log('🔍 Analyzing text for blood parameters...');
  
  for (const [paramKey, paramConfig] of Object.entries(PARAMETER_MAPPINGS)) {
    for (const line of lines) {
      for (const pattern of paramConfig.patterns) {
        if (line.includes(pattern.toLowerCase())) {
          const value = extractValueFromLine(line, lines, pattern);
          if (value) {
            extractedParams[paramKey] = {
              displayName: paramConfig.displayName,
              value: value.number,
              unit: value.unit || paramConfig.unit,
              confidence: value.confidence,
              normalRange: paramConfig.normalRange,
              status: determineStatus(value.number, paramKey),
              rawText: line.trim()
            };
            console.log(`✅ Found ${paramConfig.displayName}: ${value.number} ${value.unit}`);
            break;
          }
        }
      }
      if (extractedParams[paramKey]) break;
    }
  }
  
  console.log(`📊 Extracted ${Object.keys(extractedParams).length} parameters`);
  return extractedParams;
}

// Extract numeric value from text line
function extractValueFromLine(line, allLines, pattern) {
  const valuePatterns = [
    /(\d+\.?\d*)\s*(mg\/dl|g\/dl|mmol\/l|pg\/ml|ng\/ml|µiu\/ml|mill\/mm³|cells\/mm³|10³\/µl|%)/i,
    /(\d+,?\d*\.?\d*)\s*(mg\/dl|g\/dl|mmol\/l|pg\/ml|ng\/ml|µiu\/ml|mill\/mm³|cells\/mm³|10³\/µl|%)/i,
    /(\d+\.?\d*)/
  ];

  let bestMatch = null;
  let bestConfidence = 0;

  for (const regex of valuePatterns) {
    const match = line.match(regex);
    if (match) {
      const number = parseFloat(match[1].replace(',', ''));
      const unit = match[2] || '';
      
      let confidence = 0.5;
      if (unit) confidence += 0.3;
      if (number > 0 && number < 10000) confidence += 0.2;
      
      const patternIndex = line.toLowerCase().indexOf(pattern.toLowerCase());
      if (patternIndex >= 0 && patternIndex < 10) confidence += 0.2;

      if (confidence > bestConfidence) {
        bestMatch = { number, unit, confidence: Math.min(confidence, 1.0) };
        bestConfidence = confidence;
      }
    }
  }

  return bestMatch;
}

// Determine status
function determineStatus(value, paramKey) {
  const ranges = {
    rbc: { low: 4.1, high: 5.9 },
    hemoglobin: { low: 12.0, high: 17.5 },
    wbc: { low: 4500, high: 11000 },
    platelets: { low: 150, high: 450 },
    hdl: { low: 40, high: 100 },
    ldl: { low: 0, high: 100 },
    total_cholesterol: { low: 0, high: 200 },
    hba1c: { low: 0, high: 5.7 },
    glucose: { low: 70, high: 140 },
    creatinine: { low: 0.6, high: 1.3 },
    calcium: { low: 8.5, high: 10.5 },
    sodium: { low: 135, high: 145 },
    potassium: { low: 3.5, high: 5.0 }
  };

  const range = ranges[paramKey];
  if (!range) return 'unknown';

  if (value < range.low) return 'low';
  if (value > range.high) return 'high';
  return 'normal';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileId, userId } = req.body;

    if (!fileId || !userId) {
      return res.status(400).json({ error: 'FileId and userId are required' });
    }

    // Find the uploaded file in /tmp directory
    const filePath = `/tmp/*${fileId}*.pdf`;
    const { glob } = await import('glob');
    const files = await glob(filePath);
    
    if (files.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const targetFile = files[0];
    console.log(`🔄 Processing file for ${userId}: ${targetFile}`);

    // Extract text from PDF
    const extractedText = await extractTextFromPDF(targetFile);

    // Extract blood parameters
    const parameters = extractBloodParameters(extractedText);

    const result = {
      reportId: fileId,
      userId,
      fileName: targetFile.split('/').pop(),
      processedAt: new Date().toISOString(),
      reportDate: new Date().toISOString(),
      parameters,
      ocrText: extractedText.substring(0, 1000),
      summary: {
        totalParameters: Object.keys(parameters).length,
        highConfidence: Object.values(parameters).filter(p => p.confidence > 0.8).length,
        mediumConfidence: Object.values(parameters).filter(p => p.confidence >= 0.5 && p.confidence <= 0.8).length,
        lowConfidence: Object.values(parameters).filter(p => p.confidence < 0.5).length
      }
    };

    console.log('✅ Processing completed for', userId, ':', result.summary);

    // Clean up temporary file
    try {
      await fs.unlink(targetFile);
    } catch (error) {
      console.warn('Could not delete temporary file:', error);
    }

    res.status(200).json(result);

  } catch (error) {
    console.error('Processing error:', error);
    res.status(500).json({ error: 'File processing failed: ' + error.message });
  }
}
