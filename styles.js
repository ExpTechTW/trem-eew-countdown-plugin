const { CLASSES } = require("./constants");

function applyStyles() {
  const style = document.createElement("style");
  style.textContent = `
      .${CLASSES.CURRENT_LOCATION_COUNT_DOWN_WRAPPER} {
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
      .${CLASSES.CURRENT_LOCATION_COUNT_DOWN_BOX} {
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
	  .${CLASSES.CURRENT_LOCATION_COUNT_DOWN_BOX}:after {
        display: none !important;
      }
      .${CLASSES.CURRENT_LOCATION_INFO} {
        display: flex;
        flex-direction: column;
        flex-wrap: wrap;
        width: 100%;
        justify-content: space-around;
      }
      .${CLASSES.CURRENT_LOCATION_LOC} {
        font-size: 1.2rem;
        font-weight: bold;
        text-align: center;
      }
      .intensity-4 .${CLASSES.CURRENT_LOCATION_LOC},
      .intensity-5 .${CLASSES.CURRENT_LOCATION_LOC},
      .intensity-6 .${CLASSES.CURRENT_LOCATION_LOC},
      .${CLASSES.CURRENT_LOCATION_PSWAVE}.eew-warn,
      .${CLASSES.CURRENT_ROTATION_NUMBER}.eew-warn {
		    color: #000;
      }
      .${CLASSES.CURRENT_LOCATION_PSWAVE} {
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
      .${CLASSES.CURRENT_LOCATION_PWAVE_BOX},
      .${CLASSES.CURRENT_LOCATION_SWAVE_BOX},
      .${CLASSES.CURRENT_LOCATION_INTENSITY_BOX} {
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
      .${CLASSES.CURRENT_LOCATION_INTENSITY_BOX} {
        border: 1px solid #ffffff4f !important;
        width: 35px;
        height: 35px;
        min-width: unset;
      }
      .${CLASSES.CURRENT_LOCATION_INTENSITY_BOX}.intensity-0:after {
        content: "0" !important;
      }
      .${CLASSES.CURRENT_LOCATION_INTENSITY_WRAPPER} {
        display: flex;
        flex-direction: column;
        align-items: center;
        height: 4.3rem;
        justify-content: center;
      }
      .${CLASSES.CURRENT_LOCATION_INTENSITY_TEXT} {
        margin-right: 3px;
        font-size: 1rem;
      }
      .${CLASSES.CURRENT_LOCATION_INTENSITY_TEXT}:before {
        content: "震度";
      }
      .${CLASSES.CURRENT_LOCATION_PWAVE_TEXT}:before {
        content: "P波";
      }
      .${CLASSES.CURRENT_LOCATION_SWAVE_TEXT} {
        margin-right: 5px;
      }
      .${CLASSES.CURRENT_LOCATION_SWAVE_TEXT}:before {
        content: "S波";
      }
      .${CLASSES.CURRENT_LOCATION_LOC}:empty:before,
      .${CLASSES.CURRENT_LOCATION_PWAVE_VAL}:empty:before,
      .${CLASSES.CURRENT_LOCATION_SWAVE_VAL}:empty:before {
        content: "-";
      }
      .${CLASSES.CURRENT_LOCATION_PWAVE_VAL}.${CLASSES.ARRIVE}:before,
      .${CLASSES.CURRENT_LOCATION_SWAVE_VAL}.${CLASSES.ARRIVE}:before {
        content: "抵達";
      }
      .${CLASSES.CURRENT_LOCATION_PWAVE_VAL}.${CLASSES.UNKNOWN}:before,
      .${CLASSES.CURRENT_LOCATION_SWAVE_VAL}.${CLASSES.UNKNOWN}:before {
        content: "?";
      }
      .${CLASSES.CURRENT_LOCATION_PWAVE_VAL}:not(:empty):after,
      .${CLASSES.CURRENT_LOCATION_SWAVE_VAL}:not(:empty):after {
        content: "秒";
        font-size: 1.2rem;
        margin-left: 3px;
        margin-top: 4px;
      }
      .${CLASSES.CURRENT_LOCATION_PWAVE_VAL},
      .${CLASSES.CURRENT_LOCATION_SWAVE_VAL},
      .${CLASSES.CURRENT_LOCATION_SWAVE_VAL} {
        border-radius: 5px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
      }
      .${CLASSES.CURRENT_LOCATION_SEC_BOX} {
        display: flex;
        align-items: flex-end;
      }
      .${CLASSES.CURRENT_ROTATION_NUMBER} {
          position: absolute;
          left: .5rem;
          top: .5rem;
          border: 1px solid #ffffff4f;
          border-radius: 50%;
          width: 1rem;
          height: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: .8rem;
          color: #ffffff;
          opacity: 0;
      }
      .${CLASSES.CURRENT_REPORT_NUMBER} {
          position: absolute;
          right: .5rem;
          top: .5rem;
          border: 1px solid #ffffff4f;
          border-radius: 10px;
          padding: 0 .4rem;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: .8rem;
          background: #383838;
          color: #ffffff;
      }
      .${CLASSES.CURRENT_REPORT_NUMBER}:before {
          content: "第";
      }
      .${CLASSES.CURRENT_REPORT_NUMBER}:after {
          content: "報";
      }
      .${CLASSES.CURRENT_REPORT_NUMBER}.is-final-report::after {
          content: "(最終報)";
          margin-left: 5px;
          font-size: 0.7em;
          color: #ffffff;
      }
    `;
  document.head.appendChild(style);
}

module.exports = {
  applyStyles,
};
