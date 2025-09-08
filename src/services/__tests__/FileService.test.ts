/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FileService } from '../FileService'
import { sampleFiles, sampleErrorMessages } from '@/test/fixtures'

describe('FileService', () => {
  describe('validateFile', () => {
    it('should validate correct file types', async () => {
      const result = await FileService.validateFile(sampleFiles.validCSV)
      
      expect(result.data).toBeDefined()
      expect(result.data?.isValid).toBe(true)
      expect(result.data?.errors).toHaveLength(0)
      expect(result.error).toBeUndefined()
    })

    it('should reject unsupported file types', async () => {
      const result = await FileService.validateFile(sampleFiles.unsupportedFile)
      
      expect(result.data?.isValid).toBe(false)
      expect(result.data?.errors).toContain('File type is not supported')
    })

    it('should reject files that are too large', async () => {
      const result = await FileService.validateFile(sampleFiles.largeCSV, {
        maxSizeBytes: 1024 * 1024 // 1MB limit
      })
      
      expect(result.data?.isValid).toBe(false)
      expect(result.data?.errors).toContain('File size exceeds maximum allowed size')
    })

    it('should accept files within size limit', async () => {
      const result = await FileService.validateFile(sampleFiles.validImage, {
        maxSizeBytes: 10 * 1024 * 1024 // 10MB limit
      })
      
      expect(result.data?.isValid).toBe(true)
    })

    it('should validate file extensions', async () => {
      const result = await FileService.validateFile(sampleFiles.validCSV, {
        allowedExtensions: ['.csv', '.txt']
      })
      
      expect(result.data?.isValid).toBe(true)
    })

    it('should reject invalid file extensions', async () => {
      const result = await FileService.validateFile(sampleFiles.validImage, {
        allowedExtensions: ['.csv', '.txt']
      })
      
      expect(result.data?.isValid).toBe(false)
      expect(result.data?.errors).toContain('File extension is not allowed')
    })

    it('should handle custom MIME type validation', async () => {
      const result = await FileService.validateFile(sampleFiles.validImage, {
        allowedMimeTypes: ['image/jpeg', 'image/png']
      })
      
      expect(result.data?.isValid).toBe(true)
    })

    it('should reject invalid MIME types', async () => {
      const result = await FileService.validateFile(sampleFiles.validCSV, {
        allowedMimeTypes: ['image/jpeg', 'image/png']
      })
      
      expect(result.data?.isValid).toBe(false)
      expect(result.data?.errors).toContain('File MIME type is not allowed')
    })

    it('should handle file without extension', async () => {
      const fileWithoutExtension = new File(['content'], 'filename', { type: 'text/plain' })
      
      const result = await FileService.validateFile(fileWithoutExtension)
      
      expect(result.data?.isValid).toBe(false)
      expect(result.data?.errors).toContain('File has no extension')
    })

    it('should validate empty files', async () => {
      const result = await FileService.validateFile(sampleFiles.emptyCSV)
      
      expect(result.data?.isValid).toBe(false)
      expect(result.data?.errors).toContain('File appears to be empty')
    })
  })

  describe('uploadFile', () => {
    it('should upload valid file successfully', async () => {
      const result = await FileService.uploadFile(sampleFiles.validCSV)
      
      expect(result.data).toBeDefined()
      expect(result.data).toBe(sampleFiles.validCSV)
      expect(result.error).toBeUndefined()
    })

    it('should reject invalid file during upload', async () => {
      const result = await FileService.uploadFile(sampleFiles.unsupportedFile)
      
      expect(result.data).toBeUndefined()
      expect(result.error).toBeDefined()
      expect(result.error.userMessage).toContain('File validation failed')
    })

    it('should upload file with custom validation options', async () => {
      const result = await FileService.uploadFile(sampleFiles.validImage, {
        maxSizeBytes: 10 * 1024 * 1024,
        allowedMimeTypes: ['image/jpeg', 'image/png']
      })
      
      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
    })

    it('should handle upload with size validation failure', async () => {
      const result = await FileService.uploadFile(sampleFiles.largeImage, {
        maxSizeBytes: 1024 * 1024 // 1MB limit
      })
      
      expect(result.data).toBeUndefined()
      expect(result.error).toBeDefined()
    })
  })

  describe('getFileInfo', () => {
    it('should extract file information correctly', () => {
      const info = FileService.getFileInfo(sampleFiles.validCSV)
      
      expect(info.name).toBe('test.csv')
      expect(info.type).toBe('text/csv')
      expect(info.size).toBeGreaterThan(0)
      expect(info.extension).toBe('.csv')
      expect(info.lastModified).toBeDefined()
    })

    it('should handle file without extension', () => {
      const fileWithoutExt = new File(['content'], 'filename', { type: 'text/plain' })
      const info = FileService.getFileInfo(fileWithoutExt)
      
      expect(info.name).toBe('filename')
      expect(info.extension).toBe('')
    })

    it('should handle various file types', () => {
      const imageInfo = FileService.getFileInfo(sampleFiles.validImage)
      expect(imageInfo.type).toBe('image/jpeg')
      expect(imageInfo.extension).toBe('.jpg')

      const csvInfo = FileService.getFileInfo(sampleFiles.validCSV)
      expect(csvInfo.type).toBe('text/csv')
      expect(csvInfo.extension).toBe('.csv')
    })
  })

  describe('error handling', () => {
    it('should handle null file gracefully', async () => {
      const result = await FileService.validateFile(null as any)
      
      expect(result.error).toBeDefined()
      expect(result.error.userMessage).toContain('Invalid file')
    })

    it('should handle undefined file gracefully', async () => {
      const result = await FileService.uploadFile(undefined as any)
      
      expect(result.error).toBeDefined()
      expect(result.error.userMessage).toContain('Invalid file')
    })

    it('should provide meaningful error messages', async () => {
      const result = await FileService.validateFile(sampleFiles.unsupportedFile)
      
      expect(result.data?.errors).toContain('File type is not supported')
      expect(result.data?.warnings).toBeDefined()
    })
  })

  describe('performance considerations', () => {
    it('should handle large file validation efficiently', async () => {
      const start = Date.now()
      
      await FileService.validateFile(sampleFiles.largeCSV)
      
      const duration = Date.now() - start
      expect(duration).toBeLessThan(1000) // Should complete within 1 second
    })

    it('should not load entire file content for size validation', async () => {
      const spy = vi.spyOn(FileReader.prototype, 'readAsText')
      
      await FileService.validateFile(sampleFiles.largeCSV)
      
      // Size validation shouldn't require reading file content
      expect(spy).not.toHaveBeenCalled()
      
      spy.mockRestore()
    })
  })
})