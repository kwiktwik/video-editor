'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useEditorStore } from '@/store/editorStore';
import { uploadAudio, getFullUrl } from '@/lib/api';

export default function AudioPanel() {
  const { audioTracks, addAudioTrack, updateAudioTrack, removeAudioTrack } = useEditorStore();
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      for (const file of acceptedFiles) {
        if (!file.type.startsWith('audio/')) continue;

        setIsUploading(true);
        try {
          // Create local URL
          const localUrl = URL.createObjectURL(file);

          addAudioTrack({
            name: file.name,
            url: localUrl,
            file,
            volume: 1,
            startTime: 0,
          });

          // Try upload to backend
          try {
            const response = await uploadAudio(file);
            useEditorStore.setState((state) => ({
              audioTracks: state.audioTracks.map((t) =>
                t.file === file ? { ...t, url: getFullUrl(response.url) } : t
              ),
            }));
          } catch (err) {
            console.warn('Backend audio upload failed, using local file');
          }
        } catch (err) {
          console.error('Failed to add audio:', err);
        } finally {
          setIsUploading(false);
        }
      }
    },
    [addAudioTrack]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a', '.aac', '.ogg'],
    },
    multiple: true,
  });

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={`drop-zone rounded-lg p-6 text-center cursor-pointer ${
          isDragActive ? 'active' : ''
        }`}
      >
        <input {...getInputProps()} />
        <svg
          className="w-10 h-10 mx-auto mb-2 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
          />
        </svg>
        <p className="text-sm text-gray-400">
          {isUploading
            ? 'Uploading...'
            : isDragActive
            ? 'Drop audio files here...'
            : 'Drag & drop or click to add audio'}
        </p>
        <p className="text-xs text-gray-500 mt-1">MP3, WAV, M4A, AAC, OGG</p>
      </div>

      {/* Audio Tracks List */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-300">Audio Tracks</h3>

        {audioTracks.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">No audio tracks added</p>
        ) : (
          audioTracks.map((track) => (
            <div key={track.id} className="bg-[#1e1e1e] rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">{track.name}</p>
                </div>
                <button
                  onClick={() => removeAudioTrack(track.id)}
                  className="p-1 text-gray-500 hover:text-red-500 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Volume Control */}
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-gray-500">Volume</label>
                  <span className="text-xs text-blue-400">{Math.round(track.volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={track.volume}
                  onChange={(e) =>
                    updateAudioTrack(track.id, { volume: parseFloat(e.target.value) })
                  }
                  className="w-full"
                />
              </div>

              {/* Start Time */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Start Time (seconds)</label>
                <input
                  type="number"
                  value={track.startTime}
                  onChange={(e) =>
                    updateAudioTrack(track.id, { startTime: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full bg-[#2a2a2a] border border-[#3a3a3a] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  min={0}
                  step={0.1}
                />
              </div>

              {/* Audio Preview */}
              <audio controls className="w-full h-8" style={{ filter: 'invert(1)' }}>
                <source src={track.url} />
                Your browser does not support the audio element.
              </audio>
            </div>
          ))
        )}
      </div>

      {/* Tips */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-400 mb-2">Tips</h4>
        <ul className="text-xs text-gray-400 space-y-1">
          <li>• Audio tracks will be mixed with video audio</li>
          <li>• Adjust start time to sync with video</li>
          <li>• Use volume to balance audio levels</li>
        </ul>
      </div>
    </div>
  );
}
