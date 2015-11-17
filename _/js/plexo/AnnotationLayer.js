/*-----------------------------------------------------------------------------------------------
 Annotation Layer
 ------------------------------------------------------------------------------------------------*/
/**
 * Represents the annotated slice. There can only be one at a time per slice.
 */
plx.AnnotationLayer = function (slice) {

    this.slice        = slice;
    this.index        = slice.index;
    this.canvas       = document.createElement('canvas');
    this.ctx          = this.canvas.getContext('2d');
    this.imageData    = undefined;
    this.lastX        = undefined;
    this.lastY        = undefined;
    this.undo_history = [];
    this.redo_history = [];
    this.view         = undefined;
};

//Constants
plx.AnnotationLayer.LABEL_DISTANCE_TOLERANCE = 20;

/**
 * Sets the reference of the view where this annotation layer will be displayed
 * @param view
 */
plx.AnnotationLayer.prototype.setView = function (view) {
    this.view = view;
};

/**
 * Checks if this annotation layer is empty
 * @returns true or false
 */
plx.AnnotationLayer.prototype.isEmpty = function () {
    if (this.imageData == undefined) {
        //we have never annotated here
        return true;
    }
    var data = this.imageData.data;
    var maxR = 0, maxG = 0, maxB = 0, N = data.length;
    for (var i = 0; i < N; i += 4) {
        if (data[i] > maxR) {maxR = data[i];}
        if (data[i + 1] > maxG) {maxG = data[i + 1];}
        if (data[i + 2] > maxB) {maxB = data[i + 2];}
    }
    return (maxR == maxG && maxG == maxB & maxR == 0); //nothing ?
};

/**
 * Clears this annotation layer. The Undo/Redo history is cleared too.
 */
plx.AnnotationLayer.prototype.clearAnnotations = function () {
    if (this.imageData == undefined) {
        return;
    } //nothing here to clear

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.imageData    = undefined;
    this.undo_history = [];
    this.redo_history = [];
};

/**
 * Creates a new undo step with the current content of the annotation context
 */
plx.AnnotationLayer.prototype.saveUndoStep = function () {
    this.undo_history.push(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height));
};

/**
 * Sets the contents of the annotation layer to one step before in history
 * @returns {boolean}
 */
plx.AnnotationLayer.prototype.undo = function () {
    if (this.undo_history.length == 0) {
        console.warn(this.slice_id + ' nothing to undo here');
        return false;
    }
    var currentStep = this.undo_history.pop();
    this.redo_history.push(currentStep);

    var previousStep = this.undo_history[this.undo_history.length - 1];
    this.imageData   = previousStep;
    if (this.imageData == undefined) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    }
    this.ctx.putImageData(this.imageData, 0, 0);
    return true;
};

/**
 * Sets the contents of the annotation layer to one step further in history
 * @returns {boolean}
 */
plx.AnnotationLayer.prototype.redo = function () {

    if (this.redo_history.length == 0) {
        console.warn(this.slice_id + ' nothing to redo here');
        return false;
    }

    this.imageData = this.redo_history.pop();
    this.undo_history.push(this.imageData);
    this.ctx.putImageData(this.imageData, 0, 0);
    return true;
};

/**
 * Starts annotating
 * @param x coordinate x
 * @param y coordinate y
 * @param view corresponding view
 */
