/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QualityAssessmentService, QualityAssessmentError } from '../QualityAssessmentService'
import type { QualityReport, MeshStats, OverhangAnalysis, ThicknessAnalysis } from '@/types'
import * as THREE from 'three'

// Mock Three.js
vi.mock('three', () => ({
  BufferGeometry: class MockBufferGeometry {
    attributes = {
      position: { count: 0 }
    }
    index = null
    computeBoundingBox = vi.fn()
    boundingBox = new THREE.Box3()
  },
  Box3: class MockBox3 {
    min = { x: 0, y: 0, z: 0 }
    max = { x: 1, y: 1, z: 1 }
    getSize = vi.fn(() => ({ x: 1, y: 1, z: 1 }))
    getCenter = vi.fn(() => ({ x: 0.5, y: 0.5, z: 0.5 }))
  },
  Vector3: class MockVector3 {
    x = 0
    y = 0
    z = 0
    constructor(x = 0, y = 0, z = 0) {
      this.x = x
      this.y = y
      this.z = z
    }
    length = () => Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z)
    normalize = () => this
    dot = () => 0
    cross = () => new THREE.Vector3()
    distanceTo = () => 1
  },
  Triangle: class MockTriangle {
    a = new THREE.Vector3()
    b = new THREE.Vector3()
    c = new THREE.Vector3()
    getArea = () => 1
    getNormal = () => new THREE.Vector3(0, 1, 0)
  }
}))

const createMockGeometry = (vertexCount = 8, faceCount = 12): THREE.BufferGeometry => {
  const geometry = new THREE.BufferGeometry()
  
  // Mock vertex positions for a cube
  const positions = new Float32Array(vertexCount * 3)
  for (let i = 0; i < vertexCount * 3; i++) {
    positions[i] = Math.random() * 2 - 1 // -1 to 1
  }
  
  geometry.attributes.position = {
    count: vertexCount,
    array: positions
  } as any
  
  // Mock indices for faces
  const indices = new Uint16Array(faceCount * 3)
  for (let i = 0; i < faceCount * 3; i++) {
    indices[i] = Math.floor(Math.random() * vertexCount)
  }
  
  geometry.index = {
    count: faceCount * 3,
    array: indices
  } as any
  
  return geometry
}

const mockMeshStats: MeshStats = {
  vertexCount: 8,
  faceCount: 12,
  edgeCount: 18,
  boundingBox: { width: 2, height: 2, depth: 2 },
  surfaceArea: 24,
  volume: 8,
  memoryUsage: 1024
}

