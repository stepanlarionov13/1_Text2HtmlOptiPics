$port = 8080
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "HTTP server running at http://localhost:$port/"

$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        $urlPath = $request.Url.LocalPath
        if ($urlPath -eq '/' -or [string]::IsNullOrEmpty($urlPath)) { $urlPath = '/index.html' }
        $localFilePath = Join-Path $root ($urlPath.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar))
        
        if (Test-Path $localFilePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($localFilePath)
            if ($localFilePath.EndsWith('.html')) {
                $response.ContentType = 'text/html; charset=utf-8'
            } elseif ($localFilePath.EndsWith('.css')) {
                $response.ContentType = 'text/css; charset=utf-8'
            } elseif ($localFilePath.EndsWith('.js')) {
                $response.ContentType = 'application/javascript; charset=utf-8'
            } elseif ($localFilePath.EndsWith('.docx')) {
                $response.ContentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            } elseif ($localFilePath.EndsWith('.json')) {
                $response.ContentType = 'application/json; charset=utf-8'
            }
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.ContentLength64 = $errBytes.Length
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        }
        $response.Close()
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
