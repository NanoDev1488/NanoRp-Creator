"""
Procedural High-Resolution App Icon Generator for NanoRp-Creator
Generates clean isometric Minecraft Resource Cube with cybernetic neon styling using Pillow.
"""

import math
from PIL import Image, ImageDraw, ImageFilter

def draw_app_icon(size=512):
    # Canvas with RGBA
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. Background Rounded Squircle with Dark Slate Gradient
    pad = int(size * 0.06)
    radius = int(size * 0.22)
    bg_box = [pad, pad, size - pad, size - pad]

    # Create mask for squircle
    mask = Image.new("L", (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle(bg_box, radius=radius, fill=255)

    # Base gradient background
    bg_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg_layer)
    for y in range(pad, size - pad):
        factor = (y - pad) / (size - 2 * pad)
        # Deep dark blue-gray gradient: #0d131f -> #06090e
        r = int(13 * (1 - factor) + 6 * factor)
        g = int(20 * (1 - factor) + 10 * factor)
        b = int(32 * (1 - factor) + 16 * factor)
        bg_draw.line([(pad, y), (size - pad, y)], fill=(r, g, b, 255))

    # Apply mask
    bg_layer.putalpha(mask)
    img.alpha_composite(bg_layer)

    # Subtle Hairline Border around squircle
    border_draw = ImageDraw.Draw(img)
    border_draw.rounded_rectangle(bg_box, radius=radius, outline=(56, 189, 248, 70), width=int(size * 0.006))

    # 2. Isometric Cube Coordinates
    cx = size // 2
    cy = int(size * 0.49)
    rw = int(size * 0.28)  # half-width of rhombus
    rh = int(rw * 0.58)     # half-height of rhombus
    h = int(size * 0.27)    # cube height

    top_top = (cx, cy - rh)
    top_right = (cx + rw, cy)
    top_bottom = (cx, cy + rh)
    top_left = (cx - rw, cy)

    bot_left = (cx - rw, cy + h)
    bot_bottom = (cx, cy + rh + h)
    bot_right = (cx + rw, cy + h)

    # 3. Outer Neon Glow behind the Cube
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_box = [cx - rw - 20, cy - rh - 10, cx + rw + 20, bot_bottom[1] + 10]
    glow_draw.ellipse(glow_box, fill=(56, 189, 248, 60))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=int(size * 0.05)))
    img.alpha_composite(glow)

    cube_draw = ImageDraw.Draw(img)

    # 4. Left Face: Medium Blue Slate with Pixel Grid
    left_poly = [top_left, top_bottom, bot_bottom, bot_left]
    cube_draw.polygon(left_poly, fill=(18, 30, 49, 255))

    # Left face cybernetic circuit lines
    lx1 = (top_left[0] + top_bottom[0]) // 2
    ly1 = (top_left[1] + top_bottom[1]) // 2
    lx2 = (bot_left[0] + bot_bottom[0]) // 2
    ly2 = (bot_left[1] + bot_bottom[1]) // 2
    cube_draw.line([(lx1, ly1), (lx2, ly2)], fill=(56, 189, 248, 120), width=int(size * 0.008))
    cube_draw.line([(top_left[0] + 15, ly1), (lx1, ly1)], fill=(56, 189, 248, 160), width=int(size * 0.008))

    # 5. Right Face: Deep Navy Slate with Glowing Core
    right_poly = [top_bottom, top_right, bot_right, bot_bottom]
    cube_draw.polygon(right_poly, fill=(11, 20, 34, 255))

    rx1 = (top_bottom[0] + top_right[0]) // 2
    ry1 = (top_bottom[1] + top_right[1]) // 2
    rx2 = (bot_bottom[0] + bot_right[0]) // 2
    ry2 = (bot_bottom[1] + bot_right[1]) // 2
    cube_draw.line([(rx1, ry1), (rx2, ry2)], fill=(14, 165, 233, 100), width=int(size * 0.008))

    # Stylized Letter "N" on the right face
    nx_mid = (rx1 + rx2) // 2
    ny_mid = (ry1 + ry2) // 2
    n_w = int(size * 0.04)
    n_h = int(size * 0.06)
    p1 = (nx_mid - n_w, ny_mid - n_h)
    p2 = (nx_mid - n_w, ny_mid + n_h)
    p3 = (nx_mid + n_w, ny_mid - n_h + 8)
    p4 = (nx_mid + n_w, ny_mid + n_h)
    cube_draw.line([p1, p2], fill=(56, 189, 248, 240), width=int(size * 0.012))
    cube_draw.line([p1, p4], fill=(56, 189, 248, 240), width=int(size * 0.012))
    cube_draw.line([p3, p4], fill=(56, 189, 248, 240), width=int(size * 0.012))

    # 6. Top Face: Bright Cyan / Ice Blue Isometric Diamond
    top_poly = [top_top, top_right, top_bottom, top_left]
    cube_draw.polygon(top_poly, fill=(30, 48, 76, 255))

    # Top face inner inset diamond
    inset = 0.6
    it_top = (cx, int(cy - rh * inset))
    it_right = (int(cx + rw * inset), cy)
    it_bottom = (cx, int(cy + rh * inset))
    it_left = (int(cx - rw * inset), cy)
    cube_draw.polygon([it_top, it_right, it_bottom, it_left], fill=(56, 189, 248, 80))
    cube_draw.polygon([it_top, it_right, it_bottom, it_left], outline=(56, 189, 248, 220), width=int(size * 0.007))

    # Central glowing power node
    cube_draw.ellipse([cx - 8, cy - 6, cx + 8, cy + 6], fill=(240, 249, 255, 255))

    # 7. Sharp Neon Edges
    neon_width = max(2, int(size * 0.008))
    # Outer cube edges
    cube_draw.line([top_top, top_right], fill=(125, 211, 252, 230), width=neon_width)
    cube_draw.line([top_top, top_left], fill=(125, 211, 252, 230), width=neon_width)
    cube_draw.line([top_left, bot_left], fill=(56, 189, 248, 180), width=neon_width)
    cube_draw.line([top_right, bot_right], fill=(14, 165, 233, 180), width=neon_width)
    cube_draw.line([bot_left, bot_bottom], fill=(56, 189, 248, 220), width=neon_width)
    cube_draw.line([bot_right, bot_bottom], fill=(14, 165, 233, 220), width=neon_width)

    # Front corner vertical spine (center)
    cube_draw.line([top_bottom, bot_bottom], fill=(240, 249, 255, 255), width=neon_width + 1)
    # Top front edges
    cube_draw.line([top_left, top_bottom], fill=(186, 230, 253, 255), width=neon_width)
    cube_draw.line([top_right, top_bottom], fill=(186, 230, 253, 255), width=neon_width)

    return img

