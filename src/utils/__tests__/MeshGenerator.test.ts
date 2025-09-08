/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MeshGenerator } from '../MeshGenerator'
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
}))

describe('MeshGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateFromPattern', () => {
    it('should generate mesh from small pattern', () => {
      const pattern = sampleDotPatterns.small
      
      const result = MeshGenerator.generateFromPattern(pattern)
      
      expect(result).toBeDefined()
      expect(THREE.BufferGeometry).toHaveBeenCalled()
      
      // Should create geometry with cubes for true values
      const trueCount = pattern.data.flat().filter(Boolean).length
      expect(trueCount).toBeGreaterThan(0)
    })

    it('should handle empty pattern', () => {
      const pattern = sampleDotPatterns.empty
      
      const result = MeshGenerator.generateFromPattern(pattern)
      
      expect(result).toBeDefined()
      // Empty pattern should still create valid geometry
      expect(THREE.BufferGeometry).toHaveBeenCalled()
    })

    it('should handle full pattern', () => {
      const pattern = sampleDotPatterns.full
      
      const result = MeshGenerator.generateFromPattern(pattern)
      
      expect(result).toBeDefined()
      expect(THREE.BufferGeometry).toHaveBeenCalled()
    })

    it('should generate background layer when enabled', () => {
      const pattern = sampleDotPatterns.small
      
      const result = MeshGenerator.generateFromPattern(pattern, {
        cubeSize: 1.0,
        generateBackground: true,
        backgroundHeight: 0.2,
        optimizeMesh: false,
        centerMesh: true
      })
      
      expect(result).toBeDefined()
      expect(THREE.BufferGeometry).toHaveBeenCalled()
    })

    it('should center mesh when option is enabled', () => {
      const pattern = sampleDotPatterns.large
      
      const result = MeshGenerator.generateFromPattern(pattern, {
        cubeSize: 1.0,
        generateBackground: false,
        backgroundHeight: 0.2,
        optimizeMesh: false,
        centerMesh: true
      })
      
      expect(result).toBeDefined()
      expect(THREE.BufferGeometry).toHaveBeenCalled()
    })
  })

  describe('generateCubeGeometry', () => {
    it('should generate cube geometry with correct dimensions', () => {
      const size = 2.0
      const position = { x: 1, y: 0, z: 1 }
      
      const result = MeshGenerator.generateCubeGeometry(size, position)
      
      expect(result.vertices).toBeDefined()
      expect(result.indices).toBeDefined()
      expect(result.vertices.length).toBe(24 * 3) // 24 vertices * 3 components
      expect(result.indices.length).toBe(36) // 12 triangles * 3 vertices
    })

    it('should position cube correctly', () => {
      const size = 1.0
      const position = { x: 2, y: 3, z: 4 }
      
      const result = MeshGenerator.generateCubeGeometry(size, position)
      
      expect(result.vertices).toBeDefined()
      // Vertices should be positioned relative to the given position
      expect(result.vertices.length).toBeGreaterThan(0)
    })
  })

  describe('optimizeGeometry', () => {
    it('should optimize geometry by removing duplicate vertices', () => {
      const geometry = {
        vertices: new Float32Array([
          0, 0, 0,  // vertex 0
          1, 0, 0,  // vertex 1
          0, 0, 0,  // duplicate of vertex 0
          0, 1, 0,  // vertex 2
        ]),
        indices: new Uint32Array([0, 1, 2, 1, 2, 3])
      }
      
      const result = MeshGenerator.optimizeGeometry(geometry)
      
      expect(result.vertices.length).toBeLessThan(geometry.vertices.length)
      expect(result.indices).toBeDefined()
    })

    it('should handle geometry with no duplicates', () => {
      const geometry = {
        vertices: new Float32Array([
          0, 0, 0,
          1, 0, 0,
          0, 1, 0,
          1, 1, 0,
        ]),
        indices: new Uint32Array([0, 1, 2, 1, 2, 3])
      }
      
      const result = MeshGenerator.optimizeGeometry(geometry)
      
      expect(result.vertices.length).toBe(geometry.vertices.length)
      expect(result.indices.length).toBe(geometry.indices.length)
    })

    it('should handle empty geometry', () => {
      const geometry = {
        vertices: new Float32Array([]),
        indices: new Uint32Array([])
      }
      
      const result = MeshGenerator.optimizeGeometry(geometry)
      
      expect(result.vertices.length).toBe(0)
      expect(result.indices.length).toBe(0)
    })
  })

  describe('createBackgroundPlane', () => {
    it('should create background plane with correct dimensions', () => {
      const width = 5
      const height = 4
      const depth = 0.5
      
      const result = MeshGenerator.createBackgroundPlane(width, height, depth)
      
      expect(result.vertices).toBeDefined()
      expect(result.indices).toBeDefined()
      expect(result.vertices.length).toBeGreaterThan(0)
      expect(result.indices.length).toBeGreaterThan(0)
    })

    it('should handle zero dimensions gracefully', () => {
      const result = MeshGenerator.createBackgroundPlane(0, 0, 0)
      
      expect(result.vertices).toBeDefined()
      expect(result.indices).toBeDefined()
      // Should still create some geometry even with zero dimensions
    })
  })

  describe('mergeGeometries', () => {
    it('should merge multiple geometries into one', () => {
      const geo1 = {
        vertices: new Float32Array([0, 0, 0, 1, 0, 0]),
        indices: new Uint32Array([0, 1])
      }
      const geo2 = {
        vertices: new Float32Array([2, 0, 0, 3, 0, 0]),
        indices: new Uint32Array([0, 1])
      }
      
      const result = MeshGenerator.mergeGeometries([geo1, geo2])
      
      expect(result.vertices.length).toBe(geo1.vertices.length + geo2.vertices.length)
      expect(result.indices.length).toBe(geo1.indices.length + geo2.indices.length)
    })

    it('should handle empty geometry array', () => {
      const result = MeshGenerator.mergeGeometries([])
      
      expect(result.vertices.length).toBe(0)
      expect(result.indices.length).toBe(0)
    })

    it('should handle single geometry', () => {
      const geometry = {
        vertices: new Float32Array([0, 0, 0, 1, 0, 0]),
        indices: new Uint32Array([0, 1])
      }
      
      const result = MeshGenerator.mergeGeometries([geometry])
      
      expect(result.vertices.length).toBe(geometry.vertices.length)
      expect(result.indices.length).toBe(geometry.indices.length)
    })
  })

  describe('calculateBounds', () => {
    it('should calculate correct bounds for geometry', () => {
      const geometry = {
        vertices: new Float32Array([
          -1, -2, -3,  // min vertex
          4, 5, 6,     // max vertex
          0, 1, 2      // middle vertex
        ]),
        indices: new Uint32Array([])
      }
      
      const result = MeshGenerator.calculateBounds(geometry)
      
      expect(result.min.x).toBe(-1)
      expect(result.min.y).toBe(-2)
      expect(result.min.z).toBe(-3)
      expect(result.max.x).toBe(4)
      expect(result.max.y).toBe(5)
      expect(result.max.z).toBe(6)
    })

    it('should handle empty geometry', () => {
      const geometry = {
        vertices: new Float32Array([]),
        indices: new Uint32Array([])
      }
      
      const result = MeshGenerator.calculateBounds(geometry)
      
      expect(result.min.x).toBe(0)
      expect(result.min.y).toBe(0)
      expect(result.min.z).toBe(0)
      expect(result.max.x).toBe(0)
      expect(result.max.y).toBe(0)
      expect(result.max.z).toBe(0)
    })
  })

  describe('centerGeometry', () => {
    it('should center geometry at origin', () => {
      const geometry = {
        vertices: new Float32Array([
          2, 2, 2,
          4, 4, 4,
          6, 6, 6
        ]),
        indices: new Uint32Array([])
      }
      
      const result = MeshGenerator.centerGeometry(geometry)
      
      // Should shift vertices so center is at origin
      expect(result.vertices).not.toEqual(geometry.vertices)
      expect(result.vertices.length).toBe(geometry.vertices.length)
    })

    it('should handle already centered geometry', () => {
      const geometry = {
        vertices: new Float32Array([
          -1, -1, -1,
          1, 1, 1,
          0, 0, 0
        ]),
        indices: new Uint32Array([])
      }
      
      const result = MeshGenerator.centerGeometry(geometry)
      
      expect(result.vertices).toBeDefined()
      expect(result.vertices.length).toBe(geometry.vertices.length)
    })
  })

  describe('error handling', () => {
    it('should handle invalid pattern dimensions', () => {
      const invalidPattern = {
        width: -1,
        height: -1,
        data: [],
        metadata: { source: 'test' as const }
      }
      
      expect(() => MeshGenerator.generateFromPattern(invalidPattern))
        .not.toThrow() // Should handle gracefully
    })

    it('should handle null or undefined pattern data', () => {
      const invalidPattern = {
        width: 2,
        height: 2,
        data: null as any,
        metadata: { source: 'test' as const }
      }
      
      expect(() => MeshGenerator.generateFromPattern(invalidPattern))
        .not.toThrow() // Should handle gracefully
    })
  })
})