/**
 * Created by dcantor on 20/10/15.
 */
var plx = plx || {};

plx.PI2 = Math.PI * 2;

plx.BRUSH  = undefined;
plx.ERASER = undefined;
plx.LABELS = undefined;

plx.CURRENT_OPERATION = undefined;
plx.OP_ANNOTATE       = 'plx-op-annotate';
plx.OP_DELETE         = 'plx-op-delete';
plx.OP_EROSION        = 'plx-op-erosion';
plx.OP_NONE           = 'plx-op-none';

/**
 * Helper function to transform hex colors into rgb colors
 * @param hex
 * @returns {{r: Number, g: Number, b: Number}}
 */
plx.hex2rgb = function (hex) {
    hex   = hex.replace('#', '');
    var r = parseInt(hex.substring(0, 2), 16);
    var g = parseInt(hex.substring(2, 4), 16);
    var b = parseInt(hex.substring(4, 6), 16);
    return {'r': r, 'g': g, 'b': b};
}

plx.rgb2hex = function (R, G, B) {

    function toHex(n) {
        n = parseInt(n, 10);
        if (isNaN(n)) {
            return "00";
        }
        n = Math.max(0, Math.min(n, 255));
        return "0123456789ABCDEF".charAt((n - n % 16) / 16)
            + "0123456789ABCDEF".charAt(n % 16);
    }

    return '#'+toHex(R) + toHex(G) + toHex(B);
};

plx.LabelSet = {}

plx.LabelSet.getLabelByIndex = function (label_index) {
    if (label_index > 0 && label_index <= plx.LABELS.length) {
        return plx.LABELS[label_index - 1];
    }
    else {
        return undefined;
    }
};

plx.LabelSet.getLabelByID = function (label_id) {
    var N = plx.LABELS.length;
    for (var i = 0; i < N; i += 1) {
        if (plx.LABELS[i].id == label_id) {
            return plx.LABELS[i];
        }
    }
    return undefined;
};

plx.Brush = function (size, opacity, type) {
    this.size     = size;
    this.opacity  = opacity;
    this.type     = type;
    this.comp     = 'lighten';
    this.color    = "rgba(0,0,0," + opacity + ')';
    this.r        = 0;
    this.g        = 0;
    this.b        = 0;
    this.label_id = undefined;

};

plx.Brush.prototype.getHexColor= function(){
    return plx.rgb2hex(this.r, this.g, this.b);
}

plx.Brush.prototype.setColor = function (hex) {
    var clr    = plx.hex2rgb(hex);
    this.r     = clr.r;
    this.g     = clr.g;
    this.b     = clr.b;
    this.color = 'rgba(' + this.r + ',' + this.g + ',' + this.b + ',' + this.opacity + ')';
};

plx.Brush.prototype.setOpacity = function (opacity) {
    this.opacity = opacity;
    this.color   = 'rgba(' + this.r + ',' + this.g + ',' + this.b + ',' + this.opacity + ')';
};

plx.Brush.prototype.setLabelID = function (label_id) {
    this.label_id = label_id;
    var label     = plx.LabelSet.getLabelByID(label_id);
    this.setColor(label.color);
    this.label_id = label.id;
};

plx.Brush.prototype.setLabelByIndex = function (label_index) {
    var label     = plx.LabelSet.getLabelByIndex(label_index);
    this.setColor(label.color);
    this.label_id = label.id;
}

plx.setGlobalBrush = function (brush) {
    plx.BRUSH = brush;
    return plx.BRUSH;
};

plx.Eraser = function (size) {
    this.size = size;
    this.type = 'square';
};

plx.setGlobalEraser = function (eraser) {
    plx.ERASER = eraser;
    return plx.ERASER;
};

plx.setGlobalLabels = function (labels) {
    plx.LABELS = labels;
    return plx.LABELS;
};

plx.setCurrentOperation = function (operation) {
    console.debug('set operation: ' + plx.CURRENT_OPERATION);
    plx.CURRENT_OPERATION = operation;
};



