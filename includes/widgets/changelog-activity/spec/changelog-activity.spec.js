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
         $httpBackend.whenGET( 'http://localhost:8007/api' ).respond( 200, changelogApi[ '/api' ] );
         $httpBackend.whenGET( '/categories' ).respond( 200, changelogApi[ '/categories' ] );
         $httpBackend.whenGET( '/categories/frontend' ).respond( 200, changelogApi[ '/categories/frontend' ] );
         $httpBackend.whenGET( '/categories/backend' ).respond( 200, changelogApi[ '/categories/backend' ] );
         $httpBackend.whenGET( '/categories/frontend/repositories' ).respond( 200, changelogApi[ '/categories/frontend/repositories' ] );
         $httpBackend.whenGET( '/categories/backend/repositories' ).respond( 200, changelogApi[ '/categories/backend/repositories' ] );
         $httpBackend.whenGET( '/repositories/0' ).respond( 200, changelogApi[ '/repositories/0' ] );
         $httpBackend.whenGET( '/repositories/1' ).respond( 200, changelogApi[ '/repositories/1' ] );
         $httpBackend.whenGET( '/repositories/3' ).respond( 200, changelogApi[ '/repositories/3' ] );
         $httpBackend.whenGET( '/repositories/4' ).respond( 200, changelogApi[ '/repositories/4' ] );
         $httpBackend.whenGET( '/repositories/0/releases' ).respond( 200, changelogApi[ '/repositories/0/releases' ] );
         $httpBackend.whenGET( '/repositories/1/releases' ).respond( 200, changelogApi[ '/repositories/1/releases' ] );
         axMocks.triggerStartupEvents();
      } );

      afterEach( function() {
         $httpBackend.verifyNoOutstandingExpectation();
         $httpBackend.verifyNoOutstandingRequest();
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      describe( 'with feature "server" and "categories"', function() {

         it( 'gets the categories from the backend and publishes them as resource', function() {
            $httpBackend.flush();
            expect( axMocks.widget.$scope.eventBus.publish )
               .toHaveBeenCalledWith( 'didReplace.categories', {
                  resource: 'categories',
                  data: resources[ 0 ]
               } );
         } );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      describe( 'with feature "releases"', function() {

         it( 'subscribes to the takeActionRequest of the configured "releases.action"', function() {
            $httpBackend.flush();
            expect( axMocks.widget.$scope.eventBus.subscribe )
               .toHaveBeenCalledWith( 'takeActionRequest.getReleases', jasmine.any(Function) );
         } );

        
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      afterEach( axMocks.tearDown );

   } );

} );
