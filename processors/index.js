/*
  Developer note: When creating new component processors that extract images,
  always use `extractImageMetadata(imgEl, baseUrl)` from `utils/index.js` to
  populate image objects with { src, alt, width, height } and normalize URLs.
  This keeps image handling consistent across components.
*/
/*
  Wiring guideline: For every new processor added to this folder:
  1) import and export it from `processors/index.js` (done here),
  2) add a call to it in `processors/processMiddleColumnContentItem.js`, and
  3) add a call to it in `processors/processMainContentItem.js`.
+
  This ensures components are handled whether they appear as top-level page
  items or nested inside wrappers. Always follow these three steps to avoid
  missing components during migration.
*/
import processJumbotron from './processJumbotron.js';
import processImageWraper from './processImageWrapper.js';
import processMiniBanner from './processMiniBanner.js';
import processQuote from './processQuote.js';
import processClusterBlock from './processClusterBlock.js';
import processFeaturedContent from './processFeaturedContent.js';
import processGridLayout from './processGridLayout.js';
import processHtmlEditor from './processHtmlEditor.js';
import processTextWithImage from './processTextWithImage.js';
import processAccordion from './processAccordion.js';
import processAccordionItem from './processAccordionItem.js';
import processSectionIntroduction from './processSectionIntroduction.js';
import processLinkList from './processLinkList.js';
import processLinkList2 from './processLinkList2.js';
import processContentWithSidebar from './processContentWithSidebar.js';
import processMainContentItem from './processMainContentItem.js';
import processMiddleColumnContentItem from './processMiddleColumnContentItem.js';
import processRightColumnContentItem from './processRightColumnContentItem.js';
import processJobSearch from './processJobSearch.js';
import processLatestNews from './processLatestNews.js';
import processNewsOverviewBlock from './processNewsOverviewBlock.js';
import processProfileCard from './processProfileCard.js';
import processJobSearchBanner from './processJobSearchBanner.js';
import processCtaButton from './processCtaButton.js';
import processInfoBox from './processInfoBox.js';
import processSitemap from './processSitemap.js';
import processTable from './processTable.js';
import processText from './processText.js';
import processLocalNewsContent from './processLocalNewsContent.js';

export {
  processJumbotron,
  processImageWraper,
  processMiniBanner,
  processQuote,
  processClusterBlock,
  processFeaturedContent,
  processGridLayout,
  processHtmlEditor,
  processTextWithImage,
  processAccordion,
  processAccordionItem,
  processSectionIntroduction,
  processLinkList,
  processLinkList2,
  processContentWithSidebar,
  processMainContentItem,
  processMiddleColumnContentItem,
  processRightColumnContentItem
  ,processJobSearch
  ,processLatestNews
  ,processNewsOverviewBlock
  ,processProfileCard
  ,processJobSearchBanner,
  processCtaButton
  ,processInfoBox
  ,processSitemap
  ,processTable
  ,processText
  ,processLocalNewsContent
};
