import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Model3DService } from '@/services/Model3DService'
import { ModelViewer } from './ModelViewer'
import type { DotPattern, Model3DParams, ExportParams } from '@/types'

interface Model3DProps {
  pattern: DotPattern
  onExportComplete: (blob: Blob, filename: string) => void
  onError: (error: string) => void
}

interface GenerationProgress {
  stage: 'idle' | 'validating' | 'generating' | 'optimizing' | 'complete' | 'error'
  progress: number
  message: string
  estimatedTime?: string
}

export const Model3D: React.FC<Model3DProps> = ({
  pattern,
  onExportComplete,
  onError
}) => {
  const [model3DParams, setModel3DParams] = useState<Model3DParams>(() => 
    Model3DService.getDefault3DParams()
  )
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress>({
    stage: 'idle',
    progress: 0,
    message: 'Ready to generate 3D model'
  })
  const [isAdvancedMode, setIsAdvancedMode] = useState(false)
  const [paramErrors, setParamErrors] = useState<string[]>([])

  // Calculate if pattern is large and might need optimization
  const patternComplexity = useMemo(() => {
    const totalDots = pattern.width * pattern.height
    const activeDots = pattern.data.flat().filter(Boolean).length
    const complexity = (totalDots * activeDots) / (pattern.width * pattern.height)
    
    return {
      totalDots,
      activeDots,
      complexity,
      isLarge: totalDots > 10000,
      isComplex: complexity > 0.7
    }
  }, [pattern])

  // Validate parameters whenever they change
  useEffect(() => {
    const errors = Model3DService.validate3DParams(model3DParams)
    setParamErrors(errors)
  }, [model3DParams])

  // Auto-optimize parameters for large patterns
  useEffect(() => {
    if (patternComplexity.isLarge || patternComplexity.isComplex) {
      setModel3DParams(prev => ({
        ...prev,
        optimizeMesh: true,
        mergeAdjacentFaces: true,
        // Reduce cube size for very large patterns
        cubeSize: patternComplexity.totalDots > 50000 ? 1.5 : prev.cubeSize,
        // Increase spacing slightly for better printing
        spacing: patternComplexity.isComplex ? 0.15 : prev.spacing
      }))
    }
  }, [patternComplexity])

  const handleParameterChange = useCallback((paramName: keyof Model3DParams, value: any) => {
    setModel3DParams(prev => ({
      ...prev,
      [paramName]: value
    }))
  }, [])

  const simulateGenerationProgress = useCallback(async () => {
    const stages = [
      { stage: 'validating' as const, progress: 10, message: 'Validating pattern and parameters...', duration: 500 },
      { stage: 'generating' as const, progress: 40, message: 'Generating 3D mesh from pattern...', duration: 1500 },
      { stage: 'optimizing' as const, progress: 80, message: 'Optimizing mesh for 3D printing...', duration: 1000 },
      { stage: 'complete' as const, progress: 100, message: '3D model generated successfully!', duration: 500 }
    ]

    for (const stageInfo of stages) {
      setGenerationProgress({
        ...stageInfo,
        estimatedTime: stageInfo.stage === 'generating' ? 
          `~${Math.ceil(patternComplexity.activeDots / 1000)} seconds` : undefined
      })
      await new Promise(resolve => setTimeout(resolve, stageInfo.duration))
    }

    // Reset to idle after completion
    setTimeout(() => {
      setGenerationProgress({
        stage: 'idle',
        progress: 0,
        message: 'Ready to generate 3D model'
      })
    }, 2000)
  }, [patternComplexity.activeDots])

  const handleExport = useCallback((blob: Blob, filename: string) => {
    onExportComplete(blob, filename)
    
    // Show brief success message
    setGenerationProgress({
      stage: 'complete',
      progress: 100,
      message: `Exported ${filename} successfully!`
    })

    setTimeout(() => {
      setGenerationProgress({
        stage: 'idle',
        progress: 0,
        message: 'Ready to generate 3D model'
      })
    }, 3000)
  }, [onExportComplete])

  const handleModelViewerError = useCallback((error: string) => {
    setGenerationProgress({
      stage: 'error',
      progress: 0,
      message: error
    })
    onError(error)

    setTimeout(() => {
      setGenerationProgress({
        stage: 'idle',
        progress: 0,
        message: 'Ready to generate 3D model'
      })
    }, 5000)
  }, [onError])

  // Trigger progress simulation when pattern changes
  useEffect(() => {
    if (pattern && pattern.data.length > 0) {
      simulateGenerationProgress()
    }
  }, [pattern, simulateGenerationProgress])

  const printEstimates = useMemo(() => {
    return Model3DService.calculatePrintEstimates(pattern, model3DParams)
  }, [pattern, model3DParams])

  const hasErrors = paramErrors.length > 0

  return (
    <div className="model-3d">
      <div className="model-3d-header">
        <h2>3D Model Generation</h2>
        <div className="pattern-summary">
          <span>Pattern: {pattern.width}×{pattern.height}</span>
          <span>Active Dots: {patternComplexity.activeDots.toLocaleString()}</span>
          {patternComplexity.isLarge && (
            <span className="warning">⚠️ Large Pattern - Auto-optimization enabled</span>
          )}
        </div>
      </div>

      {/* Generation Progress */}
      {generationProgress.stage !== 'idle' && (
        <div className="generation-progress">
          <div className="progress-header">
            <span className="progress-message">{generationProgress.message}</span>
            <span className="progress-percentage">{generationProgress.progress}%</span>
          </div>
          <div className="progress-bar">
            <div 
              className={`progress-fill ${generationProgress.stage}`}
              style={{ width: `${generationProgress.progress}%` }}
            />
          </div>
          {generationProgress.estimatedTime && (
            <div className="progress-estimate">
              Estimated time remaining: {generationProgress.estimatedTime}
            </div>
          )}
        </div>
      )}

      {/* Parameter Controls */}
      <div className="model-parameters">
        <div className="parameter-header">
          <h3>Model Parameters</h3>
          <button 
            onClick={() => setIsAdvancedMode(!isAdvancedMode)}
            className="toggle-advanced"
          >
            {isAdvancedMode ? '🔼 Hide' : '🔽 Show'} Advanced Options
          </button>
        </div>

        {hasErrors && (
          <div className="parameter-errors">
            {paramErrors.map((error, index) => (
              <div key={index} className="error-message">⚠️ {error}</div>
            ))}
          </div>
        )}

        <div className="basic-parameters">
          <div className="parameter-group">
            <label htmlFor="cubeHeight">Cube Height (mm)</label>
            <input
              id="cubeHeight"
              type="number"
              min="0.1"
              max="50"
              step="0.1"
              value={model3DParams.cubeHeight}
              onChange={(e) => handleParameterChange('cubeHeight', parseFloat(e.target.value))}
            />
          </div>

          <div className="parameter-group">
            <label htmlFor="cubeSize">Cube Size (mm)</label>
            <input
              id="cubeSize"
              type="number"
              min="0.1"
              max="50"
              step="0.1"
              value={model3DParams.cubeSize}
              onChange={(e) => handleParameterChange('cubeSize', parseFloat(e.target.value))}
            />
          </div>

          <div className="parameter-group">
            <label htmlFor="generateBase">
              <input
                id="generateBase"
                type="checkbox"
                checked={model3DParams.generateBase}
                onChange={(e) => handleParameterChange('generateBase', e.target.checked)}
              />
              Generate Base Layer
            </label>
          </div>
        </div>

        {isAdvancedMode && (
          <div className="advanced-parameters">
            <div className="parameter-group">
              <label htmlFor="spacing">Spacing (mm)</label>
              <input
                id="spacing"
                type="number"
                min="0"
                max="10"
                step="0.05"
                value={model3DParams.spacing}
                onChange={(e) => handleParameterChange('spacing', parseFloat(e.target.value))}
              />
            </div>

            <div className="parameter-group">
              <label htmlFor="baseThickness">Base Thickness (mm)</label>
              <input
                id="baseThickness"
                type="number"
                min="0.1"
                max="20"
                step="0.1"
                value={model3DParams.baseThickness}
                disabled={!model3DParams.generateBase}
                onChange={(e) => handleParameterChange('baseThickness', parseFloat(e.target.value))}
              />
            </div>

            <div className="parameter-group">
              <label htmlFor="optimizeMesh">
                <input
                  id="optimizeMesh"
                  type="checkbox"
                  checked={model3DParams.optimizeMesh}
                  onChange={(e) => handleParameterChange('optimizeMesh', e.target.checked)}
                />
                Optimize Mesh
              </label>
            </div>

            <div className="parameter-group">
              <label htmlFor="mergeAdjacentFaces">
                <input
                  id="mergeAdjacentFaces"
                  type="checkbox"
                  checked={model3DParams.mergeAdjacentFaces}
                  onChange={(e) => handleParameterChange('mergeAdjacentFaces', e.target.checked)}
                />
                Merge Adjacent Faces
              </label>
            </div>

            <div className="parameter-group">
              <label htmlFor="chamferEdges">
                <input
                  id="chamferEdges"
                  type="checkbox"
                  checked={model3DParams.chamferEdges}
                  onChange={(e) => handleParameterChange('chamferEdges', e.target.checked)}
                />
                Chamfer Edges
              </label>
            </div>

            {model3DParams.chamferEdges && (
              <div className="parameter-group">
                <label htmlFor="chamferSize">Chamfer Size (mm)</label>
                <input
                  id="chamferSize"
                  type="number"
                  min="0"
                  max="5"
                  step="0.05"
                  value={model3DParams.chamferSize}
                  onChange={(e) => handleParameterChange('chamferSize', parseFloat(e.target.value))}
                />
              </div>
            )}
          </div>
        )}

        {/* Print Estimates */}
        <div className="print-estimates">
          <h4>Print Estimates</h4>
          <div className="estimate-grid">
            <div className="estimate-item">
              <span className="estimate-label">Print Time:</span>
              <span className="estimate-value">{printEstimates.estimatedPrintTime}</span>
            </div>
            <div className="estimate-item">
              <span className="estimate-label">Material:</span>
              <span className="estimate-value">{printEstimates.estimatedMaterial}</span>
            </div>
            <div className="estimate-item">
              <span className="estimate-label">Est. Cost:</span>
              <span className="estimate-value">{printEstimates.estimatedCost}</span>
            </div>
          </div>
        </div>

        {/* Optimization Tips */}
        {(patternComplexity.isLarge || patternComplexity.isComplex) && (
          <div className="optimization-tips">
            <h4>💡 Optimization Tips</h4>
            <ul>
              {patternComplexity.isLarge && (
                <li>Large pattern detected - consider reducing cube size for faster printing</li>
              )}
              {patternComplexity.isComplex && (
                <li>Complex pattern - mesh optimization recommended for best results</li>
              )}
              {patternComplexity.activeDots > 5000 && (
                <li>High dot count - enable "Merge Adjacent Faces" to reduce file size</li>
              )}
              {!model3DParams.generateBase && (
                <li>Consider enabling base layer for better bed adhesion</li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* 3D Model Viewer */}
      <div className="model-viewer-container">
        <ModelViewer
          pattern={pattern}
          model3DParams={model3DParams}
          onExport={handleExport}
          onError={handleModelViewerError}
        />
      </div>

      <div className="model-help">
        <p><strong>Usage Instructions:</strong></p>
        <ul>
          <li>Adjust parameters above to customize your 3D model</li>
          <li>Use the 3D viewer to inspect the model from all angles</li>
          <li>Export the OBJ file when satisfied with the preview</li>
          <li>Import the OBJ file into your 3D printing software</li>
        </ul>
      </div>
    </div>
  )
}

export default Model3D