
import formidable from 'formidable';
import { copyFile } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

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

    const form = formidable({
      uploadDir: '/tmp',
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
    const tempPath = `/tmp/${fileName}`;
    
    console.log('💾 Copying file to:', tempPath);
    await copyFile(file.filepath, tempPath);

    console.log('✅ File uploaded successfully:', fileName);

    const response = {
      success: true,
      fileId,
      fileName,
      filePath: tempPath,
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
      stack: error.stack 
    });
  }
}
