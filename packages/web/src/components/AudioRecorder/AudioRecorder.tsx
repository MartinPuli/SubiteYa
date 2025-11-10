/**
 * AudioRecorder component
 * Purpose: Record audio directly in the browser and convert to files
 */

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../Button/Button';
import './AudioRecorder.css';

interface AudioRecorderProps {
  onAudioRecorded: (file: File) => void;
  maxDuration?: number; // in seconds
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onAudioRecorded,
  maxDuration = 300, // 5 minutes default
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioURL(url);

        // Convert to File
        const timestamp = new Date().getTime();
        const file = new File([blob], `recording-${timestamp}.webm`, {
          type: 'audio/webm',
        });

        onAudioRecorded(file);

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= maxDuration) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('No se pudo acceder al micrófono. Verifica los permisos.');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);

      // Resume timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= maxDuration) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const discardRecording = () => {
    if (audioURL) {
      URL.revokeObjectURL(audioURL);
    }
    setAudioURL(null);
    setRecordingTime(0);
    chunksRef.current = [];
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="audio-recorder">
      {error && (
        <div className="recorder-error">
          <span>⚠️</span> {error}
        </div>
      )}

      <div className="recorder-display">
        {isRecording ? (
          <div className="recording-indicator">
            <span
              className={`recording-dot ${isPaused ? 'paused' : ''}`}
            ></span>
            <span className="recording-text">
              {isPaused ? 'Pausado' : 'Grabando'}
            </span>
            <span className="recording-time">{formatTime(recordingTime)}</span>
          </div>
        ) : audioURL ? (
          <div className="recording-preview">
            <span className="preview-icon">🎵</span>
            <audio controls src={audioURL} className="audio-player" />
            <span className="preview-duration">
              {formatTime(recordingTime)}
            </span>
          </div>
        ) : (
          <div className="recorder-idle">
            <span className="mic-icon">🎤</span>
            <p>Presiona el botón para comenzar a grabar</p>
          </div>
        )}
      </div>

      <div className="recorder-controls">
        {!isRecording && !audioURL && (
          <Button variant="primary" onClick={startRecording}>
            🎙️ Comenzar Grabación
          </Button>
        )}

        {isRecording && !isPaused && (
          <>
            <Button variant="ghost" onClick={pauseRecording}>
              ⏸️ Pausar
            </Button>
            <Button variant="danger" onClick={stopRecording}>
              ⏹️ Detener
            </Button>
          </>
        )}

        {isRecording && isPaused && (
          <>
            <Button variant="primary" onClick={resumeRecording}>
              ▶️ Continuar
            </Button>
            <Button variant="danger" onClick={stopRecording}>
              ⏹️ Detener
            </Button>
          </>
        )}

        {audioURL && (
          <>
            <Button variant="ghost" onClick={discardRecording}>
              🗑️ Descartar
            </Button>
            <Button variant="primary" onClick={startRecording}>
              🔄 Grabar Otra Vez
            </Button>
          </>
        )}
      </div>

      <div className="recorder-info">
        <small>
          💡 Duración mínima: 30 segundos | Máxima:{' '}
          {Math.floor(maxDuration / 60)} minutos
        </small>
      </div>
    </div>
  );
};
