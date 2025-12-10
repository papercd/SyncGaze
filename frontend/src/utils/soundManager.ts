// src/utils/soundManager.ts
import * as THREE from 'three';

export class SoundManager {
  private audioLoader: THREE.AudioLoader;
  private listener: THREE.AudioListener;
  private sounds: Map<string, THREE.Audio> = new Map();
  private masterVolume: number = 0.7;
  private sfxVolume: number = 1.0;
  private muted: boolean = false;
  
  constructor() {
    this.audioLoader = new THREE.AudioLoader();
    this.listener = new THREE.AudioListener();
  }

  getListener(): THREE.AudioListener {
    return this.listener;
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.updateAllVolumes();
  }

  setSfxVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    this.updateAllVolumes();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.updateAllVolumes();
  }

  private updateAllVolumes(): void {
    const finalVolume = this.muted ? 0 : this.masterVolume * this.sfxVolume;
    this.sounds.forEach(sound => {
      sound.setVolume(finalVolume);
    });
  }

  async loadSound(name: string, url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.audioLoader.load(
        url,
        (buffer) => {
          const sound = new THREE.Audio(this.listener);
          sound.setBuffer(buffer);
          const finalVolume = this.muted ? 0 : this.masterVolume * this.sfxVolume;
          sound.setVolume(finalVolume);
          this.sounds.set(name, sound);
          console.log(`✅ Loaded sound: ${name}`);
          resolve();
        },
        undefined,
        (error) => {
          console.error(`❌ Failed to load sound ${name}:`, error);
          reject(error);
        }
      );
    });
  }

  async loadWeaponSounds(): Promise<void> {
    const soundsToLoad = [
      { name: 'fire', url: '/sounds/fire.wav' },
      { name: 'reload', url: '/sounds/reload.wav' },
      { name: 'reload_empty', url: '/sounds/reload_empty.wav' },
      { name: 'slideback', url: '/sounds/slideback.wav' }
    ];

    try {
      await Promise.all(
        soundsToLoad.map(({ name, url }) => this.loadSound(name, url))
      );
      console.log('🔊 All weapon sounds loaded');
    } catch (error) {
      console.error('Failed to load some sounds:', error);
    }
  }

  playSound(name: string): void {
    const sound = this.sounds.get(name);
    if (sound) {
      if (sound.isPlaying) {
        sound.stop();
      }
      sound.play();
    }
  }

  playFire(): void {
    this.playSound('fire');
  }

  playReload(): void {
    this.playSound('reload');
  }

  playReloadEmpty(): void {
    this.playSound('reload_empty');
  }

  playSlideback(): void {
    this.playSound('slideback');
  }

  dispose(): void {
    this.sounds.forEach(sound => {
      if (sound.isPlaying) {
        sound.stop();
      }
    });
    this.sounds.clear();
  }
}