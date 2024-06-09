/**
 * -------
 * threeVR (https://github.com/richtr/threeVR)
 * -------
 *
 * W3C Device Orientation control (http://www.w3.org/TR/orientation-event/)
 * with manual user drag (rotate) and pinch (zoom) override handling
 *
 * Author: Rich Tibbett (http://github.com/richtr)
 * License: The MIT License
 *
**/

import {
	Euler,
	EventDispatcher,
	MathUtils,
	Matrix4,
	Quaternion,
	Vector2
} from "three";

class DeviceOrientationController extends EventDispatcher {

	constructor( object, domElement ) {

		super();

		this.object = object;
		this.object.rotation.reorder( 'YXZ' );

		this.element = domElement || document;

		this.freeze = true;

		this.enableManualDrag = true; // enable manual user drag override control by default
		this.enableManualZoom = true; // enable manual user zoom override control by default

		this.useQuaternions = true; // use quaternions for orientation calculation by default

		this.deviceOrientation = {};
		this.screenOrientation = window.screen.orientation || 0;

		// Manual rotate override components
		let startX = 0;
		let startY = 0;
		let currentX = 0;
		let currentY = 0;
		let scrollSpeedX;
		let scrollSpeedY;
		let tmpQuat = new Quaternion();

		// Manual zoom override components
		let tmpFOV;
		let zoomStart = 1;
		let zoomCurrent = 1;
		let zoomP1 = new Vector2();
		let zoomP2 = new Vector2();

		const CONTROLLER_STATE = {
			AUTO: 0,
			MANUAL_ROTATE: 1,
			MANUAL_ZOOM: 2
		};

		var appState = CONTROLLER_STATE.AUTO;

		const CONTROLLER_EVENT = {
			CALIBRATE_COMPASS: 'compassneedscalibration',
			SCREEN_ORIENTATION: 'orientationchange',
			MANUAL_CONTROL: 'userinteraction', // userinteractionstart, userinteractionend
			ZOOM_CONTROL: 'zoom', // zoomstart, zoomend
			ROTATE_CONTROL: 'rotate', // rotatestart, rotateend
		};

		// Consistent Object Field-Of-View fix components
		let startClientHeight = window.innerHeight;
		let startFOVFrustrumHeight = 2000.0 * Math.tan( MathUtils.degToRad( ( this.object.fov || 75.0 ) / 2.0 ) );
		let relativeFOVFrustrumHeight;
		let relativeVerticalFOV;

		let deviceQuat = new Quaternion();

		let fireEvent = function() {

			var eventData;

			return function (name) {

				eventData = arguments || {};

				eventData.type = name;
				eventData.target = this;

				this.dispatchEvent( eventData );

			}.bind( this );

		}.bind( this )();

		this.constrainObjectFOV = function() {

			relativeFOVFrustrumHeight = startFOVFrustrumHeight * ( window.innerHeight / startClientHeight );
			relativeVerticalFOV = MathUtils.radToDeg( 2.0 * Math.atan( relativeFOVFrustrumHeight / 2000.0 ) );

			this.object.fov = relativeVerticalFOV;

		}.bind( this );

		this.onDeviceOrientationChange = function( event ) {

			this.deviceOrientation = event;

		}.bind( this );

		this.onScreenOrientationChange = function() {

			this.screenOrientation = window.screen.orientation || 0;
			fireEvent( CONTROLLER_EVENT.SCREEN_ORIENTATION );

		}.bind( this );


		this.onCompassNeedsCalibration = function ( event ) {

			event.preventDefault();
			fireEvent(CONTROLLER_EVENT.CALIBRATE_COMPASS);

		}.bind( this );

		this.onDocumentMouseDown = function ( event ) {

			if ( this.enableManualDrag !== true ) return;

			event.preventDefault();

			appState = CONTROLLER_STATE.MANUAL_ROTATE;

			this.freeze = true;

			tmpQuat.copy( this.object.quaternion );

			startX = currentX = event.pageX;
			startY = currentY = event.pageY;

			// Set consistent scroll speed based on current viewport width/height

			scrollSpeedX = ( 1600.0 / window.innerWidth ) * 0.2;
			scrollSpeedY = ( 900.0 / window.innerHeight ) * 0.2;

			this.element.addEventListener( 'pointermove', this.onDocumentMouseMove, false );
			this.element.addEventListener( 'pointerup', this.onDocumentMouseUp, false );

			fireEvent( CONTROLLER_EVENT.MANUAL_CONTROL + 'start' );
			fireEvent( CONTROLLER_EVENT.ROTATE_CONTROL + 'start' );

		}.bind( this );

		this.onDocumentMouseMove = function( event ) {

			currentX = event.pageX;
			currentY = event.pageY;

		}.bind( this );

		this.onDocumentMouseUp = function( event ) {

			this.element.removeEventListener( 'pointermove', this.onDocumentMouseMove, false );
			this.element.removeEventListener( 'pointerup', this.onDocumentMouseUp, false );

			appState = CONTROLLER_STATE.AUTO;

			this.freeze = false;

			fireEvent( CONTROLLER_EVENT.MANUAL_CONTROL + 'end' );
			fireEvent( CONTROLLER_EVENT.ROTATE_CONTROL + 'end' );

		}.bind( this );

		this.onDocumentTouchStart = function( event ) {

			event.preventDefault();
			event.stopPropagation();

			switch ( event.touches.length ) {

				case 1: // ROTATE
					if ( this.enableManualDrag !== true ) return;

					appState = CONTROLLER_STATE.MANUAL_ROTATE;

					this.freeze = true;

					tmpQuat.copy( this.object.quaternion );

					startX = currentX = event.touches[ 0 ].pageX;
					currentX = startX;
					startY = currentY = event.touches[ 0 ].pageY;
					currentY = startY;

					// Set consistent scroll speed based on current viewport width/height

					scrollSpeedX = ( 1600.0 / window.innerWidth ) * 0.1;
					scrollSpeedY = ( 900.0 / window.innerHeight ) * 0.1;

					this.element.addEventListener( 'touchmove', this.onDocumentTouchMove, false );
					this.element.addEventListener( 'touchend', this.onDocumentTouchEnd, false );

					fireEvent( CONTROLLER_EVENT.MANUAL_CONTROL + 'start' );
					fireEvent( CONTROLLER_EVENT.ROTATE_CONTROL + 'start' );

					break;

				case 2: // ZOOM
					if ( this.enableManualZoom !== true ) return;

					appState = CONTROLLER_STATE.MANUAL_ZOOM;

					this.freeze = true;

					tmpFOV = this.object.fov;

					zoomP1.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );
					zoomP2.set( event.touches[ 1 ].pageX, event.touches[ 1 ].pageY );

					zoomStart = zoomCurrent = zoomP1.distanceTo( zoomP2 );

					this.element.addEventListener( 'touchmove', this.onDocumentTouchMove, false );
					this.element.addEventListener( 'touchend', this.onDocumentTouchEnd, false );

					fireEvent( CONTROLLER_EVENT.MANUAL_CONTROL + 'start' );
					fireEvent( CONTROLLER_EVENT.ZOOM_CONTROL + 'start' );

					break;

			}

		}.bind( this );

