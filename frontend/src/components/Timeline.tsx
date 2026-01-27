'use client';

import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
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
}

function SortableClip({ clip, isSelected, onSelect, onRemove }: SortableClipProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: clip.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const duration = clip.endTime - clip.startTime;

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
      className={`clip-item relative flex-shrink-0 w-40 h-28 rounded-lg overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-blue-400/50 ${
        isDragging ? 'dragging z-50 scale-105' : ''
      } ${isSelected ? 'ring-2 ring-blue-500 bg-blue-500/10' : ''}`}
      onClick={onSelect}
    >
      {/* Draggable handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-1 left-1 w-6 h-6 bg-black/50 rounded cursor-grab active:cursor-grabbing flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <svg className="w-3 h-3 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </div>
      
      {/* Clip Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20 pointer-events-none" />
      
      {/* Clip Content */}
      <div className="relative h-full p-2 flex flex-col pointer-events-none">
        <div className="flex justify-between items-start">
          <span className="text-xs text-white/70 truncate flex-1">
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
        
        <div className="flex-1 flex items-center justify-center">
          <svg className="w-8 h-8 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = clips.findIndex((c) => c.id === active.id);
      const newIndex = clips.findIndex((c) => c.id === over.id);
      reorderClips(arrayMove(clips, oldIndex, newIndex));
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
              Click clips to select • Drag handle to reorder
            </span>
          )}
        </div>
        <div className="text-sm text-gray-400">
          Total: {formatTime(getTotalDuration())}
        </div>
      </div>

      {/* Timeline Content */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        {clips.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
              <p>Add clips from the preview panel</p>
              <p className="text-sm text-gray-600 mt-1">Drag to reorder</p>
            </div>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={clips.map((c) => c.id)}
              strategy={horizontalListSortingStrategy}
            >
              <div className="flex gap-3 h-full items-center">
                {clips.map((clip) => (
                  <SortableClip
                    key={clip.id}
                    clip={clip}
                    isSelected={selectedClipId === clip.id}
                    onSelect={() => onSelectClip(clip.id)}
                    onRemove={() => {
                      removeClip(clip.id);
                      if (selectedClipId === clip.id) {
                        onSelectClip(null);
                      }
                    }}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
