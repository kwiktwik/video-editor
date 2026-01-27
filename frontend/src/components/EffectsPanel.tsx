'use client';

import React, { useState } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { TextOverlay, ImageOverlay } from '@/types';
import { createOverlayPreview } from '@/lib/api';

interface EffectsPanelProps {
  selectedClipId: string | null;
  onSelectClip: (id: string | null) => void;
}

const FONT_FAMILIES = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Verdana',
  'Courier New',
  'Impact',
  'Comic Sans MS',
];

export default function EffectsPanel({ selectedClipId, onSelectClip }: EffectsPanelProps) {
  const {
    clips,
    updateClipEffects,
    addTextOverlay,
    updateTextOverlay,
    removeTextOverlay,
    addImageOverlay,
    updateImageOverlay,
    removeImageOverlay,
  } = useEditorStore();

  const selectedClip = clips.find((c) => c.id === selectedClipId);
  const [newOverlayText, setNewOverlayText] = useState('');
  const [newImageOverlayUrl, setNewImageOverlayUrl] = useState('');

  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [generatingPreview, setGeneratingPreview] = useState<string | null>(null);

  if (!selectedClip) {
    return (
      <div className="text-center text-gray-500 py-8">
        <svg className="w-12 h-12 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
        </svg>
        <p>Select a clip from the timeline</p>
        <p className="text-sm text-gray-600 mt-1">Click on any clip in the timeline below to edit its effects</p>
        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p className="text-xs text-blue-400">💡 Tip: Selected clips will have a blue border</p>
        </div>
      </div>
    );
  }

  const clipDuration = selectedClip.endTime - selectedClip.startTime;

  const handleAddTextOverlay = () => {
    if (!newOverlayText.trim()) return;

    addTextOverlay(selectedClip.id, {
      text: newOverlayText,
      fontFamily: 'Arial',
      fontSize: 32,
      color: '#ffffff',
      position: { x: 50, y: 90 },
      startTime: 0,
      endTime: clipDuration,
    });
    setNewOverlayText('');
  };

  const handleAddImageOverlay = () => {
    if (!newImageOverlayUrl.trim()) return;

    addImageOverlay(selectedClip.id, {
      imageUrl: newImageOverlayUrl,
      imageShape: 'RECTANGLE', // Default to rectangle
      percentageWidth: 30, // Default width percentage
      percentageFromTop: 20, // Default top position
      percentageFromStart: 35, // Default left position
      startTime: 0,
      endTime: clipDuration,
    });
    setNewImageOverlayUrl('');
  };

  const handleGeneratePreview = async (overlay: ImageOverlay) => {
    if (!selectedClip) return;

    console.log('[Preview] Starting preview generation for overlay:', overlay);
    console.log('[Preview] Selected clip videoId:', selectedClip.videoId);

    setGeneratingPreview(overlay.id);
    try {
      const result = await createOverlayPreview(selectedClip.videoId, overlay);
      console.log('[Preview] Preview generated successfully:', result);
      setPreviewUrls(prev => ({
        ...prev,
        [overlay.id]: result.preview_url
      }));
    } catch (error) {
      console.error('Failed to generate preview:', error);
      alert('Failed to generate preview. Please check your overlay settings.');
    } finally {
      setGeneratingPreview(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Clip Info */}
      <div className="bg-[#1e1e1e] rounded-lg p-4 border border-blue-500/30">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-sm font-medium text-gray-300">Selected Clip</h3>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" title="Currently selected"></div>
        </div>
        <p className="text-white truncate font-medium">{selectedClip.videoName}</p>
        <p className="text-gray-500 text-sm">
          {selectedClip.startTime.toFixed(1)}s - {selectedClip.endTime.toFixed(1)}s
          <span className="text-gray-400 ml-2">
            ({(selectedClip.endTime - selectedClip.startTime).toFixed(1)}s duration)
          </span>
        </p>
        <div className="mt-2 flex gap-2 text-xs">
          <span className="px-2 py-1 bg-gray-700 rounded text-gray-300">
            {selectedClip.textOverlays.length} text overlay{selectedClip.textOverlays.length !== 1 ? 's' : ''}
          </span>
          <span className="px-2 py-1 bg-gray-700 rounded text-gray-300">
            {selectedClip.imageOverlays.length} image overlay{selectedClip.imageOverlays.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Speed Control */}
      <div className="bg-[#1e1e1e] rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Playback Speed</h3>
        <div className="space-y-2">
          <input
            type="range"
            min={0.25}
            max={4}
            step={0.25}
            value={selectedClip.effects.speed}
            onChange={(e) =>
              updateClipEffects(selectedClip.id, { speed: parseFloat(e.target.value) })
            }
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>0.25x</span>
            <span className="text-blue-400 font-medium">{selectedClip.effects.speed}x</span>
            <span>4x</span>
          </div>
          <div className="flex gap-2 mt-2">
            {[0.5, 1, 1.5, 2].map((speed) => (
              <button
                key={speed}
                onClick={() => updateClipEffects(selectedClip.id, { speed })}
                className={`flex-1 py-1 rounded text-sm transition-colors ${
                  selectedClip.effects.speed === speed
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#2a2a2a] text-gray-400 hover:bg-[#3a3a3a]'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Fade Effects */}
      <div className="bg-[#1e1e1e] rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Fade Effects</h3>
        
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-gray-500">Fade In</label>
              <span className="text-xs text-blue-400">{selectedClip.effects.fadeIn}s</span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.min(5, clipDuration / 2)}
              step={0.1}
              value={selectedClip.effects.fadeIn}
              onChange={(e) =>
                updateClipEffects(selectedClip.id, { fadeIn: parseFloat(e.target.value) })
              }
              className="w-full"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-gray-500">Fade Out</label>
              <span className="text-xs text-purple-400">{selectedClip.effects.fadeOut}s</span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.min(5, clipDuration / 2)}
              step={0.1}
              value={selectedClip.effects.fadeOut}
              onChange={(e) =>
                updateClipEffects(selectedClip.id, { fadeOut: parseFloat(e.target.value) })
              }
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Text Overlays */}
      <div className="bg-[#1e1e1e] rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Text Overlays (Subtitles)</h3>
        
        {/* Add new overlay */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newOverlayText}
            onChange={(e) => setNewOverlayText(e.target.value)}
            placeholder="Enter text..."
            className="flex-1 bg-[#2a2a2a] border border-[#3a3a3a] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && handleAddTextOverlay()}
          />
          <button
            onClick={handleAddTextOverlay}
            disabled={!newOverlayText.trim()}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm transition-colors"
          >
            Add
          </button>
        </div>

        {/* Existing overlays */}
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {selectedClip.textOverlays.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-2">No text overlays</p>
          ) : (
            selectedClip.textOverlays.map((overlay) => (
              <div key={overlay.id} className="bg-[#2a2a2a] rounded-lg p-3 space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <input
                    type="text"
                    value={overlay.text}
                    onChange={(e) =>
                      updateTextOverlay(selectedClip.id, overlay.id, { text: e.target.value })
                    }
                    className="flex-1 bg-[#1e1e1e] border border-[#3a3a3a] rounded px-2 py-1 text-sm text-white"
                  />
                  <button
                    onClick={() => removeTextOverlay(selectedClip.id, overlay.id)}
                    className="p-1 text-gray-500 hover:text-red-500 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Font</label>
                    <select
                      value={overlay.fontFamily}
                      onChange={(e) =>
                        updateTextOverlay(selectedClip.id, overlay.id, {
                          fontFamily: e.target.value,
                        })
                      }
                      className="w-full bg-[#1e1e1e] border border-[#3a3a3a] rounded px-2 py-1 text-xs text-white"
                    >
                      {FONT_FAMILIES.map((font) => (
                        <option key={font} value={font}>
                          {font}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Size</label>
                    <input
                      type="number"
                      value={overlay.fontSize}
                      onChange={(e) =>
                        updateTextOverlay(selectedClip.id, overlay.id, {
                          fontSize: parseInt(e.target.value) || 24,
                        })
                      }
                      className="w-full bg-[#1e1e1e] border border-[#3a3a3a] rounded px-2 py-1 text-xs text-white"
                      min={12}
                      max={120}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Color</label>
                    <input
                      type="color"
                      value={overlay.color}
                      onChange={(e) =>
                        updateTextOverlay(selectedClip.id, overlay.id, { color: e.target.value })
                      }
                      className="w-full h-8 bg-[#1e1e1e] border border-[#3a3a3a] rounded cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Position Y</label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={overlay.position.y}
                      onChange={(e) =>
                        updateTextOverlay(selectedClip.id, overlay.id, {
                          position: { ...overlay.position, y: parseInt(e.target.value) },
                        })
                      }
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Start (s)</label>
                    <input
                      type="number"
                      value={overlay.startTime}
                      onChange={(e) =>
                        updateTextOverlay(selectedClip.id, overlay.id, {
                          startTime: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-[#1e1e1e] border border-[#3a3a3a] rounded px-2 py-1 text-xs text-white"
                      min={0}
                      max={clipDuration}
                      step={0.1}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">End (s)</label>
                    <input
                      type="number"
                      value={overlay.endTime}
                      onChange={(e) =>
                        updateTextOverlay(selectedClip.id, overlay.id, {
                          endTime: parseFloat(e.target.value) || clipDuration,
                        })
                      }
                      className="w-full bg-[#1e1e1e] border border-[#3a3a3a] rounded px-2 py-1 text-xs text-white"
                      min={0}
                      max={clipDuration}
                      step={0.1}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Image Overlays */}
      <div className="bg-[#1e1e1e] rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Image Overlays
        </h3>
        <p className="text-xs text-gray-500 mb-3">Add images that overlay on your video with custom positioning and masking</p>

        {/* Quick demo button */}
        <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <button
            onClick={() => {
              setNewImageOverlayUrl('https://picsum.photos/200/200');
            }}
            className="text-xs text-blue-400 hover:text-blue-300 underline"
          >
            Load demo image URL
          </button>
          <span className="text-xs text-gray-500 ml-2">(click to auto-fill with sample data)</span>
        </div>

        {/* Add new image overlay */}
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Image URL</label>
            <input
              type="url"
              value={newImageOverlayUrl}
              onChange={(e) => setNewImageOverlayUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full bg-[#2a2a2a] border border-[#3a3a3a] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            onClick={handleAddImageOverlay}
            disabled={!newImageOverlayUrl.trim()}
            className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Overlay
          </button>
        </div>

        {/* Existing image overlays */}
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {selectedClip.imageOverlays.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-2">No image overlays</p>
          ) : (
            selectedClip.imageOverlays.map((overlay) => (
              <div key={overlay.id} className="bg-[#2a2a2a] rounded-lg p-3 space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1">
                    <img
                      src={overlay.imageUrl}
                      alt="Overlay preview"
                      className="w-16 h-16 object-cover rounded mb-2"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <input
                      type="url"
                      value={overlay.imageUrl}
                      onChange={(e) =>
                        updateImageOverlay(selectedClip.id, overlay.id, { imageUrl: e.target.value })
                      }
                      className="w-full bg-[#1e1e1e] border border-[#3a3a3a] rounded px-2 py-1 text-xs text-white"
                      placeholder="Image URL"
                    />
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleGeneratePreview(overlay)}
                      disabled={generatingPreview === overlay.id}
                      className="p-1 text-gray-500 hover:text-blue-500 transition-colors disabled:opacity-50"
                      title="Generate preview"
                    >
                      {generatingPreview === overlay.id ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => removeImageOverlay(selectedClip.id, overlay.id)}
                      className="p-1 text-gray-500 hover:text-red-500 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Width %</label>
                  <input
                    type="text"
                    value={overlay.percentageWidth}
                    onChange={(e) =>
                      updateImageOverlay(selectedClip.id, overlay.id, {
                        percentageWidth: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-[#1e1e1e] border border-[#3a3a3a] rounded px-2 py-1 text-xs text-white"
                    placeholder="30"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">From Top %</label>
                    <input
                      type="text"
                      value={overlay.percentageFromTop}
                      onChange={(e) =>
                        updateImageOverlay(selectedClip.id, overlay.id, {
                          percentageFromTop: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-[#1e1e1e] border border-[#3a3a3a] rounded px-2 py-1 text-xs text-white"
                      placeholder="20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">From Start %</label>
                    <input
                      type="text"
                      value={overlay.percentageFromStart}
                      onChange={(e) =>
                        updateImageOverlay(selectedClip.id, overlay.id, {
                          percentageFromStart: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-[#1e1e1e] border border-[#3a3a3a] rounded px-2 py-1 text-xs text-white"
                      placeholder="35"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Start (s)</label>
                    <input
                      type="text"
                      value={overlay.startTime}
                      onChange={(e) =>
                        updateImageOverlay(selectedClip.id, overlay.id, {
                          startTime: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-[#1e1e1e] border border-[#3a3a3a] rounded px-2 py-1 text-xs text-white"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">End (s)</label>
                    <input
                      type="text"
                      value={overlay.endTime}
                      onChange={(e) =>
                        updateImageOverlay(selectedClip.id, overlay.id, {
                          endTime: parseFloat(e.target.value) || clipDuration,
                        })
                      }
                      className="w-full bg-[#1e1e1e] border border-[#3a3a3a] rounded px-2 py-1 text-xs text-white"
                      placeholder={clipDuration.toFixed(1)}
                    />
                  </div>
                </div>



                {/* Preview */}
                {previewUrls[overlay.id] && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-500 mb-2">Preview:</p>
                    <div className="relative">
                      <img
                        src={previewUrls[overlay.id]}
                        alt="Overlay preview"
                        className="w-full max-w-xs rounded border border-gray-600"
                      />
                      <div className="absolute top-1 right-1 bg-black/70 text-white text-xs px-2 py-1 rounded">
                        Preview
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
