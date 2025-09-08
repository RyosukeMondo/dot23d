import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAppContext } from '@/context/AppContext'
import { TestSessionService } from '@/services/TestSessionService'
import type { DotPattern, Model3DParams, SweepConfig, SweepResult, TestResult } from '@/types'
import styles from './ParameterSweep.module.css'

export interface ParameterSweepProps {
  /** Pattern to test with */
  pattern?: DotPattern
  /** Base parameters to sweep from */
  baseParams?: Model3DParams
  /** Callback when sweep completes */
  onSweepComplete?: (results: SweepResult[]) => void
  /** Callback for progress updates */
  onProgress?: (current: number, total: number) => void
}

type SweepMetric = 'processingTime' | 'qualityScore' | 'vertexCount' | 'faceCount' | 'memoryUsage'

export const ParameterSweep: React.FC<ParameterSweepProps> = ({
  pattern,
  baseParams,
  onSweepComplete,
  onProgress
}) => {
  const { state, addTestResult } = useAppContext()
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [results, setResults] = useState<SweepResult[]>([])
  const [selectedMetric, setSelectedMetric] = useState<SweepMetric>('processingTime')
  const [showOptimalParams, setShowOptimalParams] = useState(true)
  
  // Sweep configuration
  const [sweepConfig, setSweepConfig] = useState<SweepConfig>({
    parameter: 'cubeHeight',
    startValue: 0.5,
    endValue: 3.0,
    steps: 10,
    logarithmic: false
  })

  const currentPattern = pattern || state.currentPattern
  const currentParams = baseParams || state.model3DParams

  // Calculate sweep values
  const sweepValues = useMemo(() => {
    const { startValue, endValue, steps, logarithmic } = sweepConfig
    const values: number[] = []
    
    if (logarithmic) {
      const logStart = Math.log(startValue)
      const logEnd = Math.log(endValue)
      const logStep = (logEnd - logStart) / (steps - 1)
      
      for (let i = 0; i < steps; i++) {
        values.push(Math.exp(logStart + i * logStep))
      }
    } else {
      const step = (endValue - startValue) / (steps - 1)
      for (let i = 0; i < steps; i++) {
        values.push(startValue + i * step)
      }
    }
    
    return values
  }, [sweepConfig])

  // Handle progress updates
  const handleProgress = useCallback((current: number, total: number) => {
    setProgress({ current, total })
    onProgress?.(current, total)
  }, [onProgress])

  // Run parameter sweep
  const runSweep = useCallback(async () => {
    if (!state.testSession || !currentPattern) return

    try {
      setIsRunning(true)
      setResults([])
      
      const sweepResults = await TestSessionService.runParameterSweep(
        state.testSession.id,
        currentPattern,
        currentParams,
        sweepConfig,
        handleProgress
      )

      setResults(sweepResults)
      sweepResults.forEach(result => addTestResult(result.testResult))
      onSweepComplete?.(sweepResults)
    } catch (error) {
      console.error('Parameter sweep failed:', error)
    } finally {
      setIsRunning(false)
      setProgress({ current: 0, total: 0 })
    }
  }, [
    state.testSession,
    currentPattern,
    currentParams,
    sweepConfig,
    handleProgress,
    addTestResult,
    onSweepComplete
  ])

  // Get optimal parameter value
  const optimalResult = useMemo(() => {
    if (results.length === 0) return null
    
    let best = results[0]
    for (const result of results) {
      switch (selectedMetric) {
        case 'processingTime':
          if (result.testResult.processingTime < best.testResult.processingTime) {
            best = result
          }
          break
        case 'qualityScore':
          if (result.testResult.qualityScore > best.testResult.qualityScore) {
            best = result
          }
          break
        case 'vertexCount':
        case 'faceCount':
        case 'memoryUsage':
          const currentValue = result.testResult.meshStats[selectedMetric as keyof typeof result.testResult.meshStats] as number
          const bestValue = best.testResult.meshStats[selectedMetric as keyof typeof best.testResult.meshStats] as number
          if (selectedMetric === 'memoryUsage' ? currentValue < bestValue : currentValue > bestValue) {
            best = result
          }
          break
      }
    }
    return best
  }, [results, selectedMetric])

  // Get metric value from result
  const getMetricValue = (result: SweepResult): number => {
    switch (selectedMetric) {
      case 'processingTime':
        return result.testResult.processingTime
      case 'qualityScore':
        return result.testResult.qualityScore
      case 'vertexCount':
      case 'faceCount':
      case 'memoryUsage':
        return result.testResult.meshStats[selectedMetric as keyof typeof result.testResult.meshStats] as number
      default:
        return 0
    }
  }

  // Format metric value for display
  const formatMetricValue = (value: number): string => {
    switch (selectedMetric) {
      case 'processingTime':
        return `${value.toFixed(1)}ms`
      case 'qualityScore':
        return value.toFixed(1)
      case 'vertexCount':
      case 'faceCount':
        return value.toLocaleString()
      case 'memoryUsage':
        return `${(value / 1024 / 1024).toFixed(1)}MB`
      default:
        return value.toString()
    }
  }

  // Get metric color based on value
  const getMetricColor = (result: SweepResult): string => {
    if (!optimalResult) return '#8b949e'
    
    const value = getMetricValue(result)
    const optimalValue = getMetricValue(optimalResult)
    
    if (value === optimalValue) return '#2da44e'
    
    const ratio = selectedMetric === 'processingTime' || selectedMetric === 'memoryUsage' 
      ? value / optimalValue 
      : optimalValue / value
    
    if (ratio <= 1.2) return '#2da44e'
    if (ratio <= 1.5) return '#fb8500'
    return '#cf222e'
  }

  // Format parameter name for display
  const formatParameterName = (param: keyof Model3DParams): string => {
    const nameMap: Record<keyof Model3DParams, string> = {
      cubeHeight: 'Cube Height',
      cubeSize: 'Cube Size',
      spacing: 'Spacing',
      generateBase: 'Generate Base',
      baseThickness: 'Base Thickness',
      optimizeMesh: 'Optimize Mesh',
      mergeAdjacentFaces: 'Merge Adjacent Faces',
      chamferEdges: 'Chamfer Edges',
      chamferSize: 'Chamfer Size'
    }
    return nameMap[param] || param
  }

  // Render sweep chart
  const renderSweepChart = () => {
    if (results.length === 0) return null

    const maxValue = Math.max(...results.map(getMetricValue))
    const minValue = Math.min(...results.map(getMetricValue))
    const range = maxValue - minValue

    return (
      <div className={styles.sweepChart}>
        <div className={styles.chartHeader}>
          <h4>Parameter Sweep Results</h4>
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value as SweepMetric)}
            className={styles.metricSelect}
          >
            <option value="processingTime">Processing Time</option>
            <option value="qualityScore">Quality Score</option>
            <option value="vertexCount">Vertex Count</option>
            <option value="faceCount">Face Count</option>
            <option value="memoryUsage">Memory Usage</option>
          </select>
        </div>
        
        <div className={styles.chart}>
          <div className={styles.yAxis}>
            <span className={styles.axisLabel}>{formatMetricValue(maxValue)}</span>
            <span className={styles.axisLabel}>{formatMetricValue((maxValue + minValue) / 2)}</span>
            <span className={styles.axisLabel}>{formatMetricValue(minValue)}</span>
          </div>
          
          <div className={styles.chartArea}>
            <svg width="100%" height="200" className={styles.chartSvg}>
              {results.map((result, index) => {
                const value = getMetricValue(result)
                const x = (index / (results.length - 1)) * 100
                const y = range > 0 ? ((maxValue - value) / range) * 180 + 10 : 100
                const color = getMetricColor(result)
                
                return (
                  <g key={index}>
                    <circle
                      cx={`${x}%`}
                      cy={y}
                      r={result === optimalResult ? 6 : 4}
                      fill={color}
                      className={styles.chartPoint}
                    />
                    {index < results.length - 1 && (
                      <line
                        x1={`${x}%`}
                        y1={y}
                        x2={`${((index + 1) / (results.length - 1)) * 100}%`}
                        y2={range > 0 ? ((maxValue - getMetricValue(results[index + 1])) / range) * 180 + 10 : 100}
                        stroke="#8b949e"
                        strokeWidth="2"
                        className={styles.chartLine}
                      />
                    )}
                  </g>
                )
              })}
            </svg>
          </div>
          
          <div className={styles.xAxis}>
            <span className={styles.axisLabel}>{sweepConfig.startValue.toFixed(2)}</span>
            <span className={styles.axisLabel}>
              {formatParameterName(sweepConfig.parameter)}
            </span>
            <span className={styles.axisLabel}>{sweepConfig.endValue.toFixed(2)}</span>
          </div>
        </div>
      </div>
    )
  }

  // Render optimization recommendations
  const renderRecommendations = () => {
    if (!optimalResult || results.length < 3) return null

    const recommendations: string[] = []
    const optimalValue = optimalResult.parameterValue
    const currentValue = currentParams[sweepConfig.parameter] as number

    if (Math.abs(optimalValue - currentValue) > 0.01) {
      const direction = optimalValue > currentValue ? 'increase' : 'decrease'
      const change = Math.abs(optimalValue - currentValue)
      const percentage = ((change / currentValue) * 100).toFixed(1)
      
      recommendations.push(
        `${direction.charAt(0).toUpperCase() + direction.slice(1)} ${formatParameterName(sweepConfig.parameter)} ` +
        `to ${optimalValue.toFixed(2)} (${percentage}% change) for optimal ${selectedMetric.replace(/([A-Z])/g, ' $1').toLowerCase()}`
      )
    }

    // Check for stability near optimal
    const nearOptimal = results.filter(r => 
      Math.abs(r.parameterValue - optimalValue) <= (sweepConfig.endValue - sweepConfig.startValue) * 0.1
    )
    
    if (nearOptimal.length < 3) {
      recommendations.push(
        `Consider narrowing the sweep range around ${optimalValue.toFixed(2)} for more precise optimization`
      )
    }

    // Check for local minima/maxima
    let hasMultiplePeaks = false
    for (let i = 1; i < results.length - 1; i++) {
      const prev = getMetricValue(results[i - 1])
      const curr = getMetricValue(results[i])
      const next = getMetricValue(results[i + 1])
      
      const isLocalPeak = selectedMetric === 'processingTime' || selectedMetric === 'memoryUsage' 
        ? curr < prev && curr < next
        : curr > prev && curr > next
        
      if (isLocalPeak && results[i] !== optimalResult) {
        hasMultiplePeaks = true
        break
      }
    }

    if (hasMultiplePeaks) {
      recommendations.push(
        'Multiple optimization peaks detected. Consider testing different parameter combinations for global optimization'
      )
    }

    if (recommendations.length === 0) {
      recommendations.push('Current parameter value is already near optimal for the selected metric')
    }

    return (
      <div className={styles.recommendations}>
        <h4>Optimization Recommendations</h4>
        <ul className={styles.recommendationList}>
          {recommendations.map((rec, index) => (
            <li key={index} className={styles.recommendation}>
              {rec}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const canStart = currentPattern && sweepConfig.steps > 1 && sweepConfig.startValue !== sweepConfig.endValue

  return (
    <div className={styles.parameterSweep}>
      <div className={styles.header}>
        <h3>Parameter Sweep Optimization</h3>
        {optimalResult && (
          <div className={styles.optimalBadge}>
            Optimal: {formatParameterName(sweepConfig.parameter)} = {optimalResult.parameterValue.toFixed(2)}
          </div>
        )}
      </div>

      <div className={styles.content}>
        <div className={styles.configuration}>
          <div className={styles.configSection}>
            <h4>Sweep Configuration</h4>
            
            <div className={styles.configRow}>
              <label>
                Parameter:
                <select
                  value={sweepConfig.parameter}
                  onChange={(e) => setSweepConfig(prev => ({ 
                    ...prev, 
                    parameter: e.target.value as keyof Model3DParams 
                  }))}
                  className={styles.paramSelect}
                >
                  {(Object.keys(currentParams) as Array<keyof Model3DParams>).map(param => (
                    <option key={param} value={param}>
                      {formatParameterName(param)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            
            <div className={styles.configRow}>
              <label>
                Start Value:
                <input
                  type="number"
                  value={sweepConfig.startValue}
                  onChange={(e) => setSweepConfig(prev => ({ 
                    ...prev, 
                    startValue: parseFloat(e.target.value) || 0 
                  }))}
                  step="0.1"
                  className={styles.numberInput}
                />
              </label>
              <label>
                End Value:
                <input
                  type="number"
                  value={sweepConfig.endValue}
                  onChange={(e) => setSweepConfig(prev => ({ 
                    ...prev, 
                    endValue: parseFloat(e.target.value) || 0 
                  }))}
                  step="0.1"
                  className={styles.numberInput}
                />
              </label>
              <label>
                Steps:
                <input
                  type="number"
                  value={sweepConfig.steps}
                  onChange={(e) => setSweepConfig(prev => ({ 
                    ...prev, 
                    steps: Math.max(2, parseInt(e.target.value) || 2) 
                  }))}
                  min="2"
                  max="100"
                  className={styles.numberInput}
                />
              </label>
            </div>
            
            <div className={styles.configRow}>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={sweepConfig.logarithmic}
                  onChange={(e) => setSweepConfig(prev => ({ 
                    ...prev, 
                    logarithmic: e.target.checked 
                  }))}
                />
                Logarithmic Scale
              </label>
            </div>

            <div className={styles.sweepPreview}>
              <h5>Sweep Values Preview</h5>
              <div className={styles.valuesList}>
                {sweepValues.slice(0, 10).map((value, index) => (
                  <span key={index} className={styles.sweepValue}>
                    {value.toFixed(3)}
                  </span>
                ))}
                {sweepValues.length > 10 && <span className={styles.moreValues}>... and {sweepValues.length - 10} more</span>}
              </div>
            </div>
          </div>

          <div className={styles.patternInfo}>
            <h4>Test Pattern</h4>
            {currentPattern ? (
              <div className={styles.patternDetails}>
                <div className={styles.patternPreview}>
                  {currentPattern.width}×{currentPattern.height}
                </div>
                <div className={styles.patternStats}>
                  <span>Size: {currentPattern.width}×{currentPattern.height}</span>
                  <span>Active dots: {currentPattern.data.flat().filter(Boolean).length}</span>
                </div>
              </div>
            ) : (
              <div className={styles.noPattern}>
                No pattern selected. Please select a pattern first.
              </div>
            )}
          </div>
        </div>

        <div className={styles.actions}>
          <button
            onClick={runSweep}
            disabled={!canStart || isRunning}
            className={styles.startButton}
          >
            {isRunning ? 'Running Sweep...' : 'Start Parameter Sweep'}
          </button>
          
          {isRunning && (
            <div className={styles.progressInfo}>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill}
                  style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                />
              </div>
              <div className={styles.progressText}>
                {progress.current} / {progress.total}
              </div>
            </div>
          )}
        </div>

        {results.length > 0 && (
          <div className={styles.results}>
            {renderSweepChart()}
            {showOptimalParams && renderRecommendations()}
            
            <div className={styles.resultTable}>
              <div className={styles.tableHeader}>
                <span>Parameter Value</span>
                <span>Processing Time</span>
                <span>Quality Score</span>
                <span>Vertices</span>
                <span>Status</span>
              </div>
              {results.map((result, index) => (
                <div 
                  key={index} 
                  className={`${styles.tableRow} ${result === optimalResult ? styles.optimal : ''} ${!result.testResult.success ? styles.failed : ''}`}
                >
                  <span className={styles.paramValue}>
                    {result.parameterValue.toFixed(3)}
                  </span>
                  <span className={styles.timeValue}>
                    {result.testResult.processingTime.toFixed(1)}ms
                  </span>
                  <span className={styles.qualityValue}>
                    {result.testResult.qualityScore}
                  </span>
                  <span className={styles.vertexValue}>
                    {result.testResult.meshStats.vertexCount.toLocaleString()}
                  </span>
                  <span className={styles.statusValue}>
                    {result === optimalResult ? '⭐' : result.testResult.success ? '✅' : '❌'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ParameterSweep