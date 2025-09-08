/**
 * Web Worker for heavy 3D mesh generation and optimization
 * Handles complex geometry operations without blocking the main thread
 */

interface MeshGenerationMessage {
  type: 'GENERATE_MESH' | 'OPTIMIZE_MESH' | 'EXPORT_OBJ';
  payload: {
    dotPattern?: boolean[][];
    meshData?: any;
    optimizationLevel?: 'low' | 'medium' | 'high';
    includeBackground?: boolean;
    scale?: number;
    taskId: string;
  };
}

interface MeshResult {
  type: 'SUCCESS' | 'ERROR' | 'PROGRESS';
  payload: {
    taskId: string;
    result?: any;
    error?: string;
    progress?: number;
  };
}

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface Face {
  vertices: [number, number, number];
  normal?: Vector3;
}

interface MeshData {
  vertices: Vector3[];
  faces: Face[];
  bounds: {
    min: Vector3;
    max: Vector3;
  };
  stats: {
    vertexCount: number;
    faceCount: number;
    surfaceArea: number;
  };
}

// Main message handler
self.addEventListener('message', (event: MessageEvent<MeshGenerationMessage>) => {
  const { type, payload } = event.data;

  try {
    switch (type) {
      case 'GENERATE_MESH':
        generateMesh(payload);
        break;
      case 'OPTIMIZE_MESH':
        optimizeMesh(payload);
        break;
      case 'EXPORT_OBJ':
        exportToOBJ(payload);
        break;
      default:
        sendError(payload.taskId, `Unknown task type: ${type}`);
    }
  } catch (error) {
    sendError(payload.taskId, error instanceof Error ? error.message : 'Unknown error');
  }
});

/**
 * Generate 3D mesh from dot pattern
 */
async function generateMesh(payload: MeshGenerationMessage['payload']) {
  const { 
    dotPattern, 
    includeBackground = true, 
    scale = 1.0, 
    taskId 
  } = payload;
  
  if (!dotPattern) {
    sendError(taskId, 'No dot pattern provided');
    return;
  }

  sendProgress(taskId, 10);

  try {
    const height = dotPattern.length;
    const width = height > 0 ? dotPattern[0].length : 0;
    
    if (width === 0) {
      sendError(taskId, 'Invalid dot pattern dimensions');
      return;
    }

    // Generate vertices and faces for dots
    const meshData = await generateBaseMesh(dotPattern, scale);
    sendProgress(taskId, 50);

    // Add background layer if requested
    if (includeBackground) {
      const backgroundMesh = generateBackgroundLayer(width, height, scale);
      mergeMeshes(meshData, backgroundMesh);
    }
    sendProgress(taskId, 70);

    // Calculate bounds and statistics
    calculateBounds(meshData);
    calculateStatistics(meshData);
    sendProgress(taskId, 90);

    sendSuccess(taskId, {
      meshData,
      dimensions: { width, height },
      scale,
      hasBackground: includeBackground
    });

    sendProgress(taskId, 100);
  } catch (error) {
    sendError(taskId, error instanceof Error ? error.message : 'Mesh generation failed');
  }
}

/**
 * Optimize mesh by reducing vertices and faces
 */
async function optimizeMesh(payload: MeshGenerationMessage['payload']) {
  const { meshData, optimizationLevel = 'medium', taskId } = payload;
  
  if (!meshData) {
    sendError(taskId, 'No mesh data provided');
    return;
  }

  sendProgress(taskId, 10);

  try {
    let optimizedMesh = { ...meshData };

    // Remove duplicate vertices
    optimizedMesh = removeDuplicateVertices(optimizedMesh);
    sendProgress(taskId, 30);

    // Merge coplanar faces
    if (optimizationLevel === 'medium' || optimizationLevel === 'high') {
      optimizedMesh = mergeCoplanarFaces(optimizedMesh);
      sendProgress(taskId, 60);
    }

    // Advanced optimization for high level
    if (optimizationLevel === 'high') {
      optimizedMesh = simplifyGeometry(optimizedMesh);
      sendProgress(taskId, 80);
    }

    // Recalculate statistics
    calculateStatistics(optimizedMesh);
    sendProgress(taskId, 95);

    sendSuccess(taskId, {
      meshData: optimizedMesh,
      optimizationLevel,
      reduction: {
        vertexReduction: ((meshData.vertices.length - optimizedMesh.vertices.length) / meshData.vertices.length * 100).toFixed(1) + '%',
        faceReduction: ((meshData.faces.length - optimizedMesh.faces.length) / meshData.faces.length * 100).toFixed(1) + '%'
      }
    });

    sendProgress(taskId, 100);
  } catch (error) {
    sendError(taskId, error instanceof Error ? error.message : 'Mesh optimization failed');
  }
}

/**
 * Export mesh to OBJ format
 */
function exportToOBJ(payload: MeshGenerationMessage['payload']) {
  const { meshData, taskId } = payload;
  
  if (!meshData) {
    sendError(taskId, 'No mesh data provided');
    return;
  }

  try {
    const objContent = generateOBJString(meshData);
    
    sendSuccess(taskId, {
      objContent,
      filename: `dot-art-model-${Date.now()}.obj`,
      size: objContent.length,
      stats: meshData.stats
    });
  } catch (error) {
    sendError(taskId, error instanceof Error ? error.message : 'OBJ export failed');
  }
}

