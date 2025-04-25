'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import EpubViewer from './components/EpubViewer';
import TextToSpeech from './components/TextToSpeech';

export default function Home() {
  const [book, setBook] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
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

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
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
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">AI Ebook Reader</h1>
          <div className="flex gap-4 items-center">
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
              className={`${
                isLoading ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'
              } text-white px-4 py-2 rounded cursor-pointer`}
            >
              {isLoading ? 'Uploading...' : 'Upload Ebook'}
            </label>
            <button
              onClick={togglePlayPause}
              className={`${
                isPlaying ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
              } text-white px-4 py-2 rounded`}
              disabled={!book || isLoading}
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
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
                <TextToSpeech
                  text={currentText}
                  isPlaying={isPlaying}
                  onHighlight={handleHighlight}
                />
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
