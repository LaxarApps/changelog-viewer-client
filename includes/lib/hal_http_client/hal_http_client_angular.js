/**
 * Copyright 2015 LaxarJS
 * Released under the MIT license
 * http://www.laxarjs.org
 */
define( [
   'angular',
   'laxar',
   './hal_http_client'
], function( ng, ax, halHttpClient ) {
   'use strict';

   var module = ng.module( 'hal_http_client', [] );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   module.service( 'halHttpClient', [ '$http', '$q', function( $http, $q ) {
      return function( optionalOptions ) {
         return halHttpClient.create( $http, $q, optionalOptions );
      };
   } ] );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   return module;

} );
