/**
 * Copyright 2015 LaxarJS
 * Released under the MIT license
 * http://www.laxarjs.org
 */
define( [
   'laxar'
], function( ax ) {
   'use strict';

   // Due to AngularJS bug https://github.com/angular/angular.js/issues/7187 promises are explicitly rejected
   // via q.reject and not simply thrown. The later would break the tests.


   /**
    * Default headers used with safe http methods.
    */
   var DEFAULT_SAFE_HEADERS = {
      Accept: 'application/hal+json'
   };

   /**
    * Default headers used with unsafe http methods.
    */
   var DEFAULT_UNSAFE_HEADERS = ax.object.options( {
      'Content-Type': 'application/json'
   }, DEFAULT_SAFE_HEADERS );

   /**
    * Default headers used with the PATCH http methods.
    */
   var DEFAULT_PATCH_HEADERS = ax.object.options( {
      'Content-Type': 'application/json-patch+json'
   }, DEFAULT_SAFE_HEADERS );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   /**
    * Creates new http client for usage with a RESTful backend supporting the content type
    * `application/hal+json` (https://tools.ietf.org/html/draft-kelly-json-hal-06).
    *
    * Promises returned by the methods of a hal client are basically the ones returned by the given `q`
    * library enriched by an `on` function. This function can be called with a map of status code to handler
    * function. Suffixes of a status code can be replaced by the wildcard character `x`. Note that in reality
    * only something like `2xx` (match all successful codes) and `xxx` (match any code) make sense, as for
    * example `20x` doesn't reference any semantically useful code range. It is possible to reuse the same
    * handler for several codes (optionally with wildcards) by joining them with the `|` (pipe) character,
    * Each handler receives the http response as argument. In case of `followAll()` or a handler returned by
    * `thenFollowAll()` an array of responses is given.
    *
    * Example:
    * ```javascript
    * halClient.get( 'http://host/someResource' )
    *    .on( {
    *       '2xx': function( response ) {
    *          console.log( 'Everything looks fine: ', response.data );
    *       },
    *       '4xx|5xx': function( response ) {
    *          console.log( 'Server or client failed. Who knows? The status!', response.status );
    *       }
    *    } );
    * ```
    *
    * If no matching handler was found in the object passed to `on`, the global handlers are searched for a
    * matching handler. Note that a more specific global handler will be favored over a more general local
    * handler. If no handler at all was found, a message in level `debug` is logged.
    * A handler may then return a new promise generated from a hal http request and thus chain several `on`
    * handlers.
    *
    * @param {Function} http
    *    a http client conforming to AngularJS' `$http` service
    * @param {Object} q
    *    a promise library conforming to AngularJS' `$q` service
    * @param {Object} [optionalOptions]
    *    map of global configuration to use for the hal client
    * @param {Boolean} optionalOptions.queueUnsafeRequests
    *    if `true` an unsafe request has to be finished before the next is started. Default is `false`
    * @param {Object} optionalOptions.headers
    *    global headers to send along with every request
    * @param {Object} optionalOptions.on
    *    global `on` handlers to use as fallback if no matching handler was found in an `on` call
    * @param {Function} optionalOptions.responseTransformer
    *    a function that is called for every response and must return an optionally transformed version of
    *    that response. This currently is only used for url rewriting after proxied requests during development
    *
    * @return {Object}
    *    a new hal client instance
    */
   function create( http, q, optionalOptions ) {

      ax.assert( http ).hasType( Function ).isNotNull();
      ax.assert( q ).isNotNull();

      var getPromiseCache = {};
      var eTags = {};
      var dataByUrl = {};
      var globalOptions = ax.object.options( optionalOptions, {
         queueUnsafeRequests: false,
         headers: {},
         on: {},
         responseTransformer: function( response ) { return response; }
      } );
      var globalOnHandlers = expandHandlers( globalOptions.on );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      /**
       * Makes a GET request for the given url or hal representation. In case a hal representation is given,
       * the `self relation in the `_links` map is used to derive the url for the request.
       *
       * If a requested resource exhibits an ETag header field, the resource representation is cached with its
       * current ETag value. On subsequent requests this value is send along in an `If-None-Match` header and
       * if the response yields a status code of `304 Not Modified`, the representation is returned from cache.
       *
       * @param {String|Object} urlOrHalRepresentation
       *    an url or hal representation to make the request for
       * @param {Object} [optionalOptions]
       *    configuration to use for the request
       * @param {Object} optionalOptions.headers
       *    headers to send along with the request. By default `Accept: application/hal+json` is added to
       *    the headers
       *
       * @return {Promise}
       *    a promise for the response enriched by an `on` function (see `create()`)
       */
      function get( urlOrHalRepresentation, optionalOptions ) {
         var url = extractUrl( urlOrHalRepresentation );
         var options = ax.object.options( optionalOptions, { headers: {} } );
         var headers = createHeaders( 'GET', options.headers );

         if( url in eTags ) {
            headers[ 'If-None-Match' ] = eTags[ url ];
         }

         var cacheKey = createCacheKey( url, headers );
         if( cacheKey in getPromiseCache ) {
            return getPromiseCache[ cacheKey ];
         }

         var promise = http( {
            url: url,
            method: 'GET',
            headers: headers
         } ).then( null, function( response ) {
               if( 'status' in response && family( response ) === 'redirection' ) {
                  return response;
               }

               return q.reject( response );
            } )
            .then( function( response ) {
               return globalOptions.responseTransformer( response );
            }, function( response ) {
               return q.reject( globalOptions.responseTransformer( response ) );
            } )
            .then( function( response ) {
               var codeFamily = family( response );
               if( codeFamily === 'successful' && response.headers( 'etag' ) ) {
                  eTags[ url ] = response.headers( 'etag' );
                  dataByUrl[ url ] = JSON.stringify( response.data );
               }
               else if( codeFamily === 'redirection' ) {
                  response.data = JSON.parse( dataByUrl[ url ] );
               }

               return response;
            } );

         promise[ 'finally' ]( function() {
            delete getPromiseCache[ cacheKey ];
         } );

         getPromiseCache[ cacheKey ] = extendResponsePromise( promise );
         return getPromiseCache[ cacheKey ];
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      /**
       * Makes a PUT request for the given url or hal representation. In case a hal representation is given,
       * the `self relation in the `_links` map is used to derive the url for the request.
       *
       * @param {String|Object} urlOrHalRepresentation
       *    an url or hal representation to make the request for
       * @param {Object} data
       *    JSON serializable data to send
       * @param {Object} [optionalOptions]
       *    configuration to use for the request
       * @param {Object} optionalOptions.headers
       *    headers to send along with the request. By default `Accept: application/hal+json` and
       *    `Content-Type: application/json` are added to the headers
       *
       * @return {Promise}
       *    a promise for the response enriched by an `on` function (see `create()`)
       */
      function put( urlOrHalRepresentation, data, optionalOptions ) {
         return unsafeRequest( 'PUT', urlOrHalRepresentation, optionalOptions, data );
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      /**
       * Makes a POST request for the given url or hal representation. In case a hal representation is given,
       * the `self relation in the `_links` map is used to derive the url for the request.
       *
       * @param {String|Object} urlOrHalRepresentation
       *    an url or hal representation to make the request for
       * @param {Object} data
       *    JSON serializable data to send
       * @param {Object} [optionalOptions]
       *    configuration to use for the request
       * @param {Object} optionalOptions.headers
       *    headers to send along with the request. By default `Accept: application/hal+json` and
       *    `Content-Type: application/json` are added to the headers
       *
       * @return {Promise}
       *    a promise for the response enriched by an `on` function (see `create()`)
       */
      function post( urlOrHalRepresentation, data, optionalOptions ) {
         return unsafeRequest( 'POST', urlOrHalRepresentation, optionalOptions, data );
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      /**
       * Makes a PATCH request for the given url or hal representation. In case a hal representation is given,
       * the `self relation in the `_links` map is used to derive the url for the request.
       *
       * @param {String|Object} urlOrHalRepresentation
       *    an url or hal representation to make the request for
       * @param {Object} data
       *    data in JSON Patch notation (http://tools.ietf.org/html/rfc6902)
       * @param {Object} [optionalOptions]
       *    configuration to use for the request
       * @param {Object} optionalOptions.headers
       *    headers to send along with the request. By default `Accept: application/hal+json` and
       *    `Content-Type: application/json-patch+json` are added to the headers
       *
       * @return {Promise}
       *    a promise for the response enriched by an `on` function (see `create()`)
       */
      function patch( urlOrHalRepresentation, data, optionalOptions ) {
         return unsafeRequest( 'PATCH', urlOrHalRepresentation, optionalOptions, data );
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      /**
       * Makes a DELETE request for the given url or hal representation. In case a hal representation is given,
       * the `self relation in the `_links` map is used to derive the url for the request.
       *
       * @param {String|Object} urlOrHalRepresentation
       *    an url or hal representation to make the request for
       * @param {Object} [optionalOptions]
       *    configuration to use for the request
       * @param {Object} optionalOptions.headers
       *    headers to send along with the request. By default `Accept: application/hal+json` and
       *    `Content-Type: application/json` are added to the headers
       *
       * @return {Promise}
       *    a promise for the response enriched by an `on` function (see `create()`)
       */
      function del( urlOrHalRepresentation, optionalOptions ) {
         return unsafeRequest( 'DELETE', urlOrHalRepresentation, optionalOptions );
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      /**
       * Returns a copy of the given hal representation with all hal media type specific properties removed.
       * Currently these are `_links` and `_embedded`.
       *
       * @param {Object} halRepresentation
       *    the representation to clean up
       *
       * @return {Object}
       *    the copy without hal media type keys
       */
      function removeHalKeys( halRepresentation ) {
         var representation = {};
         Object.keys( halRepresentation ).forEach( function( key ) {
            if( key !== '_links' && key !== '_embedded' ) {
               representation[ key ] = ax.object.deepClone( halRepresentation[ key ] );
            }
         } );
         return representation;
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      /**
       * Returns `true` if the given relation exists as link or is embedded.
       *
       * @param {Object} halRepresentation
       *    hal representation to check for the relation
       * @param {String} relation
       *    name of the relation to find
       *
       * @return {Boolean} `true` if `relation` exists in the representation
       */
      function canFollow( halRepresentation, relation ) {
         return !!( ( halRepresentation._links && relation in halRepresentation._links ) ||
            ( halRepresentation._embedded && relation in halRepresentation._embedded ) );
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      /**
       * Returns the first value of href for the requested relation. Search for the relation starts under
       * `_links` and continues in `_embedded`, if not found in `_links`. If not found at all, `null` is
       * returned.
       * If the relation is found and yields only a single value, that value's `href` attribute value is
       * returned. If the relation yields a list, the `href` attribute value of the first entry is returned.
       *
       * @param {Object} halRepresentation
       *    the representation to search for the relation
       * @param {String} relation
       *    the relation to get a `href` attribute value from
       *
       * @return {String} the `href` attribute value if available, `null` otherwise
       */
      function firstRelationHref( halRepresentation, relation ) {
         if( halRepresentation._links && relation in halRepresentation._links ) {
            var linkOrLinks = halRepresentation._links[ relation ];
            return Array.isArray( linkOrLinks ) ? linkOrLinks[ 0 ].href : linkOrLinks.href;
         }

         return ax.object.path( halRepresentation, '_embedded.' + relation + '._links.self.href', null );
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      /**
       * Follows one or more resources of a relation within a given hal representation. First it is checked if
       * a representation for the relation is already embedded and in case it exists, this will be the result.
       * If that isn't the case, the `_links` property is searched for an url of that relation and if found, a
       * GET request for this url is performed. If the relation could not be found in the given representation
       * the resulting promise is rejected.
       *
       * If there are multiple links or embedded resources, by default only the first one will possibly be
       * requested and its response passed to the consumers of the promise. In case the `followAll` option is
       * set to `true`, all found embedded representations are returned or all relations found in the `_links`
       * property are requested resp.. The result the promise then is resolved with, will be an array of
       * responses instead of a single response.
       * As there might be different status codes for the responses, a specific `on` handler is only called
       * if all status codes yield the same value. In any other case *only* the handler for `xxx` is called.
       *
       * @param {Object} halRepresentation
       *    the representation whose relation should be followed
       * @param {String} relation
       *    the relation to follow
       * @param {Object} [optionalOptions]
       *    configuration to use for the request
       * @param {Object} optionalOptions.headers
       *    headers to send along with the request. The same default headers as for `get()` are used
       * @param {Boolean} optionalOptions.followAll
       *    if `true`, follows all entities found for that relation. Default is `false`
       *
       * @return {Promise}
       *    a promise for the response enriched by an `on` function (see `create()`)
       */
      function follow( halRepresentation, relation, optionalOptions ) {
         ax.assert( halRepresentation ).hasType( Object ).isNotNull();
         ax.assert( relation ).hasType( String ).isNotNull();

         var options = ax.object.options( optionalOptions, {
            followAll: false,
            headers: {},
            vars: {}
         } );
         var returnPromise;

         if( '_embedded' in halRepresentation && relation in halRepresentation._embedded ) {
            var embedded = halRepresentation._embedded[ relation ];
            if( options.followAll ) {
               var all = Array.isArray( embedded ) ? embedded : [ embedded ];
               returnPromise = q.when( all.map( function( data ) {
                  return {
                     status: 200,
                     headers: {},
                     data: data
                  };
               } ) );
            }
            else {
               var first = Array.isArray( embedded ) ? embedded[ 0 ] : embedded;
               returnPromise = q.when( {
                  status: 200,
                  headers: {},
                  data: first
               } );
            }
         }
         else if( '_links' in halRepresentation && relation in halRepresentation._links ) {
            var linkOrLinks = halRepresentation._links[ relation ];
            if( options.followAll ) {
               var links = Array.isArray( linkOrLinks ) ? linkOrLinks : [ linkOrLinks ];
               returnPromise = allSettled( q, links.map( function( link ) {
                  var href = expandPossibleVars( link, options.vars );
                  return get( href, { headers: options.headers } );
               } ) );
            }
            else {
               var link = Array.isArray( linkOrLinks ) ? linkOrLinks[ 0 ] : linkOrLinks;
               var href = expandPossibleVars( link, options.vars );
               returnPromise = get( href, { headers: options.headers } );
            }
         }
         else {
            // NEEDS FIX B: Still not sure what to return here. Yield a 404 or something similar? Simulate no
            // server response at all but simply reject as it is done right now?
            returnPromise = q.reject( {
               message: 'Relation "' + relation + '" could not be found.',
               representation: halRepresentation,
               relation: relation
            } );
         }

         return extendResponsePromise( returnPromise );
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      /**
       * A shortcut function for `follow( halRepresentation, relation, { followAll: true } )`.
       *
       * @param {Object} halRepresentation
       *    the representation whose relation should be followed
       * @param {String} relation
       *    the relation to follow
       * @param {Object} [optionalOptions]
       *    configuration to use for the request
       * @param {Object} optionalOptions.headers
       *    headers to send along with the request. The same default headers as for `get()` are used
       *
       * @return {Promise}
       *    a promise for the response enriched by an `on` function (see `create()`)
       */
      function followAll( halRepresentation, relation, optionalOptions ) {
         var options = ax.object.options( optionalOptions, {} );
         options.followAll = true;
         return follow( halRepresentation, relation, options );
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      /**
       * Helper factory for `follow()` function calls. The returned function only expects a response object
       * with at least a representation in the `data´ field and calls `follow` using that representation as
       * first argument. The purpose of this method is for use within chained follow calls, especially in `on`
       * handlers.
       *
       * Example:
       * ```javascript
       * halClient.get( 'http://host/office' )
       *    .on( { '200': halClient.thenFollow( 'desk' ) } )
       *    .on( { '200': halClient.thenFollow( 'computer' ) } )
       *    .on( { '200': halClient.thenFollow( 'keyboard' ) } );
       * // ...
       * ```
       * Assuming every response yields a status of `200`, first a representation of an office resource is
       * fetched, then the `desk` relation is followed, then within the resulting representation the `computer`
       * relation is followed and finally within that representation the `keyboard` relation is followed.
       *
       * Note that this method cannot be used in an `on` handler after a `followAll` request.
       *
       * @param {String} relation
       *    the relation to follow
       * @param {Object} [optionalOptions]
       *    configuration to use for the request
       * @param {Object} optionalOptions.headers
       *    headers to send along with the request. The same default headers as for `get()` are used
       * @param {Boolean} optionalOptions.followAll
       *    if `true`, follows all entities found for that relation. Default is `false`
       *
       * @returns {Function}
       */
      function thenFollow( relation, optionalOptions ) {
         return function( response ) {
            return follow( response.data, relation, optionalOptions );
         };
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      /**
       * A shortcut function for `thenFollow( relation, { followAll: true } )`.
       *
       * @param {String} relation
       *    the relation to follow
       * @param {Object} [optionalOptions]
       *    configuration to use for the request
       * @param {Object} optionalOptions.headers
       *    headers to send along with the request. The same default headers as for `get()` are used
       *
       * @returns {Function}
       */
      function thenFollowAll( relation, optionalOptions ) {
         return function( response ) {
            return followAll( response.data, relation, optionalOptions );
         };
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      /**
       *
       * @private
       */
      function createHeaders( method, addtional ) {
         var defaultHeaders = DEFAULT_UNSAFE_HEADERS;
         if( method === 'GET' ) {
            defaultHeaders = DEFAULT_SAFE_HEADERS;
         }
         else if( method === 'PATCH' ) {
            defaultHeaders = DEFAULT_PATCH_HEADERS;
         }
         return ax.object.options( addtional, ax.object.options( globalOptions.headers, defaultHeaders ) );
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      var continuationPromise = q.when();
      /**
       *
       * @private
       */
      function unsafeRequest( method, urlOrHalRepresentation, optionalOptions, optionalData ) {
         var url = extractUrl( urlOrHalRepresentation );
         var options = ax.object.options( optionalOptions, { headers: {} } );

         var req = {
            url: url,
            method: method,
            headers: createHeaders( method, options.headers )
         };
         if( optionalData ) {
            req.data = optionalData;
         }

         if( globalOptions.queueUnsafeRequests === true ) {
            continuationPromise = continuationPromise.then( next, next );
            return extendResponsePromise( continuationPromise );
         }

         return extendResponsePromise( next() );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         function next() {
            return http( req )
               .then( function( response ) {
                  return globalOptions.responseTransformer( response );
               }, function( response ) {
                  return q.reject( globalOptions.responseTransformer( response ) );
               } );
         }
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      /**
       *
       * @private
       */
      function extendResponsePromise( promise ) {

         promise.on = function( handlers ) {
            var callStatusHandler = createCallStatusHandler( handlers );

            return extendResponsePromise( promise.then( callStatusHandler, callStatusHandler ) );
         };

         return promise;

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         function createCallStatusHandler( statusHandlers ) {
            return function callStatusHandler( response ) {
               if( !response ) {
                  return;
               }

               if( response.__unhandledOn ) {
                  return q.reject( response );
               }

               var status = response.status || 'xxx';
               if( !( 'status' in response ) && Array.isArray( response ) ) {
                  if( response.length ) {
                     status = response[0].status;
                     if( !response.every( function( _ ) { return _.status === status; } ) ) {
                        status = 'xxx';
                     }
                  }
                  else {
                     // This is the case, when we tried to follow a list of embedded resources, but there
                     // were no entries. For list resources it hence is totally valid to be empty. If
                     // emptiness is a problem, that has to be handled later on by functional code.
                     status = 200;
                  }
               }

               var handler = findBestMatchingStatusHandler( status, statusHandlers, globalOnHandlers );
               if( !handler ) {
                  if( response.config && response.config.url ) {
                     ax.log.debug(
                        'Unhandled http status "[0]" of response for uri "[1]".',
                        status,
                        response.config.url
                     );
                  }
                  else {
                     if( response.message && response.representation ) {
                        ax.log.error(
                           'An error occured: [0]. Representation: [1:%o].',
                           response.message,
                           response.representation
                        );
                     }
                     else {
                        ax.log.error(
                           'Unhandled http status "[0]" of response "[1:%o]".',
                           status,
                           response
                        );
                     }
                  }


                  response.__unhandledOn = true;
                  return q.reject( response );
               }

               return handler( response );
            };
         }
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      /**
       * Currently only supports query (`?`) and query continuation (`&`) prefixes.
       *
       * @private
       */
      function expandPossibleVars( link, vars ) {
         if( !link.templated ) {
            return link.href;
         }

         return link.href.replace( /\{([^}]*)}/ig, function( fullMatch, key ) {
            if( key.indexOf( '?' ) === 0 || key.indexOf( '&' ) === 0 ) {
               return key.charAt( 0 ) + encodeURIComponent( key.substr( 1 ) ) +
                  '=' + encodeURIComponent( vars[ key.substr( 1 ) ] );
            }

            return vars[ key ] || '';
         } );
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      return {
         get: get,
         put: put,
         post: post,
         patch: patch,
         del: del,
         removeHalKeys: removeHalKeys,
         canFollow: canFollow,
         firstRelationHref: firstRelationHref,
         follow: follow,
         followAll: followAll,
         thenFollow: thenFollow,
         thenFollowAll: thenFollowAll
      };

   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   /**
    *
    * @private
    */
   function family( response ) {
      var firstDigit = Math.floor( response.status / 100 );
      switch( firstDigit ) {
         case 2: return 'successful';
         case 3: return 'redirection';
         case 4: return 'client-error';
         case 5: return 'server-error';
         default: return 'unknown-error';
      }
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   /**
    *
    * @private
    */
   function findBestMatchingStatusHandler( status, handlers, globalHandlers ) {
      var statusStr = ''+status;
      var localHandlers = expandHandlers( handlers );
      var statusKeys = [ statusStr, statusStr.substr( 0, 2 ) + 'x', statusStr[0] + 'xx', 'xxx' ];

      for( var i = 0, len = statusKeys.length; i < len; ++i ) {
         if( statusKeys[i] in localHandlers ) {
            return localHandlers[ statusKeys[i] ];
         }
         if( statusKeys[i] in globalHandlers ) {
            return globalHandlers[ statusKeys[i] ];
         }
      }
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   /**
    *
    * @private
    */
   function expandHandlers( handlers ) {
      var tmp = {};

      Object.keys( handlers ).forEach( function( key ) {
         var value = handlers[ key ];
         var keyParts = key.split( '|' );
         keyParts.forEach( function( keyPart ) {
            tmp[ keyPart ] = value;
         } );
      } );

      return tmp;
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   /**
    * Similar to `q.all` but waits for all promises to be fulfilled, no matter if some get rejected or not.
    * The resulting promise is rejected if at least one input promise is rejected and resolved otherwise. The
    * argument array consists of all promise values, thus inspection by the application is necessary to sort
    * out the rejections.
    *
    * @private
    */
   function allSettled( q, promises ) {
      var deferred = q.defer();
      var waitingFor = promises.length;
      var finished = [];
      var failed = false;
      promises.forEach( function( promise, index ) {
         promise.then( doneCallback( false ), doneCallback( true ) );

         function doneCallback( rejected ) {
            return function( result ) {
               failed = rejected || failed;
               finished[ index ] = result;
               if( --waitingFor === 0 ) {
                  if( failed ) {
                     deferred.reject( finished );
                  }
                  else {
                     deferred.resolve( finished );
                  }
               }
            };
         }
      } );
      return deferred.promise;
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   /**
    *
    * @private
    */
   function extractUrl( urlOrHalRepresentation ) {
      var url = typeof urlOrHalRepresentation === 'string' ?
         urlOrHalRepresentation : ax.object.path( urlOrHalRepresentation, '_links.self.href', null );

      if( !url ) {
         ax.log.error( 'Tried to make a request without valid url. Instead got [0:%o].', urlOrHalRepresentation );
         throw new Error( 'Tried to make a request without valid url' );
      }

      return url;
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   /**
    *
    * @private
    */
   function createCacheKey( url, headers ) {
      return url + '@' + Object.keys( headers ).sort().reduce( function( acc, key ) {
            return acc + ( acc.length ? '_' : '' ) + key + '=' + headers[ key ];
         }, '' );
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   return {
      create: create
   };

} );
