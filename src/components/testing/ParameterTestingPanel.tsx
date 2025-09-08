import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { useAppContext } from '@/context/AppContext'
import { ParameterPresets } from './ParameterPresets'
import { BulkTesting } from './BulkTesting'
import { ParameterSweep } from './ParameterSweep'
import { TestSessionService } from '@/services/TestSessionService'
import type { 
  Model3DParams, 
  ParameterPreset, 
  TestResult, 
  SweepResult,
  DotPattern,
  SweepConfig,
  BulkTestConfig
} from '@/types'
import styles from './ParameterTestingPanel.module.css'

export interface ParameterTestingPanelProps {
  /** Available patterns for testing */
  availablePatterns?: DotPattern[]
  /** Current pattern being tested */
  currentPattern?: DotPattern
  /** Callback when parameters change */
  onParametersChange?: (params: Model3DParams) => void
  /** Callback when test completes */
  onTestComplete?: (results: TestResult[]) => void
}

type ActiveTab = 'presets' | 'bulk' | 'sweep' | 'recommendations'

interface ParameterRecommendation {
  parameter: keyof Model3DParams
  recommendedValue: number | boolean
  reason: string
  confidence: number
  impact: 'performance' | 'quality' | 'compatibility'
}

export const ParameterTestingPanel: React.FC<ParameterTestingPanelProps> = ({
  availablePatterns = [],
  currentPattern,
  onParametersChange,
  onTestComplete
}) => {
  const { state, updateModel3DParams } = useAppContext()
  const [activeTab, setActiveTab] = useState<ActiveTab>('presets')
  const [testHistory, setTestHistory] = useState<TestResult[]>([])
  const [recommendations, setRecommendations] = useState<ParameterRecommendation[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // Get current parameters and pattern
  const currentParams = state.model3DParams
  const testPattern = currentPattern || state.currentPattern

  // Get available parameter presets
  const [availablePresets, setAvailablePresets] = useState<Array<{ name: string; parameters: Model3DParams }>>([])

  // Load presets and test history on component mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Load parameter presets
        const presets = TestSessionService.getParameterPresets()
        const presetData = presets.map(preset => ({
          name: preset.name,
          parameters: preset.parameters as Model3DParams
        }))
        setAvailablePresets(presetData)

        // Load recent test history for analysis
        if (state.testSession) {
          const history = await TestSessionService.getTestHistory(state.testSession.id, 50)
          setTestHistory(history)
        }
      } catch (error) {
        console.error('Failed to load testing data:', error)
      }
    }

    loadInitialData()
  }, [state.testSession])

  // Generate intelligent parameter recommendations based on pattern and history
  const generateRecommendations = useCallback(async () => {
    if (!testPattern || testHistory.length === 0) return

    setIsAnalyzing(true)
    
    try {
      const newRecommendations: ParameterRecommendation[] = []

      // Analyze pattern characteristics
      const patternArea = testPattern.width * testPattern.height
      const activeDots = testPattern.data.flat().filter(Boolean).length
      const dotDensity = activeDots / patternArea

      // Pattern-based recommendations
      if (dotDensity > 0.7) {
        // High density pattern
        newRecommendations.push({
          parameter: 'cubeSize',
          recommendedValue: Math.max(0.8, currentParams.cubeSize * 0.9),
          reason: 'Reduce cube size for high-density patterns to prevent overcrowding',
          confidence: 0.8,
          impact: 'quality'
        })
        
        newRecommendations.push({
          parameter: 'spacing',
          recommendedValue: Math.max(0.1, currentParams.spacing * 1.1),
          reason: 'Increase spacing to improve printability with dense patterns',
          confidence: 0.85,
          impact: 'compatibility'
        })
      } else if (dotDensity < 0.3) {
        // Low density pattern
        newRecommendations.push({
          parameter: 'cubeSize',
          recommendedValue: Math.min(2.0, currentParams.cubeSize * 1.1),
          reason: 'Increase cube size for sparse patterns to improve visual impact',
          confidence: 0.75,
          impact: 'quality'
        })
      }

      // Size-based recommendations
      if (patternArea > 400) { // Large patterns
        newRecommendations.push({
          parameter: 'optimizeMesh',
          recommendedValue: true,
          reason: 'Enable mesh optimization for large patterns to improve performance',
          confidence: 0.9,
          impact: 'performance'
        })

        newRecommendations.push({
          parameter: 'mergeAdjacentFaces',
          recommendedValue: true,
          reason: 'Merge adjacent faces on large models to reduce complexity',
          confidence: 0.85,
          impact: 'performance'
        })
      }

      // History-based analysis
      const successfulTests = testHistory.filter(test => 
        test.success && test.qualityScore > 7
      )

      if (successfulTests.length >= 3) {
        // Analyze successful parameter combinations
        const avgSuccessfulCubeHeight = successfulTests.reduce((sum, test) => 
          sum + (test.parameters?.cubeHeight || currentParams.cubeHeight), 0
        ) / successfulTests.length

        const currentCubeHeight = currentParams.cubeHeight
        const heightDifference = Math.abs(avgSuccessfulCubeHeight - currentCubeHeight)

        if (heightDifference > 0.2) {
          newRecommendations.push({
            parameter: 'cubeHeight',
            recommendedValue: Math.round(avgSuccessfulCubeHeight * 100) / 100,
            reason: `Successful tests average ${avgSuccessfulCubeHeight.toFixed(2)} cube height`,
            confidence: 0.7,
            impact: 'quality'
          })
        }

        // Performance-based recommendations
        const fastTests = successfulTests.filter(test => test.processingTime < 1000)
        if (fastTests.length > 0) {
          const fastTestsWithOptimization = fastTests.filter(test => 
            test.parameters?.optimizeMesh === true
          )
          
          if (fastTestsWithOptimization.length / fastTests.length > 0.6) {
            newRecommendations.push({
              parameter: 'optimizeMesh',
              recommendedValue: true,
              reason: 'Fast tests commonly use mesh optimization',
              confidence: 0.6,
              impact: 'performance'
            })
          }
        }
      }

      // Remove duplicates and sort by confidence
      const uniqueRecommendations = newRecommendations.filter((rec, index, arr) => 
        arr.findIndex(r => r.parameter === rec.parameter) === index
      ).sort((a, b) => b.confidence - a.confidence)

      setRecommendations(uniqueRecommendations)
    } catch (error) {
      console.error('Failed to generate recommendations:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }, [testPattern, testHistory, currentParams])

  // Apply recommendation
  const applyRecommendation = useCallback((recommendation: ParameterRecommendation) => {
    const newParams = {
      ...currentParams,
      [recommendation.parameter]: recommendation.recommendedValue
    }
    updateModel3DParams(newParams)
    onParametersChange?.(newParams)
  }, [currentParams, updateModel3DParams, onParametersChange])

  // Handle preset selection
  const handlePresetSelect = useCallback((params: Model3DParams, preset: ParameterPreset) => {
    updateModel3DParams(params)
    onParametersChange?.(params)
    
    // Update preset usage count
    const updatedPreset = { ...preset, usageCount: preset.usageCount + 1 }
    TestSessionService.saveParameterPreset(updatedPreset)
  }, [updateModel3DParams, onParametersChange])

  // Handle bulk test completion
  const handleBulkTestComplete = useCallback((results: TestResult[]) => {
    setTestHistory(prev => [...results, ...prev].slice(0, 100))
    onTestComplete?.(results)
    
    // Trigger recommendation generation after new test data
    setTimeout(generateRecommendations, 500)
  }, [onTestComplete, generateRecommendations])

  // Handle sweep completion
  const handleSweepComplete = useCallback((results: SweepResult[]) => {
    const testResults = results.map(r => r.testResult)
    setTestHistory(prev => [...testResults, ...prev].slice(0, 100))
    onTestComplete?.(testResults)
    
    // Trigger recommendation generation after new test data
    setTimeout(generateRecommendations, 500)
  }, [onTestComplete, generateRecommendations])

  // Handle preset creation
  const handlePresetCreate = useCallback((preset: ParameterPreset) => {
    setAvailablePresets(prev => [
      { name: preset.name, parameters: preset.parameters as Model3DParams },
      ...prev
    ])
  }, [])

  // Generate recommendations when pattern or history changes
  useEffect(() => {
    if (testPattern && testHistory.length > 0) {
      generateRecommendations()
    }
  }, [testPattern, testHistory, generateRecommendations])

  // Tab configuration
  const tabs = useMemo(() => [
    { 
      id: 'presets' as const, 
      label: 'Parameter Presets', 
      icon: '⚙️',
      description: 'Use and create parameter presets' 
    },
    { 
      id: 'bulk' as const, 
      label: 'Bulk Testing', 
      icon: '📊',
      description: 'Run multiple parameter combinations' 
    },
    { 
      id: 'sweep' as const, 
      label: 'Parameter Sweep', 
      icon: '📈',
      description: 'Optimize single parameter ranges' 
    },
    { 
      id: 'recommendations' as const, 
      label: 'AI Recommendations', 
      icon: '🤖',
      description: 'Intelligent parameter suggestions',
      badge: recommendations.length > 0 ? recommendations.length.toString() : undefined
    }
  ], [recommendations.length])

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

  // Format parameter value
  const formatParameterValue = (value: number | boolean): string => {
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    return value.toFixed(2)
  }

  return (
    <div className={styles.parameterTestingPanel}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h2 className={styles.title}>Parameter Testing Interface</h2>
          <p className={styles.subtitle}>
            Comprehensive parameter testing with presets, bulk testing, and AI-powered recommendations
          </p>
        </div>
        
        {testPattern && (
          <div className={styles.patternInfo}>
            <div className={styles.patternPreview}>
              {testPattern.width}×{testPattern.height}
            </div>
            <div className={styles.patternDetails}>
              <span className={styles.patternSize}>
                {testPattern.width}×{testPattern.height}
              </span>
              <span className={styles.dotCount}>
                {testPattern.data.flat().filter(Boolean).length} dots
              </span>
            </div>
          </div>
        )}
      </div>

      <div className={styles.tabNavigation}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`${styles.tabButton} ${activeTab === tab.id ? styles.active : ''}`}
            title={tab.description}
          >
            <span className={styles.tabIcon}>{tab.icon}</span>
            <span className={styles.tabLabel}>{tab.label}</span>
            {tab.badge && (
              <span className={styles.tabBadge}>{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      <div className={styles.tabContent}>
        {activeTab === 'presets' && (
          <div className={styles.tabPanel}>
            <ParameterPresets
              currentParams={currentParams}
              onPresetSelect={handlePresetSelect}
              onPresetCreate={handlePresetCreate}
              allowEdit={true}
              showComparison={true}
            />
          </div>
        )}

        {activeTab === 'bulk' && (
          <div className={styles.tabPanel}>
            <BulkTesting
              availablePatterns={availablePatterns}
              availablePresets={availablePresets}
              onTestComplete={handleBulkTestComplete}
            />
          </div>
        )}

        {activeTab === 'sweep' && (
          <div className={styles.tabPanel}>
            <ParameterSweep
              pattern={testPattern}
              baseParams={currentParams}
              onSweepComplete={handleSweepComplete}
            />
          </div>
        )}

        {activeTab === 'recommendations' && (
          <div className={styles.tabPanel}>
            <div className={styles.recommendationsPanel}>
              <div className={styles.recommendationsHeader}>
                <h3>AI-Powered Parameter Recommendations</h3>
                <button
                  onClick={generateRecommendations}
                  disabled={isAnalyzing || !testPattern}
                  className={styles.refreshButton}
                >
                  {isAnalyzing ? 'Analyzing...' : 'Refresh Recommendations'}
                </button>
              </div>

              {!testPattern && (
                <div className={styles.emptyState}>
                  <p>Select a pattern to get parameter recommendations</p>
                </div>
              )}

              {testPattern && testHistory.length === 0 && (
                <div className={styles.emptyState}>
                  <p>Run some tests to get AI-powered recommendations based on your testing history</p>
                </div>
              )}

              {recommendations.length === 0 && testPattern && testHistory.length > 0 && !isAnalyzing && (
                <div className={styles.emptyState}>
                  <p>No specific recommendations at this time. Your current parameters look good!</p>
                </div>
              )}

              {recommendations.length > 0 && (
                <div className={styles.recommendationsList}>
                  {recommendations.map((rec, index) => (
                    <div key={index} className={`${styles.recommendationCard} ${styles[rec.impact]}`}>
                      <div className={styles.recommendationHeader}>
                        <div className={styles.recommendationTitle}>
                          <span className={styles.parameterName}>
                            {formatParameterName(rec.parameter)}
                          </span>
                          <span className={styles.impactBadge}>
                            {rec.impact}
                          </span>
                        </div>
                        <div className={styles.confidenceBar}>
                          <div 
                            className={styles.confidenceFill}
                            style={{ width: `${rec.confidence * 100}%` }}
                          />
                          <span className={styles.confidenceLabel}>
                            {(rec.confidence * 100).toFixed(0)}% confidence
                          </span>
                        </div>
                      </div>

                      <div className={styles.recommendationContent}>
                        <div className={styles.valueChange}>
                          <span className={styles.currentValue}>
                            Current: {formatParameterValue(currentParams[rec.parameter] as number | boolean)}
                          </span>
                          <span className={styles.arrow}>→</span>
                          <span className={styles.recommendedValue}>
                            Recommended: {formatParameterValue(rec.recommendedValue)}
                          </span>
                        </div>
                        
                        <p className={styles.recommendationReason}>
                          {rec.reason}
                        </p>
                      </div>

                      <div className={styles.recommendationActions}>
                        <button
                          onClick={() => applyRecommendation(rec)}
                          className={styles.applyButton}
                        >
                          Apply Recommendation
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {testHistory.length > 0 && (
                <div className={styles.historyStats}>
                  <h4>Testing History Analysis</h4>
                  <div className={styles.statsGrid}>
                    <div className={styles.statCard}>
                      <span className={styles.statValue}>{testHistory.length}</span>
                      <span className={styles.statLabel}>Total Tests</span>
                    </div>
                    <div className={styles.statCard}>
                      <span className={styles.statValue}>
                        {((testHistory.filter(t => t.success).length / testHistory.length) * 100).toFixed(1)}%
                      </span>
                      <span className={styles.statLabel}>Success Rate</span>
                    </div>
                    <div className={styles.statCard}>
                      <span className={styles.statValue}>
                        {(testHistory.reduce((sum, t) => sum + (t.qualityScore || 0), 0) / testHistory.length).toFixed(1)}
                      </span>
                      <span className={styles.statLabel}>Avg Quality</span>
                    </div>
                    <div className={styles.statCard}>
                      <span className={styles.statValue}>
                        {(testHistory.reduce((sum, t) => sum + t.processingTime, 0) / testHistory.length).toFixed(0)}ms
                      </span>
                      <span className={styles.statLabel}>Avg Time</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ParameterTestingPanel