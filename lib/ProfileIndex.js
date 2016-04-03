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

var toposort = require('toposort');

/**
 * The profile index where profile objects
 * are contained.
 */
var ProfileIndex = function() {
	this.objects = {};
	this._objTree = [];
	this._objList = [];
	this.index = [];
	this._properties = {};
	this._propID = 0;

	this.shortNames = true;
	this.indent = "\t";
}

ProfileIndex.prototype = {

	/**
	 * Add a profile object on the index
	 */
	'add': function( po ) {
		this.objects[po.name] = po;
		if (po.extends) {
			this._objTree.push([ po.extends, po.name ]);
		} else {
			this._objList.push( po.name );
		}
	},

	/**
	 * Generates a divide-and-conquer nested if-statements
	 * up to maximum 'depth' steps deep. After that it performs
	 * equality testing using a switch-case statement.
	 *
	 * This is intended for optimizing the lookup speed of
	 * elements when processing.
	 */
	'generateDnCif': function( size, depth, testVar, callback ) {
		var code = "";
			genChunk = (function( s, e, d, pf ) {
				if (d === 0) {
					code += pf + "switch ("+testVar+") {\n";
					for (var i=s; i<e; ++i) {
						code += pf + this.indent + "case "+i+": return "+callback(i);
					}
					code += pf + "}\n";
				} else {
					var mid = Math.round((s+e) / 2);
					code += pf + "if (" + testVar + " < " + mid + ") {\n";
					genChunk(s, mid, d - 1, pf + this.indent);
					code += pf + "} else {\n";
					genChunk(mid, e, d - 1, pf + this.indent);
					code += pf + "}\n";
				}
			}).bind(this);
		genChunk( 0, size, depth, this.indent );
		return code;
	},

	/**
	 * Return the property variable name, used to optimize for size
	 * the minified result.
	 */
	'propertyVar': function( name ) {
		var id = this._properties[name];
		if (id === undefined) {
			if (this.shortNames) {
				id = this._properties[name] = 'p' + (this._propID++).toString()
			} else {
				id = this._properties[name] = 'p' + name[0].toUpperCase() +
					name.substr(1).toLowerCase().replace(/[,\.\- \_]/g, '_')
			}
		}
	},

	/**
	 * Resolve dependencies and arrange objects 
	 * accoridng to priority and priority.
	 *
	 * Also handle subclassing of objects and other elements.
	 */
	'compile': function() {

		// Reset index
		this.index = [];

		// Apply extends to the objects
		for (var i=0, l=this._objTree.length; i<l; ++i) {
			if (this.objects[this._objTree[i][0]] === undefined) {
				throw "Extending unknown object "+this._objTree[i][0];
			}

			// Apply
			this.objects[this._objTree[i][1]].applyExtend(
				this.objects[this._objTree[i][0]]
			);
		}

		// Resolve dependencies
		var deps = toposort( this._objTree ).reverse(), used = {};
		for (var i=0, l=deps.length; i<l; ++i) {
			used[deps[i]] = 1;
			this.objects[deps[i]].id = this.index.length;
			this.index.push( this.objects[deps[i]] );
		}

		// Then include objects not part of dependency tree
		for (var i=0, l=this._objList.length; i<l; ++i) {
			// Skip objects already used in the dependency resolution
			if (!used[this._objList[i]])  {
				this.objects[this._objList[i]].id = this.index.length;
				this.index.push( this.objects[this._objList[i]] );
			}
		}

		// Then pre-cache property IDs for all the propeties
		for (var i=0, l=this.index.length; i<l; ++i) {
			var pp = this.index[i].properties;
			for (var j=0, jl=pp.length; j<jl; ++j) {
				this.propertyVar(pp[j]);
			}
		}

	},

	/**
	 * Generate a table with all the property constants
	 */
	'generatePropertyTable': function() {
		var pn = Object.keys(this._properties);
		var code = "var ";
		for (var i=0, l=pn.length; i<l; ++i) {
			if (i!==0) code += ",\n";
			code += this.indent + this._properties[pn[i]] + " = '"+ pn[i] + "'";
		}
		code += ";\n";
		return code;
	},

	/**
	 * Generate the list of init functions used by the lookup fcatory
	 * to generate the items
	 */
	'generateInitFunctions': function() {
		var code = "";

		// // Collect proeprty initializers
		// var known = {}, serial = [];
		// for (var i=0, l=this.index.length; i<l; ++i) {
		// 	var o = this.index[i], n = o.getPropertyInitializerName();
		// 	if (known[n] === undefined) {
		// 		known[n] = {
		// 			'comment': 'Property initializer of: ' + o.name,
		// 			'fn': o.generatePropertySetter( 'inst', 'props', this.indent )
		// 		};
		// 		serial.push(known[n]);
		// 	} else {
		// 		known[n].comment += ", " + o.name;
		// 	}
		// }

		// // Keep them
		// for (var i=0, l=serial.length; i<l; ++i) {
		// 	code += "/**\n * "+serial[i].comment+"\n */\n";
		// 	code += "function prop"+n+"(inst, props) {\n";
		// 	code += serial[i].fn;
		// 	code += "}\n\n";
		// }

		// Collect object initializers
		for (var i=0, l=this.index.length; i<l; ++i) {
			var o = this.index[i];
			code += "/**\n * Instance initializer of "+o.name+"\n */\n";
			code += "function init_"+o.safeName+"(inst, props) {\n";
			code += o.generateInitializer('inst','props',this.indent, this.indent);
			code += "}\n\n";
		}

		return code;
	},

	/**
	 * Generate the lookup factory by ID 
	 */
	'generateDecodeFactory' : function() {
		var code = "function( id ) {\n";
		code += this.generateDnCif( this.index.length, 4, 'id', (function(i) {
			return "[" + this.index[i].generateFactory() + ", init_"+this.index[i].safeName+"];\n"
		}).bind(this));
		code += "}\n";
		return code;
	},

	/**
	 * Generate the function that is used to encode an object
	 */
	'generateEncodeFactory': function() {
		var code = "function( inst ) {\n";
		for (var i=0, l=this.index.length; i<l; ++i) {
			var o = this.index[i];
			if (i === 0) code += this.indent + "if";
			else code += this.indent + "} else if";
			code += " (inst instanceof "+o.name+") {\n";
			code += this.indent + this.indent + "return [" + o.id + ", " + 
				o.generatePropertyGetter( 'inst', this.indent + this.indent + this.indent ) + " ];\n";
		}
		code += this.indent + "}\n}\n"
		return code;
	}

};

module.exports = ProfileIndex;
