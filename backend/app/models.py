from pydantic import BaseModel
from typing import List, Optional, Literal
from datetime import datetime
from enum import Enum


class Position(BaseModel):
    x: float
    y: float


class TextOverlay(BaseModel):
    text: str
    font_family: str = "Arial"
    font_size: int = 32
    color: str = "#ffffff"
    position: Position
    start_time: float
    end_time: float


class ImageOverlay(BaseModel):
    image_url: str
    image_shape: Literal["CIRCLE", "RECTANGLE", "SQUARE"] = "CIRCLE"
    shape_image_url: Optional[str] = None
    percentage_width: float
    percentage_from_top: float
    percentage_from_start: float
    start_time: float
    end_time: float


class ClipEffects(BaseModel):
    fade_in: float = 0
    fade_out: float = 0
    speed: float = 1


class ClipRequest(BaseModel):
    video_url: str
    start_time: float
    end_time: float
    track: int = 0
    effects: ClipEffects
    text_overlays: List[TextOverlay] = []
    image_overlays: List[ImageOverlay] = []


class AudioTrackRequest(BaseModel):
    url: str
    volume: float = 1
    start_time: float = 0


class ExportSettings(BaseModel):
    aspect_ratio: Literal["1:1", "16:9", "9:16"] = "16:9"
    quality: Literal["low", "optimised", "high"] = "optimised"
    format: Literal["mp4", "mov", "avi"] = "mp4"


class ExportRequest(BaseModel):
    clips: List[ClipRequest]
    audio_tracks: List[AudioTrackRequest] = []
    settings: ExportSettings


class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Job(BaseModel):
    id: str
    status: JobStatus = JobStatus.PENDING
    progress: float = 0
    logs: List[str] = []
    created_at: datetime
    completed_at: Optional[datetime] = None
    output_url: Optional[str] = None
    request: Optional[ExportRequest] = None


class UploadResponse(BaseModel):
    id: str
    filename: str
    url: str
    duration: float
    thumbnail: str


class VideoUrlRequest(BaseModel):
    url: str


class ThumbnailRequest(BaseModel):
    time: float = 0


class JobStatusResponse(BaseModel):
    id: str
    status: str
    progress: float
    logs: List[str]
    output_url: Optional[str] = None
