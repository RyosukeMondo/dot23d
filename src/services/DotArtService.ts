import { parseCSV, dotPatternToCSV, CSVParseError } from '@/utils/CSVParser'
import type { DotPattern, DotPosition, DotSelection } from '@/types'

/**
 * Error class for dot art operations
 */
export class DotArtServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DotArtServiceError'
  }
}

/**
 * Service for dot art editing operations
 */
export class DotArtService {
  /**
   * Toggle a single dot in the pattern
   */
  static toggleDot(pattern: DotPattern, position: DotPosition): DotPattern {
    const { x, y } = position
    
    // Validate position
    if (x < 0 || x >= pattern.width || y < 0 || y >= pattern.height) {
      throw new DotArtServiceError(`Position (${x}, ${y}) is outside pattern bounds`)
    }
    
    // Create a deep copy of the pattern
    const newPattern = this.clonePattern(pattern)
    
    // Toggle the dot
    newPattern.data[y][x] = !newPattern.data[y][x]
    
    // Update metadata
    newPattern.metadata = {
      ...newPattern.metadata,
      modifiedAt: new Date()
    }
    
    return newPattern
  }
  
  /**
   * Toggle a range of dots based on selection
   */
  static toggleRange(pattern: DotPattern, selection: DotSelection, value?: boolean): DotPattern {
    const { start, end } = selection
    
    // Calculate actual selection bounds
    const minX = Math.max(0, Math.min(start.x, end.x))
    const maxX = Math.min(pattern.width - 1, Math.max(start.x, end.x))
    const minY = Math.max(0, Math.min(start.y, end.y))
    const maxY = Math.min(pattern.height - 1, Math.max(start.y, end.y))
    
    // Create a deep copy of the pattern
    const newPattern = this.clonePattern(pattern)
    
    // Toggle or set dots in the selection
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (value !== undefined) {
          newPattern.data[y][x] = value
        } else {
          newPattern.data[y][x] = !newPattern.data[y][x]
        }
      }
    }
    
    // Update metadata
    newPattern.metadata = {
      ...newPattern.metadata,
      modifiedAt: new Date()
    }
    
    return newPattern
  }
  
  /**
   * Fill a rectangular area with a specific value
   */
  static fillArea(pattern: DotPattern, selection: DotSelection, value: boolean): DotPattern {
    return this.toggleRange(pattern, selection, value)
  }
  
  /**
   * Clear the entire pattern (set all to false)
   */
  static clearPattern(pattern: DotPattern): DotPattern {
    const newPattern = this.clonePattern(pattern)
    
    for (let y = 0; y < newPattern.height; y++) {
      for (let x = 0; x < newPattern.width; x++) {
        newPattern.data[y][x] = false
      }
    }
    
    newPattern.metadata = {
      ...newPattern.metadata,
      modifiedAt: new Date()
    }
    
    return newPattern
  }
  
  /**
   * Invert the entire pattern
   */
  static invertPattern(pattern: DotPattern): DotPattern {
    const newPattern = this.clonePattern(pattern)
    
    for (let y = 0; y < newPattern.height; y++) {
      for (let x = 0; x < newPattern.width; x++) {
        newPattern.data[y][x] = !newPattern.data[y][x]
      }
    }
    
    newPattern.metadata = {
      ...newPattern.metadata,
      modifiedAt: new Date()
    }
    
    return newPattern
  }
  
  /**
   * Export pattern as CSV string
   */
  static exportCSV(pattern: DotPattern): string {
    try {
      return dotPatternToCSV(pattern)
    } catch (error) {
      throw new DotArtServiceError(
        `Failed to export CSV: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }
  
  /**
   * Import pattern from CSV file
   */
  static async importCSV(file: File): Promise<DotPattern> {
    try {
      return await parseCSV(file)
    } catch (error) {
      if (error instanceof CSVParseError) {
        throw new DotArtServiceError(`CSV import failed: ${error.message}`)
      }
      throw new DotArtServiceError(
        `Failed to import CSV: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }
  
  /**
   * Create a new empty pattern with given dimensions
   */
  static createEmptyPattern(width: number, height: number): DotPattern {
    if (width <= 0 || height <= 0) {
      throw new DotArtServiceError('Width and height must be positive numbers')
    }
    
    if (width > 1000 || height > 1000) {
      throw new DotArtServiceError('Width and height cannot exceed 1000')
    }
    
    const data: boolean[][] = []
    for (let y = 0; y < height; y++) {
      const row: boolean[] = []
      for (let x = 0; x < width; x++) {
        row.push(false)
      }
      data.push(row)
    }
    
    return {
      data,
      width,
      height,
      metadata: {
        createdAt: new Date(),
        modifiedAt: new Date()
      }
    }
  }
  
  /**
   * Resize pattern to new dimensions
   */
  static resizePattern(pattern: DotPattern, newWidth: number, newHeight: number): DotPattern {
    if (newWidth <= 0 || newHeight <= 0) {
      throw new DotArtServiceError('Width and height must be positive numbers')
    }
    
    if (newWidth > 1000 || newHeight > 1000) {
      throw new DotArtServiceError('Width and height cannot exceed 1000')
    }
    
    const newData: boolean[][] = []
    
    for (let y = 0; y < newHeight; y++) {
      const row: boolean[] = []
      for (let x = 0; x < newWidth; x++) {
        // Copy value if within original bounds, otherwise false
        const value = (x < pattern.width && y < pattern.height) ? pattern.data[y][x] : false
        row.push(value)
      }
      newData.push(row)
    }
    
    return {
      data: newData,
      width: newWidth,
      height: newHeight,
      metadata: {
        ...pattern.metadata,
        modifiedAt: new Date()
      }
    }
  }
  
  /**
   * Get pattern statistics
   */
  static getPatternStats(pattern: DotPattern): {
    totalDots: number
    activeDots: number
    fillPercentage: number
    density: number
  } {
    let activeDots = 0
    const totalDots = pattern.width * pattern.height
    
    for (let y = 0; y < pattern.height; y++) {
      for (let x = 0; x < pattern.width; x++) {
        if (pattern.data[y][x]) {
          activeDots++
        }
      }
    }
    
    const fillPercentage = totalDots > 0 ? (activeDots / totalDots) * 100 : 0
    const density = activeDots / Math.max(pattern.width, pattern.height)
    
    return {
      totalDots,
      activeDots,
      fillPercentage,
      density
    }
  }
  
  /**
   * Check if position is within pattern bounds
   */
  static isValidPosition(pattern: DotPattern, position: DotPosition): boolean {
    return position.x >= 0 && 
           position.x < pattern.width && 
           position.y >= 0 && 
           position.y < pattern.height
  }
  
  /**
   * Get dot value at position
   */
  static getDotValue(pattern: DotPattern, position: DotPosition): boolean {
    if (!this.isValidPosition(pattern, position)) {
      throw new DotArtServiceError(`Position (${position.x}, ${position.y}) is outside pattern bounds`)
    }
    
    return pattern.data[position.y][position.x]
  }
  
  /**
   * Create a deep copy of a dot pattern
   */
  private static clonePattern(pattern: DotPattern): DotPattern {
    return {
      data: pattern.data.map(row => [...row]),
      width: pattern.width,
      height: pattern.height,
      metadata: pattern.metadata ? { ...pattern.metadata } : undefined
    }
  }
  
  /**
   * Normalize selection to ensure start is top-left and end is bottom-right
   */
  static normalizeSelection(selection: DotSelection): DotSelection {
    return {
      start: {
        x: Math.min(selection.start.x, selection.end.x),
        y: Math.min(selection.start.y, selection.end.y)
      },
      end: {
        x: Math.max(selection.start.x, selection.end.x),
        y: Math.max(selection.start.y, selection.end.y)
      }
    }
  }
  
  /**
   * Check if two patterns are equal
   */
  static patternsEqual(pattern1: DotPattern, pattern2: DotPattern): boolean {
    if (pattern1.width !== pattern2.width || pattern1.height !== pattern2.height) {
      return false
    }
    
    for (let y = 0; y < pattern1.height; y++) {
      for (let x = 0; x < pattern1.width; x++) {
        if (pattern1.data[y][x] !== pattern2.data[y][x]) {
          return false
        }
      }
    }
    
    return true
  }
}