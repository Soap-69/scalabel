/* global sprintf */

/* exported Sat SatImage SatLabel ImageLabel */

/*
 Utilities
 */

let COLOR_PALETTE = [
  [31, 119, 180],
  [174, 199, 232],
  [255, 127, 14],
  [255, 187, 120],
  [44, 160, 44],
  [152, 223, 138],
  [214, 39, 40],
  [255, 152, 150],
  [148, 103, 189],
  [197, 176, 213],
  [140, 86, 75],
  [196, 156, 148],
  [227, 119, 194],
  [247, 182, 210],
  [127, 127, 127],
  [199, 199, 199],
  [188, 189, 34],
  [219, 219, 141],
  [23, 190, 207],
  [158, 218, 229],
];

/**
 * Summary: Tune the shade or tint of rgb color
 * @param {[number,number,number]} rgb: input color
 * @param {[number,number,number]} base: base color (white or black)
 * @param {number} ratio: blending ratio
 * @return {[number,number,number]}
 */
function blendColor(rgb, base, ratio) {
  let newRgb = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    newRgb[i] = Math.max(0,
        Math.min(255, rgb[i] + Math.round((base[i] - rgb[i]) * ratio)));
  }
  return newRgb;
}

/**
 * Pick color from the palette. Add additional shades and tints to increase
 * the color number. Results: https://jsfiddle.net/739397/e980vft0/
 * @param {[int]} index: palette index
 * @return {[number,number,number]}
 */
function pickColorPalette(index) {
  let colorIndex = index % COLOR_PALETTE.length;
  let shadeIndex = (Math.floor(index / COLOR_PALETTE.length)) % 3;
  let rgb = COLOR_PALETTE[colorIndex];
  if (shadeIndex === 1) {
    rgb = blendColor(rgb, [255, 255, 255], 0.4);
  } else if (shadeIndex === 2) {
    rgb = blendColor(rgb, [0, 0, 0], 0.2);
  }
  return rgb;
}

/**
 * Base class for each labeling session/task
 * @param {SatItem} ItemType: item instantiation type
 * @param {SatLabel} LabelType: label instantiation type
 */
function Sat(ItemType, LabelType) {
  this.items = []; // a.k.a ImageList, but can be 3D model list
  this.labels = []; // list of label objects
  this.labelIdMap = {};
  this.lastLabelId = 0;
  this.currentItem = null;
  this.ItemType = ItemType;
  this.LabelType = LabelType;
  this.events = [];
  this.startTime = Date.now();
  this.taskId = null;
  this.projectName = null;
}

Sat.prototype.getIPAddress = function() {
  $.getJSON('//freegeoip.net/json/?callback=?', function(data) {
    this.ipAddress = data;
  });
};

Sat.prototype.newItem = function(url) {
  let item = new this.ItemType(this, this.items.length, url);
  this.items.push(item);
  return item;
};

Sat.prototype.newLabelId = function() {
  let newId = this.lastLabelId + 1;
  this.lastLabelId = newId;
  return newId;
};

Sat.prototype.newLabel = function(optionalAttributes) {
  let self = this;
  let label = new self.LabelType(self, self.newLabelId(), optionalAttributes);
  self.labelIdMap[label.id] = label;
  self.labels.push(label);
  self.currentItem.labels.push(label);
  return label;
};

Sat.prototype.addEvent = function(action, itemIndex, labelId = -1,
                                  position = null) {
  this.events.push({
    timestamp: Date.now(),
    action: action,
    itemIndex: itemIndex,
    labelId: labelId,
    position: position,
  });
};

