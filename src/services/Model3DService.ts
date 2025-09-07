import { MeshGenerator, MeshGenerationError } from '@/utils/MeshGenerator'
import { OBJExporter, OBJExportError } from '@/utils/OBJExporter'
import type { DotPattern, Model3DParams, ExportParams } from '@/types'
import type { MeshStats } from '@/utils/MeshGenerator'
import * as THREE from 'three'

/**
 * Service for 3D model generation and export
 */
export class Model3DService {
  /**
   * Generate 3D mesh from dot pattern
   */
  static generateMesh(pattern: DotPattern, params: Model3DParams): THREE.Group {
    try {
      return MeshGenerator.generateMesh(pattern, params)
    } catch (error) {
      if (error instanceof MeshGenerationError) {
        throw error
      }
      throw new MeshGenerationError(
        `Mesh generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }
  
  /**
   * Optimize existing mesh
   */
  static optimizeMesh(mesh: THREE.Group): THREE.Group {
    // This is a simplified optimization
    // In a production app, you might use more sophisticated optimization
    try {
      // Center the mesh
      MeshGenerator.centerMesh(mesh)
      
      // Additional optimizations could be added here
      // - Merge geometries
      // - Remove duplicate vertices
      // - Simplify complex meshes
      
      return mesh
    } catch (error) {
      throw new MeshGenerationError(
        `Mesh optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }
  
  /**
   * Export mesh to OBJ format
   */
  static exportOBJ(mesh: THREE.Group, params: ExportParams): { blob: Blob; filename: string } {
    try {
      return OBJExporter.createDownloadBlob(mesh, params)
    } catch (error) {
      if (error instanceof OBJExportError) {
        throw error
      }
      throw new OBJExportError(
        `OBJ export failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }
  
  /**
   * Get mesh statistics
   */
  static getMeshStats(mesh: THREE.Group): MeshStats {
    return MeshGenerator.calculateMeshStats(mesh)
  }
  
  /**
   * Get default 3D parameters
   */
  static getDefault3DParams(): Model3DParams {
    return {
      cubeHeight: 2.0,
      cubeSize: 2.0,
      spacing: 0.1,
      generateBase: true,
      baseThickness: 1.0,
      optimizeMesh: true,
      mergeAdjacentFaces: false,
      chamferEdges: false,
      chamferSize: 0.1
    }
  }
  
  /**
   * Get default export parameters
   */
  static getDefaultExportParams(): ExportParams {
    return {
      format: 'obj',
      includeMaterials: false,
      scaleFactor: 1.0,
      centerModel: true,
      filename: 'dot-art-model'
    }
  }
  
  /**
   * Validate 3D parameters
   */
  static validate3DParams(params: Partial<Model3DParams>): string[] {
    const errors: string[] = []
    
    if (params.cubeHeight !== undefined && (params.cubeHeight <= 0 || params.cubeHeight > 50)) {
      errors.push('Cube height must be between 0 and 50mm')
    }
    
    if (params.cubeSize !== undefined && (params.cubeSize <= 0 || params.cubeSize > 50)) {
      errors.push('Cube size must be between 0 and 50mm')
    }
    
    if (params.spacing !== undefined && (params.spacing < 0 || params.spacing > 10)) {
      errors.push('Spacing must be between 0 and 10mm')
    }
    
    if (params.baseThickness !== undefined && (params.baseThickness <= 0 || params.baseThickness > 20)) {
      errors.push('Base thickness must be between 0 and 20mm')
    }
    
    if (params.chamferSize !== undefined && (params.chamferSize < 0 || params.chamferSize > 5)) {
      errors.push('Chamfer size must be between 0 and 5mm')
    }
    
    // Check if chamfer size is reasonable compared to cube size
    if (params.chamferSize !== undefined && params.cubeSize !== undefined) {
      if (params.chamferSize >= params.cubeSize * 0.4) {
        errors.push('Chamfer size should be less than 40% of cube size')
      }
    }
    
    return errors
  }
  
  /**
   * Validate export parameters
   */
  static validateExportParams(params: Partial<ExportParams>): string[] {
    const errors: string[] = []
    
    if (params.scaleFactor !== undefined && (params.scaleFactor <= 0 || params.scaleFactor > 100)) {
      errors.push('Scale factor must be between 0 and 100')
    }
    
    if (params.filename !== undefined) {
      // Check for invalid filename characters
      const invalidChars = /[<>:"/\\|?*]/g
      if (invalidChars.test(params.filename)) {
        errors.push('Filename contains invalid characters')
      }
      
      if (params.filename.length === 0) {
        errors.push('Filename cannot be empty')
      }
      
      if (params.filename.length > 100) {
        errors.push('Filename is too long (max 100 characters)')
      }
    }
    
    return errors
  }
  
  /**
   * Calculate estimated print time and material usage
   */
  static calculatePrintEstimates(pattern: DotPattern, params: Model3DParams): {
    estimatedPrintTime: string
    estimatedMaterial: string
    estimatedCost: string
  } {
    const stats = { activeDots: 0, totalDots: pattern.width * pattern.height }
    
    // Count active dots
    for (let y = 0; y < pattern.height; y++) {
      for (let x = 0; x < pattern.width; x++) {
        if (pattern.data[y][x]) {
          stats.activeDots++
        }
      }
    }
    
    // Calculate volumes
    const cubeVolume = Math.pow(params.cubeSize, 2) * params.cubeHeight // mm³
    const totalCubeVolume = stats.activeDots * cubeVolume
    
    let baseVolume = 0
    if (params.generateBase) {
      const baseWidth = pattern.width * (params.cubeSize + params.spacing) + params.cubeSize
      const baseDepth = pattern.height * (params.cubeSize + params.spacing) + params.cubeSize
      baseVolume = baseWidth * baseDepth * params.baseThickness
    }
    
    const totalVolume = totalCubeVolume + baseVolume // mm³
    const totalVolumeML = totalVolume / 1000 // convert to mL
    
    // Rough estimates (these would be more accurate with specific printer/material data)
    const printSpeed = 50 // mm³/min (rough estimate)
    const printTimeMinutes = totalVolume / printSpeed
    const printTimeHours = printTimeMinutes / 60
    
    const materialDensity = 1.25 // g/mL for PLA
    const materialWeight = totalVolumeML * materialDensity
    const materialCost = materialWeight * 0.05 // $0.05 per gram estimate
    
    return {
      estimatedPrintTime: printTimeHours > 1 
        ? `${printTimeHours.toFixed(1)} hours` 
        : `${printTimeMinutes.toFixed(0)} minutes`,
      estimatedMaterial: `${materialWeight.toFixed(1)}g (${totalVolumeML.toFixed(1)}mL)`,
      estimatedCost: `$${materialCost.toFixed(2)}`
    }
  }
  
  /**
   * Generate preview mesh with reduced complexity for performance
   */
  static generatePreviewMesh(pattern: DotPattern, params: Model3DParams): THREE.Group {
    // Create a simplified version for preview
    const previewParams: Model3DParams = {
      ...params,
      optimizeMesh: true,
      mergeAdjacentFaces: true // Always merge for preview
    }
    
    return this.generateMesh(pattern, previewParams)
  }
}