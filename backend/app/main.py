import os
import uuid
import asyncio
import aiofiles
from datetime import datetime
from typing import List
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .models import (
    ExportRequest,
    UploadResponse,
    VideoUrlRequest,
    ThumbnailRequest,
    JobStatusResponse,
    JobStatus,
)
from .video_processor import get_processor
from .job_queue import get_job_queue


# Directory setup
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
EXPORTS_DIR = os.path.join(BASE_DIR, "exports")
TEMP_DIR = os.path.join(BASE_DIR, "temp")

print(f"[STARTUP] BASE_DIR: {BASE_DIR}")
print(f"[STARTUP] UPLOADS_DIR: {UPLOADS_DIR}")
print(f"[STARTUP] EXPORTS_DIR: {EXPORTS_DIR}")
print(f"[STARTUP] TEMP_DIR: {TEMP_DIR}")

for dir_path in [UPLOADS_DIR, EXPORTS_DIR, TEMP_DIR]:
    os.makedirs(dir_path, exist_ok=True)
    print(f"[STARTUP] Directory {dir_path} exists: {os.path.exists(dir_path)}")


def url_to_filepath(url: str) -> str:
    """Convert a URL path to an actual file system path"""
    print(f"[DEBUG] url_to_filepath input: {url}")
    
    result = url  # default
    
    if not url:
        print(f"[DEBUG] Empty URL")
        return ""
    
    # Handle full URLs by extracting the path
    if url.startswith("http://") or url.startswith("https://"):
        # Extract path from full URL (e.g., http://localhost:8000/static/uploads/file.mp4 -> /static/uploads/file.mp4)
        from urllib.parse import urlparse
        parsed = urlparse(url)
        url = parsed.path
        print(f"[DEBUG] Extracted path from URL: {url}")
    
    if url.startswith("/static/uploads/"):
        filename = url.replace("/static/uploads/", "")
        result = os.path.join(UPLOADS_DIR, filename)
    elif url.startswith("/static/exports/"):
        filename = url.replace("/static/exports/", "")
        result = os.path.join(EXPORTS_DIR, filename)
    elif url.startswith("/static/temp/"):
        filename = url.replace("/static/temp/", "")
        result = os.path.join(TEMP_DIR, filename)
    elif os.path.isabs(url):
        # Already an absolute path
        result = url
    else:
        # Assume it's just a filename in uploads
        result = os.path.join(UPLOADS_DIR, os.path.basename(url))
    
    print(f"[DEBUG] url_to_filepath output: {result}")
    print(f"[DEBUG] File exists: {os.path.exists(result)}")
    
    return result


# Background job processor
async def process_jobs():
    """Background task to process jobs from queue"""
    print("[JobProcessor] Background job processor started!")
    job_queue = get_job_queue()
    processor = get_processor()
    
    while True:
        try:
            print("[JobProcessor] Checking for pending jobs...")
            job = job_queue.get_next_job()
            
            if job:
                print(f"[JobProcessor] Found job: {job.id}")
                job_queue.update_job(job.id, status=JobStatus.PROCESSING)
                job_queue.add_log(job.id, "Starting processing...")
                
                def log_callback(msg: str):
                    job_queue.add_log(job.id, msg)
                    print(f"[Job {job.id}] {msg}")
                
                def progress_callback(progress: float):
                    job_queue.set_progress(job.id, progress)
                
                try:
                    # Run the export in a thread pool to not block the event loop
                    import concurrent.futures
                    loop = asyncio.get_event_loop()
                    
                    def run_export():
                        import asyncio
                        # Create a new event loop for this thread
                        new_loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(new_loop)
                        try:
                            return new_loop.run_until_complete(
                                processor.process_export(
                                    job=job,
                                    clips_requests=job.request.clips,
                                    audio_tracks=job.request.audio_tracks,
                                    settings=job.request.settings,
                                    log_callback=log_callback,
                                    progress_callback=progress_callback,
                                    url_resolver=url_to_filepath,
                                )
                            )
                        finally:
                            new_loop.close()
                    
                    with concurrent.futures.ThreadPoolExecutor() as pool:
                        output_url = await loop.run_in_executor(pool, run_export)
                    
                    job_queue.complete_job(job.id, output_url)
                    print(f"[JobProcessor] Job {job.id} completed successfully")
                except Exception as e:
                    import traceback
                    traceback.print_exc()
                    job_queue.fail_job(job.id, str(e))
                    print(f"[JobProcessor] Job {job.id} failed: {e}")
            else:
                await asyncio.sleep(1)  # Wait before checking again
        except Exception as e:
            print(f"[JobProcessor] Error: {e}")
            import traceback
            traceback.print_exc()
            await asyncio.sleep(5)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start background job processor
    print("[Lifespan] Starting background job processor...")
    task = asyncio.create_task(process_jobs())
    print("[Lifespan] Background job processor task created")
    yield
    # Shutdown: Cancel background task
    print("[Lifespan] Shutting down background job processor...")
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        print("[Lifespan] Background job processor cancelled")
        pass


