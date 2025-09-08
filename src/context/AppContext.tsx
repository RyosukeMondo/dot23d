import React, { createContext, useContext, useReducer, useCallback, useMemo, type ReactNode } from 'react'
import type { 
  DotPattern, 
  ConversionParams, 
  Model3DParams,
  TestSession,
  TestResult,
  PerformanceMetrics,
  ParameterPreset
} from '@/types'

// Define the application state
export interface AppState {
  // Current workflow step
  currentStep: 'upload' | 'convert' | 'edit' | 'generate' | 'export'
  
  // File and pattern state
  uploadedFile: File | null
  originalImage: ImageData | null
  dotPattern: DotPattern | null
  
  // Processing parameters
  conversionParams: ConversionParams
  model3DParams: Model3DParams
  
  // UI state
  isLoading: boolean
  error: string | null
  
  // Session data
  sessionHistory: SessionEntry[]
  
  // Development/testing state
  isDevelopmentMode: boolean
  
  // Enhanced testing state
  testSession: TestSession | null
  testResults: TestResult[]
  performanceMetrics: PerformanceMetrics[]
  parameterPresets: ParameterPreset[]
  activeTestId: string | null
  testHistory: TestSession[]
  isTestMode: boolean
}

export interface SessionEntry {
  id: string
  timestamp: Date
  type: 'upload' | 'conversion' | 'generation' | 'export'
  description: string
  success: boolean
  data?: any
}

// Define action types
export type AppAction =
  | { type: 'SET_CURRENT_STEP'; payload: AppState['currentStep'] }
  | { type: 'SET_UPLOADED_FILE'; payload: File | null }
  | { type: 'SET_ORIGINAL_IMAGE'; payload: ImageData | null }
  | { type: 'SET_DOT_PATTERN'; payload: DotPattern | null }
  | { type: 'UPDATE_CONVERSION_PARAMS'; payload: Partial<ConversionParams> }
  | { type: 'UPDATE_MODEL3D_PARAMS'; payload: Partial<Model3DParams> }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'ADD_SESSION_ENTRY'; payload: Omit<SessionEntry, 'id' | 'timestamp'> }
  | { type: 'CLEAR_SESSION_HISTORY' }
  | { type: 'RESET_STATE' }
  | { type: 'TOGGLE_DEVELOPMENT_MODE' }
  // Enhanced testing actions
  | { type: 'SET_TEST_SESSION'; payload: TestSession | null }
  | { type: 'ADD_TEST_RESULT'; payload: TestResult }
  | { type: 'UPDATE_TEST_RESULT'; payload: { id: string; result: Partial<TestResult> } }
  | { type: 'CLEAR_TEST_RESULTS' }
  | { type: 'ADD_PERFORMANCE_METRIC'; payload: PerformanceMetrics }
  | { type: 'CLEAR_PERFORMANCE_METRICS' }
  | { type: 'SET_PARAMETER_PRESETS'; payload: ParameterPreset[] }
  | { type: 'ADD_PARAMETER_PRESET'; payload: ParameterPreset }
  | { type: 'REMOVE_PARAMETER_PRESET'; payload: string }
  | { type: 'SET_ACTIVE_TEST_ID'; payload: string | null }
  | { type: 'ADD_TEST_HISTORY'; payload: TestSession }
  | { type: 'CLEAR_TEST_HISTORY' }
  | { type: 'TOGGLE_TEST_MODE' }
  | { type: 'UPDATE_TEST_SESSION'; payload: Partial<TestSession> }

// Default state
const getDefaultConversionParams = (): ConversionParams => ({
  // ImageProcessingParams
  grayscaleMethod: 'luminance',
  threshold: 128,
  preBlur: false,
  blurRadius: 1,
  enhanceContrast: false,
  contrastFactor: 1.0,
  
  // ResizeParams  
  targetWidth: 50,
  targetHeight: 50,
  maintainAspectRatio: true,
  algorithm: 'bilinear',
  fillColor: '#ffffff',
  
  // ConversionParams
  invert: false,
  enableDithering: false,
  ditheringMethod: 'floyd-steinberg'
})

