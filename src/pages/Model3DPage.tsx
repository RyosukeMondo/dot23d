import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { Model3D } from '@/components/Model3D'
import { ModelViewer } from '@/components/ModelViewer'
import { DotArtService } from '@/services/DotArtService'
import { Model3DService } from '@/services/Model3DService'
import type { DotPattern, Model3DParams, ExportParams } from '@/types'

interface Model3DTest {
  id: string
  name: string
  pattern: DotPattern
  timestamp: Date
  params: Model3DParams
  processingTime: number
  meshStats: {
    vertices: number
    faces: number
    optimized: boolean
    fileSize: number
  }
  success: boolean
  errorMessage?: string
  notes?: string
}

interface GenerationBenchmark {
  patternSize: string
  activeDots: number
  generationTime: number
  optimizationTime: number
  exportTime: number
  memoryUsage: number
}

export const Model3DPage: React.FC = () => {
  const [testPattern, setTestPattern] = useState<DotPattern | null>(null)
  const [model3DTests, setModel3DTests] = useState<Model3DTest[]>([])
  const [currentTest, setCurrentTest] = useState<Model3DTest | null>(null)
  const [isBenchmarking, setIsBenchmarking] = useState(false)
  const [benchmarkResults, setBenchmarkResults] = useState<GenerationBenchmark[]>([])
  
  // Test pattern presets for different scenarios
  const [testPatterns] = useState<Array<{
    name: string
    description: string
    generator: () => DotPattern
  }>>([
    {
      name: "Simple 5×5 Grid",
      description: "Basic small pattern for quick testing",
      generator: () => ({
        width: 5,
        height: 5,
        data: [
          [true, false, true, false, true],
          [false, true, true, true, false],
          [true, true, true, true, true],
          [false, true, true, true, false],
          [true, false, true, false, true]
        ],
        metadata: {
          filename: 'test-5x5.csv',
          originalDimensions: { width: 5, height: 5 }
        }
      })
    },
    {
      name: "Complex 20×20 Checkerboard",
      description: "Medium complexity pattern with high optimization potential",
      generator: () => {
        const data: boolean[][] = []
        for (let y = 0; y < 20; y++) {
          const row: boolean[] = []
          for (let x = 0; x < 20; x++) {
            row.push((x + y) % 2 === 0)
          }
          data.push(row)
        }
        return {
          width: 20,
          height: 20,
          data,
          metadata: {
            filename: 'checkerboard-20x20.csv',
            originalDimensions: { width: 20, height: 20 }
          }
        }
      }
    },
    {
      name: "Large 50×50 Spiral",
      description: "Large pattern for performance testing",
      generator: () => {
        const data: boolean[][] = Array.from({ length: 50 }, () => Array(50).fill(false))
        const centerX = 25, centerY = 25
        let x = centerX, y = centerY
        let dx = 0, dy = -1
        
        for (let i = 0; i < 2500; i++) {
          if (x >= 0 && x < 50 && y >= 0 && y < 50) {
            data[y][x] = i % 3 !== 0 // Creates gaps in the spiral
          }
          
          if (x === y || (x < 0 && x === -y) || (x > 0 && x === 1 - y)) {
            [dx, dy] = [-dy, dx]
          }
          
          x += dx
          y += dy
        }
        
        return {
          width: 50,
          height: 50,
          data,
          metadata: {
            filename: 'spiral-50x50.csv',
            originalDimensions: { width: 50, height: 50 }
          }
        }
      }
    },
    {
      name: "Edge Case: Single Dot",
      description: "Minimal pattern for edge case testing",
      generator: () => ({
        width: 1,
        height: 1,
        data: [[true]],
        metadata: {
          filename: 'single-dot.csv',
          originalDimensions: { width: 1, height: 1 }
        }
      })
    },
    {
      name: "Performance Test: 100×100 Random",
      description: "Large random pattern for stress testing",
      generator: () => {
        const data: boolean[][] = []
        for (let y = 0; y < 100; y++) {
          const row: boolean[] = []
          for (let x = 0; x < 100; x++) {
            row.push(Math.random() > 0.6) // 40% density
          }
          data.push(row)
        }
        return {
          width: 100,
          height: 100,
          data,
          metadata: {
            filename: 'random-100x100.csv',
            originalDimensions: { width: 100, height: 100 }
          }
        }
      }
    }
  ])

  // Test parameter presets for different optimization scenarios
  const [parameterPresets] = useState<Array<{
    name: string
    description: string
    params: Partial<Model3DParams>
  }>>([
    {
      name: "High Quality",
      description: "Maximum quality settings for detailed models",
      params: {
        cubeSize: 2.0,
        cubeHeight: 2.0,
        spacing: 0.1,
        optimizeMesh: true,
        mergeAdjacentFaces: true,
        chamferEdges: true,
        chamferSize: 0.1,
        generateBase: true,
        baseThickness: 1.0
      }
    },
    {
      name: "Fast Generation",
      description: "Optimized for speed, minimal processing",
      params: {
        cubeSize: 1.5,
        cubeHeight: 1.5,
        spacing: 0.05,
        optimizeMesh: false,
        mergeAdjacentFaces: false,
        chamferEdges: false,
        generateBase: true,
        baseThickness: 0.5
      }
    },
    {
      name: "Print Optimized",
      description: "Best settings for 3D printing success",
      params: {
        cubeSize: 1.8,
        cubeHeight: 2.5,
        spacing: 0.2,
        optimizeMesh: true,
        mergeAdjacentFaces: true,
        chamferEdges: true,
        chamferSize: 0.15,
        generateBase: true,
        baseThickness: 2.0
      }
    },
    {
      name: "Minimal File Size",
      description: "Maximum optimization for smallest file size",
      params: {
        cubeSize: 1.0,
        cubeHeight: 1.0,
        spacing: 0.0,
        optimizeMesh: true,
        mergeAdjacentFaces: true,
        chamferEdges: false,
        generateBase: false
      }
    }
  ])

  const loadTestPattern = useCallback((patternGenerator: () => DotPattern) => {
    try {
      const pattern = patternGenerator()
      setTestPattern(pattern)
    } catch (error) {
      console.error('Failed to generate test pattern:', error)
    }
  }, [])

  const runGenerationTest = useCallback(async (
    pattern: DotPattern, 
    params: Model3DParams, 
    testName: string
  ) => {
    const startTime = performance.now()
    
    try {
      const testId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      // Simulate mesh generation with timing
      const mesh = Model3DService.generateMesh(pattern, params)
      const meshStats = Model3DService.getMeshStats(mesh)
      
      // Calculate approximate file size
      const approximateFileSize = meshStats.vertexCount * 50 + meshStats.faceCount * 30 // Rough OBJ size estimation
      
      const processingTime = performance.now() - startTime
      
      const test: Model3DTest = {
        id: testId,
        name: testName,
        pattern,
        timestamp: new Date(),
        params,
        processingTime,
        meshStats: {
          vertices: meshStats.vertexCount,
          faces: meshStats.faceCount,
          optimized: params.optimizeMesh || false,
          fileSize: approximateFileSize
        },
        success: true,
        notes: `Generated in ${processingTime.toFixed(2)}ms`
      }
      
      setModel3DTests(prev => [test, ...prev])
      setCurrentTest(test)
      
      return test
    } catch (error) {
      const processingTime = performance.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      const test: Model3DTest = {
        id: `test-error-${Date.now()}`,
        name: testName,
        pattern,
        timestamp: new Date(),
        params,
        processingTime,
        meshStats: {
          vertices: 0,
          faces: 0,
          optimized: false,
          fileSize: 0
        },
        success: false,
        errorMessage,
        notes: `Failed after ${processingTime.toFixed(2)}ms`
      }
      
      setModel3DTests(prev => [test, ...prev])
      return test
    }
  }, [])

  const runBenchmarkSuite = useCallback(async () => {
    setIsBenchmarking(true)
    setBenchmarkResults([])
    
    try {
      const benchmarks: GenerationBenchmark[] = []
      
      // Test different pattern sizes with standardized parameters
      const standardParams = Model3DService.getDefault3DParams()
      standardParams.optimizeMesh = true
      standardParams.mergeAdjacentFaces = true
      
      for (const patternInfo of testPatterns) {
        const pattern = patternInfo.generator()
        const activeDots = pattern.data.flat().filter(Boolean).length
        
        // Generation timing
        const genStart = performance.now()
        const mesh = Model3DService.generateMesh(pattern, standardParams)
        const genTime = performance.now() - genStart
        
        // Optimization timing (simulate)
        const optStart = performance.now()
        // Simulate optimization work
        await new Promise(resolve => setTimeout(resolve, Math.min(100, activeDots / 10)))
        const optTime = performance.now() - optStart
        
        // Export timing
        const exportStart = performance.now()
        const exportParams = Model3DService.getDefaultExportParams()
        Model3DService.exportOBJ(mesh, exportParams)
        const exportTime = performance.now() - exportStart
        
        // Estimate memory usage
        const meshStats = Model3DService.getMeshStats(mesh)
        const estimatedMemory = (meshStats.vertexCount * 12 + meshStats.faceCount * 36) / 1024 // KB
        
        benchmarks.push({
          patternSize: `${pattern.width}×${pattern.height}`,
          activeDots,
          generationTime: genTime,
          optimizationTime: optTime,
          exportTime: exportTime,
          memoryUsage: estimatedMemory
        })
        
        // Update UI progressively
        setBenchmarkResults([...benchmarks])
        
        // Small delay to prevent UI blocking
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      
    } catch (error) {
      console.error('Benchmark suite failed:', error)
    } finally {
      setIsBenchmarking(false)
    }
  }, [testPatterns])

  const handleExportComplete = useCallback((blob: Blob, filename: string) => {
    // Simulate export validation
    console.log(`Export completed: ${filename}, Size: ${blob.size} bytes`)
    
    // Update current test with export info
    if (currentTest) {
      setModel3DTests(prev => prev.map(test => 
        test.id === currentTest.id 
          ? { 
              ...test, 
              notes: `${test.notes || ''} | Exported: ${filename} (${(blob.size / 1024).toFixed(1)}KB)`
            }
          : test
      ))
    }
  }, [currentTest])

  const handleError = useCallback((error: string) => {
    console.error('3D Generation Error:', error)
  }, [])

  // Calculate summary statistics
  const testStatistics = useMemo(() => {
    const successfulTests = model3DTests.filter(test => test.success)
    const avgProcessingTime = successfulTests.length > 0 
      ? successfulTests.reduce((sum, test) => sum + test.processingTime, 0) / successfulTests.length
      : 0
    
    const avgVertices = successfulTests.length > 0
      ? successfulTests.reduce((sum, test) => sum + test.meshStats.vertices, 0) / successfulTests.length
      : 0

    return {
      totalTests: model3DTests.length,
      successfulTests: successfulTests.length,
      failedTests: model3DTests.length - successfulTests.length,
      avgProcessingTime: avgProcessingTime.toFixed(2),
      avgVertices: Math.round(avgVertices)
    }
  }, [model3DTests])

  return (
    <div className="model-3d-page">
      <div className="page-header">
        <h1>3D Model Generation Testing</h1>
        <p>
          Test and validate 3D model generation, mesh optimization, and export functionality
        </p>
      </div>

      {/* Test Pattern Selection */}
      <div className="test-patterns-section">
        <h2>Test Patterns</h2>
        <div className="pattern-grid">
          {testPatterns.map((patternInfo, index) => (
            <div key={index} className="pattern-card">
              <h4>{patternInfo.name}</h4>
              <p>{patternInfo.description}</p>
              <button 
                onClick={() => loadTestPattern(patternInfo.generator)}
                className="load-pattern-btn"
              >
                Load Pattern
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Parameter Testing */}
      {testPattern && (
        <div className="parameter-testing-section">
          <h2>Parameter Testing</h2>
          <div className="current-pattern">
            <h4>Current Pattern: {testPattern.width}×{testPattern.height}</h4>
            <p>Active Dots: {testPattern.data.flat().filter(Boolean).length}</p>
          </div>
          
          <div className="preset-grid">
            {parameterPresets.map((preset, index) => (
              <div key={index} className="preset-card">
                <h4>{preset.name}</h4>
                <p>{preset.description}</p>
                <button 
                  onClick={() => {
                    const fullParams = { ...Model3DService.getDefault3DParams(), ...preset.params }
                    runGenerationTest(testPattern, fullParams, `${preset.name} - ${testPattern.width}×${testPattern.height}`)
                  }}
                  className="run-test-btn"
                >
                  Run Test
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Benchmarking */}
      <div className="benchmarking-section">
        <h2>Performance Benchmarking</h2>
        <button 
          onClick={runBenchmarkSuite}
          disabled={isBenchmarking}
          className="benchmark-btn"
        >
          {isBenchmarking ? 'Running Benchmarks...' : 'Run Benchmark Suite'}
        </button>

        {benchmarkResults.length > 0 && (
          <div className="benchmark-results">
            <table className="benchmark-table">
              <thead>
                <tr>
                  <th>Pattern Size</th>
                  <th>Active Dots</th>
                  <th>Generation Time (ms)</th>
                  <th>Optimization Time (ms)</th>
                  <th>Export Time (ms)</th>
                  <th>Memory Usage (KB)</th>
                </tr>
              </thead>
              <tbody>
                {benchmarkResults.map((result, index) => (
                  <tr key={index}>
                    <td>{result.patternSize}</td>
                    <td>{result.activeDots.toLocaleString()}</td>
                    <td>{result.generationTime.toFixed(2)}</td>
                    <td>{result.optimizationTime.toFixed(2)}</td>
                    <td>{result.exportTime.toFixed(2)}</td>
                    <td>{result.memoryUsage.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Test Results */}
      <div className="test-results-section">
        <h2>Test Results</h2>
        
        {/* Statistics Summary */}
        <div className="test-statistics">
          <div className="stat-item">
            <span className="stat-label">Total Tests:</span>
            <span className="stat-value">{testStatistics.totalTests}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Successful:</span>
            <span className="stat-value success">{testStatistics.successfulTests}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Failed:</span>
            <span className="stat-value error">{testStatistics.failedTests}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Avg Time:</span>
            <span className="stat-value">{testStatistics.avgProcessingTime}ms</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Avg Vertices:</span>
            <span className="stat-value">{testStatistics.avgVertices}</span>
          </div>
        </div>

        {/* Test History */}
        <div className="test-history">
          {model3DTests.map((test) => (
            <div 
              key={test.id} 
              className={`test-result-card ${test.success ? 'success' : 'error'}`}
              onClick={() => setCurrentTest(test)}
            >
              <div className="test-header">
                <h4>{test.name}</h4>
                <span className="test-time">{test.timestamp.toLocaleTimeString()}</span>
              </div>
              <div className="test-details">
                <span>Pattern: {test.pattern.width}×{test.pattern.height}</span>
                <span>Time: {test.processingTime.toFixed(2)}ms</span>
                {test.success ? (
                  <span>Vertices: {test.meshStats.vertices.toLocaleString()}</span>
                ) : (
                  <span className="error-text">{test.errorMessage}</span>
                )}
              </div>
              {test.notes && (
                <div className="test-notes">{test.notes}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Live 3D Testing */}
      {testPattern && (
        <div className="live-testing-section">
          <h2>Live 3D Model Testing</h2>
          <div className="live-testing-container">
            <Model3D
              pattern={testPattern}
              onExportComplete={handleExportComplete}
              onError={handleError}
            />
          </div>
        </div>
      )}

      <div className="page-help">
        <h3>Usage Instructions</h3>
        <ul>
          <li><strong>Test Patterns:</strong> Load different pattern types to test various scenarios</li>
          <li><strong>Parameter Testing:</strong> Try different optimization presets to see their effects</li>
          <li><strong>Benchmarking:</strong> Run comprehensive performance tests across all patterns</li>
          <li><strong>Live Testing:</strong> Interact with the actual 3D generation components</li>
          <li><strong>Export Validation:</strong> Test OBJ file generation and download functionality</li>
        </ul>
      </div>

      <style>{`
        .model-3d-page {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .page-header {
          text-align: center;
          margin-bottom: 40px;
        }

        .page-header h1 {
          color: #333;
          margin-bottom: 10px;
        }

        .page-header p {
          color: #666;
          font-size: 16px;
        }

        .test-patterns-section,
        .parameter-testing-section,
        .benchmarking-section,
        .test-results-section,
        .live-testing-section {
          margin-bottom: 40px;
          padding: 20px;
          background: #f9f9f9;
          border-radius: 8px;
        }

        .pattern-grid,
        .preset-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }

        .pattern-card,
        .preset-card {
          background: white;
          padding: 20px;
          border-radius: 8px;
          border: 1px solid #ddd;
        }

        .pattern-card h4,
        .preset-card h4 {
          margin: 0 0 10px 0;
          color: #333;
        }

        .pattern-card p,
        .preset-card p {
          color: #666;
          margin-bottom: 15px;
        }

        .load-pattern-btn,
        .run-test-btn,
        .benchmark-btn {
          background: #2196f3;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .load-pattern-btn:hover,
        .run-test-btn:hover,
        .benchmark-btn:hover {
          background: #1976d2;
        }

        .benchmark-btn:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .current-pattern {
          background: white;
          padding: 15px;
          border-radius: 6px;
          margin-bottom: 20px;
          border: 1px solid #ddd;
        }

        .benchmark-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
          background: white;
        }

        .benchmark-table th,
        .benchmark-table td {
          padding: 10px;
          text-align: left;
          border: 1px solid #ddd;
        }

        .benchmark-table th {
          background: #f5f5f5;
          font-weight: bold;
        }

        .test-statistics {
          display: flex;
          gap: 30px;
          margin-bottom: 20px;
          padding: 20px;
          background: white;
          border-radius: 6px;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .stat-label {
          font-size: 12px;
          color: #666;
          margin-bottom: 5px;
        }

        .stat-value {
          font-size: 18px;
          font-weight: bold;
          color: #333;
        }

        .stat-value.success {
          color: #4caf50;
        }

        .stat-value.error {
          color: #f44336;
        }

        .test-history {
          max-height: 400px;
          overflow-y: auto;
        }

        .test-result-card {
          background: white;
          padding: 15px;
          margin-bottom: 10px;
          border-radius: 6px;
          border: 1px solid #ddd;
          cursor: pointer;
          transition: all 0.2s;
        }

        .test-result-card:hover {
          border-color: #2196f3;
          transform: translateY(-1px);
        }

        .test-result-card.success {
          border-left: 4px solid #4caf50;
        }

        .test-result-card.error {
          border-left: 4px solid #f44336;
        }

        .test-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .test-header h4 {
          margin: 0;
          color: #333;
        }

        .test-time {
          font-size: 12px;
          color: #666;
        }

        .test-details {
          display: flex;
          gap: 20px;
          font-size: 14px;
          color: #666;
          margin-bottom: 5px;
        }

        .test-notes {
          font-size: 12px;
          color: #888;
          font-style: italic;
        }

        .error-text {
          color: #f44336;
        }

        .live-testing-container {
          background: white;
          border-radius: 8px;
          padding: 20px;
        }

        .page-help {
          background: #e3f2fd;
          padding: 20px;
          border-radius: 8px;
          margin-top: 40px;
        }

        .page-help h3 {
          margin-top: 0;
          color: #1976d2;
        }

        .page-help ul {
          color: #333;
        }

        .page-help li {
          margin-bottom: 8px;
        }

        @media (max-width: 768px) {
          .model-3d-page {
            padding: 10px;
          }
          
          .pattern-grid,
          .preset-grid {
            grid-template-columns: 1fr;
          }
          
          .test-statistics {
            flex-wrap: wrap;
            gap: 15px;
          }
        }
      `}</style>
    </div>
  )
}

export default Model3DPage