import type { DotPattern, ValidationResult } from '@/types'

/**
 * Error types for CSV parsing
 */
export class CSVParseError extends Error {
  constructor(message: string, public line?: number, public column?: number) {
    super(message)
    this.name = 'CSVParseError'
  }
}

/**
 * Options for CSV parsing
 */
export interface CSVParseOptions {
  /** Expected delimiter (default: ',') */
  delimiter: string
  
  /** Allow different row lengths */
  allowVariableLength: boolean
  
  /** Trim whitespace from cells */
  trimCells: boolean
  
  /** Skip empty lines */
  skipEmptyLines: boolean
  
  /** Maximum allowed dimensions */
  maxDimensions: {
    width: number
    height: number
  }
}

/**
 * Default CSV parse options
 */
const DEFAULT_OPTIONS: CSVParseOptions = {
  delimiter: ',',
  allowVariableLength: false,
  trimCells: true,
  skipEmptyLines: true,
  maxDimensions: {
    width: 1000,
    height: 1000
  }
}

/**
 * Parse CSV content to boolean values
 */
function parseCellValue(value: string): boolean {
  const trimmed = value.trim().toLowerCase()
  
  // Handle various boolean representations
  if (trimmed === '1' || trimmed === 'true' || trimmed === 'yes' || trimmed === 'x') {
    return true
  }
  
  if (trimmed === '0' || trimmed === 'false' || trimmed === 'no' || trimmed === '' || trimmed === ' ') {
    return false
  }
  
  // Try parsing as number
  const numValue = parseFloat(trimmed)
  if (!isNaN(numValue)) {
    return numValue !== 0
  }
  
  // If we can't parse it, throw an error
  throw new Error(`Invalid boolean value: "${value}". Expected: 0/1, true/false, yes/no, x/empty, or numeric values`)
}

/**
 * Validate CSV structure and content
 */
export function validateCSV(content: string, options: Partial<CSVParseOptions> = {}): ValidationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const errors: string[] = []
  const warnings: string[] = []
  
  try {
    if (!content || content.trim().length === 0) {
      errors.push('CSV content is empty')
      return { isValid: false, errors, warnings }
    }
    
    const lines = content.split(/\r?\n/)
    const dataLines = opts.skipEmptyLines 
      ? lines.filter(line => line.trim().length > 0)
      : lines
    
    if (dataLines.length === 0) {
      errors.push('No data lines found in CSV')
      return { isValid: false, errors, warnings }
    }
    
    if (dataLines.length > opts.maxDimensions.height) {
      errors.push(`Too many rows: ${dataLines.length} (max: ${opts.maxDimensions.height})`)
    }
    
    let expectedWidth: number | null = null
    
    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i]
      const cells = line.split(opts.delimiter)
      
      if (opts.trimCells) {
        for (let j = 0; j < cells.length; j++) {
          cells[j] = cells[j].trim()
        }
      }
      
      // Check width consistency
      if (expectedWidth === null) {
        expectedWidth = cells.length
        if (expectedWidth > opts.maxDimensions.width) {
          errors.push(`Too many columns in row ${i + 1}: ${expectedWidth} (max: ${opts.maxDimensions.width})`)
        }
      } else if (cells.length !== expectedWidth && !opts.allowVariableLength) {
        errors.push(`Inconsistent row length at line ${i + 1}: expected ${expectedWidth} columns, got ${cells.length}`)
      }
      
      // Validate cell values
      for (let j = 0; j < cells.length; j++) {
        try {
          parseCellValue(cells[j])
        } catch (error) {
          errors.push(`Invalid cell value at row ${i + 1}, column ${j + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    }
    
    // Warnings for potential issues
    if (expectedWidth && expectedWidth < 5) {
      warnings.push(`Pattern is very narrow (${expectedWidth} columns). Consider if this is intended.`)
    }
    
    if (dataLines.length < 5) {
      warnings.push(`Pattern is very short (${dataLines.length} rows). Consider if this is intended.`)
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
    
  } catch (error) {
    errors.push(`Unexpected error during validation: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return { isValid: false, errors, warnings }
  }
}

/**
 * Parse CSV file content into a DotPattern
 */
export async function parseCSV(file: File, options: Partial<CSVParseOptions> = {}): Promise<DotPattern> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string
        
        if (!content) {
          reject(new CSVParseError('Failed to read file content'))
          return
        }
        
        // Validate the CSV first
        const validation = validateCSV(content, opts)
        if (!validation.isValid) {
          reject(new CSVParseError(validation.errors.join(', ')))
          return
        }
        
        // Parse the content
        const dotPattern = parseCSVContent(content, opts)
        dotPattern.metadata = {
          filename: file.name,
          createdAt: new Date(),
          modifiedAt: new Date()
        }
        
        resolve(dotPattern)
        
      } catch (error) {
        if (error instanceof CSVParseError) {
          reject(error)
        } else {
          reject(new CSVParseError(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`))
        }
      }
    }
    
    reader.onerror = () => {
      reject(new CSVParseError('Failed to read file'))
    }
    
    reader.readAsText(file)
  })
}

/**
 * Parse CSV content string into a DotPattern
 */
export function parseCSVContent(content: string, options: Partial<CSVParseOptions> = {}): DotPattern {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  const lines = content.split(/\r?\n/)
  const dataLines = opts.skipEmptyLines 
    ? lines.filter(line => line.trim().length > 0)
    : lines
  
  if (dataLines.length === 0) {
    throw new CSVParseError('No data found in CSV content')
  }
  
  const data: boolean[][] = []
  let width = 0
  
  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i]
    const cells = line.split(opts.delimiter)
    
    if (opts.trimCells) {
      for (let j = 0; j < cells.length; j++) {
        cells[j] = cells[j].trim()
      }
    }
    
    const row: boolean[] = []
    for (let j = 0; j < cells.length; j++) {
      try {
        row.push(parseCellValue(cells[j]))
      } catch (error) {
        throw new CSVParseError(
          `Invalid cell value at row ${i + 1}, column ${j + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          i + 1,
          j + 1
        )
      }
    }
    
    if (i === 0) {
      width = row.length
    } else if (row.length !== width && !opts.allowVariableLength) {
      throw new CSVParseError(
        `Inconsistent row length at line ${i + 1}: expected ${width} columns, got ${row.length}`,
        i + 1
      )
    }
    
    // Pad or trim row to match expected width if variable length is allowed
    if (opts.allowVariableLength) {
      while (row.length < width) {
        row.push(false)
      }
      if (row.length > width) {
        width = Math.max(width, row.length)
        // Go back and pad previous rows if needed
        for (const prevRow of data) {
          while (prevRow.length < width) {
            prevRow.push(false)
          }
        }
      }
    }
    
    data.push(row)
  }
  
  return {
    data,
    width,
    height: data.length
  }
}

/**
 * Convert DotPattern to CSV string
 */
export function dotPatternToCSV(pattern: DotPattern, options: Partial<CSVParseOptions> = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  const lines: string[] = []
  
  for (const row of pattern.data) {
    const cells = row.map(cell => cell ? '1' : '0')
    lines.push(cells.join(opts.delimiter))
  }
  
  return lines.join('\n')
}

/**
 * Create a download URL for a DotPattern as CSV
 */
export function createCSVDownload(pattern: DotPattern, filename?: string): { url: string; filename: string } {
  const csvContent = dotPatternToCSV(pattern)
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  
  const finalFilename = filename || pattern.metadata?.filename || 'dot-pattern.csv'
  const csvFilename = finalFilename.endsWith('.csv') ? finalFilename : `${finalFilename}.csv`
  
  return { url, filename: csvFilename }
}