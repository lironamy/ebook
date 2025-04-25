import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { readFile } from 'fs/promises';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/epub+zip',
        'Content-Disposition': `attachment; filename="${file.name}"`,
      },
    });
  } catch (error) {
    console.error('Error handling file:', error);
    return NextResponse.json({ error: 'Error processing file' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/api/epub/');
  
  if (pathParts.length < 2) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  const filePath = decodeURIComponent(pathParts[1]);
  const tempDir = join(process.cwd(), 'temp', 'epub-extract');

  try {
    const fileContent = await readFile(join(tempDir, filePath));
    const contentType = filePath.endsWith('.xml') ? 'application/xml' : 
                       filePath.endsWith('.html') || filePath.endsWith('.xhtml') ? 'text/html' :
                       filePath.endsWith('.css') ? 'text/css' :
                       filePath.endsWith('.js') ? 'application/javascript' :
                       'application/octet-stream';

    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': contentType,
      },
    });
  } catch (error) {
    console.error('Error reading file:', error);
    return NextResponse.json({ error: 'Error reading file' }, { status: 404 });
  }
}
