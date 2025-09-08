import * as THREE from 'three'
import type { 
  QualityReport,
  QualityRecommendation,
  QualityWarning,
  OverhangAnalysis,
  ThicknessAnalysis,
  BridgingAnalysis,
  Measurement
} from '@/types'

/**
 * Custom error for quality assessment operations
 */
export class QualityAssessmentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QualityAssessmentError'
  }
}

/**
 * Configuration for quality assessment parameters
 */
export interface QualityAssessmentConfig {
  /** Minimum wall thickness for printability (mm) */
  minWallThickness: number
  /** Maximum overhang angle before support needed (degrees) */
  maxOverhangAngle: number
  /** Maximum bridge length without support (mm) */
  maxBridgeLength: number
  /** Tolerance for geometry validation */
  geometryTolerance: number
}

/**
 * Service for comprehensive 3D model quality assessment and analysis
 */
export class QualityAssessmentService {
  private static readonly DEFAULT_CONFIG: QualityAssessmentConfig = {
    minWallThickness: 0.8, // 0.8mm minimum for most FDM printers
    maxOverhangAngle: 45, // 45 degrees maximum overhang
    maxBridgeLength: 10, // 10mm maximum bridge length
    geometryTolerance: 0.001 // 0.001mm tolerance
  }

  /**
   * Perform comprehensive quality assessment of a 3D model
   */
  static assessQuality(
    mesh: THREE.Group,
    modelId: string,
    config: Partial<QualityAssessmentConfig> = {}
  ): QualityReport {
    const assessmentConfig = { ...this.DEFAULT_CONFIG, ...config }
    
    try {
      // Extract geometry data from the mesh
      const geometryData = this.extractGeometryData(mesh)
      
      // Perform geometry analysis
      const geometryAnalysis = this.analyzeGeometry(geometryData, assessmentConfig)
      
      // Perform printability analysis
      const printabilityAnalysis = this.analyzePrintability(geometryData, assessmentConfig)
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(geometryAnalysis, printabilityAnalysis, assessmentConfig)
      
      // Generate warnings
      const warnings = this.generateWarnings(geometryAnalysis, printabilityAnalysis)
      
      // Calculate overall score
      const overallScore = this.calculateOverallScore(geometryAnalysis, printabilityAnalysis)
      
      return {
        modelId,
        timestamp: new Date(),
        overallScore,
        geometry: {
          manifoldness: geometryAnalysis.manifoldness,
          watertightness: geometryAnalysis.watertightness,
          selfIntersections: geometryAnalysis.selfIntersections,
          duplicateVertices: geometryAnalysis.duplicateVertices
        },
        printability: {
          overhangs: printabilityAnalysis.overhangs,
          supportNeed: printabilityAnalysis.supportNeed,
          wallThickness: printabilityAnalysis.wallThickness,
          bridging: printabilityAnalysis.bridging
        },
        recommendations,
        warnings
      }
      
    } catch (error) {
      throw new QualityAssessmentError(
        `Quality assessment failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Analyze geometry for specific issues
   */
  static analyzeGeometry(mesh: THREE.Group): {
    manifoldIssues: string[]
    selfIntersections: number
    duplicateVertices: number
    faceNormals: { inconsistent: number; total: number }
  } {
    try {
      const geometryData = this.extractGeometryData(mesh)
      const analysis = this.analyzeGeometry(geometryData, this.DEFAULT_CONFIG)
      
      return {
        manifoldIssues: this.findManifoldIssues(geometryData),
        selfIntersections: analysis.selfIntersections,
        duplicateVertices: analysis.duplicateVertices,
        faceNormals: this.analyzeFaceNormals(geometryData)
      }
    } catch (error) {
      throw new QualityAssessmentError(`Geometry analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Analyze printability characteristics
   */
  static analyzePrintability(mesh: THREE.Group): {
    overhangs: OverhangAnalysis[]
    bridgeSpans: BridgingAnalysis[]
    supportVolume: number
    printTime: number
  } {
    try {
      const geometryData = this.extractGeometryData(mesh)
      const printabilityAnalysis = this.analyzePrintability(geometryData, this.DEFAULT_CONFIG)
      
      // Calculate additional metrics
      const supportVolume = this.calculateSupportVolume(printabilityAnalysis.overhangs, printabilityAnalysis.bridging)
      const printTime = this.estimatePrintTime(geometryData, supportVolume)
      
      return {
        overhangs: printabilityAnalysis.overhangs,
        bridgeSpans: printabilityAnalysis.bridging,
        supportVolume,
        printTime
      }
    } catch (error) {
      throw new QualityAssessmentError(`Printability analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Create measurements for the 3D model
   */
  static createMeasurement(
    type: 'distance' | 'angle' | 'area' | 'volume',
    points: Array<{ x: number; y: number; z: number }>,
    label: string
  ): Measurement {
    let value = 0
    let unit = ''

    switch (type) {
      case 'distance':
        if (points.length !== 2) throw new QualityAssessmentError('Distance measurement requires exactly 2 points')
        value = this.calculateDistance(points[0], points[1])
        unit = 'mm'
        break
      
      case 'angle':
        if (points.length !== 3) throw new QualityAssessmentError('Angle measurement requires exactly 3 points')
        value = this.calculateAngle(points[0], points[1], points[2])
        unit = 'degrees'
        break
      
      case 'area':
        if (points.length < 3) throw new QualityAssessmentError('Area measurement requires at least 3 points')
        value = this.calculatePolygonArea(points)
        unit = 'mm²'
        break
      
      case 'volume':
        throw new QualityAssessmentError('Volume measurement not yet implemented')
    }

    return {
      id: `measurement-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      points,
      value,
      unit,
      label,
      visible: true
    }
  }

  /**
   * Compare quality between multiple models
   */
  static compareQuality(reports: QualityReport[]): {
    bestOverall: string
    comparison: Array<{
      modelId: string
      score: number
      strengths: string[]
      weaknesses: string[]
    }>
    recommendations: string[]
  } {
    if (reports.length === 0) {
      throw new QualityAssessmentError('No quality reports provided for comparison')
    }

    const comparison = reports.map(report => ({
      modelId: report.modelId,
      score: report.overallScore,
      strengths: this.identifyStrengths(report),
      weaknesses: this.identifyWeaknesses(report)
    }))

    // Sort by score
    comparison.sort((a, b) => b.score - a.score)
    
    const bestOverall = comparison[0].modelId
    const globalRecommendations = this.generateGlobalRecommendations(reports)

    return {
      bestOverall,
      comparison,
      recommendations: globalRecommendations
    }
  }

  /**
   * Generate optimization suggestions for improving quality
   */
  static generateOptimizationPlan(report: QualityReport): {
    priority: 'low' | 'medium' | 'high'
    actions: Array<{
      action: string
      impact: 'low' | 'medium' | 'high'
      difficulty: 'easy' | 'medium' | 'hard'
      expectedImprovement: string
    }>
  } {
    const actions: Array<{
      action: string
      impact: 'low' | 'medium' | 'high'
      difficulty: 'easy' | 'medium' | 'hard'
      expectedImprovement: string
    }> = []

    // Analyze geometric issues
    if (report.geometry.manifoldness < 95) {
      actions.push({
        action: 'Fix non-manifold geometry by repairing edges and vertices',
        impact: 'high',
        difficulty: 'medium',
        expectedImprovement: '+15-25 quality points'
      })
    }

    if (report.geometry.selfIntersections > 0) {
      actions.push({
        action: 'Resolve self-intersecting faces',
        impact: 'high',
        difficulty: 'hard',
        expectedImprovement: '+20-30 quality points'
      })
    }

    // Analyze printability issues
    if (report.printability.supportNeed > 80) {
      actions.push({
        action: 'Redesign to reduce support requirements',
        impact: 'medium',
        difficulty: 'hard',
        expectedImprovement: 'Reduced print time and material usage'
      })
    }

    if (report.printability.wallThickness.minThickness < 0.8) {
      actions.push({
        action: 'Increase wall thickness to minimum printable dimensions',
        impact: 'high',
        difficulty: 'easy',
        expectedImprovement: 'Improved structural integrity'
      })
    }

    // Determine overall priority
    let priority: 'low' | 'medium' | 'high' = 'low'
    if (report.overallScore < 50) {
      priority = 'high'
    } else if (report.overallScore < 75) {
      priority = 'medium'
    }

    return { priority, actions }
  }

  /**
   * Private helper methods
   */

  private static extractGeometryData(mesh: THREE.Group): GeometryData {
    const vertices: THREE.Vector3[] = []
    const faces: Face[] = []
    const normals: THREE.Vector3[] = []
    
    mesh.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const geometry = child.geometry
        const position = geometry.attributes.position
        const normal = geometry.attributes.normal
        const index = geometry.index

        if (position) {
          const worldMatrix = child.matrixWorld
          const localVertices: THREE.Vector3[] = []
          
          for (let i = 0; i < position.count; i++) {
            const vertex = new THREE.Vector3().fromBufferAttribute(position, i)
            vertex.applyMatrix4(worldMatrix)
            vertices.push(vertex)
            localVertices.push(vertex)
          }

          // Extract faces
          if (index) {
            for (let i = 0; i < index.count; i += 3) {
              faces.push({
                vertices: [
                  index.getX(i),
                  index.getX(i + 1),
                  index.getX(i + 2)
                ],
                normal: normal ? new THREE.Vector3().fromBufferAttribute(normal, i) : new THREE.Vector3()
              })
            }
          }

          // Extract normals
          if (normal) {
            for (let i = 0; i < normal.count; i++) {
              normals.push(new THREE.Vector3().fromBufferAttribute(normal, i))
            }
          }
        }
      }
    })

    return { vertices, faces, normals }
  }

  private static analyzeGeometry(data: GeometryData, config: QualityAssessmentConfig): GeometryAnalysisResult {
    // Manifoldness check
    const manifoldness = this.checkManifoldness(data)
    
    // Watertightness check
    const watertightness = this.checkWatertightness(data)
    
    // Self-intersection detection
    const selfIntersections = this.detectSelfIntersections(data)
    
    // Duplicate vertex detection
    const duplicateVertices = this.detectDuplicateVertices(data, config.geometryTolerance)

    return {
      manifoldness,
      watertightness,
      selfIntersections,
      duplicateVertices
    }
  }

  private static analyzePrintability(data: GeometryData, config: QualityAssessmentConfig): PrintabilityAnalysisResult {
    // Overhang analysis
    const overhangs = this.analyzeOverhangs(data, config.maxOverhangAngle)
    
    // Wall thickness analysis
    const wallThickness = this.analyzeWallThickness(data, config.minWallThickness)
    
    // Bridge analysis
    const bridging = this.analyzeBridges(data, config.maxBridgeLength)
    
    // Calculate support need score
    const supportNeed = this.calculateSupportNeed(overhangs, bridging)

    return {
      overhangs,
      wallThickness,
      bridging,
      supportNeed
    }
  }

  private static checkManifoldness(data: GeometryData): number {
    // Simplified manifoldness check
    // In a real implementation, this would check if each edge is shared by exactly 2 faces
    let manifoldEdges = 0
    let totalEdges = 0

    const edges = new Map<string, number>()
    
    data.faces.forEach(face => {
      const edgeKeys = [
        `${Math.min(face.vertices[0], face.vertices[1])}-${Math.max(face.vertices[0], face.vertices[1])}`,
        `${Math.min(face.vertices[1], face.vertices[2])}-${Math.max(face.vertices[1], face.vertices[2])}`,
        `${Math.min(face.vertices[2], face.vertices[0])}-${Math.max(face.vertices[2], face.vertices[0])}`
      ]
      
      edgeKeys.forEach(key => {
        edges.set(key, (edges.get(key) || 0) + 1)
        totalEdges++
      })
    })

    edges.forEach(count => {
      if (count === 2) manifoldEdges++
    })

    return totalEdges > 0 ? (manifoldEdges / totalEdges) * 100 : 100
  }

  private static checkWatertightness(data: GeometryData): number {
    // Simplified watertightness check
    // This is a basic implementation - full watertightness is complex
    return this.checkManifoldness(data) // Using manifoldness as proxy for now
  }

  private static detectSelfIntersections(data: GeometryData): number {
    // Simplified self-intersection detection
    // In practice, this would use more sophisticated spatial indexing
    return 0 // Placeholder - complex geometric algorithm required
  }

  private static detectDuplicateVertices(data: GeometryData, tolerance: number): number {
    let duplicates = 0
    const seen = new Set<string>()

    data.vertices.forEach(vertex => {
      const key = `${Math.round(vertex.x / tolerance)},${Math.round(vertex.y / tolerance)},${Math.round(vertex.z / tolerance)}`
      if (seen.has(key)) {
        duplicates++
      } else {
        seen.add(key)
      }
    })

    return duplicates
  }

  private static analyzeOverhangs(data: GeometryData, maxAngle: number): OverhangAnalysis[] {
    const overhangs: OverhangAnalysis[] = []
    const upVector = new THREE.Vector3(0, 1, 0)

    data.faces.forEach((face, index) => {
      if (face.normal.y < 0) { // Face pointing downward
        const angle = Math.acos(Math.abs(face.normal.dot(upVector))) * (180 / Math.PI)
        
        if (angle > maxAngle) {
          const centerVertex = this.calculateFaceCenter(face, data.vertices)
          
          overhangs.push({
            position: { x: centerVertex.x, y: centerVertex.y, z: centerVertex.z },
            angle,
            severity: angle > 60 ? 'high' : angle > 50 ? 'medium' : 'low',
            suggestion: angle > 60 ? 'Requires support structures' : 'Consider adding supports'
          })
        }
      }
    })

    return overhangs
  }

  private static analyzeWallThickness(data: GeometryData, minThickness: number): ThicknessAnalysis {
    // Simplified wall thickness analysis
    // This is a placeholder - real implementation requires complex geometric analysis
    const estimatedMinThickness = minThickness * 1.2 // Conservative estimate
    
    return {
      minThickness: estimatedMinThickness,
      averageThickness: minThickness * 2,
      thinAreas: [], // Would be populated by actual analysis
      recommendedMinimum: minThickness
    }
  }

  private static analyzeBridges(data: GeometryData, maxLength: number): BridgingAnalysis[] {
    // Simplified bridge analysis
    // Real implementation would detect horizontal spans without support
    return [] // Placeholder
  }

  private static calculateSupportNeed(overhangs: OverhangAnalysis[], bridges: BridgingAnalysis[]): number {
    const severeOverhangs = overhangs.filter(o => o.severity === 'high').length
    const moderateOverhangs = overhangs.filter(o => o.severity === 'medium').length
    const unprintableBridges = bridges.filter(b => !b.printable).length

    const score = (severeOverhangs * 30 + moderateOverhangs * 15 + unprintableBridges * 20)
    return Math.min(100, score)
  }

  private static generateRecommendations(
    geometryAnalysis: GeometryAnalysisResult,
    printabilityAnalysis: PrintabilityAnalysisResult,
    config: QualityAssessmentConfig
  ): QualityRecommendation[] {
    const recommendations: QualityRecommendation[] = []

    if (geometryAnalysis.manifoldness < 95) {
      recommendations.push({
        type: 'geometry',
        priority: 'high',
        message: 'Model has non-manifold geometry that may cause printing issues',
        action: 'Use mesh repair tools to fix non-manifold edges and vertices',
        expectedImprovement: 'Improved print reliability and quality'
      })
    }

    if (printabilityAnalysis.supportNeed > 70) {
      recommendations.push({
        type: 'printing',
        priority: 'medium',
        message: 'Model requires significant support structures',
        action: 'Consider reorienting the model or redesigning overhanging features',
        expectedImprovement: 'Reduced support material and print time'
      })
    }

    if (printabilityAnalysis.wallThickness.minThickness < config.minWallThickness) {
      recommendations.push({
        type: 'printing',
        priority: 'high',
        message: 'Some walls are too thin for reliable printing',
        action: 'Increase wall thickness or use higher resolution printer settings',
        expectedImprovement: 'Improved structural integrity and print success rate'
      })
    }

    return recommendations
  }

  private static generateWarnings(
    geometryAnalysis: GeometryAnalysisResult,
    printabilityAnalysis: PrintabilityAnalysisResult
  ): QualityWarning[] {
    const warnings: QualityWarning[] = []

    if (geometryAnalysis.selfIntersections > 0) {
      warnings.push({
        category: 'geometry',
        severity: 'error',
        message: 'Self-intersecting geometry detected',
        resolution: 'Use mesh repair tools to resolve intersections'
      })
    }

    if (geometryAnalysis.duplicateVertices > 10) {
      warnings.push({
        category: 'geometry',
        severity: 'warning',
        message: 'Multiple duplicate vertices found',
        resolution: 'Use mesh cleanup tools to remove duplicate vertices'
      })
    }

    return warnings
  }

  private static calculateOverallScore(
    geometryAnalysis: GeometryAnalysisResult,
    printabilityAnalysis: PrintabilityAnalysisResult
  ): number {
    // Weighted scoring algorithm
    const geometryScore = (
      geometryAnalysis.manifoldness * 0.3 +
      geometryAnalysis.watertightness * 0.2 +
      (100 - Math.min(100, geometryAnalysis.selfIntersections)) * 0.3 +
      (100 - Math.min(100, geometryAnalysis.duplicateVertices / 10)) * 0.2
    )

    const printabilityScore = (
      (100 - printabilityAnalysis.supportNeed) * 0.4 +
      Math.min(100, (printabilityAnalysis.wallThickness.minThickness / 0.8) * 100) * 0.6
    )

    return Math.round((geometryScore * 0.6 + printabilityScore * 0.4))
  }

  private static calculateDistance(p1: { x: number; y: number; z: number }, p2: { x: number; y: number; z: number }): number {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2) + Math.pow(p2.z - p1.z, 2))
  }

  private static calculateAngle(p1: { x: number; y: number; z: number }, vertex: { x: number; y: number; z: number }, p2: { x: number; y: number; z: number }): number {
    const v1 = new THREE.Vector3(p1.x - vertex.x, p1.y - vertex.y, p1.z - vertex.z).normalize()
    const v2 = new THREE.Vector3(p2.x - vertex.x, p2.y - vertex.y, p2.z - vertex.z).normalize()
    return Math.acos(v1.dot(v2)) * (180 / Math.PI)
  }

  private static calculatePolygonArea(points: { x: number; y: number; z: number }[]): number {
    // Simplified 2D area calculation - projects to best-fit plane
    let area = 0
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length
      area += points[i].x * points[j].y
      area -= points[j].x * points[i].y
    }
    return Math.abs(area / 2)
  }

  private static calculateFaceCenter(face: Face, vertices: THREE.Vector3[]): THREE.Vector3 {
    const center = new THREE.Vector3()
    face.vertices.forEach(vertexIndex => {
      center.add(vertices[vertexIndex])
    })
    return center.divideScalar(face.vertices.length)
  }

  private static findManifoldIssues(data: GeometryData): string[] {
    const issues: string[] = []
    // Placeholder for manifold issue detection
    return issues
  }

  private static analyzeFaceNormals(data: GeometryData): { inconsistent: number; total: number } {
    return { inconsistent: 0, total: data.faces.length }
  }

  private static calculateSupportVolume(overhangs: OverhangAnalysis[], bridges: BridgingAnalysis[]): number {
    // Simplified support volume calculation
    return overhangs.length * 0.5 + bridges.length * 1.0 // cm³ estimate
  }

  private static estimatePrintTime(data: GeometryData, supportVolume: number): number {
    const modelVolume = data.vertices.length * 0.001 // Rough volume estimate
    const totalVolume = modelVolume + supportVolume
    return totalVolume * 2 // 2 minutes per cm³ estimate
  }

  private static identifyStrengths(report: QualityReport): string[] {
    const strengths: string[] = []
    
    if (report.geometry.manifoldness > 95) strengths.push('Excellent manifold geometry')
    if (report.printability.supportNeed < 30) strengths.push('Minimal support required')
    if (report.overallScore > 80) strengths.push('High overall quality')
    
    return strengths
  }

  private static identifyWeaknesses(report: QualityReport): string[] {
    const weaknesses: string[] = []
    
    if (report.geometry.manifoldness < 80) weaknesses.push('Poor manifold geometry')
    if (report.printability.supportNeed > 70) weaknesses.push('Requires significant support')
    if (report.overallScore < 60) weaknesses.push('Below average quality')
    
    return weaknesses
  }

  private static generateGlobalRecommendations(reports: QualityReport[]): string[] {
    const recommendations: string[] = []
    
    const avgScore = reports.reduce((sum, r) => sum + r.overallScore, 0) / reports.length
    if (avgScore < 70) {
      recommendations.push('Consider improving overall model quality before printing')
    }
    
    return recommendations
  }
}

/**
 * Supporting interfaces
 */
interface GeometryData {
  vertices: THREE.Vector3[]
  faces: Face[]
  normals: THREE.Vector3[]
}

interface Face {
  vertices: number[]
  normal: THREE.Vector3
}

interface GeometryAnalysisResult {
  manifoldness: number
  watertightness: number
  selfIntersections: number
  duplicateVertices: number
}

interface PrintabilityAnalysisResult {
  overhangs: OverhangAnalysis[]
  wallThickness: ThicknessAnalysis
  bridging: BridgingAnalysis[]
  supportNeed: number
}