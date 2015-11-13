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
      $scope.model = {
         categories: []
      };
      var relations = {
         CATEGORIES: 'categories',
         CATEGORY: 'category',
         REPOSITORIES: 'repositories',
         REPOSITORY: 'repository',
         RELEASES: 'releases'
      };

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      $scope.eventBus.subscribe( 'beginLifecycleRequest', function( event ) {
         getCategories()
            .then( getCategory )
            .then( getAllRepositories )
            .then( getAllReleases )
            .then( getAllChangelogs )
            .then( createModelAndPublishResource );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function getCategories() {
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
            } );
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

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

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

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

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

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
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

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

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function getAllChangelogs( data ) {
         var categories = ax.object.deepClone( $scope.model.categories );
         var promises = [];

         data.category.forEach( function( category ) {
            data.releases[ category.id ].forEach( function( repository ) {
               if( !( ( repository.releases || {} )._links || {} ).release ){
                  return;
               }
               if( Array.isArray( repository.releases._links.release ) ) {
                  repository.releases._links.release.forEach( function( release ) {
                     promises.push( getChangelog( release.href ) );
                  } );
               }
               else {
                  promises.push( getChangelog( repository.releases._links.release.href ) );
               }
            } );
         } );

         return $q.all( promises ).then( function( responses ) {
            data.changelogs = {};
            responses.forEach( function( response ) {
               var href = response.href;
               data.changelogs[ href ] = response.changelog;
            } );
            return data;
         } );

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
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function createModelAndPublishResource( data ){
         var categories = createModel( data );
         publishResource( categories );

         $scope.model.categories = ax.object.deepClone( categories );
         return data;
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function createModel( data ) {
         return data.category.map( function( category ) {
            var repositories = [];
            if( data.releases ) {
               data.releases[ category.id ].forEach( function( repository ) {
                  var releases = [];
                  if( Array.isArray( repository.releases._links.release ) ) {
                     releases = repository.releases._links.release;
                  }
                  else if( repository.releases._links.release ) {
                     releases.push( repository.releases._links.release );
                  }
                  else {
                     return;
                  }
                  if( data.changelogs ) {
                     releases = releases.map( function( release ) {
                        release.changelog = data.changelogs[ release.href ];
                        return release;
                     } );
                  }
                  repositories.push( {
                     releases: releases,
                     title: repository.repository.title,
                     pushedAt: repository.repository.pushedAt,
                     href: {_links: repository.repository._links}
                  } );
               } );
            }
            return {
               title: category.title,
               repositories: repositories
            };
         } );
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function publishResource( categories ) {
         $scope.eventBus.publish( 'didReplace.' + $scope.features.categories.resource, {
            resource: $scope.features.categories.resource,
            data: categories
         } );
      }

   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   return ng.module( 'changelogActivity', [ halHttpClientModule.name ] )
      .controller( 'ChangelogActivityController', Controller );

} );
