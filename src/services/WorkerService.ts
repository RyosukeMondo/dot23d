/**
 * Service for managing Web Workers and heavy computational tasks
 */

type WorkerType = 'image-processing' | 'mesh-generation';

interface WorkerTask {
  id: string;
  type: WorkerType;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  onProgress?: (progress: number) => void;
  startTime: number;
}

class WorkerService {
  private workers: Map<WorkerType, Worker> = new Map();
  private tasks: Map<string, WorkerTask> = new Map();
  private taskIdCounter = 0;

  constructor() {
    this.initializeWorkers();
  }

  /**
   * Initialize Web Workers
   */
  private initializeWorkers() {
    try {
      // Initialize image processing worker
      const imageWorker = new Worker(
        new URL('../workers/imageProcessingWorker.ts', import.meta.url),
        { type: 'module' }
      );
      imageWorker.addEventListener('message', this.handleWorkerMessage.bind(this));
      this.workers.set('image-processing', imageWorker);

      // Initialize mesh generation worker
      const meshWorker = new Worker(
        new URL('../workers/meshGenerationWorker.ts', import.meta.url),
        { type: 'module' }
      );
      meshWorker.addEventListener('message', this.handleWorkerMessage.bind(this));
      this.workers.set('mesh-generation', meshWorker);

    } catch (error) {
      console.warn('Web Workers not supported in this environment:', error);
    }
  }