/**
 * Displays an image on a canvas
 */
plx.Slice = function (uri, dataset) {

    this.dataset = dataset;
    this.uri     = uri;
    this.image   = new Image();
    this.index   = undefined; //given by the dataset
};

/**
 * Loads he image to display and tries to display it
 * @param filename
 */
plx.Slice.prototype.load = function () {
    var slice              = this;
    var xhr                = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            var url         = window.URL || window.webkitURL;
            slice.image.src = url.createObjectURL(this.response);
            if (slice.dataset != undefined) {
                slice.dataset.onLoadSlice(slice);
            }
        }
    }

    xhr.open('GET', slice.uri + '?1=' + Math.random());
    xhr.responseType       = 'blob';
    xhr.send();
};

/**
 * Checks if this is the current slice
 * @returns {boolean}
 */
plx.Slice.prototype.isCurrent = function (view) {
    return view.currentSlice == this;
};

plx.Dataset = function (folder, start_item, end_item, step) {
    this.folder = folder;
    this.slices = []; //to do set operations
    this.slicemap = {}; //to quickly access a slice by index
    this.keys = []; //easy access to keys in the slicemap

    if (step == undefined || step <= 0) {
        step = 1;
    }

    for (var i = start_item; i <= end_item; i = i + step) {
        var filename = folder + '/' + folder.substr(folder.lastIndexOf('/') + 1) + '_' + i + '.png';
        var slice    = new plx.Slice(filename, this);

        slice.index      = i;
        this.slices.push(slice);
        this.slicemap[i] = slice;
        this.keys.push(i);

    }

    this.num_items  = this.slices.length;
    this.num_loaded = 0;

    console.debug('dataset: ' + folder + ', number items: ' + this.num_items)
};

plx.Dataset.prototype.load = function (progress_callback) {
    this.progress_callback = progress_callback;
    this.num_loaded        = 0;
    for (var i = 0; i < this.num_items; i++) {
        this.slices[i].load();
    }
};

plx.Dataset.prototype.onLoadSlice = function (slice) {
    this.num_loaded++;
    if (this.num_loaded == this.num_items) {
        console.debug('all items loaded');
    }
    this.progress_callback(this);
};

plx.Dataset.prototype.hasLoaded = function () {
    return (this.num_loaded == this.num_items);
}

/**
 * Represents the annotated slice. There can only be one at a time per slice.
 */
plx.AnnotationSlice = function (slice_id) {
    this.slice_id     = slice_id;
    this.offcanvas    = document.createElement("canvas");
    this.ctx          = this.offcanvas.getContext("2d");
    this.data         = undefined;
    this.lastX        = undefined;
    this.lastY        = undefined;
    this.undo_history = new Array();
    this.redo_history = new Array();
};

plx.AnnotationSlice.prototype.isEmpty = function () {
    if (this.data == undefined) {
        //we have never annotated here
        return true;
    }

    var imdata = this.data.data;

    var maxR = 0, maxG = 0, maxB = 0, N = imdata.length;

    for (var i = 0; i < N; i += 4) {
        if (imdata[i] > maxR) {maxR = imdata[i];}
        if (imdata[i + 1] > maxG) {maxG = imdata[i + 1];}
        if (imdata[i + 2] > maxB) {maxB = imdata[i + 2];}
    }

    return (maxR == maxG && maxG == maxB & maxR == 0); //nothing ?
};

plx.AnnotationSlice.prototype.saveStep = function () {
    this.undo_history.push(this.ctx.getImageData(0, 0, this.offcanvas.width, this.offcanvas.height));
    console.debug('step saved. ' + this.undo_history.length + ' steps to undo');
};

