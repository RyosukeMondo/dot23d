/**
 * Parameters for image processing and conversion
 */
export interface ImageProcessingParams {
  /** Grayscale conversion method */
  grayscaleMethod: 'luminance' | 'average' | 'desaturation'
  
  /** Threshold for binary conversion (0-255) */
  threshold: number
  
  /** Apply blur before thresholding to reduce noise */
  preBlur: boolean
  
  /** Blur radius if preBlur is enabled */
  blurRadius: number
  
  /** Enhance contrast before conversion */
  enhanceContrast: boolean
  
  /** Contrast enhancement factor (1.0 = no change) */
  contrastFactor: number
}

/**
 * Parameters for resizing operations
 */
export interface ResizeParams {
  /** Target width in pixels */
  targetWidth: number
  
  /** Target height in pixels */
  targetHeight: number
  
  /** Whether to maintain original aspect ratio */
  maintainAspectRatio: boolean
  
  /** Resize algorithm to use */
  algorithm: 'nearest' | 'bilinear' | 'bicubic'
  
  /** Background fill color for non-square images when maintaining aspect ratio */
  fillColor: string
}

/**
 * Complete conversion parameters combining all processing options
 */
export interface ConversionParams extends ImageProcessingParams, ResizeParams {
  /** Invert the final pattern (swap black/white) */
  invert: boolean
  
  /** Apply dithering for better visual quality */
  enableDithering: boolean
  
  /** Dithering algorithm to use */
  ditheringMethod: 'floyd-steinberg' | 'atkinson' | 'sierra'
}

/**
 * Parameters for 3D model generation
 */
export interface Model3DParams {
  /** Height of individual cubes/voxels in mm */
  cubeHeight: number
  
  /** Width/depth of individual cubes/voxels in mm */
  cubeSize: number
  
  /** Spacing between cubes in mm (0 = no spacing) */
  spacing: number
  
  /** Generate a base/platform under the pattern */
  generateBase: boolean
  
  /** Base thickness in mm if generateBase is true */
  baseThickness: number
  
  /** Apply mesh optimization to reduce polygon count */
  optimizeMesh: boolean
  
  /** Merge adjacent faces to reduce complexity */
  mergeAdjacentFaces: boolean
  
  /** Add chamfer/bevel to cube edges */
  chamferEdges: boolean
  
  /** Chamfer size in mm */
  chamferSize: number
}

/**
 * Export format options
 */
export interface ExportParams {
  /** File format for export */
  format: 'obj' | 'stl' | 'ply'
  
  /** Include material file (.mtl) for OBJ format */
  includeMaterials: boolean
  
  /** Scale factor for export (1.0 = 1mm per unit) */
  scaleFactor: number
  
  /** Center the model at origin */
  centerModel: boolean
  
  /** File name for export (without extension) */
  filename: string
}