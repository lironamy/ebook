'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ReactReader } from 'react-reader';
import { extractEpubFromBlob } from '../utils/epub';
import './epub-styles.css';

interface EpubViewerProps {
  url: string;
  onTextExtracted?: (text: string) => void;
}

interface Voice {
  name: string;
  voice: SpeechSynthesisVoice;
}

interface TextNode {
  node: Text;
  text: string;
  start: number;
  end: number;
}

export default function EpubViewer({ url, onTextExtracted }: EpubViewerProps) {
  const [location, setLocation] = useState<string | number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [epubData, setEpubData] = useState<ArrayBuffer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [pausedPosition, setPausedPosition] = useState<number>(0);
  const currentCharIndexRef = useRef<number>(0);
  const lastWordIndexRef = useRef<number>(0);
  const renditionRef = useRef<any>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const readerRef = useRef<any>(null);
  const textNodesRef = useRef<TextNode[]>([]);
  const highlightSpanRef = useRef<HTMLSpanElement | null>(null);
  const currentTextRef = useRef<string>('');
  const isManuallyPaused = useRef<boolean>(false);

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      const ziraVoice = availableVoices.find(voice => 
        voice.name === 'Microsoft Zira - English (United States)' && 
        voice.lang === 'en-US'
      );
      
      if (ziraVoice) {
        setSelectedVoice({
          name: ziraVoice.name,
          voice: ziraVoice
        });
      }
    };

    // Chrome loads voices asynchronously
    if (typeof window !== 'undefined') {
      window.speechSynthesis.onvoiceschanged = loadVoices;
      loadVoices(); // Initial load
    }
  }, []);

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

  const getRendition = (rendition: any) => {
    renditionRef.current = rendition;
    
    // Store the reader instance
    if (rendition.book) {
      readerRef.current = rendition.book;
    }
    
    // Set up content change listener
    rendition.on('rendered', (section: any) => {
      console.log('New section rendered:', section);
    });
  };

  const removeHighlight = () => {
    if (highlightSpanRef.current) {
      const parent = highlightSpanRef.current.parentNode;
      if (parent) {
        const text = highlightSpanRef.current.textContent || '';
        const textNode = document.createTextNode(text);
        parent.replaceChild(textNode, highlightSpanRef.current);
        highlightSpanRef.current = null;
      }
    }
  };

  const highlightWord = (word: string, charIndex: number) => {
    removeHighlight();

    try {
      const iframe = document.querySelector('iframe');
      if (!iframe?.contentDocument?.body) return;

      const selection = iframe.contentDocument.getSelection();
      if (!selection) return;

      const range = iframe.contentDocument.createRange();
      let foundNode: Text | null = null;
      let foundStart = 0;

      // Find the text node containing our word
      const walker = document.createTreeWalker(
        iframe.contentDocument.body,
        NodeFilter.SHOW_TEXT,
        null
      );

      let currentPos = 0;
      let node: Text | null;
      
      while ((node = walker.nextNode() as Text)) {
        const text = node.textContent || '';
        if (charIndex >= currentPos && charIndex < currentPos + text.length) {
          foundNode = node;
          foundStart = charIndex - currentPos;
          break;
        }
        currentPos += text.length;
      }

      if (foundNode) {
        try {
          range.setStart(foundNode, foundStart);
          range.setEnd(foundNode, foundStart + word.length);

          const span = iframe.contentDocument.createElement('span');
          span.style.backgroundColor = '#ffeb3b';
          
          
          range.surroundContents(span);
          highlightSpanRef.current = span;
        } catch (e) {
          console.error('Error setting range:', e);
        }
      }
    } catch (e) {
      console.error('Error highlighting word:', e);
    }
  };

  const getCurrentPageText = async (): Promise<string> => {
    if (!renditionRef.current) return '';
    
    try {
      // Get text from the current page's iframe
      const iframe = document.querySelector('iframe');
      if (!iframe?.contentDocument?.body) {
        return '';
      }

      // Get all text content
      const text = iframe.contentDocument.body.textContent || '';
      currentTextRef.current = text;
      return text;
    } catch (err) {
      console.error('Error getting page text:', err);
      return '';
    }
  };

  const stopSpeech = () => {
    if (speechRef.current) {
      // Store the current position when manually paused
      if (isManuallyPaused.current) {
        setPausedPosition(lastWordIndexRef.current);
      }
      
      speechRef.current.onend = null;
      speechRef.current.onboundary = null;
      speechRef.current.onerror = null;
    }
    window.speechSynthesis.cancel();
    removeHighlight();
    setIsPlaying(false);
  };

  const handleTextClick = (event: MouseEvent) => {
    const iframe = document.querySelector('iframe');
    if (!iframe?.contentDocument?.body) return;

    const selection = iframe.contentDocument.getSelection();
    if (!selection) return;

    const range = iframe.contentDocument.caretRangeFromPoint(event.clientX, event.clientY);
    if (!range) return;

    // Get the text node and its position
    const textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) return;

    // Calculate the position in the full text
    let position = 0;
    const walker = document.createTreeWalker(
      iframe.contentDocument.body,
      NodeFilter.SHOW_TEXT,
      null
    );

    let node: Text | null;
    while ((node = walker.nextNode() as Text)) {
      if (node === textNode) {
        position += range.startOffset;
        break;
      }
      position += node.length;
    }

    // Start reading from this position
    setPausedPosition(position);
    if (!isPlaying) {
      startSpeech();
    } else {
      // If already playing, restart from new position
      stopSpeech();
      startSpeech();
    }
  };

  const startSpeech = async () => {
    const text = await getCurrentPageText();
    if (!text) return;

    // Stop any existing speech
    stopSpeech();

    // Reset the manual pause flag
    isManuallyPaused.current = false;

    // Create new utterance
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set the selected voice
    if (selectedVoice) {
      utterance.voice = selectedVoice.voice;
    }
    
    utterance.rate = speechRate;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // If we have a paused position, start from there
    if (pausedPosition > 0) {
      utterance.text = text.substring(pausedPosition);
      currentCharIndexRef.current = pausedPosition;
      lastWordIndexRef.current = pausedPosition;
      setPausedPosition(0); // Reset the paused position
    }

    // Handle word boundaries for highlighting
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        const charIndex = event.charIndex + currentCharIndexRef.current;
        const wordLength = event.charLength || 0;
        const word = text.substr(charIndex, wordLength);
        
        if (word.trim()) {
          highlightWord(word, charIndex);
          lastWordIndexRef.current = charIndex;
        }
      }
    };

    // Handle speech end
    utterance.onend = () => {
      removeHighlight();
      // Only proceed if we're still in playing state and not manually paused
      if (isPlaying && !isManuallyPaused.current && renditionRef.current) {
        // Try to move to next page
        renditionRef.current.next().then((result: boolean) => {
          if (!result) {
            // If no next page, stop playing
            setIsPlaying(false);
          }
        });
      }
    };

    // Handle errors
    utterance.onerror = (event) => {
      // Only log and handle non-interrupted errors
      if (event.error !== 'interrupted' || !isManuallyPaused.current) {
        console.error('Speech error:', event);
        removeHighlight();
        setIsPlaying(false);
      }
    };

    speechRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
  };

  const toggleSpeech = () => {
    if (isPlaying) {
      isManuallyPaused.current = true;
      stopSpeech();
    } else {
      startSpeech();
    }
  };

  // Handle speech rate change
  const handleRateChange = (newRate: number) => {
    setSpeechRate(newRate);
    if (isPlaying) {
      // Restart speech with new rate
      startSpeech();
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

    // Cleanup speech synthesis when component unmounts
    return () => {
      stopSpeech();
    };
  }, [url, onTextExtracted]);

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
  }, [isPlaying]);

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
  }, [isPlaying]);

  useEffect(() => {
    const addReaderStyles = () => {
      const iframe = document.querySelector('iframe');
      if (iframe?.contentDocument?.body) {
        // Add styles to the iframe body
        iframe.contentDocument.body.style.maxWidth = '65ch';
        iframe.contentDocument.body.style.margin = '0 auto';
        iframe.contentDocument.body.style.padding = '2rem';
        iframe.contentDocument.body.style.fontSize = '1.2rem';
        iframe.contentDocument.body.style.lineHeight = '1.6';
        iframe.contentDocument.body.style.overflowX = 'hidden';
        
        // Add styles to all paragraphs
        const paragraphs = iframe.contentDocument.querySelectorAll('p');
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

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  if (isLoading || !epubData) {
    return <div>Loading...</div>;
  }

  return (
    <div className="relative" style={{ height: '100vh', width: '100%' }}>
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 flex gap-4 items-center bg-white/80 p-4 rounded-lg shadow-lg">
        <button
          onClick={() => {
            renditionRef.current?.prev().then(() => {
              setTimeout(scrollToTop, 100);
            });
          }}
          className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
          title="Previous Chapter"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <button
          onClick={() => {
            renditionRef.current?.next().then(() => {
              setTimeout(scrollToTop, 100);
            });
          }}
          className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
          title="Next Chapter"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
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
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex items-center gap-2"
          title="Press Ctrl+Space to play/pause"
        >
          {isPlaying ? (
            <>
              <PauseIcon /> Pause
            </>
          ) : (
            <>
              <PlayIcon /> Play
            </>
          )}
        </button>
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
