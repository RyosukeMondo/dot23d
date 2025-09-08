import { test, expect, testFiles, HomePage, assertions } from './fixtures';

test.describe('File Upload and CSV Processing Workflow', () => {
  let homePage: HomePage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    await homePage.goto();
  });

  test('should upload and display simple dot pattern from CSV', async ({ 
    page, 
    uploadTestFile, 
    compareScreenshots 
  }) => {
    // Create test CSV file
    const testFile = await uploadTestFile(testFiles.simpleDots, 'simple-dots.csv');
    
    // Upload file
    await homePage.uploadFile(testFile);
    await homePage.waitForUpload();
    
    // Verify the dot pattern is displayed correctly
    await expect(page.locator('[data-testid="preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="dot"]')).toHaveCount(9); // 3x3 grid
    
    // Take screenshot for visual regression
    await compareScreenshots('simple-dot-pattern');
  });

  test('should upload and display complex dot pattern', async ({ 
    page, 
    uploadTestFile 
  }) => {
    const testFile = await uploadTestFile(testFiles.complexDots, 'complex-dots.csv');
    
    await homePage.uploadFile(testFile);
    await homePage.waitForUpload();
    
    // Verify complex pattern display
    await expect(page.locator('[data-testid="preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="dot"]')).toHaveCount(25); // 5x5 grid
    
    // Check that active dots are visually different from inactive ones
    const activeDots = page.locator('[data-testid="dot"].active, [data-testid="dot"].filled');
    const inactiveDots = page.locator('[data-testid="dot"]:not(.active):not(.filled)');
    
    await expect(activeDots).toHaveCount(13); // Based on complex pattern
    await expect(inactiveDots).toHaveCount(12);
  });

  test('should handle large dot patterns efficiently', async ({ 
    page, 
    uploadTestFile 
  }) => {
    const testFile = await uploadTestFile(testFiles.largeDots, 'large-dots.csv');
    
    // Measure performance
    const startTime = Date.now();
    
    await homePage.uploadFile(testFile);
    await homePage.waitForUpload();
    
    const endTime = Date.now();
    const loadTime = endTime - startTime;
    
    // Should load within reasonable time (5 seconds)
    expect(loadTime).toBeLessThan(5000);
    
    // Verify large pattern display
    await expect(page.locator('[data-testid="preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="dot"]')).toHaveCount(100); // 10x10 grid
  });

  test('should provide pan and zoom controls for preview', async ({ 
    page, 
    uploadTestFile 
  }) => {
    const testFile = await uploadTestFile(testFiles.complexDots, 'complex-dots.csv');
    
    await homePage.uploadFile(testFile);
    await homePage.waitForUpload();
    
    const preview = page.locator('[data-testid="preview"]');
    await expect(preview).toBeVisible();
    
    // Test zoom functionality
    const zoomInButton = page.getByRole('button', { name: /zoom.?in|\\+/i });
    const zoomOutButton = page.getByRole('button', { name: /zoom.?out|\\-/i });
    
    if (await zoomInButton.isVisible()) {
      await zoomInButton.click();
      await page.waitForTimeout(100); // Allow zoom animation
    }
    
    if (await zoomOutButton.isVisible()) {
      await zoomOutButton.click();
      await page.waitForTimeout(100);
    }
    
    // Test pan functionality (drag to pan)
    const previewArea = page.locator('[data-testid="preview-area"], canvas, svg').first();
    if (await previewArea.isVisible()) {
      const box = await previewArea.boundingBox();
      if (box) {
        // Simulate drag gesture for panning
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 50);
        await page.mouse.up();
      }
    }
  });

  test('should handle invalid CSV files gracefully', async ({ page, uploadTestFile }) => {
    // Create invalid CSV content
    const invalidCsv = `invalid,content,here
not,boolean,values
true,maybe,false`;
    
    const testFile = await uploadTestFile(invalidCsv, 'invalid.csv');
    
    await homePage.uploadFile(testFile);
    
    // Should show error message
    await expect(page.locator('[data-testid="error"], .error, [role="alert"]')).toBeVisible();
    await expect(page.locator('[data-testid="error"], .error, [role="alert"]')).toContainText(/invalid|error|parse/i);
  });

  test('should handle empty CSV files', async ({ page, uploadTestFile }) => {
    const emptyFile = await uploadTestFile('', 'empty.csv');
    
    await homePage.uploadFile(emptyFile);
    
    // Should show appropriate message
    await expect(page.locator('[data-testid="error"], .error, [role="alert"], .message')).toBeVisible();
  });

  test('should handle single dot pattern', async ({ page, uploadTestFile }) => {
    const testFile = await uploadTestFile(testFiles.singleDot, 'single.csv');
    
    await homePage.uploadFile(testFile);
    await homePage.waitForUpload();
    
    // Should display single dot
    await expect(page.locator('[data-testid="preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="dot"]')).toHaveCount(1);
  });

  test('should reject non-CSV files', async ({ page, uploadTestFile }) => {
    // Create a non-CSV file
    const textFile = await uploadTestFile('This is not a CSV file', 'test.txt');
    
    await homePage.uploadFile(textFile);
    
    // Should show file type error
    await expect(page.locator('[data-testid="error"], .error, [role="alert"]')).toBeVisible();
    await expect(page.locator('[data-testid="error"], .error, [role="alert"]')).toContainText(/csv|format|type/i);
  });
});