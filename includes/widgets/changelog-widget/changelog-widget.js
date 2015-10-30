/**
 * Copyright 2015 aixigo AG
 * Released under the MIT license.
 * http://laxarjs.org/license
 */
define( [
   'angular',
   'laxar',
   'laxar-patterns',
   'marked/lib/marked',
   'semver'
], function( ng, ax, patterns, marked, semver ) {
   'use strict';

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   Controller.$inject = [ '$scope', '$sce' ];

   function Controller( $scope, $sce ) {
      var defaultRenderer = new marked.Renderer();
      var renderer = new marked.Renderer();
      renderer.link = renderLink;

      $scope.model = {};
      $scope.resources = {};
      var model = $scope.model;

      model.requestChangelogs = {};

      model.visibleMap = {
         categories: {},
         repositories: {},
         releases: {}
      };
      model.requestedDataMap = {
         repositories: {}
      };

      patterns.resources.handlerFor( $scope )
            .registerResourceFromFeature( 'categories', {
               onReplace: deleteMap,
               onUpdateReplace: createModel
            } );

      $scope.eventBus.subscribe( 'didTakeAction.' + $scope.features.changelog.action, function( event ) {
         model.requestChangelogs[ event.repository.href ] = false;
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      $scope.showCategory = function( categoryIndex ) {
         model.visibleMap.categories[ categoryIndex ]  = !model.visibleMap.categories[ categoryIndex ];
      };
      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      $scope.showRepository = function( href ) {
         model.visibleMap.repositories[ href ] = !model.visibleMap.repositories[ href ];
         if( model.visibleMap.repositories[ href ] && !model.requestedDataMap.repositories[ href ] ) {
            model.requestChangelogs[ href ] = true;
            $scope.eventBus.publish( 'takeActionRequest.' + $scope.features.changelog.action, {
               action: $scope.features.changelog.action,
               repository: { href: href }
            } );
            model.requestedDataMap.repositories[ href ] = true;
         }
      };

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      $scope.changelog = function( href ) {
         model.visibleMap.releases[ href ] = !model.visibleMap.releases[ href ];
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
               if( Array.isArray( repository.releases ) ) {
                  repository.releases = repository.releases.sort( sortByVersion );
                  repository.lastVersion = getLastVersion( repository.releases[ 0 ] );
                  if( Array.isArray( repository.releases ) ) {
                     repository.releases.forEach( function( release ) {
                        if( !release ) { return; }
                        if( release.changelog ) {
                           release.changelog = filterChapter( release );
                           release.changelog = markdownToHtml( release.changelog );
                        }
                     } );
                  }
               }
            } );
         } );
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function sortByVersion( a, b) {
         var firstVersion = a.title.substr( 0, a.title.length - 1) + '0';
         var secondVersion = b.title.substr( 0, b.title.length - 1) + '0';
         return semver.compare( firstVersion, secondVersion ) * (-1);
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function getLastVersion( release ) {
         if( !release ) { return; }
         return release.title;
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function filterChapter( release ) {
         if( !testTitle( release.title ) ) {
            return release.changelog;
         }
         var validVersion = release.title.substr( 0, release.title.length - 1) + '0';
         var majorVersion = semver.major( validVersion );
         var minorVersion = semver.minor( validVersion );
         var versionHeadline = new RegExp( '##\\sv' + majorVersion + '.' + minorVersion );

         var changelog = release.changelog;
         var startPosition = changelog.search( versionHeadline );

         if( startPosition === -1 ) {
            return changelog;
         }
         var endPosition = determineEndposition( majorVersion, minorVersion, changelog );
         return changelog.substr( startPosition, endPosition - startPosition);
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function testTitle( title ) {
         var expectedTitleFormat = /\d+\.\d+\.[x]/;
         return expectedTitleFormat.test( title );
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////


      function determineEndposition( majorVersion, minorVersion, changelog ) {
         var previousVersionHeadline;
         var minor = minorVersion - 1;
         if( minor === -1 ) {
            var major = majorVersion - 1;
            previousVersionHeadline = new RegExp( '##\\sv' + major + '.' + '\\d+' );
         }
         else {
            previousVersionHeadline = new RegExp( '##\\sv' + majorVersion + '.' + minor );
         }
         var endPosition = changelog.search( previousVersionHeadline );
         if( endPosition === -1 ) {
            return changelog.length;
         }
         return endPosition;
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function markdownToHtml( mdText ) {
         return $sce.trustAsHtml( marked( mdText, {
            renderer: renderer,
            sanitize: true,
            headerPrefix: $scope.id( '' )
         } ) );
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function renderLink( href, title, text ) {
         var html = '<a href="' + href + '"';
         if( title ) {
            html += ' title="' + title + '"';
         }
         html += 'target="_blank">' + text + '</a>';
         return html;
      }
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   return ng.module( 'changelogWidget', [] ).controller( 'ChangelogWidgetController', Controller );

} );
