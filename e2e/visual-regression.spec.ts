import { test, expect, testFiles, HomePage } from './fixtures';

test.describe('Visual Regression Testing', () => {
  test('UI component consistency across updates', async ({ 
    page, 
    uploadTestFile, 
    compareScreenshots 
  }) => {
    const homePage = new HomePage(page);
    await homePage.goto();
    
    // Test homepage layout
    await compareScreenshots('homepage-layout', { threshold: 0.2 });
    
    // Upload file and test preview layout
    const testFile = await uploadTestFile(testFiles.simpleDots, 'visual-test.csv');
    await homePage.uploadFile(testFile);
    await homePage.waitForUpload();
    
    await compareScreenshots('preview-layout', { threshold: 0.2 });
    
    // Test different viewport sizes
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);
    await compareScreenshots('preview-desktop-large', { threshold: 0.2 });
    
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    await compareScreenshots('preview-tablet', { threshold: 0.2 });
    
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    await compareScreenshots('preview-mobile', { threshold: 0.2 });
  });

  test('Dot pattern rendering consistency', async ({ 
    page, 
    uploadTestFile, 
    compareScreenshots 
  }) => {
    const homePage = new HomePage(page);
    await homePage.goto();
    
    // Test simple pattern
    const simpleFile = await uploadTestFile(testFiles.simpleDots, 'visual-simple.csv');
    await homePage.uploadFile(simpleFile);
    await homePage.waitForUpload();
    
    await compareScreenshots('simple-dot-pattern', { threshold: 0.1 });
    
    // Test complex pattern
    const complexFile = await uploadTestFile(testFiles.complexDots, 'visual-complex.csv');
    await homePage.uploadFile(complexFile);
    await homePage.waitForUpload();
    
    await compareScreenshots('complex-dot-pattern', { threshold: 0.1 });
    
    // Test large pattern
    const largeFile = await uploadTestFile(testFiles.largeDots, 'visual-large.csv');
    await homePage.uploadFile(largeFile);
    await homePage.waitForUpload();
    
    await compareScreenshots('large-dot-pattern', { threshold: 0.1 });
  });

  test('3D model rendering consistency', async ({ 
    page, 
    uploadTestFile, 
    compareScreenshots 
  }) => {
    const homePage = new HomePage(page);
    await homePage.goto();
    
    const testFile = await uploadTestFile(testFiles.simpleDots, '3d-visual-test.csv');
    await homePage.uploadFile(testFile);
    await homePage.waitForUpload();
    
    // Generate 3D model
    const generate3DButton = page.getByRole('button', { name: /generate|3d/i });
    if (await generate3DButton.isVisible()) {
      await generate3DButton.click();
      await page.waitForTimeout(3000);
      
      // Wait for 3D scene to stabilize
      const canvas = page.locator('canvas');
      if (await canvas.isVisible()) {
        await page.waitForTimeout(2000); // Allow WebGL to render
        
        // Test default 3D view
        await compareScreenshots('3d-model-default-view', { threshold: 0.3 });
        
        // Test different camera angles
        await page.mouse.move(400, 300);
        await page.mouse.down();
        await page.mouse.move(450, 250);
        await page.mouse.up();
        await page.waitForTimeout(1000);
        
        await compareScreenshots('3d-model-rotated-view', { threshold: 0.3 });
      }
    }
  });

  test('Error state visual consistency', async ({ 
    page, 
    uploadTestFile, 
    compareScreenshots 
  }) => {
    const homePage = new HomePage(page);
    await homePage.goto();
    
    // Test invalid file error
    const invalidFile = await uploadTestFile('invalid content', 'invalid.txt');
    await homePage.uploadFile(invalidFile);
    
    await page.waitForTimeout(500);
    await compareScreenshots('error-invalid-file', { threshold: 0.2 });
    
    // Test empty file error
    const emptyFile = await uploadTestFile('', 'empty.csv');
    await homePage.uploadFile(emptyFile);
    
    await page.waitForTimeout(500);
    await compareScreenshots('error-empty-file', { threshold: 0.2 });
  });

  test('Interactive state visual consistency', async ({ 
    page, 
    uploadTestFile, 
    compareScreenshots 
  }) => {
    const homePage = new HomePage(page);
    await homePage.goto();
    
    const testFile = await uploadTestFile(testFiles.simpleDots, 'interactive-test.csv');
    await homePage.uploadFile(testFile);
    await homePage.waitForUpload();
    
    // Test hover states
    const firstDot = page.locator('[data-testid="dot"]').first();
    if (await firstDot.isVisible()) {
      await firstDot.hover();
      await page.waitForTimeout(200);
      await compareScreenshots('dot-hover-state', { threshold: 0.2 });
      
      // Test selected/active state
      await firstDot.click();
      await page.waitForTimeout(200);
      await compareScreenshots('dot-active-state', { threshold: 0.2 });
    }
    
    // Test button states
    const buttons = page.getByRole('button');
    if (await buttons.first().isVisible()) {
      await buttons.first().hover();
      await page.waitForTimeout(200);
      await compareScreenshots('button-hover-state', { threshold: 0.2 });
    }
  });

  test('Loading state visual consistency', async ({ 
    page, 
    uploadTestFile, 
    compareScreenshots 
  }) => {
    const homePage = new HomePage(page);
    await homePage.goto();
    
    // Capture loading states during file processing
    const testFile = await uploadTestFile(testFiles.largeDots, 'loading-test.csv');
    
    // Start upload and capture loading state quickly
    const uploadPromise = homePage.uploadFile(testFile);
    
    // Try to capture loading spinner/indicator
    await page.waitForTimeout(100);
    const loadingIndicator = page.locator('.loading, [data-testid="loading"], .spinner');
    if (await loadingIndicator.isVisible()) {
      await compareScreenshots('loading-state', { threshold: 0.2 });
    }
    
    await uploadPromise;
    await homePage.waitForUpload();
  });

  test('Theme and styling consistency', async ({ 
    page, 
    uploadTestFile, 
    compareScreenshots 
  }) => {
    const homePage = new HomePage(page);
    await homePage.goto();
    
    // Test light theme (default)
    await compareScreenshots('theme-light', { threshold: 0.2 });
    
    // Test dark theme if available
    const themeToggle = page.getByRole('button', { name: /dark|theme|mode/i });
    if (await themeToggle.isVisible()) {
      await themeToggle.click();
      await page.waitForTimeout(500);
      await compareScreenshots('theme-dark', { threshold: 0.2 });
    }
    
    // Test with content loaded
    const testFile = await uploadTestFile(testFiles.simpleDots, 'theme-test.csv');
    await homePage.uploadFile(testFile);
    await homePage.waitForUpload();
    
    await compareScreenshots('theme-with-content', { threshold: 0.2 });
  });

  test('Animation and transition consistency', async ({ 
    page, 
    uploadTestFile, 
    compareScreenshots 
  }) => {
    const homePage = new HomePage(page);
    await homePage.goto();
    
    const testFile = await uploadTestFile(testFiles.simpleDots, 'animation-test.csv');
    await homePage.uploadFile(testFile);
    await homePage.waitForUpload();
    
    // Test zoom animation
    const zoomInButton = page.getByRole('button', { name: /zoom.*in|\+/i });
    if (await zoomInButton.isVisible()) {
      await zoomInButton.click();
      await page.waitForTimeout(500); // Wait for animation to complete
      await compareScreenshots('zoom-in-animation-complete', { threshold: 0.2 });
      
      const zoomOutButton = page.getByRole('button', { name: /zoom.*out|\-/i });
      if (await zoomOutButton.isVisible()) {
        await zoomOutButton.click();
        await page.waitForTimeout(500);
        await compareScreenshots('zoom-out-animation-complete', { threshold: 0.2 });
      }
    }
    
    // Test edit animation
    const firstDot = page.locator('[data-testid="dot"]').first();
    if (await firstDot.isVisible()) {
      await firstDot.click();
      await page.waitForTimeout(300); // Wait for toggle animation
      await compareScreenshots('edit-animation-complete', { threshold: 0.2 });
    }
  });

  test('Cross-browser visual consistency', async ({ 
    page, 
    uploadTestFile, 
    compareScreenshots,
    browserName 
  }) => {
    const homePage = new HomePage(page);
    await homePage.goto();
    
    // Test basic layout across browsers
    await compareScreenshots(`${browserName}-homepage`, { threshold: 0.3 });
    
    const testFile = await uploadTestFile(testFiles.simpleDots, `${browserName}-test.csv`);
    await homePage.uploadFile(testFile);
    await homePage.waitForUpload();
    
    await compareScreenshots(`${browserName}-with-content`, { threshold: 0.3 });
    
    // Test 3D rendering (if supported)
    const generate3DButton = page.getByRole('button', { name: /generate|3d/i });
    if (await generate3DButton.isVisible()) {
      try {
        await generate3DButton.click();
        await page.waitForTimeout(3000);
        
        const canvas = page.locator('canvas');
        if (await canvas.isVisible()) {
          await page.waitForTimeout(2000);
          await compareScreenshots(`${browserName}-3d-view`, { threshold: 0.4 });
        }
      } catch (error) {
        console.log(`3D rendering not available in ${browserName}`);
      }
    }
  });

  test('Typography and text rendering consistency', async ({ 
    page, 
    compareScreenshots 
  }) => {
    const homePage = new HomePage(page);
    await homePage.goto();
    
    // Test text rendering at different sizes
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);
    await compareScreenshots('typography-large-screen', { threshold: 0.2 });
    
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(500);
    await compareScreenshots('typography-medium-screen', { threshold: 0.2 });
    
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    await compareScreenshots('typography-small-screen', { threshold: 0.2 });
  });
});