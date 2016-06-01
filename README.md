# gulp-jbb-profile

[![Version](https://img.shields.io/npm/v/gulp-jbb-profile.svg?label=version&maxAge=2592000)](https://www.npmjs.com/package/gulp-jbb-profile)

> Compile `jbb` profiles form specification files.

## Installation

Install package with NPM and add it to your development dependencies:

    npm install --save-dev gulp-jbb-profile

## Usage

```javascript
var jbb_profile = require('gulp-jbb-profile');

gulp.task('profile', function() {
    return gulp
        .src([ 'specs.yml' ])
        .pipe(jbb_profile({
            'name': 'my-profile'
        }))
        .pipe(gulp.dest('build'));
});
```

## Options

- `name`

    The name prefix of the file to generate. If missing, the filename of the input file will be used. The compiler will generate an `-encode.js` and `-decode.js` file with the encoding and decoding instructions for your profile.

## Specification Example

The following is a very simple specifications file that defines the properties of two objects: `Vector2` and `Vector3`:

```yaml
@uuid: 1
@revision: 1

Vector2:
    properties:
        - x
        - y

Vector3:
    extends: Vector2
    properties:
        - z
```

## Specification Syntax

The syntax specifications file is a `yaml` data file that contains all the javascript objects to be supported, along with their properties. For example:

```yaml
THREE.Vector3:
    properties:
        - x
        - y
        - z
```

There are various other properties available, explained in the following sections.

### `@xxx` - Meta properties

You can optionally specify various metadata properties for your profile:

- `@uuid`: Specify the unique ID of this profile table (32-bit)
- `@revision`: Specify the profile revision
- `@include[.encode|.decode]`: Include the specified file (globally or only on encoding/decoding).
- `@require[.encode|.decode]`: Require the specified node module (globally, or only on encoding/decoding).

For example:

```yaml
@uuid: 0x0100
@revision: 1
@include: lib/CustomFunctions.js
@include.encode: lib/EncodeFunctions.js
@require:
    THREE: three
```

### `extends`/`depends` - Inheritance

Using the `extends` property you can define inheritance of properties from another object:

```yaml
THREE.Object3D:
    properties:
        - position
        - rotation

# This will also inherit the properties
# of THREE.Object3D
THREE.Scene:
    extends: THREE.Object3D
    properties:
        - children

# This will only make sure that instances of THREE.Person are 
# tested before THREE.Object3D. No properties or are inherited.
THREE.Person:
    depends: THREE.Object3D
    properties:
        - position
```

If you don't want to inherit any properties, but you want your object to be tested before it's super-class you can use the `depends` keyword. This way it will not inherit it's properties.

### `init` - Constructor

It is important to note that jbb does not instantiate the objects in a single call, rather it separates this process in two distinct phases:

 1. At first, JBB will create an instance of the object, without knowing any of it's serialized properties.
 2. When the properties are known, an initialization function will be called.

The `init` property can be configured according to your needs. Depending on each object's particularities, one of the following options can be used:

<table>
    <tr>
        <th>Value</th>
        <th>Description</th>
        <th>When to use</th>
    </tr>
    <tr>
        <td>default</td>
        <td>Use the <code>new</code> keyword, with no arguments to create an object instance, and then define it's properties.</td>
        <td>When the object constructor is simple. For example when it only initializes the properties with some default values.</td>
    </tr>
    <tr>
        <td><code>[ prop, ... ]</code></td>
        <td>Use the <code>Object.create(prototype)</code> method to create an empty instance, and then call it's constructor to populate it's properties. The variable names passed in the array will be passed in that order to the object constructor. <em>Note:</em> If you are tracking more properties than the ones you use in the constructor, they will be set to the instance, after it's initialized.</td>
        <td>When the object does more in the constructor than just assign the values to it's properties. For example, when it generates some data based on the arguments.</td>
    </tr>
    <tr>
        <td><code>{ prop: ... }</code></td>
        <td>Use the <code>new</code> keyword, with no arguments to create an object instance, and then define it's properties. The dictionary provides fine-grained control over the way each property gets assigned to the instance. The value of the key is a javascript snipped for assigning the value to the instance. Script macros are available, refer to the _Script Macros_ section below for more details.</td>
        <td>When you are satisfied with the default, but you want a bit more fine-grained control on some properties.</td>        
    </tr>
    <tr>
        <td><code>function</code></td>
        <td>Use the <code>Object.create(prototype)</code> method to create an empty instance, and then call a user function to initialize it's properties.</td>
        <td>When the data needs some processing before they are assigned to the object. For example, when you need to create an image element from an image URL.</td>
    </tr>
</table>

The following example illustrates the previous values:

```yaml
# This will do:
#
#   inst = new THREE.Vector3()
#   inst.x = values[0]
#   inst.y = values[1]
#   inst.z = values[2]
#
THREE.Vector3:
    init: default
    properties:
        - x
        - y
        - z

# This will do:
#
#   inst = new THREE.Object3D()
#   inst.name = values[0]
#   inst.position.copy( values[1] )
#   inst.color.set( values[2], values[3], values[4] )
#
THREE.Object3D:
    init:
        position: $inst.position.copy( $value )
        color: $inst.color.set( $$red, $$green, $$blue )
    properties:
        - name
        - position
        - red
        - green
        - blue

# This will do:
#
#   inst = Object.create(THREE.Vector3.prototype)
#   THREE.Vector3.call( inst, values[0], 
#                             values[1], 
#                             values[2] )
THREE.Vector3:
    init: [x,y,z]
    properties:
        - x
        - y
        - z

# Demonstrating the note on second case,
# the extra properties will be defined afterwards:
#
#   inst = Object.create(THREE.Vector3.prototype)
#   THREE.Vector3.call( inst, values[0], 
#                             values[1], 
#                             values[2] )
#   inst.more1 = values[3];
#   inst.more2 = values[4];
#
THREE.Vector3:
    init: [x,y,z]
    properties:
        - x
        - y
        - z
        - more1
        - more2

# This will do:
#
#   inst = Object.create(THREE.Vector3.prototype)
#   user_function( inst, values )
#
THREE.Vector3:
    init: user_function
    properties:
        - x
        - y
        - z
```

### `frequent` - Frequently Encountered Flag

This flag should be set to `true` if this object is frequently encountered. Such objects are encoded in a more optimised way.

_NOTE: The optimisation works only for the first 32 objects, so carefully chose your frequent objects._

### `postInit` - Post-init Script

This property contains a script that will be executed right after the object is constructed in order to initialise the instance. Script macros are available, refer to the _Script Macros_ section below for more details.

For example:

```yaml
THREE.Mesh:
    extends: THREE.Object3D
    postInit: |
        $inst.updateMorphTargets();
    properties:
        - geometry
        - material
        - materialTexture
        - materialWireframe
```

### `embed` - Embed resources

This is an array of property names, that are string and pointing to URLs. The resources pointed by the URLs will be downloaded at compile time and embedded as a binary blob in the bundle. At decoding time, a blob URL will be used in place of the actual URL.

For example:

```yaml
# This will download the file pointed by 
# the 'url' property and store it in the bundle.
AudioFile:
    properties:
        - url
        - volume
        - pan
    embed:
        - url
```

## Script Macros

The following macros can be used when writing in-line javascript snippets (ex. `postInit` or `init` customisations):

<table>
    <tr>
        <th>$inst</th>
        <td>Expands to the variable that refers to the object instance.</td>
    </tr
    <tr>
        <th>$prop</th>
        <td>Expands to the name of the current property (not available on <code>postInit</code>).</td>
    </tr
    <tr>
        <th>$value</th>
        <td>Expands to the value of the current property (not available on <code>postInit</code>).</td>
    </tr
    <tr>
        <th>$values</th>
        <td>Expands to the array that contains all the encoded properties in the order they were defined.</td>
    </tr
    <tr>
        <th>$$<em>property</em></th>
        <td>Expands to the value of the object property with the given name (as received from the de-serialization function).</td>
    </tr
</table>
