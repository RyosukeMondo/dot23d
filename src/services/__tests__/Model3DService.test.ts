/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Model3DService } from '../Model3DService'
import { sampleDotPatterns, mockThreeJSObjects } from '@/test/fixtures'
import * as THREE from 'three'

// Mock Three.js classes
vi.mock('three', () => ({
  BufferGeometry: vi.fn().mockImplementation(() => ({
    setAttribute: vi.fn(),
    setIndex: vi.fn(),
    computeVertexNormals: vi.fn(),
    computeBoundingBox: vi.fn(),
    vertices: [],
    faces: [],
  })),
  BufferAttribute: vi.fn().mockImplementation((array, itemSize) => ({
    array,
    itemSize,
    count: array.length / itemSize,
  })),
  Vector3: vi.fn().mockImplementation((x = 0, y = 0, z = 0) => ({ x, y, z })),
  Box3: vi.fn().mockImplementation(() => ({
    min: { x: 0, y: 0, z: 0 },
    max: { x: 1, y: 1, z: 1 },
    getSize: vi.fn(() => ({ x: 1, y: 1, z: 1 })),
  })),
  Scene: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
    remove: vi.fn(),
    children: [],
  })),
  Mesh: vi.fn().mockImplementation((geometry, material) => ({
    geometry,
    material,
    position: { set: vi.fn() },
    rotation: { set: vi.fn() },
    scale: { set: vi.fn() },
  })),
  MeshStandardMaterial: vi.fn().mockImplementation((options) => ({
    color: options?.color || 0xffffff,
    metalness: options?.metalness || 0,
    roughness: options?.roughness || 1,
  })),
}))

