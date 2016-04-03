# gulp-jbb-profile

> Compile `jbb` profiles form specification files.

## Installation

Install package with NPM and add it to your development dependencies:

    npm install --save-dev gulp-jbb-profile

## Usage

```javascript
var jbbProfile = require('gulp-jbb-profile');

gulp.task('profile', function() {
    return gulp
        .src([ 'specs.yml' ])
        .pipe(jbbProfile({
        }))
        .pipe(gulp.dest('build'));
});
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

There are various other options available, as explained later.

### Inheritance

You can also represent inheritance in the specifications file, making it simpler to re-use the parent specifications for the child. 

To define inheritance, use the `extends` keyword to specify the parent object:

```yaml
THREE.Object3D:
    properties:
        - position
        - rotation

THREE.Scene:
    extends: THREE.Object3D
    properties:
        - children
```

### Constructors & Initializers

It is important to note that jbb does not instantiate the objects in a single call, rather it separates this process in two functions:

 1. At first, JBB will create an instance of the object, without knowing any of it's serialized properties.
 2. When the properties are known, an initialization function will be called.

Depending on each object's particularities, one of the following solutions can be used:

<table>
    <tr>
        <th>Code</th>
        <th>Description<th>
        <th>Wen to use this<th>
    </tr>
    <tr>
        <td>default</td>
        <td>Use the <code>new</code> keyword, with no arguments to create an object instance, and then define it's properties.</td>
        <td>If the object constructor does not generate any data</td>
    </tr>
    <tr>
        <td>late</td>
        <td>Use the <code>Object.create(prototype)</code> method to create an empty instance, and then call it's constructor to define it's properties.</td>
        <td>If</td>
    </tr>
    <tr>
        <td>user</td>
        <td>Use the <code>Object.create(prototype)</code> method to create an empty instance, and then call a user function to initialize it's properties.</td>
    </tr>
</table>
