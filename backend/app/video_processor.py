import os
import uuid
import asyncio
import requests
import io
from typing import List, Callable, Optional
from datetime import datetime

# Fix for Pillow 10+ compatibility with MoviePy
from PIL import Image, ImageDraw
if not hasattr(Image, 'ANTIALIAS'):
    Image.ANTIALIAS = Image.Resampling.LANCZOS

from moviepy.editor import (
    VideoFileClip,
    AudioFileClip,
    CompositeVideoClip,
    CompositeAudioClip,
    TextClip,
    ImageClip,
    concatenate_videoclips,
    vfx,
)
from moviepy.video.fx.all import fadein, fadeout, speedx
import numpy as np

from .models import ClipRequest, AudioTrackRequest, ExportSettings, Job, JobStatus


# Quality settings mapping
QUALITY_SETTINGS = {
    "low": {"width": 854, "height": 480, "bitrate": "1000k", "fps": 24},
    "optimised": {"width": 1280, "height": 720, "bitrate": "2500k", "fps": 30},
    "high": {"width": 1920, "height": 1080, "bitrate": "5000k", "fps": 30},
}

# Aspect ratio dimensions
ASPECT_RATIOS = {
    "16:9": (16, 9),
    "9:16": (9, 16),
    "1:1": (1, 1),
}


