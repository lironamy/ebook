'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ReactReader } from 'react-reader';
import { extractEpubFromBlob } from '../utils/epub';
import './epub-styles.css';
import type { Rendition } from 'epubjs';

interface EpubViewerProps {
  url: string;
  onTextExtracted?: (text: string) => void;
}

interface Voice {
  name: string;
  voice: SpeechSynthesisVoice;
}

export default function EpubViewer({ url, onTextExtracted }: EpubViewerProps) {
  const [location, setLocation] = useState<string | number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [epubData, setEpubData] = useState<ArrayBuffer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [availableVoices, setAvailableVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null);
  const currentCharIndexRef = useRef<number>(0);
  const lastWordIndexRef = useRef<number>(0);
  const renditionRef = useRef<Rendition | undefined>(undefined);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const readerRef = useRef<Rendition | undefined>(undefined);
  const highlightSpanRef = useRef<HTMLSpanElement | null>(null);
  const currentTextRef = useRef<string>('');
  const isManuallyPaused = useRef<boolean>(false);

  const removeHighlight = useCallback(() => {
    if (highlightSpanRef.current?.parentNode) {
      const text = highlightSpanRef.current.textContent;
      const textNode = document.createTextNode(text || '');
      highlightSpanRef.current.parentNode.replaceChild(textNode, highlightSpanRef.current);
      highlightSpanRef.current = null;
    }
  }, []);

  const stopSpeech = useCallback(() => {
    if (speechRef.current) {
      // Store the current position when manually paused
      if (isManuallyPaused.current) {
        // Removed pausedPosition state
      }
      
      speechRef.current.onend = null;
      speechRef.current.onboundary = null;
      speechRef.current.onerror = null;
    }
    window.speechSynthesis.cancel();
    removeHighlight();
    setIsPlaying(false);
  }, [removeHighlight]);

  const highlightCurrentWord = useCallback((text: string, charIndex: number, wordLength: number) => {
    removeHighlight();

    try {
      const iframe = document.querySelector('iframe');
      if (!iframe?.contentDocument?.body) return;

      const doc = iframe.contentDocument;
      const body = doc.body;

      // Find the text node containing this character index
      let currentPos = 0;
      let foundNode: Text | null = null;
      let foundStart = 0;

      const walker = document.createTreeWalker(
        body,
        NodeFilter.SHOW_TEXT,
        null
      );

      let node: Text | null;
      
      while ((node = walker.nextNode() as Text)) {
        const textContent = node.textContent || '';
        if (charIndex >= currentPos && charIndex < currentPos + textContent.length) {
          foundNode = node;
          foundStart = charIndex - currentPos;
          break;
        }
        currentPos += textContent.length;
      }

      if (foundNode) {
        const range = doc.createRange();
        range.setStart(foundNode, foundStart);
        range.setEnd(foundNode, foundStart + wordLength);

        const span = doc.createElement('span');
        span.style.backgroundColor = '#ffeb3b';
        span.style.color = '#000';
        span.style.transition = 'background-color 0.2s ease-in-out';
        
        range.surroundContents(span);
        highlightSpanRef.current = span;

        // Ensure the highlighted word is visible
        const rect = span.getBoundingClientRect();
        const iframeRect = iframe.getBoundingClientRect();
        if (rect.top < iframeRect.top || rect.bottom > iframeRect.bottom) {
          span.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    } catch (err) {
      console.error('Error highlighting word:', err);
    }
  }, [removeHighlight]);

  const startSpeech = useCallback(async () => {
    const text = await getCurrentPageText();
    if (!text) return;

    // Reset manual pause flag when starting new speech
    isManuallyPaused.current = false;
    currentTextRef.current = text;

    // Create a new utterance starting from the current position
    const startIndex = currentCharIndexRef.current;
    const utterance = new SpeechSynthesisUtterance(text.slice(startIndex));
    utterance.rate = speechRate;

    // Set the selected voice
    if (selectedVoice) {
      utterance.voice = selectedVoice.voice;
    }

    // Handle word boundaries for highlighting
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        const globalCharIndex = startIndex + event.charIndex;
        const word = text.slice(globalCharIndex).split(/\s+/)[0] || '';
        
        // Update indices and highlight with proper word boundaries
        currentCharIndexRef.current = globalCharIndex;
        lastWordIndexRef.current = globalCharIndex + word.length;
        
        // Highlight the full word
        highlightCurrentWord(text, globalCharIndex, word.length);
      }
    };

    // Handle speech end
    utterance.onend = () => {
      removeHighlight();
      // Only proceed if we're still in playing state and not manually paused
      if (isPlaying && !isManuallyPaused.current && renditionRef.current) {
        // Try to move to next page
        renditionRef.current.next().then(() => {
          // Check if we're at the end of the book
          if (!renditionRef.current) {
            setIsPlaying(false);
          } else {
            // Reset character index for new page
            currentCharIndexRef.current = 0;
            startSpeech();
          }
        });
      }
    };

    // Handle errors
    utterance.onerror = (event) => {
      if (event.error !== 'interrupted' || !isManuallyPaused.current) {
        console.error('Speech synthesis error:', event);
        setIsPlaying(false);
      }
    };

    // Store the utterance and start speaking
    speechRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
  }, [speechRate, isPlaying, removeHighlight, highlightCurrentWord, selectedVoice]);

  const toggleSpeech = useCallback(() => {
    if (isPlaying) {
      isManuallyPaused.current = true;
      stopSpeech();
    } else {
      startSpeech();
    }
  }, [isPlaying, stopSpeech, startSpeech]);

  const handleTextClick = useCallback((event: MouseEvent) => {
    const iframe = document.querySelector('iframe');
    if (!iframe?.contentDocument) return;

    const doc = iframe.contentDocument;
    const selection = doc.getSelection();
    if (!selection) return;

    const range = doc.caretRangeFromPoint(event.clientX, event.clientY);
    if (!range) return;

    // Get the text node
    const textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) return;

    // Get the full page text
    getCurrentPageText().then(text => {
      if (!iframe?.contentDocument?.body) return;

      const body = iframe.contentDocument.body;

      // Calculate the absolute position in the text
      let absolutePosition = 0;
      const walker = document.createTreeWalker(
        body,
        NodeFilter.SHOW_TEXT,
        null
      );

      let node: Text | null;
      let foundClickedNode = false;
      while ((node = walker.nextNode() as Text)) {
        if (node === textNode) {
          absolutePosition += range.startOffset;
          foundClickedNode = true;
          break;
        }
        absolutePosition += node.textContent?.length || 0;
      }

      if (!foundClickedNode) return;

      // Find word boundaries
      let wordStart = absolutePosition;
      while (wordStart > 0 && !/\s/.test(text[wordStart - 1])) {
        wordStart--;
      }

      let wordEnd = absolutePosition;
      while (wordEnd < text.length && !/\s/.test(text[wordEnd])) {
        wordEnd++;
      }

      // Update current position to start of word
      currentCharIndexRef.current = wordStart;
      lastWordIndexRef.current = wordEnd;

      // Highlight the word before starting speech
      const wordLength = wordEnd - wordStart;
      highlightCurrentWord(text, wordStart, wordLength);

      // Start or restart speech from this position
      if (isPlaying) {
        stopSpeech();
      }
      startSpeech();
    });
  }, [isPlaying, stopSpeech, startSpeech, highlightCurrentWord]);

  const handleRateChange = useCallback((newRate: number) => {
    setSpeechRate(newRate);
    if (isPlaying) {
      const currentPosition = currentCharIndexRef.current;
      stopSpeech();
      // Preserve the position and restart with new rate
      setTimeout(() => {
        currentCharIndexRef.current = currentPosition;
        startSpeech();
      }, 100);
    }
  }, [isPlaying, stopSpeech, startSpeech]);

  const locationChanged = (epubcifi: string) => {
    setLocation(epubcifi);
    // Only start reading if we're not already playing
    if (isPlaying && !speechRef.current) {
      startSpeech();
    }

    // Scroll to top after a short delay to ensure the new content is loaded
    setTimeout(() => {
      const iframe = document.querySelector('iframe');
      if (iframe?.contentDocument?.body) {
        iframe.contentDocument.body.scrollTop = 0;
        iframe.contentDocument.documentElement.scrollTop = 0;
        iframe.contentWindow?.scrollTo(0, 0);
      }
    }, 100);
  };

  const getRendition = (rendition: Rendition) => {
    renditionRef.current = rendition;
    
    // Store the reader instance
    if (rendition.book) {
      readerRef.current = rendition;
    }
    
    // Set up content change listener
    rendition.on('rendered', (section: unknown) => {
      console.log('New section rendered:', section);
    });
  };

  const getCurrentPageText = async (): Promise<string> => {
    if (!renditionRef.current) return '';
    
    try {
      // Get text from the current page's iframe
      const iframe = document.querySelector('iframe');
      if (!iframe?.contentDocument) return '';

      const doc = iframe.contentDocument;
      const body = doc.body;

      // Get all text content
      const text = body?.textContent || '';
      currentTextRef.current = text;
      return text;
    } catch (err) {
      console.error('Error getting page text:', err);
      return '';
    }
  };

  const scrollToTop = () => {
    const iframe = document.querySelector('iframe');
    if (iframe?.contentDocument?.body) {
      iframe.contentDocument.body.scrollTop = 0;
      iframe.contentDocument.documentElement.scrollTop = 0;
    }
  };

  useEffect(() => {
    const iframe = document.querySelector('iframe');
    if (iframe?.contentDocument?.body) {
      iframe.contentDocument.body.addEventListener('click', handleTextClick);
    }

    return () => {
      if (iframe?.contentDocument?.body) {
        iframe.contentDocument.body.removeEventListener('click', handleTextClick);
      }
    };
  }, [handleTextClick]);

  // Handle play/pause keyboard shortcut
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.code === 'Space' && event.ctrlKey) {
        event.preventDefault();
        toggleSpeech();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [toggleSpeech]);

  useEffect(() => {
    if (!url) return;
    
    const loadEpub = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // First fetch the blob
        const response = await fetch(url);
        const blob = await response.blob();
        const buffer = await blob.arrayBuffer();
        setEpubData(buffer);
        
        // Extract text for search/processing
        const result = await extractEpubFromBlob(url);
        if (onTextExtracted && result.success) {
          onTextExtracted(result.text);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load EPUB');
      } finally {
        setIsLoading(false);
      }
    };

    loadEpub();

    return () => {
      stopSpeech();
    };
  }, [url, onTextExtracted, stopSpeech]);

  useEffect(() => {
    const addReaderStyles = () => {
      const iframe = document.querySelector('iframe');
      if (iframe?.contentDocument?.body) {
        const doc = iframe.contentDocument;
        const body = doc.body;

        // Add styles to the iframe body
        body.style.maxWidth = '65ch';
        body.style.margin = '0 auto';
        body.style.padding = '2rem';
        body.style.fontSize = '1.2rem';
        body.style.lineHeight = '1.6';
        body.style.overflowX = 'hidden';
        
        // Add styles to all paragraphs
        const paragraphs = doc.querySelectorAll('p');
        paragraphs.forEach(p => {
          p.style.marginBottom = '1rem';
          p.style.textAlign = 'justify';
        });
      }
    };

    // Initial style application
    addReaderStyles();

    // Also apply styles after content changes
    const observer = new MutationObserver(addReaderStyles);
    const iframe = document.querySelector('iframe');
    if (iframe?.contentDocument?.body) {
      observer.observe(iframe.contentDocument.body, {
        childList: true,
        subtree: true
      });
    }

    return () => observer.disconnect();
  }, []);

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices()
        .map(voice => ({
          name: `${voice.name} (${voice.lang})`,
          voice: voice
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setAvailableVoices(voices);

      // Try to select English voice by default
      const defaultVoice = voices.find(v => 
        v.voice.lang.startsWith('en-') || 
        v.voice.name.toLowerCase().includes('english')
      );
      
      if (defaultVoice) {
        setSelectedVoice(defaultVoice);
      } else if (voices.length > 0) {
        setSelectedVoice(voices[0]);
      }
    };

    // Chrome loads voices asynchronously
    if (typeof window !== 'undefined') {
      window.speechSynthesis.onvoiceschanged = loadVoices;
      loadVoices(); // Initial load
    }
  }, []);

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  if (isLoading || !epubData) {
    return <div>Loading...</div>;
  }

  return (
    <div className="relative" style={{ height: '100vh', width: '100%' }}>
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 flex gap-4 items-center bg-white/80 p-4 rounded-lg shadow-lg">
        <div className="flex items-center gap-4">
          <select
            className="px-2 py-1 rounded border border-gray-300 bg-white text-sm"
            value={selectedVoice?.name || ''}
            onChange={(e) => {
              const voice = availableVoices.find(v => v.name === e.target.value);
              if (voice) {
                setSelectedVoice(voice);
                if (isPlaying) {
                  // Restart speech with new voice
                  const currentPosition = currentCharIndexRef.current;
                  stopSpeech();
                  setTimeout(() => {
                    currentCharIndexRef.current = currentPosition;
                    startSpeech();
                  }, 100);
                }
              }
            }}
          >
            {availableVoices.map(voice => (
              <option key={voice.name} value={voice.name}>
                {voice.name}
              </option>
            ))}
          </select>
          
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Speed:</label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={speechRate}
              onChange={(e) => handleRateChange(parseFloat(e.target.value))}
              className="w-24"
            />
            <span className="text-sm text-gray-600">{speechRate}x</span>
          </div>

          <button
            onClick={toggleSpeech}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center gap-2"
          >
            {isPlaying ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6" y="4" width="4" height="16"></rect>
                  <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
                Pause
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                Play
              </>
            )}
          </button>
        </div>
      </div>
      
      <div className="max-w-3xl mx-auto px-16 relative" style={{ height: 'calc(100vh - 100px)' }}>
        <ReactReader
          url={epubData}
          location={location}
          locationChanged={locationChanged}
          getRendition={getRendition}
          loadingView={<div>Loading...</div>}
          epubOptions={{
            flow: "scrolled-doc",
            allowScriptedContent: true
          }}
        />
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3"></polygon>
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="4" width="4" height="16"></rect>
      <rect x="14" y="4" width="4" height="16"></rect>
    </svg>
  );
}
