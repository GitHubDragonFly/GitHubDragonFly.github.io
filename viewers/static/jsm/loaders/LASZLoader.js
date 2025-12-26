import {
    BufferGeometry,
    FileLoader,
    Float32BufferAttribute,
    Loader
} from 'three';

// Created with Microsoft Copilot assistance
// Supporting loading of LAS and LAZ points models

// Loaders.gl LAS loader, mapped in the HTML file with following entries:
//     "loaders-core": "https://esm.sh/@loaders.gl/core@4.3.4"
//     "loaders-las": "https://esm.sh/@loaders.gl/las@4.3.4"

import { LASLoader as LoadersGLLASLoader } from 'loaders-las';
import { load as LASLoad } from 'loaders-core';

class LASZLoader extends Loader {

	load( url, onLoad, onProgress, onError ) {

		const scope = this;

		const loader = new FileLoader( scope.manager );
		loader.setPath( scope.path );
		loader.setResponseType( 'arraybuffer' );
		loader.setRequestHeader( scope.requestHeader );
		loader.setWithCredentials( scope.withCredentials );

		loader.load( url, buffer => {

			// Detect Git LFS pointer file

			if ( buffer.byteLength <= 150 ) {

				const text = new TextDecoder().decode( buffer );

				if ( text.startsWith( 'version https://git-lfs.github.com/spec' ) ) {

					alert( 'The selected file is stored in Git LFS!' );

					if ( onError ) {

						onError( 'The selected file is stored in Git LFS!' );
						return;

					} else {

						console.error( 'The selected file is stored in Git LFS!' );
						return;

					}

				}

			}

			this.parse( buffer )
			.then( geometry => onLoad( geometry ) )
			.catch( err => {

				if ( onError ) onError( err );
				else console.error( err );

			});

		}, onProgress, onError );

	}

	async parse( buffer ) {

		// Decode LAS/LAZ using loaders.gl

		const data = await LASLoad( buffer, LoadersGLLASLoader, { worker: true } );

		const positions = data.attributes.POSITION?.value;
		const colors = data.attributes.COLOR_0?.value || data.attributes.color?.value || null;
		const intensity = data.attributes.intensity?.value || null;
		const classification = data.attributes.classification?.value || null;

		if ( !positions ) {

			throw new Error( 'LAS/LAZ file missing POSITION attribute!' );

		}

		const geometry = new BufferGeometry();

		geometry.setAttribute(

			'position',
			new Float32BufferAttribute( positions, 3 )

		);

		if ( colors ) {

			const normalized = new Float32Array( colors.length );

			// Detect bit depth ( 8‑bit vs 16‑bit )

			let max = 0;

			for ( let i = 0; i < colors.length; i++ ) {

				if ( colors[ i ] > max ) max = colors[ i ];

			}

			if ( max === 0 ) max = 1;

			// Avoid divide by zero

			for ( let i = 0; i < colors.length; i++ ) {

				normalized[ i ] = colors[ i ] / max;

			}

			geometry.setAttribute(

				'color',
				new Float32BufferAttribute( normalized, 3 )

			);

		}

		if ( intensity ) {

			let maxI = 0;

			for ( let i = 0; i < intensity.length; i++ ) {

				if ( intensity[ i ] > maxI ) maxI = intensity[ i ];

			}

			if ( maxI === 0 ) maxI = 1;

			const normalizedI = new Float32Array( intensity.length );

			for ( let i = 0; i < intensity.length; i++ ) {

				normalizedI[ i ] = intensity[ i ] / maxI;

			}

			geometry.setAttribute(

				'intensity',
				new Float32BufferAttribute( normalizedI, 1 )

			);

		}

		if ( classification ) {

			geometry.setAttribute(

				'classification',
				new Float32BufferAttribute( classification, 1 )

			);

		}

		geometry.computeBoundingBox();
		geometry.computeBoundingSphere();

		return geometry;

	}

}

export { LASZLoader };
