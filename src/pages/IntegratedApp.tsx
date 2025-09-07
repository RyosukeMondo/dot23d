import React, { useState, useCallback } from 'react'
import FileUpload from '@/components/FileUpload'
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
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const handleFileSelect = useCallback(async (file: File) => {
    setSelectedFile(file)
    setError(null)
    setIsProcessing(true)

    try {
      if (FileService.isCSV(file)) {
        // Import CSV directly
        const pattern = await DotArtService.importCSV(file)
        setDotPattern(pattern)
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
      const pattern = await ImageService.convertToDotsPattern(selectedFile, conversionParams)
      setDotPattern(pattern)
      setCurrentStep('edit')
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
      const mesh = Model3DService.generateMesh(dotPattern, model3DParams)
      // Store mesh for export
      setCurrentStep('export')
    } catch (err) {
      setError(err instanceof Error ? err.message : '3D generation failed')
    } finally {
      setIsProcessing(false)
    }
  }, [dotPattern, model3DParams])

  const handleExport = useCallback(async () => {
    if (!dotPattern) return

    setIsProcessing(true)
    setError(null)

    try {
      const mesh = Model3DService.generateMesh(dotPattern, model3DParams)
      const { blob, filename } = Model3DService.exportOBJ(mesh, exportParams)
      FileService.downloadFile(blob, filename)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setIsProcessing(false)
    }
  }, [dotPattern, model3DParams, exportParams])

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
            {dotPattern && (
              <div className="pattern-info">
                <p>Pattern Size: {dotPattern.width} x {dotPattern.height}</p>
                <p>Active Dots: {DotArtService.getPatternStats(dotPattern).activeDots}</p>
                <p>Fill: {DotArtService.getPatternStats(dotPattern).fillPercentage.toFixed(1)}%</p>
              </div>
            )}
            <div className="pattern-actions">
              <button onClick={() => setCurrentStep('generate3d')} className="primary-button">
                Generate 3D Model
              </button>
              <button 
                onClick={async () => {
                  if (dotPattern) {
                    const csvContent = DotArtService.exportCSV(dotPattern)
                    const blob = FileService.createTextBlob(csvContent, 'text/csv')
                    FileService.downloadFile(blob, 'dot-pattern.csv')
                  }
                }}
                className="secondary-button"
              >
                Export as CSV
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
            <button 
              onClick={handleGenerate3D} 
              disabled={isProcessing}
              className="primary-button"
            >
              {isProcessing ? 'Generating...' : 'Generate 3D Model'}
            </button>
          </div>
        )

      case 'export':
        return (
          <div className="step-content">
            <h2>Step 5: Export 3D Model</h2>
            <div className="export-controls">
              <div className="param-group">
                <label>
                  Filename: 
                  <input 
                    type="text" 
                    value={exportParams.filename} 
                    onChange={(e) => setExportParams(prev => ({
                      ...prev, 
                      filename: e.target.value || 'dot-art-model'
                    }))}
                  />
                </label>
              </div>
              <div className="param-group">
                <label>
                  Scale Factor: 
                  <input 
                    type="number" 
                    step="0.1" 
                    value={exportParams.scaleFactor} 
                    onChange={(e) => setExportParams(prev => ({
                      ...prev, 
                      scaleFactor: parseFloat(e.target.value) || 1.0
                    }))}
                    min="0.1" 
                    max="10" 
                  />
                </label>
              </div>
            </div>
            <button 
              onClick={handleExport} 
              disabled={isProcessing}
              className="primary-button"
            >
              {isProcessing ? 'Exporting...' : 'Download OBJ File'}
            </button>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="integrated-app">
      <div className="workflow-steps">
        <div className={`step ${currentStep === 'upload' ? 'active' : ''} ${selectedFile ? 'completed' : ''}`}>
          1. Upload
        </div>
        <div className={`step ${currentStep === 'convert' ? 'active' : ''} ${currentStep !== 'upload' && currentStep !== 'convert' ? 'completed' : ''}`}>
          2. Convert
        </div>
        <div className={`step ${currentStep === 'edit' ? 'active' : ''} ${dotPattern ? 'completed' : ''}`}>
          3. Edit
        </div>
        <div className={`step ${currentStep === 'generate3d' ? 'active' : ''}`}>
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
            setCurrentStep('upload')
            setSelectedFile(null)
            setDotPattern(null)
            setError(null)
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