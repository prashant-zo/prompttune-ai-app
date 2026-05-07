export async function compressImage(file: File, maxWidth = 1024, maxHeight = 1024, quality = 0.8): Promise<File> {
  // We only compress images (not PDFs or other types)
  if (!file.type.startsWith('image/')) {
    return file;
  }

  // We skip SVG or GIFs to preserve their original formatting/animation
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(file); // fallback to original if canvas fails
        }

        // Fill background with white in case of transparent PNG to JPEG conversion
        if (file.type === 'image/png') {
           ctx.fillStyle = '#FFFFFF';
           ctx.fillRect(0, 0, width, height);
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Convert back to file, defaulting to JPEG for better compression
        const outputType = 'image/jpeg';
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve(file);
            }
            // FIX #13: If compressed is larger than original, keep original
            if (blob.size >= file.size) {
              return resolve(file);
            }
            const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
            const compressedFile = new File([blob], newFileName, {
              type: outputType,
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          outputType,
          quality
        );
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
}
