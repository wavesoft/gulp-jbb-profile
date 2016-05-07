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

var through2 		= require('through2');
var gutil 			= require('gulp-util');
var fs   			= require('fs');
var path 			= require('path');
var toArray  		= require('stream-to-array');
var Readable 		= require('stream').Readable;
var PluginError 	= gutil.PluginError;
var ProfileCompiler	= require('./lib/ProfileCompiler.js');

const PLUGIN_NAME 	= 'gulp-jbb-profile';

/**
 * Read entire buffer and compile
 */
function bufferMode( contents, options, callback ) {
	ProfileCompiler( contents.toString('utf-8'), options, function(err, encBuf, decBuf){
		if (err) {
			callback(err);
			return;
		}

		// Callback buffers
		callback(null, new Buffer(encBuf,'utf8'), 
					   new Buffer(decBuf,'utf8') );
	});
}

/**
 * Read entire stream and process
 */
function streamMode( contents, options, callback ) {
	toArray(contents, function(err, chunks) {
		if (err) {
			callback(err);
			return;
		}
		bufferMode( Buffer.concat(chunks), options, function(err, encBuf, decBuf) {
			if (err) {
				callback(err);
				return;
			}

			var encStream = new Readable();
			encStream.push(encBuf);
			encStream.push(null);

			var decStream = new Readable();
			decStream.push(decBuf);
			decStream.push(null);

			// Callback streams
			callback(null, encStream, decStream);
		});
	});
}

/**
 * Interface to Gulp
 */
module.exports = function( options ) {

	// Combine user defined options with default options
	var config = { };
	for (var attrname in options) { config[attrname] = options[attrname]; }

	// Create a through2 object stream. This is our plugin export
	var stream = through2.obj(compile);

	// Expose the config so we can test it
	stream.config = config;

	function compile(originalFile, enc, done) {
		var self = this;

	    // Call when finished with compression
	    var finished = function( err, encContents, decContents ) {

	    	// Emmit errors
			if (err) {
				var error = new PluginError(PLUGIN_NAME, err, { showStack: true });
				self.emit('error', error);
				done();
				return;
			}

			// Get base name
			var dir = path.dirname( originalFile.path );
			var name = path.basename( originalFile.path );
			var parts = name.split("."); parts.pop();
			var baseName = self.config.name || parts.join(".");

			// The encode file
			var f = originalFile.clone();
			f.contents = encContents;
			f.path = path.join( dir, baseName + '-encode.js' );
			self.push(f);

			// The decode file
			var f = originalFile.clone();
			f.contents = decContents;
			f.path = path.join( dir, baseName + '-decode.js' );
			self.push(f);

	    	// We are done
			done();
			return;
	    }

        // Nothing to do on empty files
        if (originalFile.isNull()) {
            return done(null, originalFile);
        }

        // Handle stream
        if (originalFile.isStream()) {
        	streamMode( originalFile.contents, this.config, finished );
        } else if (originalFile.isBuffer()) {
        	bufferMode( originalFile.contents, this.config, finished );
        }

	}

	return stream;
}
