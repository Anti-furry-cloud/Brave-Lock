$ErrorActionPreference = 'Stop'
$keyPath = 'Software\Google\Chrome\NativeMessagingHosts\local.brave_lock'
$key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($keyPath)
if ($key) {
    try { $registered = [string]$key.GetValue('') } finally { $key.Dispose() }
    $expected = Join-Path $PSScriptRoot 'local.brave_lock.json'
    if ($registered -ine $expected) {
        throw 'The registered helper belongs to another folder. Run Uninstall.cmd from that folder.'
    }
    [Microsoft.Win32.Registry]::CurrentUser.DeleteSubKey($keyPath)
}
$hostManifest = Join-Path $PSScriptRoot 'local.brave_lock.json'
if (Test-Path -LiteralPath $hostManifest) { Remove-Item -LiteralPath $hostManifest }
Write-Host 'Helper registration removed. You can now remove Brave Lock from brave://extensions.'
Write-Host 'Downloaded files have not been changed.'
