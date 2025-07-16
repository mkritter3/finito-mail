# Finito Mail E2E Testing

This document describes the end-to-end testing setup for Finito Mail using Playwright.

## Overview

The E2E tests validate the complete user journey from authentication to email sync and display. Tests are designed to be fast, reliable, and deterministic by mocking external dependencies.

## Test Structure

```
tests/
├── e2e/
│   ├── auth-flow.spec.ts      # Authentication and OAuth flow tests
│   ├── email-list.spec.ts     # Email list functionality tests
│   └── helpers/
│       └── test-setup.ts      # Test utilities and mock data
└── README.md
```

## Test Scenarios

### Authentication Flow (`auth-flow.spec.ts`)

1. **Happy Path OAuth Flow**
   - User visits login page
   - Clicks "Continue with Google" button
   - OAuth flow is mocked with proper state parameter
   - User is redirected to callback page
   - JWT token is stored in localStorage
   - Initial email sync is triggered
   - User is redirected to main email app
   - Email list is displayed

2. **CSRF Protection**
   - Tests that invalid state parameters are rejected
   - Verifies proper error handling for CSRF attacks

3. **Error Handling**
   - Tests graceful handling of OAuth service failures
   - Verifies error messages are displayed to users

### Email List (`email-list.spec.ts`)

1. **Email Display**
   - Shows list of emails for authenticated users
   - Displays email metadata (subject, sender, snippet)
   - Distinguishes between read and unread emails

2. **Loading States**
   - Shows loading spinner during API calls
   - Handles empty email lists

3. **Error Handling**
   - Gracefully handles API errors
   - Shows appropriate error messages
   - Handles authentication failures

## Mock Data

The tests use comprehensive mock data to simulate real-world scenarios:

- **Authentication**: Mock JWT tokens, OAuth state parameters
- **User Data**: Test user profile information
- **Email Data**: Sample emails with various states (read/unread)

## Running Tests

### Local Development

```bash
# Run all E2E tests
npm run test:e2e

# Run tests with UI
npm run test:e2e:ui

# Run tests in headed mode (visible browser)
npm run test:e2e:headed

# Use automated setup script
./scripts/test-e2e.sh
./scripts/test-e2e.sh --ui
./scripts/test-e2e.sh --headed
```

### Docker Environment

```bash
# Start services with Docker
docker-compose up -d

# Run tests
npm run test:e2e
```

### CI/CD

Tests run automatically on:
- Push to main/master branches
- Pull requests
- GitHub Actions workflow includes PostgreSQL service

## Test Configuration

### Playwright Configuration (`playwright.config.ts`)

- **Base URL**: http://localhost:3000
- **Browsers**: Chrome, Firefox, Safari
- **Reporters**: HTML reports
- **Artifacts**: Screenshots and videos on failure
- **Web Server**: Automatically starts dev servers

### Environment Setup

Tests require:
- PostgreSQL database
- API server on port 3001
- Web app on port 3000
- Environment variables configured

## Mock Strategy

### Why Mock External Services?

1. **Reliability**: No dependency on external OAuth providers
2. **Speed**: No network requests to third-party services
3. **Determinism**: Consistent test results
4. **Security**: No real OAuth credentials needed
5. **Isolation**: Tests focus on application logic

### Mock Implementation

- **Google OAuth**: Complete flow simulation with state validation
- **Gmail API**: Mock email data and sync responses
- **JWT Authentication**: Mock token validation
- **Database**: Real PostgreSQL for integration testing

## Test Data

### Mock User
```javascript
{
  id: 'user123',
  email: 'test@example.com',
  name: 'Test User'
}
```

### Mock Emails
- Welcome email (unread)
- Account ready notification (read)
- Various senders and timestamps
- Proper email metadata structure

## Best Practices

1. **Test Isolation**: Each test is independent
2. **Mock External APIs**: No real API calls to Google
3. **Data-Driven Tests**: Use consistent mock data
4. **Error Scenarios**: Test both success and failure paths
5. **User-Centric**: Test from user's perspective
6. **Performance**: Fast execution with minimal setup

## Debugging

### Test Failures

1. **Screenshots**: Available in `test-results/`
2. **Videos**: Recorded for failed tests
3. **Trace Files**: For detailed debugging
4. **Console Logs**: Check browser and server logs

### Common Issues

1. **Service Not Running**: Use `./scripts/test-e2e.sh`
2. **Database Issues**: Check PostgreSQL connection
3. **Port Conflicts**: Ensure ports 3000/3001 are available
4. **Mock Issues**: Verify mock data matches API responses

## Extending Tests

### Adding New Test Cases

1. Create test file in `tests/e2e/`
2. Use helpers from `test-setup.ts`
3. Follow existing patterns for mocking
4. Add appropriate assertions

### Mock Updates

When API changes, update:
1. Mock data in `test-setup.ts`
2. Route handlers for new endpoints
3. Test assertions for new UI elements

## Future Improvements

1. **Visual Regression Testing**: Screenshot comparisons
2. **Performance Testing**: Load time measurements
3. **Accessibility Testing**: A11y compliance
4. **Mobile Testing**: Responsive design validation
5. **Integration Testing**: Real API testing environment