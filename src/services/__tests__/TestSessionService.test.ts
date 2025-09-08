/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TestSessionService, TestSessionError } from '../TestSessionService'
import type { TestSession, TestResult, ParameterPreset, DotPattern, Model3DParams } from '@/types'
import { Model3DService } from '../Model3DService'

// Mock Model3DService
vi.mock('../Model3DService')

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {}
  
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} })
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
})

const mockPattern: DotPattern = {
  data: [[true, false], [false, true]],
  width: 2,
  height: 2,
  metadata: {
    filename: 'test-pattern.csv',
    createdAt: new Date('2024-01-01'),
    modifiedAt: new Date('2024-01-01')
  }
}

const mockParameters: Model3DParams = {
  height: 5,
  depth: 2,
  resolution: 0.1,
  smoothing: true,
  hollowOut: false,
  wallThickness: 1
}

const mockTestResult: TestResult = {
  id: 'result-1',
  testSessionId: 'session-1',
  timestamp: new Date('2024-01-01T10:00:00'),
  pattern: mockPattern,
  parameters: mockParameters,
  success: true,
  processingTime: 1500,
  meshStats: {
    vertexCount: 1000,
    faceCount: 2000,
    edgeCount: 3000,
    boundingBox: { width: 10, height: 5, depth: 2 },
    surfaceArea: 100,
    volume: 50,
    memoryUsage: 1024
  },
  qualityScore: 85,
  performanceMetrics: {
    memoryUsed: 150,
    cpuUsage: 45,
    generationSpeed: 500,
    elapsedTime: 1500
  },
  warnings: [],
  exportedFormats: []
}

