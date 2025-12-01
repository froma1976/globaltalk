import React, { useState, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Mic, Square, Loader2, ArrowRight } from 'lucide-react';
import { arrayBufferToBase64 } from '../utils/audioUtils';
import { SupportedLanguage } from '../types';

interface TranscriberProps {
  onBack: () => void;
}

const Transcriber: React.FC<TranscriberProps> = ({ onBack }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [targetLang, setTargetLang] = useState<SupportedLanguage>(SupportedLanguage.ENGLISH);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setTranscription('');
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await transcribeAndTranslateAudio(blob);
        
        // Stop all tracks
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAndTranslateAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = arrayBufferToBase64(arrayBuffer);

      const prompt = `
        1. Transcribe the audio exactly as spoken.
        2. Translate the transcription into ${targetLang}.
        
        Output format:
        [Transcription]
        
        --- TRANSLATION (${targetLang}) ---
        [Translation]
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'audio/webm',
                data: base64Audio
              }
            },
            {
              text: prompt
            }
          ]
        }
      });

      setTranscription(response.text || "No transcription generated.");
    } catch (error) {
      console.error("Transcription error:", error);
      setTranscription("Error generating transcription. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-4 bg-white shadow-sm flex items-center justify-between">
        <button onClick={onBack} className="text-slate-600 hover:text-indigo-600 font-medium">
          &larr; Back
        </button>
        <h2 className="text-lg font-bold text-slate-800">Smart Transcriber</h2>
        <div className="w-16"></div>
      </div>

      <div className="flex-1 p-6 flex flex-col items-center max-w-2xl mx-auto w-full">
        
        {/* Language Selection */}
        <div className="w-full bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Translate to:</span>
            <div className="relative">
                <select 
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.target.value as SupportedLanguage)}
                    className="appearance-none bg-indigo-50 border border-indigo-100 text-indigo-700 font-semibold py-2 pl-4 pr-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    {Object.values(SupportedLanguage).map(lang => (
                        <option key={lang} value={lang}>{lang}</option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-indigo-600">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
            </div>
        </div>

        {/* Output Area */}
        <div className="w-full flex-1 bg-white rounded-2xl shadow-md mb-8 p-6 overflow-y-auto relative min-h-[300px]">
           {isProcessing ? (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-10 rounded-2xl">
               <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
               <p className="text-slate-600 font-medium">Listening, Transcribing & Translating...</p>
             </div>
           ) : null}
           
           {transcription ? (
             <div className="prose prose-slate max-w-none">
               <div className="whitespace-pre-wrap text-slate-700 leading-relaxed text-lg font-light">
                 {transcription.split('--- TRANSLATION').map((part, i) => (
                    <div key={i} className={i === 1 ? "mt-6 pt-6 border-t-2 border-indigo-50 bg-indigo-50/50 p-4 rounded-xl" : ""}>
                        {i === 1 && <h3 className="text-xs font-bold text-indigo-500 uppercase tracking-wide mb-2">Translation</h3>}
                        {part.replace(/[()]/g, '')}
                    </div>
                 ))}
               </div>
             </div>
           ) : (
             <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center space-y-4">
               <div className="p-4 bg-slate-50 rounded-full">
                  <Mic className="w-8 h-8 text-slate-300" />
               </div>
               <p>Tap the microphone to start recording.<br/>Audio will be transcribed and translated to {targetLang}.</p>
             </div>
           )}
        </div>

        {/* Recording Controls */}
        <div className="flex flex-col items-center space-y-4">
            <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`
                    flex items-center justify-center w-20 h-20 rounded-full shadow-xl transition-all transform hover:scale-105
                    ${isRecording ? 'bg-red-500 hover:bg-red-600 ring-4 ring-red-100' : 'bg-indigo-600 hover:bg-indigo-700 ring-4 ring-indigo-100'}
                `}
            >
                {isRecording ? (
                    <Square className="w-8 h-8 text-white fill-current rounded-sm" />
                ) : (
                    <Mic className="w-10 h-10 text-white" />
                )}
            </button>
            
            <p className="text-sm text-slate-500 font-medium animate-pulse">
                {isRecording ? 'Recording in progress...' : 'Ready to record'}
            </p>
        </div>

      </div>
    </div>
  );
};

export default Transcriber;