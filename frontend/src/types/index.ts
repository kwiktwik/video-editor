export interface VideoFile {
  id: string;
  name: string;
  url: string;
  duration: number;
  type: 'local' | 'url';
  thumbnail?: string;
  file?: File;
}

export interface VideoClip {
  id: string;
  videoId: string;
  videoName: string;
  startTime: number;
  endTime: number;
  thumbnail?: string;
  effects: ClipEffects;
  textOverlays: TextOverlay[];
  imageOverlays: ImageOverlay[];
}

export interface ClipEffects {
  fadeIn: number;
  fadeOut: number;
  speed: number;
}

export interface TextOverlay {
  id: string;
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  position: { x: number; y: number };
  startTime: number;
  endTime: number;
}

export interface ImageOverlay {
  id: string;
  imageUrl: string;
  imageShape: 'CIRCLE' | 'RECTANGLE' | 'SQUARE';
  percentageWidth: number;
  percentageFromTop: number;
  percentageFromStart: number;
  startTime: number;
  endTime: number;
}

export interface AudioTrack {
  id: string;
  name: string;
  url: string;
  file?: File;
  volume: number;
  startTime: number;
}

export interface ExportSettings {
  aspectRatio: '1:1' | '16:9' | '9:16';
  quality: 'low' | 'optimised' | 'high';
  format: 'mp4' | 'mov' | 'avi';
}

export interface Job {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  logs: string[];
  createdAt: Date;
  completedAt?: Date;
  outputUrl?: string;
  settings: ExportSettings;
}

export type Screen = 'upload' | 'editor' | 'processing';

export interface EditorState {
  screen: Screen;
  videos: VideoFile[];
  clips: VideoClip[];
  currentVideoId: string | null;
  audioTracks: AudioTrack[];
  exportSettings: ExportSettings;
  jobs: Job[];
  currentJobId: string | null;
}