plx.AnnotationSlice.prototype.undo = function () {
    if (this.undo_history.length == 0) {
        console.warn(this.slice_id + ' nothing to undo here');
        return;
    }

    var currentStep = this.undo_history.pop();
    this.redo_history.push(currentStep);

    var previousStep = this.undo_history[this.undo_history.length - 1];

    this.data = previousStep;

    if (this.data == undefined) {
        this.ctx.clearRect(0, 0, this.offcanvas.width, this.offcanvas.height);
        this.data = this.ctx.getImageData(0, 0, this.offcanvas.width, this.offcanvas.height);
    }

    this.ctx.putImageData(this.data, 0, 0);
    console.debug('undo. ' + this.undo_history.length + ' steps to undo. ' + this.redo_history.length + ' steps to redo.');
};

plx.AnnotationSlice.prototype.redo = function () {
    if (this.redo_history.length == 0) {
        console.warn(this.slice_id + ' nothing to redo here');
        return;
    }

    this.data = this.redo_history.pop();
    this.undo_history.push(this.data);
    this.ctx.putImageData(this.data, 0, 0);
    console.debug('redo. ' + this.undo_history.length + ' steps to undo. ' + this.redo_history.length + ' steps to redo.');

};

plx.AnnotationSlice.prototype.startAnnotation = function (x, y, view) {

    var brush  = plx.BRUSH;
    var eraser = plx.ERASER;

    this.offcanvas.width  = view.canvas.width;
    this.offcanvas.height = view.canvas.height;

    this.ctx = this.offcanvas.getContext("2d");

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
        case plx.OP_EROSION:
            break;
    }

    this.lastX = x;
    this.lastY = y;

    if (this.data) {
        this.ctx.clearRect(0, 0, this.offcanvas.width, this.offcanvas.height);
        this.ctx.putImageData(this.data, 0, 0);
    }

    this.redo_history = [];
    console.debug('new operation. ' + plx.CURRENT_OPERATION + '. ' + this.undo_history.length + ' steps to undo. ' + this.redo_history.length + ' steps to redo.');

}

plx.AnnotationSlice.prototype.updateAnnotation = function (x, y, view) {

    var ctx    = this.ctx;
    var brush  = plx.BRUSH;
    var eraser = plx.ERASER;
    var mouseX = x, mouseY = y;
    var x1     = x, x2 = this.lastX, y1 = y, y2 = this.lastY;
    var steep  = (Math.abs(y2 - y1) > Math.abs(x2 - x1));
    var imdata = ctx.getImageData(0,0, this.offcanvas.width, this.offcanvas.height);
    var width = this.offcanvas.width;
    var height = this.offcanvas.height;

    function cneighbours(x,y,radio){
        var pos = [];
        for(var i=-radio; i<radio; i++){
            for(var j=-radio; j<radio; j++){
                pos.push(4* (y* width + x));
            }
        }
        return pos;
    };

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

    var bsize2 = brush.size * 2;
    var esize2 = eraser.size * 2;

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

    else if (plx.CURRENT_OPERATION == plx.OP_EROSION){



        for (var x = x1; x < x2; x += 1) {

            var vecindad = [];
            if (steep) {
                vecindad = cneighbours(x,y,5);
                //pos = (x * width + y) * 4;
            }
            else {
                //pos = (y * width + x) * 4;
                vecindad = cneighbours(y,x,5);

            }

            for (var i=0;i<vecindad.length;i++) {

                var pos = vecindad[i];

                var r = imdata.data[pos];
                var g = imdata.data[pos + 1];
                var b = imdata.data[pos + 2];

                if (r > 0 || g > 0 || b > 0) {
                    imdata.data[pos] = 255;
                }
            }

            error += de;
            if (error >= 0.5) {
                y += yStep;
                error -= 1.0;
            }
        }

        this.ctx.putImageData(imdata,0,0);

    }
    this.lastX = mouseX;
    this.lastY = mouseY;




    view.ctx.globalAlpha = 1;
    view.ctx.clearRect(0, 0, view.canvas.width, view.canvas.height);
    view.ctx.drawImage(view.currentSlice.image, 0, 0, view.canvas.width, view.canvas.height);

    view.ctx.globalAlpha = plx.BRUSH.opacity;
    view.ctx.drawImage(this.offcanvas, 0, 0, view.canvas.width, view.canvas.height);

};

