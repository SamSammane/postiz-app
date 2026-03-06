# Load .env file
Get-Content "f:\cursor\postiz-app\.env" | Where-Object { $_ -match "^[A-Za-z]" -and $_ -notmatch "^#" } | ForEach-Object {
    $parts = $_ -split "=", 2
    if ($parts.Length -eq 2) {
        $key = $parts[0].Trim()
        $val = $parts[1].Trim().Trim('"')
        [System.Environment]::SetEnvironmentVariable($key, $val, "Process")
    }
}

Set-Location "f:\cursor\postiz-app\apps\backend"
& npx nest start --watch --entryFile="apps/backend/src/main"
