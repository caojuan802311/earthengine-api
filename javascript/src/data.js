/**
 * @fileoverview Singleton for all of the library's communcation
 * with the Earth Engine API.
 */

goog.provide('ee.data');

goog.require('goog.Uri');
goog.require('goog.json');
goog.require('goog.net.XhrIo');
goog.require('goog.net.XmlHttp');


/** Required for exportSymbol() to work without lint warnings. */
ee.data = {};


/**
 * @type {string?} The base URL for all API calls.
 * @private
 */
ee.data.apiBaseUrl_ = null;


/**
 * @type {string?} The base URL for map tiles.
 * @private
 */
ee.data.tileBaseUrl_ = null;


/**
 * @type {boolean} Whether the library has been initialized.
 * @private
 */
ee.data.initialized_ = false;


/**
 * @type {number} The number of milliseconds to wait for each request before
 *     considering it timed out. 0 means no limit. Note that this is not
 *     supported by browsers for synchronous requests.
 * @private
 */
ee.data.deadlineMs_ = 0;


/**
 * @type {string} The default base URL for API calls.
 * @private
 * @const
 */
ee.data.DEFAULT_API_BASE_URL_ = '/api';


/**
 * @type {string} The default base URL for media/tile calls.
 * @private
 * @const
 */
ee.data.DEFAULT_TILE_BASE_URL_ = 'https://earthengine.googleapis.com';


/**
 * Initializes the data module, setting base URLs.
 *
 * @param {string=} opt_apiBaseUrl The (proxied) EarthEngine REST API endpoint.
 * @param {string=} opt_tileBaseUrl The (unproxied) EarthEngine REST tile
 *     endpoint.
 * @hidden
 */
ee.data.initialize = function(opt_apiBaseUrl, opt_tileBaseUrl) {
  // If already initialized, only replace the explicitly specified parts.

  if (goog.isDefAndNotNull(opt_apiBaseUrl)) {
    ee.data.apiBaseUrl_ = opt_apiBaseUrl;
  } else if (!ee.data.initialized_) {
    ee.data.apiBaseUrl_ = ee.data.DEFAULT_API_BASE_URL_;
  }
  if (goog.isDefAndNotNull(opt_tileBaseUrl)) {
    ee.data.tileBaseUrl_ = opt_tileBaseUrl;
  } else if (!ee.data.initialized_) {
    ee.data.tileBaseUrl_ = ee.data.DEFAULT_TILE_BASE_URL_;
  }
  ee.data.initialized_ = true;
};


/**
 * Resets the data module, clearing custom base URLs.
 * @hidden
 */
ee.data.reset = function() {
  ee.data.apiBaseUrl_ = null;
  ee.data.tileBaseUrl_ = null;
  ee.data.initialized_ = false;
};


/**
 * Sets the timeout length for asynchronous API requests.
 *
 * @param {number} milliseconds The number of milliseconds to wait for a
 *     request before considering it timed out. 0 means no limit.
 * @hidden
 */
ee.data.setDeadline = function(milliseconds) {
  ee.data.deadlineMs_ = milliseconds;
};


/**
 * Load info for an asset, given an asset id.
 *
 * @param {string} id The asset to be retrieved.
 * @param {function(Object, string=)=} opt_callback An optional callback.
 *     If not supplied, the call is made synchronously.
 * @return {Object} The value call results.
 */
ee.data.getInfo = function(id, opt_callback) {
  return ee.data.send_('/info',
                       new goog.Uri.QueryData().add('id', id),
                       opt_callback);
};


/**
 * Get a list of contents for a collection asset.
 * @param {Object} params An object containing request parameters with
 *     the following possible values:
 *       - id (string) The asset id of the collection to list.
 *       - starttime (number) Start time, in msec since the epoch.
 *       - endtime (number) End time, in msec since the epoch.
 *       - fields (comma-separated strings) Field names to return.
 * @param {function(Object, string=)=} opt_callback An optional callback.
 *     If not supplied, the call is made synchronously.
 * @return {Object} The list call results.
 */
