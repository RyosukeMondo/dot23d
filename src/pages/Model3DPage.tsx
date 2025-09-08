import React, { useState, useEffect, useCallback, useMemo } from 'react'
import * as THREE from 'three'
import { useAppContext } from '@/context/AppContext'
import { TestSessionService } from '@/services/TestSessionService'
import { PerformanceService } from '@/services/PerformanceService'
import PatternEditor from '@/components/testing/PatternEditor'
import PatternLibrary from '@/components/testing/PatternLibrary'
import ParameterPresets from '@/components/testing/ParameterPresets'
import ModelViewer from '@/components/ModelViewer'
import type { DotPattern, Model3DParams, TestSession, TestResult, MeshStats as FullMeshStats } from '@/types'
import styles from './Model3DPage.module.css'

type PanelType = 'patterns' | 'parameters' | 'viewer' | 'performance' | 'results' | 'automation'

interface PanelConfig {
  id: PanelType
  title: string
  icon: string
  component: React.ComponentType<any>
  defaultProps?: any
}

export const Model3DPage: React.FC = () => {
  const { state, toggleTestMode, setTestSession, addTestResult, setCurrentStep } = useAppContext()
  const [activePanel, setActivePanel] = useState<PanelType>('patterns')
  const [panelLayout, setPanelLayout] = useState<'single' | 'split' | 'quad'>('single')
  const [splitPanels, setSplitPanels] = useState<[PanelType, PanelType]>(['patterns', 'viewer'])
  const [currentPattern, setCurrentPattern] = useState<DotPattern | null>(null)
  const [currentParams, setCurrentParams] = useState<Model3DParams>(state.model3DParams)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedModel, setGeneratedModel] = useState<any>(null)
  const [activeTestId, setActiveTestId] = useState<string | null>(null)

  // Panel configurations
  const panelConfigs: PanelConfig[] = useMemo(() => [
    {
      id: 'patterns',
      title: 'Pattern Management',
      icon: '🎨',
      component: PatternManagementPanel,
      defaultProps: {
        onPatternSelect: setCurrentPattern,
        currentPattern
      }
    },
    {
      id: 'parameters',
      title: 'Parameter Testing',
      icon: '⚙️',
      component: ParameterTestingPanel,
      defaultProps: {
        currentParams,
        onParamsChange: setCurrentParams
      }
    },
    {
      id: 'viewer',
      title: '3D Viewer',
      icon: '🎲',
      component: Enhanced3DViewerPanel,
      defaultProps: {
        pattern: currentPattern,
        model3DParams: currentParams
      }
    },
    {
      id: 'performance',
      title: 'Performance Monitor',
      icon: '📊',
      component: PerformanceMonitoringPanel,
      defaultProps: {
        isActive: isGenerating,
        testId: activeTestId
      }
    },
    {
      id: 'results',
      title: 'Results Dashboard',
      icon: '📈',
      component: ResultsDashboardPanel,
      defaultProps: {
        testSession: state.testSession
      }
    },
    {
      id: 'automation',
      title: 'Test Automation',
      icon: '🤖',
      component: AutomatedTestingPanel,
      defaultProps: {}
    }
  ], [currentPattern, currentParams, generatedModel, isGenerating, activeTestId, state.testSession])

  // Initialize test mode
  useEffect(() => {
    if (!state.isTestMode) {
      toggleTestMode()
    }
    setCurrentStep('generate') // Set to the appropriate step for testing
  }, [state.isTestMode, toggleTestMode, setCurrentStep])

  // Create or load test session
  useEffect(() => {
    if (!state.testSession) {
      const newSession = TestSessionService.createSession(
        `Test Session ${new Date().toLocaleDateString()}`,
        'user'
      )
      setTestSession(newSession)
    }
  }, [state.testSession, setTestSession])

  // Handle pattern changes
  useEffect(() => {
    if (currentPattern && state.testSession) {
      const session = state.testSession

      // If the first pattern is already the currentPattern reference, no update needed
      const firstIsCurrent = session.patterns.length > 0 && session.patterns[0] === currentPattern
      if (firstIsCurrent) return

      const updatedPatterns = [
        currentPattern,
        ...session.patterns.filter(p => !(p.width === currentPattern.width && p.height === currentPattern.height))
      ].slice(0, 10)

      // If arrays are reference-equal element-wise, avoid dispatch
      const sameOrderAndRefs =
        session.patterns.length === updatedPatterns.length &&
        session.patterns.every((p, i) => p === updatedPatterns[i])
      if (sameOrderAndRefs) return

      setTestSession({ ...session, patterns: updatedPatterns })
    }
  }, [currentPattern, state.testSession, setTestSession])

  // Generate 3D model
  const handleGenerateModel = useCallback(async () => {
    if (!currentPattern || !state.testSession) return

    setIsGenerating(true)
    const testId = `test-${Date.now()}`
    setActiveTestId(testId)

    // Start performance monitoring
    const performanceSessionId = PerformanceService.startMonitoring(testId)

    try {
      // Simulate model generation with the existing service
      const { Model3DService } = await import('@/services/Model3DService')
      
      const startTime = performance.now()
      const mesh = Model3DService.generateMesh(currentPattern, currentParams)
      const processingTime = performance.now() - startTime

      const basicStats = Model3DService.getMeshStats(mesh)
      // Compute bounding box for full stats
      const box = new THREE.Box3().setFromObject(mesh)
      const size = box.getSize(new THREE.Vector3())
      // Map to the full MeshStats interface expected by TestResult
      const meshStats: FullMeshStats = {
        vertexCount: basicStats.vertexCount,
        faceCount: basicStats.faceCount,
        edgeCount: 0, // Not computed in current generator; placeholder
        boundingBox: { width: size.x, height: size.y, depth: size.z },
        surfaceArea: 0, // Not computed; could be added in MeshGenerator later
        volume: 0, // Not computed; could be added in MeshGenerator later
        memoryUsage: Math.round(basicStats.fileSizeEstimate / 1024) // Approx KB
      }
      
      // Create test result
      const testResult: TestResult = {
        id: testId,
        testSessionId: state.testSession.id,
        timestamp: new Date(),
        pattern: currentPattern,
        parameters: currentParams,
        success: true,
        processingTime,
        meshStats,
        qualityScore: 85, // Would be calculated by QualityAssessmentService
        performanceMetrics: PerformanceService.getRealtimeSnapshot(),
        warnings: [],
        exportedFormats: []
      }

      setGeneratedModel(mesh)
      addTestResult(testResult)

    } catch (error) {
      console.error('Model generation failed:', error)
      
      // Create failure result
      const failureResult = {
        id: testId,
        testSessionId: state.testSession.id,
        timestamp: new Date(),
        pattern: currentPattern,
        parameters: currentParams,
        success: false,
        processingTime: 0,
        meshStats: {
          vertexCount: 0,
          faceCount: 0,
          edgeCount: 0,
          boundingBox: { width: 0, height: 0, depth: 0 },
          surfaceArea: 0,
          volume: 0,
          memoryUsage: 0
        },
        qualityScore: 0,
        performanceMetrics: PerformanceService.getRealtimeSnapshot(),
        error: error instanceof Error ? error.message : 'Unknown error',
        warnings: [],
        exportedFormats: []
      }

      addTestResult(failureResult)
    } finally {
      // Stop performance monitoring
      PerformanceService.stopMonitoring(performanceSessionId)
      setIsGenerating(false)
      setActiveTestId(null)
    }
  }, [currentPattern, currentParams, state.testSession, addTestResult])

  // Panel layout handlers
  const handlePanelLayoutChange = (layout: typeof panelLayout) => {
    setPanelLayout(layout)
    if (layout === 'split' && splitPanels[0] === splitPanels[1]) {
      // Ensure different panels in split mode
      const otherPanel = panelConfigs.find(p => p.id !== activePanel)?.id || 'viewer'
      setSplitPanels([activePanel, otherPanel])
    }
  }

  const handleSplitPanelChange = (index: 0 | 1, panelId: PanelType) => {
    const newSplitPanels: [PanelType, PanelType] = [...splitPanels]
    newSplitPanels[index] = panelId
    setSplitPanels(newSplitPanels)
  }

  // Render panel content
  const renderPanel = (panelId: PanelType, className?: string) => {
    const config = panelConfigs.find(p => p.id === panelId)
    if (!config) return null

    const Component = config.component
    return (
      <div className={`${styles.panelContent} ${className || ''}`}>
        <div className={styles.panelHeader}>
          <h3>{config.icon} {config.title}</h3>
          {panelId === 'patterns' && (
            <button
              onClick={handleGenerateModel}
              disabled={!currentPattern || isGenerating}
              className={styles.generateButton}
            >
              {isGenerating ? 'Generating...' : 'Generate 3D Model'}
            </button>
          )}
        </div>
        <div className={styles.panelBody}>
          <Component {...config.defaultProps} />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.model3DPage}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <h1>Enhanced 3D Model Testing</h1>
          {state.testSession && (
            <div className={styles.sessionInfo}>
              <span>Session: {state.testSession.name}</span>
              <span>•</span>
              <span>Tests: {state.testResults.length}</span>
              {state.testResults.length > 0 && (
                <>
                  <span>•</span>
                  <span>
                    Success Rate: {Math.round((state.testResults.filter(r => r.success).length / state.testResults.length) * 100)}%
                  </span>
                </>
              )}
            </div>
          )}
        </div>
        
        <div className={styles.toolbarCenter}>
          <div className={styles.layoutControls}>
            <button
              onClick={() => handlePanelLayoutChange('single')}
              className={`${styles.layoutButton} ${panelLayout === 'single' ? styles.active : ''}`}
              title="Single Panel"
            >
              ⬜
            </button>
            <button
              onClick={() => handlePanelLayoutChange('split')}
              className={`${styles.layoutButton} ${panelLayout === 'split' ? styles.active : ''}`}
              title="Split View"
            >
              ⬛⬜
            </button>
            <button
              onClick={() => handlePanelLayoutChange('quad')}
              className={`${styles.layoutButton} ${panelLayout === 'quad' ? styles.active : ''}`}
              title="Quad View"
            >
              ⬛⬛
            </button>
          </div>
        </div>

        <div className={styles.toolbarRight}>
          <div className={styles.panelTabs}>
            {panelConfigs.map(config => (
              <button
                key={config.id}
                onClick={() => setActivePanel(config.id)}
                className={`${styles.panelTab} ${
                  (panelLayout === 'single' && activePanel === config.id) ||
                  (panelLayout !== 'single' && splitPanels.includes(config.id))
                    ? styles.active 
                    : ''
                }`}
                title={config.title}
              >
                {config.icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.panelContainer}>
        {panelLayout === 'single' && (
          <div className={styles.singlePanel}>
            {renderPanel(activePanel)}
          </div>
        )}

        {panelLayout === 'split' && (
          <div className={styles.splitPanels}>
            <div className={styles.splitPanel}>
              <div className={styles.splitPanelSelector}>
                <select
                  value={splitPanels[0]}
                  onChange={(e) => handleSplitPanelChange(0, e.target.value as PanelType)}
                  className={styles.panelSelect}
                >
                  {panelConfigs.map(config => (
                    <option key={config.id} value={config.id}>
                      {config.icon} {config.title}
                    </option>
                  ))}
                </select>
              </div>
              {renderPanel(splitPanels[0], styles.splitPanelContent)}
            </div>
            <div className={styles.splitDivider} />
            <div className={styles.splitPanel}>
              <div className={styles.splitPanelSelector}>
                <select
                  value={splitPanels[1]}
                  onChange={(e) => handleSplitPanelChange(1, e.target.value as PanelType)}
                  className={styles.panelSelect}
                >
                  {panelConfigs.map(config => (
                    <option key={config.id} value={config.id}>
                      {config.icon} {config.title}
                    </option>
                  ))}
                </select>
              </div>
              {renderPanel(splitPanels[1], styles.splitPanelContent)}
            </div>
          </div>
        )}

        {panelLayout === 'quad' && (
          <div className={styles.quadPanels}>
            {panelConfigs.slice(0, 4).map((config, index) => (
              <div key={config.id} className={styles.quadPanel}>
                {renderPanel(config.id, styles.quadPanelContent)}
              </div>
            ))}
          </div>
        )}
      </div>

      {isGenerating && (
        <div className={styles.generatingOverlay}>
          <div className={styles.generatingDialog}>
            <div className={styles.spinner} />
            <h3>Generating 3D Model...</h3>
            <p>Processing pattern: {currentPattern?.width}×{currentPattern?.height}</p>
            <p>Active dots: {currentPattern?.data.flat().filter(Boolean).length}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// Placeholder panel components - these would be implemented in separate tasks
const PatternManagementPanel: React.FC<{ onPatternSelect: (pattern: DotPattern) => void; currentPattern: DotPattern | null }> = ({ onPatternSelect, currentPattern }) => (
  <div className={styles.placeholderPanel}>
    <PatternLibrary onPatternSelect={onPatternSelect} />
    {currentPattern && (
      <div style={{ marginTop: '16px' }}>
        <PatternEditor pattern={currentPattern} onChange={onPatternSelect} />
      </div>
    )}
  </div>
)

const ParameterTestingPanel: React.FC<{ currentParams: Model3DParams; onParamsChange: (params: Model3DParams) => void }> = ({ currentParams, onParamsChange }) => (
  <div className={styles.placeholderPanel}>
    <ParameterPresets 
      currentParams={currentParams}
      onPresetSelect={(params) => onParamsChange(params)}
    />
  </div>
)

const Enhanced3DViewerPanel: React.FC<{ pattern: DotPattern | null; model3DParams: Model3DParams }> = ({ pattern, model3DParams }) => (
  <div className={styles.placeholderPanel}>
    {pattern ? (
      <ModelViewer 
        pattern={pattern}
        model3DParams={model3DParams}
        onExport={(blob, filename) => {
          // Basic download helper
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${filename}.obj`
          a.click()
          URL.revokeObjectURL(url)
        }}
        onError={(msg) => {
          // Simple error surface for now
          console.error('ModelViewer error:', msg)
        }}
      />
    ) : (
      <div className={styles.noModel}>
        <p>No pattern selected.</p>
        <p>Select a pattern and click "Generate 3D Model" to begin.</p>
      </div>
    )}
  </div>
)

const PerformanceMonitoringPanel: React.FC<{ isActive: boolean; testId: string | null }> = ({ isActive, testId }) => (
  <div className={styles.placeholderPanel}>
    <h4>Performance Monitoring</h4>
    <p>Status: {isActive ? 'Monitoring Active' : 'Idle'}</p>
    {testId && <p>Test ID: {testId}</p>}
    <p>Real-time metrics and performance charts would appear here.</p>
  </div>
)

const ResultsDashboardPanel: React.FC<{ testSession: TestSession | null }> = ({ testSession }) => (
  <div className={styles.placeholderPanel}>
    <h4>Results Dashboard</h4>
    {testSession ? (
      <div>
        <p>Session: {testSession.name}</p>
        <p>Tests: {testSession.testResults.length}</p>
        <p>Created: {testSession.createdAt.toLocaleDateString()}</p>
      </div>
    ) : (
      <p>No active test session</p>
    )}
    <p>Test statistics and trend analysis would appear here.</p>
  </div>
)

const AutomatedTestingPanel: React.FC = () => (
  <div className={styles.placeholderPanel}>
    <h4>Test Automation</h4>
    <p>Test suite management and CI/CD integration would appear here.</p>
  </div>
)

export default Model3DPage