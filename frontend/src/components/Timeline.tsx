'use client';

import React, { useState } from 'react';
import {
  DndContext,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDroppable,
  useDraggable,
  DragOverlay,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useEditorStore } from '@/store/editorStore';
import { VideoClip } from '@/types';

interface TimelineProps {
  selectedClipId: string | null;
  onSelectClip: (id: string | null) => void;
}

interface SortableClipProps {
  clip: VideoClip;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  duration?: number; // Total timeline duration for width calculation
}

interface TrackAreaProps {
  trackNumber: number;
  clips: VideoClip[];
  selectedClipId: string | null;
  onSelectClip: (id: string | null) => void;
  onRemoveClip: (id: string) => void;
  pixelsPerSecond: number;
  totalDuration: number;
  activeId: string | null;
}

function TrackArea({ trackNumber, clips, selectedClipId, onSelectClip, onRemoveClip, pixelsPerSecond, totalDuration, activeId }: TrackAreaProps & { activeId: string | null }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `track-${trackNumber}`,
    data: {
      track: trackNumber,
      type: 'track',
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`relative bg-gray-800/30 border rounded min-h-[4rem] flex-1 transition-colors ${
        isOver ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700'
      }`}
      style={{ width: Math.max(800, totalDuration * pixelsPerSecond) }}
    >
      {clips
        .sort((a, b) => a.startTime - b.startTime)
        .map((clip) => (
          <div
            key={clip.id}
            className="absolute top-1"
            style={{
              left: `${clip.startTime * pixelsPerSecond}px`,
              width: `${(clip.endTime - clip.startTime) * pixelsPerSecond}px`,
              opacity: activeId === clip.id ? 0 : 1,
            }}
          >
            <SortableClip
              clip={clip}
              isSelected={selectedClipId === clip.id}
              onSelect={() => onSelectClip(clip.id)}
              onRemove={() => onRemoveClip(clip.id)}
              duration={totalDuration}
            />
          </div>
        ))}
    </div>
  );
}

