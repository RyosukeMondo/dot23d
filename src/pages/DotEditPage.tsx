import React, { useState, useCallback } from 'react'
import { DotEditor } from '@/components/DotEditor'
import { FileUpload } from '@/components/FileUpload'
import { DotArtService } from '@/services/DotArtService'
import { FileService } from '@/services/FileService'
import type { DotPattern } from '@/types'

const DotEditPage: React.FC = () => {
  const [pattern, setPattern] = useState<DotPattern | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Create a sample pattern for testing
  const createSamplePattern = useCallback(() => {
    const samplePattern: DotPattern = {
      width: 20,
      height: 20,
      data: Array(20).fill(null).map((_, y) => 
        Array(20).fill(null).map((_, x) => {
          // Create a simple pattern for testing
          return (x + y) % 3 === 0 || (x - y) % 4 === 0
        })
      ),
      metadata: {
        filename: 'sample-pattern.csv',
        createdAt: new Date()
      }
    }
    setPattern(samplePattern)
    setHasChanges(false)
    setError(null)
  }, [])

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a CSV file')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const parsedPattern = await DotArtService.importCSV(file)
      setPattern(parsedPattern)
      setHasChanges(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pattern')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Handle pattern changes
  const handlePatternChange = useCallback((newPattern: DotPattern) => {
    setPattern(newPattern)
    setHasChanges(true)
    setError(null)
  }, [])

  // Handle save to CSV
  const handleSaveCSV = useCallback(() => {
    if (!pattern) return

    try {
      const csvContent = DotArtService.exportCSV(pattern)
      const blob = FileService.createTextBlob(csvContent, 'text/csv')
      const filename = `dot_pattern_${Date.now()}.csv`
      FileService.downloadFile(blob, filename)
      setHasChanges(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save pattern')
    }
  }, [pattern])

  // Handle pattern validation
  const validatePattern = useCallback(() => {
    if (!pattern) {
      setError('No pattern to validate')
      return
    }

    try {
      const stats = DotArtService.getPatternStats(pattern)
      
      // Simple validation - check if pattern has valid dimensions and data
      const isValid = pattern.width > 0 && pattern.height > 0 && 
                      pattern.data.length === pattern.height &&
                      pattern.data.every(row => row.length === pattern.width)
      
      const validationMessage = isValid
        ? `✅ Pattern is valid! ${stats.activeDots} active dots (${stats.fillPercentage.toFixed(1)}% fill)`
        : `❌ Pattern validation failed: Invalid dimensions or data structure`
        
      alert(validationMessage)
      setError(isValid ? null : 'Pattern structure is invalid')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed')
    }
  }, [pattern])

  // Clear pattern
  const handleClearPattern = useCallback(() => {
    if (!pattern) return
    
    if (hasChanges && !confirm('You have unsaved changes. Are you sure you want to clear the pattern?')) {
      return
    }

    setPattern(null)
    setHasChanges(false)
    setError(null)
  }, [pattern, hasChanges])

  return (
    <div className="dot-edit-page">
      <div className="page-header">
        <h1>Dot Pattern Editor - Testing Interface</h1>
        <p>
          Test the dot pattern editing functionality with interactive controls, 
          click and range selection, and state management validation.
        </p>
      </div>

      <div className="page-content">
        {/* Control Panel */}
        <div className="control-panel">
          <h2>Pattern Management</h2>
          
          <div className="control-section">
            <h3>Load Pattern</h3>
            <div className="control-buttons">
              <button onClick={createSamplePattern} className="button-primary">
                📝 Create Sample Pattern
              </button>
            </div>
            <div className="file-upload-section">
              <FileUpload
                onFileSelect={handleFileUpload}
                acceptedTypes=".csv"
                maxSize={1024 * 1024}
              />
              {isLoading && <p>Loading pattern...</p>}
            </div>
          </div>

          {pattern && (
            <>
              <div className="control-section">
                <h3>Pattern Actions</h3>
                <div className="control-buttons">
                  <button 
                    onClick={handleSaveCSV}
                    className="button-success"
                    disabled={!hasChanges}
                  >
                    💾 Save CSV {hasChanges ? '(*)' : ''}
                  </button>
                  <button onClick={validatePattern} className="button-info">
                    ✅ Validate Pattern
                  </button>
                  <button onClick={handleClearPattern} className="button-danger">
                    🗑️ Clear Pattern
                  </button>
                </div>
              </div>

              <div className="control-section">
                <h3>Testing Status</h3>
                <div className="status-info">
                  <div className="status-item">
                    <strong>Pattern Size:</strong> {pattern.width}×{pattern.height}
                  </div>
                  <div className="status-item">
                    <strong>Has Changes:</strong> 
                    <span className={hasChanges ? 'status-changed' : 'status-clean'}>
                      {hasChanges ? 'Yes (unsaved)' : 'No (clean)'}
                    </span>
                  </div>
                  <div className="status-item">
                    <strong>Total Dots:</strong> {pattern.width * pattern.height}
                  </div>
                  <div className="status-item">
                    <strong>Source:</strong> {pattern.metadata?.filename || 'unknown'}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="error-panel">
            <h3>⚠️ Error</h3>
            <p>{error}</p>
            <button onClick={() => setError(null)} className="button-secondary">
              Dismiss
            </button>
          </div>
        )}

        {/* Editor Section */}
        {pattern && (
          <div className="editor-section">
            <h2>Interactive Editor</h2>
            <div className="editor-container">
              <DotEditor
                pattern={pattern}
                onPatternChange={handlePatternChange}
                onError={setError}
              />
            </div>
          </div>
        )}

        {/* Testing Instructions */}
        <div className="testing-section">
          <h2>Testing Instructions</h2>
          <div className="testing-checklist">
            <h3>Click and Toggle Testing</h3>
            <ul>
              <li>✓ Click individual dots to toggle them on/off</li>
              <li>✓ Verify visual feedback for active vs inactive dots</li>
              <li>✓ Test that changes are tracked (unsaved indicator)</li>
            </ul>

            <h3>Range Selection Testing</h3>
            <ul>
              <li>✓ Switch to Select tool and drag to select areas</li>
              <li>✓ Use Fill/Clear/Toggle selection actions</li>
              <li>✓ Verify selection visual feedback</li>
              <li>✓ Test selection cancellation</li>
            </ul>

            <h3>State Management Testing</h3>
            <ul>
              <li>✓ Make changes and verify "Has Changes" status</li>
              <li>✓ Save pattern and verify status clears</li>
              <li>✓ Test pattern validation functionality</li>
              <li>✓ Test error handling with invalid operations</li>
            </ul>

            <h3>View Controls Testing</h3>
            <ul>
              <li>✓ Test zoom in/out controls</li>
              <li>✓ Test pan functionality (Ctrl+click and drag)</li>
              <li>✓ Test reset view button</li>
              <li>✓ Test pattern actions (Clear All, Invert All)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DotEditPage