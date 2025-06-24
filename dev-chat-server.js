// Development server for intelligent chat API
// Run this with: node dev-chat-server.js

const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3001;

// Import the intelligent chat handler
const chatHandler = require('./api/chat-mcp-intelligent.js');

app.use(cors());
app.use(express.json());

// Convert Vercel serverless function to Express route
app.post('/api/chat-intelligent', async (req, res) => {
  try {
    // Create mock Vercel req/res objects
    const mockReq = {
      method: 'POST',
      body: req.body
    };
    
    const mockRes = {
      status: (code) => ({
        json: (data) => res.status(code).json(data),
        end: () => res.status(code).end()
      }),
      setHeader: (name, value) => res.setHeader(name, value)
    };
    
    // Call the handler
    await chatHandler.default(mockReq, mockRes);
  } catch (error) {
    console.error('Chat server error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`🤖 Intelligent Chat API server running on http://localhost:${PORT}`);
  console.log(`📡 Ready to handle chat requests at /api/chat-intelligent`);
});

module.exports = app; 
