// Test script for MCP Running Coach
const fetch = require('node-fetch');

async function testMCPCoach() {
  try {
    console.log('🏃 Testing MCP Running Coach...');
    
    // Test 1: Health check
    console.log('\n1. Testing MCP server health...');
    const healthResponse = await fetch('http://localhost:10000/health');
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData);
    
    // Test 2: Tools list
    console.log('\n2. Testing available tools...');
    const toolsResponse = await fetch('http://localhost:10000/tools');
    const toolsData = await toolsResponse.json();
    console.log('✅ Available tools:', toolsData);
    
    // Test 3: Chat API
    console.log('\n3. Testing chat API...');
    const chatResponse = await fetch('http://localhost:8080/api/chat-mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'How was my last run?',
        userId: 'mihir_jain'
      })
    });
    
    if (chatResponse.ok) {
      const chatData = await chatResponse.json();
      console.log('✅ Chat API response:', chatData);
    } else {
      console.log('❌ Chat API error:', chatResponse.status, await chatResponse.text());
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testMCPCoach(); 
