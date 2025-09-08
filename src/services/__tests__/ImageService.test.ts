/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ImageService } from '../ImageService'
import { sampleFiles, sampleConversionParams, createMockImageData } from '@/test/fixtures'

describe('ImageService', () => {
  let mockImage: any
  let mockCanvas: any
  let mockContext: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock Canvas context
    mockContext = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => createMockImageData(100, 100, 'checkerboard')),
      putImageData: vi.fn(),
      canvas: { width: 100, height: 100 }
    }

    // Mock Canvas
    mockCanvas = {
      getContext: vi.fn(() => mockContext),
      width: 100,
      height: 100
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
      width: 100,
      height: 100,
      naturalWidth: 100,
      naturalHeight: 100
    }
    global.Image = vi.fn(() => mockImage)
  })

  describe('loadImage', () => {
    it('should load image from file successfully', async () => {
      const file = sampleFiles.validImage
      
      const loadPromise = ImageService.loadImage(file)
      
      // Simulate image load
      setTimeout(() => {
        if (mockImage.onload) {
          mockImage.onload()
        }
      }, 0)

      const result = await loadPromise
      
      expect(result.data).toBeDefined()
      expect(result.data?.width).toBeGreaterThan(0)
      expect(result.data?.height).toBeGreaterThan(0)
      expect(result.error).toBeUndefined()
      expect(mockContext.drawImage).toHaveBeenCalled()
      expect(mockContext.getImageData).toHaveBeenCalled()
    })

    it('should handle image load failure', async () => {
      const file = sampleFiles.invalidImage
      
      const loadPromise = ImageService.loadImage(file)
      
      // Simulate image error
      setTimeout(() => {
        if (mockImage.onerror) {
          mockImage.onerror(new Error('Failed to load image'))
        }
      }, 0)

      const result = await loadPromise
      
      expect(result.data).toBeUndefined()
      expect(result.error).toBeDefined()
      expect(result.error.userMessage).toContain('Failed to load image')
    })

    it('should handle canvas context unavailable', async () => {
      mockCanvas.getContext = vi.fn(() => null)
      
      const result = await ImageService.loadImage(sampleFiles.validImage)
      
      expect(result.error).toBeDefined()
      expect(result.error.userMessage).toContain('Canvas context not available')
    })

    it('should handle file read as data URL failure', async () => {
      const mockFileReader = {
        readAsDataURL: vi.fn(),
        onload: null,
        onerror: null,
        result: null
      }
      global.FileReader = vi.fn(() => mockFileReader)

      const loadPromise = ImageService.loadImage(sampleFiles.validImage)
      
      // Simulate FileReader error
      setTimeout(() => {
        if (mockFileReader.onerror) {
          mockFileReader.onerror(new Error('File read error'))
        }
      }, 0)

      const result = await loadPromise
      
      expect(result.error).toBeDefined()
    })
  })

  describe('processImage', () => {
    it('should process image with default parameters', async () => {
      const imageData = createMockImageData(50, 50, 'checkerboard')
      mockContext.getImageData
        .mockReturnValueOnce(imageData) // grayscale
        .mockReturnValueOnce(imageData) // resize
        .mockReturnValueOnce(imageData) // threshold

      const result = await ImageService.processImage(imageData, sampleConversionParams.default)
      
      expect(result.data).toBeDefined()
      expect(result.data?.width).toBe(50)
      expect(result.data?.height).toBe(50)
      expect(result.error).toBeUndefined()
    })

    it('should apply contrast enhancement when enabled', async () => {
      const imageData = createMockImageData(25, 25)
      const paramsWithContrast = {
        ...sampleConversionParams.default,
        enhanceContrast: true,
        contrastFactor: 2.0
      }
      
      mockContext.getImageData.mockReturnValue(imageData)

      const result = await ImageService.processImage(imageData, paramsWithContrast)
      
      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
    })

    it('should apply blur when preBlur is enabled', async () => {
      const imageData = createMockImageData(25, 25)
      const paramsWithBlur = {
        ...sampleConversionParams.default,
        preBlur: true,
        blurRadius: 2
      }
      
      mockContext.getImageData.mockReturnValue(imageData)

      const result = await ImageService.processImage(imageData, paramsWithBlur)
      
      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
    })

    it('should handle different grayscale methods', async () => {
      const imageData = createMockImageData(10, 10)
      mockContext.getImageData.mockReturnValue(imageData)

      const luminanceParams = { ...sampleConversionParams.default, grayscaleMethod: 'luminance' as const }
      const averageParams = { ...sampleConversionParams.default, grayscaleMethod: 'average' as const }
      const desaturationParams = { ...sampleConversionParams.default, grayscaleMethod: 'desaturation' as const }

      const luminanceResult = await ImageService.processImage(imageData, luminanceParams)
      const averageResult = await ImageService.processImage(imageData, averageParams)
      const desaturationResult = await ImageService.processImage(imageData, desaturationParams)
      
      expect(luminanceResult.data).toBeDefined()
      expect(averageResult.data).toBeDefined()
      expect(desaturationResult.data).toBeDefined()
    })

    it('should handle resize with aspect ratio maintenance', async () => {
      const imageData = createMockImageData(100, 50) // 2:1 aspect ratio
      const resizedData = createMockImageData(50, 25) // Maintains ratio
      mockContext.getImageData.mockReturnValue(resizedData)

      const params = {
        ...sampleConversionParams.default,
        targetWidth: 50,
        targetHeight: 50,
        maintainAspectRatio: true
      }

      const result = await ImageService.processImage(imageData, params)
      
      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
    })

    it('should handle threshold with inversion', async () => {
      const imageData = createMockImageData(10, 10)
      mockContext.getImageData.mockReturnValue(imageData)

      const invertedParams = {
        ...sampleConversionParams.default,
        invert: true,
        threshold: 128
      }

      const result = await ImageService.processImage(imageData, invertedParams)
      
      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
    })

    it('should handle canvas context failure during processing', async () => {
      const imageData = createMockImageData(10, 10)
      mockCanvas.getContext = vi.fn(() => null)

      const result = await ImageService.processImage(imageData, sampleConversionParams.default)
      
      expect(result.error).toBeDefined()
      expect(result.error.userMessage).toContain('Canvas context not available')
    })
  })

  describe('convertToDotPattern', () => {
    it('should convert file to dot pattern successfully', async () => {
      const file = sampleFiles.validImage
      const processedImageData = createMockImageData(25, 25, 'checkerboard')
      
      mockContext.getImageData.mockReturnValue(processedImageData)

      const loadPromise = ImageService.convertToDotPattern(file, sampleConversionParams.default)
      
      // Simulate image load
      setTimeout(() => {
        if (mockImage.onload) {
          mockImage.onload()
        }
      }, 0)

      const result = await loadPromise
      
      expect(result.data).toBeDefined()
      expect(result.data?.width).toBe(25)
      expect(result.data?.height).toBe(25)
      expect(result.data?.data).toBeDefined()
      expect(result.data?.metadata.source).toBe('image')
      expect(result.data?.metadata.conversionParams).toEqual(sampleConversionParams.default)
      expect(result.error).toBeUndefined()
    })

    it('should handle image load failure during conversion', async () => {
      const file = sampleFiles.invalidImage
      
      const loadPromise = ImageService.convertToDotPattern(file, sampleConversionParams.default)
      
      // Simulate image error
      setTimeout(() => {
        if (mockImage.onerror) {
          mockImage.onerror(new Error('Load failed'))
        }
      }, 0)

      const result = await loadPromise
      
      expect(result.data).toBeUndefined()
      expect(result.error).toBeDefined()
      expect(result.error.userMessage).toContain('Failed to load image')
    })

    it('should handle processing failure during conversion', async () => {
      const file = sampleFiles.validImage
      mockCanvas.getContext = vi.fn(() => null) // Force processing failure

      const loadPromise = ImageService.convertToDotPattern(file, sampleConversionParams.default)
      
      // Simulate image load
      setTimeout(() => {
        if (mockImage.onload) {
          mockImage.onload()
        }
      }, 0)

      const result = await loadPromise
      
      expect(result.data).toBeUndefined()
      expect(result.error).toBeDefined()
    })

    it('should convert with high resolution parameters', async () => {
      const file = sampleFiles.validImage
      const largeImageData = createMockImageData(100, 100, 'gradient')
      
      mockContext.getImageData.mockReturnValue(largeImageData)

      const loadPromise = ImageService.convertToDotPattern(file, sampleConversionParams.highResolution)
      
      // Simulate image load
      setTimeout(() => {
        if (mockImage.onload) {
          mockImage.onload()
        }
      }, 0)

      const result = await loadPromise
      
      expect(result.data).toBeDefined()
      expect(result.data?.width).toBe(100)
      expect(result.data?.height).toBe(100)
      expect(result.data?.metadata.conversionParams).toEqual(sampleConversionParams.highResolution)
    })
  })

  describe('validateImageFile', () => {
    it('should validate supported image formats', async () => {
      const result = await ImageService.validateImageFile(sampleFiles.validImage)
      
      expect(result.data).toBeDefined()
      expect(result.data?.isValid).toBe(true)
      expect(result.data?.errors).toHaveLength(0)
      expect(result.error).toBeUndefined()
    })

    it('should reject non-image files', async () => {
      const result = await ImageService.validateImageFile(sampleFiles.validCSV)
      
      expect(result.data?.isValid).toBe(false)
      expect(result.data?.errors).toContain('File is not a valid image format')
    })

    it('should check image file size limits', async () => {
      const result = await ImageService.validateImageFile(sampleFiles.largeImage)
      
      expect(result.data?.isValid).toBe(false)
      expect(result.data?.errors).toContain('File size exceeds maximum allowed size')
    })

    it('should validate image within size limits', async () => {
      const result = await ImageService.validateImageFile(sampleFiles.validImage)
      
      expect(result.data?.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })
  })

  describe('error handling', () => {
    it('should handle null file gracefully', async () => {
      const result = await ImageService.loadImage(null as any)
      
      expect(result.error).toBeDefined()
      expect(result.error.userMessage).toContain('Invalid file provided')
    })

    it('should handle invalid conversion parameters', async () => {
      const imageData = createMockImageData(10, 10)
      const invalidParams = {
        ...sampleConversionParams.default,
        targetWidth: -1,
        targetHeight: -1
      }

      const result = await ImageService.processImage(imageData, invalidParams)
      
      expect(result.error).toBeDefined()
      expect(result.error.userMessage).toContain('Invalid processing parameters')
    })

    it('should provide meaningful error messages for processing failures', async () => {
      const imageData = createMockImageData(10, 10)
      mockContext.getImageData.mockImplementation(() => {
        throw new Error('Canvas processing failed')
      })

      const result = await ImageService.processImage(imageData, sampleConversionParams.default)
      
      expect(result.error).toBeDefined()
      expect(result.error.userMessage).toContain('Image processing failed')
      expect(result.error.technicalDetails).toContain('Canvas processing failed')
    })
  })

  describe('performance', () => {
    it('should handle large image processing efficiently', async () => {
      const largeImageData = createMockImageData(500, 500)
      mockContext.getImageData.mockReturnValue(largeImageData)

      const start = Date.now()
      
      const result = await ImageService.processImage(largeImageData, sampleConversionParams.default)
      
      const duration = Date.now() - start
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
      expect(result.data).toBeDefined()
    })

    it('should optimize memory usage for large images', async () => {
      const largeImageData = createMockImageData(1000, 1000)
      
      // Mock memory-efficient processing
      mockContext.getImageData.mockReturnValue(createMockImageData(100, 100))

      const result = await ImageService.processImage(largeImageData, {
        ...sampleConversionParams.default,
        targetWidth: 100,
        targetHeight: 100
      })
      
      expect(result.data).toBeDefined()
      expect(result.data?.width).toBe(100)
      expect(result.data?.height).toBe(100)
    })
  })
})