param(
  $database = "master",
  # Content source root. Leave blank to choose at runtime from /sitecore/media library/Migration first-level children
  [string]$ContentFolder = "",
  # Root under which to populate the runtime dropdown (first-level children). Default is the Migration root.
  [string]$MigrationSelectionRoot = "/sitecore/media library/Migration",
    [string]$ParentPath    = "master:/sitecore/content/Bayer/Corporate/bayer-uk/Home/Develop/Migration",
    [string]$BranchTemplateId = "{60112A08-0BEA-44D6-A38C-69CDC3DC7FCB}",

    # Full component mapping (static for now)
  [string]$ComponentMappingJson = @"
{
  "components": {
    "HTML Editor": {
      "renderingId": "{915F1CA3-F285-404D-AD81-B8032690208A}",
      "datasourceTemplateId": "{3859AE1B-B1E1-4A53-A38D-B865512DE58A}",
      "fieldMappings": {
        "html": "HTMLBlock",
        "text": "HTMLBlock"
      }
    },
    "Jumbotron": {
      "renderingId": "{66E43373-6D9F-4206-A8FA-5D5B15364403}",
      "datasourceTemplateId": "{2D418647-C7ED-4366-8668-087B804D87A4}",
      "fieldMappings": {
        "title": "PrimaryOverlayText",
        "image": "Image"
      }
    },
    "JumbotronWithoutImage": {
      "renderingId": "{3406E6D5-C93F-4E1F-8796-B28E72FA7FB3}",
      "datasourceTemplateId": "{5707290A-C8B6-4CD0-A98E-776BE2F5ABBF}",
      "fieldMappings": {
        "title": "HeadlineText",
        "{4DC3F8E9-D887-4CFE-A7D2-78F8FFFF14BC}": "HeadingTagLevel"
      }
    },
    "Mini Banner": {
      "renderingId": "{66E43373-6D9F-4206-A8FA-5D5B15364403}",
      "datasourceTemplateId": "{2D418647-C7ED-4366-8668-087B804D87A4}",
      "fieldMappings": {
        "title": "PrimaryOverlayText",
        "image": "Image"
      }
    },
    "Quote": {
      "renderingId": "{4DD9DAD8-290D-4326-8176-3A9C5F09893B}",
      "datasourceTemplateId": "{B62B51CD-8090-4B06-B45A-B945AD24C640}",
      "fieldMappings": {
        "text": "QuoteText",
        "author": "AuthorName",
        "designation": "AuthorDesignation"
      }
    },
    "Text With Image": {
      "renderingId": "{4C206E7C-C3D1-4637-BBEC-D6DC3274EB6D}",
      "datasourceTemplateId": "{D60BB58E-AF3D-49FF-8CEB-4FFF1D3C97FE}",
      "fieldMappings": {
        "title": "Heading",
        "html": "BodyContent",
        "image": "Image"
      }
    }
  }
}
"@,
  [switch]$DryRun,
  [switch]$UploadToMedia
)

# --- Helper Functions ---
function Get-JsonFromMedia([string]$path) {
  # Retained for backward compatibility when reading from media library
  $mediaItem = Get-Item -Path $path
  $media = New-Object Sitecore.Data.Items.MediaItem($mediaItem)
  $reader = New-Object System.IO.StreamReader($media.GetMediaStream())
  try { return ($reader.ReadToEnd() | ConvertFrom-Json) }
  finally { $reader.Close() }
}

function Get-JsonFromFile([string]$path) {
  try {
    $raw = Get-Content -Path $path -Raw -ErrorAction Stop
    return $raw | ConvertFrom-Json
  }
  catch {
    Write-Host "❌ Failed to read or parse JSON file: $path - $_" -ForegroundColor Red
    return $null
  }
}

