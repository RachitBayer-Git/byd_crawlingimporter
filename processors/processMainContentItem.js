import { getComponentTypeClass } from '../utils/index.js';
import processJumbotron from './processJumbotron.js';
import processImageWraper from './processImageWrapper.js';
import processClusterBlock from './processClusterBlock.js';
import processFeaturedContent from './processFeaturedContent.js';
import processGridLayout from './processGridLayout.js';
import processContentWithSidebar from './processContentWithSidebar.js';
import processMiniBanner from './processMiniBanner.js';
import processJobSearch from './processJobSearch.js';
import processLatestNews from './processLatestNews.js';
import processNewsOverviewBlock from './processNewsOverviewBlock.js';
import processJobSearchBanner from './processJobSearchBanner.js';
import processCtaButton from './processCtaButton.js';
import processInfoBox from './processInfoBox.js';
import processSitemap from './processSitemap.js';
import processTable from './processTable.js';
import processText from './processText.js';
import processLocalNewsContent from './processLocalNewsContent.js';

export default function processMainContentItem($, fieldItem, mainComponents, missingComponentImplementations, baseUrl, orderedComponents) {
  // We ignore "filler components"
  let componentName = getComponentTypeClass($, fieldItem);
  if (!componentName) {
    return false;
  }
  
  // If this fieldItem is a wrapper 'content-with-sidebars', handle it first
  // (add-on logic) to avoid misclassification by nested child paragraph types.
  let processed = false;
  if (componentName === 'content-with-sidebars') {
    processed = processContentWithSidebar($, fieldItem, mainComponents, missingComponentImplementations, baseUrl);
  }

  // Normal processing order (unchanged for all other cases). If the special-case handled it
  // above, we don't run the rest.
  if (!processed) {
    processed =
      processJumbotron($, fieldItem, mainComponents, baseUrl) ||
  processJobSearchBanner($, fieldItem, mainComponents, baseUrl) ||
  processCtaButton($, fieldItem, mainComponents, baseUrl) ||
  processInfoBox($, fieldItem, mainComponents, baseUrl) ||
  processSitemap($, fieldItem, mainComponents, baseUrl) ||
  processTable($, fieldItem, mainComponents, baseUrl) ||
  processText($, fieldItem, mainComponents, baseUrl) ||
  processLocalNewsContent($, fieldItem, mainComponents, baseUrl) ||
      processImageWraper($, fieldItem, mainComponents, baseUrl) ||
      processClusterBlock($, fieldItem, mainComponents, baseUrl) ||
      processFeaturedContent($, fieldItem, mainComponents, baseUrl) ||
  processNewsOverviewBlock($, fieldItem, mainComponents, baseUrl) ||
      processLatestNews($, fieldItem, mainComponents, baseUrl) ||
      processGridLayout($, fieldItem, mainComponents, orderedComponents, baseUrl) ||
      processJobSearch($, fieldItem, mainComponents, baseUrl) ||
      processContentWithSidebar($, fieldItem, mainComponents, missingComponentImplementations, baseUrl) ||
      processMiniBanner($, fieldItem, mainComponents);
  }
    

  if(!processed) {
    console.warn('Component implementation missing in main placeholder. Type: ', componentName);
    if (!missingComponentImplementations[componentName]){
      missingComponentImplementations[componentName] = 0;
    }
    missingComponentImplementations[componentName]++;
  }

  return processed;
}
