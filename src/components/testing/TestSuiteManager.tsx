import React, { useState, useCallback, useEffect } from 'react'
import type { 
  TestSuite, 
  TestSuiteTest, 
  TestSuiteResult, 
  DotPattern, 
  Model3DParams, 
  TestResult 
} from '@/types'
import { TestSessionService } from '@/services/TestSessionService'

interface TestSuiteManagerProps {
  availablePatterns: DotPattern[]
  availableParams: Model3DParams[]
  onSuiteExecuted?: (result: TestSuiteResult) => void
  onSuiteCreated?: (suite: TestSuite) => void
  onSuiteUpdated?: (suite: TestSuite) => void
  className?: string
}

interface TestSuiteTemplate {
  id: string
  name: string
  description: string
  category: 'quality' | 'performance' | 'compatibility' | 'regression' | 'stress' | 'custom'
  tests: Omit<TestSuiteTest, 'id'>[]
}

const DEFAULT_TEMPLATES: TestSuiteTemplate[] = [
  {
    id: 'quality-assurance',
    name: 'Quality Assurance Suite',
    description: 'Comprehensive quality testing across different patterns and parameters',
    category: 'quality',
    tests: [
      {
        name: 'Basic Quality Check',
        pattern: {} as DotPattern, // Will be filled with actual patterns
        parameters: {} as Model3DParams,
        expectations: {
          shouldSucceed: true,
          minQualityScore: 70
        }
      }
    ]
  },
  {
    id: 'performance-benchmark',
    name: 'Performance Benchmark Suite',
    description: 'Test performance characteristics and identify bottlenecks',
    category: 'performance',
    tests: [
      {
        name: 'Speed Test - Small Pattern',
        pattern: {} as DotPattern,
        parameters: {} as Model3DParams,
        expectations: {
          shouldSucceed: true,
          maxProcessingTime: 5000
        }
      },
      {
        name: 'Speed Test - Large Pattern',
        pattern: {} as DotPattern,
        parameters: {} as Model3DParams,
        expectations: {
          shouldSucceed: true,
          maxProcessingTime: 30000
        }
      }
    ]
  },
  {
    id: 'compatibility-matrix',
    name: 'Compatibility Matrix',
    description: 'Test various pattern and parameter combinations',
    category: 'compatibility',
    tests: []
  },
  {
    id: 'regression-test',
    name: 'Regression Test Suite',
    description: 'Ensure changes don\'t break existing functionality',
    category: 'regression',
    tests: []
  },
  {
    id: 'stress-test',
    name: 'Stress Test Suite',
    description: 'Test system limits and error handling',
    category: 'stress',
    tests: []
  }
]

