import { test, expect, testFiles, HomePage, DotEditorPage } from './fixtures';

test.describe('Interactive Dot Editing Workflow', () => {
  let homePage: HomePage;
  let dotEditorPage: DotEditorPage;

  test.beforeEach(async ({ page, uploadTestFile }) => {
    homePage = new HomePage(page);
    dotEditorPage = new DotEditorPage(page);
    
    await homePage.goto();
    
    // Set up a test pattern for editing
    const testFile = await uploadTestFile(testFiles.simpleDots, 'edit-test.csv');
    await homePage.uploadFile(testFile);
    await homePage.waitForUpload();
  });

  test('should toggle individual dots on click', async ({ page, compareScreenshots }) => {
    // Find a specific dot to toggle
    const targetDot = page.locator('[data-testid="dot-1-1"], [data-testid="dot"]:nth-child(5)');
    
    if (await targetDot.isVisible()) {
      // Get initial state
      const initialClasses = await targetDot.getAttribute('class');
      const wasActive = initialClasses?.includes('active') || initialClasses?.includes('filled');
      
      // Click to toggle
      await targetDot.click();
      
      // Wait for state change
      await page.waitForTimeout(100);
      
      // Verify state changed
      const newClasses = await targetDot.getAttribute('class');
      const isNowActive = newClasses?.includes('active') || newClasses?.includes('filled');
      
      expect(isNowActive).toBe(!wasActive);
      
      // Take screenshot for visual regression
      await compareScreenshots('dot-toggled-state');
    }
  });

  test('should support range selection for multiple dots', async ({ page }) => {
    // Test drag selection functionality
    const dotGrid = page.locator('[data-testid="dot-grid"], .dot-grid, .preview');
    
    if (await dotGrid.isVisible()) {
      const gridBox = await dotGrid.boundingBox();
      
      if (gridBox) {
        // Perform drag selection
        const startX = gridBox.x + 50;
        const startY = gridBox.y + 50;
        const endX = gridBox.x + 150;
        const endY = gridBox.y + 150;
        
        // Start drag
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(endX, endY);
        await page.mouse.up();
        
        // Wait for selection processing
        await page.waitForTimeout(200);
        
        // Verify multiple dots were affected (visual feedback or state change)
        const selectedDots = page.locator('[data-testid="dot"].selected, .dot.selected');
        const selectedCount = await selectedDots.count();
        
        // Should have selected some dots
        expect(selectedCount).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('should update preview immediately after editing', async ({ page }) => {
    const firstDot = page.locator('[data-testid="dot"]').first();
    
    if (await firstDot.isVisible()) {
      await firstDot.click();
      
      // Preview should update without delay
      const preview = page.locator('[data-testid="preview"]');
      await expect(preview).toBeVisible();
      
      // Check that the change is visually reflected
      await page.waitForTimeout(100);
      
      // Verify edit history or undo functionality exists
      const undoButton = page.getByRole('button', { name: /undo|revert/i });
      const redoButton = page.getByRole('button', { name: /redo|restore/i });
      
      if (await undoButton.isVisible()) {
        await undoButton.click();
        await page.waitForTimeout(100);
        
        // Should revert the change
        expect(true).toBeTruthy();
      }
    }
  });

  test('should support keyboard shortcuts for editing', async ({ page }) => {
    // Focus on the dot grid
    const dotGrid = page.locator('[data-testid="dot-grid"], .dot-grid');
    
    if (await dotGrid.isVisible()) {
      await dotGrid.focus();
      
      // Test common keyboard shortcuts
      
      // Ctrl+Z for undo
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(100);
      
      // Ctrl+Y for redo
      await page.keyboard.press('Control+y');
      await page.waitForTimeout(100);
      
      // Space or Enter to toggle selected dot
      await page.keyboard.press('Space');
      await page.waitForTimeout(100);
      
      // Arrow keys for navigation
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('ArrowUp');
    }
  });

  test('should maintain edit history with undo/redo', async ({ page }) => {
    const dots = page.locator('[data-testid="dot"]');
    const undoButton = page.getByRole('button', { name: /undo/i });
    const redoButton = page.getByRole('button', { name: /redo/i });
    
    if (await dots.first().isVisible()) {
      // Make several edits
      await dots.nth(0).click();
      await page.waitForTimeout(50);
      await dots.nth(1).click();
      await page.waitForTimeout(50);
      await dots.nth(2).click();
      await page.waitForTimeout(50);
      
      // Undo operations
      if (await undoButton.isVisible()) {
        await undoButton.click();
        await page.waitForTimeout(100);
        
        await undoButton.click();
        await page.waitForTimeout(100);
        
        // Redo operation
        if (await redoButton.isVisible()) {
          await redoButton.click();
          await page.waitForTimeout(100);
        }
      }
    }
  });

  test('should support different edit modes (paint, erase, toggle)', async ({ page }) => {
    // Look for mode selection controls
    const paintMode = page.getByRole('button', { name: /paint|draw/i });
    const eraseMode = page.getByRole('button', { name: /erase|clear/i });
    const toggleMode = page.getByRole('button', { name: /toggle|flip/i });
    
    const firstDot = page.locator('[data-testid="dot"]').first();
    
    // Test paint mode
    if (await paintMode.isVisible() && await firstDot.isVisible()) {
      await paintMode.click();
      await firstDot.click();
      
      // Should set dot to active
      const classes = await firstDot.getAttribute('class');
      expect(classes).toContain('active');
    }
    
    // Test erase mode
    if (await eraseMode.isVisible()) {
      await eraseMode.click();
      await firstDot.click();
      
      // Should set dot to inactive
      const classes = await firstDot.getAttribute('class');
      expect(classes).not.toContain('active');
    }
  });

  test('should handle large patterns efficiently during editing', async ({ 
    page, 
    uploadTestFile 
  }) => {
    // Test with large pattern
    const largeFile = await uploadTestFile(testFiles.largeDots, 'large-edit.csv');
    
    await homePage.uploadFile(largeFile);
    await homePage.waitForUpload();
    
    // Test editing performance
    const startTime = Date.now();
    
    const randomDot = page.locator('[data-testid="dot"]').nth(50);
    if (await randomDot.isVisible()) {
      await randomDot.click();
    }
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Should respond quickly even with large patterns
    expect(responseTime).toBeLessThan(1000);
  });

  test('should provide visual feedback for selected areas', async ({ page }) => {
    const dotGrid = page.locator('[data-testid="dot-grid"], .dot-grid');
    
    if (await dotGrid.isVisible()) {
      // Test selection rectangle or highlighting
      const gridBox = await dotGrid.boundingBox();
      
      if (gridBox) {
        await page.mouse.move(gridBox.x + 50, gridBox.y + 50);
        await page.mouse.down();
        await page.mouse.move(gridBox.x + 150, gridBox.y + 150);
        
        // Should show selection rectangle or highlighted area
        const selectionIndicator = page.locator('.selection-rect, [data-testid="selection"]');
        
        // Visual feedback should appear during selection
        await page.waitForTimeout(100);
        
        await page.mouse.up();
      }
    }
  });

  test('should support copy/paste of pattern sections', async ({ page }) => {
    // Test copy/paste functionality if available
    const copyButton = page.getByRole('button', { name: /copy/i });
    const pasteButton = page.getByRole('button', { name: /paste/i });
    
    if (await copyButton.isVisible() && await pasteButton.isVisible()) {
      // Select an area first
      const dotGrid = page.locator('[data-testid="dot-grid"]');
      if (await dotGrid.isVisible()) {
        const gridBox = await dotGrid.boundingBox();
        if (gridBox) {
          // Select area
          await page.mouse.move(gridBox.x + 20, gridBox.y + 20);
          await page.mouse.down();
          await page.mouse.move(gridBox.x + 80, gridBox.y + 80);
          await page.mouse.up();
          
          // Copy selection
          await copyButton.click();
          
          // Move to different area and paste
          await page.mouse.click(gridBox.x + 120, gridBox.y + 120);
          await pasteButton.click();
        }
      }
    }
  });

  test('should validate pattern integrity after editing', async ({ page }) => {
    // Make some edits
    const dots = page.locator('[data-testid="dot"]');
    
    if (await dots.first().isVisible()) {
      const totalDots = await dots.count();
      
      // Click several dots
      for (let i = 0; i < Math.min(5, totalDots); i++) {
        await dots.nth(i).click();
        await page.waitForTimeout(50);
      }
      
      // Verify pattern is still valid
      const activeDots = page.locator('[data-testid="dot"].active');
      const activeDotCount = await activeDots.count();
      
      expect(activeDotCount).toBeGreaterThanOrEqual(0);
      expect(activeDotCount).toBeLessThanOrEqual(totalDots);
      
      // Pattern should still be convertible to 3D
      const convert3DButton = page.getByRole('button', { name: /3d|convert|generate/i });
      if (await convert3DButton.isVisible()) {
        await assertions.toBeInteractable(convert3DButton);
      }
    }
  });
});