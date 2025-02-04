import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { createNoise2D } from 'https://cdn.jsdelivr.net/npm/simplex-noise@4.0.1/dist/esm/simplex-noise.js';

class Game {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);
    
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.controls = null;
    this.player = null;
    this.moveDirection = new THREE.Vector3();
    this.enemies = [];
    this.bullets = [];
    this.playerHealth = 100;
    this.weaponModel = null;
    this.isGameStarted = false;
    this.mountains = [];
    this.isShooting = false;
    this.shootInterval = null;
    this.isDead = false;
    this.invulnerabilityTimer = null;
    this.isInvulnerable = false;
    this.invulnerabilityDuration = 500; // 0.5 seconds of invulnerability
    
    this.noise2D = createNoise2D();
    this.currentWeapon = 'pistol';
    this.weapons = {
      pistol: {
        name: 'Pistol',
        damage: 34,
        fireRate: 100,
        bulletSpeed: 10
      },
      sniper: {
        name: 'Sniper',
        damage: 100,
        fireRate: 1000,
        bulletSpeed: 25
      }
    };
    this.init();
  }

  init() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);

    this.setupPointerLock();
    
    const instructions = document.getElementById('instructions');
    instructions.addEventListener('click', () => {
      if (!this.isGameStarted) {
        instructions.style.display = 'none';
        this.startGame();
      }
    });

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    this.setupWeaponSwitching();
  }

  startGame() {
    this.player = new Player(this.camera);
    this.createWeaponModel();
    this.createOpenWorld();
    this.spawnDiverseEnemies(50);  
    this.createHUD();
    this.updateHealthDisplay();
    
    this.controls.lock();
    this.isGameStarted = true;
    
    this.animate();
  }

  setupPointerLock() {
    this.controls = new PointerLockControls(this.camera, document.body);
    
    this.controls.addEventListener('lock', () => {
      document.addEventListener('keydown', this.handleKeyDown.bind(this));
      document.addEventListener('keyup', this.handleKeyUp.bind(this));
      
      document.addEventListener('keydown', this.handleWeaponSwitch.bind(this));
    });

    this.controls.addEventListener('unlock', () => {
      document.removeEventListener('keydown', this.handleKeyDown.bind(this));
      document.removeEventListener('keyup', this.handleKeyUp.bind(this));
      
      document.removeEventListener('keydown', this.handleWeaponSwitch.bind(this));
    });
  }

  setupWeaponSwitching() {
    const weaponSlots = document.querySelectorAll('.weapon-slot');
    weaponSlots.forEach(slot => {
      slot.addEventListener('click', () => {
        const weaponType = slot.dataset.weapon;
        this.switchWeapon(weaponType);
      });
    });
  }

  switchWeapon(weaponType) {
    if (this.currentWeapon === weaponType) return;

    this.currentWeapon = weaponType;
    
    // Update weapon visual
    document.querySelectorAll('.weapon-slot').forEach(slot => {
      slot.classList.toggle('active', slot.dataset.weapon === weaponType);
    });

    // Remove existing weapon model
    if (this.weaponModel) {
      this.camera.remove(this.weaponModel);
    }

    // Create new weapon model
    this.createWeaponModel(weaponType);
  }

  createWeaponModel(weaponType = 'pistol') {
    const gunGroup = new THREE.Group();
    
    if (weaponType === 'pistol') {
      const gunBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.1, 0.5),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      
      const gunHandle = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.2, 0.08),
        new THREE.MeshBasicMaterial({ color: 0xff6600 })
      );
      gunHandle.position.set(0, -0.1, -0.1);
      
      gunGroup.add(gunBody);
      gunGroup.add(gunHandle);
    } else if (weaponType === 'sniper') {
      const sniperBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.1, 1),
        new THREE.MeshBasicMaterial({ color: 0x444444 })
      );
      
      const scope = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 0.3, 32),
        new THREE.MeshBasicMaterial({ color: 0x222222 })
      );
      scope.rotation.z = Math.PI / 2;
      scope.position.set(0, 0.1, 0.5);
      
      const stock = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.2, 0.1),
        new THREE.MeshBasicMaterial({ color: 0x555555 })
      );
      stock.position.set(0, -0.1, -0.3);
      
      gunGroup.add(sniperBody);
      gunGroup.add(scope);
      gunGroup.add(stock);
    }
    
    gunGroup.position.set(0.3, -0.3, -0.5);
    
    this.weaponModel = gunGroup;
    this.camera.add(this.weaponModel);
    this.scene.add(this.camera);
  }

  startShooting() {
    if (this.controls.isLocked && this.isGameStarted && !this.isShooting) {
      this.isShooting = true;
      this.player.shoot(this, this.currentWeapon);
      
      this.shootInterval = setInterval(() => {
        if (this.isShooting) {
          this.player.shoot(this, this.currentWeapon);
        }
      }, this.weapons[this.currentWeapon].fireRate);
    }
  }

  stopShooting() {
    this.isShooting = false;
    if (this.shootInterval) {
      clearInterval(this.shootInterval);
      this.shootInterval = null;
    }
  }

  handleKeyDown(event) {
    switch(event.code) {
      case 'KeyW': this.moveDirection.z = -1; break;
      case 'KeyS': this.moveDirection.z = 1; break;
      case 'KeyA': this.moveDirection.x = -1; break;
      case 'KeyD': this.moveDirection.x = 1; break;
      case 'Space': 
        if (this.player.canJump) {
          this.player.jump();
        }
        break;
    }
  }

  handleKeyUp(event) {
    switch(event.code) {
      case 'KeyW':
      case 'KeyS': this.moveDirection.z = 0; break;
      case 'KeyA':
      case 'KeyD': this.moveDirection.x = 0; break;
    }
  }

  handleWeaponSwitch(event) {
    if (event.key === '1') {
      this.switchWeapon('pistol');
    } else if (event.key === '2') {
      this.switchWeapon('sniper');
    }
  }

  createOpenWorld() {
    const terrainWidth = 1000;
    const terrainDepth = 1000;
    const segmentsX = 250;
    const segmentsZ = 250;

    // Add thin green ground layer
    const groundGeometry = new THREE.PlaneGeometry(terrainWidth + 100, terrainDepth + 100);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x2E8B57,  // Sea green color
      roughness: 0.8,
      metalness: 0.1
    });
    const groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.position.y = 0.01;  // Just slightly above zero to avoid z-fighting
    this.scene.add(groundPlane);

    const terrainGeometry = new THREE.PlaneGeometry(terrainWidth, terrainDepth, segmentsX, segmentsZ);

    const vertices = terrainGeometry.attributes.position.array;

    const noise2D = createNoise2D();

    const layers = [
      { scale: 0.01, amplitude: 10 },   // Large terrain features
      { scale: 0.05, amplitude: 5 },    // Medium terrain variations
      { scale: 0.1, amplitude: 2 }      // Small hills
    ];

    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i];
      const z = vertices[i + 2];
      
      let height = 0;
      
      layers.forEach(layer => {
        height += noise2D(x * layer.scale, z * layer.scale) * layer.amplitude;
      });

      vertices[i + 1] = Math.max(0, height);
    }

    terrainGeometry.attributes.position.needsUpdate = true;
    terrainGeometry.computeVertexNormals();

    // Load grass textures
    const grassTextures = [
      'https://threejs.org/examples/textures/terrain/grasslight-big.jpg',
      'https://threejs.org/examples/textures/terrain/grasslight-thin.jpg'
    ];

    const textureLoader = new THREE.TextureLoader();
    const grassTexture = textureLoader.load(grassTextures[Math.floor(Math.random() * grassTextures.length)]);
    
    grassTexture.wrapS = THREE.RepeatWrapping;
    grassTexture.wrapT = THREE.RepeatWrapping;
    grassTexture.repeat.set(50, 50);

    const terrainMaterial = new THREE.MeshStandardMaterial({ 
      map: grassTexture,
      roughness: 0.8,
      metalness: 0.1
    });

    const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
    terrain.rotation.x = -Math.PI / 2;
    terrain.receiveShadow = true;
    this.scene.add(terrain);

    const mountainTypes = [
      { color: 0x8B4513, minHeight: 80, maxHeight: 150, roughness: 0.7 },   // Rocky brown
      { color: 0xA0522D, minHeight: 100, maxHeight: 200, roughness: 0.9 },  // Darker brown
      { color: 0x696969, minHeight: 70, maxHeight: 130, roughness: 0.5 }    // Gray stone
    ];

    const rockTextureMountain = new THREE.TextureLoader().load('https://threejs.org/examples/textures/terrain/rock.jpg');
    rockTextureMountain.wrapS = THREE.RepeatWrapping;
    rockTextureMountain.wrapT = THREE.RepeatWrapping;
    rockTextureMountain.repeat.set(3, 3);

    for (let i = 0; i < 50; i++) {
      const mountainType = mountainTypes[Math.floor(Math.random() * mountainTypes.length)];
      
      const baseRadius = Math.random() * 30 + 20;
      const height = Math.random() * (mountainType.maxHeight - mountainType.minHeight) + mountainType.minHeight;
      
      const mountainGeometry = new THREE.ConeGeometry(
        baseRadius,   
        height,  
        32,  
        16,
        false,
        0,
        Math.PI * 2
      );
      
      const mountainVertices = mountainGeometry.attributes.position.array;
      for (let j = 0; j < mountainVertices.length; j += 3) {
        const noiseX = mountainVertices[j];
        const noiseZ = mountainVertices[j + 2];
        const noiseValue = this.noise2D(noiseX * 0.1, noiseZ * 0.1);
        mountainVertices[j + 1] += noiseValue * 10;
      }
      mountainGeometry.attributes.position.needsUpdate = true;
      mountainGeometry.computeVertexNormals();
      
      const mountainMaterial = new THREE.MeshStandardMaterial({ 
        color: mountainType.color,
        map: rockTextureMountain,
        roughness: mountainType.roughness,
        metalness: 0.3
      });
      
      const mountain = new THREE.Mesh(mountainGeometry, mountainMaterial);
      
      mountain.position.set(
        Math.random() * (terrainWidth * 0.8) - (terrainWidth * 0.4),  
        height / 2,    
        Math.random() * (terrainDepth * 0.8) - (terrainDepth * 0.4)
      );
      
      mountain.rotation.y = Math.random() * Math.PI;
      mountain.rotation.x = (Math.random() - 0.5) * 0.2;  
      mountain.rotation.z = (Math.random() - 0.5) * 0.2;
      
      this.scene.add(mountain);
      this.mountains.push(mountain);
    }

    const treeGeometry = new THREE.CylinderGeometry(0.2, 0.2, 3, 8);
    const treeTrunkMaterial = new THREE.MeshStandardMaterial({ color: 0x5D4037 });
    const treeFoliageMaterial = new THREE.MeshStandardMaterial({ color: 0x2E7D32 });

    for (let i = 0; i < 200; i++) {
      const treeTrunk = new THREE.Mesh(treeGeometry, treeTrunkMaterial);
      const treeFoliage = new THREE.Mesh(
        new THREE.ConeGeometry(1, 2, 6), 
        treeFoliageMaterial
      );
      
      treeTrunk.position.set(
        Math.random() * 900 - 450,
        1.5,
        Math.random() * 900 - 450
      );
      
      treeFoliage.position.set(
        treeTrunk.position.x,
        treeTrunk.position.y + 2,
        treeTrunk.position.z
      );
      
      this.scene.add(treeTrunk);
      this.scene.add(treeFoliage);
    }

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
    directionalLight.position.set(100, 200, 100);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);
  }

  spawnDiverseEnemies(count) {
    const enemyTypes = [
      { color: 0xFF0000, health: 50, name: 'Red Scout' },    
      { color: 0x0000FF, health: 100, name: 'Blue Tank' },   
      { color: 0x00FF00, health: 75, name: 'Green Sniper' }, 
      { color: 0xFFFF00, health: 60, name: 'Yellow Rusher' } 
    ];

    for (let i = 0; i < count * 3; i++) {  
      const enemyType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
      const pos = new THREE.Vector3(
        Math.random() * 800 - 400,  
        1, 
        Math.random() * 800 - 400
      );

      const enemy = new Enemy(pos, enemyType);
      this.enemies.push(enemy);
      this.scene.add(enemy.mesh);
    }
  }

  createHUD() {
    const crosshair = document.createElement('div');
    crosshair.style.position = 'absolute';
    crosshair.style.top = '50%';
    crosshair.style.left = '50%';
    crosshair.style.width = '20px';
    crosshair.style.height = '20px';
    crosshair.style.backgroundColor = 'transparent';
    crosshair.style.border = '2px solid white';
    crosshair.style.borderRadius = '50%';
    crosshair.style.transform = 'translate(-50%, -50%)';
    document.body.appendChild(crosshair);

    const healthContainer = document.createElement('div');
    healthContainer.style.position = 'absolute';
    healthContainer.style.bottom = '20px';
    healthContainer.style.left = '20px';
    healthContainer.style.backgroundColor = 'rgba(0,0,0,0.5)';
    healthContainer.style.padding = '10px';
    healthContainer.style.borderRadius = '5px';
    healthContainer.style.width = '200px';
    document.body.appendChild(healthContainer);

    const healthText = document.createElement('div');
    healthText.id = 'healthText';
    healthText.style.color = 'white';
    healthText.style.marginBottom = '5px';
    healthContainer.appendChild(healthText);

    const healthBar = document.createElement('div');
    healthBar.id = 'healthBar';
    healthBar.style.width = '100%';
    healthBar.style.height = '20px';
    healthBar.style.backgroundColor = 'green';
    healthBar.style.transition = 'width 0.3s, background-color 0.3s';
    healthContainer.appendChild(healthBar);

    const respawnScreen = document.createElement('div');
    respawnScreen.id = 'respawnScreen';
    respawnScreen.style.position = 'absolute';
    respawnScreen.style.top = '50%';
    respawnScreen.style.left = '50%';
    respawnScreen.style.transform = 'translate(-50%, -50%)';
    respawnScreen.style.textAlign = 'center';
    respawnScreen.style.backgroundColor = 'rgba(0,0,0,0.5)';
    respawnScreen.style.padding = '20px';
    respawnScreen.style.borderRadius = '10px';
    respawnScreen.style.display = 'none';
    document.body.appendChild(respawnScreen);

    const respawnText = document.createElement('h1');
    respawnText.textContent = 'You Died';
    respawnText.style.color = '#87CEEB';
    respawnScreen.appendChild(respawnText);

    const respawnButton = document.createElement('button');
    respawnButton.id = 'respawnButton';
    respawnButton.textContent = 'Respawn';
    respawnButton.style.backgroundColor = '#4CAF50';
    respawnButton.style.border = 'none';
    respawnButton.style.color = 'white';
    respawnButton.style.padding = '15px 32px';
    respawnButton.style.textAlign = 'center';
    respawnButton.style.textDecoration = 'none';
    respawnButton.style.display = 'inline-block';
    respawnButton.style.fontSize = '16px';
    respawnButton.style.margin = '4px 2px';
    respawnButton.style.cursor = 'pointer';
    respawnButton.style.borderRadius = '8px';
    respawnButton.style.transition = 'all 0.3s ease';
    respawnButton.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
    respawnButton.onmouseover = () => {
      respawnButton.style.backgroundColor = '#45a049';
      respawnButton.style.transform = 'scale(1.05)';
      respawnButton.style.boxShadow = '0 6px 8px rgba(0,0,0,0.2)';
    };
    respawnButton.onmouseout = () => {
      respawnButton.style.backgroundColor = '#4CAF50';
      respawnButton.style.transform = 'scale(1)';
      respawnButton.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
    };
    respawnScreen.appendChild(respawnButton);
    
    const respawnScreenElement = document.getElementById('respawnScreen');
    const respawnButtonElement = document.getElementById('respawnButton');
    
    if (respawnButtonElement) {
      respawnButtonElement.onclick = this.respawn.bind(this);
    }
  }

  updateHealthDisplay() {
    const healthBar = document.getElementById('healthBar');
    const healthText = document.getElementById('healthText');
    
    if (healthBar && healthText) {
      healthBar.style.width = `${this.playerHealth}%`;
      healthText.textContent = `Health: ${this.playerHealth}`;
      
      if (this.playerHealth > 50) {
        healthBar.style.backgroundColor = 'green';
      } else if (this.playerHealth > 25) {
        healthBar.style.backgroundColor = 'orange';
      } else {
        healthBar.style.backgroundColor = 'red';
      }
    }
  }

  showRespawnScreen() {
    const respawnScreen = document.getElementById('respawnScreen');
    const respawnButton = document.getElementById('respawnButton');
    
    if (respawnScreen && respawnButton && this.playerHealth <= 0) {  
      respawnScreen.style.display = 'flex';
      this.controls.unlock();
    }
  }

  respawn() {
    const respawnScreen = document.getElementById('respawnScreen');
    
    if (respawnScreen) {
      respawnScreen.style.display = 'none';
    }

    this.camera.position.set(0, 2, 0);
    this.playerHealth = 100;
    this.isDead = false;
    this.isInvulnerable = false;
    if (this.invulnerabilityTimer) {
      clearTimeout(this.invulnerabilityTimer);
    }
    this.updateHealthDisplay();

    this.enemies.forEach(enemy => {
      this.scene.remove(enemy.mesh);
    });
    this.enemies = [];
    this.spawnDiverseEnemies(50);

    this.controls.lock();
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    
    if (this.controls.isLocked) {
      this.player.move(this.moveDirection, this.mountains);
    }
    
    this.enemies.forEach(enemy => {
      enemy.update(this.player.getPosition());
      
      if (!this.isDead) {
        const playerBox = new THREE.Box3().setFromObject(this.camera);
        const enemyBox = new THREE.Box3().setFromObject(enemy.mesh);
        
        if (playerBox.intersectsBox(enemyBox) && !this.isInvulnerable) {
          this.playerHealth = Math.max(0, this.playerHealth - 10);
          this.updateHealthDisplay();
          
          this.isInvulnerable = true;
          if (this.invulnerabilityTimer) {
            clearTimeout(this.invulnerabilityTimer);
          }
          this.invulnerabilityTimer = setTimeout(() => {
            this.isInvulnerable = false;
          }, this.invulnerabilityDuration);
          
          if (this.playerHealth <= 0) {  
            this.isDead = true;  
            this.showRespawnScreen();
          }
        }
      }
    });
    
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      bullet.update();
      
      if (bullet.lifetime <= 0) {
        this.scene.remove(bullet.mesh);
        this.bullets.splice(i, 1);
        continue;
      }
      
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const enemy = this.enemies[j];
        const distance = bullet.mesh.position.distanceTo(enemy.mesh.position);
        
        if (distance < 1) { 
          enemy.health -= bullet.damage; 
          this.scene.remove(bullet.mesh);
          this.bullets.splice(i, 1);
          
          if (enemy.health <= 0) {
            this.scene.remove(enemy.mesh);
            this.enemies.splice(j, 1);
          }
          break;
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  setupScopeEffect() {
    const scopeOverlay = document.getElementById('scopeOverlay');
    const scopeCrosshair = document.getElementById('scopeCrosshair');
    const defaultCrosshair = document.querySelector('div[style*="position: absolute"]');  // Select the default white crosshair
    let isScopeActive = false;

    document.addEventListener('mousedown', (event) => {
      if (this.currentWeapon === 'sniper') {
        if (event.button === 2) {  // Right mouse button
          isScopeActive = true;
          scopeOverlay.style.opacity = 1;
          scopeCrosshair.style.display = 'block';
          
          // Hide default crosshair when sniper scope is active
          if (defaultCrosshair) {
            defaultCrosshair.style.display = 'none';
          }
          
          // Apply zoom effect
          this.camera.fov = 20;  // Narrow field of view for zoom
          this.camera.updateProjectionMatrix();
        } else if (event.button === 0 && isScopeActive) {  // Left mouse button, only shoot when scope is active
          this.startShooting();
        }
      } else {
        if (event.button === 0) {  // Left mouse button for other weapons
          this.startShooting();
        }
      }
    });

    document.addEventListener('mouseup', (event) => {
      if (event.button === 2 && this.currentWeapon === 'sniper') {  // Right mouse button
        isScopeActive = false;
        scopeOverlay.style.opacity = 0;
        scopeCrosshair.style.display = 'none';
        
        // Restore default crosshair when sniper scope is deactivated
        if (defaultCrosshair) {
          defaultCrosshair.style.display = 'block';
        }
        
        // Reset camera zoom
        this.camera.fov = 75;
        this.camera.updateProjectionMatrix();
        
        this.stopShooting();
      } else if (event.button === 0) {  // Left mouse button
        this.stopShooting();
      }
    });

    // Prevent context menu from appearing
    document.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });
  }
}

