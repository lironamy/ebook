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

export async function POST(request: NextRequest) {
  try {
    const { files, blobUrl } = await request.json();
    
    if (!files || !blobUrl) {
      return NextResponse.json({ error: 'Missing files or blobUrl' }, { status: 400 });
    }

    console.log('[store] Storing', files.length, 'files for blob:', blobUrl);

    const mongoClient = await getMongoClient();
    const db = mongoClient.db('epub-reader');
    const collection = db.collection('epub-files');

    // Store each file
    for (const file of files) {
      await collection.insertOne({
        blobUrl,
        path: file.path,
        content: file.content
      });
    }

    console.log('[store] Successfully stored', files.length, 'files in MongoDB');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[store] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to store EPUB contents' },
      { status: 500 }
    );
  }
}