function Collect-Components($node, [array]$targetTypes) {
  # Recursively walk the JSON object/array and return objects that have a 'type' matching targetTypes
  $found = @()
  if ($null -eq $node) { return $found }

  if ($node -is [System.Collections.IEnumerable] -and -not ($node -is [string])) {
    foreach ($child in $node) {
      $found += (Collect-Components $child $targetTypes)
    }
    return $found
  }

  if ($node.PSObject -and $node.PSObject.Properties['type']) {
    # Some nodes are container/layout nodes (not renderable components) e.g. 'Three Columns'.
    # Treat them as containers: continue traversing children but do NOT collect them as standalone components.
    $nodeType = [string]$node.type
    $containerTypes = @('three columns')
    if (-not [string]::IsNullOrWhiteSpace($nodeType)) {
      if (-not ($containerTypes -contains $nodeType.ToLower())) {
        # Collect any object that has a 'type' property so unmapped components can be handled by fallback code
        $found += $node
      }
      else {
        Write-Verbose "Skipping container-type node: $nodeType"
      }
    }
  }

  # Walk all properties on object
  foreach ($prop in $node.PSObject.Properties) {
    $val = $prop.Value
    if ($val -is [System.Management.Automation.PSObject] -or ($val -is [System.Collections.IEnumerable] -and -not ($val -is [string]))) {
      $found += (Collect-Components $val $targetTypes)
    }
  }

  return $found
}

