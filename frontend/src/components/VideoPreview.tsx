'use client';

import React, { useState, useRef, useEffect, startTransition } from 'react';
import { VideoFile } from '@/types';
import { useEditorStore } from '@/store/editorStore';
import { generateThumbnail, getFullUrl } from '@/lib/api';

interface TimeInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  className?: string;
}

function TimeInput({ value, onChange, min = 0, max = 3600, step = 0.1, placeholder = "0.0", className = "" }: TimeInputProps) {
  const [inputValue, setInputValue] = useState(value.toFixed(1));
  const [isValid, setIsValid] = useState(true);
  const isEditingRef = useRef(false);

  const validateAndClampValue = (numValue: number) => {
    return Math.max(min, Math.min(max, numValue));
  };

  // Update input value when prop value changes and not editing
  React.useLayoutEffect(() => {
    if (!isEditingRef.current) {
      setInputValue(value.toFixed(1));
      setIsValid(true);
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    const numValue = parseFloat(newValue);
    if (!isNaN(numValue)) {
      const clampedValue = validateAndClampValue(numValue);
      setIsValid(clampedValue === numValue || (numValue >= min && numValue <= max));
      onChange(clampedValue);
    } else {
      setIsValid(newValue === "" || /^\d*\.?\d*$/.test(newValue));
    }
  };

  const handleBlur = () => {
    isEditingRef.current = false;
    const numValue = parseFloat(inputValue);
    if (isNaN(numValue)) {
      setInputValue(value.toFixed(1));
      setIsValid(true);
    } else {
      const clampedValue = validateAndClampValue(numValue);
      setInputValue(clampedValue.toFixed(1));
      setIsValid(true);
      onChange(clampedValue);
    }
  };

  const handleFocus = () => {
    isEditingRef.current = true;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setInputValue(value.toFixed(1));
      setIsValid(true);
      e.currentTarget.blur();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newValue = validateAndClampValue(value + step);
      onChange(newValue);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newValue = validateAndClampValue(value - step);
      onChange(newValue);
    }
  };

  return (
    <input
      type="text"
      value={inputValue}
      onChange={handleInputChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={`bg-[#2a2a2a] border rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 transition-colors ${className} ${
        isValid ? 'border-[#3a3a3a] focus:border-blue-500 focus:ring-blue-500/20' : 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
      }`}
    />
  );
}

interface VideoPreviewProps {
  video: VideoFile;
}

export default function VideoPreview({ video }: VideoPreviewProps) {
  const { addClip, clips } = useEditorStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(video.duration || 0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(video.duration || 0);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeking, setIsSeeking] = useState(false);

  useEffect(() => {
    console.log('[VideoPreview] Video changed:', { id: video.id, url: video.url, duration: video.duration });
    // Reset video state when video changes
    startTransition(() => {
      setTrimStart(0);
      setTrimEnd(video.duration || 0);
      setCurrentTime(0);
      setIsPlaying(false);
      setVideoError(null);
      setIsLoading(true);
    });
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.load(); // Force reload when video changes
    }
  }, [video.id, video.url, video.duration]);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      setDuration(dur);
      setIsLoading(false);
      if (trimEnd === 0 || trimEnd > dur) {
        setTrimEnd(dur);
      }
    }
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error('Video load error:', e);
    setVideoError('Failed to load video. Please check if the file is accessible.');
    setIsLoading(false);
  };

  const handleCanPlay = () => {
    setIsLoading(false);
    setVideoError(null);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && !isSeeking) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setIsSeeking(true);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const handleSeekStart = () => {
    setIsSeeking(true);
  };

  const handleSeekEnd = () => {
    setTimeout(() => setIsSeeking(false), 150);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  // Helper function to find the next available position and track
  const findNextPosition = (clipDuration: number): { track: number, startTime: number } => {
    // Always try to place sequentially on track 0 first
    // Find the latest end time on track 0 only
    let latestEndTimeOnTrack0 = 0;
    clips.forEach(clip => {
      if (clip.track === 0) {
        latestEndTimeOnTrack0 = Math.max(latestEndTimeOnTrack0, clip.endTime);
      }
    });

    // Try to place on track 0 at the end
    const proposedStartTime = latestEndTimeOnTrack0;
    const proposedEndTime = proposedStartTime + clipDuration;

    // Check if track 0 has any conflicts at this time
    const hasConflictOnTrack0 = clips.some(clip =>
      clip.track === 0 &&
      !(proposedEndTime <= clip.startTime || proposedStartTime >= clip.endTime)
    );

    if (!hasConflictOnTrack0) {
      return { track: 0, startTime: proposedStartTime };
    }

    // If there's a conflict on track 0, find the earliest available time on track 0
    // or place on another track
    for (let track = 0; track < 10; track++) {
      // For track 0, find the next available slot
      if (track === 0) {
        // Find gaps in track 0
        const track0Clips = clips.filter(c => c.track === 0).sort((a, b) => a.startTime - b.startTime);
        let earliestAvailable = 0;

        for (const clip of track0Clips) {
          if (earliestAvailable + clipDuration <= clip.startTime) {
            return { track: 0, startTime: earliestAvailable };
          }
          earliestAvailable = Math.max(earliestAvailable, clip.endTime);
        }

        // Check if we can place at the end
        if (earliestAvailable + clipDuration <= proposedEndTime) {
          return { track: 0, startTime: earliestAvailable };
        }
      } else {
        // For other tracks, place at the same time as track 0's latest
        const trackHasConflict = clips.some(clip =>
          clip.track === track &&
          !(proposedEndTime <= clip.startTime || proposedStartTime >= clip.endTime)
        );

        if (!trackHasConflict) {
          return { track, startTime: proposedStartTime };
        }
      }
    }

    // Fallback: place on the highest track
    const maxTrack = clips.length > 0 ? Math.max(...clips.map(c => c.track)) : 0;
    return { track: maxTrack + 1, startTime: proposedStartTime };
  };

  const handleAddToTimeline = async () => {
    if (trimStart >= trimEnd) {
      alert('Invalid trim selection. Start time must be before end time.');
      return;
    }

    const clipDuration = trimEnd - trimStart;
    const { track, startTime } = findNextPosition(clipDuration);
    const endTime = startTime + clipDuration;

    try {
      // Generate thumbnail for the clip
      const thumbnailResponse = await generateThumbnail(video.id, trimStart);
      const thumbnailUrl = getFullUrl(thumbnailResponse.url);

      addClip({
        videoId: video.id,
        videoName: video.name,
        startTime,
        endTime,
        thumbnail: thumbnailUrl,
        track,
        effects: {
          fadeIn: 0,
          fadeOut: 0,
          speed: 1,
        },
        textOverlays: [],
        imageOverlays: [],
      });
    } catch (error) {
      console.warn('Failed to generate thumbnail, adding clip without thumbnail:', error);
      // Add clip without thumbnail if thumbnail generation fails
      addClip({
        videoId: video.id,
        videoName: video.name,
        startTime,
        endTime,
        track,
        effects: {
          fadeIn: 0,
          fadeOut: 0,
          speed: 1,
        },
        textOverlays: [],
        imageOverlays: [],
      });
    }
  };

  const setTrimStartToCurrent = () => {
    setTrimStart(currentTime);
  };

  const setTrimEndToCurrent = () => {
    setTrimEnd(currentTime);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Video Player */}
      <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
            <div className="text-center">
              <svg className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-gray-400 text-sm">Loading video...</p>
            </div>
          </div>
        )}
        
        {videoError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
            <div className="text-center p-4">
              <svg className="w-12 h-12 text-red-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-400 text-sm">{videoError}</p>
              <p className="text-gray-500 text-xs mt-2">URL: {video.url}</p>
            </div>
          </div>
        )}
        
        <video
          ref={videoRef}
          src={video.url}
          className="w-full h-full object-contain"
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setIsPlaying(false)}
          onError={handleVideoError}
          onCanPlay={handleCanPlay}
          onClick={togglePlay}
          crossOrigin="anonymous"
        />
        
        {/* Play/Pause Overlay */}
        {!isLoading && !videoError && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
            onClick={togglePlay}
          >
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
              {isPlaying ? (
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Time Display */}
      <div className="flex justify-between text-sm text-gray-400">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Seek Bar */}
      <div className="relative">
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.01}
          value={currentTime}
          onChange={handleSeek}
          onMouseDown={handleSeekStart}
          onMouseUp={handleSeekEnd}
          onTouchStart={handleSeekStart}
          onTouchEnd={handleSeekEnd}
          className="w-full"
        />
        {/* Trim Overlay */}
        <div
          className="absolute top-0 h-1 bg-blue-500/30 pointer-events-none"
          style={{
            left: `${(trimStart / duration) * 100}%`,
            width: `${((trimEnd - trimStart) / duration) * 100}%`,
          }}
        />
      </div>

      {/* Playback Controls */}
      <div className="flex justify-center gap-2">
        <button
          onClick={() => {
            if (videoRef.current) {
              videoRef.current.currentTime = Math.max(0, currentTime - 5);
            }
          }}
          className="p-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] rounded-lg transition-colors"
          title="Rewind 5s"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
          </svg>
        </button>
        <button
          onClick={togglePlay}
          className="p-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          {isPlaying ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        <button
          onClick={() => {
            if (videoRef.current) {
              videoRef.current.currentTime = Math.min(duration, currentTime + 5);
            }
          }}
          className="p-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] rounded-lg transition-colors"
          title="Forward 5s"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
          </svg>
        </button>
      </div>

      {/* Trim Controls */}
      <div className="bg-[#1e1e1e] rounded-lg p-4 space-y-4">
        <h3 className="text-sm font-medium text-gray-300">Trim Selection</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Start Time</label>
            <div className="flex gap-2">
              <TimeInput
                value={trimStart}
                onChange={(value) => setTrimStart(Math.max(0, Math.min(trimEnd - 0.1, value)))}
                min={0}
                max={trimEnd - 0.1}
                step={0.1}
                className="flex-1"
              />
              <button
                onClick={setTrimStartToCurrent}
                className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded text-xs transition-colors"
                title="Set to current time"
              >
                Set
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">End Time</label>
            <div className="flex gap-2">
              <TimeInput
                value={trimEnd}
                onChange={(value) => setTrimEnd(Math.min(duration, Math.max(trimStart + 0.1, value)))}
                min={trimStart + 0.1}
                max={duration}
                step={0.1}
                className="flex-1"
              />
              <button
                onClick={setTrimEndToCurrent}
                className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded text-xs transition-colors"
                title="Set to current time"
              >
                Set
              </button>
            </div>
          </div>
        </div>

        <div className="text-center text-sm text-gray-400">
          Duration: {formatTime(trimEnd - trimStart)}
        </div>

        <button
          onClick={handleAddToTimeline}
          className="w-full py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add to Timeline
        </button>
      </div>
    </div>
  );
}
