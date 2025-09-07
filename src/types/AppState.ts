import type { DotPattern, DotSelection } from './DotPattern'
import type { ConversionParams, Model3DParams, ExportParams } from './ConversionParams'
import type { Mesh } from 'three'

/**
 * Application workflow steps
 */
export type WorkflowStep = 
  | 'upload'
  | 'convert' 
  | 'edit'
  | 'generate3d'
  | 'export'

/**
 * File upload state
 */
export interface FileUploadState {
  /** Currently selected file */
  file: File | null
  
  /** File upload progress (0-100) */
  uploadProgress: number
  
  /** Whether file is currently being processed */
  isProcessing: boolean
  
  /** Upload/processing error message */
  error: string | null
  
  /** File validation result */
  isValid: boolean
}

/**
 * Image conversion state
 */
export interface ConversionState {
  /** Original image data */
  originalImage: ImageData | null
  
  /** Converted dot pattern */
  dotPattern: DotPattern | null
  
  /** Current conversion parameters */
  params: ConversionParams
  
  /** Whether conversion is in progress */
  isConverting: boolean
  
  /** Conversion progress (0-100) */
  progress: number
  
  /** Conversion error message */
  error: string | null
  
  /** Preview of conversion result */
  previewData: ImageData | null
}

/**
 * Dot pattern editing state
 */
export interface EditingState {
  /** Current dot pattern being edited */
  pattern: DotPattern | null
  
  /** Current selection area */
  selection: DotSelection | null
  
  /** Whether pattern has unsaved changes */
  hasUnsavedChanges: boolean
  
  /** Undo history stack */
  undoStack: DotPattern[]
  
  /** Redo history stack */
  redoStack: DotPattern[]
  
  /** Current zoom level (1.0 = 100%) */
  zoomLevel: number
  
  /** Pan offset for large patterns */
  panOffset: { x: number; y: number }
  
  /** Currently selected editing tool */
  selectedTool: 'pen' | 'eraser' | 'fill' | 'select'
}

/**
 * 3D model generation state
 */
export interface Model3DState {
  /** Generated 3D mesh */
  mesh: Mesh | null
  
  /** 3D generation parameters */
  params: Model3DParams
  
  /** Whether 3D model is being generated */
  isGenerating: boolean
  
  /** Generation progress (0-100) */
  progress: number
  
  /** Generation error message */
  error: string | null
  
  /** Mesh statistics */
  meshStats: {
    vertexCount: number
    faceCount: number
    fileSizeEstimate: number
  } | null
}

/**
 * Export state
 */
export interface ExportState {
  /** Export parameters */
  params: ExportParams
  
  /** Whether export is in progress */
  isExporting: boolean
  
  /** Export progress (0-100) */
  progress: number
  
  /** Export error message */
  error: string | null
  
  /** Generated file blob for download */
  downloadBlob: Blob | null
  
  /** Download URL for the generated file */
  downloadUrl: string | null
}

/**
 * UI state management
 */
export interface UIState {
  /** Current workflow step */
  currentStep: WorkflowStep
  
  /** Whether sidebar is open */
  sidebarOpen: boolean
  
  /** Current theme */
  theme: 'light' | 'dark'
  
  /** Active modal/dialog */
  activeModal: string | null
  
  /** Loading state for the application */
  isLoading: boolean
  
  /** Global error message */
  globalError: string | null
  
  /** Success notifications */
  notifications: Array<{
    id: string
    type: 'success' | 'warning' | 'error' | 'info'
    message: string
    timestamp: Date
  }>
}

/**
 * Main application state interface
 */
export interface AppState {
  /** File upload state */
  upload: FileUploadState
  
  /** Image conversion state */
  conversion: ConversionState
  
  /** Dot pattern editing state */
  editing: EditingState
  
  /** 3D model generation state */
  model3d: Model3DState
  
  /** Export state */
  export: ExportState
  
  /** UI state */
  ui: UIState
}

/**
 * Action types for state management
 */
export type AppAction =
  | { type: 'SET_CURRENT_STEP'; payload: WorkflowStep }
  | { type: 'SET_FILE'; payload: File | null }
  | { type: 'SET_UPLOAD_PROGRESS'; payload: number }
  | { type: 'SET_UPLOAD_ERROR'; payload: string | null }
  | { type: 'SET_DOT_PATTERN'; payload: DotPattern | null }
  | { type: 'SET_CONVERSION_PARAMS'; payload: Partial<ConversionParams> }
  | { type: 'SET_CONVERSION_PROGRESS'; payload: number }
  | { type: 'SET_CONVERSION_ERROR'; payload: string | null }
  | { type: 'SET_SELECTION'; payload: DotSelection | null }
  | { type: 'SET_ZOOM_LEVEL'; payload: number }
  | { type: 'SET_PAN_OFFSET'; payload: { x: number; y: number } }
  | { type: 'SET_EDITING_TOOL'; payload: EditingState['selectedTool'] }
  | { type: 'SET_3D_MESH'; payload: Mesh | null }
  | { type: 'SET_3D_PARAMS'; payload: Partial<Model3DParams> }
  | { type: 'SET_3D_PROGRESS'; payload: number }
  | { type: 'SET_3D_ERROR'; payload: string | null }
  | { type: 'SET_EXPORT_PARAMS'; payload: Partial<ExportParams> }
  | { type: 'SET_EXPORT_PROGRESS'; payload: number }
  | { type: 'SET_EXPORT_ERROR'; payload: string | null }
  | { type: 'SET_GLOBAL_ERROR'; payload: string | null }
  | { type: 'ADD_NOTIFICATION'; payload: UIState['notifications'][0] }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' }

/**
 * State management context type
 */
export interface AppContextType {
  state: AppState
  dispatch: React.Dispatch<AppAction>
}