import type { 
  TestSession, 
  TestResult, 
  ParameterPreset, 
  DotPattern, 
  Model3DParams,
  BulkTestConfig,
  SweepConfig,
  SweepResult,
  TestSuite,
  TestSuiteResult
} from '@/types'
import { Model3DService } from './Model3DService'

/**
 * Custom error for test session operations
 */
export class TestSessionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TestSessionError'
  }
}

/**
 * Service for managing test sessions, parameter presets, and test execution
 */
export class TestSessionService {
  private static readonly STORAGE_KEY_SESSIONS = 'dot23d_test_sessions'
  private static readonly STORAGE_KEY_PRESETS = 'dot23d_parameter_presets'
  private static readonly STORAGE_KEY_SUITES = 'dot23d_test_suites'
  private static readonly MAX_SESSIONS = 50
  private static readonly MAX_RESULTS_PER_SESSION = 1000

  /**
   * Create a new test session
   */
  static createSession(name: string, author: string): TestSession {
    if (!name.trim()) {
      throw new TestSessionError('Session name cannot be empty')
    }

    const session: TestSession = {
      id: this.generateId(),
      name: name.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
      patterns: [],
      parameterSets: [],
      testResults: [],
      performanceMetrics: [],
      tags: [],
      notes: '',
      author: author || 'unknown'
    }

    this.saveSession(session)
    return session
  }

  /**
   * Get all test sessions
   */
  static getSessions(): TestSession[] {
    try {
      const sessionsJson = localStorage.getItem(this.STORAGE_KEY_SESSIONS)
      if (!sessionsJson) return []

      const sessions = JSON.parse(sessionsJson) as TestSession[]
      return sessions.map(this.deserializeSession)
    } catch (error) {
      console.error('Failed to load test sessions:', error)
      return []
    }
  }

  /**
   * Get a specific test session by ID
   */
  static getSession(id: string): TestSession | null {
    const sessions = this.getSessions()
    return sessions.find(session => session.id === id) || null
  }

