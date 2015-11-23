/**
 * Copyright 2015 aixigo AG
 * Released under the MIT license.
 * http://laxarjs.org/license
 */
define( [
   'json!../widget.json',
   'laxar-mocks'
], function( descriptor, axMocks ) {
   'use strict';

   describe( 'changelog-widget', function() {

      var widgetDom;

      beforeEach( axMocks.createSetupForWidget( descriptor ) );

      beforeEach( function() {
         axMocks.widget.configure( {
            'categories': {
               'resource': 'categories'
            },
            'repository': {
               'action': 'getRepository'
            }
         } );
      } );

      beforeEach( axMocks.widget.load );

      beforeEach( function() {
         axMocks.triggerStartupEvents();
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      describe( 'with feature "categories"', function() {

         it( 'subscribes to didReplace events of the categories resource', function() {
            expect( axMocks.widget.$scope.eventBus.subscribe )
               .toHaveBeenCalledWith( 'didReplace.categories', jasmine.any( Function ) );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'subscribes to didUpdate events of the categories resource', function() {
            expect( axMocks.widget.$scope.eventBus.subscribe )
               .toHaveBeenCalledWith( 'didUpdate.categories', jasmine.any( Function ) );
         } );

      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      afterEach( axMocks.tearDown );

   } );

} );
