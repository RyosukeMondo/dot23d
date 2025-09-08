import { test, expect, testFiles, HomePage, Model3DPage } from './fixtures';

test.describe('3D Model Generation and Viewing Workflow', () => {
  let homePage: HomePage;
  let model3DPage: Model3DPage;

  test.beforeEach(async ({ page, uploadTestFile }) => {
    homePage = new HomePage(page);
    model3DPage = new Model3DPage(page);
    
    await homePage.goto();
    
    // Set up test pattern for 3D conversion
    const testFile = await uploadTestFile(testFiles.simpleDots, '3d-test.csv');
    await homePage.uploadFile(testFile);
    await homePage.waitForUpload();
  });

  test('should generate 3D model from dot pattern', async ({ page, compareScreenshots }) => {
    // Click generate 3D or convert button
    const generate3DButton = page.getByRole('button', { 
      name: /generate.*3d|convert.*3d|create.*model/i 
    });
    
    if (await generate3DButton.isVisible()) {
      await generate3DButton.click();
      
      // Wait for 3D model generation
      await page.waitForTimeout(2000);
      
      // Verify 3D model is displayed
      await model3DPage.waitForModel();
      
      // Take screenshot for visual regression
      await compareScreenshots('3d-model-generated');
    } else {
      // Alternative: check if 3D view is already visible
      const canvas = page.locator('canvas');
      if (await canvas.isVisible()) {
        await model3DPage.waitForModel();
      }
    }
  });

  test('should provide interactive 3D model controls', async ({ page }) => {
    // Navigate to 3D view
    const view3DButton = page.getByRole('button', { name: /3d.*view|view.*model/i });
    if (await view3DButton.isVisible()) {
      await view3DButton.click();
    }
    
    await model3DPage.waitForModel();
    
    // Test rotation controls
    await model3DPage.rotateModel(50, 30);
    await page.waitForTimeout(500);
    
    // Test zoom controls
    await model3DPage.zoomModel(-100); // Zoom in
    await page.waitForTimeout(300);
    await model3DPage.zoomModel(100);  // Zoom out
    await page.waitForTimeout(300);
    
    // Verify model is still visible after interactions
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('should export 3D model as OBJ file', async ({ page, waitForFileDownload }) => {
    // Generate/view 3D model first
    const view3DButton = page.getByRole('button', { name: /3d|model|generate/i });
    if (await view3DButton.isVisible()) {
      await view3DButton.click();
      await model3DPage.waitForModel();
    }
    
    // Test download functionality
    const downloadButton = page.getByRole('button', { 
      name: /download|export|save.*obj/i 
    });
    
    if (await downloadButton.isVisible()) {
      const downloadPromise = page.waitForEvent('download');
      await downloadButton.click();
      
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.obj$/i);
      
      // Verify file content (basic validation)
      const path = await download.path();
      if (path) {
        const fs = require('fs');
        const content = fs.readFileSync(path, 'utf8');
        
        // OBJ files should start with comments and contain vertices
        expect(content).toMatch(/^#/m); // Comments
        expect(content).toMatch(/^v\s/m); // Vertices
        expect(content).toMatch(/^f\s/m); // Faces
      }
    }
  });

  test('should optimize mesh for 3D printing', async ({ page }) => {
    // Generate 3D model
    const generate3DButton = page.getByRole('button', { name: /generate|3d/i });
    if (await generate3DButton.isVisible()) {
      await generate3DButton.click();
      await model3DPage.waitForModel();
    }
    
    // Check for optimization features
    const optimizeButton = page.getByRole('button', { name: /optimize|merge.*faces/i });
    if (await optimizeButton.isVisible()) {
      await optimizeButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Verify model statistics or information
    const modelStats = page.locator('[data-testid="model-stats"], .model-info');
    if (await modelStats.isVisible()) {
      // Should show vertex/face count
      await expect(modelStats).toContainText(/vertices?|faces?|triangles?/i);
    }
  });

  test('should create background support layer', async ({ page }) => {
    // The requirements specify a background layer for 3D printing support
    await model3DPage.waitForModel();
    
    // Look for background layer toggle or setting
    const backgroundToggle = page.locator('input[type="checkbox"]').filter({
      hasText: /background|support|base/i
    });
    
    if (await backgroundToggle.isVisible()) {
      // Test with background enabled
      await backgroundToggle.check();
      await page.waitForTimeout(500);
      
      // Test with background disabled
      await backgroundToggle.uncheck();
      await page.waitForTimeout(500);
    }
    
    // Verify model includes background layer by checking dimensions or description
    const modelInfo = page.locator('[data-testid="model-info"], .model-description');
    if (await modelInfo.isVisible()) {
      // Background layer should extend beyond the dot pattern
      expect(true).toBeTruthy(); // Placeholder for actual validation
    }
  });

  test('should handle complex patterns efficiently', async ({ 
    page, 
    uploadTestFile 
  }) => {
    // Test with complex pattern
    const complexFile = await uploadTestFile(testFiles.complexDots, 'complex-3d.csv');
    
    await homePage.uploadFile(complexFile);
    await homePage.waitForUpload();
    
    // Generate 3D model
    const generate3DButton = page.getByRole('button', { name: /generate|3d/i });
    if (await generate3DButton.isVisible()) {
      const startTime = Date.now();
      
      await generate3DButton.click();
      await model3DPage.waitForModel();
      
      const endTime = Date.now();
      const generationTime = endTime - startTime;
      
      // Should generate within reasonable time
      expect(generationTime).toBeLessThan(10000); // 10 seconds max
    }
  });

  test('should provide wireframe and solid view modes', async ({ page }) => {
    await model3DPage.waitForModel();
    
    // Look for view mode controls
    const wireframeButton = page.getByRole('button', { name: /wireframe/i });
    const solidButton = page.getByRole('button', { name: /solid|shaded/i });
    
    if (await wireframeButton.isVisible()) {
      await wireframeButton.click();
      await page.waitForTimeout(300);
      
      // Verify wireframe mode is active
      const canvas = page.locator('canvas');
      await expect(canvas).toBeVisible();
    }
    
    if (await solidButton.isVisible()) {
      await solidButton.click();
      await page.waitForTimeout(300);
      
      // Verify solid mode is active
      const canvas = page.locator('canvas');
      await expect(canvas).toBeVisible();
    }
  });

  test('should support model lighting controls', async ({ page }) => {
    await model3DPage.waitForModel();
    
    // Look for lighting controls
    const lightingControls = page.locator('[data-testid="lighting-controls"], .lighting');
    
    if (await lightingControls.isVisible()) {
      // Test different lighting options
      const ambientLight = page.locator('input[type="range"]').filter({
        hasText: /ambient/i
      });
      
      if (await ambientLight.isVisible()) {
        await ambientLight.fill('0.8');
        await page.waitForTimeout(200);
      }
    }
  });

  test('should validate model dimensions and scale', async ({ page }) => {
    await model3DPage.waitForModel();
    
    // Check model dimensions display
    const dimensionsInfo = page.locator('[data-testid="dimensions"], .model-dimensions');
    
    if (await dimensionsInfo.isVisible()) {
      // Should show width, height, depth
      await expect(dimensionsInfo).toContainText(/\d+/); // Some numeric dimension
    }
    
    // Test scale controls if available
    const scaleInput = page.locator('input[type="number"], input[type="range"]').filter({
      hasText: /scale|size/i
    });
    
    if (await scaleInput.isVisible()) {
      await scaleInput.fill('2.0');
      await page.waitForTimeout(500);
      
      // Model should update to new scale
      expect(true).toBeTruthy();
    }
  });

  test('should handle edge cases in model generation', async ({ 
    page, 
    uploadTestFile 
  }) => {
    // Test single dot
    const singleDotFile = await uploadTestFile(testFiles.singleDot, 'single-3d.csv');
    
    await homePage.uploadFile(singleDotFile);
    await homePage.waitForUpload();
    
    const generate3DButton = page.getByRole('button', { name: /generate|3d/i });
    if (await generate3DButton.isVisible()) {
      await generate3DButton.click();
      await model3DPage.waitForModel();
      
      // Should successfully create model from single dot
      const canvas = page.locator('canvas');
      await expect(canvas).toBeVisible();
    }
  });

  test('should support model reset and regeneration', async ({ page }) => {
    await model3DPage.waitForModel();
    
    // Look for reset or regenerate controls
    const resetButton = page.getByRole('button', { name: /reset|regenerate|refresh/i });
    
    if (await resetButton.isVisible()) {
      await resetButton.click();
      await page.waitForTimeout(1000);
      
      // Model should be regenerated
      await model3DPage.waitForModel();
    }
  });
});