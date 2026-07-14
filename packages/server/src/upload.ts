import multer from 'multer';

// docs/plan.md §2.7: "v1 asume carga en memoria con límite 50 MB".
export const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;

export function createUpload(maxFileSizeBytes: number) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxFileSizeBytes },
  });
}

export const upload = createUpload(MAX_UPLOAD_SIZE_BYTES);
