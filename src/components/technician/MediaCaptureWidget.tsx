import { useRef, useState } from 'react';
import { Camera, Mic, Video } from 'lucide-react';

type MediaCaptureWidgetProps = {
  onFileSelected: (file: File, mediaType: 'photo' | 'video' | 'audio') => void;
  disabled?: boolean;
};

export function MediaCaptureWidget({ onFileSelected, disabled }: MediaCaptureWidgetProps) {
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startAudioRecording = async () => {
    if (recording || !navigator.mediaDevices?.getUserMedia) {
      audioInputRef.current?.click();
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    audioChunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' });
      onFileSelected(file, 'audio');
      stream.getTracks().forEach((track) => track.stop());
    };
    mediaRecorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  };

  const stopAudioRecording = () => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();
    setRecording(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFileSelected(file, 'photo');
          event.currentTarget.value = '';
        }}
        disabled={disabled}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFileSelected(file, 'video');
          event.currentTarget.value = '';
        }}
        disabled={disabled}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        capture="microphone"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFileSelected(file, 'audio');
          event.currentTarget.value = '';
        }}
        disabled={disabled}
      />

      <button
        type="button"
        onClick={() => photoInputRef.current?.click()}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide border border-slate-200 rounded-lg hover:border-slate-400"
      >
        <Camera className="w-4 h-4" />
        Photo
      </button>
      <button
        type="button"
        onClick={() => videoInputRef.current?.click()}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide border border-slate-200 rounded-lg hover:border-slate-400"
      >
        <Video className="w-4 h-4" />
        Video
      </button>
      <button
        type="button"
        onClick={() => (recording ? stopAudioRecording() : startAudioRecording())}
        disabled={disabled}
        className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide border rounded-lg ${
          recording ? 'border-red-300 text-red-600 bg-red-50' : 'border-slate-200 hover:border-slate-400'
        }`}
      >
        <Mic className="w-4 h-4" />
        {recording ? 'Stop' : 'Audio'}
      </button>
    </div>
  );
}
