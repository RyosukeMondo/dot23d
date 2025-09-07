import * as THREE from 'three'
import type { DotPattern, Model3DParams } from '@/types'

/**
 * Error class for mesh generation operations
 */
export class MeshGenerationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MeshGenerationError'
  }
}

/**
 * Interface for mesh statistics
 */
export interface MeshStats {
  vertexCount: number
  faceCount: number
  cubeCount: number
  fileSizeEstimate: number
}

/**
 * Utility class for generating 3D meshes from dot patterns
 */
export class MeshGenerator {
  /**
   * Generate individual cube geometry (reusable)
   */
  private static createCubeGeometry(size: number, chamfer: number = 0): THREE.BufferGeometry {
    if (chamfer > 0 && chamfer < size * 0.4) {
      // Create chamfered cube using BoxGeometry with rounded edges simulation
      const geometry = new THREE.BoxGeometry(size - chamfer * 2, size - chamfer * 2, size - chamfer * 2)
      
      // Add chamfer effect by slightly rounding the geometry
      const position = geometry.attributes.position
      const vector = new THREE.Vector3()
      
      for (let i = 0; i < position.count; i++) {
        vector.fromBufferAttribute(position, i)
        
        // Apply slight rounding to vertices near edges
        const factor = Math.min(1, chamfer / size)
        vector.multiplyScalar(1 - factor * 0.1)
        
        position.setXYZ(i, vector.x, vector.y, vector.z)
      }
      
      geometry.attributes.position.needsUpdate = true
      geometry.computeVertexNormals()
      
      return geometry
    }
    
    return new THREE.BoxGeometry(size, size, size)
  }

