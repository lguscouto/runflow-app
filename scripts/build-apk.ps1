# RunFlow — gera APK de debug
# Uso: .\scripts\build-apk.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

function Find-AndroidSdk {
    $candidates = @(
        $env:ANDROID_HOME,
        "$env:LOCALAPPDATA\Android\Sdk",
        "$env:USERPROFILE\AppData\Local\Android\Sdk"
    ) | Where-Object { $_ -and (Test-Path "$_\platform-tools\adb.exe") }
    if ($candidates) { return $candidates[0] }

    $searchRoots = @(
        "$env:LOCALAPPDATA\Android",
        "C:\Program Files\Android",
        "D:\Android"
    )
    foreach ($root in $searchRoots) {
        if (-not (Test-Path $root)) { continue }
        $adb = Get-ChildItem -Path $root -Recurse -Filter "adb.exe" -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -match "platform-tools" } |
            Select-Object -First 1
        if ($adb) {
            return $adb.Directory.Parent.FullName
        }
    }
    return $null
}

function Find-JavaHome {
    if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin\java.exe")) {
        return $env:JAVA_HOME
    }
    $candidates = @(
        "C:\Program Files\Android\Android Studio\jbr",
        "C:\Program Files\Android\Android Studio\jre",
        "${env:ProgramFiles(x86)}\Android\Android Studio\jbr"
    )
    foreach ($p in $candidates) {
        if (Test-Path "$p\bin\java.exe") { return $p }
    }
    $java = Get-Command java -ErrorAction SilentlyContinue
    if ($java) {
        return (Split-Path (Split-Path $java.Source -Parent) -Parent)
    }
    return $null
}

Write-Host "==> Build web + sync Capacitor..." -ForegroundColor Cyan
npm run build:mobile
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$sdk = Find-AndroidSdk
$java = Find-JavaHome

if (-not $sdk) {
    Write-Host ""
    Write-Host "ERRO: Android SDK nao encontrado." -ForegroundColor Red
    Write-Host ""
    Write-Host "Faca isto no Android Studio (primeira vez):" -ForegroundColor Yellow
    Write-Host "  1. Abra o Android Studio"
    Write-Host "  2. More Actions -> SDK Manager (ou File -> Settings -> Android SDK)"
    Write-Host "  3. Instale: Android SDK Platform + Build-Tools (API 34 ou 35)"
    Write-Host "  4. SDK path padrao: $env:LOCALAPPDATA\Android\Sdk"
    Write-Host ""
    Write-Host "Depois rode de novo: .\scripts\build-apk.ps1"
    Write-Host "Ou abra o projeto: npm run cap:android"
    exit 1
}

if ($java) {
    $env:JAVA_HOME = $java
    $env:PATH = "$java\bin;$env:PATH"
    Write-Host "==> JAVA_HOME: $java" -ForegroundColor Gray
}

$env:ANDROID_HOME = $sdk
$localProps = Join-Path $Root "android\local.properties"
"sdk.dir=$($sdk -replace '\\','\\')" | Set-Content -Path $localProps -Encoding UTF8
Write-Host "==> SDK: $sdk" -ForegroundColor Gray
Write-Host "==> Gradle assembleDebug..." -ForegroundColor Cyan

Set-Location (Join-Path $Root "android")
& .\gradlew.bat assembleDebug
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$apk = Join-Path $Root "android\app\build\outputs\apk\debug\app-debug.apk"
Write-Host ""
Write-Host "APK gerado com sucesso!" -ForegroundColor Green
Write-Host $apk
Write-Host ""
Write-Host "Copie para o celular e instale, ou use: adb install `"$apk`""
