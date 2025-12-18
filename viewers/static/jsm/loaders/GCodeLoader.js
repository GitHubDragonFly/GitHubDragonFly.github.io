import {
	BufferGeometry,
	Euler,
	FileLoader,
	Float32BufferAttribute,
	Group,
	LineBasicMaterial,
	LineSegments,
	Line,
	Loader,
	SplineCurve,
	Vector2
} from "three";

/**
* GCodeLoader is used to load gcode files usually used for 3D printing or CNC applications.
*
* Gcode files are composed by commands used by machines to create objects.
*
* @class GCodeLoader
* @param {Manager} manager Loading manager.
*/

class GCodeLoader extends Loader {

		constructor( manager ) {

			super( manager );

			this.splitLayer = false;

		}

		load( url, onLoad, onProgress, onError ) {

			const scope = this;

			const loader = new FileLoader( scope.manager );
			loader.setResponseType( 'text' );
			loader.setRequestHeader( scope.requestHeader );
			loader.setWithCredentials( scope.withCredentials );

			loader.load( url, function ( text ) {

				try {

					// Normalize line endings
					text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

					// Ensure final newline
					if (!text.endsWith('\n')) text += '\n';

					// Strip comments safely
					const lines = text.split('\n').map(line => line.replace(/;.*$/, '').trim());

					// Detect Git LFS pointer file
					if (text.startsWith('version https://git-lfs.github.com/spec')) {

						alert('The selected file is stored in Git LFS!');

						if ( onError ) {

							onError( 'The selected file is stored in Git LFS!' );
							return;

						} else {

							console.error( 'The selected file is stored in Git LFS!' );
							return;

						}

					}

					const gcode = scope.parse( lines );
					onLoad( gcode );

				} catch ( e ) {

					if ( onError ) {

						onError( e );

					} else {

						console.error( e );

					}

					scope.manager.itemError( url );

				}

			}, onProgress, onError );

		}
	