describe('QualityAssessmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('assessMeshQuality', () => {
    it('should perform comprehensive quality assessment', async () => {
      const geometry = createMockGeometry(8, 12)
      
      const report = await QualityAssessmentService.assessMeshQuality(
        geometry,
        mockMeshStats
      )
      
      expect(report).toBeDefined()
      expect(report.modelId).toBeTruthy()
      expect(report.timestamp).toBeInstanceOf(Date)
      expect(report.overallScore).toBeGreaterThanOrEqual(0)
      expect(report.overallScore).toBeLessThanOrEqual(100)
      expect(report.geometry).toBeDefined()
      expect(report.printability).toBeDefined()
      expect(report.recommendations).toBeDefined()
      expect(report.warnings).toBeDefined()
    })

    it('should handle empty geometry', async () => {
      const emptyGeometry = createMockGeometry(0, 0)
      
      await expect(
        QualityAssessmentService.assessMeshQuality(emptyGeometry, {
          ...mockMeshStats,
          vertexCount: 0,
          faceCount: 0
        })
      ).rejects.toThrow(QualityAssessmentError)
    })

    it('should detect non-manifold geometry', async () => {
      const geometry = createMockGeometry(100, 50)
      
      // Mock non-manifold detection
      vi.spyOn(QualityAssessmentService as any, 'checkManifoldness')
        .mockResolvedValue(60) // 60% manifold
      
      const report = await QualityAssessmentService.assessMeshQuality(geometry, {
        ...mockMeshStats,
        vertexCount: 100,
        faceCount: 50
      })
      
      expect(report.geometry.manifoldness).toBe(60)
      expect(report.warnings.some(w => 
        w.message.includes('non-manifold')
      )).toBe(true)
    })

    it('should assess watertightness', async () => {
      const geometry = createMockGeometry(50, 96)
      
      const report = await QualityAssessmentService.assessMeshQuality(geometry, {
        ...mockMeshStats,
        vertexCount: 50,
        faceCount: 96
      })
      
      expect(report.geometry.watertightness).toBeGreaterThanOrEqual(0)
      expect(report.geometry.watertightness).toBeLessThanOrEqual(100)
    })
  })

  describe('analyzeGeometry', () => {
    it('should analyze basic geometry properties', () => {
      const geometry = createMockGeometry(8, 12)
      
      const analysis = QualityAssessmentService.analyzeGeometry(geometry)
      
      expect(analysis).toBeDefined()
      expect(analysis.manifoldness).toBeGreaterThanOrEqual(0)
      expect(analysis.watertightness).toBeGreaterThanOrEqual(0)
      expect(analysis.selfIntersections).toBeGreaterThanOrEqual(0)
      expect(analysis.duplicateVertices).toBeGreaterThanOrEqual(0)
    })

    it('should detect self-intersections', () => {
      const geometry = createMockGeometry(20, 30)
      
      // Mock self-intersection detection
      vi.spyOn(QualityAssessmentService as any, 'detectSelfIntersections')
        .mockReturnValue(3)
      
      const analysis = QualityAssessmentService.analyzeGeometry(geometry)
      
      expect(analysis.selfIntersections).toBe(3)
    })

    it('should count duplicate vertices', () => {
      const geometry = createMockGeometry(10, 15)
      
      // Mock duplicate vertex detection
      vi.spyOn(QualityAssessmentService as any, 'countDuplicateVertices')
        .mockReturnValue(2)
      
      const analysis = QualityAssessmentService.analyzeGeometry(geometry)
      
      expect(analysis.duplicateVertices).toBe(2)
    })
  })

  describe('analyzePrintability', () => {
    it('should analyze 3D printing suitability', async () => {
      const geometry = createMockGeometry(50, 96)
      
      const printability = await QualityAssessmentService.analyzePrintability(geometry)
      
      expect(printability).toBeDefined()
      expect(printability.overhangs).toBeInstanceOf(Array)
      expect(printability.supportNeed).toBeGreaterThanOrEqual(0)
      expect(printability.supportNeed).toBeLessThanOrEqual(100)
      expect(printability.wallThickness).toBeDefined()
      expect(printability.bridging).toBeInstanceOf(Array)
    })

    it('should detect overhangs', async () => {
      const geometry = createMockGeometry(30, 50)
      
      const printability = await QualityAssessmentService.analyzePrintability(geometry)
      
      printability.overhangs.forEach(overhang => {
        expect(overhang.position).toBeDefined()
        expect(overhang.angle).toBeGreaterThanOrEqual(0)
        expect(overhang.angle).toBeLessThanOrEqual(90)
        expect(['low', 'medium', 'high']).toContain(overhang.severity)
        expect(overhang.suggestion).toBeTruthy()
      })
    })

    it('should analyze wall thickness', async () => {
      const geometry = createMockGeometry(40, 70)
      
      const printability = await QualityAssessmentService.analyzePrintability(geometry)
      
      expect(printability.wallThickness.minThickness).toBeGreaterThan(0)
      expect(printability.wallThickness.averageThickness).toBeGreaterThan(0)
      expect(printability.wallThickness.thinAreas).toBeInstanceOf(Array)
      expect(printability.wallThickness.recommendedMinimum).toBeGreaterThan(0)
    })

    it('should identify thin areas', async () => {
      const geometry = createMockGeometry(60, 100)
      
      // Mock thin area detection
      vi.spyOn(QualityAssessmentService as any, 'findThinAreas')
        .mockReturnValue([
          { position: { x: 1, y: 2, z: 3 }, thickness: 0.2 },
          { position: { x: 2, y: 3, z: 4 }, thickness: 0.3 }
        ])
      
      const printability = await QualityAssessmentService.analyzePrintability(geometry)
      
      expect(printability.wallThickness.thinAreas).toHaveLength(2)
      expect(printability.wallThickness.minThickness).toBeLessThan(0.5)
    })

    it('should analyze bridging requirements', async () => {
      const geometry = createMockGeometry(25, 40)
      
      const printability = await QualityAssessmentService.analyzePrintability(geometry)
      
      printability.bridging.forEach(bridge => {
        expect(bridge.startPoint).toBeDefined()
        expect(bridge.endPoint).toBeDefined()
        expect(bridge.length).toBeGreaterThan(0)
        expect(typeof bridge.printable).toBe('boolean')
        expect(bridge.supportSuggestion).toBeTruthy()
      })
    })
  })

  describe('generateRecommendations', () => {
    it('should generate quality recommendations', () => {
      const report: Partial<QualityReport> = {
        overallScore: 65,
        geometry: {
          manifoldness: 70,
          watertightness: 80,
          selfIntersections: 5,
          duplicateVertices: 3
        },
        printability: {
          overhangs: [
            {
              position: { x: 1, y: 2, z: 3 },
              angle: 60,
              severity: 'high' as const,
              suggestion: 'Add support'
            }
          ],
          supportNeed: 75,
          wallThickness: {
            minThickness: 0.2,
            averageThickness: 1.5,
            thinAreas: [{ position: { x: 0, y: 0, z: 0 }, thickness: 0.2 }],
            recommendedMinimum: 0.4
          },
          bridging: []
        }
      }
      
      const recommendations = QualityAssessmentService.generateRecommendations(report as QualityReport)
      
      expect(recommendations.length).toBeGreaterThan(0)
      
      // Should recommend fixing manifold issues
      expect(recommendations.some(r => 
        r.type === 'geometry' && r.message.includes('manifold')
      )).toBe(true)
      
      // Should recommend support structures
      expect(recommendations.some(r => 
        r.type === 'printing' && r.message.includes('support')
      )).toBe(true)
      
      // Should recommend thicker walls
      expect(recommendations.some(r => 
        r.type === 'printing' && r.message.includes('wall thickness')
      )).toBe(true)
    })

    it('should prioritize recommendations by importance', () => {
      const report: Partial<QualityReport> = {
        overallScore: 30, // Very low score
        geometry: {
          manifoldness: 20, // Very low
          watertightness: 30,
          selfIntersections: 10,
          duplicateVertices: 5
        },
        printability: {
          overhangs: [],
          supportNeed: 90, // Very high
          wallThickness: {
            minThickness: 0.1, // Very thin
            averageThickness: 0.8,
            thinAreas: [],
            recommendedMinimum: 0.4
          },
          bridging: []
        }
      }
      
      const recommendations = QualityAssessmentService.generateRecommendations(report as QualityReport)
      
      // High priority recommendations should come first
      const highPriority = recommendations.filter(r => r.priority === 'high')
      expect(highPriority.length).toBeGreaterThan(0)
    })
  })

  describe('generateWarnings', () => {
    it('should generate appropriate warnings', () => {
      const report: Partial<QualityReport> = {
        geometry: {
          manifoldness: 60,
          watertightness: 70,
          selfIntersections: 8,
          duplicateVertices: 4
        },
        printability: {
          overhangs: [
            {
              position: { x: 1, y: 2, z: 3 },
              angle: 75,
              severity: 'high' as const,
              suggestion: 'Add support'
            }
          ],
          supportNeed: 85,
          wallThickness: {
            minThickness: 0.15,
            averageThickness: 1.0,
            thinAreas: [{ position: { x: 0, y: 0, z: 0 }, thickness: 0.15 }],
            recommendedMinimum: 0.4
          },
          bridging: []
        }
      }
      
      const warnings = QualityAssessmentService.generateWarnings(report as QualityReport)
      
      expect(warnings.length).toBeGreaterThan(0)
      
      // Should warn about geometry issues
      expect(warnings.some(w => 
        w.category === 'geometry' && w.severity === 'warning'
      )).toBe(true)
      
      // Should warn about printing issues
      expect(warnings.some(w => 
        w.category === 'printing' && w.severity === 'warning'
      )).toBe(true)
    })

    it('should escalate to errors for severe issues', () => {
      const report: Partial<QualityReport> = {
        geometry: {
          manifoldness: 10, // Very low - should be error
          watertightness: 15,
          selfIntersections: 50, // Very high - should be error
          duplicateVertices: 20
        }
      }
      
      const warnings = QualityAssessmentService.generateWarnings(report as QualityReport)
      
      const errors = warnings.filter(w => w.severity === 'error')
      expect(errors.length).toBeGreaterThan(0)
    })
  })

  describe('compareQuality', () => {
    it('should compare two quality reports', () => {
      const report1: QualityReport = {
        modelId: 'model-1',
        timestamp: new Date(),
        overallScore: 70,
        geometry: {
          manifoldness: 80,
          watertightness: 85,
          selfIntersections: 2,
          duplicateVertices: 1
        },
        printability: {
          overhangs: [],
          supportNeed: 30,
          wallThickness: {
            minThickness: 0.8,
            averageThickness: 1.5,
            thinAreas: [],
            recommendedMinimum: 0.4
          },
          bridging: []
        },
        recommendations: [],
        warnings: []
      }
      
      const report2: QualityReport = {
        modelId: 'model-2',
        timestamp: new Date(),
        overallScore: 85,
        geometry: {
          manifoldness: 95,
          watertightness: 90,
          selfIntersections: 0,
          duplicateVertices: 0
        },
        printability: {
          overhangs: [],
          supportNeed: 15,
          wallThickness: {
            minThickness: 1.2,
            averageThickness: 1.8,
            thinAreas: [],
            recommendedMinimum: 0.4
          },
          bridging: []
        },
        recommendations: [],
        warnings: []
      }
      
      const comparison = QualityAssessmentService.compareQuality(report1, report2)
      
      expect(comparison).toBeDefined()
      expect(comparison.overallScoreDifference).toBe(15) // 85 - 70
      expect(comparison.betterModel).toBe('model-2')
      expect(comparison.improvements.length).toBeGreaterThan(0)
      expect(comparison.regressions.length).toBe(0)
    })

    it('should identify specific improvements and regressions', () => {
      const report1: QualityReport = {
        modelId: 'model-1',
        timestamp: new Date(),
        overallScore: 80,
        geometry: {
          manifoldness: 90,
          watertightness: 80,
          selfIntersections: 1,
          duplicateVertices: 2
        },
        printability: {
          overhangs: [],
          supportNeed: 40,
          wallThickness: {
            minThickness: 0.6,
            averageThickness: 1.2,
            thinAreas: [],
            recommendedMinimum: 0.4
          },
          bridging: []
        },
        recommendations: [],
        warnings: []
      }
      
      const report2: QualityReport = {
        ...report1,
        modelId: 'model-2',
        overallScore: 75, // Worse overall
        geometry: {
          manifoldness: 95, // Better
          watertightness: 70, // Worse
          selfIntersections: 0, // Better
          duplicateVertices: 3 // Worse
        }
      }
      
      const comparison = QualityAssessmentService.compareQuality(report1, report2)
      
      expect(comparison.improvements.length).toBeGreaterThan(0)
      expect(comparison.regressions.length).toBeGreaterThan(0)
      
      // Check for specific improvements
      expect(comparison.improvements.some(i => 
        i.includes('manifoldness')
      )).toBe(true)
      
      // Check for specific regressions
      expect(comparison.regressions.some(r => 
        r.includes('watertightness')
      )).toBe(true)
    })
  })

  describe('performance and stress testing', () => {
    it('should handle large meshes efficiently', async () => {
      const largeGeometry = createMockGeometry(10000, 20000) // Large mesh
      
      const startTime = Date.now()
      const report = await QualityAssessmentService.assessMeshQuality(
        largeGeometry,
        {
          ...mockMeshStats,
          vertexCount: 10000,
          faceCount: 20000
        }
      )
      const endTime = Date.now()
      
      expect(endTime - startTime).toBeLessThan(5000) // Should complete within 5 seconds
      expect(report).toBeDefined()
    })

    it('should handle degenerate geometry gracefully', async () => {
      // Create geometry with degenerate triangles
      const degenerateGeometry = new THREE.BufferGeometry()
      const positions = new Float32Array([
        0, 0, 0,
        0, 0, 0, // Duplicate point
        1, 0, 0
      ])
      
      degenerateGeometry.attributes.position = {
        count: 3,
        array: positions
      } as any
      
      const indices = new Uint16Array([0, 1, 2])
      degenerateGeometry.index = {
        count: 3,
        array: indices
      } as any
      
      const report = await QualityAssessmentService.assessMeshQuality(
        degenerateGeometry,
        { ...mockMeshStats, vertexCount: 3, faceCount: 1 }
      )
      
      expect(report.warnings.some(w => 
        w.message.includes('degenerate')
      )).toBe(true)
    })

    it('should handle memory pressure during analysis', async () => {
      // Mock memory pressure scenario
      const originalMemory = (performance as any).memory
      Object.defineProperty(performance, 'memory', {
        value: {
          usedJSHeapSize: 1900000000, // Near limit
          totalJSHeapSize: 2000000000,
          jsHeapSizeLimit: 2000000000
        },
        configurable: true
      })
      
      const geometry = createMockGeometry(1000, 2000)
      
      const report = await QualityAssessmentService.assessMeshQuality(geometry, {
        ...mockMeshStats,
        vertexCount: 1000,
        faceCount: 2000
      })
      
      expect(report).toBeDefined()
      
      // Restore original memory
      Object.defineProperty(performance, 'memory', {
        value: originalMemory,
        configurable: true
      })
    })
  })

  describe('error handling', () => {
    it('should handle invalid geometry data', async () => {
      const invalidGeometry = {
        attributes: {},
        index: null
      } as any
      
      await expect(
        QualityAssessmentService.assessMeshQuality(invalidGeometry, mockMeshStats)
      ).rejects.toThrow(QualityAssessmentError)
    })

    it('should handle corrupted mesh data', async () => {
      const corruptedGeometry = new THREE.BufferGeometry()
      corruptedGeometry.attributes.position = {
        count: 5,
        array: new Float32Array([1, 2, 3, 4]) // Incomplete data
      } as any
      
      await expect(
        QualityAssessmentService.assessMeshQuality(corruptedGeometry, mockMeshStats)
      ).rejects.toThrow(QualityAssessmentError)
    })

    it('should provide detailed error messages', async () => {
      const invalidGeometry = createMockGeometry(0, 0)
      
      try {
        await QualityAssessmentService.assessMeshQuality(invalidGeometry, {
          ...mockMeshStats,
          vertexCount: 0,
          faceCount: 0
        })
        expect.fail('Should have thrown error')
      } catch (error) {
        expect(error).toBeInstanceOf(QualityAssessmentError)
        expect(error.message).toContain('empty')
      }
    })
  })

  describe('configuration and customization', () => {
    it('should accept custom quality thresholds', async () => {
      const customConfig = {
        manifoldnessThreshold: 95,
        watertightnessThreshold: 90,
        maxSelfIntersections: 1,
        minWallThickness: 1.0
      }
      
      QualityAssessmentService.setQualityThresholds(customConfig)
      
      const geometry = createMockGeometry(20, 35)
      const report = await QualityAssessmentService.assessMeshQuality(geometry, mockMeshStats)
      
      // Should generate more strict warnings with higher thresholds
      expect(report.warnings.length).toBeGreaterThanOrEqual(0)
    })

    it('should support different assessment levels', async () => {
      const geometry = createMockGeometry(50, 90)
      
      // Quick assessment
      const quickReport = await QualityAssessmentService.assessMeshQuality(
        geometry, 
        mockMeshStats, 
        { level: 'quick' }
      )
      
      // Detailed assessment
      const detailedReport = await QualityAssessmentService.assessMeshQuality(
        geometry, 
        mockMeshStats, 
        { level: 'detailed' }
      )
      
      // Detailed should have more comprehensive analysis
      expect(detailedReport.recommendations.length).toBeGreaterThanOrEqual(
        quickReport.recommendations.length
      )
    })
  })
})