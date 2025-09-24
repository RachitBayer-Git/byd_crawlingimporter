# Excel Transformation Script

This Node.js script transforms a media ouput file from Drupal into the format requited for Content hub Import.

## Features

- ✅ Reads given Excel sheet
- ✅ Transforms data according to Content Hub Import requirements
- ✅ Sets required constant values for FinalLifeCycleStatusToAsset, ContentRepositoryToAsset, and BayerTags
- ✅ Maps source columns to target format
- ✅ Validates output against reference format
- ✅ Generates detailed transformation report

## Usage

### Method 1: Using npm script (recommended)
```bash
npm run transform Inputfile
```

## Input/Output

**Input File:** `Asset Migration/Media Images.xlsx`
- Sheet: MediaImage
- Contains 12 columns with Drupal media data

**Output File:** `Asset Migration/Content Hub Import File - Generated.xlsx`
- Sheet: M.Asset
- Contains 9 columns in Content Hub format

## Column Mapping

| Target Column | Source Column | Value |
|---------------|---------------|-------|
| FinalLifeCycleStatusToAsset | - | `M.Final.LifeCycle.Status.Created` (constant) |
| ContentRepositoryToAsset | - | `M.Content.Repository.Standard` (constant) |
| BayerTags | - | `Bayer.Assets.tags.ImportedfromDrupal` (constant) |
| DrupalMediaID | Drupal Media ID | Mapped from source |
| DrupalImageID | Drupal Image ID | Mapped from source |
| Title | Alt Text → FileName | Uses Alt Text if available, otherwise falls back to FileName |
| FileName | FileName | Mapped from source |
| File | DrupalUrl | Mapped from source |
| ImportUrls | DrupalUrl | Mapped from source |

## Requirements

- Node.js (v14 or higher)
- Dependencies: `xlsx` package (already installed)

## Script Features

- **Input validation**: Checks if source file exists
- **Smart title handling**: Uses Alt Text when available, falls back to FileName to ensure titles are always populated
- **Format validation**: Ensures output matches expected format
- **Progress reporting**: Shows detailed transformation progress including title source statistics
- **Error handling**: Provides clear error messages

## Output Validation

The script automatically validates:
- ✅ Column headers match exactly
- ✅ Row count matches source data
- ✅ Constant values are correctly applied
- ✅ Data mapping is successful

## Dependencies

This script uses the existing project dependencies:
- `xlsx` - For reading and writing Excel files
- Standard Node.js modules (fs, path)