ee.data.getList = function(params, opt_callback) {
  var request = ee.data.makeRequest_(params);
  return ee.data.send_('/list', request, opt_callback);
};


/**
 * @typedef {{
 *     mapid: string,
 *     token: string,
 *     image: ee.Image
 * }}
 */
ee.data.mapid;


/**
 * Get a Map ID for a given asset
 * @param {Object} params An object containing visualization
 *     options with the following possible values:
 *       - image (JSON string) The image to render.
 *       - version (number) Version number of image (or latest).
 *       - bands (comma-seprated strings) Comma-delimited list of
 *             band names to be mapped to RGB.
 *       - min (comma-separated numbers) Value (or one per band)
 *             to map onto 00.
 *       - max (comma-separated numbers) Value (or one per band)
 *             to map onto FF.
 *       - gain (comma-separated numbers) Gain (or one per band)
 *             to map onto 00-FF.
 *       - bias (comma-separated numbers) Offset (or one per band)
 *             to map onto 00-FF.
 *       - gamma (comma-separated numbers) Gamma correction
 *             factor (or one per band)
 *       - palette (comma-separated strings) List of CSS-style color
 *             strings (single-band previews only).
 *       - format (string) Either "jpg" or "png".
 * @param {function(Object, string=)=} opt_callback An optional callback.
 *     If not supplied, the call is made synchronously.
 * @return {ee.data.mapid} The mapId call results.
 */
ee.data.getMapId = function(params, opt_callback) {
  params['json_format'] = 'v2';
  return /** @type {ee.data.mapid} */ (
      ee.data.send_('/mapid', ee.data.makeRequest_(params), opt_callback));
};


/**
 * Generate a URL for map tiles from a Map ID and coordinates.
 * @param {ee.data.mapid} mapid The mapid to generate tiles for.
 * @param {number} x The tile x coordinate.
 * @param {number} y The tile y coordinate.
 * @param {number} z The tile zoom level.
 * @return {string} The tile URL.
 */
ee.data.getTileUrl = function(mapid, x, y, z) {
  var width = Math.pow(2, z);
  x = x % width;
  if (x < 0) {
    x += width;
  }
  return [ee.data.tileBaseUrl_, 'map', mapid['mapid'], z, x, y].join('/') +
      '?token=' + mapid['token'];
};


/**
 * Retrieve a processed value from the front end.
 * @param {Object} params The value to be evaluated, with the following
 *     possible values:
 *      - json (String) A JSON object to be evaluated.
 * @param {function(Object, string=)=} opt_callback An optional callback.
 *     If not supplied, the call is made synchronously.
 * @return {Object} The value call results.
 */
ee.data.getValue = function(params, opt_callback) {
  params['json_format'] = 'v2';
  return ee.data.send_('/value', ee.data.makeRequest_(params), opt_callback);
};


/**
 * Get a Thumbnail Id for a given asset.
 * @param {Object} params Parameters identical to those for the vizOptions for
 *     getMapId with the following additions:
 *       - size (a number or pair of numbers in format WIDTHxHEIGHT) Maximum
 *             dimensions of the thumbnail to render, in pixels. If only one
 *             number is passed, it is used as the maximum, and the other
 *             dimension is computed by proportional scaling.
 *       - region (E,S,W,N or GeoJSON) Geospatial region of the image
 *             to render. By default, the whole image.
 *       - format (string) Either 'png' (default) or 'jpg'.
 * @param {function(Object, string=)=} opt_callback An optional callback.
 *     If not supplied, the call is made synchronously.
 * @return {Object} The thumb call results, usually an image.
 */
ee.data.getThumbId = function(params, opt_callback) {
  params['json_format'] = 'v2';
  if (goog.isArray(params['size'])) {
    params['size'] = params['size'].join('x');
  }
  var request = ee.data.makeRequest_(params).add('getid', '1');
  return ee.data.send_('/thumb', request, opt_callback);
};


/**
 * Create a thumbnail URL from a thumbid and token.
 * @param {{thumbid: string, token: string}} id A thumbnail ID and token.
 * @return {string} The thumbnail URL.
 */
