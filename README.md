# 🎬 Browser-Based Video Editor

A powerful online video editor built with Next.js frontend and Python FastAPI backend using MoviePy for video processing.

## Features

### Video Handling
- **Upload Support**: MP4, MOV, AVI formats
- **URL Import**: Add videos from external URLs
- **Drag & Drop**: Easy file upload with drag and drop

### Editing Capabilities
- **Trim & Select**: Select specific portions of videos using timeline controls
- **Multiple Clips**: Combine multiple video clips into a single output
- **Reorder Clips**: Drag and drop clips in the timeline to change sequence

### Effects
- **Speed Control**: Slow down (0.25x) or speed up (4x) video playback
- **Fade In/Out**: Add smooth fade transitions to clips
- **Text Overlays**: Add subtitles with customizable:
  - Font family
  - Font size
  - Color
  - Position
  - Timing
- **Image Overlays**: Overlay images on video with:
  - Shape masking (Circle, Rectangle, Square)
  - Percentage-based positioning
  - Custom sizing and timing
  - Shape mask images for circular overlays

### Audio
- **External Audio**: Add background music or audio tracks
- **Volume Control**: Adjust audio levels
- **Sync Control**: Set audio start time

### Export Options
- **Aspect Ratios**: 1:1 (Square), 16:9 (Landscape), 9:16 (Portrait)
- **Quality Levels**:
  - Low (480p) - Fast processing
  - Optimised (720p) - Balanced
  - High (1080p) - Best quality
- **Output Formats**: MP4, MOV, AVI

### Job Queue & Batch Processing
- **Multiple Tasks**: Queue multiple export jobs with sequential processing
- **Batch Export**: Create multiple exports with different settings at once
- **Progress Tracking**: Real-time progress updates with queue position
- **Processing Logs**: Detailed logs for each job with backend sync
- **Queue Management**:
  - Cancel pending jobs
  - Retry failed jobs
  - Clear completed jobs
  - View queue statistics
- **Quick Export Presets**: All qualities (HD/720p/480p), all aspect ratios

## Project Structure

```
├── frontend/                 # Next.js Frontend
│   ├── src/
│   │   ├── app/             # App router pages
│   │   ├── components/      # React components
│   │   │   ├── UploadScreen.tsx
│   │   │   ├── EditorScreen.tsx
│   │   │   ├── ProcessingScreen.tsx
│   │   │   ├── VideoPreview.tsx
│   │   │   ├── VideoLibrary.tsx
│   │   │   ├── Timeline.tsx
│   │   │   ├── EffectsPanel.tsx
│   │   │   ├── AudioPanel.tsx
│   │   │   └── ExportPanel.tsx
│   │   ├── store/           # Zustand state management
│   │   ├── lib/             # API utilities
│   │   └── types/           # TypeScript types
│   └── package.json
│
├── backend/                  # FastAPI Backend
│   ├── app/
│   │   ├── main.py          # FastAPI application
│   │   ├── models.py        # Pydantic models
│   │   ├── video_processor.py # MoviePy processing
│   │   └── job_queue.py     # Job queue management
│   ├── uploads/             # Uploaded files
│   ├── exports/             # Exported videos
│   ├── temp/                # Temporary files
│   └── requirements.txt
│
└── README.md
```

## Screens

### Screen 1: Upload
- Drag & drop zone for video files
- URL input for external videos
- Preview of uploaded videos
- Continue to editor button

### Screen 2: Editor
Three-panel layout:
- **Left Panel**: Video preview with trim controls
- **Middle Panel**: Video library (all uploaded videos)
- **Right Panel**: Effects, Audio, and Export settings
- **Bottom**: Timeline with drag-and-drop reordering

### Screen 3: Processing & Queue
- Export summary with batch options
- Job queue with status indicators and queue positions
- Real-time processing logs with backend synchronization
- Queue statistics dashboard (processing, queued, completed, failed)
- Job management: cancel, retry, clear completed
- Download completed exports

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.9+
- FFmpeg (required for MoviePy)

### Install FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**Windows:**
Download from https://ffmpeg.org/download.html

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:3000

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run server (option 1)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Or run server (option 2)
python run.py
```

Backend runs at http://localhost:8000

**Important**: Make sure FFmpeg is installed before running the backend, as MoviePy depends on it for video processing.

API docs available at http://localhost:8000/docs

## API Endpoints

### Upload
- `POST /api/upload` - Upload video file
- `POST /api/upload-url` - Upload from URL
- `POST /api/upload-audio` - Upload audio file

### Video Info
- `GET /api/video/{id}/info` - Get video metadata
- `POST /api/video/{id}/thumbnail` - Generate thumbnail

### Export & Queue
- `POST /api/export` - Start export job (supports text and image overlays)
- `GET /api/job/{id}` - Get job status
- `GET /api/jobs` - List all jobs with status sorting
- `GET /api/jobs/stats` - Get queue statistics
- `POST /api/job/{id}/cancel` - Cancel pending job
- `GET /api/download/{filename}` - Download exported video

## Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Drag & Drop**: @dnd-kit
- **File Upload**: react-dropzone
- **HTTP Client**: Axios

### Backend
- **Framework**: FastAPI
- **Video Processing**: MoviePy
- **Async File Handling**: aiofiles
- **HTTP Client**: httpx

## Demo Mode

The frontend works in demo mode if the backend is not running:
- Videos can still be uploaded (stored locally in browser)
- Export simulates progress
- Real video processing requires the backend

## Environment Variables

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## License

MIT
