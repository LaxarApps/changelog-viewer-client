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
   'json!./data/releases.json'
], function( descriptor, axMocks, ngMocks, changelogApi, releases ) {
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
               'resource': 'categories',
               'include': [ 'Frontend' ]
            },
            'repository': {
               'action': 'getRepository'
            },
            'getAll': {
               'action': 'getAll'
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
         $httpBackend.whenGET( 'http://localhost:8007/api' ).respond( 200, changelogApi[ '/api' ] );
         $httpBackend.whenGET( '/component-map' ).respond( 200, changelogApi[ '/component-map' ] );
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
         $httpBackend.whenGET( '/repositories/3/releases' ).respond( 200, changelogApi[ '/repositories/3/releases' ] );
         $httpBackend.whenGET( '/repositories/4/releases' ).respond( 200, changelogApi[ '/repositories/4/releases' ] );

         $httpBackend.whenGET( 'http://localhost:8007/api/repositories/0/releases/master' ).respond( 200, releases[ '/repositories/0/releases/master' ] );
         $httpBackend.whenGET( 'http://localhost:8007/api/repositories/0/releases/master-2.x' ).respond( 200, releases[ '/repositories/0/releases/master-2.x' ] );
         $httpBackend.whenGET( 'http://localhost:8007/api/repositories/0/releases/2.0.x' ).respond( 200, releases[ '/repositories/0/releases/2.0.x' ] );
         $httpBackend.whenGET( 'http://localhost:8007/api/repositories/0/releases/3.0.x' ).respond( 200, releases[ '/repositories/0/releases/3.0.x' ] );

         $httpBackend.whenGET( 'http://localhost:8007/api/repositories/1/releases/2.0.x' ).respond( 200, releases[ '/repositories/1/releases/2.0.x' ] );
         $httpBackend.whenGET( 'http://localhost:8007/api/repositories/1/releases/3.0.x' ).respond( 200, releases[ '/repositories/1/releases/3.0.x' ] );
         $httpBackend.whenGET( 'http://localhost:8007/api/repositories/1/releases/master' ).respond( 200, releases[ '/repositories/1/releases/master' ] );
         $httpBackend.whenGET( 'http://localhost:8007/api/repositories/1/releases/master-2.x' ).respond( 200, releases[ '/repositories/1/releases/master-2.x' ] );

         $httpBackend.whenGET( 'http://localhost:8007/api/repositories/3/releases/master' ).respond( 200, releases[ '/repositories/3/releases/master' ] );
         $httpBackend.whenGET( 'http://localhost:8007/api/repositories/3/releases/master-2.x' ).respond( 200, releases[ '/repositories/3/releases/master-2.x' ] );
         $httpBackend.whenGET( 'http://localhost:8007/api/repositories/3/releases/2.0.x' ).respond( 200, releases[ '/repositories/3/releases/2.0.x' ] );
         $httpBackend.whenGET( 'http://localhost:8007/api/repositories/3/releases/3.0.x' ).respond( 200, releases[ '/repositories/3/releases/3.0.x' ] );

         $httpBackend.whenGET( 'http://localhost:8007/api/repositories/4/releases/master' ).respond( 200, releases[ '/repositories/4/releases/master' ] );
         $httpBackend.whenGET( 'http://localhost:8007/api/repositories/4/releases/master-1.x' ).respond( 200, releases[ '/repositories/4/releases/master-1.x' ] );
         $httpBackend.whenGET( 'http://localhost:8007/api/repositories/4/releases/2.0.x' ).respond( 200, releases[ '/repositories/4/releases/2.0.x' ] );
         $httpBackend.whenGET( 'http://localhost:8007/api/repositories/4/releases/1.0.x' ).respond( 200, releases[ '/repositories/4/releases/1.0.x' ] );
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
            expect( widgetEventBus.publish )
               .toHaveBeenCalledWith( 'didReplace.categories', {
                  resource: 'categories',
                  data: jasmine.any( Object )
               } );
         } );

      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      describe( 'with feature "repository"', function() {

         it( 'subscribes to takeActionRequest event', function() {
            $httpBackend.flush();
            expect( axMocks.widget.$scope.eventBus.subscribe )
               .toHaveBeenCalledWith( 'takeActionRequest.getRepository', jasmine.any( Function ) );
         } );

      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      describe( 'with feature "getAll"', function() {

         it( 'subscribes to takeActionRequest event', function() {
            $httpBackend.flush();
            expect( axMocks.widget.$scope.eventBus.subscribe )
               .toHaveBeenCalledWith( 'takeActionRequest.getAll', jasmine.any( Function ) );
         } );

      } );

      afterEach( axMocks.tearDown );

   } );

} );
