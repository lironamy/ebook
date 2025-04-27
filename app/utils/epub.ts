import JSZip from 'jszip';

export async function extractEpubFromBlob(blobUrl: string): Promise<{ success: boolean; text: string }> {
  try {
    console.log('[extractEpubFromBlob] Starting extraction for:', blobUrl);
    
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    
    const zip = new JSZip();
    const zipContents = await zip.loadAsync(blob);
    
    let extractedText = '';

    // First find the content.opf to get the reading order
    let contentOpf = '';
    for (const [path, file] of Object.entries(zipContents.files)) {
      if (path.toLowerCase().endsWith('content.opf')) {
        contentOpf = await file.async('string');
        break;
      }
    }

    // Parse content.opf to get the spine order
    const parser = new DOMParser();
    const doc = parser.parseFromString(contentOpf, 'application/xml');
    const spine = doc.querySelector('spine');
    const itemrefs = spine ? Array.from(spine.querySelectorAll('itemref')) : [];
    const manifest = doc.querySelector('manifest');
    
    // Get the reading order
    const readingOrder = itemrefs.map(itemref => {
      const idref = itemref.getAttribute('idref');
      const item = manifest?.querySelector(`item[id="${idref}"]`);
      return item?.getAttribute('href') || '';
    }).filter(href => href);

    // Extract chapters in reading order
    for (const href of readingOrder) {
      const file = zipContents.files[href];
      if (!file) continue;

      const content = await file.async('string');
      
      // Skip preface and afterword
      const lowerContent = content.toLowerCase();
      if (lowerContent.includes('preface') || lowerContent.includes('afterword')) {
        console.log('[extractEpubFromBlob] Skipping:', href, '(preface/afterword)');
        continue;
      }

      console.log('[extractEpubFromBlob] Extracting chapter:', href);
      
      // Extract text content from HTML
      const doc = parser.parseFromString(content, 'text/html');
      const text = doc.body?.textContent || '';
      extractedText += text + '\n\n';
    }
    
    if (!extractedText) {
      throw new Error('No valid chapter content found in EPUB');
    }

    console.log('[extractEpubFromBlob] Successfully extracted chapter content');
    return { success: true, text: extractedText };
  } catch (error) {
    console.error('[extractEpubFromBlob] Error:', error);
    return { success: false, text: '' };
  }
}