ee.data.makeThumbUrl = function(id) {
  return ee.data.tileBaseUrl_ + '/api/thumb?thumbid=' + id['thumbid'] +
      '&token=' + id['token'];
};


/**
 * Get a Download ID.
 * @param {Object} params An object containing download options with the
 *     following possible values:
 *   - id: The ID of the image to download.
 *   - name: a base name to use when constructing filenames.
 *   - bands: a description of the bands to download. Must be an array of
 *         dictionaries, each with the following keys:
 *     + id: the name of the band, a string, required.
 *     + crs: an optional CRS string defining the band projection.
 *     + crs_transform: an optional array of 6 numbers specifying an affine
 *           transform from the specified CRS, in the order: xScale, yShearing,
 *           xShearing, yScale, xTranslation and yTranslation.
 *     + dimensions: an optional array of two integers defining the width and
 *           height to which the band is cropped.
 *     + scale: an optional number, specifying the scale in meters of the band;
 *              ignored if crs and crs_transform is specified.
 *   - crs: a default CRS string to use for any bands that do not explicitly
 *         specify one.
 *   - crs_transform: a default affine transform to use for any bands that do
 *         not specify one, of the same format as the crs_transform of bands.
 *   - dimensions: default image cropping dimensions to use for any bands that
 *         do not specify them.
 *   - scale: a default scale to use for any bands that do not specify one;
 *         ignored if crs and crs_transform is specified.
 *   - region: a polygon specifying a region to download; ignored if crs
 *         and crs_transform is specified.
 * @param {function(Object, string=)=} opt_callback An optional callback.
 *     If not supplied, the call is made synchronously.
 * @return {{docid: string, token: string}} A download ID and token.
 */
ee.data.getDownloadId = function(params, opt_callback) {
  params['json_format'] = 'v2';
  return /** @type {{docid: string, token: string}} */ (ee.data.send_(
      '/download',
      ee.data.makeRequest_(params),
      opt_callback));
};


/**
 * Create a download URL from a docid and token.
 * @param {{docid: string, token: string}} id A download ID and token.
 * @return {string} The download URL.
 */
ee.data.makeDownloadUrl = function(id) {
  return ee.data.tileBaseUrl_ + '/api/download?docid=' + id['docid'] +
      '&token=' + id['token'];
};


/**
 * Get the list of algorithms.
 *
 * @param {function(Object, string=)=} opt_callback An optional callback.
 *     If not supplied, the call is made synchronously.
 * @return {Object} The list of algorithm signatures.
 * @hidden
 */
ee.data.getAlgorithms = function(opt_callback) {
  return ee.data.send_('/algorithms',
                       null,
                       opt_callback,
                       'GET');
};


/**
 * Save an asset.
 *
 * @param {string} value The JSON-serialized value of the asset.
 * @param {string=} opt_path An optional desired ID, including full path.
 * @param {function(Object, string=)=} opt_callback An optional callback.
 *     If not supplied, the call is made synchronously.
 * @return {Object}  A description of the saved asset, including a generated ID.
 * @hidden
 */
ee.data.createAsset = function(value, opt_path, opt_callback) {
  var args = {'value': value, 'json_format': 'v2'};
  if (opt_path !== undefined) {
    args['id'] = opt_path;
  }
  return ee.data.send_('/create',
                       ee.data.makeRequest_(args),
                       opt_callback);
};


/**
 * Generate an ID for a long-running task.
 *
 * @param {number=} opt_count Number of IDs to generate, one by default.
 * @param {function(Object, string=)=} opt_callback An optional callback.
 *     If not supplied, the call is made synchronously.
 * @return {Array} An array containing generated ID strings.
 * @hidden
 */
ee.data.newTaskId = function(opt_count, opt_callback) {
  var params = {};
  if (goog.isNumber(opt_count)) {
    params['count'] = opt_count;
  }
  return ee.data.send_('/newtaskid',
                       ee.data.makeRequest_(params),
                       opt_callback);
};


