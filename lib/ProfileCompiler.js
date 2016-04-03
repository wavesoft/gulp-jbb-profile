/**
 * gulp-jbb-profile - Javascript Binary Bundles - Profile Compiler
 * Copyright (C) 2015 Ioannis Charalampidis <ioannis.charalampidis@cern.ch>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @author Ioannis Charalampidis / https://github.com/wavesoft
 */

var fs = require('fs');
var path = require('path');
var YAML = require('yamljs');
var ProfileObject = require('./ProfileObject');
var ProfileIndex = require('./ProfileIndex');

/**
 * Export the compiler function
 *
 * It receives the soecification file as source and calls back with
 * two arguments, the contents of the encode and the decode files.
 */
module.exports = function( data, config, callback ) {
	var baseDir = config.config || ".";

	// Load specs from file
	var specs = YAML.parse(data);
	var profile = new ProfileIndex();

	// Iterate over the objects in the specifications & register them
	var objects = Object.keys(specs), meta = {};
	for (var i=0, l=objects.length; i<l; ++i) {
		var key = objects[i];
		if (key[0] === "@") {
			if (key === "@PROFILE") {
				meta = specs[objects[i]];
			} else {
				callback("Unknown meta-key "+key);
				return;
			}
		} else {
			profile.add( new ProfileObject(key, specs[objects[i]]) )
		}
	}

	// Compile profile
	profile.compile();

	// Load library buffers if specified
	var encodeBuffer = "", decodeBuffer = "";
	if (meta['lib']) {
		var f = meta['lib'];
		if (f === ".") f = baseDir + f;
		var lib = fs.readFileSync( f , { 'encoding': 'utf-8' } );
		encodeBuffer += lib;
		decodeBuffer += lib;
	}
	if (meta['lib-encode']) {
		var f = meta['lib-encode'];
		if (f === ".") f = baseDir + f;
		encodeBuffer += fs.readFileSync( f , { 'encoding': 'utf-8' } );
	}
	if (meta['lib-decode']) {
		var f = meta['lib-decode'];
		if (f === ".") f = baseDir + f;
		decodeBuffer += fs.readFileSync( f , { 'encoding': 'utf-8' } );
	}

	// Compile encode buffer
	encodeBuffer += "module.exports = "+profile.generateEncodeFactory();

	// Compile decode buffer
	decodeBuffer += profile.generateInitFunctions();
	decodeBuffer += "module.exports = "+profile.generateDecodeFactory();

	// Callback
	callback( null, encodeBuffer, decodeBuffer );	

};
