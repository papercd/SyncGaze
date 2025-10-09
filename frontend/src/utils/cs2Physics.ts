// frontend/src/utils/cs2Physics.ts
import * as THREE from 'three';

// CS2/Valorant-inspired Movement Constants
export const CS2_CONSTANTS = {
  // Movement speeds (units per second) - tuned for CS2 feel
  WALK_SPEED: 2.6,           // ~260 u/s in CS2 scaled down
  RUN_SPEED: 2.6,            // Same as walk (no sprint in CS2/Val)
  CROUCH_MOVE_SPEED: 1.0,    // Movement speed while crouched
  
  // Acceleration values
  ACCELERATION: 50,          // Ground acceleration - snappy response
  GROUND_FRICTION: 12.0,     // How quickly you stop
  AIR_ACCELERATION: 10,      // Air control
  STOP_SPEED: 1.0,           // Speed below which extra friction is applied
  
  // Jump physics
  JUMP_VELOCITY: 5.2,        // Jump height
  GRAVITY: 20,               // Fall speed
  
  // Weapon movement
  WEAPON_SWAY_AMOUNT: 0.003,
  WEAPON_SWAY_SPEED: 5,
  WEAPON_BOB_AMOUNT: 0.015,
  WEAPON_BOB_SPEED: 10,
  
  // Camera
  HEAD_HEIGHT: 1.7,          // Standing eye height
  CROUCH_HEIGHT: 1.2,        // Crouching eye height
  CROUCH_TRANSITION_SPEED: 8, // How fast you crouch/uncrouch
};

export interface MovementState {
  velocity: THREE.Vector3;
  position: THREE.Vector3;
  isGrounded: boolean;
  isCrouching: boolean;
  currentHeight: number;
  targetHeight: number;
}

export class CS2Physics {
  private movementState: MovementState;
  private wishDir: THREE.Vector3 = new THREE.Vector3();
  
  constructor() {
    this.movementState = {
      velocity: new THREE.Vector3(),
      position: new THREE.Vector3(0, CS2_CONSTANTS.HEAD_HEIGHT, 0),
      isGrounded: true,
      isCrouching: false,
      currentHeight: CS2_CONSTANTS.HEAD_HEIGHT,
      targetHeight: CS2_CONSTANTS.HEAD_HEIGHT
    };
  }

  private accelerate(wishDir: THREE.Vector3, wishSpeed: number, accel: number, delta: number) {
    // Get current speed in wish direction
    const currentSpeed = this.movementState.velocity.dot(wishDir);
    const addSpeed = wishSpeed - currentSpeed;
    
    if (addSpeed <= 0) return;
    
    // Calculate acceleration speed
    let accelSpeed = accel * delta * wishSpeed;
    
    // Cap it
    if (accelSpeed > addSpeed) {
      accelSpeed = addSpeed;
    }
    
    // Add to velocity
    this.movementState.velocity.addScaledVector(wishDir, accelSpeed);
  }

  private applyFriction(delta: number) {
    if (!this.movementState.isGrounded) return;
    
    const speed = this.movementState.velocity.length();
    
    // DEBUG: Log when speed is very low
    if (speed < 0.5 && speed > 0.001) {
      console.log('🐌 Low speed:', speed.toFixed(4), 'velocity:', this.movementState.velocity);
    }
    
    // Stop completely if very slow
    if (speed < 0.1) {
      console.log('✋ STOPPING at speed:', speed.toFixed(4));
      this.movementState.velocity.set(0, 0, 0);
      return;
    }
    
    // Enhanced friction when below stop speed
    let control = speed < CS2_CONSTANTS.STOP_SPEED ? CS2_CONSTANTS.STOP_SPEED : speed;
    let drop = control * CS2_CONSTANTS.GROUND_FRICTION * delta;
    
    // Calculate new speed
    let newSpeed = speed - drop;
    
    // If friction would reverse direction, just stop
    if (newSpeed < 0) {
      console.log('✋ STOPPING (friction reversed) at speed:', speed.toFixed(4));
      this.movementState.velocity.set(0, 0, 0);
      return;
    }
    
    // Scale the velocity
    newSpeed /= speed;
    this.movementState.velocity.multiplyScalar(newSpeed);
  }

