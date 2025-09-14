import { isComponentType } from '../utils/index.js';

export default function processAccordionItem($, fieldItem, mainComponents) {
  // Check if is accordion item
  if (!isComponentType($, fieldItem, 'accordion-item')) {
    return false;
  }

  // Always return true for accordion item (it has been processed in processAccordion))
  return true;
}
