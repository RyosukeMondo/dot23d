import React, { useState, useCallback } from 'react'
import type { 
  TestSession, 
  TestResult, 
  QualityReport, 
  TestSuiteResult,
  PerformanceMetrics 
} from '@/types'

export interface ReportTemplate {
  id: string
  name: string
  description: string
  sections: ReportSection[]
  format: 'html' | 'json' | 'csv' | 'markdown'
}

export interface ReportSection {
  id: string
  title: string
  type: 'summary' | 'performance' | 'quality' | 'detailed' | 'charts' | 'recommendations'
  includeCharts: boolean
  includeDetails: boolean
}

export interface ReportConfig {
  templateId: string
  includeSessions: string[]
  includeResults: string[]
  dateRange?: {
    start: Date
    end: Date
  }
  filters?: {
    minQualityScore?: number
    maxProcessingTime?: number
    patterns?: string[]
    authors?: string[]
  }
  customSections?: ReportSection[]
}

export interface GeneratedReport {
  id: string
  name: string
  generatedAt: Date
  format: string
  content: string
  downloadUrl?: string
  size: number
}

interface ReportGeneratorProps {
  sessions: TestSession[]
  results: TestResult[]
  qualityReports: QualityReport[]
  suiteResults?: TestSuiteResult[]
  onReportGenerated?: (report: GeneratedReport) => void
  className?: string
}

const DEFAULT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'comprehensive',
    name: 'Comprehensive Analysis Report',
    description: 'Complete overview with all metrics and detailed analysis',
    format: 'html',
    sections: [
      { id: 'summary', title: 'Executive Summary', type: 'summary', includeCharts: true, includeDetails: false },
      { id: 'performance', title: 'Performance Analysis', type: 'performance', includeCharts: true, includeDetails: true },
      { id: 'quality', title: 'Quality Assessment', type: 'quality', includeCharts: true, includeDetails: true },
      { id: 'detailed', title: 'Detailed Results', type: 'detailed', includeCharts: false, includeDetails: true },
      { id: 'recommendations', title: 'Recommendations', type: 'recommendations', includeCharts: false, includeDetails: true }
    ]
  },
  {
    id: 'performance',
    name: 'Performance Report',
    description: 'Focus on performance metrics and optimization opportunities',
    format: 'html',
    sections: [
      { id: 'perf-summary', title: 'Performance Summary', type: 'performance', includeCharts: true, includeDetails: false },
      { id: 'perf-trends', title: 'Performance Trends', type: 'performance', includeCharts: true, includeDetails: true },
      { id: 'perf-recommendations', title: 'Performance Recommendations', type: 'recommendations', includeCharts: false, includeDetails: true }
    ]
  },
  {
    id: 'quality',
    name: 'Quality Assessment Report',
    description: 'Detailed quality analysis with improvement suggestions',
    format: 'html',
    sections: [
      { id: 'qual-summary', title: 'Quality Overview', type: 'quality', includeCharts: true, includeDetails: false },
      { id: 'qual-detailed', title: 'Detailed Quality Analysis', type: 'quality', includeCharts: true, includeDetails: true },
      { id: 'qual-recommendations', title: 'Quality Improvements', type: 'recommendations', includeCharts: false, includeDetails: true }
    ]
  },
  {
    id: 'executive',
    name: 'Executive Summary',
    description: 'High-level overview for management and stakeholders',
    format: 'html',
    sections: [
      { id: 'exec-summary', title: 'Executive Summary', type: 'summary', includeCharts: true, includeDetails: false },
      { id: 'exec-recommendations', title: 'Key Recommendations', type: 'recommendations', includeCharts: false, includeDetails: false }
    ]
  },
  {
    id: 'data-export',
    name: 'Data Export',
    description: 'Raw data export for further analysis',
    format: 'json',
    sections: [
      { id: 'data-detailed', title: 'Complete Data', type: 'detailed', includeCharts: false, includeDetails: true }
    ]
  }
]

