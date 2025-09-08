// Core pattern types
export type {
  DotPattern,
  DotPosition,
  DotSelection,
  ValidationResult,
  ConversionParams as DotConversionParams
} from './DotPattern'

// Conversion and processing parameters
export type {
  ImageProcessingParams,
  ResizeParams,
  ConversionParams,
  Model3DParams,
  ExportParams
} from './ConversionParams'

// Application state management
export type {
  WorkflowStep,
  FileUploadState,
  ConversionState,
  EditingState,
  Model3DState,
  ExportState,
  UIState,
  AppState,
  AppAction,
  AppContextType
} from './AppState'

// Enhanced testing interfaces
export type {
  TestSession,
  TestResult,
  PerformanceMetrics,
  PerformanceSnapshot,
  ParameterPreset,
  QualityReport,
  MeshStats,
  ExportResult,
  PatternFilter,
  OverhangAnalysis,
  ThicknessAnalysis,
  BridgingAnalysis,
  QualityRecommendation,
  QualityWarning,
  SweepConfig,
  SweepResult,
  BulkTestConfig,
  TestSuite,
  TestSuiteTest,
  TestSuiteResult,
  Measurement,
  ComparisonResult,
  CIReport
} from './TestingInterfaces'