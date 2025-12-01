import React, { useEffect, useRef } from 'react';
import { AudioVisualizerProps } from '../types';

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ stream, isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode>();
  const audioContextRef = useRef<AudioContext>();

  useEffect(() => {
    if (!stream || !isActive || !canvasRef.current) return;

    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = audioContextRef.current.createMediaStreamSource(stream);
    analyserRef.current = audioContextRef.current.createAnalyser();
    
    analyserRef.current.fftSize = 256;
    source.connect(analyserRef.current);

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    const draw = () => {
      if (!isActive) return;
      animationRef.current = requestAnimationFrame(draw);

      analyserRef.current!.getByteFrequencyData(dataArray);

      ctx.fillStyle = 'rgba(255, 255, 255, 0)'; // Transparent clear
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      // Center the visualizer
      const centerY = canvas.height / 2;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2;
        
        // Gradient color based on height
        const r = barHeight + 25 * (i/bufferLength);
        const g = 250 * (i/bufferLength);
        const b = 50;

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        
        // Draw mirrored bars for wave effect
        ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, [stream, isActive]);

  if (!isActive) {
    return (
      <div className="h-32 w-full flex items-center justify-center">
         <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
             <div className="h-full bg-gray-300 w-full opacity-20"></div>
         </div>
      </div>
    );
  }

  return (
    <canvas 
      ref={canvasRef} 
      width={300} 
      height={128} 
      className="w-full h-32 rounded-xl"
    />
  );
};

export default AudioVisualizer;