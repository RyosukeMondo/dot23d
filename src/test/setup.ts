import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock ResizeObserver for tests
(globalThis as any).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Mock WebGL context for Three.js tests
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: function (contextType: string) {
    if (contextType === 'webgl' || contextType === 'webgl2') {
      return {
        canvas: this,
        clearColor: () => {},
        clear: () => {},
        clearDepth: () => {},
        clearStencil: () => {},
        viewport: () => {},
        drawElements: () => {},
        drawArrays: () => {},
        getExtension: () => null,
        getParameter: () => null,
        createShader: () => null,
        shaderSource: () => {},
        compileShader: () => {},
        createProgram: () => null,
        attachShader: () => {},
        linkProgram: () => {},
        useProgram: () => {},
        createBuffer: () => null,
        bindBuffer: () => {},
        bufferData: () => {},
        enableVertexAttribArray: () => {},
        vertexAttribPointer: () => {},
        enable: () => {},
        disable: () => {},
        blendFunc: () => {},
        depthFunc: () => {},
        cullFace: () => {},
      }
    }
    if (contextType === '2d') {
      return {
        canvas: this,
        putImageData: vi.fn(),
        getImageData: vi.fn(() => ({
          data: new Uint8ClampedArray(4),
          width: 1,
          height: 1,
          colorSpace: 'srgb',
        })),
        drawImage: vi.fn(),
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        rect: vi.fn(),
      }
    }
    return null
  },
})

// Mock browser APIs that are not available in JSDOM
Object.defineProperty(window, 'URL', {
  writable: true,
  value: {
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  },
})

// Mock FileReader
global.FileReader = vi.fn().mockImplementation(() => ({
  readAsText: vi.fn(),
  readAsArrayBuffer: vi.fn(),
  readAsDataURL: vi.fn(),
  onload: null,
  onerror: null,
  result: null,
}))

// Mock Image constructor
global.Image = vi.fn().mockImplementation(() => ({
  onload: null,
  onerror: null,
  src: '',
  width: 100,
  height: 100,
  naturalWidth: 100,
  naturalHeight: 100,
}))

// Global test utilities
export const createMockFile = (content: string, name: string, type: string): File => {
  const blob = new Blob([content], { type })
  return new File([blob], name, { type })
}

export const createMockImageData = (width = 10, height = 10): ImageData => {
  const data = new Uint8ClampedArray(width * height * 4)
  // Fill with some test data
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255     // R
    data[i + 1] = 255 // G
    data[i + 2] = 255 // B
    data[i + 3] = 255 // A
  }
  
  return {
    data,
    width,
    height,
    colorSpace: 'srgb' as PredefinedColorSpace,
  }
}

export const createMockDotPattern = (width = 5, height = 5) => {
  const data = Array(height).fill(null).map(() => 
    Array(width).fill(null).map(() => Math.random() > 0.5)
  )
  
  return {
    width,
    height,
    data,
    metadata: {
      source: 'test' as const,
    }
  }
}