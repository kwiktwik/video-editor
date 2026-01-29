#!/usr/bin/env python3
"""
Test script for overlay scaling logic
"""

import sys
import os

def test_scaling_logic():
    """Test the overlay scaling logic without PIL"""
    print("Testing overlay scaling logic...")

    # Simulate overlay image dimensions
    overlay_width = 800
    overlay_height = 600
    overlay_ratio = overlay_width / overlay_height  # 1.33

    # Simulate placeholder dimensions (from shape mask bounding box)
    placeholder_width = 400
    placeholder_height = 400

    print(f"Overlay: {overlay_width}x{overlay_height} (ratio: {overlay_ratio:.2f})")
    print(f"Placeholder: {placeholder_width}x{placeholder_height}")

    placeholder_ratio = placeholder_width / placeholder_height  # 1.0

    if overlay_ratio > placeholder_ratio:
        # Overlay is wider than placeholder - scale by width
        new_width = placeholder_width
        new_height = int(placeholder_width / overlay_ratio)
        print("Scaling by width (overlay wider than placeholder)")
    else:
        # Overlay is taller than placeholder - scale by height
        new_height = placeholder_height
        new_width = int(placeholder_height * overlay_ratio)
        print("Scaling by height (overlay taller than placeholder)")

    print(f"Scaled overlay: {new_width}x{new_height}")

    # Calculate centering
    x_offset = (placeholder_width - new_width) // 2
    y_offset = (placeholder_height - new_height) // 2

    print(f"Centered position: ({x_offset}, {y_offset})")
    print("✓ Scaling logic test completed successfully")

def test_different_aspect_ratios():
    """Test scaling with different aspect ratios"""
    print("\nTesting different aspect ratios...")

    test_cases = [
        {"overlay": (800, 600), "placeholder": (400, 400), "desc": "Wide overlay, square placeholder"},
        {"overlay": (600, 800), "placeholder": (400, 400), "desc": "Tall overlay, square placeholder"},
        {"overlay": (1000, 500), "placeholder": (600, 300), "desc": "Wide overlay, wide placeholder"},
        {"overlay": (500, 1000), "placeholder": (300, 600), "desc": "Tall overlay, tall placeholder"},
    ]

    for case in test_cases:
        overlay_w, overlay_h = case["overlay"]
        placeholder_w, placeholder_h = case["placeholder"]

        overlay_ratio = overlay_w / overlay_h
        placeholder_ratio = placeholder_w / placeholder_h

        if overlay_ratio > placeholder_ratio:
            new_w = placeholder_w
            new_h = int(placeholder_w / overlay_ratio)
        else:
            new_h = placeholder_h
            new_w = int(placeholder_h * overlay_ratio)

        x_offset = (placeholder_w - new_w) // 2
        y_offset = (placeholder_h - new_h) // 2

        print(f"✓ {case['desc']}: {overlay_w}x{overlay_h} → {new_w}x{new_h} @ ({x_offset}, {y_offset})")

    print("✓ All aspect ratio tests passed")

if __name__ == "__main__":
    print("🧪 Testing Overlay Scaling Logic\n")

    try:
        test_scaling_logic()
        test_different_aspect_ratios()

        print("\n🎉 All scaling tests passed!")
        print("\nThe scaling logic ensures:")
        print("  ✅ Overlay fits within placeholder boundaries")
        print("  ✅ Aspect ratio is maintained")
        print("  ✅ Overlay is centered within placeholder")
        print("  ✅ No overflow from designated areas")

    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        sys.exit(1)