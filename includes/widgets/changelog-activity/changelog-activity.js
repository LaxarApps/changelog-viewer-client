/**
 * Copyright 2015 LaxarJS
 * Released under the MIT license
 * http://www.laxarjs.org
 */
define( [
   'angular',
   'laxar',
   'laxar-patterns',
   'hal_http_client/hal_http_client_angular'
], function( ng, ax, patterns, halHttpClientModule ) {
   'use strict';

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   Controller.$inject = [ '$scope', '$q', '$http', 'halHttpClient' ];

   function Controller( $scope, $q, $http, halHttpClient ) {
      var hal = halHttpClient();
      var LOCATION = $scope.features.server.url;
      $scope.model = {};

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      $scope.eventBus.subscribe( 'beginLifecycleRequest', function( event ) {
         getData()
            .then( function() {
               $scope.eventBus.publish( 'didReplace.' + $scope.features.categories.resource, {
                  resource: $scope.features.categories.resource,
                  data: $scope.model.categories
               } );
            } );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      $scope.eventBus.subscribe( 'takeActionRequest.' + $scope.features.releases.action, function( event ) {
         if( event.repository.href ) {
            $scope.eventBus.publish( 'willTakeAction.' + $scope.features.releases.action, {
               action: $scope.features.releases.action
            } );

            getReleases( event.repository.href )
               .then( function() {
                  $scope.eventBus.publish( 'didTakeAction.' + $scope.features.releases.action, {
                     action: $scope.features.releases.action
                  } );
               } );
         }
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function getReleases( href ) {
         return hal.get( LOCATION + href )
            .on( {
               '200': function( response ) {
                  if( Array.isArray( response.data._links.release ) ) {
                     return response.data._links.release.map( function( release ) {
                        return {
                           href: release.href,
                           title: release.title
                        };
                     } );
                  }
                  else if( response.data._links.release ) {
                     return [ {
                        href: response.data._links.release.href,
                        title: response.data._links.release.title
                     } ];
                  }
                  else {
                     return false;
                  }
               },
               'xxx': function() {
                  return false;
               }
            } )
            .then( function( releases ) {
               if( !releases ) { return; }
               var categories = ax.object.deepClone( $scope.model.categories );

               categories.forEach( function( category, categoryId ) {
                  category.repositories.forEach( function( repository, index ) {
                     if( repository.releases.href === href ) {
                        categories[ categoryId ].repositories[ index ].releases.data = [];
                        releases.forEach( function( release ) {
                           categories[ categoryId ].repositories[ index ].releases.data.push(
                              {
                                 title: release.title,
                                 href: release.href
                              }
                           );
                        } );
                     }
                  } );

               } );
               var patch = patterns.json.createPatch( $scope.model.categories, categories );
               patterns.json.applyPatch( $scope.model.categories, patch );
               $scope.eventBus.publish( 'didUpdate.' + $scope.features.categories.resource, {
                  resource: $scope.features.categories.resource,
                  patches: patch
               } );
            } );
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      $scope.eventBus.subscribe( 'takeActionRequest.' + $scope.features.changelog.action, function( event ) {
         if( event.release.href ) {
            $scope.eventBus.publish( 'willTakeAction.' + $scope.features.changelog.action, {
               action: $scope.features.changelog.action
            } );
            var categories = ax.object.deepClone( $scope.model.categories );
            var release = findRelease( categories, event.release.href);

            getChangelog( release.href ).then( function( changelog ) {
               if( changelog ) {
                  categories[ release.categoryIndex ].
                     repositories[ release.repositoryIndex ].
                     releases.data[ release.releaseIndex ].changelog = changelog;

                  var patch = patterns.json.createPatch( $scope.model.categories, categories );
                  patterns.json.applyPatch( $scope.model.categories, patch );
                  $scope.eventBus.publish( 'didUpdate.' + $scope.features.categories.resource, {
                     resource: $scope.features.categories.resource,
                     patches: patch
                  } );
               }
            } ).then( function() {
               $scope.eventBus.publish( 'didTakeAction.' + $scope.features.changelog.action, {
                  action: $scope.features.changelog.action
               } );
            } );
         }
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function findRelease( categories, href) {
         var result = {};
         categories.forEach( function( category, categoryIndex ) {
            category.repositories.forEach( function( repository, repositoryIndex ) {
               if( repository.releases.data ) {
                  repository.data = repository.releases.data.forEach( function( release, releaseIndex ) {
                     if( release.href === href ) {
                        result.categoryIndex = categoryIndex;
                        result.repositoryIndex = repositoryIndex;
                        result.releaseIndex = releaseIndex;
                        result.href = release.href;
                     }
                  } );
               }
            } );
         } );
         return result;
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function getChangelog( href ) {
         return hal.get( LOCATION + href )
            .on( {
               '200': function( response ) {
                  return response.data.changelog;
               },
               'xxx': function( response ) {
                  return false;
               }
            } );
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function getData() {
         var relations = {
            CATEGORIES: 'categories',
            CATEGORY: 'category',
            REPOSITORIES: 'repositories',
            REPOSITORY: 'repository'
         };

         $scope.model.categories = [];

         return hal.get( LOCATION )
            .on( {
               '200': hal.thenFollow( relations.CATEGORIES )
            } )
            .on( {
               '200': function( response ) {
                  return {
                     categories: response.data
                  };
               }
            } )
            .then( function( halRepresentations ) {
               return hal.followAll( halRepresentations.categories, relations.CATEGORY )
                  .on( {
                     'xxx': function( responses ) {
                        halRepresentations.category = responses.filter( function( response ) {
                           return response.status === 200;
                        } );
                        return halRepresentations;
                     }
                  } );
            } )
            .then( function( halRepresentations ) {
               halRepresentations.repositories = {};
               var promises = [];
               halRepresentations.category.forEach( function( category ) {
                  promises.push( getRepositories( category.data ) );
               } );

               return $q.all( promises ).then( function() {
                  return halRepresentations;
               } );

               ///////////////////////////////////////////////////////////////////////////////////////////////

               function getRepositories( halRepresentation ) {
                  return hal.follow( halRepresentation, relations.REPOSITORIES )
                     .on( {
                        '200': function( responseRepositories ) {
                           halRepresentations.repositories[ halRepresentation.id ] = responseRepositories.data;
                        }
                     } );
               }
            } )
            .then( function( halRepresentations ) {

               halRepresentations.repository = {};
               var promises = [];
               halRepresentations.category.forEach( function( category ) {
                  promises.push( getRepository( category.data.id, halRepresentations.repositories[ category.data.id ] ) );

               } );

               return $q.all( promises ).then( function( repositories ) {
                  return {
                     representations: halRepresentations,
                     repositories: repositories
                  };
               } );

               ///////////////////////////////////////////////////////////////////////////////////////////////

               function getRepository( categoryId, halRepresentation ) {
                  return hal.followAll( halRepresentation, relations.REPOSITORY )
                     .on( {
                        'xxx': function( responses ) {
                           var repositories = {};
                           if( Array.isArray( responses ) ) {
                              var successResponses = responses.filter( function( response ) {
                                 return response.status === 200;
                              } );
                              repositories[ categoryId ] = successResponses;
                              return repositories;
                           }
                           else if( responses.status === 200 ) {
                              repositories[ categoryId ] = [ responses ];
                              return repositories;
                           }
                           else {
                              repositories[ categoryId ] = [ responses ];
                              return repositories;
                           }
                        }
                     } );
               }
            } )
            .then( function( data ) {
               createModel( data );
            } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         function createModel( data ) {
            $scope.model.categories = data.representations.category.map( function( category ) {
               var repositories = [];
               data.repositories.forEach( function( repositoryObject ) {
                  if( repositoryObject[ category.data.id ] ) {
                     repositoryObject[ category.data.id ].forEach( function( repository ) {
                        if( repository.data ) {
                           repositories.push(
                              {
                                 releases: {
                                    href: repository.data._links.releases.href
                                 },
                                 title: repository.data.title,
                                 pushedAt: repository.data.pushedAt
                              }
                           );
                        }
                     } );
                  }
               } );
               return {
                  title: category.data.title,
                  repositories: repositories
               };
            } );
         }
      }
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   return ng.module( 'changelogActivity', [ halHttpClientModule.name ] ).controller( 'ChangelogActivityController', Controller );

} );
