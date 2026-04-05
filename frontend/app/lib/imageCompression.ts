/**
 * Image compression utility
 * Compresses images before upload to reduce file size and improve upload speed
 */

export const MAX_IMAGE_SIZE_MB = 20;
export const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeMB?: number;
}

const defaultOptions: CompressionOptions = {
  maxWidth: 3840,
  maxHeight: 3840,
  quality: 0.95,
  maxSizeMB: 10,
};

/**
 * Compress a single image file
 * @param file - The image file to compress
 * @param options - Compression options
 * @returns Promise<File> - Compressed image file
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const opts = { ...defaultOptions, ...options };
  
  // Skip compression for files under 5MB or non-image files
  if (file.size < 5 * 1024 * 1024 || !file.type.startsWith('image/')) {
    return file;
  }
  
  // Skip compression for GIFs (to preserve animation)
  if (file.type === 'image/gif') {
    return file;
  }
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    img.onload = () => {
      try {
        let { width, height } = img;
        
        // Calculate new dimensions while maintaining aspect ratio
        if (width > opts.maxWidth! || height > opts.maxHeight!) {
          const ratio = Math.min(
            opts.maxWidth! / width,
            opts.maxHeight! / height
          );
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw image on canvas
        ctx!.drawImage(img, 0, 0, width, height);
        
        // Preserve original format when possible
        const outputType = file.type === 'image/png' ? 'image/png' : 
                          file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
        
        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file); // Return original if compression fails
              return;
            }
            
            // If compressed file is larger, return original
            if (blob.size >= file.size) {
              resolve(file);
              return;
            }
            
            // Create new file with same name
            const compressedFile = new File([blob], file.name, {
              type: outputType,
              lastModified: Date.now(),
            });
            
            console.log(
              `Compressed ${file.name}: ${(file.size / 1024 / 1024).toFixed(2)}MB -> ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`
            );
            
            resolve(compressedFile);
          },
          outputType,
          opts.quality
        );
      } catch (error) {
        console.error('Image compression error:', error);
        resolve(file); // Return original on error
      }
    };
    
    img.onerror = () => {
      console.error('Failed to load image for compression');
      resolve(file); // Return original on error
    };
    
    // Load image from file
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      resolve(file);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Compress multiple images in parallel
 * @param files - Array of image files to compress
 * @param options - Compression options
 * @returns Promise<File[]> - Array of compressed image files
 */
export async function compressImages(
  files: File[],
  options: CompressionOptions = {}
): Promise<File[]> {
  const compressionPromises = files.map((file) => compressImage(file, options));
  return Promise.all(compressionPromises);
}
