var require = {
   baseUrl: 'bower_components',
   deps: [],
   paths: {
      // LaxarJS Core and dependencies:
      laxar: 'laxar/dist/laxar.with-deps',
      requirejs: 'requirejs/require',
      text: 'requirejs-plugins/lib/text',
      json: 'requirejs-plugins/src/json',
      angular: 'angular/angular',
      'angular-mocks': 'angular-mocks/angular-mocks',
      'angular-route': 'angular-route/angular-route',
      'angular-sanitize': 'angular-sanitize/angular-sanitize',

      // LaxarJS Core (tests only):
      'laxar/laxar_testing': 'laxar/dist/laxar_testing',
      jquery: 'jquery/dist/jquery',
      jasmine: 'jasmine/lib/jasmine-core/jasmine',
      q_mock: 'q_mock/q',

      // LaxarJS Patterns:
      'laxar-patterns': 'laxar-patterns/dist/laxar-patterns',
      'json-patch': 'fast-json-patch/src/json-patch-duplex',

      // LaxarJS UIKit:
      'laxar-uikit': 'laxar-uikit/dist/laxar-uikit',
      'laxar-uikit/controls': 'laxar-uikit/dist/controls',

      // LaxarJS application paths:
      'laxar-path-root': '..',
      'laxar-path-layouts': '../application/layouts',
      'laxar-path-pages': '../application/pages',
      'laxar-path-flow': '../application/flow/flow.json',
      'laxar-path-widgets': '../includes/widgets',
      'laxar-path-themes': '../includes/themes',
      'laxar-path-default-theme': 'laxar-uikit/dist/themes/default.theme',

      // LaxarJS application modules (contents are generated):
      'laxar-application-dependencies': '../var/flows/main/dependencies',

      // laxar-mocks specific paths:
      'laxar-mocks': 'laxar-mocks/dist/laxar-mocks',
      jasmine2: 'jasmine2/lib/jasmine-core/jasmine',
      'promise-polyfill': 'promise-polyfill/Promise',

      // changelog-widget
      marked: 'marked',
      semver: 'semver/semver.browser',
      'iframe-resizer': 'iframe-resizer/js/iframeResizer.contentWindow.min'
   },
   packages: [
      {
         name: 'laxar-application',
         location: '..',
         main: 'init'
      },
      {
         name: 'hal_http_client',
         location:'../includes/lib/hal_http_client',
         main: 'hal_http_client'
      }
   ],
   shim: {
      angular: {
         // use `deps: [ 'jquery' ]` if you use jquery and need a jQuery-compatible angular.element()
         deps: [],
         exports: 'angular'
      },
      'angular-mocks': {
         deps: [ 'angular' ],
         init: function( angular ) {
            'use strict';
            return angular.mock;
         }
      },
      'angular-route': {
         deps: [ 'angular' ],
         init: function( angular ) {
            'use strict';
            return angular;
         }
      },
      'angular-sanitize': {
         deps: [ 'angular' ],
         init: function( angular ) {
            'use strict';
            return angular;
         }
      },
      // LaxarJS Patterns
      'json-patch': {
         exports: 'jsonpatch'
      }
   }
};