  /**
   * Save or update a test session
   */
  static saveSession(session: TestSession): void {
    if (!session.id) {
      throw new TestSessionError('Session must have an ID')
    }

    try {
      const sessions = this.getSessions()
      const existingIndex = sessions.findIndex(s => s.id === session.id)

      // Update timestamp
      session.updatedAt = new Date()

      if (existingIndex >= 0) {
        sessions[existingIndex] = session
      } else {
        sessions.push(session)
      }

      // Maintain maximum sessions limit
      if (sessions.length > this.MAX_SESSIONS) {
        sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        sessions.splice(this.MAX_SESSIONS)
      }

      const serializedSessions = sessions.map(this.serializeSession)
      localStorage.setItem(this.STORAGE_KEY_SESSIONS, JSON.stringify(serializedSessions))
    } catch (error) {
      throw new TestSessionError(`Failed to save session: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Delete a test session
   */
  static deleteSession(id: string): boolean {
    try {
      const sessions = this.getSessions()
      const filteredSessions = sessions.filter(s => s.id !== id)
      
      if (filteredSessions.length === sessions.length) {
        return false // Session not found
      }

      const serializedSessions = filteredSessions.map(this.serializeSession)
      localStorage.setItem(this.STORAGE_KEY_SESSIONS, JSON.stringify(serializedSessions))
      return true
    } catch (error) {
      console.error('Failed to delete session:', error)
      return false
    }
  }

  /**
   * Archive a test session
   */
  static archiveSession(id: string): void {
    const session = this.getSession(id)
    if (!session) {
      throw new TestSessionError('Session not found')
    }

    session.status = 'archived'
    this.saveSession(session)
  }

  /**
   * Add a test result to a session
   */
  static addTestResult(sessionId: string, result: TestResult): void {
    const session = this.getSession(sessionId)
    if (!session) {
      throw new TestSessionError('Session not found')
    }

    // Ensure result belongs to this session
    result.testSessionId = sessionId

    session.testResults.push(result)

    // Maintain maximum results limit per session
    if (session.testResults.length > this.MAX_RESULTS_PER_SESSION) {
      session.testResults.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      session.testResults.splice(this.MAX_RESULTS_PER_SESSION)
    }

    this.saveSession(session)
  }

  /**
   * Get test results for a session with filtering options
   */
  static getTestResults(
    sessionId: string, 
    filters?: {
      success?: boolean
      dateRange?: { start: Date; end: Date }
      patternName?: string
    }
  ): TestResult[] {
    const session = this.getSession(sessionId)
    if (!session) return []

    let results = session.testResults

    if (filters) {
      if (filters.success !== undefined) {
        results = results.filter(r => r.success === filters.success)
      }

      if (filters.dateRange) {
        results = results.filter(r => 
          r.timestamp >= filters.dateRange!.start && 
          r.timestamp <= filters.dateRange!.end
        )
      }

      if (filters.patternName) {
        results = results.filter(r => 
          r.pattern.metadata?.filename?.includes(filters.patternName!) ||
          false
        )
      }
    }

    return results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  /**
   * Run a single test with the given pattern and parameters
   */
  static async runTest(
    sessionId: string,
    pattern: DotPattern,
    parameters: Model3DParams,
    onProgress?: (progress: number) => void
  ): Promise<TestResult> {
    const startTime = Date.now()
    const testId = this.generateId()

    try {
      // Validate inputs
      const paramErrors = Model3DService.validate3DParams(parameters)
      if (paramErrors.length > 0) {
        throw new Error(`Invalid parameters: ${paramErrors.join(', ')}`)
      }

      onProgress?.(10) // Validation complete

      // Generate mesh
      const mesh = Model3DService.generateMesh(pattern, parameters)
      onProgress?.(60) // Mesh generation complete

      // Get mesh statistics
      const meshStats = Model3DService.getMeshStats(mesh)
      onProgress?.(80) // Stats calculation complete

      // Calculate quality score (simplified)
      const qualityScore = this.calculateQualityScore(meshStats, parameters)
      onProgress?.(90) // Quality assessment complete

      const processingTime = Date.now() - startTime

      const result: TestResult = {
        id: testId,
        testSessionId: sessionId,
        timestamp: new Date(),
        pattern,
        parameters,
        success: true,
        processingTime,
        meshStats,
        qualityScore,
        performanceMetrics: {
          memoryUsed: this.estimateMemoryUsage(meshStats),
          cpuUsage: 50, // Simplified
          generationSpeed: meshStats.vertexCount / (processingTime / 1000),
          elapsedTime: processingTime
        },
        warnings: [],
        exportedFormats: []
      }

      onProgress?.(100) // Complete

      this.addTestResult(sessionId, result)
      return result

    } catch (error) {
      const processingTime = Date.now() - startTime
      const failureResult: TestResult = {
        id: testId,
        testSessionId: sessionId,
        timestamp: new Date(),
        pattern,
        parameters,
        success: false,
        processingTime,
        meshStats: {
          vertexCount: 0,
          faceCount: 0,
          edgeCount: 0,
          boundingBox: { width: 0, height: 0, depth: 0 },
          surfaceArea: 0,
          volume: 0,
          memoryUsage: 0
        },
        qualityScore: 0,
        performanceMetrics: {
          memoryUsed: 0,
          cpuUsage: 0,
          generationSpeed: 0,
          elapsedTime: processingTime
        },
        error: error instanceof Error ? error.message : 'Unknown error',
        warnings: [],
        exportedFormats: []
      }

      this.addTestResult(sessionId, failureResult)
      throw new TestSessionError(`Test execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Run bulk tests with multiple pattern and parameter combinations
   */
  static async runBulkTest(
    sessionId: string,
    config: BulkTestConfig,
    onProgress?: (current: number, total: number, currentTest?: string) => void
  ): Promise<TestResult[]> {
    const results: TestResult[] = []
    const combinations: Array<{ pattern: DotPattern; params: Model3DParams }> = []

    // Generate all combinations
    if (config.testAllCombinations) {
      config.patterns.forEach(pattern => {
        config.parameterSets.forEach(params => {
          combinations.push({ pattern, params })
        })
      })
    } else {
      // Test patterns and parameter sets in sequence
      const maxLength = Math.max(config.patterns.length, config.parameterSets.length)
      for (let i = 0; i < maxLength; i++) {
        const pattern = config.patterns[i % config.patterns.length]
        const params = config.parameterSets[i % config.parameterSets.length]
        combinations.push({ pattern, params })
      }
    }

    let completed = 0
    const total = combinations.length

    // Process tests with concurrency control
    const processTest = async (combo: { pattern: DotPattern; params: Model3DParams }) => {
      const patternName = combo.pattern.metadata?.filename || `Pattern ${combinations.indexOf(combo) + 1}`
      onProgress?.(completed, total, patternName)

      try {
        const result = await this.runTest(sessionId, combo.pattern, combo.params)
        results.push(result)
      } catch (error) {
        // Individual test failures don't stop bulk execution
        console.error(`Test failed for ${patternName}:`, error)
      }

      completed++
      onProgress?.(completed, total, patternName)
    }

    // Execute with concurrency limit
    const concurrency = Math.min(config.maxConcurrency || 3, combinations.length)
    const batches: Array<{ pattern: DotPattern; params: Model3DParams }[]> = []
    
    for (let i = 0; i < combinations.length; i += concurrency) {
      batches.push(combinations.slice(i, i + concurrency))
    }

    for (const batch of batches) {
      await Promise.all(batch.map(processTest))
    }

    return results
  }

  /**
   * Run parameter sweep test
   */
  static async runParameterSweep(
    sessionId: string,
    pattern: DotPattern,
    baseParams: Model3DParams,
    sweepConfig: SweepConfig,
    onProgress?: (current: number, total: number) => void
  ): Promise<SweepResult[]> {
    const results: SweepResult[] = []
    const values: number[] = []

    // Generate parameter values
    if (sweepConfig.logarithmic) {
      const logStart = Math.log10(sweepConfig.startValue)
      const logEnd = Math.log10(sweepConfig.endValue)
      const logStep = (logEnd - logStart) / (sweepConfig.steps - 1)
      
      for (let i = 0; i < sweepConfig.steps; i++) {
        values.push(Math.pow(10, logStart + i * logStep))
      }
    } else {
      const step = (sweepConfig.endValue - sweepConfig.startValue) / (sweepConfig.steps - 1)
      for (let i = 0; i < sweepConfig.steps; i++) {
        values.push(sweepConfig.startValue + i * step)
      }
    }

    for (let i = 0; i < values.length; i++) {
      const value = values[i]
      const testParams = { ...baseParams, [sweepConfig.parameter]: value }
      
      onProgress?.(i, values.length)

      try {
        const testResult = await this.runTest(sessionId, pattern, testParams)
        
        // Calculate relative performance (simplified)
        const relativePerformance = testResult.processingTime > 0 
          ? (1000 / testResult.processingTime) * 100 
          : 0

        results.push({
          parameterValue: value,
          testResult,
          relativePerformance
        })
      } catch (error) {
        console.error(`Sweep test failed for ${sweepConfig.parameter}=${value}:`, error)
      }
    }

    onProgress?.(values.length, values.length)
    return results
  }

  /**
   * Parameter preset management
   */
  static getParameterPresets(): ParameterPreset[] {
    try {
      const presetsJson = localStorage.getItem(this.STORAGE_KEY_PRESETS)
      if (!presetsJson) return this.getDefaultPresets()

      const presets = JSON.parse(presetsJson) as ParameterPreset[]
      return presets.map(preset => ({
        ...preset,
        createdAt: new Date(preset.createdAt)
      }))
    } catch (error) {
      console.error('Failed to load parameter presets:', error)
      return this.getDefaultPresets()
    }
  }

  /**
   * Save parameter preset
   */
  static saveParameterPreset(preset: ParameterPreset): void {
    try {
      const presets = this.getParameterPresets()
      const existingIndex = presets.findIndex(p => p.id === preset.id)

      if (existingIndex >= 0) {
        presets[existingIndex] = preset
      } else {
        presets.push(preset)
      }

      localStorage.setItem(this.STORAGE_KEY_PRESETS, JSON.stringify(presets))
    } catch (error) {
      throw new TestSessionError(`Failed to save preset: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Delete parameter preset
   */
  static deleteParameterPreset(id: string): boolean {
    try {
      const presets = this.getParameterPresets()
      const filteredPresets = presets.filter(p => p.id !== id)
      
      if (filteredPresets.length === presets.length) {
        return false // Preset not found
      }

      localStorage.setItem(this.STORAGE_KEY_PRESETS, JSON.stringify(filteredPresets))
      return true
    } catch (error) {
      console.error('Failed to delete preset:', error)
      return false
    }
  }

  /**
   * Generate session statistics
   */
  static getSessionStatistics(sessionId: string): {
    totalTests: number
    successRate: number
    averageProcessingTime: number
    averageQualityScore: number
    totalPatterns: number
    uniqueParameterSets: number
  } {
    const session = this.getSession(sessionId)
    if (!session) {
      return {
        totalTests: 0,
        successRate: 0,
        averageProcessingTime: 0,
        averageQualityScore: 0,
        totalPatterns: 0,
        uniqueParameterSets: 0
      }
    }

    const results = session.testResults
    const successfulResults = results.filter(r => r.success)

    return {
      totalTests: results.length,
      successRate: results.length > 0 ? (successfulResults.length / results.length) * 100 : 0,
      averageProcessingTime: successfulResults.length > 0 
        ? successfulResults.reduce((sum, r) => sum + r.processingTime, 0) / successfulResults.length
        : 0,
      averageQualityScore: successfulResults.length > 0 
        ? successfulResults.reduce((sum, r) => sum + r.qualityScore, 0) / successfulResults.length
        : 0,
      totalPatterns: session.patterns.length,
      uniqueParameterSets: session.parameterSets.length
    }
  }

  /**
   * Private helper methods
   */

  private static generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private static serializeSession(session: TestSession): any {
    return {
      ...session,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      testResults: session.testResults.map(result => ({
        ...result,
        timestamp: result.timestamp.toISOString()
      })),
      performanceMetrics: session.performanceMetrics.map(metric => ({
        ...metric,
        timestamp: metric.timestamp.toISOString()
      }))
    }
  }

  private static deserializeSession(data: any): TestSession {
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      testResults: data.testResults.map((result: any) => ({
        ...result,
        timestamp: new Date(result.timestamp)
      })),
      performanceMetrics: data.performanceMetrics.map((metric: any) => ({
        ...metric,
        timestamp: new Date(metric.timestamp)
      }))
    }
  }

  private static calculateQualityScore(meshStats: any, params: Model3DParams): number {
    // Simplified quality scoring algorithm
    let score = 100

    // Penalize for excessive complexity
    if (meshStats.vertexCount > 100000) {
      score -= 20
    } else if (meshStats.vertexCount > 50000) {
      score -= 10
    }

    // Reward mesh optimization
    if (params.optimizeMesh) {
      score += 5
    }

    // Reward merged faces
    if (params.mergeAdjacentFaces) {
      score += 5
    }

    // Penalize for very small or very large cubes
    if (params.cubeSize < 0.5 || params.cubeSize > 10) {
      score -= 10
    }

    return Math.max(0, Math.min(100, score))
  }

  private static estimateMemoryUsage(meshStats: any): number {
    // Rough estimate based on vertex/face counts
    const vertexMemory = meshStats.vertexCount * 12 // 3 floats * 4 bytes
    const faceMemory = meshStats.faceCount * 12 // 3 indices * 4 bytes
    return Math.round((vertexMemory + faceMemory) / (1024 * 1024)) // Convert to MB
  }

  private static getDefaultPresets(): ParameterPreset[] {
    return [
      {
        id: 'preset-quality',
        name: 'High Quality',
        description: 'Optimized for maximum quality with detailed features',
        category: 'quality',
        parameters: {
          cubeHeight: 2.0,
          cubeSize: 1.0,
          spacing: 0.05,
          generateBase: true,
          baseThickness: 1.5,
          optimizeMesh: true,
          mergeAdjacentFaces: true,
          chamferEdges: true,
          chamferSize: 0.05
        },
        author: 'system',
        createdAt: new Date(),
        usageCount: 0,
        rating: 5,
        compatiblePatterns: [],
        recommendedFor: ['detailed patterns', 'final prints', 'display models']
      },
      {
        id: 'preset-speed',
        name: 'Fast Generation',
        description: 'Optimized for quick generation and testing',
        category: 'speed',
        parameters: {
          cubeHeight: 2.0,
          cubeSize: 2.0,
          spacing: 0.1,
          generateBase: false,
          baseThickness: 1.0,
          optimizeMesh: false,
          mergeAdjacentFaces: false,
          chamferEdges: false,
          chamferSize: 0.1
        },
        author: 'system',
        createdAt: new Date(),
        usageCount: 0,
        rating: 4,
        compatiblePatterns: [],
        recommendedFor: ['testing', 'prototyping', 'large patterns']
      },
      {
        id: 'preset-printing',
        name: 'Print Ready',
        description: 'Optimized for 3D printing with good support characteristics',
        category: 'printing',
        parameters: {
          cubeHeight: 2.5,
          cubeSize: 1.5,
          spacing: 0.2,
          generateBase: true,
          baseThickness: 2.0,
          optimizeMesh: true,
          mergeAdjacentFaces: true,
          chamferEdges: false,
          chamferSize: 0.1
        },
        author: 'system',
        createdAt: new Date(),
        usageCount: 0,
        rating: 5,
        compatiblePatterns: [],
        recommendedFor: ['FDM printing', 'structural parts', 'functional prints']
      }
    ]
  }
}