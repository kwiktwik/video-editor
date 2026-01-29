'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { useEditorStore } from '@/store/editorStore';
import { uploadVideo, uploadVideoFromUrl, getFullUrl } from '@/lib/api';

export default function UploadScreen() {
  const { videos, addVideo, removeVideo, setCurrentVideo } = useEditorStore();
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [urlInput, setUrlInput] = useState('');
  const [error, setError] = useState<string | null>(null);

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
            
            console.log('[Upload] Backend response:', response);
            console.log('[Upload] Video ID in store:', videoId);
            console.log('[Upload] Full URL:', getFullUrl(response.url));
            console.log('[Upload] Thumbnail URL:', getFullUrl(response.thumbnail));
            
            // Update with server URL (convert to full URL)
            useEditorStore.setState((state) => {
              console.log('[Upload] Current videos in store:', state.videos.map(v => ({ id: v.id, url: v.url })));
              return {
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
              };
            });
            
            // Verify the update
            setTimeout(() => {
              const updatedVideos = useEditorStore.getState().videos;
              console.log('[Upload] Updated videos:', updatedVideos.map(v => ({ id: v.id, url: v.url })));
            }, 100);
          } catch (uploadError) {
            // If backend is not available, continue with local file
            console.warn('Backend upload failed, using local file:', uploadError);
          }
        } catch (err) {
          setError(`Failed to process ${file.name}`);
          console.error(err);
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

  const handleProceed = () => {
    if (videos.length > 0) {
      setCurrentVideo(videos[0].id);
      router.push('/edit');
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            🎬 Video Editor
          </h1>
          <p className="text-gray-400 text-lg">
            Upload your videos to get started with editing
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {/* Upload Area */}
        <div
          {...getRootProps()}
          className={`drop-zone rounded-2xl p-12 text-center cursor-pointer mb-8 ${
            isDragActive ? 'active' : ''
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center">
            <svg
              className="w-16 h-16 text-gray-500 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-xl text-gray-300 mb-2">
              {isDragActive
                ? 'Drop your videos here...'
                : 'Drag & drop videos here'}
            </p>
            <p className="text-gray-500">
              or click to browse • MP4, MOV, AVI supported
            </p>
          </div>
        </div>

        {/* URL Input */}
        <div className="mb-8">
          <label className="block text-gray-300 mb-2 text-sm">
            Or enter a video URL
          </label>
          <div className="flex gap-3">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/video.mp4"
              className="flex-1 bg-[#1e1e1e] border border-[#3b3b3b] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
            <button
              onClick={handleUrlSubmit}
              disabled={!urlInput.trim() || isUploading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              Add URL
            </button>
          </div>
        </div>

        {/* Upload Progress */}
        {Object.keys(uploadProgress).length > 0 && (
          <div className="mb-8 space-y-3">
            {Object.entries(uploadProgress).map(([id, progress]) => (
              <div key={id} className="bg-[#1e1e1e] rounded-lg p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-300 text-sm truncate">Uploading...</span>
                  <span className="text-blue-400 text-sm">{progress}%</span>
                </div>
                <div className="h-2 bg-[#3b3b3b] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Video List */}
        {videos.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              Added Videos ({videos.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {videos.map((video) => (
                <div
                  key={video.id}
                  className="bg-[#1e1e1e] rounded-lg p-4 flex items-center gap-4 group"
                >
                  <div className="w-24 h-16 bg-[#2a2a2a] rounded-lg overflow-hidden flex-shrink-0">
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
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{video.name}</p>
                    <p className="text-gray-500 text-sm">
                      {video.duration > 0
                        ? `${Math.floor(video.duration / 60)}:${Math.floor(video.duration % 60).toString().padStart(2, '0')}`
                        : 'Duration unknown'}
                    </p>
                  </div>
                  <button
                    onClick={() => removeVideo(video.id)}
                    className="p-2 text-gray-500 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Proceed Button */}
        <div className="flex justify-center">
          <button
            onClick={handleProceed}
            disabled={videos.length === 0}
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed rounded-xl font-semibold text-lg transition-all transform hover:scale-105 disabled:hover:scale-100"
          >
            Continue to Editor →
          </button>
        </div>
      </div>
    </div>
  );
}