if __name__ == "__main__":
    import os
    app_root = r"c:\Users\nanodev\RpCreator"
    
    print("[IconGenerator] Generating 512x512 Master Icon via PIL...")
    master_icon = draw_app_icon(512)

    # 1. build/icon.png
    build_dir = os.path.join(app_root, "build")
    os.makedirs(build_dir, exist_ok=True)
    master_icon.save(os.path.join(build_dir, "icon.png"), format="PNG")
    print(f"  -> Saved: {os.path.join(build_dir, 'icon.png')}")

    # 2. build/icon.ico (Windows multi-resolution icon)
    ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    master_icon.save(os.path.join(build_dir, "icon.ico"), format="ICO", sizes=ico_sizes)
    print(f"  -> Saved: {os.path.join(build_dir, 'icon.ico')}")

    # 3. src/renderer/assets/icon.png
    assets_dir = os.path.join(app_root, "src", "renderer", "assets")
    os.makedirs(assets_dir, exist_ok=True)
    master_icon.resize((128, 128), Image.Resampling.LANCZOS).save(os.path.join(assets_dir, "icon.png"), format="PNG")
    print(f"  -> Saved: {os.path.join(assets_dir, 'icon.png')}")

    # 4. assets/logo.png for README
    root_assets = os.path.join(app_root, "assets")
    os.makedirs(root_assets, exist_ok=True)
    master_icon.resize((256, 256), Image.Resampling.LANCZOS).save(os.path.join(root_assets, "logo.png"), format="PNG")
    print(f"  -> Saved: {os.path.join(root_assets, 'logo.png')}")

    print("[IconGenerator] All application icons successfully generated!")