describe('Model3DService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateMesh', () => {
    it('should generate mesh from small dot pattern', async () => {
      const result = await Model3DService.generateMesh(sampleDotPatterns.small)
      
      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
      expect(THREE.BufferGeometry).toHaveBeenCalled()
    })

    it('should generate mesh from large dot pattern', async () => {
      const result = await Model3DService.generateMesh(sampleDotPatterns.large)
      
      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
      expect(THREE.BufferGeometry).toHaveBeenCalled()
    })

    it('should handle empty dot pattern', async () => {
      const result = await Model3DService.generateMesh(sampleDotPatterns.empty)
      
      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
      // Empty pattern should still create valid geometry
      expect(THREE.BufferGeometry).toHaveBeenCalled()
    })

    it('should generate mesh with custom options', async () => {
      const options = {
        cubeSize: 2.0,
        generateBackground: true,
        backgroundHeight: 0.5,
        optimizeMesh: true,
        centerMesh: true
      }
      
      const result = await Model3DService.generateMesh(sampleDotPatterns.small, options)
      
      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
      expect(THREE.BufferGeometry).toHaveBeenCalled()
    })

    it('should handle mesh generation failure', async () => {
      // Mock BufferGeometry to throw error
      vi.mocked(THREE.BufferGeometry).mockImplementationOnce(() => {
        throw new Error('Geometry creation failed')
      })

      const result = await Model3DService.generateMesh(sampleDotPatterns.small)
      
      expect(result.data).toBeUndefined()
      expect(result.error).toBeDefined()
      expect(result.error.userMessage).toContain('Failed to generate 3D mesh')
    })

    it('should handle invalid pattern dimensions', async () => {
      const invalidPattern = {
        width: -1,
        height: -1,
        data: [],
        metadata: { source: 'csv' as const }
      }
      
      const result = await Model3DService.generateMesh(invalidPattern)
      
      expect(result.data).toBeUndefined()
      expect(result.error).toBeDefined()
      expect(result.error.userMessage).toContain('Invalid pattern provided')
    })

    it('should generate background layer when enabled', async () => {
      const options = {
        cubeSize: 1.0,
        generateBackground: true,
        backgroundHeight: 0.2,
        optimizeMesh: false,
        centerMesh: false
      }
      
      const result = await Model3DService.generateMesh(sampleDotPatterns.small, options)
      
      expect(result.data).toBeDefined()
      expect(THREE.BufferGeometry).toHaveBeenCalled()
    })

    it('should center mesh when option is enabled', async () => {
      const options = {
        cubeSize: 1.0,
        generateBackground: false,
        backgroundHeight: 0.0,
        optimizeMesh: false,
        centerMesh: true
      }
      
      const result = await Model3DService.generateMesh(sampleDotPatterns.large, options)
      
      expect(result.data).toBeDefined()
      expect(THREE.BufferGeometry).toHaveBeenCalled()
    })
  })

  describe('exportToOBJ', () => {
    it('should export mesh to OBJ format', async () => {
      // First generate a mesh
      const meshResult = await Model3DService.generateMesh(sampleDotPatterns.small)
      expect(meshResult.data).toBeDefined()

      const result = await Model3DService.exportToOBJ(meshResult.data!)
      
      expect(result.data).toBeDefined()
      expect(typeof result.data).toBe('string')
      expect(result.data).toContain('# OBJ file generated by Dot Art 3D Converter')
      expect(result.data).toContain('v ') // Vertices
      expect(result.data).toContain('f ') // Faces
      expect(result.error).toBeUndefined()
    })

    it('should export large mesh to OBJ format', async () => {
      const meshResult = await Model3DService.generateMesh(sampleDotPatterns.large)
      expect(meshResult.data).toBeDefined()

      const result = await Model3DService.exportToOBJ(meshResult.data!)
      
      expect(result.data).toBeDefined()
      expect(typeof result.data).toBe('string')
      expect(result.data).toContain('# OBJ file generated by Dot Art 3D Converter')
      expect(result.error).toBeUndefined()
    })

    it('should handle export failure', async () => {
      // Create invalid geometry that will cause export to fail
      const invalidGeometry = null as any

      const result = await Model3DService.exportToOBJ(invalidGeometry)
      
      expect(result.data).toBeUndefined()
      expect(result.error).toBeDefined()
      expect(result.error.userMessage).toContain('Failed to export mesh to OBJ')
    })

    it('should include metadata in OBJ export', async () => {
      const meshResult = await Model3DService.generateMesh(sampleDotPatterns.small)
      expect(meshResult.data).toBeDefined()

      const result = await Model3DService.exportToOBJ(meshResult.data!, {
        includeComments: true,
        precision: 6
      })
      
      expect(result.data).toBeDefined()
      expect(result.data).toContain('# Pattern dimensions:')
      expect(result.data).toContain('# Generated from:')
      expect(result.error).toBeUndefined()
    })

    it('should handle custom precision in export', async () => {
      const meshResult = await Model3DService.generateMesh(sampleDotPatterns.small)
      expect(meshResult.data).toBeDefined()

      const result = await Model3DService.exportToOBJ(meshResult.data!, {
        includeComments: false,
        precision: 2
      })
      
      expect(result.data).toBeDefined()
      expect(typeof result.data).toBe('string')
      expect(result.error).toBeUndefined()
    })
  })

  describe('validateMeshOptions', () => {
    it('should validate default mesh options', () => {
      const defaultOptions = {
        cubeSize: 1.0,
        generateBackground: false,
        backgroundHeight: 0.2,
        optimizeMesh: true,
        centerMesh: true
      }
      
      const result = Model3DService.validateMeshOptions(defaultOptions)
      
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should validate custom mesh options', () => {
      const customOptions = {
        cubeSize: 2.5,
        generateBackground: true,
        backgroundHeight: 0.5,
        optimizeMesh: false,
        centerMesh: false
      }
      
      const result = Model3DService.validateMeshOptions(customOptions)
      
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject negative cube size', () => {
      const invalidOptions = {
        cubeSize: -1.0,
        generateBackground: false,
        backgroundHeight: 0.2,
        optimizeMesh: true,
        centerMesh: true
      }
      
      const result = Model3DService.validateMeshOptions(invalidOptions)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Cube size must be positive')
    })

    it('should reject negative background height', () => {
      const invalidOptions = {
        cubeSize: 1.0,
        generateBackground: true,
        backgroundHeight: -0.5,
        optimizeMesh: true,
        centerMesh: true
      }
      
      const result = Model3DService.validateMeshOptions(invalidOptions)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Background height must be non-negative')
    })

    it('should reject zero cube size', () => {
      const invalidOptions = {
        cubeSize: 0,
        generateBackground: false,
        backgroundHeight: 0.2,
        optimizeMesh: true,
        centerMesh: true
      }
      
      const result = Model3DService.validateMeshOptions(invalidOptions)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Cube size must be positive')
    })

    it('should warn about very large cube size', () => {
      const largeOptions = {
        cubeSize: 50.0,
        generateBackground: false,
        backgroundHeight: 0.2,
        optimizeMesh: true,
        centerMesh: true
      }
      
      const result = Model3DService.validateMeshOptions(largeOptions)
      
      expect(result.isValid).toBe(true)
      expect(result.warnings).toContain('Large cube size may impact performance')
    })

    it('should handle null options gracefully', () => {
      const result = Model3DService.validateMeshOptions(null as any)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Invalid mesh options provided')
    })

    it('should handle undefined options gracefully', () => {
      const result = Model3DService.validateMeshOptions(undefined as any)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Invalid mesh options provided')
    })
  })

  describe('calculateMeshComplexity', () => {
    it('should calculate complexity for small pattern', () => {
      const complexity = Model3DService.calculateMeshComplexity(sampleDotPatterns.small)
      
      expect(complexity).toBeDefined()
      expect(complexity.totalCubes).toBeGreaterThan(0)
      expect(complexity.estimatedVertices).toBeGreaterThan(0)
      expect(complexity.estimatedFaces).toBeGreaterThan(0)
      expect(complexity.memoryUsageKB).toBeGreaterThan(0)
    })

    it('should calculate complexity for large pattern', () => {
      const complexity = Model3DService.calculateMeshComplexity(sampleDotPatterns.large)
      
      expect(complexity).toBeDefined()
      expect(complexity.totalCubes).toBeGreaterThan(0)
      expect(complexity.estimatedVertices).toBeGreaterThan(0)
      expect(complexity.estimatedFaces).toBeGreaterThan(0)
      expect(complexity.memoryUsageKB).toBeGreaterThan(0)
    })

    it('should calculate complexity for empty pattern', () => {
      const complexity = Model3DService.calculateMeshComplexity(sampleDotPatterns.empty)
      
      expect(complexity).toBeDefined()
      expect(complexity.totalCubes).toBe(0)
      expect(complexity.estimatedVertices).toBe(0)
      expect(complexity.estimatedFaces).toBe(0)
      expect(complexity.memoryUsageKB).toBeGreaterThanOrEqual(0)
    })

    it('should calculate complexity for full pattern', () => {
      const complexity = Model3DService.calculateMeshComplexity(sampleDotPatterns.full)
      
      expect(complexity).toBeDefined()
      expect(complexity.totalCubes).toBe(4) // 2x2 full pattern
      expect(complexity.estimatedVertices).toBeGreaterThan(0)
      expect(complexity.estimatedFaces).toBeGreaterThan(0)
      expect(complexity.memoryUsageKB).toBeGreaterThan(0)
    })

    it('should handle invalid pattern gracefully', () => {
      const invalidPattern = {
        width: -1,
        height: -1,
        data: [],
        metadata: { source: 'csv' as const }
      }
      
      expect(() => {
        Model3DService.calculateMeshComplexity(invalidPattern)
      }).toThrow('Invalid pattern provided')
    })
  })

  describe('optimizeMesh', () => {
    it('should optimize mesh by removing duplicate vertices', async () => {
      const meshResult = await Model3DService.generateMesh(sampleDotPatterns.small)
      expect(meshResult.data).toBeDefined()

      const result = await Model3DService.optimizeMesh(meshResult.data!)
      
      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
    })

    it('should handle optimization of large mesh', async () => {
      const meshResult = await Model3DService.generateMesh(sampleDotPatterns.large)
      expect(meshResult.data).toBeDefined()

      const result = await Model3DService.optimizeMesh(meshResult.data!)
      
      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
    })

    it('should handle optimization failure', async () => {
      const invalidGeometry = null as any

      const result = await Model3DService.optimizeMesh(invalidGeometry)
      
      expect(result.data).toBeUndefined()
      expect(result.error).toBeDefined()
      expect(result.error.userMessage).toContain('Failed to optimize mesh')
    })

    it('should preserve mesh structure during optimization', async () => {
      const meshResult = await Model3DService.generateMesh(sampleDotPatterns.small)
      expect(meshResult.data).toBeDefined()

      const result = await Model3DService.optimizeMesh(meshResult.data!)
      
      expect(result.data).toBeDefined()
      // Mesh should still be valid after optimization
      expect(THREE.BufferGeometry).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should handle null pattern gracefully', async () => {
      const result = await Model3DService.generateMesh(null as any)
      
      expect(result.data).toBeUndefined()
      expect(result.error).toBeDefined()
      expect(result.error.userMessage).toContain('Invalid pattern provided')
    })

    it('should handle undefined pattern gracefully', async () => {
      const result = await Model3DService.generateMesh(undefined as any)
      
      expect(result.data).toBeUndefined()
      expect(result.error).toBeDefined()
      expect(result.error.userMessage).toContain('Invalid pattern provided')
    })

    it('should handle malformed pattern data', async () => {
      const malformedPattern = {
        width: 2,
        height: 2,
        data: 'invalid-data' as any,
        metadata: { source: 'csv' as const }
      }
      
      const result = await Model3DService.generateMesh(malformedPattern)
      
      expect(result.data).toBeUndefined()
      expect(result.error).toBeDefined()
    })

    it('should provide meaningful error messages', async () => {
      const invalidPattern = {
        width: 0,
        height: 0,
        data: [],
        metadata: { source: 'csv' as const }
      }
      
      const result = await Model3DService.generateMesh(invalidPattern)
      
      expect(result.error).toBeDefined()
      expect(result.error.userMessage).toBeDefined()
      expect(typeof result.error.userMessage).toBe('string')
      expect(result.error.userMessage.length).toBeGreaterThan(0)
    })
  })

  describe('performance', () => {
    it('should handle large pattern generation efficiently', async () => {
      const start = Date.now()
      
      const result = await Model3DService.generateMesh(sampleDotPatterns.large)
      
      const duration = Date.now() - start
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
      expect(result.data).toBeDefined()
    })

    it('should handle mesh optimization efficiently', async () => {
      const meshResult = await Model3DService.generateMesh(sampleDotPatterns.large)
      expect(meshResult.data).toBeDefined()

      const start = Date.now()
      
      const result = await Model3DService.optimizeMesh(meshResult.data!)
      
      const duration = Date.now() - start
      expect(duration).toBeLessThan(3000) // Should complete within 3 seconds
      expect(result.data).toBeDefined()
    })

    it('should handle OBJ export efficiently', async () => {
      const meshResult = await Model3DService.generateMesh(sampleDotPatterns.large)
      expect(meshResult.data).toBeDefined()

      const start = Date.now()
      
      const result = await Model3DService.exportToOBJ(meshResult.data!)
      
      const duration = Date.now() - start
      expect(duration).toBeLessThan(2000) // Should complete within 2 seconds
      expect(result.data).toBeDefined()
    })

    it('should calculate complexity efficiently', () => {
      const start = Date.now()
      
      Model3DService.calculateMeshComplexity(sampleDotPatterns.large)
      
      const duration = Date.now() - start
      expect(duration).toBeLessThan(100) // Should complete within 100ms
    })
  })
})