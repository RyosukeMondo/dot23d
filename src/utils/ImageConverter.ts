import type { DotPattern, ImageProcessingParams, ResizeParams, ConversionParams } from '@/types'

/**
 * Error class for image processing operations
 */
export class ImageProcessingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImageProcessingError'
  }
}

/**
 * Utility class for image processing operations
 */
export class ImageConverter {
  private static canvas: HTMLCanvasElement | null = null
  private static context: CanvasRenderingContext2D | null = null

  /**
   * Get or create a reusable canvas element
   */
  private static getCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    if (!this.canvas || !this.context) {
      this.canvas = document.createElement('canvas')
      const ctx = this.canvas.getContext('2d')
      if (!ctx) {
        throw new ImageProcessingError('Failed to get 2D canvas context')
      }
      this.context = ctx
    }
    return { canvas: this.canvas, ctx: this.context }
  }

  /**
   * Load an image from a File object
   */
  static async loadImage(file: File): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      
      img.onload = () => {
        try {
          const { canvas, ctx } = this.getCanvas()
          
          // Set canvas size to match image
          canvas.width = img.width
          canvas.height = img.height
          
          // Clear and draw image
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0)
          
          // Get image data
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          resolve(imageData)
          
          // Clean up
          URL.revokeObjectURL(img.src)
        } catch (error) {
          reject(new ImageProcessingError(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`))
        }
      }
      
      img.onerror = () => {
        reject(new ImageProcessingError('Failed to load image file'))
        URL.revokeObjectURL(img.src)
      }
      
      img.src = URL.createObjectURL(file)
    })
  }

  /**
   * Convert ImageData to grayscale
   */
  static convertToGreyscale(imageData: ImageData, method: ImageProcessingParams['grayscaleMethod'] = 'luminance'): ImageData {
    const { canvas, ctx } = this.getCanvas()
    
    // Create a copy of the image data
    const newImageData = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    )
    
    const data = newImageData.data
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      
      let gray: number
      
      switch (method) {
        case 'luminance':
          // Use standard luminance formula
          gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
          break
        case 'average':
          // Simple average
          gray = Math.round((r + g + b) / 3)
          break
        case 'desaturation':
          // Average of max and min
          gray = Math.round((Math.max(r, g, b) + Math.min(r, g, b)) / 2)
          break
        default:
          gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
      }
      
      // Set RGB to gray value, keep alpha
      data[i] = gray
      data[i + 1] = gray
      data[i + 2] = gray
      // data[i + 3] remains unchanged (alpha)
    }
    
    return newImageData
  }

  /**
   * Apply Gaussian blur to ImageData
   */
  static applyBlur(imageData: ImageData, radius: number): ImageData {
    const { canvas, ctx } = this.getCanvas()
    
    // Set canvas size
    canvas.width = imageData.width
    canvas.height = imageData.height
    
    // Put image data on canvas
    ctx.putImageData(imageData, 0, 0)
    
    // Apply blur filter
    ctx.filter = `blur(${radius}px)`
    ctx.drawImage(canvas, 0, 0)
    
    // Reset filter
    ctx.filter = 'none'
    
    // Get blurred image data
    return ctx.getImageData(0, 0, canvas.width, canvas.height)
  }

  /**
   * Enhance contrast of ImageData
   */
  static enhanceContrast(imageData: ImageData, factor: number): ImageData {
    const newImageData = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    )
    
    const data = newImageData.data
    
    for (let i = 0; i < data.length; i += 4) {
      // Apply contrast enhancement to RGB channels
      for (let c = 0; c < 3; c++) {
        const value = data[i + c]
        // Contrast formula: (value - 128) * factor + 128
        const enhanced = Math.round((value - 128) * factor + 128)
        data[i + c] = Math.max(0, Math.min(255, enhanced))
      }
      // Alpha channel remains unchanged
    }
    
    return newImageData
  }

  /**
   * Apply threshold to convert grayscale to binary
   */
  static applyThreshold(imageData: ImageData, threshold: number, invert: boolean = false): ImageData {
    const newImageData = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    )
    
    const data = newImageData.data
    
    for (let i = 0; i < data.length; i += 4) {
      // Use red channel as grayscale value (assuming image is already grayscale)
      const grayValue = data[i]
      
      // Apply threshold
      let binaryValue = grayValue >= threshold ? 255 : 0
      
      // Invert if requested
      if (invert) {
        binaryValue = 255 - binaryValue
      }
      
      // Set RGB to binary value
      data[i] = binaryValue
      data[i + 1] = binaryValue
      data[i + 2] = binaryValue
      // Alpha remains unchanged
    }
    
    return newImageData
  }

  /**
   * Resize ImageData to target dimensions
   */
  static resizeToTarget(imageData: ImageData, params: ResizeParams): ImageData {
    const { canvas, ctx } = this.getCanvas()
    
    // Calculate final dimensions
    let finalWidth = params.targetWidth
    let finalHeight = params.targetHeight
    
    if (params.maintainAspectRatio) {
      const aspectRatio = imageData.width / imageData.height
      const targetAspectRatio = params.targetWidth / params.targetHeight
      
      if (aspectRatio > targetAspectRatio) {
        // Image is wider than target
        finalHeight = Math.round(params.targetWidth / aspectRatio)
      } else {
        // Image is taller than target
        finalWidth = Math.round(params.targetHeight * aspectRatio)
      }
    }
    
    // Create temporary canvas for source image
    const sourceCanvas = document.createElement('canvas')
    const sourceCtx = sourceCanvas.getContext('2d')
    if (!sourceCtx) {
      throw new ImageProcessingError('Failed to create source canvas context')
    }
    
    sourceCanvas.width = imageData.width
    sourceCanvas.height = imageData.height
    sourceCtx.putImageData(imageData, 0, 0)
    
    // Set target canvas size
    canvas.width = params.targetWidth
    canvas.height = params.targetHeight
    
    // Fill with background color if maintaining aspect ratio
    if (params.maintainAspectRatio && params.fillColor) {
      ctx.fillStyle = params.fillColor
      ctx.fillRect(0, 0, params.targetWidth, params.targetHeight)
    }
    
    // Configure resampling
    switch (params.algorithm) {
      case 'nearest':
        ctx.imageSmoothingEnabled = false
        break
      case 'bilinear':
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'low'
        break
      case 'bicubic':
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        break
    }
    
    // Calculate centering offset for aspect ratio preservation
    const offsetX = Math.round((params.targetWidth - finalWidth) / 2)
    const offsetY = Math.round((params.targetHeight - finalHeight) / 2)
    
    // Draw resized image
    ctx.drawImage(sourceCanvas, offsetX, offsetY, finalWidth, finalHeight)
    
    // Get result
    return ctx.getImageData(0, 0, params.targetWidth, params.targetHeight)
  }

  /**
   * Convert ImageData to boolean matrix (DotPattern data)
   */
  static imageToBooleanMatrix(imageData: ImageData, threshold: number = 128): boolean[][] {
    const data = imageData.data
    const width = imageData.width
    const height = imageData.height
    const matrix: boolean[][] = []
    
    for (let y = 0; y < height; y++) {
      const row: boolean[] = []
      for (let x = 0; x < width; x++) {
        const pixelIndex = (y * width + x) * 4
        // Use red channel as grayscale value
        const grayValue = data[pixelIndex]
        
        // Convert to boolean based on threshold
        row.push(grayValue >= threshold)
      }
      matrix.push(row)
    }
    
    return matrix
  }

  /**
   * Apply Floyd-Steinberg dithering
   */
  static applyDithering(imageData: ImageData, method: 'floyd-steinberg' | 'atkinson' | 'sierra' = 'floyd-steinberg'): ImageData {
    const newImageData = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    )
    
    const data = newImageData.data
    const width = imageData.width
    const height = imageData.height
    
    // Dithering matrices
    const matrices = {
      'floyd-steinberg': [
        [1, 0, 7/16],
        [-1, 1, 3/16],
        [0, 1, 5/16],
        [1, 1, 1/16]
      ],
      'atkinson': [
        [1, 0, 1/8], [2, 0, 1/8],
        [-1, 1, 1/8], [0, 1, 1/8], [1, 1, 1/8],
        [0, 2, 1/8]
      ],
      'sierra': [
        [1, 0, 5/32], [2, 0, 3/32],
        [-2, 1, 2/32], [-1, 1, 4/32], [0, 1, 5/32], [1, 1, 4/32], [2, 1, 2/32],
        [-1, 2, 2/32], [0, 2, 3/32], [1, 2, 2/32]
      ]
    }
    
    const matrix = matrices[method]
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = (y * width + x) * 4
        const oldValue = data[pixelIndex]
        
        // Quantize to black or white
        const newValue = oldValue < 128 ? 0 : 255
        const error = oldValue - newValue
        
        // Set the new value
        data[pixelIndex] = newValue
        data[pixelIndex + 1] = newValue
        data[pixelIndex + 2] = newValue
        
        // Distribute error to neighboring pixels
        for (const [dx, dy, weight] of matrix) {
          const nx = x + dx
          const ny = y + dy
          
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const neighborIndex = (ny * width + nx) * 4
            const errorAmount = error * weight
            
            data[neighborIndex] = Math.max(0, Math.min(255, data[neighborIndex] + errorAmount))
            data[neighborIndex + 1] = data[neighborIndex]
            data[neighborIndex + 2] = data[neighborIndex]
          }
        }
      }
    }
    
    return newImageData
  }

  /**
   * Complete image to dot pattern conversion
   */
  static async convertImageToDotPattern(file: File, params: ConversionParams): Promise<DotPattern> {
    try {
      // Load the image
      let imageData = await this.loadImage(file)
      
      // Resize first if needed
      if (imageData.width !== params.targetWidth || imageData.height !== params.targetHeight) {
        imageData = this.resizeToTarget(imageData, params)
      }
      
      // Convert to grayscale
      imageData = this.convertToGreyscale(imageData, params.grayscaleMethod)
      
      // Apply blur if enabled
      if (params.preBlur && params.blurRadius > 0) {
        imageData = this.applyBlur(imageData, params.blurRadius)
      }
      
      // Enhance contrast if enabled
      if (params.enhanceContrast && params.contrastFactor !== 1.0) {
        imageData = this.enhanceContrast(imageData, params.contrastFactor)
      }
      
      // Apply dithering if enabled
      if (params.enableDithering) {
        imageData = this.applyDithering(imageData, params.ditheringMethod)
      }
      
      // Apply threshold to create binary image
      imageData = this.applyThreshold(imageData, params.threshold, params.invert)
      
      // Convert to boolean matrix
      const data = this.imageToBooleanMatrix(imageData, params.invert ? 127 : 128)
      
      return {
        data,
        width: params.targetWidth,
        height: params.targetHeight,
        metadata: {
          filename: file.name,
          createdAt: new Date(),
          modifiedAt: new Date(),
          originalDimensions: {
            width: imageData.width,
            height: imageData.height
          },
          conversionParams: params
        }
      }
      
    } catch (error) {
      if (error instanceof ImageProcessingError) {
        throw error
      }
      throw new ImageProcessingError(`Image conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}