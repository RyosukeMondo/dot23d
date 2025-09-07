import React, { useState, useCallback, useEffect } from 'react'
import * as THREE from 'three'
import FileUpload from '@/components/FileUpload'
import DotEditor from '@/components/DotEditor'
import Model3D from '@/components/Model3D'
import { FileService } from '@/services/FileService'
import { ImageService } from '@/services/ImageService'
import { DotArtService } from '@/services/DotArtService'
import { Model3DService } from '@/services/Model3DService'
import type { DotPattern, ConversionParams, Model3DParams, ExportParams } from '@/types'

type Step = 'upload' | 'convert' | 'edit' | 'generate3d' | 'export'

export const IntegratedApp: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<Step>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dotPattern, setDotPattern] = useState<DotPattern | null>(null)
  const [originalPattern, setOriginalPattern] = useState<DotPattern | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [generatedMesh, setGeneratedMesh] = useState<THREE.Group | null>(null)

  // Conversion parameters with defaults
  const [conversionParams, setConversionParams] = useState<ConversionParams>(() => 
    ImageService.getDefaultConversionParams()
  )

  // 3D parameters with defaults  
  const [model3DParams, setModel3DParams] = useState<Model3DParams>(() => 
    Model3DService.getDefault3DParams()
  )

  // Export parameters with defaults
  const [exportParams, setExportParams] = useState<ExportParams>(() => 
    Model3DService.getDefaultExportParams()
  )

  // State persistence key
  const STORAGE_KEY = 'dot-art-3d-converter-state'

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const savedState = localStorage.getItem(STORAGE_KEY)
      if (savedState) {
        const parsed = JSON.parse(savedState)
        if (parsed.dotPattern) {
          setDotPattern(parsed.dotPattern)
          setOriginalPattern(parsed.originalPattern)
          setCurrentStep(parsed.currentStep || 'edit')
          setConversionParams(prev => ({ ...prev, ...parsed.conversionParams }))
          setModel3DParams(prev => ({ ...prev, ...parsed.model3DParams }))
          setExportParams(prev => ({ ...prev, ...parsed.exportParams }))
        }
      }
    } catch (error) {
      console.warn('Failed to load saved state:', error)
    }
  }, [])

  // Save state to localStorage whenever key state changes
  useEffect(() => {
    if (dotPattern) {
      const stateToSave = {
        dotPattern,
        originalPattern,
        currentStep,
        conversionParams,
        model3DParams,
        exportParams,
        timestamp: Date.now()
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave))
    }
  }, [dotPattern, originalPattern, currentStep, conversionParams, model3DParams, exportParams])

  // Clear saved state
  const clearSavedState = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setDotPattern(null)
    setOriginalPattern(null)
    setSelectedFile(null)
    setCurrentStep('upload')
    setHasUnsavedChanges(false)
    setGeneratedMesh(null)
    setError(null)
  }, [])

  const handleFileSelect = useCallback(async (file: File) => {
    setSelectedFile(file)
    setError(null)
    setIsProcessing(true)

    try {
      if (FileService.isCSV(file)) {
        // Import CSV directly
        const pattern = await DotArtService.importCSV(file)
        setDotPattern(pattern)
        setOriginalPattern(pattern)
        setHasUnsavedChanges(false)
        setCurrentStep('edit')
      } else if (FileService.isImage(file)) {
        // Move to conversion step for images
        setCurrentStep('convert')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process file')
    } finally {
      setIsProcessing(false)
    }
  }, [])

  const handleImageConversion = useCallback(async () => {
    if (!selectedFile) return

    setIsProcessing(true)
    setError(null)

    try {
      const result = await ImageService.convertToDotsPattern(selectedFile, conversionParams)
      
      if (result.error) {
        setError(`Pattern generation failed: ${result.error.userMessage || result.error.message}`)
        return
      }
      
      if (result.data) {
        setDotPattern(result.data)
        setOriginalPattern(result.data)
        setHasUnsavedChanges(false)
        setCurrentStep('edit')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed')
    } finally {
      setIsProcessing(false)
    }
  }, [selectedFile, conversionParams])

  const handleGenerate3D = useCallback(async () => {
    if (!dotPattern) return

    setIsProcessing(true)
    setError(null)

    try {
      // For now, just move to export step - the Model3D component will handle generation
      setCurrentStep('export')
    } catch (err) {
      setError(err instanceof Error ? err.message : '3D generation failed')
    } finally {
      setIsProcessing(false)
    }
  }, [dotPattern, model3DParams])


  // Handle pattern changes in the editor
  const handlePatternChange = useCallback((newPattern: DotPattern) => {
    setDotPattern(newPattern)
    setHasUnsavedChanges(true)
    // Clear generated mesh when pattern changes
    if (generatedMesh) {
      setGeneratedMesh(null)
    }
  }, [generatedMesh])

  // Save pattern changes
  const savePatternChanges = useCallback(() => {
    if (dotPattern) {
      setOriginalPattern(dotPattern)
      setHasUnsavedChanges(false)
    }
  }, [dotPattern])

  // Revert pattern changes
  const revertPatternChanges = useCallback(() => {
    if (originalPattern) {
      setDotPattern(originalPattern)
      setHasUnsavedChanges(false)
    }
  }, [originalPattern])

  const renderStepContent = () => {
    switch (currentStep) {
      case 'upload':
        return (
          <div className="step-content">
            <h2>Step 1: Upload File</h2>
            <p>Upload a CSV dot art file or an image to convert to 3D</p>
            <FileUpload onFileSelect={handleFileSelect} />
          </div>
        )

      case 'convert':
        return (
          <div className="step-content">
            <h2>Step 2: Convert Image</h2>
            <div className="conversion-controls">
              <div className="param-group">
                <label>
                  Target Width: 
                  <input 
                    type="number" 
                    value={conversionParams.targetWidth} 
                    onChange={(e) => setConversionParams(prev => ({
                      ...prev, 
                      targetWidth: parseInt(e.target.value) || 50
                    }))}
                    min="10" 
                    max="200" 
                  />
                </label>
              </div>
              <div className="param-group">
                <label>
                  Target Height: 
                  <input 
                    type="number" 
                    value={conversionParams.targetHeight} 
                    onChange={(e) => setConversionParams(prev => ({
                      ...prev, 
                      targetHeight: parseInt(e.target.value) || 50
                    }))}
                    min="10" 
                    max="200" 
                  />
                </label>
              </div>
              <div className="param-group">
                <label>
                  Threshold: 
                  <input 
                    type="range" 
                    min="0" 
                    max="255" 
                    value={conversionParams.threshold} 
                    onChange={(e) => setConversionParams(prev => ({
                      ...prev, 
                      threshold: parseInt(e.target.value)
                    }))}
                  />
                  <span>{conversionParams.threshold}</span>
                </label>
              </div>
              <div className="param-group">
                <label>
                  <input 
                    type="checkbox" 
                    checked={conversionParams.invert} 
                    onChange={(e) => setConversionParams(prev => ({
                      ...prev, 
                      invert: e.target.checked
                    }))}
                  />
                  Invert colors
                </label>
              </div>
            </div>
            <button 
              onClick={handleImageConversion} 
              disabled={isProcessing}
              className="primary-button"
            >
              {isProcessing ? 'Converting...' : 'Convert to Dot Pattern'}
            </button>
          </div>
        )

      case 'edit':
        return (
          <div className="step-content">
            <h2>Step 3: Edit Dot Pattern</h2>
            <div className="edit-header">
              <div className="pattern-info">
                {dotPattern && (
                  <>
                    <span>Size: {dotPattern.width}×{dotPattern.height}</span>
                    <span>Active: {DotArtService.getPatternStats(dotPattern).activeDots}</span>
                    <span>Fill: {DotArtService.getPatternStats(dotPattern).fillPercentage.toFixed(1)}%</span>
                    {hasUnsavedChanges && <span className="unsaved-indicator">● Unsaved changes</span>}
                  </>
                )}
              </div>
              <div className="edit-actions">
                {hasUnsavedChanges && (
                  <>
                    <button onClick={savePatternChanges} className="save-button">
                      ✓ Save Changes
                    </button>
                    <button onClick={revertPatternChanges} className="revert-button">
                      ↶ Revert
                    </button>
                  </>
                )}
                <button 
                  onClick={async () => {
                    if (dotPattern) {
                      const csvContent = DotArtService.exportCSV(dotPattern)
                      const blob = FileService.createTextBlob(csvContent, 'text/csv')
                      FileService.downloadFile(blob, `dot-pattern-${Date.now()}.csv`)
                    }
                  }}
                  className="secondary-button"
                >
                  📄 Export CSV
                </button>
              </div>
            </div>
            
            {dotPattern && (
              <div className="editor-container">
                <DotEditor
                  pattern={dotPattern}
                  onPatternChange={handlePatternChange}
                  onError={setError}
                />
              </div>
            )}
            
            <div className="step-navigation">
              <button 
                onClick={() => setCurrentStep('generate3d')} 
                className="primary-button"
                disabled={!dotPattern}
              >
                Continue to 3D Generation →
              </button>
            </div>
          </div>
        )

      case 'generate3d':
        return (
          <div className="step-content">
            <h2>Step 4: 3D Model Parameters</h2>
            <div className="param-controls">
              <div className="param-group">
                <label>
                  Cube Size (mm): 
                  <input 
                    type="number" 
                    step="0.1" 
                    value={model3DParams.cubeSize} 
                    onChange={(e) => setModel3DParams(prev => ({
                      ...prev, 
                      cubeSize: parseFloat(e.target.value) || 2.0
                    }))}
                    min="0.5" 
                    max="10" 
                  />
                </label>
              </div>
              <div className="param-group">
                <label>
                  Cube Height (mm): 
                  <input 
                    type="number" 
                    step="0.1" 
                    value={model3DParams.cubeHeight} 
                    onChange={(e) => setModel3DParams(prev => ({
                      ...prev, 
                      cubeHeight: parseFloat(e.target.value) || 2.0
                    }))}
                    min="0.5" 
                    max="20" 
                  />
                </label>
              </div>
              <div className="param-group">
                <label>
                  <input 
                    type="checkbox" 
                    checked={model3DParams.generateBase} 
                    onChange={(e) => setModel3DParams(prev => ({
                      ...prev, 
                      generateBase: e.target.checked
                    }))}
                  />
                  Generate Base Platform
                </label>
              </div>
            </div>
            {dotPattern && (
              <div className="estimates">
                <h3>Print Estimates:</h3>
                <div className="estimate-info">
                  {(() => {
                    const estimates = Model3DService.calculatePrintEstimates(dotPattern, model3DParams)
                    return (
                      <>
                        <p>Time: {estimates.estimatedPrintTime}</p>
                        <p>Material: {estimates.estimatedMaterial}</p>
                        <p>Cost: {estimates.estimatedCost}</p>
                      </>
                    )
                  })()}
                </div>
              </div>
            )}
            <div className="generation-actions">
              <button 
                onClick={handleGenerate3D} 
                disabled={isProcessing}
                className="primary-button"
              >
                {isProcessing ? 'Generating...' : 'Preview 3D Model'}
              </button>
            </div>
            
            <div className="step-navigation">
              <button 
                onClick={() => setCurrentStep('export')}
                className="primary-button"
                disabled={!dotPattern}
              >
                Continue to Export →
              </button>
            </div>
          </div>
        )

      case 'export':
        return (
          <div className="step-content">
            <h2>Step 5: Generate and Export 3D Model</h2>
            <div className="export-instructions">
              <p>
                Generate your 3D model with the current dot pattern and export it as an OBJ file
                ready for 3D printing.
              </p>
            </div>
            
            {dotPattern && (
              <div className="model-generator">
                <Model3D
                  pattern={dotPattern}
                  onExportComplete={(blob, filename) => {
                    FileService.downloadFile(blob, filename)
                  }}
                  onError={setError}
                />
              </div>
            )}
            
            <div className="export-actions">
              <button 
                onClick={() => {
                  if (hasUnsavedChanges) {
                    const confirmRestart = confirm('You have unsaved changes. Are you sure you want to start over?')
                    if (!confirmRestart) return
                  }
                  clearSavedState()
                }}
                className="secondary-button"
              >
                🏠 Start New Project
              </button>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="integrated-app">
      <div className="workflow-steps">
        <div className={`step ${currentStep === 'upload' ? 'active' : ''} ${selectedFile && (currentStep !== 'upload') ? 'completed' : ''}`}>
          1. Upload
        </div>
        <div className={`step ${currentStep === 'convert' ? 'active' : ''} ${dotPattern && currentStep !== 'upload' && currentStep !== 'convert' ? 'completed' : ''}`}>
          2. Convert
        </div>
        <div className={`step ${currentStep === 'edit' ? 'active' : ''} ${dotPattern && currentStep !== 'upload' && currentStep !== 'convert' && currentStep !== 'edit' ? 'completed' : ''}`}>
          3. Edit
        </div>
        <div className={`step ${currentStep === 'generate3d' ? 'active' : ''} ${currentStep === 'export' ? 'completed' : ''}`}>
          4. Generate 3D
        </div>
        <div className={`step ${currentStep === 'export' ? 'active' : ''}`}>
          5. Export
        </div>
      </div>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div className="main-content">
        {renderStepContent()}
      </div>

      <div className="navigation">
        {currentStep !== 'upload' && (
          <button 
            onClick={() => {
              const steps: Step[] = ['upload', 'convert', 'edit', 'generate3d', 'export']
              const currentIndex = steps.indexOf(currentStep)
              if (currentIndex > 0) {
                setCurrentStep(steps[currentIndex - 1])
              }
            }}
            className="nav-button"
          >
            ← Back
          </button>
        )}
        
        <button 
          onClick={() => {
            if (hasUnsavedChanges) {
              const confirmRestart = confirm('You have unsaved changes. Are you sure you want to start over?')
              if (!confirmRestart) return
            }
            clearSavedState()
          }}
          className="nav-button"
        >
          🏠 Start Over
        </button>
      </div>
    </div>
  )
}

export default IntegratedApp