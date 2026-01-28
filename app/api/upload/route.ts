import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Maximum file sizes (in bytes)
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_AUDIO_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

// Allowed file types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg'];

// Get file size and type limits based on file type
function getFileLimits(fileType: string) {
  if (ALLOWED_IMAGE_TYPES.includes(fileType)) {
    return { maxSize: MAX_IMAGE_SIZE, allowedTypes: ALLOWED_IMAGE_TYPES, name: 'Image' };
  } else if (ALLOWED_AUDIO_TYPES.includes(fileType)) {
    return { maxSize: MAX_AUDIO_SIZE, allowedTypes: ALLOWED_AUDIO_TYPES, name: 'Audio' };
  } else if (ALLOWED_VIDEO_TYPES.includes(fileType)) {
    return { maxSize: MAX_VIDEO_SIZE, allowedTypes: ALLOWED_VIDEO_TYPES, name: 'Video' };
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
  INVALID_TYPE: (type: string) => `File type "${type}" is not supported. Please upload an image (JPG, PNG, GIF, WebP), audio (MP3, WAV, OGG, WebM), or video (MP4, WebM).`,
  TOO_LARGE: (maxMB: number, type: string) => `${type} file is too large. Maximum size is ${maxMB}MB. Please compress your file and try again.`,
  SAVE_FAILED: 'Failed to save the file. Please check if the uploads directory exists and has write permissions.',
  DISK_FULL: 'Server disk is full. Please contact the administrator.',
};

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
    if (!allowedTypes.includes(file.type)) {
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
    if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
      uploadDir = 'public/uploads/images';
    } else if (ALLOWED_AUDIO_TYPES.includes(file.type)) {
      uploadDir = 'public/uploads/audio';
    } else if (ALLOWED_VIDEO_TYPES.includes(file.type)) {
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

    // Return the URL path (relative to public directory)
    const urlPath = filePath.replace(path.join(process.cwd(), 'public'), '');
    const url = urlPath.replace(/\\/g, '/'); // Convert Windows backslashes to forward slashes

    return NextResponse.json({
      url: `/${url.replace(/^\//, '')}`,
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
