// src/utils/cs2Physics.ts
import * as THREE from 'three';

// CS2 Movement Constants
export const CS2_CONSTANTS = {
  // Movement speeds (units/second)
  WALK_SPEED: 130,
  RUN_SPEED: 250,
  CROUCH_SPEED: 85,
  
  // Acceleration and friction
  ACCELERATION: 10,
  GROUND_FRICTION: 4.0,
  AIR_ACCELERATION: 1000,
  
  // Jump mechanics
  JUMP_VELOCITY: 301.99,
  GRAVITY: 800,
  
  // Air control
  AIR_CONTROL: 0.7,
  
  // Stamina (for bunny hop)
  STAMINA_RECOVERY: 0.5,
  STAMINA_COST: 80,
  STAMINA_MAX: 100,
  STAMINA_LAND_COST: 25,
  
  // Weapon sway
  WEAPON_SWAY_AMOUNT: 0.02,
  WEAPON_SWAY_SPEED: 10,
  WEAPON_BOB_AMOUNT: 0.015,
  WEAPON_BOB_SPEED: 0.15,
  
  // Recoil
  RECOIL_RECOVERY: 8,
  RECOIL_PATTERN_SCALE: 1.0,
  
  // Inaccuracy
  BASE_INACCURACY: 0.5,
  MOVE_INACCURACY: 15,
  JUMP_INACCURACY: 40,
  CROUCH_ACCURACY_BONUS: 0.5,
};

export interface MovementState {
  velocity: THREE.Vector3;
  position: THREE.Vector3;
  isGrounded: boolean;
  isCrouching: boolean;
  stamina: number;
  moveSpeed: number;
}

export interface WeaponState {
  recoilIndex: number;
  totalRecoil: THREE.Vector2;
  inaccuracy: number;
  lastShotTime: number;
}

export class CS2Physics {
  private movementState: MovementState;
  private weaponState: WeaponState;
  private wishDir: THREE.Vector3 = new THREE.Vector3();
  
  constructor() {
    this.movementState = {
      velocity: new THREE.Vector3(),
      position: new THREE.Vector3(0, 1.6, 0), // Eye height in CS2
      isGrounded: true,
      isCrouching: false,
      stamina: CS2_CONSTANTS.STAMINA_MAX,
      moveSpeed: CS2_CONSTANTS.RUN_SPEED
    };
    
    this.weaponState = {
      recoilIndex: 0,
      totalRecoil: new THREE.Vector2(),
      inaccuracy: CS2_CONSTANTS.BASE_INACCURACY,
      lastShotTime: 0
    };
  }

  // Ground movement with source engine style acceleration
  private accelerate(wishDir: THREE.Vector3, wishSpeed: number, accel: number, delta: number) {
    const currentSpeed = this.movementState.velocity.dot(wishDir);
    const addSpeed = wishSpeed - currentSpeed;
    
    if (addSpeed <= 0) return;
    
    let accelSpeed = accel * delta * wishSpeed;
    if (accelSpeed > addSpeed) {
      accelSpeed = addSpeed;
    }
    
    this.movementState.velocity.addScaledVector(wishDir, accelSpeed);
  }

  // Air strafing (source engine style)
  private airAccelerate(wishDir: THREE.Vector3, wishSpeed: number, delta: number) {
    const wishSpd = Math.min(wishSpeed, 30); // Cap air speed
    const currentSpeed = this.movementState.velocity.dot(wishDir);
    const addSpeed = wishSpd - currentSpeed;
    
    if (addSpeed <= 0) return;
    
    let accelSpeed = CS2_CONSTANTS.AIR_ACCELERATION * wishSpeed * delta;
    if (accelSpeed > addSpeed) {
      accelSpeed = addSpeed;
    }
    
    this.movementState.velocity.addScaledVector(wishDir, accelSpeed);
  }

  // Friction calculation
  private applyFriction(delta: number) {
    if (!this.movementState.isGrounded) return;
    
    const speed = this.movementState.velocity.length();
    if (speed < 0.1) return;
    
    let drop = speed * CS2_CONSTANTS.GROUND_FRICTION * delta;
    let newSpeed = Math.max(speed - drop, 0);
    
    if (newSpeed > 0) {
      newSpeed /= speed;
    }
    
    this.movementState.velocity.multiplyScalar(newSpeed);
  }