// TODO
Sat.prototype.load = function() {
  let self = this;
  let x = new XMLHttpRequest();
  x.onreadystatechange = function() {
    if (x.readyState === 4) {
      let assignment = JSON.parse(x.response);
      let itemLocs = assignment.items;
      self.addEvent('start labeling', self.currentItem); // ??
      // preload items
      self.items = [];
      for (let i = 0; i < itemLocs.length; i++) {
        self.items.push(new self.ItemType(self, i, itemLocs[i].url));
      }
      self.currentItem = self.items[0];
      self.currentItem.setActive(true);
      self.currentItem.image.onload = function() {
        self.currentItem.redraw();
      };
    }
  };
  // get params from url path
  let searchParams = new URLSearchParams(window.location.search);
  self.taskId = searchParams.get('task_id');
  self.projectName = searchParams.get('project_name');

  // ?
  let request = JSON.stringify({
    'assignmentId': self.taskId,
    'projectName': self.projectName,
  });
  x.open('POST', './requestSubmission');
  x.send(request);
};

// TODO
Sat.prototype.submit = function() {

};

// TODO
Sat.prototype.gotoItem = function(index) {
  //  TODO: save
  // mod the index to wrap around the list
  index = index % this.items.length;
  // TODO: event?
  this.currentItem.setActive(false);
  this.currentItem = this.items[index];
  this.currentItem.setActive(true);
  this.currentItem.onload = function() {
    this.currentItem.redraw();
  };
  this.currentItem.redraw();
};

/**
 * Information used for submission
 * @return {{items: Array, labels: Array, events: *, userAgent: string}}
 */
Sat.prototype.getInfo = function() {
  let self = this;
  let items = [];
  for (let i = 0; i < this.items.length; i++) {
    items.push(this.items[i].toJson());
  }
  let labels = [];
  for (let i = 0; i < this.labels.length; i++) {
    if (this.labels[i].valid) {
      labels.push(this.labels[i].toJson());
    }
  }
  return {
    startTime: self.startTime,
    items: items,
    labels: labels,
    events: self.events,
    userAgent: navigator.userAgent,
    ipAddress: self.ipAddress,
  };
};

/**
 * Base class for each labeling target, can be pointcloud or 2D image
 * @param {Sat} sat: context
 * @param {number} index: index of this item in sat
 * @param {string | null} url: url to load the item
 */
function SatItem(sat, index = -1, url = null) {
  this.sat = sat;
  this.index = index;
  this.url = url;
  this.labels = [];
  this.ready = false;
}

SatItem.prototype.loaded = function() {
  this.ready = true;
  this.sat.addEvent('loaded', this.index);
};

SatItem.prototype.previousItem = function() {
  if (this.index === 0) {
    return null;
  }
  return this.sat.items[this.index-1];
};

SatItem.prototype.nextItem = function() {
  if (this.index < this.sat.items.length - 1) {
    return null;
  }
  return this.sat.items[this.index+1];
};

SatItem.prototype.toJson = function() {
  let labelIds = [];
  for (let i = 0; i < this.labels.length; i++) {
    if (this.labels[i].valid) {
      labelIds.push(this.labels[i].id);
    }
  }
  return {url: this.url, index: this.index, labels: labelIds};
};

SatItem.prototype.fromJson = function(object) {
  this.url = object.url;
  this.index = object.index;
  for (let i = 0; i < object.labelIds.length; i++) {
    this.labels.push(this.sat.labelIdMap[object.labelIds[i]]);
  }
};

SatItem.prototype.getVisibleLabels = function() {
  let labels = [];
  for (let i = 0; i < this.labels.length; i++) {
    if (this.labels[i].valid && this.labels[i].numChildren === 0) {
      labels.push(this.labels[i]);
    }
  }
  return labels;
};

/**
 * Base class for each targeted labeling Image.
 *
 * To define a new tool:
 *
 * function NewTool() {
 *   SatImage.call(this, sat, index, url);
 * }
 *
 * NewTool.prototype = Object.create(SatImage.prototype);
 *
 * @param {Sat} sat: context
 * @param {number} index: index of this item in sat
 * @param {string} url: url to load the item
 */
function SatImage(sat, index, url) {
  let self = this;
  SatItem.call(self, sat, index, url);
  self.image = new Image();
  self.image.onload = function() {
    self.loaded();
  };
  self.image.src = self.url;

  self.imageRatio = 0;
}

SatImage.prototype = Object.create(SatItem.prototype);

