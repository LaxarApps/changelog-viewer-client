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

      model.initialized = false;

      model.visibleMap = {
         categories: {},
         repositories: {},
         releases: {},
         category: {}
      };
      model.categories = [];
      model.requestedDataMap = {
         repositories: {}
      };
      var requestedAll = false;
      model.requestingAll = false;
      var initialState = true;

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      patterns.resources.handlerFor( $scope )
         .registerResourceFromFeature( 'categories', {
            onReplace: deleteMap,
            onUpdateReplace: createModel
         } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      $scope.expandAll = function( expand) {
         if( expand === false ) {
            showChangelogs( false );
            return;
         }
         if( !requestedAll ) {
            model.requestingAll = true;
            $scope.eventBus.publish( 'takeActionRequest.' + $scope.features.expandAll.action, {
               action: $scope.features.expandAll.action
            } );
            $scope.eventBus.subscribe( 'didTakeAction.' + $scope.features.expandAll.action, function(){
               showChangelogs( true );
               requestedAll = true;
               model.requestingAll = false;
            } );
         }
         else {
             showChangelogs( true );
         }
      };

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function showChangelogs( expand ) {
         model.categories.forEach( function( category, categoryIndex ) {
            category.groups.forEach( function( group, groupIndex ) {
               model.visibleMap.category[ categoryIndex ].groups[ groupIndex ] = expand;
               group.repositories.forEach( function( repository ) {
                  model.visibleMap.repositories[ repository._links.self.href ] = expand;
                  if( expand ) {
                     model.requestedDataMap.repositories[ repository._links.self.href ] = true;
                  }
                  if( Array.isArray( repository.releases ) ) {
                     repository.releases.forEach( function( release ) {
                        model.visibleMap.releases[release._links.self.href] = expand;
                     } );
                  }
               } );
            } );
         } );
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      $scope.showCategory = function( categoryIndex ) {
         model.visibleMap.categories[ categoryIndex ]  = !model.visibleMap.categories[ categoryIndex ];
      };

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      $scope.showGroup = function( categoryIndex, groupIndex ) {
         model.visibleMap.category[ categoryIndex ].groups[ groupIndex ] = !model.visibleMap.category[ categoryIndex].groups[ groupIndex ];
      };

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      $scope.showRepository = function( repository ) {
         var href = repository._links.self.href;
         model.visibleMap.repositories[ href ] = !model.visibleMap.repositories[ href  ];
         if( model.requestedDataMap.repositories[ href ] === undefined ) {
            model.requestedDataMap.repositories[ href ] = false;
         }
         if( model.visibleMap.repositories[ href  ] && !model.requestedDataMap.repositories[ href ] ) {
            $scope.eventBus.publish( 'takeActionRequest.' + $scope.features.repository.action, {
               action: $scope.features.repository.action,
               repository: repository
            } );
            $scope.eventBus.subscribe( 'didTakeAction.' + $scope.features.repository.action, function(){
               model.requestedDataMap.repositories[ href ] = true;
            } );
         }
      };

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      $scope.changelog = function( href ) {
         model.visibleMap.releases[ href ] = !model.visibleMap.releases[ href ];
      };

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function deleteMap() {
         model.initialized = true;
         model.visibleMap = {
            categories: {},
            category: {},
            repositories: {},
            releases: {}
         };
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function createModel() {
         model.categories = ax.object.deepClone( $scope.resources.categories );
         model.categories.forEach( function( category, index ) {
            var groups = [];
            if( initialState ) {
               model.visibleMap.categories[ index ] = true;
               model.visibleMap.category[ index ] = { groups: [] };
            }

            category.groups.forEach( function( group, groupIndex ) {
               //model.visibleMap.category[ index ][ groupIndex ] = false;
               group.repositories = group.repositories.map( function( repository ) {
                  repository.title = trimTitle( repository.title );
                  if( repository.releases ) {
                     repository.releases = repository.releases.sort( sortByVersion );
                     repository.lastVersion = getLastVersion( repository.releases[0] );

                     repository.releases = repository.releases.filter( function( release ) {
                        return typeof release === 'object' && release.changelog;
                     } ).map( function( release ) {
                        release.changelog = filterChapter( release );
                        release.changelog = markdownToHtml( release.changelog );
                        return release;
                     } );
                  }
                  return repository;
               } );
            } );
         } );
         initialState = false;
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