plx.AnnotationSlice.prototype.stopAnnotation = function () {
    this.data = this.ctx.getImageData(0, 0, this.offcanvas.width, this.offcanvas.height);
    this.saveStep();
};

plx.AnnotationSlice.prototype.draw = function (view) {
    var view_ctx = view.ctx;
    var off_ctx  = this.ctx;

    //clear layer
    off_ctx.clearRect(0, 0, this.offcanvas.width, this.offcanvas.height);

    if (this.data) {
        //update layer
        off_ctx.putImageData(this.data, 0, 0);

        //now draw slice
        view.ctx.globalAlpha = 1;
        view.ctx.clearRect(0, 0, view.canvas.width, view.canvas.height);
        view.ctx.drawImage(view.currentSlice.image, 0, 0, view.canvas.width, view.canvas.height);

        //now copy annotation layer to slice
        view_ctx.globalAlpha = plx.BRUSH.opacity;
        view_ctx.drawImage(this.offcanvas, 0, 0, view.canvas.width, view.canvas.height);
    }
};


plx.PaintBucket = function (aslice) {
    //some info about the slice
    this.aslice = aslice;
    this.sizeX = aslice.offcanvas.width;
    this.sizeY = aslice.offcanvas.height;

    // create a local canvas and context
    this.buffer = document.createElement("canvas");
    this.buffer.width = this.sizeX;
    this.buffer.height = this.sizeY;
    this.ctx  =  this.buffer.getContext("2d");


    this.ctx.clearRect(0,0, this.sizeX, this.sizeY);

    if (aslice.data) {
        this.ctx.putImageData(aslice.data,0,0);
    }

};

plx.PaintBucket.prototype.updateAnnotationSlice = function(view){

    //clear layer
    var off_ctx = this.aslice.ctx;
    off_ctx.clearRect(0,0, this.aslice.offcanvas.width, this.aslice.offcanvas.height);

    //initalize with previous data
    if (this.aslice.data) {
        off_ctx.putImageData(this.aslice.data, 0, 0);
    }

    //add current buffer
    off_ctx.drawImage(this.buffer,0,0, this.sizeX, this.sizeY);

    //update data object

    this.aslice.data = off_ctx.getImageData(0,0, this.aslice.offcanvas.width, this.aslice.offcanvas.height);

    //saveStep
    this.aslice.saveStep();
    this.aslice.draw(view);
}

/**
 *
 * @see https://en.wikipedia.org/wiki/Flood_fill
 */
