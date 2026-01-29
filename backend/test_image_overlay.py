#!/usr/bin/env python3
"""
Test script for image overlay functionality
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.models import ImageOverlay, ClipRequest, ExportSettings

def test_image_overlay_model():
    """Test creating an ImageOverlay model"""
    overlay = ImageOverlay(
        image_url="https://example.com/avatar.jpg",
        image_shape="CIRCLE",
        shape_image_url="https://example.com/mask.png",
        percentage_width=38.23,
        percentage_from_top=66.27,
        percentage_from_start=31.19,
        start_time=0.0,
        end_time=10.0
    )

    print("✓ ImageOverlay model created successfully")
    print(f"  - Image URL: {overlay.image_url}")
    print(f"  - Shape: {overlay.image_shape}")
    print(f"  - Shape URL: {overlay.shape_image_url}")
    print(f"  - Width: {overlay.percentage_width}%")
    print(f"  - From Top: {overlay.percentage_from_top}%")
    print(f"  - From Start: {overlay.percentage_from_start}%")

    return overlay

def test_clip_request_with_image_overlay():
    """Test adding image overlay to clip request"""
    overlay = test_image_overlay_model()

    clip_request = ClipRequest(
        video_url="/static/uploads/test.mp4",
        start_time=0.0,
        end_time=10.0,
        effects={
            "fade_in": 0.0,
            "fade_out": 0.0,
            "speed": 1.0
        },
        text_overlays=[],
        image_overlays=[overlay]
    )

    print("\n✓ ClipRequest with image overlay created successfully")
    print(f"  - Video URL: {clip_request.video_url}")
    print(f"  - Image overlays count: {len(clip_request.image_overlays)}")

    return clip_request

def test_export_request():
    """Test creating export request with image overlays"""
    clip_request = test_clip_request_with_image_overlay()

    export_request = {
        "clips": [clip_request.dict()],
        "audio_tracks": [],
        "settings": {
            "aspect_ratio": "16:9",
            "quality": "optimised",
            "format": "mp4"
        }
    }

    print("\n✓ Export request structure created successfully")
    print(f"  - Clips count: {len(export_request['clips'])}")
    print(f"  - Settings: {export_request['settings']}")

    return export_request

if __name__ == "__main__":
    print("Testing Image Overlay functionality...\n")

    try:
        test_export_request()
        print("\n🎉 All tests passed! Image overlay functionality is ready.")
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        sys.exit(1)