		parse( lines ) {

			let cmd;

			let state = { x: 0, y: 0, z: 0, e: 0, f: 0, i: 0, j: 0, extruding: false, relative: false };
			const layers = [];

			let currentLayer = undefined;

			const pathMaterial = new LineBasicMaterial( { color: 0xA51515 } );
			pathMaterial.name = 'path';

			const extrudingMaterial = new LineBasicMaterial( { color: 0x15A515 } );
			extrudingMaterial.name = 'extruded';

			const object = new Group();
			object.name = 'gcode';

			function newLayer( line ) {

				currentLayer = { vertex: [], pathVertex: [], z: line.z };
				layers.push( currentLayer );

			}

			//Create line segment between p1 and p2
			function addSegment( p1, p2 ) {

				if ( currentLayer === undefined ) {

					newLayer( p1 );

				}

				if ( state.extruding ) {

					currentLayer.vertex.push( p1.x, p1.y, p1.z );
					currentLayer.vertex.push( p2.x, p2.y, p2.z );

				} else {

					currentLayer.pathVertex.push( p1.x, p1.y, p1.z );
					currentLayer.pathVertex.push( p2.x, p2.y, p2.z );

				}

			}

			function delta( v1, v2 ) {

				return state.relative ? v2 : v2 - v1;

			}

			function absolute( v1, v2 ) {

				return state.relative ? v1 + v2 : v2;

			}

			const regEx = /(([XxYyZz]) *(-?\d+.?\d*)) *(([XxYyZz]) *(-?\d+.?\d*))? *(([XxYyZz]) *(-?\d+.?\d*))?/g;

			for ( const gcode_line of lines ) {

				const tokens = gcode_line.split( ' ' );
				cmd = tokens[ 0 ].toUpperCase();

				//Argumments
				const args = {};
				tokens.splice( 0 ).forEach( function ( token ) {

					if ( token[ 0 ] !== undefined ) {

						const key = token[ 0 ].toLowerCase();
						const value = parseFloat( token.substring( 1 ) );
						args[ key ] = value;

					}

				} );

				//Process commands

				//G0/G1 – Linear Movement
				if ( cmd === 'G00' || cmd === 'G0' || cmd === 'G01' || cmd==='G1' || regEx.test(cmd) ) {

					const line = {
						x: args.x !== undefined ? absolute( state.x, args.x ) : state.x,
						y: args.y !== undefined ? absolute( state.y, args.y ) : state.y,
						z: args.z !== undefined ? absolute( state.z, args.z ) : state.z,
						e: args.e !== undefined ? absolute( state.e, args.e ) : state.e,
						f: args.f !== undefined ? absolute( state.f, args.f ) : state.f,
					};

					//Layer change detection is or made by watching Z, it's made by watching when we extrude at a new Z position
					if ( delta( state.e, line.e ) > 0 ) {

						state.extruding = true;

						if ( currentLayer == undefined || line.z != currentLayer.z ) {

							newLayer( line );

						}

					}

					addSegment( state, line );
					state = line;
				} else if ( cmd === 'G02' || cmd === 'G2' || cmd === 'G03' || cmd === 'G3' ) {

						const line = {
							x: args.x !== undefined ? absolute( state.x, args.x ) : state.x,
							y: args.y !== undefined ? absolute( state.y, args.y ) : state.y,
							z: args.z !== undefined ? absolute( state.z, args.z ) : state.z,
							i: args.i !== undefined ? absolute( state.i, args.i ) : state.i,
							j: args.j !== undefined ? absolute( state.j, args.j ) : state.j,
							e: args.e !== undefined ? absolute( state.e, args.e ) : state.e,
							f: args.f !== undefined ? absolute( state.f, args.f ) : state.f,
						};
					
						if ( delta( state.e, line.e ) > 0 ) {

							state.extruding = true;
	
							if ( currentLayer == undefined || line.z != currentLayer.z ) {
	
								newLayer( line );

							}

						}


					addSegment( state, line );
					state = line;

				} else if ( cmd === 'G90' ) {

					//G90: Set to Absolute Positioning
					state.relative = false;

				} else if ( cmd === 'G91' ) {

					//G91: Set to state.relative Positioning
					state.relative = true;

				} else if ( cmd === 'G92' ) {

					//G92: Set Position
					const line = state;
					line.x = args.x !== undefined ? args.x : line.x;
					line.y = args.y !== undefined ? args.y : line.y;
					line.z = args.z !== undefined ? args.z : line.z;
					line.e = args.e !== undefined ? args.e : line.e;
					state = line;

				} else {

					//console.warn( 'THREE.GCodeLoader: Command not supported:' + cmd );

				}

			}

			function addObject( vertex, extruding, i, cmd ) {

				if ( cmd != 'G02' || cmd != 'G03' || cmd != 'G2' || cmd != 'G3') {

					const geometry = new BufferGeometry();
					geometry.setAttribute( 'position', new Float32BufferAttribute( vertex, 3 ) );
					const segments = new LineSegments( geometry, extruding ? extrudingMaterial : pathMaterial );
					segments.name = 'layer' + i;
					object.add( segments );

				} else {

					const curve = new SplineCurve( [
						new Vector2( state.x, state.y ),
						new Vector2( args.x, args.y )

					] );

					const points = curve.getPoints( 50 );
					const geometry = new BufferGeometry().setFromPoints( points );
					const ellipse = new Line( geometry, extruding ? extrudingMaterial : pathMaterial );
					ellipse.name = 'layer' + i;
					object.add( ellipse );

				}

			}

			if ( this.splitLayer ) {

				for ( let i = 0; i < layers.length; i ++ ) {

					const layer = layers[ i ];
					addObject( layer.vertex, true, i, cmd );
					addObject( layer.pathVertex, false, i, cmd );

				}

			} else {

				const vertex = [], pathVertex = [];

				for ( const layer of layers ) {

					const layerVertex = layer.vertex;
					const layerPathVertex = layer.pathVertex;

					for ( let i = 0; i < layerVertex.length; i ++ ) {

						vertex.push( layerVertex[ i ] );

					}

					for ( let j = 0; j < layerPathVertex.length; j ++ ) {

						pathVertex.push( layerPathVertex[ j ] );

					}

				}

				addObject( vertex, true, layers.length, cmd );
				addObject( pathVertex, false, layers.length, cmd );

			}

			object.quaternion.setFromEuler( new Euler( - Math.PI / 2, 0, 0 ) );

			return object;

		}

	}

	export { GCodeLoader }
