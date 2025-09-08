import { test as base, expect } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

// Test data fixtures
export const testFiles = {
  // Simple 3x3 dot pattern CSV
  simpleDots: `true,false,true
false,true,false
true,false,true`,

  // Complex 5x5 pattern
  complexDots: `true,true,false,true,true
true,false,true,false,true
false,true,true,true,false
true,false,true,false,true
true,true,false,true,true`,

  // Single dot
  singleDot: `true`,

  // Empty pattern
  emptyPattern: `false,false
false,false`,

  // Large pattern (10x10 checkerboard)
  largeDots: Array.from({ length: 10 }, (_, row) =>
    Array.from({ length: 10 }, (_, col) => (row + col) % 2 === 0 ? 'true' : 'false').join(',')
  ).join('\n'),
};

// Test fixtures
type TestFixtures = {
  testDataDir: string;
  uploadTestFile: (content: string, filename?: string) => Promise<string>;
  cleanupFiles: () => Promise<void>;
  waitForFileDownload: () => Promise<string>;
  compareScreenshots: (name: string, options?: { threshold?: number }) => Promise<void>;
};

export const test = base.extend<TestFixtures>({
  testDataDir: async ({}, use) => {
    const testDataDir = path.join(process.cwd(), 'test-data');
    await fs.mkdir(testDataDir, { recursive: true });
    await use(testDataDir);
  },

  uploadTestFile: async ({ testDataDir }, use) => {
    const filesToCleanup: string[] = [];
    
    const uploadTestFile = async (content: string, filename = 'test-dots.csv') => {
      const filePath = path.join(testDataDir, filename);
      await fs.writeFile(filePath, content, 'utf-8');
      filesToCleanup.push(filePath);
      return filePath;
    };

    await use(uploadTestFile);

    // Cleanup
    for (const file of filesToCleanup) {
      try {
        await fs.unlink(file);
      } catch {
        // File might not exist, ignore error
      }
    }
  },

  cleanupFiles: async ({ testDataDir }, use) => {
    const cleanupFiles = async () => {
      try {
        const files = await fs.readdir(testDataDir);
        await Promise.all(
          files.map(file => fs.unlink(path.join(testDataDir, file)).catch(() => {}))
        );
      } catch {
        // Directory might not exist, ignore error
      }
    };

    await use(cleanupFiles);
  },

  waitForFileDownload: async ({ page }, use) => {
    const waitForFileDownload = async (): Promise<string> => {
      const downloadPromise = page.waitForEvent('download');
      // Trigger download by clicking download button
      await page.getByRole('button', { name: /download|export/i }).click();
      const download = await downloadPromise;
      
      // Save the file
      const filename = download.suggestedFilename();
      const filepath = path.join(process.cwd(), 'downloads', filename);
      await download.saveAs(filepath);
      
      return filepath;
    };

    await use(waitForFileDownload);
  },

  compareScreenshots: async ({ page }, use) => {
    const compareScreenshots = async (name: string, options?: { threshold?: number }) => {
      await expect(page).toHaveScreenshot(`${name}.png`, {
        threshold: options?.threshold || 0.3,
        mode: 'rgb',
        animations: 'disabled',
      });
    };

    await use(compareScreenshots);
  },
});

// Helper functions for common assertions
export const assertions = {
  // Check if element is visible and enabled
  async toBeInteractable(locator: any) {
    await expect(locator).toBeVisible();
    await expect(locator).toBeEnabled();
  },

  // Check if file input accepts the uploaded file
  async toAcceptFile(fileInput: any, filepath: string) {
    await fileInput.setInputFiles(filepath);
    const files = await fileInput.inputValue();
    expect(files).toBeTruthy();
  },

  // Check if 3D model viewer is loaded
  async toHave3DModel(page: any) {
    // Check for Three.js canvas
    await expect(page.locator('canvas')).toBeVisible();
    
    // Wait for WebGL context to be ready
    await page.waitForFunction(() => {
      const canvas = document.querySelector('canvas');
      return canvas && (canvas as HTMLCanvasElement).getContext('webgl') !== null;
    });
  },

  // Check if dot pattern is correctly displayed
  async toShowDotPattern(page: any, expectedPattern: boolean[][]) {
    const dots = page.locator('[data-testid="dot"]');
    const count = await dots.count();
    
    const expectedCount = expectedPattern.reduce((sum, row) => sum + row.length, 0);
    expect(count).toBe(expectedCount);
    
    // Check individual dot states
    for (let row = 0; row < expectedPattern.length; row++) {
      for (let col = 0; col < expectedPattern[row].length; col++) {
        const dotElement = dots.nth(row * expectedPattern[0].length + col);
        const isActive = expectedPattern[row][col];
        
        if (isActive) {
          await expect(dotElement).toHaveClass(/active|filled/);
        } else {
          await expect(dotElement).not.toHaveClass(/active|filled/);
        }
      }
    }
  },
};

// Page Object Models for better test organization
export class HomePage {
  constructor(public page: any) {}

  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  async uploadFile(filepath: string) {
    const fileInput = this.page.locator('input[type="file"]');
    await fileInput.setInputFiles(filepath);
  }

  async waitForUpload() {
    await this.page.waitForSelector('[data-testid="preview"]', { state: 'visible' });
  }
}

export class DotEditorPage {
  constructor(public page: any) {}

  async toggleDot(x: number, y: number) {
    const dot = this.page.locator(`[data-testid="dot-${x}-${y}"]`);
    await dot.click();
  }

  async selectRange(startX: number, startY: number, endX: number, endY: number) {
    const startDot = this.page.locator(`[data-testid="dot-${startX}-${startY}"]`);
    const endDot = this.page.locator(`[data-testid="dot-${endX}-${endY}"]`);
    
    await startDot.dragTo(endDot);
  }

  async getDotState(x: number, y: number): Promise<boolean> {
    const dot = this.page.locator(`[data-testid="dot-${x}-${y}"]`);
    const classNames = await dot.getAttribute('class');
    return classNames?.includes('active') || classNames?.includes('filled') || false;
  }
}

export class Model3DPage {
  constructor(public page: any) {}

  async waitForModel() {
    await assertions.toHave3DModel(this.page);
  }

  async downloadModel() {
    const downloadPromise = this.page.waitForEvent('download');
    await this.page.getByRole('button', { name: /download|export/i }).click();
    return await downloadPromise;
  }

  async rotateModel(deltaX: number, deltaY: number) {
    const canvas = this.page.locator('canvas');
    const box = await canvas.boundingBox();
    
    if (box) {
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      
      await this.page.mouse.move(centerX, centerY);
      await this.page.mouse.down();
      await this.page.mouse.move(centerX + deltaX, centerY + deltaY);
      await this.page.mouse.up();
    }
  }

  async zoomModel(delta: number) {
    const canvas = this.page.locator('canvas');
    await canvas.hover();
    await this.page.mouse.wheel(0, delta);
  }
}

export { expect } from '@playwright/test';