'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import EpubViewer from './components/EpubViewer';
import TextToSpeech from './components/TextToSpeech';
import './styles/footer.css';

export default function Home() {
  const [book, setBook] = useState<string | null>(null);
  const [isPlaying] = useState(false);
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
        <div className="flex flex-col items-center">
          {!book && (
            <div className="header-text flex flex-col items-center">
              <p className="lead-text1">Ebook Voice Reader</p>
              <div className="header-text-rio">
                <p className="lead-text">Dedicated to all</p>
                <div className="header-text-rio-agatha">
                  <b className="title-text">Agatha</b>
                  <b className="title-textRio">Rio</b>
                </div>
                <p className="lead-text">fans!</p>
              </div>
            </div>
          )}
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
        {!book && (
          <div className="footer">
            <div className="social-links">
              <a href="https://www.linkedin.com/in/liron-avraham-788957254/?originalSubdomain=il" target="_blank" rel="noopener noreferrer" className="social-link linkedin">
                <svg className="social-icon" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                </svg>
              </a>
              <a href="https://github.com/lironamy" target="_blank" rel="noopener noreferrer" className="social-link github">
                <svg className="social-icon" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </a>
              <a href="https://x.com/Lily_Allenn" target="_blank" rel="noopener noreferrer" className="social-link twitter">
                <svg className="social-icon" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
            </div>
            <p className="copyright"> Liron Lin Avraham | All Rights Reserved</p>
          </div>
        )}
      </div>
    </main>
  );
}