plx.AnnotationLayer.prototype.startAnnotation = function (x, y) {

    if (this.view === undefined) {
        throw 'Annotation cannot start, the view has not been set';
    }
    var view   = this.view;
    var brush  = plx.BRUSH;
    var eraser = plx.ERASER;

    /*---------------------------------------------*/
    // Propagate coordinates from background layer (image)
    /*---------------------------------------------*/
    this.canvas.width  = view.canvas.width;
    this.canvas.height = view.canvas.height;

    /*---------------------------------------------*/

    switch (plx.CURRENT_OPERATION) {
        case plx.OP_ANNOTATE:
            this.ctx.strokeStyle = plx.BRUSH.color;
            this.ctx.fillStyle   = plx.BRUSH.color;
            this.ctx.lineJoin    = brush.type;
            this.ctx.lineCap     = brush.type;
            this.ctx.lineWidth   = brush.size;

            break;

        case plx.OP_DELETE:
            this.ctx.strokeStyle = 'rgba(0,0,0,1)';
            this.ctx.fillStyle   = 'rgba(0,0,0,1)';
            this.ctx.lineJoin    = eraser.type;
            this.ctx.lineCap     = eraser.type;
            this.ctx.lineWidth   = eraser.size;
            break;
    }

    this.lastX = x;
    this.lastY = y;

    plx.smoothingEnabled(this.ctx, false);

    if (this.imageData) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.putImageData(this.imageData, 0, 0); //adds the current annotations to the annotation context
    }

    this.redo_history = [];
};

plx.AnnotationLayer.prototype.updateAnnotation = function (curr_x, curr_y) {

    var ctx    = this.ctx;
    var view   = this.view;
    var brush  = plx.BRUSH;
    var eraser = plx.ERASER;
    var mouseX = curr_x;
    var mouseY = curr_y;
    var x1     = curr_x;
    var y1     = curr_y;
    var x2     = this.lastX;
    var y2     = this.lastY;
    var steep  = (Math.abs(y2 - y1) > Math.abs(x2 - x1));
    var bsize2 = brush.size * 2;
    var esize2 = eraser.size * 2;

    if (steep) {
        var x = x1;
        x1    = y1;
        y1    = x;
        var y = y2;
        y2    = x2;
        x2    = y;
    }
    if (x1 > x2) {
        var x = x1;
        x1    = x2;
        x2    = x;
        var y = y1;
        y1    = y2;
        y2    = y;
    }
    var dx    = x2 - x1,
        dy    = Math.abs(y2 - y1),
        error = 0,
        de    = dy / dx,
        yStep = -1,
        y     = y1;
    if (y1 < y2) {
        yStep = 1;
    }

    if (plx.CURRENT_OPERATION == plx.OP_ANNOTATE) {
        for (var x = x1; x < x2; x += 1) {
            if (brush.type == 'square') {
                if (steep) {
                    ctx.fillRect(y - brush.size, x - brush.size, bsize2, bsize2);
                }
                else {
                    ctx.fillRect(x - brush.size, y - brush.size, bsize2, bsize2);
                }
            }
            else {
                if (steep) {
                    ctx.beginPath();
                    ctx.arc(y, x, brush.size, 0, plx.PI2);
                    ctx.fill();
                }
                else {
                    ctx.beginPath();
                    ctx.arc(x, y, brush.size, 0, plx.PI2);
                    ctx.fill();
                }
            }
            error += de;
            if (error >= 0.5) {
                y += yStep;
                error -= 1.0;
            }
        }
    }
    else if (plx.CURRENT_OPERATION == plx.OP_DELETE) {
        for (var x = x1; x < x2; x += 1) {
            if (steep) {
                ctx.clearRect(y - eraser.size, x - eraser.size, esize2, esize2);
            }
            else {
                ctx.clearRect(x - eraser.size, y - eraser.size, esize2, esize2);
            }
            error += de;
            if (error >= 0.5) {
                y += yStep;
                error -= 1.0;
            }
        }
    }

    this.lastX = mouseX;
    this.lastY = mouseY;

    var width  = this.canvas.width;
    var height = this.canvas.height;

    view.ctx.globalAlpha = 1;
    view.ctx.clearRect(0, 0, width, height);
    view.ctx.drawImage(view.current_slice.image, 0, 0, width, height);

    view.ctx.globalAlpha = plx.BRUSH.opacity;
    view.ctx.drawImage(this.canvas, 0, 0, width, height);
};

