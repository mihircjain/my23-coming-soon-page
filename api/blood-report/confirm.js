// pages/api/blood-report/confirm.js
export default async function handler(req, res) {
  console.log('🔍 Confirm API called, method:', req.method);
  
  if (req.method !== 'POST') {
    console.log('❌ Wrong method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('📋 Request body:', req.body);
    
    const { userId, reportId, parameters, reportDate } = req.body;
    
    console.log('🔍 Confirmation request:', { 
      userId, 
      reportId, 
      parameterCount: Object.keys(parameters || {}).length,
      reportDate 
    });
    
    if (!userId || !reportId || !parameters) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ 
        error: 'userId, reportId, and parameters are required',
        received: { userId, reportId, hasParameters: !!parameters, reportDate }
      });
    }

    // Simulate saving to database
    console.log('💾 Saving confirmed parameters...');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Extract just the values for the response
    const confirmedValues = {};
    Object.entries(parameters).forEach(([key, param]) => {
      confirmedValues[key] = param.value;
    });

    console.log('✅ Parameters confirmed and saved');
    console.log('📊 Saved', Object.keys(confirmedValues).length, 'parameter values');

    const response = {
      success: true,
      userId,
      reportId,
      parameters: confirmedValues,
      reportDate,
      confirmedAt: new Date().toISOString(),
      message: 'Blood parameters saved successfully'
    };
    
    console.log('📤 Sending confirmation response');
    return res.status(200).json(response);

  } catch (error) {
    console.error('❌ Confirmation error:', error);
    return res.status(500).json({ 
      error: 'Confirmation failed: ' + error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
