# End-to-End Testing with Playwright

This directory contains comprehensive end-to-end tests for the Dot Art 3D Converter application using Playwright.

## Test Structure

### Test Files

- **`upload-workflow.spec.ts`** - Tests file upload and CSV processing workflows
- **`image-conversion-workflow.spec.ts`** - Tests image to dot art conversion workflows  
- **`dot-editing-workflow.spec.ts`** - Tests interactive dot pattern editing features
- **`3d-model-workflow.spec.ts`** - Tests 3D model generation and viewing
- **`complete-user-journey.spec.ts`** - Tests complete end-to-end user workflows
- **`visual-regression.spec.ts`** - Visual regression testing for UI consistency

### Support Files

- **`fixtures.ts`** - Test fixtures, page objects, and helper utilities
- **`playwright.config.ts`** - Playwright configuration (in project root)

## Running Tests

### Basic Commands

```bash
# Run all E2E tests
npm run test:e2e

# Run tests with UI mode for debugging
npm run test:e2e:ui

# Run tests in headed mode (visible browser)
npm run test:e2e:headed

# Debug specific test
npm run test:e2e:debug

# View test reports
npm run test:e2e:report

# Run both unit and E2E tests
npm run test:all
```

### Running Specific Tests

```bash
# Run only upload workflow tests
npx playwright test upload-workflow

# Run only visual regression tests
npx playwright test visual-regression

# Run tests for specific browser
npx playwright test --project=chromium
```

## Test Coverage

### Workflows Tested

1. **File Upload & Processing**
   - CSV file upload and validation
   - Dot pattern parsing and display
   - Error handling for invalid files
   - Performance with large patterns

2. **Image Conversion**
   - Image to dot art conversion
   - Real-time threshold adjustments
   - Resolution controls
   - Format validation

3. **Interactive Editing**
   - Individual dot toggling
   - Range selection and editing
   - Undo/redo functionality
   - Keyboard shortcuts

4. **3D Model Generation**
   - Dot pattern to 3D mesh conversion
   - Interactive 3D viewer controls
   - OBJ file export and download
   - Mesh optimization

5. **Complete User Journeys**
   - CSV upload → edit → 3D conversion → download
   - Image upload → conversion → edit → 3D
   - Error recovery workflows
   - Performance under load

6. **Visual Regression**
   - UI component consistency
   - Cross-browser rendering
   - Responsive design
   - Animation and transitions

### Browser Coverage

Tests run on multiple browsers:
- Chromium (Chrome/Edge)
- Firefox
- WebKit (Safari)
- Mobile Chrome
- Mobile Safari

## Test Data

### Fixtures Available

- `testFiles.simpleDots` - Simple 3x3 pattern
- `testFiles.complexDots` - Complex 5x5 pattern  
- `testFiles.singleDot` - Single dot pattern
- `testFiles.emptyPattern` - Empty pattern
- `testFiles.largeDots` - Large 10x10 checkerboard

### Test Utilities

- `uploadTestFile()` - Create and upload test CSV files
- `compareScreenshots()` - Visual regression comparison
- `waitForFileDownload()` - Handle file downloads
- Page Objects for common interactions

## Configuration

### Playwright Settings

- **Timeout**: 30 seconds for tests, 5 seconds for assertions
- **Retries**: 2 on CI, 0 locally
- **Video**: Recorded on failure
- **Screenshots**: Taken on failure
- **Trace**: Enabled on first retry

### Environment

- **Base URL**: http://localhost:4173 (Vite preview server)
- **Viewport**: 1280x720 default
- **Test Data**: `./test-data/` directory
- **Downloads**: `./downloads/` directory

## Best Practices

### Writing Tests

1. **Use Page Objects** - Leverage provided page objects for common interactions
2. **Explicit Waits** - Use `waitForTimeout()` sparingly, prefer element visibility
3. **Test Data** - Use fixture functions to create test files
4. **Assertions** - Use custom assertion helpers when available
5. **Screenshots** - Take screenshots for visual regression testing

### Debugging

1. **UI Mode** - Use `npm run test:e2e:ui` for interactive debugging
2. **Headed Mode** - Use `npm run test:e2e:headed` to see browser
3. **Debug Mode** - Use `npm run test:e2e:debug` to step through tests
4. **Trace Viewer** - Check traces in HTML report for failed tests

### Performance

- Tests automatically measure performance for large operations
- File upload should complete within 5 seconds
- 3D generation should complete within 15 seconds
- Editing operations should respond within 1 second

## Continuous Integration

Tests are configured to run on GitHub Actions:

- Automatic retry on failure (2 retries)
- Parallel execution disabled on CI
- HTML reports generated and saved
- Videos and screenshots saved on failure

## Troubleshooting

### Common Issues

1. **Browser Dependencies** - Run `npx playwright install` if browsers missing
2. **Port Conflicts** - Ensure port 4173 is available for preview server
3. **File Permissions** - Check write permissions for test-data and downloads directories
4. **WebGL Issues** - Some tests may skip if WebGL not available in test environment

### Debug Commands

```bash
# Check Playwright installation
npx playwright --version

# Install browsers
npx playwright install

# Run system checks
npx playwright doctor

# Clear test cache
rm -rf test-results/ playwright-report/
```

## Contributing

When adding new E2E tests:

1. Follow existing naming patterns
2. Use provided fixtures and page objects
3. Add appropriate visual regression tests
4. Include error handling scenarios
5. Test across mobile and desktop viewports
6. Update this README with new test coverage

## Related Documentation

- [Playwright Documentation](https://playwright.dev)
- [Project Requirements](../.spec-workflow/specs/dot-art-3d-converter/requirements.md)
- [Design Document](../.spec-workflow/specs/dot-art-3d-converter/design.md)
- [Implementation Tasks](../.spec-workflow/specs/dot-art-3d-converter/tasks.md)