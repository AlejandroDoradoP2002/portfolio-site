# ============================================================
# setup-photos.ps1
# Abre 3 dialogs de seleccion de archivo y copia las fotos
# al lugar correcto con el nombre correcto.
#
# Uso: clic derecho en este archivo > "Ejecutar con PowerShell"
#       o desde una terminal:
#       powershell -ExecutionPolicy Bypass -File setup-photos.ps1
# ============================================================

Add-Type -AssemblyName System.Windows.Forms

$ErrorActionPreference = "Stop"

# Resolver la carpeta destino (assets/img/ relativo a este script)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$destDir   = Join-Path (Split-Path -Parent $scriptDir) "assets\img"

if (-not (Test-Path $destDir)) {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
}

Write-Host ""
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host " Setup de fotos para el portfolio de Alejandro Dorado" -ForegroundColor Cyan
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Carpeta destino: $destDir" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Te voy a abrir 3 ventanas. En cada una selecciona la foto que corresponde." -ForegroundColor Yellow
Write-Host ""

$photos = @(
    @{ Title = "1/3 - Foto HERO (navy sweater, brazos cruzados, fondo oscuro)"; Name = "photo-hero.jpg" }
    @{ Title = "2/3 - Foto ABOUT (sweater blanco/crema, fondo claro)";          Name = "photo-about.jpg" }
    @{ Title = "3/3 - Foto CONTACT (quarter-zip navy, sonriendo)";              Name = "photo-contact.jpg" }
)

$copied = 0
$skipped = 0

foreach ($photo in $photos) {
    Write-Host "$($photo.Title)" -ForegroundColor White

    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Title  = $photo.Title
    $dialog.Filter = "Imagenes (*.jpg;*.jpeg;*.png;*.webp;*.heic)|*.jpg;*.jpeg;*.png;*.webp;*.heic|Todos los archivos (*.*)|*.*"
    $dialog.InitialDirectory = [Environment]::GetFolderPath("MyPictures")
    $dialog.Multiselect = $false

    $result = $dialog.ShowDialog()

    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
        $src = $dialog.FileName
        $dst = Join-Path $destDir $photo.Name
        Copy-Item -Path $src -Destination $dst -Force
        $size = [math]::Round((Get-Item $dst).Length / 1KB, 1)
        Write-Host "  -> Copiada como $($photo.Name) ($size KB)" -ForegroundColor Green
        $copied++
    } else {
        Write-Host "  -> SALTADA (no seleccionaste archivo)" -ForegroundColor DarkYellow
        $skipped++
    }
    Write-Host ""
}

Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host " Resumen: $copied copiadas, $skipped saltadas" -ForegroundColor Cyan
Write-Host "=============================================================" -ForegroundColor Cyan

if ($copied -eq 3) {
    Write-Host ""
    Write-Host "Todo listo. Ahora recarga http://localhost:8765 en el navegador" -ForegroundColor Green
    Write-Host "(Ctrl+F5 para forzar refresh sin cache)" -ForegroundColor Green
    Write-Host ""
}

Read-Host "Presiona Enter para cerrar"
