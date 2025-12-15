import { DefaultLoadingManager } from "three";
import Polyslice from "https://cdn.jsdelivr.net/npm/@jgphilpott/polyslice@25.12.8/dist/index.browser.esm.js";

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

		let mesh_count = 0, gcode = '';

		scene.updateMatrixWorld( true, true );

		function parse_objects() {

			scene.traverse( function ( object ) {

				if ( object.isMesh && object.geometry ) {

					mesh_count ++;

					const cloned = object.clone();
					gcode += slicer.slice( cloned ) + '\n';

				}

			} );

		}

		parse_objects();

		if ( mesh_count === 0 || gcode.trim().length === 0 ) {

			if ( typeof onError === 'function' ) {

				onError( 'THREE.GCODEExporter: No qualifying objects found or G-code generation failed!' );
				return null;

			} else {

				throw new Error( 'THREE.GCODEExporter: No qualifying objects found or G-code generation failed!' );

			}

		} else {

			if ( typeof onDone === 'function' ) {

				onDone( gcode );

			} else {

				return gcode;

			}

		}

	}

}

export { GcodeExporter };
