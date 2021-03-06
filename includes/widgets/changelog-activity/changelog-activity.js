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

      var order = {
         ALPHABETICAL: 'alphabetical',
         MAP: 'map'
      };

      var relations = {
         COMPONENT_MAP: 'component-map',
         CATEGORIES: 'categories',
         CATEGORY: 'category',
         REPOSITORIES: 'repositories',
         REPOSITORY: 'repository',
         RELEASES: 'releases',
         RELEASE: 'release'
      };
      var replaceResource = false;

      var componentMap = {
         groups: {},
         repositories: {}
      };

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      $scope.eventBus.subscribe( 'beginLifecycleRequest', function( event ) {
         var componentPromise = getComponentMap()
            .then( getCategories )
            .then( getEachCategory )
            .then( getAllRepositories )
            .then( getRepository );
         componentPromise
            .then( createModelAndPublishResource );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function getComponentMap() {
         return hal.get( LOCATION )
            .on( {
               '200': hal.thenFollow( relations.COMPONENT_MAP )
            } )
            .on( {
               '200': function( response ) {
                  createComponentMap( response.data.categories );
               }
            } );
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function createComponentMap( categories ) {
         categories.forEach( function( category ) {
            componentMap.groups[ category.name ] = {};
            category.groups.forEach( function( group, groupIndex ) {
               componentMap.groups[ category.name][ group.name ] = {
                  index: groupIndex,
                  order: group.order
               };
               group.components.forEach( function( component, index ) {
                  var id = component.organization + '/' + component.name;
                  componentMap.repositories[ id ] = {
                     index: index,
                     group: group.name
                  };
               } );
            } );
         } );
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      $scope.eventBus.subscribe( 'takeActionRequest.' + $scope.features.repository.action, function( event ) {
         if( ( ( event.repository || {} )._links || {} ).releases ) {
            $scope.eventBus.publish( 'willTakeAction.' + $scope.features.repository.action, {
               action: $scope.features.repository.action,
               repository: event.repository
            } );
            getReleases( event.repository )
               .then( getAllChangelogs )
               .then( addReleaseToModelAndUpdateResource)
               .then( function() {
                  $scope.eventBus.publish( 'didTakeAction.' + $scope.features.repository.action, {
                     action: $scope.features.repository.action,
                     repository: event.repository
                  } );
               } );
         }
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      $scope.eventBus.subscribe( 'takeActionRequest.' + $scope.features.getAll.action, function( event ) {
         $scope.eventBus.publish( 'willTakeAction.' + $scope.features.getAll.action, {
            action: $scope.features.getAll.action
         } );
         var promises = [];
         $scope.model.categories.forEach( function( category ) {
            category.groups.forEach( function( group ) {
                  group.repositories.forEach( function( repository ) {
                  promises.push( getReleases( repository ).then( getAllChangelogs ) );
               } );
            } );
         } );
         $q.all(promises).then( expandModelAndUpdateResource )
            .then( function() {
               $scope.eventBus.publish( 'didTakeAction.' + $scope.features.getAll.action, {
                  action: $scope.features.getAll.action
               } );
            } );
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
                        halRepresentations.repositories[ halRepresentation.id ] = responseRepositories.data;
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
                        categoryId: categoryId,
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
                     halRepresentation: response.data
                  };
               }
            }
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
                     data_.releases = responses.filter( function( response ) {
                        return response.status === 200;
                     } );
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
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function createModel( data ) {
         return data.category.filter( function( category ) {
            var includeCategory = $scope.features.categories.include.some( function( include ) {
               return include === category.id;
            } );
            return data.repositories[ category.id ]._links.repository && includeCategory;
         } ).map( function( category ) {
            var groups = {};
            var orderMap = {};
            var repositories = [];
            data.repository.forEach( function( repository ) {
               if( repository.categoryId === category.id ) {
                  repositories = repository.repositories.map( function( singleRepository ) {
                     return singleRepository.data;
                  } );
               }
            } );

            repositories.forEach( function( repository ) {
               var componentMapRepository = componentMap.repositories[ repository.organization + '/' + repository.title];
               if( componentMapRepository ) {
                  var groupName = componentMapRepository.group;
                  if( !Array.isArray( groups[ groupName ] ) ) {
                     groups[ groupName ] = [];
                     orderMap[ groupName ] = {};
                  }
                  orderMap[ groupName ][ repository.title ] = componentMapRepository.index;
                  groups[ groupName ].push( repository );

               }
            } );

            var groupsArray = [];
            ax.object.forEach( groups, function( repositories, groupName ) {
               repositories = sortRepositories(
                  repositories,
                  componentMap.groups[ category.title ][ groupName ].order,
                  orderMap[ groupName ]
               );
               groupsArray.push( {
                  name: groupName,
                  repositories: repositories
               } );
            } );

            groupsArray.sort( function( firstGroup, secondGroup ) {
               var firstIndex = componentMap.groups[ category.title ][ firstGroup.name].index;
               var secondIndex = componentMap.groups[ category.title ][ secondGroup.name].index;
               if( firstIndex < secondIndex ) {
                  return -1;
               }
               else if( firstIndex > secondIndex ){
                  return 1;
               }
               return 0;
            } );

            return {
               title: category.title,
               groups: groupsArray
            };
         } );
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function sortRepositories( repositories, orderBy, orderMap ) {
         if( order.ALPHABETICAL === orderBy ) {
            repositories = repositories.sort( function( first, second ) {
               return first.title > second.title ? 1 : -1;
            } );
         }
         else if( order.MAP === orderBy ) {
            repositories = repositories.sort( function( first, second ) {
               return orderMap[ first.title ] - orderMap[ second.title ];
            } );
         }
         return repositories;
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function addReleaseToModelAndUpdateResource( data ) {
         if( !data ) { return; }
         var categories = ax.object.deepClone( $scope.model.categories );
         addReleases( categories, data );
         updateResource( categories );
         $scope.model.categories = ax.object.deepClone( categories );
         return true;
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function expandModelAndUpdateResource( data ) {
         if( !Array.isArray( data ) ) { return; }
         var categories = ax.object.deepClone( $scope.model.categories );
         data.forEach( function( repository ) {
            if( !repository ) { return; }
            addReleases( categories, repository );
         } );
         updateResource( categories );
         $scope.model.categories = ax.object.deepClone( categories );
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function addReleases( categories, data ) {
         categories.forEach( function( category ) {
            category.groups.forEach( function( group ) {
               group.repositories.forEach( function( repository ) {
                  if( data.repository._links.self.href === repository._links.self.href ) {
                     repository.releases = data.releases.filter( function( release ) {
                        return release.status === 200;
                     } ).map( function( release ) {
                        return release.data;
                     } );
                  }
               } );
            } );
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