/**
 * Generate base mesh from dot pattern
 */
async function generateBaseMesh(dotPattern: boolean[][], scale: number): Promise<MeshData> {
  const vertices: Vector3[] = [];
  const faces: Face[] = [];
  const height = dotPattern.length;
  const width = dotPattern[0].length;

  // Generate cubes for each true dot
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (dotPattern[y][x]) {
        const cubeData = generateCube(x * scale, 0, y * scale, scale);
        
        // Offset vertex indices for this cube
        const vertexOffset = vertices.length;
        vertices.push(...cubeData.vertices);
        
        cubeData.faces.forEach(face => {
          faces.push({
            vertices: [
              face.vertices[0] + vertexOffset,
              face.vertices[1] + vertexOffset,
              face.vertices[2] + vertexOffset
            ] as [number, number, number],
            normal: face.normal
          });
        });
      }
    }
  }

  return {
    vertices,
    faces,
    bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
    stats: { vertexCount: 0, faceCount: 0, surfaceArea: 0 }
  };
}

/**
 * Generate cube geometry
 */
function generateCube(x: number, y: number, z: number, size: number): MeshData {
  const s = size * 0.5; // Half size
  
  const vertices: Vector3[] = [
    // Bottom face
    { x: x - s, y: y - s, z: z - s },
    { x: x + s, y: y - s, z: z - s },
    { x: x + s, y: y - s, z: z + s },
    { x: x - s, y: y - s, z: z + s },
    // Top face
    { x: x - s, y: y + s, z: z - s },
    { x: x + s, y: y + s, z: z - s },
    { x: x + s, y: y + s, z: z + s },
    { x: x - s, y: y + s, z: z + s },
  ];

  const faces: Face[] = [
    // Bottom face (y = -s)
    { vertices: [0, 2, 1], normal: { x: 0, y: -1, z: 0 } },
    { vertices: [0, 3, 2], normal: { x: 0, y: -1, z: 0 } },
    // Top face (y = +s)
    { vertices: [4, 5, 6], normal: { x: 0, y: 1, z: 0 } },
    { vertices: [4, 6, 7], normal: { x: 0, y: 1, z: 0 } },
    // Front face (z = +s)
    { vertices: [2, 3, 7], normal: { x: 0, y: 0, z: 1 } },
    { vertices: [2, 7, 6], normal: { x: 0, y: 0, z: 1 } },
    // Back face (z = -s)
    { vertices: [0, 1, 5], normal: { x: 0, y: 0, z: -1 } },
    { vertices: [0, 5, 4], normal: { x: 0, y: 0, z: -1 } },
    // Right face (x = +s)
    { vertices: [1, 2, 6], normal: { x: 1, y: 0, z: 0 } },
    { vertices: [1, 6, 5], normal: { x: 1, y: 0, z: 0 } },
    // Left face (x = -s)
    { vertices: [0, 4, 7], normal: { x: -1, y: 0, z: 0 } },
    { vertices: [0, 7, 3], normal: { x: -1, y: 0, z: 0 } },
  ];

  return {
    vertices,
    faces,
    bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
    stats: { vertexCount: 0, faceCount: 0, surfaceArea: 0 }
  };
}

/**
 * Generate background layer
 */
function generateBackgroundLayer(width: number, height: number, scale: number): MeshData {
  const s = scale * 0.5;
  const vertices: Vector3[] = [
    // Background plane vertices (1 unit larger than pattern)
    { x: -s - scale, y: -s, z: -s - scale },
    { x: width * scale + s, y: -s, z: -s - scale },
    { x: width * scale + s, y: -s, z: height * scale + s },
    { x: -s - scale, y: -s, z: height * scale + s },
  ];

  const faces: Face[] = [
    { vertices: [0, 2, 1], normal: { x: 0, y: 1, z: 0 } },
    { vertices: [0, 3, 2], normal: { x: 0, y: 1, z: 0 } },
  ];

  return {
    vertices,
    faces,
    bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
    stats: { vertexCount: 0, faceCount: 0, surfaceArea: 0 }
  };
}

/**
 * Merge two meshes
 */
function mergeMeshes(mesh1: MeshData, mesh2: MeshData): void {
  const vertexOffset = mesh1.vertices.length;
  
  mesh1.vertices.push(...mesh2.vertices);
  
  mesh2.faces.forEach(face => {
    mesh1.faces.push({
      vertices: [
        face.vertices[0] + vertexOffset,
        face.vertices[1] + vertexOffset,
        face.vertices[2] + vertexOffset
      ] as [number, number, number],
      normal: face.normal
    });
  });
}

/**
 * Remove duplicate vertices
 */
