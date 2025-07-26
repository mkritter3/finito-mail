#!/usr/bin/env node

/**
 * Gmail Webhook Testing Script
 * 
 * This script helps test the Gmail webhook endpoint with various scenarios
 * including happy path and edge cases.
 */

const https = require('https');
const crypto = require('crypto');

// Configuration
const config = {
  ngrokUrl: process.env.NGROK_URL || 'https://YOUR-NGROK-URL.ngrok-free.app',
  webhookPath: '/api/webhooks/gmail',
  verificationToken: process.env.PUBSUB_VERIFICATION_TOKEN || '5YQa2UY7F0ZJcruX6Vsfc5EQjSOn7CZv',
  rateLimitBypassToken: process.env.RATELIMIT_BYPASS_TOKEN || 'N22nGHOAgrV8vUSmwESEWs73ZyhnVOqT'
};

// Test scenarios
const scenarios = {
  // A1: New Email Arrival
  newEmail: {
    emailAddress: 'test@example.com',
    historyId: Date.now()
  },
  
  // A2: Email Read Status
  emailRead: {
    emailAddress: 'test@example.com',
    historyId: Date.now() + 1
  },
  
  // A3: Email Starred
  emailStarred: {
    emailAddress: 'test@example.com',
    historyId: Date.now() + 2
  },
  
  // A4: Email Deleted
  emailDeleted: {
    emailAddress: 'test@example.com',
    historyId: Date.now() + 3
  },
  
  // B3: Auth Failure (no token)
  authFailure: {
    emailAddress: 'test@example.com',
    historyId: Date.now() + 4,
    skipAuth: true
  },
  
  // B4: Malformed Payload
  malformed: {
    invalid: 'data',
    missing: 'required fields'
  }
};

// Create Pub/Sub message
function createPubSubMessage(data, messageId = crypto.randomUUID()) {
  const encodedData = Buffer.from(JSON.stringify(data)).toString('base64');
  
  return {
    message: {
      data: encodedData,
      messageId: messageId,
      publishTime: new Date().toISOString(),
      attributes: {}
    },
    subscription: 'projects/email-death-blow/subscriptions/gmail-push-subscription'
  };
}

// Send webhook request
function sendWebhook(scenario, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(config.ngrokUrl);
    const data = JSON.stringify(createPubSubMessage(scenario, options.messageId));
    
    const requestOptions = {
      hostname: url.hostname,
      port: url.port || 443,
      path: config.webhookPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };
    
    // Add authentication unless explicitly skipped
    if (!scenario.skipAuth) {
      // Use legacy token authentication for testing
      requestOptions.headers['x-goog-pubsub-token'] = config.verificationToken;
    }
    
    // Add rate limit bypass for testing
    if (options.bypassRateLimit) {
      requestOptions.headers['x-ratelimit-bypass'] = config.rateLimitBypassToken;
    }
    
    console.log(`\n📤 Sending ${options.name || 'webhook'} request...`);
    console.log(`URL: ${url.origin}${config.webhookPath}`);
    
    const startTime = Date.now();
    
    const req = https.request(requestOptions, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`📥 Response received in ${duration}ms`);
        console.log(`Status: ${res.statusCode}`);
        console.log(`Headers:`, res.headers);
        console.log(`Body:`, responseData);
        
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: responseData,
          duration
        });
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Request error:', error);
      reject(error);
    });
    
    req.write(data);
    req.end();
  });
}

