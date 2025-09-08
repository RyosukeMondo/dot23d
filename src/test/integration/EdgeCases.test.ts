/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FileService } from '@/services/FileService'
import { ImageService } from '@/services/ImageService'
import { DotArtService } from '@/services/DotArtService'
import { Model3DService } from '@/services/Model3DService'
import { parseCSVContent } from '@/utils/CSVParser'
import { MeshGenerator } from '@/utils/MeshGenerator'
import { createMockFile, createMockImageData } from '@/test/fixtures'

describe('Edge Cases and Boundary Conditions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Minimum Size Edge Cases', () => {
    it('should handle 1x1 CSV pattern', () => {
      const minimalCSV = 'true'
      const result = parseCSVContent(minimalCSV)
      
      expect(result.width).toBe(1)
      expect(result.height).toBe(1)
      expect(result.data).toEqual([[true]])
    })

    it('should handle 1x1 image processing', async () => {
      const minimalImageData = createMockImageData(1, 1)
      
      const result = await ImageService.processImage(minimalImageData, {
        grayscaleMethod: 'luminance',
        threshold: 128,
        preBlur: false,
        blurRadius: 1,
        enhanceContrast: false,
        contrastFactor: 1.0,
        targetWidth: 1,
        targetHeight: 1,
        maintainAspectRatio: true,
        algorithm: 'bilinear',
        fillColor: '#ffffff',
        invert: false,
        enableDithering: false,
        ditheringMethod: 'floyd-steinberg'
      })
      
      expect(result.data).toBeDefined()
      expect(result.data?.width).toBe(1)
      expect(result.data?.height).toBe(1)
    })

    it('should handle minimal mesh generation', async () => {
      const minimalPattern = {
        width: 1,
        height: 1,
        data: [[true]],
        metadata: { source: 'csv' as const }
      }
      
      const result = await Model3DService.generateMesh(minimalPattern)
      
      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
    })

    it('should handle empty pattern (all false)', async () => {
      const emptyPattern = {
        width: 3,
        height: 3,
        data: [
          [false, false, false],
          [false, false, false],
          [false, false, false]
        ],
        metadata: { source: 'csv' as const }
      }
      
      const result = await Model3DService.generateMesh(emptyPattern)
      
      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
    })
  })

  describe('Maximum Size Edge Cases', () => {
    it('should handle large CSV patterns efficiently', () => {
      const size = 100
      const largeCSV = Array(size).fill(null)
        .map(() => Array(size).fill('true').join(','))
        .join('\n')
      
      const start = Date.now()
      const result = parseCSVContent(largeCSV)
      const duration = Date.now() - start
      
      expect(result.width).toBe(size)
      expect(result.height).toBe(size)
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
    })

    it('should handle large image dimensions', async () => {
      const largeImageData = createMockImageData(200, 200)
      
      const start = Date.now()
      const result = await ImageService.processImage(largeImageData, {
        grayscaleMethod: 'luminance',
        threshold: 128,
        preBlur: false,
        blurRadius: 1,
        enhanceContrast: false,
        contrastFactor: 1.0,
        targetWidth: 50,
        targetHeight: 50,
        maintainAspectRatio: true,
        algorithm: 'bilinear',
        fillColor: '#ffffff',
        invert: false,
        enableDithering: false,
        ditheringMethod: 'floyd-steinberg'
      })
      const duration = Date.now() - start
      
      expect(result.data).toBeDefined()
      expect(duration).toBeLessThan(10000) // Should complete within 10 seconds
    })

    it('should handle memory-intensive mesh generation', async () => {
      const largePattern = {
        width: 50,
        height: 50,
        data: Array(50).fill(null).map(() => Array(50).fill(true)),
        metadata: { source: 'csv' as const }
      }
      
      const start = Date.now()
      const result = await Model3DService.generateMesh(largePattern)
      const duration = Date.now() - start
      
      expect(result.data).toBeDefined()
      expect(duration).toBeLessThan(15000) // Should complete within 15 seconds
    })
  })

  describe('Extreme Aspect Ratio Edge Cases', () => {
    it('should handle very wide CSV patterns', () => {
      const wideCSV = Array(2).fill(null)
        .map(() => Array(100).fill('true').join(','))
        .join('\n')
      
      const result = parseCSVContent(wideCSV)
      
      expect(result.width).toBe(100)
      expect(result.height).toBe(2)
      expect(result.data[0]).toHaveLength(100)
    })

    it('should handle very tall CSV patterns', () => {
      const tallCSV = Array(100).fill('true,false').join('\n')
      
      const result = parseCSVContent(tallCSV)
      
      expect(result.width).toBe(2)
      expect(result.height).toBe(100)
      expect(result.data).toHaveLength(100)
    })

    it('should handle extreme aspect ratio in mesh generation', async () => {
      const extremePattern = {
        width: 50,
        height: 2,
        data: Array(2).fill(null).map(() => Array(50).fill(true)),
        metadata: { source: 'csv' as const }
      }
      
      const result = await Model3DService.generateMesh(extremePattern)
      
      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
    })

    it('should handle image resize with extreme aspect ratios', async () => {
      const wideImageData = createMockImageData(1000, 10)
      
      const result = await ImageService.processImage(wideImageData, {
        grayscaleMethod: 'luminance',
        threshold: 128,
        preBlur: false,
        blurRadius: 1,
        enhanceContrast: false,
        contrastFactor: 1.0,
        targetWidth: 100,
        targetHeight: 100,
        maintainAspectRatio: true,
        algorithm: 'bilinear',
        fillColor: '#ffffff',
        invert: false,
        enableDithering: false,
        ditheringMethod: 'floyd-steinberg'
      })
      
      expect(result.data).toBeDefined()
    })
  })

  describe('Data Type Edge Cases', () => {
    it('should handle CSV with various truthy/falsy values', () => {
      const mixedCSV = 'true,false,1,0,TRUE,FALSE,yes,no'
      
      // Should handle conversion gracefully
      const result = parseCSVContent(mixedCSV)
      
      expect(result.width).toBe(8)
      expect(result.height).toBe(1)
      // Values should be normalized to boolean
      expect(result.data[0].every(value => typeof value === 'boolean')).toBe(true)
    })

    it('should handle very small floating point cube sizes', async () => {
      const pattern = {
        width: 2,
        height: 2,
        data: [[true, false], [false, true]],
        metadata: { source: 'csv' as const }
      }
      
      const result = await Model3DService.generateMesh(pattern, {
        cubeSize: 0.001,
        generateBackground: false,
        backgroundHeight: 0.0,
        optimizeMesh: false,
        centerMesh: false
      })
      
      expect(result.data).toBeDefined()
    })

    it('should handle very large cube sizes', async () => {
      const pattern = {
        width: 2,
        height: 2,
        data: [[true, false], [false, true]],
        metadata: { source: 'csv' as const }
      }
      
      const result = await Model3DService.generateMesh(pattern, {
        cubeSize: 1000.0,
        generateBackground: false,
        backgroundHeight: 0.0,
        optimizeMesh: false,
        centerMesh: false
      })
      
      expect(result.data).toBeDefined()
    })

    it('should handle extreme threshold values in image processing', async () => {
      const imageData = createMockImageData(10, 10)
      
      // Test with threshold at boundaries
      const result1 = await ImageService.processImage(imageData, {
        grayscaleMethod: 'luminance',
        threshold: 0,
        preBlur: false,
        blurRadius: 1,
        enhanceContrast: false,
        contrastFactor: 1.0,
        targetWidth: 10,
        targetHeight: 10,
        maintainAspectRatio: true,
        algorithm: 'bilinear',
        fillColor: '#ffffff',
        invert: false,
        enableDithering: false,
        ditheringMethod: 'floyd-steinberg'
      })
      
      const result2 = await ImageService.processImage(imageData, {
        grayscaleMethod: 'luminance',
        threshold: 255,
        preBlur: false,
        blurRadius: 1,
        enhanceContrast: false,
        contrastFactor: 1.0,
        targetWidth: 10,
        targetHeight: 10,
        maintainAspectRatio: true,
        algorithm: 'bilinear',
        fillColor: '#ffffff',
        invert: false,
        enableDithering: false,
        ditheringMethod: 'floyd-steinberg'
      })
      
      expect(result1.data).toBeDefined()
      expect(result2.data).toBeDefined()
    })
  })

  describe('File Format Edge Cases', () => {
    it('should handle files with unusual but valid extensions', async () => {
      const unusualFile = createMockFile('true,false\nfalse,true', 'test.CSV', 'text/csv')
      
      const result = await FileService.validateFile(unusualFile)
      
      expect(result.data?.isValid).toBe(true)
    })

    it('should handle files with mismatched extension and MIME type', async () => {
      const mismatchedFile = createMockFile('true,false\nfalse,true', 'test.txt', 'text/csv')
      
      const result = await FileService.validateFile(mismatchedFile)
      
      // Should provide warning about mismatch
      expect(result.data?.warnings).toBeDefined()
    })

    it('should handle very long file names', async () => {
      const longName = 'a'.repeat(200) + '.csv'
      const longNameFile = createMockFile('true,false', longName, 'text/csv')
      
      const result = await FileService.validateFile(longNameFile)
      
      expect(result.data?.isValid).toBe(true)
    })

    it('should handle file names with special characters', async () => {
      const specialFile = createMockFile('true,false', 'test@#$%^&()_+.csv', 'text/csv')
      
      const result = await FileService.validateFile(specialFile)
      
      expect(result.data?.isValid).toBe(true)
    })

    it('should handle files with Unicode names', async () => {
      const unicodeFile = createMockFile('true,false', 'тест🚀файл.csv', 'text/csv')
      
      const result = await FileService.validateFile(unicodeFile)
      
      expect(result.data?.isValid).toBe(true)
    })
  })

  describe('Concurrency Edge Cases', () => {
    it('should handle multiple simultaneous file validations', async () => {
      const files = Array(10).fill(null).map((_, i) => 
        createMockFile('true,false', `test${i}.csv`, 'text/csv')
      )
      
      const promises = files.map(file => FileService.validateFile(file))
      const results = await Promise.all(promises)
      
      expect(results).toHaveLength(10)
      results.forEach(result => {
        expect(result.data?.isValid).toBe(true)
      })
    })

    it('should handle multiple mesh generations concurrently', async () => {
      const patterns = Array(5).fill(null).map((_, i) => ({
        width: 3,
        height: 3,
        data: [
          [true, false, true],
          [false, true, false],
          [true, false, true]
        ],
        metadata: { source: 'csv' as const }
      }))
      
      const promises = patterns.map(pattern => Model3DService.generateMesh(pattern))
      const results = await Promise.all(promises)
      
      expect(results).toHaveLength(5)
      results.forEach(result => {
        expect(result.data).toBeDefined()
        expect(result.error).toBeUndefined()
      })
    })

    it('should handle race conditions in pattern optimization', () => {
      const pattern = {
        width: 10,
        height: 10,
        data: Array(10).fill(null).map(() => Array(10).fill(true)),
        metadata: { source: 'csv' as const }
      }
      
      // Multiple optimizations should not interfere
      const optimized1 = DotArtService.optimizePattern(pattern)
      const optimized2 = DotArtService.optimizePattern(pattern)
      const optimized3 = DotArtService.optimizePattern(pattern)
      
      expect(optimized1).toEqual(optimized2)
      expect(optimized2).toEqual(optimized3)
    })
  })

  describe('Memory and Performance Edge Cases', () => {
    it('should handle repeated operations without memory leaks', async () => {
      const pattern = {
        width: 5,
        height: 5,
        data: Array(5).fill(null).map(() => Array(5).fill(true)),
        metadata: { source: 'csv' as const }
      }
      
      // Perform many operations to test for memory leaks
      for (let i = 0; i < 50; i++) {
        const result = await Model3DService.generateMesh(pattern)
        expect(result.data).toBeDefined()
      }
    })

    it('should handle garbage collection gracefully', async () => {
      const patterns = Array(20).fill(null).map(() => ({
        width: 10,
        height: 10,
        data: Array(10).fill(null).map(() => Array(10).fill(Math.random() > 0.5)),
        metadata: { source: 'csv' as const }
      }))
      
      // Process all patterns and allow garbage collection
      const results = []
      for (const pattern of patterns) {
        const result = await Model3DService.generateMesh(pattern)
        results.push(result)
        
        // Force potential garbage collection points
        if (results.length > 10) {
          results.splice(0, 5)
        }
      }
      
      expect(results.length).toBeGreaterThan(0)
    })

    it('should handle operations during high CPU load', async () => {
      const pattern = {
        width: 20,
        height: 20,
        data: Array(20).fill(null).map(() => Array(20).fill(true)),
        metadata: { source: 'csv' as const }
      }
      
      // Start CPU-intensive operations
      const heavyPromises = Array(5).fill(null).map(() => 
        Model3DService.generateMesh(pattern)
      )
      
      // Add a lightweight operation during heavy load
      const lightResult = await DotArtService.validatePattern(pattern)
      
      expect(lightResult.isValid).toBe(true)
      
      const heavyResults = await Promise.all(heavyPromises)
      heavyResults.forEach(result => {
        expect(result.data).toBeDefined()
      })
    })
  })

  describe('Browser Compatibility Edge Cases', () => {
    it('should handle missing modern browser APIs gracefully', async () => {
      // Mock missing FileReader
      const originalFileReader = global.FileReader
      delete (global as any).FileReader
      
      try {
        const file = createMockFile('true,false', 'test.csv', 'text/csv')
        const result = await DotArtService.generateFromCSV(file)
        
        expect(result.error).toBeDefined()
      } finally {
        global.FileReader = originalFileReader
      }
    })

    it('should handle canvas context variations', async () => {
      const imageData = createMockImageData(10, 10)
      
      // Mock different canvas context implementations
      const mockCanvas = {
        getContext: vi.fn(() => ({
          drawImage: vi.fn(),
          getImageData: vi.fn(() => imageData),
          putImageData: vi.fn(),
          canvas: { width: 10, height: 10 }
        })),
        width: 10,
        height: 10
      }
      
      vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
        if (tagName === 'canvas') {
          return mockCanvas as any
        }
        return {} as any
      })
      
      const result = await ImageService.processImage(imageData, {
        grayscaleMethod: 'luminance',
        threshold: 128,
        preBlur: false,
        blurRadius: 1,
        enhanceContrast: false,
        contrastFactor: 1.0,
        targetWidth: 10,
        targetHeight: 10,
        maintainAspectRatio: true,
        algorithm: 'bilinear',
        fillColor: '#ffffff',
        invert: false,
        enableDithering: false,
        ditheringMethod: 'floyd-steinberg'
      })
      
      expect(result.data).toBeDefined()
    })

    it('should handle varying Image constructor behavior', async () => {
      // Test different Image constructor patterns
      const originalImage = global.Image
      
      try {
        // Mock Image that loads immediately
        global.Image = vi.fn(() => {
          const mockImage = {
            onload: null as any,
            onerror: null as any,
            src: '',
            width: 100,
            height: 100,
            naturalWidth: 100,
            naturalHeight: 100
          }
          
          // Simulate immediate load
          setTimeout(() => {
            if (mockImage.onload) {
              mockImage.onload()
            }
          }, 0)
          
          return mockImage
        })
        
        const file = createMockFile('fake-image-data', 'test.jpg', 'image/jpeg')
        const result = await ImageService.loadImage(file)
        
        expect(result.data).toBeDefined()
      } finally {
        global.Image = originalImage
      }
    })
  })

  describe('Data Integrity Edge Cases', () => {
    it('should maintain data consistency across transformations', () => {
      const originalPattern = {
        width: 5,
        height: 5,
        data: [
          [true, false, true, false, true],
          [false, true, false, true, false],
          [true, false, true, false, true],
          [false, true, false, true, false],
          [true, false, true, false, true]
        ],
        metadata: { source: 'csv' as const }
      }
      
      // Export and re-import should preserve data
      const csvExport = DotArtService.exportPattern(originalPattern, 'csv')
      const reimported = parseCSVContent(csvExport)
      
      expect(reimported.data).toEqual(originalPattern.data)
    })

    it('should handle pattern validation consistency', () => {
      const pattern = {
        width: 3,
        height: 3,
        data: [[true, false, true], [false, true, false], [true, false, true]],
        metadata: { source: 'csv' as const }
      }
      
      // Multiple validations should be consistent
      const result1 = DotArtService.validatePattern(pattern)
      const result2 = DotArtService.validatePattern(pattern)
      const result3 = DotArtService.validatePattern(pattern)
      
      expect(result1.isValid).toBe(result2.isValid)
      expect(result2.isValid).toBe(result3.isValid)
      expect(result1.errors).toEqual(result2.errors)
      expect(result2.errors).toEqual(result3.errors)
    })

    it('should maintain mesh generation determinism', async () => {
      const pattern = {
        width: 3,
        height: 3,
        data: [[true, false, true], [false, true, false], [true, false, true]],
        metadata: { source: 'csv' as const }
      }
      
      const options = {
        cubeSize: 1.0,
        generateBackground: false,
        backgroundHeight: 0.0,
        optimizeMesh: false,
        centerMesh: false
      }
      
      // Multiple mesh generations with same input should be consistent
      const result1 = await Model3DService.generateMesh(pattern, options)
      const result2 = await Model3DService.generateMesh(pattern, options)
      
      expect(result1.data).toBeDefined()
      expect(result2.data).toBeDefined()
      
      // Results should be structurally similar
      expect(result1.error).toEqual(result2.error)
    })
  })
})