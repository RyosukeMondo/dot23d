/**
 * Web Worker for heavy image processing operations
 * Handles image conversion, filtering, and dot pattern generation
 */

interface ImageProcessingMessage {
  type: 'CONVERT_IMAGE_TO_DOTS' | 'RESIZE_IMAGE' | 'APPLY_FILTER';
  payload: {
    imageData?: ImageData;
    width?: number;
    height?: number;
    threshold?: number;
    resolution?: number;
    filterType?: 'blur' | 'sharpen' | 'contrast';
    taskId: string;
  };
}

interface ProcessingResult {
  type: 'SUCCESS' | 'ERROR' | 'PROGRESS';
  payload: {
    taskId: string;
    result?: any;
    error?: string;
    progress?: number;
  };
}

// Main message handler
self.addEventListener('message', (event: MessageEvent<ImageProcessingMessage>) => {
  const { type, payload } = event.data;

  try {
    switch (type) {
      case 'CONVERT_IMAGE_TO_DOTS':
        convertImageToDots(payload);
        break;
      case 'RESIZE_IMAGE':
        resizeImage(payload);
        break;
      case 'APPLY_FILTER':
        applyFilter(payload);
        break;
      default:
        sendError(payload.taskId, `Unknown task type: ${type}`);
    }
  } catch (error) {
    sendError(payload.taskId, error instanceof Error ? error.message : 'Unknown error');
  }
});

/**
 * Convert image to dot pattern
 */
async function convertImageToDots(payload: ImageProcessingMessage['payload']) {
  const { imageData, threshold = 0.5, resolution = 32, taskId } = payload;
  
  if (!imageData) {
    sendError(taskId, 'No image data provided');
    return;
  }

  sendProgress(taskId, 10);

  try {
    // Convert to grayscale first
    const grayscaleData = convertToGrayscale(imageData);
    sendProgress(taskId, 30);

    // Resize to target resolution
    const resizedData = resizeImageData(grayscaleData, resolution, resolution);
    sendProgress(taskId, 60);

    // Apply threshold to create binary pattern
    const dotPattern = applyThreshold(resizedData, threshold);
    sendProgress(taskId, 90);

    sendSuccess(taskId, {
      dotPattern,
      originalWidth: imageData.width,
      originalHeight: imageData.height,
      targetResolution: resolution,
      threshold
    });

    sendProgress(taskId, 100);
  } catch (error) {
    sendError(taskId, error instanceof Error ? error.message : 'Conversion failed');
  }
}

/**
 * Resize image data
 */
function resizeImage(payload: ImageProcessingMessage['payload']) {
  const { imageData, width, height, taskId } = payload;
  
  if (!imageData || !width || !height) {
    sendError(taskId, 'Missing required parameters for resize');
    return;
  }

  try {
    const resizedData = resizeImageData(imageData, width, height);
    sendSuccess(taskId, resizedData);
  } catch (error) {
    sendError(taskId, error instanceof Error ? error.message : 'Resize failed');
  }
}

/**
 * Apply image filter
 */
function applyFilter(payload: ImageProcessingMessage['payload']) {
  const { imageData, filterType, taskId } = payload;
  
  if (!imageData || !filterType) {
    sendError(taskId, 'Missing required parameters for filter');
    return;
  }

  try {
    let filteredData: ImageData;
    
    switch (filterType) {
      case 'blur':
        filteredData = applyGaussianBlur(imageData);
        break;
      case 'sharpen':
        filteredData = applySharpenFilter(imageData);
        break;
      case 'contrast':
        filteredData = applyContrastFilter(imageData);
        break;
      default:
        throw new Error(`Unsupported filter type: ${filterType}`);
    }

    sendSuccess(taskId, filteredData);
  } catch (error) {
    sendError(taskId, error instanceof Error ? error.message : 'Filter failed');
  }
}

/**
 * Convert image to grayscale using luminance formula
 */
function convertToGrayscale(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const grayscaleData = new ImageData(width, height);
  
  for (let i = 0; i < data.length; i += 4) {
    // Calculate luminance: Y = 0.299*R + 0.587*G + 0.114*B
    const luminance = Math.round(
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    );
    
    grayscaleData.data[i] = luminance;     // R
    grayscaleData.data[i + 1] = luminance; // G
    grayscaleData.data[i + 2] = luminance; // B
    grayscaleData.data[i + 3] = data[i + 3]; // A
  }
  
  return grayscaleData;
}

/**
 * Resize image data using bilinear interpolation
 */