  updateMovement(
    input: { forward: number; right: number; jump: boolean; crouch: boolean },
    camera: THREE.Camera,
    delta: number
  ): THREE.Vector3 {
    // Smooth crouch transition
    this.movementState.targetHeight = input.crouch 
      ? CS2_CONSTANTS.CROUCH_HEIGHT 
      : CS2_CONSTANTS.HEAD_HEIGHT;
    
    this.movementState.currentHeight = THREE.MathUtils.lerp(
      this.movementState.currentHeight,
      this.movementState.targetHeight,
      CS2_CONSTANTS.CROUCH_TRANSITION_SPEED * delta
    );
    
    this.movementState.isCrouching = Math.abs(this.movementState.currentHeight - CS2_CONSTANTS.CROUCH_HEIGHT) < 0.1;

    // Apply gravity if in air
    if (!this.movementState.isGrounded) {
      this.movementState.velocity.y -= CS2_CONSTANTS.GRAVITY * delta;
    }

    // Calculate wish direction (where player wants to move)
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0;
    forward.normalize();
    
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    right.y = 0;
    right.normalize();

    this.wishDir.set(0, 0, 0);
    this.wishDir.addScaledVector(forward, input.forward);
    this.wishDir.addScaledVector(right, input.right);
    
    const wishDirLength = this.wishDir.length();
    const wishSpeed = this.movementState.isCrouching ? CS2_CONSTANTS.CROUCH_MOVE_SPEED : CS2_CONSTANTS.WALK_SPEED;
    
    if (wishDirLength > 0.001) {
      this.wishDir.divideScalar(wishDirLength);
      
      // Diagonal movement shouldn't be faster (CS2 style)
      const normalizedSpeed = Math.min(wishDirLength, 1) * wishSpeed;
      
      // Apply friction before acceleration
      this.applyFriction(delta);
      
      // Accelerate
      if (this.movementState.isGrounded) {
        this.accelerate(this.wishDir, normalizedSpeed, CS2_CONSTANTS.ACCELERATION, delta);
      } else {
        this.accelerate(this.wishDir, normalizedSpeed, CS2_CONSTANTS.AIR_ACCELERATION, delta);
      }
    } else {
      // No input - just apply friction
      this.applyFriction(delta);
    }

    // Jump - no stamina restrictions
    if (input.jump && this.movementState.isGrounded) {
      this.movementState.velocity.y = CS2_CONSTANTS.JUMP_VELOCITY;
      this.movementState.isGrounded = false;
    }

    // Update position
    const deltaPos = this.movementState.velocity.clone().multiplyScalar(delta);
    this.movementState.position.add(deltaPos);

    // Ground check with smooth height
    if (this.movementState.position.y <= this.movementState.currentHeight) {
      this.movementState.position.y = this.movementState.currentHeight;
      
      // Only zero Y velocity if falling
      if (this.movementState.velocity.y < 0) {
        this.movementState.velocity.y = 0;
      }
      
      this.movementState.isGrounded = true;
    } else {
      this.movementState.isGrounded = false;
    }

    return this.movementState.position.clone();
  }

  calculateWeaponSway(velocity: THREE.Vector3, time: number, delta: number): THREE.Vector3 {
    const speed = new THREE.Vector2(velocity.x, velocity.z).length();
    const swayAmount = CS2_CONSTANTS.WEAPON_SWAY_AMOUNT;
    
    const swayX = Math.sin(time * CS2_CONSTANTS.WEAPON_SWAY_SPEED) * swayAmount * speed;
    const swayY = Math.cos(time * CS2_CONSTANTS.WEAPON_SWAY_SPEED * 0.5) * swayAmount * speed;
    const swayZ = Math.sin(time * CS2_CONSTANTS.WEAPON_SWAY_SPEED * 0.7) * swayAmount * speed * 0.5;
    
    return new THREE.Vector3(swayX, swayY, swayZ);
  }

  calculateWeaponBob(velocity: THREE.Vector3, time: number, delta: number): number {
    if (!this.movementState.isGrounded) return 0;
    
    const speed = new THREE.Vector2(velocity.x, velocity.z).length();
    const normalizedSpeed = speed / CS2_CONSTANTS.WALK_SPEED;
    const bobAmount = CS2_CONSTANTS.WEAPON_BOB_AMOUNT;
    const bobSpeed = CS2_CONSTANTS.WEAPON_BOB_SPEED;
    
    return Math.sin(time * bobSpeed * normalizedSpeed) * bobAmount * normalizedSpeed;
  }

  getMovementState() {
    return this.movementState;
  }

  // Weapon recoil methods remain the same...
  private glockRecoilPattern: THREE.Vector2[] = [
    new THREE.Vector2(0, -2.5),
    new THREE.Vector2(-0.5, -2.8),
    new THREE.Vector2(0.5, -3.0),
    new THREE.Vector2(-0.8, -3.2),
    new THREE.Vector2(1.0, -3.5),
  ];

  private weaponState = {
    recoilIndex: 0,
    totalRecoil: new THREE.Vector2(),
    lastShotTime: 0
  };

  applyRecoil(multiplier: number = 1): THREE.Vector2 {
    const recoil = this.glockRecoilPattern[this.weaponState.recoilIndex % this.glockRecoilPattern.length].clone();
    recoil.multiplyScalar(0.3 * multiplier); // Apply multiplier here
    
    this.weaponState.totalRecoil.add(recoil);
    this.weaponState.recoilIndex++;
    this.weaponState.lastShotTime = performance.now();
    
    return recoil;
  }

  updateRecoilRecovery(delta: number): THREE.Vector2 {
    const timeSinceShot = (performance.now() - this.weaponState.lastShotTime) / 1000;
    
    if (timeSinceShot > 0.4) {
      this.weaponState.recoilIndex = Math.max(0, this.weaponState.recoilIndex - 1);
    }
    
    const recovery = 3 * delta;
    const recoilLength = this.weaponState.totalRecoil.length();
    
    if (recoilLength > 0) {
      const normalized = this.weaponState.totalRecoil.clone().normalize();
      const recoveryAmount = Math.min(recovery, recoilLength);
      this.weaponState.totalRecoil.sub(normalized.multiplyScalar(recoveryAmount));
    }
    
    return this.weaponState.totalRecoil.clone();
  }

  getWeaponState() {
    return this.weaponState;
  }
}