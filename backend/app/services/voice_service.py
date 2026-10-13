import asyncio
import io
import os
import re
import tempfile
import threading
from typing import Optional, List, Dict, Tuple
import pyttsx3

try:
    import edge_tts
    HAS_EDGE_TTS = True
except ImportError:
    HAS_EDGE_TTS = False

# Curated Candidate Voices for F.R.I.D.A.Y.
CANDIDATE_VOICES: List[Dict[str, any]] = [
    {
        "id": "en-US-AvaNeural",
        "name": "Ava (Neural, US)",
        "personality": "Sweet, soft, calm, gentle, composed feminine English voice (Mikasa Ackerman English dub aesthetic)",
        "locale": "en-US",
        "gender": "Female",
        "default_rate": "-4%",
        "default_pitch": "-2Hz",
        "recommended": True,
        "engine": "edge_neural",
        "is_offline": False
    },
    {
        "id": "en-US-EmmaNeural",
        "name": "Emma (Neural, US)",
        "personality": "Gentle, composed, soft, serene feminine delivery",
        "locale": "en-US",
        "gender": "Female",
        "default_rate": "-3%",
        "default_pitch": "-2Hz",
        "recommended": False,
        "engine": "edge_neural",
        "is_offline": False
    },
    {
        "id": "en-US-JennyNeural",
        "name": "Jenny (Neural, US)",
        "personality": "Warm, natural, clear, balanced feminine delivery",
        "locale": "en-US",
        "gender": "Female",
        "default_rate": "-2%",
        "default_pitch": "-1Hz",
        "recommended": False,
        "engine": "edge_neural",
        "is_offline": False
    },
    {
        "id": "en-US-AnaNeural",
        "name": "Ana (Neural, US)",
        "personality": "Delicate, soft, youthful, quiet tone",
        "locale": "en-US",
        "gender": "Female",
        "default_rate": "-4%",
        "default_pitch": "-1Hz",
        "recommended": False,
        "engine": "edge_neural",
        "is_offline": False
    },
    {
        "id": "en-GB-SoniaNeural",
        "name": "Sonia (Neural, UK)",
        "personality": "Composed, calm, gentle British English feminine delivery",
        "locale": "en-GB",
        "gender": "Female",
        "default_rate": "-3%",
        "default_pitch": "-2Hz",
        "recommended": False,
        "engine": "edge_neural",
        "is_offline": False
    },
    {
        "id": "en-GB-LibbyNeural",
        "name": "Libby (Neural, UK)",
        "personality": "Warm, pleasant, soft British English feminine voice",
        "locale": "en-GB",
        "gender": "Female",
        "default_rate": "-3%",
        "default_pitch": "-1Hz",
        "recommended": False,
        "engine": "edge_neural",
        "is_offline": False
    },
    {
        "id": "en-AU-NatashaNeural",
        "name": "Natasha (Neural, AU)",
        "personality": "Composed, clear, natural Australian English feminine voice",
        "locale": "en-AU",
        "gender": "Female",
        "default_rate": "-3%",
        "default_pitch": "-2Hz",
        "recommended": False,
        "engine": "edge_neural",
        "is_offline": False
    },
    {
        "id": "local-sapi5",
        "name": "Windows Desktop SAPI5 (Offline)",
        "personality": "Local Windows system voice. 100% offline, zero network required.",
        "locale": "en-US",
        "gender": "Female/System",
        "default_rate": "0%",
        "default_pitch": "0Hz",
        "recommended": False,
        "engine": "local_sapi5",
        "is_offline": True
    }
]

def clean_text_for_speech(raw_text: str) -> str:
    """
    Cleans raw markdown, code blocks, JSON tool arguments, URLs, and formatting
    to produce a natural, pleasant, spoken English text.
    """
    if not raw_text or not raw_text.strip():
        return ""

    text = raw_text

    # 1. Remove JSON tool execution calls or payloads like {"tool": "open_app", ...}
    text = re.sub(r'\{[\s\S]*?"tool"[\s\S]*?\}', '', text)
    # Remove raw JSON blocks
    text = re.sub(r'```json[\s\S]*?```', '', text)

    # 2. Extract or summarize markdown code blocks
    def code_replacer(match):
        return " Here is the code snippet you requested. "
    text = re.sub(r'```[\w]*\n[\s\S]*?```', code_replacer, text)
    text = re.sub(r'`[^`\n]+`', '', text)

    # 3. Remove URLs
    text = re.sub(r'https?://\S+', '', text)
    # Convert markdown links [Label](url) -> Label
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)

    # 4. Remove headings, blockquotes, bullets, horizontal rules
    text = re.sub(r'^#{1,6}\s*', '', text, flags=re.MULTILINE)
    text = re.sub(r'^>\s*', '', text, flags=re.MULTILINE)
    text = re.sub(r'^\s*[-*+]\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'^\s*\d+\.\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'---+', '', text)

    # 5. Remove bold / italic symbols and special tech punctuation
    text = re.sub(r'[*_~]', '', text)
    text = re.sub(r'[<>{}\[\]|\\]', '', text)

    # 6. Normalize multiple spaces and newlines into natural pauses
    text = re.sub(r'\n+', ' ', text)
    text = re.sub(r'\s{2,}', ' ', text)
    text = text.strip()

    # If completely empty after stripping code/tools, provide a graceful spoken acknowledgment
    if not text:
        text = "I have executed that command."

    return text