  /**
   * Handle messages from Web Workers
   */
  private handleWorkerMessage(event: MessageEvent) {
    const { type, payload } = event.data;
    const { taskId } = payload;
    const task = this.tasks.get(taskId);

    if (!task) return;

    switch (type) {
      case 'SUCCESS':
        task.resolve(payload.result);
        this.tasks.delete(taskId);
        break;

      case 'ERROR':
        task.reject(new Error(payload.error));
        this.tasks.delete(taskId);
        break;

      case 'PROGRESS':
        if (task.onProgress) {
          task.onProgress(payload.progress);
        }
        break;
    }
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task_${++this.taskIdCounter}_${Date.now()}`;
  }

  /**
   * Convert image to dot pattern using Web Worker
   */
  async convertImageToDots(
    imageData: ImageData,
    options: {
      threshold?: number;
      resolution?: number;
      onProgress?: (progress: number) => void;
    } = {}
  ): Promise<{
    dotPattern: boolean[][];
    originalWidth: number;
    originalHeight: number;
    targetResolution: number;
    threshold: number;
  }> {
    const worker = this.workers.get('image-processing');
    if (!worker) {
      throw new Error('Image processing worker not available');
    }

    const taskId = this.generateTaskId();
    const { threshold = 0.5, resolution = 32, onProgress } = options;

    return new Promise((resolve, reject) => {
      this.tasks.set(taskId, {
        id: taskId,
        type: 'image-processing',
        resolve,
        reject,
        onProgress,
        startTime: Date.now()
      });

      worker.postMessage({
        type: 'CONVERT_IMAGE_TO_DOTS',
        payload: {
          imageData,
          threshold,
          resolution,
          taskId
        }
      });
    });
  }

  /**
   * Resize image using Web Worker
   */
  async resizeImage(
    imageData: ImageData,
    width: number,
    height: number,
    onProgress?: (progress: number) => void
  ): Promise<ImageData> {
    const worker = this.workers.get('image-processing');
    if (!worker) {
      throw new Error('Image processing worker not available');
    }

    const taskId = this.generateTaskId();

    return new Promise((resolve, reject) => {
      this.tasks.set(taskId, {
        id: taskId,
        type: 'image-processing',
        resolve,
        reject,
        onProgress,
        startTime: Date.now()
      });

      worker.postMessage({
        type: 'RESIZE_IMAGE',
        payload: {
          imageData,
          width,
          height,
          taskId
        }
      });
    });
  }

  /**
   * Apply image filter using Web Worker
   */
  async applyImageFilter(
    imageData: ImageData,
    filterType: 'blur' | 'sharpen' | 'contrast',
    onProgress?: (progress: number) => void
  ): Promise<ImageData> {
    const worker = this.workers.get('image-processing');
    if (!worker) {
      throw new Error('Image processing worker not available');
    }

    const taskId = this.generateTaskId();

    return new Promise((resolve, reject) => {
      this.tasks.set(taskId, {
        id: taskId,
        type: 'image-processing',
        resolve,
        reject,
        onProgress,
        startTime: Date.now()
      });

      worker.postMessage({
        type: 'APPLY_FILTER',
        payload: {
          imageData,
          filterType,
          taskId
        }
      });
    });
  }

  /**
   * Generate 3D mesh from dot pattern using Web Worker
   */
  async generateMesh(
    dotPattern: boolean[][],
    options: {
      includeBackground?: boolean;
      scale?: number;
      onProgress?: (progress: number) => void;
    } = {}
  ): Promise<{
    meshData: any;
    dimensions: { width: number; height: number };
    scale: number;
    hasBackground: boolean;
  }> {
    const worker = this.workers.get('mesh-generation');
    if (!worker) {
      throw new Error('Mesh generation worker not available');
    }

    const taskId = this.generateTaskId();
    const { includeBackground = true, scale = 1.0, onProgress } = options;

    return new Promise((resolve, reject) => {
      this.tasks.set(taskId, {
        id: taskId,
        type: 'mesh-generation',
        resolve,
        reject,
        onProgress,
        startTime: Date.now()
      });

      worker.postMessage({
        type: 'GENERATE_MESH',
        payload: {
          dotPattern,
          includeBackground,
          scale,
          taskId
        }
      });
    });
  }

  /**
   * Optimize mesh using Web Worker
   */
  async optimizeMesh(
    meshData: any,
    optimizationLevel: 'low' | 'medium' | 'high' = 'medium',
    onProgress?: (progress: number) => void
  ): Promise<{
    meshData: any;
    optimizationLevel: string;
    reduction: {
      vertexReduction: string;
      faceReduction: string;
    };
  }> {
    const worker = this.workers.get('mesh-generation');
    if (!worker) {
      throw new Error('Mesh generation worker not available');
    }

    const taskId = this.generateTaskId();

    return new Promise((resolve, reject) => {
      this.tasks.set(taskId, {
        id: taskId,
        type: 'mesh-generation',
        resolve,
        reject,
        onProgress,
        startTime: Date.now()
      });

      worker.postMessage({
        type: 'OPTIMIZE_MESH',
        payload: {
          meshData,
          optimizationLevel,
          taskId
        }
      });
    });
  }

  /**
   * Export mesh to OBJ format using Web Worker
   */
  async exportMeshToOBJ(
    meshData: any,
    onProgress?: (progress: number) => void
  ): Promise<{
    objContent: string;
    filename: string;
    size: number;
    stats: any;
  }> {
    const worker = this.workers.get('mesh-generation');
    if (!worker) {
      throw new Error('Mesh generation worker not available');
    }

    const taskId = this.generateTaskId();

    return new Promise((resolve, reject) => {
      this.tasks.set(taskId, {
        id: taskId,
        type: 'mesh-generation',
        resolve,
        reject,
        onProgress,
        startTime: Date.now()
      });

      worker.postMessage({
        type: 'EXPORT_OBJ',
        payload: {
          meshData,
          taskId
        }
      });
    });
  }

  /**
   * Get task statistics
   */
  getTaskStats(): {
    activeTasks: number;
    tasksByType: Record<WorkerType, number>;
    averageTaskTime: number;
  } {
    const activeTasks = this.tasks.size;
    const tasksByType: Record<WorkerType, number> = {
      'image-processing': 0,
      'mesh-generation': 0
    };

    let totalTime = 0;
    let completedTasks = 0;

    this.tasks.forEach(task => {
      tasksByType[task.type]++;
      // Only count running time for active tasks
      totalTime += Date.now() - task.startTime;
    });

    return {
      activeTasks,
      tasksByType,
      averageTaskTime: completedTasks > 0 ? totalTime / completedTasks : 0
    };
  }

  /**
   * Cancel a specific task
   */
  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (task) {
      task.reject(new Error('Task cancelled'));
      this.tasks.delete(taskId);
      return true;
    }
    return false;
  }

  /**
   * Cancel all tasks of a specific type
   */
  cancelTasksByType(type: WorkerType): number {
    let cancelledCount = 0;
    this.tasks.forEach((task, taskId) => {
      if (task.type === type) {
        task.reject(new Error('Task cancelled'));
        this.tasks.delete(taskId);
        cancelledCount++;
      }
    });
    return cancelledCount;
  }

  /**
   * Check if Web Workers are supported
   */
  isSupported(): boolean {
    return typeof Worker !== 'undefined' && this.workers.size > 0;
  }

  /**
   * Get fallback message for unsupported environments
   */
  getFallbackMessage(): string {
    return 'Web Workers are not supported in this environment. Processing will run on the main thread, which may cause temporary UI freezing for large operations.';
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Cancel all active tasks
    this.tasks.forEach((task, taskId) => {
      task.reject(new Error('Worker service destroyed'));
    });
    this.tasks.clear();

    // Terminate workers
    this.workers.forEach(worker => {
      worker.terminate();
    });
    this.workers.clear();
  }
}

// Export singleton instance
export const workerService = new WorkerService();
export default WorkerService;