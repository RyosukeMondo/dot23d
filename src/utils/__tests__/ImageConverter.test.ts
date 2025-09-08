/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ImageConverter, ImageProcessingError } from '../ImageConverter'
import { sampleFiles, sampleConversionParams, createMockImageData } from '@/test/fixtures'

describe('ImageConverter', () => {
  let mockImage: any
  let mockCanvas: any
  let mockContext: any

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Mock Canvas context
    mockContext = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => createMockImageData(10, 10, 'checkerboard')),
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
      
      const loadPromise = ImageConverter.loadImage(file)
      
      // Simulate image load
      setTimeout(() => {
        if (mockImage.onload) {
          mockImage.onload()
        }
      }, 0)

      const result = await loadPromise
      
      expect(result).toBeDefined()
      expect(result.width).toBe(10)
      expect(result.height).toBe(10)
      expect(mockContext.drawImage).toHaveBeenCalled()
      expect(mockContext.getImageData).toHaveBeenCalledWith(0, 0, 100, 100)
    })

    it('should reject when image fails to load', async () => {
      const file = sampleFiles.invalidImage
      
      const loadPromise = ImageConverter.loadImage(file)
      
      // Simulate image error
      setTimeout(() => {
        if (mockImage.onerror) {
          mockImage.onerror(new Error('Failed to load image'))
        }
      }, 0)

      await expect(loadPromise).rejects.toThrow(ImageProcessingError)
    })

    it('should reject when canvas context is not available', async () => {
      mockCanvas.getContext = vi.fn(() => null)
      
      const file = sampleFiles.validImage
      
      await expect(ImageConverter.loadImage(file)).rejects.toThrow(ImageProcessingError)
    })
  })

  describe('convertToGreyscale', () => {
    it('should convert color image to greyscale using luminance', () => {
      const imageData = createMockImageData(2, 2)
      // Set specific RGB values
      imageData.data[0] = 255  // R
      imageData.data[1] = 0    // G
      imageData.data[2] = 0    // B
      imageData.data[3] = 255  // A

      const result = ImageConverter.convertToGreyscale(imageData, 'luminance')
      
      expect(result.width).toBe(2)
      expect(result.height).toBe(2)
      
      // Luminance formula: 0.299 * R + 0.587 * G + 0.114 * B
      const expectedGray = Math.floor(0.299 * 255 + 0.587 * 0 + 0.114 * 0)
      expect(result.data[0]).toBe(expectedGray) // R
      expect(result.data[1]).toBe(expectedGray) // G
      expect(result.data[2]).toBe(expectedGray) // B
      expect(result.data[3]).toBe(255) // A unchanged
    })

    it('should convert using average method', () => {
      const imageData = createMockImageData(1, 1)
      imageData.data[0] = 255  // R
      imageData.data[1] = 128  // G
      imageData.data[2] = 64   // B
      imageData.data[3] = 255  // A

      const result = ImageConverter.convertToGreyscale(imageData, 'average')
      
      const expectedGray = Math.floor((255 + 128 + 64) / 3)
      expect(result.data[0]).toBe(expectedGray)
      expect(result.data[1]).toBe(expectedGray)
      expect(result.data[2]).toBe(expectedGray)
    })

    it('should convert using desaturation method', () => {
      const imageData = createMockImageData(1, 1)
      imageData.data[0] = 200  // R
      imageData.data[1] = 100  // G
      imageData.data[2] = 50   // B
      imageData.data[3] = 255  // A

      const result = ImageConverter.convertToGreyscale(imageData, 'desaturation')
      
      const expectedGray = Math.floor((Math.max(200, 100, 50) + Math.min(200, 100, 50)) / 2)
      expect(result.data[0]).toBe(expectedGray)
      expect(result.data[1]).toBe(expectedGray)
      expect(result.data[2]).toBe(expectedGray)
    })
  })

  describe('applyThreshold', () => {
    it('should apply threshold to convert to binary', () => {
      const imageData = createMockImageData(2, 1)
      imageData.data[0] = 100   // Below threshold
      imageData.data[1] = 100
      imageData.data[2] = 100
      imageData.data[4] = 200   // Above threshold
      imageData.data[5] = 200
      imageData.data[6] = 200

      const result = ImageConverter.applyThreshold(imageData, 128, false)
      
      // First pixel should be black (below threshold)
      expect(result.data[0]).toBe(0)
      expect(result.data[1]).toBe(0)
      expect(result.data[2]).toBe(0)
      
      // Second pixel should be white (above threshold)
      expect(result.data[4]).toBe(255)
      expect(result.data[5]).toBe(255)
      expect(result.data[6]).toBe(255)
    })

    it('should invert colors when invert is true', () => {
      const imageData = createMockImageData(1, 1)
      imageData.data[0] = 200   // Above threshold
      imageData.data[1] = 200
      imageData.data[2] = 200

      const result = ImageConverter.applyThreshold(imageData, 128, true)
      
      // Should be black because of inversion
      expect(result.data[0]).toBe(0)
      expect(result.data[1]).toBe(0)
      expect(result.data[2]).toBe(0)
    })
  })

  describe('resizeToTarget', () => {
    it('should resize image maintaining aspect ratio', () => {
      const imageData = createMockImageData(20, 10) // 2:1 aspect ratio
      mockContext.getImageData.mockReturnValue(createMockImageData(10, 5))

      const result = ImageConverter.resizeToTarget(imageData, {
        targetWidth: 10,
        targetHeight: 10,
        maintainAspectRatio: true,
        algorithm: 'bilinear',
        fillColor: '#ffffff'
      })
      
      expect(result.width).toBe(10)
      expect(result.height).toBe(5) // Maintains 2:1 ratio
      expect(mockContext.drawImage).toHaveBeenCalled()
    })

    it('should resize without maintaining aspect ratio', () => {
      const imageData = createMockImageData(20, 10)
      mockContext.getImageData.mockReturnValue(createMockImageData(15, 25))

      const result = ImageConverter.resizeToTarget(imageData, {
        targetWidth: 15,
        targetHeight: 25,
        maintainAspectRatio: false,
        algorithm: 'nearest',
        fillColor: '#000000'
      })
      
      expect(result.width).toBe(15)
      expect(result.height).toBe(25)
    })
  })

  describe('convertImageToDotPattern', () => {
    it('should convert file to dot pattern successfully', async () => {
      const file = sampleFiles.validImage
      mockContext.getImageData
        .mockReturnValueOnce(createMockImageData(100, 100)) // loadImage
        .mockReturnValueOnce(createMockImageData(50, 50))   // resize
        .mockReturnValueOnce(createMockImageData(50, 50))   // threshold

      const loadPromise = ImageConverter.convertImageToDotPattern(file, sampleConversionParams.default)
      
      // Simulate image load
      setTimeout(() => {
        if (mockImage.onload) {
          mockImage.onload()
        }
      }, 0)

      const result = await loadPromise
      
      expect(result.width).toBe(50)
      expect(result.height).toBe(50)
      expect(result.data).toBeDefined()
      expect(result.metadata.source).toBe('image')
      expect(result.metadata.conversionParams).toEqual(sampleConversionParams.default)
    })

    it('should handle image load failure', async () => {
      const file = sampleFiles.invalidImage
      
      const loadPromise = ImageConverter.convertImageToDotPattern(file, sampleConversionParams.default)
      
      // Simulate image error
      setTimeout(() => {
        if (mockImage.onerror) {
          mockImage.onerror(new Error('Load failed'))
        }
      }, 0)

      await expect(loadPromise).rejects.toThrow(ImageProcessingError)
    })
  })

  describe('enhanceContrast', () => {
    it('should enhance contrast with specified factor', () => {
      const imageData = createMockImageData(2, 1)
      imageData.data[0] = 128   // Mid gray
      imageData.data[1] = 128
      imageData.data[2] = 128

      const result = ImageConverter.enhanceContrast(imageData, 2.0)
      
      // With factor 2.0, mid gray should become more extreme
      expect(result.data[0]).not.toBe(128)
      expect(result.data[1]).not.toBe(128)
      expect(result.data[2]).not.toBe(128)
    })

    it('should clamp values to valid range', () => {
      const imageData = createMockImageData(1, 1)
      imageData.data[0] = 200
      imageData.data[1] = 200
      imageData.data[2] = 200

      const result = ImageConverter.enhanceContrast(imageData, 3.0)
      
      // Should be clamped to 255
      expect(result.data[0]).toBeLessThanOrEqual(255)
      expect(result.data[1]).toBeLessThanOrEqual(255)
      expect(result.data[2]).toBeLessThanOrEqual(255)
      expect(result.data[0]).toBeGreaterThanOrEqual(0)
    })
  })

  describe('applyGaussianBlur', () => {
    it('should apply blur with specified radius', () => {
      const imageData = createMockImageData(5, 5, 'checkerboard')
      
      const result = ImageConverter.applyGaussianBlur(imageData, 1)
      
      expect(result.width).toBe(5)
      expect(result.height).toBe(5)
      // Blurred image should have different data
      expect(result.data).not.toEqual(imageData.data)
    })

    it('should handle edge cases with zero radius', () => {
      const imageData = createMockImageData(3, 3)
      
      const result = ImageConverter.applyGaussianBlur(imageData, 0)
      
      // Zero radius should return original image
      expect(result.data).toEqual(imageData.data)
    })
  })

  describe('ImageProcessingError', () => {
    it('should create error with message', () => {
      const error = new ImageProcessingError('Test error')
      
      expect(error.message).toBe('Test error')
      expect(error.name).toBe('ImageProcessingError')
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(ImageProcessingError)
    })
  })
})