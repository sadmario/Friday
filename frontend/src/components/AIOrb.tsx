import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { AssistantVoiceState } from '../types';
import { voiceManager } from '../services/voiceManager';

interface AIOrbProps {
  state: AssistantVoiceState;
  onClick?: () => void;
  size?: number;
}

export const AIOrb: React.FC<AIOrbProps> = ({ state = 'IDLE', onClick, size = 220 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Real-time circular audio waveform renderer
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const baseRadius = (size / 2) * 0.72;

      phase += 0.03;
      const isSpeaking = state === 'SPEAKING';
      const isListening = state === 'LISTENING_USER' || state === 'LISTENING_WAKE_WORD';
      const isProcessing = state === 'PROCESSING';

      // Read real audio frequency buffer if speaking or listening
      const freqData = isSpeaking ? voiceManager.getWaveformData() : null;
      const audioLevel = isSpeaking ? voiceManager.getAudioLevel() : 0;

      const numBars = 48;
      const angleStep = (Math.PI * 2) / numBars;

      for (let i = 0; i < numBars; i++) {
        const angle = i * angleStep;
        let barHeight = 4;

        if (isSpeaking && freqData && freqData.length > 0) {
          const dataIndex = Math.floor((i / numBars) * (freqData.length / 2));
          const val = freqData[dataIndex] || 0;
          barHeight = 4 + (val / 255) * 32 * (1 + audioLevel * 0.5);
        } else if (isListening) {
          barHeight = 3 + Math.sin(phase * 2 + i * 0.4) * 5;
        } else if (isProcessing) {
          barHeight = 3 + Math.cos(phase * 4 - i * 0.3) * 6;
        } else if (state === 'WAKE_WORD_DETECTED') {
          barHeight = 12 + Math.sin(phase * 8 + i) * 6;
        } else {
          // Idle breathing
          barHeight = 2 + Math.sin(phase + i * 0.2) * 2;
        }

        const x1 = centerX + Math.cos(angle) * baseRadius;
        const y1 = centerY + Math.sin(angle) * baseRadius;
        const x2 = centerX + Math.cos(angle) * (baseRadius + barHeight);
        const y2 = centerY + Math.sin(angle) * (baseRadius + barHeight);

        // Styling based on state
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);

        if (state === 'ERROR') {
          ctx.strokeStyle = `rgba(244, 63, 94, ${0.4 + (barHeight / 30) * 0.6})`;
        } else if (state === 'INTERRUPTED') {
          ctx.strokeStyle = `rgba(251, 146, 60, ${0.4 + (barHeight / 30) * 0.6})`;
        } else if (state === 'PROCESSING') {
          ctx.strokeStyle = `rgba(168, 85, 247, ${0.5 + (barHeight / 30) * 0.5})`;
        } else if (state === 'WAKE_WORD_DETECTED') {
          ctx.strokeStyle = `rgba(56, 189, 248, 0.95)`;
        } else if (isSpeaking) {
          ctx.strokeStyle = `rgba(0, 240, 255, ${0.6 + (barHeight / 35) * 0.4})`;
        } else {
          ctx.strokeStyle = `rgba(0, 220, 255, ${0.25 + (barHeight / 15) * 0.35})`;
        }

        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [state, size]);

  const getStateStyles = () => {
    switch (state) {
      case 'SPEAKING':
        return {
          glow: '#00f0ff',
          coreGradient: 'radial-gradient(circle at 35% 35%, #38bdf8 0%, #0284c7 45%, #050b18 90%)',
          label: 'SPEAKING',
          labelColor: 'text-cyan-300',
        };
      case 'LISTENING_USER':
        return {
          glow: '#00f0ff',
          coreGradient: 'radial-gradient(circle at 35% 35%, #00f0ff 0%, #0369a1 50%, #030812 90%)',
          label: 'LISTENING',
          labelColor: 'text-cyan-300',
        };
      case 'LISTENING_WAKE_WORD':
        return {
          glow: '#38bdf8',
          coreGradient: 'radial-gradient(circle at 35% 35%, #0284c7 0%, #075985 50%, #030812 90%)',
          label: 'AWAITING "FRIDAY"',
          labelColor: 'text-sky-300',
        };
      case 'WAKE_WORD_DETECTED':
        return {
          glow: '#22d3ee',
          coreGradient: 'radial-gradient(circle at 35% 35%, #67e8f9 0%, #0891b2 50%, #081525 90%)',
          label: 'WAKE WORD DETECTED',
          labelColor: 'text-cyan-200',
        };
      case 'PROCESSING':
        return {
          glow: '#a855f7',
          coreGradient: 'radial-gradient(circle at 35% 35%, #c084fc 0%, #7e22ce 50%, #090618 90%)',
          label: 'THINKING',
          labelColor: 'text-purple-300',
        };
      case 'INTERRUPTED':
        return {
          glow: '#fb923c',
          coreGradient: 'radial-gradient(circle at 35% 35%, #fdba74 0%, #c2410c 50%, #160a04 90%)',
          label: 'INTERRUPTED',
          labelColor: 'text-amber-300',
        };
      case 'ERROR':
        return {
          glow: '#f43f5e',
          coreGradient: 'radial-gradient(circle at 35% 35%, #fb7185 0%, #be123c 50%, #180509 90%)',
          label: 'SYSTEM ERROR',
          labelColor: 'text-rose-300',
        };
      case 'OFFLINE':
        return {
          glow: '#64748b',
          coreGradient: 'radial-gradient(circle at 35% 35%, #94a3b8 0%, #334155 50%, #07090e 90%)',
          label: 'OFFLINE',
          labelColor: 'text-slate-400',
        };
      default:
        return {
          glow: '#0284c7',
          coreGradient: 'radial-gradient(circle at 35% 35%, #38bdf8 0%, #0369a1 40%, #060b18 90%)',
          label: 'STANDBY',
          labelColor: 'text-cyan-400/80',
        };
    }
  };

  const style = getStateStyles();

  return (
    <div
      onClick={onClick}
      className="relative flex items-center justify-center cursor-pointer select-none group"
      style={{ width: size, height: size }}
      title="Click to interact / toggle listening"
    >
      {/* Outer ambient glow */}
      <motion.div
        animate={{
          scale:
            state === 'SPEAKING'
              ? [1, 1.25, 1.1, 1.3, 1]
              : state === 'PROCESSING'
              ? [1, 1.18, 1]
              : state === 'LISTENING_USER'
              ? [1, 1.2, 1]
              : [1, 1.06, 1],
          opacity: state === 'IDLE' ? [0.2, 0.4, 0.2] : [0.55, 0.9, 0.55],
        }}
        transition={{
          duration: state === 'SPEAKING' ? 1.4 : state === 'PROCESSING' ? 2 : 3.8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute inset-0 rounded-full blur-2xl pointer-events-none"
        style={{ backgroundColor: style.glow }}
      />

      {/* Circular Canvas Audio Waveform */}
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="absolute inset-0 pointer-events-none z-10"
      />

      {/* Rotating outer HUD reticle 1 */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{
          duration: state === 'PROCESSING' ? 8 : 28,
          repeat: Infinity,
          ease: 'linear',
        }}
        className="absolute rounded-full border border-cyan/25 border-dashed pointer-events-none"
        style={{ width: size * 0.88, height: size * 0.88 }}
      />

      {/* Counter-rotating dotted reticle 2 */}
      <motion.div
        animate={{ rotate: -360 }}
        transition={{
          duration: state === 'PROCESSING' ? 12 : 36,
          repeat: Infinity,
          ease: 'linear',
        }}
        className="absolute rounded-full border border-purple-500/20 border-dotted pointer-events-none"
        style={{ width: size * 0.82, height: size * 0.82 }}
      />

      {/* Core Holographic AI Sphere */}
      <motion.div
        animate={{
          scale:
            state === 'SPEAKING'
              ? [1, 1.07, 1]
              : state === 'LISTENING_USER'
              ? [1, 1.05, 1]
              : [1, 1.02, 1],
        }}
        transition={{
          duration: state === 'SPEAKING' ? 1.2 : 2.4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="relative z-20 rounded-full flex items-center justify-center shadow-2xl overflow-hidden border border-white/10"
        style={{
          width: size * 0.6,
          height: size * 0.6,
          background: style.coreGradient,
          boxShadow: `0 0 45px ${style.glow}66, inset 0 0 30px rgba(255,255,255,0.25)`,
        }}
      >
        {/* Core dynamic pulse wave */}
        <motion.div
          animate={{
            scale:
              state === 'SPEAKING'
                ? [0.85, 1.35, 0.85]
                : state === 'PROCESSING'
                ? [0.8, 1.2, 0.8]
                : [0.9, 1.1, 0.9],
            opacity: [0.35, 0.75, 0.35],
          }}
          transition={{
            duration: state === 'SPEAKING' ? 1.4 : 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="w-1/2 h-1/2 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(0,240,255,0.25) 75%)',
          }}
        />

        {/* Dynamic HUD state badge */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span
            className={`text-[9px] font-mono tracking-widest uppercase font-bold drop-shadow-md text-center px-1.5 py-0.5 rounded ${style.labelColor}`}
          >
            {style.label}
          </span>
        </div>
      </motion.div>
    </div>
  );
};
