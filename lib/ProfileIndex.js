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
 * Maximum number of frequent items (5-bit max)
 */
const MAX_FREQ_ITEMS = 32;

/**
 * The profile index where profile objects
 * are contained.
 */
var ProfileIndex = function() {
	this.objects = {};
	this.index = [];

	this._objTree = [];
	this._objList = [];
	this._properties = {};
	this._propID = 0;
	this._decodeIndex = [];

	this._objFreq = [];
	this._objInfeq = [];

	this.shortNames = true;
	this.indent = "\t";
	this.hasEmbed = false;

}

ProfileIndex.prototype = {

	/**
	 * Add a profile object on the index
	 */
	'add': function( po ) {
		this.objects[po.name] = po;
		if (po.extends) {
			this._objTree.push([ po.extends, po.name ]);
		} else if (po.depends) {
			this._objTree.push([ po.depends, po.name ]);
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
	'generateDnCif': function( index_offset, size, depth, prefix, testVar, callback ) {
		if (size == 0) 
			return prefix + this.indent + "/* No items */\n";
		var code = "";
			genChunk = (function( s, e, d, pf ) {
				if (d === 0) {
					code += pf + "switch ("+testVar+") {\n";
					for (var i=s; i<e; ++i) {
						code += pf + this.indent + "case "+(index_offset+i)+": return "+callback(i);
					}
					code += pf + "}\n";
				} else {

					// No items
					if (e == s) {

					// Only 1 item
					} else if (e == s+1) {
						code += pf + "if (" + testVar + " === " + (index_offset+s) + ")\n";
						code += pf + this.indent + "return "+callback(s);
					} else {
						var mid = Math.round((s+e) / 2);
						code += pf + "if (" + testVar + " < " + (index_offset+mid) + ") {\n";
						genChunk(s, mid, d - 1, pf + this.indent);
						code += pf + "} else {\n";
						genChunk(mid, e, d - 1, pf + this.indent);
						code += pf + "}\n";
					}
				}
			}).bind(this);
		genChunk( 0, size, depth, prefix + this.indent );
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
				this.index.push( this.objects[this._objList[i]] );
			}
		}

		// Then pre-cache property IDs for all the propeties
		// and check if any of the objects has embeds
		for (var i=0, l=this.index.length; i<l; ++i) {
			var pp = this.index[i].properties;
			for (var j=0, jl=pp.length; j<jl; ++j) {
				this.propertyVar(pp[j]);
			}
			if (this.index[i].embed.length > 0) {
				this.hasEmbed = true;
			}
		}

		// Separate to frequent and infrequent objects
		for (var i=0, l=this.index.length; i<l; ++i) {
			var obj = this.index[i], isFreq = obj.frequent;

			// Make sure we only register 5-bit objects
			if (isFreq) {
				if (this._objFreq.length >= MAX_FREQ_ITEMS) {
					isFreq = false;
				}
			}

			// Put on frequent or infrequent table
			if (isFreq) {
				obj.id = this._objFreq.length;
				this._objFreq.push(obj);
			} else {
				obj.id = this._objInfeq.length+MAX_FREQ_ITEMS;
				this._objInfeq.push(obj);
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
	'generateDecodeInitFunctions': function() {
		var code = "";

		// Collect object initializers
		for (var i=0, l=this.index.length; i<l; ++i) {
			var o = this.index[i];
			code += "/**\n * Factory & Initializer of "+o.name+"\n */\n";
			code += "var factory_"+o.safeName+" = {\n";
			code += this.indent + "props: "+o.properties.length+",\n";
			code += this.indent + "create: function() {\n";
			code += this.indent + this.indent + "return " + o.generateFactory() + ";\n";
			code += this.indent + "},\n";
			code += this.indent + "init: function(inst, props, pagesize, offset) {\n";
			code += o.generateInitializer('inst','props','pagesize','offset',this.indent+this.indent, this.indent);
			code += this.indent + "}\n";
			code += "}\n\n";
		}

		return code;
	},

	/**
	 * Generate the lookup factory by ID 
	 */
	'generateDecodeFactory' : function(prefix) {
		var code = "function( id ) {\n";
		code += prefix + this.indent + "if (id < "+MAX_FREQ_ITEMS+") {\n";
		code += this.generateDnCif( 0, this._objFreq.length, 3, prefix+this.indent, 'id', (function(i) {
			return "factory_"+this._objFreq[i].safeName+";\n"
		}).bind(this));
		code += prefix + this.indent + "} else {\n";
		code += this.generateDnCif( MAX_FREQ_ITEMS, this._objInfeq.length, 3, prefix+this.indent, 'id', (function(i) {
			return "factory_"+this._objInfeq[i].safeName+";\n"
		}).bind(this));
		code += prefix + this.indent + "}\n";
		code += prefix + "}\n";
		return code;
	},

	/**
	 * Generate the function to use for identifying an object
	 */
	'generateEncodeLookupFunction': function( prefix ) {
		var code = "function( inst ) {\n";
		for (var i=0, l=this.index.length; i<l; ++i) {
			var o = this.index[i];
			if (i === 0) code += prefix + this.indent + "if";
			else code += prefix + this.indent + "} else if";
			code += " (inst instanceof "+o.name+") {\n";
			code += prefix + this.indent + this.indent + "return [" + o.id + ", getter_"+o.safeName+"];\n";
		}
		code += prefix + this.indent + "}\n";
		code += prefix + "}\n"
		return code;
	},

	/**
	 * Generate the function that is used to encode an object
	 */
	'generateEncodeGetterFunctions': function() {
		var code = "";

		// Collect object initializers
		for (var i=0, l=this.index.length; i<l; ++i) {
			var o = this.index[i];
			code += "/**\n * Property getter "+o.name+"\n */\n";
			code += "function getter_"+o.safeName+"(inst) {\n";
			code += this.indent + "return "+o.generatePropertyGetter('inst',this.indent+this.indent) + ";\n";
			code += "}\n\n";
		}

		code += "\n"
		return code;
	}

};

module.exports = ProfileIndex;
