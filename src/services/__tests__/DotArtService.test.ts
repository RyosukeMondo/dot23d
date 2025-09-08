/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DotArtService } from '../DotArtService'
import { sampleDotPatterns, sampleFiles, createMockFile } from '@/test/fixtures'

describe('DotArtService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateFromCSV', () => {
    let mockFileReader: any

    beforeEach(() => {
      mockFileReader = {
        readAsText: vi.fn(),
        onload: null,
        onerror: null,
        result: null
      }
      global.FileReader = vi.fn(() => mockFileReader)
    })

    it('should generate dot pattern from valid CSV file', async () => {
      const file = sampleFiles.validCSV
      const csvContent = 'true,false,true\nfalse,true,false\ntrue,true,false'
      mockFileReader.result = csvContent

      const generatePromise = DotArtService.generateFromCSV(file)
      
      // Simulate FileReader onload
      setTimeout(() => {
        mockFileReader.onload({ target: { result: csvContent } })
      }, 0)

      const result = await generatePromise
      
      expect(result.data).toBeDefined()
      expect(result.data?.width).toBe(3)
      expect(result.data?.height).toBe(3)
      expect(result.data?.data).toEqual([
        [true, false, true],
        [false, true, false],
        [true, true, false]
      ])
      expect(result.data?.metadata.source).toBe('csv')
      expect(result.error).toBeUndefined()
    })

    it('should handle FileReader error', async () => {
      const file = sampleFiles.validCSV
      
      const generatePromise = DotArtService.generateFromCSV(file)
      
      // Simulate FileReader error
      setTimeout(() => {
        mockFileReader.onerror(new Error('File read failed'))
      }, 0)

      const result = await generatePromise
      
      expect(result.data).toBeUndefined()
      expect(result.error).toBeDefined()
      expect(result.error.userMessage).toContain('Failed to read CSV file')
    })

    it('should handle invalid CSV content', async () => {
      const file = sampleFiles.invalidCSV
      const invalidContent = 'not,boolean,data\ninvalid,csv,format'
      mockFileReader.result = invalidContent

      const generatePromise = DotArtService.generateFromCSV(file)
      
      // Simulate FileReader onload with invalid content
      setTimeout(() => {
        mockFileReader.onload({ target: { result: invalidContent } })
      }, 0)

      const result = await generatePromise
      
      expect(result.data).toBeUndefined()
      expect(result.error).toBeDefined()
      expect(result.error.userMessage).toContain('Failed to parse CSV')
    })

    it('should handle empty CSV file', async () => {
      const file = sampleFiles.emptyCSV
      mockFileReader.result = ''

      const generatePromise = DotArtService.generateFromCSV(file)
      
      // Simulate FileReader onload with empty content
      setTimeout(() => {
        mockFileReader.onload({ target: { result: '' } })
      }, 0)

      const result = await generatePromise
      
      expect(result.data).toBeUndefined()
      expect(result.error).toBeDefined()
      expect(result.error.userMessage).toContain('Failed to parse CSV')
    })

    it('should handle non-string FileReader result', async () => {
      const file = sampleFiles.validCSV
      mockFileReader.result = new ArrayBuffer(10)

      const generatePromise = DotArtService.generateFromCSV(file)
      
      // Simulate FileReader onload with non-string result
      setTimeout(() => {
        mockFileReader.onload({ target: { result: new ArrayBuffer(10) } })
      }, 0)

      const result = await generatePromise
      
      expect(result.data).toBeUndefined()
      expect(result.error).toBeDefined()
      expect(result.error.userMessage).toContain('Failed to read file as text')
    })
  })

  describe('generateFromImage', () => {
    let mockImage: any
    let mockCanvas: any
    let mockContext: any

    beforeEach(() => {
      // Mock Canvas context
      mockContext = {
        drawImage: vi.fn(),
        getImageData: vi.fn(() => ({
          data: new Uint8ClampedArray(400), // 10x10 image * 4 channels
          width: 10,
          height: 10,
          colorSpace: 'srgb',
        })),
        putImageData: vi.fn(),
        canvas: { width: 10, height: 10 }
      }

      // Mock Canvas
      mockCanvas = {
        getContext: vi.fn(() => mockContext),
        width: 10,
        height: 10
      }

      // Mock document.createElement for canvas
      vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
        if (tagName === 'canvas') {
          return mockCanvas as any
        }
        return {} as any
      })

      // Mock Image constructor
      mockImage = {
        onload: null,
        onerror: null,
        src: '',
        width: 10,
        height: 10,
        naturalWidth: 10,
        naturalHeight: 10
      }
      global.Image = vi.fn(() => mockImage)
    })

    it('should generate dot pattern from valid image file', async () => {
      const file = sampleFiles.validImage
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

      const generatePromise = DotArtService.generateFromImage(file, conversionParams)
      
      // Simulate image load
      setTimeout(() => {
        if (mockImage.onload) {
          mockImage.onload()
        }
      }, 0)

      const result = await generatePromise
      
      expect(result.data).toBeDefined()
      expect(result.data?.width).toBe(10)
      expect(result.data?.height).toBe(10)
      expect(result.data?.data).toBeDefined()
      expect(result.data?.metadata.source).toBe('image')
      expect(result.data?.metadata.conversionParams).toEqual(conversionParams)
      expect(result.error).toBeUndefined()
    })

    it('should handle image load failure', async () => {
      const file = sampleFiles.invalidImage
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
      
      const generatePromise = DotArtService.generateFromImage(file, conversionParams)
      
      // Simulate image error
      setTimeout(() => {
        if (mockImage.onerror) {
          mockImage.onerror(new Error('Image load failed'))
        }
      }, 0)

      const result = await generatePromise
      
      expect(result.data).toBeUndefined()
      expect(result.error).toBeDefined()
      expect(result.error.userMessage).toContain('Failed to convert image')
    })
  })

  describe('validatePattern', () => {
    it('should validate correct dot pattern', () => {
      const result = DotArtService.validatePattern(sampleDotPatterns.small)
      
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.warnings).toBeDefined()
    })

    it('should validate empty dot pattern', () => {
      const result = DotArtService.validatePattern(sampleDotPatterns.empty)
      
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should validate full dot pattern', () => {
      const result = DotArtService.validatePattern(sampleDotPatterns.full)
      
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should validate large dot pattern with warnings', () => {
      const result = DotArtService.validatePattern(sampleDotPatterns.large)
      
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.warnings).toContain('Large pattern size may impact performance')
    })

    it('should reject pattern with invalid dimensions', () => {
      const invalidPattern = {
        width: -1,
        height: -1,
        data: [],
        metadata: { source: 'csv' as const }
      }
      
      const result = DotArtService.validatePattern(invalidPattern)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Invalid pattern dimensions')
    })

    it('should reject pattern with mismatched data dimensions', () => {
      const mismatchedPattern = {
        width: 3,
        height: 2,
        data: [
          [true, false], // Only 2 columns, but width is 3
          [false, true]
        ],
        metadata: { source: 'csv' as const }
      }
      
      const result = DotArtService.validatePattern(mismatchedPattern)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Pattern data dimensions do not match width/height')
    })

    it('should reject pattern with null or undefined data', () => {
      const nullDataPattern = {
        width: 2,
        height: 2,
        data: null as any,
        metadata: { source: 'csv' as const }
      }
      
      const result = DotArtService.validatePattern(nullDataPattern)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Pattern data is missing or invalid')
    })

    it('should reject pattern with non-boolean data', () => {
      const nonBooleanPattern = {
        width: 2,
        height: 2,
        data: [
          ['true', 'false'], // Strings instead of booleans
          [1, 0] // Numbers instead of booleans
        ] as any,
        metadata: { source: 'csv' as const }
      }
      
      const result = DotArtService.validatePattern(nonBooleanPattern)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Pattern data contains non-boolean values')
    })

    it('should reject pattern exceeding maximum size', () => {
      // Create a pattern that exceeds maximum dimensions
      const largeData = Array(1001).fill(null).map(() => Array(1001).fill(true))
      const oversizedPattern = {
        width: 1001,
        height: 1001,
        data: largeData,
        metadata: { source: 'csv' as const }
      }
      
      const result = DotArtService.validatePattern(oversizedPattern)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Pattern exceeds maximum dimensions')
    })
  })

  describe('optimizePattern', () => {
    it('should optimize pattern by removing empty rows and columns', () => {
      const patternWithEmptyBorders = {
        width: 5,
        height: 5,
        data: [
          [false, false, false, false, false],
          [false, true, false, true, false],
          [false, false, true, false, false],
          [false, true, false, true, false],
          [false, false, false, false, false]
        ],
        metadata: { source: 'csv' as const }
      }
      
      const result = DotArtService.optimizePattern(patternWithEmptyBorders)
      
      expect(result.width).toBe(3) // Removed empty columns
      expect(result.height).toBe(3) // Removed empty rows
      expect(result.data).toEqual([
        [true, false, true],
        [false, true, false],
        [true, false, true]
      ])
    })

    it('should return original pattern if no optimization possible', () => {
      const result = DotArtService.optimizePattern(sampleDotPatterns.small)
      
      expect(result.width).toBe(sampleDotPatterns.small.width)
      expect(result.height).toBe(sampleDotPatterns.small.height)
      expect(result.data).toEqual(sampleDotPatterns.small.data)
    })

    it('should handle completely empty pattern', () => {
      const result = DotArtService.optimizePattern(sampleDotPatterns.empty)
      
      expect(result.width).toBe(2) // Minimum size maintained
      expect(result.height).toBe(2)
      expect(result.data).toEqual([[false, false], [false, false]])
    })

    it('should preserve metadata during optimization', () => {
      const result = DotArtService.optimizePattern(sampleDotPatterns.large)
      
      expect(result.metadata).toEqual(sampleDotPatterns.large.metadata)
    })
  })

  describe('exportPattern', () => {
    it('should export pattern as CSV string', () => {
      const result = DotArtService.exportPattern(sampleDotPatterns.small, 'csv')
      
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      expect(result).toContain('true')
      expect(result).toContain('false')
      expect(result).toContain(',') // CSV delimiter
      expect(result).toContain('\n') // Row separator
    })

    it('should export pattern as JSON string', () => {
      const result = DotArtService.exportPattern(sampleDotPatterns.small, 'json')
      
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      
      // Verify it's valid JSON
      const parsed = JSON.parse(result)
      expect(parsed.width).toBe(sampleDotPatterns.small.width)
      expect(parsed.height).toBe(sampleDotPatterns.small.height)
      expect(parsed.data).toEqual(sampleDotPatterns.small.data)
      expect(parsed.metadata).toEqual(sampleDotPatterns.small.metadata)
    })

    it('should handle unsupported export format', () => {
      expect(() => {
        DotArtService.exportPattern(sampleDotPatterns.small, 'xml' as any)
      }).toThrow('Unsupported export format')
    })

    it('should export large pattern correctly', () => {
      const csvResult = DotArtService.exportPattern(sampleDotPatterns.large, 'csv')
      const jsonResult = DotArtService.exportPattern(sampleDotPatterns.large, 'json')
      
      expect(csvResult).toBeDefined()
      expect(jsonResult).toBeDefined()
      
      const parsed = JSON.parse(jsonResult)
      expect(parsed.width).toBe(sampleDotPatterns.large.width)
      expect(parsed.height).toBe(sampleDotPatterns.large.height)
    })
  })

  describe('error handling', () => {
    it('should handle null pattern gracefully', () => {
      expect(() => {
        DotArtService.validatePattern(null as any)
      }).toThrow('Invalid pattern provided')
    })

    it('should handle undefined pattern gracefully', () => {
      expect(() => {
        DotArtService.optimizePattern(undefined as any)
      }).toThrow('Invalid pattern provided')
    })

    it('should handle malformed pattern structure', () => {
      const malformedPattern = {
        width: 2,
        // missing height
        data: [[true, false]],
        metadata: { source: 'csv' as const }
      } as any
      
      const result = DotArtService.validatePattern(malformedPattern)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Invalid pattern structure')
    })

    it('should provide meaningful error messages', () => {
      const invalidPattern = {
        width: 0,
        height: 0,
        data: [],
        metadata: { source: 'csv' as const }
      }
      
      const result = DotArtService.validatePattern(invalidPattern)
      
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.every(error => typeof error === 'string')).toBe(true)
    })
  })

  describe('performance', () => {
    it('should handle large pattern validation efficiently', () => {
      const start = Date.now()
      
      DotArtService.validatePattern(sampleDotPatterns.large)
      
      const duration = Date.now() - start
      expect(duration).toBeLessThan(1000) // Should complete within 1 second
    })

    it('should handle large pattern optimization efficiently', () => {
      const start = Date.now()
      
      DotArtService.optimizePattern(sampleDotPatterns.large)
      
      const duration = Date.now() - start
      expect(duration).toBeLessThan(2000) // Should complete within 2 seconds
    })

    it('should handle large pattern export efficiently', () => {
      const start = Date.now()
      
      DotArtService.exportPattern(sampleDotPatterns.large, 'csv')
      
      const duration = Date.now() - start
      expect(duration).toBeLessThan(1000) // Should complete within 1 second
    })
  })
})