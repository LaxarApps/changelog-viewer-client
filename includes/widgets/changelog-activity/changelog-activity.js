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
         RELEASES: 'releases',
         RELEASE: 'release'
      };
      var replaceResource = false;

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      $scope.eventBus.subscribe( 'beginLifecycleRequest', function( event ) {
         getCategories()
            .then( getEachCategory )
            .then( getAllRepositories )
            .then( getRepository )
            .then( createModelAndPublishResource );
      } );

      $scope.eventBus.subscribe( 'takeActionRequest.' + $scope.features.changelog.action, function( event ) {
         if( ( ( event.repository || {} )._links || {} ).releases ) {
            $scope.eventBus.publish( 'willTakeAction.' + $scope.features.changelog.action, {
               action: $scope.features.changelog.action,
               repository: event.repository
            } );
            getReleases( event.repository )
               .then( getAllChangelogs )
               .then( expandModelAndUpdateResource )
               .then( function() {
                  $scope.eventBus.publish( 'didTakeAction.' + $scope.features.changelog.action, {
                     action: $scope.features.changelog.action,
                     repository: event.repository
                  } );
               } );
         }
      } );
      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function getCategories() {
         replaceResource = true;
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

      function getEachCategory( halRepresentations ) {
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
                        halRepresentations.repositories[halRepresentation.id] = responseRepositories.data;
                  }
               } );
         }
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function getRepository( halRepresentations ) {
         var promises = halRepresentations.category.map( function( category ) {
            return getOneRepository( category.id, halRepresentations.repositories[category.id] );
         } );
         halRepresentations.releases = {};
         return $q.all( promises ).then( function( response ) {
            halRepresentations.repository = response;
            return halRepresentations;
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         function getOneRepository( categoryId, halRepresentation ) {
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

      function getReleases( repository ) {
         return hal.follow( repository, relations.RELEASES ).on( {
            '500': function( error ) {
               ax.log.error( error.statusText + ': ' + error.config.url );
            },
            'xxx': function( response ) {
               if( ( response.data._links || {} ).release ) {
                  return {
                     repository: repository,
                     //releases: response.data._links.release,
                     halRepresentation: response.data
                  };
               }
            }
         } );
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function expandModelAndUpdateResource( data ) {
         if( !data ) { return; }
         var categories = ax.object.deepClone( $scope.model.categories );
         categories.forEach( function( category ) {
            category.repositories.forEach( function( repository ) {
               if( data.repository._links.self.href === repository._links.self.href ) {
                  repository.releases = data.releases.filter( function( release ) {
                     return release.status === 200;
                  } ).map( function( release ) {
                     return release.data;
                  } );
               }
            } );
         } );
         updateResource( categories );
         $scope.model.categories = ax.object.deepClone( categories );
         return true;
      }

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

         /////////////////////////////////////////////////////////////////////////////////////////////////////

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

      function getReleasesx( data ) {
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
         if( !data ) { return; }
         return hal.followAll( data.halRepresentation, relations.RELEASE )
            .on( {
               'xxx': function( responses ) {
                  var data_ = data;
                  if( Array.isArray( responses ) ) {
                     var successResponses = responses.filter( function( response ) {
                        return response.status === 200;
                     } );
                     data_.releases = successResponses;
                     return data_;
                  }
                  else if( responses.status === 200 ) {
                     data_.releases = [responses];
                     return data_;
                  }
                  else {
                     data_.repositories = [responses];
                     return data_;
                  }
               }
            } );

         //var categories = ax.object.deepClone( $scope.model.categories );
         //var promises = [];
         //
         //data.category.forEach( function( category ) {
         //   data.releases[ category.id ].forEach( function( repository ) {
         //      if( !( ( repository.releases || {} )._links || {} ).release ){
         //         return;
         //      }
         //      if( Array.isArray( repository.releases._links.release ) ) {
         //         repository.releases._links.release.forEach( function( release ) {
         //            promises.push( getChangelog( release.href ) );
         //         } );
         //      }
         //      else {
         //         promises.push( getChangelog( repository.releases._links.release.href ) );
         //      }
         //   } );
         //} );
         //
         //return $q.all( promises ).then( function( responses ) {
         //   data.changelogs = {};
         //   responses.forEach( function( response ) {
         //
         //      var href = response.href;
         //
         //
         //      data.changelogs[ href ] = response.changelog;
         //   } );
         //   return data;
         //} );
         //
         ///////////////////////////////////////////////////////////////////////////////////////////////////////
         //
         //function getChangelog( href ) {
         //   return hal.get( LOCATION + href )
         //      .on( {
         //         '200': function( response ) {
         //            return {
         //               href: response.data._links.self.href,
         //               changelog: response.data.changelog
         //            };
         //         },
         //         'xxx': function( response ) {
         //            return false;
         //         }
         //      } );
         //}
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function createModelAndPublishResource( data ){
         var categories = createModel( data );
         if( replaceResource ) {
            publishResource( categories );
         }
         else {
            updateResource( categories );
         }
         $scope.model.categories = ax.object.deepClone( categories );
         return data; //Todo unnecessary?
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function createModel( data ) {
         return data.category.filter( function( category ) {
               return data.repositories[ category.id ]._links.repository;
            } ).map( function( category ) {
               var repositories = [];
               data.repository.forEach( function( repository ) {
                  if( repository.id === category.id ) {
                     repositories = repository.repositories.map( function( singleRepository ) {
                        return singleRepository.data;
                     } );
                  }
               } );
               //if( data.releases ) {
               //   data.releases[ category.id ].forEach( function( repository ) {
               //      var releases = [];
               //      if( Array.isArray( repository.releases._links.release ) ) {
               //         releases = repository.releases._links.release;
               //      }
               //      else if( repository.releases._links.release ) {
               //         releases.push( repository.releases._links.release );
               //      }
               //      else {
               //         return;
               //      }
               //      if( data.changelogs ) {
               //         releases = releases.map( function( release ) {
               //            release.changelog = data.changelogs[ release.href ];
               //            return release;
               //         } );
               //      }
               //      repositories.push( {
               //         releases: releases,
               //         title: repository.repository.title,
               //         pushedAt: repository.repository.pushedAt,
               //         href: {_links: repository.repository._links}
               //      } );
               //   } );
               //}
               //else {
               //   if( Array.isArray( data.repositories[ category.id ]._links.repository ) ) {
               //      repositories =
               //      data.repositories[ category.id ]._links.repository.map( function( repository ) {
               //         repository.title = repository.href;
               //         return repository;
               //      } );
               //   }
               //}

               return {
                  title: category.title,
                  repositories: repositories
               };
            } );
         }


      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function createModel_old( data ) {
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
         replaceResource = false;
         $scope.eventBus.publish( 'didReplace.' + $scope.features.categories.resource, {
            resource: $scope.features.categories.resource,
            data: categories
         } );
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function updateResource( categories ) {
         var patch = patterns.json.createPatch( $scope.model.categories, categories );
         if( patch.length > 0 ) {
            $scope.eventBus.publish( 'didUpdate.' + $scope.features.categories.resource, {
               resource: $scope.features.categories.resource,
               patches: patch
            } );
         }
      }
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   return ng.module( 'changelogActivity', [ halHttpClientModule.name ] )
      .controller( 'ChangelogActivityController', Controller );

} );