plx.PaintBucket.prototype.fill = function (x, y, target_color, replacement_color) {


    if (target_color == replacement_color) {
        return;
    }

    var imdata    = this.ctx.getImageData(0,0, this.sizeX, this.sizeY);
    var sizeX     = this.sizeX, sizeY = this.sizeY;

    //var ctx       = this.ctx;
    var rep       = plx.hex2rgb(replacement_color);
    var processed = [];
    var queue     = [{'x': x, 'y': y}];

    var maxProcessed = 5000;
    var countProcessed = 0;


    function ptos (pixel){
        return 'x:' + pixel.x + ',y:' + pixel.y;
    }

    function markAsProcessed(pixel) {
        var key = 'x:' + pixel.x + ',y:' + pixel.y;
        processed.push(key);
        //console.debug(key + ' PROCESSED');
        countProcessed++;
    }

    function isProcessed(pixel) {
        var key = 'x:' + pixel.x + ',y:' + pixel.y;
        return (processed.indexOf(key) >= 0);
    };

    function getPixelColor(pixel) {

        var pos = (pixel.y * sizeX) + pixel.x;
        var r = imdata.data[pos * 4];
        var g = imdata.data[pos * 4 +1];
        var b = imdata.data[pos * 4 +2];
        var color = plx.rgb2hex(r,g,b);
        return color;
    };

    function setPixelColor(pixel) {
        var pos = (pixel.y * sizeX) + pixel.x;
        imdata.data[pos*4] = rep.r;
        imdata.data[pos*4 +1] = rep.g;
        imdata.data[pos*4 +2] = rep.b;
        imdata.data[pos*4 +3] = 255;

    };

    setPixelColor({'x':50,'y':5});
    setPixelColor({'x':50,'y':6})
    setPixelColor({'x':50,'y':7})
    setPixelColor({'x':50,'y':8})



    function checkBoundaries(pixel) {

        if (pixel.x < 0 || pixel.x >= sizeX || pixel.y < 0 || pixel.y >= sizeY) {
            return false;
        }
        else {
            return true;
        }
    }

    while (queue.length > 0) {
        var pixel = queue.shift();
        if (getPixelColor(pixel) == target_color) {

            setPixelColor(pixel);
            markAsProcessed(pixel);

            if (countProcessed == maxProcessed){
                console.info('processed '+maxProcessed);
                console.info('stopping now');
                break;
            }


            var west  = {'x': pixel.x - 1, 'y': pixel.y};
            var east  = {'x': pixel.x + 1, 'y': pixel.y};
            var north = {'x': pixel.x, 'y': pixel.y - 1};
            var south = {'x': pixel.x, 'y': pixel.y + 1};

            if (checkBoundaries(west) && !isProcessed(west)) {
                queue.push(west);
            }

            if (checkBoundaries(east) && !isProcessed(east)) {
                queue.push(east);
            }

            if (checkBoundaries(north) && !isProcessed(north)) {
                queue.push(north);
            }

            if (checkBoundaries(south) && !isProcessed(south)) {
                queue.push(south);
            }
        }
    }

    this.ctx.putImageData(imdata,0,0);
};

plx.AnnotationSet = function (dataset_id, user_id, annotation_set_id, labelset_id) {

    this.annotations = {}; //dictionary containing the slice-uri, annotation slice object pairing.

};

plx.AnnotationSet.load = function (anset_url) {
    //loads an annotationset given the corresponding JSON file URL
    // the JSON file contains:
    //    the location of the dataset
    //    the user identifier
    //    the location of the annotated set
    //    the location of the label set
};

plx.AnnotationSet.prototype.save = function () {
    // Does two things:
    //  1. Saves a set of annotated images png to a writable location
    //  2. Writes the corresponding anset_url (so we can load this later on).
};

plx.AnnotationSet.prototype.getAnnotationSlice = function (slice_uri) {

    var aslice = undefined;

    if (!(slice_uri in this.annotations)) {
        aslice                      = new plx.AnnotationSlice(slice_uri);
        this.annotations[slice_uri] = aslice;
    }
    else {
        aslice = this.annotations[slice_uri];
    }
    return aslice;
};

plx.AnnotationSet.prototype.hasAnnotationSlice = function (slice_uri) {
    return (slice_uri in this.annotations);
}

plx.View = function (canvas_id) {

    var canvas = document.getElementById(canvas_id);

    canvas.style.width          = '100%';
    canvas.style.height         = '100%';
    canvas.style.cursor         = 'crosshair';
    canvas.width                = canvas.offsetWidth;
    canvas.height               = canvas.offsetHeight;
    this.canvas                 = canvas;
    this.ctx                    = canvas.getContext("2d");
    this.currentSlice           = undefined;
    this.currentAnnotationSlice = undefined;
    this.dataset                = undefined;
    this.aset                   = undefined;
    this.interactor             = new plx.ViewInteractor(this);
    this.fullscreen             = false;
};

plx.View.prototype.clear = function () {
    this.ctx.fillStyle = "#3e495f";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
};

plx.View.prototype.resizeTo = function (width, height) {
    this.canvas.width  = width;
    this.canvas.height = height;
};

plx.View.prototype.load = function (dataset, callback) {
    this.dataset = dataset;
    dataset.load(callback);
};

plx.View.prototype.showSliceByObject = function (slice) {

    this.currentSlice    = slice;
    this.getCurrentAnnotationSlice();

    this.resizeTo(slice.image.width, slice.image.height);
    this.ctx.globalAlpha = 1;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(slice.image, 0, 0, this.canvas.width, this.canvas.height);
};

