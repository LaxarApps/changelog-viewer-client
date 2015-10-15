/**
 * Copyright 2015 LaxarJS
 * Released under the MIT license
 * http://www.laxarjs.org
 */
define( [
   '../hal_http_client',
   'laxar/laxar_testing',
   'angular-mocks',
   './spec_data'
], function( halHttp, ax, ngMocks, specData ) {
   'use strict';

   describe( 'A hal http client', function() {

      var BASE_URL = 'http://host:1234';
      var halClient;
      var $http;
      var $httpBackend;
      var $injector;
      var $rootScope;
      var data;

      var responseTransformerSpy;
      var onSpy5xxGlobal;
      var onSpy200;
      var onSpy2xx;
      var onSpy404;
      var onSpyXxx;
      var thenResolvedSpy;
      var thenRejectedSpy;

      beforeEach( function() {
         ngMocks.inject( function( _$httpBackend_, _$injector_, _$rootScope_ ) {
            $httpBackend = _$httpBackend_;
            $injector = _$injector_;
            $rootScope = _$rootScope_;
         } );

         responseTransformerSpy = jasmine
            .createSpy( 'responseTransformerSpy' )
            .andCallFake( function( response ) { return response; } );
         onSpy5xxGlobal = jasmine.createSpy( 'onSpy5xxGlobal' );
         $http = jasmine.createSpy( 'httpSpy' ).andCallFake( $injector.get( '$http' ) );
         halClient = halHttp.create( $http, $injector.get( '$q' ), {
            headers: { 'Accept-Language': 'de' },
            on: { '5xx': onSpy5xxGlobal },
            responseTransformer: responseTransformerSpy
         } );
         data = ax.object.deepClone( specData );

         onSpy200 = jasmine.createSpy( 'onSpy200' );
         onSpy2xx = jasmine.createSpy( 'onSpy2xx' );
         onSpy404 = jasmine.createSpy( 'onSpy404' );
         onSpyXxx = jasmine.createSpy( 'onSpyXxx' );
         thenResolvedSpy = jasmine.createSpy( 'thenResolvedSpy' );
         thenRejectedSpy = jasmine.createSpy( 'thenRejectedSpy' );

         addMatchers( this );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      afterEach(function() {
         $httpBackend.verifyNoOutstandingExpectation();
         $httpBackend.verifyNoOutstandingRequest();
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'has a method to remove hal specific properties (ATP-9509)', function() {
         expect( halClient.removeHalKeys( {
            _links: { self: 'xxx' },
            _embedded: { rel: { property: 1 } },
            property: 42,
            car: { color: 'red' }
         } ) ).toEqual( {
            property: 42,
            car: { color: 'red' }
         } );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      describe( 'on successful GET', function() {

         beforeEach( function() {
            $httpBackend.expectGET( BASE_URL + '/resource' ).respond( 200, {
               _links: { self: { href: BASE_URL + '/resource' } },
               value: 123
            }, { etag: 'myEtag' } );

            var promise = halClient.get( BASE_URL + '/resource', {
               headers: {
                  'X-Custom-Header': 'such header'
               }
            } );
            promise.then( thenResolvedSpy, thenRejectedSpy );
            promise.on( {
               '200': onSpy200,
               '2xx': onSpy2xx,
               '404': onSpy404
            } );
            $httpBackend.flush();
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'calls the configured response transformer', function() {
            expect( responseTransformerSpy ).toHaveBeenCalled();
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'resolves the simple promise', function() {
            expect( thenResolvedSpy ).toHaveBeenCalled();
            expect( thenRejectedSpy ).not.toHaveBeenCalled();
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'calls the most specific matching on handler', function() {
            expect( onSpy200 ).toHaveBeenCalled();
            expect( onSpy2xx ).not.toHaveBeenCalled();
            expect( onSpy404 ).not.toHaveBeenCalled();
            expect( onSpy5xxGlobal ).not.toHaveBeenCalled();
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'sends default safe, global and local headers along', function() {
            var callArgs = $http.calls[0].args[0];

            expect( callArgs.headers ).toEqual( {
               'Accept': 'application/hal+json',
               'Accept-Language': 'de',
               'X-Custom-Header': 'such header'
            } );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         describe( 'when getting the same resource again', function() {

            beforeEach( function() {
               thenResolvedSpy.reset();
               $http.reset();
               $httpBackend.expectGET( BASE_URL + '/resource' ).respond( 304 );
               halClient.get( BASE_URL + '/resource' ).then( thenResolvedSpy );
               $httpBackend.flush();
            } );

            //////////////////////////////////////////////////////////////////////////////////////////////////

            it( 'the client sends an if-none-match header with the previous etag', function() {
               expect( $http.calls[0].args[0].headers[ 'If-None-Match' ] ).toEqual( 'myEtag' );
            } );

            //////////////////////////////////////////////////////////////////////////////////////////////////

            it( 'serves the value from cache', function() {
               expect( thenResolvedSpy.calls[0].args[0].data.value ).toEqual( 123 );
            } );

         } );

      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      describe( 'on failed GET with error 404', function() {

         beforeEach( function() {
            $httpBackend.expectGET( BASE_URL + '/resource' ).respond( 404 );
            var promise = halClient.get( BASE_URL + '/resource' );
            promise.then( thenResolvedSpy, thenRejectedSpy );
            promise.on( {
               '200': onSpy200,
               '2xx': onSpy2xx,
               '404': onSpy404
            } );
            $httpBackend.flush();
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'rejects the simple promise', function() {
            expect( thenResolvedSpy ).not.toHaveBeenCalled();
            expect( thenRejectedSpy ).toHaveBeenCalled();
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'calls the most specific matching on handler', function() {
            expect( onSpy200 ).not.toHaveBeenCalled();
            expect( onSpy2xx ).not.toHaveBeenCalled();
            expect( onSpy404 ).toHaveBeenCalled();
            expect( onSpy5xxGlobal ).not.toHaveBeenCalled();
         } );

      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      describe( 'on failed GET with error 500', function() {

         beforeEach( function() {
            $httpBackend.expectGET( BASE_URL + '/resource' ).respond( 500 );
            var promise = halClient.get( BASE_URL + '/resource' );
            promise.then( thenResolvedSpy, thenRejectedSpy );
            promise.on( {
               '200': onSpy200,
               '2xx': onSpy2xx,
               '404': onSpy404
            } );
            $httpBackend.flush();
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'rejects the simple promise', function() {
            expect( thenResolvedSpy ).not.toHaveBeenCalled();
            expect( thenRejectedSpy ).toHaveBeenCalled();
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'calls the most specific matching on handler (in this case the global handler)', function() {
            expect( onSpy200 ).not.toHaveBeenCalled();
            expect( onSpy2xx ).not.toHaveBeenCalled();
            expect( onSpy404 ).not.toHaveBeenCalled();
            expect( onSpy5xxGlobal ).toHaveBeenCalled();
         } );

      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      describe( 'for multiple GETs during the same tick', function() {

         var httpSpy;
         var promise1;
         var promise2;
         var promise3;
         var promise4;
         var promise5;
         var deferred;

         beforeEach( function() {

            var $q = $injector.get( '$q' );
            deferred = $q.defer();
            httpSpy = jasmine.createSpy( '$http' ).andReturn( deferred.promise  );

            halClient = halHttp.create( httpSpy, $q, {
               headers: { 'Accept-Language': 'de' },
               on: { '5xx': onSpy5xxGlobal },
               responseTransformer: responseTransformerSpy
            } );

            promise1 = halClient.get( BASE_URL + '/resource' );
            promise2 = halClient.get( BASE_URL + '/resource' );
            promise3 = halClient.get( BASE_URL + '/resource' );

            promise4 = halClient.get( BASE_URL + '/resource', { headers: { 'If-None-Match': 'abc123' } } );
            promise5 = halClient.get( BASE_URL + '/resource', { headers: { 'If-None-Match': 'abc123' } } );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'returns the promise of the first request when url and headers match (jira ATP-9313)', function() {
            expect( promise1 ).toBe( promise2 );
            expect( promise2 ).toBe( promise3 );

            expect( promise4 ).toBe( promise5 );

            expect( promise1 ).not.toBe( promise4 );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'returns a new promise in the next tick (jira ATP-9313)', function() {
            deferred.resolve( { status: 200, headers: function() {} } );
            $rootScope.$digest();

            expect( promise1 ).not.toBe( halClient.get( BASE_URL + '/resource' ) );
         } );

      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      [ 'PUT', 'POST', 'PATCH', 'DELETE' ].forEach( function( method ) {

         describe( 'on successful ' + method, function() {

            beforeEach( function() {
               $httpBackend[ 'expect' + method ]( BASE_URL + '/resource' ).respond( 200 );

               var promise;
               if( method === 'DELETE' ) {
                  promise = halClient.del( BASE_URL + '/resource', {
                     headers: {
                        'X-Custom-Header': 'such header'
                     }
                  } );
               }
               else {
                  promise = halClient[ method.toLowerCase() ]( BASE_URL + '/resource', { my: 'data' }, {
                     headers: {
                        'X-Custom-Header': 'such header'
                     }
                  } );
               }
               promise.then( thenResolvedSpy, thenRejectedSpy );
               promise.on( {
                  '200': onSpy200,
                  '2xx': onSpy2xx,
                  '404': onSpy404
               } );
               $httpBackend.flush();
            } );

            //////////////////////////////////////////////////////////////////////////////////////////////////

            it( 'calls the configured response transformer', function() {
               expect( responseTransformerSpy ).toHaveBeenCalled();
            } );

            //////////////////////////////////////////////////////////////////////////////////////////////////

            it( 'resolves the simple promise', function() {
               expect( thenResolvedSpy ).toHaveBeenCalled();
               expect( thenRejectedSpy ).not.toHaveBeenCalled();
            } );

            //////////////////////////////////////////////////////////////////////////////////////////////////

            it( 'calls the most specific matching on handler', function() {
               expect( onSpy200 ).toHaveBeenCalled();
               expect( onSpy2xx ).not.toHaveBeenCalled();
               expect( onSpy404 ).not.toHaveBeenCalled();
               expect( onSpy5xxGlobal ).not.toHaveBeenCalled();
            } );

            //////////////////////////////////////////////////////////////////////////////////////////////////

            it( 'sends default unsafe, global and local headers along', function() {
               var callArgs = $http.calls[0].args[0];

               expect( callArgs.headers ).toEqual( {
                  'Accept': 'application/hal+json',
                  'Accept-Language': 'de',
                  'Content-Type': method === 'PATCH' ? 'application/json-patch+json' : 'application/json',
                  'X-Custom-Header': 'such header'
               } );
            } );

            //////////////////////////////////////////////////////////////////////////////////////////////////

            if( method !== 'DELETE' ) {
               it( 'sends the data as request body', function() {
                  var callArgs = $http.calls[0].args[0];
                  expect( callArgs.data ).toEqual( { my: 'data' } );
               } );
            }

         } );

      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      describe( 'with follow relation functions', function() {

         var meHalResource;

         beforeEach( function() {
            meHalResource = data.ROOT;

            $httpBackend.whenGET( data.baseUrl + '/me/cars' ).respond( 200, data.CARS );
            $httpBackend.whenGET( data.baseUrl + '/me/cars/0' ).respond( 200, data.CARS._embedded.car[0] );
            $httpBackend.whenGET( data.baseUrl + '/me/cars/1' ).respond( 200, data.CARS._embedded.car[1] );
            $httpBackend.whenGET( data.baseUrl + '/me/pets' ).respond( 200, data.PETS );
            $httpBackend.whenGET( data.baseUrl + '/me/pets/0' ).respond( 200, data.PETS._embedded.pet[0] );

            spyOn( halClient, 'follow' ).andCallThrough();
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'has a function to test if a relation can be followed (ATP-9441)', function() {
            expect( halClient.canFollow( { }, 'relation' ) ).toBe( false );
            expect( halClient.canFollow( { _links: { relation: {} } }, 'relation' ) ).toBe( true );
            expect( halClient.canFollow( { _embedded: { relation: {} } }, 'relation' ) ).toBe( true );
            expect( halClient.canFollow( {
               _links: { relation: {} },
               _embedded: { relation: {} }
            }, 'relation' ) )
               .toBe( true );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'has a function to retrieve the url of the first entry from a relation (ATP-9503)', function() {
            expect( halClient.firstRelationHref( { }, 'relation' ) ).toBe( null );
            expect( halClient.firstRelationHref( {
               _links: { relation: { href: 'fancyUrl' } }
            }, 'relation' ) ).toEqual( 'fancyUrl' );

            expect( halClient.firstRelationHref( {
               _links: { relation: [ { href: 'fancyUrl' }, { href: 'tooFancyUrl' } ] }
            }, 'relation' ) ).toEqual( 'fancyUrl' );

            expect( halClient.firstRelationHref( {
               _embedded: { relation: { _links: { self: { href: 'embeddedFancyUrl' } } } }
            }, 'relation' ) ).toEqual( 'embeddedFancyUrl' );

            expect( halClient.firstRelationHref( {
               _links: { relation: { href: 'linkedFancyUrl' } },
               _embedded: { relation: { _links: { self: { href: 'embeddedFancyUrl' } } } }
            }, 'relation' ) ).toEqual( 'linkedFancyUrl' );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'fetches resources from the representation if already embedded', function() {
            halClient.follow( meHalResource, 'address' ).then( thenResolvedSpy, thenRejectedSpy );
            $rootScope.$digest();

            expect( $http ).not.toHaveBeenCalled();
            expect( thenResolvedSpy ).toHaveBeenCalledWithProperties( {
               status: 200,
               data: meHalResource._embedded.address
            } );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'calls the most specific matching on handler', function() {
            halClient.follow( meHalResource, 'address' ).on( {
               '200': onSpy200,
               '2xx': onSpy2xx
            } );
            $rootScope.$digest();

            expect( onSpy200 ).toHaveBeenCalledWithProperties( {
               status: 200,
               data: meHalResource._embedded.address
            } );
            expect( onSpy2xx ).not.toHaveBeenCalled();
            expect( onSpy5xxGlobal ).not.toHaveBeenCalled();
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'makes a GET request for a resource that is not embedded', function() {
            halClient.follow( meHalResource, 'cars' ).then( thenResolvedSpy, thenRejectedSpy );
            $httpBackend.flush();

            expect( $http ).toHaveBeenCalledWithProperties( {
               url: data.baseUrl + '/me/cars',
               method: 'GET'
            } );
            expect( thenResolvedSpy ).toHaveBeenCalledWithProperties( {
               status: 200,
               data: data.CARS
            } );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'follows a complete collection if followAll is true', function() {
            halClient.follow( meHalResource, 'car', { followAll: true } )
               .then( thenResolvedSpy, thenRejectedSpy );
            $httpBackend.flush();

            expect( $http ).toHaveBeenCalledWithProperties( {
               url: data.baseUrl + '/me/cars/0',
               method: 'GET'
            } );
            expect( $http ).toHaveBeenCalledWithProperties( {
               url: data.baseUrl + '/me/cars/1',
               method: 'GET'
            } );

            var callArgs = thenResolvedSpy.calls[0].args[0];
            expect( callArgs[0].status ).toEqual( 200 );
            expect( callArgs[0].data ).toEqual( data.CARS._embedded.car[0] );
            expect( callArgs[1].status ).toEqual( 200 );
            expect( callArgs[1].data ).toEqual( data.CARS._embedded.car[1] );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'follows a complete collection if followAll is true although there is only one link', function() {
            halClient.follow( meHalResource, 'pet', { followAll: true } )
               .then( thenResolvedSpy, thenRejectedSpy );
            $httpBackend.flush();

            expect( $http ).toHaveBeenCalledWithProperties( {
               url: data.baseUrl + '/me/pets/0',
               method: 'GET'
            } );

            var callArgs = thenResolvedSpy.calls[0].args[0];
            expect( callArgs[0].status ).toEqual( 200 );
            expect( callArgs[0].data ).toEqual( data.PETS._embedded.pet[0] );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'defines followAll as shortcut for follow with followAll being true', function() {
            halClient.followAll( meHalResource, 'pet', { headers: { 'X-More-Headers': 'yay' } } )
               .then( thenResolvedSpy, thenRejectedSpy );
            $httpBackend.flush();

            expect( $http ).toHaveBeenCalledWithProperties( {
               url: data.baseUrl + '/me/pets/0',
               method: 'GET',
               headers: {
                  Accept: 'application/hal+json',
                  'Accept-Language': 'de',
                  'X-More-Headers': 'yay'
               }
            } );

            var callArgs = thenResolvedSpy.calls[0].args[0];
            expect( callArgs[0].status ).toEqual( 200 );
            expect( callArgs[0].data ).toEqual( data.PETS._embedded.pet[0] );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'can follow a set of embedded resources', function() {
            halClient.followAll( data.CARS, 'car' ).then( thenResolvedSpy, thenRejectedSpy );
            $rootScope.$digest();

            var callArgs = thenResolvedSpy.calls[0].args[0];
            expect( callArgs[0].status ).toEqual( 200 );
            expect( callArgs[0].data ).toEqual( data.CARS._embedded.car[0] );
            expect( callArgs[1].status ).toEqual( 200 );
            expect( callArgs[1].data ).toEqual( data.CARS._embedded.car[1] );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'can follow a set of embedded resources although there is only one element embedded (jira ATP-9300)', function() {
            var carData = data.CARS;
            carData._embedded.car = carData._embedded.car[0];
            halClient.followAll( carData, 'car' ).then( thenResolvedSpy, thenRejectedSpy );
            $rootScope.$digest();

            var callArgs = thenResolvedSpy.calls[0].args[0];
            expect( callArgs.length ).toEqual( 1 );
            expect( callArgs[0].status ).toEqual( 200 );
            expect( callArgs[0].data ).toEqual( carData._embedded.car );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'can follow an empty set of embedded resources and passes an empty list of responses with overall status 200 (jira ATP-9408)', function() {
            var carData = data.CARS;
            carData._embedded.car = [];
            halClient.followAll( carData, 'car' ).on( {
               '200': onSpy200,
               '2xx': onSpy2xx,
               'xxx': onSpyXxx
            } );
            $rootScope.$digest();

            expect( onSpy200 ).toHaveBeenCalledWith( [] );
            expect( onSpy2xx ).not.toHaveBeenCalled();
            expect( onSpyXxx ).not.toHaveBeenCalled();
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'calls a matching on handler if the status codes of all responses are the same', function() {
            halClient.followAll( meHalResource, 'car' ).on( {
               '200': onSpy200,
               '2xx': onSpy2xx,
               'xxx': onSpyXxx
            } );
            $httpBackend.flush();

            expect( onSpy200 ).toHaveBeenCalled();
            expect( onSpy2xx ).not.toHaveBeenCalled();
            expect( onSpyXxx ).not.toHaveBeenCalled();
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'calls xxx handler if the status codes of some responses are different', function() {
            meHalResource._links.car.push( { href: data.baseUrl + '/me/cars/2' } );
            $httpBackend.whenGET( data.baseUrl + '/me/cars/2' ).respond( 404 );
            halClient.followAll( meHalResource, 'car' ).on( {
               '200': onSpy200,
               '2xx': onSpy2xx,
               'xxx': onSpyXxx
            } );
            $httpBackend.flush();

            var callArgs = onSpyXxx.calls[0].args[0];
            expect( onSpy200 ).not.toHaveBeenCalled();
            expect( onSpy2xx ).not.toHaveBeenCalled();
            expect( onSpyXxx ).toHaveBeenCalled();
            expect( callArgs[0].status ).toEqual( 200 );
            expect( callArgs[1].status ).toEqual( 200 );
            expect( callArgs[2].status ).toEqual( 404 );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'has a utility function to create a simple follow handler', function() {
            var addressFollower = halClient.thenFollow( 'address' );

            addressFollower( { data: meHalResource } ).then( thenResolvedSpy, thenRejectedSpy );
            $rootScope.$digest();

            expect( thenResolvedSpy ).toHaveBeenCalledWithProperties( {
               status: 200,
               data: meHalResource._embedded.address
            } );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'has a utility function to create a simple followAll handler', function() {
            var carFollower = halClient.thenFollowAll( 'car' );

            carFollower( { data: meHalResource } ).then( thenResolvedSpy, thenRejectedSpy );
            $httpBackend.flush();

            var callArgs = thenResolvedSpy.calls[0].args[0];
            expect( callArgs[0].status ).toEqual( 200 );
            expect( callArgs[0].data ).toEqual( data.CARS._embedded.car[0] );
            expect( callArgs[1].status ).toEqual( 200 );
            expect( callArgs[1].data ).toEqual( data.CARS._embedded.car[1] );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'supports following simple path fragment templated URIs (ATP-9391)', function() {
            $httpBackend.expectGET( data.baseUrl + '/me/carsByType/VW' ).respond( 200, {} );

            halClient.follow( data.CARS, 'carsByType', {
               vars: {
                  type: 'VW'
               }
            } );

            $httpBackend.flush();
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'supports following simple query string templated URIs (ATP-9391)', function() {
            $httpBackend.expectGET( data.baseUrl + '/me/carsByModel?model=DeLorean' ).respond( 200, {} );

            halClient.follow( data.CARS, 'carsByModel', {
               vars: {
                  model: 'DeLorean'
               }
            } );

            $httpBackend.flush();
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'supports following simple query and query continuation string templated URIs (ATP-9391)', function() {
            $httpBackend.expectGET( data.baseUrl + '/me/carsByTypeAndModel?type=VW&model=DeLorean' ).respond( 404 );

            halClient.follow( data.CARS, 'carsByTypeAndModel', {
               vars: {
                  type: 'VW',
                  model: 'DeLorean'
               }
            } );

            $httpBackend.flush();
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'URI encodes simple query and query continuation string templated URIs (ATP-9617)', function() {
            $httpBackend.expectGET( data.baseUrl + '/me/carsByTypeAndModel?type=Daimler%20Benz&model=T%201000%2B' ).respond( 404 );

            halClient.follow( data.CARS, 'carsByTypeAndModel', {
               vars: {
                  type: 'Daimler Benz',
                  model: 'T 1000+'
               }
            } );

            $httpBackend.flush();
         } );

      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      describe( 'configured to queue unsafe requests', function() {

         var httpMock;
         var deferred;

         beforeEach( function() {
            httpMock = jasmine.createSpy( 'httpMock' ).andCallFake( function() {
               return deferred.promise;
            } );

            ngMocks.inject( function( $q ) {
               deferred = $q.defer();
            } );

            halClient = halHttp.create( httpMock, $injector.get( '$q' ), {
               queueUnsafeRequests: true
            } );

            halClient.post( 'first', {} );
            halClient.post( 'second', {} );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'only starts the next request if the previous was fulfilled (ATP-9539)', function() {
            $rootScope.$digest();
            expect( httpMock.calls.length ).toBe( 1 );

            deferred.resolve();
            $rootScope.$digest();
            expect( httpMock.calls.length ).toBe( 2 );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'only starts the next request if the previous was rejected (ATP-9539)', function() {
            $rootScope.$digest();
            expect( httpMock.calls.length ).toBe( 1 );

            deferred.reject();
            $rootScope.$digest();
            expect( httpMock.calls.length ).toBe( 2 );
         } );

      } );

   } );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function addMatchers( jasmineContext ) {
      jasmineContext.addMatchers( {
         toHaveBeenCalledWithProperties: function( expectedProperties ) {
            var expectedKeys = Object.keys( expectedProperties );
            var args = (this.actual.calls || [])
               .map( function( call ) {
                  return call.args && call.args.length ? call.args[0] : {};
               } );

            var called = args.some( function( arg ) {
               return expectedKeys.every( function( key ) {
                  return JSON.stringify( expectedProperties[ key ] ) === JSON.stringify( arg[ key ] );
               } );
            } );

            this.message = function() {
               return 'Expected call with properties ' + jasmine.pp( expectedProperties ) +
                  ' but was called with ' + jasmine.pp( args );
            };

            return called;
         }
      } );
   }

} );
