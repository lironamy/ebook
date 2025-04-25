import JSZip from 'jszip';

export async function extractEpubFromBlob(blobUrl: string): Promise<{ success: boolean; text: string }> {
  try {
    console.log('[extractEpubFromBlob] Starting extraction for:', blobUrl);
    
    // Fetch the blob
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    
    // Load and parse the EPUB
    const zip = new JSZip();
    const zipContents = await zip.loadAsync(blob);
    
    // Extract each file
    const files = [];
    let extractedText = '';
    for (const [path, file] of Object.entries(zipContents.files)) {
      if (!file.dir) {
        const content = await file.async('string');
        // Clean the path to ensure consistent format
        const cleanPath = path.replace(/^\/+/, '');
        console.log('[extractEpubFromBlob] Extracting file:', cleanPath);
        files.push({
          path: cleanPath,
          content
        });
        extractedText += content + '\n';
      }
    }
    
    // Store files via API route
    const storeResponse = await fetch('/api/epub/store', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        blobUrl,
        files
      })
    });
    
    if (!storeResponse.ok) {
      const error = await storeResponse.json();
      throw new Error(`Failed to store EPUB contents: ${error.message}`);
    }
    
    console.log('[extractEpubFromBlob] Successfully stored', files.length, 'files');
    return { success: true, text: extractedText };
  } catch (error) {
    console.error('[extractEpubFromBlob] Error:', error);
    return { success: false, text: '' };
  }
}