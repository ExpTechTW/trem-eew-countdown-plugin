const path = require("path");

class CountdownAudio {
  constructor(logger) {
    this.logger = logger;
    this.audioPlayers = {};
    this.audioQueue = [];
    this.isPlayingAudio = false;
    this.eewAudioState = {};
    this.audioSettings = {};
  }

  // 設定音效開關
  setAudioSettings(settings) {
    this.audioSettings = { ...settings };
    this.logger?.debug("音效設定已更新: ", this.audioSettings);
  }

  audioFilePaths = {
    0: "0.wav",
    1: "1.wav",
    2: "2.wav",
    3: "3.wav",
    4: "4.wav",
    5: "5.wav",
    6: "6.wav",
    7: "7.wav",
    8: "8.wav",
    9: "9.wav",
    10: "10.wav",
    "1xx": "1xx.wav",
    "2xx": "2xx.wav",
    "2x": "2x.wav",
    "3x": "3x.wav",
    "4x": "4x.wav",
    "5x": "5x.wav",
    "6x": "6x.wav",
    "7x": "7x.wav",
    "8x": "8x.wav",
    "9x": "9x.wav",
    x0: "x0.wav",
    x1: "x1.wav",
    x2: "x2.wav",
    x3: "x3.wav",
    x4: "x4.wav",
    x5: "x5.wav",
    x6: "x6.wav",
    x7: "x7.wav",
    x8: "x8.wav",
    x9: "x9.wav",
    intensity: "intensity.wav",
    "intensity-strong": "intensity-strong.wav",
    "intensity-weak": "intensity-weak.wav",
    second: "second.wav",
    alert: "alert.wav",
    arrive: "arrive.wav",
    ding: "ding.wav",
    update: "update.wav",
  };

  // 載入音效
  loadAudio() {
    for (const key in this.audioFilePaths) {
      if (this.audioFilePaths.hasOwnProperty(key)) {
        const filePath = path.resolve(
          __dirname,
          "audio",
          this.audioFilePaths[key]
        );
        this.audioPlayers[key] = new Audio(filePath);
        this.audioPlayers[key].load();
      }
    }
    this.logger?.info("音效檔案已載入。");
  }