# Shared processing for a parsed JSON object (file or media)
function Process-JsonObject($json, $sourceLabel) {

  # Page creation from metadata.title (or fall back to source label)
  $title = $null
  if ($json.metadata -and $json.metadata.title) { $title = $json.metadata.title }
  $originalFullTitle = $title
  # Remove trailing site suffix variants like '| Bayer United Kingdom' / '- Bayer United Kingdom' / 'Bayer United Kingdom'
  if ($title) {
    $before = $title
    # Robust single regex: optional separator (| or -) with surrounding whitespace before the phrase
    $title = $title -replace '(?i)(?:\s*[|\-])?\s*Bayer United Kingdom\s*$', ''
    if ([string]::IsNullOrWhiteSpace($title)) { $title = $before } # don't allow full wipe-out
  }
  if (-not $title) { $title = $sourceLabel }
  $finalName = Sanitize-Name $title
  $targetPath = "$ParentPath/$finalName"
  if ($DryRun) {
    Write-Host "(DryRun) Target page path would be: $targetPath" -ForegroundColor Cyan
    $createdItem = $null
    $dataFolder = $null
  }
  else {
    $createdItem = Get-Item -Path $targetPath -ErrorAction SilentlyContinue
    if (-not $createdItem) {
      $createdItem = New-Item -Path $ParentPath -Name $finalName -ItemType $BranchTemplateId -ErrorAction Stop
      # If we altered the title (removed suffix) set the display name to the cleaned title (so tree shows suffix-free value)
      if ($originalFullTitle -and ($originalFullTitle -ne $finalName)) {
        try { $createdItem.Editing.BeginEdit(); $createdItem["__Display name"] = $title; $createdItem.Editing.EndEdit() } catch { Write-Host "Warning: failed to set display name: $_" -ForegroundColor Yellow }
      }
      Write-Host "Created page: $($createdItem.Paths.FullPath)" -ForegroundColor Cyan
    }

    # Ensure Data folder
    $dataFolderPath = "$($createdItem.Paths.FullPath)/This Page"
    $dataFolder = Get-Item -Path $dataFolderPath -ErrorAction SilentlyContinue
    if (-not $dataFolder) {
      $dataFolder = New-Item -Path $createdItem.Paths.FullPath -Name "This Page" -ItemType "Common/Folder"
    }
  }

  # Collect components anywhere in the JSON that match our mapping (recursively)
  $componentsFound = Collect-Components -node $json -targetTypes $targetTypes
  if ($componentsFound.Count -eq 0) {
    Write-Host "No supported components found in $sourceLabel, skipping." -ForegroundColor DarkYellow
    return
  }

  $index = 1
  foreach ($comp in $componentsFound) {
  $compType = [string]$comp.type
  # Normalize and trim to avoid hidden/extra whitespace issues
  $norm = $compType.Trim() -replace '\s+', ' '
  $normKey = $norm.ToLower()
  $mapping = $null
  if ($componentLookup.ContainsKey($normKey)) { $mapping = $componentLookup[$normKey] }
  $usingJumbotronNoImage = $false
  # Conditional swap: if original type is Jumbotron but image is missing/empty, use JumbotronWithoutImage mapping (if configured)
  if ($normKey -eq 'jumbotron') {
    $hasImage = $false
    if ($comp.PSObject.Properties['image']) {
      $imgVal = $comp.image
      # If image object holds src property, use that
      if ($imgVal -and $imgVal.PSObject.Properties['src']) { $imgVal = $imgVal.src }
      if (-not [string]::IsNullOrWhiteSpace([string]$imgVal)) { $hasImage = $true }
    }
    if (-not $hasImage -and $componentMapping.components.JumbotronWithoutImage) {
      $mapping = $componentMapping.components.JumbotronWithoutImage
      $usingJumbotronNoImage = $true
      Write-Verbose "Switching Jumbotron without image to JumbotronWithoutImage mapping"
    }
  }
  Write-Verbose "Component detected: '$compType' -> mapping found: $([bool]($mapping))"
    if (-not $mapping) {
      # No mapping: create a fallback HTML Block datasource containing the raw component JSON
      Write-Host "⚠ No mapping for component type: $compType - creating fallback HTML Block datasource" -ForegroundColor Yellow

      $dsName = Sanitize-Name("HTML-Block-$index")
      try { $rawJson = $comp | ConvertTo-Json -Depth 10 } catch { $rawJson = [string]$comp }

      # Determine fallback mapping (HTML Editor) and field to write into
      $fallback = $componentMapping.components.'HTML Editor'
      if (-not $fallback) { Write-Host "No HTML Editor fallback configured; skipping component: $compType" -ForegroundColor Yellow; $index++; continue }
      $fallbackField = 'HTMLBlock'
      try { $firstProp = $fallback.fieldMappings.PSObject.Properties | Select-Object -First 1; if ($firstProp -and $firstProp.Value) { $fallbackField = $firstProp.Value } } catch { }

      # Notice HTML (bold + larger) with actual component name
      $notice = "<p style='font-size:18px; font-weight:bold;'>$compType is not available yet. HTML Block is added temporarily with json</p><hr/>\n"

      if ($DryRun) {
        Write-Host "(DryRun) Would create fallback HTML Block datasource: $dsName of template $($fallback.datasourceTemplateId)" -ForegroundColor Green
        Write-Host "    $fallbackField = $notice<pre>$rawJson</pre>" -ForegroundColor DarkGreen
        Write-Host "(DryRun) Would add rendering: $($fallback.renderingId) datasource=$dsName placeholder=/headless-main/1col-w100-1" -ForegroundColor Cyan
        $index++
        continue
      }

      if (-not $dataFolder) {
        Write-Host "No Data folder available for page; cannot create fallback datasource for $compType" -ForegroundColor DarkYellow
        $index++
        continue
      }

      $dsItem = $null
      try {
        $dsItem = New-Item -Path $dataFolder.Paths.FullPath -Name $dsName -ItemType $fallback.datasourceTemplateId -ErrorAction Stop
      } catch { Write-Host ("Failed to create fallback datasource " + $dsName + ": " + $_) -ForegroundColor Red }

      if (-not $dsItem) { Write-Host "Could not create fallback datasource $dsName; skipping component $compType" -ForegroundColor Yellow; $index++; continue }

      try { $dsItem.Editing.BeginEdit() } catch { Write-Host ("Failed to begin edit on datasource " + $dsName + ": " + $_) -ForegroundColor Red }
      try { $dsItem[$fallbackField] = $notice + "<pre>" + $rawJson + "</pre>" } catch { $dsItem[$fallbackField] = [string]($notice + "<pre>" + $rawJson + "</pre>") }
      try { $dsItem.Editing.EndEdit() } catch { Write-Host ("Failed to end edit on datasource " + $dsName + ": " + $_) -ForegroundColor Red }
      Write-Host "✅ Created fallback HTML Block datasource: $dsName" -ForegroundColor Green

      # Add HTML Editor rendering to the page
      try {
        $createdItem.Editing.BeginEdit()
        $layoutField = New-Object Sitecore.Data.Fields.LayoutField $createdItem.Fields["__Renderings"]
        $layoutDef = [Sitecore.Layouts.LayoutDefinition]::Parse($layoutField.Value)
        $device = $layoutDef.Devices[0]
        $rendering = New-Object Sitecore.Layouts.RenderingDefinition
        $rendering.ItemID = $fallback.renderingId
        if ($dsItem -ne $null) { $rendering.Datasource = $dsItem.ID.ToString() }
        $rendering.Placeholder = "/headless-main/1col-w100-1"
        $device.AddRendering($rendering)
        $layoutField.Value = $layoutDef.ToXml()
        $createdItem.Editing.EndEdit()
        Write-Host "➕ Added fallback rendering for $dsName" -ForegroundColor Cyan
      } catch { Write-Host ("Failed to add fallback rendering for " + $dsName + ": " + $_) -ForegroundColor Red }

      $index++
      continue
    }

    $dsName = Sanitize-Name("$compType-$index")

    # Prepare mapped values for datasource
    $mapped = @{}
    foreach ($map in $mapping.fieldMappings.PSObject.Properties) {
      $jsonField = $map.Name
      $scField   = $map.Value
      $value = $null
      if ($comp.PSObject.Properties[$jsonField]) { $value = $comp.$jsonField }
      if ($value -and $value.PSObject.Properties['src']) { $value = $value.src }
      if ($null -ne $value) {
        if ($value -is [System.Collections.IEnumerable] -and -not ($value -is [string])) {
          try { $value = ($value -join ", ") } catch { $value = [string]$value }
        }
        $mapped[$scField] = $value
      }
    }

      # Inject constant field value for HeadingTagLevel when using the no-image Jumbotron mapping (GUID provided in mapping as pseudo key)
      if ($usingJumbotronNoImage) {
        if (-not $mapped.ContainsKey('HeadingTagLevel')) { $mapped['HeadingTagLevel'] = '{4DC3F8E9-D887-4CFE-A7D2-78F8FFFF14BC}' }
      }

    if ($DryRun) {
      Write-Host "(DryRun) Would create datasource: $dsName of template $($mapping.datasourceTemplateId)" -ForegroundColor Green
      foreach ($k in $mapped.Keys) { Write-Host "    $k = $($mapped[$k])" }
      Write-Host "(DryRun) Would add rendering: $($mapping.renderingId) datasource=$dsName placeholder=/headless-main/1col-w100-1" -ForegroundColor Cyan
    }
    else {
      $dsItem = New-Item -Path $dataFolder.Paths.FullPath -Name $dsName -ItemType $mapping.datasourceTemplateId -ErrorAction Stop
      $dsItem.Editing.BeginEdit()
      foreach ($k in $mapped.Keys) { $dsItem[$k] = $mapped[$k] }
      $dsItem.Editing.EndEdit()
      Write-Host "✅ Created datasource: $dsName" -ForegroundColor Green

      # Add rendering to page layout
      $createdItem.Editing.BeginEdit()
      $layoutField = New-Object Sitecore.Data.Fields.LayoutField $createdItem.Fields["__Renderings"]
      $layoutDef = [Sitecore.Layouts.LayoutDefinition]::Parse($layoutField.Value)
      $device = $layoutDef.Devices[0]
      $rendering = New-Object Sitecore.Layouts.RenderingDefinition
      $rendering.ItemID = $mapping.renderingId
      $rendering.Datasource = $dsItem.ID.ToString()
      $rendering.Placeholder = "/headless-main/1col-w100-1"
      $device.AddRendering($rendering)
      $layoutField.Value = $layoutDef.ToXml()
      $createdItem.Editing.EndEdit()

      Write-Host "➕ Added rendering for $dsName" -ForegroundColor Cyan
      
  # No child collection handling here; unmapped or collection components will fall back to HTML Block handling
    }
    $index++
  }
}

