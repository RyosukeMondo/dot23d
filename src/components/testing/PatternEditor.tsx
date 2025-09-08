import React, { useRef, useEffect, useState, useCallback } from 'react'
import type { DotPattern } from '@/types'
import styles from './PatternEditor.module.css'

export interface PatternEditorProps {
  /** Initial pattern to edit */
  pattern?: DotPattern
  /** Callback when pattern changes */
  onChange?: (pattern: DotPattern) => void
  /** Grid width */
  width?: number
  /** Grid height */
  height?: number
  /** Cell size in pixels */
  cellSize?: number
  /** Whether the editor is read-only */
  readOnly?: boolean
  /** Show grid lines */
  showGrid?: boolean
  /** Enable zoom controls */
  enableZoom?: boolean
}

export const PatternEditor: React.FC<PatternEditorProps> = ({
  pattern,
  onChange,
  width = 32,
  height = 32,
  cellSize = 12,
  readOnly = false,
  showGrid = true,
  enableZoom = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [currentPattern, setCurrentPattern] = useState<DotPattern>(() => {
    if (pattern) return pattern
    
    // Create empty pattern
    const data = Array(height).fill(null).map(() => Array(width).fill(false))
    return {
      data,
      width,
      height,
      metadata: {
        createdAt: new Date(),
        modifiedAt: new Date()
      }
    }
  })
  
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawMode, setDrawMode] = useState<'draw' | 'erase'>('draw')
  const [zoom, setZoom] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const actualCellSize = cellSize * zoom
  const canvasWidth = currentPattern.width * actualCellSize
  const canvasHeight = currentPattern.height * actualCellSize

  // Draw the pattern on canvas
  const drawPattern = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Apply transform
    ctx.save()
    ctx.translate(offset.x, offset.y)

    // Draw pattern
    for (let y = 0; y < currentPattern.height; y++) {
      for (let x = 0; x < currentPattern.width; x++) {
        const filled = currentPattern.data[y][x]
        const cellX = x * actualCellSize
        const cellY = y * actualCellSize

        // Fill cell
        ctx.fillStyle = filled ? '#333333' : '#f8f8f8'
        ctx.fillRect(cellX, cellY, actualCellSize, actualCellSize)

        // Draw grid
        if (showGrid) {
          ctx.strokeStyle = '#e0e0e0'
          ctx.lineWidth = 1
          ctx.strokeRect(cellX + 0.5, cellY + 0.5, actualCellSize - 1, actualCellSize - 1)
        }
      }
    }

    ctx.restore()
  }, [currentPattern, actualCellSize, offset, showGrid])

  // Get cell coordinates from mouse position
  const getCellFromMouse = useCallback((event: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left - offset.x
    const y = event.clientY - rect.top - offset.y

    const cellX = Math.floor(x / actualCellSize)
    const cellY = Math.floor(y / actualCellSize)

    if (cellX >= 0 && cellX < currentPattern.width && cellY >= 0 && cellY < currentPattern.height) {
      return { x: cellX, y: cellY }
    }

    return null
  }, [actualCellSize, offset, currentPattern])

  // Toggle cell state
  const toggleCell = useCallback((x: number, y: number, force?: boolean) => {
    if (readOnly) return

    const newPattern = {
      ...currentPattern,
      data: currentPattern.data.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          if (rowIndex === y && colIndex === x) {
            return force !== undefined ? force : (drawMode === 'draw' ? true : false)
          }
          return cell
        })
      ),
      metadata: {
        ...currentPattern.metadata,
        modifiedAt: new Date()
      }
    }

    setCurrentPattern(newPattern)
    onChange?.(newPattern)
  }, [currentPattern, onChange, readOnly, drawMode])

  // Mouse event handlers
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (readOnly) return

    event.preventDefault()
    const cell = getCellFromMouse(event)

    if (cell) {
      if (event.button === 0) { // Left click
        setIsDrawing(true)
        const currentValue = currentPattern.data[cell.y][cell.x]
        setDrawMode(currentValue ? 'erase' : 'draw')
        toggleCell(cell.x, cell.y, !currentValue)
      } else if (event.button === 2) { // Right click
        setIsDragging(true)
        setDragStart({ x: event.clientX - offset.x, y: event.clientY - offset.y })
      }
    }
  }, [getCellFromMouse, toggleCell, currentPattern, offset, readOnly])

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (isDragging) {
      const newOffset = {
        x: event.clientX - dragStart.x,
        y: event.clientY - dragStart.y
      }
      setOffset(newOffset)
    } else if (isDrawing && !readOnly) {
      const cell = getCellFromMouse(event)
      if (cell) {
        toggleCell(cell.x, cell.y, drawMode === 'draw')
      }
    }
  }, [isDrawing, isDragging, getCellFromMouse, toggleCell, drawMode, dragStart, readOnly])

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false)
    setIsDragging(false)
  }, [])

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
  }, [])

  // Zoom handlers
  const handleWheel = useCallback((event: React.WheelEvent) => {
    if (!enableZoom) return
    
    event.preventDefault()
    const delta = event.deltaY > 0 ? -0.1 : 0.1
    const newZoom = Math.max(0.25, Math.min(4, zoom + delta))
    setZoom(newZoom)
  }, [zoom, enableZoom])

  // Tool functions
  const clearPattern = useCallback(() => {
    if (readOnly) return
    
    const newPattern = {
      ...currentPattern,
      data: Array(currentPattern.height).fill(null).map(() => Array(currentPattern.width).fill(false)),
      metadata: {
        ...currentPattern.metadata,
        modifiedAt: new Date()
      }
    }
    setCurrentPattern(newPattern)
    onChange?.(newPattern)
  }, [currentPattern, onChange, readOnly])

  const fillPattern = useCallback(() => {
    if (readOnly) return
    
    const newPattern = {
      ...currentPattern,
      data: Array(currentPattern.height).fill(null).map(() => Array(currentPattern.width).fill(true)),
      metadata: {
        ...currentPattern.metadata,
        modifiedAt: new Date()
      }
    }
    setCurrentPattern(newPattern)
    onChange?.(newPattern)
  }, [currentPattern, onChange, readOnly])

  const invertPattern = useCallback(() => {
    if (readOnly) return
    
    const newPattern = {
      ...currentPattern,
      data: currentPattern.data.map(row => row.map(cell => !cell)),
      metadata: {
        ...currentPattern.metadata,
        modifiedAt: new Date()
      }
    }
    setCurrentPattern(newPattern)
    onChange?.(newPattern)
  }, [currentPattern, onChange, readOnly])

  // Reset zoom and offset
  const resetView = useCallback(() => {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  // Update pattern when prop changes
  useEffect(() => {
    if (pattern && pattern !== currentPattern) {
      setCurrentPattern(pattern)
    }
  }, [pattern, currentPattern])

  // Draw pattern when it changes
  useEffect(() => {
    drawPattern()
  }, [drawPattern])

  // Set up canvas size
  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      canvas.width = Math.max(400, canvasWidth + 100)
      canvas.height = Math.max(300, canvasHeight + 100)
    }
  }, [canvasWidth, canvasHeight])

  return (
    <div className={styles.patternEditor}>
      <div className={styles.toolbar}>
        {!readOnly && (
          <>
            <button
              onClick={clearPattern}
              className={styles.toolButton}
              title="Clear all dots"
            >
              Clear
            </button>
            <button
              onClick={fillPattern}
              className={styles.toolButton}
              title="Fill all dots"
            >
              Fill
            </button>
            <button
              onClick={invertPattern}
              className={styles.toolButton}
              title="Invert pattern"
            >
              Invert
            </button>
            <div className={styles.separator} />
          </>
        )}
        
        {enableZoom && (
          <>
            <button
              onClick={() => setZoom(Math.min(4, zoom * 1.2))}
              className={styles.toolButton}
              title="Zoom in"
            >
              +
            </button>
            <span className={styles.zoomLevel}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(Math.max(0.25, zoom / 1.2))}
              className={styles.toolButton}
              title="Zoom out"
            >
              -
            </button>
            <button
              onClick={resetView}
              className={styles.toolButton}
              title="Reset view"
            >
              Reset
            </button>
          </>
        )}
      </div>

      <div className={styles.canvasContainer}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={handleContextMenu}
          onWheel={handleWheel}
        />
      </div>

      <div className={styles.info}>
        <span>Size: {currentPattern.width} × {currentPattern.height}</span>
        <span>
          Dots: {currentPattern.data.flat().filter(Boolean).length} / {currentPattern.width * currentPattern.height}
        </span>
        {!readOnly && (
          <span className={styles.instructions}>
            Left click: Draw/Erase • Right click + drag: Pan • Scroll: Zoom
          </span>
        )}
      </div>
    </div>
  )
}

export default PatternEditor