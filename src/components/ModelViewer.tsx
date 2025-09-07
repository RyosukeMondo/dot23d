import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import * as THREE from 'three'
import { Model3DService } from '@/services/Model3DService'
import type { DotPattern, Model3DParams, ExportParams } from '@/types'

interface ModelViewerProps {
  pattern: DotPattern
  model3DParams: Model3DParams
  onExport: (blob: Blob, filename: string) => void
  onError: (error: string) => void
}

export const ModelViewer: React.FC<ModelViewerProps> = ({
  pattern,
  model3DParams,
  onExport,
  onError
}) => {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene>()
  const rendererRef = useRef<THREE.WebGLRenderer>()
  const cameraRef = useRef<THREE.PerspectiveCamera>()
  const meshRef = useRef<THREE.Group>()
  const animationFrameRef = useRef<number>()
  const controlsRef = useRef<{
    isRotating: boolean
    lastMousePosition: { x: number; y: number }
    cameraDistance: number
    cameraAngleX: number
    cameraAngleY: number
  }>({
    isRotating: false,
    lastMousePosition: { x: 0, y: 0 },
    cameraDistance: 50,
    cameraAngleX: Math.PI * 0.3,
    cameraAngleY: 0
  })

  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [meshStats, setMeshStats] = useState<{
    vertices: number
    faces: number
    activeDots: number
  } | null>(null)

  const exportParams: ExportParams = useMemo(() => 
    Model3DService.getDefaultExportParams()
  , [])

  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current) return

    const mount = mountRef.current
    const width = mount.clientWidth
    const height = mount.clientHeight

    // Scene setup
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf5f5f5)
    sceneRef.current = scene

    // Camera setup
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
    cameraRef.current = camera

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setClearColor(0xf5f5f5)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    rendererRef.current = renderer

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(10, 10, 5)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    scene.add(directionalLight)

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3)
    fillLight.position.set(-10, -10, -5)
    scene.add(fillLight)

    // Ground plane for shadows
    const planeGeometry = new THREE.PlaneGeometry(200, 200)
    const planeMaterial = new THREE.ShadowMaterial({ opacity: 0.2 })
    const plane = new THREE.Mesh(planeGeometry, planeMaterial)
    plane.rotation.x = -Math.PI / 2
    plane.position.y = -10
    plane.receiveShadow = true
    scene.add(plane)

    mount.appendChild(renderer.domElement)

    // Handle window resize
    const handleResize = () => {
      if (!mountRef.current || !camera || !renderer) return
      
      const width = mountRef.current.clientWidth
      const height = mountRef.current.clientHeight
      
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (mount && renderer.domElement) {
        mount.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
  }, [])

  // Generate and update 3D model
  useEffect(() => {
    if (!sceneRef.current || !pattern) return

    setIsLoading(true)

    try {
      // Remove existing mesh
      if (meshRef.current) {
        sceneRef.current.remove(meshRef.current)
        // Dispose of geometries and materials
        meshRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose()
            if (Array.isArray(child.material)) {
              child.material.forEach(material => material.dispose())
            } else {
              child.material.dispose()
            }
          }
        })
      }

      // Generate new mesh
      const mesh = Model3DService.generatePreviewMesh(pattern, model3DParams)
      mesh.castShadow = true
      mesh.receiveShadow = true

      // Apply material to all mesh children
      const material = new THREE.MeshLambertMaterial({ color: 0x2196f3 })
      mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = material
          child.castShadow = true
          child.receiveShadow = true
        }
      })

      meshRef.current = mesh
      sceneRef.current.add(mesh)

      // Center the model and adjust camera
      const box = new THREE.Box3().setFromObject(mesh)
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())

      // Center the mesh
      mesh.position.sub(center)

      // Adjust camera distance based on model size
      const maxDim = Math.max(size.x, size.y, size.z)
      controlsRef.current.cameraDistance = maxDim * 2

      // Calculate mesh statistics
      const stats = Model3DService.getMeshStats(mesh)
      setMeshStats({
        vertices: stats.vertexCount,
        faces: stats.faceCount,
        activeDots: stats.cubeCount
      })

    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to generate 3D model')
    } finally {
      setIsLoading(false)
    }
  }, [pattern, model3DParams, onError])

  // Animation loop
  useEffect(() => {
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate)

      if (!cameraRef.current || !rendererRef.current || !sceneRef.current) return

      const controls = controlsRef.current
      const camera = cameraRef.current

      // Update camera position based on controls
      camera.position.x = Math.sin(controls.cameraAngleY) * Math.cos(controls.cameraAngleX) * controls.cameraDistance
      camera.position.y = Math.sin(controls.cameraAngleX) * controls.cameraDistance
      camera.position.z = Math.cos(controls.cameraAngleY) * Math.cos(controls.cameraAngleX) * controls.cameraDistance

      camera.lookAt(0, 0, 0)

      rendererRef.current.render(sceneRef.current, camera)
    }

    animate()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  // Mouse interaction handlers
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    controlsRef.current.isRotating = true
    controlsRef.current.lastMousePosition = {
      x: event.clientX,
      y: event.clientY
    }
  }, [])

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!controlsRef.current.isRotating) return

    event.preventDefault()

    const deltaX = event.clientX - controlsRef.current.lastMousePosition.x
    const deltaY = event.clientY - controlsRef.current.lastMousePosition.y

    controlsRef.current.cameraAngleY += deltaX * 0.005
    controlsRef.current.cameraAngleX = Math.max(
      -Math.PI / 2 + 0.1,
      Math.min(Math.PI / 2 - 0.1, controlsRef.current.cameraAngleX - deltaY * 0.005)
    )

    controlsRef.current.lastMousePosition = {
      x: event.clientX,
      y: event.clientY
    }
  }, [])

  const handleMouseUp = useCallback(() => {
    controlsRef.current.isRotating = false
  }, [])

  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault()
    const zoomSpeed = 0.1
    const zoomFactor = event.deltaY > 0 ? 1 + zoomSpeed : 1 - zoomSpeed
    
    controlsRef.current.cameraDistance = Math.max(
      5,
      Math.min(200, controlsRef.current.cameraDistance * zoomFactor)
    )
  }, [])

  const handleResetView = useCallback(() => {
    controlsRef.current.cameraDistance = 50
    controlsRef.current.cameraAngleX = Math.PI * 0.3
    controlsRef.current.cameraAngleY = 0
  }, [])

  const handleExport = useCallback(async () => {
    if (!meshRef.current) {
      onError('No model to export')
      return
    }

    setIsExporting(true)

    try {
      const { blob, filename } = Model3DService.exportOBJ(meshRef.current, exportParams)
      onExport(blob, filename)
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to export model')
    } finally {
      setIsExporting(false)
    }
  }, [onExport, onError, exportParams])

  const printEstimates = useMemo(() => {
    return Model3DService.calculatePrintEstimates(pattern, model3DParams)
  }, [pattern, model3DParams])

  return (
    <div className="model-viewer">
      <div className="viewer-header">
        <h2>3D Model Preview</h2>
        {meshStats && (
          <div className="model-stats">
            <span>Vertices: {meshStats.vertices.toLocaleString()}</span>
            <span>Faces: {meshStats.faces.toLocaleString()}</span>
            <span>Active Dots: {meshStats.activeDots.toLocaleString()}</span>
          </div>
        )}
      </div>

      <div className="viewer-controls">
        <div className="control-group">
          <h4>View Controls</h4>
          <div className="control-buttons">
            <button onClick={handleResetView}>
              🏠 Reset View
            </button>
          </div>
        </div>

        <div className="control-group">
          <h4>Export</h4>
          <div className="export-info">
            <div className="print-estimates">
              <span>Print Time: {printEstimates.estimatedPrintTime}</span>
              <span>Material: {printEstimates.estimatedMaterial}</span>
              <span>Est. Cost: {printEstimates.estimatedCost}</span>
            </div>
            <button 
              onClick={handleExport}
              disabled={isExporting || isLoading}
              className="export-button"
            >
              {isExporting ? '⏳ Exporting...' : '💾 Export OBJ'}
            </button>
          </div>
        </div>
      </div>

      <div
        ref={mountRef}
        className="viewer-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{
          width: '100%',
          height: '400px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          cursor: controlsRef.current?.isRotating ? 'grabbing' : 'grab',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {isLoading && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(255, 255, 255, 0.9)',
            padding: '20px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{
              width: '20px',
              height: '20px',
              border: '2px solid #f3f3f3',
              borderTop: '2px solid #3498db',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            Generating 3D model...
          </div>
        )}
      </div>

      <div className="viewer-help">
        <p><strong>Controls:</strong></p>
        <ul>
          <li>Left click + drag: Rotate model</li>
          <li>Scroll wheel: Zoom in/out</li>
          <li>Reset view: Return to default angle</li>
          <li>Export OBJ: Download 3D model for printing</li>
        </ul>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default ModelViewer