import React, { createContext, useContext, useReducer, ReactNode } from 'react'
import type { DotPattern, ConversionParams, Model3DParams } from '@/types'

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

// Default state
const getDefaultConversionParams = (): ConversionParams => ({
  threshold: 128,
  targetWidth: 50,
  targetHeight: 50,
  maintainAspectRatio: true,
  invert: false
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
  isDevelopmentMode: process.env.NODE_ENV === 'development'
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
  const setCurrentStep = (step: AppState['currentStep']) => {
    dispatch({ type: 'SET_CURRENT_STEP', payload: step })
  }

  const setUploadedFile = (file: File | null) => {
    dispatch({ type: 'SET_UPLOADED_FILE', payload: file })
  }

  const setOriginalImage = (image: ImageData | null) => {
    dispatch({ type: 'SET_ORIGINAL_IMAGE', payload: image })
  }

  const setDotPattern = (pattern: DotPattern | null) => {
    dispatch({ type: 'SET_DOT_PATTERN', payload: pattern })
  }

  const updateConversionParams = (params: Partial<ConversionParams>) => {
    dispatch({ type: 'UPDATE_CONVERSION_PARAMS', payload: params })
  }

  const updateModel3DParams = (params: Partial<Model3DParams>) => {
    dispatch({ type: 'UPDATE_MODEL3D_PARAMS', payload: params })
  }

  const setLoading = (loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading })
  }

  const setError = (error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error })
  }

  const addSessionEntry = (entry: Omit<SessionEntry, 'id' | 'timestamp'>) => {
    dispatch({ type: 'ADD_SESSION_ENTRY', payload: entry })
  }

  const clearSessionHistory = () => {
    dispatch({ type: 'CLEAR_SESSION_HISTORY' })
  }

  const resetState = () => {
    dispatch({ type: 'RESET_STATE' })
  }

  const toggleDevelopmentMode = () => {
    dispatch({ type: 'TOGGLE_DEVELOPMENT_MODE' })
  }

  const contextValue: AppContextType = {
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
    toggleDevelopmentMode
  }

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