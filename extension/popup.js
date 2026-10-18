"use strict";

const status = document.getElementById("status");
const failure = document.getElementById("failure");

// Show the failure behind the "!" badge once, then clear it.
chrome.action.getBadgeText({}).then(async badge => {
  if (badge !== "!") return;
  const title = await chrome.action.getTitle({});
  failure.textContent = title.replace(/^Brave Lock: rename failed\. /, "Last rename failed: ");
  failure.hidden = false;
  await chrome.action.setBadgeText({text: ""});
  await chrome.action.setTitle({title: "Brave Lock"});
});

chrome.runtime.sendNativeMessage("local.brave_lock", {action: "ping"}).then(result => {
  if (!result?.ok) throw new Error(result?.error || "No response from the helper.");
  status.textContent = "Helper connected";
  status.dataset.state = "ready";
}).catch(error => {
  status.textContent = "Helper unavailable. Run Install.cmd, then reopen this panel.";
  status.dataset.state = "error";
  status.title = error.message;
});
