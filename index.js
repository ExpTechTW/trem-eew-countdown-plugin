const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

function getUserDataPath(appName = 'trem_lite') {
  const home = os.homedir();
  switch (process.platform) {
    case 'win32':
      return path.join(home, 'AppData', 'Roaming', appName);
    case 'darwin':
      return path.join(home, 'Library', 'Application Support', appName);
    case 'linux':
      return path.join(home, '.config', appName);
    default:
      throw new Error('Unsupported platform: ' + process.platform);
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

  static CLASSES = {
    CURRENT_LOCATION_COUNT_DOWN: "current-location-count-down",
    CURRENT_ROTATION_NUMBER: "current-rotation-number",
    CURRENT_LOCATION_INFO: "current-location-info",
    CURRENT_LOCATION_LOC: "current-location-loc",
    CURRENT_LOCATION_PSWAVE: "current-location-pswave",
    CURRENT_LOCATION_PWAVE_BOX: "current-location-pwave-box",
    CURRENT_LOCATION_PWAVE_TEXT: "current-location-pwave-text",
    CURRENT_LOCATION_PWAVE_VAL: "current-location-pwave-val",
    CURRENT_LOCATION_PWAVE_SEC_TEXT: "current-location-pwave-sec-text",
    CURRENT_LOCATION_SWAVE_BOX: "current-location-swave-box",
    CURRENT_LOCATION_SWAVE_TEXT: "current-location-swave-text",
    CURRENT_LOCATION_SWAVE_VAL: "current-location-swave-val",
    CURRENT_LOCATION_SWAVE_SEC_TEXT: "current-location-swave-sec-text",
    ARRIVE: "arrive",
    UNKNOWN: "unknown",
  };

  constructor(ctx) {
    this.#ctx = ctx;
    this.configDir = path.join(getUserDataPath(), 'user', 'config.yml');
    this.imageUrl = path.resolve(__dirname, 'gps.png');
    this.config = {};
  }

  // 初始化
  async init(TREM) {
    this.readConfigYaml();
    try {
      this.regions = await this.fetchData('region');
    } catch (error) {
      this.logger?.error("Failed to load region data:", error);
      this.regions = {};
    }
    this.timeTable = await this.fetchData('time');
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
      const raw = fs.readFileSync(this.configDir, 'utf8');
      this.config = yaml.load(raw);
      this.logger?.info('Config loaded:', this.config);
    } catch (error) {
      this.logger?.warn('Config YAML 讀取失敗：', error.message);
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
    const target = document.querySelector(".rts-intensity-list-wrapper");
    if (
      !document.querySelector(`.${Plugin.CLASSES.CURRENT_LOCATION_COUNT_DOWN}`) &&
      target
    ) {
      const newElement = this.createCountDownElement();
      target.appendChild(newElement);
      this.applyStyles();
      this.cacheDOMElements();
    }
  }


  createCountDownElement() {
    const newElement = document.createElement("div");
    newElement.className = Plugin.CLASSES.CURRENT_LOCATION_COUNT_DOWN;
    newElement.innerHTML = `
      <div class="${Plugin.CLASSES.CURRENT_ROTATION_NUMBER}"></div>
      <div class="${Plugin.CLASSES.CURRENT_LOCATION_INFO}">
        <div id="${Plugin.CLASSES.CURRENT_LOCATION_LOC}" class="${Plugin.CLASSES.CURRENT_LOCATION_LOC}"></div>
        <div class="${Plugin.CLASSES.CURRENT_LOCATION_PSWAVE}">
          <div class="${Plugin.CLASSES.CURRENT_LOCATION_PWAVE_BOX}">
            <div class="${Plugin.CLASSES.CURRENT_LOCATION_PWAVE_TEXT}"></div>
            <div class="${Plugin.CLASSES.CURRENT_LOCATION_PWAVE_VAL}"></div>
            <div class="${Plugin.CLASSES.CURRENT_LOCATION_PWAVE_SEC_TEXT}"></div>
          </div>
          <div class="${Plugin.CLASSES.CURRENT_LOCATION_SWAVE_BOX}">
            <div class="${Plugin.CLASSES.CURRENT_LOCATION_SWAVE_TEXT}"></div>
            <div class="${Plugin.CLASSES.CURRENT_LOCATION_SWAVE_VAL}"></div>
            <div class="${Plugin.CLASSES.CURRENT_LOCATION_SWAVE_SEC_TEXT}"></div>
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
        top: -7px;
        left: -7px;
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
		z-index: 9999;
      }
      .${Plugin.CLASSES.CURRENT_ROTATION_NUMBER}:not(:empty) {
         display: flex;
      }
      .${Plugin.CLASSES.CURRENT_LOCATION_COUNT_DOWN} {
        padding: 2px;
        background-color: #505050;
        color: white;
        display: flex;
        width: 190px;
        height: 60px;
        margin-right: 3px;
        transition: transform 0.6s ease;
        pointer-events: none;
        border-radius: 5px;
        border: 1px solid #ffffff6b;
        position: relative;
      }
      .${Plugin.CLASSES.CURRENT_LOCATION_INFO} {
        display: flex;
        flex-direction: column;
        flex-wrap: wrap;
        width: 100%;
		margin-right: 3px;
		margin-left: 3px;
        justify-content: space-around;
      }
      .${Plugin.CLASSES.CURRENT_LOCATION_LOC} {
        font-size: 17px;
        font-weight: bold;
        text-align: center;
      }
      .${Plugin.CLASSES.CURRENT_LOCATION_PSWAVE} {
			display: flex;
			justify-content: space-around;
			font-size: 14px;
			font-weight: bold;
			background-color: #383838;
			border-radius: 5px;
			border: 1px solid #27272778;
			height: 25px;
			align-items: center;
      }
      .${Plugin.CLASSES.CURRENT_LOCATION_PWAVE_BOX},
      .${Plugin.CLASSES.CURRENT_LOCATION_SWAVE_BOX} {
			display: flex;
			width: 71px;
      }
      .${Plugin.CLASSES.CURRENT_LOCATION_PWAVE_TEXT} {
        margin-right: 3px;
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
      .${Plugin.CLASSES.CURRENT_LOCATION_PWAVE_SEC_TEXT}:before,
      .${Plugin.CLASSES.CURRENT_LOCATION_SWAVE_SEC_TEXT}:before {
        content: "秒";
      }
      .${Plugin.CLASSES.CURRENT_LOCATION_PWAVE_VAL}:empty + .${Plugin.CLASSES.CURRENT_LOCATION_PWAVE_SEC_TEXT},
      .${Plugin.CLASSES.CURRENT_LOCATION_SWAVE_VAL}:empty + .${Plugin.CLASSES.CURRENT_LOCATION_SWAVE_SEC_TEXT} {
        display: none;
      }
      .${Plugin.CLASSES.CURRENT_LOCATION_PWAVE_VAL}.${Plugin.CLASSES.ARRIVE},
	  .${Plugin.CLASSES.CURRENT_LOCATION_SWAVE_VAL}.${Plugin.CLASSES.ARRIVE} {
        background: var(--rts-trigger-high);
      }
      .${Plugin.CLASSES.CURRENT_LOCATION_PWAVE_VAL},
      .${Plugin.CLASSES.CURRENT_LOCATION_SWAVE_VAL} {
          border: 1px solid #ffffff4d;
          border-radius: 5px;
          height: 15px;
          min-width: 20px;
          padding: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 2px;
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
  waveTimeByDistance(depth, dist, type = 'P') {
    if (!this.timeTable || Object.keys(this.timeTable).length === 0) return 0;
    const depthKeys = Object.keys(this.timeTable).map(Number);
    if (depthKeys.length === 0) return 0;
    const depthKey = this.findClosest(depthKeys, depth).toString();
    const tableData = this.timeTable[depthKey];
    if (!tableData || tableData.length === 0) return 0;
    let time = 0.0, prev = null;
    for (const table of tableData) {
      if (time === 0 && table.R >= dist) {
        if (prev) {
          const rDiff = table.R - prev.R;
          const tDiff = table[type] - prev[type];
          time = rDiff === 0 ? prev[type] : prev[type] + ((dist - prev.R) / rDiff) * tDiff;
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
        const slowness = (last[type] - secondLast[type]) / (last.R - secondLast.R);
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
    this.currentLocationPwaveVal.classList.remove(Plugin.CLASSES.ARRIVE, Plugin.CLASSES.UNKNOWN);
    this.currentLocationSwaveVal.classList.remove(Plugin.CLASSES.ARRIVE, Plugin.CLASSES.UNKNOWN);
    this.currentRotationNumber.classList.remove('eew-rts', 'eew-alert', 'eew-warn', 'eew-cancel');
    if (!this.timeTable || Object.keys(this.timeTable).length === 0) {
      this.logger?.warn("TimeData 未初始化。");
      return;
    }
    const eewDataArray = TREM.variable.data.eew;
    if (!eewDataArray || eewDataArray.length === 0) {
      this.currentLocationPwaveVal.textContent = "";
      this.currentLocationSwaveVal.textContent = "";
      this.currentRotationNumber.textContent = "";
      return;
    }
    const currentEewData = eewDataArray[TREM.variable.last_rotation];
    const eqData = currentEewData?.eq;
    if (!eqData || !this.userLocation) {
      return;
    }
    const { lat: eqLat, lon: eqLon, depth: eqDepth, time: originTime } = eqData;
    const { lat: userLat, lon: userLon } = this.userLocation;
    const currentTime = this.getCurrentTime(TREM);
    const surfaceDistance = this.distance(eqLat, eqLon, userLat, userLon);
    const pWaveTravelTimeMs = this.waveTimeByDistance(eqDepth, surfaceDistance, 'P');
    const sWaveTravelTimeMs = this.waveTimeByDistance(eqDepth, surfaceDistance, 'S');
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
    this.renderCountDown({
      id: currentEewData.id,
      serial: currentEewData.serial,
      user: this.userLocation,
      distance: surfaceDistance,
      pWaveRemainingSeconds,
      sWaveRemainingSeconds,
      lastRotation: TREM.variable.last_rotation,
      statusClass: statusClass,
    });
  }

  // 取得目前時間
  getCurrentTime(TREM) {
    if (TREM.variable.replay.start_time && TREM.variable.replay.local_time) {
      return TREM.variable.replay.start_time + (Date.now() - TREM.variable.replay.local_time);
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
    this.currentRotationNumber.textContent =
      data.lastRotation !== null ? data.lastRotation + 1 : "";
    this.currentRotationNumber.classList.add(data.statusClass);
  }

  // 更新地圖上使用者位置
  updateUserMarkerOnMap() {
    if (!this.map || !this.map.isStyleLoaded() || !this.map.getSource('user-location-source')) {
      return;
    }
    const source = this.map.getSource('user-location-source');
    if (this.userLocation && typeof this.userLocation.lon === 'number' && typeof this.userLocation.lat === 'number') {
      const geojson = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [this.userLocation.lon, this.userLocation.lat]
          }
        }]
      };
      source.setData(geojson);
      if (this.map.getLayer('user-location-layer')) {
        this.map.setLayoutProperty('user-location-layer', 'visibility', 'visible');
      }
    } else {
      source.setData({ type: 'FeatureCollection', features: [] });
      if (this.map.getLayer('user-location-layer')) {
        this.map.setLayoutProperty('user-location-layer', 'visibility', 'none');
      }
    }
  }

  // 取得使用者位置並更新元素
  getLocationInfoAndUpdateDOM() {
    let newLocation = null;
    let displayName = "";
    if (this.config && this.config["location-code"]) {
      const targetCode = this.config["location-code"];
      if (this.regions && Object.keys(this.regions).length > 0) {
        for (const cityKey in this.regions) {
          if (this.regions.hasOwnProperty(cityKey)) {
            const city = this.regions[cityKey];
            for (const districtKey in city) {
              if (city.hasOwnProperty(districtKey)) {
                const data = city[districtKey];
                if (data.code === targetCode) {
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
              if (!this.map.hasImage('gps-marker')) {
                this.map.addImage('gps-marker', image.data);
              }
            } else {
              this.logger?.warn(`地圖圖標 ${this.imageUrl} 載入失敗或圖片資料不存在`);
            }
            if (!this.map.getSource('user-location-source')) {
              this.map.addSource('user-location-source', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
              });
            }
            if (!this.map.getLayer('user-location-layer')) {
              this.map.addLayer({
                id: 'user-location-layer',
                type: 'symbol',
                source: 'user-location-source',
                layout: {
                  'icon-image': 'gps-marker',
                  'icon-size': 0.35,
                  'icon-allow-overlap': true,
                  'icon-ignore-placement': true,
                  'visibility': 'none'
                }
              });
            }
            this.getLocationInfoAndUpdateDOM();
            this.logger?.info("地圖資源設定完成。");
          } catch (err) {
            this.logger?.error(`設定地圖資源時發生錯誤 (${this.imageUrl}):`, err);
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
