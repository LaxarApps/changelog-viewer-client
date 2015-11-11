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
   'semver',
   'iframe-resizer'
], function( ng, ax, patterns, marked, semver ) {
   'use strict';

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   Controller.$inject = [ '$scope', '$sce' ];

   function Controller( $scope, $sce ) {
      var BREAKING_CHANGE = 'BREAKING CHANGE';
      var NEW_FEATURE = 'NEW FEATURE:';

      var defaultRenderer = new marked.Renderer();
      var renderer = new marked.Renderer();
      renderer.link = renderLink;
      renderer.strong = renderStrong;
      renderer.text = renderText;

      $scope.model = {};
      $scope.resources = {};
      var model = $scope.model;

      model.visibleMap = {
         categories: {},
         repositories: {},
         releases: {}
      };
      model.categories = [];

      patterns.resources.handlerFor( $scope )
            .registerResourceFromFeature( 'categories', {
               onReplace: deleteMap,
               onUpdateReplace: createModel
            } );

      $scope.expandAll = function( expand) {
         model.categories.forEach( function( category, categoryIndex ) {
            model.visibleMap.categories[categoryIndex] = expand;
            category.repositories.forEach( function( repository ) {
               model.visibleMap.repositories[repository.href._links.self.href] = expand;
               repository.releases.forEach( function( release ) {
                  model.visibleMap.releases[release.href] = expand;
               } );
            } );
         } );
      };

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      $scope.showCategory = function( categoryIndex ) {
         model.visibleMap.categories[ categoryIndex ]  = !model.visibleMap.categories[ categoryIndex ];
      };
      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      $scope.showRepository = function( href ) {
         model.visibleMap.repositories[ href ] = !model.visibleMap.repositories[ href ];
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
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function createModel() {
         model.categories = ax.object.deepClone( $scope.resources.categories );
         model.categories = model.categories.filter( function( category ) {
            return category && Array.isArray( category.repositories ) && category.repositories.length > 0;
         } );
         model.categories = model.categories.map( function( category ) {

            var repositories = category.repositories.filter( function( repository ) {
                  return  Array.isArray( repository.releases );
               } )
               .map( function( repository ) {
                  repository.releases = repository.releases.sort( sortByVersion );
                  repository.lastVersion = getLastVersion( repository.releases[0] );
                  repository.title = trimTitle( repository.title );

                  repository.releases = repository.releases.filter( function( release ) {
                     return typeof release === 'object' && release.changelog;
                  } ).map( function( release ) {
                     release.changelog = filterChapter( release );
                     release.changelog = markdownToHtml( release.changelog );
                     return release;
                  } );
                  return repository;
               } ).filter( function( repository ) {
                  return repository.releases.length;
               } );

            return {
               title: category.title,
               repositories: repositories
            };
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

      function trimTitle( title ) {
         title = title.split( '/' );
         title = title[ title.length - 1 ];
         title = title.replace( '.git', '' );
         return title;
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

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function renderStrong( text ) {
         if( text.trim().search( BREAKING_CHANGE ) !== -1 ) {
            return '<strong class="changelog-widget-breaking-change">' + text + '</strong>';
         }
         return '<strong>' + text + '</strong>';
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function renderText( text ) {
         if( text.trim().search( NEW_FEATURE ) !== -1 ) {
            var parts = text.split( NEW_FEATURE );
            text = parts.join( '<em class="changelog-widget-new-feature">' + NEW_FEATURE + '</em>' );
         }
         return text;
      }
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   return ng.module( 'changelogWidget', [] ).controller( 'ChangelogWidgetController', Controller );

} );
