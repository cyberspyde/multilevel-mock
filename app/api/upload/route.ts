import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, stat } from 'fs/promises';
import { existsSync, createReadStream } from 'fs';
import path from 'path';

// Maximum file sizes (in bytes) - Increased for better support
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 50MB - Increased from 20MB
const MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200MB - Increased from 50MB

// Allowed file types - Extended list
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4',
  'audio/x-wav', 'audio/x-mpeg', 'audio/aac', 'audio/m4a', 'audio/x-m4a',
  // Handle browser recordings with codec info in MIME type
  'audio/webm;codecs=opus', 'audio/webm;codecs=vp8,opus',
  'audio/ogg;codecs=opus',
];
const ALLOWED_VIDEO_TYPES = [
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo',
  'video/x-matroska', 'video/x-flv'
];

// Get file size and type limits based on file type
function getFileLimits(fileType: string) {
  // Extract base MIME type (remove codec info like ";codecs=opus")
  const baseMimeType = fileType.split(';')[0].trim().toLowerCase();

  // Check against base types for more flexible matching
  const isImage = ALLOWED_IMAGE_TYPES.some(t => t.split(';')[0].trim() === baseMimeType);
  const isAudio = ALLOWED_AUDIO_TYPES.some(t => t.split(';')[0].trim() === baseMimeType);
  const isVideo = ALLOWED_VIDEO_TYPES.some(t => t.split(';')[0].trim() === baseMimeType);

  // Also check if the base type starts with known prefixes
  const startsWithAudio = baseMimeType.startsWith('audio/');
  const startsWithVideo = baseMimeType.startsWith('video/');
  const startsWithImage = baseMimeType.startsWith('image/');

  if (isImage || (startsWithImage && !baseMimeType.includes('svg'))) {
    return { maxSize: MAX_IMAGE_SIZE, allowedTypes: [...ALLOWED_IMAGE_TYPES], name: 'Image' };
  } else if (isAudio || startsWithAudio) {
    return { maxSize: MAX_AUDIO_SIZE, allowedTypes: [...ALLOWED_AUDIO_TYPES], name: 'Audio' };
  } else if (isVideo || startsWithVideo) {
    return { maxSize: MAX_VIDEO_SIZE, allowedTypes: [...ALLOWED_VIDEO_TYPES], name: 'Video' };
  }
  return { maxSize: MAX_FILE_SIZE, allowedTypes: [...ALLOWED_IMAGE_TYPES, ...ALLOWED_AUDIO_TYPES, ...ALLOWED_VIDEO_TYPES], name: 'File' };
}

// Generate unique filename
function generateFilename(originalName: string): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const ext = path.extname(originalName);
  const nameWithoutExt = path.basename(originalName, ext).replace(/[^a-z0-9]/gi, '-').toLowerCase();
  return `${timestamp}-${randomString}-${nameWithoutExt}${ext}`;
}

// User-friendly error messages
const ERROR_MESSAGES = {
  NO_FILE: 'Please select a file to upload.',
  INVALID_TYPE: (type: string) => `File type "${type}" is not supported. Please upload an image (JPG, PNG, GIF, WebP), audio (MP3, WAV, OGG, WebM, M4A, AAC), or video (MP4, WebM, MOV, AVI).`,
  TOO_LARGE: (maxMB: number, type: string) => `${type} file is too large. Maximum size is ${maxMB}MB. Please compress your file and try again.`,
  SAVE_FAILED: 'Failed to save the file. Please check if the uploads directory exists and has write permissions.',
  DISK_FULL: 'Server disk is full. Please contact the administrator.',
};

// Helper to determine if a file is media (for streaming)
function isMediaFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ['.mp4', '.webm', '.ogg', '.mp3', '.wav', '.m4a', '.aac', '.mov', '.avi', '.mkv'].includes(ext);
}

