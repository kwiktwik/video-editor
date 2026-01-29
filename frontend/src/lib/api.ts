import axios from 'axios';
import { ExportSettings, VideoClip, AudioTrack, ImageOverlay } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
});

// Helper to convert relative URLs to full URLs
export const getFullUrl = (path: string): string => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:')) {
    return path;
  }
  return `${API_BASE}${path}`;
};

export interface UploadResponse {
  id: string;
  filename: string;
  url: string;
  duration: number;
  thumbnail: string;
}

export interface ExportRequest {
  clips: {
    video_url: string;
    start_time: number;
    end_time: number;
    effects: {
      fade_in: number;
      fade_out: number;
      speed: number;
    };
    text_overlays: {
      text: string;
      font_family: string;
      font_size: number;
      color: string;
      position: { x: number; y: number };
      start_time: number;
      end_time: number;
    }[];
    image_overlays: {
      image_url: string;
      image_shape: string;
      shape_image_url?: string;
      percentage_width: number;
      percentage_from_top: number;
      percentage_from_start: number;
      start_time: number;
      end_time: number;
    }[];
  }[];
  audio_tracks: {
    url: string;
    volume: number;
    start_time: number;
  }[];
  settings: {
    aspect_ratio: string;
    quality: string;
    format: string;
  };
}

export interface JobStatusResponse {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  logs: string[];
  output_url?: string;
}

// Upload video file
export const uploadVideo = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post<UploadResponse>('/api/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total && onProgress) {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(progress);
      }
    },
  });

  return response.data;
};

// Upload video from URL
export const uploadVideoFromUrl = async (url: string): Promise<UploadResponse> => {
  const response = await api.post<UploadResponse>('/api/upload-url', { url });
  return response.data;
};

// Upload audio file
export const uploadAudio = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ id: string; filename: string; url: string }> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/api/upload-audio', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total && onProgress) {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(progress);
      }
    },
  });

  return response.data;
};

// Get video info
export const getVideoInfo = async (videoId: string): Promise<{
  duration: number;
  width: number;
  height: number;
  fps: number;
}> => {
  const response = await api.get(`/api/video/${videoId}/info`);
  return response.data;
};

// Generate thumbnail
export const generateThumbnail = async (
  videoId: string,
  time: number
): Promise<{ url: string }> => {
  const response = await api.post(`/api/video/${videoId}/thumbnail`, { time });
  return response.data;
};

// Helper to convert full URL back to relative path for backend
const urlToRelativePath = (url: string): string => {
  if (!url) return '';
  // If it's a blob URL, we can't use it - this shouldn't happen if backend is working
  if (url.startsWith('blob:')) {
    console.warn('Cannot use blob URL for export, file must be uploaded to backend');
    return url;
  }
  // Remove the API base to get relative path
  if (url.startsWith(API_BASE)) {
    return url.replace(API_BASE, '');
  }
  // If it's already a relative path or external URL, return as-is
  return url;
};

// Start export job
export const startExport = async (
  clips: VideoClip[],
  audioTracks: AudioTrack[],
  settings: ExportSettings,
  videoUrls: Record<string, string>
): Promise<{ job_id: string }> => {
  // Debug logging
  console.log('[Export] Video URLs map:', videoUrls);
  console.log('[Export] Clips:', clips);
  
  const request: ExportRequest = {
    clips: clips.map((clip) => {
      const originalUrl = videoUrls[clip.videoId];
      const resolvedUrl = urlToRelativePath(originalUrl);
      console.log(`[Export] Clip ${clip.id}: originalUrl=${originalUrl}, resolvedUrl=${resolvedUrl}`);
      
      return {
        video_url: resolvedUrl,
        start_time: clip.startTime,
        end_time: clip.endTime,
        track: clip.track,
        effects: {
          fade_in: clip.effects.fadeIn,
          fade_out: clip.effects.fadeOut,
          speed: clip.effects.speed,
        },
        text_overlays: clip.textOverlays.map((overlay) => ({
          text: overlay.text,
          font_family: overlay.fontFamily,
          font_size: overlay.fontSize,
          color: overlay.color,
          position: overlay.position,
          start_time: overlay.startTime,
          end_time: overlay.endTime,
        })),
        image_overlays: clip.imageOverlays.map((overlay) => ({
          image_url: overlay.imageUrl,
          image_shape: overlay.imageShape,
          shape_image_url: overlay.shapeImageUrl,
          percentage_width: overlay.percentageWidth,
          percentage_from_top: overlay.percentageFromTop,
          percentage_from_start: overlay.percentageFromStart,
          start_time: overlay.startTime,
          end_time: overlay.endTime,
        })),
      };
    }),
    audio_tracks: audioTracks.map((track) => ({
      url: urlToRelativePath(track.url),
      volume: track.volume,
      start_time: track.startTime,
    })),
    settings: {
      aspect_ratio: settings.aspectRatio,
      quality: settings.quality,
      format: settings.format,
    },
  };

  console.log('[Export] Final request:', JSON.stringify(request, null, 2));
  const response = await api.post('/api/export', request);
  return response.data;
};

// Get job status
export const getJobStatus = async (jobId: string): Promise<JobStatusResponse> => {
  const response = await api.get(`/api/job/${jobId}`);
  return response.data;
};

// Get all jobs
export const getAllJobs = async (): Promise<JobStatusResponse[]> => {
  const response = await api.get('/api/jobs');
  return response.data;
};

// Download exported video
export const getDownloadUrl = (jobId: string): string => {
  return `${API_BASE}/api/download/${jobId}`;
};

// Cancel job
export const cancelJob = async (jobId: string): Promise<void> => {
  await api.post(`/api/job/${jobId}/cancel`);
};

// Create overlay preview
export const createOverlayPreview = async (
  videoId: string,
  overlay: ImageOverlay
): Promise<{ preview_url: string }> => {
  const response = await api.post('/api/preview/overlay', {
    video_id: videoId,
    overlay: {
      image_url: overlay.imageUrl,
      image_shape: overlay.imageShape,
      percentage_width: overlay.percentageWidth,
      percentage_from_top: overlay.percentageFromTop,
      percentage_from_start: overlay.percentageFromStart,
      start_time: overlay.startTime,
      end_time: overlay.endTime,
    },
  });
  return response.data;
};

// Get job queue statistics
export const getJobStats = async (): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}> => {
  const response = await api.get('/api/jobs/stats');
  return response.data;
};

export default api;
