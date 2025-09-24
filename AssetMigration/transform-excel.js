import XLSX from 'xlsx';
import path from 'path';

/**
 * Transform Media Images.xlsx to Content Hub Import File.xlsx format
 * @param {string} inputPath - Path to the input Excel file
 */
function transformMediaImagesToContentHub(inputPath) {
    if (!inputPath) {
        console.error('❌ Please provide an input file path as parameter');
        console.error('Usage: node transform-excel.js "path/to/input.xlsx"');
        return false;
    }
    
    console.log(`Starting transformation from ${path.basename(inputPath)} to Content Hub Import File format...\n`);
    
    // Generate output file path with " CH" suffix
    const inputDir = path.dirname(inputPath);
    const inputName = path.basename(inputPath, path.extname(inputPath));
    const inputExt = path.extname(inputPath);
    const outputPath = path.join(inputDir, `${inputName} CH${inputExt}`);
    
    // Check if input file exists
    try {
        XLSX.readFile(inputPath);
    } catch (error) {
        console.error(`❌ Cannot find input file: ${inputPath}`);
        console.error('Please ensure the file exists and try again.');
        return false;
    }
    
    try {
        // Read the source Excel file
        console.log(`Reading source file: ${inputPath}`);
        const workbook = XLSX.readFile(inputPath);
        const sheetName = workbook.SheetNames[0]; // 'MediaImage'
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert sheet to JSON for easier manipulation
        const sourceData = XLSX.utils.sheet_to_json(worksheet);
        console.log(`Found ${sourceData.length} rows of data to transform`);
        
        // Transform data according to the mapping rules
        let titlesFromAltText = 0;
        let titlesFromFileName = 0;
        let emptyTitles = 0;
        
        const transformedData = sourceData.map((row, index) => {
            // Determine title: Use Alt Text if available, otherwise use FileName as fallback
            let title = row['Alt Text'] || '';
            let titleSource = '';
            
            if (title && title.trim() !== '') {
                titleSource = 'alt-text';
                titlesFromAltText++;
            } else {
                title = row['FileName'] || '';
                if (title && title.trim() !== '') {
                    titleSource = 'filename';
                    titlesFromFileName++;
                } else {
                    titleSource = 'empty';
                    emptyTitles++;
                }
            }
            
            const transformedRow = {
                // Constant values as specified
                'FinalLifeCycleStatusToAsset': 'M.Final.LifeCycle.Status.Created',
                'ContentRepositoryToAsset': 'M.Content.Repository.Standard',
                'BayerTags': 'Bayer.Assets.tags.ImportedfromDrupal',
                
                // Mapped values from source
                'DrupalMediaID': row['Drupal Media ID'] || '',
                'DrupalImageID': row['Drupal Image ID'] || '',
                'Title': title,
                'FileName': row['FileName'] || '',
                'File': row['DrupalUrl'] || '',
                'ImportUrls': row['DrupalUrl'] || ''
            };
            
            return transformedRow;
        });
        
        console.log(`Transformed ${transformedData.length} rows`);
        console.log(`📊 Title sources: ${titlesFromAltText} from Alt Text, ${titlesFromFileName} from FileName, ${emptyTitles} empty`);
        
        // Create new workbook with transformed data
        const newWorkbook = XLSX.utils.book_new();
        const newWorksheet = XLSX.utils.json_to_sheet(transformedData);
        
        // Add the worksheet to workbook with the correct sheet name
        XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, 'M.Asset');
        
        // Write the output file
        console.log(`Writing output file: ${outputPath}`);
        XLSX.writeFile(newWorkbook, outputPath);
        
        console.log('\n✅ Transformation completed successfully!');
        console.log(`📁 Output file created: ${outputPath}`);
        
        // Show sample of transformed data
        if (transformedData.length > 0) {
            console.log('\n📋 Sample of transformed data (first row):');
            console.log(JSON.stringify(transformedData[0], null, 2));
        }
        
        return { success: true, outputPath };
        
    } catch (error) {
        console.error('❌ Error during transformation:', error.message);
        console.error(error.stack);
        return { success: false, outputPath: null };
    }
}

/**
 * Validate the transformation by comparing with expected format
 * @param {string} generatedPath - Path to the generated file
 */
function validateTransformation(generatedPath) {
    const referencePath = 'Asset Migration/Content Hub Import File.xlsx';
    
    try {
        console.log('\n🔍 Validating transformation...');
        
        // Read the generated file
        const generatedWorkbook = XLSX.readFile(generatedPath);
        const generatedSheet = generatedWorkbook.Sheets['M.Asset'];
        const generatedData = XLSX.utils.sheet_to_json(generatedSheet);
        
        // Read the reference file for comparison (if it exists)
        let referenceData = null;
        let referenceHeaders = null;
        
        try {
            const referenceWorkbook = XLSX.readFile(referencePath);
            const referenceSheet = referenceWorkbook.Sheets['M.Asset'];
            referenceData = XLSX.utils.sheet_to_json(referenceSheet);
            referenceHeaders = Object.keys(referenceData[0] || {});
        } catch (error) {
            console.log('⚠️  Reference file not found, skipping header comparison');
        }
        
        // Get headers from generated file
        const generatedHeaders = Object.keys(generatedData[0] || {});
        
        console.log('Generated headers:', generatedHeaders);
        if (referenceHeaders) {
            console.log('Reference headers:', referenceHeaders);
            // Check if headers match
            const headersMatch = JSON.stringify(generatedHeaders) === JSON.stringify(referenceHeaders);
            console.log(`Headers match: ${headersMatch ? '✅' : '❌'}`);
        }
        // Check constant values in first few rows
        const sampleSize = Math.min(3, generatedData.length);
        console.log(`\n🧪 Checking constant values in first ${sampleSize} rows:`);
        
        for (let i = 0; i < sampleSize; i++) {
            const row = generatedData[i];
            console.log(`Row ${i + 1}:`);
            console.log(`  FinalLifeCycleStatusToAsset: ${row.FinalLifeCycleStatusToAsset}`);
            console.log(`  ContentRepositoryToAsset: ${row.ContentRepositoryToAsset}`);
            console.log(`  BayerTags: ${row.BayerTags}`);
        }
        
        console.log(`\n📊 Statistics:`);
        console.log(`  Generated rows: ${generatedData.length}`);
        if (referenceData) {
            console.log(`  Reference rows: ${referenceData.length}`);
            console.log(`  Row count match: ${generatedData.length === referenceData.length ? '✅' : '❌'}`);
        }
    } catch (error) {
        console.error('❌ Error during validation:', error.message);
    }
}

// Main execution
console.log('🚀 Excel Transformation Script');
console.log('================================');
console.log('This script transforms Excel files into Content Hub Import File format');
console.log('with the required column headers and constant values.\n');

// Get input file from command line arguments
const args = process.argv.slice(2);
const inputFile = args[0];

if (!inputFile) {
    console.error('❌ Please provide an input file path as parameter');
    console.error('Usage: node transform-excel.js "path/to/input.xlsx"');
    console.error('Example: node transform-excel.js "Asset Migration/Media Images.xlsx"');
    process.exit(1);
}

const result = transformMediaImagesToContentHub(inputFile);

if (result.success) {
    validateTransformation(result.outputPath);
} else {
    console.log('❌ Transformation failed. Please check the error messages above.');
}

console.log('\n🏁 Script completed.');