import React, { useState, useRef } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Volume2, Loader2, Play, Trash2 } from 'lucide-react';
import { base64ToUint8Array, decodeAudioData } from '../utils/audioUtils';

interface TTSProps {
  onBack: () => void;
}

const TextToSpeech: React.FC<TTSProps> = ({ onBack }) => {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [voice, setVoice] = useState('Puck');
  const audioContextRef = useRef<AudioContext | null>(null);

  const voices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];

  const generateSpeech = async () => {
    if (!text.trim()) return;
    
    setIsLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        await playAudio(base64Audio);
      }

    } catch (error) {
      console.error("TTS Error:", error);
      alert("Failed to generate speech.");
    } finally {
      setIsLoading(false);
    }
  };

  const playAudio = async (base64String: string) => {
    try {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
        }
        
        setIsPlaying(true);
        const ctx = audioContextRef.current;
        const outputNode = ctx.createGain();
        
        const audioBuffer = await decodeAudioData(
            base64ToUint8Array(base64String),
            ctx,
            24000,
            1
        );

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(outputNode);
        outputNode.connect(ctx.destination);
        
        source.onended = () => setIsPlaying(false);
        source.start();

    } catch (e) {
        console.error("Audio playback error", e);
        setIsPlaying(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-4 bg-white shadow-sm flex items-center justify-between">
        <button onClick={onBack} className="text-slate-600 hover:text-indigo-600 font-medium">
          &larr; Back
        </button>
        <h2 className="text-lg font-bold text-slate-800">Neural Speech Gen</h2>
        <div className="w-16"></div>
      </div>

      <div className="flex-1 p-6 max-w-3xl mx-auto w-full flex flex-col space-y-6">
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <label className="block text-sm font-medium text-slate-700 mb-2">Select Voice Personality</label>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {voices.map(v => (
                    <button
                        key={v}
                        onClick={() => setVoice(v)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                            voice === v 
                            ? 'bg-indigo-600 text-white shadow-md' 
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        {v}
                    </button>
                ))}
            </div>
        </div>

        <div className="flex-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
            <textarea
                className="flex-1 w-full resize-none outline-none text-lg text-slate-700 placeholder-slate-300"
                placeholder="Type something here to convert to realistic speech..."
                value={text}
                onChange={(e) => setText(e.target.value)}
            />
            
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-100">
                <button 
                    onClick={() => setText('')}
                    className="text-slate-400 hover:text-red-500 transition-colors p-2"
                >
                    <Trash2 size={20} />
                </button>
                
                <button
                    disabled={isLoading || !text}
                    onClick={generateSpeech}
                    className={`
                        flex items-center space-x-2 px-6 py-3 rounded-full font-bold text-white shadow-lg transition-all
                        ${isLoading || !text 
                            ? 'bg-slate-300 cursor-not-allowed' 
                            : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 transform hover:-translate-y-1'
                        }
                    `}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="animate-spin w-5 h-5" />
                            <span>Generating...</span>
                        </>
                    ) : (
                        <>
                            <Volume2 className="w-5 h-5" />
                            <span>Speak It</span>
                        </>
                    )}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default TextToSpeech;