import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { TestSessionService } from '@/services/TestSessionService'
import type { TestSession, TestResult } from '@/types'
import styles from './TrendAnalysis.module.css'

interface TrendAnalysisProps {
  sessions?: TestSession[]
  onTrendDetected?: (trend: TrendData) => void
  onPredictionUpdate?: (prediction: PredictionData) => void
  refreshInterval?: number
  showPredictions?: boolean
  showRecommendations?: boolean
}

interface DataPoint {
  timestamp: Date
  successRate: number
  averageScore: number
  testCount: number
  averageTime: number
  failureRate: number
}

interface TrendData {
  metric: 'successRate' | 'averageScore' | 'averageTime' | 'failureRate'
  direction: 'improving' | 'declining' | 'stable'
  strength: 'weak' | 'moderate' | 'strong'
  confidence: number
  slope: number
  correlation: number
  period: string
  significance: 'low' | 'medium' | 'high'
  description: string
}

interface PredictionData {
  metric: string
  predictedValue: number
  confidenceInterval: { lower: number; upper: number }
  timeframe: '24h' | '7d' | '30d'
  accuracy: number
  recommendation: string
}

interface RegressionResult {
  slope: number
  intercept: number
  rSquared: number
  correlation: number
}

export const TrendAnalysis: React.FC<TrendAnalysisProps> = ({
  sessions: externalSessions,
  onTrendDetected,
  onPredictionUpdate,
  refreshInterval = 60000,
  showPredictions = true,
  showRecommendations = true
}) => {
  const [sessions, setSessions] = useState<TestSession[]>([])
  const [selectedMetric, setSelectedMetric] = useState<'successRate' | 'averageScore' | 'averageTime' | 'failureRate'>('successRate')
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | '90d'>('7d')
  const [trendPeriod, setTrendPeriod] = useState<'hour' | 'day' | 'week'>('day')
  const [isLoading, setIsLoading] = useState(true)
  const [lastAnalyzed, setLastAnalyzed] = useState<Date>(new Date())

  // Load sessions
  useEffect(() => {
    const loadSessions = async () => {
      try {
        if (externalSessions) {
          setSessions(externalSessions)
        } else {
          const loadedSessions = TestSessionService.getAllSessions()
          setSessions(loadedSessions)
        }
      } catch (error) {
        console.error('Failed to load sessions:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadSessions()
  }, [externalSessions])

  // Auto-refresh analysis
  useEffect(() => {
    if (!refreshInterval) return

    const interval = setInterval(() => {
      setLastAnalyzed(new Date())
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [refreshInterval])

  // Process test results into time-series data
  const timeSeriesData = useMemo((): DataPoint[] => {
    const allResults = sessions.flatMap(s => s.testResults)
    
    if (allResults.length === 0) return []

    // Filter by time range
    const now = new Date()
    const cutoff = new Date()
    
    switch (timeRange) {
      case '24h':
        cutoff.setDate(now.getDate() - 1)
        break
      case '7d':
        cutoff.setDate(now.getDate() - 7)
        break
      case '30d':
        cutoff.setDate(now.getDate() - 30)
        break
      case '90d':
        cutoff.setDate(now.getDate() - 90)
        break
    }

    const filteredResults = allResults.filter(result => 
      new Date(result.timestamp) >= cutoff
    )

    // Group by time period
    const grouped: { [key: string]: TestResult[] } = {}
    
    filteredResults.forEach(result => {
      const date = new Date(result.timestamp)
      let groupKey: string
      
      switch (trendPeriod) {
        case 'hour':
          groupKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`
          break
        case 'day':
          groupKey = date.toISOString().split('T')[0]
          break
        case 'week':
          const weekStart = new Date(date)
          weekStart.setDate(date.getDate() - date.getDay())
          groupKey = weekStart.toISOString().split('T')[0]
          break
      }
      
      if (!grouped[groupKey]) {
        grouped[groupKey] = []
      }
      grouped[groupKey].push(result)
    })

    // Convert to data points
    return Object.entries(grouped)
      .map(([key, results]) => {
        const successful = results.filter(r => r.status === 'success')
        const failed = results.filter(r => r.status === 'error')
        const withQuality = results.filter(r => r.qualityReport)
        const withTiming = results.filter(r => r.executionTime)

        const successRate = results.length > 0 ? (successful.length / results.length) * 100 : 0
        const averageScore = withQuality.length > 0 
          ? withQuality.reduce((sum, r) => sum + r.qualityReport!.overallScore, 0) / withQuality.length
          : 0
        const averageTime = withTiming.length > 0
          ? withTiming.reduce((sum, r) => sum + r.executionTime!, 0) / withTiming.length
          : 0
        const failureRate = results.length > 0 ? (failed.length / results.length) * 100 : 0

        return {
          timestamp: new Date(key),
          successRate,
          averageScore,
          testCount: results.length,
          averageTime,
          failureRate
        }
      })
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }, [sessions, timeRange, trendPeriod])

  // Linear regression calculation
  const calculateRegression = useCallback((data: number[]): RegressionResult => {
    if (data.length < 2) {
      return { slope: 0, intercept: 0, rSquared: 0, correlation: 0 }
    }

    const n = data.length
    const x = Array.from({ length: n }, (_, i) => i)
    const y = data

    const sumX = x.reduce((a, b) => a + b, 0)
    const sumY = y.reduce((a, b) => a + b, 0)
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0)
    const sumXX = x.reduce((acc, xi) => acc + xi * xi, 0)
    const sumYY = y.reduce((acc, yi) => acc + yi * yi, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n

    // Calculate correlation coefficient
    const correlation = (n * sumXY - sumX * sumY) / 
      Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY))

    // Calculate R-squared
    const yMean = sumY / n
    const totalSumSquares = y.reduce((acc, yi) => acc + Math.pow(yi - yMean, 2), 0)
    const residualSumSquares = y.reduce((acc, yi, i) => {
      const predicted = slope * x[i] + intercept
      return acc + Math.pow(yi - predicted, 2)
    }, 0)
    const rSquared = 1 - (residualSumSquares / totalSumSquares)

    return { slope, intercept, rSquared, correlation }
  }, [])

  // Trend analysis
  const trendAnalysis = useMemo((): TrendData[] => {
    if (timeSeriesData.length < 3) return []

    const metrics: Array<{ key: keyof DataPoint; name: string }> = [
      { key: 'successRate', name: 'Success Rate' },
      { key: 'averageScore', name: 'Quality Score' },
      { key: 'averageTime', name: 'Generation Time' },
      { key: 'failureRate', name: 'Failure Rate' }
    ]

    return metrics.map(({ key, name }) => {
      const values = timeSeriesData.map(d => d[key] as number)
      const regression = calculateRegression(values)
      
      // Determine trend direction
      let direction: 'improving' | 'declining' | 'stable'
      const absSlope = Math.abs(regression.slope)
      
      if (key === 'averageTime' || key === 'failureRate') {
        // For these metrics, negative slope is improving
        direction = regression.slope < -0.1 ? 'improving' : 
                   regression.slope > 0.1 ? 'declining' : 'stable'
      } else {
        // For success rate and quality score, positive slope is improving
        direction = regression.slope > 0.1 ? 'improving' : 
                   regression.slope < -0.1 ? 'declining' : 'stable'
      }

      // Determine trend strength
      const strength: 'weak' | 'moderate' | 'strong' = 
        absSlope > 2 ? 'strong' : absSlope > 0.5 ? 'moderate' : 'weak'

      // Calculate confidence (based on R-squared and data points)
      const confidence = Math.min(100, Math.max(0, 
        (regression.rSquared * 0.7 + (timeSeriesData.length / 30) * 0.3) * 100
      ))

      // Determine significance
      const significance: 'low' | 'medium' | 'high' = 
        confidence > 70 && strength !== 'weak' ? 'high' :
        confidence > 50 || strength === 'moderate' ? 'medium' : 'low'

      // Generate description
      let description = `${name} is ${direction}`
      if (direction !== 'stable') {
        description += ` with ${strength} ${direction === 'improving' ? 'improvement' : 'decline'}`
      }
      description += ` (${confidence.toFixed(0)}% confidence)`

      const trend: TrendData = {
        metric: key as any,
        direction,
        strength,
        confidence,
        slope: regression.slope,
        correlation: regression.correlation,
        period: `${timeRange} (${trendPeriod}ly)`,
        significance,
        description
      }

      // Notify parent component
      if (onTrendDetected && significance !== 'low') {
        onTrendDetected(trend)
      }

      return trend
    })
  }, [timeSeriesData, timeRange, trendPeriod, calculateRegression, onTrendDetected])

  // Predictions
  const predictions = useMemo((): PredictionData[] => {
    if (!showPredictions || timeSeriesData.length < 5) return []

    const currentMetric = timeSeriesData[timeSeriesData.length - 1]
    const trend = trendAnalysis.find(t => t.metric === selectedMetric)
    
    if (!trend) return []

    const predictions: PredictionData[] = []
    const timeframes: Array<{ key: '24h' | '7d' | '30d'; periods: number }> = [
      { key: '24h', periods: trendPeriod === 'hour' ? 24 : 1 },
      { key: '7d', periods: trendPeriod === 'hour' ? 168 : trendPeriod === 'day' ? 7 : 1 },
      { key: '30d', periods: trendPeriod === 'hour' ? 720 : trendPeriod === 'day' ? 30 : 4 }
    ]

    timeframes.forEach(({ key, periods }) => {
      const currentValue = currentMetric[selectedMetric] as number
      const predictedValue = currentValue + (trend.slope * periods)
      
      // Calculate confidence interval (simplified)
      const errorMargin = Math.abs(predictedValue * 0.1) // 10% margin
      const confidenceInterval = {
        lower: Math.max(0, predictedValue - errorMargin),
        upper: Math.min(100, predictedValue + errorMargin)
      }

      // Accuracy based on trend confidence and stability
      const accuracy = Math.min(95, trend.confidence * 0.8 + 
        (trend.strength === 'strong' ? 20 : trend.strength === 'moderate' ? 10 : 0))

      // Generate recommendation
      let recommendation = ''
      if (trend.direction === 'declining' && trend.significance === 'high') {
        recommendation = `Urgent action needed - ${selectedMetric} declining rapidly`
      } else if (trend.direction === 'improving') {
        recommendation = `Continue current practices - positive trend observed`
      } else if (trend.direction === 'stable') {
        recommendation = `Monitor closely - no significant change predicted`
      } else {
        recommendation = `Consider intervention - negative trend detected`
      }

      const prediction: PredictionData = {
        metric: selectedMetric,
        predictedValue,
        confidenceInterval,
        timeframe: key,
        accuracy,
        recommendation
      }

      predictions.push(prediction)
    })

    // Notify parent component
    if (onPredictionUpdate && predictions.length > 0) {
      onPredictionUpdate(predictions[0])
    }

    return predictions
  }, [timeSeriesData, trendAnalysis, selectedMetric, trendPeriod, showPredictions, onPredictionUpdate])

  const chartData = useMemo(() => {
    if (timeSeriesData.length === 0) return { points: '', viewBox: '0 0 800 300' }

    const values = timeSeriesData.map(d => d[selectedMetric] as number)
    const maxValue = Math.max(...values)
    const minValue = Math.min(...values)
    const range = maxValue - minValue || 1

    const chartWidth = 760
    const chartHeight = 260
    const margin = 20

    const points = timeSeriesData.map((d, i) => {
      const x = margin + (i / (timeSeriesData.length - 1)) * chartWidth
      const y = chartHeight + margin - ((d[selectedMetric] as number - minValue) / range) * chartHeight
      return `${x},${y}`
    }).join(' ')

    return {
      points,
      viewBox: `0 0 ${chartWidth + margin * 2} ${chartHeight + margin * 2}`,
      maxValue,
      minValue
    }
  }, [timeSeriesData, selectedMetric])

  if (isLoading) {
    return (
      <div className={styles.trendAnalysis}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Analyzing trends...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.trendAnalysis}>
      <div className={styles.header}>
        <h3>Trend Analysis</h3>
        <div className={styles.controls}>
          <div className={styles.metricSelector}>
            <label>Metric:</label>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as any)}
              className={styles.metricSelect}
            >
              <option value="successRate">Success Rate</option>
              <option value="averageScore">Quality Score</option>
              <option value="averageTime">Generation Time</option>
              <option value="failureRate">Failure Rate</option>
            </select>
          </div>

          <div className={styles.timeRangeSelector}>
            <label>Range:</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className={styles.timeRangeSelect}
            >
              <option value="24h">24 Hours</option>
              <option value="7d">7 Days</option>
              <option value="30d">30 Days</option>
              <option value="90d">90 Days</option>
            </select>
          </div>

          <div className={styles.periodSelector}>
            <label>Period:</label>
            <select
              value={trendPeriod}
              onChange={(e) => setTrendPeriod(e.target.value as any)}
              className={styles.periodSelect}
            >
              <option value="hour">Hourly</option>
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
            </select>
          </div>
        </div>
      </div>

      <div className={styles.lastAnalyzed}>
        Last analyzed: {lastAnalyzed.toLocaleTimeString()}
      </div>

      <div className={styles.content}>
        {timeSeriesData.length === 0 ? (
          <div className={styles.noData}>
            <p>No data available for trend analysis</p>
          </div>
        ) : (
          <>
            {/* Trend Chart */}
            <div className={styles.trendChart}>
              <h4>Trend Visualization</h4>
              <div className={styles.chartContainer}>
                <svg className={styles.chart} viewBox={chartData.viewBox}>
                  {/* Grid lines */}
                  <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e0e0e0" strokeWidth="1"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                  
                  {/* Trend line */}
                  <polyline
                    fill="none"
                    stroke="#0969da"
                    strokeWidth="2"
                    points={chartData.points}
                  />
                  
                  {/* Data points */}
                  {timeSeriesData.map((_, i) => {
                    const x = 20 + (i / (timeSeriesData.length - 1)) * 760
                    const y = 280 - ((timeSeriesData[i][selectedMetric] as number - chartData.minValue) / (chartData.maxValue - chartData.minValue || 1)) * 260
                    return (
                      <circle
                        key={i}
                        cx={x}
                        cy={y}
                        r="4"
                        fill="#0969da"
                        className={styles.dataPoint}
                      />
                    )
                  })}
                </svg>
              </div>
            </div>

            {/* Trend Summary */}
            <div className={styles.trendSummary}>
              <h4>Trend Analysis Summary</h4>
              <div className={styles.trendsGrid}>
                {trendAnalysis.map((trend) => (
                  <div 
                    key={trend.metric} 
                    className={`${styles.trendCard} ${styles[trend.significance]}`}
                  >
                    <div className={styles.trendHeader}>
                      <div className={styles.trendMetric}>
                        {trend.metric.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </div>
                      <div className={`${styles.trendDirection} ${styles[trend.direction]}`}>
                        {trend.direction === 'improving' ? '📈' : 
                         trend.direction === 'declining' ? '📉' : '➡️'}
                      </div>
                    </div>
                    
                    <div className={styles.trendDetails}>
                      <div className={styles.trendStrength}>
                        Strength: <span className={styles[trend.strength]}>{trend.strength}</span>
                      </div>
                      <div className={styles.trendConfidence}>
                        Confidence: {trend.confidence.toFixed(0)}%
                      </div>
                    </div>
                    
                    <div className={styles.trendDescription}>
                      {trend.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Predictions */}
            {showPredictions && predictions.length > 0 && (
              <div className={styles.predictions}>
                <h4>Predictions for {selectedMetric.replace(/([A-Z])/g, ' $1')}</h4>
                <div className={styles.predictionsGrid}>
                  {predictions.map((prediction) => (
                    <div key={prediction.timeframe} className={styles.predictionCard}>
                      <div className={styles.predictionHeader}>
                        <div className={styles.predictionTimeframe}>
                          {prediction.timeframe.toUpperCase()}
                        </div>
                        <div className={styles.predictionAccuracy}>
                          {prediction.accuracy.toFixed(0)}% accuracy
                        </div>
                      </div>
                      
                      <div className={styles.predictionValue}>
                        {prediction.predictedValue.toFixed(1)}
                        {selectedMetric.includes('Rate') ? '%' : selectedMetric.includes('Time') ? 'ms' : ''}
                      </div>
                      
                      <div className={styles.predictionRange}>
                        Range: {prediction.confidenceInterval.lower.toFixed(1)} - {prediction.confidenceInterval.upper.toFixed(1)}
                      </div>
                      
                      <div className={styles.predictionRecommendation}>
                        {prediction.recommendation}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {showRecommendations && (
              <div className={styles.recommendations}>
                <h4>Optimization Recommendations</h4>
                <div className={styles.recommendationsList}>
                  {trendAnalysis
                    .filter(t => t.significance === 'high' || t.direction === 'declining')
                    .map((trend, index) => {
                      let recommendation = ''
                      
                      if (trend.metric === 'successRate' && trend.direction === 'declining') {
                        recommendation = 'Review test parameters and error patterns to identify failure causes'
                      } else if (trend.metric === 'averageScore' && trend.direction === 'declining') {
                        recommendation = 'Analyze quality factors and consider parameter optimization'
                      } else if (trend.metric === 'averageTime' && trend.direction === 'declining') {
                        recommendation = 'Performance is improving - consider increasing test complexity'
                      } else if (trend.metric === 'failureRate' && trend.direction === 'improving') {
                        recommendation = 'Failure rate is decreasing - monitor for continued improvement'
                      } else {
                        recommendation = `Monitor ${trend.metric} closely for potential issues`
                      }

                      return (
                        <div key={index} className={`${styles.recommendation} ${styles[trend.significance]}`}>
                          <div className={styles.recommendationIcon}>
                            {trend.direction === 'declining' ? '⚠️' : '💡'}
                          </div>
                          <div className={styles.recommendationText}>
                            <strong>{trend.metric}:</strong> {recommendation}
                          </div>
                        </div>
                      )
                    })}
                  
                  {trendAnalysis.every(t => t.direction === 'improving' || t.direction === 'stable') && (
                    <div className={`${styles.recommendation} ${styles.positive}`}>
                      <div className={styles.recommendationIcon}>✅</div>
                      <div className={styles.recommendationText}>
                        All metrics show positive or stable trends. Continue current testing practices.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default TrendAnalysis