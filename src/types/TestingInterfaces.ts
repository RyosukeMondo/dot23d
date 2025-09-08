import { DotPattern, ValidationResult, Model3DParams, ExportParams } from './index'

/**
 * Represents a testing session containing multiple test runs and results
 */
export interface TestSession {
  /** Unique identifier for the test session */
  id: string
  
  /** Human-readable name for the session */
  name: string
  
  /** Timestamp when session was created */
  createdAt: Date
  
  /** Timestamp of last update */
  updatedAt: Date
  
  /** Current session status */
  status: 'active' | 'completed' | 'archived'
  
  /** Test configuration */
  patterns: DotPattern[]
  parameterSets: Model3DParams[]
  testResults: TestResult[]
  
  /** Performance data collected during session */
  performanceMetrics: PerformanceMetrics[]
  
  /** Session metadata */
  tags: string[]
  notes: string
  author: string
}

/**
 * Individual test result containing input parameters and output metrics
 */
export interface TestResult {
  /** Unique identifier for this test result */
  id: string
  
  /** ID of the parent test session */
  testSessionId: string
  
  /** Timestamp when test was executed */
  timestamp: Date
  
  /** Input pattern used for the test */
  pattern: DotPattern
  
  /** 3D generation parameters used */
  parameters: Model3DParams
  
  /** Whether the test completed successfully */
  success: boolean
  
  /** Total processing time in milliseconds */
  processingTime: number
  
  /** Generated mesh statistics */
  meshStats: MeshStats
  
  /** Overall quality score (0-100) */
  qualityScore: number
  
  /** Performance snapshot during generation */
  performanceMetrics: PerformanceSnapshot
  
  /** Error message if test failed */
  error?: string
  
  /** Warning messages from the test */
  warnings: string[]
  
  /** Export results if models were exported */
  exportedFormats: ExportResult[]
}

/**
 * Real-time and historical performance metrics
 */
export interface PerformanceMetrics {
  /** Timestamp for this measurement */
  timestamp: Date
  
  /** Test ID this metric belongs to */
  testId: string
  
  /** Memory usage information */
  memoryUsage: {
    /** Current memory used in MB */
    used: number
    /** Peak memory usage during operation in MB */
    peak: number
    /** Available system memory in MB */
    available: number
  }
  
  /** CPU utilization breakdown */
  cpuUsage: {
    /** CPU used for 3D generation */
    generation: number
    /** CPU used for mesh optimization */
    optimization: number
    /** CPU used for rendering/preview */
    rendering: number
  }
  
  /** Detailed timing breakdown */
  timings: {
    /** Validation phase duration (ms) */
    validation: number
    /** Core generation phase duration (ms) */
    generation: number
    /** Optimization phase duration (ms) */
    optimization: number
    /** Rendering/preview duration (ms) */
    rendering: number
    /** Export phase duration (ms) */
    export: number
  }
  
  /** Quality and efficiency metrics */
  qualityMetrics: {
    /** Mesh complexity score (0-100) */
    meshComplexity: number
    /** Optimization effectiveness ratio (0-1) */
    optimizationRatio: number
    /** 3D printing suitability score (0-100) */
    printability: number
  }
}

/**
 * Point-in-time performance snapshot
 */
export interface PerformanceSnapshot {
  /** Memory usage at time of snapshot */
  memoryUsed: number
  /** CPU utilization percentage */
  cpuUsage: number
  /** Generation speed (voxels per second) */
  generationSpeed: number
  /** Total elapsed time */
  elapsedTime: number
}

/**
 * Predefined parameter sets for common testing scenarios
 */
export interface ParameterPreset {
  /** Unique identifier */
  id: string
  
  /** Display name */
  name: string
  
  /** Detailed description */
  description: string
  
  /** Category for organization */
  category: 'quality' | 'speed' | 'printing' | 'size' | 'custom'
  
  /** The parameter values */
  parameters: Partial<Model3DParams>
  
  /** Preset metadata */
  author: string
  createdAt: Date
  usageCount: number
  rating: number
  
  /** Validation rules */
  compatiblePatterns: PatternFilter[]
  recommendedFor: string[]
}

/**
 * Comprehensive quality assessment report
 */
export interface QualityReport {
  /** ID of the model being assessed */
  modelId: string
  
  /** Timestamp of assessment */
  timestamp: Date
  
  /** Overall quality score (0-100) */
  overallScore: number
  
  /** Geometric quality metrics */
  geometry: {
    /** Manifoldness check (0-100, 100 = fully manifold) */
    manifoldness: number
    /** Watertight check (0-100, 100 = fully watertight) */
    watertightness: number
    /** Count of self-intersecting faces */
    selfIntersections: number
    /** Count of duplicate vertices */
    duplicateVertices: number
  }
  
