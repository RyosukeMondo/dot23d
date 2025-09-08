import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import * as THREE from 'three'
import { Model3DService } from '@/services/Model3DService'
import type { DotPattern, Model3DParams, ExportParams } from '@/types'

type MeasurementTool = 'none' | 'distance' | 'angle' | 'area'

interface MeasurementPoint {
  id: string
  position: THREE.Vector3
  screenPosition: THREE.Vector2
}

interface Measurement {
  id: string
  type: MeasurementTool
  points: MeasurementPoint[]
  value: number
  label: string
  color: string
}

interface ModelViewerProps {
  pattern?: DotPattern
  model3DParams?: Model3DParams
  model?: any // For direct model input
  onExport?: (blob: Blob, filename: string) => void
  onError?: (error: string) => void
  showMeasurementTools?: boolean
  measurementPrecision?: number
}

export const ModelViewer: React.FC<ModelViewerProps> = ({
  pattern,
  model3DParams,
  model,
  onExport,
  onError,
  showMeasurementTools = false,
  measurementPrecision = 2
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

  // Measurement tool state
  const [activeTool, setActiveTool] = useState<MeasurementTool>('none')
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [tempPoints, setTempPoints] = useState<MeasurementPoint[]>([])
  const [isPlacingPoint, setIsPlacingPoint] = useState(false)
  const [hoveredPoint, setHoveredPoint] = useState<THREE.Vector3 | null>(null)
  
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster())
  const measurementGroupRef = useRef<THREE.Group>()

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

    // Initialize measurement group
    const measurementGroup = new THREE.Group()
    measurementGroupRef.current = measurementGroup
    scene.add(measurementGroup)

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

  // Measurement utility functions
  const generatePointId = useCallback(() => {
    return `point-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }, [])

  const generateMeasurementId = useCallback(() => {
    return `measurement-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }, [])

  const getIntersectionPoint = useCallback((clientX: number, clientY: number): THREE.Vector3 | null => {
    if (!cameraRef.current || !meshRef.current || !mountRef.current) return null

    const rect = mountRef.current.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )

    raycasterRef.current.setFromCamera(mouse, cameraRef.current)
    const intersects = raycasterRef.current.intersectObject(meshRef.current, true)

    return intersects.length > 0 ? intersects[0].point.clone() : null
  }, [])

  const worldToScreen = useCallback((worldPos: THREE.Vector3): THREE.Vector2 => {
    if (!cameraRef.current || !mountRef.current) return new THREE.Vector2()

    const vector = worldPos.clone()
    vector.project(cameraRef.current)

    const rect = mountRef.current.getBoundingClientRect()
    return new THREE.Vector2(
      (vector.x + 1) * rect.width / 2,
      -(vector.y - 1) * rect.height / 2
    )
  }, [])

  const calculateDistance = useCallback((p1: THREE.Vector3, p2: THREE.Vector3): number => {
    return p1.distanceTo(p2)
  }, [])

  const calculateAngle = useCallback((p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3): number => {
    const v1 = p1.clone().sub(p2).normalize()
    const v2 = p3.clone().sub(p2).normalize()
    return v1.angleTo(v2) * (180 / Math.PI)
  }, [])

  const calculateTriangleArea = useCallback((p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3): number => {
    const v1 = p2.clone().sub(p1)
    const v2 = p3.clone().sub(p1)
    return v1.cross(v2).length() / 2
  }, [])

  const createMeasurementPoint = useCallback((position: THREE.Vector3): MeasurementPoint => {
    return {
      id: generatePointId(),
      position: position.clone(),
      screenPosition: worldToScreen(position)
    }
  }, [generatePointId, worldToScreen])

  const createMeasurement = useCallback((points: MeasurementPoint[], tool: MeasurementTool): Measurement => {
    let value = 0
    let label = ''
    const colors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff']
    const color = colors[measurements.length % colors.length]

    switch (tool) {
      case 'distance':
        if (points.length >= 2) {
          value = calculateDistance(points[0].position, points[1].position)
          label = `${value.toFixed(measurementPrecision)} units`
        }
        break
      case 'angle':
        if (points.length >= 3) {
          value = calculateAngle(points[0].position, points[1].position, points[2].position)
          label = `${value.toFixed(measurementPrecision)}°`
        }
        break
      case 'area':
        if (points.length >= 3) {
          value = calculateTriangleArea(points[0].position, points[1].position, points[2].position)
          label = `${value.toFixed(measurementPrecision)} sq units`
        }
        break
    }

    return {
      id: generateMeasurementId(),
      type: tool,
      points,
      value,
      label,
      color
    }
  }, [measurements.length, calculateDistance, calculateAngle, calculateTriangleArea, measurementPrecision, generateMeasurementId])

  const addMeasurementVisuals = useCallback((measurement: Measurement) => {
    if (!measurementGroupRef.current) return

    const group = new THREE.Group()
    group.userData.measurementId = measurement.id

    // Create points
    measurement.points.forEach((point, index) => {
      const pointGeometry = new THREE.SphereGeometry(0.1, 8, 6)
      const pointMaterial = new THREE.MeshBasicMaterial({ color: measurement.color })
      const pointMesh = new THREE.Mesh(pointGeometry, pointMaterial)
      pointMesh.position.copy(point.position)
      group.add(pointMesh)

      // Add point labels
      if (index === 0 || measurement.type === 'angle') {
        const loader = new THREE.FontLoader()
        // For now, use a simple approach without font loading
        // In a production app, you'd want to load a proper font
      }
    })

    // Create lines between points
    if (measurement.points.length >= 2) {
      const linePoints = measurement.points.map(p => p.position)
      
      if (measurement.type === 'angle' && measurement.points.length >= 3) {
        // Draw two lines for angle measurement
        const geometry1 = new THREE.BufferGeometry().setFromPoints([linePoints[0], linePoints[1]])
        const geometry2 = new THREE.BufferGeometry().setFromPoints([linePoints[1], linePoints[2]])
        const lineMaterial = new THREE.LineBasicMaterial({ color: measurement.color })
        
        group.add(new THREE.Line(geometry1, lineMaterial))
        group.add(new THREE.Line(geometry2, lineMaterial))
        
        // Add arc to show angle
        const center = linePoints[1]
        const v1 = linePoints[0].clone().sub(center).normalize()
        const v2 = linePoints[2].clone().sub(center).normalize()
        const angle = v1.angleTo(v2)
        
        const arcGeometry = new THREE.BufferGeometry()
        const arcPoints = []
        const radius = 0.5
        for (let i = 0; i <= 20; i++) {
          const t = i / 20
          const currentAngle = t * angle
          const direction = v1.clone().multiplyScalar(Math.cos(currentAngle)).add(
            v1.clone().cross(v2).cross(v1).normalize().multiplyScalar(Math.sin(currentAngle))
          )
          arcPoints.push(center.clone().add(direction.multiplyScalar(radius)))
        }
        arcGeometry.setFromPoints(arcPoints)
        group.add(new THREE.Line(arcGeometry, lineMaterial))
      } else {
        // Draw single line or polygon
        const geometry = new THREE.BufferGeometry().setFromPoints(linePoints)
        const lineMaterial = new THREE.LineBasicMaterial({ color: measurement.color })
        if (measurement.type === 'area' && linePoints.length >= 3) {
          linePoints.push(linePoints[0]) // Close the shape
          geometry.setFromPoints(linePoints)
        }
        group.add(new THREE.Line(geometry, lineMaterial))
      }
    }

    measurementGroupRef.current.add(group)
  }, [])

  const removeMeasurementVisuals = useCallback((measurementId: string) => {
    if (!measurementGroupRef.current) return

    const group = measurementGroupRef.current.children.find(
      child => child.userData.measurementId === measurementId
    )
    if (group) {
      measurementGroupRef.current.remove(group)
      // Dispose of geometries and materials
      group.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose()
          if (Array.isArray(obj.material)) {
            obj.material.forEach(mat => mat.dispose())
          } else {
            obj.material.dispose()
          }
        }
      })
    }
  }, [])

  // Generate and update 3D model
  useEffect(() => {
    if (!sceneRef.current || (!pattern && !model)) return

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

      // Generate new mesh - either from pattern or use provided model
      let mesh: THREE.Group
      if (model) {
        // Use provided model directly
        mesh = model
      } else if (pattern && model3DParams) {
        // Generate from pattern and parameters
        mesh = Model3DService.generatePreviewMesh(pattern, model3DParams)
      } else {
        throw new Error('No pattern or model provided')
      }

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
      if (pattern && model3DParams) {
        const stats = Model3DService.getMeshStats(mesh)
        setMeshStats({
          vertices: stats.vertexCount,
          faces: stats.faceCount,
          activeDots: stats.cubeCount
        })
      } else {
        // For direct model input, calculate basic stats
        let vertexCount = 0
        let faceCount = 0
        mesh.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.geometry.attributes.position) {
              vertexCount += child.geometry.attributes.position.count
            }
            if (child.geometry.index) {
              faceCount += child.geometry.index.count / 3
            }
          }
        })
        setMeshStats({
          vertices: vertexCount,
          faces: Math.floor(faceCount),
          activeDots: 0 // Unknown for direct models
        })
      }

    } catch (error) {
      if (onError) {
        onError(error instanceof Error ? error.message : 'Failed to generate 3D model')
      }
    } finally {
      setIsLoading(false)
    }
  }, [pattern, model3DParams, model, onError])

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
    
    // Handle measurement tool interaction
    if (showMeasurementTools && activeTool !== 'none') {
      const intersection = getIntersectionPoint(event.clientX, event.clientY)
      if (intersection) {
        const newPoint = createMeasurementPoint(intersection)
        setTempPoints(prev => {
          const updated = [...prev, newPoint]
          
          // Check if we have enough points for the current tool
          const requiredPoints = activeTool === 'distance' ? 2 : 3
          if (updated.length >= requiredPoints) {
            // Create measurement
            const measurement = createMeasurement(updated, activeTool)
            setMeasurements(prev => [...prev, measurement])
            addMeasurementVisuals(measurement)
            return [] // Clear temp points
          }
          return updated
        })
        return
      }
    }
    
    // Default camera rotation behavior
    controlsRef.current.isRotating = true
    controlsRef.current.lastMousePosition = {
      x: event.clientX,
      y: event.clientY
    }
  }, [showMeasurementTools, activeTool, getIntersectionPoint, createMeasurementPoint, createMeasurement, addMeasurementVisuals])

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    // Update hover point for measurement tools
    if (showMeasurementTools && activeTool !== 'none') {
      const intersection = getIntersectionPoint(event.clientX, event.clientY)
      setHoveredPoint(intersection)
    }

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
  }, [showMeasurementTools, activeTool, getIntersectionPoint])

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

  // Measurement tool functions
  const handleToolChange = useCallback((tool: MeasurementTool) => {
    setActiveTool(tool)
    setTempPoints([])
    setHoveredPoint(null)
  }, [])

  const handleClearMeasurements = useCallback(() => {
    measurements.forEach(measurement => {
      removeMeasurementVisuals(measurement.id)
    })
    setMeasurements([])
    setTempPoints([])
    setHoveredPoint(null)
  }, [measurements, removeMeasurementVisuals])

  const handleDeleteMeasurement = useCallback((measurementId: string) => {
    removeMeasurementVisuals(measurementId)
    setMeasurements(prev => prev.filter(m => m.id !== measurementId))
  }, [removeMeasurementVisuals])

  const handleExport = useCallback(async () => {
    if (!meshRef.current) {
      if (onError) onError('No model to export')
      return
    }

    setIsExporting(true)

    try {
      if (onExport) {
        const { blob, filename } = Model3DService.exportOBJ(meshRef.current, exportParams)
        onExport(blob, filename)
      }
    } catch (error) {
      if (onError) onError(error instanceof Error ? error.message : 'Failed to export model')
    } finally {
      setIsExporting(false)
    }
  }, [onExport, onError, exportParams])

  const printEstimates = useMemo(() => {
    return pattern && model3DParams ? Model3DService.calculatePrintEstimates(pattern, model3DParams) : null
  }, [pattern, model3DParams])

  return (
    <div className="model-viewer">
      <div className="viewer-header">
        <h2>3D Model Preview</h2>
        {meshStats && (
          <div className="model-stats">
            <span>Vertices: {meshStats.vertices.toLocaleString()}</span>
            <span>Faces: {meshStats.faces.toLocaleString()}</span>
            {meshStats.activeDots > 0 && <span>Active Dots: {meshStats.activeDots.toLocaleString()}</span>}
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

        {showMeasurementTools && (
          <div className="control-group">
            <h4>Measurement Tools</h4>
            <div className="control-buttons">
              <button 
                onClick={() => handleToolChange('none')} 
                className={activeTool === 'none' ? 'active' : ''}
              >
                ✋ None
              </button>
              <button 
                onClick={() => handleToolChange('distance')} 
                className={activeTool === 'distance' ? 'active' : ''}
              >
                📏 Distance
              </button>
              <button 
                onClick={() => handleToolChange('angle')} 
                className={activeTool === 'angle' ? 'active' : ''}
              >
                📐 Angle
              </button>
              <button 
                onClick={() => handleToolChange('area')} 
                className={activeTool === 'area' ? 'active' : ''}
              >
                📐 Area
              </button>
              <button onClick={handleClearMeasurements}>
                🗑️ Clear All
              </button>
            </div>
            {activeTool !== 'none' && (
              <div className="measurement-help">
                <p>
                  {activeTool === 'distance' && 'Click two points to measure distance'}
                  {activeTool === 'angle' && 'Click three points to measure angle'}
                  {activeTool === 'area' && 'Click three points to measure triangle area'}
                </p>
                {tempPoints.length > 0 && (
                  <p>Points placed: {tempPoints.length} / {activeTool === 'distance' ? 2 : 3}</p>
                )}
              </div>
            )}
          </div>
        )}

        {onExport && (
          <div className="control-group">
            <h4>Export</h4>
            <div className="export-info">
              {printEstimates && (
                <div className="print-estimates">
                  <span>Print Time: {printEstimates.estimatedPrintTime}</span>
                  <span>Material: {printEstimates.estimatedMaterial}</span>
                  <span>Est. Cost: {printEstimates.estimatedCost}</span>
                </div>
              )}
              <button 
                onClick={handleExport}
                disabled={isExporting || isLoading}
                className="export-button"
              >
                {isExporting ? '⏳ Exporting...' : '💾 Export OBJ'}
              </button>
            </div>
          </div>
        )}
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
          cursor: showMeasurementTools && activeTool !== 'none' ? 'crosshair' : 
                  controlsRef.current?.isRotating ? 'grabbing' : 'grab',
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

        {/* Measurement overlays */}
        {showMeasurementTools && (
          <>
            {/* Temporary points during measurement */}
            {tempPoints.map((point, index) => (
              <div
                key={point.id}
                style={{
                  position: 'absolute',
                  left: `${point.screenPosition.x - 4}px`,
                  top: `${point.screenPosition.y - 4}px`,
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#ff4444',
                  borderRadius: '50%',
                  border: '2px solid white',
                  pointerEvents: 'none',
                  zIndex: 1000
                }}
              />
            ))}

            {/* Hover point */}
            {hoveredPoint && (
              <div
                style={{
                  position: 'absolute',
                  left: `${worldToScreen(hoveredPoint).x - 2}px`,
                  top: `${worldToScreen(hoveredPoint).y - 2}px`,
                  width: '4px',
                  height: '4px',
                  backgroundColor: '#ffffff',
                  borderRadius: '50%',
                  border: '1px solid #333',
                  pointerEvents: 'none',
                  zIndex: 999
                }}
              />
            )}

            {/* Measurement labels */}
            {measurements.map((measurement) => {
              const centerPoint = measurement.points.reduce(
                (acc, point) => acc.add(point.position), 
                new THREE.Vector3()
              ).divideScalar(measurement.points.length)
              const screenPos = worldToScreen(centerPoint)
              
              return (
                <div
                  key={measurement.id}
                  style={{
                    position: 'absolute',
                    left: `${screenPos.x}px`,
                    top: `${screenPos.y - 30}px`,
                    background: 'rgba(0, 0, 0, 0.8)',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    whiteSpace: 'nowrap',
                    transform: 'translateX(-50%)',
                    pointerEvents: 'none',
                    zIndex: 1001
                  }}
                >
                  <div style={{ color: measurement.color, fontWeight: 'bold' }}>
                    {measurement.label}
                  </div>
                  <button
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ff4444',
                      cursor: 'pointer',
                      fontSize: '10px',
                      padding: 0,
                      marginLeft: '8px',
                      pointerEvents: 'auto'
                    }}
                    onClick={() => handleDeleteMeasurement(measurement.id)}
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </>
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