  // 播放音效序列
  playAudioSequence(audioKeys) {
    if (audioKeys.includes("update") && !this.audioSettings.updateAudio) {
      this.logger?.debug("更新音效已關閉，跳過播放。");
      this.isPlayingAudio = false;
      this.playNextAudioInQueue();
      return;
    }
    if (audioKeys.length === 0) {
      this.isPlayingAudio = false;
      this.playNextAudioInQueue();
      return;
    }
    const currentKey = audioKeys[0];
    const audio = this.audioPlayers[currentKey];
    if (audio) {
      audio.currentTime = 0;
      audio
        .play()
        .then(() => {
          const remainingAudioKeys = audioKeys.slice(1);
          if (remainingAudioKeys.length > 0) {
            const nextKey = remainingAudioKeys[0];
            const isHundredsSound = currentKey.endsWith("xx");
            const isNextSoundTensOrUnit =
              ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"].includes(
                nextKey
              ) || nextKey.startsWith("x");
            const shouldOverlap = isHundredsSound && isNextSoundTensOrUnit;
            let delayBeforeNextAudio = 0;
            if (isNaN(audio.duration) || audio.duration <= 0) {
              delayBeforeNextAudio = 0;
            } else {
              const audioDurationMs = audio.duration * 1000;
              if (shouldOverlap) {
                delayBeforeNextAudio = Math.max(0, audioDurationMs - 50);
              } else {
                delayBeforeNextAudio = audioDurationMs;
              }
            }
            this.logger?.debug(
              `播放音效: ${currentKey}, 下一個音效: ${nextKey}, 延遲 ${delayBeforeNextAudio} ms`
            );
            setTimeout(() => {
              this.playAudioSequence(remainingAudioKeys);
            }, delayBeforeNextAudio);
          } else {
            this.isPlayingAudio = false;
            this.playNextAudioInQueue();
          }
        })
        .catch((error) => {
          this.logger?.error(`播放音效失敗 (${currentKey}):`, error);
          const remainingAudioKeys = audioKeys.slice(1);
          if (remainingAudioKeys.length > 0) {
            this.playAudioSequence(remainingAudioKeys);
          } else {
            this.isPlayingAudio = false;
            this.playNextAudioInQueue();
          }
        });
    } else {
      this.logger?.warn(`找不到音效檔案: ${currentKey}`);
      const remainingAudioKeys = audioKeys.slice(1);
      if (remainingAudioKeys.length > 0) {
        this.playAudioSequence(remainingAudioKeys);
      } else {
        this.isPlayingAudio = false;
        this.playNextAudioInQueue();
      }
    }
  }

  // 播放下一個音效
  playNextAudioInQueue() {
    if (this.audioQueue.length > 0 && !this.isPlayingAudio) {
      this.isPlayingAudio = true;
      const { audioKeys } = this.audioQueue.shift();
      this.playAudioSequence(audioKeys);
    }
  }

  // 取得倒數音效
  getAudioKeysForNumber(num) {
    const keys = [];
    if (num < 0) return keys;
    if (num === 0) {
      keys.push("0");
      return keys;
    }
    let isTensPartAfterHundreds = false;
    if (num >= 100) {
      const hundreds = Math.floor(num / 100);
      if (hundreds === 1) {
        keys.push("1xx");
      } else if (hundreds === 2) {
        keys.push("2xx");
      }
      num %= 100;
      if (num === 0) {
        return keys;
      }
      if (num > 0 && num < 10) {
        keys.push("0");
      }
      isTensPartAfterHundreds = true;
    }
    if (num >= 10) {
      const tens = Math.floor(num / 10);
      const units = num % 10;
      if (tens === 1) {
        if (isTensPartAfterHundreds) {
          keys.push("1");
          keys.push("x0");
        } else {
          keys.push("10");
        }
        if (units > 0) {
          keys.push(units.toString());
        }
      } else {
        keys.push(tens.toString());
        keys.push("x0");
        if (units > 0) {
          keys.push(units.toString());
        }
      }
    } else if (num > 0) {
      keys.push(num.toString());
    }
    return keys;
  }

  playCountdownAudio(sWaveSec, intensity, eewId) {
    const roundedSSec = Math.round(sWaveSec);
    if (
      !this.audioSettings.countdownAudio ||
      sWaveSec === "?" ||
      sWaveSec === undefined ||
      Math.round(sWaveSec) > 200
    ) {
      return;
    }
    let eewState = this.eewAudioState[eewId];
    if (!eewState) {
      this.logger?.warn(`未找到 ID: ${eewId} 的 EEW 音效狀態，正在初始化。`);
      eewState = {
        isInitialBroadcastDone: false,
        lastSpokenCountdown: -1,
        isArrivedAudioPlayed: false,
      };
      this.eewAudioState[eewId] = eewState;
    }
    const audioKeys = [];

    // 抵達音效
    if (roundedSSec <= 0) {
      if (!eewState.isArrivedAudioPlayed) {
        audioKeys.push("arrive");
        if (this.audioSettings.ding) {
          for (let i = 0; i < 10; i++) {
            audioKeys.push("ding");
          }
        }
        eewState.isArrivedAudioPlayed = true;
        eewState.lastSpokenCountdown = 0;
      }
    }
    // 初始廣播邏輯
    else if (!eewState.isInitialBroadcastDone) {
      if (intensity >= 0 && intensity <= 4) {
        audioKeys.push(intensity.toString());
        audioKeys.push("intensity");
      } else if (intensity === 5) {
        audioKeys.push("5");
        audioKeys.push("intensity-weak");
      } else if (intensity === 6) {
        audioKeys.push("5");
        audioKeys.push("intensity-strong");
      } else if (intensity === 7) {
        audioKeys.push("6");
        audioKeys.push("intensity-weak");
      } else if (intensity === 8) {
        audioKeys.push("6");
        audioKeys.push("intensity-strong");
      } else if (intensity === 9) {
        audioKeys.push("7");
        audioKeys.push("intensity");
      }
      audioKeys.push(...this.getAudioKeysForNumber(roundedSSec));
      audioKeys.push("second");
      eewState.isInitialBroadcastDone = true;
      eewState.lastSpokenCountdown = roundedSSec;
    }
    // 後續倒數
    else {
      if (
        roundedSSec !== eewState.lastSpokenCountdown &&
        (roundedSSec % 10 === 0 || roundedSSec <= 10)
      ) {
        audioKeys.push(...this.getAudioKeysForNumber(roundedSSec));
        if (roundedSSec % 10 === 0 && roundedSSec !== 10) {
          audioKeys.push("second");
        }
        eewState.lastSpokenCountdown = roundedSSec;
      }
    }
    if (audioKeys.length > 0) {
      this.audioQueue.push({ audioKeys });
      this.playNextAudioInQueue();
    }
  }

  // 清除特定EEW的音效狀態
  clearEewAudioState(eewId) {
    if (this.eewAudioState[eewId]) {
      delete this.eewAudioState[eewId];
      this.logger?.debug(`已清除 EEW ID: ${eewId} 的音效狀態。`);
    }
  }

  // 重設音效佇列及播放狀態
  resetAudioQueueAndState() {
    this.audioQueue = [];
    this.isPlayingAudio = false;
    for (const key in this.audioPlayers) {
      if (this.audioPlayers.hasOwnProperty(key)) {
        const audio = this.audioPlayers[key];
        if (!audio.paused && key !== "ding") {
          audio.pause();
          audio.currentTime = 0;
        }
      }
    }
    this.logger?.debug("已重設音效佇列和播放狀態。");
  }
}

module.exports = CountdownAudio;
