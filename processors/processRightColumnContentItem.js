import processLinkList from './processLinkList.js';
import { getComponentTypeClass } from '../utils/index.js';

export default function processRightColumnContentItem($, fieldItem, mainComponents) {
  let processed =
    processLinkList($, fieldItem, mainComponents);

  if(!processed) {
    console.warn('Component implemented in right column. Type: ', getComponentTypeClass($, fieldItem));
  }

  return processed;
}
