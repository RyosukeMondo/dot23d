import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { DotArtService } from '@/services/DotArtService'
import type { DotPattern, DotPosition, DotSelection } from '@/types'

interface DotEditorProps {
  pattern: DotPattern
  onPatternChange: (pattern: DotPattern) => void
  onError: (error: string) => void
}

export const DotEditor: React.FC<DotEditorProps> = ({
  pattern,
  onPatternChange,
  onError
}) => {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionStart, setSelectionStart] = useState<DotPosition | null>(null)
  const [selectionEnd, setSelectionEnd] = useState<DotPosition | null>(null)
  const [tool, setTool] = useState<'toggle' | 'fill' | 'clear' | 'select'>('toggle')
  const [isPanning, setIsPanning] = useState(false)
  const [lastPanPosition, setLastPanPosition] = useState({ x: 0, y: 0 })

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const dotSize = useMemo(() => Math.max(4, 20 * zoom), [zoom])
  const spacing = useMemo(() => dotSize + Math.max(1, 2 * zoom), [dotSize, zoom])

  // Draw the pattern
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const canvasWidth = pattern.width * spacing
    const canvasHeight = pattern.height * spacing
    
    canvas.width = canvasWidth
    canvas.height = canvasHeight

    // Clear canvas
    ctx.fillStyle = '#f8f9fa'
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    // Draw grid
    ctx.strokeStyle = '#e9ecef'
    ctx.lineWidth = 1
    ctx.setLineDash([1, 1])
    
    // Vertical lines
    for (let x = 0; x <= pattern.width; x++) {
      const xPos = x * spacing
      ctx.beginPath()
      ctx.moveTo(xPos, 0)
      ctx.lineTo(xPos, canvasHeight)
      ctx.stroke()
    }
    
    // Horizontal lines
    for (let y = 0; y <= pattern.height; y++) {
      const yPos = y * spacing
      ctx.beginPath()
      ctx.moveTo(0, yPos)
      ctx.lineTo(canvasWidth, yPos)
      ctx.stroke()
    }

    ctx.setLineDash([])

    // Draw dots
    for (let y = 0; y < pattern.height; y++) {
      for (let x = 0; x < pattern.width; x++) {
        const xPos = x * spacing + spacing / 2
        const yPos = y * spacing + spacing / 2
        
        if (pattern.data[y][x]) {
          // Active dot
          ctx.fillStyle = '#343a40'
          ctx.beginPath()
          ctx.arc(xPos, yPos, dotSize / 2 - 1, 0, 2 * Math.PI)
          ctx.fill()
        } else {
          // Inactive dot
          ctx.fillStyle = '#ffffff'
          ctx.strokeStyle = '#adb5bd'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.arc(xPos, yPos, dotSize / 2 - 1, 0, 2 * Math.PI)
          ctx.fill()
          ctx.stroke()
        }
      }
    }

    // Draw selection overlay
    if (isSelecting && selectionStart && selectionEnd) {
      const startX = Math.min(selectionStart.x, selectionEnd.x)
      const endX = Math.max(selectionStart.x, selectionEnd.x)
      const startY = Math.min(selectionStart.y, selectionEnd.y)
      const endY = Math.max(selectionStart.y, selectionEnd.y)

      ctx.fillStyle = 'rgba(0, 123, 255, 0.2)'
      ctx.strokeStyle = '#007bff'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])

      const rectX = startX * spacing
      const rectY = startY * spacing
      const rectWidth = (endX - startX + 1) * spacing
      const rectHeight = (endY - startY + 1) * spacing

      ctx.fillRect(rectX, rectY, rectWidth, rectHeight)
      ctx.strokeRect(rectX, rectY, rectWidth, rectHeight)
    }
  }, [pattern, spacing, dotSize, isSelecting, selectionStart, selectionEnd])

  const getPositionFromEvent = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    
    const canvasX = (e.clientX - rect.left) * scaleX - pan.x
    const canvasY = (e.clientY - rect.top) * scaleY - pan.y

    const x = Math.floor(canvasX / spacing)
    const y = Math.floor(canvasY / spacing)

    if (x >= 0 && x < pattern.width && y >= 0 && y < pattern.height) {
      return { x, y }
    }
    
    return null
  }, [spacing, pan, pattern.width, pattern.height])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const position = getPositionFromEvent(e)
    if (!position) return

    if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
      // Middle click or Ctrl+click for panning
      setIsPanning(true)
      setLastPanPosition({ x: e.clientX, y: e.clientY })
      return
    }

    if (tool === 'select') {
      setIsSelecting(true)
      setSelectionStart(position)
      setSelectionEnd(position)
    } else if (tool === 'toggle') {
      try {
        const newPattern = DotArtService.toggleDot(pattern, position)
        onPatternChange(newPattern)
      } catch (error) {
        onError(error instanceof Error ? error.message : 'Failed to toggle dot')
      }
    }
  }, [getPositionFromEvent, tool, pattern, onPatternChange, onError])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      const deltaX = e.clientX - lastPanPosition.x
      const deltaY = e.clientY - lastPanPosition.y
      
      setPan(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }))
      
      setLastPanPosition({ x: e.clientX, y: e.clientY })
      return
    }

    if (isSelecting && selectionStart) {
      const position = getPositionFromEvent(e)
      if (position) {
        setSelectionEnd(position)
      }
    }
  }, [isPanning, lastPanPosition, isSelecting, selectionStart, getPositionFromEvent])

  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false)
      return
    }

    if (isSelecting) {
      setIsSelecting(false)
    }
  }, [isPanning, isSelecting])

  const handleSelectionAction = useCallback((action: 'fill' | 'clear' | 'toggle') => {
    if (!selectionStart || !selectionEnd) return

    try {
      const selection: DotSelection = { start: selectionStart, end: selectionEnd }
      let newPattern: DotPattern

      switch (action) {
        case 'fill':
          newPattern = DotArtService.fillArea(pattern, selection, true)
          break
        case 'clear':
          newPattern = DotArtService.fillArea(pattern, selection, false)
          break
        case 'toggle':
          newPattern = DotArtService.toggleRange(pattern, selection)
          break
        default:
          return
      }

      onPatternChange(newPattern)
      setSelectionStart(null)
      setSelectionEnd(null)
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to apply selection action')
    }
  }, [selectionStart, selectionEnd, pattern, onPatternChange, onError])

  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(Math.max(0.1, Math.min(5, newZoom)))
  }, [])

  const handleResetView = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  const handleClearAll = useCallback(() => {
    try {
      const newPattern = DotArtService.clearPattern(pattern)
      onPatternChange(newPattern)
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to clear pattern')
    }
  }, [pattern, onPatternChange, onError])

  const handleInvertAll = useCallback(() => {
    try {
      const newPattern = DotArtService.invertPattern(pattern)
      onPatternChange(newPattern)
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to invert pattern')
    }
  }, [pattern, onPatternChange, onError])

  const patternStats = useMemo(() => {
    return DotArtService.getPatternStats(pattern)
  }, [pattern])

  return (
    <div className="dot-editor">
      <div className="editor-header">
        <h2>Dot Pattern Editor</h2>
        <div className="pattern-info">
          <span>Size: {pattern.width}×{pattern.height}</span>
          <span>Active: {patternStats.activeDots}/{patternStats.totalDots}</span>
          <span>Fill: {patternStats.fillPercentage.toFixed(1)}%</span>
        </div>
      </div>

      <div className="editor-toolbar">
        <div className="tool-group">
          <h4>Tools</h4>
          <div className="tool-buttons">
            <button
              className={tool === 'toggle' ? 'active' : ''}
              onClick={() => setTool('toggle')}
            >
              ✏️ Toggle
            </button>
            <button
              className={tool === 'select' ? 'active' : ''}
              onClick={() => setTool('select')}
            >
              ⬚ Select
            </button>
            <button
              className={tool === 'fill' ? 'active' : ''}
              onClick={() => setTool('fill')}
            >
              ⬛ Fill
            </button>
            <button
              className={tool === 'clear' ? 'active' : ''}
              onClick={() => setTool('clear')}
            >
              ⬜ Clear
            </button>
          </div>
        </div>

        <div className="tool-group">
          <h4>View</h4>
          <div className="zoom-controls">
            <button onClick={() => handleZoomChange(zoom - 0.25)}>-</button>
            <span>Zoom: {(zoom * 100).toFixed(0)}%</span>
            <button onClick={() => handleZoomChange(zoom + 0.25)}>+</button>
            <button onClick={handleResetView}>Reset</button>
          </div>
        </div>

        <div className="tool-group">
          <h4>Pattern</h4>
          <div className="pattern-actions">
            <button onClick={handleClearAll} className="danger">
              Clear All
            </button>
            <button onClick={handleInvertAll}>
              Invert All
            </button>
          </div>
        </div>
      </div>

      {selectionStart && selectionEnd && (
        <div className="selection-toolbar">
          <span>Selection: {Math.abs(selectionEnd.x - selectionStart.x) + 1}×{Math.abs(selectionEnd.y - selectionStart.y) + 1}</span>
          <button onClick={() => handleSelectionAction('fill')}>Fill Selection</button>
          <button onClick={() => handleSelectionAction('clear')}>Clear Selection</button>
          <button onClick={() => handleSelectionAction('toggle')}>Toggle Selection</button>
          <button onClick={() => { setSelectionStart(null); setSelectionEnd(null) }}>Cancel</button>
        </div>
      )}

      <div 
        ref={containerRef}
        className="editor-canvas-container"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0'
        }}
      >
        <canvas
          ref={canvasRef}
          className="editor-canvas"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: isPanning ? 'grabbing' : tool === 'select' ? 'crosshair' : 'pointer' }}
        />
      </div>

      <div className="editor-help">
        <p><strong>Usage:</strong></p>
        <ul>
          <li>Left click: Use selected tool</li>
          <li>Ctrl+click or middle mouse: Pan view</li>
          <li>Select tool: Drag to select area, then use selection actions</li>
          <li>Scroll wheel: Zoom in/out</li>
        </ul>
      </div>
    </div>
  )
}

export default DotEditor