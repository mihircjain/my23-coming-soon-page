import { readFile, unlink } from 'fs/promises';
import { glob } from 'glob';

const PARAMETER_MAPPINGS = {
  rbc: {
    patterns: ['rbc', 'red blood cell', 'erythrocyte'],
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
    patterns: ['wbc', 'white blood cell', 'leukocyte'],
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
    patterns: ['hdl', 'hdl cholesterol'],
    displayName: 'HDL Cholesterol',
    unit: 'mg/dL',
    normalRange: '40 mg/dL or higher (men); 50 or higher (women)'
  },
  ldl: {
    patterns: ['ldl', 'ldl cholesterol'],
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
    patterns: ['glucose', 'blood sugar', 'blood glucose'],
    displayName: 'Glucose (Random)',
    unit: 'mg/dL',
    normalRange: '70-140 mg/dL (random); 70-99 mg/dL (fasting)'
  },
  hba1c: {
    patterns: ['hba1c', 'a1c', 'glycated hemoglobin'],
    displayName: 'HbA1C',
    unit: '%',
    normalRange: 'Below 5.7%'
  },
  creatinine: {
    patterns: ['creatinine', 'creat', 'cr'],
    displayName: 'Creatinine',
    unit: 'mg/dL',
    normalRange: '0.7-1.3 mg/dL (men); 0.6-1.1 mg/dL (women)'
  }
};

function extractTextFromFile(filePath) {
  return readFile(filePath, 'utf8');
}

function extractBloodParameters(text) {
  const extractedParams = {};
  const lines = text.toLowerCase().split('\n');
  
  console.log('🔍 Analyzing text for blood parameters...');
  
  for (const [paramKey, paramConfig] of Object.entries(PARAMETER_MAPPINGS)) {
    for (const line of lines) {
      for (const pattern of paramConfig.patterns) {
        if (line.includes(pattern.toLowerCase())) {
          const value = extractValueFromLine(line, pattern);
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
            console.log(`✅ Found ${paramConfig.displayName}: ${value.number}`);
            break;
          }
        }
      }
      if (extractedParams[paramKey]) break;
    }
  }
  
  return extractedParams;
}

function extractValueFromLine(line, pattern) {
  const valuePatterns = [
    /(\d+\.?\d*)\s*(mg\/dl|g\/dl|mmol\/l|pg\/ml|ng\/ml|µiu\/ml|mill\/mm³|cells\/mm³|10³\/µl|%)/i,
    /(\d+\.?\d*)/
  ];

  for (const regex of valuePatterns) {
    const match = line.match(regex);
    if (match) {
      const number = parseFloat(match[1]);
      const unit = match[2] || '';
      
      if (number > 0) {
        return { 
          number, 
          unit, 
          confidence: unit ? 0.8 : 0.6 
        };
      }
    }
  }
  return null;
}

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
    creatinine: { low: 0.6, high: 1.3 }
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

    const pattern = `/tmp/*${fileId}*`;
    const files = await glob(pattern);
    
    if (files.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const targetFile = files[0];
    console.log(`🔄 Processing file: ${targetFile}`);

    const extractedText = await extractTextFromFile(targetFile);
    const parameters = extractBloodParameters(extractedText);

    const result = {
      reportId: fileId,
      userId,
      fileName: targetFile.split('/').pop(),
      processedAt: new Date().toISOString(),
      reportDate: new Date().toISOString(),
      parameters,
      extractedText: extractedText.substring(0, 500),
      summary: {
        totalParameters: Object.keys(parameters).length,
        highConfidence: Object.values(parameters).filter(p => p.confidence > 0.8).length,
        mediumConfidence: Object.values(parameters).filter(p => p.confidence >= 0.5 && p.confidence <= 0.8).length,
        lowConfidence: Object.values(parameters).filter(p => p.confidence < 0.5).length
      }
    };

    console.log('✅ Processing completed:', result.summary);

    try {
      await unlink(targetFile);
    } catch (error) {
      console.warn('Could not delete temp file:', error);
    }

    res.status(200).json(result);

  } catch (error) {
    console.error('Processing error:', error);
    res.status(500).json({ error: 'Processing failed: ' + error.message });
  }
}
