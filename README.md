# gulp-jbb-profile

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
@PROFILE:
    id: 255
    version: 1
    name: simple

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

# This will only make THREE.Person to be
# tested before THREE.Object3D. No properties
# or other attributes are inherited.
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

This flag should be set to `true` if this object is frequently encountered in order to opt it in for further optimisation.

_NOTE: This optimisation works only for the first 32 objects._

### `postInit` - Post-init Script

This property contains a script that will be executed right after the object is constructed in order to initialise the instance.

The following global variables are available in your script:

- `inst` : The instance of the object
- `props` : An array of the de-serialised properties in the order they appear in the properties field.

For example:

```
THREE.Mesh:
    extends: THREE.Object3D
    postInit: |
        inst.updateMorphTargets();
    properties:
        - geometry
        - material
        - materialTexture
        - materialWireframe
```

