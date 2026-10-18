$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (!(Test-Path -LiteralPath $compiler)) {
    $compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'
}
if (!(Test-Path -LiteralPath $compiler)) { throw '.NET Framework 4.x C# compiler not found.' }
$output = Join-Path $root 'native\BraveLockHost.exe'
& $compiler /nologo /target:exe /optimize+ /reference:System.Web.Extensions.dll "/out:$output" (Join-Path $root 'native\NativeHost.cs')
if ($LASTEXITCODE -ne 0) { throw 'Native helper build failed.' }
Write-Host "Built $output"