/**
 * Set whether this SatImage is the active one in the sat instance.
 * @param {boolean} active: if this SatImage is active
 */
SatImage.prototype.setActive = function(active) {
  let self = this;
  self.active = active;
  if (active) {
    self.imageCanvas = document.getElementById('image_canvas');
    self.hiddenCanvas = document.getElementById('hidden_canvas');
    self.mainCtx = self.imageCanvas.getContext('2d');
    self.hiddenCtx = self.hiddenCanvas.getContext('2d');
    self.state = 'free';
    self.lastLabelID = 0;
    self.padBox = self._getPadding();
    self.catSel = document.getElementById('category_select');
    self.catSel.selectedIndex = 0;
    self.occlCheckbox = document.getElementById('occluded_checkbox');
    self.truncCheckbox = document.getElementById('truncated_checkbox');
    document.getElementById('prev_btn').onclick = function() {
      self.sat.gotoItem(self.index - 1);
    };
    document.getElementById('next_btn').onclick = function() {
      self.sat.gotoItem(self.index + 1);
    };
    document.onmousedown = function(e) {
      self._mousedown(e);
    };
    document.onmousemove = function(e) {
      self._mousemove(e);
    };
    document.onmouseup = function(e) {
      self._mouseup(e);
    };
    $('#category_select').change(function() {
      self._changeCat();
    });
    $('[name=\'occluded-checkbox\']').on('switchChange.bootstrapSwitch',
    function() {
      self._occlSwitch();
    });
    $('[name=\'truncated-checkbox\']').on('switchChange.bootstrapSwitch',
    function() {
      self._truncSwitch();
    });
    // TODO: Wenqi
    // traffic light color
    $('#remove_btn').click(function() {
      self.remove();
    });
  } else {
    // TODO: do we need anything here?
  }
};

SatImage.prototype.loaded = function() {
  // Call SatItem loaded
  SatItem.prototype.loaded.call(this);
  // TODO: Show the image here when the image is loaded.
  // Sean: (Why here? Will show every image on load, which is not what we want,
  // we want user to control top image)
};

/**
 * Redraws this SatImage and all labels.
 */
SatImage.prototype.redraw = function() {
  let self = this;
  self.padBox = self._getPadding();
  self.mainCtx.clearRect(0, 0, self.imageCanvas.width,
    self.imageCanvas.height);
  self.hiddenCtx.clearRect(0, 0, self.hiddenCanvas.width,
    self.hiddenCanvas.height);
  self.mainCtx.drawImage(self.image, 0, 0, self.image.width, self.image.height,
    self.padBox.x, self.padBox.y, self.padBox.w, self.padBox.h);
  for (let i = 0; i < self.labels.length; i++) {
    self.labels[i].redraw(self.mainCtx, self.hiddenCtx, self.selectedLabel,
      self.resizeID === self.labels[i].id, self.hoverLabel, self.hoverHandle);
  }
};

/**
 * Removes the currently selected item.
 */
SatImage.prototype.remove = function() {
  let self = this;
  if (self.selectedLabel) {
    for (let i = 0; i < self.labels.length; i++) {
      if (self.labels[i].id === self.selectedLabel.id) {
        self.labels.splice(i, 1);
        self.selectedLabel = null;
        self.redraw();
        return;
      }
    }
  }
};

/**
 * Called when this SatImage is active and the mouse is clicked.
 * @param {object} e: mouse event
 */
