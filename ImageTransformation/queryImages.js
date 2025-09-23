import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env.local') });

/**
 * Query Content Hub for assets by URL
 * @param {string} url - The URL to search for in the Content Hub
 * @param {boolean} verbose - Whether to log detailed information (default: false)
 * @returns {Promise<Object>} - Object containing asset data and relativeUrl
 */
export async function queryImagesByUrl(url, verbose = false) {
  try {
    // Read the GraphQL query from file
    const queryPath = path.join(__dirname, 'getImagesByUrl.graphql');
    const query = fs.readFileSync(queryPath, 'utf8');
    
    if (verbose) {
      console.log('Using URL:', url);
      console.log('GraphQL Endpoint:', `${process.env.CONTENT_HUB_BASE_URL}${process.env.CONTENT_HUB_API_URL}`);
    }
    
    // Prepare the GraphQL request
    const requestBody = {
      query: query,
      variables: {
        url: url
      }
    };
    
    // Make the GraphQL request
    const response = await fetch(`${process.env.CONTENT_HUB_BASE_URL}${process.env.CONTENT_HUB_API_URL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GQL-Token': process.env.CONTENT_HUB_API_KEY
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    // Check for GraphQL errors
    if (result.errors) {
      throw new Error(`GraphQL errors: ${result.errors.map(e => e.message).join(', ')}`);
    }
    
    // Extract data
    const assets = result.data?.allM_Asset?.results || [];
    
    // Get the relativeUrl from the first asset's first public link
    let relativeUrl = null;
    if (assets.length > 0 && assets[0].assetToPublicLink?.results?.length > 0) {
      relativeUrl = assets[0].assetToPublicLink.results[0].relativeUrl;
    }
    
    if (verbose) {
      console.log('\n=== GraphQL Response ===');
      console.log(JSON.stringify(result, null, 2));
      
      console.log(`\n=== Summary ===`);
      console.log(`Found ${assets.length} asset(s) matching the URL`);
      
      if (relativeUrl) {
        console.log(`Relative URL: ${relativeUrl}`);
      }
      
      assets.forEach((asset, index) => {
        console.log(`\nAsset ${index + 1}:`);
        console.log(`  File Name: ${asset.fileName || 'N/A'}`);
        console.log(`  Copyright: ${asset.asset_Copyright || 'N/A'}`);
        console.log(`  Public Links: ${asset.assetToPublicLink?.total || 0}`);
      });
    }
    
    return {
      success: true,
      assets: assets,
      relativeUrl: relativeUrl,
      totalAssets: assets.length,
      rawResponse: result
    };
    
  } catch (error) {
    if (verbose) {
      console.error('Error executing GraphQL query:', error.message);
    }
    return {
      success: false,
      error: error.message,
      assets: [],
      relativeUrl: null,
      totalAssets: 0,
      rawResponse: null
    };
  }
}

/**
 * Standalone execution function for running the script directly
 */
async function runStandalone() {
  try {
    // Read the test URL from file
    const urlPath = path.join(__dirname, 'testurl.txt');
    const testUrl = fs.readFileSync(urlPath, 'utf8').trim();
    
    const result = await queryImagesByUrl(testUrl, true);
    
    if (!result.success) {
      console.error('Query failed:', result.error);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run standalone if this file is executed directly
if (process.argv[1] && process.argv[1].endsWith('queryImages.js')) {
  runStandalone();
}