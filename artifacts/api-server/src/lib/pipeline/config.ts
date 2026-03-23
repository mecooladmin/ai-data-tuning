export const PIPELINE_CONFIG = {
  maxFileSizeBytes: 50 * 1024 * 1024,    // 50 MB
  maxFileSizeMB: 50,
  maxFilesPerJob: 100,
  maxFilesPerRequest: 10,
  supportedMimeTypes: [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/bmp",
    "image/tiff",
    "image/gif",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
    "text/csv",
    "application/json",
    "text/xml",
    "application/xml",
    "text/html",
  ],
  supportedExtensions: [
    ".pdf",
    ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".gif",
    ".docx",
    ".txt", ".md", ".csv", ".json", ".xml", ".html",
  ],
} as const;
