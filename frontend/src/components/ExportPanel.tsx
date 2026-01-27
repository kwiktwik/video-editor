'use client';

import React from 'react';
import { useEditorStore } from '@/store/editorStore';

const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9', description: 'Landscape (YouTube, TV)' },
  { value: '9:16', label: '9:16', description: 'Portrait (TikTok, Reels)' },
  { value: '1:1', label: '1:1', description: 'Square (Instagram)' },
];

const QUALITY_OPTIONS = [
  { value: 'low', label: 'Low', description: '480p - Fast processing' },
  { value: 'optimised', label: 'Optimised', description: '720p - Balanced' },
  { value: 'high', label: 'High', description: '1080p - Best quality' },
];

const FORMAT_OPTIONS = [
  { value: 'mp4', label: 'MP4', description: 'Most compatible' },
  { value: 'mov', label: 'MOV', description: 'Apple devices' },
  { value: 'avi', label: 'AVI', description: 'Windows' },
];

export default function ExportPanel() {
  const { exportSettings, updateExportSettings, clips } = useEditorStore();

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
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-[#1e1e1e] rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Export Summary</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Clips</p>
            <p className="text-white font-medium">{clips.length}</p>
          </div>
          <div>
            <p className="text-gray-500">Duration</p>
            <p className="text-white font-medium">{formatTime(getTotalDuration())}</p>
          </div>
        </div>
      </div>

      {/* Aspect Ratio */}
      <div className="bg-[#1e1e1e] rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Aspect Ratio</h3>
        <div className="grid grid-cols-3 gap-2">
          {ASPECT_RATIOS.map((ratio) => (
            <button
              key={ratio.value}
              onClick={() =>
                updateExportSettings({
                  aspectRatio: ratio.value as '1:1' | '16:9' | '9:16',
                })
              }
              className={`p-3 rounded-lg border transition-all ${
                exportSettings.aspectRatio === ratio.value
                  ? 'border-blue-500 bg-blue-500/20'
                  : 'border-[#3a3a3a] hover:border-[#4a4a4a]'
              }`}
            >
              <div
                className={`mx-auto mb-2 bg-gray-600 rounded ${
                  ratio.value === '16:9'
                    ? 'w-12 h-7'
                    : ratio.value === '9:16'
                    ? 'w-7 h-12'
                    : 'w-10 h-10'
                }`}
              />
              <p className="text-sm text-white font-medium">{ratio.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{ratio.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Quality */}
      <div className="bg-[#1e1e1e] rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Export Quality</h3>
        <div className="space-y-2">
          {QUALITY_OPTIONS.map((quality) => (
            <button
              key={quality.value}
              onClick={() =>
                updateExportSettings({
                  quality: quality.value as 'low' | 'optimised' | 'high',
                })
              }
              className={`w-full p-3 rounded-lg border text-left transition-all flex justify-between items-center ${
                exportSettings.quality === quality.value
                  ? 'border-blue-500 bg-blue-500/20'
                  : 'border-[#3a3a3a] hover:border-[#4a4a4a]'
              }`}
            >
              <div>
                <p className="text-sm text-white font-medium">{quality.label}</p>
                <p className="text-xs text-gray-500">{quality.description}</p>
              </div>
              {exportSettings.quality === quality.value && (
                <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Format */}
      <div className="bg-[#1e1e1e] rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Output Format</h3>
        <div className="grid grid-cols-3 gap-2">
          {FORMAT_OPTIONS.map((format) => (
            <button
              key={format.value}
              onClick={() =>
                updateExportSettings({
                  format: format.value as 'mp4' | 'mov' | 'avi',
                })
              }
              className={`p-3 rounded-lg border transition-all ${
                exportSettings.format === format.value
                  ? 'border-blue-500 bg-blue-500/20'
                  : 'border-[#3a3a3a] hover:border-[#4a4a4a]'
              }`}
            >
              <p className="text-sm text-white font-medium">{format.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{format.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Estimated Output */}
      <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
        <h4 className="text-sm font-medium text-purple-400 mb-2">Estimated Output</h4>
        <div className="text-sm text-gray-400 space-y-1">
          <p>Resolution: {exportSettings.quality === 'high' ? '1920x1080' : exportSettings.quality === 'optimised' ? '1280x720' : '854x480'}</p>
          <p>Format: {exportSettings.format.toUpperCase()}</p>
          <p>Aspect Ratio: {exportSettings.aspectRatio}</p>
        </div>
      </div>
    </div>
  );
}
