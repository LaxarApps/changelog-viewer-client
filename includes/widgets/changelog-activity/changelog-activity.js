/**
 * Copyright 2015 aixigo AG
 * Released under the MIT license.
 * http://laxarjs.org/license
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

      $scope.eventBus.subscribe( 'takeActionRequest.' + $scope.features.changelog.action, function( event ) {
         if( event.repository.href ) {
            $scope.eventBus.publish( 'willTakeAction.' + $scope.features.changelog.action, {
               action: $scope.features.changelog.action
            } );
            var categories = ax.object.deepClone( $scope.model.categories );
            var promises = [];

            categories.forEach( function( category ) {
               category.repositories.forEach( function( repository ) {
                  if( repository.releases ) {
                     if( event.repository.href === repository.href._links.releases.href ) {
                        repository.releases.forEach( function( release ) {
                           promises.push( getChangelog( release.href ) );
                        } );
                     }
                  }
               } );
            } );

            $q.all( promises ).then( function( responses ) {
               responses.forEach( function( response, responseIndex ) {
                  categories.forEach( function( category, categoryIndex ) {
                     category.repositories.forEach( function( repository, repositoryIndex ) {
                        if( repository.releases ) {
                           if(  event.repository.href === repository.href._links.releases.href ) {
                              repository.releases[ responseIndex].changelog = response.changelog;
                              // ToDo: Fixing bug in service
                              //repository.releases.forEach( function( release, releaseIndex ) {
                              //   if( release.href ===  response.href ) {
                              //      release.changelog = response.changelog;
                              //   }
                              //
                              //} );
                           }
                        }
                     } );
                  } );
               } );
               var patch = patterns.json.createPatch( $scope.model.categories, categories );
                  patterns.json.applyPatch( $scope.model.categories, patch );
               if( patch.length > 0 ) {
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

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         function getChangelog( href ) {
            return hal.get( LOCATION + href )
               .on( {
                  '200': function( response ) {
                     return {
                        href: response.data._links.self.href,
                        changelog: response.data.changelog
                     };
                  },
                  'xxx': function( response ) {
                     return false;
                  }
               } );
         }
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function getData() {
         var relations = {
            CATEGORIES: 'categories',
            CATEGORY: 'category',
            REPOSITORIES: 'repositories',
            REPOSITORY: 'repository',
            RELEASES: 'releases'
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
            .then( getCategory )
            .then( getAllRepositories )
            .then( getAllReleases ) //repository
            .then( createModel );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         function getCategory( halRepresentations ) {
            return hal.followAll( halRepresentations.categories, relations.CATEGORY )
               .on( {
                  'xxx': function( responses ) {
                     halRepresentations.category = responses.filter( function( response ) {
                        return response.status === 200;
                     } ).map( function( response ) {
                        return response.data;
                     } );
                     return halRepresentations;
                  }
               } );
         }

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         function getAllRepositories( halRepresentations ) {
            halRepresentations.repositories = {};
            var promises = [];
            halRepresentations.category.forEach( function( category ) {
               promises.push( getRepositories( category ) );
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
         }

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         function getAllReleases( halRepresentations ) {
            var promises = halRepresentations.category.map( function( category ) {
               return getRepository( category.id, halRepresentations.repositories[category.id] )
                  .then( getReleases )
                  .then( function( releases ) {
                     return {
                        category: category,
                        releases: releases
                     };
                  } );
            } );
            halRepresentations.releases = {};
            return $q.all( promises ).then( function( releases ) {
               releases.forEach( function( release ) {
                  halRepresentations.releases[release.category.id] = release.releases;
               } );
               return halRepresentations;
            } );

            //////////////////////////////////////////////////////////////////////////////////////////////////

            function getRepository( categoryId, halRepresentation ) {
               return hal.followAll( halRepresentation, relations.REPOSITORY )
                  .on( {
                     'xxx': function( responses ) {
                        var data_ = {
                           id: categoryId,
                           repositories: []
                        };
                        if( Array.isArray( responses ) ) {
                           var successResponses = responses.filter( function( response ) {
                              return response.status === 200;
                           } );
                           data_.repositories = successResponses;
                           return data_;
                        }
                        else if( responses.status === 200 ) {
                           data_.repositories = [responses];
                           return data_;
                        }
                        else {
                           data_.repositories = [responses];
                           return data_;
                        }
                     }
                  } );
            }

            //////////////////////////////////////////////////////////////////////////////////////////////////

            function getReleases( data ) {
               var promises = [];
               data.repositories.forEach( function( repository ) {
                  if( repository.data ) {
                     promises.push( hal.follow( repository.data, relations.RELEASES ).on( {
                        '500': function( error ) {
                           ax.log.error( error.statusText + ': ' + error.config.url );
                        },
                        'xxx': function( response ) {
                           return {data: response, repository: repository.data};
                        }
                     } ) );
                  }
               } );
               if( promises.length === 0 ) { return []; }

               return $q.all( promises ).then( function( responses ) {
                  return responses.filter( function( response ) {
                     return typeof( response ) !== 'undefined';
                  } ).map( function( response ) {
                     if( response ) {
                        return {
                           id: data.id,
                           repository: response.repository,
                           releases: response.data.data
                        };
                     }
                  } );
               } );
            }
         }

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         function createModel( data ) {
            $scope.model.categories = data.category.map( function( category ) {
               var repositories = [];
               data.releases[category.id].forEach( function( repository ) {
                  var releases = [];
                  if( Array.isArray( repository.releases._links.release ) ) {
                     releases = repository.releases._links.release;
                  }
                  else if( repository.releases._links.release ) {
                     releases.push( repository.releases._links.release );
                  }
                  else {
                     releases = null;
                  }
                  repositories.push( {
                     releases: releases,
                     title: repository.repository.title,
                     pushedAt: repository.repository.pushedAt,
                     href: { _links: repository.repository._links }
                  } );
               } );
               return {
                  title: category.title,
                  repositories: repositories
               };
            } );
         }
      }
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   return ng.module( 'changelogActivity', [ halHttpClientModule.name ] ).controller( 'ChangelogActivityController', Controller );

} );