# Create FastAPI app
app = FastAPI(
    title="Video Editor API",
    description="Backend API for browser-based video editor",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file serving for uploads, exports and temp
app.mount("/static/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")
app.mount("/static/exports", StaticFiles(directory=EXPORTS_DIR), name="exports")
app.mount("/static/temp", StaticFiles(directory=TEMP_DIR), name="temp")


@app.get("/")
async def root():
    return {"message": "Video Editor API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/api/debug/files")
async def debug_files():
    """Debug endpoint to list all uploaded files"""
    uploads = os.listdir(UPLOADS_DIR) if os.path.exists(UPLOADS_DIR) else []
    exports = os.listdir(EXPORTS_DIR) if os.path.exists(EXPORTS_DIR) else []
    temp = os.listdir(TEMP_DIR) if os.path.exists(TEMP_DIR) else []
    return {
        "uploads_dir": UPLOADS_DIR,
        "exports_dir": EXPORTS_DIR,
        "temp_dir": TEMP_DIR,
        "uploads": uploads,
        "exports": exports,
        "temp": temp,
    }


# ============ Upload Endpoints ============

@app.post("/api/upload", response_model=UploadResponse)
async def upload_video(file: UploadFile = File(...)):
    """Upload a video file"""
    # Validate file type
    allowed_types = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/avi"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Invalid file type: {file.content_type}. Allowed: MP4, MOV, AVI")
    
    # Generate unique filename
    ext = os.path.splitext(file.filename)[1] or ".mp4"
    file_id = uuid.uuid4().hex[:12]
    filename = f"{file_id}{ext}"
    file_path = os.path.join(UPLOADS_DIR, filename)
    
    # Save file
    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)
    
    # Get video info
    processor = get_processor()
    try:
        info = processor.get_video_info(file_path)
        
        # Generate thumbnail
        thumb_filename = f"{file_id}_thumb.jpg"
        thumb_path = os.path.join(TEMP_DIR, thumb_filename)
        processor.generate_thumbnail(file_path, time=0, output_path=thumb_path)
        
        return UploadResponse(
            id=file_id,
            filename=file.filename,
            url=f"/static/uploads/{filename}",
            duration=info["duration"],
            thumbnail=f"/static/temp/{thumb_filename}",
        )
    except Exception as e:
        # Clean up on error
        if os.path.exists(file_path):
            os.remove(file_path)
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to process video: {str(e)}")


@app.post("/api/upload-url", response_model=UploadResponse)
async def upload_from_url(request: VideoUrlRequest):
    """Upload video from URL"""
    import httpx
    
    try:
        # Download video from URL
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(request.url, follow_redirects=True)
            response.raise_for_status()
        
        # Determine file extension
        content_type = response.headers.get("content-type", "")
        if "mp4" in content_type or request.url.endswith(".mp4"):
            ext = ".mp4"
        elif "quicktime" in content_type or request.url.endswith(".mov"):
            ext = ".mov"
        elif "avi" in content_type or request.url.endswith(".avi"):
            ext = ".avi"
        else:
            ext = ".mp4"  # Default
        
        # Save file
        file_id = uuid.uuid4().hex[:12]
        filename = f"{file_id}{ext}"
        file_path = os.path.join(UPLOADS_DIR, filename)
        
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(response.content)
        
        # Get video info
        processor = get_processor()
        info = processor.get_video_info(file_path)
        
        # Generate thumbnail
        thumb_filename = f"{file_id}_thumb.jpg"
        thumb_path = os.path.join(TEMP_DIR, thumb_filename)
        processor.generate_thumbnail(file_path, time=0, output_path=thumb_path)
        
        return UploadResponse(
            id=file_id,
            filename=os.path.basename(request.url),
            url=f"/static/uploads/{filename}",
            duration=info["duration"],
            thumbnail=f"/static/temp/{thumb_filename}",
        )
    except httpx.HTTPError as e:
        raise HTTPException(status_code=400, detail=f"Failed to download video: {str(e)}")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to process video: {str(e)}")


@app.post("/api/upload-audio")
async def upload_audio(file: UploadFile = File(...)):
    """Upload an audio file"""
    allowed_types = ["audio/mpeg", "audio/wav", "audio/mp4", "audio/aac", "audio/ogg", "audio/x-m4a"]
    
    # Generate unique filename
    ext = os.path.splitext(file.filename)[1]
    file_id = uuid.uuid4().hex[:12]
    filename = f"{file_id}{ext}"
    file_path = os.path.join(UPLOADS_DIR, filename)
    
    # Save file
    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)
    
    return {
        "id": file_id,
        "filename": file.filename,
        "url": f"/static/uploads/{filename}",
    }


# ============ Video Info Endpoints ============