SatImage.prototype._mousedown = function(e) {
  let self = this;
  if (/*self._isWithinFrame(e) &&*/ self.state === 'free') {
    let mousePos = self._getMousePos(e);
    [self.selectedLabel, self.currHandle] = self._getSelected(mousePos);
    // change checked traits on label selection
    if (self.selectedLabel) {
      for (let i = 0; i < self.catSel.options.length; i++) {
        if (self.catSel.options[i].innerHTML === self.selectedLabel.name) {
          self.catSel.selectedIndex = i;
          break;
        }
      }
      if ($('[name=\'occluded-checkbox\']').prop('checked') !==
        self.selectedLabel.occl) {
        $('[name=\'occluded-checkbox\']').trigger('click');
      }
      if ($('[name=\'truncated-checkbox\']').prop('checked') !==
        self.selectedLabel.trunc) {
        $('[name=\'truncated-checkbox\']').trigger('click');
      }
      // TODO: Wenqi
      // traffic light color
    }

    if (self.selectedLabel && self.currHandle > 0) {
      // if we have a resize handle
      self.state = 'resize';
      self.resizeID = self.selectedLabel.id;
    } else if (self.currHandle === 0) {
      // if we have a move handle
      self.movePos = self.selectedLabel.getCurrentPosition();
      self.moveClickPos = mousePos;
      self.state = 'move';
    } else if (!self.selectedLabel) {
      // otherwise, new label
      let cat = self.catSel.options[self.catSel.selectedIndex].innerHTML;
      let occl = self.occlCheckbox.checked;
      let trunc = self.truncCheckbox.checked;
      self.selectedLabel = self.sat.newLabel({category: cat, occl: occl, trunc: trunc, mousePos: mousePos});
      self.state = 'resize';
      self.currHandle = self.selectedLabel.INITIAL_HANDLE;
      self.resizeID = self.selectedLabel.id;
    }
  }
  self.redraw();
};

/**
 * Called when this SatImage is active and the mouse is moved.
 * @param {object} e: mouse event
 */
SatImage.prototype._mousemove = function(e) {
  let self = this;
  let canvRect = this.imageCanvas.getBoundingClientRect();
  let mousePos = self._getMousePos(e);

  // draw the crosshair
  let cH = $('#crosshair-h');
  let cV = $('#crosshair-v');
  // cH.css('top', Math.min(canvRect.y + self.padBox.y + self.padBox.h, Math.max(
  //   e.clientY, canvRect.y + self.padBox.y)));
  // cH.css('left', canvRect.x + self.padBox.x);
  // cH.css('width', self.padBox.w);
  // cV.css('left', Math.min(canvRect.x + self.padBox.x + self.padBox.w, Math.max(
  //   e.clientX, canvRect.x + self.padBox.x)));
  // cV.css('top', canvRect.y + self.padBox.y);
  // cV.css('height', self.padBox.h);
  if (self._isWithinFrame(e)) {
    $('.hair').show();
  } else {
    $('.hair').hide();
  }

  // needed for on-hover animations
  [self.hoverLabel, self.hoverHandle] = self._getSelected(mousePos);
  // change the cursor appropriately
  if (self.state === 'resize') {
    self.imageCanvas.style.cursor = 'crosshair';
  } else if (self.state === 'move') {
    self.imageCanvas.style.cursor = 'move';
  } else if (self.hoverLabel && self.hoverHandle >= 0) {
    self.imageCanvas.style.cursor = self.hoverLabel.getCursorStyle(
      self.hoverHandle);
  } else {
    self.imageCanvas.style.cursor = 'crosshair';
  }

  if (self.state === 'resize') {
    self.selectedLabel.resize(mousePos, self.currHandle, canvRect, self.padBox);
  } else if (self.state === 'move') {
    self.selectedLabel.move(mousePos, self.movePos, self.moveClickPos,
      self.padBox);
  }
  self.redraw();
};

/**
 * Called when this SatImage is active and the mouse is released.
 * @param {object} _: mouse event (unused)
 */
SatImage.prototype._mouseup = function(_) { // eslint-disable-line
  let self = this;
  if (self.state !== 'free') {
    if (self.state === 'resize') {
      // if we resized, we need to reorder ourselves
      if (self.selectedLabel.w < 0) {
        self.selectedLabel.x = self.selectedLabel.x + self.selectedLabel.w;
        self.selectedLabel.w = -1 * self.selectedLabel.w;
      }
      if (self.selectedLabel.h < 0) {
        self.selectedLabel.y = self.selectedLabel.y + self.selectedLabel.h;
        self.selectedLabel.h = -1 * self.selectedLabel.h;
      }
      // remove the box if it's too small
      if (self.selectedLabel.isSmall()) {
        self.remove();
      }
    }
    self.state = 'free';
    self.resizeID = null;
    self.movePos = null;
    self.moveClickPos = null;
  }
  self.redraw();
};

