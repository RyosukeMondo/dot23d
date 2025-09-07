import React, { useState, useCallback, useEffect, useRef } from 'react'
import { ImageService } from '@/services/ImageService'
import type { DotPattern, ConversionParams } from '@/types'

interface ImageProcessorProps {
  file: File
  onPatternGenerated: (pattern: DotPattern) => void
  onError: (error: string) => void
}

export const ImageProcessor: React.FC<ImageProcessorProps> = ({
  file,
  onPatternGenerated,
  onError
}) => {
  const [originalImage, setOriginalImage] = useState<ImageData | null>(null)
  const [processedImage, setProcessedImage] = useState<ImageData | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [conversionParams, setConversionParams] = useState<ConversionParams>(
    ImageService.getDefaultConversionParams()
  )
  
  const originalCanvasRef = useRef<HTMLCanvasElement>(null)
  const processedCanvasRef = useRef<HTMLCanvasElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)

  // Load original image on mount
  useEffect(() => {
    const loadImage = async () => {
      try {
        setIsProcessing(true)
        const result = await ImageService.loadImage(file)
        
        if (result.error) {
          onError(`Failed to load image: ${result.error.userMessage || result.error.message}`)
          return
        }
        
        if (result.data) {
          setOriginalImage(result.data)
          
          // Draw original image to canvas
          if (originalCanvasRef.current) {
            const canvas = originalCanvasRef.current
            const ctx = canvas.getContext('2d')
            if (ctx) {
              canvas.width = result.data.width
              canvas.height = result.data.height
              ctx.putImageData(result.data, 0, 0)
            }
          }
        }
      } catch (error) {
        onError(`Failed to load image: ${error instanceof Error ? error.message : 'Unknown error'}`)
      } finally {
        setIsProcessing(false)
      }
    }

    loadImage()
  }, [file, onError])

  // Process image when parameters change
  useEffect(() => {
    if (!originalImage) return

    const processImage = async () => {
      try {
        setIsProcessing(true)
        
        // Resize image first
        const resizedImage = ImageService.resizeImage(
          originalImage, 
          conversionParams.targetWidth, 
          conversionParams.targetHeight,
          conversionParams.maintainAspectRatio
        )
        
        // Apply threshold
        const thresholdImage = ImageService.adjustThreshold(
          resizedImage,
          conversionParams.threshold,
          conversionParams.invert
        )
        
        setProcessedImage(thresholdImage)
        
        // Draw processed image to canvas
        if (processedCanvasRef.current) {
          const canvas = processedCanvasRef.current
          const ctx = canvas.getContext('2d')
          if (ctx) {
            canvas.width = thresholdImage.width
            canvas.height = thresholdImage.height
            ctx.putImageData(thresholdImage, 0, 0)
          }
        }
        
        // Generate dot pattern preview
        const result = await ImageService.convertToDotsPattern(file, conversionParams)
        
        if (result.error) {
          onError(`Pattern generation failed: ${result.error.userMessage || result.error.message}`)
          return
        }
        
        if (result.data) {
          drawDotPatternPreview(result.data)
        }
        
      } catch (error) {
        onError(`Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      } finally {
        setIsProcessing(false)
      }
    }

    processImage()
  }, [originalImage, conversionParams, file, onError])

  const drawDotPatternPreview = useCallback((pattern: DotPattern) => {
    if (!previewCanvasRef.current) return

    const canvas = previewCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dotSize = Math.max(2, Math.min(20, 400 / Math.max(pattern.width, pattern.height)))
    const spacing = dotSize + 1

    canvas.width = pattern.width * spacing
    canvas.height = pattern.height * spacing

    // Clear canvas
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw dots
    ctx.fillStyle = '#000000'
    for (let y = 0; y < pattern.height; y++) {
      for (let x = 0; x < pattern.width; x++) {
        if (pattern.data[y][x]) {
          ctx.fillRect(
            x * spacing + 1, 
            y * spacing + 1, 
            dotSize - 1, 
            dotSize - 1
          )
        }
      }
    }
  }, [])

  const handleGeneratePattern = useCallback(async () => {
    if (!originalImage) return

    try {
      setIsProcessing(true)
      const result = await ImageService.convertToDotsPattern(file, conversionParams)
      
      if (result.error) {
        onError(`Pattern generation failed: ${result.error.userMessage || result.error.message}`)
        return
      }
      
      if (result.data) {
        onPatternGenerated(result.data)
      }
    } catch (error) {
      onError(`Pattern generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsProcessing(false)
    }
  }, [originalImage, file, conversionParams, onPatternGenerated, onError])

  const handleParamChange = useCallback((key: keyof ConversionParams, value: any) => {
    setConversionParams(prev => ({ ...prev, [key]: value }))
  }, [])

  const getRecommendedDimensions = useCallback(() => {
    if (!originalImage) return { width: 50, height: 50 }
    return ImageService.calculateRecommendedDimensions(originalImage, 100)
  }, [originalImage])

  const applyRecommendedDimensions = useCallback(() => {
    const recommended = getRecommendedDimensions()
    setConversionParams(prev => ({
      ...prev,
      targetWidth: recommended.width,
      targetHeight: recommended.height
    }))
  }, [getRecommendedDimensions])

  return (
    <div className="image-processor">
      <div className="processor-header">
        <h2>Image Processing</h2>
        <p>Adjust parameters to convert your image to dot art</p>
      </div>

      {isProcessing && (
        <div className="processing-overlay">
          <div className="spinner"></div>
          <p>Processing...</p>
        </div>
      )}

      <div className="processing-controls">
        <div className="control-group">
          <h3>Size Settings</h3>
          
          <div className="control-row">
            <label>
              Target Width:
              <input
                type="number"
                min="1"
                max="200"
                value={conversionParams.targetWidth}
                onChange={(e) => handleParamChange('targetWidth', parseInt(e.target.value))}
                disabled={isProcessing}
              />
            </label>
            
            <label>
              Target Height:
              <input
                type="number"
                min="1"
                max="200"
                value={conversionParams.targetHeight}
                onChange={(e) => handleParamChange('targetHeight', parseInt(e.target.value))}
                disabled={isProcessing}
              />
            </label>
          </div>

          <div className="control-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={conversionParams.maintainAspectRatio}
                onChange={(e) => handleParamChange('maintainAspectRatio', e.target.checked)}
                disabled={isProcessing}
              />
              Maintain Aspect Ratio
            </label>
            
            <button
              onClick={applyRecommendedDimensions}
              disabled={isProcessing || !originalImage}
              className="recommend-btn"
            >
              Use Recommended ({getRecommendedDimensions().width}×{getRecommendedDimensions().height})
            </button>
          </div>
        </div>

        <div className="control-group">
          <h3>Conversion Settings</h3>
          
          <div className="control-row">
            <label>
              Threshold: {conversionParams.threshold}
              <input
                type="range"
                min="0"
                max="255"
                value={conversionParams.threshold}
                onChange={(e) => handleParamChange('threshold', parseInt(e.target.value))}
                disabled={isProcessing}
                className="threshold-slider"
              />
            </label>
          </div>

          <div className="control-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={conversionParams.invert}
                onChange={(e) => handleParamChange('invert', e.target.checked)}
                disabled={isProcessing}
              />
              Invert Colors
            </label>
            
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={conversionParams.enableDithering}
                onChange={(e) => handleParamChange('enableDithering', e.target.checked)}
                disabled={isProcessing}
              />
              Enable Dithering
            </label>
          </div>
        </div>

        <div className="control-group">
          <h3>Enhancement Settings</h3>
          
          <div className="control-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={conversionParams.enhanceContrast}
                onChange={(e) => handleParamChange('enhanceContrast', e.target.checked)}
                disabled={isProcessing}
              />
              Enhance Contrast
            </label>
            
            {conversionParams.enhanceContrast && (
              <label>
                Factor: {conversionParams.contrastFactor.toFixed(1)}
                <input
                  type="range"
                  min="0.1"
                  max="3.0"
                  step="0.1"
                  value={conversionParams.contrastFactor}
                  onChange={(e) => handleParamChange('contrastFactor', parseFloat(e.target.value))}
                  disabled={isProcessing}
                />
              </label>
            )}
          </div>

          <div className="control-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={conversionParams.preBlur}
                onChange={(e) => handleParamChange('preBlur', e.target.checked)}
                disabled={isProcessing}
              />
              Pre-blur
            </label>
            
            {conversionParams.preBlur && (
              <label>
                Radius: {conversionParams.blurRadius}
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={conversionParams.blurRadius}
                  onChange={(e) => handleParamChange('blurRadius', parseInt(e.target.value))}
                  disabled={isProcessing}
                />
              </label>
            )}
          </div>
        </div>
      </div>

      <div className="preview-section">
        <div className="preview-grid">
          <div className="preview-item">
            <h4>Original Image</h4>
            <div className="canvas-container">
              <canvas
                ref={originalCanvasRef}
                className="preview-canvas"
              />
            </div>
          </div>

          <div className="preview-item">
            <h4>Processed Image</h4>
            <div className="canvas-container">
              <canvas
                ref={processedCanvasRef}
                className="preview-canvas"
              />
            </div>
          </div>

          <div className="preview-item">
            <h4>Dot Pattern Preview</h4>
            <div className="canvas-container">
              <canvas
                ref={previewCanvasRef}
                className="preview-canvas dot-preview"
              />
            </div>
            <div className="preview-info">
              <p>Size: {conversionParams.targetWidth}×{conversionParams.targetHeight}</p>
              <p>Total dots: {conversionParams.targetWidth * conversionParams.targetHeight}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="action-buttons">
        <button
          onClick={handleGeneratePattern}
          disabled={isProcessing || !originalImage}
          className="generate-btn primary"
        >
          {isProcessing ? 'Generating...' : 'Generate Dot Pattern'}
        </button>
      </div>
    </div>
  )
}

export default ImageProcessor