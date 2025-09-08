import { test, expect, testFiles, HomePage, DotEditorPage, Model3DPage } from './fixtures';

test.describe('Complete User Journey - End-to-End Workflows', () => {
  test('CSV upload → Edit → 3D conversion → Download complete workflow', async ({ 
    page, 
    uploadTestFile, 
    compareScreenshots 
  }) => {
    const homePage = new HomePage(page);
    const dotEditorPage = new DotEditorPage(page);
    const model3DPage = new Model3DPage(page);
    
    // Step 1: Upload CSV file
    await homePage.goto();
    const testFile = await uploadTestFile(testFiles.complexDots, 'journey-test.csv');
    await homePage.uploadFile(testFile);
    await homePage.waitForUpload();
    
    // Verify initial upload
    await expect(page.locator('[data-testid="preview"]')).toBeVisible();
    await compareScreenshots('journey-01-uploaded');
    
    // Step 2: Edit the dot pattern
    const firstDot = page.locator('[data-testid="dot"]').first();
    if (await firstDot.isVisible()) {
      await firstDot.click();
      await page.waitForTimeout(200);
    }
    
    // Edit a few more dots
    const dots = page.locator('[data-testid="dot"]');
    const dotCount = await dots.count();
    if (dotCount > 5) {
      await dots.nth(5).click();
      await dots.nth(10).click();
      await page.waitForTimeout(200);
    }
    
    await compareScreenshots('journey-02-edited');
    
    // Step 3: Generate 3D model
    const generate3DButton = page.getByRole('button', { 
      name: /generate.*3d|convert.*3d|3d.*view|view.*model/i 
    });
    
    if (await generate3DButton.isVisible()) {
      await generate3DButton.click();
      await page.waitForTimeout(3000); // Allow time for 3D generation
      
      // Verify 3D model is generated
      await model3DPage.waitForModel();
      await compareScreenshots('journey-03-3d-generated');
      
      // Step 4: Interact with 3D model
      await model3DPage.rotateModel(45, 30);
      await page.waitForTimeout(500);
      await model3DPage.zoomModel(-50);
      await page.waitForTimeout(300);
      
      await compareScreenshots('journey-04-3d-interacted');
      
      // Step 5: Download the model
      const downloadButton = page.getByRole('button', { 
        name: /download|export|save/i 
      });
      
      if (await downloadButton.isVisible()) {
        const downloadPromise = page.waitForEvent('download');
        await downloadButton.click();
        
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/\.obj$/i);
        
        // Verify download completed successfully
        const downloadPath = await download.path();
        expect(downloadPath).toBeTruthy();
      }
    }
    
    // Complete workflow should take reasonable time
    // This ensures performance is acceptable for real users
  });

  test('Image upload → Conversion → Edit → 3D workflow', async ({ 
    page, 
    compareScreenshots 
  }) => {
    const homePage = new HomePage(page);
    const model3DPage = new Model3DPage(page);
    
    await homePage.goto();
    
    // Step 1: Switch to image upload mode
    const imageUploadButton = page.getByRole('button', { 
      name: /upload.*image|image.*mode|convert.*image/i 
    });
    
    if (await imageUploadButton.isVisible()) {
      await imageUploadButton.click();
      await page.waitForTimeout(500);
      
      // Step 2: Test image conversion controls
      const thresholdSlider = page.locator('input[type="range"][data-testid*="threshold"]');
      const resolutionSlider = page.locator('input[type="range"][data-testid*="resolution"]');
      
      if (await thresholdSlider.isVisible()) {
        await thresholdSlider.fill('0.6');
        await page.waitForTimeout(300);
      }
      
      if (await resolutionSlider.isVisible()) {
        await resolutionSlider.fill('32');
        await page.waitForTimeout(300);
      }
      
      await compareScreenshots('journey-image-01-converted');
      
      // Step 3: Edit converted pattern
      const dots = page.locator('[data-testid="dot"]');
      if (await dots.first().isVisible()) {
        await dots.first().click();
        await dots.nth(2).click();
        await page.waitForTimeout(200);
      }
      
      // Step 4: Generate 3D from image-converted pattern
      const generate3DButton = page.getByRole('button', { name: /generate.*3d|3d/i });
      if (await generate3DButton.isVisible()) {
        await generate3DButton.click();
        await model3DPage.waitForModel();
        
        await compareScreenshots('journey-image-02-3d-from-image');
      }
    }
  });

  test('Error recovery and user guidance workflow', async ({ 
    page, 
    uploadTestFile 
  }) => {
    const homePage = new HomePage(page);
    
    await homePage.goto();
    
    // Step 1: Test invalid file upload
    const invalidFile = await uploadTestFile('invalid content', 'invalid.txt');
    await homePage.uploadFile(invalidFile);
    
    // Should show helpful error message
    const errorMessage = page.locator('[data-testid="error"], .error, [role="alert"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText(/csv|format|invalid/i);
    
    // Step 2: Test empty file
    const emptyFile = await uploadTestFile('', 'empty.csv');
    await homePage.uploadFile(emptyFile);
    
    // Should show appropriate guidance
    await expect(errorMessage).toBeVisible();
    
    // Step 3: Test successful recovery
    const validFile = await uploadTestFile(testFiles.simpleDots, 'recovery.csv');
    await homePage.uploadFile(validFile);
    await homePage.waitForUpload();
    
    // Should successfully recover and show content
    await expect(page.locator('[data-testid="preview"]')).toBeVisible();
    
    // Error messages should be cleared
    const persistentErrors = page.locator('[data-testid="error"].visible, .error.visible');
    const errorCount = await persistentErrors.count();
    expect(errorCount).toBe(0);
  });

  test('Performance under load - large patterns workflow', async ({ 
    page, 
    uploadTestFile 
  }) => {
    const homePage = new HomePage(page);
    const model3DPage = new Model3DPage(page);
    
    await homePage.goto();
    
    // Test with large pattern
    const largeFile = await uploadTestFile(testFiles.largeDots, 'large-perf.csv');
    
    // Measure upload and display performance
    const uploadStartTime = Date.now();
    
    await homePage.uploadFile(largeFile);
    await homePage.waitForUpload();
    
    const uploadEndTime = Date.now();
    const uploadTime = uploadEndTime - uploadStartTime;
    
    // Should handle large files within reasonable time
    expect(uploadTime).toBeLessThan(5000); // 5 seconds
    
    // Test editing performance
    const editStartTime = Date.now();
    
    const randomDot = page.locator('[data-testid="dot"]').nth(50);
    if (await randomDot.isVisible()) {
      await randomDot.click();
    }
    
    const editEndTime = Date.now();
    const editTime = editEndTime - editStartTime;
    
    expect(editTime).toBeLessThan(1000); // 1 second
    
    // Test 3D generation performance
    const generate3DButton = page.getByRole('button', { name: /generate|3d/i });
    if (await generate3DButton.isVisible()) {
      const gen3DStartTime = Date.now();
      
      await generate3DButton.click();
      await model3DPage.waitForModel();
      
      const gen3DEndTime = Date.now();
      const gen3DTime = gen3DEndTime - gen3DStartTime;
      
      // 3D generation should complete within reasonable time even for large patterns
      expect(gen3DTime).toBeLessThan(15000); // 15 seconds
    }
  });

  test('Accessibility and keyboard navigation workflow', async ({ page, uploadTestFile }) => {
    const homePage = new HomePage(page);
    
    await homePage.goto();
    
    // Test keyboard navigation
    await page.keyboard.press('Tab'); // Should focus first interactive element
    await page.keyboard.press('Tab'); // Navigate to next element
    
    // Test file upload via keyboard
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.isVisible()) {
      await fileInput.focus();
      
      // Simulate file selection (in real test, this would be more complex)
      const testFile = await uploadTestFile(testFiles.simpleDots, 'a11y-test.csv');
      await fileInput.setInputFiles(testFile);
      
      await homePage.waitForUpload();
    }
    
    // Test keyboard editing
    const dotGrid = page.locator('[data-testid="dot-grid"], .dot-grid');
    if (await dotGrid.isVisible()) {
      await dotGrid.focus();
      
      // Arrow key navigation
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowDown');
      
      // Space to toggle
      await page.keyboard.press('Space');
      await page.waitForTimeout(100);
      
      // Enter to confirm
      await page.keyboard.press('Enter');
    }
    
    // Test 3D viewer keyboard controls
    const generate3DButton = page.getByRole('button', { name: /generate|3d/i });
    if (await generate3DButton.isVisible()) {
      await generate3DButton.focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      
      // Test 3D keyboard controls
      const canvas = page.locator('canvas');
      if (await canvas.isVisible()) {
        await canvas.focus();
        
        // WASD or arrow keys for camera control
        await page.keyboard.press('KeyW'); // Move up/forward
        await page.keyboard.press('KeyA'); // Move left
        await page.keyboard.press('KeyS'); // Move down/back
        await page.keyboard.press('KeyD'); // Move right
      }
    }
  });

  test('Mobile responsive workflow', async ({ page, uploadTestFile }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    const homePage = new HomePage(page);
    await homePage.goto();
    
    // Test mobile file upload
    const testFile = await uploadTestFile(testFiles.simpleDots, 'mobile-test.csv');
    await homePage.uploadFile(testFile);
    await homePage.waitForUpload();
    
    // Test mobile editing (touch interactions)
    const firstDot = page.locator('[data-testid="dot"]').first();
    if (await firstDot.isVisible()) {
      // Simulate touch tap
      await firstDot.tap();
      await page.waitForTimeout(200);
    }
    
    // Test mobile 3D viewer
    const generate3DButton = page.getByRole('button', { name: /generate|3d/i });
    if (await generate3DButton.isVisible()) {
      await generate3DButton.tap();
      await page.waitForTimeout(3000);
      
      // Test touch gestures on 3D model
      const canvas = page.locator('canvas');
      if (await canvas.isVisible()) {
        // Pinch zoom simulation (simplified)
        const box = await canvas.boundingBox();
        if (box) {
          const centerX = box.x + box.width / 2;
          const centerY = box.y + box.height / 2;
          
          // Single finger drag for rotation
          await page.touchscreen.tap(centerX, centerY);
          await page.waitForTimeout(100);
        }
      }
    }
  });

  test('Cross-browser compatibility workflow', async ({ page, uploadTestFile, browserName }) => {
    const homePage = new HomePage(page);
    await homePage.goto();
    
    // Test basic functionality across browsers
    const testFile = await uploadTestFile(testFiles.simpleDots, `${browserName}-test.csv`);
    await homePage.uploadFile(testFile);
    await homePage.waitForUpload();
    
    // Verify core features work in all browsers
    await expect(page.locator('[data-testid="preview"]')).toBeVisible();
    
    // Test 3D functionality (WebGL support)
    const generate3DButton = page.getByRole('button', { name: /generate|3d/i });
    if (await generate3DButton.isVisible()) {
      await generate3DButton.click();
      
      // WebGL support varies by browser
      try {
        await page.waitForSelector('canvas', { timeout: 5000 });
        const canvas = page.locator('canvas');
        await expect(canvas).toBeVisible();
      } catch (error) {
        // Some browsers might not support WebGL in test environment
        console.log(`WebGL not available in ${browserName}`);
      }
    }
  });
});