import React, { useState, useCallback, useMemo } from 'react'
import { ModelViewer } from '../ModelViewer'
import { QualityAssessmentService } from '@/services/QualityAssessmentService'
import type { DotPattern, Model3DParams, QualityReport } from '@/types'
import styles from './ModelComparison.module.css'

interface ComparisonModel {
  id: string
  label: string
  pattern: DotPattern
  params: Model3DParams
  qualityReport?: QualityReport
}

interface ModelComparisonProps {
  models: ComparisonModel[]
  onModelSelect?: (modelId: string) => void
  onComparisonComplete?: (comparison: ComparisonResult) => void
  showQualityComparison?: boolean
  showStatistics?: boolean
  syncControls?: boolean
}

interface ComparisonResult {
  models: ComparisonModel[]
  bestQuality: string
  statistics: {
    averageScore: number
    scoreRange: { min: number; max: number }
    recommendations: string[]
  }
  differences: Array<{
    metric: string
    values: { [modelId: string]: number }
    significance: 'low' | 'medium' | 'high'
  }>
}

interface ViewControls {
  cameraAngleX: number
  cameraAngleY: number
  cameraDistance: number
}

export const ModelComparison: React.FC<ModelComparisonProps> = ({
  models,
  onModelSelect,
  onComparisonComplete,
  showQualityComparison = true,
  showStatistics = true,
  syncControls = false
}) => {
  const [selectedModels, setSelectedModels] = useState<string[]>(() => 
    models.slice(0, 2).map(m => m.id)
  )
  const [qualityReports, setQualityReports] = useState<{ [modelId: string]: QualityReport }>({})
  const [viewControls, setViewControls] = useState<ViewControls>({
    cameraAngleX: Math.PI * 0.3,
    cameraAngleY: 0,
    cameraDistance: 50
  })
  const [comparisonView, setComparisonView] = useState<'side-by-side' | 'overlay' | 'statistics'>('side-by-side')
  const [highlightDifferences, setHighlightDifferences] = useState(false)

  const handleModelSelection = useCallback((modelId: string) => {
    setSelectedModels(prev => {
      const newSelection = prev.includes(modelId) 
        ? prev.filter(id => id !== modelId)
        : prev.length < 4 
          ? [...prev, modelId]
          : [prev[1], prev[2], prev[3], modelId] // Replace first model if at limit

      if (onModelSelect) {
        onModelSelect(modelId)
      }

      return newSelection
    })
  }, [onModelSelect])

  const handleQualityAssessment = useCallback((modelId: string, report: QualityReport) => {
    setQualityReports(prev => ({
      ...prev,
      [modelId]: report
    }))
  }, [])

  const comparisonResult = useMemo((): ComparisonResult | null => {
    if (selectedModels.length < 2) return null

    const selectedModelData = selectedModels.map(id => 
      models.find(m => m.id === id)!
    ).filter(Boolean)

    const reportsWithModels = selectedModelData.filter(model => 
      qualityReports[model.id]
    )

    if (reportsWithModels.length === 0) return null

    // Calculate statistics
    const scores = reportsWithModels.map(model => qualityReports[model.id].overallScore)
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length
    const scoreRange = {
      min: Math.min(...scores),
      max: Math.max(...scores)
    }

    // Find best quality model
    const bestModel = reportsWithModels.reduce((best, current) => 
      qualityReports[current.id].overallScore > qualityReports[best.id].overallScore ? current : best
    )

    // Calculate differences
    const differences = [
      {
        metric: 'Overall Quality',
        values: Object.fromEntries(
          reportsWithModels.map(model => [model.id, qualityReports[model.id].overallScore])
        ),
        significance: scoreRange.max - scoreRange.min > 20 ? 'high' : 
                     scoreRange.max - scoreRange.min > 10 ? 'medium' : 'low' as const
      },
      {
        metric: 'Manifoldness',
        values: Object.fromEntries(
          reportsWithModels.map(model => [model.id, qualityReports[model.id].geometry.manifoldness])
        ),
        significance: 'medium' as const
      },
      {
        metric: 'Support Need',
        values: Object.fromEntries(
          reportsWithModels.map(model => [model.id, qualityReports[model.id].printability.supportNeed])
        ),
        significance: 'high' as const
      }
    ]

    // Aggregate recommendations
    const allRecommendations = reportsWithModels.flatMap(model => 
      qualityReports[model.id].recommendations.map(rec => rec.message)
    )
    const uniqueRecommendations = [...new Set(allRecommendations)].slice(0, 5)

    const result: ComparisonResult = {
      models: selectedModelData,
      bestQuality: bestModel.id,
      statistics: {
        averageScore,
        scoreRange,
        recommendations: uniqueRecommendations
      },
      differences
    }

    return result
  }, [models, selectedModels, qualityReports])

  // Update comparison result callback
  React.useEffect(() => {
    if (comparisonResult && onComparisonComplete) {
      onComparisonComplete(comparisonResult)
    }
  }, [comparisonResult, onComparisonComplete])

  const selectedModelData = selectedModels.map(id => 
    models.find(m => m.id === id)!
  ).filter(Boolean)

  return (
    <div className={styles.modelComparison}>
      <div className={styles.header}>
        <h3>Model Comparison</h3>
        <div className={styles.controls}>
          <div className={styles.viewControls}>
            <label>View:</label>
            <select 
              value={comparisonView} 
              onChange={(e) => setComparisonView(e.target.value as any)}
              className={styles.viewSelect}
            >
              <option value="side-by-side">Side by Side</option>
              <option value="overlay">Overlay</option>
              <option value="statistics">Statistics</option>
            </select>
          </div>
          
          {comparisonView === 'side-by-side' && (
            <div className={styles.syncControls}>
              <label>
                <input
                  type="checkbox"
                  checked={syncControls}
                  onChange={(e) => {
                    // Note: This would need to be lifted to parent component
                    // for actual synchronization between ModelViewer instances
                  }}
                />
                Sync Controls
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={highlightDifferences}
                  onChange={(e) => setHighlightDifferences(e.target.checked)}
                />
                Highlight Differences
              </label>
            </div>
          )}
        </div>
      </div>

      <div className={styles.modelSelection}>
        <h4>Select Models to Compare (max 4):</h4>
        <div className={styles.modelList}>
          {models.map((model) => (
            <div 
              key={model.id} 
              className={`${styles.modelCard} ${selectedModels.includes(model.id) ? styles.selected : ''}`}
              onClick={() => handleModelSelection(model.id)}
            >
              <div className={styles.modelInfo}>
                <h5>{model.label}</h5>
                <div className={styles.modelStats}>
                  {qualityReports[model.id] && (
                    <span className={styles.qualityScore}>
                      Score: {qualityReports[model.id].overallScore}/100
                    </span>
                  )}
                </div>
              </div>
              {selectedModels.includes(model.id) && (
                <div className={styles.selectedBadge}>✓</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {selectedModelData.length > 0 && (
        <div className={styles.comparisonContent}>
          {comparisonView === 'side-by-side' && (
            <div className={styles.sideBySide}>
              <div 
                className={styles.modelsGrid}
                style={{ 
                  gridTemplateColumns: `repeat(${Math.min(selectedModelData.length, 2)}, 1fr)` 
                }}
              >
                {selectedModelData.slice(0, 2).map((model, index) => (
                  <div key={model.id} className={styles.modelContainer}>
                    <div className={styles.modelHeader}>
                      <h4>{model.label}</h4>
                      {qualityReports[model.id] && (
                        <div className={styles.quickStats}>
                          <span className={`${styles.score} ${
                            qualityReports[model.id].overallScore >= 80 ? styles.good :
                            qualityReports[model.id].overallScore >= 60 ? styles.warning : styles.poor
                          }`}>
                            {qualityReports[model.id].overallScore}/100
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className={styles.modelViewerWrapper}>
                      <ModelViewer
                        pattern={model.pattern}
                        model3DParams={model.params}
                        showQualityInspection={showQualityComparison}
                        onQualityAssessment={(report) => handleQualityAssessment(model.id, report)}
                        onError={(error) => console.error(`Model ${model.label} error:`, error)}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {selectedModelData.length > 2 && (
                <div className={styles.additionalModels}>
                  <h4>Additional Models:</h4>
                  <div 
                    className={styles.modelsGrid}
                    style={{ 
                      gridTemplateColumns: `repeat(${Math.min(selectedModelData.length - 2, 2)}, 1fr)` 
                    }}
                  >
                    {selectedModelData.slice(2, 4).map((model) => (
                      <div key={model.id} className={styles.modelContainer}>
                        <div className={styles.modelHeader}>
                          <h5>{model.label}</h5>
                          {qualityReports[model.id] && (
                            <span className={styles.miniScore}>
                              {qualityReports[model.id].overallScore}/100
                            </span>
                          )}
                        </div>
                        
                        <div className={styles.modelViewerWrapper}>
                          <ModelViewer
                            pattern={model.pattern}
                            model3DParams={model.params}
                            showQualityInspection={showQualityComparison}
                            onQualityAssessment={(report) => handleQualityAssessment(model.id, report)}
                            onError={(error) => console.error(`Model ${model.label} error:`, error)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {comparisonView === 'statistics' && comparisonResult && (
            <div className={styles.statisticsView}>
              <div className={styles.statsOverview}>
                <div className={styles.statCard}>
                  <h4>Best Quality Model</h4>
                  <div className={styles.bestModel}>
                    {models.find(m => m.id === comparisonResult.bestQuality)?.label}
                    <span className={styles.score}>
                      {qualityReports[comparisonResult.bestQuality]?.overallScore}/100
                    </span>
                  </div>
                </div>

                <div className={styles.statCard}>
                  <h4>Average Score</h4>
                  <div className={styles.averageScore}>
                    {comparisonResult.statistics.averageScore.toFixed(1)}/100
                  </div>
                </div>

                <div className={styles.statCard}>
                  <h4>Score Range</h4>
                  <div className={styles.scoreRange}>
                    {comparisonResult.statistics.scoreRange.min} - {comparisonResult.statistics.scoreRange.max}
                  </div>
                </div>
              </div>

              <div className={styles.differences}>
                <h4>Key Differences</h4>
                <div className={styles.differencesTable}>
                  <table>
                    <thead>
                      <tr>
                        <th>Metric</th>
                        {selectedModelData.map(model => (
                          <th key={model.id}>{model.label}</th>
                        ))}
                        <th>Significance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonResult.differences.map((diff, index) => (
                        <tr key={index} className={`significance-${diff.significance}`}>
                          <td className={styles.metricName}>{diff.metric}</td>
                          {selectedModelData.map(model => (
                            <td key={model.id} className={styles.metricValue}>
                              {diff.values[model.id]?.toFixed(1) ?? 'N/A'}
                            </td>
                          ))}
                          <td className={`${styles.significance} ${styles[diff.significance]}`}>
                            {diff.significance.toUpperCase()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {comparisonResult.statistics.recommendations.length > 0 && (
                <div className={styles.recommendations}>
                  <h4>Common Recommendations</h4>
                  <ul>
                    {comparisonResult.statistics.recommendations.map((rec, index) => (
                      <li key={index}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {selectedModelData.length === 0 && (
        <div className={styles.emptyState}>
          <p>Select models above to start comparing</p>
        </div>
      )}

      {selectedModelData.length === 1 && (
        <div className={styles.singleModelState}>
          <p>Select at least 2 models to enable comparison features</p>
        </div>
      )}
    </div>
  )
}

export default ModelComparison