  // Update player movement
  updateMovement(
    input: { forward: number; right: number; jump: boolean; crouch: boolean },
    camera: THREE.Camera,
    delta: number
  ): THREE.Vector3 {
    // Apply gravity
    if (!this.movementState.isGrounded) {
      this.movementState.velocity.y -= CS2_CONSTANTS.GRAVITY * delta;
    }

    // Calculate wish direction from input
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
    if (wishDirLength > 0) {
      this.wishDir.divideScalar(wishDirLength);
    }

    // Handle crouching
    this.movementState.isCrouching = input.crouch;
    this.movementState.moveSpeed = this.movementState.isCrouching 
      ? CS2_CONSTANTS.CROUCH_SPEED 
      : CS2_CONSTANTS.RUN_SPEED;

    // Apply friction
    this.applyFriction(delta);

    // Jump
    if (input.jump && this.movementState.isGrounded && this.movementState.stamina > CS2_CONSTANTS.STAMINA_COST) {
      this.movementState.velocity.y = CS2_CONSTANTS.JUMP_VELOCITY;
      this.movementState.isGrounded = false;
      this.movementState.stamina -= CS2_CONSTANTS.STAMINA_COST;
    }

    // Apply acceleration (ground or air)
    if (this.movementState.isGrounded) {
      this.accelerate(this.wishDir, this.movementState.moveSpeed, CS2_CONSTANTS.ACCELERATION, delta);
    } else {
      // Air control - scale wish direction by air control value
      const airWishSpeed = this.movementState.moveSpeed * CS2_CONSTANTS.AIR_CONTROL;
      this.airAccelerate(this.wishDir, airWishSpeed, delta);
    }

    // Update position
    const deltaPos = this.movementState.velocity.clone().multiplyScalar(delta);
    this.movementState.position.add(deltaPos);

    // Ground check (simplified - you'd want proper raycasting)
    if (this.movementState.position.y <= 1.6) {
      this.movementState.position.y = 1.6;
      this.movementState.velocity.y = 0;
      
      if (!this.movementState.isGrounded) {
        this.movementState.stamina = Math.max(0, this.movementState.stamina - CS2_CONSTANTS.STAMINA_LAND_COST);
      }
      
      this.movementState.isGrounded = true;
    } else {
      this.movementState.isGrounded = false;
    }

    // Stamina recovery
    if (this.movementState.isGrounded) {
      this.movementState.stamina = Math.min(
        CS2_CONSTANTS.STAMINA_MAX, 
        this.movementState.stamina + CS2_CONSTANTS.STAMINA_RECOVERY * delta
      );
    }

    return this.movementState.position.clone();
  }

  // Calculate weapon sway based on movement
  calculateWeaponSway(velocity: THREE.Vector3, time: number): THREE.Vector3 {
    const speed = new THREE.Vector2(velocity.x, velocity.z).length();
    const swayAmount = CS2_CONSTANTS.WEAPON_SWAY_AMOUNT;
    
    const swayX = Math.sin(time * CS2_CONSTANTS.WEAPON_SWAY_SPEED) * swayAmount * speed;
    const swayY = Math.cos(time * CS2_CONSTANTS.WEAPON_SWAY_SPEED * 0.5) * swayAmount * speed;
    const swayZ = Math.sin(time * CS2_CONSTANTS.WEAPON_SWAY_SPEED * 0.7) * swayAmount * speed;
    
    return new THREE.Vector3(swayX, swayY, swayZ);
  }

  // Calculate weapon bob (up/down motion when walking)
  calculateWeaponBob(velocity: THREE.Vector3, time: number): number {
    const speed = new THREE.Vector2(velocity.x, velocity.z).length();
    const bobAmount = CS2_CONSTANTS.WEAPON_BOB_AMOUNT;
    const bobSpeed = CS2_CONSTANTS.WEAPON_BOB_SPEED;
    
    return Math.sin(time * bobSpeed * speed) * bobAmount * speed;
  }

  // Glock-19 specific recoil pattern (simplified)
  private glockRecoilPattern: THREE.Vector2[] = [
    new THREE.Vector2(0, -2.5),
    new THREE.Vector2(-0.5, -2.8),
    new THREE.Vector2(0.5, -3.0),
    new THREE.Vector2(-0.8, -3.2),
    new THREE.Vector2(1.0, -3.5),
    new THREE.Vector2(-1.2, -3.8),
    new THREE.Vector2(1.5, -4.0),
    new THREE.Vector2(-1.8, -4.2),
    new THREE.Vector2(2.0, -4.5),
    new THREE.Vector2(-2.2, -4.8),
  ];

  // Apply recoil on shot
  applyRecoil(): THREE.Vector2 {
    const recoil = this.glockRecoilPattern[this.weaponState.recoilIndex % this.glockRecoilPattern.length].clone();
    recoil.multiplyScalar(CS2_CONSTANTS.RECOIL_PATTERN_SCALE);
    
    this.weaponState.totalRecoil.add(recoil);
    this.weaponState.recoilIndex++;
    this.weaponState.lastShotTime = performance.now();
    
    return recoil;
  }

  // Recover from recoil
  updateRecoilRecovery(delta: number): THREE.Vector2 {
    const timeSinceShot = (performance.now() - this.weaponState.lastShotTime) / 1000;
    
    if (timeSinceShot > 0.4) {
      this.weaponState.recoilIndex = Math.max(0, this.weaponState.recoilIndex - 1);
    }
    
    const recovery = CS2_CONSTANTS.RECOIL_RECOVERY * delta;
    const recoilLength = this.weaponState.totalRecoil.length();
    
    if (recoilLength > 0) {
      const normalized = this.weaponState.totalRecoil.clone().normalize();
      const recoveryAmount = Math.min(recovery, recoilLength);
      this.weaponState.totalRecoil.sub(normalized.multiplyScalar(recoveryAmount));
    }
    
    return this.weaponState.totalRecoil.clone();
  }

  // Calculate weapon inaccuracy (spread)
  calculateInaccuracy(): number {
    let inaccuracy = CS2_CONSTANTS.BASE_INACCURACY;
    
    // Movement penalty
    const speed = new THREE.Vector2(this.movementState.velocity.x, this.movementState.velocity.z).length();
    if (speed > 10) {
      inaccuracy += (speed / this.movementState.moveSpeed) * CS2_CONSTANTS.MOVE_INACCURACY;
    }
    
    // Jump penalty
    if (!this.movementState.isGrounded) {
      inaccuracy += CS2_CONSTANTS.JUMP_INACCURACY;
    }
    
    // Crouch bonus
    if (this.movementState.isCrouching) {
      inaccuracy *= CS2_CONSTANTS.CROUCH_ACCURACY_BONUS;
    }
    
    return inaccuracy;
  }

  getMovementState() {
    return this.movementState;
  }

  getWeaponState() {
    return this.weaponState;
  }
}