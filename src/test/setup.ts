import '@testing-library/jest-dom'

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
    return null
  },
})