function Sanitize-Name($name) {
  $original = [string]$name
  $s = [string]$name
  # Remove obviously disallowed filesystem-style chars first
  $s = $s -replace '[\\\/:*?"<>|]', ''
  # Replace ANY char not allowed by Sitecore ItemNameValidation pattern with a space (except we'll handle first char separately)
  # Allowed overall after first char: [\w\s\-\$]; we also allow * anywhere per pattern (pattern allows only at first char technically, but keep for safety)
  $s = $s -replace "[^\w\s\-\$*]", ' '
  # Collapse multiple whitespace
  $s = $s -replace '\s+', ' '
  $s = $s.Trim()
  if (-not $s) { $s = 'Migrated-' + [System.Guid]::NewGuid().ToString('N').Substring(0,8) }
  # Ensure first char is valid: [\w*$]
  if ($s[0] -notmatch '[\w\*\$]') { $s = 'X' + $s }
  # Truncate
  if ($s.Length -gt 90) { $s = $s.Substring(0,90) }
  # Final safety pass: strip any remaining invalid characters so we satisfy ^[\w\*\$][\w\s\-\$]*(\(\d{1,}\)){0,1}$
  if ($s -notmatch '^[\w\*\$][\w\s\-\$]*(\(\d{1,}\)){0,1}$') {
    # Remove invalid chars globally (retain allowed)
    $chars = New-Object System.Text.StringBuilder
    for ($i=0; $i -lt $s.Length; $i++) {
      $c = $s[$i]
      if ($i -eq 0) {
        if ($c -match '[\w\*\$]') { $null = $chars.Append($c) } else { $null = $chars.Append('X') }
      } else {
        if ($c -match '[\w\s\-\$]') { $null = $chars.Append($c) } # else skip
      }
    }
    $s = $chars.ToString().Trim()
    if (-not $s) { $s = 'Migrated-' + [System.Guid]::NewGuid().ToString('N').Substring(0,8) }
  }
  if ($original -ne $s) { Write-Verbose "Sanitized item name from '$original' to '$s'" }
  return $s
}

