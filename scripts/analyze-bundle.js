#!/usr/bin/env node

/**
 * Bundle analyzer script for visualizing and analyzing bundle sizes
 * Run with: npm run analyze-bundle
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

/**
 * Analyze build output and generate report
 */
function analyzeBuildOutput() {
  const distPath = join(projectRoot, 'dist');
  const assetsPath = join(distPath, 'assets');
  
  if (!existsSync(distPath)) {
    console.error('❌ Build output not found. Run "npm run build" first.');
    process.exit(1);
  }

  console.log('📊 Analyzing bundle sizes...\n');

  const analysis = {
    timestamp: new Date().toISOString(),
    chunks: [],
    assets: [],
    summary: {
      totalSize: 0,
      jsSize: 0,
      cssSize: 0,
      imageSize: 0,
      fontSize: 0,
      otherSize: 0,
      chunkCount: 0
    }
  };

  try {
    // Read all files in assets directory
    const fs = await import('fs/promises');
    const files = await fs.readdir(assetsPath);
    
    for (const file of files) {
      const filePath = join(assetsPath, file);
      const stats = await fs.stat(filePath);
      const size = stats.size;
      
      analysis.summary.totalSize += size;
      
      const asset = {
        name: file,
        size,
        sizeFormatted: formatBytes(size),
        type: getFileType(file)
      };
      
      // Categorize by file type
      if (file.endsWith('.js')) {
        analysis.chunks.push({
          ...asset,
          isVendor: file.includes('vendor') || file.includes('node_modules'),
          isEntry: file.includes('index') || file.includes('main'),
          chunkName: extractChunkName(file)
        });
        analysis.summary.jsSize += size;
        analysis.summary.chunkCount++;
      } else if (file.endsWith('.css')) {
        analysis.summary.cssSize += size;
      } else if (isImageFile(file)) {
        analysis.summary.imageSize += size;
      } else if (isFontFile(file)) {
        analysis.summary.fontSize += size;
      } else {
        analysis.summary.otherSize += size;
      }
      
      analysis.assets.push(asset);
    }

    // Sort chunks by size (largest first)
    analysis.chunks.sort((a, b) => b.size - a.size);
    analysis.assets.sort((a, b) => b.size - a.size);

    // Generate report
    generateReport(analysis);
    
    // Check for potential issues
    checkForIssues(analysis);

  } catch (error) {
    console.error('❌ Error analyzing build output:', error.message);
    process.exit(1);
  }
}

/**
 * Extract chunk name from filename
 */
function extractChunkName(filename) {
  const match = filename.match(/^(.+?)-[a-f0-9]+\.js$/);
  return match ? match[1] : filename.replace('.js', '');
}

/**
 * Get file type category
 */
function getFileType(filename) {
  if (filename.endsWith('.js')) return 'JavaScript';
  if (filename.endsWith('.css')) return 'CSS';
  if (isImageFile(filename)) return 'Image';
  if (isFontFile(filename)) return 'Font';
  return 'Other';
}

/**
 * Check if file is an image
 */
function isImageFile(filename) {
  return /\.(png|jpe?g|gif|svg|webp|ico)$/i.test(filename);
}

/**
 * Check if file is a font
 */
