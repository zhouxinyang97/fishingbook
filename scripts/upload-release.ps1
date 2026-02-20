Param(
  [Parameter(Mandatory = $false)][string]$Tag = "v2.1.0",
  [Parameter(Mandatory = $false)][string]$Dist = "dist",
  [Parameter(Mandatory = $false)][string]$Repo = "",
  [Parameter(Mandatory = $false)][string]$Title = "",
  [Parameter(Mandatory = $false)][switch]$Draft
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "[ERR ] $msg" -ForegroundColor Red }

$Token = $env:GH_TOKEN
if ([string]::IsNullOrWhiteSpace($Token)) {
  Write-Err "Environment variable GH_TOKEN is required (repo scope)."
  exit 1
}

# Resolve repository owner/name from git remote if not provided
if ([string]::IsNullOrWhiteSpace($Repo)) {
  $remote = (git remote get-url origin) 2>$null
  if (-not $remote) {
    Write-Err "Cannot determine GitHub repo from 'git remote'. Pass -Repo 'owner/name'."
    exit 1
  }
  if ($remote -match "git@github.com:(.+?)(\.git)?$") {
    $Repo = $Matches[1]
  } elseif ($remote -match "https://github.com/(.+?)(\.git)?$") {
    $Repo = $Matches[1]
  }
}
if ([string]::IsNullOrWhiteSpace($Repo)) {
  Write-Err "Failed to parse repository owner/name from remote URL."
  exit 1
}

if (-not (Test-Path $Dist)) {
  Write-Err "Dist path '$Dist' not found."
  exit 1
}

if ([string]::IsNullOrWhiteSpace($Title)) {
  $Title = "FishingBook $Tag"
}

$apiBase = "https://api.github.com"
$commonHeaders = @{
  "Authorization" = "token $Token"
  "Accept"        = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
}

# Ensure release exists (create if missing)
Write-Info "Checking release for tag '$Tag' on $Repo"
$release = $null
try {
  $release = Invoke-RestMethod -Method GET -Headers $commonHeaders -Uri "$apiBase/repos/$Repo/releases/tags/$Tag"
} catch {
  if ($_.Exception.Response.StatusCode.Value__ -eq 404) {
    Write-Info "Release not found. Creating new release for tag '$Tag'."
    $body = @{
      tag_name   = $Tag
      name       = $Title
      draft      = [bool]$Draft
      prerelease = $false
    } | ConvertTo-Json
    $release = Invoke-RestMethod -Method POST -Headers $commonHeaders -Uri "$apiBase/repos/$Repo/releases" -Body $body
  } else {
    throw
  }
}

if (-not $release) {
  Write-Err "Failed to resolve or create release for tag '$Tag'."
  exit 1
}

$uploadUrlTemplate = $release.upload_url # e.g. https://uploads.github.com/repos/{owner}/{repo}/releases/{id}/assets{?name,label}
$uploadBase = $uploadUrlTemplate -replace "\{\?name,label\}$",""

$files = Get-ChildItem -File -Path $Dist
if ($files.Count -eq 0) {
  Write-Warn "No files found under '$Dist'. Nothing to upload."
  exit 0
}

foreach ($f in $files) {
  $name = $f.Name
  $url  = "$uploadBase?name=$([uri]::EscapeDataString($name))"
  Write-Info "Uploading '$name'..."
  try {
    Invoke-WebRequest -Method POST `
      -Headers (@{ Authorization = "token $Token"; "Content-Type" = "application/octet-stream"; "Accept" = "application/vnd.github+json" }) `
      -Uri $url `
      -InFile $f.FullName | Out-Null
    Write-Host "  -> OK" -ForegroundColor Green
  } catch {
    if ($_.Exception.Response.StatusCode.Value__ -eq 422) {
      Write-Warn "  -> Asset exists. Re-uploading (delete then upload)."
      # Find existing asset ID and delete it, then retry
      $assets = Invoke-RestMethod -Method GET -Headers $commonHeaders -Uri "$apiBase/repos/$Repo/releases/$($release.id)/assets"
      $asset  = $assets | Where-Object { $_.name -eq $name }
      if ($asset) {
        Invoke-RestMethod -Method DELETE -Headers $commonHeaders -Uri "$apiBase/repos/$Repo/releases/assets/$($asset.id)" | Out-Null
        Invoke-WebRequest -Method POST `
          -Headers (@{ Authorization = "token $Token"; "Content-Type" = "application/octet-stream"; "Accept" = "application/vnd.github+json" }) `
          -Uri $url `
          -InFile $f.FullName | Out-Null
        Write-Host "  -> Replaced" -ForegroundColor Green
      } else {
        Write-Err "  -> 422 received but asset not found via API."
        throw
      }
    } else {
      throw
    }
  }
}

Write-Info "All assets uploaded to release '$Tag'."