/**
 * True if mouse is within the image frame (tighter bound than canvas).
 * @param {object} e: mouse event
 * @return {boolean}: whether the mouse is within the image frame
 */
SatImage.prototype._isWithinFrame = function(e) {
  let rect = this.imageCanvas.getBoundingClientRect();
  return (this.padBox && rect.x + this.padBox.x < e.clientX && e.clientX <
    rect.x + this.padBox.x + this.padBox.w && rect.y + this.padBox.y <
    e.clientY && e.clientY < rect.y + this.padBox.y + this.padBox.h);
};

/**
 * Get the mouse position on the canvas.
 * @param {object} e: mouse event
 * @return {object}: mouse position (x,y) on the canvas
 */
SatImage.prototype._getMousePos = function(e) {
  let rect = this.imageCanvas.getBoundingClientRect();
  return {x: e.clientX - rect.x, y: e.clientY - rect.y};
};

/**
 * Get the padding for the image given its size and canvas size.
 * @return {object}: padding box (x,y,w,h)
 */
SatImage.prototype._getPadding = function() {
  // which dim is bigger compared to canvas
  let xRatio = this.image.width / this.imageCanvas.width;
  let yRatio = this.image.height / this.imageCanvas.height;
  // use ratios to determine how to pad
  let box = {x: 0, y: 0, w: 0, h: 0};
  if (xRatio >= yRatio) {
    box.x = 0;
    box.y = 0.5 * (this.imageCanvas.height - this.imageCanvas.width *
      this.image.height / this.image.width);
    box.w = this.imageCanvas.width;
    box.h = this.imageCanvas.height - 2 * box.y;
  } else {
    box.x = 0.5 * (this.imageCanvas.width - this.imageCanvas.height *
      this.image.width / this.image.height);
    box.y = 0;
    box.w = this.imageCanvas.width - 2 * box.x;
    box.h = this.imageCanvas.height;
  }
  return box;
};

/**
 * Get the label with a given id.
 * @param {number} labelID: id of the sought label
 * @return {ImageLabel}: the sought label
 */
SatImage.prototype._getLabelByID = function(labelID) {
  for (let i = 0; i < this.labels.length; i++) {
    if (this.labels[i].id === labelID) {
      return this.labels[i];
    }
  }
};

/**
 * Get the box and handle under the mouse.
 * @param {object} mousePos: canvas mouse position (x,y)
 * @return {[ImageLabel, number]}: the box and handle (0-9) under the mouse
 */
SatImage.prototype._getSelected = function(mousePos) {
  let pixelData = this.hiddenCtx.getImageData(mousePos.x,
    mousePos.y, 1, 1).data;
  let selectedLabelID = null;
  let currHandle = null;
  if (pixelData[0] !== 0 && pixelData[3] === 255) {
    selectedLabelID = pixelData[0] - 1;
    currHandle = pixelData[1] - 1;
  }
  return [this._getLabelByID(selectedLabelID), currHandle];
};

/**
 * Called when the selected category is changed.
 */
SatImage.prototype._changeCat = function() {
  let self = this;
  if (self.selectedLabel) {
    let option = self.catSel.options[self.catSel.selectedIndex].innerHTML;
    self.selectedLabel.name = option;
    self.redraw();
  }
};

/**
 * Called when the occluded checkbox is toggled.
 */
SatImage.prototype._occlSwitch = function() {
  let self = this;
  if (self.selectedLabel) {
    self.selectedLabel.occl = $('[name=\'occluded-checkbox\']').prop('checked');
  }
};

/**
 * Called when the truncated checkbox is toggled.
 */
