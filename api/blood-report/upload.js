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
    
    console.log('📄 Reading uploaded file from:', file.filepath);
    const fileBuffer = await readFile(file.filepath);
    console.log('📄 File read successfully, size:', fileBuffer.length);
    
    // Store file in /tmp with a predictable name based on fileId
    const storedFilePath = path.join(tempDir, `${fileId}.data`);
    const metadataPath = path.join(tempDir, `${fileId}.meta`);
    
    // Save the actual file content
    await writeFile(storedFilePath, fileBuffer);
    console.log('💾 File content saved to:', storedFilePath);
    
    // Save metadata as JSON
    const metadata = {
      fileId,
      fileName: `${timestamp}_${fileId}_${file.originalFilename}`,
      fileSize: file.size,
      originalName: file.originalFilename,
      uploadedAt: new Date().toISOString(),
      userId,
      mimeType: file.mimetype || 'text/plain',
      storedPath: storedFilePath
    };
    
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    console.log('💾 Metadata saved to:', metadataPath);
    
    console.log('✅ File uploaded and stored successfully');

    const response = {
      success: true,
      fileId,
      fileName: metadata.fileName,
      fileSize: file.size,
      originalName: file.originalFilename,
      uploadedAt: metadata.uploadedAt,
      stored: true,
      debug: {
        storedPath: storedFilePath,
        metadataPath: metadataPath
      }
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
