const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const CountdownAudio = require("./countdownAudio");
const {
  getUserDataPath,
  distance,
  waveTimeByDistance,
  getCurrentTime,
  intensityFloatToInt,
  formatSec,
  updateWaveDisplay,
} = require("./utils");
const { CLASSES } = require("./constants");
const { createCountDownElement } = require("./domElements");
const { applyStyles } = require("./styles");
const {
  initializeAudioSettings,
  getAudioSettings,
  setAudioSetting,
} = require("./audioSettings");

class Plugin {
  #ctx;

  logger = null;
  regions = {};
  timeTable = {};
  userLocation = null;
  currentLocationLoc = null;
  currentRotationNumber = null;
  currentLocationPwaveVal = null;
  currentLocationSwaveVal = null;
  map = null;
  getLocationInfoIntervalId = null;
  userCode = null;
  syncedEewCache = {};
  countdownAudio = null;
  currentDisplayedEewId = null;
  lastPlayedReportNumber = null;
  supportOptions = [
    { value: "updateAudio", text: "報數更新音效 (Report update sound effect)" },
    { value: "countdownAudio", text: "倒數音效 (Countdown sound effect)" },
    {
      value: "ding",
      text: "抵達時的叮叮叮音效 (Ding ding ding sound effect upon arrival)",
    },
  ];

  static CLASSES = CLASSES;

  constructor(ctx) {
    this.#ctx = ctx;
    this.configDir = path.join(getUserDataPath(), "user", "config.yml");
    this.imageUrl = path.resolve(__dirname, "gps.png");
    this.config = {};
    this.countdownAudio = new CountdownAudio(this.logger);
    this.countdownAudio.setAudioSettings(getAudioSettings());
    this.currentDisplayedEewId = null;
    this.lastPlayedReportNumber = null;
  }

  // 初始化
  async init(TREM) {
    this.readConfigYaml();
    try {
      this.regions = await this.fetchData("region");
    } catch (error) {
      this.logger?.error("Failed to load region data:", error);
      this.regions = {};
    }
    this.timeTable = await this.fetchData("time");
    this.setupDOMElements(TREM);
    this.countdownAudio.loadAudio();

    if (this.getLocationInfoIntervalId) {
      clearInterval(this.getLocationInfoIntervalId);
    }
    this.getLocationInfoAndUpdateDOM();
    this.getLocationInfoIntervalId = setInterval(() => {
      this.getLocationInfoAndUpdateDOM();
    }, 1000);

    setInterval(() => {
      this.getEewData(TREM);
    }, 100);
  }

  eewCountDownOptionInit(TREM) {
    window.addEventListener("storage", (event) => {
      if (event.key === "eew-countdown-plugin" && event.newValue) {
        this.initializeEEWOptions(TREM);
      }
    });

    const settingButtons = document.querySelector(".setting-buttons");
    const settingContent = document.querySelector(".setting-content");

    if (settingContent && settingButtons) {
      const button = document.createElement("div");
      button.className = "button eew-countdown";
      button.setAttribute("for", "eew-countdown-page");
      settingButtons.appendChild(button);
      button.textContent = "EEW Count Down";

      const options = this.supportOptions
        .map(
          (opt) => `
        <div>
          <span>${opt.text}</span>
          <label class="switch">
            <input id="${opt.value}.eew-countdown-plugin" type="checkbox">
            <div class="slider round"></div>
          </label>
        </div>
      `
        )
        .join("");

      const element = document.createElement("div");
      element.classList.add("setting-options-page", "eew-countdown-page");
      element.innerHTML = `
        <div class="setting-page-header-title">EEW Count Down</div>
        <div class="setting-item-wrapper">
          <div class="setting-item-content">
            <span class="setting-item-title">EEW Count Down</span>
            <span class="description">開啟/關閉倒數擴充音效</span>
            <div class="setting-option">
              ${options}
            </div>
          </div>
        </div>`;
      settingContent.appendChild(element);
    }
  }

