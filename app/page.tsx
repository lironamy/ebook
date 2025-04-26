'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import EpubViewer, { isPlaying, setIsPlaying } from './components/EpubViewer';
import TextToSpeech from './components/TextToSpeech';

export default function Home() {
  const [book, setBook] = useState<string | null>(null);
  const [currentText, setCurrentText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (book && book.startsWith('blob:')) {
        URL.revokeObjectURL(book);
      }
    };
  }, [book]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/epub', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload file');
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      setBook(blobUrl);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextExtracted = useCallback((text: string) => {
    setCurrentText(text);
  }, []);

  const handleHighlight = useCallback((position: number) => {
    const contentElement = document.querySelector('.epub-container');
    if (contentElement) {
      const range = document.createRange();
      const textNodes = Array.from(contentElement.querySelectorAll('*'))
        .filter(node => node.childNodes.length === 1 && node.firstChild?.nodeType === Node.TEXT_NODE)
        .map(node => node.firstChild as Text);
      
      let currentPosition = 0;
      for (const node of textNodes) {
        if (currentPosition + node.length >= position) {
          const offset = position - currentPosition;
          range.setStart(node, offset);
          range.setEnd(node, offset + 1);
          break;
        }
        currentPosition += node.length;
      }
    }
  }, []);

  return (
    <main className="min-h-screen p-8 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex flex-col items-center">
          <h1 className="text-4xl font-bold mb-6 text-center">Ebook Voice Reader</h1>
          <div className="flex justify-center">
            <input
              type="file"
              accept=".epub"
              onChange={handleFileUpload}
              ref={fileInputRef}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className={`
                flex items-center justify-center gap-3 
                ${isLoading 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'
                }
                text-white font-semibold
                px-8 py-4 rounded-xl
                shadow-lg hover:shadow-xl
                transform hover:-translate-y-0.5
                transition-all duration-200
                text-lg
                min-w-[200px]
              `}
            >
              {isLoading ? (
                <>
                  <svg className="svgIcon animate-spin h-2 w-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <svg className="svgIcon w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span>Upload Ebook</span>
                </>
              )}
            </label>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-4 min-h-[600px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-[600px] text-gray-500">
              Loading ebook...
            </div>
          ) : book ? (
            <>
              <EpubViewer
                url={book}
                onTextExtracted={handleTextExtracted}
              />
              {currentText && (
                <>
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    {isPlaying ? 'Pause' : 'Play'}
                  </button>
                  <TextToSpeech
                    text={currentText}
                    isPlaying={isPlaying}
                    onHighlight={handleHighlight}
                  />
                </>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-[600px] text-gray-500">
              Upload an ebook to start reading
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