const getDefaultModel3DParams = (): Model3DParams => ({
  cubeHeight: 2.0,
  cubeSize: 2.0,
  spacing: 0.1,
  generateBase: true,
  baseThickness: 1.0,
  optimizeMesh: true,
  mergeAdjacentFaces: false,
  chamferEdges: false,
  chamferSize: 0.1
})

const initialState: AppState = {
  currentStep: 'upload',
  uploadedFile: null,
  originalImage: null,
  dotPattern: null,
  conversionParams: getDefaultConversionParams(),
  model3DParams: getDefaultModel3DParams(),
  isLoading: false,
  error: null,
  sessionHistory: [],
  isDevelopmentMode: import.meta.env.DEV,
  // Enhanced testing state
  testSession: null,
  testResults: [],
  performanceMetrics: [],
  parameterPresets: [],
  activeTestId: null,
  testHistory: [],
  isTestMode: false
}

// Reducer function
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_CURRENT_STEP':
      return {
        ...state,
        currentStep: action.payload,
        error: null // Clear errors when changing steps
      }

    case 'SET_UPLOADED_FILE':
      return {
        ...state,
        uploadedFile: action.payload,
        // Clear downstream state when file changes
        originalImage: null,
        dotPattern: null,
        error: null
      }

    case 'SET_ORIGINAL_IMAGE':
      return {
        ...state,
        originalImage: action.payload,
        // Clear dot pattern when image changes
        dotPattern: null,
        error: null
      }

    case 'SET_DOT_PATTERN':
      return {
        ...state,
        dotPattern: action.payload,
        error: null
      }

    case 'UPDATE_CONVERSION_PARAMS':
      return {
        ...state,
        conversionParams: {
          ...state.conversionParams,
          ...action.payload
        }
      }

    case 'UPDATE_MODEL3D_PARAMS':
      return {
        ...state,
        model3DParams: {
          ...state.model3DParams,
          ...action.payload
        }
      }

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
        // Clear errors when starting new operation
        error: action.payload ? null : state.error
      }

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false // Stop loading on error
      }

    case 'ADD_SESSION_ENTRY':
      const newEntry: SessionEntry = {
        ...action.payload,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date()
      }
      
      return {
        ...state,
        sessionHistory: [newEntry, ...state.sessionHistory].slice(0, 50) // Keep last 50 entries
      }

    case 'CLEAR_SESSION_HISTORY':
      return {
        ...state,
        sessionHistory: []
      }

    case 'RESET_STATE':
      return {
        ...initialState,
        isDevelopmentMode: state.isDevelopmentMode, // Preserve development mode
        sessionHistory: state.sessionHistory // Preserve session history
      }

    case 'TOGGLE_DEVELOPMENT_MODE':
      return {
        ...state,
        isDevelopmentMode: !state.isDevelopmentMode
      }

    // Enhanced testing actions
    case 'SET_TEST_SESSION':
      return {
        ...state,
        testSession: action.payload
      }

    case 'ADD_TEST_RESULT':
      return {
        ...state,
        testResults: [action.payload, ...state.testResults]
      }

    case 'UPDATE_TEST_RESULT':
      return {
        ...state,
        testResults: state.testResults.map(result =>
          result.id === action.payload.id
            ? { ...result, ...action.payload.result }
            : result
        )
      }

    case 'CLEAR_TEST_RESULTS':
      return {
        ...state,
        testResults: []
      }

    case 'ADD_PERFORMANCE_METRIC':
      return {
        ...state,
        performanceMetrics: [action.payload, ...state.performanceMetrics].slice(0, 1000) // Keep last 1000 metrics
      }

    case 'CLEAR_PERFORMANCE_METRICS':
      return {
        ...state,
        performanceMetrics: []
      }

    case 'SET_PARAMETER_PRESETS':
      return {
        ...state,
        parameterPresets: action.payload
      }

    case 'ADD_PARAMETER_PRESET':
      return {
        ...state,
        parameterPresets: [...state.parameterPresets, action.payload]
      }

    case 'REMOVE_PARAMETER_PRESET':
      return {
        ...state,
        parameterPresets: state.parameterPresets.filter(preset => preset.id !== action.payload)
      }

    case 'SET_ACTIVE_TEST_ID':
      return {
        ...state,
        activeTestId: action.payload
      }

    case 'ADD_TEST_HISTORY':
      return {
        ...state,
        testHistory: [action.payload, ...state.testHistory].slice(0, 20) // Keep last 20 sessions
      }

    case 'CLEAR_TEST_HISTORY':
      return {
        ...state,
        testHistory: []
      }

    case 'TOGGLE_TEST_MODE':
      return {
        ...state,
        isTestMode: !state.isTestMode
      }

    case 'UPDATE_TEST_SESSION':
      return {
        ...state,
        testSession: state.testSession
          ? { ...state.testSession, ...action.payload }
          : null
      }

    default:
      return state
  }
}

