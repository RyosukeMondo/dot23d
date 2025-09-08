/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FileService } from '@/services/FileService'
import { ImageService } from '@/services/ImageService'
import { DotArtService } from '@/services/DotArtService'
import { Model3DService } from '@/services/Model3DService'
import { parseCSVContent, CSVParseError } from '@/utils/CSVParser'
import { ImageConverter, ImageProcessingError } from '@/utils/ImageConverter'
import { MeshGenerator } from '@/utils/MeshGenerator'
import { createMockFile, createMockImageData } from '@/test/fixtures'

describe('Error Handling Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('File Service Error Scenarios', () => {
    it('should handle null file validation gracefully', async () => {
      const result = await FileService.validateFile(null as any)
      
      expect(result.error).toBeDefined()
      expect(result.error.userMessage).toContain('Invalid file')
      expect(result.data).toBeUndefined()
    })

    it('should handle undefined file validation gracefully', async () => {
      const result = await FileService.validateFile(undefined as any)
      
      expect(result.error).toBeDefined()
      expect(result.error.userMessage).toContain('Invalid file')
      expect(result.data).toBeUndefined()
    })

    it('should handle file with corrupted properties', async () => {
      const corruptedFile = {
        name: null,
        type: undefined,
        size: 'invalid',
        lastModified: 'not-a-date'
      } as any

      const result = await FileService.validateFile(corruptedFile)
      
      expect(result.error).toBeDefined()
      expect(result.error.userMessage).toBeDefined()
    })

    it('should handle extremely large file sizes', async () => {
      const hugeFile = createMockFile('content', 'huge.csv', 'text/csv', Number.MAX_SAFE_INTEGER)
      
      const result = await FileService.validateFile(hugeFile, {
        maxSizeBytes: 1024 * 1024 // 1MB limit
      })
      
      expect(result.data?.isValid).toBe(false)
      expect(result.data?.errors).toContain('File size exceeds maximum allowed size')
    })

    it('should handle file with no extension', async () => {
      const noExtFile = createMockFile('content', 'filename', 'text/plain')
      
      const result = await FileService.validateFile(noExtFile)
      
      expect(result.data?.isValid).toBe(false)
      expect(result.data?.errors).toContain('File has no extension')
    })

    it('should handle file with multiple dots in name', async () => {
      const complexName = createMockFile('content', 'file.name.with.dots.csv', 'text/csv')
      
      const result = await FileService.validateFile(complexName)
      
      expect(result.data?.isValid).toBe(true)
    })

    it('should handle empty file gracefully', async () => {
      const emptyFile = createMockFile('', 'empty.csv', 'text/csv', 0)
      
      const result = await FileService.validateFile(emptyFile)
      
      expect(result.data?.isValid).toBe(false)
      expect(result.data?.errors).toContain('File appears to be empty')
    })
  })

  describe('CSV Parser Error Scenarios', () => {
    it('should handle completely empty CSV content', () => {
      expect(() => parseCSVContent('')).toThrow(CSVParseError)
    })

    it('should handle CSV with only whitespace', () => {
      expect(() => parseCSVContent('   \n\n  \t  ')).toThrow(CSVParseError)
    })

    it('should handle CSV with inconsistent row lengths', () => {
      const inconsistentCSV = 'true,false,true\nfalse,true\ntrue'
      expect(() => parseCSVContent(inconsistentCSV)).toThrow(CSVParseError)
    })

    it('should handle CSV with invalid boolean values', () => {
      const invalidCSV = 'true,false,maybe\nyes,no,perhaps'
      expect(() => parseCSVContent(invalidCSV)).toThrow(CSVParseError)
    })

    it('should handle CSV with non-ASCII characters', () => {
      const nonAsciiCSV = 'true,false,true\nfalse,🙂,false'
      expect(() => parseCSVContent(nonAsciiCSV)).toThrow(CSVParseError)
    })

    it('should handle extremely large CSV patterns', () => {
      // Create a CSV that exceeds reasonable limits
      const hugeRow = Array(10000).fill('true').join(',')
      const hugeCSV = Array(1000).fill(hugeRow).join('\n')
      
      expect(() => parseCSVContent(hugeCSV, {
        maxDimensions: { width: 100, height: 100 }
      })).toThrow(CSVParseError)
    })

    it('should handle CSV with mixed quote styles', () => {
      const mixedQuotes = '"true",\'false\',"true"\n"false","true","false"'
      expect(() => parseCSVContent(mixedQuotes)).toThrow(CSVParseError)
    })

    it('should handle CSV with embedded newlines in quotes', () => {
      const embeddedNewlines = '"true\nvalue","false","true"\n"false","true","false"'
      expect(() => parseCSVContent(embeddedNewlines)).toThrow(CSVParseError)
    })
  })

  describe('Image Service Error Scenarios', () => {
    it('should handle null file in loadImage', async () => {
      const result = await ImageService.loadImage(null as any)
      
      expect(result.error).toBeDefined()
      expect(result.error.userMessage).toContain('Invalid file')
    })

    it('should handle file that is not actually an image', async () => {
      const fakeImageFile = createMockFile('not an image', 'fake.jpg', 'image/jpeg')
      
      // Mock Image constructor to simulate load failure
      const mockImage = {
        onload: null as any,
        onerror: null as any,
        src: ''
      }
      global.Image = vi.fn(() => mockImage)

      const loadPromise = ImageService.loadImage(fakeImageFile)
      
      // Simulate image load error
      setTimeout(() => {
        if (mockImage.onerror) {
          mockImage.onerror(new Error('Failed to load image'))
        }
      }, 0)

      const result = await loadPromise
      
      expect(result.error).toBeDefined()
      expect(result.error.userMessage).toContain('Failed to load image')
    })

    it('should handle invalid conversion parameters', async () => {
      const imageData = createMockImageData(10, 10)
      const invalidParams = {
        grayscaleMethod: 'invalid' as any,
        threshold: -1,
        targetWidth: -100,
        targetHeight: -100,
        contrastFactor: -5,
        blurRadius: -1,
        preBlur: false,
        enhanceContrast: false,
        maintainAspectRatio: true,
        algorithm: 'invalid' as any,
        fillColor: 'invalid-color',
        invert: false,
        enableDithering: false,
        ditheringMethod: 'invalid' as any
      }

      const result = await ImageService.processImage(imageData, invalidParams)
      
      expect(result.error).toBeDefined()
      expect(result.error.userMessage).toContain('Invalid processing parameters')
    })

    it('should handle canvas context creation failure', async () => {
      const imageData = createMockImageData(10, 10)

      // Mock canvas creation to fail
      vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
        if (tagName === 'canvas') {
          return {
            getContext: () => null // Simulate context creation failure
          } as any
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
      
      expect(result.error).toBeDefined()
      expect(result.error.userMessage).toContain('Canvas context not available')
    })
  })

  describe('Dot Art Service Error Scenarios', () => {
    it('should handle null pattern in validation', () => {
      expect(() => DotArtService.validatePattern(null as any))
        .toThrow('Invalid pattern provided')
    })

    it('should handle pattern with malformed data structure', () => {
      const malformedPattern = {
        width: 2,
        height: 2,
        data: 'not-an-array' as any,
        metadata: { source: 'csv' as const }
      }
      
      const result = DotArtService.validatePattern(malformedPattern)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Pattern data is missing or invalid')
    })

    it('should handle pattern with circular references', () => {
      const circularPattern: any = {
        width: 2,
        height: 2,
        data: [[true, false], [false, true]],
        metadata: { source: 'csv' as const }
      }
      circularPattern.self = circularPattern

      const result = DotArtService.validatePattern(circularPattern)
      
      // Should still validate the core pattern structure
      expect(result.isValid).toBe(true)
    })

    it('should handle extremely large pattern dimensions', () => {
      const oversizedPattern = {
        width: 100000,
        height: 100000,
        data: [], // Empty for performance
        metadata: { source: 'csv' as const }
      }
      
      const result = DotArtService.validatePattern(oversizedPattern)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Pattern exceeds maximum dimensions')
    })

    it('should handle pattern optimization on null pattern', () => {
      expect(() => DotArtService.optimizePattern(null as any))
        .toThrow('Invalid pattern provided')
    })

    it('should handle export with unsupported format', () => {
      const pattern = {
        width: 2,
        height: 2,
        data: [[true, false], [false, true]],
        metadata: { source: 'csv' as const }
      }
      
      expect(() => DotArtService.exportPattern(pattern, 'xml' as any))
        .toThrow('Unsupported export format')
    })
  })

  describe('Model3D Service Error Scenarios', () => {
    it('should handle null pattern in mesh generation', async () => {
      const result = await Model3DService.generateMesh(null as any)
      
      expect(result.error).toBeDefined()
      expect(result.error.userMessage).toContain('Invalid pattern provided')
    })

    it('should handle pattern with invalid data types', async () => {
      const invalidPattern = {
        width: 2,
        height: 2,
        data: [['string', 123], [null, undefined]] as any,
        metadata: { source: 'csv' as const }
      }
      
      const result = await Model3DService.generateMesh(invalidPattern)
      
      expect(result.error).toBeDefined()
    })

    it('should handle mesh generation with invalid options', async () => {
      const pattern = {
        width: 2,
        height: 2,
        data: [[true, false], [false, true]],
        metadata: { source: 'csv' as const }
      }
      
      const invalidOptions = {
        cubeSize: -1,
        generateBackground: true,
        backgroundHeight: -5,
        optimizeMesh: true,
        centerMesh: true
      }
      
      const result = await Model3DService.generateMesh(pattern, invalidOptions)
      
      expect(result.error).toBeDefined()
    })

    it('should handle OBJ export of null geometry', async () => {
      const result = await Model3DService.exportToOBJ(null as any)
      
      expect(result.error).toBeDefined()
      expect(result.error.userMessage).toContain('Failed to export mesh to OBJ')
    })

    it('should handle complexity calculation with invalid pattern', () => {
      const invalidPattern = {
        width: -1,
        height: -1,
        data: null as any,
        metadata: { source: 'csv' as const }
      }
      
      expect(() => Model3DService.calculateMeshComplexity(invalidPattern))
        .toThrow('Invalid pattern provided')
    })

    it('should handle mesh optimization failure', async () => {
      // Create a geometry that will cause optimization to fail
      const invalidGeometry = {
        vertices: null,
        indices: undefined
      } as any
      
      const result = await Model3DService.optimizeMesh(invalidGeometry)
      
      expect(result.error).toBeDefined()
      expect(result.error.userMessage).toContain('Failed to optimize mesh')
    })
  })

  describe('Cross-Service Integration Error Scenarios', () => {
    it('should handle complete workflow failure from CSV', async () => {
      const invalidCSVFile = createMockFile('invalid,csv,data\nwith,wrong,format', 'invalid.csv', 'text/csv')
      
      // Test complete workflow
      const csvResult = await DotArtService.generateFromCSV(invalidCSVFile)
      expect(csvResult.error).toBeDefined()
      
      // Ensure mesh generation would also fail
      if (csvResult.data) {
        const meshResult = await Model3DService.generateMesh(csvResult.data)
        expect(meshResult.error).toBeDefined()
      }
    })

    it('should handle complete workflow failure from image', async () => {
      const invalidImageFile = createMockFile('not-an-image', 'fake.jpg', 'image/jpeg')
      
      // Mock Image to fail
      const mockImage = {
        onload: null as any,
        onerror: null as any
      }
      global.Image = vi.fn(() => mockImage)

      const conversionParams = {
        grayscaleMethod: 'luminance' as const,
        threshold: 128,
        preBlur: false,
        blurRadius: 1,
        enhanceContrast: false,
        contrastFactor: 1.0,
        targetWidth: 10,
        targetHeight: 10,
        maintainAspectRatio: true,
        algorithm: 'bilinear' as const,
        fillColor: '#ffffff',
        invert: false,
        enableDithering: false,
        ditheringMethod: 'floyd-steinberg' as const
      }

      const imagePromise = DotArtService.generateFromImage(invalidImageFile, conversionParams)
      
      // Trigger image error
      setTimeout(() => {
        if (mockImage.onerror) {
          mockImage.onerror(new Error('Failed to load image'))
        }
      }, 0)

      const imageResult = await imagePromise
      expect(imageResult.error).toBeDefined()
    })

    it('should handle memory pressure scenarios', async () => {
      // Simulate memory pressure by creating very large pattern
      const largePattern = {
        width: 1000,
        height: 1000,
        data: Array(1000).fill(null).map(() => Array(1000).fill(true)),
        metadata: { source: 'csv' as const }
      }
      
      // This should either succeed or fail gracefully
      const result = await Model3DService.generateMesh(largePattern)
      
      if (result.error) {
        expect(result.error.userMessage).toBeDefined()
        expect(typeof result.error.userMessage).toBe('string')
      } else {
        expect(result.data).toBeDefined()
      }
    })

    it('should handle concurrent operation conflicts', async () => {
      const pattern = {
        width: 10,
        height: 10,
        data: Array(10).fill(null).map(() => Array(10).fill(true)),
        metadata: { source: 'csv' as const }
      }
      
      // Start multiple operations simultaneously
      const promises = [
        Model3DService.generateMesh(pattern),
        Model3DService.generateMesh(pattern),
        Model3DService.generateMesh(pattern)
      ]
      
      const results = await Promise.all(promises)
      
      // All should either succeed or fail gracefully
      results.forEach(result => {
        if (result.error) {
          expect(result.error.userMessage).toBeDefined()
        } else {
          expect(result.data).toBeDefined()
        }
      })
    })
  })

  describe('Error Recovery Scenarios', () => {
    it('should provide meaningful error messages for all failure modes', async () => {
      const testCases = [
        () => FileService.validateFile(null as any),
        () => ImageService.loadImage(undefined as any),
        () => DotArtService.validatePattern({ width: -1, height: -1, data: null, metadata: { source: 'csv' as const } }),
        () => Model3DService.generateMesh(null as any)
      ]
      
      for (const testCase of testCases) {
        try {
          const result = await testCase()
          if (result && 'error' in result && result.error) {
            expect(result.error.userMessage).toBeDefined()
            expect(typeof result.error.userMessage).toBe('string')
            expect(result.error.userMessage.length).toBeGreaterThan(0)
          }
        } catch (error) {
          expect(error).toBeInstanceOf(Error)
          expect((error as Error).message.length).toBeGreaterThan(0)
        }
      }
    })

    it('should maintain system stability after errors', async () => {
      // Cause various errors
      await FileService.validateFile(null as any).catch(() => {})
      await ImageService.loadImage(undefined as any).catch(() => {})
      try {
        DotArtService.validatePattern(null as any)
      } catch {}
      await Model3DService.generateMesh(null as any).catch(() => {})
      
      // System should still work normally after errors
      const validFile = createMockFile('true,false\nfalse,true', 'test.csv', 'text/csv')
      const result = await FileService.validateFile(validFile)
      
      expect(result.data?.isValid).toBe(true)
    })

    it('should handle error propagation correctly', async () => {
      const invalidFile = createMockFile('', 'empty.csv', 'text/csv', 0)
      
      // Error should propagate from file validation
      const fileResult = await FileService.uploadFile(invalidFile)
      expect(fileResult.error).toBeDefined()
      
      // Subsequent operations should not be attempted with failed file
      if (fileResult.error) {
        expect(fileResult.data).toBeUndefined()
      }
    })
  })
})