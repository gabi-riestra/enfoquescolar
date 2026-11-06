# ============================================================
#  Enfoque Escolar · servidor local para la versión web
#  Abre una ventana de PowerShell y ejecuta:
#      powershell -ExecutionPolicy Bypass -File .\servir.ps1
#  Luego visita:  http://localhost:8080
# ============================================================

param(
    [int]$Port = 8080,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$prefix = "http://localhost:$Port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    Write-Host ""
    Write-Host "No se pudo iniciar el servidor en el puerto $Port." -ForegroundColor Red
    Write-Host "Puede que otro programa esté usando ese puerto."
    Write-Host "Prueba con otro puerto, por ejemplo:"
    Write-Host "    powershell -ExecutionPolicy Bypass -File .\servir.ps1 -Port 8090"
    Write-Host ""
    Read-Host "Pulsa Enter para cerrar"
    exit 1
}

$mime = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "text/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".webmanifest" = "application/manifest+json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".txt"  = "text/plain; charset=utf-8"
    ".woff2" = "font/woff2"
}

Write-Host ""
Write-Host "  Enfoque Escolar · servidor local" -ForegroundColor Magenta
Write-Host "  Dirección: $prefix" -ForegroundColor Cyan
Write-Host "  Carpeta:   $root"
Write-Host ""
Write-Host "  Deja esta ventana abierta mientras usas la app."
Write-Host "  Pulsa Ctrl+C para detener el servidor."
Write-Host ""

if (-not $NoBrowser) {
    Start-Process $prefix | Out-Null
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $path = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath)
        if ([string]::IsNullOrWhiteSpace($path) -or $path -eq "/") { $path = "/index.html" }
        $path = $path.TrimStart("/")
        $full = [System.IO.Path]::GetFullPath((Join-Path $root $path))

        if (-not $full.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
            $response.StatusCode = 403
            $response.Close()
            continue
        }

        if ((Test-Path $full) -and (Get-Item $full).PSIsContainer) {
            $full = Join-Path $full "index.html"
        }

        if (-not (Test-Path $full) -or -not (Test-Path $full -PathType Leaf)) {
            $response.StatusCode = 404
            $bytes = [System.Text.Encoding]::UTF8.GetBytes("No encontrado")
            $response.ContentType = "text/plain; charset=utf-8"
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }

        $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
        if ($mime.ContainsKey($ext)) { $response.ContentType = $mime[$ext] }
        else { $response.ContentType = "application/octet-stream" }

        $response.Headers["Cache-Control"] = "no-cache"
        $response.Headers["Service-Worker-Allowed"] = "/"

        $bytes = [System.IO.File]::ReadAllBytes($full)
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
        $response.Close()
    } catch {
        try { $context.Response.Abort() } catch { }
    }
}