class VoiceService:
    def __init__(self):
        self._is_speaking = False
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._engine = None

    def list_candidate_voices(self) -> List[Dict[str, any]]:
        """Returns the curated candidate voices for F.R.I.D.A.Y."""
        return CANDIDATE_VOICES

    def list_voices(self) -> List[Dict[str, any]]:
        """Backwards compatibility for existing API callers."""
        return self.list_candidate_voices()

    async def synthesize_audio(
        self,
        text: str,
        voice: str = "en-US-AvaNeural",
        rate: str = "-4%",
        pitch: str = "-2Hz",
        volume: str = "+0%"
    ) -> Tuple[bytes, str]:
        """
        Synthesizes text into an audio byte stream (MP3 or WAV).
        Tries high-quality neural voice first; falls back smoothly to local SAPI5 if offline.
        """
        cleaned = clean_text_for_speech(text)
        if not cleaned:
            return b"", "audio/mpeg"

        # Check if local engine is explicitly requested
        is_local_requested = (voice == "local-sapi5" or "sapi" in voice.lower())

        if HAS_EDGE_TTS and not is_local_requested:
            try:
                # Ensure pitch, rate, and volume have valid signs/units for edge-tts
                effective_voice = voice if voice and "Neural" in voice else "en-US-AvaNeural"
                eff_rate = rate if (rate.endswith("%") and (rate.startswith("+") or rate.startswith("-"))) else "-4%"
                eff_pitch = pitch if (pitch.endswith("Hz") and (pitch.startswith("+") or pitch.startswith("-"))) else "-2Hz"
                eff_vol = volume if (volume.endswith("%") and (volume.startswith("+") or volume.startswith("-"))) else "+0%"

                communicate = edge_tts.Communicate(
                    cleaned,
                    voice=effective_voice,
                    rate=eff_rate,
                    pitch=eff_pitch,
                    volume=eff_vol
                )
                audio_stream = io.BytesIO()
                async for chunk in communicate.stream():
                    if chunk["type"] == "audio":
                        audio_stream.write(chunk["data"])
                
                audio_bytes = audio_stream.getvalue()
                if audio_bytes:
                    return audio_bytes, "audio/mpeg"
            except Exception as e:
                print(f"[VoiceService] Neural TTS unavailable ({e}). Falling back to local offline engine.")

        # Offline local synthesis fallback using pyttsx3 / Windows SAPI5
        return self._synthesize_local_sapi(cleaned)

    def _synthesize_local_sapi(self, text: str) -> Tuple[bytes, str]:
        """Synthesizes audio using local Windows pyttsx3 into a WAV in-memory buffer."""
        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
                tmp_path = tf.name

            engine = pyttsx3.init()
            voices = engine.getProperty("voices")
            # Prefer female voice
            for v in voices:
                if any(k in v.name.lower() for k in ["zira", "female", "hazel", "catherine", "eva"]):
                    engine.setProperty("voice", v.id)
                    break
            engine.setProperty("rate", 165)
            engine.setProperty("volume", 1.0)
            engine.save_to_file(text, tmp_path)
            engine.runAndWait()

            if os.path.exists(tmp_path):
                with open(tmp_path, "rb") as f:
                    wav_data = f.read()
                return wav_data, "audio/wav"
        except Exception as e:
            print(f"[VoiceService] Local SAPI fallback error: {e}")
        finally:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass

        return b"", "audio/wav"

    def speak(self, text: str, rate: int = 175, volume: float = 1.0):
        """Asynchronously speaks text locally on server speaker (legacy support)."""
        self.stop()
        t = threading.Thread(target=self._speak_worker, args=(text, rate, volume), daemon=True)
        t.start()

    def _speak_worker(self, text: str, rate: int, volume: float):
        cleaned = clean_text_for_speech(text)
        if not cleaned:
            return
        with self._lock:
            self._is_speaking = True
            self._stop_event.clear()
            try:
                engine = pyttsx3.init()
                voices = engine.getProperty('voices')
                for v in voices:
                    if "zira" in v.name.lower() or "female" in v.name.lower():
                        engine.setProperty('voice', v.id)
                        break
                engine.setProperty('rate', rate)
                engine.setProperty('volume', volume)
                engine.say(cleaned)
                engine.runAndWait()
            except Exception as e:
                print(f"[VoiceService] Local speak worker error: {e}")
            finally:
                self._is_speaking = False

    def stop(self):
        """Immediately interrupts speech output."""
        self._stop_event.set()
        try:
            if self._engine:
                self._engine.stop()
        except Exception:
            pass
        self._is_speaking = False

    def is_speaking(self) -> bool:
        return self._is_speaking


voice_service = VoiceService()