class Player {
  constructor(camera) {
    this.camera = camera;
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.moveSpeed = 0.6;  
    this.jumpStrength = 6;
    this.gravity = 0.2;
    this.canJump = true;
    this.position = new THREE.Vector3(0, 2, 0);
  }

  move(moveDirection, mountains) {
    this.velocity.y -= this.gravity;
    
    const frontVector = new THREE.Vector3(0, 0, moveDirection.z);
    const sideVector = new THREE.Vector3(moveDirection.x, 0, 0);
    
    const direction = frontVector.applyQuaternion(this.camera.quaternion)
      .add(sideVector.applyQuaternion(this.camera.quaternion))
      .normalize();
    
    const speed = this.moveSpeed;
    const moveAmount = direction.multiplyScalar(speed);
    const proposedPosition = this.camera.position.clone().add(moveAmount);
    
    let canMove = true;
    mountains.forEach(mountain => {
      const boundingBox = new THREE.Box3().setFromObject(mountain);
      const mountainRadius = mountain.geometry.parameters.radiusBottom;
      
      const distanceToMountain = proposedPosition.distanceTo(mountain.position);
      if (distanceToMountain < mountainRadius + 2) { 
        canMove = false;
      }
    });
    
    if (canMove) {
      this.camera.position.add(moveAmount);
    }
    
    this.camera.position.y += this.velocity.y;
    
    if (this.camera.position.y < 2) {
      this.camera.position.y = 2;
      this.velocity.y = 0;
      this.canJump = true;
    }
  }

