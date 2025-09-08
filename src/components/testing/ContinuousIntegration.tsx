import React, { useState, useCallback, useEffect } from 'react'
import type { 
  TestSuite, 
  TestSuiteResult, 
  CIReport 
} from '@/types'

export interface CIProvider {
  id: string
  name: string
  description: string
  logo?: string
  webhookUrl?: string
  apiKey?: string
  enabled: boolean
  configuration: Record<string, any>
}

export interface CIPipeline {
  id: string
  name: string
  description: string
  provider: string
  testSuiteIds: string[]
  triggers: CITrigger[]
  schedule?: CISchedule
  notifications: CINotification[]
  lastRun?: Date
  status: 'active' | 'paused' | 'disabled'
  settings: {
    timeout: number
    retryCount: number
    failFast: boolean
    parallelExecution: boolean
  }
}

export interface CITrigger {
  type: 'webhook' | 'schedule' | 'manual' | 'git_push' | 'pull_request'
  configuration: Record<string, any>
  enabled: boolean
}

export interface CISchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom'
  time: string // HH:mm format
  days?: number[] // 0-6 for weekly, 1-31 for monthly
  timezone: string
}

export interface CINotification {
  type: 'email' | 'slack' | 'teams' | 'webhook'
  target: string
  events: ('success' | 'failure' | 'always')[]
  enabled: boolean
}

export interface CIIntegrationProps {
  testSuites: TestSuite[]
  onPipelineCreated?: (pipeline: CIPipeline) => void
  onPipelineUpdated?: (pipeline: CIPipeline) => void
  onPipelineDeleted?: (pipelineId: string) => void
  onTestTriggered?: (pipelineId: string, suiteIds: string[]) => void
  className?: string
}

const DEFAULT_PROVIDERS: CIProvider[] = [
  {
    id: 'github-actions',
    name: 'GitHub Actions',
    description: 'Integrate with GitHub Actions workflows',
    enabled: false,
    configuration: {}
  },
  {
    id: 'jenkins',
    name: 'Jenkins',
    description: 'Connect to Jenkins automation server',
    enabled: false,
    configuration: {}
  },
  {
    id: 'gitlab-ci',
    name: 'GitLab CI/CD',
    description: 'Integrate with GitLab CI/CD pipelines',
    enabled: false,
    configuration: {}
  },
  {
    id: 'azure-devops',
    name: 'Azure DevOps',
    description: 'Connect to Azure DevOps pipelines',
    enabled: false,
    configuration: {}
  },
  {
    id: 'circleci',
    name: 'CircleCI',
    description: 'Integrate with CircleCI workflows',
    enabled: false,
    configuration: {}
  },
  {
    id: 'travis-ci',
    name: 'Travis CI',
    description: 'Connect to Travis CI builds',
    enabled: false,
    configuration: {}
  }
]

