import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAppContext } from '@/context/AppContext'
import { TestSessionService } from '@/services/TestSessionService'
import type { DotPattern, Model3DParams, BulkTestConfig, TestResult, SweepConfig, SweepResult } from '@/types'
import styles from './BulkTesting.module.css'

export interface BulkTestingProps {
  /** Available patterns to test */
  availablePatterns?: DotPattern[]
  /** Available parameter presets */
  availablePresets?: Array<{ name: string; parameters: Model3DParams }>
  /** Callback when bulk test completes */
  onTestComplete?: (results: TestResult[]) => void
  /** Callback for progress updates */
  onProgress?: (current: number, total: number, currentTest?: string) => void
}

type TestMode = 'bulk' | 'sweep'

export const BulkTesting: React.FC<BulkTestingProps> = ({
  availablePatterns = [],
  availablePresets = [],
  onTestComplete,
  onProgress
}) => {
  const { state, addTestResult } = useAppContext()
  const [testMode, setTestMode] = useState<TestMode>('bulk')
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, currentTest: '' })
  const [results, setResults] = useState<TestResult[] | SweepResult[]>([])
  
  // Bulk testing configuration
  const [selectedPatterns, setSelectedPatterns] = useState<Set<number>>(new Set())
  const [selectedPresets, setSelectedPresets] = useState<Set<number>>(new Set())
  const [testAllCombinations, setTestAllCombinations] = useState(true)
  const [maxConcurrency, setMaxConcurrency] = useState(3)
  const [testTimeout, setTestTimeout] = useState(30000) // 30 seconds
  
  // Parameter sweep configuration
  const [sweepPattern, setSweepPattern] = useState<DotPattern | null>(null)
  const [baseParams, setBaseParams] = useState<Model3DParams>(state.model3DParams)
  const [sweepConfig, setSweepConfig] = useState<SweepConfig>({
    parameter: 'cubeHeight',
    startValue: 0.5,
    endValue: 3.0,
    steps: 10,
    logarithmic: false
  })

  // Calculate test combinations
  const testCombinations = useMemo(() => {
    if (testMode === 'sweep') return sweepConfig.steps

    const patterns = availablePatterns.filter((_, index) => selectedPatterns.has(index))
    const presets = availablePresets.filter((_, index) => selectedPresets.has(index))
    
    if (testAllCombinations) {
      return patterns.length * presets.length
    } else {
      return Math.min(patterns.length, presets.length)
    }
  }, [testMode, selectedPatterns, selectedPresets, availablePatterns, availablePresets, testAllCombinations, sweepConfig.steps])

  // Handle progress updates
  const handleProgress = useCallback((current: number, total: number, currentTest?: string) => {
    setProgress({ current, total, currentTest: currentTest || '' })
    onProgress?.(current, total, currentTest)
  }, [onProgress])

  // Run bulk tests
  const runBulkTests = useCallback(async () => {
    if (!state.testSession) return

    const patterns = availablePatterns.filter((_, index) => selectedPatterns.has(index))
    const parameterSets = availablePresets
      .filter((_, index) => selectedPresets.has(index))
      .map(preset => preset.parameters)

    const config: BulkTestConfig = {
      patterns,
      parameterSets,
      testAllCombinations,
      maxConcurrency,
      testTimeout
    }

    try {
      setIsRunning(true)
      setResults([])
      
      const testResults = await TestSessionService.runBulkTest(
        state.testSession.id,
        config,
        handleProgress
      )

      setResults(testResults)
      testResults.forEach(result => addTestResult(result))
      onTestComplete?.(testResults)
    } catch (error) {
      console.error('Bulk test failed:', error)
    } finally {
      setIsRunning(false)
      setProgress({ current: 0, total: 0, currentTest: '' })
    }
  }, [
    state.testSession,
    availablePatterns,
    selectedPatterns,
    availablePresets,
    selectedPresets,
    testAllCombinations,
    maxConcurrency,
    testTimeout,
    handleProgress,
    addTestResult,
    onTestComplete
  ])

  // Run parameter sweep
  const runParameterSweep = useCallback(async () => {
    if (!state.testSession || !sweepPattern) return

    try {
      setIsRunning(true)
      setResults([])
      
      const sweepResults = await TestSessionService.runParameterSweep(
        state.testSession.id,
        sweepPattern,
        baseParams,
        sweepConfig,
        handleProgress
      )

      setResults(sweepResults)
      sweepResults.forEach(result => addTestResult(result.testResult))
    } catch (error) {
      console.error('Parameter sweep failed:', error)
    } finally {
      setIsRunning(false)
      setProgress({ current: 0, total: 0, currentTest: '' })
    }
  }, [
    state.testSession,
    sweepPattern,
    baseParams,
    sweepConfig,
    handleProgress,
    addTestResult
  ])

  // Start testing based on mode
  const handleStartTest = useCallback(() => {
    if (testMode === 'bulk') {
      runBulkTests()
    } else {
      runParameterSweep()
    }
  }, [testMode, runBulkTests, runParameterSweep])

  // Toggle pattern selection
  const togglePattern = useCallback((index: number) => {
    setSelectedPatterns(prev => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }, [])

  // Toggle preset selection
  const togglePreset = useCallback((index: number) => {
    setSelectedPresets(prev => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }, [])

  // Select all patterns
  const selectAllPatterns = useCallback(() => {
    setSelectedPatterns(new Set(availablePatterns.map((_, index) => index)))
  }, [availablePatterns])

  // Clear pattern selection
  const clearPatternSelection = useCallback(() => {
    setSelectedPatterns(new Set())
  }, [])

  // Select all presets
  const selectAllPresets = useCallback(() => {
    setSelectedPresets(new Set(availablePresets.map((_, index) => index)))
  }, [availablePresets])

  // Clear preset selection
  const clearPresetSelection = useCallback(() => {
    setSelectedPresets(new Set())
  }, [])

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

  // Render success rate chart
  const renderSuccessChart = () => {
    if (results.length === 0) return null

    const testResults = 'testResult' in results[0] 
      ? (results as SweepResult[]).map(r => r.testResult)
      : results as TestResult[]

    const successCount = testResults.filter(r => r.success).length
    const successRate = (successCount / testResults.length) * 100

    return (
      <div className={styles.successChart}>
        <div className={styles.chartHeader}>
          <h4>Success Rate</h4>
          <span className={styles.successRate}>{successRate.toFixed(1)}%</span>
        </div>
        <div className={styles.progressBar}>
          <div 
            className={styles.successBar} 
            style={{ width: `${successRate}%` }}
          />
        </div>
        <div className={styles.chartStats}>
          <span>Success: {successCount}</span>
          <span>Failed: {testResults.length - successCount}</span>
          <span>Total: {testResults.length}</span>
        </div>
      </div>
    )
  }

  const canStart = testMode === 'bulk' 
    ? selectedPatterns.size > 0 && selectedPresets.size > 0
    : sweepPattern && sweepConfig.steps > 0

  return (
    <div className={styles.bulkTesting}>
      <div className={styles.header}>
        <h3>Bulk Testing</h3>
        <div className={styles.modeSelector}>
          <button
            onClick={() => setTestMode('bulk')}
            className={`${styles.modeButton} ${testMode === 'bulk' ? styles.active : ''}`}
          >
            Bulk Tests
          </button>
          <button
            onClick={() => setTestMode('sweep')}
            className={`${styles.modeButton} ${testMode === 'sweep' ? styles.active : ''}`}
          >
            Parameter Sweep
          </button>
        </div>
      </div>

      <div className={styles.content}>
        {testMode === 'bulk' ? (
          <div className={styles.bulkConfig}>
            <div className={styles.configSection}>
              <div className={styles.sectionHeader}>
                <h4>Patterns ({selectedPatterns.size}/{availablePatterns.length})</h4>
                <div className={styles.selectionActions}>
                  <button onClick={selectAllPatterns} className={styles.actionButton}>
                    Select All
                  </button>
                  <button onClick={clearPatternSelection} className={styles.actionButton}>
                    Clear
                  </button>
                </div>
              </div>
              <div className={styles.patternGrid}>
                {availablePatterns.map((pattern, index) => (
                  <div
                    key={index}
                    className={`${styles.patternCard} ${selectedPatterns.has(index) ? styles.selected : ''}`}
                    onClick={() => togglePattern(index)}
                  >
                    <div className={styles.patternPreview}>
                      {pattern.width}×{pattern.height}
                    </div>
                    <div className={styles.patternInfo}>
                      <span className={styles.patternSize}>{pattern.width}×{pattern.height}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.configSection}>
              <div className={styles.sectionHeader}>
                <h4>Parameter Presets ({selectedPresets.size}/{availablePresets.length})</h4>
                <div className={styles.selectionActions}>
                  <button onClick={selectAllPresets} className={styles.actionButton}>
                    Select All
                  </button>
                  <button onClick={clearPresetSelection} className={styles.actionButton}>
                    Clear
                  </button>
                </div>
              </div>
              <div className={styles.presetList}>
                {availablePresets.map((preset, index) => (
                  <div
                    key={index}
                    className={`${styles.presetCard} ${selectedPresets.has(index) ? styles.selected : ''}`}
                    onClick={() => togglePreset(index)}
                  >
                    <span className={styles.presetName}>{preset.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.configOptions}>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={testAllCombinations}
                  onChange={(e) => setTestAllCombinations(e.target.checked)}
                />
                Test all combinations ({testCombinations} tests)
              </label>
              
              <div className={styles.configRow}>
                <label>
                  Max Concurrency:
                  <input
                    type="number"
                    value={maxConcurrency}
                    onChange={(e) => setMaxConcurrency(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    max="10"
                    className={styles.numberInput}
                  />
                </label>
                <label>
                  Timeout (ms):
                  <input
                    type="number"
                    value={testTimeout}
                    onChange={(e) => setTestTimeout(Math.max(1000, parseInt(e.target.value) || 1000))}
                    min="1000"
                    step="1000"
                    className={styles.numberInput}
                  />
                </label>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.sweepConfig}>
            <div className={styles.configSection}>
              <h4>Pattern Selection</h4>
              <div className={styles.patternSelector}>
                <select
                  value={sweepPattern ? availablePatterns.indexOf(sweepPattern) : -1}
                  onChange={(e) => {
                    const index = parseInt(e.target.value)
                    setSweepPattern(index >= 0 ? availablePatterns[index] : null)
                  }}
                  className={styles.patternSelect}
                >
                  <option value={-1}>Select a pattern...</option>
                  {availablePatterns.map((pattern, index) => (
                    <option key={index} value={index}>
                      Pattern {index + 1} ({pattern.width}×{pattern.height})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.configSection}>
              <h4>Parameter Sweep Configuration</h4>
              <div className={styles.sweepSettings}>
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
                      {(Object.keys(baseParams) as Array<keyof Model3DParams>).map(param => (
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
                </div>
                
                <div className={styles.configRow}>
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
                      max="50"
                      className={styles.numberInput}
                    />
                  </label>
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
              </div>
            </div>
          </div>
        )}

        <div className={styles.actions}>
          <button
            onClick={handleStartTest}
            disabled={!canStart || isRunning}
            className={styles.startButton}
          >
            {isRunning ? 'Testing...' : `Start ${testMode === 'bulk' ? 'Bulk' : 'Sweep'} Test`}
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
                {progress.currentTest && <span> - {progress.currentTest}</span>}
              </div>
            </div>
          )}
        </div>

        {results.length > 0 && (
          <div className={styles.results}>
            <div className={styles.resultsHeader}>
              <h4>Test Results</h4>
              <span className={styles.resultCount}>{results.length} results</span>
            </div>
            
            {renderSuccessChart()}
            
            <div className={styles.resultsList}>
              {results.map((result, index) => {
                const testResult = 'testResult' in result ? result.testResult : result
                return (
                  <div key={index} className={`${styles.resultCard} ${testResult.success ? styles.success : styles.failure}`}>
                    <div className={styles.resultHeader}>
                      <span className={styles.resultStatus}>
                        {testResult.success ? '✅' : '❌'}
                      </span>
                      <span className={styles.resultId}>Test #{index + 1}</span>
                      {'parameterValue' in result && (
                        <span className={styles.parameterValue}>
                          {formatParameterName(sweepConfig.parameter)}: {result.parameterValue.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <div className={styles.resultDetails}>
                      <span>Processing: {testResult.processingTime.toFixed(1)}ms</span>
                      <span>Quality: {testResult.qualityScore}</span>
                      <span>Vertices: {testResult.meshStats.vertexCount}</span>
                    </div>
                    {testResult.error && (
                      <div className={styles.resultError}>
                        Error: {testResult.error}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default BulkTesting