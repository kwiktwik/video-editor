'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import VideoPreview from './VideoPreview';
import VideoLibrary from './VideoLibrary';
import Timeline from './Timeline';
import EffectsPanel from './EffectsPanel';
import AudioPanel from './AudioPanel';
import ExportPanel from './ExportPanel';

type Tab = 'effects' | 'audio' | 'export';

export default function EditorScreen() {
  const { videos, clips, currentVideoId, setScreen } = useEditorStore();
  const [activeTab, setActiveTab] = useState<Tab>('effects');
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  const currentVideo = videos.find((v) => v.id === currentVideoId);

  return (
    <div className="h-screen bg-[#0f0f0f] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-14 bg-[#1a1a1a] border-b border-[#2a2a2a] flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setScreen('upload')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-xl font-semibold text-white">Video Editor</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">
            {clips.length} clip{clips.length !== 1 ? 's' : ''} in timeline
          </span>
          <button
            onClick={() => setScreen('processing')}
            disabled={clips.length === 0}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Export
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Video Preview */}
        <div className="w-1/3 border-r border-[#2a2a2a] flex flex-col">
          <div className="p-4 border-b border-[#2a2a2a]">
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
              Preview & Trim
            </h2>
          </div>
          <div className="flex-1 overflow-auto">
            {currentVideo ? (
              <VideoPreview video={currentVideo} />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                Select a video to preview
              </div>
            )}
          </div>
        </div>

        {/* Middle Panel - Video Library */}
        <div className="w-1/3 border-r border-[#2a2a2a] flex flex-col">
          <div className="p-4 border-b border-[#2a2a2a]">
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
              Video Library
            </h2>
          </div>
          <div className="flex-1 overflow-auto">
            <VideoLibrary />
          </div>
        </div>

        {/* Right Panel - Timeline & Settings */}
        <div className="w-1/3 flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-[#2a2a2a]">
            <button
              onClick={() => setActiveTab('effects')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'effects'
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Effects & Overlays
            </button>
            <button
              onClick={() => setActiveTab('audio')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'audio'
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Audio
            </button>
            <button
              onClick={() => setActiveTab('export')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'export'
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Settings
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-auto p-4">
            {activeTab === 'effects' && (
              <EffectsPanel
                selectedClipId={selectedClipId}
                onSelectClip={setSelectedClipId}
              />
            )}
            {activeTab === 'audio' && <AudioPanel />}
            {activeTab === 'export' && <ExportPanel />}
          </div>
        </div>
      </div>

      {/* Bottom Panel - Timeline */}
      <div className="h-48 border-t border-[#2a2a2a] timeline-container flex-shrink-0">
        <Timeline
          selectedClipId={selectedClipId}
          onSelectClip={setSelectedClipId}
        />
      </div>
    </div>
  );
}
