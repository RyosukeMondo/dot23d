/**
 * E2E Test Setup
 * Initializes the test environment and provides global setup utilities
 */

import { FullConfig } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Global setup run once before all tests
 */
export default async function globalSetup(config: FullConfig) {
  console.log('🚀 Setting up E2E test environment...');
  
  // Create necessary directories
  const directories = ['test-data', 'downloads', 'test-results'];
  
  for (const dir of directories) {
    const dirPath = path.join(process.cwd(), dir);
    try {
      await fs.mkdir(dirPath, { recursive: true });
      console.log(`✅ Created directory: ${dir}`);
    } catch (error) {
      console.log(`ℹ️ Directory already exists: ${dir}`);
    }
  }
  
  // Clean up any existing test data
  try {
    const testDataDir = path.join(process.cwd(), 'test-data');
    const files = await fs.readdir(testDataDir);
    
    await Promise.all(
      files.map(file => 
        fs.unlink(path.join(testDataDir, file)).catch(() => {})
      )
    );
    
    console.log('🧹 Cleaned up existing test data');
  } catch {
    // Directory might not exist or be empty
  }
  
  // Verify required environment
  console.log('🔍 Verifying test environment...');
  
  // Check if Node.js version is compatible
  const nodeVersion = process.version;
  console.log(`Node.js version: ${nodeVersion}`);
  
  // Check if we're running in CI
  const isCI = process.env.CI === 'true';
  console.log(`Running in CI: ${isCI}`);
  
  console.log('✅ E2E test environment ready!');
}

/**
 * Global teardown run once after all tests
 */
export async function globalTeardown() {
  console.log('🧹 Cleaning up E2E test environment...');
  
  // Optional: Clean up test data after all tests complete
  try {
    const testDataDir = path.join(process.cwd(), 'test-data');
    const files = await fs.readdir(testDataDir);
    
    await Promise.all(
      files.map(file => 
        fs.unlink(path.join(testDataDir, file)).catch(() => {})
      )
    );
    
    console.log('✅ Test cleanup completed');
  } catch {
    // Ignore cleanup errors
  }
}