  jump() {
    this.velocity.y = this.jumpStrength;
    this.canJump = false;
  }

  getPosition() {
    return this.camera.position;
  }

  shoot(game, weaponType) {
    const bulletDirection = new THREE.Vector3();
    game.camera.getWorldDirection(bulletDirection);
    
    const bulletOrigin = game.camera.position.clone().add(
      bulletDirection.clone().multiplyScalar(1)
    );
    
    const weapon = game.weapons[weaponType];
    const bullet = new Bullet(bulletOrigin, bulletDirection, weapon);
    game.scene.add(bullet.mesh);
    game.bullets.push(bullet);

    const flash = new THREE.PointLight(0xffff00, 1, 2);
    flash.position.copy(game.camera.position);
    game.scene.add(flash);
    setTimeout(() => game.scene.remove(flash), 50);
  }
}

class Enemy {
  constructor(position, type) {
    const headGeometry = new THREE.SphereGeometry(0.3);  
    const bodyGeometry = new THREE.CylinderGeometry(0.3, 0.4, 1.2);  
    const armGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1);  
    const faceGeometry = new THREE.PlaneGeometry(0.4, 0.4);

    const material = new THREE.MeshStandardMaterial({ color: type.color });
    const faceMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xFFFFFF,
      side: THREE.DoubleSide 
    });

    const head = new THREE.Mesh(headGeometry, material);
    const body = new THREE.Mesh(bodyGeometry, material);
    const leftArm = new THREE.Mesh(armGeometry, material);
    const rightArm = new THREE.Mesh(armGeometry, material);
    
    const face = new THREE.Mesh(faceGeometry, faceMaterial);
    
    const leftEye = new THREE.Mesh(
      new THREE.SphereGeometry(0.05), 
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    const rightEye = leftEye.clone();
    
    const mouth = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.05), 
      new THREE.MeshBasicMaterial({ color: 0x8B4513 })
    );

    leftEye.position.set(-0.1, 0.05, 0.2);
    rightEye.position.set(0.1, 0.05, 0.2);
    mouth.position.set(0, -0.1, 0.2);

    face.add(leftEye);
    face.add(rightEye);
    face.add(mouth);

    head.position.set(0, 1.4, 0);  
    body.position.set(0, 0.6, 0);  
    leftArm.position.set(-0.4, 0.8, 0);  
    rightArm.position.set(0.4, 0.8, 0);  
    face.position.set(0, 0, 0.3);

    this.mesh = new THREE.Group();
    this.mesh.add(head);
    this.mesh.add(body);
    this.mesh.add(leftArm);
    this.mesh.add(rightArm);
    head.add(face);

    this.mesh.position.copy(position);
    this.mesh.position.y = 1;  
    this.mesh.scale.set(0.7, 0.7, 0.7);  

    this.leftArm = leftArm;
    this.rightArm = rightArm;
    this.armSwingSpeed = 0.05;
    this.armSwingAngle = 0;

    this.type = type;
    this.health = type.health;
    this.state = 'patrol';
    this.patrolPoints = this.generatePatrolPoints(this.mesh.position);
    this.currentPatrolPoint = 0;
    this.detectionRange = 15;
    this.rotationSpeed = 0.1;
  }

  generatePatrolPoints(startPos) {
    return [
      startPos.clone(),
      startPos.clone().add(new THREE.Vector3(5, 0, 0)),
      startPos.clone().add(new THREE.Vector3(5, 0, 5)),
      startPos.clone().add(new THREE.Vector3(0, 0, 5))
    ];
  }

  animateArms() {
    this.armSwingAngle += this.armSwingSpeed;
    
    const swingAmplitude = Math.PI / 4;
    this.leftArm.rotation.x = Math.sin(this.armSwingAngle) * swingAmplitude;
    this.rightArm.rotation.x = -Math.sin(this.armSwingAngle) * swingAmplitude;
  }

  update(playerPosition) {
    const distanceToPlayer = this.mesh.position.distanceTo(playerPosition);
    
    if (distanceToPlayer < this.detectionRange) {
      this.state = 'chase';
      
      const direction = playerPosition.clone().sub(this.mesh.position).normalize();
      direction.y = 0;  
      
      this.mesh.position.add(direction.multiplyScalar(0.05));
      
      const targetRotation = Math.atan2(direction.x, direction.z);
      
      const currentRotationY = this.mesh.rotation.y;
      const angleDifference = targetRotation - currentRotationY;
      
      const smoothedRotation = currentRotationY + 
        Math.sign(angleDifference) * 
        Math.min(Math.abs(angleDifference), this.rotationSpeed);
      
      this.mesh.rotation.y = smoothedRotation;
      
      this.animateArms();
    } else {
      this.state = 'patrol';
      const targetPoint = this.patrolPoints[this.currentPatrolPoint];
      const distanceToTarget = new THREE.Vector3(
        this.mesh.position.x, 
        0, 
        this.mesh.position.z
      ).distanceTo(new THREE.Vector3(
        targetPoint.x, 
        0, 
        targetPoint.z
      ));
      
      if (distanceToTarget < 0.1) {
        this.currentPatrolPoint = (this.currentPatrolPoint + 1) % this.patrolPoints.length;
      }
      
      const direction = targetPoint.clone().sub(this.mesh.position).normalize();
      direction.y = 0;  
      this.mesh.position.add(direction.multiplyScalar(0.03));
      
      this.animateArms();
    }

    this.mesh.position.y = 1;
  }
}

class Bullet {
  constructor(position, direction, weapon) {
    const bulletGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const bulletMaterial = new THREE.MeshBasicMaterial({ 
      color: weapon.name === 'Sniper' ? 0xff0000 : 0xffff00,
      transparent: true,
      opacity: 0.8
    });

    this.mesh = new THREE.Mesh(bulletGeometry, bulletMaterial);
    this.mesh.position.copy(position);
    this.direction = direction.normalize().clone(); 
    this.speed = weapon.bulletSpeed; 
    this.lifetime = 100;
    this.damage = weapon.damage;
  }

  update() {
    const movement = this.direction.clone().multiplyScalar(this.speed * 0.1);
    this.mesh.position.add(movement);
    this.lifetime--;
  }
}

const game = new Game();
game.setupScopeEffect();
