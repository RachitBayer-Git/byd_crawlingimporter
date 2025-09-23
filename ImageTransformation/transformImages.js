import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { queryImagesByUrl } from './queryImages.js';

// Track images that were not found in Content Hub during this run
// Structure: Map<filename, Map<sourceUrl, Set<pageUrls>>>
const missingImages = new Map();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Extract filename from URL by removing query parameters and getting the last part of the path
 * @param {string} url - The image URL
 * @returns {string} - The filename
 */
function extractFilename(url) {
  try {
    // Remove query parameters
    const urlWithoutQuery = url.split('?')[0];
    // Get the filename from the path
    const filename = path.basename(urlWithoutQuery);
    return filename;
  } catch (error) {
    console.warn(`Failed to extract filename from URL: ${url}`, error.message);
    return null;
  }
}

/**
 * Check if a string contains an image URL
 * @param {string} str - The string to check
 * @returns {boolean} - True if it contains an image URL
 */
function containsImageUrl(str) {
  if (typeof str !== 'string') return false;
  // Look for common image extensions and bayer domain URLs
  return /\.(jpg|jpeg|png|gif|bmp|webp|svg)/i.test(str) || 
         /bayer.*\.(jpg|jpeg|png|gif|bmp|webp|svg)/i.test(str);
}

/**
 * Find and extract all image URLs from a JSON object recursively
 * @param {any} obj - The object to search
 * @param {string} path - Current path in the object (for debugging)
 * @returns {Array} - Array of objects with {url, path}
 */
