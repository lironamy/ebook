import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

let client: MongoClient;

async function getMongoClient() {
  if (!client) {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
  }
  return client;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    // Get the blobUrl from headers
    const blobUrl = request.headers.get('x-epub-blob-url');
    if (!blobUrl) {
      console.error('[GET] Missing x-epub-blob-url header');
      return NextResponse.json({ error: 'Missing x-epub-blob-url header' }, { 
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'x-epub-blob-url, Accept',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Credentials': 'true'
        }
      });
    }

    const resolvedParams = await params;
    const filePath = resolvedParams.path.join('/');
    console.log('[GET] Fetching file:', filePath, 'for blob:', blobUrl);

    const mongoClient = await getMongoClient();
    const db = mongoClient.db('epub-reader');
    const collection = db.collection('epub-files');

    // Find the file in MongoDB
    const result = await collection.findOne({
      blobUrl,
      path: filePath
    });

    console.log('[GET] MongoDB query result:', result ? 'Found' : 'Not found');

    if (!result) {
      console.error('[GET] File not found:', filePath);
      return NextResponse.json({ error: 'File not found' }, { 
        status: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'x-epub-blob-url, Accept',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Credentials': 'true'
        }
      });
    }

    // Determine content type based on file extension
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const contentType = {
      'xml': 'application/xml',
      'html': 'text/html',
      'xhtml': 'application/xhtml+xml',
      'css': 'text/css',
      'js': 'application/javascript',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'opf': 'application/oebps-package+xml',
      'ncx': 'application/x-dtbncx+xml'
    }[ext] || 'application/octet-stream';

    // Return the file content with appropriate headers
    return new NextResponse(result.content, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'x-epub-blob-url, Accept',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Credentials': 'true'
      }
    });
  } catch (error) {
    console.error('[GET] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'x-epub-blob-url, Accept',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Credentials': 'true'
    }
  });
}