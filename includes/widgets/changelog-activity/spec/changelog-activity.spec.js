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
            },
            'changelog': {
               'action': 'getChangelog'
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
                  data: resources[ 0 ]
               } );
         } );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      describe( 'with feature "changelog"', function() {

         it( 'subscribes to the takeActionRequest of the configured "changelog.action"', function() {
            $httpBackend.flush();
            expect( widgetEventBus.subscribe )
               .toHaveBeenCalledWith( 'takeActionRequest.getChangelog', jasmine.any(Function) );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         describe( 'when receiving a takeActionRequest for the changelogs of a repository', function() {

            beforeEach( function() {
               $httpBackend.flush();
               widgetEventBus.publish.calls.reset();
               $httpBackend.whenGET( 'http://localhost:8007/api/repositories/1/releases/2.0.x' ).respond( 200, releases[ '/repositories/1/releases/2.0.x' ] );
               $httpBackend.whenGET( 'http://localhost:8007/api/repositories/1/releases/3.0.x' ).respond( 200, releases[ '/repositories/1/releases/3.0.x' ] );
               $httpBackend.whenGET( 'http://localhost:8007/api/repositories/1/releases/master' ).respond( 200, releases[ '/repositories/1/releases/master' ] );
               $httpBackend.whenGET( 'http://localhost:8007/api/repositories/1/releases/master-2.x' ).respond( 200, releases[ '/repositories/1/releases/master-2.x' ] );
               testEventBus.publish( 'takeActionRequest.getChangelog', {
                  action: 'getChangelog',
                  repository: {
                     href: '/repositories/1/releases'
                  }
               } );
               testEventBus.flush();
               $httpBackend.flush();
            } );

            //////////////////////////////////////////////////////////////////////////////////////////////////

            it( 'gets the list of releases and publishes an update of the "categories" resource ', function() {
               expect( widgetEventBus.publish )
                  .toHaveBeenCalledWith( 'willTakeAction.getChangelog', {
                     action: 'getChangelog'
                  } );
               expect( widgetEventBus.publish )
                  .toHaveBeenCalledWith( 'didUpdate.categories', resources[ 1 ] );
               expect( widgetEventBus.publish )
                  .toHaveBeenCalledWith( 'didTakeAction.getChangelog', {
                     action: 'getChangelog',
                     repository: {
                        href: '/repositories/1/releases'
                     }
                  } );
            } );


         } );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      afterEach( axMocks.tearDown );

   } );

} );
