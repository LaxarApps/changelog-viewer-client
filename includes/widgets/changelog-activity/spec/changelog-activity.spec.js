/**
 * Copyright 2015 LaxarJS
 * Released under the MIT license
 * http://www.laxarjs.org
 */
define( [
   'json!../widget.json',
   'laxar-mocks',
   'angular-mocks',
   'json!./data/changelog_api.json',
   'json!./data/releases.json',
   'json!./data/resources.json'
], function( descriptor, axMocks, ngMocks, changelogApi, releases, resources ) {
   'use strict';

   describe( 'changelog-activity', function() {

      var $httpBackend;

      beforeEach( axMocks.createSetupForWidget( descriptor ) );

      beforeEach( function() {
         axMocks.widget.configure( {
            'server': {
               'url': 'http://localhost:8007/api'
            },
            'categories': {
               'resource': 'categories'
            },
            'releases': {
               'action': 'getReleases'
            },
            'changelog': {
               'action': 'getChangelog'
            }
         } );
      } );

      beforeEach( axMocks.widget.load );

      beforeEach( function() {
         ngMocks.inject( function( $injector ) {
            $httpBackend = $injector.get( '$httpBackend' );
         } );
         $httpBackend.expectGET( 'http://localhost:8007/api' ).respond( 200, changelogApi[ 0 ] );
         $httpBackend.expectGET( 'http://localhost:8007/categories' ).respond( 200, changelogApi[ 1 ] );
         axMocks.triggerStartupEvents();
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      describe( 'with feature "server" and "categories"', function() {

         it( 'gets the categories from the backend and publishes them as resource', function() {
            //expect( axMocks.widget.$scope.eventBus.publish )
            //   .toHaveBeenCalledWith( 'didReplace.categories', {
            //      resource: 'categories',
            //      data: resources[ 0 ]
            //   } );
         } );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      afterEach( axMocks.tearDown );

   } );

} );
