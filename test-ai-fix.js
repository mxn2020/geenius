// Test script to trigger AI error fixing on a failed deployment
const { NetlifyService } = require('./src/services/netlify.js');

async function testAIErrorFix() {
  const netlifyService = new NetlifyService();
  
  // Use the deployment that failed with TypeScript errors
  const mockDeployment = {
    id: '6880a5320dbee16bdad30663',
    site_id: '0bf9e2ac-09ba-405a-96e0-c021fa5b7881',
    state: 'error',
    error_message: 'Failed during stage \'building site\': Build script returned non-zero exit code: 2'
  };
  
  try {
    console.log('🧪 Testing AI error fixing...');
    
    // Import the error parsing function (you'd need to export it)
    // const { parseDeploymentError } = require('./api/initialize-project.js');
    // const errorInfo = await parseDeploymentError(mockDeployment);
    
    // For now, just test WebSocket log retrieval
    const logs = await netlifyService.getBuildLogs(
      mockDeployment.site_id, 
      mockDeployment.id
    );
    
    console.log('📋 Retrieved logs length:', logs.length);
    console.log('🔍 Logs contain TS6133:', logs.includes('TS6133'));
    console.log('🔍 Logs contain Clock error:', logs.includes('Clock'));
    
    if (logs.includes('TS6133')) {
      console.log('✅ AI error fixing should trigger!');
    } else {
      console.log('❌ No TypeScript errors found in logs');
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

testAIErrorFix();