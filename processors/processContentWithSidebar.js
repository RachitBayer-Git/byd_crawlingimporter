import { isComponentType, getComponentTypeClass } from '../utils/index.js';
import processMiddleColumnContentItem from './processMiddleColumnContentItem.js';
import processRightColumnContentItem from './processRightColumnContentItem.js';

export default function processContentWithSidebar($, fieldItem, mainComponents, missingComponentImplementations, baseUrl) {
  // Check if is content with sidebar
  if (!isComponentType($, fieldItem, 'content-with-sidebars')) {
    return false;
  }

  // Three Columns
  const threeColumns = $(fieldItem).find('.three-columns, .content-area-left-sidebar, .content-area-inner, .content-area-right-sidebar').length;
  if (threeColumns) {
    let left = $(fieldItem).find('.content-area-left-sidebar').first();
    let center = $(fieldItem).find('.content-area-inner').first();
    let right = $(fieldItem).find('.content-area-right-sidebar').first();

    // Center Column
    let centerColumnComponents = [];
    $(center).find('.field > .field__item').each((i, middleColumnItem) => {
      let processed = processMiddleColumnContentItem($, middleColumnItem, centerColumnComponents, missingComponentImplementations, baseUrl);
    })

    // Right Column
    let rightColumnComponents = [];
    $(right).find('.field > .field__item').each((i, rightColumnItem) => {

      let processed = processRightColumnContentItem($, rightColumnItem, rightColumnComponents);
      if(!processed) {
        console.warn('Component implementation missing in middle column. Type: ', componentName);
        if (!missingComponentImplementations[getComponentTypeClass($, fieldItem)]){
          missingComponentImplementations[getComponentTypeClass($, fieldItem)] = 0;
        }
        missingComponentImplementations[getComponentTypeClass($, fieldItem)]++;
      }
    })

    mainComponents.push({ type: 'Three Columns', center: centerColumnComponents, right: rightColumnComponents });
  }
  
  return true;
}
