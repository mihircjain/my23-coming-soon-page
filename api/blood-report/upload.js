import formidable from 'formidable';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Disable body parser for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = formidable({
      uploadDir: '/tmp', // Vercel's temporary directory
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
    });

    const [fields, files] = await form.parse(req);
    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    const userId = Array.isArray(fields.userId) ? fields.userId[0] : fields.userId;

    if (!file || !userId) {
      return res.status(400).json({ error: 'File and userId are required' });
    }

    // Validate file type
    if (!file.originalFilename?.endsWith('.pdf')) {
      return res.status(400).json({ error: 'Only PDF files are allowed' });
    }

    // Generate unique file ID
    const fileId = uuidv4();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${timestamp}_${fileId}.pdf`;

    // On Vercel, we store temporarily in /tmp and should upload to cloud storage
    // For now, we'll keep it in /tmp for processing
    const tempPath = `/tmp/${fileName}`;
    await fs.copyFile(file.filepath, tempPath);

    console.log(`📄 File uploaded for ${userId}: ${fileName} (${file.size} bytes)`);

    res.status(200).json({
      success: true,
      fileId,
      fileName,
      filePath: tempPath,
      fileSize: file.size,
      uploadedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'File upload failed: ' + error.message });
  }
}
