'use client';

import React from 'react';
import { useEditorStore } from '@/store/editorStore';

export default function VideoLibrary() {
  const { videos, currentVideoId, setCurrentVideo, removeVideo } = useEditorStore();

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-4">
      {videos.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          No videos added yet
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