function removeDuplicateVertices(mesh: MeshData): MeshData {
  const vertexMap = new Map<string, number>();
  const newVertices: Vector3[] = [];
  const vertexRemap: number[] = [];

  // Build unique vertex list
  mesh.vertices.forEach((vertex, index) => {
    const key = `${vertex.x.toFixed(6)},${vertex.y.toFixed(6)},${vertex.z.toFixed(6)}`;
    
    if (vertexMap.has(key)) {
      vertexRemap[index] = vertexMap.get(key)!;
    } else {
      const newIndex = newVertices.length;
      newVertices.push(vertex);
      vertexMap.set(key, newIndex);
      vertexRemap[index] = newIndex;
    }
  });

  // Remap faces
  const newFaces = mesh.faces.map(face => ({
    vertices: [
      vertexRemap[face.vertices[0]],
      vertexRemap[face.vertices[1]],
      vertexRemap[face.vertices[2]]
    ] as [number, number, number],
    normal: face.normal
  }));

  return {
    ...mesh,
    vertices: newVertices,
    faces: newFaces
  };
}

/**
 * Merge coplanar faces (simplified implementation)
 */
function mergeCoplanarFaces(mesh: MeshData): MeshData {
  // This is a simplified implementation
  // A full implementation would require more complex geometric algorithms
  return mesh;
}

/**
 * Simplify geometry (simplified implementation)
 */
function simplifyGeometry(mesh: MeshData): MeshData {
  // This would implement edge collapse or other simplification algorithms
  // For now, return the mesh as-is
  return mesh;
}

/**
 * Calculate mesh bounds
 */
function calculateBounds(mesh: MeshData): void {
  if (mesh.vertices.length === 0) return;

  let minX = mesh.vertices[0].x, maxX = mesh.vertices[0].x;
  let minY = mesh.vertices[0].y, maxY = mesh.vertices[0].y;
  let minZ = mesh.vertices[0].z, maxZ = mesh.vertices[0].z;

  mesh.vertices.forEach(vertex => {
    minX = Math.min(minX, vertex.x);
    maxX = Math.max(maxX, vertex.x);
    minY = Math.min(minY, vertex.y);
    maxY = Math.max(maxY, vertex.y);
    minZ = Math.min(minZ, vertex.z);
    maxZ = Math.max(maxZ, vertex.z);
  });

  mesh.bounds = {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ }
  };
}

/**
 * Calculate mesh statistics
 */
function calculateStatistics(mesh: MeshData): void {
  mesh.stats = {
    vertexCount: mesh.vertices.length,
    faceCount: mesh.faces.length,
    surfaceArea: calculateSurfaceArea(mesh)
  };
}

/**
 * Calculate surface area
 */
function calculateSurfaceArea(mesh: MeshData): number {
  let totalArea = 0;

  mesh.faces.forEach(face => {
    const v1 = mesh.vertices[face.vertices[0]];
    const v2 = mesh.vertices[face.vertices[1]];
    const v3 = mesh.vertices[face.vertices[2]];

    // Calculate triangle area using cross product
    const edge1 = { x: v2.x - v1.x, y: v2.y - v1.y, z: v2.z - v1.z };
    const edge2 = { x: v3.x - v1.x, y: v3.y - v1.y, z: v3.z - v1.z };
    
    const cross = {
      x: edge1.y * edge2.z - edge1.z * edge2.y,
      y: edge1.z * edge2.x - edge1.x * edge2.z,
      z: edge1.x * edge2.y - edge1.y * edge2.x
    };

    const magnitude = Math.sqrt(cross.x * cross.x + cross.y * cross.y + cross.z * cross.z);
    totalArea += magnitude * 0.5;
  });

  return totalArea;
}

/**
 * Generate OBJ file content
 */
function generateOBJString(mesh: MeshData): string {
  const lines: string[] = [];
  
  // Header
  lines.push('# Dot Art 3D Model');
  lines.push('# Generated by Dot Art 3D Converter');
  lines.push(`# Vertices: ${mesh.stats.vertexCount}`);
  lines.push(`# Faces: ${mesh.stats.faceCount}`);
  lines.push('');

  // Vertices
  mesh.vertices.forEach(vertex => {
    lines.push(`v ${vertex.x.toFixed(6)} ${vertex.y.toFixed(6)} ${vertex.z.toFixed(6)}`);
  });

  lines.push('');

  // Faces (OBJ uses 1-based indexing)
  mesh.faces.forEach(face => {
    lines.push(`f ${face.vertices[0] + 1} ${face.vertices[1] + 1} ${face.vertices[2] + 1}`);
  });

  return lines.join('\n');
}

/**
 * Send success result back to main thread
 */
function sendSuccess(taskId: string, result: any) {
  const message: MeshResult = {
    type: 'SUCCESS',
    payload: { taskId, result }
  };
  self.postMessage(message);
}

/**
 * Send error back to main thread
 */
function sendError(taskId: string, error: string) {
  const message: MeshResult = {
    type: 'ERROR',
    payload: { taskId, error }
  };
  self.postMessage(message);
}

/**
 * Send progress update back to main thread
 */
function sendProgress(taskId: string, progress: number) {
  const message: MeshResult = {
    type: 'PROGRESS',
    payload: { taskId, progress }
  };
  self.postMessage(message);
}

export {}; // Make this a module