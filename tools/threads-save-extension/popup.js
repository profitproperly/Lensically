const DEFAULT_WORKER = "https://api.lensically.com";
const DEFAULT_APP_USER_ID = "lensically";
const DEFAULT_LABEL_ENABLED = true;
const DEFAULT_LABEL_THRESHOLD = 1000;
const DEFAULT_LABEL_TEXT = "1K+ Likes";

const workerUrlInput = document.getElementById("workerUrl");
const appUserIdInput = document.getElementById("appUserId");
const accountIdInput = document.getElementById("accountId");
const saveBtn = document.getElementById("saveBtn");
const statusEl = document.getElementById("status");

const labelEnabledInput = document.getElementById("labelEnabled");
const labelThresholdInput = document.getElementById("labelThreshold");
const labelTextInput = document.getElementById("labelText");
const saveLabelSettingsBtn = document.getElementById("saveLabelSettingsBtn");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#fca5a5" : "#a7f3d0";
}

function normalizeWorkerUrl(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

function clampThreshold(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LABEL_THRESHOLD;
  return Math.floor(n);
}

function sanitizeLabelText(value) {
  const text = String(value || "").trim();
  return text || DEFAULT_LABEL_TEXT;
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

function ensureThreadsUrl(url) {
  return /^https:\/\/(www\.)?threads\.com\//i.test(url) || /^https:\/\/threads\.net\//i.test(url);
}

function normalizeAccountId(value) {
  return String(value || "").trim().toLowerCase();
}

async function saveConnectionSettings(workerUrl, appUserId, accountId) {
  await chrome.storage.local.set({
    workerUrl,
    appUserId,
    accountId
  });
}

async function saveLabelSettings(next) {
  await chrome.storage.local.set(next);
}

async function loadSettings() {
  const stored = await chrome.storage.local.get([
    "workerUrl",
    "appUserId",
    "accountId",
    "labelEnabled",
    "labelThreshold",
    "labelText"
  ]);

  const workerUrl = normalizeWorkerUrl(stored.workerUrl || DEFAULT_WORKER);
  const appUserId = String(stored.appUserId || DEFAULT_APP_USER_ID).trim();
  const accountId = normalizeAccountId(stored.accountId);

  const labelEnabled = typeof stored.labelEnabled === "boolean" ? stored.labelEnabled : DEFAULT_LABEL_ENABLED;
  const labelThreshold = clampThreshold(stored.labelThreshold);
  const labelText = sanitizeLabelText(stored.labelText);

  workerUrlInput.value = workerUrl;
  appUserIdInput.value = appUserId;
  accountIdInput.value = accountId;
  labelEnabledInput.checked = labelEnabled;
  labelThresholdInput.value = String(labelThreshold);
  labelTextInput.value = labelText;
}

async function extractFromTab(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: "EXTRACT_THREADS_POST" }, (response) => {
      resolve(response || { ok: false, error: "No response from content script." });
    });
  });
}

async function ensureContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"]
  });
}

async function notifyLabelSettingsChanged(tab) {
  if (!tab || !tab.id || !tab.url || !ensureThreadsUrl(tab.url)) {
    return;
  }

  await new Promise((resolve) => {
    chrome.tabs.sendMessage(tab.id, { type: "LENSICALLY_LABEL_SETTINGS_CHANGED" }, () => {
      resolve();
    });
  });
}

async function importPattern(workerUrl, appUserId, accountId, payload) {
  const accountPayload = accountId ? { account_id: accountId } : {};
  const res = await fetch(`${workerUrl}/api/patterns/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_user_id: appUserId,
      ...accountPayload,
      ...payload
    })
  });

  let data = null;
  try {
    data = await res.json();
  } catch {}

  if (!res.ok) {
    const err = (data && data.error) || `HTTP ${res.status}`;
    throw new Error(String(err));
  }

  return data;
}

saveLabelSettingsBtn.addEventListener("click", async () => {
  saveLabelSettingsBtn.disabled = true;
  try {
    const next = {
      labelEnabled: Boolean(labelEnabledInput.checked),
      labelThreshold: clampThreshold(labelThresholdInput.value),
      labelText: sanitizeLabelText(labelTextInput.value)
    };

    await saveLabelSettings(next);
    labelThresholdInput.value = String(next.labelThreshold);
    labelTextInput.value = next.labelText;

    const tab = await getActiveTab();
    await notifyLabelSettingsChanged(tab);
    setStatus("Label settings saved.");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Could not save label settings.", true);
  } finally {
    saveLabelSettingsBtn.disabled = false;
  }
});

accountIdInput.addEventListener("change", async () => {
  try {
    await chrome.storage.local.set({
      accountId: normalizeAccountId(accountIdInput.value)
    });
  } catch {
    // Save again on the next post if Orion ignores this storage write.
  }
});

saveBtn.addEventListener("click", async () => {
  saveBtn.disabled = true;
  try {
    const workerUrl = normalizeWorkerUrl(workerUrlInput.value || DEFAULT_WORKER);
    const appUserId = String(appUserIdInput.value || DEFAULT_APP_USER_ID).trim();
    const accountId = normalizeAccountId(accountIdInput.value);
    if (!workerUrl || !appUserId) {
      throw new Error("Worker URL and App User ID are required.");
    }

    accountIdInput.value = accountId;
    await saveConnectionSettings(workerUrl, appUserId, accountId);

    const tab = await getActiveTab();
    if (!tab || !tab.id || !tab.url) {
      throw new Error("No active tab found.");
    }
    if (!ensureThreadsUrl(tab.url)) {
      throw new Error("Open a Threads post page first.");
    }

    setStatus("Extracting post...");
    let extracted = await extractFromTab(tab.id);
    if (!extracted || !extracted.ok) {
      await ensureContentScript(tab.id);
      extracted = await extractFromTab(tab.id);
    }
    if (!extracted || !extracted.ok) {
      throw new Error((extracted && extracted.error) || "Extraction failed.");
    }

    setStatus("Saving to backend...");
    const result = await importPattern(workerUrl, appUserId, accountId, extracted.payload);
    setStatus(`Saved to ${result.account_id || accountId}. Updated ${result.updated_at || "just now"}`);
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Unexpected error", true);
  } finally {
    saveBtn.disabled = false;
  }
});

loadSettings().catch(() => {
  workerUrlInput.value = DEFAULT_WORKER;
  appUserIdInput.value = DEFAULT_APP_USER_ID;
  accountIdInput.value = "";
  labelEnabledInput.checked = DEFAULT_LABEL_ENABLED;
  labelThresholdInput.value = String(DEFAULT_LABEL_THRESHOLD);
  labelTextInput.value = DEFAULT_LABEL_TEXT;
});
