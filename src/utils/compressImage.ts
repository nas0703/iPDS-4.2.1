/**
 * Kompres/Mampat imej pada bahagian klien menggunakan HTML Canvas sebelum dihantar ke API.
 * Ini menyelesaikan isu:
 * 1. Had muatan Vercel Serverless (4.5MB Payload Limit) -> Menghasilkan Failed to fetch.
 * 2. Kelajuan muat naik di kawasan ladang (3G/4G perlahan).
 * 3. Kualiti optimum untuk pemprosesan Vision AI/OCR (Gemini).
 */
export async function compressImage(
  input: File | string,
  maxDimension = 1600,
  quality = 0.85
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    // Check if we are running in a browser environment (canvas is supported)
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      // If server-side or non-browser, return base64 content of file or input
      if (input instanceof File) {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(",")[1];
          resolve(base64);
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(input);
      } else {
        const base64Data = input.startsWith('data:') ? input.split(',')[1] : input;
        resolve(base64Data);
      }
      return;
    }

    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions keeping aspect ratio
      if (width > height) {
        if (width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Gagal menyediakan konteks kanvas 2D untuk pemampatan imej."));
        return;
      }

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      
      // Get base64 string
      const base64 = canvas.toDataURL("image/jpeg", quality);
      const base64Data = base64.split(",")[1];
      resolve(base64Data);
    };

    img.onerror = () => {
      reject(new Error("Gagal membaca imej untuk pemampatan. Sila pastikan format fail adalah imej sah."));
    };

    if (input instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(input);
    } else {
      // It's already a base64 or data URL string
      img.src = input.startsWith('data:') ? input : `data:image/jpeg;base64,${input}`;
    }
  });
}
