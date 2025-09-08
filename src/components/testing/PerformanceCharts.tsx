import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useAppContext } from '@/context/AppContext'
import { TestSessionService } from '@/services/TestSessionService'
import type { TestResult, TestSession, PerformanceMetrics } from '@/types'
import styles from './PerformanceCharts.module.css'

export interface PerformanceChartsProps {
  /** Test session to analyze */
  testSession?: TestSession
  /** Time range for analysis */
  timeRange?: '1h' | '1d' | '1w' | '1m' | 'all'
  /** Chart type to display */
  chartType?: 'line' | 'bar' | 'scatter' | 'area'
  /** Show comparison with previous sessions */
  showComparison?: boolean
  /** Height of charts */
  chartHeight?: number
}

type MetricType = 'processingTime' | 'qualityScore' | 'memoryUsage' | 'cpuUsage' | 'vertexCount' | 'faceCount'

interface ChartDataPoint {
  timestamp: number
  value: number
  testId: string
  label: string
  metadata?: {
    patternSize: string
    parameterHash: string
    success: boolean
  }
}

interface TrendAnalysis {
  direction: 'improving' | 'declining' | 'stable'
  slope: number
  correlation: number
  confidence: number
  prediction: number
  recommendation: string
}

export const PerformanceCharts: React.FC<PerformanceChartsProps> = ({
  testSession,
  timeRange = '1d',
  chartType = 'line',
  showComparison = false,
  chartHeight = 300
}) => {
  const { state } = useAppContext()
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('processingTime')
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [comparisonData, setComparisonData] = useState<ChartDataPoint[]>([])
  const [trendAnalysis, setTrendAnalysis] = useState<TrendAnalysis | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set())

  const currentSession = testSession || state.testSession
  const allResults = currentSession ? [...currentSession.testResults, ...state.testResults] : state.testResults

  // Filter results by time range
  const filteredResults = useMemo(() => {
    if (allResults.length === 0) return []

    const now = Date.now()
    let timeWindow: number

    switch (timeRange) {
      case '1h': timeWindow = 60 * 60 * 1000; break
      case '1d': timeWindow = 24 * 60 * 60 * 1000; break
      case '1w': timeWindow = 7 * 24 * 60 * 60 * 1000; break
      case '1m': timeWindow = 30 * 24 * 60 * 60 * 1000; break
      default: return allResults
    }

    return allResults.filter(result => now - result.timestamp.getTime() <= timeWindow)
  }, [allResults, timeRange])

  // Convert results to chart data points
  const convertToChartData = useCallback((results: TestResult[], metric: MetricType): ChartDataPoint[] => {
    return results.map(result => {
      let value: number
      
      switch (metric) {
        case 'processingTime':
          value = result.processingTime
          break
        case 'qualityScore':
          value = result.qualityScore
          break
        case 'memoryUsage':
          value = result.performanceMetrics?.memoryUsage?.used || 0
          break
        case 'cpuUsage':
          const cpu = result.performanceMetrics?.cpuUsage
          value = cpu ? cpu.generation + cpu.optimization + cpu.rendering : 0
          break
        case 'vertexCount':
          value = result.meshStats.vertexCount
          break
        case 'faceCount':
          value = result.meshStats.faceCount
          break
        default:
          value = 0
      }

      return {
        timestamp: result.timestamp.getTime(),
        value,
        testId: result.id,
        label: new Date(result.timestamp).toLocaleTimeString(),
        metadata: {
          patternSize: `${result.pattern.width}×${result.pattern.height}`,
          parameterHash: JSON.stringify(result.parameters).slice(0, 8),
          success: result.success
        }
      }
    }).sort((a, b) => a.timestamp - b.timestamp)
  }, [])

  // Calculate trend analysis
  const calculateTrend = useCallback((data: ChartDataPoint[]): TrendAnalysis => {
    if (data.length < 3) {
      return {
        direction: 'stable',
        slope: 0,
        correlation: 0,
        confidence: 0,
        prediction: data[data.length - 1]?.value || 0,
        recommendation: 'Insufficient data for trend analysis'
      }
    }

    // Simple linear regression
    const n = data.length
    const x = data.map((_, i) => i)
    const y = data.map(d => d.value)
    
    const sumX = x.reduce((sum, val) => sum + val, 0)
    const sumY = y.reduce((sum, val) => sum + val, 0)
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0)
    const sumXX = x.reduce((sum, val) => sum + val * val, 0)
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n
    
    // Calculate correlation coefficient
    const meanX = sumX / n
    const meanY = sumY / n
    const numerator = x.reduce((sum, val, i) => sum + (val - meanX) * (y[i] - meanY), 0)
    const denomX = Math.sqrt(x.reduce((sum, val) => sum + Math.pow(val - meanX, 2), 0))
    const denomY = Math.sqrt(y.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0))
    const correlation = numerator / (denomX * denomY)
    
    const confidence = Math.abs(correlation) * 100
    const prediction = intercept + slope * n
    
    let direction: TrendAnalysis['direction']
    let recommendation: string
    
    if (Math.abs(slope) < 0.1) {
      direction = 'stable'
      recommendation = 'Performance is stable. Continue current optimization strategies.'
    } else if (slope > 0) {
      if (selectedMetric === 'processingTime' || selectedMetric === 'memoryUsage' || selectedMetric === 'cpuUsage') {
        direction = 'declining'
        recommendation = 'Performance is declining. Consider reviewing recent parameter changes or optimizing mesh generation.'
      } else {
        direction = 'improving'
        recommendation = 'Performance is improving. Current optimization strategies are effective.'
      }
    } else {
      if (selectedMetric === 'processingTime' || selectedMetric === 'memoryUsage' || selectedMetric === 'cpuUsage') {
        direction = 'improving'
        recommendation = 'Performance is improving. Current optimization strategies are effective.'
      } else {
        direction = 'declining'
        recommendation = 'Quality metrics are declining. Review mesh generation parameters and quality settings.'
      }
    }
    
    return {
      direction,
      slope,
      correlation,
      confidence,
      prediction,
      recommendation
    }
  }, [selectedMetric])

  // Update chart data when dependencies change
  useEffect(() => {
    if (filteredResults.length === 0) {
      setChartData([])
      setTrendAnalysis(null)
      return
    }

    setIsLoading(true)
    
    setTimeout(() => {
      const data = convertToChartData(filteredResults, selectedMetric)
      setChartData(data)
      
      const trend = calculateTrend(data)
      setTrendAnalysis(trend)
      
      setIsLoading(false)
    }, 100)
  }, [filteredResults, selectedMetric, convertToChartData, calculateTrend])

  // Load comparison data
  useEffect(() => {
    if (!showComparison || !currentSession) {
      setComparisonData([])
      return
    }

    // Get previous session data for comparison
    const sessions = TestSessionService.getSessions()
    const sessionIndex = sessions.findIndex(s => s.id === currentSession.id)
    const previousSession = sessionIndex > 0 ? sessions[sessionIndex - 1] : null
    
    if (previousSession) {
      const compData = convertToChartData(previousSession.testResults, selectedMetric)
      setComparisonData(compData)
    }
  }, [showComparison, currentSession, selectedMetric, convertToChartData])

  // Toggle test selection
  const toggleTestSelection = useCallback((testId: string) => {
    setSelectedTests(prev => {
      const newSet = new Set(prev)
      if (newSet.has(testId)) {
        newSet.delete(testId)
      } else {
        newSet.add(testId)
      }
      return newSet
    })
  }, [])

  // Get metric statistics
  const getStatistics = useMemo(() => {
    if (chartData.length === 0) return null

    const values = chartData.map(d => d.value)
    const successfulValues = chartData.filter(d => d.metadata?.success).map(d => d.value)
    
    return {
      total: values.length,
      successful: successfulValues.length,
      average: values.reduce((sum, val) => sum + val, 0) / values.length,
      median: [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)],
      min: Math.min(...values),
      max: Math.max(...values),
      standardDeviation: Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - (values.reduce((s, v) => s + v, 0) / values.length), 2), 0) / values.length),
      successfulAverage: successfulValues.length > 0 
        ? successfulValues.reduce((sum, val) => sum + val, 0) / successfulValues.length 
        : 0
    }
  }, [chartData])

  // Render SVG chart
  const renderChart = () => {
    if (isLoading) {
      return (
        <div className={styles.loadingChart}>
          <div className={styles.spinner} />
          <span>Loading chart data...</span>
        </div>
      )
    }

    if (chartData.length === 0) {
      return (
        <div className={styles.noData}>
          <span>No data available for selected metric and time range</span>
        </div>
      )
    }

    const width = 600
    const height = chartHeight
    const margin = { top: 20, right: 30, bottom: 40, left: 60 }
    const chartWidth = width - margin.left - margin.right
    const chartHeight = height - margin.top - margin.bottom

    const values = chartData.map(d => d.value)
    const times = chartData.map(d => d.timestamp)
    
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    const valueRange = maxValue - minValue
    
    const minTime = Math.min(...times)
    const maxTime = Math.max(...times)
    const timeRange = maxTime - minTime

    const getX = (timestamp: number) => 
      timeRange > 0 ? ((timestamp - minTime) / timeRange) * chartWidth : chartWidth / 2
    
    const getY = (value: number) => 
      valueRange > 0 ? chartHeight - ((value - minValue) / valueRange) * chartHeight : chartHeight / 2

    return (
      <div className={styles.chartContainer}>
        <svg width={width} height={height} className={styles.chart}>
          {/* Chart area background */}
          <rect 
            x={margin.left} 
            y={margin.top} 
            width={chartWidth} 
            height={chartHeight}
            fill="#f8f9fa"
            stroke="#e0e0e0"
          />
          
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(ratio => (
            <g key={ratio}>
              <line
                x1={margin.left}
                y1={margin.top + ratio * chartHeight}
                x2={margin.left + chartWidth}
                y2={margin.top + ratio * chartHeight}
                stroke="#e0e0e0"
                strokeDasharray="2,2"
              />
              <text
                x={margin.left - 10}
                y={margin.top + ratio * chartHeight + 4}
                textAnchor="end"
                fontSize="10"
                fill="#656d76"
              >
                {(minValue + (1 - ratio) * valueRange).toFixed(1)}
              </text>
            </g>
          ))}

          {/* Comparison data (background) */}
          {showComparison && comparisonData.length > 1 && (
            <polyline
              points={comparisonData.map(d => 
                `${margin.left + getX(d.timestamp)},${margin.top + getY(d.value)}`
              ).join(' ')}
              fill="none"
              stroke="#d0d7de"
              strokeWidth="2"
              strokeDasharray="5,5"
              opacity="0.6"
            />
          )}

          {/* Main data line/area */}
          {chartType === 'area' && (
            <polygon
              points={[
                `${margin.left},${margin.top + chartHeight}`,
                ...chartData.map(d => 
                  `${margin.left + getX(d.timestamp)},${margin.top + getY(d.value)}`
                ),
                `${margin.left + chartWidth},${margin.top + chartHeight}`
              ].join(' ')}
              fill="#0969da"
              fillOpacity="0.1"
              stroke="none"
            />
          )}

          {chartType === 'line' || chartType === 'area' ? (
            <polyline
              points={chartData.map(d => 
                `${margin.left + getX(d.timestamp)},${margin.top + getY(d.value)}`
              ).join(' ')}
              fill="none"
              stroke="#0969da"
              strokeWidth="2"
            />
          ) : null}

          {/* Data points */}
          {chartData.map((d, index) => {
            const x = margin.left + getX(d.timestamp)
            const y = margin.top + getY(d.value)
            const isSelected = selectedTests.has(d.testId)
            const isSuccess = d.metadata?.success
            
            return (
              <g key={d.testId}>
                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? 6 : 4}
                  fill={isSuccess ? '#2da44e' : '#cf222e'}
                  stroke={isSelected ? '#0969da' : 'white'}
                  strokeWidth={isSelected ? 2 : 1}
                  className={styles.dataPoint}
                  onClick={() => toggleTestSelection(d.testId)}
                />
                {isSelected && (
                  <text
                    x={x}
                    y={y - 10}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#24292f"
                    className={styles.dataLabel}
                  >
                    {d.value.toFixed(1)}
                  </text>
                )}
              </g>
            )
          })}

          {/* Trend line */}
          {trendAnalysis && Math.abs(trendAnalysis.slope) > 0.1 && (
            <line
              x1={margin.left}
              y1={margin.top + getY(trendAnalysis.prediction - trendAnalysis.slope * chartData.length)}
              x2={margin.left + chartWidth}
              y2={margin.top + getY(trendAnalysis.prediction)}
              stroke="#fb8500"
              strokeWidth="2"
              strokeDasharray="3,3"
              opacity="0.7"
            />
          )}

          {/* X-axis labels */}
          {[0, 0.5, 1].map(ratio => {
            const timestamp = minTime + ratio * timeRange
            return (
              <text
                key={ratio}
                x={margin.left + ratio * chartWidth}
                y={height - 10}
                textAnchor="middle"
                fontSize="10"
                fill="#656d76"
              >
                {new Date(timestamp).toLocaleTimeString()}
              </text>
            )
          })}

          {/* Axis labels */}
          <text
            x={30}
            y={height / 2}
            textAnchor="middle"
            fontSize="12"
            fill="#24292f"
            transform={`rotate(-90, 30, ${height / 2})`}
          >
            {selectedMetric.replace(/([A-Z])/g, ' $1')}
          </text>
          <text
            x={width / 2}
            y={height - 5}
            textAnchor="middle"
            fontSize="12"
            fill="#24292f"
          >
            Time
          </text>
        </svg>
      </div>
    )
  }

  // Format metric value
  const formatValue = (value: number): string => {
    switch (selectedMetric) {
      case 'processingTime':
        return `${value.toFixed(1)}ms`
      case 'qualityScore':
        return value.toFixed(1)
      case 'memoryUsage':
        return `${value.toFixed(1)}MB`
      case 'cpuUsage':
        return `${value.toFixed(1)}%`
      case 'vertexCount':
      case 'faceCount':
        return value.toLocaleString()
      default:
        return value.toString()
    }
  }

  return (
    <div className={styles.performanceCharts}>
      <div className={styles.header}>
        <h3>Performance Analysis</h3>
        <div className={styles.controls}>
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value as MetricType)}
            className={styles.metricSelect}
          >
            <option value="processingTime">Processing Time</option>
            <option value="qualityScore">Quality Score</option>
            <option value="memoryUsage">Memory Usage</option>
            <option value="cpuUsage">CPU Usage</option>
            <option value="vertexCount">Vertex Count</option>
            <option value="faceCount">Face Count</option>
          </select>
          
          <select
            value={timeRange}
            onChange={(e) => setSelectedMetric(e.target.value as any)}
            className={styles.timeRangeSelect}
          >
            <option value="1h">Last Hour</option>
            <option value="1d">Last Day</option>
            <option value="1w">Last Week</option>
            <option value="1m">Last Month</option>
            <option value="all">All Time</option>
          </select>

          <label className={styles.comparisonToggle}>
            <input
              type="checkbox"
              checked={showComparison}
              onChange={(e) => setShowComparison(e.target.checked)}
            />
            Compare with previous
          </label>
        </div>
      </div>

      <div className={styles.content}>
        {renderChart()}
        
        {getStatistics && (
          <div className={styles.statistics}>
            <h4>Statistics</h4>
            <div className={styles.statsGrid}>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Total Tests</span>
                <span className={styles.statValue}>{getStatistics.total}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Successful</span>
                <span className={styles.statValue}>{getStatistics.successful}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Average</span>
                <span className={styles.statValue}>{formatValue(getStatistics.average)}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Best</span>
                <span className={styles.statValue}>
                  {formatValue(selectedMetric === 'processingTime' || selectedMetric === 'memoryUsage' || selectedMetric === 'cpuUsage' 
                    ? getStatistics.min 
                    : getStatistics.max)}
                </span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Median</span>
                <span className={styles.statValue}>{formatValue(getStatistics.median)}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Std Dev</span>
                <span className={styles.statValue}>{formatValue(getStatistics.standardDeviation)}</span>
              </div>
            </div>
          </div>
        )}

        {trendAnalysis && (
          <div className={styles.trendAnalysis}>
            <h4>Trend Analysis</h4>
            <div className={styles.trendInfo}>
              <div className={styles.trendDirection}>
                <span className={`${styles.trendIndicator} ${styles[trendAnalysis.direction]}`}>
                  {trendAnalysis.direction === 'improving' ? '📈' : 
                   trendAnalysis.direction === 'declining' ? '📉' : '➡️'}
                </span>
                <span className={styles.trendLabel}>
                  {trendAnalysis.direction.charAt(0).toUpperCase() + trendAnalysis.direction.slice(1)}
                </span>
                <span className={styles.trendConfidence}>
                  ({trendAnalysis.confidence.toFixed(1)}% confidence)
                </span>
              </div>
              <div className={styles.trendPrediction}>
                <span>Predicted next value: {formatValue(trendAnalysis.prediction)}</span>
              </div>
              <div className={styles.trendRecommendation}>
                {trendAnalysis.recommendation}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PerformanceCharts