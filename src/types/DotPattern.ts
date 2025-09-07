/**
 * Represents a 2D dot art pattern where true indicates a dot/filled pixel
 * and false indicates empty space
 */
export interface DotPattern {
  /** 2D array representing the dot pattern. true = filled, false = empty */
  data: boolean[][]
  
  /** Width of the pattern (number of columns) */
  width: number
  
  /** Height of the pattern (number of rows) */
  height: number
  
  /** Optional metadata about the pattern */
  metadata?: {
    /** Source filename if loaded from a file */
    filename?: string
    
    /** Creation timestamp */
    createdAt?: Date
    
    /** Last modification timestamp */
    modifiedAt?: Date
    
    /** Original image dimensions if converted from image */
    originalDimensions?: {
      width: number
      height: number
    }
    
    /** Processing parameters used if converted from image */
    conversionParams?: ConversionParams
  }
}

/**
 * Parameters for converting images to dot patterns
 */
export interface ConversionParams {
  /** Threshold value for binary conversion (0-255) */
  threshold: number
  
  /** Target width for resizing (pixels) */
  targetWidth: number
  
  /** Target height for resizing (pixels) */
  targetHeight: number
  
  /** Whether to maintain aspect ratio during resize */
  maintainAspectRatio: boolean
  
  /** Invert the pattern (swap true/false values) */
  invert: boolean
}

/**
 * Represents a position in the 2D dot pattern
 */
export interface DotPosition {
  /** Column index (x coordinate) */
  x: number
  
  /** Row index (y coordinate) */
  y: number
}

/**
 * Represents a rectangular selection in the dot pattern
 */
export interface DotSelection {
  /** Starting position */
  start: DotPosition
  
  /** Ending position */
  end: DotPosition
}

/**
 * Validation result for dot pattern operations
 */
export interface ValidationResult {
  /** Whether the validation passed */
  isValid: boolean
  
  /** Array of validation errors, if any */
  errors: string[]
  
  /** Array of validation warnings, if any */
  warnings: string[]
}