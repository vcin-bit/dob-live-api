/**
 * Compress an image file before upload.
 * Resizes to max 1200px on longest side, JPEG at 80% quality.
 * Returns a new File object.
 */
export async function compressImage(file, { maxSize = 1200, quality = 0.8 } = {}) {
  // Skip non-images and already-small files
  if (!file.type.startsWith('image/') || file.size < 100000) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      // Scale down if needed
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round(height * (maxSize / width));
          width = maxSize;
        } else {
          width = Math.round(width * (maxSize / height));
          height = maxSize;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return; }
        const compressed = new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
        console.log(`Image compressed: ${(file.size/1024).toFixed(0)}KB → ${(compressed.size/1024).toFixed(0)}KB (${width}x${height})`);
        resolve(compressed);
      }, 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}
