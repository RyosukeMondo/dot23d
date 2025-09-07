import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { FileUpload } from '@/components/FileUpload'
import { ImageProcessor } from '@/components/ImageProcessor'
import { ImageService } from '@/services/ImageService'
import { DotArtService } from '@/services/DotArtService'
import type { DotPattern, ConversionParams } from '@/types'

interface ConversionTest {
  id: string
  file: File
  timestamp: Date
  originalParams: ConversionParams
  resultPattern?: DotPattern
  processingTime: number
  success: boolean
  errorMessage?: string
  notes?: string
}

export const ImageConversionPage: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [conversionTests, setConversionTests] = useState<ConversionTest[]>([])
  const [currentTest, setCurrentTest] = useState<ConversionTest | null>(null)
  const [isBenchmarking, setIsBenchmarking] = useState(false)
  const [testPresets] = useState<Array<{
    name: string
    description: string
    params: Partial<ConversionParams>
  }>>([
    {
      name: "High Detail",
      description: "Large size, low threshold for detailed conversion",
      params: { targetWidth: 100, targetHeight: 100, threshold: 100 }
    },
    {
      name: "Low Detail",
      description: "Small size, high threshold for simplified conversion",
      params: { targetWidth: 25, targetHeight: 25, threshold: 180 }
    },
    {
      name: "High Contrast",
      description: "Enhanced contrast with dithering",
      params: { enhanceContrast: true, contrastFactor: 2.0, enableDithering: true }
    },
    {
      name: "Blurred Source",
      description: "Pre-blur with moderate threshold",
      params: { preBlur: true, blurRadius: 2, threshold: 128 }
    },
    {
      name: "Inverted Colors",
      description: "Inverted color scheme",
      params: { invert: true, threshold: 128 }
    }
  ])

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file)
  }, [])

  const handlePatternGenerated = useCallback((pattern: DotPattern) => {
    if (!selectedFile || !currentTest) return

    const endTime = Date.now()
    const processingTime = endTime - currentTest.timestamp.getTime()

    const updatedTest: ConversionTest = {
      ...currentTest,
      resultPattern: pattern,
      processingTime,
      success: true
    }

    setConversionTests(prev => {
      const index = prev.findIndex(test => test.id === currentTest.id)
      if (index >= 0) {
        const updated = [...prev]
        updated[index] = updatedTest
        return updated
      }
      return [updatedTest, ...prev]
    })

    setCurrentTest(updatedTest)
  }, [selectedFile, currentTest])

  const handleError = useCallback((error: string) => {
    if (!currentTest) return

    const endTime = Date.now()
    const processingTime = endTime - currentTest.timestamp.getTime()

    const failedTest: ConversionTest = {
      ...currentTest,
      processingTime,
      success: false,
      errorMessage: error
    }

    setConversionTests(prev => {
      const index = prev.findIndex(test => test.id === currentTest.id)
      if (index >= 0) {
        const updated = [...prev]
        updated[index] = failedTest
        return updated
      }
      return [failedTest, ...prev]
    })

    setCurrentTest(failedTest)
  }, [currentTest])

  const startNewTest = useCallback((params?: Partial<ConversionParams>) => {
    if (!selectedFile) return

    const defaultParams = ImageService.getDefaultConversionParams()
    const testParams = { ...defaultParams, ...params }

    const newTest: ConversionTest = {
      id: `test-${Date.now()}`,
      file: selectedFile,
      timestamp: new Date(),
      originalParams: testParams,
      processingTime: 0,
      success: false
    }

    setCurrentTest(newTest)
  }, [selectedFile])

  const runBenchmarkTests = useCallback(async () => {
    if (!selectedFile) return

    setIsBenchmarking(true)

    for (const preset of testPresets) {
      try {
        const defaultParams = ImageService.getDefaultConversionParams()
        const testParams = { ...defaultParams, ...preset.params }

        const startTime = Date.now()

        const result = await ImageService.convertToDotsPattern(selectedFile, testParams)
        
        if (result.error) {
          handleError(`Pattern generation failed: ${result.error.userMessage || result.error.message}`)
          return
        }
        
        if (!result.data) {
          handleError('No pattern data returned')
          return
        }

        const endTime = Date.now()
        const processingTime = endTime - startTime

        const benchmarkTest: ConversionTest = {
          id: `benchmark-${preset.name}-${Date.now()}`,
          file: selectedFile,
          timestamp: new Date(startTime),
          originalParams: testParams,
          resultPattern: result.data,
          processingTime,
          success: true,
          notes: `Benchmark: ${preset.name} - ${preset.description}`
        }

        setConversionTests(prev => [benchmarkTest, ...prev])

        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (error) {
        const failedTest: ConversionTest = {
          id: `benchmark-failed-${preset.name}-${Date.now()}`,
          file: selectedFile,
          timestamp: new Date(),
          originalParams: { ...ImageService.getDefaultConversionParams(), ...preset.params },
          processingTime: 0,
          success: false,
          errorMessage: error instanceof Error ? error.message : 'Benchmark test failed',
          notes: `Failed benchmark: ${preset.name}`
        }

        setConversionTests(prev => [failedTest, ...prev])
      }
    }

    setIsBenchmarking(false)
  }, [selectedFile, testPresets])

  const clearTests = useCallback(() => {
    setConversionTests([])
    setCurrentTest(null)
  }, [])

  const exportTestResults = useCallback(() => {
    const results = conversionTests.map(test => ({
      id: test.id,
      fileName: test.file.name,
      fileSize: test.file.size,
      timestamp: test.timestamp.toISOString(),
      success: test.success,
      processingTime: test.processingTime,
      parameters: test.originalParams,
      errorMessage: test.errorMessage,
      notes: test.notes,
      patternStats: test.resultPattern ? DotArtService.getPatternStats(test.resultPattern) : null
    }))

    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `conversion-test-results-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [conversionTests])

  const testSummary = useMemo(() => {
    const total = conversionTests.length
    const successful = conversionTests.filter(test => test.success).length
    const failed = total - successful
    const averageTime = total > 0 
      ? conversionTests.reduce((sum, test) => sum + test.processingTime, 0) / total
      : 0

    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? (successful / total * 100).toFixed(1) : '0',
      averageTime: averageTime.toFixed(0)
    }
  }, [conversionTests])

  const quickTestButtons = useMemo(() => {
    if (!selectedFile) return []

    return testPresets.map(preset => ({
      ...preset,
      onClick: () => startNewTest(preset.params)
    }))
  }, [selectedFile, testPresets, startNewTest])

  return (
    <div className="image-conversion-page">
      <header className="page-header">
        <h1>Image Conversion Testing Page</h1>
        <p>Test and validate image-to-dot-art conversion with different parameters</p>
      </header>

      {/* File Selection */}
      <section className="file-selection-section">
        <h2>Select Test Image</h2>
        <FileUpload
          onFileSelect={handleFileSelect}
          acceptedTypes=".jpg,.jpeg,.png,.gif,.bmp,.webp"
          maxSize={10 * 1024 * 1024}
        />

        {selectedFile && (
          <div className="selected-file-info">
            <h3>Selected File: {selectedFile.name}</h3>
            <p>Size: {(selectedFile.size / 1024).toFixed(1)} KB</p>
            <p>Type: {selectedFile.type}</p>
          </div>
        )}
      </section>

      {/* Quick Tests */}
      {selectedFile && (
        <section className="quick-tests-section">
          <h2>Quick Test Presets</h2>
          <div className="preset-buttons">
            {quickTestButtons.map((preset, index) => (
              <button
                key={index}
                onClick={preset.onClick}
                className="preset-button"
                disabled={isBenchmarking}
              >
                <strong>{preset.name}</strong>
                <p>{preset.description}</p>
              </button>
            ))}
          </div>

          <div className="benchmark-controls">
            <button
              onClick={runBenchmarkTests}
              disabled={isBenchmarking}
              className="benchmark-button"
            >
              {isBenchmarking ? '⏳ Running Benchmarks...' : '🏁 Run All Benchmark Tests'}
            </button>
            
            {conversionTests.length > 0 && (
              <>
                <button onClick={exportTestResults} className="export-button">
                  📊 Export Test Results
                </button>
                <button onClick={clearTests} className="clear-button">
                  🗑️ Clear All Tests
                </button>
              </>
            )}
          </div>
        </section>
      )}

      {/* Interactive Conversion Testing */}
      {selectedFile && currentTest && (
        <section className="interactive-conversion-section">
          <h2>Interactive Conversion Testing</h2>
          <p>Test ID: {currentTest.id}</p>
          
          <ImageProcessor
            file={selectedFile}
            onPatternGenerated={handlePatternGenerated}
            onError={handleError}
          />
        </section>
      )}

      {/* Test Summary */}
      {conversionTests.length > 0 && (
        <section className="test-summary-section">
          <h2>Test Summary</h2>
          <div className="summary-grid">
            <div className="summary-item">
              <span className="summary-label">Total Tests:</span>
              <span className="summary-value">{testSummary.total}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Successful:</span>
              <span className="summary-value success">{testSummary.successful}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Failed:</span>
              <span className="summary-value error">{testSummary.failed}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Success Rate:</span>
              <span className="summary-value">{testSummary.successRate}%</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Avg Processing Time:</span>
              <span className="summary-value">{testSummary.averageTime}ms</span>
            </div>
          </div>
        </section>
      )}

      {/* Test Results History */}
      {conversionTests.length > 0 && (
        <section className="test-results-section">
          <h2>Test Results History</h2>
          <div className="results-list">
            {conversionTests.map(test => (
              <div
                key={test.id}
                className={`result-item ${test.success ? 'success' : 'error'}`}
              >
                <div className="result-header">
                  <span className="result-status">
                    {test.success ? '✅' : '❌'} {test.id}
                  </span>
                  <span className="result-time">{test.processingTime}ms</span>
                  <span className="result-timestamp">
                    {test.timestamp.toLocaleTimeString()}
                  </span>
                </div>

                <div className="result-details">
                  <div className="result-params">
                    <strong>Parameters:</strong>
                    <ul>
                      <li>Size: {test.originalParams.targetWidth}×{test.originalParams.targetHeight}</li>
                      <li>Threshold: {test.originalParams.threshold}</li>
                      <li>Invert: {test.originalParams.invert ? 'Yes' : 'No'}</li>
                      <li>Dithering: {test.originalParams.enableDithering ? 'Yes' : 'No'}</li>
                      {test.originalParams.enhanceContrast && (
                        <li>Contrast Factor: {test.originalParams.contrastFactor}</li>
                      )}
                      {test.originalParams.preBlur && (
                        <li>Blur Radius: {test.originalParams.blurRadius}</li>
                      )}
                    </ul>
                  </div>

                  {test.success && test.resultPattern && (
                    <div className="result-pattern-stats">
                      <strong>Pattern Statistics:</strong>
                      {(() => {
                        const stats = DotArtService.getPatternStats(test.resultPattern)
                        return (
                          <ul>
                            <li>Active Dots: {stats.activeDots.toLocaleString()}</li>
                            <li>Total Dots: {stats.totalDots.toLocaleString()}</li>
                            <li>Fill Percentage: {stats.fillPercentage.toFixed(1)}%</li>
                          </ul>
                        )
                      })()}
                    </div>
                  )}

                  {!test.success && test.errorMessage && (
                    <div className="result-error">
                      <strong>Error:</strong> {test.errorMessage}
                    </div>
                  )}

                  {test.notes && (
                    <div className="result-notes">
                      <strong>Notes:</strong> {test.notes}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Performance Analysis */}
      {conversionTests.length >= 3 && (
        <section className="performance-analysis-section">
          <h2>Performance Analysis</h2>
          
          <div className="performance-insights">
            <h3>💡 Performance Insights</h3>
            <ul>
              {conversionTests.filter(test => test.success && test.processingTime > 2000).length > 0 && (
                <li>⚠️ Some tests took longer than 2 seconds - consider optimization for larger patterns</li>
              )}
              {conversionTests.filter(test => !test.success).length > conversionTests.length * 0.2 && (
                <li>⚠️ High failure rate detected - check parameter validation</li>
              )}
              {conversionTests.some(test => test.success && test.resultPattern && 
                DotArtService.getPatternStats(test.resultPattern).fillPercentage < 5) && (
                <li>💡 Some patterns have very low fill percentage - consider adjusting threshold</li>
              )}
              {conversionTests.some(test => test.success && test.resultPattern && 
                DotArtService.getPatternStats(test.resultPattern).fillPercentage > 90) && (
                <li>💡 Some patterns have very high fill percentage - may need threshold adjustment</li>
              )}
            </ul>
          </div>

          <div className="timing-analysis">
            <h3>⏱️ Processing Time Analysis</h3>
            <div className="timing-stats">
              <div className="timing-item">
                <span>Fastest:</span>
                <span>{Math.min(...conversionTests.filter(t => t.success).map(t => t.processingTime))}ms</span>
              </div>
              <div className="timing-item">
                <span>Slowest:</span>
                <span>{Math.max(...conversionTests.filter(t => t.success).map(t => t.processingTime))}ms</span>
              </div>
              <div className="timing-item">
                <span>Median:</span>
                <span>
                  {(() => {
                    const times = conversionTests.filter(t => t.success).map(t => t.processingTime).sort((a, b) => a - b)
                    const mid = Math.floor(times.length / 2)
                    return times.length > 0 ? times[mid] : 0
                  })()}ms
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="testing-help">
        <h2>Testing Guide</h2>
        <div className="help-content">
          <h3>🧪 Test Categories</h3>
          <ul>
            <li><strong>Parameter Testing:</strong> Test different threshold, size, and enhancement settings</li>
            <li><strong>Edge Case Testing:</strong> Very small/large images, extreme parameters, unusual aspect ratios</li>
            <li><strong>Performance Testing:</strong> Measure processing times with different configurations</li>
            <li><strong>Quality Testing:</strong> Compare output quality with different settings</li>
          </ul>

          <h3>🎯 Key Metrics to Monitor</h3>
          <ul>
            <li>Processing time vs. image size and parameters</li>
            <li>Pattern fill percentage distribution</li>
            <li>Success/failure rates across different settings</li>
            <li>Quality of conversion with different source image types</li>
          </ul>

          <h3>⚙️ Testing Best Practices</h3>
          <ul>
            <li>Test with various image formats and sizes</li>
            <li>Use both photographic and graphic/artistic source images</li>
            <li>Test extreme parameter values to find limits</li>
            <li>Document any unusual behavior or unexpected results</li>
          </ul>
        </div>
      </section>
    </div>
  )
}

export default ImageConversionPage