function isFontFile(filename) {
  return /\.(woff2?|eot|ttf|otf)$/i.test(filename);
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Generate detailed report
 */
function generateReport(analysis) {
  console.log('📈 Bundle Analysis Report');
  console.log('='.repeat(50));
  
  // Summary
  console.log('\n📊 Summary:');
  console.log(`Total Size: ${formatBytes(analysis.summary.totalSize)}`);
  console.log(`JavaScript: ${formatBytes(analysis.summary.jsSize)} (${analysis.summary.chunkCount} chunks)`);
  console.log(`CSS: ${formatBytes(analysis.summary.cssSize)}`);
  console.log(`Images: ${formatBytes(analysis.summary.imageSize)}`);
  console.log(`Fonts: ${formatBytes(analysis.summary.fontSize)}`);
  console.log(`Other: ${formatBytes(analysis.summary.otherSize)}`);
  
  // JavaScript chunks
  console.log('\n🧩 JavaScript Chunks (by size):');
  const maxNameLength = Math.max(...analysis.chunks.map(chunk => chunk.chunkName.length));
  
  analysis.chunks.forEach((chunk, index) => {
    const indicator = chunk.isEntry ? '📦' : chunk.isVendor ? '📚' : '🔧';
    const nameFormatted = chunk.chunkName.padEnd(maxNameLength);
    const percentage = ((chunk.size / analysis.summary.jsSize) * 100).toFixed(1);
    
    console.log(`  ${indicator} ${nameFormatted} ${chunk.sizeFormatted.padStart(10)} (${percentage}%)`);
  });
  
  // Large assets
  const largeAssets = analysis.assets.filter(asset => asset.size > 100 * 1024); // > 100KB
  if (largeAssets.length > 0) {
    console.log('\n🐘 Large Assets (>100KB):');
    largeAssets.slice(0, 10).forEach(asset => {
      console.log(`  📄 ${asset.name} - ${asset.sizeFormatted} (${asset.type})`);
    });
  }
  
  // Performance recommendations
  console.log('\n💡 Recommendations:');
  
  if (analysis.summary.jsSize > 500 * 1024) {
    console.log('  ⚠️  Large JavaScript bundle size. Consider code splitting.');
  }
  
  const vendorChunks = analysis.chunks.filter(chunk => chunk.isVendor);
  const totalVendorSize = vendorChunks.reduce((sum, chunk) => sum + chunk.size, 0);
  if (totalVendorSize > 300 * 1024) {
    console.log('  📚 Large vendor bundle. Consider separating large libraries.');
  }
  
  const threeChunk = analysis.chunks.find(chunk => chunk.chunkName.includes('three'));
  if (threeChunk && threeChunk.size > 500 * 1024) {
    console.log('  🎮 Large Three.js bundle. Consider tree-shaking unused features.');
  }
  
  if (analysis.summary.imageSize > 1024 * 1024) {
    console.log('  🖼️  Large images detected. Consider optimization and WebP format.');
  }
  
  console.log('  ✅ Use lazy loading for non-critical components');
  console.log('  ✅ Enable compression (gzip/brotli) on your server');
  console.log('  ✅ Consider preloading critical chunks');
}

/**
 * Check for potential performance issues
 */
function checkForIssues(analysis) {
  const issues = [];
  
  // Check for overly large chunks
  analysis.chunks.forEach(chunk => {
    if (chunk.size > 1024 * 1024) { // > 1MB
      issues.push({
        severity: 'high',
        type: 'large-chunk',
        message: `Chunk "${chunk.chunkName}" is very large (${chunk.sizeFormatted})`
      });
    }
  });
  
  // Check for many small chunks
  const smallChunks = analysis.chunks.filter(chunk => chunk.size < 10 * 1024); // < 10KB
  if (smallChunks.length > 10) {
    issues.push({
      severity: 'medium',
      type: 'many-small-chunks',
      message: `${smallChunks.length} very small chunks detected. Consider bundling.`
    });
  }
  
  // Check total bundle size
  if (analysis.summary.totalSize > 3 * 1024 * 1024) { // > 3MB
    issues.push({
      severity: 'high',
      type: 'large-total-size',
      message: `Total bundle size is very large (${formatBytes(analysis.summary.totalSize)})`
    });
  }
  
  if (issues.length > 0) {
    console.log('\n⚠️  Potential Issues:');
    issues.forEach(issue => {
      const icon = issue.severity === 'high' ? '🔴' : '🟡';
      console.log(`  ${icon} ${issue.message}`);
    });
  }
  
  // Save detailed report to file
  const reportPath = join(projectRoot, 'bundle-analysis.json');
  const detailedReport = {
    ...analysis,
    issues,
    generated: new Date().toISOString()
  };
  
  writeFileSync(reportPath, JSON.stringify(detailedReport, null, 2));
  console.log(`\n📋 Detailed report saved to: bundle-analysis.json`);
}

/**
 * Compare with previous analysis
 */
function compareWithPrevious(currentAnalysis) {
  const previousReportPath = join(projectRoot, 'bundle-analysis-previous.json');
  
  if (existsSync(previousReportPath)) {
    try {
      const previousAnalysis = JSON.parse(readFileSync(previousReportPath, 'utf8'));
      
      console.log('\n📊 Comparison with Previous Build:');
      
      const sizeDiff = currentAnalysis.summary.totalSize - previousAnalysis.summary.totalSize;
      const percentChange = ((sizeDiff / previousAnalysis.summary.totalSize) * 100).toFixed(2);
      
      const icon = sizeDiff > 0 ? '📈' : sizeDiff < 0 ? '📉' : '➡️';
      const sign = sizeDiff > 0 ? '+' : '';
      
      console.log(`  ${icon} Total Size: ${sign}${formatBytes(Math.abs(sizeDiff))} (${sign}${percentChange}%)`);
      
      // Compare chunks
      const newChunks = currentAnalysis.chunks.filter(chunk => 
        !previousAnalysis.chunks.some(prev => prev.chunkName === chunk.chunkName)
      );
      
      if (newChunks.length > 0) {
        console.log(`  ➕ New Chunks: ${newChunks.map(c => c.chunkName).join(', ')}`);
      }
      
    } catch (error) {
      console.warn('⚠️  Could not compare with previous build:', error.message);
    }
  }
  
  // Save current as previous for next comparison
  const currentReportPath = join(projectRoot, 'bundle-analysis.json');
  if (existsSync(currentReportPath)) {
    const currentReport = readFileSync(currentReportPath, 'utf8');
    writeFileSync(previousReportPath, currentReport);
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  analyzeBuildOutput();
}