// Test runner
async function runTests() {
  console.log('🧪 Gmail Webhook Testing Script');
  console.log('================================');
  console.log(`ngrok URL: ${config.ngrokUrl}`);
  console.log(`Webhook Path: ${config.webhookPath}`);
  console.log('');
  
  // Check if ngrok URL is configured
  if (config.ngrokUrl.includes('YOUR-NGROK-URL')) {
    console.error('❌ Please set NGROK_URL environment variable or update the script');
    console.error('Example: export NGROK_URL=https://abc123.ngrok-free.app');
    process.exit(1);
  }
  
  // Get test scenario from command line
  const testName = process.argv[2];
  
  if (!testName) {
    console.log('Available test scenarios:');
    console.log('  - newEmail      (A1: New email arrival)');
    console.log('  - emailRead     (A2: Email read status)');
    console.log('  - emailStarred  (A3: Email starred)');
    console.log('  - emailDeleted  (A4: Email deleted)');
    console.log('  - duplicate     (B1: Idempotency check)');
    console.log('  - rapidFire     (B2: Rapid-fire events)');
    console.log('  - authFailure   (B3: Auth failure)');
    console.log('  - malformed     (B4: Malformed payload)');
    console.log('  - all           (Run all tests)');
    console.log('');
    console.log('Usage: node test-webhook.js <scenario>');
    process.exit(0);
  }
  
  try {
    switch (testName) {
      case 'newEmail':
        await sendWebhook(scenarios.newEmail, { name: 'New Email', bypassRateLimit: true });
        break;
        
      case 'emailRead':
        await sendWebhook(scenarios.emailRead, { name: 'Email Read', bypassRateLimit: true });
        break;
        
      case 'emailStarred':
        await sendWebhook(scenarios.emailStarred, { name: 'Email Starred', bypassRateLimit: true });
        break;
        
      case 'emailDeleted':
        await sendWebhook(scenarios.emailDeleted, { name: 'Email Deleted', bypassRateLimit: true });
        break;
        
      case 'duplicate':
        console.log('🔄 Testing idempotency (B1)...');
        const messageId = crypto.randomUUID();
        const result1 = await sendWebhook(scenarios.newEmail, { 
          name: 'Duplicate Test (1st)', 
          messageId,
          bypassRateLimit: true 
        });
        const result2 = await sendWebhook(scenarios.newEmail, { 
          name: 'Duplicate Test (2nd)', 
          messageId,
          bypassRateLimit: true 
        });
        console.log('\n✅ Both requests should return 200, second should be marked as duplicate in logs');
        break;
        
      case 'rapidFire':
        console.log('🚀 Testing rapid-fire events (B2)...');
        const promises = [];
        for (let i = 0; i < 10; i++) {
          promises.push(sendWebhook(
            { ...scenarios.newEmail, historyId: Date.now() + i },
            { name: `Rapid Fire ${i+1}`, bypassRateLimit: true }
          ));
        }
        const results = await Promise.all(promises);
        console.log(`\n✅ Sent ${results.length} requests simultaneously`);
        console.log(`Success: ${results.filter(r => r.status === 200).length}`);
        console.log(`Failed: ${results.filter(r => r.status !== 200).length}`);
        break;
        
      case 'authFailure':
        await sendWebhook(scenarios.authFailure, { name: 'Auth Failure', bypassRateLimit: true });
        console.log('\n✅ Should return 401 Unauthorized');
        break;
        
      case 'malformed':
        await sendWebhook(scenarios.malformed, { name: 'Malformed Payload', bypassRateLimit: true });
        console.log('\n✅ Should return 400 Bad Request');
        break;
        
      case 'all':
        console.log('🏃 Running all tests...\n');
        
        // Run happy path tests
        console.log('📋 Happy Path Tests (A1-A4)');
        console.log('============================');
        await sendWebhook(scenarios.newEmail, { name: 'A1: New Email', bypassRateLimit: true });
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await sendWebhook(scenarios.emailRead, { name: 'A2: Email Read', bypassRateLimit: true });
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await sendWebhook(scenarios.emailStarred, { name: 'A3: Email Starred', bypassRateLimit: true });
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await sendWebhook(scenarios.emailDeleted, { name: 'A4: Email Deleted', bypassRateLimit: true });
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Run edge case tests
        console.log('\n📋 Edge Case Tests (B1-B4)');
        console.log('=========================');
        
        // B1: Idempotency
        const dupId = crypto.randomUUID();
        await sendWebhook(scenarios.newEmail, { name: 'B1: Duplicate (1st)', messageId: dupId, bypassRateLimit: true });
        await sendWebhook(scenarios.newEmail, { name: 'B1: Duplicate (2nd)', messageId: dupId, bypassRateLimit: true });
        
        // B3: Auth failure
        await sendWebhook(scenarios.authFailure, { name: 'B3: Auth Failure', bypassRateLimit: true });
        
        // B4: Malformed
        await sendWebhook(scenarios.malformed, { name: 'B4: Malformed', bypassRateLimit: true });
        
        console.log('\n✅ All tests completed!');
        break;
        
      default:
        console.error(`❌ Unknown test scenario: ${testName}`);
        process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Health check
async function checkHealth() {
  try {
    const url = new URL(config.ngrokUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: config.webhookPath,
      method: 'GET'
    };
    
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log('✅ Webhook endpoint is healthy');
            resolve(true);
          } else {
            console.error(`❌ Health check failed: ${res.statusCode}`);
            resolve(false);
          }
        });
      });
      
      req.on('error', reject);
      req.end();
    });
  } catch (error) {
    console.error('❌ Health check error:', error);
    return false;
  }
}

// Main
(async () => {
  // Check health first
  console.log('🏥 Checking webhook health...');
  const healthy = await checkHealth();
  
  if (!healthy) {
    console.error('❌ Webhook endpoint is not healthy. Please check your setup.');
    process.exit(1);
  }
  
  console.log('');
  
  // Run tests
  await runTests();
})();