  addCheckBoxEvent(TREM) {
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("slider")) {
        const inputElement = e.target.previousElementSibling;
        if (inputElement && inputElement.id.endsWith(".eew-countdown-plugin")) {
          const key = inputElement.id.split(".")[0];
          const isChecked = inputElement.checked;

          setAudioSetting(key, !isChecked);
          this.countdownAudio.setAudioSettings(getAudioSettings());
        }
      }
    });
  }

  addClickEvent() {
    const settingOptionsPage = document.querySelectorAll(
      ".setting-options-page"
    );
    const settingButtons = document.querySelectorAll(
      ".setting-buttons .button"
    );

    settingButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const targetPageId = button.getAttribute("for");
        const targetPage = document.querySelector(`.${targetPageId}`);

        settingOptionsPage.forEach((item) => {
          item.classList.remove("active");
        });
        if (targetPage) {
          targetPage.classList.add("active");
        }

        settingButtons.forEach((item) => {
          item.classList.remove("on");
        });
        button.classList.add("on");
      });
    });
  }

  initializeEEWOptions(TREM) {
    const audioSettings = getAudioSettings();

    for (const opt of this.supportOptions) {
      const checkbox = document.getElementById(
        `${opt.value}.eew-countdown-plugin`
      );
      if (checkbox) {
        checkbox.checked = false || audioSettings[opt.value];
      }
    }
  }

  readConfigYaml() {
    try {
      const raw = fs.readFileSync(this.configDir, "utf8");
      this.config = yaml.load(raw);
      this.logger?.info("Config loaded:", this.config);
    } catch (error) {
      this.logger?.warn("Config YAML 讀取失敗：", error.message);
      this.config = {};
    }
  }

  async fetchData(type) {
    try {
      const response = await fetch(
        `https://raw.githubusercontent.com/ExpTechTW/TREM-Lite/refs/heads/main/src/resource/data/${type}.json`
      );
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      this.logger.info(`${type} data loaded`);
      return await response.json();
    } catch (error) {
      this.logger.error(`Error loading ${type} data:${error}`);
    }
  }

  // 創建元素
  setupDOMElements(TREM) {
    if (
      !document.querySelector(`.${CLASSES.CURRENT_LOCATION_COUNT_DOWN_WRAPPER}`)
    ) {
      const newElement = createCountDownElement();
      document.body.appendChild(newElement);
      applyStyles();
      this.cacheDOMElements();
    }
  }

  cacheDOMElements() {
    this.currentLocationPwaveVal = document.querySelector(
      `.${CLASSES.CURRENT_LOCATION_PWAVE_VAL}`
    );
    this.currentLocationSwaveVal = document.querySelector(
      `.${CLASSES.CURRENT_LOCATION_SWAVE_VAL}`
    );
    this.currentLocationLoc = document.querySelector(
      `.${CLASSES.CURRENT_LOCATION_LOC}`
    );
    this.currentRotationNumber = document.querySelector(
      `.${CLASSES.CURRENT_ROTATION_NUMBER}`
    );
    this.currentLocationCountDownBox = document.querySelector(
      `.${CLASSES.CURRENT_LOCATION_COUNT_DOWN_BOX}`
    );
    this.currentLocationPSWave = document.querySelector(
      `.${CLASSES.CURRENT_LOCATION_PSWAVE}`
    );
    this.currentLocationCountDownBox = document.querySelector(
      `.${CLASSES.CURRENT_LOCATION_COUNT_DOWN_BOX}`
    );
    this.currentReportNumber = document.querySelector(
      `.${CLASSES.CURRENT_REPORT_NUMBER}`
    );
  }

  // 取得地震資料
  getEewData(TREM) {
    if (!this.currentLocationPwaveVal || !this.currentLocationSwaveVal) {
      return;
    }
    this.removeClass();

    if (!this.timeTable || Object.keys(this.timeTable).length === 0) {
      this.logger?.warn("TimeData 未初始化。");
      this.currentLocationPwaveVal.textContent = "";
      this.currentLocationSwaveVal.textContent = "";
      this.currentRotationNumber.textContent = "";
      if (this.currentLocationCountDownBox)
        this.currentLocationCountDownBox.style.display = "none";
      this.currentReportNumber.textContent = "";
      this.lastPlayedReportNumber = null;
      return;
    }

    const eewDataArray = TREM.variable.data.eew;
    if (!eewDataArray || eewDataArray.length === 0) {
      this.currentLocationPwaveVal.textContent = "";
      this.currentLocationSwaveVal.textContent = "";
      this.currentRotationNumber.textContent = "";
      if (this.currentLocationCountDownBox)
        this.currentLocationCountDownBox.style.display = "none";
      this.currentReportNumber.textContent = "";
      this.lastPlayedReportNumber = null;
      return;
    }

    const displayableEews = [];
    for (const eew of eewDataArray) {
      if (!TREM.constant.SHOW_TREM_EEW && eew.author === "trem") {
        continue;
      }
      displayableEews.push(eew);
    }

    if (displayableEews.length === 0) {
      this.currentLocationPwaveVal.textContent = "";
      this.currentLocationSwaveVal.textContent = "";
      this.currentRotationNumber.textContent = "";
      if (this.currentLocationCountDownBox)
        this.currentLocationCountDownBox.style.display = "none";
      this.currentReportNumber.textContent = "";
      this.lastPlayedReportNumber = null;
      return;
    }

    let showEewIntendedRotationIndex = TREM.variable.last_rotation;
    const idsFromSyncedCache = Object.keys(this.syncedEewCache);

    if (
      typeof showEewIntendedRotationIndex !== "number" ||
      isNaN(showEewIntendedRotationIndex)
    ) {
      showEewIntendedRotationIndex = 0;
    }

    if (idsFromSyncedCache.length === 0) {
      this.currentLocationPwaveVal.textContent = "";
      this.currentLocationSwaveVal.textContent = "";
      this.currentRotationNumber.textContent = "";
      if (this.currentLocationCountDownBox)
        this.currentLocationCountDownBox.style.display = "none";
      this.currentReportNumber.textContent = "";
      this.lastPlayedReportNumber = null;
      return;
    }

    showEewIntendedRotationIndex =
      ((showEewIntendedRotationIndex % idsFromSyncedCache.length) +
        idsFromSyncedCache.length) %
      idsFromSyncedCache.length;

    const targetEewId = idsFromSyncedCache[showEewIntendedRotationIndex];
    let currentEewData = null;
    let actualEewIndexInDisplayableEews = -1;

    for (let i = 0; i < displayableEews.length; i++) {
      if (displayableEews[i].id === targetEewId) {
        currentEewData = displayableEews[i];
        actualEewIndexInDisplayableEews = i;
        break;
      }
    }

    if (!currentEewData) {
      this.logger?.warn(
        `在 displayableEews 中找不到 EEW ID ${targetEewId} (來自 show_eew context)。`
      );
      this.currentLocationPwaveVal.textContent = "";
      this.currentLocationSwaveVal.textContent = "";
      this.currentRotationNumber.textContent = "";
      if (this.currentLocationCountDownBox)
        this.currentLocationCountDownBox.style.display = "none";
      this.currentReportNumber.textContent = "";
      this.lastPlayedReportNumber = null;
      return;
    }

    // 檢查顯示的 EEW 是否已變更
    if (this.currentDisplayedEewId !== currentEewData.id) {
      this.logger?.debug(
        `EEW ID changed from ${this.currentDisplayedEewId} to ${currentEewData.id}. Resetting audio queue.`
      );
      this.countdownAudio.resetAudioQueueAndState();
      this.currentDisplayedEewId = currentEewData.id;
      this.lastPlayedReportNumber = currentEewData.serial;
    }

    const eqData = currentEewData?.eq;

    if (!eqData || !this.userLocation || currentEewData.trigger === true) {
      this.currentLocationPwaveVal.textContent = "";
      this.currentLocationSwaveVal.textContent = "";
      this.currentRotationNumber.textContent = "";
      if (this.currentLocationCountDownBox)
        this.currentLocationCountDownBox.style.display = "none";
      this.currentReportNumber.textContent = "";
      this.lastPlayedReportNumber = null;
      return;
    }

    const eewIntensityCache = TREM.variable.cache.eewIntensityArea;
    const intensityMapForThisEew = eewIntensityCache
      ? eewIntensityCache[currentEewData.id]
      : null;
    const userIntensityData =
      intensityMapForThisEew && this.userCode
        ? intensityMapForThisEew[this.userCode]
        : null;
    const userIntensityValueI = userIntensityData ? userIntensityData.I : 0;

    const { lat: eqLat, lon: eqLon, depth: eqDepth, time: originTime } = eqData;
    const { lat: userLat, lon: userLon } = this.userLocation;
    const currentTime = getCurrentTime(TREM);
    const surfaceDistance = distance(eqLat, eqLon, userLat, userLon);
    const pWaveTravelTimeMs = waveTimeByDistance(
      this.timeTable,
      eqDepth,
      surfaceDistance,
      "P"
    );
    const sWaveTravelTimeMs = waveTimeByDistance(
      this.timeTable,
      eqDepth,
      surfaceDistance,
      "S"
    );
    const elapsedTimeMs = currentTime - originTime;
    let pWaveRemainingSeconds, sWaveRemainingSeconds;

    if (eqData.mag !== 1 && currentEewData.status !== 3) {
      pWaveRemainingSeconds = (pWaveTravelTimeMs - elapsedTimeMs) / 1000;
      sWaveRemainingSeconds = (sWaveTravelTimeMs - elapsedTimeMs) / 1000;
    } else {
      pWaveRemainingSeconds = "?";
      sWaveRemainingSeconds = "?";
    }

    const statusClass =
      currentEewData.status == 3
        ? "eew-cancel"
        : currentEewData.status == 1
        ? "eew-alert"
        : currentEewData.author == "trem" && !currentEewData.rts
        ? "eew-rts"
        : "eew-warn";

    if (this.currentLocationCountDownBox) {
      this.currentLocationCountDownBox.style.display = "flex";
    }

    this.renderCountDown({
      id: currentEewData.id,
      serial: currentEewData.serial,
      user: this.userLocation,
      distance: surfaceDistance,
      pWaveRemainingSeconds,
      sWaveRemainingSeconds,
      lastRotation: actualEewIndexInDisplayableEews,
      statusClass: statusClass,
      I: userIntensityValueI,
      intensity: intensityFloatToInt(userIntensityValueI),
    });
  }

  // 移除 Class
  removeClass() {
    this.currentLocationPwaveVal.classList.remove(
      CLASSES.ARRIVE,
      CLASSES.UNKNOWN
    );
    this.currentLocationSwaveVal.classList.remove(
      CLASSES.ARRIVE,
      CLASSES.UNKNOWN
    );
    this.currentLocationPSWave.classList.remove(
      "eew-rts",
      "eew-alert",
      "eew-warn",
      "eew-cancel"
    );
    this.currentLocationCountDownBox.style.removeProperty("display");
    [...this.currentLocationCountDownBox.classList].forEach((cls) => {
      if (cls.startsWith("intensity-")) {
        this.currentLocationCountDownBox.classList.remove(cls);
      }
    });
  }

  // 渲染內容
  renderCountDown(data) {
    const pSec = formatSec(data.pWaveRemainingSeconds);
    const sSec = formatSec(data.sWaveRemainingSeconds);
    updateWaveDisplay(this.currentLocationPwaveVal, pSec, CLASSES);
    updateWaveDisplay(this.currentLocationSwaveVal, sSec, CLASSES);
    this.currentLocationCountDownBox.style.display = data ? "flex" : "none";
    this.currentLocationPSWave.classList.add(data.statusClass);
    this.currentRotationNumber.textContent = data.lastRotation;
    this.currentReportNumber.textContent = data.serial;

    if (data.final === 1) {
      this.currentReportNumber.classList.add("is-final-report");
    } else {
      this.currentReportNumber.classList.remove("is-final-report");
    }

    if (this.currentLocationCountDownBox) {
      this.currentLocationCountDownBox.style.background = `var(--intensity-${data.intensity})`;
      this.currentLocationCountDownBox.classList.add();
    }
    const intensityBox = this.currentLocationCountDownBox.querySelector(
      ".current-location-intensity-box"
    );
    if (intensityBox) {
      for (let i = 0; i <= 9; i++) {
        intensityBox.classList.remove(`intensity-${i}`);
        this.currentLocationCountDownBox.classList.remove(`intensity-${i}`);
      }
      intensityBox.classList.add(`intensity-${data.intensity}`);
      this.currentLocationCountDownBox.classList.add(
        `intensity-${data.intensity}`
      );
    }

    // 報告編號變更時播放 update.wav
    if (data.serial && data.serial !== this.lastPlayedReportNumber) {
      this.countdownAudio.playAudioSequence(["update"]);
      this.lastPlayedReportNumber = data.serial;
    }

    this.countdownAudio.playCountdownAudio(sSec, data.intensity, data.id);
  }

  // 更新地圖上使用者位置
  updateUserMarkerOnMap() {
    if (
      !this.map ||
      !this.map.isStyleLoaded() ||
      !this.map.getSource("user-location-source")
    ) {
      return;
    }
    const source = this.map.getSource("user-location-source");
    if (
      this.userLocation &&
      typeof this.userLocation.lon === "number" &&
      typeof this.userLocation.lat === "number"
    ) {
      const geojson = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [this.userLocation.lon, this.userLocation.lat],
            },
          },
        ],
      };
      source.setData(geojson);
      if (this.map.getLayer("user-location-layer")) {
        this.map.setLayoutProperty(
          "user-location-layer",
          "visibility",
          "visible"
        );
      }
    } else {
      source.setData({ type: "FeatureCollection", features: [] });
      if (this.map.getLayer("user-location-layer")) {
        this.map.setLayoutProperty("user-location-layer", "visibility", "none");
      }
    }
  }

  // 取得使用者位置並更新元素
  getLocationInfoAndUpdateDOM() {
    let newLocation = null;
    let displayName = "";
    if (this.config && this.config["location-code"]) {
      this.userCode = this.config["location-code"];
      if (this.regions && Object.keys(this.regions).length > 0) {
        for (const cityKey in this.regions) {
          if (this.regions.hasOwnProperty(cityKey)) {
            const city = this.regions[cityKey];
            for (const districtKey in city) {
              if (city.hasOwnProperty(districtKey)) {
                const data = city[districtKey];
                if (data.code === this.userCode) {
                  displayName = `${data.area.slice(0, 3)}${districtKey}`;
                  newLocation = {
                    lat: data.lat,
                    lon: data.lon,
                  };
                  break;
                }
              }
            }
          }
          if (newLocation) break;
        }
      } else {
        this.logger?.warn("地區資料尚未載入，無法設定使用者位置。");
      }
    }
    this.userLocation = newLocation;
    if (this.currentLocationLoc) {
      this.currentLocationLoc.textContent = displayName;
    }
    this.updateUserMarkerOnMap();
  }

  // 測試用，外部觸發音效播報
  testPlayCountdownAudio(sWaveSec, intensity, eewId) {
    this.logger?.debug(
      `手動觸發音效: sWaveSec=${sWaveSec}, intensity=${intensity}, eewId=${eewId}`
    );
    this.countdownAudio.playCountdownAudio(sWaveSec, intensity, eewId);
  }

  async onLoad() {
    const { TREM, logger } = this.#ctx;
    this.logger = logger;

    initializeAudioSettings();
    this.countdownAudio.setAudioSettings(getAudioSettings());

    if (TREM.variable.events) {
      TREM.variable.events.on("EewRelease", (ans) => {
        if (ans && ans.data && ans.data.id) {
          this.syncedEewCache[ans.data.id] = ans.data;
          this.logger?.debug("syncedEewCache: EewRelease", ans.data.id);
        }
      });
      TREM.variable.events.on("EewUpdate", (ans) => {
        if (ans && ans.data && ans.data.id) {
          this.syncedEewCache[ans.data.id] = ans.data;
          this.logger?.debug("syncedEewCache: EewUpdate", ans.data.id);
        }
      });
      TREM.variable.events.on("EewEnd", (ans) => {
        if (ans && ans.data && ans.data.id) {
          delete this.syncedEewCache[ans.data.id];
          this.countdownAudio.clearEewAudioState(ans.data.id);
          this.logger?.debug("syncedEewCache: EewEnd", ans.data.id);
        }
      });

      if (
        typeof window !== "undefined" &&
        !window.location.pathname.includes("index.html")
      ) {
        return;
      }

      const setupMapResources = async () => {
        if (!this.map) {
          this.logger?.error(
            "setupMapResources 被呼叫，但 this.map 未被設定。"
          );
          return;
        }
        const executeMapSetup = async () => {
          if (this.map.isStyleLoaded()) {
            this.logger?.info("地圖樣式已載入，開始設定地圖資源。");
            try {
              const image = await this.map.loadImage(this.imageUrl);
              if (image && image.data) {
                if (!this.map.hasImage("gps-marker")) {
                  this.map.addImage("gps-marker", image.data);
                }
              } else {
                this.logger?.warn(
                  `地圖圖標 ${this.imageUrl} 載入失敗或圖片資料不存在`
                );
              }
              if (!this.map.getSource("user-location-source")) {
                this.map.addSource("user-location-source", {
                  type: "geojson",
                  data: { type: "FeatureCollection", features: [] },
                });
              }
              if (!this.map.getLayer("user-location-layer")) {
                this.map.addLayer({
                  id: "user-location-layer",
                  type: "symbol",
                  source: "user-location-source",
                  layout: {
                    "icon-image": "gps-marker",
                    "icon-size": 0.35,
                    "icon-allow-overlap": true,
                    "icon-ignore-placement": true,
                    visibility: "none",
                  },
                });
              }
              this.getLocationInfoAndUpdateDOM();
              this.logger?.info("地圖資源設定完成。");
            } catch (err) {
              this.logger?.error(
                `設定地圖資源時發生錯誤 (${this.imageUrl}):`,
                err
              );
            }
          } else {
            this.logger?.warn("地圖樣式尚未載入，將於 500ms 後重試。");
            setTimeout(executeMapSetup, 500);
          }
        };
        await executeMapSetup();
      };

      const tryInitializePlugin = async () => {
        if (TREM.variable.map) {
          this.map = TREM.variable.map;
          await setupMapResources();
          try {
            await this.init(TREM);
            this.logger?.info("擴充已成功初始化。");
          } catch (err) {
            this.logger?.error("擴充 init 方法執行失敗:", err);
          }
        } else {
          this.logger?.warn("TREM.variable.map 尚未初始化，將於1秒後重試。");
          setTimeout(tryInitializePlugin, 1000);
        }
      };

      tryInitializePlugin();
    }

    this.eewCountDownOptionInit(TREM);
    this.addClickEvent();
    this.addCheckBoxEvent(TREM);
    this.initializeEEWOptions(TREM);
    this.logger.info("Loading EEW Count Down plugin...");

    window.testPlayCountdownAudio = this.testPlayCountdownAudio.bind(this);
  }
}

module.exports = Plugin;
