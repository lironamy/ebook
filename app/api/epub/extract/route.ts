import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { promises as fs } from 'fs';
import JSZip from 'jszip';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Read the EPUB file (which is a ZIP file)
    const zip = new JSZip();
    const contents = await zip.loadAsync(buffer);
    
    // Ensure temp directory exists
    const tempDir = join(process.cwd(), 'temp', 'epub-extract');
    await fs.mkdir(tempDir, { recursive: true });
    
    // Extract all files
    const extractionPromises = Object.keys(contents.files).map(async (filename) => {
      const file = contents.files[filename];
      if (!file.dir) {
        const content = await file.async('uint8array');
        const filePath = join(tempDir, filename);
        const fileDir = join(tempDir, filename.split('/').slice(0, -1).join('/'));
        
        // Create directory if it doesn't exist
        await fs.mkdir(fileDir, { recursive: true });
        
        // Write file to disk
        await fs.writeFile(filePath, content);
      }
    });
    
    await Promise.all(extractionPromises);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error extracting EPUB:', error);
    return NextResponse.json({ error: 'Error extracting EPUB' }, { status: 500 });
  }
}
