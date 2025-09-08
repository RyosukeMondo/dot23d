/**
 * Test Fixtures
 * Common test data and mock objects for consistent testing
 */

import type { DotPattern, ConversionParams, ValidationResult } from '@/types'

// Sample CSV data for testing
export const sampleCSVData = {
  valid: 'true,false,true\nfalse,true,false\ntrue,true,false',
  invalid: 'not,boolean,data\ninvalid,csv,format',
  empty: '',
  singleRow: 'true,false,true',
  mixedTypes: 'true,false,1\n0,true,false',
}

// Sample dot patterns
export const sampleDotPatterns: Record<string, DotPattern> = {
  small: {
    width: 3,
    height: 3,
    data: [
      [true, false, true],
      [false, true, false],
      [true, true, false]
    ],
    metadata: {
      source: 'csv',
    }
  },
  
  large: {
    width: 5,
    height: 4,
    data: [
      [true, true, false, false, true],
      [false, true, true, true, false],
      [true, false, true, false, true],
      [false, false, true, true, true]
    ],
    metadata: {
      source: 'image',
      originalSize: { width: 100, height: 80 },
      conversionParams: {
        grayscaleMethod: 'luminance',
        threshold: 128,
        preBlur: false,
        blurRadius: 1,
        enhanceContrast: false,
        contrastFactor: 1.0,
        targetWidth: 5,
        targetHeight: 4,
        maintainAspectRatio: true,
        algorithm: 'bilinear',
        fillColor: '#ffffff',
        invert: false,
        enableDithering: false,
        ditheringMethod: 'floyd-steinberg'
      }
    }
  },

  empty: {
    width: 2,
    height: 2,
    data: [
      [false, false],
      [false, false]
    ],
    metadata: {
      source: 'csv',
    }
  },

  full: {
    width: 2,
    height: 2,
    data: [
      [true, true],
      [true, true]
    ],
    metadata: {
      source: 'csv',
    }
  }
}

// Sample conversion parameters
export const sampleConversionParams: Record<string, ConversionParams> = {
  default: {
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
  },

  highResolution: {
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
    enableDithering: true,
    ditheringMethod: 'floyd-steinberg'
  },

  lowThreshold: {
    grayscaleMethod: 'luminance',
    threshold: 64,
    preBlur: true,
    blurRadius: 2,
    enhanceContrast: true,
    contrastFactor: 1.5,
    targetWidth: 25,
    targetHeight: 25,
    maintainAspectRatio: false,
    algorithm: 'nearest',
    fillColor: '#000000',
    invert: true,
    enableDithering: false,
    ditheringMethod: 'floyd-steinberg'
  }
}

// Sample validation results
export const sampleValidationResults: Record<string, ValidationResult> = {
  valid: {
    isValid: true,
    errors: [],
    warnings: []
  },

  withWarnings: {
    isValid: true,
    errors: [],
    warnings: ['File size is large and may impact performance']
  },

  invalid: {
    isValid: false,
    errors: [
      'File size exceeds maximum allowed size',
      'Unsupported file type'
    ],
    warnings: []
  },

  multipleIssues: {
    isValid: false,
    errors: [
      'Invalid file format',
      'File appears to be corrupted'
    ],
    warnings: [
      'File extension does not match content type',
      'Large file size detected'
    ]
  }
}

// Mock file objects
export const createMockFile = (content: string, name: string, type: string, size?: number): File => {
  const blob = new Blob([content], { type })
  const file = new File([blob], name, { type, lastModified: Date.now() })
  
  // Override size if specified
  if (size !== undefined) {
    Object.defineProperty(file, 'size', {
      value: size,
      writable: false
    })
  }
  
  return file
}

// Sample files for testing
export const sampleFiles = {
  validCSV: createMockFile(sampleCSVData.valid, 'test.csv', 'text/csv'),
  invalidCSV: createMockFile(sampleCSVData.invalid, 'invalid.csv', 'text/csv'),
  emptyCSV: createMockFile(sampleCSVData.empty, 'empty.csv', 'text/csv'),
  largeCSV: createMockFile(sampleCSVData.valid.repeat(1000), 'large.csv', 'text/csv', 10 * 1024 * 1024), // 10MB
  
  validImage: createMockFile('fake-image-data', 'test.jpg', 'image/jpeg', 1024),
  invalidImage: createMockFile('not-an-image', 'fake.jpg', 'text/plain'),
  largeImage: createMockFile('large-image-data', 'big.png', 'image/png', 15 * 1024 * 1024), // 15MB
  
  unsupportedFile: createMockFile('document content', 'document.doc', 'application/msword'),
}

// Mock ImageData objects
export const createMockImageData = (width = 10, height = 10, pattern?: 'checkerboard' | 'gradient' | 'solid'): ImageData => {
  const data = new Uint8ClampedArray(width * height * 4)
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      
      let r = 255, g = 255, b = 255, a = 255
      
      switch (pattern) {
        case 'checkerboard':
          const isWhite = (x + y) % 2 === 0
          r = g = b = isWhite ? 255 : 0
          break
        case 'gradient':
          const intensity = Math.floor((x / width) * 255)
          r = g = b = intensity
          break
        case 'solid':
        default:
          r = g = b = 128 // gray
          break
      }
      
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = a
    }
  }
  
  return {
    data,
    width,
    height,
    colorSpace: 'srgb' as PredefinedColorSpace,
  }
}

// Sample ImageData objects
export const sampleImageData = {
  small: createMockImageData(5, 5, 'checkerboard'),
  large: createMockImageData(50, 50, 'gradient'),
  solid: createMockImageData(10, 10, 'solid'),
}

// Mock Three.js objects (simplified)
export const mockThreeJSObjects = {
  geometry: {
    vertices: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 1, y: 1, z: 0 },
      { x: 0, y: 1, z: 0 },
    ],
    faces: [
      { a: 0, b: 1, c: 2 },
      { a: 0, b: 2, c: 3 },
    ]
  },
  
  mesh: {
    geometry: null,
    material: null,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  }
}

// Error messages for testing
export const sampleErrorMessages = {
  fileValidation: {
    sizeExceeded: 'File size exceeds maximum allowed size',
    invalidType: 'File type is not supported',
    emptyFile: 'File appears to be empty',
    corrupted: 'File appears to be corrupted',
  },
  
  imageProcessing: {
    loadFailed: 'Failed to load image',
    conversionFailed: 'Image conversion failed',
    invalidFormat: 'Invalid image format',
    processingError: 'Image processing error',
  },
  
  csvParsing: {
    invalidFormat: 'Invalid CSV format',
    parseFailed: 'Failed to parse CSV data',
    invalidDimensions: 'Invalid pattern dimensions',
    invalidData: 'CSV contains invalid data',
  },
  
  modelGeneration: {
    generationFailed: '3D model generation failed',
    exportFailed: 'Failed to export model',
    meshOptimization: 'Mesh optimization failed',
    invalidPattern: 'Invalid dot pattern for 3D generation',
  }
}