/**
 * Retrieve status of one or more long-running tasks.
 *
 * @param {string|!Array.<string>} task_id ID of the task or an array of
 *     multiple task IDs.
 * @param {function(Object, string=)=} opt_callback An optional callback.
 *     If not supplied, the call is made synchronously.
 * @return {Array}  An array containing one object for each queried task,
 *     in the same order as the input array, each object containing the
 *     following values:
 *     id (string) ID of the task.
 *     state (string) State of the task, one of READY, RUNNING, COMPLETED,
 *         FAILED, CANCELLED; or UNKNOWN if the task with the specified ID
 *         doesn't exist.
 *     error_message (string) For a FAILED task, a description of the error.
 * @hidden
 */
ee.data.getTaskStatus = function(task_id, opt_callback) {
  if (goog.isString(task_id)) {
    task_id = [task_id];
  } else if (!goog.isArray(task_id)) {
    throw new Error('Invalid task_id: expected a string or ' +
        'an array of strings.');
  }
  return ee.data.send_('/taskstatus?q=' + task_id.join(),
                       null,
                       opt_callback,
                       'GET');
};


/**
 * Create processing task which computes a value.
 *
 * @param {string} task_id ID for the task (obtained using newTaskId).
 * @param {Object} params The value to be evaluated, with the following
 *     possible values:
 *        json (string) A JSON object to be evaluated.
 * @param {function(Object, string=)=} opt_callback An optional callback.
 *     If not supplied, the call is made synchronously.
 * @return {Object} May contain field 'note' with value 'ALREADY_EXISTS' if
 *     an identical task with the same ID already exists.
 * @hidden
 */
ee.data.prepareValue = function(task_id, params, opt_callback) {
  params['tid'] = task_id;
  return ee.data.send_('/prepare',
                       ee.data.makeRequest_(params),
                       opt_callback);
};


/**
 * Create processing task that exports or pre-renders an image.
 *
 * @param {string} task_id ID for the task (obtained using newTaskId).
 * @param {Object} params The object that describes the processing task;
 *    only fields that are common for all processing types are documented here.
 *      type (string) Either 'export_image' or 'render'.
 *      imageJson (string) JSON description of the image.
 * @param {function(Object, string=)=} opt_callback An optional callback.
 *     If not supplied, the call is made synchronously.
 * @return {Object} May contain field 'note' with value 'ALREADY_EXISTS' if
 *     an identical task with the same ID already exists.
 * @hidden
 */
ee.data.startProcessing = function(task_id, params, opt_callback) {
  params['id'] = task_id;
  return ee.data.send_('/processingrequest',
                       ee.data.makeRequest_(params),
                       opt_callback);
};


/**
 * Send an API call.
 *
 * @param {string} path The API endpoint to call.
 * @param {?goog.Uri.QueryData} params The call parameters.
 * @param {function(Object, string=)=} opt_callback An optional callback.
 *     If not specified, the call is made synchronously and the response
 *     is returned.
 * @param {string=} opt_method The HTTPRequest method (GET or POST), default
 *     is POST.
 *
 * @return {?Object} The data object returned by the API call.
 * @private
 */
ee.data.send_ = function(path, params, opt_callback, opt_method) {
  // Make sure we never perform API calls before initialization.
  ee.data.initialize();

  opt_method = opt_method || 'POST';
  var url = ee.data.apiBaseUrl_ + path;
  var requestData = params ? params.toString() : '';

  // Handle processing and dispatching a callback response.
  function handleResponse(responseText, opt_callback) {
    var jsonIsInvalid = false;
    try {
      var response = goog.json.parse(responseText);
      var data = response['data'];
    } catch (e) {
      jsonIsInvalid = true;
    }

    var errorMessage = undefined;

    // Totally malformed, with either invalid JSON or JSON with
    // neither a data nor an error property.
    if (jsonIsInvalid || !('data' in response || 'error' in response)) {
      errorMessage = 'Malformed response: ' + responseText;
    } else if ('error' in response) {
      errorMessage = response['error']['message'];
    }

    if (opt_callback) {
      opt_callback(data, errorMessage);
    } else {
      if (!errorMessage) {
        return data;
      }
      throw new Error(errorMessage);
    }
  };

  // WARNING: The content-type header in the section below must use this exact
  // capitalization to remain compatible with the Node.JS environment. See:
  // https://github.com/driverdan/node-XMLHttpRequest/issues/20
  if (opt_callback) {
    goog.net.XhrIo.send(
        url,
        function(e) {
          return handleResponse(e.target.getResponseText(), opt_callback);
        },
        opt_method,
        requestData,
        {'Content-Type': 'application/x-www-form-urlencoded'},
        ee.data.deadlineMs_);
  } else {
    // Construct a synchronous request.
    var xmlhttp = goog.net.XmlHttp();

    // Send request.
    xmlhttp.open(opt_method, url, false);
    xmlhttp.setRequestHeader(
        'Content-Type', 'application/x-www-form-urlencoded');
    xmlhttp.send(requestData);
    return handleResponse(xmlhttp.responseText, null);
  }
};


