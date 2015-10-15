/**
 * Copyright 2015 LaxarJS
 * Released under the MIT license
 * http://laxarjs.org
 */
require( [
   'laxar',
   'laxar-application-dependencies',
   'json!laxar-application/var/flows/main/resources.json'
], function( ax, applicationDependencies, resources ) {
   'use strict';

   // prepare file listings for efficient asset loading
   // listing contents are determined by the Gruntfile.js
   window.laxar.fileListings = {
      application: resources,
      bower_components: resources,
      includes: resources
   };

   ax.bootstrap( applicationDependencies );
} );
