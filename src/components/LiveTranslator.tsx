import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { SupportedLanguage } from '../types';
import { Phone, PhoneOff, Bluetooth } from 'lucide-react';
import AudioVisualizer from './AudioVisualizer';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from '../utils/audioUtils';

interface LiveTranslatorProps {
  onBack: () => void;
}

interface TranscriptItem {
    id: string;
    text: string;
    sender: 'user' | 'ai';
    isFinal: boolean;
}

const LiveTranslator: React.FC<LiveTranslatorProps> = ({ onBack }) => {
  // State
  const [isActive, setIsActive] = useState(false);
  const [sourceLang, setSourceLang] = useState<SupportedLanguage>(SupportedLanguage.ENGLISH);
  const [targetLang, setTargetLang] = useState<SupportedLanguage>(SupportedLanguage.SPANISH);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [headphonesMode, setHeadphonesMode] = useState(false);
  
  // Transcription State
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const transcriptListRef = useRef<HTMLDivElement>(null);

  // Refs for audio processing
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

  // Refs for accumulating partial transcripts
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');
  
  // Auto-scroll to bottom of transcript
  useEffect(() => {
    if (transcriptListRef.current) {
        transcriptListRef.current.scrollTop = transcriptListRef.current.scrollHeight;
    }
  }, [transcripts]);
  
  // Clean up function
  const stopSession = useCallback(() => {
    setIsActive(false);
    
    // Stop Microphone Stream
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    // Stop Audio Input Processing
    if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current = null;
    }
    if (inputAudioContextRef.current) {
        inputAudioContextRef.current.close();
        inputAudioContextRef.current = null;
    }

    // Stop Audio Output
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    sourcesRef.current.forEach(source => {
        try { source.stop(); } catch(e) {}
    });
    sourcesRef.current.clear();
    
    // Attempt to close session if possible
    sessionPromiseRef.current = null;

  }, [stream]);

  const startSession = async () => {
    setError(null);
    setTranscripts([]);
    currentInputTranscription.current = '';
    currentOutputTranscription.current = '';
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Initialize Audio Contexts
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      nextStartTimeRef.current = audioContextRef.current.currentTime;

      // Get Microphone Stream
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(mediaStream);

      // Connect to Gemini Live
      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            console.log('Gemini Live Connected');
            setIsActive(true);
            
            // Setup Audio Input Streaming
            if (!inputAudioContextRef.current) return;
            
            const source = inputAudioContextRef.current.createMediaStreamSource(mediaStream);
            const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = processor;

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              
              if (sessionPromiseRef.current) {
                sessionPromiseRef.current.then(session => {
                   session.sendRealtimeInput({ media: pcmBlob });
                }).catch(err => {
                    console.error("Session send error", err);
                });
              }
            };

            source.connect(processor);
            processor.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // 1. Handle Transcriptions
            // User Input
            if (message.serverContent?.inputTranscription) {
                const text = message.serverContent.inputTranscription.text;
                if (text) {
                    currentInputTranscription.current += text;
                    setTranscripts(prev => {
                        // Update the last "user" message if it's pending, or add new
                        const last = prev[prev.length - 1];
                        if (last && last.sender === 'user' && !last.isFinal) {
                            return [...prev.slice(0, -1), { ...last, text: currentInputTranscription.current }];
                        } else {
                            return [...prev, { id: Date.now().toString(), text: text, sender: 'user', isFinal: false }];
                        }
                    });
                }
            }
            
            // Model Output (Translation)
            if (message.serverContent?.outputTranscription) {
                const text = message.serverContent.outputTranscription.text;
                if (text) {
                    currentOutputTranscription.current += text;
                    setTranscripts(prev => {
                        const last = prev[prev.length - 1];
                        if (last && last.sender === 'ai' && !last.isFinal) {
                            return [...prev.slice(0, -1), { ...last, text: currentOutputTranscription.current }];
                        } else {
                            return [...prev, { id: Date.now().toString(), text: text, sender: 'ai', isFinal: false }];
                        }
                    });
                }
            }

            // Turn Complete - Finalize transcripts
            if (message.serverContent?.turnComplete) {
                currentInputTranscription.current = '';
                currentOutputTranscription.current = '';
                setTranscripts(prev => prev.map(t => ({ ...t, isFinal: true })));
            }

            // 2. Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && audioContextRef.current) {
              try {
                // Keep track of playback time
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioContextRef.current.currentTime);
                
                const audioBuffer = await decodeAudioData(
                  base64ToUint8Array(base64Audio),
                  audioContextRef.current,
                  24000,
                  1
                );

                const source = audioContextRef.current.createBufferSource();
                source.buffer = audioBuffer;
                
                const gainNode = audioContextRef.current.createGain();
                gainNode.gain.value = 1.0; 
                
                source.connect(gainNode);
                gainNode.connect(audioContextRef.current.destination);
                
                source.addEventListener('ended', () => {
                    sourcesRef.current.delete(source);
                });

                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                sourcesRef.current.add(source);

              } catch (err) {
                console.error("Error decoding audio", err);
              }
            }
            
            // 3. Handle Interruptions
            if (message.serverContent?.interrupted) {
                sourcesRef.current.forEach(s => s.stop());
                sourcesRef.current.clear();
                currentOutputTranscription.current = ''; 
                if (audioContextRef.current) {
                   nextStartTimeRef.current = audioContextRef.current.currentTime;
                }
            }
          },
          onclose: () => {
            console.log('Gemini Live Closed');
            setIsActive(false);
          },
          onerror: (err) => {
            console.error('Gemini Live Error', err);
            setError("Connection error. Please try again.");
            stopSession();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          // Enable transcription for both user input and model output
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: `You are a professional simultaneous interpreter. 
          Your task is to translate a conversation between ${sourceLang} and ${targetLang} in real-time.
          
          Rules:
          1. If you hear ${sourceLang}, translate it to ${targetLang} immediately.
          2. If you hear ${targetLang}, translate it to ${sourceLang} immediately.
          3. Do not assume the role of a conversational partner. Do not answer questions. ONLY TRANSLATE what you hear.
          4. Maintain the tone and emotion of the speaker.
          5. Keep the translation concise and natural.`,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } }
          }
        }
      });

    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to start session");
      setIsActive(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => stopSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-white shadow-sm flex items-center justify-between z-10 shrink-0">
        <button onClick={onBack} className="text-slate-600 hover:text-indigo-600 font-medium">
          &larr; Back
        </button>
        <h2 className="text-lg font-bold text-slate-800">Live Call Translator</h2>
        <div className="w-16"></div> {/* Spacer */}
      </div>

      {/* Language Selector */}
      <div className="bg-white px-6 py-4 border-b border-slate-100 flex justify-between items-center space-x-4 shrink-0">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Speaker A</label>
          <select 
            disabled={isActive}
            value={sourceLang}
            onChange={(e) => setSourceLang(e.target.value as SupportedLanguage)}
            className="w-full p-2 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {Object.values(SupportedLanguage).map(lang => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
        </div>
        
        <div className="text-slate-400 mt-5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"/></svg>
        </div>

        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Speaker B</label>
           <select 
            disabled={isActive}
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value as SupportedLanguage)}
            className="w-full p-2 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {Object.values(SupportedLanguage).map(lang => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content Area - Split between Visualizer and Transcript */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* Connection Status / Visualizer */}
        <div className="shrink-0 p-4 flex flex-col items-center justify-center">
             <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden p-4">
                 <div className="absolute top-2 right-2">
                    <button 
                        onClick={() => setHeadphonesMode(!headphonesMode)}
                        className={`p-1.5 rounded-full transition-colors ${headphonesMode ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}
                        title="Headphones Mode (Simulated Routing)"
                    >
                        <Bluetooth size={16} />
                    </button>
                 </div>
                 
                 <div className="flex flex-col items-center space-y-2">
                    <div className="flex items-center space-x-2">
                         <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-red-300'}`}></div>
                         <h3 className="text-sm font-semibold text-slate-700">
                             {isActive ? 'Live' : 'Offline'}
                         </h3>
                    </div>
                 </div>

                 <div className="mt-4">
                    <AudioVisualizer stream={stream} isActive={isActive} />
                 </div>
            </div>
            {error && (
                <div className="mt-2 bg-red-50 text-red-600 px-4 py-2 rounded-lg border border-red-100 text-sm">
                    {error}
                </div>
            )}
        </div>

        {/* Live Transcript Area */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3" ref={transcriptListRef}>
            {transcripts.length === 0 && isActive && (
                <div className="text-center text-slate-400 mt-10 text-sm">
                    Listening for conversation...
                </div>
            )}
            
            {transcripts.map((item, index) => (
                <div key={item.id + index} className={`flex ${item.sender === 'ai' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`
                        max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm
                        ${item.sender === 'ai' 
                            ? 'bg-indigo-600 text-white rounded-tr-none' 
                            : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'}
                        ${!item.isFinal ? 'opacity-70' : ''}
                    `}>
                        <div className="font-xs opacity-75 mb-1 text-[10px] uppercase tracking-wider">
                            {item.sender === 'ai' ? 'Interpreter' : 'Speaker'}
                        </div>
                        {item.text}
                    </div>
                </div>
            ))}
        </div>

      </div>

      {/* Controls */}
      <div className="p-6 bg-white border-t border-slate-100 flex justify-center items-center shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <button
            onClick={isActive ? stopSession : startSession}
            className={`
                relative w-16 h-16 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95
                ${isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700'}
            `}
          >
            {isActive ? (
                <PhoneOff className="text-white w-8 h-8" />
            ) : (
                <Phone className="text-white w-8 h-8" />
            )}
            
            {/* Ripple effect when active */}
            {isActive && (
                <span className="absolute w-full h-full rounded-full bg-red-400 opacity-20 animate-ping"></span>
            )}
          </button>
      </div>
    </div>
  );
};

export default LiveTranslator;