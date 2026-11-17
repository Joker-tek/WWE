import 'fake-indexeddb/auto';

// jsdom doesn't implement scrolling.
window.scrollTo = () => {};
Element.prototype.scrollIntoView = () => {};