// Helper to get MIME type based on file extension
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'audio/ogg',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// POST /api/upload - Upload a file
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.NO_FILE },
        { status: 400 }
      );
    }

    // Validate file type
    const { maxSize, allowedTypes, name: fileType } = getFileLimits(file.type);
    const baseMimeType = file.type.split(';')[0].trim().toLowerCase();

    // Check if the base type is in allowed types
    const isAllowed = allowedTypes.some(t => t.split(';')[0].trim() === baseMimeType) ||
                      allowedTypes.some(t => t.split(';')[0].trim().startsWith(baseMimeType.split('/')[0] + '/'));

    if (!isAllowed && !baseMimeType.startsWith('audio/') && !baseMimeType.startsWith('video/') && !baseMimeType.startsWith('image/')) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.INVALID_TYPE(file.type) },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024);
      return NextResponse.json(
        { error: ERROR_MESSAGES.TOO_LARGE(maxSizeMB, fileType) },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename
    const filename = generateFilename(file.name);

    // Determine upload directory based on file type
    let uploadDir = 'public/uploads';
    if (baseMimeType.startsWith('image/')) {
      uploadDir = 'public/uploads/images';
    } else if (baseMimeType.startsWith('audio/')) {
      uploadDir = 'public/uploads/audio';
    } else if (baseMimeType.startsWith('video/')) {
      uploadDir = 'public/uploads/videos';
    }

    // Create directory if it doesn't exist
    const fullPath = path.join(process.cwd(), uploadDir);
    if (!existsSync(fullPath)) {
      await mkdir(fullPath, { recursive: true });
    }

    // Write file to disk
    const filePath = path.join(fullPath, filename);
    await writeFile(filePath, buffer);

    // Return the URL path - use API route for serving to ensure files work immediately
    const urlPath = filePath.replace(path.join(process.cwd(), 'public'), '')
      .replace(/\\/g, '/')
      .replace(/^\//, '');

    return NextResponse.json({
      // Use API route for serving files (works immediately after upload)
      url: `/api/upload?file=/${urlPath}`,
      filename: filename,
      size: file.size,
      type: file.type
    });
  } catch (error: any) {
    console.error('[Upload API] Error:', error);

    // Check for specific error types
    if (error.code === 'ENOSPC') {
      return NextResponse.json(
        { error: ERROR_MESSAGES.DISK_FULL },
        { status: 500 }
      );
    }

    if (error.code === 'EACCES' || error.code === 'EPERM') {
      return NextResponse.json(
        { error: ERROR_MESSAGES.SAVE_FAILED },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: `Failed to upload file: ${error.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// GET /api/upload - Stream media files with range request support
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filePath = searchParams.get('file');

    if (!filePath) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      );
    }

    // Remove leading slash if present and normalize the path
    const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;

    // Security: Ensure the file path is within uploads directory and doesn't escape
    const normalizedPath = path.normalize(cleanPath).replace(/^(\.\.(\/|\\|$))+/, '');
    const fullPath = path.join(process.cwd(), 'public', normalizedPath);

    console.log('[Upload GET] filePath:', filePath);
    console.log('[Upload GET] cleanPath:', cleanPath);
    console.log('[Upload GET] normalizedPath:', normalizedPath);
    console.log('[Upload GET] fullPath:', fullPath);

    // Check if file exists
    if (!existsSync(fullPath)) {
      console.error('[Upload GET] File not found:', fullPath);
      return NextResponse.json(
        { error: 'File not found', path: fullPath },
        { status: 404 }
      );
    }

    // Get file stats
    const stats = await stat(fullPath);
    const fileSize = stats.size;
    const mimeType = getMimeType(fullPath);

    // Handle Range request for streaming
    const range = request.headers.get('range');

    if (range && isMediaFile(fullPath)) {
      // Parse Range header (format: "bytes=start-end")
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      // Validate range
      if (start >= fileSize || end >= fileSize || start > end) {
        return new NextResponse('Invalid Range', {
          status: 416,
          headers: {
            'Content-Range': `bytes */${fileSize}`,
          },
        });
      }

      // Calculate chunk size
      const chunkSize = end - start + 1;

      // Create readable stream for the requested range
      const stream = createReadStream(fullPath, { start, end });

      // Convert Node.js stream to Web Stream
      const webStream = new ReadableStream({
        start(controller) {
          stream.on('data', (chunk: Buffer | string) => {
            controller.enqueue(new Uint8Array(Buffer.from(chunk)));
          });
          stream.on('end', () => {
            controller.close();
          });
          stream.on('error', (err) => {
            controller.error(err);
          });
        },
        cancel() {
          stream.destroy();
        },
      });

      return new NextResponse(webStream, {
        status: 206, // Partial Content
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize.toString(),
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // For non-range requests or non-media files, serve the entire file
    const stream = createReadStream(fullPath);
    const webStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk: Buffer | string) => {
          controller.enqueue(new Uint8Array(Buffer.from(chunk)));
        });
        stream.on('end', () => {
          controller.close();
        });
        stream.on('error', (err) => {
          controller.error(err);
        });
      },
      cancel() {
        stream.destroy();
      },
    });

    return new NextResponse(webStream, {
      headers: {
        'Content-Length': fileSize.toString(),
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: any) {
    console.error('[Upload API GET] Error:', error);
    return NextResponse.json(
      { error: `Failed to serve file: ${error.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}
