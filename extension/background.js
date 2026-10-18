"use strict";

const HOST = "local.brave_lock";
const pending = new Set();

// Chromium may replace a suggested extension based on MIME type.
// Wait for completion, then let the native host rename the file on disk.
chrome.downloads.onChanged.addListener(delta => {
  if (delta.state?.current === "complete") lockDownload(delta.id);
});

async function lockDownload(id) {
  if (pending.has(id)) return;
  pending.add(id);

  try {
    const [item] = await chrome.downloads.search({id});
    if (!item || item.state !== "complete" || !item.exists || /\.lock$/i.test(item.filename)) return;

    const response = await chrome.runtime.sendNativeMessage(HOST, {
      action: "lock", path: item.filename
    });
    if (!response?.ok) throw new Error(response?.error || "No response from the helper.");

    // Keep an earlier failure visible until the popup is opened.
    if (await chrome.action.getBadgeText({}) !== "!")
      await chrome.action.setTitle({title: "Brave Lock: last download renamed"});
  } catch (error) {
    console.error("Brave Lock:", error);
    await chrome.action.setBadgeBackgroundColor({color: "#b42318"});
    await chrome.action.setBadgeText({text: "!"});
    await chrome.action.setTitle({title: "Brave Lock: rename failed. " + error.message});
  } finally {
    pending.delete(id);
  }
}
