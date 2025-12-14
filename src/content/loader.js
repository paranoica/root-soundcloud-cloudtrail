(async () => {
    const src = chrome.runtime.getURL("src/content/index.js");
    await import(src);
})();