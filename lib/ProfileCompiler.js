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
			meta[key.substr(1)] = specs[objects[i]];
		} else {
			profile.add( new ProfileObject(key, specs[objects[i]]) )
		}
	}

	// Compile profile
	profile.compile();

	// Load library buffers if specified
	var encodeBuffer = "", decodeBuffer = "", metaBuffer = "";
	if (meta['include']) {
		var f = meta['include'];
		if (f === ".") f = baseDir + f;
		var lib = fs.readFileSync( f , { 'encoding': 'utf-8' } );
		encodeBuffer += lib;
		decodeBuffer += lib;
	}
	if (meta['include.encode']) {
		var f = meta['include.encode'];
		if (f === ".") f = baseDir + f;
		encodeBuffer += fs.readFileSync( f , { 'encoding': 'utf-8' } );
	}
	if (meta['include.decode']) {
		var f = meta['include.decode'];
		if (f === ".") f = baseDir + f;
		decodeBuffer += fs.readFileSync( f , { 'encoding': 'utf-8' } );
	}

	// Populate metadata
	metaBuffer += "\tid: " + (meta['uuid'] || 1) + ",\n";
	if(meta['meta']) {
		metaBuffer += "\tmeta: "+JSON.stringify(meta['meta'])+",\n";
	}


	// Compile encode buffer
	encodeBuffer += profile.generateEncodeGetterFunctions();
	encodeBuffer += "module.exports = {\n";
	encodeBuffer += metaBuffer;
	encodeBuffer += "\tencode: " + profile.generateEncodeLookupFunction("\t\t");
	encodeBuffer += "};\n";

	// Compile decode buffer
	decodeBuffer += profile.generateDecodeInitFunctions();
	decodeBuffer += "module.exports = {\n";
	decodeBuffer += metaBuffer;
	decodeBuffer += "\tdecode: " + profile.generateDecodeFactory("\t\t");
	decodeBuffer += "};\n";

	// Callback
	callback( null, encodeBuffer, decodeBuffer );	

};
