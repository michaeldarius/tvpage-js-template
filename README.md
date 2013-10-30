TVPage Javascript Template
==========================

TVPage is a software-as-a-service video marketing platform for converting video to sales.

This javascript based template library is intended to enable front-end javascript developers to create their own video experience with re-usable components, powered by the TVPage backend data API & management interface.

## Quick start

* [Download the latest release](https://github.com/twbs/bootstrap/releases/tag/v1.0.0).
* Clone the repo: `git clone https://github.com/tvpage/tvpage-js-template.git`.

For additional documentation, check out the Wiki, where information on framework contents, templates and examples will reside.



### What's included
Within the download you'll find the following directories and files, logically grouping common assets and providing both compiled and minified variations. You'll see something like this:

```
tvpage-js-template/
├── app/
│   ├── modules/
│   └── templates/
├── assets/
│   ├── css/
│   ├── fonts/
│   └── js/
│       ├── libs/
│       └── plugins/
└── dist/
    ├── debug/
    ├── release/
    └── templates/
```

Compiled versions of the javascript templates are available in the `dist/debug/` folder, while compiled/minified versions are available in the `dist/release/` folder.



## Bugs and feature requests

Have a bug or a feature request? [Please open a new issue](https://github.com/tvpage/tvpage-js-template/issues). Before opening any issue, please search for existing issues and read the [Issue Guidelines](https://github.com/necolas/issue-guidelines), written by [Nicolas Gallagher](https://github.com/necolas/).



## Documentation

The long-form version of the documentation is located in the this repo's [wiki](https://github.com/tvpage/tvpage-js-template/wiki)




## Compiling CSS and JavaScript

We use [Grunt](http://gruntjs.com/) with convenient methods for working with the framework. It's how we compile our code, run tests, and more. To use it, install the required dependencies as directed (from folder root, run `npm install`) and then run some Grunt commands.

Dependencies:
* NodeJS + NPM
* GruntJS (grunt, grunt-init, grunt-cli)

### Install Grunt

From the command line:

1. Install `grunt-cli` globally with `npm install -g grunt-cli`.
2. Navigate to the root `/tvpage-js-template` directory, then run `npm install`. npm will look at [package.json](package.json) and automatically install the necessary local dependencies listed there.

When completed, you'll be able to run the various Grunt commands provided from the command line.

**Unfamiliar with `npm`? Don't have node installed?** No worries. npm stands for [node packaged modules](http://npmjs.org/) and is a way to manage development dependencies through node.js. [Download and install node.js](http://nodejs.org/download/) before proceeding.

### Available Grunt commands

#### Debug - `grunt debug`
Run `grunt debug` to compile the CSS and JavaScript into `dist/debug/`. 

#### Release - `grunt release`
`grunt release` creates the `dist/release/` directory with compiled/minified files.

#### Tests - `grunt test`
Runs [JSHint](http://jshint.com) and [Jasmine](http://pivotal.github.io/jasmine/) tests headlessly in [PhantomJS](http://phantomjs.org/) (used for CI).

#### Watch - `grunt watch`
This is a convenience method for watching the files in your project and building them as they change. Can also be used in conjunction with [Live Reload](https://github.com/gruntjs/grunt-contrib-livereload).

### Troubleshooting dependencies

Should you encounter problems with installing dependencies or running Grunt commands, uninstall all previous dependency versions (global and local). Then, rerun `npm install`.



## Contributing

Please read through our [contributing guidelines](https://github.com/twbs/bootstrap/blob/master/CONTRIBUTING.md). Included are directions for opening issues, coding standards, and notes on development.


## Community

Keep track of development and community news.

* Follow [@tvpage on Twitter](http://twitter.com/tvpage).
* Read and subscribe to [The TVPage Blog](http://blog.tvpage.com).




## Versioning

For transparency and insight into our release cycle, and for striving to maintain backward compatibility, TVPage will be maintained under the Semantic Versioning guidelines as much as possible.

Releases will be numbered with the following format:

`<major>.<minor>.<patch>`

And constructed with the following guidelines:

* Breaking backward compatibility bumps the major (and resets the minor and patch)
* New additions without breaking backward compatibility bumps the minor (and resets the patch)
* Bug fixes and misc changes bumps the patch

For more information on SemVer, please visit <http://semver.org/>.



## Authors

**Matt Babineau**

+ <http://twitter.com/tvpmb>
+ <http://github.com/tvpmb>
