$ErrorActionPreference = 'Stop'
$bundle = Split-Path -Parent $PSScriptRoot
$extension = Join-Path $bundle 'extension'
$manifest = Get-Content -LiteralPath (Join-Path $extension 'manifest.json') -Raw | ConvertFrom-Json
$publicKey = [Convert]::FromBase64String($manifest.key)
$sha = [System.Security.Cryptography.SHA256]::Create()
try { $digest = $sha.ComputeHash($publicKey) } finally { $sha.Dispose() }
$extensionId = -join (0..15 | ForEach-Object {
    [string][char](97 + ($digest[$_] -shr 4)) + [string][char](97 + ($digest[$_] -band 15))
})
$hostManifest = Join-Path $PSScriptRoot 'local.brave_lock.json'
$hostConfig = @{
    name = 'local.brave_lock'
    description = 'Brave Lock file renaming helper'
    path = (Join-Path $PSScriptRoot 'BraveLockHost.exe')
    type = 'stdio'
    allowed_origins = @("chrome-extension://$extensionId/")
}
if (!(Test-Path -LiteralPath $hostConfig.path)) {
    throw 'BraveLockHost.exe is missing. Run scripts\Build.ps1 or use the release ZIP.'
}
[IO.File]::WriteAllText($hostManifest, ($hostConfig | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))

# Brave also reads Chromium's Chrome-compatible native host registration.
$keyPath = 'Software\Google\Chrome\NativeMessagingHosts\local.brave_lock'
$key = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($keyPath)
try { $key.SetValue('', $hostManifest, [Microsoft.Win32.RegistryValueKind]::String) } finally { $key.Dispose() }

Write-Host ''
Write-Host 'Brave Lock helper registered for this Windows user.'
Write-Host 'Developed by Anti-furry-cloud'
Write-Host ''
Write-Host '1. Open brave://extensions and turn on Developer mode.'
Write-Host '2. Choose Load unpacked and select this folder:'
Write-Host "   $extension"
Write-Host '3. Open the extension popup. It should say Helper connected.'
Write-Host ''
Write-Host "Extension ID: $extensionId"
Write-Host 'If an older copy is installed, remove it before loading this one.'
Write-Host 'Keep this folder in place. Moving it breaks the helper registration.'