plx.AnnotationLayer.prototype.saveAnnotation = function () {

    this.processPixels();
    this.saveUndoStep();
    this.view.render();
};

plx.AnnotationLayer.prototype.updateLayer = function (view) {

    if (view !== this.view) {
        throw 'Assertion error: the annotation layer is not assigned to the current view being rendered';
    }

    var view_ctx = view.ctx;
    var off_ctx  = this.ctx;

    off_ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.imageData) {

        plx.smoothingEnabled(off_ctx, false);
        off_ctx.putImageData(this.imageData, 0, 0);

        view_ctx.globalAlpha = plx.BRUSH.opacity;
        plx.smoothingEnabled(view_ctx, false);
        view_ctx.drawImage(this.canvas, 0, 0, view.canvas.width, view.canvas.height);

    }
};

plx.AnnotationLayer.prototype._getPixelPopulation = function () {

    //assertion: this.imageData has been set
    if (this.imageData == undefined) {
        return {};
    }

    var data = this.imageData.data;

    var dict = {};

    for (var i = 0, N = data.length; i < N; i += 4) {

        var r = data[i], g = data[i + 1], b = data[i + 2];

        if (r == g && g == b & b == 0) {
            continue;
        }
        var hex = plx.rgb2hex(r, g, b);
        if (dict[hex] == undefined) {
            dict[hex] = 1;
        }
        else {
            dict[hex]++;
        }
    }

    return dict;
};

plx.AnnotationLayer.prototype.getUsedLabels = function () {

    var dict   = this._getPixelPopulation();
    var colors = Object.keys(dict);

    if (colors.length == 0) {
        return [];
    }

    var labels       = plx.LABELS.labels;
    var MAX_DISTANCE = plx.AnnotationLayer.LABEL_DISTANCE_TOLERANCE;
    var used         = [];

    function distanceToLabel(label) {

        var minDistance = 255 * 3; //maximum possible distance

        for (var i = 0, N = colors.length; i < N; i++) {
            var color    = plx.hex2rgb(colors[i]);
            var distance = Math.abs(color.r - label.r) + Math.abs(color.g - label.g) + Math.abs(color.b - label.b);
            if (distance < minDistance) {
                minDistance = distance;
            }
        }
        //console.log('minimum distance to label ' + label.id + ' (' + label.color + ') :' + minDistance);
        return minDistance;
    }

    for (var i = 0, N = labels.length; i < N; i++) {
        var label = labels[i];
        if (distanceToLabel(label) <= MAX_DISTANCE) {
            used.push(label);
        }
    }
    return used;
};

/**
 * Removes the smoothing due to the bilinear interpolation
 * caused by ctx.fillRect ctx.arc and ctx.fill (problem inherent to html canvas)
 *
 * This method UPDATES the current ImageData object of the annotation layer.
 *
 */
plx.AnnotationLayer.prototype.processPixels = function () {

    this.imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

    var labels = this.getUsedLabels();
    var data   = this.imageData.data;

    var dict = {};

    for (var i = 0, N = data.length; i < N; i += 4) {

        var r = data[i], g = data[i + 1], b = data[i + 2];

        if (r == g && g == b & b == 0) {
            continue;
        }

        data[i + 3] = 255; //no alpha

        //assign pixel to closest label

        var lastDistance = 255 * 3;
        var index        = 0;
        for (var j = 0, M = labels.length; j < M; j++) {
            var label    = labels[j];
            var distance = Math.abs(label.r - r) + Math.abs(label.g - g) + Math.abs(label.b - b);

            if (distance < lastDistance) {
                index        = j;
                lastDistance = distance;
            }
        }

        var selected = labels[index];

        data[i]     = selected.r;
        data[i + 1] = selected.g;
        data[i + 2] = selected.b;

    }

    //console.log('used labels: ', labels);

    plx.smoothingEnabled(this.ctx, false);
    this.ctx.putImageData(this.imageData, 0, 0); //updates the data in the canvas.
};