/**
 * Index in the dictionary (there could be missing indices if the
 * dataset is loaded with step != 1).
 * @param slice
 */
plx.View.prototype.showSliceByIndex = function (slice_index) {
    var slice = this.dataset.slicemap[slice_index];
    if (slice == undefined) {
        console.error('slice does not exist');
        return;
    }
    this.showSliceByObject(slice);
};

plx.View.prototype.showMiddleSlice = function () {
    var keys  = this.dataset.keys;
    var index = Math.floor(keys.length / 2);
    var slice = this.dataset.slicemap[keys[index]];
    this.showSliceByObject(slice);
    return keys[index];
};

plx.View.prototype.showCurrentSlice = function () {
    this.showSliceByObject(this.currentSlice);
};

plx.View.prototype.showNextSlice = function () {
    var keys      = this.dataset.keys;
    var key       = this.currentSlice.index;
    var index_key = keys.indexOf(key);
    var index     = undefined;

    if (index_key < keys.length - 1) {
        index = keys[index_key + 1];
        this.showSliceByObject(this.dataset.slicemap[index]);

    }
    return index;
};

plx.View.prototype.showPreviousSlice = function () {
    var keys      = this.dataset.keys;
    var key       = this.currentSlice.index;
    var index_key = keys.indexOf(key);
    var index     = undefined;

    if (index_key > 0) {
        index = keys[index_key - 1];
        this.showSliceByObject(this.dataset.slicemap[index]);
    }

    return index;
};

plx.View.prototype.showCurrentAnnotationSlice = function () {
    this.currentAnnotationSlice.draw(this);
}

plx.View.prototype.getAnnotationSlice = function (slice_uri) {
    if (this.aset == undefined) { //@TODO: review hard code
        this.aset = new plx.AnnotationSet('spine_phantom_1', 'dcantor', '1', 'labels_spine');
    }

    var aset = this.aset;
    return aset.getAnnotationSlice(slice_uri);
};

plx.View.prototype.getCurrentAnnotationSlice = function () {
    if (this.aset == undefined) { //@TODO: review hard code
        this.aset = new plx.AnnotationSet('spine_phantom_1', 'dcantor', '1', 'labels_spine');
    }

    var aset                    = this.aset;
    this.currentAnnotationSlice = aset.getAnnotationSlice(this.currentSlice.uri);
    return this.currentAnnotationSlice;
};

plx.View.prototype.undo = function () {
    var aslice = this.currentAnnotationSlice;
    aslice.undo();
    this.showCurrentSlice();
    this.showCurrentAnnotationSlice();
};

plx.View.prototype.redo = function () {
    var aslice = this.currentAnnotationSlice;
    aslice.redo();
    this.showCurrentSlice();
    this.showCurrentAnnotationSlice();
};

//plx.View.prototype.toggleFullscreen = function () {
//
//    var canvas  = this.canvas;
//    var memento = undefined;
//
//    var ratio  = window.devicePixelRatio || 1;
//    var width  = window.innerWidth * ratio;
//    var height = window.innerHeight * ratio;
//
//    if (!this.fullscreen) {
//
//        //canvas.mozRequestFullScreen();
//        //go fullscreen
//        memento                   = {};
//        memento['width']          = canvas.width;
//        memento['height']         = canvas.height;
//        memento['style-position'] = canvas.style.position;
//        memento['style-left']     = canvas.style.left;
//        memento['style-top']      = canvas.style.top;
//        memento['style-z-index']  = canvas.style.zIndex;
//
//        canvas.width          = width;
//        canvas.height         = height;
//        canvas.style.position = 'fixed';
//        canvas.style.left     = 0;
//        canvas.style.top      = 0;
//        canvas.style.zIndex   = 1000;
//        this.fullscreen       = true;
//        this.memento          = memento;
//        this.fullscreen       = true;
//
//    }
//    else {        //go back from fullscreen
//        memento = this.memento;
//        if (memento != undefined) {
//            canvas.width          = memento['width'];
//            canvas.height         = memento['height'];
//            canvas.style.position = memento['style-position'];
//            canvas.style.left     = memento['style-left'];
//            canvas.style.top      = memento['style-top'];
//            canvas.style.zIndex   = memento['style-z-index'];
//
//        }
//        this.fullscreen = false;
//        // document.mozCancelFullScreen();
//        this.fullscreen = false;
//    }
//
//    this.showCurrentSlice();
//    this.showCurrentAnnotationSlice();
//};
plx.ViewInteractor = function (view) {
    this.dragging = false;
    this.view     = view;
    this.aslice   = undefined; //annotation slice
};

