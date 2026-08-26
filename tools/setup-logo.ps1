# ============================================================
# setup-logo.ps1
# Copia tu logo AD (la imagen rose-gold embossed que mandaste)
# al lugar correcto, dos veces:
#   - assets/img/logo-ad.png      (para el monograma del nav)
#   - assets/img/favicon.png      (para la pestaña del navegador)
#
# Uso desde PowerShell:
#   powershell -ExecutionPolicy Bypass -File setup-logo.ps1
# ============================================================

Add-Type -AssemblyName System.Windows.Forms
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$destDir   = Join-Path (Split-Path -Parent $scriptDir) "assets\img"

if (-not (Test-Path $destDir)) {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
}

Write-Host ""
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host " Setup del logo AD rose-gold" -ForegroundColor Cyan
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Destino: $destDir" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Selecciona la imagen del logo AD (la rose-gold embossed sobre fondo oscuro)." -ForegroundColor Yellow
Write-Host ""

$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title  = "Selecciona el logo AD (PNG, JPG, etc.)"
$dialog.Filter = "Imagenes (*.png;*.jpg;*.jpeg;*.webp)|*.png;*.jpg;*.jpeg;*.webp|Todos los archivos (*.*)|*.*"
$dialog.InitialDirectory = [Environment]::GetFolderPath("MyPictures")
$dialog.Multiselect = $false

$result = $dialog.ShowDialog()

if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
    $src = $dialog.FileName

    # Copia 1: logo-ad.png (para el nav monograma)
    $dst1 = Join-Path $destDir "logo-ad.png"
    Copy-Item -Path $src -Destination $dst1 -Force
    $size1 = [math]::Round((Get-Item $dst1).Length / 1KB, 1)
    Write-Host "  -> Copiada como logo-ad.png ($size1 KB)" -ForegroundColor Green

    # Copia 2: favicon.png (para la pestaña)
    $dst2 = Join-Path $destDir "favicon.png"
    Copy-Item -Path $src -Destination $dst2 -Force
    $size2 = [math]::Round((Get-Item $dst2).Length / 1KB, 1)
    Write-Host "  -> Copiada como favicon.png ($size2 KB)" -ForegroundColor Green

    Write-Host ""
    Write-Host "Listo. Recarga http://localhost:8765 con Ctrl+Shift+R" -ForegroundColor Green
} else {
    Write-Host "  -> Cancelado." -ForegroundColor DarkYellow
}

Write-Host ""
Read-Host "Presiona Enter para cerrar"
