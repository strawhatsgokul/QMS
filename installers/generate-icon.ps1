<#
.SYNOPSIS
  Generate a simple QMS .ico file for the installers.
#>

Add-Type -AssemblyName System.Drawing

$outputPath = Join-Path $PSScriptRoot "resources\qms.ico"
New-Item -ItemType Directory -Path (Split-Path $outputPath -Parent) -Force | Out-Null

# Create 32x32 bitmap with gradient background + "Q"
$bmp = New-Object System.Drawing.Bitmap 32, 32
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

# Dark blue gradient circle
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.PointF 0, 0),
  (New-Object System.Drawing.PointF 32, 32),
  [System.Drawing.Color]::FromArgb(37, 99, 235),
  [System.Drawing.Color]::FromArgb(30, 64, 175)
)
$g.FillEllipse($brush, 1, 1, 30, 30)

# White letter "Q"
$font = New-Object System.Drawing.Font("Segoe UI", 18, [System.Drawing.FontStyle]::Bold)
$brush2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$g.DrawString("Q", $font, $brush2, 5, 3)

$g.Dispose()
$brush.Dispose()
$brush2.Dispose()
$font.Dispose()

# Save as PNG in memory (modern Windows ICO supports PNG compression)
$pngStream = New-Object System.IO.MemoryStream
$bmp.Save($pngStream, [System.Drawing.Imaging.ImageFormat]::Png)
$pngBytes = $pngStream.ToArray()
$pngStream.Close()
$bmp.Dispose()

# ── Write ICO file with embedded PNG image ──────────────────
$fs = [System.IO.File]::Open($outputPath, [System.IO.FileMode]::Create)
$writer = New-Object System.IO.BinaryWriter($fs)

# ICO header
$writer.Write([byte]0); $writer.Write([byte]0)   # reserved
$writer.Write([byte]1); $writer.Write([byte]0)   # ICO type (1)
$writer.Write([byte]1); $writer.Write([byte]0)   # count (1)

# Directory entry
$writer.Write([byte]32)                           # width (32)
$writer.Write([byte]32)                           # height (32)
$writer.Write([byte]0)                            # colors (0 = 32bpp)
$writer.Write([byte]0)                            # reserved
$writer.Write([int16]1)                           # color planes (1)
$writer.Write([int16]32)                          # bits per pixel (32)
$writer.Write([int32]$pngBytes.Length)            # image size
$writer.Write([int32]22)                          # image offset (after header + directory)

# PNG image data
$writer.Write($pngBytes)
$writer.Close()
$fs.Close()

Write-Host "[OK] Icon generated: $outputPath" -ForegroundColor Green
