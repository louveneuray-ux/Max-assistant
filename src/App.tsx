import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import { Mic, MicOff, Volume2, VolumeX, Sparkles, Loader2 } from "lucide-react";
import { AudioStreamPlayer, float32ToInt16, arrayBufferToBase64 } from "./lib/audio-utils";

const API_KEY = process.env.GEMINI_API_KEY || "";
const MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";

export default function App() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<any>(null);
  const audioPlayerRef = useRef<AudioStreamPlayer | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  // Initialize audio player
  useEffect(() => {
    audioPlayerRef.current = new AudioStreamPlayer(24000);
    return () => {
      audioPlayerRef.current?.stop();
    };
  }, []);

  const stopAudioCapture = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const startAudioCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(2048, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!isMuted && sessionRef.current) {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcmData = float32ToInt16(inputData);
          const base64Data = arrayBufferToBase64(pcmData.buffer);
          
          sessionRef.current.sendRealtimeInput({
            audio: {
              data: base64Data,
              mimeType: 'audio/pcm;rate=16000'
            }
          });
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
    } catch (err) {
      console.error("Error capturing audio:", err);
      setError("Could not access microphone. Please check permissions.");
    }
  }, [isMuted]);

  const connectToMax = async () => {
    if (isConnected) {
      sessionRef.current?.close();
      setIsConnected(false);
      stopAudioCapture();
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: API_KEY });
      
      const sessionPromise = ai.live.connect({
        model: MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: "You are Max, a futuristic voice assistant for Louve. You speak both English and French with a charming English accent. You are helpful, witty, and sophisticated. Your initial greeting should always be: 'Hello, I'm Max. What would you like to know about life.' You should respond in the language the user speaks to you, but maintain your English accent in both. If the user asks about life, give deep but concise philosophical answers.",
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setIsConnecting(false);
            startAudioCapture();
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              audioPlayerRef.current?.playChunk(base64Audio);
            }
          },
          onclose: () => {
            setIsConnected(false);
            setIsConnecting(false);
            stopAudioCapture();
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            setError("Connection error. Please try again.");
            setIsConnecting(false);
            setIsConnected(false);
            stopAudioCapture();
          }
        }
      });

      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error("Failed to connect:", err);
      setError("Failed to initialize session.");
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-cyan-500/30 overflow-hidden flex flex-col items-center justify-center p-4">
      {/* Background Atmosphere */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full animate-pulse delay-1000" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
      </div>

      <main className="relative z-10 w-full max-w-2xl flex flex-col items-center gap-12">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-2"
        >
          <h1 className="text-5xl font-light tracking-tighter sm:text-7xl bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">
            MAX
          </h1>
          <p className="text-cyan-400/60 font-mono text-xs uppercase tracking-[0.3em]">
            Voice Assistant for Louve
          </p>
        </motion.div>

        {/* Visualizer / Orb */}
        <div className="relative group">
          <AnimatePresence mode="wait">
            {!isConnected ? (
              <motion.button
                key="connect-btn"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={connectToMax}
                disabled={isConnecting}
                className="relative w-48 h-48 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                {isConnecting ? (
                  <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
                ) : (
                  <Sparkles className="w-12 h-12 text-white group-hover:text-cyan-400 transition-colors" />
                )}
              </motion.button>
            ) : (
              <motion.div
                key="orb"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="relative w-64 h-64 flex items-center justify-center"
              >
                {/* Glowing Rings */}
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.1, 0.3] }}
                  transition={{ duration: 4, repeat: Infinity }}
                  className="absolute inset-0 rounded-full border border-cyan-500/30"
                />
                <motion.div 
                  animate={{ scale: [1.2, 1, 1.2], opacity: [0.1, 0.3, 0.1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="absolute inset-[-20px] rounded-full border border-white/5"
                />

                {/* Core Orb */}
                <div className="w-40 h-40 rounded-full bg-gradient-to-br from-white to-cyan-500/50 shadow-[0_0_80px_rgba(6,182,212,0.4)] flex items-center justify-center overflow-hidden">
                  <motion.div 
                    animate={{ 
                      borderRadius: ["40% 60% 70% 30% / 40% 50% 60% 50%", "60% 40% 30% 70% / 50% 60% 40% 60%", "40% 60% 70% 30% / 40% 50% 60% 50%"],
                      rotate: [0, 180, 360]
                    }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="w-full h-full bg-cyan-400/20 backdrop-blur-xl"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Controls */}
        <AnimatePresence>
          {isConnected && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex items-center gap-6"
            >
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`p-4 rounded-full border transition-all ${
                  isMuted 
                    ? "bg-red-500/10 border-red-500/50 text-red-400" 
                    : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                }`}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>

              <button
                onClick={connectToMax}
                className="px-8 py-4 rounded-full bg-white text-black font-medium hover:bg-cyan-400 transition-colors"
              >
                End Session
              </button>

              <button
                className="p-4 rounded-full bg-white/5 border border-white/10 text-white hover:bg-white/10"
              >
                <Volume2 className="w-6 h-6" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Message */}
        {error && (
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-red-400 font-mono text-sm"
          >
            {error}
          </motion.p>
        )}

        {/* Status Text */}
        <div className="h-8 flex items-center justify-center">
          {!isConnected && !isConnecting && (
            <p className="text-white/40 text-sm font-light">Tap to wake Max</p>
          )}
          {isConnecting && (
            <p className="text-cyan-400/60 text-sm font-mono animate-pulse">Initializing Neural Link...</p>
          )}
          {isConnected && (
            <p className="text-cyan-400 text-sm font-mono">Max is listening...</p>
          )}
        </div>
      </main>

      {/* Footer Meta */}
      <footer className="absolute bottom-8 left-8 right-8 flex justify-between items-end pointer-events-none">
        <div className="space-y-1">
          <p className="text-[10px] font-mono text-white/20 uppercase tracking-widest">System Status</p>
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,1)]' : 'bg-white/20'}`} />
            <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
              {isConnected ? 'Online' : 'Standby'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-mono text-white/20 uppercase tracking-widest">Protocol</p>
          <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Gemini 2.5 Live</p>
        </div>
      </footer>
    </div>
  );
}

