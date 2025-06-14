// pages/api/blood-report/upload.js
import formidable from 'formidable';
import { readFile, writeFile } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Global in-memory storage for file data (persists across requests in same container)
global.fileStorage = global.fileStorage || new Map();

export default async function handler(req, res) {
  console.log('🔍 Upload API called, method:', req.method);
  
  if (req.method !== 'POST') {
    console.log('❌ Wrong method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('📄 Starting file upload process');
    
    // Use /tmp directory which is writable in serverless environments
    const tempDir = '/tmp';
    console.log('📁 Using temp directory:', tempDir);

    const form = formidable({
      uploadDir: tempDir,
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024,
    });

    console.log('📋 Parsing form data...');
    const [fields, files] = await form.parse(req);
    
    console.log('📋 Fields received:', Object.keys(fields));
    console.log('📋 Files received:', Object.keys(files));
    
    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    const userId = Array.isArray(fields.userId) ? fields.userId[0] : fields.userId;
    
    console.log('👤 UserId:', userId);
    console.log('📄 File info:', file ? {
      originalFilename: file.originalFilename,
      size: file.size,
      filepath: file.filepath
    } : 'No file');

    if (!file || !userId) {
      console.log('❌ Missing file or userId');
      return res.status(400).json({ 
        error: 'File and userId are required',
        received: { hasFile: !!file, userId } 
      });
    }

    const fileId = uuidv4();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${timestamp}_${fileId}_${file.originalFilename}`;
    
    console.log('📄 Reading uploaded file from:', file.filepath);
    const fileBuffer = await readFile(file.filepath);
    console.log('📄 File read successfully, size:', fileBuffer.length);
    
    // Store file data in memory with all necessary info
    const fileData = {
      fileId,
      fileName,
      fileSize: file.size,
      originalName: file.originalFilename,
      uploadedAt: new Date().toISOString(),
      userId,
      buffer: fileBuffer, // Store the actual buffer
      mimeType: file.mimetype || 'text/plain'
    };
    
    // Store in global memory
    global.fileStorage.set(fileId, fileData);
    console.log('💾 File stored in memory with ID:', fileId);
    console.log('💾 Total files in storage:', global.fileStorage.size);

    // Try to also save to /tmp for backup (optional)
    const tempPath = path.join(tempDir, fileName);
    try {
      await writeFile(tempPath, fileBuffer);
      console.log('💾 File also saved to temp path:', tempPath);
      fileData.tempPath = tempPath;
    } catch (tempError) {
      console.log('⚠️ Could not save to temp path (not critical):', tempError.message);
    }
    
    console.log('✅ File uploaded successfully:', fileName);

    const response = {
      success: true,
      fileId,
      fileName,
      fileSize: file.size,
      originalName: file.originalFilename,
      uploadedAt: new Date().toISOString(),
      stored: true
    };
    
    console.log('📤 Sending response:', response);
    return res.status(200).json(response);

  } catch (error) {
    console.error('❌ Upload error:', error);
    return res.status(500).json({ 
      error: 'File upload failed: ' + error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