export const ReportGenerator: React.FC<ReportGeneratorProps> = ({
  sessions,
  results,
  qualityReports,
  suiteResults = [],
  onReportGenerated,
  className = ''
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<string>(DEFAULT_TEMPLATES[0].id)
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    templateId: DEFAULT_TEMPLATES[0].id,
    includeSessions: sessions.map(s => s.id),
    includeResults: results.map(r => r.id)
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([])
  const [scheduleConfig, setScheduleConfig] = useState({
    enabled: false,
    frequency: 'weekly' as 'daily' | 'weekly' | 'monthly',
    time: '09:00',
    recipients: [] as string[]
  })

  const generateReport = useCallback(async () => {
    setIsGenerating(true)
    
    try {
      const template = DEFAULT_TEMPLATES.find(t => t.id === reportConfig.templateId)
      if (!template) {
        throw new Error('Template not found')
      }

      // Filter data based on configuration
      const filteredSessions = sessions.filter(session => 
        reportConfig.includeSessions.includes(session.id)
      )
      
      const filteredResults = results.filter(result => 
        reportConfig.includeResults.includes(result.id) &&
        (!reportConfig.filters?.minQualityScore || result.qualityScore >= reportConfig.filters.minQualityScore) &&
        (!reportConfig.filters?.maxProcessingTime || result.processingTime <= reportConfig.filters.maxProcessingTime)
      )

      let content: string

      switch (template.format) {
        case 'html':
          content = generateHTMLReport(template, filteredSessions, filteredResults, qualityReports)
          break
        case 'json':
          content = generateJSONReport(template, filteredSessions, filteredResults, qualityReports)
          break
        case 'csv':
          content = generateCSVReport(template, filteredSessions, filteredResults)
          break
        case 'markdown':
          content = generateMarkdownReport(template, filteredSessions, filteredResults, qualityReports)
          break
        default:
          throw new Error('Unsupported format')
      }

      const report: GeneratedReport = {
        id: `report_${Date.now()}`,
        name: `${template.name} - ${new Date().toLocaleDateString()}`,
        generatedAt: new Date(),
        format: template.format,
        content,
        size: new Blob([content]).size
      }

      // Create download URL
      const blob = new Blob([content], { 
        type: template.format === 'html' ? 'text/html' : 
              template.format === 'json' ? 'application/json' : 'text/plain'
      })
      report.downloadUrl = URL.createObjectURL(blob)

      setGeneratedReports(prev => [report, ...prev.slice(0, 9)]) // Keep last 10 reports
      onReportGenerated?.(report)

    } catch (error) {
      console.error('Failed to generate report:', error)
      alert('Failed to generate report: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsGenerating(false)
    }
  }, [reportConfig, sessions, results, qualityReports, onReportGenerated])

  const generateHTMLReport = (
    template: ReportTemplate, 
    sessions: TestSession[], 
    results: TestResult[], 
    qualityReports: QualityReport[]
  ): string => {
    const styles = `
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; margin: 40px; line-height: 1.6; color: #333; }
        .header { border-bottom: 3px solid #007bff; padding-bottom: 20px; margin-bottom: 30px; }
        .title { color: #007bff; margin: 0; font-size: 2.5em; }
        .subtitle { color: #666; margin: 5px 0 0 0; }
        .section { margin: 30px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; }
        .section h2 { color: #007bff; border-bottom: 2px solid #dee2e6; padding-bottom: 10px; }
        .metric { display: inline-block; margin: 10px; padding: 15px; background: white; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric-label { font-size: 0.9em; color: #666; }
        .metric-value { font-size: 1.5em; font-weight: bold; color: #007bff; }
        .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6; }
        .table th { background-color: #007bff; color: white; }
        .success { color: #28a745; } .warning { color: #ffc107; } .danger { color: #dc3545; }
        .chart-placeholder { height: 300px; background: #e9ecef; border-radius: 5px; display: flex; align-items: center; justify-content: center; color: #6c757d; }
      </style>
    `

    let htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${template.name}</title>
        ${styles}
      </head>
      <body>
        <div class="header">
          <h1 class="title">${template.name}</h1>
          <p class="subtitle">Generated on ${new Date().toLocaleString()}</p>
        </div>
    `

    // Generate content for each section
    for (const section of template.sections) {
      htmlContent += `<div class="section">`
      htmlContent += `<h2>${section.title}</h2>`

      switch (section.type) {
        case 'summary':
          htmlContent += generateSummarySection(sessions, results)
          break
        case 'performance':
          htmlContent += generatePerformanceSection(results, section.includeCharts)
          break
        case 'quality':
          htmlContent += generateQualitySection(qualityReports, results, section.includeCharts)
          break
        case 'detailed':
          htmlContent += generateDetailedSection(results)
          break
        case 'recommendations':
          htmlContent += generateRecommendationsSection(qualityReports, results)
          break
      }

      htmlContent += `</div>`
    }

    htmlContent += `
        </body>
      </html>
    `

    return htmlContent
  }

  const generateSummarySection = (sessions: TestSession[], results: TestResult[]): string => {
    const successRate = results.length > 0 ? (results.filter(r => r.success).length / results.length * 100) : 0
    const avgQuality = results.length > 0 ? results.reduce((sum, r) => sum + r.qualityScore, 0) / results.length : 0
    const avgProcessingTime = results.length > 0 ? results.reduce((sum, r) => sum + r.processingTime, 0) / results.length : 0

    return `
      <div class="metric">
        <div class="metric-label">Total Sessions</div>
        <div class="metric-value">${sessions.length}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Total Tests</div>
        <div class="metric-value">${results.length}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Success Rate</div>
        <div class="metric-value ${successRate >= 90 ? 'success' : successRate >= 70 ? 'warning' : 'danger'}">${successRate.toFixed(1)}%</div>
      </div>
      <div class="metric">
        <div class="metric-label">Average Quality Score</div>
        <div class="metric-value ${avgQuality >= 80 ? 'success' : avgQuality >= 60 ? 'warning' : 'danger'}">${avgQuality.toFixed(1)}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Average Processing Time</div>
        <div class="metric-value">${avgProcessingTime.toFixed(0)}ms</div>
      </div>
    `
  }

  const generatePerformanceSection = (results: TestResult[], includeCharts: boolean): string => {
    let content = '<h3>Performance Metrics</h3>'
    
    if (includeCharts) {
      content += '<div class="chart-placeholder">Performance charts would be rendered here with Chart.js integration</div>'
    }

    const performanceStats = calculatePerformanceStats(results)
    content += `
      <h4>Processing Time Statistics</h4>
      <ul>
        <li>Minimum: ${performanceStats.processingTime.min}ms</li>
        <li>Maximum: ${performanceStats.processingTime.max}ms</li>
        <li>Average: ${performanceStats.processingTime.avg}ms</li>
        <li>95th Percentile: ${performanceStats.processingTime.p95}ms</li>
      </ul>
    `

    return content
  }

  const generateQualitySection = (qualityReports: QualityReport[], results: TestResult[], includeCharts: boolean): string => {
    let content = '<h3>Quality Analysis</h3>'

    if (includeCharts) {
      content += '<div class="chart-placeholder">Quality distribution charts would be rendered here</div>'
    }

    const qualityStats = calculateQualityStats(results)
    content += `
      <h4>Quality Score Distribution</h4>
      <ul>
        <li>Excellent (90-100): ${qualityStats.excellent} tests</li>
        <li>Good (70-89): ${qualityStats.good} tests</li>
        <li>Fair (50-69): ${qualityStats.fair} tests</li>
        <li>Poor (<50): ${qualityStats.poor} tests</li>
      </ul>
    `

    return content
  }

  const generateDetailedSection = (results: TestResult[]): string => {
    let content = '<h3>Detailed Test Results</h3>'
    content += `
      <table class="table">
        <thead>
          <tr>
            <th>Test ID</th>
            <th>Pattern</th>
            <th>Success</th>
            <th>Processing Time</th>
            <th>Quality Score</th>
            <th>Mesh Stats</th>
          </tr>
        </thead>
        <tbody>
    `

    for (const result of results.slice(0, 50)) { // Limit to 50 results
      content += `
        <tr>
          <td>${result.id}</td>
          <td>${result.pattern.name || 'Unnamed'}</td>
          <td class="${result.success ? 'success' : 'danger'}">${result.success ? 'Success' : 'Failed'}</td>
          <td>${result.processingTime}ms</td>
          <td class="${result.qualityScore >= 80 ? 'success' : result.qualityScore >= 60 ? 'warning' : 'danger'}">${result.qualityScore.toFixed(1)}</td>
          <td>${result.meshStats.vertexCount} vertices, ${result.meshStats.faceCount} faces</td>
        </tr>
      `
    }

    content += '</tbody></table>'
    return content
  }

  const generateRecommendationsSection = (qualityReports: QualityReport[], results: TestResult[]): string => {
    let content = '<h3>Key Recommendations</h3><ul>'

    // Generate recommendations based on data analysis
    const failedTests = results.filter(r => !r.success)
    if (failedTests.length > 0) {
      content += `<li><strong>Test Reliability:</strong> ${failedTests.length} tests failed. Review error patterns and improve input validation.</li>`
    }

    const lowQualityTests = results.filter(r => r.qualityScore < 60)
    if (lowQualityTests.length > 0) {
      content += `<li><strong>Quality Improvement:</strong> ${lowQualityTests.length} tests had quality scores below 60. Consider parameter optimization.</li>`
    }

    const slowTests = results.filter(r => r.processingTime > 10000) // > 10 seconds
    if (slowTests.length > 0) {
      content += `<li><strong>Performance Optimization:</strong> ${slowTests.length} tests took longer than 10 seconds. Review algorithm efficiency.</li>`
    }

    content += '</ul>'
    return content
  }

  const generateJSONReport = (template: ReportTemplate, sessions: TestSession[], results: TestResult[], qualityReports: QualityReport[]): string => {
    const reportData = {
      metadata: {
        templateId: template.id,
        templateName: template.name,
        generatedAt: new Date().toISOString(),
        dataRange: {
          sessions: sessions.length,
          results: results.length,
          qualityReports: qualityReports.length
        }
      },
      summary: {
        totalSessions: sessions.length,
        totalTests: results.length,
        successRate: results.length > 0 ? results.filter(r => r.success).length / results.length : 0,
        averageQualityScore: results.length > 0 ? results.reduce((sum, r) => sum + r.qualityScore, 0) / results.length : 0,
        averageProcessingTime: results.length > 0 ? results.reduce((sum, r) => sum + r.processingTime, 0) / results.length : 0
      },
      sessions: sessions,
      results: results,
      qualityReports: qualityReports,
      statistics: {
        performance: calculatePerformanceStats(results),
        quality: calculateQualityStats(results)
      }
    }

    return JSON.stringify(reportData, null, 2)
  }

  const generateCSVReport = (template: ReportTemplate, sessions: TestSession[], results: TestResult[]): string => {
    let csv = 'Test ID,Session ID,Pattern Name,Success,Processing Time (ms),Quality Score,Vertex Count,Face Count,Surface Area,Volume\n'
    
    for (const result of results) {
      csv += [
        result.id,
        result.testSessionId,
        result.pattern.name || 'Unnamed',
        result.success,
        result.processingTime,
        result.qualityScore,
        result.meshStats.vertexCount,
        result.meshStats.faceCount,
        result.meshStats.surfaceArea,
        result.meshStats.volume
      ].join(',') + '\n'
    }

    return csv
  }

  const generateMarkdownReport = (template: ReportTemplate, sessions: TestSession[], results: TestResult[], qualityReports: QualityReport[]): string => {
    let md = `# ${template.name}\n\n`
    md += `Generated on: ${new Date().toLocaleString()}\n\n`

    // Summary section
    const successRate = results.length > 0 ? (results.filter(r => r.success).length / results.length * 100) : 0
    const avgQuality = results.length > 0 ? results.reduce((sum, r) => sum + r.qualityScore, 0) / results.length : 0

    md += `## Summary\n\n`
    md += `- **Total Sessions**: ${sessions.length}\n`
    md += `- **Total Tests**: ${results.length}\n`
    md += `- **Success Rate**: ${successRate.toFixed(1)}%\n`
    md += `- **Average Quality Score**: ${avgQuality.toFixed(1)}\n\n`

    // Add other sections as needed
    md += `## Performance Statistics\n\n`
    const perfStats = calculatePerformanceStats(results)
    md += `- **Min Processing Time**: ${perfStats.processingTime.min}ms\n`
    md += `- **Max Processing Time**: ${perfStats.processingTime.max}ms\n`
    md += `- **Average Processing Time**: ${perfStats.processingTime.avg}ms\n\n`

    return md
  }

  const calculatePerformanceStats = (results: TestResult[]) => {
    if (results.length === 0) {
      return { processingTime: { min: 0, max: 0, avg: 0, p95: 0 } }
    }

    const times = results.map(r => r.processingTime).sort((a, b) => a - b)
    const p95Index = Math.floor(times.length * 0.95)

    return {
      processingTime: {
        min: times[0],
        max: times[times.length - 1],
        avg: times.reduce((sum, t) => sum + t, 0) / times.length,
        p95: times[p95Index] || 0
      }
    }
  }

  const calculateQualityStats = (results: TestResult[]) => {
    return {
      excellent: results.filter(r => r.qualityScore >= 90).length,
      good: results.filter(r => r.qualityScore >= 70 && r.qualityScore < 90).length,
      fair: results.filter(r => r.qualityScore >= 50 && r.qualityScore < 70).length,
      poor: results.filter(r => r.qualityScore < 50).length
    }
  }

  const downloadReport = (report: GeneratedReport) => {
    if (report.downloadUrl) {
      const a = document.createElement('a')
      a.href = report.downloadUrl
      a.download = `${report.name.replace(/[^a-z0-9]/gi, '_')}.${report.format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  const deleteReport = (reportId: string) => {
    setGeneratedReports(prev => {
      const updated = prev.filter(r => r.id !== reportId)
      // Clean up blob URLs
      const deleted = prev.find(r => r.id === reportId)
      if (deleted?.downloadUrl) {
        URL.revokeObjectURL(deleted.downloadUrl)
      }
      return updated
    })
  }

  return (
    <div className={`report-generator ${className}`}>
      <div className="report-config">
        <h3>Report Configuration</h3>
        
        {/* Template Selection */}
        <div className="config-section">
          <label htmlFor="template-select">Report Template:</label>
          <select 
            id="template-select"
            value={selectedTemplate}
            onChange={(e) => {
              setSelectedTemplate(e.target.value)
              setReportConfig(prev => ({ ...prev, templateId: e.target.value }))
            }}
          >
            {DEFAULT_TEMPLATES.map(template => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          <p className="template-description">
            {DEFAULT_TEMPLATES.find(t => t.id === selectedTemplate)?.description}
          </p>
        </div>

        {/* Session Selection */}
        <div className="config-section">
          <label>Include Sessions:</label>
          <div className="session-checkboxes">
            {sessions.map(session => (
              <label key={session.id} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={reportConfig.includeSessions.includes(session.id)}
                  onChange={(e) => {
                    setReportConfig(prev => ({
                      ...prev,
                      includeSessions: e.target.checked 
                        ? [...prev.includeSessions, session.id]
                        : prev.includeSessions.filter(id => id !== session.id)
                    }))
                  }}
                />
                {session.name} ({session.testResults.length} tests)
              </label>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="config-section">
          <label>Filters:</label>
          <div className="filters">
            <div className="filter-row">
              <label>Min Quality Score:</label>
              <input
                type="number"
                min="0"
                max="100"
                value={reportConfig.filters?.minQualityScore || ''}
                onChange={(e) => {
                  const value = e.target.value ? parseInt(e.target.value) : undefined
                  setReportConfig(prev => ({
                    ...prev,
                    filters: { ...prev.filters, minQualityScore: value }
                  }))
                }}
              />
            </div>
            <div className="filter-row">
              <label>Max Processing Time (ms):</label>
              <input
                type="number"
                min="0"
                value={reportConfig.filters?.maxProcessingTime || ''}
                onChange={(e) => {
                  const value = e.target.value ? parseInt(e.target.value) : undefined
                  setReportConfig(prev => ({
                    ...prev,
                    filters: { ...prev.filters, maxProcessingTime: value }
                  }))
                }}
              />
            </div>
          </div>
        </div>

        {/* Generation Controls */}
        <div className="config-section">
          <button
            onClick={generateReport}
            disabled={isGenerating || reportConfig.includeSessions.length === 0}
            className="generate-btn"
          >
            {isGenerating ? 'Generating Report...' : 'Generate Report'}
          </button>
        </div>

        {/* Automated Scheduling */}
        <div className="config-section">
          <h4>Automated Scheduling</h4>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={scheduleConfig.enabled}
              onChange={(e) => setScheduleConfig(prev => ({ ...prev, enabled: e.target.checked }))}
            />
            Enable Automated Reports
          </label>
          
          {scheduleConfig.enabled && (
            <div className="schedule-config">
              <div className="schedule-row">
                <label>Frequency:</label>
                <select 
                  value={scheduleConfig.frequency}
                  onChange={(e) => setScheduleConfig(prev => ({ 
                    ...prev, 
                    frequency: e.target.value as 'daily' | 'weekly' | 'monthly' 
                  }))}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="schedule-row">
                <label>Time:</label>
                <input
                  type="time"
                  value={scheduleConfig.time}
                  onChange={(e) => setScheduleConfig(prev => ({ ...prev, time: e.target.value }))}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Generated Reports */}
      <div className="generated-reports">
        <h3>Generated Reports</h3>
        {generatedReports.length === 0 ? (
          <p className="no-reports">No reports generated yet.</p>
        ) : (
          <div className="reports-list">
            {generatedReports.map(report => (
              <div key={report.id} className="report-item">
                <div className="report-info">
                  <h4>{report.name}</h4>
                  <p>Generated: {report.generatedAt.toLocaleString()}</p>
                  <p>Format: {report.format.toUpperCase()} | Size: {(report.size / 1024).toFixed(1)} KB</p>
                </div>
                <div className="report-actions">
                  <button onClick={() => downloadReport(report)} className="download-btn">
                    Download
                  </button>
                  <button onClick={() => deleteReport(report.id)} className="delete-btn">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .report-generator {
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding: 20px;
        }

        .report-config {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 20px;
        }

        .config-section {
          margin-bottom: 20px;
        }

        .config-section label {
          display: block;
          font-weight: 600;
          margin-bottom: 5px;
          color: #333;
        }

        .config-section select,
        .config-section input {
          width: 100%;
          max-width: 300px;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }

        .template-description {
          font-size: 0.9em;
          color: #666;
          margin-top: 5px;
        }

        .session-checkboxes {
          display: flex;
          flex-direction: column;
          gap: 5px;
          max-height: 150px;
          overflow-y: auto;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 10px;
          background: white;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: normal;
        }

        .checkbox-label input[type="checkbox"] {
          width: auto;
        }

        .filters {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .filter-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .filter-row label {
          min-width: 150px;
          margin: 0;
        }

        .filter-row input {
          max-width: 150px;
        }

        .generate-btn {
          background: #007bff;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          font-size: 16px;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .generate-btn:hover:not(:disabled) {
          background: #0056b3;
        }

        .generate-btn:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }

        .schedule-config {
          margin-top: 10px;
          padding: 15px;
          background: white;
          border-radius: 4px;
          border: 1px solid #ddd;
        }

        .schedule-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }

        .schedule-row label {
          min-width: 80px;
          margin: 0;
        }

        .generated-reports {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 20px;
        }

        .reports-list {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .report-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: white;
          padding: 15px;
          border-radius: 6px;
          border: 1px solid #ddd;
        }

        .report-info h4 {
          margin: 0 0 5px 0;
          color: #333;
        }

        .report-info p {
          margin: 2px 0;
          font-size: 0.9em;
          color: #666;
        }

        .report-actions {
          display: flex;
          gap: 10px;
        }

        .download-btn {
          background: #28a745;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }

        .download-btn:hover {
          background: #218838;
        }

        .delete-btn {
          background: #dc3545;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }

        .delete-btn:hover {
          background: #c82333;
        }

        .no-reports {
          color: #666;
          font-style: italic;
        }
      `}</style>
    </div>
  )
}

export default ReportGenerator