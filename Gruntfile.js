/*global module:false*/
module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    // Metadata.
    pkg: grunt.file.readJSON('package.json'),
    banner: 
      '',
      //'/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' +
      //'<%= pkg.homepage ? "* " + pkg.homepage + "\\n" : "" %>' +
      //'* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
      //' Licensed <%= _.pluck(pkg.licenses, "type").join(", ") %> */\n',


    // Task configuration.
    clean: {
			www: ["dist/"]
		},

    concat: {
      options: {
        banner: '<%= banner %>',
        stripBanners: true
      },
			www: {
				src: [ "dist/debug/require.js"],
				dest: 'dist/debug/require.js',
				separator: ";"
			}
    },

    handlebars: {
      all: {
        files: {
          "dist/templates/templates.js": [ "app/templates/**/*.html" ]
        },
        options: {
          processName: function(filePath) {
            // remove the www.. 
           return filePath.replace(/^www\//i, ""); 
          },
          wrapped: true,
          amd: true
        }
      }
    },

    /*less: {
      www: {
        options: {
          paths: ["assets/css/less"]
        },
        files: {
          "www/assets/css/core.css": "assets/css/less/styles.less",
          "www/assets/css/core-responsive.css": "assets/css/less/responsive.less"
        }
      }
    },*/

    cssmin: {
      www: {
        files: {
          "dist/release/index.css": ["assets/css/index.css"]
					//"www/dist/release/core.css": ["assets/css/core.css"],
					//"www/dist/release/core-responsive.css": ["assets/css/core-responsive.css"]
        }
      }
    },

    requirejs: {
      www: {
        options: {
          baseUrl: "./app/",
          mainConfigFile: "app/config.js",
          out: "dist/debug/require.js",
          name: "config",
          wrap: true,
          optimize: "none",
          paths: {
            requireLib: '../assets/js/libs/require'
          },
          include: ["requireLib","main"],
          namespace: "tvpapp"
        }
      }
    },

    uglify: {
      options: {
        banner: '<%= banner %>',
        //report: 'gzip',
        compress: true
      },
      www: {
        src: 'dist/debug/require.js',
        dest: 'dist/release/require.js'
      }
    },
    /*jshint: {
      options: {
        curly: true,
        eqeqeq: true,
        immed: true,
        latedef: true,
        newcap: true,
        noarg: true,
        sub: true,
        undef: true,
        unused: true,
        boss: true,
        eqnull: true,
        browser: true,
        globals: {}
      },
      gruntfile: {
        src: 'Gruntfile.js'
      }
    },*/
    watch: {
      gruntfile: {
        files: ["app/**/*.js", "index.html"],
        tasks: ['debug']
      },
      www: {
        files: ["app/templates/**/*.html"],
        tasks: 'handlebars'
      },
      javascript: {
        files: ["app/**/*.js", "tests/specs/**/*Spec.js"],
        tasks: "jasmine"
      },
      'less-www': {
        files: ["www/assets/css/less/**/*.less"],
        tasks: ["less:www"]
      }
    },

    connect: {
      server: {
        options: {
          port: 9001,
          baseUrl: "./"
        }
      }
    },
    jasmine: {
      www: {
        src: 'app/**/*.js',
        options: {
          //keepRunner: true,
          specs: 'tests/specs/**/*.js',
          helpers: 'tests/specs/*Helper.js',
          host: 'http://127.0.0.1:8000/',
          template: require('grunt-template-jasmine-requirejs'),
          templateOptions: {
            requireConfigFile: 'app/config.js',
            requireConfig: {
              baseUrl: "./app/"
            }
          }
        }
      }
    }
  });

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-jasmine');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-requirejs');
  grunt.loadNpmTasks('grunt-contrib-handlebars');
  grunt.loadNpmTasks('grunt-contrib-jasmine');
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-connect');

  // TVP Tasks
  grunt.registerTask('debug:www', [ 'clean:www', 'handlebars', 'requirejs:www', 'concat:www']);

  grunt.registerTask('release:www', [ 'debug:www', 'uglify:www', 'cssmin' ]);

  grunt.registerTask('test:www', ['connect:www', 'jasmine:www']);

  //TODO: LESS CSS compilation
  //grunt.registerTask('less', ['less:player', 'watch']);
};