function SortableClip({ clip, isSelected, onSelect, onRemove, duration = 100 }: SortableClipProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: clip.id });

  const style = {
    transform: CSS.Transform.toString(transform),
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('[Timeline] Removing clip:', clip.id);
    onRemove();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`clip-item relative w-full h-14 rounded-lg overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-blue-400/50 ${
        isDragging ? 'dragging z-50 scale-105' : ''
      } ${isSelected ? 'ring-2 ring-blue-500 bg-blue-500/10' : ''}`}
      onClick={onSelect}
    >
      {/* Drag handle - make entire clip draggable */}
      <div
        {...attributes}
        {...listeners}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
      ></div>
      
      {/* Thumbnail Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20 pointer-events-none">
        {clip.thumbnail ? (
          <img
            src={clip.thumbnail}
            alt={`${clip.videoName} thumbnail`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-8 h-8 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )}
        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* Clip Content */}
      <div className="relative h-full p-2 flex flex-col pointer-events-none">
        <div className="flex justify-between items-start">
          <span className="text-xs text-white truncate flex-1 font-medium">
            {clip.videoName}
          </span>
          <button
            onClick={handleRemove}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-1 hover:bg-red-500/50 rounded transition-colors ml-1 pointer-events-auto z-10"
          >
            <svg className="w-3 h-3 text-white/70 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Spacer for content below */}
        <div className="flex-1" />

        <div className="text-xs text-white/70 space-y-0.5">
          <div className="flex justify-between">
            <span>{formatTime(clip.startTime)}</span>
            <span>{formatTime(clip.endTime)}</span>
          </div>
          <div className="text-center text-white/50">
            {formatTime(duration)} @ {clip.effects.speed}x
          </div>
        </div>

        {/* Effect Indicators */}
        <div className="absolute bottom-1 right-1 flex gap-1">
          {clip.effects.fadeIn > 0 && (
            <div className="w-4 h-4 bg-blue-500/50 rounded flex items-center justify-center" title="Fade In">
              <span className="text-[8px] text-white">FI</span>
            </div>
          )}
          {clip.effects.fadeOut > 0 && (
            <div className="w-4 h-4 bg-purple-500/50 rounded flex items-center justify-center" title="Fade Out">
              <span className="text-[8px] text-white">FO</span>
            </div>
          )}
          {clip.textOverlays.length > 0 && (
            <div className="w-4 h-4 bg-green-500/50 rounded flex items-center justify-center" title="Text Overlay">
              <span className="text-[8px] text-white">T</span>
            </div>
          )}
          {clip.imageOverlays.length > 0 && (
            <div className="w-4 h-4 bg-orange-500/50 rounded flex items-center justify-center" title="Image Overlay">
              <span className="text-[8px] text-white">I</span>
            </div>
          )}
          {isSelected && (
            <div className="w-4 h-4 bg-blue-500 rounded flex items-center justify-center" title="Selected">
              <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Timeline({ selectedClipId, onSelectClip }: TimelineProps) {
  const { clips, reorderClips, removeClip } = useEditorStore();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Group clips by track
  const clipsByTrack = clips.reduce((acc, clip) => {
    if (!acc[clip.track]) {
      acc[clip.track] = [];
    }
    acc[clip.track].push(clip);
    return acc;
  }, {} as Record<number, VideoClip[]>);

  // Get all track numbers including empty ones (always show at least track 0)
  const maxTrack = clips.length > 0 ? Math.max(...clips.map(c => c.track)) : 0;
  const [availableTracks, setAvailableTracks] = useState(Math.max(maxTrack + 1, 1));

  const allTracks = Array.from({ length: availableTracks }, (_, i) => i);

  // Sort tracks by track number (0 = bottom, higher = top)
  const sortedTracks = allTracks.sort((a, b) => b - a); // Higher tracks first (top to bottom)

  // Calculate timeline dimensions
  const totalDuration = clips.length > 0 ? Math.max(...clips.map(c => c.endTime)) : 60; // Default 60 seconds
  const pixelsPerSecond = 20; // 20px per second
  const timelineWidth = Math.max(800, totalDuration * pixelsPerSecond);

  // Generate time markers
  const timeMarkers = [];
  for (let i = 0; i <= Math.ceil(totalDuration); i += 5) {
    timeMarkers.push(i);
  }

  // Create new track
  const createNewTrack = () => {
    setAvailableTracks(prev => prev + 1);
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: { active: { id: string | number } }) => {
    setActiveId(event.active.id.toString());
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over, delta } = event;
    setActiveId(null);

    if (!over) return;

    const draggedClip = clips.find(c => c.id === active.id);
    if (!draggedClip) return;

    // Calculate the time offset based on drag delta
    const timeOffset = Math.round(delta.x / pixelsPerSecond);
    const newStartTime = Math.max(0, draggedClip.startTime + timeOffset);
    const newEndTime = newStartTime + (draggedClip.endTime - draggedClip.startTime);

    // Check if dropped on a track area
    if (over.id?.toString().startsWith('track-')) {
      const targetTrack = parseInt(over.id.toString().replace('track-', ''));

      // Check for conflicts on the target track at the new position
      const hasConflict = clips.some(clip =>
        clip.id !== draggedClip.id &&
        clip.track === targetTrack &&
        !(newEndTime <= clip.startTime || newStartTime >= clip.endTime)
      );

      if (!hasConflict) {
        // Update the clip's position and track
        const updatedClip = {
          ...draggedClip,
          track: targetTrack,
          startTime: newStartTime,
          endTime: newEndTime
        };
        const newClips = clips.map(c => c.id === draggedClip.id ? updatedClip : c);
        reorderClips(newClips);
      }
    }
  };

  const getTotalDuration = () => {
    return clips.reduce((total, clip) => {
      const clipDuration = (clip.endTime - clip.startTime) / clip.effects.speed;
      return total + clipDuration;
    }, 0);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Timeline Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-medium text-gray-300">Timeline</h3>
          <span className="text-xs text-gray-500">
            {clips.length} clip{clips.length !== 1 ? 's' : ''}
          </span>
          {clips.length > 0 && (
            <span className="text-xs text-blue-400">
              Click clips to select • Drag clips to reorder
            </span>
          )}
        </div>
        <div className="text-sm text-gray-400">
          Total: {formatTime(getTotalDuration())}
        </div>
      </div>

      {/* Timeline Content */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        {clips.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500 p-8">
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
              <p>Add clips from the preview panel</p>
              <p className="text-sm text-gray-600 mt-1">Sequential timeline with multiple tracks</p>
            </div>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="p-4">
              {/* Time Ruler */}
              <div className="mb-4 flex items-center">
                {/* Spacer for track labels */}
                <div className="w-20 flex-shrink-0"></div>

                {/* Time Ruler */}
                <div className="relative border-b border-gray-600 pb-2 flex-1" style={{ width: timelineWidth }}>
                  {timeMarkers.map((time) => (
                    <div
                      key={time}
                      className="absolute flex flex-col items-center"
                      style={{
                        left: `${time * pixelsPerSecond}px`,
                        transform: 'translateX(-50%)'
                      }}
                    >
                      <div className="w-px h-3 bg-gray-600"></div>
                      <span className="text-xs text-gray-400 mt-1">{time}s</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tracks */}
              <div className="space-y-1">
                {sortedTracks.map((trackNumber) => (
                  <div key={trackNumber} className="flex items-center">
                    {/* Track Label */}
                    <div className="w-20 text-xs text-gray-500 font-medium flex-shrink-0 text-right pr-3">
                      Track {trackNumber + 1}
                    </div>

                    {/* Track Area */}
                    <TrackArea
                      trackNumber={trackNumber}
                      clips={clipsByTrack[trackNumber] || []}
                      selectedClipId={selectedClipId}
                      onSelectClip={onSelectClip}
                      onRemoveClip={(id) => {
                        removeClip(id);
                        if (selectedClipId === id) {
                          onSelectClip(null);
                        }
                      }}
                      pixelsPerSecond={pixelsPerSecond}
                      totalDuration={totalDuration}
                      activeId={activeId}
                    />
                  </div>
                ))}

                {/* Add New Track Button */}
                <div className="flex items-center gap-3 mt-4">
                  <div className="w-20"></div>
                  <button
                    onClick={createNewTrack}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Track
                  </button>
                </div>
              </div>
            </div>
            <DragOverlay>
              {activeId ? (
                <SortableClip
                  clip={clips.find(c => c.id === activeId)!}
                  isSelected={false}
                  onSelect={() => {}}
                  onRemove={() => {}}
                  duration={totalDuration}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
}