/**
 * Convert an object into a goog.Uri.QueryData.
 *
 * @param {Object} params The params to convert.
 * @return {goog.Uri.QueryData} The converted parameters.
 * @private
 */
ee.data.makeRequest_ = function(params) {
  var request = new goog.Uri.QueryData();
  for (var item in params) {
    request.set(item, params[item]);
  }
  return request;
};


/**
 * Mock the networking calls used in send_.
 *
 * @param {Object=} opt_calls A dictionary containing the responses to return
 *     for each URL, keyed to URL.
 * @hidden
 */
ee.data.setupMockSend = function(opt_calls) {
  var calls = opt_calls || {};
  // Mock XhrIo.send for async calls.
  goog.net.XhrIo.send = function(url, callback, method, data) {
    // An anonymous class to simulate an event.  Closure doesn't like this.
    /** @constructor */
    var fakeEvent = function() {};
    var e = new fakeEvent();
    e.target = {};
    e.target.getResponseText = function() {
      // If the mock is set up with a string for this URL, return that.
      // Otherwise, assume it's a function and call it.  If there's nothing
      // set for this url, return an error response.
      if (url in calls) {
        if (goog.isString(calls[url])) {
          return calls[url];
        } else {
          return calls[url](url, callback, method, data);
        }
      } else {
        return '{"error": {}}';
      }
    };
    // Call the callback in a timeout to simulate asynchronous behavior.
    setTimeout(goog.bind(/** @type {function()} */ (callback), e, e), 0);
  };

  // Mock goog.net.XmlHttp for sync calls.
  /** @constructor */
  var fakeXmlHttp = function() {};
  var method = null;
  fakeXmlHttp.prototype.open = function(method, urlIn) {
    this.url = urlIn;
    this.method = method;
  };
  fakeXmlHttp.prototype.setRequestHeader = function() {};
  fakeXmlHttp.prototype.send = function(data) {
    if (this.url in calls) {
      if (goog.isString(calls[this.url])) {
        this.responseText = calls[this.url];
      } else {
        this.responseText = calls[this.url](this.url, this.method, data);
      }
    } else {
      // Return the input arguments.
      this.responseText = goog.json.serialize({
        'data': {
          'url': this.url,
          'method': this.method,
          'data': data
        }
      });
    }
  };
  goog.net.XmlHttp = function() {
    return /** @type {?} */ (new fakeXmlHttp());
  };
};

// Explicit exports.
goog.exportSymbol('ee.data', ee.data);
goog.exportProperty(ee.data, 'getInfo', ee.data.getInfo);
goog.exportProperty(ee.data, 'getList', ee.data.getList);
goog.exportProperty(ee.data, 'getMapId', ee.data.getMapId);
goog.exportProperty(ee.data, 'getValue', ee.data.getValue);
goog.exportProperty(ee.data, 'getThumbId', ee.data.getThumbId);
goog.exportProperty(ee.data, 'makeThumbUrl', ee.data.makeThumbUrl);
goog.exportProperty(ee.data, 'getDownloadId', ee.data.getDownloadId);
goog.exportProperty(ee.data, 'makeDownloadUrl', ee.data.makeDownloadUrl);