export const ContinuousIntegration: React.FC<CIIntegrationProps> = ({
  testSuites,
  onPipelineCreated,
  onPipelineUpdated,
  onPipelineDeleted,
  onTestTriggered,
  className = ''
}) => {
  const [providers, setProviders] = useState<CIProvider[]>(DEFAULT_PROVIDERS)
  const [pipelines, setPipelines] = useState<CIPipeline[]>([])
  const [selectedPipeline, setSelectedPipeline] = useState<CIPipeline | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'providers' | 'pipelines' | 'webhooks' | 'reports'>('overview')
  const [ciReports, setCIReports] = useState<CIReport[]>([])
  const [webhookHistory, setWebhookHistory] = useState<Array<{
    id: string
    timestamp: Date
    source: string
    payload: any
    processed: boolean
    result?: string
  }>>([])

  const [newPipeline, setNewPipeline] = useState<Partial<CIPipeline>>({
    name: '',
    description: '',
    provider: '',
    testSuiteIds: [],
    triggers: [],
    notifications: [],
    status: 'active',
    settings: {
      timeout: 1800000, // 30 minutes
      retryCount: 3,
      failFast: false,
      parallelExecution: true
    }
  })

  // Load existing pipelines and reports
  useEffect(() => {
    loadPipelines()
    loadCIReports()
    loadWebhookHistory()
  }, [])

  const loadPipelines = useCallback(() => {
    // In a real implementation, this would load from a backend service
    const savedPipelines = localStorage.getItem('dot23d_ci_pipelines')
    if (savedPipelines) {
      try {
        const parsed = JSON.parse(savedPipelines)
        setPipelines(parsed.map((p: any) => ({
          ...p,
          lastRun: p.lastRun ? new Date(p.lastRun) : undefined
        })))
      } catch (error) {
        console.error('Failed to load pipelines:', error)
      }
    }
  }, [])

  const loadCIReports = useCallback(() => {
    const savedReports = localStorage.getItem('dot23d_ci_reports')
    if (savedReports) {
      try {
        const parsed = JSON.parse(savedReports)
        setCIReports(parsed.map((r: any) => ({
          ...r,
          build: {
            ...r.build,
            timestamp: new Date(r.build.timestamp)
          }
        })))
      } catch (error) {
        console.error('Failed to load CI reports:', error)
      }
    }
  }, [])

  const loadWebhookHistory = useCallback(() => {
    const savedHistory = localStorage.getItem('dot23d_webhook_history')
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory)
        setWebhookHistory(parsed.map((h: any) => ({
          ...h,
          timestamp: new Date(h.timestamp)
        })))
      } catch (error) {
        console.error('Failed to load webhook history:', error)
      }
    }
  }, [])

  const savePipelines = useCallback((updatedPipelines: CIPipeline[]) => {
    try {
      localStorage.setItem('dot23d_ci_pipelines', JSON.stringify(updatedPipelines))
      setPipelines(updatedPipelines)
    } catch (error) {
      console.error('Failed to save pipelines:', error)
    }
  }, [])

  const configureCIProvider = useCallback((providerId: string, configuration: Record<string, any>) => {
    setProviders(prev => prev.map(provider => 
      provider.id === providerId 
        ? { ...provider, configuration, enabled: true }
        : provider
    ))

    // Save to localStorage
    const updatedProviders = providers.map(provider => 
      provider.id === providerId 
        ? { ...provider, configuration, enabled: true }
        : provider
    )
    localStorage.setItem('dot23d_ci_providers', JSON.stringify(updatedProviders))
  }, [providers])

  const createPipeline = useCallback(() => {
    if (!newPipeline.name || !newPipeline.provider || !newPipeline.testSuiteIds?.length) {
      alert('Pipeline name, provider, and at least one test suite are required')
      return
    }

    const pipeline: CIPipeline = {
      id: `pipeline_${Date.now()}`,
      name: newPipeline.name,
      description: newPipeline.description || '',
      provider: newPipeline.provider,
      testSuiteIds: newPipeline.testSuiteIds,
      triggers: newPipeline.triggers || [],
      notifications: newPipeline.notifications || [],
      status: newPipeline.status || 'active',
      settings: newPipeline.settings || {
        timeout: 1800000,
        retryCount: 3,
        failFast: false,
        parallelExecution: true
      }
    }

    const updatedPipelines = isEditing && selectedPipeline
      ? pipelines.map(p => p.id === selectedPipeline.id ? { ...pipeline, id: selectedPipeline.id } : p)
      : [...pipelines, pipeline]

    savePipelines(updatedPipelines)

    if (isEditing) {
      onPipelineUpdated?.(pipeline)
    } else {
      onPipelineCreated?.(pipeline)
    }

    resetForm()
  }, [newPipeline, isEditing, selectedPipeline, pipelines, savePipelines, onPipelineCreated, onPipelineUpdated])

  const editPipeline = useCallback((pipeline: CIPipeline) => {
    setSelectedPipeline(pipeline)
    setNewPipeline(pipeline)
    setIsEditing(true)
    setIsCreating(true)
  }, [])

  const deletePipeline = useCallback((pipelineId: string) => {
    if (confirm('Are you sure you want to delete this pipeline?')) {
      const updatedPipelines = pipelines.filter(p => p.id !== pipelineId)
      savePipelines(updatedPipelines)
      onPipelineDeleted?.(pipelineId)

      if (selectedPipeline?.id === pipelineId) {
        setSelectedPipeline(null)
      }
    }
  }, [pipelines, savePipelines, selectedPipeline, onPipelineDeleted])

  const triggerPipeline = useCallback(async (pipeline: CIPipeline) => {
    try {
      // Simulate triggering the pipeline
      onTestTriggered?.(pipeline.id, pipeline.testSuiteIds)
      
      // Update last run time
      const updatedPipeline = { ...pipeline, lastRun: new Date() }
      const updatedPipelines = pipelines.map(p => 
        p.id === pipeline.id ? updatedPipeline : p
      )
      savePipelines(updatedPipelines)

      // Generate a mock CI report
      const mockReport: CIReport = {
        build: {
          id: `build_${Date.now()}`,
          commit: 'abc123def',
          branch: 'main',
          timestamp: new Date()
        },
        summary: {
          totalTests: pipeline.testSuiteIds.length * 5, // Mock test count
          passed: pipeline.testSuiteIds.length * 4,
          failed: pipeline.testSuiteIds.length * 1,
          duration: Math.random() * 300000 + 60000 // 1-5 minutes
        },
        failures: pipeline.testSuiteIds.length > 0 ? [{
          testId: 'test_001',
          testName: 'Quality assurance test',
          error: 'Quality score below threshold',
          details: 'Expected quality score >= 70, got 65'
        }] : [],
        regressions: [],
        status: Math.random() > 0.3 ? 'passed' : 'failed'
      }

      setCIReports(prev => [mockReport, ...prev.slice(0, 9)])
      alert(`Pipeline "${pipeline.name}" triggered successfully`)

    } catch (error) {
      console.error('Failed to trigger pipeline:', error)
      alert('Failed to trigger pipeline')
    }
  }, [pipelines, savePipelines, onTestTriggered])

  const addTrigger = useCallback(() => {
    const newTrigger: CITrigger = {
      type: 'webhook',
      configuration: {},
      enabled: true
    }

    setNewPipeline(prev => ({
      ...prev,
      triggers: [...(prev.triggers || []), newTrigger]
    }))
  }, [])

  const updateTrigger = useCallback((index: number, updates: Partial<CITrigger>) => {
    setNewPipeline(prev => ({
      ...prev,
      triggers: prev.triggers?.map((trigger, i) => 
        i === index ? { ...trigger, ...updates } : trigger
      ) || []
    }))
  }, [])

  const addNotification = useCallback(() => {
    const newNotification: CINotification = {
      type: 'email',
      target: '',
      events: ['failure'],
      enabled: true
    }

    setNewPipeline(prev => ({
      ...prev,
      notifications: [...(prev.notifications || []), newNotification]
    }))
  }, [])

  const updateNotification = useCallback((index: number, updates: Partial<CINotification>) => {
    setNewPipeline(prev => ({
      ...prev,
      notifications: prev.notifications?.map((notification, i) => 
        i === index ? { ...notification, ...updates } : notification
      ) || []
    }))
  }, [])

  const resetForm = useCallback(() => {
    setIsCreating(false)
    setIsEditing(false)
    setSelectedPipeline(null)
    setNewPipeline({
      name: '',
      description: '',
      provider: '',
      testSuiteIds: [],
      triggers: [],
      notifications: [],
      status: 'active',
      settings: {
        timeout: 1800000,
        retryCount: 3,
        failFast: false,
        parallelExecution: true
      }
    })
  }, [])

  const generateWebhookUrl = useCallback((pipelineId: string) => {
    return `${window.location.origin}/api/webhooks/ci/${pipelineId}`
  }, [])

  const testWebhook = useCallback(async (pipelineId: string) => {
    try {
      // Simulate webhook test
      const testPayload = {
        repository: 'test/repo',
        branch: 'main',
        commit: 'abc123',
        timestamp: new Date().toISOString()
      }

      const webhookEntry = {
        id: `webhook_${Date.now()}`,
        timestamp: new Date(),
        source: 'manual_test',
        payload: testPayload,
        processed: true,
        result: 'success'
      }

      setWebhookHistory(prev => [webhookEntry, ...prev.slice(0, 19)])
      alert('Webhook test completed successfully')

    } catch (error) {
      console.error('Webhook test failed:', error)
      alert('Webhook test failed')
    }
  }, [])

  return (
    <div className={`ci-integration ${className}`}>
      <div className="ci-header">
        <h3>Continuous Integration</h3>
        <div className="ci-tabs">
          {['overview', 'providers', 'pipelines', 'webhooks', 'reports'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="overview-section">
          <div className="stats-grid">
            <div className="stat-card">
              <h4>Active Pipelines</h4>
              <div className="stat-value">{pipelines.filter(p => p.status === 'active').length}</div>
            </div>
            <div className="stat-card">
              <h4>Connected Providers</h4>
              <div className="stat-value">{providers.filter(p => p.enabled).length}</div>
            </div>
            <div className="stat-card">
              <h4>Recent Builds</h4>
              <div className="stat-value">{ciReports.length}</div>
            </div>
            <div className="stat-card">
              <h4>Success Rate</h4>
              <div className="stat-value">
                {ciReports.length > 0 
                  ? `${Math.round(ciReports.filter(r => r.status === 'passed').length / ciReports.length * 100)}%`
                  : 'N/A'
                }
              </div>
            </div>
          </div>

          <div className="recent-activity">
            <h4>Recent Activity</h4>
            {ciReports.length === 0 ? (
              <p>No recent CI activity</p>
            ) : (
              <div className="activity-list">
                {ciReports.slice(0, 5).map(report => (
                  <div key={`${report.build.id}_${report.build.timestamp.getTime()}`} className="activity-item">
                    <div className={`status-indicator ${report.status}`}></div>
                    <div className="activity-details">
                      <div className="activity-title">Build {report.build.id}</div>
                      <div className="activity-meta">
                        {report.build.branch} • {report.summary.passed}/{report.summary.totalTests} passed
                      </div>
                    </div>
                    <div className="activity-time">
                      {report.build.timestamp.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Providers Tab */}
      {activeTab === 'providers' && (
        <div className="providers-section">
          <h4>CI/CD Providers</h4>
          <div className="providers-grid">
            {providers.map(provider => (
              <div key={provider.id} className={`provider-card ${provider.enabled ? 'enabled' : ''}`}>
                <div className="provider-info">
                  <h5>{provider.name}</h5>
                  <p>{provider.description}</p>
                </div>
                <div className="provider-status">
                  {provider.enabled ? (
                    <span className="status-badge enabled">Connected</span>
                  ) : (
                    <span className="status-badge disabled">Not Connected</span>
                  )}
                </div>
                <div className="provider-actions">
                  <button 
                    onClick={() => {
                      // In real implementation, this would open a configuration dialog
                      const mockConfig = { apiKey: 'mock-key', webhookSecret: 'mock-secret' }
                      configureCIProvider(provider.id, mockConfig)
                    }}
                    className="configure-btn"
                  >
                    {provider.enabled ? 'Reconfigure' : 'Configure'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pipelines Tab */}
      {activeTab === 'pipelines' && (
        <div className="pipelines-section">
          <div className="pipelines-header">
            <h4>CI Pipelines ({pipelines.length})</h4>
            {!isCreating && (
              <button onClick={() => setIsCreating(true)} className="create-pipeline-btn">
                Create Pipeline
              </button>
            )}
          </div>

          {isCreating && (
            <div className="pipeline-form">
              <div className="form-header">
                <h5>{isEditing ? 'Edit Pipeline' : 'Create New Pipeline'}</h5>
                <div className="form-actions">
                  <button onClick={createPipeline} className="save-btn">Save</button>
                  <button onClick={resetForm} className="cancel-btn">Cancel</button>
                </div>
              </div>

              <div className="form-content">
                <div className="basic-config">
                  <div className="form-row">
                    <label>Pipeline Name:</label>
                    <input
                      type="text"
                      value={newPipeline.name || ''}
                      onChange={(e) => setNewPipeline(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="form-row">
                    <label>Description:</label>
                    <textarea
                      value={newPipeline.description || ''}
                      onChange={(e) => setNewPipeline(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                  <div className="form-row">
                    <label>Provider:</label>
                    <select
                      value={newPipeline.provider || ''}
                      onChange={(e) => setNewPipeline(prev => ({ ...prev, provider: e.target.value }))}
                    >
                      <option value="">Select Provider</option>
                      {providers.filter(p => p.enabled).map(provider => (
                        <option key={provider.id} value={provider.id}>{provider.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="test-suites-config">
                  <h6>Test Suites to Execute</h6>
                  <div className="suites-checkboxes">
                    {testSuites.map(suite => (
                      <label key={suite.id} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={newPipeline.testSuiteIds?.includes(suite.id) || false}
                          onChange={(e) => {
                            const suiteIds = newPipeline.testSuiteIds || []
                            setNewPipeline(prev => ({
                              ...prev,
                              testSuiteIds: e.target.checked
                                ? [...suiteIds, suite.id]
                                : suiteIds.filter(id => id !== suite.id)
                            }))
                          }}
                        />
                        {suite.name} ({suite.tests.length} tests)
                      </label>
                    ))}
                  </div>
                </div>

                <div className="triggers-config">
                  <div className="section-header">
                    <h6>Triggers</h6>
                    <button onClick={addTrigger} className="add-btn">Add Trigger</button>
                  </div>
                  {newPipeline.triggers?.map((trigger, index) => (
                    <div key={index} className="trigger-item">
                      <select
                        value={trigger.type}
                        onChange={(e) => updateTrigger(index, { type: e.target.value as any })}
                      >
                        <option value="webhook">Webhook</option>
                        <option value="schedule">Schedule</option>
                        <option value="manual">Manual</option>
                        <option value="git_push">Git Push</option>
                        <option value="pull_request">Pull Request</option>
                      </select>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={trigger.enabled}
                          onChange={(e) => updateTrigger(index, { enabled: e.target.checked })}
                        />
                        Enabled
                      </label>
                    </div>
                  ))}
                </div>

                <div className="notifications-config">
                  <div className="section-header">
                    <h6>Notifications</h6>
                    <button onClick={addNotification} className="add-btn">Add Notification</button>
                  </div>
                  {newPipeline.notifications?.map((notification, index) => (
                    <div key={index} className="notification-item">
                      <select
                        value={notification.type}
                        onChange={(e) => updateNotification(index, { type: e.target.value as any })}
                      >
                        <option value="email">Email</option>
                        <option value="slack">Slack</option>
                        <option value="teams">Teams</option>
                        <option value="webhook">Webhook</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Target (email, channel, URL)"
                        value={notification.target}
                        onChange={(e) => updateNotification(index, { target: e.target.value })}
                      />
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={notification.enabled}
                          onChange={(e) => updateNotification(index, { enabled: e.target.checked })}
                        />
                        Enabled
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!isCreating && (
            <div className="pipelines-list">
              {pipelines.length === 0 ? (
                <p>No pipelines configured yet.</p>
              ) : (
                pipelines.map(pipeline => (
                  <div key={pipeline.id} className="pipeline-card">
                    <div className="pipeline-info">
                      <h5>{pipeline.name}</h5>
                      <p>{pipeline.description}</p>
                      <div className="pipeline-meta">
                        <span>Provider: {providers.find(p => p.id === pipeline.provider)?.name}</span>
                        <span>Test Suites: {pipeline.testSuiteIds.length}</span>
                        <span>Status: {pipeline.status}</span>
                        {pipeline.lastRun && (
                          <span>Last Run: {pipeline.lastRun.toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="pipeline-actions">
                      <button onClick={() => triggerPipeline(pipeline)} className="trigger-btn">
                        Trigger
                      </button>
                      <button onClick={() => editPipeline(pipeline)} className="edit-btn">
                        Edit
                      </button>
                      <button onClick={() => deletePipeline(pipeline.id)} className="delete-btn">
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Webhooks Tab */}
      {activeTab === 'webhooks' && (
        <div className="webhooks-section">
          <h4>Webhook Management</h4>
          
          <div className="webhook-urls">
            <h5>Webhook URLs</h5>
            {pipelines.length === 0 ? (
              <p>No pipelines configured for webhooks.</p>
            ) : (
              pipelines.map(pipeline => (
                <div key={pipeline.id} className="webhook-item">
                  <div className="webhook-info">
                    <label>{pipeline.name}</label>
                    <code className="webhook-url">{generateWebhookUrl(pipeline.id)}</code>
                  </div>
                  <div className="webhook-actions">
                    <button 
                      onClick={() => navigator.clipboard.writeText(generateWebhookUrl(pipeline.id))}
                      className="copy-btn"
                    >
                      Copy
                    </button>
                    <button 
                      onClick={() => testWebhook(pipeline.id)}
                      className="test-btn"
                    >
                      Test
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="webhook-history">
            <h5>Recent Webhook Activity</h5>
            {webhookHistory.length === 0 ? (
              <p>No webhook activity yet.</p>
            ) : (
              <div className="history-list">
                {webhookHistory.slice(0, 10).map(entry => (
                  <div key={entry.id} className="history-item">
                    <div className={`status-dot ${entry.processed ? 'success' : 'pending'}`}></div>
                    <div className="history-details">
                      <div className="history-source">{entry.source}</div>
                      <div className="history-time">{entry.timestamp.toLocaleString()}</div>
                    </div>
                    <div className="history-result">
                      {entry.result || 'Processing...'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="reports-section">
          <h4>CI Reports</h4>
          {ciReports.length === 0 ? (
            <p>No CI reports available yet.</p>
          ) : (
            <div className="reports-list">
              {ciReports.map(report => (
                <div key={`${report.build.id}_${report.build.timestamp.getTime()}`} className="report-card">
                  <div className="report-header">
                    <div className="report-title">
                      <span className={`status-badge ${report.status}`}>{report.status}</span>
                      Build {report.build.id}
                    </div>
                    <div className="report-time">
                      {report.build.timestamp.toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="report-summary">
                    <div className="summary-stats">
                      <div className="stat">
                        <span className="stat-label">Tests:</span>
                        <span className="stat-value">{report.summary.totalTests}</span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">Passed:</span>
                        <span className="stat-value success">{report.summary.passed}</span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">Failed:</span>
                        <span className="stat-value failure">{report.summary.failed}</span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">Duration:</span>
                        <span className="stat-value">{Math.round(report.summary.duration / 1000)}s</span>
                      </div>
                    </div>
                  </div>

                  <div className="report-details">
                    <div className="build-info">
                      <span>Branch: {report.build.branch}</span>
                      <span>Commit: {report.build.commit}</span>
                    </div>
                    
                    {report.failures.length > 0 && (
                      <div className="failures">
                        <h6>Failures ({report.failures.length})</h6>
                        {report.failures.map((failure, index) => (
                          <div key={index} className="failure-item">
                            <div className="failure-test">{failure.testName}</div>
                            <div className="failure-error">{failure.error}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .ci-integration {
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding: 20px;
        }

        .ci-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .ci-tabs {
          display: flex;
          gap: 5px;
        }

        .tab-btn {
          padding: 8px 16px;
          border: 1px solid #ddd;
          background: white;
          cursor: pointer;
          border-radius: 4px 4px 0 0;
        }

        .tab-btn.active {
          background: #007bff;
          color: white;
          border-color: #007bff;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-bottom: 30px;
        }

        .stat-card {
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 20px;
          text-align: center;
        }

        .stat-card h4 {
          margin: 0 0 10px 0;
          color: #666;
          font-size: 0.9em;
        }

        .stat-value {
          font-size: 2em;
          font-weight: bold;
          color: #007bff;
        }

        .recent-activity {
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 20px;
        }

        .activity-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .activity-item {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 10px;
          border-bottom: 1px solid #eee;
        }

        .activity-item:last-child {
          border-bottom: none;
        }

        .status-indicator {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        .status-indicator.passed { background: #28a745; }
        .status-indicator.failed { background: #dc3545; }
        .status-indicator.unstable { background: #ffc107; }

        .activity-details {
          flex: 1;
        }

        .activity-title {
          font-weight: 600;
          color: #333;
        }

        .activity-meta {
          font-size: 0.9em;
          color: #666;
        }

        .activity-time {
          font-size: 0.8em;
          color: #999;
        }

        .providers-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
        }

        .provider-card {
          background: white;
          border: 2px solid #ddd;
          border-radius: 8px;
          padding: 20px;
          transition: all 0.2s;
        }

        .provider-card.enabled {
          border-color: #28a745;
        }

        .provider-info h5 {
          margin: 0 0 10px 0;
          color: #333;
        }

        .provider-info p {
          margin: 0 0 15px 0;
          color: #666;
          font-size: 0.9em;
        }

        .status-badge {
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 0.8em;
          font-weight: 500;
        }

        .status-badge.enabled {
          background: #d4edda;
          color: #155724;
        }

        .status-badge.disabled {
          background: #f8d7da;
          color: #721c24;
        }

        .status-badge.passed {
          background: #d4edda;
          color: #155724;
        }

        .status-badge.failed {
          background: #f8d7da;
          color: #721c24;
        }

        .configure-btn {
          background: #007bff;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }

        .pipelines-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .create-pipeline-btn {
          background: #28a745;
          color: white;
          border: none;
          padding: 10px 16px;
          border-radius: 6px;
          cursor: pointer;
        }

        .pipeline-form {
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
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }

        .cancel-btn {
          background: #6c757d;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
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

        .suites-checkboxes {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 200px;
          overflow-y: auto;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 15px;
          background: white;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: normal;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .add-btn {
          background: #17a2b8;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9em;
        }

        .trigger-item, .notification-item {
          display: flex;
          gap: 10px;
          align-items: center;
          margin-bottom: 10px;
          padding: 10px;
          background: white;
          border-radius: 4px;
          border: 1px solid #ddd;
        }

        .pipelines-list {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .pipeline-card {
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .pipeline-info h5 {
          margin: 0 0 5px 0;
          color: #333;
        }

        .pipeline-info p {
          margin: 0 0 10px 0;
          color: #666;
        }

        .pipeline-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
          font-size: 0.9em;
          color: #666;
        }

        .pipeline-actions {
          display: flex;
          gap: 8px;
        }

        .trigger-btn { background: #28a745; color: white; }
        .edit-btn { background: #ffc107; color: #212529; }
        .delete-btn { background: #dc3545; color: white; }

        .pipeline-actions button {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9em;
        }

        .webhook-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: white;
          border: 1px solid #ddd;
          border-radius: 6px;
          padding: 15px;
          margin-bottom: 10px;
        }

        .webhook-info label {
          display: block;
          font-weight: 600;
          margin-bottom: 5px;
        }

        .webhook-url {
          background: #f8f9fa;
          padding: 4px 8px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 0.9em;
        }

        .webhook-actions {
          display: flex;
          gap: 8px;
        }

        .copy-btn, .test-btn {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9em;
        }

        .copy-btn { background: #17a2b8; color: white; }
        .test-btn { background: #ffc107; color: #212529; }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .history-item {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 10px;
          background: white;
          border: 1px solid #ddd;
          border-radius: 6px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .status-dot.success { background: #28a745; }
        .status-dot.pending { background: #ffc107; }

        .history-details {
          flex: 1;
        }

        .history-source {
          font-weight: 600;
          color: #333;
        }

        .history-time {
          font-size: 0.9em;
          color: #666;
        }

        .reports-list {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .report-card {
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 20px;
        }

        .report-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }

        .report-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 600;
        }

        .summary-stats {
          display: flex;
          gap: 20px;
          margin-bottom: 15px;
        }

        .stat {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .stat-label {
          font-size: 0.9em;
          color: #666;
        }

        .stat-value.success { color: #28a745; }
        .stat-value.failure { color: #dc3545; }

        .build-info {
          display: flex;
          gap: 20px;
          font-size: 0.9em;
          color: #666;
          margin-bottom: 15px;
        }

        .failures h6 {
          margin: 0 0 10px 0;
          color: #dc3545;
        }

        .failure-item {
          margin-bottom: 8px;
          padding: 8px;
          background: #f8f9fa;
          border-left: 3px solid #dc3545;
        }

        .failure-test {
          font-weight: 600;
          color: #333;
        }

        .failure-error {
          font-size: 0.9em;
          color: #666;
        }
      `}</style>
    </div>
  )
}

export default ContinuousIntegration