		this.onDocumentTouchMove = function( event ) {

			switch ( event.touches.length ) {

				case 1:
					currentX = event.touches[ 0 ].pageX;
					currentY = event.touches[ 0 ].pageY;
					break;

				case 2:
					zoomP1.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );
					zoomP2.set( event.touches[ 1 ].pageX, event.touches[ 1 ].pageY );
					break;

			}

		}.bind( this );

		this.onDocumentTouchEnd = function( event ) {

			this.element.removeEventListener( 'touchmove', this.onDocumentTouchMove, false );
			this.element.removeEventListener( 'touchend', this.onDocumentTouchEnd, false );

			if ( appState === CONTROLLER_STATE.MANUAL_ROTATE ) {

				appState = CONTROLLER_STATE.AUTO; // reset control state

				this.freeze = false;

				fireEvent( CONTROLLER_EVENT.MANUAL_CONTROL + 'end' );
				fireEvent( CONTROLLER_EVENT.ROTATE_CONTROL + 'end' );

			} else if ( appState === CONTROLLER_STATE.MANUAL_ZOOM ) {

				// this.constrainObjectFOV(); // re-instate original object FOV

				appState = CONTROLLER_STATE.AUTO; // reset control state

				this.freeze = false;

				fireEvent( CONTROLLER_EVENT.MANUAL_CONTROL + 'end' );
				fireEvent( CONTROLLER_EVENT.ZOOM_CONTROL + 'end' );

			}

		}.bind( this );

		let createQuaternion = function() {

			let finalQuaternion = new Quaternion();

			let deviceEuler = new Euler();

			let screenTransform = new Quaternion();

			let worldTransform = new Quaternion( -Math.sqrt( 0.5 ), 0, 0, Math.sqrt( 0.5 ) ); // - PI/2 around the x-axis

			let minusHalfAngle = 0;

			return function( alpha, beta, gamma, screenOrientation ) {

				deviceEuler.set( beta, alpha, -gamma, 'YXZ' );

				finalQuaternion.setFromEuler( deviceEuler );

				minusHalfAngle = -screenOrientation / 2.0;

				screenTransform.set( 0, Math.sin( minusHalfAngle ), 0, Math.cos( minusHalfAngle ));

				finalQuaternion.multiply( screenTransform );

				finalQuaternion.multiply( worldTransform );

				return finalQuaternion;

			};

		} ();

		var createRotationMatrix = function() {

			let finalMatrix = new Matrix4();

			let deviceEuler = new Euler();
			let screenEuler = new Euler();

			let worldEuler = new Euler( -Math.PI / 2.0, 0, 0, 'YXZ' ); // - PI/2 around the x-axis

			let screenTransform = new Matrix4();
			let worldTransform = new Matrix4();

			worldTransform.makeRotationFromEuler( worldEuler );

			return function( alpha, beta, gamma, screenOrientation ) {

				deviceEuler.set( beta, alpha, -gamma, 'YXZ' );

				finalMatrix.identity();

				finalMatrix.makeRotationFromEuler( deviceEuler );

				screenEuler.set( 0, -screenOrientation, 0, 'YXZ' );

				screenTransform.identity();

				screenTransform.makeRotationFromEuler( screenEuler );

				finalMatrix.multiply( screenTransform );

				finalMatrix.multiply( worldTransform );

				return finalMatrix;

			};

		} ();

		this.updateManualMove = function() {

			let lat, lon;
			let phi, theta;

			let rotation = new Euler( 0, 0, 0, 'YXZ' );

			let rotQuat = new Quaternion();
			let objQuat = new Quaternion();

			let tmpZ, objZ, realZ;

			let zoomFactor, minZoomFactor = 1; // maxZoomFactor = Infinity

			return function() {

				objQuat.copy( tmpQuat );

				if ( appState === CONTROLLER_STATE.MANUAL_ROTATE ) {

					lat = ( startY - currentY ) * scrollSpeedY;
					lon = ( startX - currentX ) * scrollSpeedX;

					phi = MathUtils.degToRad( lat );
					theta = MathUtils.degToRad( lon );

					rotQuat.set( 0, Math.sin( theta / 2.0 ), 0, Math.cos( theta / 2.0 ));

					objQuat.multiply( rotQuat );

					rotQuat.set( Math.sin( phi / 2.0 ), 0, 0, Math.cos( phi / 2.0 ));

					objQuat.multiply( rotQuat );

					// Remove introduced z-axis rotation and add device's current z-axis rotation

					tmpZ = rotation.setFromQuaternion( tmpQuat, 'YXZ' ).z;
					objZ = rotation.setFromQuaternion( objQuat, 'YXZ' ).z;
					realZ = rotation.setFromQuaternion( deviceQuat || tmpQuat, 'YXZ' ).z;

					rotQuat.set( 0, 0, Math.sin( ( realZ - tmpZ ) / 2.0 ), Math.cos( ( realZ - tmpZ ) / 2.0 ) );

					tmpQuat.multiply( rotQuat );

					rotQuat.set( 0, 0, Math.sin( ( realZ - objZ ) / 2.0 ), Math.cos( ( realZ - objZ ) / 2.0 ) );

					objQuat.multiply( rotQuat );

					this.object.quaternion.copy( objQuat );

				} else if ( appState === CONTROLLER_STATE.MANUAL_ZOOM ) {

					zoomCurrent = zoomP1.distanceTo( zoomP2 );

					zoomFactor = zoomStart / zoomCurrent;

					if ( zoomFactor <= minZoomFactor ) {

						this.object.fov = tmpFOV * zoomFactor;

						this.object.updateProjectionMatrix();

					}

					// Add device's current z-axis rotation

					if ( deviceQuat ) {

						tmpZ = rotation.setFromQuaternion( tmpQuat, 'YXZ' ).z;
						realZ = rotation.setFromQuaternion( deviceQuat, 'YXZ' ).z;

						rotQuat.set( 0, 0, Math.sin( ( realZ - tmpZ ) / 2.0 ), Math.cos( ( realZ - tmpZ ) / 2.0 ) );

						tmpQuat.multiply( rotQuat );

						this.object.quaternion.copy( tmpQuat );

					}

				}

			};

		} ();

		this.updateDeviceMove = function() {

			let alpha, beta, gamma, orient;

			let deviceMatrix;

			return function() {

				alpha = MathUtils.degToRad( this.deviceOrientation.alpha || 0 ); // Z
				beta = MathUtils.degToRad( this.deviceOrientation.beta || 0 ); // X'
				gamma = MathUtils.degToRad( this.deviceOrientation.gamma || 0 ); // Y''
				orient = MathUtils.degToRad( this.screenOrientation || 0 ); // O

				// only process non-zero 3-axis data

				if ( alpha !== 0 && beta !== 0 && gamma !== 0 ) {

					if ( this.useQuaternions ) {

						deviceQuat = createQuaternion( alpha, beta, gamma, orient );

					} else {

						deviceMatrix = createRotationMatrix( alpha, beta, gamma, orient );

						deviceQuat.setFromRotationMatrix( deviceMatrix );

					}

					if ( this.freeze ) return;

					//this.object.quaternion.slerp( deviceQuat, 0.07 ); // smoothing
					this.object.quaternion.copy( deviceQuat );

				}

			};

		} ();

		this.update = function () {

			this.updateDeviceMove();

			if ( appState !== CONTROLLER_STATE.AUTO ) {

				this.updateManualMove();

			}

		};

		this.connect = function() {

			window.addEventListener( 'resize', this.constrainObjectFOV, false );

			window.addEventListener( 'orientationchange', this.onScreenOrientationChange, false );
			window.addEventListener( 'deviceorientation', this.onDeviceOrientationChange, false );

			window.addEventListener( 'compassneedscalibration', this.onCompassNeedsCalibration, false );

			this.element.addEventListener( 'pointerdown', this.onDocumentMouseDown, false );
			this.element.addEventListener( 'touchstart', this.onDocumentTouchStart, false );

			this.freeze = false;

		};

		this.disconnect = function() {

			this.freeze = true;

			window.removeEventListener( 'resize', this.constrainObjectFOV, false );

			window.removeEventListener( 'orientationchange', this.onScreenOrientationChange, false );
			window.removeEventListener( 'deviceorientation', this.onDeviceOrientationChange, false );

			window.removeEventListener( 'compassneedscalibration', this.onCompassNeedsCalibration, false );

			this.element.removeEventListener( 'pointerdown', this.onDocumentMouseDown, false );
			this.element.removeEventListener( 'touchstart', this.onDocumentTouchStart, false );

		};

	}

}

export { DeviceOrientationController };