@app.get("/api/video/{video_id}/info")
async def get_video_info(video_id: str):
    """Get video metadata"""
    # Find the video file
    for ext in [".mp4", ".mov", ".avi"]:
        file_path = os.path.join(UPLOADS_DIR, f"{video_id}{ext}")
        if os.path.exists(file_path):
            processor = get_processor()
            info = processor.get_video_info(file_path)
            return info
    
    raise HTTPException(status_code=404, detail="Video not found")


@app.post("/api/video/{video_id}/thumbnail")
async def generate_thumbnail(video_id: str, request: ThumbnailRequest):
    """Generate thumbnail at specific time"""
    # Find the video file
    for ext in [".mp4", ".mov", ".avi"]:
        file_path = os.path.join(UPLOADS_DIR, f"{video_id}{ext}")
        if os.path.exists(file_path):
            processor = get_processor()
            thumb_filename = f"{video_id}_thumb_{int(request.time * 1000)}.jpg"
            thumb_path = os.path.join(TEMP_DIR, thumb_filename)
            processor.generate_thumbnail(file_path, request.time, thumb_path)
            return {"url": f"/static/temp/{thumb_filename}"}
    
    raise HTTPException(status_code=404, detail="Video not found")


# ============ Export Endpoints ============

@app.post("/api/export")
async def start_export(request: ExportRequest):
    """Start a video export job"""
    print(f"[DEBUG] Export request received:")
    print(f"[DEBUG] Number of clips: {len(request.clips)}")
    for i, clip in enumerate(request.clips):
        print(f"[DEBUG] Clip {i}: video_url={clip.video_url}")
        resolved = url_to_filepath(clip.video_url)
        print(f"[DEBUG] Clip {i}: resolved_path={resolved}")
    
    job_queue = get_job_queue()
    job = job_queue.create_job(request)
    return {"job_id": job.id}


@app.get("/api/job/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """Get job status and logs"""
    job_queue = get_job_queue()
    job = job_queue.get_job(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return JobStatusResponse(
        id=job.id,
        status=job.status.value,
        progress=job.progress,
        logs=job.logs,
        output_url=job.output_url,
    )


@app.get("/api/jobs")
async def get_all_jobs():
    """Get all jobs"""
    job_queue = get_job_queue()
    jobs = job_queue.get_all_jobs()
    return [
        JobStatusResponse(
            id=job.id,
            status=job.status.value,
            progress=job.progress,
            logs=job.logs,
            output_url=job.output_url,
        )
        for job in jobs
    ]


@app.get("/api/jobs/stats")
async def get_job_stats():
    """Get job queue statistics"""
    job_queue = get_job_queue()
    return job_queue.get_queue_stats()


@app.post("/api/job/{job_id}/cancel")
async def cancel_job(job_id: str):
    """Cancel a pending job"""
    job_queue = get_job_queue()
    job = job_queue.get_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status != JobStatus.PENDING:
        raise HTTPException(status_code=400, detail="Can only cancel pending jobs")

    job_queue.cancel_job(job_id)
    return {"message": "Job cancelled"}


@app.post("/api/preview/overlay")
async def create_overlay_preview(request: dict):
    """Create a preview image showing overlay on video thumbnail"""
    try:
        print(f"[Preview API] Received request: {request}")
        overlay_data = request.get("overlay", {})
        video_id = request.get("video_id")

        print(f"[Preview API] overlay_data: {overlay_data}")
        print(f"[Preview API] video_id: {video_id}")

        if not overlay_data or not video_id:
            raise HTTPException(status_code=400, detail="Missing overlay data or video_id")

        # Find the video file
        for ext in [".mp4", ".mov", ".avi"]:
            video_path = os.path.join(UPLOADS_DIR, f"{video_id}{ext}")
            if os.path.exists(video_path):
                print(f"[Preview API] Found video file: {video_path}")
                break
        else:
            raise HTTPException(status_code=404, detail="Video not found")

        # Generate thumbnail if it doesn't exist
        thumb_path = os.path.join(TEMP_DIR, f"{video_id}_thumb.jpg")
        if not os.path.exists(thumb_path):
            print(f"[Preview API] Generating thumbnail: {thumb_path}")
            processor = get_processor()
            processor.generate_thumbnail(video_path, time=1, output_path=thumb_path)
        else:
            print(f"[Preview API] Thumbnail already exists: {thumb_path}")

        # Create overlay preview
        print(f"[Preview API] Creating overlay preview...")
        processor = get_processor()
        preview_path = processor.create_image_overlay_preview(overlay_data, thumb_path)
        print(f"[Preview API] Preview created: {preview_path}")

        # Return the preview URL
        preview_filename = os.path.basename(preview_path)
        result = {"preview_url": f"/static/temp/{preview_filename}"}
        print(f"[Preview API] Returning result: {result}")
        return result

    except Exception as e:
        import traceback
        print(f"[Preview API] Error: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create overlay preview: {str(e)}")


@app.get("/api/download/{filename}")
async def download_export(filename: str):
    """Download exported video"""
    file_path = os.path.join(EXPORTS_DIR, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        file_path,
        media_type="video/mp4",
        filename=filename,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
