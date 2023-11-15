import {
	BufferGeometry,
	Color,
	FileLoader,
	Float32BufferAttribute,
	Loader
} from 'three';

class XYZLoader extends Loader {

	load( url, onLoad, onProgress, onError ) {

		const scope = this;

		const loader = new FileLoader( this.manager );
		loader.setPath( this.path );
		loader.setRequestHeader( this.requestHeader );
		loader.setWithCredentials( this.withCredentials );
		loader.load( url, function ( text ) {

			try {

				onLoad( scope.parse( text ) );

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

	parse( text ) {

		const lines = text.split( '\n' );

		const vertices = [];
		const colors = [];
		const normals = [];
		const color = new Color();

		for ( let line of lines ) {

			line = line.trim();

			if ( line.startsWith( '#' ) || line.startsWith( '//' ) ) continue; // skip comments

			if ( line.indexOf( ';' ) > -1 ) {

				const lineValues = line.split( ';' );

				// XYZ

				vertices.push( parseFloat( lineValues[ 0 ] ) );
				vertices.push( parseFloat( lineValues[ 1 ] ) );
				vertices.push( parseFloat( lineValues[ 2 ] ) );

			} else {

				const lineValues = line.split( /\s+/ );

				if ( lineValues.length >= 3 ) {

					// XYZ

					vertices.push( parseFloat( lineValues[ 0 ] ) );
					vertices.push( parseFloat( lineValues[ 1 ] ) );
					vertices.push( parseFloat( lineValues[ 2 ] ) );

				}

				if ( lineValues.length === 4 ) {

					// possible RGB or RGBA UInt32 value so parse it and convert to hex
					let hex_value = ( parseInt( lineValues[ 3 ] ) ).toString( 16 ).padEnd( 6, '0' );

					// RGB

					const r = parseInt( hex_value.substring( 0, 2 ), 16 ) / 255.0;
					const g = parseInt( hex_value.substring( 2, 4 ), 16 ) / 255.0;
					const b = parseInt( hex_value.substring( 4, 6 ), 16 ) / 255.0;

					color.setRGB( r, g, b ).convertSRGBToLinear();

					colors.push( color.r, color.g, color.b );

				}

				if ( lineValues.length >= 6 ) {

					// RGB

					const r = parseFloat( lineValues[ 3 ] ) / 255.0;
					const g = parseFloat( lineValues[ 4 ] ) / 255.0;
					const b = parseFloat( lineValues[ 5 ] ) / 255.0;

					color.setRGB( r, g, b ).convertSRGBToLinear();

					colors.push( color.r, color.g, color.b );

				}

				if ( lineValues.length >= 9 ) {

					// Normals

					normals.push( parseFloat( lineValues[ 6 ] ) );
					normals.push( parseFloat( lineValues[ 7 ] ) );
					normals.push( parseFloat( lineValues[ 8 ] ) );

				}

			}

		}

		const geometry = new BufferGeometry();
		geometry.setAttribute( 'position', new Float32BufferAttribute( vertices, 3 ) );

		if ( colors.length > 0 ) {

			geometry.setAttribute( 'color', new Float32BufferAttribute( colors, 3 ) );

		}

		if ( normals.length > 0 ) {

			geometry.setAttribute( 'normal', new THREE.Float32BufferAttribute( normals, 3 ) );

		}

		return geometry;

	}

}

export { XYZLoader };