// Context type
export interface AppContextType {
  state: AppState
  dispatch: React.Dispatch<AppAction>
  
  // Convenience methods
  setCurrentStep: (step: AppState['currentStep']) => void
  setUploadedFile: (file: File | null) => void
  setOriginalImage: (image: ImageData | null) => void
  setDotPattern: (pattern: DotPattern | null) => void
  updateConversionParams: (params: Partial<ConversionParams>) => void
  updateModel3DParams: (params: Partial<Model3DParams>) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  addSessionEntry: (entry: Omit<SessionEntry, 'id' | 'timestamp'>) => void
  clearSessionHistory: () => void
  resetState: () => void
  toggleDevelopmentMode: () => void
  
  // Enhanced testing methods
  setTestSession: (session: TestSession | null) => void
  addTestResult: (result: TestResult) => void
  updateTestResult: (id: string, result: Partial<TestResult>) => void
  clearTestResults: () => void
  addPerformanceMetric: (metric: PerformanceMetrics) => void
  clearPerformanceMetrics: () => void
  setParameterPresets: (presets: ParameterPreset[]) => void
  addParameterPreset: (preset: ParameterPreset) => void
  removeParameterPreset: (id: string) => void
  setActiveTestId: (id: string | null) => void
  addTestHistory: (session: TestSession) => void
  clearTestHistory: () => void
  toggleTestMode: () => void
  updateTestSession: (updates: Partial<TestSession>) => void
}

// Create context
const AppContext = createContext<AppContextType | undefined>(undefined)

