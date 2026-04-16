# DOB Live Testing Guide

## 🧪 End-to-End Testing with Playwright

The DOB Live platform includes comprehensive E2E tests using Playwright to ensure both officer and manager interfaces work correctly across different browsers and devices.

### 🚀 Quick Start

```bash
# Install dependencies (if not already done)
npm install

# Install Playwright browsers
npx playwright install

# Run all tests
npm test

# Run tests with browser UI visible
npm run test:headed

# Interactive test runner
npm run test:ui

# Debug tests step by step
npm run test:debug

# View test report
npm run test:report
```

### 📁 Test Structure

```
e2e/
├── auth.spec.js          # Authentication flow tests
├── officer.spec.js       # Officer app functionality
├── manager.spec.js       # Manager app functionality
└── api.spec.js          # API integration tests (future)
```

### 🎯 Test Coverage

#### **Authentication Tests**
- Sign in/up form display and validation
- Form switching between sign in and sign up
- Error handling for invalid credentials
- Loading states during authentication

#### **Officer App Tests**
- Site picker functionality
- Dashboard quick actions and stats
- Log entry form with all 16 log types
- Type-specific field validation
- GPS location capture
- Log history with filtering
- Task management and status updates
- Mobile navigation and responsive design

#### **Manager App Tests**  
- Desktop sidebar navigation
- Dashboard stats and alerts
- Site management interface
- Advanced log review and filtering
- Task assignment to officers
- Export functionality
- Responsive design on different screen sizes

### 🔧 Configuration

#### **Test Environments**
- **Local Development**: `http://localhost:3000`
- **Staging**: Set `PLAYWRIGHT_BASE_URL=https://app.doblive.co.uk`
- **Production**: Configure separate test environment

#### **Browser Coverage**
- Desktop: Chrome, Firefox, Safari
- Mobile: Chrome on Android, Safari on iOS
- Responsive testing across viewport sizes

### 📊 Continuous Integration

Add to your CI/CD pipeline:

```yaml
# GitHub Actions example
- name: Install dependencies
  run: npm ci

- name: Install Playwright browsers
  run: npx playwright install --with-deps

- name: Run Playwright tests
  run: npm test

- name: Upload test results
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: playwright-report
    path: playwright-report/
```

### 🔐 Authentication Testing

Current tests handle authentication by:
1. **UI Testing**: Forms, validation, error states
2. **Flow Testing**: Sign in/up switching, redirects
3. **State Testing**: Loading and error conditions

**For Full Authentication Testing:**
- Set up test user accounts in Clerk
- Use Playwright's authentication state persistence
- Mock API responses for consistent testing

### 📱 Mobile Testing

Tests include mobile-specific scenarios:
- Touch interactions and gestures
- Bottom navigation usability
- Form input behavior on mobile
- Viewport adaptations
- Safe area handling

### 🛠️ Debugging Tests

```bash
# Run specific test file
npx playwright test auth.spec.js

# Run tests matching pattern
npx playwright test --grep "officer dashboard"

# Run in headed mode with slow motion
npx playwright test --headed --slow-mo=1000

# Generate test code interactively
npx playwright codegen http://localhost:3000
```

### 📈 Test Reports

Playwright generates detailed HTML reports including:
- Test results with screenshots
- Video recordings of failures
- Network requests and responses
- Console logs and errors
- Performance metrics

### 🔍 Best Practices

1. **Wait for Elements**: Use `await expect().toBeVisible()` instead of fixed timeouts
2. **Unique Selectors**: Prefer `getByRole()` and `getByText()` over CSS selectors
3. **Test Independence**: Each test should be able to run independently
4. **Real User Flows**: Test complete user journeys, not just individual components
5. **Error Scenarios**: Test error states and edge cases
6. **Performance**: Monitor load times and responsiveness

### 🚨 Known Limitations

- **Authentication**: Tests currently mock authenticated states
- **Real Data**: Tests use mock data - consider test database setup
- **Network Calls**: API calls go to real endpoints - consider mocking
- **Geolocation**: Location services require permission setup

### 🔄 Updating Tests

When adding new features:
1. Add corresponding test cases
2. Update selectors if UI changes
3. Test both happy path and error scenarios
4. Ensure tests work across all supported browsers
5. Update this documentation

### 📞 Troubleshooting

**Common Issues:**
- Browser installation fails → Check network connectivity
- Tests timeout → Increase timeout in config or fix slow operations
- Flaky tests → Add proper waits and stable selectors
- Authentication issues → Verify test user setup in Clerk

For more details, see the [Playwright documentation](https://playwright.dev/docs/intro).
