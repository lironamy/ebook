import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    await request.json(); // Just parse the request body without destructuring unused variables
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[store] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to store EPUB contents' },
      { status: 500 }
    );
  }
}