class VideoProcessor:
    def __init__(self, uploads_dir: str, exports_dir: str, temp_dir: str):
        self.uploads_dir = uploads_dir
        self.exports_dir = exports_dir
        self.temp_dir = temp_dir
        os.makedirs(uploads_dir, exist_ok=True)
        os.makedirs(exports_dir, exist_ok=True)
        os.makedirs(temp_dir, exist_ok=True)

    def download_image(self, url: str, filename: str = None) -> str:
        """Download image from URL and return local path"""
        if filename is None:
            filename = f"overlay_{uuid.uuid4().hex[:8]}.png"

        local_path = os.path.join(self.temp_dir, filename)

        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()

            with open(local_path, 'wb') as f:
                f.write(response.content)

            return local_path
        except Exception as e:
            raise Exception(f"Failed to download image from {url}: {str(e)}")

    def process_overlay_image(self, image_path: str, max_width: int = 400, max_height: int = 400) -> str:
        """Process overlay image - resize if too large while maintaining aspect ratio"""
        try:
            # Open the overlay image
            overlay_image = Image.open(image_path).convert("RGBA")

            # Check if image needs resizing
            if overlay_image.width > max_width or overlay_image.height > max_height:
                # Calculate scaling factor
                width_ratio = max_width / overlay_image.width
                height_ratio = max_height / overlay_image.height
                scale_factor = min(width_ratio, height_ratio)

                # Calculate new dimensions
                new_width = int(overlay_image.width * scale_factor)
                new_height = int(overlay_image.height * scale_factor)

                # Resize image
                overlay_image = overlay_image.resize((new_width, new_height), Image.Resampling.LANCZOS)

            # Save processed image
            processed_path = os.path.join(self.temp_dir, f"processed_{uuid.uuid4().hex[:8]}.png")
            overlay_image.save(processed_path, "PNG")

            return processed_path
        except Exception as e:
            raise Exception(f"Failed to process overlay image: {str(e)}")

    def create_image_overlay_preview(self, overlay, video_thumbnail_path: str, log_callback: Callable[[str], None] = None) -> str:
        """Create a preview image showing overlay on video thumbnail"""
        def log(msg: str):
            if log_callback:
                log_callback(msg)

        try:
            # Process the overlay image
            image_path = self.download_image(overlay.image_url)
            image_path = self.process_overlay_image(image_path)
            log(f"Processed overlay image: {overlay.image_url}")

            # Open the processed overlay image
            overlay_image = Image.open(image_path).convert("RGBA")

            # Open video thumbnail
            video_thumb = Image.open(video_thumbnail_path).convert("RGBA")

            # Resize overlay according to percentage values relative to video thumbnail
            overlay_width = int((overlay.percentage_width / 100) * video_thumb.width)
            overlay_height = overlay_width  # Maintain aspect ratio

            overlay_image = overlay_image.resize((overlay_width, overlay_height), Image.Resampling.LANCZOS)

            # Calculate position
            x_pos = int((overlay.percentage_from_start / 100) * video_thumb.width)
            y_pos = int((overlay.percentage_from_top / 100) * video_thumb.height)

            # Create composite image
            preview_image = video_thumb.copy()
            preview_image.paste(overlay_image, (x_pos, y_pos), overlay_image)

            # Save preview
            preview_path = os.path.join(self.temp_dir, f"preview_{uuid.uuid4().hex[:8]}.png")
            preview_image.save(preview_path, "PNG")

            return preview_path
        except Exception as e:
            log(f"Failed to create overlay preview: {str(e)}")
            raise

    def create_image_overlay_clip(self, overlay, video_width: int, video_height: int, log_callback: Callable[[str], None] = None) -> ImageClip:
        """Create an ImageClip for overlay"""
        def log(msg: str):
            if log_callback:
                log_callback(msg)

        try:
            # Download and process the overlay image
            image_path = self.download_image(overlay.image_url)
            image_path = self.process_overlay_image(image_path)
            log(f"Processed overlay image: {overlay.image_url}")

            # Calculate overlay dimensions and position
            overlay_width = int((overlay.percentage_width / 100) * video_width)
            overlay_height = overlay_width  # Assume square for now, adjust if needed

            # Calculate position
            x_pos = int((overlay.percentage_from_start / 100) * video_width)
            y_pos = int((overlay.percentage_from_top / 100) * video_height)

            # Create ImageClip
            img_clip = ImageClip(image_path, duration=overlay.end_time - overlay.start_time)
            img_clip = img_clip.resize(width=overlay_width)

            # Set position and timing
            img_clip = img_clip.set_position((x_pos, y_pos))
            img_clip = img_clip.set_start(overlay.start_time)

            return img_clip
        except Exception as e:
            log(f"Failed to create image overlay: {str(e)}")
            raise

    def get_video_info(self, video_path: str) -> dict:
        """Get video metadata"""
        try:
            clip = VideoFileClip(video_path)
            info = {
                "duration": clip.duration,
                "width": clip.w,
                "height": clip.h,
                "fps": clip.fps,
            }
            clip.close()
            return info
        except Exception as e:
            raise Exception(f"Failed to get video info: {str(e)}")

    def generate_thumbnail(self, video_path: str, time: float = 0, output_path: str = None) -> str:
        """Generate a thumbnail from video at specified time"""
        try:
            clip = VideoFileClip(video_path)
            
            # Ensure time is within video duration
            time = min(time, clip.duration - 0.1)
            time = max(time, 0)
            
            # Get frame at specified time
            frame = clip.get_frame(time)
            
            # Convert to PIL Image and save
            img = Image.fromarray(frame)
            img.thumbnail((320, 180))  # Resize for thumbnail
            
            if output_path is None:
                output_path = os.path.join(
                    self.temp_dir, f"thumb_{uuid.uuid4().hex[:8]}.jpg"
                )
            
            img.save(output_path, "JPEG", quality=85)
            clip.close()
            
            return output_path
        except Exception as e:
            raise Exception(f"Failed to generate thumbnail: {str(e)}")

    def resize_to_aspect_ratio(self, clip: VideoFileClip, aspect_ratio: str, quality: str) -> VideoFileClip:
        """Resize video to target aspect ratio with letterboxing/pillarboxing"""
        from moviepy.editor import ColorClip, CompositeVideoClip
        
        quality_settings = QUALITY_SETTINGS[quality]
        
        # Calculate target dimensions based on aspect ratio
        if aspect_ratio == "16:9":
            target_width = quality_settings["width"]
            target_height = quality_settings["height"]
        elif aspect_ratio == "9:16":
            target_width = quality_settings["height"]
            target_height = quality_settings["width"]
        else:  # 1:1
            target_width = target_height = min(quality_settings["width"], quality_settings["height"])
        
        # Calculate scaling to fit within target dimensions
        scale_w = target_width / clip.w
        scale_h = target_height / clip.h
        scale = min(scale_w, scale_h)
        
        # Resize clip
        new_width = int(clip.w * scale)
        new_height = int(clip.h * scale)
        
        resized = clip.resize((new_width, new_height))
        
        # Create black background
        background = ColorClip(
            size=(target_width, target_height),
            color=(0, 0, 0),
            duration=clip.duration
        )
        
        # Calculate position to center the video
        x_pos = (target_width - new_width) // 2
        y_pos = (target_height - new_height) // 2
        
        # Position the resized clip on center of background
        resized = resized.set_position((x_pos, y_pos))
        
        # Composite the clips
        final_clip = CompositeVideoClip([background, resized], size=(target_width, target_height))
        final_clip = final_clip.set_fps(clip.fps or quality_settings["fps"])
        
        if clip.audio:
            final_clip = final_clip.set_audio(clip.audio)
        
        return final_clip

    def process_clip(
        self,
        clip_request: ClipRequest,
        aspect_ratio: str,
        quality: str,
        log_callback: Callable[[str], None] = None,
        url_resolver: Callable[[str], str] = None,
    ) -> VideoFileClip:
        """Process a single video clip with effects"""
        
        def log(msg: str):
            if log_callback:
                log_callback(msg)
            print(f"[VideoProcessor] {msg}")
        
        try:
            log(f"=== Starting process_clip ===")
            log(f"Input video_url: {clip_request.video_url}")
            log(f"URL resolver provided: {url_resolver is not None}")
            log(f"self.uploads_dir: {self.uploads_dir}")
            
            # Load the video clip - resolve URL to file path
            video_path = clip_request.video_url
            
            if url_resolver:
                log(f"Calling url_resolver...")
                video_path = url_resolver(video_path)
                log(f"Resolved path from url_resolver: {video_path}")
            else:
                log(f"WARNING: No URL resolver provided!")
                # Fallback: try to resolve manually
                if video_path.startswith("/static/uploads/"):
                    video_path = os.path.join(self.uploads_dir, video_path.replace("/static/uploads/", ""))
                    log(f"Fallback resolved path: {video_path}")
            
            log(f"Final video path: {video_path}")
            
            # Check if file exists
            exists = os.path.exists(video_path)
            log(f"File exists check: {exists}")
            
            if not exists:
                # List files in uploads directory for debugging
                try:
                    files = os.listdir(self.uploads_dir)
                    log(f"Files in uploads dir ({len(files)}): {files[:10]}...")
                except Exception as e:
                    log(f"Could not list uploads dir: {e}")
                raise Exception(f"Video file not found at path: {video_path}")
            
            log(f"Loading video file with MoviePy...")
            clip = VideoFileClip(video_path)
            log(f"Video loaded successfully. Duration: {clip.duration}s")
        except Exception as e:
            log(f"ERROR in process_clip during load: {str(e)}")
            raise
        
        # Trim to selected range
        log(f"Trimming: {clip_request.start_time}s to {clip_request.end_time}s")
        clip = clip.subclip(clip_request.start_time, clip_request.end_time)
        
        # Apply speed effect
        if clip_request.effects.speed != 1:
            log(f"Applying speed: {clip_request.effects.speed}x")
            clip = clip.fx(speedx, clip_request.effects.speed)
        
        # Apply fade in
        if clip_request.effects.fade_in > 0:
            log(f"Applying fade in: {clip_request.effects.fade_in}s")
            clip = clip.fx(fadein, clip_request.effects.fade_in)
        
        # Apply fade out
        if clip_request.effects.fade_out > 0:
            log(f"Applying fade out: {clip_request.effects.fade_out}s")
            clip = clip.fx(fadeout, clip_request.effects.fade_out)

        # Initialize overlay lists
        text_clips = []
        image_clips = []

        # Add text overlays
        if clip_request.text_overlays:
            log(f"Adding {len(clip_request.text_overlays)} text overlay(s)")
            
            for overlay in clip_request.text_overlays:
                try:
                    txt_clip = TextClip(
                        overlay.text,
                        fontsize=overlay.font_size,
                        color=overlay.color,
                        font=overlay.font_family,
                    )
                    
                    # Position the text
                    x_pos = overlay.position.x / 100 * clip.w
                    y_pos = overlay.position.y / 100 * clip.h
                    txt_clip = txt_clip.set_position((x_pos, y_pos))
                    
                    # Set timing
                    txt_clip = txt_clip.set_start(overlay.start_time)
                    txt_clip = txt_clip.set_duration(overlay.end_time - overlay.start_time)
                    
                    text_clips.append(txt_clip)
                except Exception as e:
                    log(f"Warning: Failed to add text overlay: {str(e)}")
            
            if text_clips:
                clip = CompositeVideoClip([clip] + text_clips)

        # Add image overlays
        if clip_request.image_overlays:
            log(f"Adding {len(clip_request.image_overlays)} image overlay(s)")

            for overlay in clip_request.image_overlays:
                try:
                    img_clip = self.create_image_overlay_clip(overlay, clip.w, clip.h, log_callback)
                    image_clips.append(img_clip)
                except Exception as e:
                    log(f"Warning: Failed to add image overlay: {str(e)}")

        # Compose all overlays together
        all_overlays = text_clips + image_clips
        if all_overlays:
            clip = CompositeVideoClip([clip] + all_overlays)
            log(f"Successfully added {len(text_clips)} text and {len(image_clips)} image overlay(s)")

        return clip

    async def process_export(
        self,
        job: Job,
        clips_requests: List[ClipRequest],
        audio_tracks: List[AudioTrackRequest],
        settings: ExportSettings,
        log_callback: Callable[[str], None],
        progress_callback: Callable[[float], None],
        url_resolver: Callable[[str], str] = None,
    ) -> str:
        """Process the full export job"""
        
        def log(msg: str):
            log_callback(msg)
            print(f"[VideoProcessor] {msg}")
        
        try:
            log("Starting export process...")
            log(f"URL resolver provided: {url_resolver is not None}")
            log(f"Uploads directory: {self.uploads_dir}")
            
            processed_clips = []
            total_clips = len(clips_requests)
            
            # Process each clip
            for i, clip_req in enumerate(clips_requests):
                log(f"Processing clip {i + 1}/{total_clips}")
                log(f"Clip video_url: {clip_req.video_url}")
                clip = self.process_clip(clip_req, settings.aspect_ratio, settings.quality, log, url_resolver)
                processed_clips.append(clip)
                progress_callback((i + 1) / total_clips * 50)  # 50% for clip processing
            
            log("Concatenating clips...")
            if len(processed_clips) == 1:
                final_video = processed_clips[0]
            else:
                final_video = concatenate_videoclips(processed_clips, method="compose")
            
            progress_callback(60)
            
            # Resize to target aspect ratio
            log(f"Resizing to {settings.aspect_ratio} aspect ratio...")
            final_video = self.resize_to_aspect_ratio(
                final_video, settings.aspect_ratio, settings.quality
            )
            
            progress_callback(70)
            
            # Add external audio tracks
            if audio_tracks:
                log(f"Adding {len(audio_tracks)} audio track(s)...")
                audio_clips = []
                
                # Keep original audio if exists
                if final_video.audio:
                    audio_clips.append(final_video.audio)
                
                for audio_req in audio_tracks:
                    try:
                        audio_path = audio_req.url
                        if url_resolver:
                            audio_path = url_resolver(audio_path)
                        
                        if not os.path.exists(audio_path):
                            log(f"Warning: Audio file not found: {audio_path}")
                            continue
                        
                        audio_clip = AudioFileClip(audio_path)
                        audio_clip = audio_clip.volumex(audio_req.volume)
                        audio_clip = audio_clip.set_start(audio_req.start_time)
                        audio_clips.append(audio_clip)
                    except Exception as e:
                        log(f"Warning: Failed to add audio track: {str(e)}")
                
                if audio_clips:
                    final_audio = CompositeAudioClip(audio_clips)
                    final_video = final_video.set_audio(final_audio)
            
            progress_callback(80)
            
            # Generate output filename
            output_filename = f"export_{uuid.uuid4().hex[:8]}.{settings.format}"
            output_path = os.path.join(self.exports_dir, output_filename)
            
            # Get quality settings
            quality_settings = QUALITY_SETTINGS[settings.quality]
            
            log(f"Encoding video ({settings.quality} quality)...")
            
            # Export video
            codec = "libx264" if settings.format in ["mp4", "mov"] else "mpeg4"
            
            final_video.write_videofile(
                output_path,
                codec=codec,
                audio_codec="aac",
                bitrate=quality_settings["bitrate"],
                fps=quality_settings["fps"],
                logger=None,  # Disable moviepy logger
            )
            
            progress_callback(100)
            log("Export completed successfully!")
            
            # Cleanup
            for clip in processed_clips:
                clip.close()
            final_video.close()
            
            return f"/api/download/{output_filename}"
            
        except Exception as e:
            log(f"Export failed: {str(e)}")
            raise


# Global processor instance
processor: Optional[VideoProcessor] = None


def get_processor() -> VideoProcessor:
    global processor
    if processor is None:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        uploads_dir = os.path.join(base_dir, "uploads")
        exports_dir = os.path.join(base_dir, "exports")
        temp_dir = os.path.join(base_dir, "temp")
        
        print(f"[VideoProcessor] Initializing with:")
        print(f"[VideoProcessor] base_dir: {base_dir}")
        print(f"[VideoProcessor] uploads_dir: {uploads_dir}")
        print(f"[VideoProcessor] exports_dir: {exports_dir}")
        print(f"[VideoProcessor] temp_dir: {temp_dir}")
        
        processor = VideoProcessor(
            uploads_dir=uploads_dir,
            exports_dir=exports_dir,
            temp_dir=temp_dir,
        )
    return processor
