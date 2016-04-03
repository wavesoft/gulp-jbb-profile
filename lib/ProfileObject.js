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

var crypto = require('crypto');

/**
 * A representation of an object in the profile
 */
var ProfileObject = function(name, specs) {
	this.name = name;
	this.id = 0;
	this.properties = specs.properties || [];
	this.extends = specs.extends || null;
	this.depends = specs.depends || null;
	this.factory = specs.factory || "new";
	this.init = specs.init || "default";
	this.frequent = false;
	this.initProperties = true;
	this.initConstructorArgs = [];
	this.postInit = specs.postInit || "";
	if (this.postInit) this.postInit += "\n";

	// Calculate a safe name
	this.safeName = name.replace(/[,\.\- \_]/g, '_');

	// Change init to 'constructor' if init is array
	if (this.init instanceof Array) {
		this.initConstructorArgs = this.init;
		this.init = "constructor";
		this.factory = "create"
	} else if (this.init !== "default") {
		// Custom user init function
		if (this.factory === "new")
			this.factory = "create";
	}

	// Initialize boolean fields
	if (specs.frequent !== undefined) {
		this.frequent = (["yes","true","1"].indexOf(specs.frequent.toString().toLowerCase()) >= 0);
	}
	if (specs.initProperties !== undefined) {
		this.initProperties = (["yes","true","1"].indexOf(specs.initProperties.toString().toLowerCase()) >= 0);
	}

}

ProfileObject.prototype = {

	/**
	 * Extend our properties based on specified object
	 */
	'applyExtend': function( o ) {
		// Don't extend 'depends', extend only 'extends'
		if (this.extends === null) {
			this.properties = o.properties.concat(this.properties);
			this.postInit = o.postInit + this.postInit;
		}
	},

	/**
	 * Generate the piece of code that fabricates (but not initializes)
	 * the object
	 */
	'generateFactory': function() {
		if (this.factory === 'new') {
			return 'new '+this.name+'()';
		} else if (this.factory === 'create') {
			return 'Object.create('+this.name+'.prototype)';
		} else {
			// Use custom user factory
			console.warn("Using custom factory for "+this.name);
			return this.factory + '('+this.name+')';
		}
	},

	/**
	 * Generate the property getter
	 */
	'generatePropertyGetter': function( instVar, prefix ) {
		var code = "[";
		for (var i=0, l=this.properties.length; i<l; ++i) {
			if (i > 0) code += ",";
			code += "\n" + prefix + instVar +"." + this.properties[i];
		}
		code += "]";
		return code;
	},

	/**
	 * Generate default property constructor
	 */
	'generatePropertySetter': function( instVar, valVar, prefix ) {
		var code ="";
		for (var i=0, l=this.properties.length; i<l; ++i) {
			code += prefix + instVar + "." + this.properties[i] + " = " + valVar + "["+i+"];\n";
		}
		return code;
	},

	/**
	 * Generate the name of the property initialization function.
	 * This is used to de-duplicate init functions for the same properties
	 */
	'getPropertyInitializerName': function() {
		var props = this.properties.slice().sort();
		return 'init' + crypto.createHash('md5').update(props.join(",")).digest("hex");
	},

	/**
	 * Generate the piece of code that initializes an instance of the object
	 */
	'generateInitializer': function( instVar, valVar, prefix, indent ) {
		var code = "", usedProps = [];

		//
		// [default] - Default empty constructor
		//
		if (this.init == "default") {

		//
		// [constructor] - Call constructor
		//
		} else if (this.init == 'constructor') {
			code += prefix + this.name+".call("+instVar;
			for (var i=0, l=this.initConstructorArgs.length; i<l; i++) {
				var arg = this.initConstructorArgs[i],
					partIdx = arg.search(/[\.\[]/),
					part = "", found = false;

				// Try to translate constructor arguments to components of the value
				// array when possivle
				if (partIdx == -1) partIdx = arg.length;
				part = arg.substr(0,partIdx);
				for (var j=0, jl=this.properties.length; j<jl; ++j) {
					if (this.properties[j] == part) {
						arg = valVar + "["+j+"]" + arg.substr(partIdx);
						usedProps.push(part);
						found = true;
						break;
					}
				}

				// Warn user if not found
				if (!found) {
					console.warn("Could not find property '"+arg+"' in "+this.name+". Assuming literal");
				}

				// Update constructor call
				code += ",\n"+prefix+indent+arg;
			}
			code += ");\n";

		//
		// [other] - Custom user function
		//
		} else {
			console.warn("Using custom init function for "+this.name);
			code += prefix + this.init + "(" + instVar +", " + valVar + ");\n";
			
		}

		// Call property initializer (might be shared with other instances)
		if (this.initProperties) {
			for (var i=0, l=this.properties.length; i<l; ++i) {
				var prop = this.properties[i];
				// Skip properties used in the constructor
				if (usedProps.indexOf(prop) !== -1) continue;
				code += prefix + instVar + "." + prop + " = " + valVar + "["+i+"];\n";
			}
		}

		// Call post-init
		if (this.postInit) {
			code += "\n" + prefix + "// Custom init function\n";
			code += prefix + this.postInit.replace(/\n/g, "\n"+prefix) + "\n";
		}

		return code;
	},

};

module.exports = ProfileObject;