describe('TestSessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.clear()
  })

  afterEach(() => {
    mockLocalStorage.clear()
  })

  describe('createSession', () => {
    it('should create a new test session', () => {
      const session = TestSessionService.createSession('Test Session', 'test-user')

      expect(session).toMatchObject({
        name: 'Test Session',
        author: 'test-user',
        status: 'active',
        patterns: [],
        parameterSets: [],
        testResults: [],
        performanceMetrics: [],
        tags: [],
        notes: ''
      })
      expect(session.id).toBeTruthy()
      expect(session.createdAt).toBeInstanceOf(Date)
      expect(session.updatedAt).toBeInstanceOf(Date)
    })

    it('should throw error for empty session name', () => {
      expect(() => {
        TestSessionService.createSession('', 'test-user')
      }).toThrow(TestSessionError)
    })

    it('should throw error for whitespace-only session name', () => {
      expect(() => {
        TestSessionService.createSession('   ', 'test-user')
      }).toThrow(TestSessionError)
    })

    it('should trim session name', () => {
      const session = TestSessionService.createSession('  Test Session  ', 'test-user')
      expect(session.name).toBe('Test Session')
    })

    it('should save session to localStorage', () => {
      TestSessionService.createSession('Test Session', 'test-user')
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'dot23d_test_sessions',
        expect.any(String)
      )
    })
  })

  describe('getSessions', () => {
    it('should return empty array when no sessions exist', () => {
      const sessions = TestSessionService.getSessions()
      expect(sessions).toEqual([])
    })

    it('should return all saved sessions', () => {
      const session1 = TestSessionService.createSession('Session 1', 'user1')
      const session2 = TestSessionService.createSession('Session 2', 'user2')

      const sessions = TestSessionService.getSessions()
      expect(sessions).toHaveLength(2)
      expect(sessions.map(s => s.name)).toEqual(['Session 1', 'Session 2'])
    })

    it('should handle corrupted localStorage gracefully', () => {
      mockLocalStorage.setItem('dot23d_test_sessions', 'invalid-json')
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const sessions = TestSessionService.getSessions()
      
      expect(sessions).toEqual([])
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load test sessions:', expect.any(Error))
      consoleSpy.mockRestore()
    })
  })

  describe('getSession', () => {
    it('should return specific session by ID', () => {
      const session = TestSessionService.createSession('Test Session', 'test-user')
      const retrieved = TestSessionService.getSession(session.id)
      
      expect(retrieved).toEqual(session)
    })

    it('should return null for non-existent session', () => {
      const retrieved = TestSessionService.getSession('non-existent-id')
      expect(retrieved).toBeNull()
    })
  })

  describe('saveSession', () => {
    it('should update existing session', () => {
      const session = TestSessionService.createSession('Test Session', 'test-user')
      session.name = 'Updated Session'
      
      TestSessionService.saveSession(session)
      
      const retrieved = TestSessionService.getSession(session.id)
      expect(retrieved?.name).toBe('Updated Session')
      expect(retrieved?.updatedAt).not.toEqual(session.createdAt)
    })

    it('should throw error for session without ID', () => {
      const session = {
        name: 'Test',
        createdAt: new Date(),
        updatedAt: new Date(),
        patterns: [],
        parameterSets: []
      } as any

      expect(() => {
        TestSessionService.saveSession(session)
      }).toThrow(TestSessionError)
    })

    it('should maintain session limit', () => {
      // Create maximum number of sessions + 1
      for (let i = 0; i <= 50; i++) {
        TestSessionService.createSession(`Session ${i}`, 'test-user')
      }

      const sessions = TestSessionService.getSessions()
      expect(sessions).toHaveLength(50) // Should not exceed limit
    })
  })

  describe('deleteSession', () => {
    it('should delete existing session', () => {
      const session = TestSessionService.createSession('Test Session', 'test-user')
      
      TestSessionService.deleteSession(session.id)
      
      const retrieved = TestSessionService.getSession(session.id)
      expect(retrieved).toBeNull()
    })

    it('should not throw error for non-existent session', () => {
      expect(() => {
        TestSessionService.deleteSession('non-existent-id')
      }).not.toThrow()
    })
  })

  describe('addTestResult', () => {
    it('should add test result to session', () => {
      const session = TestSessionService.createSession('Test Session', 'test-user')
      
      TestSessionService.addTestResult(session.id, mockTestResult)
      
      const updated = TestSessionService.getSession(session.id)
      expect(updated?.testResults).toHaveLength(1)
      expect(updated?.testResults[0]).toEqual(mockTestResult)
    })

    it('should throw error for non-existent session', () => {
      expect(() => {
        TestSessionService.addTestResult('non-existent', mockTestResult)
      }).toThrow(TestSessionError)
    })

    it('should enforce result limit per session', () => {
      const session = TestSessionService.createSession('Test Session', 'test-user')
      
      // Add maximum number of results + 1
      for (let i = 0; i <= 1000; i++) {
        const result = { ...mockTestResult, id: `result-${i}` }
        TestSessionService.addTestResult(session.id, result)
      }

      const updated = TestSessionService.getSession(session.id)
      expect(updated?.testResults).toHaveLength(1000) // Should not exceed limit
    })
  })

  describe('runBulkTest', () => {
    beforeEach(() => {
      vi.mocked(Model3DService.generate3DModel).mockResolvedValue({
        data: {
          mesh: {} as any,
          stats: mockTestResult.meshStats,
          qualityScore: 85
        },
        error: undefined
      })
    })

    it('should run bulk tests for all combinations', async () => {
      const session = TestSessionService.createSession('Test Session', 'test-user')
      session.patterns = [mockPattern]
      session.parameterSets = [mockParameters]
      TestSessionService.saveSession(session)

      const config = {
        patterns: [mockPattern],
        parameterSets: [mockParameters],
        testAllCombinations: true,
        maxConcurrency: 2,
        testTimeout: 10000
      }

      const results = await TestSessionService.runBulkTest(session.id, config)
      
      expect(results).toHaveLength(1)
      expect(results[0].success).toBe(true)
      expect(Model3DService.generate3DModel).toHaveBeenCalledWith(mockPattern, mockParameters)
    })

    it('should handle generation failures gracefully', async () => {
      vi.mocked(Model3DService.generate3DModel).mockResolvedValue({
        data: undefined,
        error: 'Generation failed'
      })

      const session = TestSessionService.createSession('Test Session', 'test-user')
      const config = {
        patterns: [mockPattern],
        parameterSets: [mockParameters],
        testAllCombinations: true,
        maxConcurrency: 1,
        testTimeout: 10000
      }

      const results = await TestSessionService.runBulkTest(session.id, config)
      
      expect(results).toHaveLength(1)
      expect(results[0].success).toBe(false)
      expect(results[0].error).toBe('Generation failed')
    })

    it('should respect concurrency limits', async () => {
      const session = TestSessionService.createSession('Test Session', 'test-user')
      const config = {
        patterns: [mockPattern, mockPattern, mockPattern],
        parameterSets: [mockParameters, mockParameters],
        testAllCombinations: true,
        maxConcurrency: 2,
        testTimeout: 10000
      }

      const startTime = Date.now()
      await TestSessionService.runBulkTest(session.id, config)
      
      expect(Model3DService.generate3DModel).toHaveBeenCalledTimes(6) // 3 patterns × 2 parameter sets
    })
  })

  describe('runParameterSweep', () => {
    beforeEach(() => {
      vi.mocked(Model3DService.generate3DModel).mockResolvedValue({
        data: {
          mesh: {} as any,
          stats: mockTestResult.meshStats,
          qualityScore: 85
        },
        error: undefined
      })
    })

    it('should run parameter sweep with linear steps', async () => {
      const session = TestSessionService.createSession('Test Session', 'test-user')
      const config = {
        parameter: 'height' as keyof Model3DParams,
        startValue: 1,
        endValue: 5,
        steps: 5,
        logarithmic: false
      }

      const results = await TestSessionService.runParameterSweep(session.id, mockPattern, mockParameters, config)
      
      expect(results).toHaveLength(5)
      expect(results[0].parameterValue).toBe(1)
      expect(results[4].parameterValue).toBe(5)
    })

    it('should run parameter sweep with logarithmic steps', async () => {
      const session = TestSessionService.createSession('Test Session', 'test-user')
      const config = {
        parameter: 'resolution' as keyof Model3DParams,
        startValue: 0.01,
        endValue: 1.0,
        steps: 3,
        logarithmic: true
      }

      const results = await TestSessionService.runParameterSweep(session.id, mockPattern, mockParameters, config)
      
      expect(results).toHaveLength(3)
      expect(results[0].parameterValue).toBeCloseTo(0.01)
      expect(results[2].parameterValue).toBeCloseTo(1.0)
    })

    it('should calculate relative performance', async () => {
      const session = TestSessionService.createSession('Test Session', 'test-user')
      const config = {
        parameter: 'height' as keyof Model3DParams,
        startValue: 1,
        endValue: 3,
        steps: 3,
        logarithmic: false
      }

      // Mock different processing times
      vi.mocked(Model3DService.generate3DModel)
        .mockResolvedValueOnce({
          data: { mesh: {} as any, stats: mockTestResult.meshStats, qualityScore: 80 },
          error: undefined
        })
        .mockResolvedValueOnce({
          data: { mesh: {} as any, stats: mockTestResult.meshStats, qualityScore: 85 },
          error: undefined
        })
        .mockResolvedValueOnce({
          data: { mesh: {} as any, stats: mockTestResult.meshStats, qualityScore: 90 },
          error: undefined
        })

      const results = await TestSessionService.runParameterSweep(session.id, mockPattern, mockParameters, config)
      
      expect(results[0].relativePerformance).toBeLessThan(results[2].relativePerformance)
    })
  })

  describe('createParameterPreset', () => {
    it('should create new parameter preset', () => {
      const preset = {
        name: 'High Quality',
        description: 'High quality settings',
        category: 'quality' as const,
        parameters: { height: 10, resolution: 0.05 },
        compatiblePatterns: [],
        recommendedFor: ['detailed models']
      }

      const created = TestSessionService.createParameterPreset(preset, 'test-user')
      
      expect(created).toMatchObject({
        ...preset,
        author: 'test-user',
        usageCount: 0,
        rating: 0
      })
      expect(created.id).toBeTruthy()
      expect(created.createdAt).toBeInstanceOf(Date)
    })

    it('should save preset to localStorage', () => {
      const preset = {
        name: 'Test Preset',
        description: 'Test',
        category: 'custom' as const,
        parameters: {},
        compatiblePatterns: [],
        recommendedFor: []
      }

      TestSessionService.createParameterPreset(preset, 'test-user')
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'dot23d_parameter_presets',
        expect.any(String)
      )
    })
  })

  describe('getParameterPresets', () => {
    it('should return all parameter presets', () => {
      const preset = {
        name: 'Test Preset',
        description: 'Test',
        category: 'custom' as const,
        parameters: {},
        compatiblePatterns: [],
        recommendedFor: []
      }

      TestSessionService.createParameterPreset(preset, 'test-user')
      const presets = TestSessionService.getParameterPresets()
      
      expect(presets).toHaveLength(1)
      expect(presets[0].name).toBe('Test Preset')
    })

    it('should return empty array when no presets exist', () => {
      const presets = TestSessionService.getParameterPresets()
      expect(presets).toEqual([])
    })
  })

  describe('archiveSession', () => {
    it('should archive active session', () => {
      const session = TestSessionService.createSession('Test Session', 'test-user')
      
      TestSessionService.archiveSession(session.id)
      
      const updated = TestSessionService.getSession(session.id)
      expect(updated?.status).toBe('archived')
    })

    it('should throw error for non-existent session', () => {
      expect(() => {
        TestSessionService.archiveSession('non-existent')
      }).toThrow(TestSessionError)
    })
  })

  describe('exportSessionData', () => {
    it('should export session data as JSON', () => {
      const session = TestSessionService.createSession('Test Session', 'test-user')
      session.testResults = [mockTestResult]
      TestSessionService.saveSession(session)

      const exported = TestSessionService.exportSessionData(session.id, 'json')
      
      expect(typeof exported).toBe('string')
      const parsed = JSON.parse(exported)
      expect(parsed.session.name).toBe('Test Session')
      expect(parsed.results).toHaveLength(1)
    })

    it('should export session data as CSV', () => {
      const session = TestSessionService.createSession('Test Session', 'test-user')
      session.testResults = [mockTestResult]
      TestSessionService.saveSession(session)

      const exported = TestSessionService.exportSessionData(session.id, 'csv')
      
      expect(typeof exported).toBe('string')
      expect(exported).toContain('Test ID,Pattern Name,Success')
      expect(exported).toContain('result-1,test-pattern.csv,true')
    })
  })

  describe('performance and error scenarios', () => {
    it('should handle large number of concurrent operations', async () => {
      const session = TestSessionService.createSession('Test Session', 'test-user')
      const promises = []

      // Simulate concurrent operations
      for (let i = 0; i < 100; i++) {
        promises.push(Promise.resolve().then(() => {
          const result = { ...mockTestResult, id: `result-${i}` }
          TestSessionService.addTestResult(session.id, result)
        }))
      }

      await Promise.all(promises)
      
      const updated = TestSessionService.getSession(session.id)
      expect(updated?.testResults.length).toBe(100)
    })

    it('should handle localStorage quota exceeded', () => {
      // Mock localStorage to throw quota exceeded error
      mockLocalStorage.setItem.mockImplementationOnce(() => {
        throw new Error('QuotaExceededError')
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      expect(() => {
        TestSessionService.createSession('Test Session', 'test-user')
      }).toThrow('Failed to save session')
      
      consoleSpy.mockRestore()
    })

    it('should handle network timeouts in bulk operations', async () => {
      vi.mocked(Model3DService.generate3DModel).mockImplementation(() => 
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      )

      const session = TestSessionService.createSession('Test Session', 'test-user')
      const config = {
        patterns: [mockPattern],
        parameterSets: [mockParameters],
        testAllCombinations: true,
        maxConcurrency: 1,
        testTimeout: 50 // Very short timeout
      }

      const results = await TestSessionService.runBulkTest(session.id, config)
      
      expect(results[0].success).toBe(false)
      expect(results[0].error).toContain('timeout')
    })

    it('should maintain data integrity under concurrent access', async () => {
      const session = TestSessionService.createSession('Test Session', 'test-user')
      
      // Simulate concurrent updates
      const promises = Array.from({ length: 10 }, (_, i) => 
        Promise.resolve().then(() => {
          const currentSession = TestSessionService.getSession(session.id)!
          currentSession.notes = `Updated ${i}`
          TestSessionService.saveSession(currentSession)
        })
      )

      await Promise.all(promises)
      
      const final = TestSessionService.getSession(session.id)
      expect(final?.notes).toMatch(/Updated \d/)
    })
  })
})