/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseCSVContent, parseCSV, validateCSVContent, CSVParseError } from '../CSVParser'
import { sampleCSVData, sampleFiles, createMockFile } from '@/test/fixtures'

describe('CSVParser', () => {
  describe('parseCSVContent', () => {
    it('should parse valid CSV content', () => {
      const result = parseCSVContent(sampleCSVData.valid)
      
      expect(result.width).toBe(3)
      expect(result.height).toBe(3)
      expect(result.data).toEqual([
        [true, false, true],
        [false, true, false],
        [true, true, false]
      ])
      expect(result.metadata.source).toBe('csv')
    })

    it('should handle single row CSV', () => {
      const result = parseCSVContent(sampleCSVData.singleRow)
      
      expect(result.width).toBe(3)
      expect(result.height).toBe(1)
      expect(result.data).toEqual([
        [true, false, true]
      ])
    })

    it('should throw error for empty CSV', () => {
      expect(() => parseCSVContent(sampleCSVData.empty))
        .toThrow(CSVParseError)
    })

    it('should throw error for invalid CSV format', () => {
      expect(() => parseCSVContent(sampleCSVData.invalid))
        .toThrow(CSVParseError)
    })

    it('should handle mixed boolean types by converting to boolean', () => {
      const result = parseCSVContent(sampleCSVData.mixedTypes)
      
      expect(result.data).toEqual([
        [true, false, true],
        [false, true, false]
      ])
    })

    it('should respect custom options', () => {
      const csvWithSemicolon = 'true;false;true\nfalse;true;false'
      const result = parseCSVContent(csvWithSemicolon, {
        delimiter: ';',
        trimCells: true,
        skipEmptyLines: true,
        allowVariableLength: false,
        maxDimensions: { width: 1000, height: 1000 }
      })
      
      expect(result.width).toBe(3)
      expect(result.height).toBe(2)
    })

    it('should throw error when exceeding max dimensions', () => {
      const largeCsv = Array(10).fill('true,false,true').join('\n')
      
      expect(() => parseCSVContent(largeCsv, {
        maxDimensions: { width: 2, height: 5 },
        delimiter: ',',
        trimCells: true,
        skipEmptyLines: true,
        allowVariableLength: false
      })).toThrow(CSVParseError)
    })

    it('should skip empty lines when option is enabled', () => {
      const csvWithEmptyLines = 'true,false\n\nfalse,true\n\n'
      const result = parseCSVContent(csvWithEmptyLines, {
        skipEmptyLines: true,
        delimiter: ',',
        trimCells: true,
        allowVariableLength: false,
        maxDimensions: { width: 1000, height: 1000 }
      })
      
      expect(result.height).toBe(2)
    })

    it('should trim whitespace from cells', () => {
      const csvWithSpaces = ' true , false , true \n false , true , false '
      const result = parseCSVContent(csvWithSpaces, {
        trimCells: true,
        delimiter: ',',
        skipEmptyLines: true,
        allowVariableLength: false,
        maxDimensions: { width: 1000, height: 1000 }
      })
      
      expect(result.data).toEqual([
        [true, false, true],
        [false, true, false]
      ])
    })
  })

  describe('validateCSVContent', () => {
    it('should return valid for correct CSV', () => {
      const result = validateCSVContent(sampleCSVData.valid)
      
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should return errors for invalid CSV', () => {
      const result = validateCSVContent(sampleCSVData.invalid)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Invalid boolean value')
    })

    it('should return errors for empty CSV', () => {
      const result = validateCSVContent(sampleCSVData.empty)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('CSV content is empty')
    })

    it('should validate row consistency', () => {
      const inconsistentRows = 'true,false,true\nfalse,true'
      const result = validateCSVContent(inconsistentRows)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Inconsistent row lengths')
    })

    it('should return warnings for large files', () => {
      const largeCsv = Array(200).fill(sampleCSVData.valid).join('\n')
      const result = validateCSVContent(largeCsv)
      
      expect(result.warnings).toContain('Large pattern size may impact performance')
    })
  })

  describe('parseCSV', () => {
    let mockFileReader: any

    beforeEach(() => {
      mockFileReader = {
        readAsText: vi.fn(),
        onload: null,
        onerror: null,
        result: null
      }
      global.FileReader = vi.fn(() => mockFileReader)
    })

    it('should parse valid CSV file', async () => {
      const file = sampleFiles.validCSV
      mockFileReader.result = sampleCSVData.valid

      const parsePromise = parseCSV(file)
      
      // Simulate FileReader onload
      setTimeout(() => {
        mockFileReader.onload({ target: { result: sampleCSVData.valid } })
      }, 0)

      const result = await parsePromise
      
      expect(result.width).toBe(3)
      expect(result.height).toBe(3)
      expect(mockFileReader.readAsText).toHaveBeenCalledWith(file)
    })

    it('should reject when FileReader fails', async () => {
      const file = sampleFiles.validCSV
      
      const parsePromise = parseCSV(file)
      
      // Simulate FileReader onerror
      setTimeout(() => {
        mockFileReader.onerror(new Error('File read error'))
      }, 0)

      await expect(parsePromise).rejects.toThrow('File read error')
    })

    it('should reject for invalid CSV content', async () => {
      const file = sampleFiles.invalidCSV
      mockFileReader.result = sampleCSVData.invalid

      const parsePromise = parseCSV(file)
      
      // Simulate FileReader onload with invalid data
      setTimeout(() => {
        mockFileReader.onload({ target: { result: sampleCSVData.invalid } })
      }, 0)

      await expect(parsePromise).rejects.toThrow(CSVParseError)
    })

    it('should reject when FileReader result is not a string', async () => {
      const file = sampleFiles.validCSV
      mockFileReader.result = new ArrayBuffer(10)

      const parsePromise = parseCSV(file)
      
      // Simulate FileReader onload with non-string result
      setTimeout(() => {
        mockFileReader.onload({ target: { result: new ArrayBuffer(10) } })
      }, 0)

      await expect(parsePromise).rejects.toThrow('Failed to read file as text')
    })
  })

  describe('CSVParseError', () => {
    it('should create error with message only', () => {
      const error = new CSVParseError('Test error')
      
      expect(error.message).toBe('Test error')
      expect(error.name).toBe('CSVParseError')
      expect(error.line).toBeUndefined()
      expect(error.column).toBeUndefined()
    })

    it('should create error with line and column information', () => {
      const error = new CSVParseError('Parse error', 5, 10)
      
      expect(error.message).toBe('Parse error')
      expect(error.line).toBe(5)
      expect(error.column).toBe(10)
    })

    it('should be instance of Error', () => {
      const error = new CSVParseError('Test error')
      
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(CSVParseError)
    })
  })
})