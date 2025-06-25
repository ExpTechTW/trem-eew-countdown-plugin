const { CLASSES } = require("./constants");

function createCountDownElement() {
  const newElement = document.createElement("div");
  newElement.className = CLASSES.CURRENT_LOCATION_COUNT_DOWN_WRAPPER;
  newElement.innerHTML = `
      <div class="${CLASSES.CURRENT_LOCATION_COUNT_DOWN_BOX}">
		  <div class="${CLASSES.CURRENT_ROTATION_NUMBER}"></div>
		  <div class="${CLASSES.CURRENT_LOCATION_INFO}">
			<div id="${CLASSES.CURRENT_LOCATION_LOC}" class="${CLASSES.CURRENT_LOCATION_LOC}"></div>
			<div class="${CLASSES.CURRENT_LOCATION_PSWAVE}">
				<div class="${CLASSES.CURRENT_LOCATION_INTENSITY_WRAPPER}">
					<div class="${CLASSES.CURRENT_LOCATION_INTENSITY_TEXT}"></div>
					<div class="${CLASSES.CURRENT_LOCATION_INTENSITY_BOX}"></div>
				</div>
			  <div class="${CLASSES.CURRENT_LOCATION_PWAVE_BOX}">
				<div class="${CLASSES.CURRENT_LOCATION_PWAVE_TEXT}"></div>
				<div class="${CLASSES.CURRENT_LOCATION_SEC_BOX}">
					<div class="${CLASSES.CURRENT_LOCATION_PWAVE_VAL}"></div>
				</div>
			  </div>
			  <div class="${CLASSES.CURRENT_LOCATION_SWAVE_BOX}">
				<div class="${CLASSES.CURRENT_LOCATION_SWAVE_TEXT}"></div>
				<div class="${CLASSES.CURRENT_LOCATION_SEC_BOX}">
					<div class="${CLASSES.CURRENT_LOCATION_SWAVE_VAL}"></div>
				</div>
			  </div>
			</div>
		  </div>
      <div class="${CLASSES.CURRENT_REPORT_NUMBER}"></div>
    </div>
    `;
  return newElement;
}

module.exports = {
  createCountDownElement,
};
