import { DefaultLoadingManager, Mesh } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.min.js';
import Polyslice from 'https://cdn.jsdelivr.net/npm/@jgphilpott/polyslice@26.4.0/dist/index.browser.esm.js';

/**
*
*	Based on: https://github.com/jgphilpott/polyslice:
*
*		- Printer defaults to: Ender3
*		- See documentation for other preconfigured printers:
*		- https://github.com/jgphilpott/polyslice/blob/dc361b12793fa29f7887da14adc1ae3497ba21b2/docs/config/PRINTER.md
*
*		- Filament defaults to: GenericPLA
*		- See documentation for other preconfigured filaments:
*		- https://github.com/jgphilpott/polyslice/blob/dc361b12793fa29f7887da14adc1ae3497ba21b2/docs/config/FILAMENT.md
*
*	Example Usage:
*
*		const { GcodeExporter } = await import( "path-to-exporter/GCODEExporter.js" );
*
*		const exporter = new GcodeExporter();
*
*		// Optional: here you could change printer and/or filament options
*		const options = { printer: 'CR10', filament: 'PrusamentPLA' };
*
*		exporter.parse( scene, function( text ) {
*			let blob = new Blob( [ text ], { type: 'text/plain' } );
*
*			let link = document.createElement( 'a' );
*			link.style.display = 'none';
*			document.body.appendChild( link );
*			link.href = URL.createObjectURL( blob );
*			link.download = 'Model.gcode';
*			link.click();
*			URL.revokeObjectURL( blob );
*			document.body.removeChild( link );
*		}, function() { console.log( 'Error exporting model!' ); }, options );
*
*/

class GcodeExporter {

	constructor( manager ) {

		this.manager = manager || DefaultLoadingManager;

	}

	parse( scene, onDone, onError, options = {} ) {

		this.parseAsync( scene, onDone, onError, options );

	}

	async parseAsync( scene, onDone, onError, options = {} ) {

		// Check if Polyslice is loaded

		if ( typeof Polyslice === 'undefined' ) {

			alert( 'Polyslice library failed to load.\n\nCheck your network connection.' );

			if ( typeof onError === 'function' ) {

				onError( 'THREE.GCODEExporter: Polyslice library failed to load!' );
				return null;

			} else {

				throw new Error( 'THREE.GCODEExporter: Polyslice library failed to load!' );

			}

		}

		const defaultOptions = {
			printer: 'Ender3',
			filament: 'GenericPLA'
		};

		options = Object.assign( defaultOptions, options );

		const printer = new Polyslice.Printer( options.printer );
		const filament = new Polyslice.Filament( options.filament );

		// Create the slicer instance with the printer and filament

		const slicer = new Polyslice({

			printer: printer,
			filament: filament

		});

		const geometries = [];
		let mesh, mergedGeometry, gcode = '', mesh_count = 0;

		scene.updateMatrixWorld( true, true );

		try {

			scene.traverse( ( child ) => {

				if ( child.isMesh && child.geometry ) {

					const clonedGeom = child.geometry.clone();
					clonedGeom.applyMatrix4( child.matrixWorld ); // Move to world position
					geometries.push( clonedGeom );
					mesh_count ++;

				}

			} );

			if ( geometries.length > 1 ) {

				mergedGeometry = await mergeGeometries( geometries );
				mesh = new Mesh( mergedGeometry );

				gcode = await slicer.slice( mesh );

			} else {

				gcode = await slicer.slice( scene );

			}

		} catch ( err ) {

			if ( onError ) onError( err );
			else throw err;

		}

		if ( mesh_count === 0 || gcode.trim().length === 0 ) {

			if ( typeof onError === 'function' ) {

				onError( 'THREE.GCODEExporter: No qualifying objects found or G-code generation failed!' );
				return null;

			} else {

				throw new Error( 'THREE.GCODEExporter: No qualifying objects found or G-code generation failed!' );

			}

		} else {

			if ( mesh ) {

				mergedGeometry.dispose();
				mesh.geometry.dispose();
				mesh.material.dispose();

				if ( geometries.length > 0 ) {

					for ( const geo of geometries ) { geo.dispose(); }

				}

			}

			if ( typeof onDone === 'function' ) {

				onDone( gcode );

			} else {

				return gcode;

			}

		}

	}

}

export { GcodeExporter };
