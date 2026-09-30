import os
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

def create_base_icon(size=2048, maskable=False, solid_square=False):
    """
    Creates a high-res 2048x2048 TradeGrow brand icon with exact gradients,
    crisp anti-aliased geometry, glowing upward-trending chart line, arrowhead,
    and emerald sprout leaf.
    """
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    
    # 1. Create Linear Gradient Background (#059669 -> #0d9488)
    c1 = np.array([5, 150, 105], dtype=np.float32)   # #059669
    c2 = np.array([13, 148, 136], dtype=np.float32)  # #0d9488
    
    y, x = np.mgrid[0:size, 0:size]
    diag = (x + y) / (2.0 * size)
    diag = np.clip(diag, 0.0, 1.0)
    
    grad = np.zeros((size, size, 4), dtype=np.uint8)
    for i in range(3):
        grad[:, :, i] = (c1[i] + diag * (c2[i] - c1[i])).astype(np.uint8)
    grad[:, :, 3] = 255
    
    grad_img = Image.fromarray(grad, "RGBA")
    
    if solid_square or maskable:
        # Full bleed background for Apple touch icon (Apple clips to squircle automatically)
        # or Android maskable icon
        bg = grad_img
    else:
        # Rounded squircle for standalone 'any' icon
        mask = Image.new("L", (size, size), 0)
        draw_mask = ImageDraw.Draw(mask)
        corner_radius = int(size * 0.22) # smooth modern squircle radius
        draw_mask.rounded_rectangle([0, 0, size, size], radius=corner_radius, fill=255)
        bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        bg.paste(grad_img, (0, 0), mask)
        
    # Scale coordinates from 32x32 viewBox to canvas size
    # If maskable, scale elements to sit inside safe area (center 80% circle)
    if maskable:
        scale = (size * 0.72) / 32.0
        offset_x = (size - 32 * scale) / 2.0
        offset_y = (size - 32 * scale) / 2.0
    else:
        scale = size / 32.0
        offset_x = 0
        offset_y = 0

    def pt(x_val, y_val):
        return (int(offset_x + x_val * scale), int(offset_y + y_val * scale))

    # Stroke thickness (2.5 in 32x32 space)
    stroke_w = int(2.5 * scale)

    # 2. Draw Glow Layer for the Chart Polyline
    glow_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_layer)
    
    chart_points = [pt(5, 24), pt(11, 14), pt(16, 18), pt(26, 8)]
    arrow_points = [pt(21, 8), pt(26, 8), pt(26, 13)]
    
    # Draw thicker glow strokes in bright emerald/white
    glow_stroke = int(stroke_w * 1.8)
    glow_draw.line(chart_points, fill=(167, 243, 208, 180), width=glow_stroke, joint="round")
    glow_draw.line(arrow_points, fill=(167, 243, 208, 180), width=glow_stroke, joint="round")
    
    # Cap circles for round ends
    for p in chart_points:
        glow_draw.ellipse([p[0] - glow_stroke//2, p[1] - glow_stroke//2, p[0] + glow_stroke//2, p[1] + glow_stroke//2], fill=(167, 243, 208, 180))
    for p in arrow_points:
        glow_draw.ellipse([p[0] - glow_stroke//2, p[1] - glow_stroke//2, p[0] + glow_stroke//2, p[1] + glow_stroke//2], fill=(167, 243, 208, 180))

    # Apply Gaussian Blur for radiant glow
    blur_radius = max(3, int(scale * 1.2))
    blurred_glow = glow_layer.filter(ImageFilter.GaussianBlur(radius=blur_radius))

    # Composite glow onto background
    bg.alpha_composite(blurred_glow)

    # 3. Draw Crisp Sharp Foreground Vector
    fg_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    fg_draw = ImageDraw.Draw(fg_layer)

    # Main Chart Polyline
    fg_draw.line(chart_points, fill=(255, 255, 255, 255), width=stroke_w, joint="round")
    # Arrow Head
    fg_draw.line(arrow_points, fill=(255, 255, 255, 255), width=stroke_w, joint="round")

    # Round caps at joints
    for p in chart_points:
        fg_draw.ellipse([p[0] - stroke_w//2, p[1] - stroke_w//2, p[0] + stroke_w//2, p[1] + stroke_w//2], fill=(255, 255, 255, 255))
    for p in arrow_points:
        fg_draw.ellipse([p[0] - stroke_w//2, p[1] - stroke_w//2, p[0] + stroke_w//2, p[1] + stroke_w//2], fill=(255, 255, 255, 255))

    # 4. Sprout Leaf at Arrow Tip: d="M24 6 C24 6 28.5 5.5 28.5 10 C28.5 10 24 10 24 6Z"
    # Approximate cubic bezier curve with fine polygonal interpolation
    # p0 = (24, 6), p1 = (28.5, 5.5), p2 = (28.5, 10), p3 = (28.5, 10)
    # curve 2: p0=(28.5, 10), p1=(24, 10), p2=(24, 6), p3=(24, 6)
    leaf_pts = []
    # Curve 1: t from 0 to 1
    for t in np.linspace(0, 1, 30):
        # Cubic bezier
        x_val = (1-t)**3 * 24 + 3*(1-t)**2 * t * 28.5 + 3*(1-t) * t**2 * 28.5 + t**3 * 28.5
        y_val = (1-t)**3 * 6 + 3*(1-t)**2 * t * 5.5 + 3*(1-t) * t**2 * 10 + t**3 * 10
        leaf_pts.append(pt(x_val, y_val))
    # Curve 2: t from 0 to 1
    for t in np.linspace(0, 1, 30):
        x_val = (1-t)**3 * 28.5 + 3*(1-t)**2 * t * 24 + 3*(1-t) * t**2 * 24 + t**3 * 24
        y_val = (1-t)**3 * 10 + 3*(1-t)**2 * t * 10 + 3*(1-t) * t**2 * 6 + t**3 * 6
        leaf_pts.append(pt(x_val, y_val))

    fg_draw.polygon(leaf_pts, fill=(167, 243, 208, 230)) # #A7F3D0 with opacity

    # Composite foreground on top of background + glow
    bg.alpha_composite(fg_layer)
    return bg

def main():
    target_dir = os.path.abspath(r"d:\2026 C downloads\Stocksharp\client\public")
    print(f"Generating high-resolution PWA and mobile icons in {target_dir}...")
    
    # 1. Generate master high-res icons
    master_any = create_base_icon(size=2048, maskable=False, solid_square=False)
    master_solid = create_base_icon(size=2048, maskable=False, solid_square=True)
    master_maskable = create_base_icon(size=2048, maskable=True, solid_square=True)

    # Define targets
    # (filename, master_source, size)
    targets = [
        ("apple-touch-icon.png", master_solid, 180),
        ("apple-touch-icon-180x180.png", master_solid, 180),
        ("apple-touch-icon-152x152.png", master_solid, 152),
        ("icon-192x192.png", master_any, 192),
        ("icon-512x512.png", master_any, 512),
        ("icon-maskable-512x512.png", master_maskable, 512),
        ("icon-maskable-192x192.png", master_maskable, 192),
        ("favicon-32x32.png", master_any, 32),
        ("favicon-16x16.png", master_any, 16),
    ]

    for filename, master, sz in targets:
        resized = master.resize((sz, sz), Image.Resampling.LANCZOS)
        out_path = os.path.join(target_dir, filename)
        resized.save(out_path, format="PNG", optimize=True)
        print(f"  [OK] Created {filename} ({sz}x{sz})")

    # Also generate multi-size favicon.ico
    ico_sizes = [(16, 16), (32, 32), (48, 48)]
    ico_imgs = [master_any.resize(s, Image.Resampling.LANCZOS) for s in ico_sizes]
    ico_path = os.path.join(target_dir, "favicon.ico")
    ico_imgs[0].save(ico_path, format="ICO", sizes=ico_sizes)
    print("  [OK] Created favicon.ico (16, 32, 48)")

    print("All mobile and PWA icons generated successfully!")

if __name__ == "__main__":
    main()
