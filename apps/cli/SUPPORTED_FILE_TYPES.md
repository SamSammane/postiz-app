# Supported File Types for Upload

The Trelexa CLI now correctly detects and uploads various media types.

## How It Works

The CLI automatically detects the MIME type based on the file extension:

```bash
trelexa upload video.mp4
# ✅ Detected as: video/mp4

trelexa upload image.png
# ✅ Detected as: image/png

trelexa upload audio.mp3
# ✅ Detected as: audio/mpeg
```

## Supported File Types

### Images

| Extension | MIME Type | Supported |
|-----------|-----------|-----------|
| `.png` | `image/png` | ✅ Yes |
| `.jpg`, `.jpeg` | `image/jpeg` | ✅ Yes |
| `.gif` | `image/gif` | ✅ Yes |
| `.webp` | `image/webp` | ✅ Yes |
| `.svg` | `image/svg+xml` | ✅ Yes |
| `.bmp` | `image/bmp` | ✅ Yes |
| `.ico` | `image/x-icon` | ✅ Yes |

**Examples:**
```bash
trelexa upload photo.jpg
trelexa upload logo.png
trelexa upload animation.gif
trelexa upload icon.svg
```

### Videos

| Extension | MIME Type | Supported |
|-----------|-----------|-----------|
| `.mp4` | `video/mp4` | ✅ Yes |
| `.mov` | `video/quicktime` | ✅ Yes |
| `.avi` | `video/x-msvideo` | ✅ Yes |
| `.mkv` | `video/x-matroska` | ✅ Yes |
| `.webm` | `video/webm` | ✅ Yes |
| `.flv` | `video/x-flv` | ✅ Yes |
| `.wmv` | `video/x-ms-wmv` | ✅ Yes |
| `.m4v` | `video/x-m4v` | ✅ Yes |
| `.mpeg`, `.mpg` | `video/mpeg` | ✅ Yes |
| `.3gp` | `video/3gpp` | ✅ Yes |

**Examples:**
```bash
trelexa upload video.mp4
trelexa upload clip.mov
trelexa upload recording.webm
trelexa upload movie.mkv
```

### Audio

| Extension | MIME Type | Supported |
|-----------|-----------|-----------|
| `.mp3` | `audio/mpeg` | ✅ Yes |
| `.wav` | `audio/wav` | ✅ Yes |
| `.ogg` | `audio/ogg` | ✅ Yes |
| `.aac` | `audio/aac` | ✅ Yes |
| `.flac` | `audio/flac` | ✅ Yes |
| `.m4a` | `audio/mp4` | ✅ Yes |

**Examples:**
```bash
trelexa upload podcast.mp3
trelexa upload song.wav
trelexa upload audio.ogg
```

### Documents

| Extension | MIME Type | Supported |
|-----------|-----------|-----------|
| `.pdf` | `application/pdf` | ✅ Yes |
| `.doc` | `application/msword` | ✅ Yes |
| `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | ✅ Yes |

**Examples:**
```bash
trelexa upload document.pdf
trelexa upload report.docx
```

### Other Files

For file types not listed above, the CLI uses:
- MIME type: `application/octet-stream`
- This is a generic binary file type

## Usage Examples

### Upload an Image

```bash
trelexa upload ./images/photo.jpg
```

Response:
```json
{
  "id": "upload-123",
  "path": "https://cdn.trelexa.ai/uploads/photo.jpg",
  "url": "https://cdn.trelexa.ai/uploads/photo.jpg"
}
```

### Upload a Video (MP4)

```bash
trelexa upload ./videos/promo.mp4
```

Response:
```json
{
  "id": "upload-456",
  "path": "https://cdn.trelexa.ai/uploads/promo.mp4",
  "url": "https://cdn.trelexa.ai/uploads/promo.mp4"
}
```

### Upload and Use in Post

```bash
# 1. Upload the file
RESULT=$(trelexa upload video.mp4)
echo $RESULT

# 2. Extract the path (you'll need jq or similar)
PATH=$(echo $RESULT | jq -r '.path')

# 3. Use in a post
trelexa posts:create \
  -c "Check out my video!" \
  -m "$PATH" \
  -i "tiktok-123"
```

### Upload Multiple Files

```bash
# Upload images
trelexa upload image1.jpg
trelexa upload image2.png
trelexa upload image3.gif

# Upload videos
trelexa upload video1.mp4
trelexa upload video2.mov
```

## What Changed (Fix)

### Before (❌ Bug)

```bash
trelexa upload video.mp4
# ❌ Was detected as: image/jpeg (WRONG!)
```

The problem: The CLI defaulted to `image/jpeg` for any unknown file type.

### After (✅ Fixed)

```bash
trelexa upload video.mp4
# ✅ Correctly detected as: video/mp4

trelexa upload audio.mp3
# ✅ Correctly detected as: audio/mpeg

trelexa upload document.pdf
# ✅ Correctly detected as: application/pdf
```

## Platform-Specific Notes

### TikTok
- Supports: MP4, MOV, WEBM
- Recommended: MP4

### YouTube
- Supports: MP4, MOV, AVI, WMV, FLV, 3GP, WEBM
- Recommended: MP4

### Instagram
- Images: JPG, PNG
- Videos: MP4, MOV
- Recommended: MP4 for videos, JPG for images

### Twitter/X
- Images: PNG, JPG, GIF, WEBP
- Videos: MP4, MOV
- Max video size: 512MB

### LinkedIn
- Images: PNG, JPG, GIF
- Videos: MP4, MOV, AVI
- Documents: PDF, DOC, DOCX, PPT

## Troubleshooting

### "Upload failed: Unsupported file type"

Some platforms may not accept certain file types. Check the platform's documentation.

**Solution:** Convert the file to a supported format:

```bash
# Convert video to MP4
ffmpeg -i video.avi video.mp4

# Then upload
trelexa upload video.mp4
```

### File Size Limits

Different platforms have different file size limits:

- **Twitter/X**: Max 512MB for videos
- **Instagram**: Max 100MB for videos
- **TikTok**: Max 287.6MB for videos
- **YouTube**: Max 128GB (but 256GB for verified)

### "MIME type mismatch"

If you renamed a file with the wrong extension:

```bash
# ❌ Wrong: PNG file renamed to .jpg
mv image.png image.jpg
trelexa upload image.jpg  # Might fail

# ✅ Correct: Keep original extension
trelexa upload image.png
```

## Testing File Upload

```bash
# Set API key
export TRELEXA_API_KEY=your_key

# Test image upload
trelexa upload test-image.jpg

# Test video upload
trelexa upload test-video.mp4

# Test audio upload
trelexa upload test-audio.mp3
```

## Error Messages

### File Not Found
```
❌ ENOENT: no such file or directory
```

**Solution:** Check the file path is correct.

### No Permission
```
❌ EACCES: permission denied
```

**Solution:** Check file permissions:
```bash
chmod 644 your-file.mp4
```

### Invalid API Key
```
❌ Upload failed (401): Unauthorized
```

**Solution:** Set your API key:
```bash
export TRELEXA_API_KEY=your_key
```

## Summary

✅ **30+ file types supported**
✅ **Automatic MIME type detection**
✅ **Images, videos, audio, documents**
✅ **Correct handling of MP4, MOV, MP3, etc.**
✅ **No more defaulting to JPEG!**

**The upload bug is fixed!** 🎉
