import {
    BufferGeometry,
    FileLoader,
    Float32BufferAttribute,
    Loader
} from 'three';

// Created with assistance from Microsoft Copilot and Google Gemini
// Supporting loading of LAS and LAZ points models

// Loaders.gl LAS loader, mapped in the HTML file with following entries:
//     "loaders-core": "https://esm.sh/@loaders.gl/core@4.3.4"
//     "loaders-las": "https://esm.sh/@loaders.gl/las@4.3.4"

import { LASLoader as LoadersGLLASLoader } from 'loaders-las';
import { load as LASLoad } from 'loaders-core';

class LASZLoader extends Loader {

	constructor( manager ) {

		super( manager );

		this.options = {

			skipPoints: 1,
			skipColor: false,
			skipIntensity: false,
			skipClassification: false,
			intensityGammaFactor: 1.0,
			applyIntensityToColor: true

		};

	}

	setSkipPoints( number_of_points ) {

		// Set how many points get processed
		// by reading one in every "number_of_points" points

		if ( !Number.isInteger( number_of_points ) ) {

			number_of_points = 1;

		} else {

			number_of_points = Math.max( Math.min( number_of_points, 10 ), 1 );

		}

		this.options.skipPoints = number_of_points;
		return this;

	}

	setSkipColor( flag ) {

		this.options.skipColor = flag;
		return this;
	}

	setSkipIntensity( flag ) {

		this.options.skipIntensity = flag;
		return this;
	}

	setSkipClassification( flag ) {

		this.options.skipClassification = flag;
		return this;

	}

	setIntensityGammaFactor( gamma ) {

		// Convert to number

		gamma = Number( gamma );

		// If invalid, fall back to default 1.0

		if ( !isFinite( gamma ) || gamma <= 0 ) { gamma = 1.0; }

		// Clamp to a reasonable range

		gamma = Math.min( Math.max( gamma, 0.1 ), 2.0);

		this.options.intensityGammaFactor = gamma;
		return this;

	}

	setApplyIntensityToColor( flag ) {

		this.options.applyIntensityToColor = flag;
		return this;

	}

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

			scope.parse( buffer )
			.then( geometry => onLoad( geometry ) )
			.catch( err => {

				if ( onError ) onError( err );
				else console.error( err );

			});

		}, onProgress, onError );

	}

	async parse( buffer ) {

		// Decode LAS/LAZ using @loaders.gl

		const options = {

			worker: true,
			CDN: 'https://cdn.jsdelivr.net/npm/@loaders.gl',
			las: { skip: this.options.skipPoints, colorDepth: 'auto' }

		};

		const data = await LASLoad( buffer, LoadersGLLASLoader, options );

		if ( !data.attributes.POSITION?.value ) {

			throw new Error( 'LAS/LAZ file missing POSITION attribute!' );

		}

		const geometry = new BufferGeometry();

		geometry.setAttribute(

			'position',
			new Float32BufferAttribute( data.attributes.POSITION.value, 3 )

		);

		if ( data.attributes.COLOR_0?.value && !this.options.skipColor ) {

			const normalized = new Float32Array( data.attributes.COLOR_0.value.length );

			// Detect bit depth ( 8‑bit vs 16‑bit )

			let max = 0;

			for ( let i = 0; i < data.attributes.COLOR_0.value.length; i++ ) {

				if ( data.attributes.COLOR_0.value[ i ] > max ) {

					max = data.attributes.COLOR_0.value[ i ];

				}

			}

			if ( max === 0 ) max = 1.0;

			const invMax = 1.0 / max;

			for ( let i = 0; i < data.attributes.COLOR_0.value.length; i++ ) {

				normalized[ i ] = data.attributes.COLOR_0.value[ i ] * invMax;

			}

			if ( data.attributes.intensity?.value && !this.options.skipIntensity ) {

				let maxI = 0;

				for ( let i = 0; i < data.attributes.intensity.value.length; i++ ) {

					if ( data.attributes.intensity.value[ i ] > maxI ) {

						maxI = data.attributes.intensity.value[ i ];

					}

				}

				if ( maxI === 0 ) maxI = 1.0;

				const invMaxI = 1.0 / maxI;

				const normalizedI = new Float32Array( data.attributes.intensity.value.length );

				for ( let i = 0; i < data.attributes.intensity.value.length; i++ ) {

					normalizedI[ i ] = data.attributes.intensity.value[ i ] * invMaxI;

				}

				if ( this.options.applyIntensityToColor ) {

					const gamma = this.options.intensityGammaFactor;

					for ( let i = 0; i < normalizedI.length; i++ ) {

						const I = Math.pow( normalizedI[ i ], gamma ); // gamma correction

						normalized[ i * 3 + 0 ] *= I;
						normalized[ i * 3 + 1 ] *= I;
						normalized[ i * 3 + 2 ] *= I;

					}

				}

				geometry.userData.intensityMax = maxI;

				geometry.setAttribute(

					'intensity',
					new Float32BufferAttribute( normalizedI, 1 )

				);

			}

			geometry.setAttribute(

				'color',
				new Float32BufferAttribute( normalized, 3 )

			);

		}

		if ( data.attributes.classification?.value && !this.options.skipClassification ) {

			geometry.setAttribute(

				'classification',
				new Float32BufferAttribute( data.attributes.classification.value, 1 )

			);

		}

		geometry.computeBoundingBox();
		geometry.computeBoundingSphere();

		for ( const key in data ) { delete data[ key ]; }

		return geometry;

	}

}

export { LASZLoader };
