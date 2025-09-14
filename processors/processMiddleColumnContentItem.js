import { getComponentTypeClass } from '../utils/index.js';
import processJumbotron from './processJumbotron.js';
import processHtmlEditor from './processHtmlEditor.js';
import processTextWithImage from './processTextWithImage.js';
import processAccordion from './processAccordion.js';
import processAccordionItem from './processAccordionItem.js';
import processGridLayout from './processGridLayout.js';
import processSectionIntroduction from './processSectionIntroduction.js';
import processLinkList2 from './processLinkList2.js';
import processQuote from './processQuote.js';
import processProfileCard from './processProfileCard.js';
import processNewsOverviewBlock from './processNewsOverviewBlock.js';
import processJobSearchBanner from './processJobSearchBanner.js';
import processCtaButton from './processCtaButton.js';
import processInfoBox from './processInfoBox.js';
import processSitemap from './processSitemap.js';
import processTable from './processTable.js';
import processText from './processText.js';
import processLocalNewsContent from './processLocalNewsContent.js';

export default function processMiddleColumnContentItem($, fieldItem, mainComponents, missingComponentImplementations, baseUrl, diagnostics) {
  // We ignore "filler components"
  let componentName = getComponentTypeClass($, fieldItem);
  
  if (!componentName) {
    return false;
  }

  // IMPORTANT: Detect accordion containers BEFORE generic text-with-image to avoid flattening accordion items.
  let processed =
    processJumbotron($, fieldItem, mainComponents, baseUrl) ||
    processHtmlEditor($, fieldItem, mainComponents) ||
  processAccordion($, fieldItem, mainComponents) ||
  processAccordionItem($, fieldItem, mainComponents) ||
  processTextWithImage($, fieldItem, mainComponents, baseUrl, diagnostics) ||
    processGridLayout($, fieldItem, mainComponents) ||
  processJobSearchBanner($, fieldItem, mainComponents, baseUrl) ||
  processCtaButton($, fieldItem, mainComponents, baseUrl) ||
  processInfoBox($, fieldItem, mainComponents, baseUrl) ||
  processSitemap($, fieldItem, mainComponents, baseUrl) ||
  processTable($, fieldItem, mainComponents, baseUrl) ||
  processText($, fieldItem, mainComponents, baseUrl) ||
  processLocalNewsContent($, fieldItem, mainComponents, baseUrl) ||
    processNewsOverviewBlock($, fieldItem, mainComponents, baseUrl) ||
  processProfileCard($, fieldItem, mainComponents) ||
    processSectionIntroduction($, fieldItem, mainComponents) ||
    processLinkList2($, fieldItem, mainComponents) ||
    processQuote($, fieldItem, mainComponents);

    if(!processed) {
      // Suppress noisy warning for text-with-image (empty or skipped cases)
      if (componentName !== 'text-with-image') {
        console.warn('Component implementation missing in middle column. Type: ', componentName);
        if (!missingComponentImplementations[componentName]){
          missingComponentImplementations[componentName] = 0;
        }
        missingComponentImplementations[componentName]++;
        diagnostics && diagnostics.onUnprocessed && diagnostics.onUnprocessed(componentName, fieldItem);
      }
    }

  return processed;
}
