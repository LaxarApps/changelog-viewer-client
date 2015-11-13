/**
 * Copyright 2015 aixigo AG
 * Released under the MIT license.
 * http://laxarjs.org/license
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
      var widgetEventBus;
      var testEventBus;

      beforeEach( axMocks.createSetupForWidget( descriptor ) );

      beforeEach( function() {
         axMocks.widget.configure( {
            'server': {
               'url': 'http://localhost:8007/api'
            },
            'categories': {
               'resource': 'categories'
            }
         } );
      } );

      beforeEach( axMocks.widget.load );

      beforeEach( function() {
         widgetEventBus = axMocks.widget.axEventBus;
         testEventBus = axMocks.eventBus;

         ngMocks.inject( function( $injector ) {
            $httpBackend = $injector.get( '$httpBackend' );
         } );
         $httpBackend.expectGET( 'http://localhost:8007/api' ).respond( 200, changelogApi[ '/api' ] );
         $httpBackend.expectGET( '/categories' ).respond( 200, changelogApi[ '/categories' ] );

         $httpBackend.expectGET( '/categories/frontend' ).respond( 200, changelogApi[ '/categories/frontend' ] );
         $httpBackend.expectGET( '/categories/backend' ).respond( 200, changelogApi[ '/categories/backend' ] );

         $httpBackend.expectGET( '/categories/frontend/repositories' ).respond( 200, changelogApi[ '/categories/frontend/repositories' ] );
         $httpBackend.expectGET( '/categories/backend/repositories' ).respond( 200, changelogApi[ '/categories/backend/repositories' ] );

         $httpBackend.expectGET( '/repositories/0' ).respond( 200, changelogApi[ '/repositories/0' ] );
         $httpBackend.expectGET( '/repositories/1' ).respond( 200, changelogApi[ '/repositories/1' ] );
         $httpBackend.expectGET( '/repositories/3' ).respond( 200, changelogApi[ '/repositories/3' ] );
         $httpBackend.expectGET( '/repositories/4' ).respond( 200, changelogApi[ '/repositories/4' ] );

         $httpBackend.expectGET( '/repositories/0/releases' ).respond( 200, changelogApi[ '/repositories/0/releases' ] );
         $httpBackend.expectGET( '/repositories/1/releases' ).respond( 200, changelogApi[ '/repositories/1/releases' ] );
         $httpBackend.expectGET( '/repositories/3/releases' ).respond( 200, changelogApi[ '/repositories/3/releases' ] );
         $httpBackend.expectGET( '/repositories/4/releases' ).respond( 200, changelogApi[ '/repositories/4/releases' ] );

         $httpBackend.whenGET( 'http://localhost:8007/api/repositories/0/releases/master' ).respond( 200, releases[ '/repositories/0/releases/master' ] );
         $httpBackend.whenGET( 'http://localhost:8007/api/repositories/0/releases/master-2.x' ).respond( 200, releases[ '/repositories/0/releases/master-2.x' ] );
         $httpBackend.whenGET( 'http://localhost:8007/api/repositories/0/releases/v2.0.x' ).respond( 200, releases[ '/repositories/0/releases/v2.0.x' ] );
         $httpBackend.whenGET( 'http://localhost:8007/api/repositories/0/releases/v3.0.x' ).respond( 200, releases[ '/repositories/0/releases/v3.0.x' ] );

         $httpBackend.whenGET( 'http://localhost:8007/api/repositories/1/releases/v2.0.x' ).respond( 200, releases[ '/repositories/1/releases/v2.0.x' ] );
         $httpBackend.whenGET( 'http://localhost:8007/api/repositories/1/releases/v3.0.x' ).respond( 200, releases[ '/repositories/1/releases/v3.0.x' ] );
         $httpBackend.whenGET( 'http://localhost:8007/api/repositories/1/releases/master' ).respond( 200, releases[ '/repositories/1/releases/master' ] );
         $httpBackend.whenGET( 'http://localhost:8007/api/repositories/1/releases/master-2.x' ).respond( 200, releases[ '/repositories/1/releases/master-2.x' ] );

         $httpBackend.whenGET( 'http://localhost:8007/api/repositories/3/releases/master' ).respond( 200, releases[ '/repositories/3/releases/master' ] );
         $httpBackend.whenGET( 'http://localhost:8007/api/repositories/3/releases/master-2.x' ).respond( 200, releases[ '/repositories/3/releases/master-2.x' ] );
         $httpBackend.whenGET( 'http://localhost:8007/api/repositories/3/releases/v2.0.x' ).respond( 200, releases[ '/repositories/3/releases/v2.0.x' ] );
         $httpBackend.whenGET( 'http://localhost:8007/api/repositories/3/releases/v3.0.x' ).respond( 200, releases[ '/repositories/3/releases/v3.0.x' ] );

         $httpBackend.whenGET( 'http://localhost:8007/api/repositories/4/releases/master' ).respond( 200, releases[ '/repositories/4/releases/master' ] );
         $httpBackend.whenGET( 'http://localhost:8007/api/repositories/4/releases/master-1.x' ).respond( 200, releases[ '/repositories/4/releases/master-1.x' ] );
         $httpBackend.whenGET( 'http://localhost:8007/api/repositories/4/releases/v2.0.x' ).respond( 200, releases[ '/repositories/4/releases/v2.0.x' ] );
         $httpBackend.whenGET( 'http://localhost:8007/api/repositories/4/releases/v1.0.x' ).respond( 200, releases[ '/repositories/4/releases/v1.0.x' ] );
         axMocks.triggerStartupEvents();
      } );

      afterEach( function() {
         $httpBackend.verifyNoOutstandingExpectation();
         $httpBackend.verifyNoOutstandingRequest();
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      describe( 'with feature "server" and "categories"', function() {

         it( 'gets the list with categories, repositories, releases and changelogs and publishes the "categories" resource ', function() {
            $httpBackend.flush();
            expect( widgetEventBus.publish )
               .toHaveBeenCalledWith( 'didReplace.categories', {
                  resource: 'categories',
                  data: resources[ 0 ]
               } );
         } );

      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      afterEach( axMocks.tearDown );

   } );

} );
