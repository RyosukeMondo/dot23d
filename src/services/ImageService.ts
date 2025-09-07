import { ImageConverter, ImageProcessingError } from '@/utils/ImageConverter'
import type { DotPattern, ConversionParams } from '@/types'

/**
 * Service for image processing operations
 */
export class ImageService {
  /**
   * Load image from file and get ImageData
   */
  static async loadImage(file: File): Promise<ImageData> {
    try {
      return await ImageConverter.loadImage(file)
    } catch (error) {
      throw new ImageProcessingError(
        `Failed to load image: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }
  
  /**
   * Convert image file to dot pattern with given parameters
   */
  static async convertToDotsPattern(file: File, params: ConversionParams): Promise<DotPattern> {
    try {
      return await ImageConverter.convertImageToDotPattern(file, params)
    } catch (error) {
      throw new ImageProcessingError(
        `Image conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }
  
  /**
   * Adjust threshold on existing ImageData
   */
  static adjustThreshold(imageData: ImageData, threshold: number, invert: boolean = false): ImageData {
    return ImageConverter.applyThreshold(imageData, threshold, invert)
  }
  
  /**
   * Resize image to new dimensions
   */
  static resizeImage(imageData: ImageData, targetWidth: number, targetHeight: number, maintainAspectRatio: boolean = true): ImageData {
    const params = {
      targetWidth,
      targetHeight,
      maintainAspectRatio,
      algorithm: 'bilinear' as const,
      fillColor: '#ffffff'
    }
    return ImageConverter.resizeToTarget(imageData, params)
  }
  
  /**
   * Convert ImageData to canvas for preview
   */
  static imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    if (!ctx) {
      throw new ImageProcessingError('Failed to get 2D canvas context')
    }
    
    canvas.width = imageData.width
    canvas.height = imageData.height
    ctx.putImageData(imageData, 0, 0)
    
    return canvas
  }
  
  /**
   * Create preview URL for ImageData
   */
  static createPreviewURL(imageData: ImageData): string {
    const canvas = this.imageDataToCanvas(imageData)
    return canvas.toDataURL()
  }
  
  /**
   * Get default conversion parameters
   */
  static getDefaultConversionParams(): ConversionParams {
    return {
      // Image processing
      grayscaleMethod: 'luminance',
      threshold: 128,
      preBlur: false,
      blurRadius: 1,
      enhanceContrast: false,
      contrastFactor: 1.0,
      
      // Resize
      targetWidth: 50,
      targetHeight: 50,
      maintainAspectRatio: true,
      algorithm: 'bilinear',
      fillColor: '#ffffff',
      
      // Conversion
      invert: false,
      enableDithering: false,
      ditheringMethod: 'floyd-steinberg'
    }
  }
  
  /**
   * Validate conversion parameters
   */
  static validateConversionParams(params: Partial<ConversionParams>): string[] {
    const errors: string[] = []
    
    if (params.threshold !== undefined && (params.threshold < 0 || params.threshold > 255)) {
      errors.push('Threshold must be between 0 and 255')
    }
    
    if (params.targetWidth !== undefined && (params.targetWidth < 1 || params.targetWidth > 1000)) {
      errors.push('Target width must be between 1 and 1000')
    }
    
    if (params.targetHeight !== undefined && (params.targetHeight < 1 || params.targetHeight > 1000)) {
      errors.push('Target height must be between 1 and 1000')
    }
    
    if (params.blurRadius !== undefined && (params.blurRadius < 0 || params.blurRadius > 10)) {
      errors.push('Blur radius must be between 0 and 10')
    }
    
    if (params.contrastFactor !== undefined && (params.contrastFactor < 0.1 || params.contrastFactor > 5.0)) {
      errors.push('Contrast factor must be between 0.1 and 5.0')
    }
    
    return errors
  }
  
  /**
   * Calculate recommended dimensions based on image aspect ratio
   */
  static calculateRecommendedDimensions(imageData: ImageData, maxDimension: number = 100): { width: number; height: number } {
    const aspectRatio = imageData.width / imageData.height
    
    if (aspectRatio > 1) {
      // Landscape
      return {
        width: maxDimension,
        height: Math.round(maxDimension / aspectRatio)
      }
    } else {
      // Portrait or square
      return {
        width: Math.round(maxDimension * aspectRatio),
        height: maxDimension
      }
    }
  }
}