  /** 3D printing suitability analysis */
  printability: {
    /** Overhang analysis results */
    overhangs: OverhangAnalysis[]
    /** Support structure necessity score (0-100) */
    supportNeed: number
    /** Wall thickness analysis */
    wallThickness: ThicknessAnalysis
    /** Bridge analysis for unsupported spans */
    bridging: BridgingAnalysis[]
  }
  
  /** Improvement recommendations */
  recommendations: QualityRecommendation[]
  
  /** Warning about potential issues */
  warnings: QualityWarning[]
}

/**
 * Statistics about generated mesh geometry
 */
export interface MeshStats {
  /** Total number of vertices */
  vertexCount: number
  
  /** Total number of faces */
  faceCount: number
  
  /** Total number of edges */
  edgeCount: number
  
  /** Bounding box dimensions */
  boundingBox: {
    width: number
    height: number
    depth: number
  }
  
  /** Surface area in square units */
  surfaceArea: number
  
  /** Volume in cubic units */
  volume: number
  
  /** Memory usage for mesh data in KB */
  memoryUsage: number
}

/**
 * Result of model export operation
 */
export interface ExportResult {
  /** Export format used */
  format: 'obj' | 'stl' | 'ply'
  
  /** Whether export was successful */
  success: boolean
  
  /** File size in bytes */
  fileSize: number
  
  /** Export duration in milliseconds */
  exportTime: number
  
  /** Any warnings during export */
  warnings: string[]
  
  /** Error message if export failed */
  error?: string
}

/**
 * Filter criteria for compatible patterns
 */
export interface PatternFilter {
  /** Minimum pattern dimensions */
  minSize?: { width: number; height: number }
  
  /** Maximum pattern dimensions */
  maxSize?: { width: number; height: number }
  
  /** Required pattern density range (0-1) */
  densityRange?: { min: number; max: number }
  
  /** Pattern complexity requirements */
  complexity?: 'simple' | 'moderate' | 'complex'
}

/**
 * Analysis of overhanging geometry
 */
export interface OverhangAnalysis {
  /** Location of the overhang */
  position: { x: number; y: number; z: number }
  
  /** Overhang angle in degrees */
  angle: number
  
  /** Severity level */
  severity: 'low' | 'medium' | 'high'
  
  /** Suggested resolution */
  suggestion: string
}

/**
 * Wall thickness analysis results
 */
export interface ThicknessAnalysis {
  /** Minimum wall thickness found */
  minThickness: number
  
  /** Average wall thickness */
  averageThickness: number
  
  /** Locations where walls are too thin */
  thinAreas: Array<{
    position: { x: number; y: number; z: number }
    thickness: number
  }>
  
  /** Recommended minimum thickness for printing */
  recommendedMinimum: number
}

/**
 * Bridge span analysis for unsupported areas
 */
export interface BridgingAnalysis {
  /** Start point of the bridge */
  startPoint: { x: number; y: number; z: number }
  
  /** End point of the bridge */
  endPoint: { x: number; y: number; z: number }
  
  /** Length of the bridge span */
  length: number
  
  /** Printability assessment */
  printable: boolean
  
  /** Suggested support strategy */
  supportSuggestion: string
}

/**
 * Quality improvement recommendation
 */
export interface QualityRecommendation {
  /** Type of recommendation */
  type: 'geometry' | 'printing' | 'optimization' | 'parameter'
  
  /** Severity/importance level */
  priority: 'low' | 'medium' | 'high'
  
  /** Human-readable recommendation */
  message: string
  
  /** Specific action to take */
  action: string
  
  /** Expected improvement */
  expectedImprovement: string
}

/**
 * Quality warning about potential issues
 */
export interface QualityWarning {
  /** Warning category */
  category: 'geometry' | 'printing' | 'performance' | 'export'
  
  /** Severity level */
  severity: 'info' | 'warning' | 'error'
  
  /** Warning message */
  message: string
  
  /** Location in model if applicable */
  location?: { x: number; y: number; z: number }
  
  /** Suggested resolution */
  resolution?: string
}

/**
 * Configuration for parameter sweep testing
 */
export interface SweepConfig {
  /** Parameter to sweep */
  parameter: keyof Model3DParams
  
  /** Start value */
  startValue: number
  
  /** End value */
  endValue: number
  
  /** Number of steps */
  steps: number
  
  /** Whether to use logarithmic stepping */
  logarithmic: boolean
}

/**
 * Results from parameter sweep testing
 */
