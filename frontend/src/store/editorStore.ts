import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  EditorState,
  VideoFile,
  VideoClip,
  AudioTrack,
  TextOverlay,
  ImageOverlay,
  ExportSettings,
  Job,
  Screen,
  ClipEffects,
} from '@/types';

interface EditorActions {
  // Screen navigation
  setScreen: (screen: Screen) => void;
  
  // Video management
  addVideo: (video: Omit<VideoFile, 'id'>) => string;
  removeVideo: (id: string) => void;
  setCurrentVideo: (id: string | null) => void;
  
  // Clip management
  addClip: (clip: Omit<VideoClip, 'id'>) => string;
  updateClip: (id: string, updates: Partial<VideoClip>) => void;
  removeClip: (id: string) => void;
  reorderClips: (clips: VideoClip[]) => void;
  
  // Effects
  updateClipEffects: (clipId: string, effects: Partial<ClipEffects>) => void;
  
  // Text overlays
  addTextOverlay: (clipId: string, overlay: Omit<TextOverlay, 'id'>) => void;
  updateTextOverlay: (clipId: string, overlayId: string, updates: Partial<TextOverlay>) => void;
  removeTextOverlay: (clipId: string, overlayId: string) => void;

  // Image overlays
  addImageOverlay: (clipId: string, overlay: Omit<ImageOverlay, 'id'>) => void;
  updateImageOverlay: (clipId: string, overlayId: string, updates: Partial<ImageOverlay>) => void;
  removeImageOverlay: (clipId: string, overlayId: string) => void;
  
  // Audio
  addAudioTrack: (audio: Omit<AudioTrack, 'id'>) => string;
  updateAudioTrack: (id: string, updates: Partial<AudioTrack>) => void;
  removeAudioTrack: (id: string) => void;
  
  // Export settings
  updateExportSettings: (settings: Partial<ExportSettings>) => void;
  
  // Jobs
  addJob: (settings: ExportSettings) => string;
  updateJob: (id: string, updates: Partial<Job>) => void;
  removeJob: (id: string) => void;
  setCurrentJob: (id: string | null) => void;
  addJobLog: (jobId: string, log: string) => void;
  
  // Reset
  reset: () => void;
}

const initialState: EditorState = {
  screen: 'upload',
  videos: [],
  clips: [],
  currentVideoId: null,
  audioTracks: [],
  exportSettings: {
    aspectRatio: '16:9',
    quality: 'optimised',
    format: 'mp4',
  },
  jobs: [],
  currentJobId: null,
};

export const useEditorStore = create<EditorState & EditorActions>((set, get) => ({
  ...initialState,

  setScreen: (screen) => set({ screen }),

  addVideo: (video) => {
    const id = uuidv4();
    set((state) => ({
      videos: [...state.videos, { ...video, id }],
    }));
    return id;
  },

  removeVideo: (id) =>
    set((state) => ({
      videos: state.videos.filter((v) => v.id !== id),
      clips: state.clips.filter((c) => c.videoId !== id),
      currentVideoId: state.currentVideoId === id ? null : state.currentVideoId,
    })),

  setCurrentVideo: (id) => set({ currentVideoId: id }),

  addClip: (clip) => {
    const id = uuidv4();
    set((state) => ({
      clips: [...state.clips, { ...clip, id, imageOverlays: [] }],
    }));
    return id;
  },

  updateClip: (id, updates) =>
    set((state) => ({
      clips: state.clips.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),

  removeClip: (id) =>
    set((state) => ({
      clips: state.clips.filter((c) => c.id !== id),
    })),

  reorderClips: (clips) => set({ clips }),

  updateClipEffects: (clipId, effects) =>
    set((state) => ({
      clips: state.clips.map((c) =>
        c.id === clipId ? { ...c, effects: { ...c.effects, ...effects } } : c
      ),
    })),

  addTextOverlay: (clipId, overlay) => {
    const id = uuidv4();
    set((state) => ({
      clips: state.clips.map((c) =>
        c.id === clipId
          ? { ...c, textOverlays: [...c.textOverlays, { ...overlay, id }] }
          : c
      ),
    }));
  },

  updateTextOverlay: (clipId, overlayId, updates) =>
    set((state) => ({
      clips: state.clips.map((c) =>
        c.id === clipId
          ? {
              ...c,
              textOverlays: c.textOverlays.map((o) =>
                o.id === overlayId ? { ...o, ...updates } : o
              ),
            }
          : c
      ),
    })),

  removeTextOverlay: (clipId, overlayId) =>
    set((state) => ({
      clips: state.clips.map((c) =>
        c.id === clipId
          ? { ...c, textOverlays: c.textOverlays.filter((o) => o.id !== overlayId) }
          : c
      ),
    })),

  addImageOverlay: (clipId, overlay) => {
    const id = uuidv4();
    set((state) => ({
      clips: state.clips.map((c) =>
        c.id === clipId
          ? { ...c, imageOverlays: [...c.imageOverlays, { ...overlay, id }] }
          : c
      ),
    }));
  },

  updateImageOverlay: (clipId, overlayId, updates) =>
    set((state) => ({
      clips: state.clips.map((c) =>
        c.id === clipId
          ? {
              ...c,
              imageOverlays: c.imageOverlays.map((o) =>
                o.id === overlayId ? { ...o, ...updates } : o
              ),
            }
          : c
      ),
    })),

  removeImageOverlay: (clipId, overlayId) =>
    set((state) => ({
      clips: state.clips.map((c) =>
        c.id === clipId
          ? { ...c, imageOverlays: c.imageOverlays.filter((o) => o.id !== overlayId) }
          : c
      ),
    })),

  addAudioTrack: (audio) => {
    const id = uuidv4();
    set((state) => ({
      audioTracks: [...state.audioTracks, { ...audio, id }],
    }));
    return id;
  },

  updateAudioTrack: (id, updates) =>
    set((state) => ({
      audioTracks: state.audioTracks.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
    })),

  removeAudioTrack: (id) =>
    set((state) => ({
      audioTracks: state.audioTracks.filter((a) => a.id !== id),
    })),

  updateExportSettings: (settings) =>
    set((state) => ({
      exportSettings: { ...state.exportSettings, ...settings },
    })),

  addJob: (settings) => {
    const id = uuidv4();
    const job: Job = {
      id,
      status: 'pending',
      progress: 0,
      logs: [],
      createdAt: new Date(),
      settings,
    };
    set((state) => ({
      jobs: [...state.jobs, job],
    }));
    return id;
  },

  updateJob: (id, updates) =>
    set((state) => ({
      jobs: state.jobs.map((j) => (j.id === id ? { ...j, ...updates } : j)),
    })),

  removeJob: (id) =>
    set((state) => ({
      jobs: state.jobs.filter((j) => j.id !== id),
      currentJobId: state.currentJobId === id ? null : state.currentJobId,
    })),

  setCurrentJob: (id) => set({ currentJobId: id }),

  addJobLog: (jobId, log) =>
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === jobId ? { ...j, logs: [...j.logs, `[${new Date().toISOString()}] ${log}`] } : j
      ),
    })),

  reset: () => set(initialState),
}));
