import { useCallback, useEffect, useRef, useState } from 'react';

const ERROR_MESSAGES = {
  'not-allowed': 'Microphone access is blocked. Allow it in your browser, then try again.',
  'service-not-allowed': 'Microphone access is blocked. Allow it in your browser, then try again.',
  'audio-capture': 'No microphone was found.',
  network: 'Speech recognition needs an internet connection.',
};

const joinText = (...parts) => parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

// Turns speech into text with the browser's speech recognition, adding to what is already written.
export function useDictation(onText) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recognition = useRef(null);
  const wantsToListen = useRef(false);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;

  const stop = useCallback(() => {
    wantsToListen.current = false;
    recognition.current?.stop();
    setListening(false);
  }, []);

  useEffect(
    () => () => {
      wantsToListen.current = false;
      recognition.current?.abort();
    },
    [],
  );

  function start(existingText) {
    setError('');
    let spoken = existingText.trim();

    const instance = new Recognition();
    instance.continuous = true;
    instance.interimResults = true;
    instance.lang = navigator.language || 'en-US';

    instance.onresult = (event) => {
      let interim = '';
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        if (result.isFinal) spoken = joinText(spoken, result[0].transcript);
        else interim = joinText(interim, result[0].transcript);
      }
      onTextRef.current(joinText(spoken, interim));
    };

    instance.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      wantsToListen.current = false;
      setError(ERROR_MESSAGES[event.error] ?? 'Voice input stopped. Please try again.');
    };

    // Browsers end recognition after a pause, so it restarts until the user stops it.
    instance.onend = () => {
      if (wantsToListen.current) instance.start();
      else setListening(false);
    };

    recognition.current = instance;
    wantsToListen.current = true;
    instance.start();
    setListening(true);
  }

  return { supported: Boolean(Recognition), listening, error, start, stop };
}
