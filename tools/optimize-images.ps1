# ============================================================
# optimize-images.ps1
# Resize y recompress de imagenes usando System.Drawing (built-in Windows).
# - logo-ad.png: 1.87 MB → ~50-80 KB (resize a 384x216)
# - favicon.png: → ~10 KB (resize a 128x128)
# - photos: solo si pesan >300 KB, recompress a JPEG quality 82
# ============================================================

Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$imgDir    = Join-Path (Split-Path -Parent $scriptDir) "assets\img"

function Resize-Image {
    param(
        [string]$Path,
        [int]$NewWidth,
        [int]$NewHeight,
        [string]$Format = "png",
        [int]$Quality = 85
    )

    if (-not (Test-Path $Path)) { Write-Host "  skip (not found): $Path" -ForegroundColor DarkYellow; return }

    $sizeBefore = [math]::Round((Get-Item $Path).Length / 1KB, 1)

    $img = [System.Drawing.Image]::FromFile($Path)
    try {
        # Maintain aspect ratio: pick the limiting dimension
        $srcAspect = $img.Width / $img.Height
        $dstAspect = $NewWidth / $NewHeight
        if ($srcAspect -gt $dstAspect) {
            # source is wider, fit to width
            $w = $NewWidth
            $h = [int]([math]::Round($NewWidth / $srcAspect))
        } else {
            $h = $NewHeight
            $w = [int]([math]::Round($NewHeight * $srcAspect))
        }

        $bmp = New-Object System.Drawing.Bitmap($w, $h)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $g.DrawImage($img, 0, 0, $w, $h)
        $g.Dispose()

        $tempPath = $Path + ".tmp"

        if ($Format -eq "jpg" -or $Format -eq "jpeg") {
            $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
            $params = New-Object System.Drawing.Imaging.EncoderParameters(1)
            $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)
            $bmp.Save($tempPath, $codec, $params)
        } else {
            $bmp.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
        }

        $bmp.Dispose()
        $img.Dispose()

        Move-Item -Path $tempPath -Destination $Path -Force

        $sizeAfter = [math]::Round((Get-Item $Path).Length / 1KB, 1)
        $savings = [math]::Round((($sizeBefore - $sizeAfter) / $sizeBefore) * 100, 0)
        Write-Host ("  OK: {0,-22} {1,7:N1} KB -> {2,7:N1} KB  ({3}% smaller, {4}x{5})" -f (Split-Path $Path -Leaf), $sizeBefore, $sizeAfter, $savings, $w, $h) -ForegroundColor Green
    }
    catch {
        Write-Host "  FAIL: $($_.Exception.Message)" -ForegroundColor Red
        if ($img) { try { $img.Dispose() } catch {} }
    }
}

Write-Host ""
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host " Optimizando imagenes" -ForegroundColor Cyan
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host ""

# Logo at 384x216 (2:1 aspect, retina-ready for 64x38 display)
Resize-Image -Path (Join-Path $imgDir "logo-ad.png") -NewWidth 384 -NewHeight 216 -Format "png"

# Favicon at 128x128 (will fit logo letterboxed at the center)
Resize-Image -Path (Join-Path $imgDir "favicon.png") -NewWidth 128 -NewHeight 128 -Format "png"

# Photos: hero loaded eagerly, others lazy. Recompress to JPEG 85.
Resize-Image -Path (Join-Path $imgDir "photo-hero.jpg")    -NewWidth 960 -NewHeight 1200 -Format "jpg" -Quality 85
Resize-Image -Path (Join-Path $imgDir "photo-about.jpg")   -NewWidth 720 -NewHeight 900 -Format "jpg" -Quality 82
Resize-Image -Path (Join-Path $imgDir "photo-contact.jpg") -NewWidth 720 -NewHeight 900 -Format "jpg" -Quality 82

Write-Host ""
Write-Host "Listo. Recarga http://localhost:8765 con Ctrl+Shift+R" -ForegroundColor Green
Write-Host ""
Read-Host "Presiona Enter para cerrar"