function findImageUrls(obj, currentPath = '') {
  const imageUrls = [];
  
  if (typeof obj === 'string') {
    // If the string contains HTML tags, try to extract src/href attributes
    if (/<[^>]+>/.test(obj)) {
      // Find src="..." or src='...' or href="..." or href='...'
      const attrRegex = /(?:src|href)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/ig;
      let match;
      while ((match = attrRegex.exec(obj)) !== null) {
        const candidate = match[1] || match[2] || match[3];
        if (candidate && containsImageUrl(candidate)) {
          imageUrls.push({ url: candidate, path: currentPath });
        }
      }
      // Also capture url(...) patterns in inline CSS
      const cssUrlRegex = /url\((?:"([^\"]+)"|'([^']+)'|([^\)]+))\)/ig;
      while ((match = cssUrlRegex.exec(obj)) !== null) {
        const candidate = match[1] || match[2] || match[3];
        if (candidate && containsImageUrl(candidate)) {
          imageUrls.push({ url: candidate.replace(/^["']|["']$/g, ''), path: currentPath });
        }
      }
    } else if (containsImageUrl(obj)) {
      // Plain string that looks like an image URL — keep as-is
      imageUrls.push({ url: obj, path: currentPath });
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      imageUrls.push(...findImageUrls(item, `${currentPath}[${index}]`));
    });
  } else if (obj && typeof obj === 'object') {
    Object.keys(obj).forEach(key => {
      imageUrls.push(...findImageUrls(obj[key], currentPath ? `${currentPath}.${key}` : key));
    });
  }
  
  return imageUrls;
}

/**
 * Replace image URLs in a JSON object recursively
 * @param {any} obj - The object to transform
 * @param {Map} urlMapping - Map of original URL to relative URL
 * @returns {any} - The transformed object
 */
function replaceImageUrls(obj, urlMapping) {
  if (typeof obj === 'string' && containsImageUrl(obj)) {
    const filename = extractFilename(obj);
    if (filename && urlMapping.has(filename)) {
      const relativeUrl = urlMapping.get(filename);
      console.log(`  Replacing: ${obj} -> ${relativeUrl}`);
      return relativeUrl;
    }
    return obj;
  } else if (Array.isArray(obj)) {
    // Pass through the metadata mapping (arguments[2]) to preserve metadata in nested arrays
    return obj.map(item => replaceImageUrls(item, urlMapping, arguments[2]));
  } else if (obj && typeof obj === 'object') {
    const newObj = {};
    Object.keys(obj).forEach(key => {
      const val = obj[key];
      // If this property is a plain string image, add contentHubImage next to it
      if (typeof val === 'string' && containsImageUrl(val)) {
        const filename = extractFilename(val);
        newObj[key] = val;
        // metadataMapping is expected to be provided as third arg; if present, use it
        // this function will be called with (obj, urlMapping, metadataMapping)
        // but to keep backward compatibility, check arguments
        const metadataMapping = arguments[2];
        if (filename && metadataMapping && metadataMapping.has(filename)) {
          const meta = metadataMapping.get(filename);
          // Special-case meta keys: for 'og:image' and 'twitter:image' create
          // 'og:contentHubImage' and 'twitter:contentHubImage' respectively.
          if (key === 'og:image') {
            newObj['og:contentHubImage'] = meta;
          } else if (key === 'twitter:image') {
            newObj['twitter:contentHubImage'] = meta;
          } else {
            newObj['contentHubImage'] = meta;
          }
        }
      } else {
        newObj[key] = replaceImageUrls(val, urlMapping, arguments[2]);
      }
    });
    return newObj;
  }
  
  return obj;
}

/**
 * Process a single data.json file
 * @param {string} filePath - Path to the data.json file
 * @param {string} outputDir - Output directory for transformed files
 * @param {string} sourceDir - Source directory for calculating relative paths
 * @returns {Promise<Object>} - Processing results
 */
async function processDataJsonFile(filePath, outputDir, sourceDir) {
  console.log(`\nProcessing: ${filePath}`);
  
  try {
    // Read the JSON file
    const jsonContent = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(jsonContent);
    
    // Find all image URLs
    const imageUrls = findImageUrls(data);
    console.log(`Found ${imageUrls.length} image URLs`);
    
    if (imageUrls.length === 0) {
      console.log('No images found, copying file as-is');
      
      // Create output directory structure
      const relativePath = path.relative(sourceDir, filePath);
      const outputPath = path.join(outputDir, relativePath);
      const outputDirPath = path.dirname(outputPath);
      
      if (!fs.existsSync(outputDirPath)) {
        fs.mkdirSync(outputDirPath, { recursive: true });
      }
      
      // Copy file as-is
      fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
      console.log(`✓ Copied file as-is: ${outputPath}`);
      
      return { processed: 0, copied: true, transformedPath: outputPath };
    }
    
    // Extract unique filenames and get their relative URLs
    const urlMapping = new Map();
  const metadataMapping = new Map();
    const uniqueFilenames = new Set();
    const filenameToUrlMap = new Map(); // To track original URLs for each filename
    
    // Determine the page URL (prefer og:url in metadata.meta, fallback to metadata.url)
    const pageUrl = (data && data.metadata && data.metadata.meta && data.metadata.meta['og:url']) || (data && data.metadata && data.metadata.url) || filePath;

    for (const imageRef of imageUrls) {
      const filename = extractFilename(imageRef.url);
      if (filename) {
        uniqueFilenames.add(filename);
        filenameToUrlMap.set(filename, imageRef.url);
        console.log(`  Found image: ${filename} at ${imageRef.path}`);
      }
    }
    
    console.log(`\nLooking up ${uniqueFilenames.size} unique images in Content Hub...`);
    
    // Query Content Hub for each unique filename
    for (const filename of uniqueFilenames) {
      const originalUrl = filenameToUrlMap.get(filename);
      
        const result = await queryImagesByUrl(filename, false);
        
        if (result.success && result.relativeUrl) {
      // Generate a random 8-character hex string for the hash
      const hash = Math.random().toString(16).slice(2, 10).padEnd(8, '0');
      const publicSrc = `${process.env.CONTENT_HUB_BASE_URL}${process.env.CONTENT_HUB_CONTENT_URL}${result.relativeUrl}?v=${hash}`;
      urlMapping.set(filename, publicSrc);

      // Build metadata object
      const assetResult = result.rawResponse?.data?.allM_Asset?.results?.[0] || {};
      const publicLink = assetResult.assetToPublicLink?.results?.[0] || {};
      const fileProps = assetResult.fileProperties?.properties || {};
      const metadata = {
        src: publicSrc,
        // Use the asset's top-level ID as the canonical DAM id. Keep the public link id available as publicLinkId.
        damId: assetResult.id || publicLink.id || null,
        publicLinkId: publicLink.id || null,
        width: fileProps.width || null,
        height: fileProps.height || null,
        alt: assetResult.fileName || null,
        damContentType: 'Image'
      };
      metadataMapping.set(filename, metadata);

      console.log(`    ✓ Found with URL: ${filename} -> ${result.relativeUrl}`);
        } else {
        console.log(`    ✗ Not found in Content Hub: ${filename}`);
        // Keep original URL if not found
        urlMapping.set(filename, originalUrl);
        // Record missing image and where it was referenced, plus page URL
        if (!missingImages.has(filename)) missingImages.set(filename, new Map());
        const srcMap = missingImages.get(filename);
        const srcKey = originalUrl || '<unknown>';
        if (!srcMap.has(srcKey)) srcMap.set(srcKey, new Set());
        srcMap.get(srcKey).add(pageUrl || filePath);
      }
    }
    
    // Transform the data
    console.log(`\nTransforming data...`);
  const transformedData = replaceImageUrls(data, urlMapping, metadataMapping);
    
    // Create output directory structure
    // Calculate relative path from source directory to this file
    const relativePath = path.relative(sourceDir, filePath);
    const outputPath = path.join(outputDir, relativePath);
    const outputDirPath = path.dirname(outputPath);
    
    if (!fs.existsSync(outputDirPath)) {
      fs.mkdirSync(outputDirPath, { recursive: true });
    }
    
    // Write transformed file
    fs.writeFileSync(outputPath, JSON.stringify(transformedData, null, 2));
    console.log(`✓ Saved transformed file: ${outputPath}`);
    
    return { 
      processed: uniqueFilenames.size, 
      found: urlMapping.size,
      transformedPath: outputPath 
    };
    
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return { error: error.message };
  }
}

/**
 * Main function to process all data.json files in the en folder
 */
async function transformAllDataFiles(sourceFolder = 'en') {
  // Resolve the input folder relative to the current working directory, not the script
  const enDir = path.isAbsolute(sourceFolder) ? sourceFolder : path.join(process.cwd(), sourceFolder);
  // The output root will be 'transformed/<root>' where <root> is the last part of the source folder, created in the context (cwd)
  const rootNode = path.basename(path.resolve(enDir));
  const outputDir = path.join(process.cwd(), 'transformed', rootNode);

  console.log('🚀 Starting transformation process...');
  console.log(`Source directory: ${enDir}`);
  console.log(`Output directory: ${outputDir}`);

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Find all data.json files
  const dataJsonFiles = [];

  function findDataJsonFiles(dir) {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        findDataJsonFiles(fullPath);
      } else if (item === 'data.json') {
        dataJsonFiles.push(fullPath);
      }
    }
  }

  findDataJsonFiles(enDir);

  console.log(`\nFound ${dataJsonFiles.length} data.json files to process:`);
  dataJsonFiles.forEach(file => {
    console.log(`  - ${path.relative(__dirname, file)}`);
  });

  // Process each file
  const results = [];
  let totalProcessed = 0;
  let totalFound = 0;

  for (const filePath of dataJsonFiles) {
    const result = await processDataJsonFile(filePath, outputDir, enDir);
    results.push(result);

    if (result.processed) {
      totalProcessed += result.processed;
    }
    if (result.found) {
      totalFound += result.found;
    }
  }

  console.log('\n📊 Transformation Summary:');
  console.log(`Files processed: ${dataJsonFiles.length}`);
  console.log(`Total images processed: ${totalProcessed}`);
  console.log(`Images found in Content Hub: ${totalFound}`);
  console.log(`Output directory: ${outputDir}`);

  // Print missing images summary
  if (missingImages.size > 0) {
    console.log('\n⚠️ Images NOT FOUND in Content Hub:');
    for (const [filename, srcMap] of missingImages.entries()) {
      console.log(`  - ${filename}`);
      for (const [src, pageSet] of srcMap.entries()) {
        console.log(`      full url: ${src}`);
        for (const page of Array.from(pageSet)) {
          console.log(`          referenced on page: ${page}`);
        }
      }
    }
  } else {
    console.log('\n✅ All referenced images were found in Content Hub.');
  }

  const errors = results.filter(r => r.error);
  if (errors.length > 0) {
    console.log(`\n❌ Errors encountered: ${errors.length}`);
    errors.forEach(error => console.log(`  - ${error.error}`));
  }

  console.log('\n✅ Transformation complete!');
}

// Export for module use
export { transformAllDataFiles, processDataJsonFile, findImageUrls, extractFilename };

// Run if executed directly
if (process.argv[1] && process.argv[1].endsWith('transformImages.js')) {
  // Accept folder as first argument, default to 'en'
  const folderArg = process.argv[2] || 'en';
  transformAllDataFiles(folderArg).catch(console.error);
}