# --- MAIN EXECUTION ---
try {
  # Runtime selection: show EXACTLY ONE popup (item picker) if no ContentFolder provided.
  if ([string]::IsNullOrWhiteSpace($ContentFolder)) {
    $migrationRoot = $MigrationSelectionRoot; if ([string]::IsNullOrWhiteSpace($migrationRoot)) { $migrationRoot = "/sitecore/media library/Migration" }
    $rootItem = Get-Item -Path $migrationRoot -ErrorAction SilentlyContinue
    if (-not $rootItem) { throw "Migration selection root not found: $migrationRoot" }

    # Ensure any stale variable from previous runs is cleared so we can reliably detect cancel.
    Remove-Variable -Name SelectedFolder -ErrorAction SilentlyContinue
    try {
      $null = Read-Variable -Parameters @{ Name='SelectedFolder'; Title='Pick folder'; Editor='Item'; Root=$migrationRoot } -Title 'Migration Folder Picker' -Description 'Pick the migration folder.' -Width 600 -OkButtonName 'Select' -CancelButtonName 'Cancel'
    } catch { throw "Failed to open folder picker: $_" }

    # SPE places the chosen value into $SelectedFolder (can be an Item object, an ID, or a path). If user cancels it remains unset/null.
    if (-not $SelectedFolder) { throw "No folder selected. Aborting import." }

    $itm = $null
    if ($SelectedFolder -is [Sitecore.Data.Items.Item]) {
      $itm = $SelectedFolder
    }
    elseif ($SelectedFolder -is [string]) {
      $selString = $SelectedFolder.Trim()
      if ($selString -match '^{[0-9A-Fa-f-]+}$') {
        $itm = Get-Item -ID $selString -ErrorAction SilentlyContinue
        if (-not $itm) { throw "Selected item id $selString could not be resolved." }
      }
      else {
        # Could be a path or name; try direct path lookup then fallback to child name under root
        $itm = Get-Item -Path $selString -ErrorAction SilentlyContinue
        if (-not $itm -and $selString -notmatch '^/sitecore') {
          $itm = Get-ChildItem -Path $migrationRoot -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq $selString } | Select-Object -First 1
        }
        if (-not $itm) { throw "Selected value '$selString' could not be resolved to an item." }
      }
    }
    else {
      throw "Unexpected selection type: $($SelectedFolder.GetType().FullName)"
    }

    # Prevent accidental selection of the root itself (default highlight) – force user to pick a child.
    if ($rootItem -and $itm -and ($itm.ID -eq $rootItem.ID)) {
      throw "No folder selected. Please pick a child folder under the Migration root."
    }

    # Folder validation (relaxed): accept if PSIsContainer OR template name contains 'folder' OR has at least one child.
    $validFolder = $false
    try {
      if ($itm.PSIsContainer) { $validFolder = $true }
      elseif ($itm.TemplateName -and ($itm.TemplateName -match '(?i)folder')) { $validFolder = $true }
      elseif ((Get-ChildItem -Path $itm.Paths.FullPath -ErrorAction SilentlyContinue | Select-Object -First 1)) { $validFolder = $true }
    } catch {}
    if (-not $validFolder) {
      Write-Host "Warning: Selected item not clearly a folder; proceeding anyway: $($itm.Paths.FullPath)" -ForegroundColor Yellow
    }

    $ContentFolder = $itm.Paths.FullPath
    Write-Host "Selected migration folder: $ContentFolder" -ForegroundColor Cyan
  }

  # If ContentFolder is a Sitecore provider path, avoid Test-Path which may not be available
  if ($ContentFolder -match '^(master:|sitecore:|/sitecore)') {
    try {
      $probe = Get-Item -Path $ContentFolder -ErrorAction SilentlyContinue
    }
    catch {
      $probe = $null
    }
    if (-not $probe) {
      Write-Host "Warning: Sitecore path not found or Sitecore provider not available: $ContentFolder" -ForegroundColor Yellow
      # continue — enumeration will be attempted but may fail if provider absent
    }
  }
  else {
    if (-not (Test-Path -Path $ContentFolder)) {
      throw "Content folder not found: $ContentFolder"
    }
  }

  $componentMapping = $ComponentMappingJson | ConvertFrom-Json
  # Only target the component types defined in the static mapping
  $targetTypes = @($componentMapping.components.PSObject.Properties.Name)
  # Build a normalized lookup (trim + lower) to robustly match component names from JSON
  $componentLookup = @{}
  foreach ($p in $componentMapping.components.PSObject.Properties) {
    $key = $p.Name.Trim().ToLower()
    if (-not $componentLookup.ContainsKey($key)) { $componentLookup[$key] = $p.Value }
  }
  # If requested, allow uploading JSON files into media library TempFiles using Receive-File
  if ($UploadToMedia) {
    Write-Host "Opening Receive-File dialog to upload JSON files to media library TempFiles..." -ForegroundColor Cyan
    # This will prompt the user to upload files into master:/sitecore/media library/TempFiles
    Receive-File (Get-Item "master:/sitecore/media library/TempFiles") -AdvancedDialog

    # Let user pick which uploaded media item(s) to process
    $result = Read-Variable -Parameters `
        @{ Name = "fileName"; Title="JSON File Name";},
        @{ Name = "language"; Title="Select Language"; Root="/sitecore/system/Languages"; Editor="item" } `
        -Description "Enter JSON File Name from TempFiles (exact name) and select language." `
        -Title "Select uploaded JSON" -Width 650 -Height 250 -OkButtonName "Proceed" -CancelButtonName "Abort"

    if (-not $result) { Write-Host "Upload canceled." -ForegroundColor Yellow; return }

    $filePath =  "master:/sitecore/media library/TempFiles/" + $result.fileName
    $media = Get-Item -Path $filePath
    if (-not $media) { throw "Uploaded media item not found: $filePath" }

    [System.IO.Stream]$body = $media.Fields["Blob"].GetBlobStream()
    try {
      $contents = New-Object byte[] $body.Length
      $body.Read($contents, 0, $body.Length) | Out-Null
    }
    finally {
      $body.Close()
    }

    $jsonText = [System.Text.Encoding]::Default.GetString($contents)
    try { $jsonObj = $jsonText | ConvertFrom-Json } catch { throw "Uploaded file is not valid JSON: $_" }

    Process-JsonObject -json $jsonObj -sourceLabel $result.fileName
    # After processing, optionally delete the uploaded temp file or leave for auditing
    Write-Host "Finished processing uploaded JSON media: $($result.fileName)" -ForegroundColor Green
  }
  else {
    # Support both filesystem folders and Sitecore media library paths
    if ($ContentFolder -match '^(master:|sitecore:|/sitecore)') {
      Write-Host "Enumerating Sitecore media items under: $ContentFolder" -ForegroundColor Cyan
      $items = Get-ChildItem -Path $ContentFolder -Recurse
      Write-Host "Found $($items.Count) items under: $ContentFolder" -ForegroundColor Cyan
      foreach ($it in $items) {
        # Skip containers/folders
        if ($it.PSIsContainer) { continue }
        # Try to read JSON from media blob; Get-JsonFromMedia will throw if not readable JSON
        try {
          $json = Get-JsonFromMedia -path $it.Paths.FullPath
        }
        catch {
          # Not a JSON media item, skip
          continue
        }
        if ($json) {
          Write-Host "\n--- Processing media: $($it.Paths.FullPath)" -ForegroundColor Yellow
          Process-JsonObject -json $json -sourceLabel $it.Name
        }
      }
    }
    else {
      # Filesystem folder: Find all exported data.json files under the content folder (avoid -File for compatibility)
      $files = Get-ChildItem -Path $ContentFolder -Recurse -Filter data.json | Where-Object { -not $_.PSIsContainer }
      Write-Host "Found $($files.Count) content JSON files under: $ContentFolder" -ForegroundColor Cyan
      foreach ($file in $files) {
        Write-Host "\n--- Processing: $($file.FullName)" -ForegroundColor Yellow
        $json = Get-JsonFromFile -path $file.FullName
        if (-not $json) { continue }
        Process-JsonObject -json $json -sourceLabel $file.FullName
      }
    }
  }

  
}
catch {
  Write-Host "❌ Error: $_" -ForegroundColor Red
}
