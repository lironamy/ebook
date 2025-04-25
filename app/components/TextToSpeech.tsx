import { useEffect, useState } from 'react';

interface TextToSpeechProps {
  text: string;
  isPlaying: boolean;
  onHighlight: (position: number) => void;
}

export default function TextToSpeech({ text, isPlaying, onHighlight }: TextToSpeechProps) {
  const [utterance, setUtterance] = useState<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    const synth = window.speechSynthesis;
    const newUtterance = new SpeechSynthesisUtterance(text);
    
    const handleBoundary = (event: SpeechSynthesisEvent) => {
      onHighlight(event.charIndex);
    };

    newUtterance.onboundary = handleBoundary;
    setUtterance(newUtterance);

    return () => {
      synth.cancel();
      newUtterance.onboundary = null;
    };
  }, [text, onHighlight]);

  useEffect(() => {
    const synth = window.speechSynthesis;
    
    if (utterance) {
      if (isPlaying) {
        synth.speak(utterance);
      } else {
        synth.pause();
      }
    }

    return () => {
      synth.cancel();
    };
  }, [isPlaying, utterance]);

  return null;
}
