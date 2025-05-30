const fs = require("fs");
const path = require("path");
const os = require("os");
const yaml = require("js-yaml");

function getUserDataPath(appName = "trem_lite") {
  const home = os.homedir();
  switch (process.platform) {
    case "win32":
      return path.join(home, "AppData", "Roaming", appName);
    case "darwin":
      return path.join(home, "Library", "Application Support", appName);
    case "linux":
      return path.join(home, ".config", appName);
    default:
      throw new Error("Unsupported platform: " + process.platform);
  }
}

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

  static CLASSES = {
    CURRENT_LOCATION_COUNT_DOWN_WRAPPER: "current-location-count-down-wrapper",
    CURRENT_LOCATION_COUNT_DOWN_BOX: "current-location-count-down-box",
    CURRENT_ROTATION_NUMBER: "current-rotation-number",
    CURRENT_LOCATION_INFO: "current-location-info",
    CURRENT_LOCATION_LOC: "current-location-loc",
    CURRENT_LOCATION_PSWAVE: "current-location-pswave",
    CURRENT_LOCATION_INTENSITY_WRAPPER: "current-location-intensity-wrapper",
    CURRENT_LOCATION_INTENSITY_TEXT: "current-location-intensity-text",
    CURRENT_LOCATION_INTENSITY_BOX: "current-location-intensity-box",
    CURRENT_LOCATION_PWAVE_BOX: "current-location-pwave-box",
    CURRENT_LOCATION_PWAVE_TEXT: "current-location-pwave-text",
    CURRENT_LOCATION_SEC_BOX: "current-location-sec-box",
    CURRENT_LOCATION_PWAVE_VAL: "current-location-pwave-val",
    CURRENT_LOCATION_PWAVE_SEC_TEXT: "current-location-pwave-sec-text",
    CURRENT_LOCATION_SWAVE_BOX: "current-location-swave-box",
    CURRENT_LOCATION_SWAVE_TEXT: "current-location-swave-text",
    CURRENT_LOCATION_SWAVE_VAL: "current-location-swave-val",
    ARRIVE: "arrive",
    UNKNOWN: "unknown",
  };

  constructor(ctx) {
    this.#ctx = ctx;
    this.configDir = path.join(getUserDataPath(), "user", "config.yml");
    this.imageUrl = path.resolve(__dirname, "gps.png");
    this.config = {};
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
    this.setupDOMElements();

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
  setupDOMElements() {
    // const target = document.querySelector(".rts-intensity-list-wrapper");
    if (
      !document.querySelector(
        `.${Plugin.CLASSES.CURRENT_LOCATION_COUNT_DOWN_WRAPPER}`
      )
    ) {
      const newElement = this.createCountDownElement();
      document.body.appendChild(newElement);
      this.applyStyles();
      this.cacheDOMElements();
    }
  }

  createCountDownElement() {
    const newElement = document.createElement("div");
    newElement.className = Plugin.CLASSES.CURRENT_LOCATION_COUNT_DOWN_WRAPPER;
    newElement.innerHTML = `
      <div class="${Plugin.CLASSES.CURRENT_LOCATION_COUNT_DOWN_BOX}">
		  <div class="${Plugin.CLASSES.CURRENT_ROTATION_NUMBER}"></div>
		  <div class="${Plugin.CLASSES.CURRENT_LOCATION_INFO}">
			<div id="${Plugin.CLASSES.CURRENT_LOCATION_LOC}" class="${Plugin.CLASSES.CURRENT_LOCATION_LOC}"></div>
			<div class="${Plugin.CLASSES.CURRENT_LOCATION_PSWAVE}">
				<div class="${Plugin.CLASSES.CURRENT_LOCATION_INTENSITY_WRAPPER}">
					<div class="${Plugin.CLASSES.CURRENT_LOCATION_INTENSITY_TEXT}"></div>
					<div class="${Plugin.CLASSES.CURRENT_LOCATION_INTENSITY_BOX}"></div>
				</div>
			  <div class="${Plugin.CLASSES.CURRENT_LOCATION_PWAVE_BOX}">
				<div class="${Plugin.CLASSES.CURRENT_LOCATION_PWAVE_TEXT}"></div>
				<div class="${Plugin.CLASSES.CURRENT_LOCATION_SEC_BOX}">
					<div class="${Plugin.CLASSES.CURRENT_LOCATION_PWAVE_VAL}"></div>
				</div>
			  </div>
			  <div class="${Plugin.CLASSES.CURRENT_LOCATION_SWAVE_BOX}">
				<div class="${Plugin.CLASSES.CURRENT_LOCATION_SWAVE_TEXT}"></div>
				<div class="${Plugin.CLASSES.CURRENT_LOCATION_SEC_BOX}">
					<div class="${Plugin.CLASSES.CURRENT_LOCATION_SWAVE_VAL}"></div>
				</div>
			  </div>
			</div>
		  </div>
	  </div>
    `;
    return newElement;
  }

  applyStyles() {
    const style = document.createElement("style");
    style.textContent = `
      .${Plugin.CLASSES.CURRENT_ROTATION_NUMBER} {
        position: absolute;
        top: .5rem;
        left: 1rem;
        font-size: 13px;
        border: 1px solid #0000004a;
        border-radius: 50%;
        background: #456473;
        color: #ffffff;
        width: 20px;
        height: 20px;
        align-items: center;
        justify-content: center;
        display: none;
      }
      .${Plugin.CLASSES.CURRENT_ROTATION_NUMBER}:not(:empty) {
         display: flex;
      }
      .${Plugin.CLASSES.CURRENT_LOCATION_COUNT_DOWN_WRAPPER} {
        height: 100%;
        width: 100%;
        position: absolute;
        top: 0;
        left: 0;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        pointer-events: none;
      }
      .${Plugin.CLASSES.CURRENT_LOCATION_COUNT_DOWN_BOX} {
        padding: 3px;
        background-color: #505050;
        color: white;
        display: none;
        width: calc(100% - 5rem);
        max-width: 30rem;
        height: 7rem;
        transition: transform 0.6s ease;
        pointer-events: none;
        border-radius: 20px;
        border: 1px solid #ffffff4f;
        position: relative;
        margin-bottom: 2.5rem;
        z-index: 99999;
      }
	  .${Plugin.CLASSES.CURRENT_LOCATION_COUNT_DOWN_BOX}:after {
        display: none !important;
      }
      .${Plugin.CLASSES.CURRENT_LOCATION_INFO} {
        display: flex;
        flex-direction: column;
        flex-wrap: wrap;
        width: 100%;
        justify-content: space-around;
      }
      .${Plugin.CLASSES.CURRENT_LOCATION_LOC} {
        font-size: 1.2rem;
        font-weight: bold;
        text-align: center;
      }
      .intensity-4 .${Plugin.CLASSES.CURRENT_LOCATION_LOC},
      .intensity-5 .${Plugin.CLASSES.CURRENT_LOCATION_LOC},
      .intensity-6 .${Plugin.CLASSES.CURRENT_LOCATION_LOC} {
		    color: #000;
      }
      .${Plugin.CLASSES.CURRENT_LOCATION_PSWAVE} {
        display: flex;
        justify-content: space-around;
        font-size: 1.1rem;
        font-weight: bold;
        border-radius: 15px;
        height: 4rem;
        align-items: center;
        background: #383838;
        border: 1px solid #ffffff4f !important;
      }
      .${Plugin.CLASSES.CURRENT_LOCATION_PWAVE_BOX},
      .${Plugin.CLASSES.CURRENT_LOCATION_SWAVE_BOX},
      .${Plugin.CLASSES.CURRENT_LOCATION_INTENSITY_BOX} {
        display: flex;
        flex-direction: column;
        font-size: 1rem;
        min-width: 3rem;
        width: auto;
        align-items: center;
        border-radius: 10px;
        height: 4rem;
        justify-content: space-evenly;
      }
      .${Plugin.CLASSES.CURRENT_LOCATION_INTENSITY_BOX} {
        border: 1px solid #ffffff4f !important;
        width: 35px;
        height: 35px;
        min-width: unset;
      }
      .${Plugin.CLASSES.CURRENT_LOCATION_INTENSITY_BOX}.intensity-0:after {
        content: "0" !important;
      }
      .${Plugin.CLASSES.CURRENT_LOCATION_INTENSITY_WRAPPER} {
        display: flex;
        flex-direction: column;
        align-items: center;
        height: 4.3rem;
        justify-content: center;
      }
      .${Plugin.CLASSES.CURRENT_LOCATION_INTENSITY_TEXT} {
        margin-right: 3px;
        font-size: 1rem;
      }
      .${Plugin.CLASSES.CURRENT_LOCATION_INTENSITY_TEXT}:before {
        content: "震度";
      }
      .${Plugin.CLASSES.CURRENT_LOCATION_PWAVE_TEXT}:before {
        content: "P波";
      }
      .${Plugin.CLASSES.CURRENT_LOCATION_SWAVE_TEXT} {
        margin-right: 5px;
      }
      .${Plugin.CLASSES.CURRENT_LOCATION_SWAVE_TEXT}:before {
        content: "S波";
      }
      .${Plugin.CLASSES.CURRENT_LOCATION_LOC}:empty:before,
      .${Plugin.CLASSES.CURRENT_LOCATION_PWAVE_VAL}:empty:before,
      .${Plugin.CLASSES.CURRENT_LOCATION_SWAVE_VAL}:empty:before {
        content: "-";
      }
      .${Plugin.CLASSES.CURRENT_LOCATION_PWAVE_VAL}.${Plugin.CLASSES.ARRIVE}:before,
      .${Plugin.CLASSES.CURRENT_LOCATION_SWAVE_VAL}.${Plugin.CLASSES.ARRIVE}:before {
        content: "抵達";
      }
      .${Plugin.CLASSES.CURRENT_LOCATION_PWAVE_VAL}.${Plugin.CLASSES.UNKNOWN}:before,
      .${Plugin.CLASSES.CURRENT_LOCATION_SWAVE_VAL}.${Plugin.CLASSES.UNKNOWN}:before {
        content: "?";
      }
      .${Plugin.CLASSES.CURRENT_LOCATION_PWAVE_VAL}:not(:empty):after,
      .${Plugin.CLASSES.CURRENT_LOCATION_SWAVE_VAL}:not(:empty):after {
        content: "秒";
        font-size: 1.2rem;
        margin-left: 3px;
        margin-top: 4px;
      }
      .${Plugin.CLASSES.CURRENT_LOCATION_PWAVE_VAL},
      .${Plugin.CLASSES.CURRENT_LOCATION_SWAVE_VAL},
      .${Plugin.CLASSES.CURRENT_LOCATION_SWAVE_VAL} {
        border-radius: 5px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
      }
      .${Plugin.CLASSES.CURRENT_LOCATION_SEC_BOX} {
        display: flex;
        align-items: flex-end;
      }
    `;
    document.head.appendChild(style);
  }

  cacheDOMElements() {
    this.currentLocationPwaveVal = document.querySelector(
      `.${Plugin.CLASSES.CURRENT_LOCATION_PWAVE_VAL}`
    );
    this.currentLocationSwaveVal = document.querySelector(
      `.${Plugin.CLASSES.CURRENT_LOCATION_SWAVE_VAL}`
    );
    this.currentLocationLoc = document.querySelector(
      `.${Plugin.CLASSES.CURRENT_LOCATION_LOC}`
    );
    this.currentRotationNumber = document.querySelector(
      `.${Plugin.CLASSES.CURRENT_ROTATION_NUMBER}`
    );
    this.currentLocationCountDownBox = document.querySelector(
      `.${Plugin.CLASSES.CURRENT_LOCATION_COUNT_DOWN_BOX}`
    );
    this.currentLocationPSWave = document.querySelector(
      `.${Plugin.CLASSES.CURRENT_LOCATION_PSWAVE}`
    );
    this.currentLocationCountDownBox = document.querySelector(
      `.${Plugin.CLASSES.CURRENT_LOCATION_COUNT_DOWN_BOX}`
    );
  }

  // 取最近值
  findClosest(arr, target) {
    return arr.reduce((prev, curr) =>
      Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev
    );
  }

  // 計算點與點之間的距離
  distance(latA, lngA, latB, lngB) {
    const toRadians = (degree) => (degree * Math.PI) / 180;
    const latARad = toRadians(latA);
    const lngARad = toRadians(lngA);
    const latBRad = toRadians(latB);
    const lngBRad = toRadians(lngB);
    return (
      Math.acos(
        Math.sin(latARad) * Math.sin(latBRad) +
          Math.cos(latARad) * Math.cos(latBRad) * Math.cos(lngARad - lngBRad)
      ) * 6371.008
    );
  }

  // 依照距離計算PS波抵達時間
  waveTimeByDistance(depth, dist, type = "P") {
    if (!this.timeTable || Object.keys(this.timeTable).length === 0) return 0;
    const depthKeys = Object.keys(this.timeTable).map(Number);
    if (depthKeys.length === 0) return 0;
    const depthKey = this.findClosest(depthKeys, depth).toString();
    const tableData = this.timeTable[depthKey];
    if (!tableData || tableData.length === 0) return 0;
    let time = 0.0,
      prev = null;
    for (const table of tableData) {
      if (time === 0 && table.R >= dist) {
        if (prev) {
          const rDiff = table.R - prev.R;
          const tDiff = table[type] - prev[type];
          time =
            rDiff === 0
              ? prev[type]
              : prev[type] + ((dist - prev.R) / rDiff) * tDiff;
        } else {
          time = table.R === 0 ? 0 : (dist / table.R) * table[type];
        }
      }
      if (time !== 0) break;
      prev = table;
    }
    if (time === 0 && prev && dist > prev.R) {
      if (tableData.length > 1) {
        const secondLast = tableData[tableData.length - 2];
        const last = prev;
        const slowness =
          (last[type] - secondLast[type]) / (last.R - secondLast.R);
        if (slowness > 0) {
          time = last[type] + (dist - last.R) * slowness;
        }
      }
      if (time === 0 && prev.R > 0 && prev[type] > 0) {
        time = (dist / prev.R) * prev[type];
      }
    }
    return time * 1000;
  }

  // 取得地震資料
  getEewData(TREM) {
    if (!this.currentLocationPwaveVal || !this.currentLocationSwaveVal) {
      return;
    }
    this.removeClass(); // 確保 DOM 狀態被重置

    if (!this.timeTable || Object.keys(this.timeTable).length === 0) {
      this.logger?.warn("TimeData 未初始化。");
      this.currentLocationPwaveVal.textContent = "";
      this.currentLocationSwaveVal.textContent = "";
      this.currentRotationNumber.textContent = "";
      if (this.currentLocationCountDownBox)
        this.currentLocationCountDownBox.style.display = "none";
      return;
    }

    const eewDataArray = TREM.variable.data.eew;
    if (!eewDataArray || eewDataArray.length === 0) {
      this.currentLocationPwaveVal.textContent = "";
      this.currentLocationSwaveVal.textContent = "";
      this.currentRotationNumber.textContent = "";
      if (this.currentLocationCountDownBox)
        this.currentLocationCountDownBox.style.display = "none";
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
      return;
    }

    let currentRotationIndex = TREM.variable.last_rotation;

    // 檢查 currentRotationIndex 有效性
    if (
      currentRotationIndex == null ||
      currentRotationIndex < 0 ||
      currentRotationIndex >= displayableEews.length
    ) {
      if (displayableEews.length > 0) {
        currentRotationIndex = currentRotationIndex % displayableEews.length;
      } else {
        this.currentLocationPwaveVal.textContent = "";
        this.currentLocationSwaveVal.textContent = "";
        this.currentRotationNumber.textContent = "";
        if (this.currentLocationCountDownBox)
          this.currentLocationCountDownBox.style.display = "none";
        return;
      }
    }

    // 再次檢查 currentRotationIndex，以防在取模後不符合預期
    if (
      currentRotationIndex < 0 ||
      currentRotationIndex >= displayableEews.length
    ) {
      this.currentLocationPwaveVal.textContent = "";
      this.currentLocationSwaveVal.textContent = "";
      this.currentRotationNumber.textContent = "";
      if (this.currentLocationCountDownBox)
        this.currentLocationCountDownBox.style.display = "none";
      return;
    }

    const currentEewData = displayableEews[currentRotationIndex];
    const eqData = currentEewData?.eq;

    if (
      !currentEewData ||
      !eqData ||
      !this.userLocation ||
      currentEewData.trigger === true
    ) {
      this.currentLocationPwaveVal.textContent = "";
      this.currentLocationSwaveVal.textContent = "";
      this.currentRotationNumber.textContent = "";
      if (this.currentLocationCountDownBox)
        this.currentLocationCountDownBox.style.display = "none";
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
    const currentTime = this.getCurrentTime(TREM);
    const surfaceDistance = this.distance(eqLat, eqLon, userLat, userLon);
    const pWaveTravelTimeMs = this.waveTimeByDistance(
      eqDepth,
      surfaceDistance,
      "P"
    );
    const sWaveTravelTimeMs = this.waveTimeByDistance(
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
      lastRotation: currentRotationIndex,
      statusClass: statusClass,
      I: userIntensityValueI,
      intensity: this.intensityFloatToInt(userIntensityValueI),
    });
  }

  // 移除 Class
  removeClass() {
    this.currentLocationPwaveVal.classList.remove(
      Plugin.CLASSES.ARRIVE,
      Plugin.CLASSES.UNKNOWN
    );
    this.currentLocationSwaveVal.classList.remove(
      Plugin.CLASSES.ARRIVE,
      Plugin.CLASSES.UNKNOWN
    );
    // this.currentRotationNumber.classList.remove('eew-rts', 'eew-alert', 'eew-warn', 'eew-cancel');
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

  // 取得目前時間
  getCurrentTime(TREM) {
    if (TREM.variable.replay.start_time && TREM.variable.replay.local_time) {
      return (
        TREM.variable.replay.start_time +
        (Date.now() - TREM.variable.replay.local_time)
      );
    }
    return Date.now();
  }

  // 渲染內容
  renderCountDown(data) {
    const formatSec = (sec) => (sec === "?" ? "?" : Math.round(sec));
    const updateWaveDisplay = (el, sec) => {
      if (!el) return;
      el.classList.remove(Plugin.CLASSES.ARRIVE, Plugin.CLASSES.UNKNOWN);
      if (sec === "?") {
        el.classList.add(Plugin.CLASSES.UNKNOWN);
        el.textContent = "";
      } else if (sec <= 0) {
        el.classList.add(Plugin.CLASSES.ARRIVE);
        el.textContent = "";
      } else {
        el.textContent = sec;
      }
    };
    const pSec = formatSec(data.pWaveRemainingSeconds);
    const sSec = formatSec(data.sWaveRemainingSeconds);
    updateWaveDisplay(this.currentLocationPwaveVal, pSec);
    updateWaveDisplay(this.currentLocationSwaveVal, sSec);
    this.currentLocationCountDownBox.style.display = data ? "flex" : "none";
    this.currentLocationPSWave.classList.add(data.statusClass);

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
  }

  // 取得震度
  intensityFloatToInt(float) {
    return float < 0
      ? 0
      : float < 4.5
      ? Math.round(float)
      : float < 5
      ? 5
      : float < 5.5
      ? 6
      : float < 6
      ? 7
      : float < 6.5
      ? 8
      : 9;
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

  async onLoad() {
    const { TREM, logger } = this.#ctx;
    this.logger = logger;

    if (
      typeof window !== "undefined" &&
      !window.location.pathname.includes("index.html")
    ) {
      return;
    }

    const setupMapResources = async () => {
      if (!this.map) {
        this.logger?.error("setupMapResources 被呼叫，但 this.map 未被設定。");
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
}

module.exports = Plugin;
