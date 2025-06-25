const os = require("os");
const path = require("path");

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

function findClosest(arr, target) {
  return arr.reduce((prev, curr) =>
    Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev
  );
}

function distance(latA, lngA, latB, lngB) {
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

function waveTimeByDistance(timeTable, depth, dist, type = "P") {
  if (!timeTable || Object.keys(timeTable).length === 0) return 0;
  const depthKeys = Object.keys(timeTable).map(Number);
  if (depthKeys.length === 0) return 0;
  const depthKey = findClosest(depthKeys, depth).toString();
  const tableData = timeTable[depthKey];
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

function getCurrentTime(TREM) {
  if (TREM.variable.replay.start_time && TREM.variable.replay.local_time) {
    return (
      TREM.variable.replay.start_time +
      (Date.now() - TREM.variable.replay.local_time)
    );
  }
  return Date.now();
}

function intensityFloatToInt(float) {
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

const formatSec = (sec) => (sec === "?" ? "?" : Math.round(sec));

const updateWaveDisplay = (el, sec, classes) => {
  if (!el) return;
  el.classList.remove(classes.ARRIVE, classes.UNKNOWN);
  if (sec === "?") {
    el.classList.add(classes.UNKNOWN);
    el.textContent = "";
  } else if (sec <= 0) {
    el.classList.add(classes.ARRIVE);
    el.textContent = "";
  } else {
    el.textContent = sec;
  }
};

module.exports = {
  getUserDataPath,
  findClosest,
  distance,
  waveTimeByDistance,
  getCurrentTime,
  intensityFloatToInt,
  formatSec,
  updateWaveDisplay,
};