plx.ViewInteractor.prototype.connectView = function () {
    var view       = this.view;
    var canvas     = this.view.canvas;
    var interactor = this;

    canvas.onmousedown  = function (ev) { interactor.onMouseDown(ev); };
    canvas.onmouseup    = function (ev) { interactor.onMouseUp(ev); };
    canvas.onmousemove  = function (ev) { interactor.onMouseMove(ev); };
    canvas.onmouseleave = function (ev) { interactor.onMouseLeave(ev); };
    canvas.onwheel      = function (ev) { interactor.onWheel(ev);};

    canvas.addEventListener('dblclick', function (ev) { interactor.onDoubleClick(ev); });
    canvas.addEventListener('touchstart', function (ev) { interactor.onTouchStart(ev); }, false);
    canvas.addEventListener('touchmove', function (ev) { interactor.onTouchMove(ev); }, false);
    canvas.addEventListener('touchend', function (ev) { interactor.onTouchEnd(ev); }, false);

    if (Hammer) {
        this._setHammerGestures;
    }
};

plx.ViewInteractor.prototype.onMouseDown = function (ev) {

    if (plx.CURRENT_OPERATION == plx.OP_ANNOTATE ||
        plx.CURRENT_OPERATION == plx.OP_DELETE ||
        plx.CURRENT_OPERATION == plx.OP_EROSION) {
        this.dragging = true;

        var view   = this.view,
            canvas = view.canvas,
            rect   = canvas.getBoundingClientRect(),
            x      = Math.round((ev.clientX - rect.left) / (rect.right - rect.left) * canvas.width),
            y      = Math.round((ev.clientY - rect.top) / (rect.bottom - rect.top) * canvas.height);

        this.aslice = view.currentAnnotationSlice;
        this.aslice.startAnnotation(x, y, view);
    }
};

plx.ViewInteractor.prototype.onMouseMove = function (ev) {

    if (plx.CURRENT_OPERATION == plx.OP_ANNOTATE ||
        plx.CURRENT_OPERATION == plx.OP_DELETE ||
        plx.CURRENT_OPERATION == plx.OP_EROSION) {

        if (this.dragging) {

            var view   = this.view,
                canvas = view.canvas,
                rect   = canvas.getBoundingClientRect(),
                x      = Math.round((ev.clientX - rect.left) / (rect.right - rect.left) * canvas.width),
                y      = Math.round((ev.clientY - rect.top) / (rect.bottom - rect.top) * canvas.height);

            this.aslice.updateAnnotation(x, y, view);
        }
    }
};

plx.ViewInteractor.prototype.onMouseUp = function (ev) {
    if (plx.CURRENT_OPERATION == plx.OP_ANNOTATE ||
        plx.CURRENT_OPERATION == plx.OP_DELETE ||
        plx.CURRENT_OPERATION == plx.OP_EROSION) {

        if (this.dragging) {
            this.dragging = false;
            this.aslice.stopAnnotation();
            this.aslice.draw(this.view);
        }
    }
};

plx.ViewInteractor.prototype.onMouseLeave  = function (ev) {
    if (plx.CURRENT_OPERATION == plx.OP_ANNOTATE ||
        plx.CURRENT_OPERATION == plx.OP_DELETE ||
        plx.CURRENT_OPERATION == plx.OP_EROSION) {

        if (this.dragging) {
            this.dragging = false;
        }
    }
};
/**
 * Toggles the view to/from fullscreen
 * @param ev
 */
