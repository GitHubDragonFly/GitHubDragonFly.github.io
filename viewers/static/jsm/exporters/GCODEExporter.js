import { DefaultLoadingManager } from "three";
import Polyslice from "https://cdn.jsdelivr.net/npm/@jgphilpott/polyslice@25.12.8/dist/index.browser.esm.js";

/**
*
*	Based on: https://github.com/jgphilpott/polyslice
*
*	Example Usage:
*
*		const { GcodeExporter } = await import( "path-to-exporter/GCODEExporter.js" );
*
*		const exporter = new GcodeExporter();
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

		try {

			// Check if Polyslice is loaded

			if ( typeof Polyslice === 'undefined' ) {

				alert( 'Polyslice library failed to load.\n\nCheck your network connection.' );
				return;
			}

		} catch ( error ) {

			alert( 'Polyslice external library is required!' );
			console.log(error);
			return;

		}

		const scope = this;

		// Printer defaults to: 'Ender3'
		// See documentation for other preconfigured printers:
		// https://github.com/jgphilpott/polyslice/blob/dc361b12793fa29f7887da14adc1ae3497ba21b2/docs/config/PRINTER.md

		// Filament defaults to: 'GenericPLA'
		// See documentation for other preconfigured filaments:
		// https://github.com/jgphilpott/polyslice/blob/dc361b12793fa29f7887da14adc1ae3497ba21b2/docs/config/FILAMENT.md

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

		function parse_objects() {

			scene.traverse( function ( object ) {

				if ( object.isMesh ) {

					mesh_count ++;

					gcode = slicer.slice( object );

				}

			} );

		}

		parse_objects();

		if ( mesh_count === 0 ) {

			if ( typeof onError === 'function' ) {

				onError( 'THREE.GCODEExporter: No qualifying objects found!' );
				return null;

			} else {

				throw new Error( 'THREE.GCODEExporter: No qualifying objects found!' );

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