SatImage.prototype._truncSwitch = function() {
  let self = this;
  if (self.selectedLabel) {
    self.selectedLabel.trunc = $('[name=\'truncated-checkbox\']').prop(
      'checked');
  }
};

/**
 * Called when the traffic light color choice is changed.
 */
SatImage.prototype._lightSwitch = function() {
  // TODO: Wenqi
};


/**
 * Base class for all the labeled objects. New label should be instantiated by
 * Sat.newLabel()
 *
 * To define a new tool:
 *
 * function NewObject(id) {
 *   SatLabel.call(this, id);
 * }
 *
 * NewObject.prototype = Object.create(SatLabel.prototype);
 *
 * @param {Sat} sat: The labeling session
 * @param {number | null} id: label object identifier
 */
function SatLabel(sat, id = -1, optionalAttributes = null) {
  this.id = id;
  this.name = null; // category or something else
  this.attributes = [];
  this.sat = sat;
  this.parent = null;
  this.children = [];
  this.numChildren = 0;
  this.valid = true;
}

SatLabel.prototype.delete = function() {
  this.valid = false;
  if (this.parent !== null) {
    this.parent.numChildren -= 1;
    if (this.parent.numChildren === 0) this.parent.delete();
  }
  for (let i = 0; i < this.children; i++) {
    this.children[i].parent = null;
    this.children[i].delete();
  }
};

SatLabel.prototype.getRoot = function() {
  if (this.parent === null) return this;
  else return this.parent.getRoot();
};

/**
 * Get the current position of this label.
 */
SatLabel.prototype.getCurrentPosition = function() {
  return;
};

SatLabel.prototype.addChild = function(child) {
  this.numChildren += 1;
  this.children.push(child);
};

/**
 * Pick a color based on the label id
 * @return {(number|number|number)[]}
 */
SatLabel.prototype.color = function() {
  return pickColorPalette(this.getRoot().id);
};

/**
 * Convert the color to css style
 * @param {number} alpha: color transparency
 * @return {[number,number,number]}
 */
SatLabel.prototype.styleColor = function(alpha = 255) {
  let c = this.color();
  return sprintf('rgba(%d, %d, %d, %f)', c[0], c[1], c[2], alpha);
};

/**
 * Return json object encoding the label information
 * @return {{id: *}}
 */
SatLabel.prototype.toJson = function() {
  let object = {id: this.id, name: this.name, attributes: this.attributes};
  if (this.parent !== null) object['parent'] = this.parent.id;
  if (this.children.length > 0) {
    let childenIds = [];
    for (let i = 0; i < this.children.length; i++) {
      childenIds.push(this.children[i].id);
    }
    object['children'] = childenIds;
  }
  return object;
};

SatLabel.prototype.startChange = function() {
};

SatLabel.prototype.updateChange = function() {

};

SatLabel.prototype.finishChange = function() {

};

SatLabel.prototype.redraw = function() {

};

/**
 * Load label information from json object
 * @param {Object} object: object to parse
 */
SatLabel.prototype.fromJson = function(object) {
  this.id = object.id;
  this.name = object.name;
  this.attributes = object.attributes;
  let labelIdMap = this.sat.labelIdMap;
  if ('parent' in object) {
    this.parent = labelIdMap[object['parent']];
  }
  if ('children' in object) {
    let childrenIds = object['children'];
    for (let i = 0; i < childrenIds.length; i++) {
      this.addChild(labelIdMap[childrenIds[i]]);
    }
  }
};


/**
 * Base class for all the labeled objects. New label should be instantiated by
 * Sat.newLabel()
 *
 * To define a new tool:
 *
 * function NewObject(sat, id) {
 *   ImageLabel.call(this, sat, id);
 * }
 *
 * NewObject.prototype = Object.create(ImageLabel.prototype);
 *
 * @param {Sat} sat: The labeling session
 * @param {number | null} id: label object identifier
 */
function ImageLabel(sat, id, optionalAttributes = null) {
  SatLabel.call(this, sat, id, optionalAttributes);
}

ImageLabel.prototype = Object.create(SatLabel.prototype);