function resizeImageData(imageData: ImageData, targetWidth: number, targetHeight: number): ImageData {
  const { data, width, height } = imageData;
  const resizedData = new ImageData(targetWidth, targetHeight);
  
  const scaleX = width / targetWidth;
  const scaleY = height / targetHeight;
  
  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const sourceX = x * scaleX;
      const sourceY = y * scaleY;
      
      // Get four surrounding pixels
      const x1 = Math.floor(sourceX);
      const y1 = Math.floor(sourceY);
      const x2 = Math.min(x1 + 1, width - 1);
      const y2 = Math.min(y1 + 1, height - 1);
      
      // Calculate weights for bilinear interpolation
      const wx = sourceX - x1;
      const wy = sourceY - y1;
      
      // Get pixel indices
      const idx1 = (y1 * width + x1) * 4;
      const idx2 = (y1 * width + x2) * 4;
      const idx3 = (y2 * width + x1) * 4;
      const idx4 = (y2 * width + x2) * 4;
      
      // Interpolate each channel
      for (let c = 0; c < 4; c++) {
        const top = data[idx1 + c] * (1 - wx) + data[idx2 + c] * wx;
        const bottom = data[idx3 + c] * (1 - wx) + data[idx4 + c] * wx;
        const final = top * (1 - wy) + bottom * wy;
        
        const targetIdx = (y * targetWidth + x) * 4 + c;
        resizedData.data[targetIdx] = Math.round(final);
      }
    }
  }
  
  return resizedData;
}

/**
 * Apply threshold to create binary dot pattern
 */
function applyThreshold(imageData: ImageData, threshold: number): boolean[][] {
  const { data, width, height } = imageData;
  const pattern: boolean[][] = [];
  
  const thresholdValue = threshold * 255;
  
  for (let y = 0; y < height; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const luminance = data[idx]; // Already grayscale
      row.push(luminance > thresholdValue);
    }
    pattern.push(row);
  }
  
  return pattern;
}

/**
 * Apply Gaussian blur filter
 */
function applyGaussianBlur(imageData: ImageData, radius: number = 1): ImageData {
  const { data, width, height } = imageData;
  const blurredData = new ImageData(width, height);
  
  // Simple 3x3 Gaussian kernel
  const kernel = [
    [1, 2, 1],
    [2, 4, 2],
    [1, 2, 1]
  ];
  const kernelSum = 16;
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) { // Skip alpha channel
        let sum = 0;
        
        for (let ky = 0; ky < 3; ky++) {
          for (let kx = 0; kx < 3; kx++) {
            const idx = ((y + ky - 1) * width + (x + kx - 1)) * 4 + c;
            sum += data[idx] * kernel[ky][kx];
          }
        }
        
        const targetIdx = (y * width + x) * 4 + c;
        blurredData.data[targetIdx] = Math.round(sum / kernelSum);
      }
      
      // Copy alpha channel
      const targetIdx = (y * width + x) * 4 + 3;
      const sourceIdx = (y * width + x) * 4 + 3;
      blurredData.data[targetIdx] = data[sourceIdx];
    }
  }
  
  // Copy edges
  for (let i = 0; i < data.length; i++) {
    if (blurredData.data[i] === 0 && i % 4 !== 3) {
      blurredData.data[i] = data[i];
    }
  }
  
  return blurredData;
}

/**
 * Apply sharpen filter
 */
function applySharpenFilter(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const sharpenedData = new ImageData(width, height);
  
  // Sharpen kernel
  const kernel = [
    [ 0, -1,  0],
    [-1,  5, -1],
    [ 0, -1,  0]
  ];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        
        for (let ky = 0; ky < 3; ky++) {
          for (let kx = 0; kx < 3; kx++) {
            const idx = ((y + ky - 1) * width + (x + kx - 1)) * 4 + c;
            sum += data[idx] * kernel[ky][kx];
          }
        }
        
        const targetIdx = (y * width + x) * 4 + c;
        sharpenedData.data[targetIdx] = Math.max(0, Math.min(255, sum));
      }
      
      // Copy alpha channel
      const targetIdx = (y * width + x) * 4 + 3;
      const sourceIdx = (y * width + x) * 4 + 3;
      sharpenedData.data[targetIdx] = data[sourceIdx];
    }
  }
  
  return sharpenedData;
}

/**
 * Apply contrast filter
 */
function applyContrastFilter(imageData: ImageData, factor: number = 1.5): ImageData {
  const { data, width, height } = imageData;
  const contrastedData = new ImageData(width, height);
  
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const value = data[i + c];
      const adjusted = ((value / 255 - 0.5) * factor + 0.5) * 255;
      contrastedData.data[i + c] = Math.max(0, Math.min(255, adjusted));
    }
    contrastedData.data[i + 3] = data[i + 3]; // Alpha
  }
  
  return contrastedData;
}

/**
 * Send success result back to main thread
 */
function sendSuccess(taskId: string, result: any) {
  const message: ProcessingResult = {
    type: 'SUCCESS',
    payload: { taskId, result }
  };
  self.postMessage(message);
}

/**
 * Send error back to main thread
 */
function sendError(taskId: string, error: string) {
  const message: ProcessingResult = {
    type: 'ERROR',
    payload: { taskId, error }
  };
  self.postMessage(message);
}

/**
 * Send progress update back to main thread
 */
function sendProgress(taskId: string, progress: number) {
  const message: ProcessingResult = {
    type: 'PROGRESS',
    payload: { taskId, progress }
  };
  self.postMessage(message);
}

export {}; // Make this a module