export interface SweepResult {
  /** Parameter value tested */
  parameterValue: number
  
  /** Test result for this parameter value */
  testResult: TestResult
  
  /** Relative performance compared to other sweep values */
  relativePerformance: number
}

/**
 * Configuration for bulk testing multiple scenarios
 */
export interface BulkTestConfig {
  /** Patterns to test */
  patterns: DotPattern[]
  
  /** Parameter sets to test */
  parameterSets: Model3DParams[]
  
  /** Whether to test all combinations */
  testAllCombinations: boolean
  
  /** Maximum concurrent tests */
  maxConcurrency: number
  
  /** Timeout per test in milliseconds */
  testTimeout: number
}

/**
 * Test suite configuration for automated testing
 */
export interface TestSuite {
  /** Unique identifier */
  id: string
  
  /** Suite name */
  name: string
  
  /** Description */
  description: string
  
  /** Test configurations */
  tests: TestSuiteTest[]
  
  /** Suite metadata */
  author: string
  createdAt: Date
  version: string
  
  /** Execution settings */
  settings: {
    /** Maximum execution time for entire suite */
    timeout: number
    /** Fail fast on first error */
    failFast: boolean
    /** Parallel execution enabled */
    parallel: boolean
    /** Maximum parallel tests */
    maxParallel: number
  }
}

/**
 * Individual test within a test suite
 */
export interface TestSuiteTest {
  /** Test identifier */
  id: string
  
  /** Test name */
  name: string
  
  /** Test pattern */
  pattern: DotPattern
  
  /** Test parameters */
  parameters: Model3DParams
  
  /** Expected outcomes */
  expectations: {
    /** Should succeed */
    shouldSucceed: boolean
    /** Maximum processing time */
    maxProcessingTime?: number
    /** Minimum quality score */
    minQualityScore?: number
    /** Required mesh properties */
    meshRequirements?: Partial<MeshStats>
  }
}

/**
 * Results from running a test suite
 */
export interface TestSuiteResult {
  /** Test suite ID */
  suiteId: string
  
  /** Execution timestamp */
  timestamp: Date
  
  /** Overall success status */
  success: boolean
  
  /** Individual test results */
  testResults: TestResult[]
  
  /** Suite execution statistics */
  statistics: {
    /** Total tests run */
    totalTests: number
    /** Tests passed */
    passed: number
    /** Tests failed */
    failed: number
    /** Tests skipped */
    skipped: number
    /** Total execution time */
    totalTime: number
  }
  
  /** Performance summary */
  performanceSummary: {
    /** Average processing time */
    averageProcessingTime: number
    /** Peak memory usage */
    peakMemoryUsage: number
    /** Overall quality score */
    averageQualityScore: number
  }
}

/**
 * Measurement tools for 3D model analysis
 */
export interface Measurement {
  /** Unique measurement ID */
  id: string
  
  /** Type of measurement */
  type: 'distance' | 'angle' | 'area' | 'volume'
  
  /** Points defining the measurement */
  points: Array<{ x: number; y: number; z: number }>
  
  /** Calculated value */
  value: number
  
  /** Unit of measurement */
  unit: string
  
  /** Display label */
  label: string
  
  /** Visibility in 3D viewer */
  visible: boolean
}

/**
 * Model comparison results
 */
export interface ComparisonResult {
  /** Models being compared */
  models: Array<{ id: string; name: string }>
  
  /** Geometric differences */
  geometricDifferences: {
    /** Vertex count differences */
    vertexCountDiff: number[]
    /** Face count differences */
    faceCountDiff: number[]
    /** Volume differences */
    volumeDiff: number[]
  }
  
  /** Performance differences */
  performanceDifferences: {
    /** Processing time differences */
    processingTimeDiff: number[]
    /** Memory usage differences */
    memoryUsageDiff: number[]
  }
  
  /** Quality score differences */
  qualityDifferences: number[]
  
  /** Detailed comparison report */
  detailedReport: string
}

/**
 * Test automation and CI integration types
 */
export interface CIReport {
  /** Build/commit information */
  build: {
    id: string
    commit: string
    branch: string
    timestamp: Date
  }
  
  /** Test execution summary */
  summary: {
    totalTests: number
    passed: number
    failed: number
    duration: number
  }
  
  /** Failed test details */
  failures: Array<{
    testId: string
    testName: string
    error: string
    details: string
  }>
  
  /** Performance regression analysis */
  regressions: Array<{
    metric: string
    currentValue: number
    previousValue: number
    regressionPercent: number
  }>
  
  /** Machine-readable status */
  status: 'passed' | 'failed' | 'unstable'
}