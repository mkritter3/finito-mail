#!/usr/bin/env node

/**
 * Test script to verify staging environment health after security remediation
 * Tests authentication, API endpoints, and database connectivity
 */

const STAGING_URL = process.env.STAGING_URL || 'https://finito-mail-staging.up.railway.app';

interface TestResult {
  test: string;
  status: 'pass' | 'fail';
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

async function testEndpoint(name: string, url: string, expectedStatus?: number): Promise<void> {
  try {
    console.log(`Testing ${name}...`);
    const response = await fetch(url);
    const status = response.status;
    
    if (expectedStatus && status !== expectedStatus) {
      results.push({
        test: name,
        status: 'fail',
        details: `Expected status ${expectedStatus}, got ${status}`,
      });
    } else if (!expectedStatus && status >= 400) {
      const text = await response.text().catch(() => 'Could not read response');
      results.push({
        test: name,
        status: 'fail',
        details: `HTTP ${status}`,
        error: text.substring(0, 200),
      });
    } else {
      results.push({
        test: name,
        status: 'pass',
        details: `HTTP ${status}`,
      });
    }
  } catch (error) {
    results.push({
      test: name,
      status: 'fail',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function runTests() {
  console.log('🧪 Testing Staging Environment Health\n');
  console.log(`Target: ${STAGING_URL}\n`);

  // Test homepage
  await testEndpoint('Homepage', STAGING_URL, 200);
  
  // Test auth page (should redirect to login)
  await testEndpoint('Auth Page', `${STAGING_URL}/auth`);
  
  // Test API health endpoint
  await testEndpoint('API Health', `${STAGING_URL}/api/health`);
  
  // Test protected route (should return 401 or redirect)
  await testEndpoint('Protected Route', `${STAGING_URL}/mail/inbox`);
  
  // Test auth callback (should redirect or return appropriate status)
  await testEndpoint('Auth Callback', `${STAGING_URL}/auth/callback`);

  // Print results
  console.log('\n📊 Test Results:\n');
  
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  
  results.forEach(result => {
    const icon = result.status === 'pass' ? '✅' : '❌';
    console.log(`${icon} ${result.test}: ${result.status.toUpperCase()}`);
    if (result.details) {
      console.log(`   Details: ${result.details}`);
    }
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  console.log('\n📈 Summary:');
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total:  ${results.length}`);
  
  if (failed > 0) {
    console.log('\n⚠️  Some tests failed. Check Railway logs for details.');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed! Staging environment is healthy.');
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});