  /**
   * Generate cubes for each true value in the dot pattern
   */
  static generateCubes(pattern: DotPattern, params: Model3DParams): THREE.Group {
    const group = new THREE.Group()
    const cubeGeometry = this.createCubeGeometry(
      params.cubeSize, 
      params.chamferEdges ? params.chamferSize : 0
    )
    
    // Create material
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x888888,
      roughness: 0.7,
      metalness: 0.1
    })
    
    const spacing = params.cubeSize + params.spacing
    
    for (let y = 0; y < pattern.height; y++) {
      for (let x = 0; x < pattern.width; x++) {
        if (pattern.data[y][x]) {
          const cube = new THREE.Mesh(cubeGeometry, material)
          
          // Position cube in 3D space
          cube.position.set(
            (x - pattern.width / 2) * spacing,
            params.cubeHeight / 2,
            (y - pattern.height / 2) * spacing
          )
          
          group.add(cube)
        }
      }
    }
    
    return group
  }

  /**
   * Create a base/platform under the pattern
   */
  static createBackground(pattern: DotPattern, params: Model3DParams): THREE.Mesh {
    const width = pattern.width * (params.cubeSize + params.spacing) - params.spacing
    const depth = pattern.height * (params.cubeSize + params.spacing) - params.spacing
    
    const geometry = new THREE.BoxGeometry(
      width + params.cubeSize, // Add padding
      params.baseThickness,
      depth + params.cubeSize  // Add padding
    )
    
    const material = new THREE.MeshStandardMaterial({ 
      color: 0xcccccc,
      roughness: 0.8,
      metalness: 0.0
    })
    
    const base = new THREE.Mesh(geometry, material)
    base.position.y = -params.baseThickness / 2
    
    return base
  }

  /**
   * Merge adjacent faces to reduce polygon count (simplified implementation)
   */
  static mergeFaces(group: THREE.Group): THREE.Mesh {
    // This is a simplified merge - for production, you'd want more sophisticated mesh optimization
    const geometries: THREE.BufferGeometry[] = []
    
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const geometry = child.geometry.clone()
        geometry.applyMatrix4(child.matrixWorld)
        geometries.push(geometry)
      }
    })
    
    if (geometries.length === 0) {
      throw new MeshGenerationError('No geometries found to merge')
    }
    
    // Merge all geometries
    const mergedGeometry = THREE.BufferGeometryUtils.mergeGeometries(geometries)
    
    if (!mergedGeometry) {
      throw new MeshGenerationError('Failed to merge geometries')
    }
    
    // Create material for merged mesh
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x888888,
      roughness: 0.7,
      metalness: 0.1
    })
    
    // Clean up individual geometries
    geometries.forEach(geo => geo.dispose())
    
    return new THREE.Mesh(mergedGeometry, material)
  }

  /**
   * Optimize mesh by removing interior faces (simplified)
   */
  private static optimizeMesh(pattern: DotPattern, params: Model3DParams): THREE.BufferGeometry {
    // This creates a more optimized mesh by only creating external faces
    const positions: number[] = []
    const normals: number[] = []
    const indices: number[] = []
    
    const size = params.cubeSize
    const spacing = size + params.spacing
    let vertexIndex = 0
    
    // Helper to add a face
    const addFace = (v1: THREE.Vector3, v2: THREE.Vector3, v3: THREE.Vector3, v4: THREE.Vector3, normal: THREE.Vector3) => {
      // Add vertices
      positions.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, v3.x, v3.y, v3.z, v4.x, v4.y, v4.z)
      
      // Add normals
      for (let i = 0; i < 4; i++) {
        normals.push(normal.x, normal.y, normal.z)
      }
      
      // Add indices for two triangles
      indices.push(
        vertexIndex, vertexIndex + 1, vertexIndex + 2,
        vertexIndex, vertexIndex + 2, vertexIndex + 3
      )
      
      vertexIndex += 4
    }
    
    const halfSize = size / 2
    
    for (let y = 0; y < pattern.height; y++) {
      for (let x = 0; x < pattern.width; x++) {
        if (!pattern.data[y][x]) continue
        
        const centerX = (x - pattern.width / 2) * spacing
        const centerY = params.cubeHeight / 2
        const centerZ = (y - pattern.height / 2) * spacing
        
        // Check each face and only add if it's external
        const neighbors = {
          left: x > 0 ? pattern.data[y][x - 1] : false,
          right: x < pattern.width - 1 ? pattern.data[y][x + 1] : false,
          front: y > 0 ? pattern.data[y - 1][x] : false,
          back: y < pattern.height - 1 ? pattern.data[y + 1][x] : false
        }
        
        // Left face (-X)
        if (!neighbors.left) {
          addFace(
            new THREE.Vector3(centerX - halfSize, centerY - halfSize, centerZ - halfSize),
            new THREE.Vector3(centerX - halfSize, centerY + halfSize, centerZ - halfSize),
            new THREE.Vector3(centerX - halfSize, centerY + halfSize, centerZ + halfSize),
            new THREE.Vector3(centerX - halfSize, centerY - halfSize, centerZ + halfSize),
            new THREE.Vector3(-1, 0, 0)
          )
        }
        
        // Right face (+X)
        if (!neighbors.right) {
          addFace(
            new THREE.Vector3(centerX + halfSize, centerY - halfSize, centerZ + halfSize),
            new THREE.Vector3(centerX + halfSize, centerY + halfSize, centerZ + halfSize),
            new THREE.Vector3(centerX + halfSize, centerY + halfSize, centerZ - halfSize),
            new THREE.Vector3(centerX + halfSize, centerY - halfSize, centerZ - halfSize),
            new THREE.Vector3(1, 0, 0)
          )
        }
        
        // Front face (-Z)
        if (!neighbors.front) {
          addFace(
            new THREE.Vector3(centerX - halfSize, centerY - halfSize, centerZ - halfSize),
            new THREE.Vector3(centerX - halfSize, centerY + halfSize, centerZ - halfSize),
            new THREE.Vector3(centerX + halfSize, centerY + halfSize, centerZ - halfSize),
            new THREE.Vector3(centerX + halfSize, centerY - halfSize, centerZ - halfSize),
            new THREE.Vector3(0, 0, -1)
          )
        }
        
        // Back face (+Z)
        if (!neighbors.back) {
          addFace(
            new THREE.Vector3(centerX + halfSize, centerY - halfSize, centerZ + halfSize),
            new THREE.Vector3(centerX + halfSize, centerY + halfSize, centerZ + halfSize),
            new THREE.Vector3(centerX - halfSize, centerY + halfSize, centerZ + halfSize),
            new THREE.Vector3(centerX - halfSize, centerY - halfSize, centerZ + halfSize),
            new THREE.Vector3(0, 0, 1)
          )
        }
        
        // Top face (+Y) - always exposed
        addFace(
          new THREE.Vector3(centerX - halfSize, centerY + halfSize, centerZ - halfSize),
          new THREE.Vector3(centerX - halfSize, centerY + halfSize, centerZ + halfSize),
          new THREE.Vector3(centerX + halfSize, centerY + halfSize, centerZ + halfSize),
          new THREE.Vector3(centerX + halfSize, centerY + halfSize, centerZ - halfSize),
          new THREE.Vector3(0, 1, 0)
        )
        
        // Bottom face (-Y) - always exposed (touching base)
        addFace(
          new THREE.Vector3(centerX - halfSize, centerY - halfSize, centerZ - halfSize),
          new THREE.Vector3(centerX + halfSize, centerY - halfSize, centerZ - halfSize),
          new THREE.Vector3(centerX + halfSize, centerY - halfSize, centerZ + halfSize),
          new THREE.Vector3(centerX - halfSize, centerY - halfSize, centerZ + halfSize),
          new THREE.Vector3(0, -1, 0)
        )
      }
    }
    
    // Create geometry
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    geometry.setIndex(indices)
    
    // Compute vertex normals for smooth shading
    geometry.computeVertexNormals()
    
    return geometry
  }

  /**
   * Generate complete 3D mesh from dot pattern
   */
  static generateMesh(pattern: DotPattern, params: Model3DParams): THREE.Group {
    const mainGroup = new THREE.Group()
    
    try {
      if (params.optimizeMesh) {
        // Use optimized mesh generation
        const optimizedGeometry = this.optimizeMesh(pattern, params)
        const material = new THREE.MeshStandardMaterial({ 
          color: 0x888888,
          roughness: 0.7,
          metalness: 0.1
        })
        const optimizedMesh = new THREE.Mesh(optimizedGeometry, material)
        mainGroup.add(optimizedMesh)
      } else if (params.mergeAdjacentFaces) {
        // Generate individual cubes then merge
        const cubeGroup = this.generateCubes(pattern, params)
        const mergedMesh = this.mergeFaces(cubeGroup)
        mainGroup.add(mergedMesh)
      } else {
        // Simple individual cubes
        const cubeGroup = this.generateCubes(pattern, params)
        mainGroup.add(cubeGroup)
      }
      
      // Add base if requested
      if (params.generateBase) {
        const base = this.createBackground(pattern, params)
        mainGroup.add(base)
      }
      
      return mainGroup
      
    } catch (error) {
      throw new MeshGenerationError(
        `Failed to generate mesh: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Calculate mesh statistics
   */
  static calculateMeshStats(mesh: THREE.Group): MeshStats {
    let vertexCount = 0
    let faceCount = 0
    let cubeCount = 0
    
    mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        cubeCount++
        
        if (child.geometry) {
          const positionAttribute = child.geometry.attributes.position
          if (positionAttribute) {
            vertexCount += positionAttribute.count
          }
          
          if (child.geometry.index) {
            faceCount += child.geometry.index.count / 3
          } else if (positionAttribute) {
            faceCount += positionAttribute.count / 3
          }
        }
      }
    })
    
    // Estimate file size (rough approximation for OBJ format)
    // Each vertex: ~30 bytes, each face: ~20 bytes
    const fileSizeEstimate = (vertexCount * 30) + (faceCount * 20)
    
    return {
      vertexCount,
      faceCount,
      cubeCount,
      fileSizeEstimate
    }
  }

  /**
   * Center mesh at origin
   */
  static centerMesh(mesh: THREE.Group): void {
    const box = new THREE.Box3().setFromObject(mesh)
    const center = box.getCenter(new THREE.Vector3())
    mesh.position.sub(center)
  }
}