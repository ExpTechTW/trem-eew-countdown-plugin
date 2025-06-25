const STORAGE_KEY = "eew-countdown-plugin";

const defaultSettings = {
  updateAudio: true,
  countdownAudio: true,
};

function initializeAudioSettings() {
  const settings = localStorage.getItem(STORAGE_KEY);
  if (!settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultSettings));
  }
}

function getAudioSettings() {
  const settings = localStorage.getItem(STORAGE_KEY);
  return settings ? JSON.parse(settings) : defaultSettings;
}

function setAudioSetting(key, value) {
  const settings = getAudioSettings();
  settings[key] = value;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

module.exports = {
  initializeAudioSettings,
  getAudioSettings,
  setAudioSetting,
};
