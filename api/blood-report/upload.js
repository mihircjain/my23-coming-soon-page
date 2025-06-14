// pages/api/blood-report/upload.js
import formidable from 'formidable';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

// In-memory storage for file data (for demo purposes)
// In production, you'd use a database or cloud storage
const fileStorage = new Map();

export default async function handler(req, res) {
  console.log('🔍 Upload API called, method:', req.method);
  
  if (req.method !== 'POST') {
    console.log('❌ Wrong method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('📄 Starting file upload process');
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
      console.log('📁 Created uploads directory');
    }

    const form = formidable({
      uploadDir: uploadsDir,
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
    const permanentPath = path.join(uploadsDir, fileName);
    
    console.log('📄 Reading uploaded file...');
    const fileBuffer = await readFile(file.filepath);
    
    console.log('💾 Saving file to permanent location:', permanentPath);
    await writeFile(permanentPath, fileBuffer);
    
    // Also store in memory for immediate access
    const fileData = {
      fileId,
      fileName,
      filePath: permanentPath,
      fileSize: file.size,
      originalName: file.originalFilename,
      uploadedAt: new Date().toISOString(),
      userId,
      buffer: fileBuffer.toString('base64') // Store as base64 for safety
    };
    
    fileStorage.set(fileId, fileData);
    console.log('💾 File stored in memory with ID:', fileId);
    
    console.log('✅ File uploaded successfully:', fileName);

    const response = {
      success: true,
      fileId,
      fileName,
      filePath: permanentPath,
      fileSize: file.size,
      originalName: file.originalFilename,
      uploadedAt: new Date().toISOString()
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

// Export fileStorage for use in other APIs
export { fileStorage };
