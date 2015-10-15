/**
 * Copyright 2015 LaxarJS
 * Released under the MIT license
 * http://www.laxarjs.org
 */
define( [
   'angular',
   'laxar',
   'laxar-patterns',
   'marked/lib/marked'
], function( ng, ax, patterns, marked ) {
   'use strict';

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   Controller.$inject = [ '$scope', '$sce' ];

   function Controller( $scope, $sce ) {
      var defaultRenderer = new marked.Renderer();
      $scope.model = {};
      $scope.resources = {};
      var model = $scope.model;

      model.visibleMap = {
         categories: {},
         repositories: {},
         releases: {}
      };
      model.requestedDataMap = {
         repositories: {},
         releases: {}
      };

      patterns.resources.handlerFor( $scope )
            .registerResourceFromFeature( 'categories', {
               onReplace: deleteMap,
               onUpdateReplace: createModel
            } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      $scope.showCategory = function( categoryIndex ) {
         model.visibleMap.categories[ categoryIndex ]  = !model.visibleMap.categories[ categoryIndex ];
      };

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      $scope.expand = function( href ) {
         model.visibleMap.repositories[ href ] = !model.visibleMap.repositories[ href ];
         if( model.visibleMap.repositories[ href ] && !model.requestedDataMap.repositories[ href ] ) {
            $scope.eventBus.publish( 'takeActionRequest.' + $scope.features.releases.action, {
               action: $scope.features.releases.action,
               repository: { href: href }
            } );
            model.requestedDataMap.repositories[ href ] = true;
         }
      };

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      $scope.changelog = function( href ) {
         model.visibleMap.releases[ href ] = !model.visibleMap.releases[ href ];
         if( model.visibleMap.releases[ href ] && !model.requestedDataMap.releases[ href ] ) {
            $scope.eventBus.publish( 'takeActionRequest.' + $scope.features.changelog.action, {
               action: $scope.features.changelog.action,
               release: { href: href }
            } );
            model.requestedDataMap.releases[ href ] = true;
         }
      };

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function deleteMap() {
         model.visibleMap = {
            categories: {},
            repositories: {},
            releases: {}
         };
         model.requestedDataMap = {
            repositories: {},
            releases: {}
         };
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function createModel() {
         model.categories = ax.object.deepClone( $scope.resources.categories );
         model.categories.forEach( function( category ) {
            category.repositories.forEach( function( repository ) {
               if( Array.isArray( repository.releases.data ) ) {
                  repository.releases.data.forEach( function( release ) {
                     if( release.changelog ) {
                        release.changelog = markdownToHtml( release.changelog );
                     }
                  } );
               }
            } );
         } );
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function markdownToHtml( mdText ) {
         return $sce.trustAsHtml( marked( mdText, {
            renderer: defaultRenderer,
            sanitize: true,
            headerPrefix: $scope.id( '' )
         } ) );
      }
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   return ng.module( 'changelogWidget', [] ).controller( 'ChangelogWidgetController', Controller );

} );
