'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useEditorStore } from '@/store/editorStore';
import { uploadVideo, uploadVideoFromUrl, getFullUrl } from '@/lib/api';

export default function VideoLibrary() {
  const { videos, currentVideoId, setCurrentVideo, removeVideo, addVideo } = useEditorStore();
  const [showUpload, setShowUpload] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [urlInput, setUrlInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      video.onerror = () => resolve(0);
      video.src = URL.createObjectURL(file);
    });
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setError(null);
      const validFiles = acceptedFiles.filter((file) =>
        ['video/mp4', 'video/quicktime', 'video/x-msvideo'].includes(file.type)
      );

      if (validFiles.length !== acceptedFiles.length) {
        setError('Some files were skipped. Only MP4, MOV, and AVI formats are supported.');
      }

      for (const file of validFiles) {
        const tempId = `temp-${Date.now()}-${file.name}`;
        setUploadProgress((prev) => ({ ...prev, [tempId]: 0 }));
        setIsUploading(true);

        try {
          // Create a local URL for preview
          const localUrl = URL.createObjectURL(file);

          // Get video duration
          const duration = await getVideoDuration(file);

          // Add video with local URL first
          const videoId = addVideo({
            name: file.name,
            url: localUrl,
            duration,
            type: 'local',
            file,
          });

          // Try to upload to backend (if available)
          try {
            const response = await uploadVideo(file, (progress) => {
              setUploadProgress((prev) => ({ ...prev, [tempId]: progress }));
            });

            // Update with server URL
            useEditorStore.setState((state) => ({
              videos: state.videos.map((v) =>
                v.id === videoId
                  ? {
                      ...v,
                      url: getFullUrl(response.url),
                      thumbnail: getFullUrl(response.thumbnail),
                      duration: response.duration || v.duration,
                    }
                  : v
              ),
            }));
          } catch (uploadError) {
            // If backend is not available, continue with local file
            console.warn('Backend upload failed, using local file:', uploadError);
          }
        } catch (error) {
          setError(`Failed to process ${file.name}`);
          console.error(error);
        } finally {
          setUploadProgress((prev) => {
            const newProgress = { ...prev };
            delete newProgress[tempId];
            return newProgress;
          });
        }
      }
      setIsUploading(false);
    },
    [addVideo]
  );

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return;

    setError(null);
    setIsUploading(true);

    try {
      const response = await uploadVideoFromUrl(urlInput);
      addVideo({
        name: response.filename,
        url: getFullUrl(response.url),
        duration: response.duration,
        type: 'url',
        thumbnail: getFullUrl(response.thumbnail),
      });
      setUrlInput('');
    } catch (err) {
      // Fallback: add URL directly without processing
      addVideo({
        name: urlInput.split('/').pop() || 'Video from URL',
        url: urlInput,
        duration: 0,
        type: 'url',
      });
      setUrlInput('');
    } finally {
      setIsUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/mp4': ['.mp4'],
      'video/quicktime': ['.mov'],
      'video/x-msvideo': ['.avi'],
    },
    multiple: true,
  });

  return (
    <div className="p-4">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-300">
          Videos ({videos.length})
        </h3>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
            showUpload
              ? 'bg-gray-600 hover:bg-gray-700 text-gray-300'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {showUpload ? (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Video
            </>
          )}
        </button>
      </div>

      {/* Upload Interface */}
      {showUpload && (
        <div className="mb-6 space-y-4 animate-in slide-in-from-top-2 duration-200">
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Drag & Drop Area */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-gray-600 hover:border-gray-500'
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center">
              <svg className="w-8 h-8 text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-gray-400 mb-1">
                {isDragActive ? 'Drop videos here...' : 'Drop videos here or click to browse'}
              </p>
              <p className="text-xs text-gray-600">MP4, MOV, AVI supported</p>
            </div>
          </div>

          {/* URL Input */}
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/video.mp4"
              className="flex-1 bg-[#1e1e1e] border border-[#3a3a3a] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
            <button
              onClick={handleUrlSubmit}
              disabled={!urlInput.trim() || isUploading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
            >
              Add URL
            </button>
          </div>

          {/* Upload Progress */}
          {Object.keys(uploadProgress).length > 0 && (
            <div className="space-y-2">
              {Object.entries(uploadProgress).map(([id, progress]) => (
                <div key={id} className="bg-[#1e1e1e] rounded p-3">
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-300 text-xs truncate">Uploading...</span>
                    <span className="text-blue-400 text-xs">{progress}%</span>
                  </div>
                  <div className="h-1.5 bg-[#3a3a3a] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {videos.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          {showUpload ? 'Add your first video above' : 'No videos added yet'}
        </div>
      ) : (
        <div className="space-y-3">
          {videos.map((video) => (
            <div
              key={video.id}
              onClick={() => setCurrentVideo(video.id)}
              className={`group cursor-pointer rounded-lg overflow-hidden transition-all ${
                currentVideoId === video.id
                  ? 'ring-2 ring-blue-500 bg-blue-500/10'
                  : 'bg-[#1e1e1e] hover:bg-[#2a2a2a]'
              }`}
            >
              <div className="flex gap-3 p-3">
                {/* Thumbnail */}
                <div className="w-28 h-16 bg-[#2a2a2a] rounded overflow-hidden flex-shrink-0 relative">
                  {video.thumbnail ? (
                    <img
                      src={video.thumbnail}
                      alt={video.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <video
                      src={video.url}
                      className="w-full h-full object-cover"
                      muted
                      preload="metadata"
                    />
                  )}
                  <div className="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 rounded text-xs text-white">
                    {formatDuration(video.duration)}
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <p className="text-white font-medium text-sm truncate">
                    {video.name}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    {video.type === 'local' ? 'Local file' : 'From URL'}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeVideo(video.id);
                    }}
                    className="p-1.5 text-gray-500 hover:text-red-500 transition-colors"
                    title="Remove video"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
