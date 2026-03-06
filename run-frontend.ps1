# Load root .env file
Get-Content "f:\cursor\postiz-app\.env" | Where-Object { $_ -match "^[A-Za-z]" -and $_ -notmatch "^#" } | ForEach-Object {
    $parts = $_ -split "=", 2
    if ($parts.Length -eq 2) {
        $key = $parts[0].Trim()
        $val = $parts[1].Trim().Trim('"')
        [System.Environment]::SetEnvironmentVariable($key, $val, "Process")
    }
}

Write-Host "NEXT_PUBLIC_BACKEND_URL = $env:NEXT_PUBLIC_BACKEND_URL"
Write-Host "FRONTEND_URL            = $env:FRONTEND_URL"
Write-Host "IS_GENERAL              = $env:IS_GENERAL"

Set-Location "f:\cursor\postiz-app\apps\frontend"
& npx next dev -p 4200
