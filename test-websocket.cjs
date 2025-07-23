const WebSocket = require('ws');

// Your deployment details
const accessToken = 'nfp_WMGzE6SnQEJVpgy4rqppTmVTvhcD2qQa8f3f';
const siteId = '0bf9e2ac-09ba-405a-96e0-c021fa5b7881';
const deployId = '6880a5320dbee16bdad30663';

console.log('🚀 Connecting to Netlify WebSocket...');
console.log('Site ID:', siteId);
console.log('Deploy ID:', deployId);
console.log('───────────────────────────────────────\n');

const ws = new WebSocket(`wss://socketeer.services.netlify.com/build/logs`);
let logCount = 0;
let tsErrors = [];

ws.on('open', () => {
  console.log('✅ WebSocket connected, requesting logs...\n');
  ws.send(JSON.stringify({
    access_token: accessToken,
    deploy_id: deployId,
    site_id: siteId
  }));
});

ws.on('message', (data) => {
  try {
    const logEntry = JSON.parse(data.toString());
    logCount++;
    
    // Print each log entry
    const timestamp = new Date(logEntry.ts).toLocaleTimeString();
    const section = logEntry.section ? `[${logEntry.section}]` : '';
    const message = logEntry.message || '';
    
    console.log(`${timestamp} ${section} ${message}`);
    
    // Check for TypeScript errors
    if (message.includes('TS6133') || message.includes('error TS')) {
      tsErrors.push({
        timestamp,
        message,
        section: logEntry.section
      });
      console.log('🎯 >>> TYPESCRIPT ERROR DETECTED <<<');
    }
    
  } catch (parseError) {
    console.warn('⚠️  Failed to parse log entry:', data.toString());
  }
});

ws.on('close', () => {
  console.log('\n───────────────────────────────────────');
  console.log('🔒 WebSocket connection closed');
  console.log(`📊 Total log entries received: ${logCount}`);
  
  if (tsErrors.length > 0) {
    console.log(`\n🎯 Found ${tsErrors.length} TypeScript errors:`);
    tsErrors.forEach((error, index) => {
      console.log(`\n${index + 1}. ${error.timestamp} [${error.section}]`);
      console.log(`   ${error.message}`);
    });
    console.log('\n✅ AI error fixing should trigger for these errors!');
  } else {
    console.log('\n❌ No TypeScript errors found in logs');
  }
});

ws.on('error', (error) => {
  console.error('💥 WebSocket error:', error);
});

// Auto-close after 20 seconds
setTimeout(() => {
  console.log('\n⏰ 20 second timeout reached, closing connection...');
  ws.close();
}, 20000);