// Provider component
interface AppProviderProps {
  children: ReactNode
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState)

  // Convenience methods
  const setCurrentStep = useCallback((step: AppState['currentStep']) => {
    dispatch({ type: 'SET_CURRENT_STEP', payload: step })
  }, [dispatch])

  const setUploadedFile = useCallback((file: File | null) => {
    dispatch({ type: 'SET_UPLOADED_FILE', payload: file })
  }, [dispatch])

  const setOriginalImage = useCallback((image: ImageData | null) => {
    dispatch({ type: 'SET_ORIGINAL_IMAGE', payload: image })
  }, [dispatch])

  const setDotPattern = useCallback((pattern: DotPattern | null) => {
    dispatch({ type: 'SET_DOT_PATTERN', payload: pattern })
  }, [dispatch])

  const updateConversionParams = useCallback((params: Partial<ConversionParams>) => {
    dispatch({ type: 'UPDATE_CONVERSION_PARAMS', payload: params })
  }, [dispatch])

  const updateModel3DParams = useCallback((params: Partial<Model3DParams>) => {
    dispatch({ type: 'UPDATE_MODEL3D_PARAMS', payload: params })
  }, [dispatch])

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading })
  }, [dispatch])

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error })
  }, [dispatch])

  const addSessionEntry = useCallback((entry: Omit<SessionEntry, 'id' | 'timestamp'>) => {
    dispatch({ type: 'ADD_SESSION_ENTRY', payload: entry })
  }, [dispatch])

  const clearSessionHistory = useCallback(() => {
    dispatch({ type: 'CLEAR_SESSION_HISTORY' })
  }, [dispatch])

  const resetState = useCallback(() => {
    dispatch({ type: 'RESET_STATE' })
  }, [dispatch])

  const toggleDevelopmentMode = useCallback(() => {
    dispatch({ type: 'TOGGLE_DEVELOPMENT_MODE' })
  }, [dispatch])

  // Enhanced testing methods
  const setTestSession = useCallback((session: TestSession | null) => {
    dispatch({ type: 'SET_TEST_SESSION', payload: session })
  }, [dispatch])

  const addTestResult = useCallback((result: TestResult) => {
    dispatch({ type: 'ADD_TEST_RESULT', payload: result })
  }, [dispatch])

  const updateTestResult = useCallback((id: string, result: Partial<TestResult>) => {
    dispatch({ type: 'UPDATE_TEST_RESULT', payload: { id, result } })
  }, [dispatch])

  const clearTestResults = useCallback(() => {
    dispatch({ type: 'CLEAR_TEST_RESULTS' })
  }, [dispatch])

  const addPerformanceMetric = useCallback((metric: PerformanceMetrics) => {
    dispatch({ type: 'ADD_PERFORMANCE_METRIC', payload: metric })
  }, [dispatch])

  const clearPerformanceMetrics = useCallback(() => {
    dispatch({ type: 'CLEAR_PERFORMANCE_METRICS' })
  }, [dispatch])

  const setParameterPresets = useCallback((presets: ParameterPreset[]) => {
    dispatch({ type: 'SET_PARAMETER_PRESETS', payload: presets })
  }, [dispatch])

  const addParameterPreset = useCallback((preset: ParameterPreset) => {
    dispatch({ type: 'ADD_PARAMETER_PRESET', payload: preset })
  }, [dispatch])

  const removeParameterPreset = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_PARAMETER_PRESET', payload: id })
  }, [dispatch])

  const setActiveTestId = useCallback((id: string | null) => {
    dispatch({ type: 'SET_ACTIVE_TEST_ID', payload: id })
  }, [dispatch])

  const addTestHistory = useCallback((session: TestSession) => {
    dispatch({ type: 'ADD_TEST_HISTORY', payload: session })
  }, [dispatch])

  const clearTestHistory = useCallback(() => {
    dispatch({ type: 'CLEAR_TEST_HISTORY' })
  }, [dispatch])

  const toggleTestMode = useCallback(() => {
    dispatch({ type: 'TOGGLE_TEST_MODE' })
  }, [dispatch])

  const updateTestSession = useCallback((updates: Partial<TestSession>) => {
    dispatch({ type: 'UPDATE_TEST_SESSION', payload: updates })
  }, [dispatch])

  const contextValue: AppContextType = useMemo(() => ({
    state,
    dispatch,
    setCurrentStep,
    setUploadedFile,
    setOriginalImage,
    setDotPattern,
    updateConversionParams,
    updateModel3DParams,
    setLoading,
    setError,
    addSessionEntry,
    clearSessionHistory,
    resetState,
    toggleDevelopmentMode,
    // Enhanced testing methods
    setTestSession,
    addTestResult,
    updateTestResult,
    clearTestResults,
    addPerformanceMetric,
    clearPerformanceMetrics,
    setParameterPresets,
    addParameterPreset,
    removeParameterPreset,
    setActiveTestId,
    addTestHistory,
    clearTestHistory,
    toggleTestMode,
    updateTestSession
  }), [
    state,
    dispatch,
    setCurrentStep,
    setUploadedFile,
    setOriginalImage,
    setDotPattern,
    updateConversionParams,
    updateModel3DParams,
    setLoading,
    setError,
    addSessionEntry,
    clearSessionHistory,
    resetState,
    toggleDevelopmentMode,
    setTestSession,
    addTestResult,
    updateTestResult,
    clearTestResults,
    addPerformanceMetric,
    clearPerformanceMetrics,
    setParameterPresets,
    addParameterPreset,
    removeParameterPreset,
    setActiveTestId,
    addTestHistory,
    clearTestHistory,
    toggleTestMode,
    updateTestSession
  ])

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  )
}

// Hook for using the context
export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider')
  }
  return context
}

export default AppContext