export const TestSuiteManager: React.FC<TestSuiteManagerProps> = ({
  availablePatterns,
  availableParams,
  onSuiteExecuted,
  onSuiteCreated,
  onSuiteUpdated,
  className = ''
}) => {
  const [testSuites, setTestSuites] = useState<TestSuite[]>([])
  const [selectedSuite, setSelectedSuite] = useState<TestSuite | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionProgress, setExecutionProgress] = useState(0)
  const [currentTest, setCurrentTest] = useState<string>('')
  const [suiteResults, setSuiteResults] = useState<TestSuiteResult[]>([])
  const [showTemplates, setShowTemplates] = useState(false)
  const [newSuite, setNewSuite] = useState<Partial<TestSuite>>({
    name: '',
    description: '',
    tests: [],
    author: 'User',
    version: '1.0.0',
    settings: {
      timeout: 300000, // 5 minutes
      failFast: false,
      parallel: true,
      maxParallel: 3
    }
  })

  // Load existing test suites on component mount
  useEffect(() => {
    loadTestSuites()
    loadSuiteResults()
  }, [])

  const loadTestSuites = useCallback(() => {
    try {
      const suites = TestSessionService.getAllTestSuites()
      setTestSuites(suites)
    } catch (error) {
      console.error('Failed to load test suites:', error)
    }
  }, [])

  const loadSuiteResults = useCallback(() => {
    try {
      const results = TestSessionService.getAllSuiteResults()
      setSuiteResults(results)
    } catch (error) {
      console.error('Failed to load suite results:', error)
    }
  }, [])

  const createSuiteFromTemplate = useCallback((template: TestSuiteTemplate) => {
    const suite: Partial<TestSuite> = {
      name: template.name,
      description: template.description,
      author: 'User',
      version: '1.0.0',
      tests: template.tests.map((test, index) => ({
        ...test,
        id: `test_${index + 1}`,
        // Use first available pattern and params as defaults
        pattern: availablePatterns[0] || {} as DotPattern,
        parameters: availableParams[0] || {} as Model3DParams
      })),
      settings: {
        timeout: 300000,
        failFast: template.category === 'quality',
        parallel: template.category !== 'stress',
        maxParallel: template.category === 'stress' ? 1 : 3
      }
    }

    setNewSuite(suite)
    setIsCreating(true)
    setShowTemplates(false)
  }, [availablePatterns, availableParams])

  const saveSuite = useCallback(async () => {
    if (!newSuite.name?.trim() || !newSuite.tests?.length) {
      alert('Suite name and at least one test are required')
      return
    }

    try {
      const suite: TestSuite = {
        id: `suite_${Date.now()}`,
        name: newSuite.name.trim(),
        description: newSuite.description || '',
        tests: newSuite.tests || [],
        author: newSuite.author || 'User',
        createdAt: new Date(),
        version: newSuite.version || '1.0.0',
        settings: newSuite.settings || {
          timeout: 300000,
          failFast: false,
          parallel: true,
          maxParallel: 3
        }
      }

      if (isEditing && selectedSuite) {
        // Update existing suite
        const updatedSuite = { ...suite, id: selectedSuite.id, createdAt: selectedSuite.createdAt }
        TestSessionService.updateTestSuite(updatedSuite)
        onSuiteUpdated?.(updatedSuite)
      } else {
        // Create new suite
        TestSessionService.saveTestSuite(suite)
        onSuiteCreated?.(suite)
      }

      loadTestSuites()
      setIsCreating(false)
      setIsEditing(false)
      setNewSuite({
        name: '',
        description: '',
        tests: [],
        author: 'User',
        version: '1.0.0',
        settings: {
          timeout: 300000,
          failFast: false,
          parallel: true,
          maxParallel: 3
        }
      })
    } catch (error) {
      console.error('Failed to save test suite:', error)
      alert('Failed to save test suite')
    }
  }, [newSuite, isEditing, selectedSuite, onSuiteCreated, onSuiteUpdated])

  const editSuite = useCallback((suite: TestSuite) => {
    setSelectedSuite(suite)
    setNewSuite({ ...suite })
    setIsEditing(true)
    setIsCreating(true)
  }, [])

  const deleteSuite = useCallback((suiteId: string) => {
    if (confirm('Are you sure you want to delete this test suite?')) {
      try {
        TestSessionService.deleteTestSuite(suiteId)
        loadTestSuites()
        if (selectedSuite?.id === suiteId) {
          setSelectedSuite(null)
        }
      } catch (error) {
        console.error('Failed to delete test suite:', error)
        alert('Failed to delete test suite')
      }
    }
  }, [selectedSuite, loadTestSuites])

  const duplicateSuite = useCallback((suite: TestSuite) => {
    const duplicated: Partial<TestSuite> = {
      ...suite,
      name: `${suite.name} (Copy)`,
      version: '1.0.0'
    }
    delete duplicated.id
    delete duplicated.createdAt

    setNewSuite(duplicated)
    setIsCreating(true)
    setIsEditing(false)
  }, [])

  const executeSuite = useCallback(async (suite: TestSuite) => {
    if (isExecuting) return

    setIsExecuting(true)
    setExecutionProgress(0)
    setCurrentTest('')

    try {
      const startTime = Date.now()
      const results: TestResult[] = []
      let passed = 0
      let failed = 0
      let skipped = 0

      for (let i = 0; i < suite.tests.length; i++) {
        const test = suite.tests[i]
        setCurrentTest(test.name)
        setExecutionProgress((i / suite.tests.length) * 100)

        try {
          // Simulate test execution - in real implementation this would call the actual 3D generation
          await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500))

          // Mock test result
          const testResult: TestResult = {
            id: `result_${Date.now()}_${i}`,
            testSessionId: `suite_execution_${Date.now()}`,
            timestamp: new Date(),
            pattern: test.pattern,
            parameters: test.parameters,
            success: Math.random() > 0.1, // 90% success rate
            processingTime: Math.random() * 10000 + 1000,
            qualityScore: Math.random() * 40 + 60, // 60-100 quality score
            meshStats: {
              vertexCount: Math.floor(Math.random() * 10000) + 1000,
              faceCount: Math.floor(Math.random() * 20000) + 2000,
              edgeCount: Math.floor(Math.random() * 15000) + 1500,
              boundingBox: { width: 10, height: 10, depth: 10 },
              surfaceArea: Math.random() * 1000 + 100,
              volume: Math.random() * 500 + 50,
              memoryUsage: Math.random() * 1024 + 512
            },
            performanceMetrics: {
              memoryUsed: Math.random() * 512 + 256,
              cpuUsage: Math.random() * 80 + 20,
              generationSpeed: Math.random() * 1000 + 500,
              elapsedTime: Math.random() * 10000 + 1000
            },
            warnings: [],
            exportedFormats: []
          }

          // Validate expectations
          let testPassed = testResult.success
          if (test.expectations.minQualityScore && testResult.qualityScore < test.expectations.minQualityScore) {
            testPassed = false
          }
          if (test.expectations.maxProcessingTime && testResult.processingTime > test.expectations.maxProcessingTime) {
            testPassed = false
          }

          if (testPassed) {
            passed++
          } else {
            failed++
            if (suite.settings.failFast) {
              break
            }
          }

          results.push(testResult)

        } catch (error) {
          failed++
          skipped = suite.tests.length - i - 1
          if (suite.settings.failFast) {
            break
          }
        }
      }

      const endTime = Date.now()
      const suiteResult: TestSuiteResult = {
        suiteId: suite.id,
        timestamp: new Date(),
        success: failed === 0,
        testResults: results,
        statistics: {
          totalTests: suite.tests.length,
          passed,
          failed,
          skipped,
          totalTime: endTime - startTime
        },
        performanceSummary: {
          averageProcessingTime: results.reduce((sum, r) => sum + r.processingTime, 0) / results.length || 0,
          peakMemoryUsage: Math.max(...results.map(r => r.performanceMetrics.memoryUsed)),
          averageQualityScore: results.reduce((sum, r) => sum + r.qualityScore, 0) / results.length || 0
        }
      }

      // Save result
      TestSessionService.saveSuiteResult(suiteResult)
      setSuiteResults(prev => [suiteResult, ...prev])
      onSuiteExecuted?.(suiteResult)

      setExecutionProgress(100)
      setCurrentTest('Completed')

    } catch (error) {
      console.error('Suite execution failed:', error)
      alert('Suite execution failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsExecuting(false)
      setTimeout(() => {
        setExecutionProgress(0)
        setCurrentTest('')
      }, 2000)
    }
  }, [isExecuting, onSuiteExecuted])

  const addTestToSuite = useCallback(() => {
    const newTest: TestSuiteTest = {
      id: `test_${Date.now()}`,
      name: `Test ${(newSuite.tests?.length || 0) + 1}`,
      pattern: availablePatterns[0] || {} as DotPattern,
      parameters: availableParams[0] || {} as Model3DParams,
      expectations: {
        shouldSucceed: true,
        minQualityScore: 70
      }
    }

    setNewSuite(prev => ({
      ...prev,
      tests: [...(prev.tests || []), newTest]
    }))
  }, [newSuite.tests, availablePatterns, availableParams])

  const updateTest = useCallback((index: number, updates: Partial<TestSuiteTest>) => {
    setNewSuite(prev => ({
      ...prev,
      tests: prev.tests?.map((test, i) => i === index ? { ...test, ...updates } : test) || []
    }))
  }, [])

  const removeTest = useCallback((index: number) => {
    setNewSuite(prev => ({
      ...prev,
      tests: prev.tests?.filter((_, i) => i !== index) || []
    }))
  }, [])

  const cancelCreation = useCallback(() => {
    setIsCreating(false)
    setIsEditing(false)
    setSelectedSuite(null)
    setNewSuite({
      name: '',
      description: '',
      tests: [],
      author: 'User',
      version: '1.0.0',
      settings: {
        timeout: 300000,
        failFast: false,
        parallel: true,
        maxParallel: 3
      }
    })
  }, [])

  return (
    <div className={`test-suite-manager ${className}`}>
      <div className="suite-header">
        <h3>Test Suite Manager</h3>
        <div className="suite-actions">
          {!isCreating && (
            <>
              <button onClick={() => setShowTemplates(true)} className="template-btn">
                New from Template
              </button>
              <button onClick={() => setIsCreating(true)} className="create-btn">
                Create Custom Suite
              </button>
            </>
          )}
        </div>
      </div>

      {/* Template Selection Modal */}
      {showTemplates && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h4>Choose Template</h4>
              <button onClick={() => setShowTemplates(false)} className="close-btn">×</button>
            </div>
            <div className="template-grid">
              {DEFAULT_TEMPLATES.map(template => (
                <div key={template.id} className="template-card" onClick={() => createSuiteFromTemplate(template)}>
                  <h5>{template.name}</h5>
                  <p>{template.description}</p>
                  <span className={`category-badge ${template.category}`}>{template.category}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Suite Creation/Editing Form */}
      {isCreating && (
        <div className="suite-form">
          <div className="form-header">
            <h4>{isEditing ? 'Edit Test Suite' : 'Create New Test Suite'}</h4>
            <div className="form-actions">
              <button onClick={saveSuite} className="save-btn">Save Suite</button>
              <button onClick={cancelCreation} className="cancel-btn">Cancel</button>
            </div>
          </div>

          <div className="form-content">
            <div className="basic-info">
              <div className="form-row">
                <label>Suite Name:</label>
                <input
                  type="text"
                  value={newSuite.name || ''}
                  onChange={(e) => setNewSuite(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter suite name"
                />
              </div>
              <div className="form-row">
                <label>Description:</label>
                <textarea
                  value={newSuite.description || ''}
                  onChange={(e) => setNewSuite(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter suite description"
                />
              </div>
              <div className="form-row">
                <label>Version:</label>
                <input
                  type="text"
                  value={newSuite.version || ''}
                  onChange={(e) => setNewSuite(prev => ({ ...prev, version: e.target.value }))}
                  placeholder="1.0.0"
                />
              </div>
            </div>

            <div className="execution-settings">
              <h5>Execution Settings</h5>
              <div className="settings-grid">
                <div className="setting-item">
                  <label>Timeout (ms):</label>
                  <input
                    type="number"
                    value={newSuite.settings?.timeout || 300000}
                    onChange={(e) => setNewSuite(prev => ({
                      ...prev,
                      settings: { ...prev.settings!, timeout: parseInt(e.target.value) }
                    }))}
                  />
                </div>
                <div className="setting-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={newSuite.settings?.failFast || false}
                      onChange={(e) => setNewSuite(prev => ({
                        ...prev,
                        settings: { ...prev.settings!, failFast: e.target.checked }
                      }))}
                    />
                    Fail Fast
                  </label>
                </div>
                <div className="setting-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={newSuite.settings?.parallel || false}
                      onChange={(e) => setNewSuite(prev => ({
                        ...prev,
                        settings: { ...prev.settings!, parallel: e.target.checked }
                      }))}
                    />
                    Parallel Execution
                  </label>
                </div>
                <div className="setting-item">
                  <label>Max Parallel:</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={newSuite.settings?.maxParallel || 3}
                    onChange={(e) => setNewSuite(prev => ({
                      ...prev,
                      settings: { ...prev.settings!, maxParallel: parseInt(e.target.value) }
                    }))}
                    disabled={!newSuite.settings?.parallel}
                  />
                </div>
              </div>
            </div>

            <div className="tests-section">
              <div className="tests-header">
                <h5>Test Scenarios ({newSuite.tests?.length || 0})</h5>
                <button onClick={addTestToSuite} className="add-test-btn">Add Test</button>
              </div>

              <div className="tests-list">
                {newSuite.tests?.map((test, index) => (
                  <div key={test.id} className="test-item">
                    <div className="test-header">
                      <input
                        type="text"
                        value={test.name}
                        onChange={(e) => updateTest(index, { name: e.target.value })}
                        className="test-name"
                      />
                      <button onClick={() => removeTest(index)} className="remove-test-btn">Remove</button>
                    </div>
                    
                    <div className="test-config">
                      <div className="config-row">
                        <label>Pattern:</label>
                        <select
                          value={availablePatterns.findIndex(p => p.id === test.pattern.id)}
                          onChange={(e) => {
                            const pattern = availablePatterns[parseInt(e.target.value)]
                            updateTest(index, { pattern })
                          }}
                        >
                          {availablePatterns.map((pattern, i) => (
                            <option key={pattern.id} value={i}>
                              {pattern.name || `Pattern ${i + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="config-row">
                        <label>Parameters:</label>
                        <select
                          value={availableParams.findIndex(p => JSON.stringify(p) === JSON.stringify(test.parameters))}
                          onChange={(e) => {
                            const parameters = availableParams[parseInt(e.target.value)]
                            updateTest(index, { parameters })
                          }}
                        >
                          {availableParams.map((params, i) => (
                            <option key={i} value={i}>
                              Parameter Set {i + 1}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="test-expectations">
                      <h6>Expectations</h6>
                      <div className="expectations-grid">
                        <div className="expectation-item">
                          <label>
                            <input
                              type="checkbox"
                              checked={test.expectations.shouldSucceed}
                              onChange={(e) => updateTest(index, {
                                expectations: { ...test.expectations, shouldSucceed: e.target.checked }
                              })}
                            />
                            Should Succeed
                          </label>
                        </div>
                        <div className="expectation-item">
                          <label>Min Quality Score:</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={test.expectations.minQualityScore || ''}
                            onChange={(e) => {
                              const value = e.target.value ? parseFloat(e.target.value) : undefined
                              updateTest(index, {
                                expectations: { ...test.expectations, minQualityScore: value }
                              })
                            }}
                          />
                        </div>
                        <div className="expectation-item">
                          <label>Max Processing Time (ms):</label>
                          <input
                            type="number"
                            min="0"
                            value={test.expectations.maxProcessingTime || ''}
                            onChange={(e) => {
                              const value = e.target.value ? parseInt(e.target.value) : undefined
                              updateTest(index, {
                                expectations: { ...test.expectations, maxProcessingTime: value }
                              })
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )) || []}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Existing Suites List */}
      {!isCreating && (
        <div className="existing-suites">
          <h4>Existing Test Suites ({testSuites.length})</h4>
          
          {testSuites.length === 0 ? (
            <p className="no-suites">No test suites created yet. Create your first suite using templates or custom configuration.</p>
          ) : (
            <div className="suites-grid">
              {testSuites.map(suite => (
                <div key={suite.id} className="suite-card">
                  <div className="suite-info">
                    <h5>{suite.name}</h5>
                    <p>{suite.description}</p>
                    <div className="suite-meta">
                      <span>Tests: {suite.tests.length}</span>
                      <span>Version: {suite.version}</span>
                      <span>Created: {suite.createdAt.toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="suite-actions">
                    <button
                      onClick={() => executeSuite(suite)}
                      disabled={isExecuting}
                      className="execute-btn"
                    >
                      {isExecuting ? 'Executing...' : 'Execute'}
                    </button>
                    <button onClick={() => editSuite(suite)} className="edit-btn">Edit</button>
                    <button onClick={() => duplicateSuite(suite)} className="duplicate-btn">Duplicate</button>
                    <button onClick={() => deleteSuite(suite.id)} className="delete-btn">Delete</button>
                  </div>

                  {/* Recent Results */}
                  {suiteResults.filter(r => r.suiteId === suite.id).length > 0 && (
                    <div className="recent-results">
                      <h6>Recent Results</h6>
                      {suiteResults
                        .filter(r => r.suiteId === suite.id)
                        .slice(0, 3)
                        .map(result => (
                          <div key={`${result.suiteId}_${result.timestamp.getTime()}`} className="result-summary">
                            <span className={`status ${result.success ? 'success' : 'failure'}`}>
                              {result.success ? '✓' : '✗'}
                            </span>
                            <span>{result.timestamp.toLocaleDateString()}</span>
                            <span>{result.statistics.passed}/{result.statistics.totalTests} passed</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Execution Progress */}
      {isExecuting && (
        <div className="execution-progress">
          <div className="progress-header">
            <h4>Executing Test Suite</h4>
            <div className="progress-info">
              <span>{executionProgress.toFixed(0)}% Complete</span>
              <span>Current: {currentTest}</span>
            </div>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${executionProgress}%` }} />
          </div>
        </div>
      )}

      <style jsx>{`
        .test-suite-manager {
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding: 20px;
        }

        .suite-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .suite-actions {
          display: flex;
          gap: 10px;
        }

        .template-btn, .create-btn {
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
        }

        .template-btn {
          background: #6f42c1;
          color: white;
        }

        .create-btn {
          background: #007bff;
          color: white;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal {
          background: white;
          border-radius: 8px;
          padding: 20px;
          max-width: 800px;
          max-height: 600px;
          overflow-y: auto;
          width: 90%;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          width: 30px;
          height: 30px;
        }

        .template-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 15px;
        }

        .template-card {
          border: 2px solid #e9ecef;
          border-radius: 8px;
          padding: 15px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .template-card:hover {
          border-color: #007bff;
          transform: translateY(-2px);
        }

        .template-card h5 {
          margin: 0 0 10px 0;
          color: #333;
        }

        .template-card p {
          margin: 0 0 10px 0;
          color: #666;
          font-size: 0.9em;
        }

        .category-badge {
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 0.8em;
          font-weight: 500;
          text-transform: capitalize;
        }

        .category-badge.quality { background: #e7f3ff; color: #0066cc; }
        .category-badge.performance { background: #fff2e7; color: #cc6600; }
        .category-badge.compatibility { background: #f0e7ff; color: #6600cc; }
        .category-badge.regression { background: #e7ffe7; color: #00cc00; }
        .category-badge.stress { background: #ffe7e7; color: #cc0000; }

        .suite-form {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .form-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .form-actions {
          display: flex;
          gap: 10px;
        }

        .save-btn {
          background: #28a745;
          color: white;
          border: none;
          padding: 10px 16px;
          border-radius: 6px;
          cursor: pointer;
        }

        .cancel-btn {
          background: #6c757d;
          color: white;
          border: none;
          padding: 10px 16px;
          border-radius: 6px;
          cursor: pointer;
        }

        .form-content {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-row {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .form-row label {
          font-weight: 600;
          color: #333;
        }

        .form-row input, .form-row textarea, .form-row select {
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }

        .form-row textarea {
          min-height: 80px;
          resize: vertical;
        }

        .settings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
        }

        .setting-item {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .setting-item label {
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .tests-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }

        .add-test-btn {
          background: #17a2b8;
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 4px;
          cursor: pointer;
        }

        .tests-list {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .test-item {
          background: white;
          border: 1px solid #ddd;
          border-radius: 6px;
          padding: 15px;
        }

        .test-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }

        .test-name {
          flex: 1;
          margin-right: 10px;
        }

        .remove-test-btn {
          background: #dc3545;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
        }

        .test-config {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin-bottom: 15px;
        }

        .config-row {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .test-expectations {
          border-top: 1px solid #eee;
          padding-top: 15px;
        }

        .test-expectations h6 {
          margin: 0 0 10px 0;
          color: #333;
        }

        .expectations-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 10px;
        }

        .expectation-item {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .expectation-item label {
          font-size: 0.9em;
          font-weight: 500;
        }

        .suites-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 20px;
        }

        .suite-card {
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 20px;
        }

        .suite-info h5 {
          margin: 0 0 10px 0;
          color: #333;
        }

        .suite-info p {
          margin: 0 0 15px 0;
          color: #666;
        }

        .suite-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
          font-size: 0.9em;
          color: #666;
          margin-bottom: 15px;
        }

        .suite-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 15px;
        }

        .suite-actions button {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9em;
        }

        .execute-btn { background: #28a745; color: white; }
        .edit-btn { background: #ffc107; color: #212529; }
        .duplicate-btn { background: #17a2b8; color: white; }
        .delete-btn { background: #dc3545; color: white; }

        .recent-results {
          border-top: 1px solid #eee;
          padding-top: 15px;
        }

        .recent-results h6 {
          margin: 0 0 10px 0;
          font-size: 0.9em;
          color: #333;
        }

        .result-summary {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.8em;
          color: #666;
          margin-bottom: 5px;
        }

        .status.success { color: #28a745; }
        .status.failure { color: #dc3545; }

        .execution-progress {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 20px;
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }

        .progress-info {
          display: flex;
          gap: 20px;
          font-size: 0.9em;
          color: #666;
        }

        .progress-bar {
          width: 100%;
          height: 8px;
          background: #e9ecef;
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #007bff, #28a745);
          transition: width 0.3s ease;
        }

        .no-suites {
          text-align: center;
          color: #666;
          font-style: italic;
          padding: 40px 20px;
        }
      `}</style>
    </div>
  )
}

export default TestSuiteManager