plx.ViewInteractor.prototype.onDoubleClick = function (ev) {

    var aslice = this.view.getCurrentAnnotationSlice();
    plx.bucket = new plx.PaintBucket(aslice);

    var view   = this.view,
        canvas = view.canvas,
        rect   = canvas.getBoundingClientRect(),
        x      = Math.round((ev.clientX - rect.left) / (rect.right - rect.left) * canvas.width),
        y      = Math.round((ev.clientY - rect.top) / (rect.bottom - rect.top) * canvas.height);

    console.debug('canvas coordinates: ' + x+', '+y)
    console.debug('brush color       : ' + plx.BRUSH.getHexColor());

    plx.bucket.fill(x,y, '#000000', plx.BRUSH.getHexColor());

    plx.bucket.updateAnnotationSlice(this.view);
};

plx.ViewInteractor.prototype.onWheel = function (ev) {
    if (ev.deltaY > 0) {
        this.view.showPreviousSlice();
    }
    else if (ev.deltaY < 0) {
        this.view.showNextSlice();
    }
    this.view.showCurrentAnnotationSlice();
};

/*-----------------------------------------------------------------------------------------------
 Touch Events
 ------------------------------------------------------------------------------------------------*/
plx.ViewInteractor.prototype.onTouchStart = function (ev) {
    ev.stopPropagation();

    if (plx.CURRENT_OPERATION == plx.OP_ANNOTATE ||
        plx.CURRENT_OPERATION == plx.OP_DELETE) {

        if (ev.targetTouches.length != 1) {
            return;
        }

        ev.preventDefault();

        var view   = this.view,
            canvas = view.canvas,
            rect   = canvas.getBoundingClientRect(),
            touch  = ev.targetTouches[0],
            x      = Math.round((touch.clientX - rect.left) / (rect.right - rect.left) * canvas.width),
            y      = Math.round((touch.clientY - rect.top) / (rect.bottom - rect.top) * canvas.height);

        this.aslice = view.getCurrentAnnotationSlice();
        this.aslice.startAnnotation(x, y, view);
    }

};

plx.ViewInteractor.prototype.onTouchMove = function (ev) {
    if (plx.CURRENT_OPERATION == plx.OP_ANNOTATE ||
        plx.CURRENT_OPERATION == plx.OP_DELETE) {

        if (ev.targetTouches.length != 1) {
            return;
        }

        var view   = this.view,
            canvas = view.canvas,
            rect   = canvas.getBoundingClientRect(),
            touch  = ev.targetTouches[0],
            x      = Math.round((touch.clientX - rect.left) / (rect.right - rect.left) * canvas.width),
            y      = Math.round((touch.clientY - rect.top) / (rect.bottom - rect.top) * canvas.height);

        this.aslice.updateAnnotation(x, y, view);
    }
};

plx.ViewInteractor.prototype.onTouchEnd = function (ev) {
    if (plx.CURRENT_OPERATION == plx.OP_ANNOTATE ||
        plx.CURRENT_OPERATION == plx.OP_DELETE) {

        this.aslice.stopAnnotation();
        this.aslice.draw(view);
    }
};

plx.ViewInteractor.prototype._setHammerGestures = function () {
    this.mc = new Hammer.Manager(canvas);
    this.mc.add(new Hammer.Press({event: 'press', pointers: 1}));
    this.mc.add(new Hammer.Swipe({event: 'swipe', pointers: 1}));

    this.mc.on('press', function (ev) {
        alert('OK');
        plx.setCurrentOperation(plx.OP_NONE);
    });

    this.mc.on('swiperight', function (ev) {
        if (plx.CURRENT_OPERATION == plx.OP_NONE) {
            view.showNextSlice();
        }
    });

    this.mc.on('swipeleft', function (ev) {
        if (plx.CURRENT_OPERATION == plx.OP_NONE) {
            view.showPreviousSlice();
        }
    });
};

