// Game canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// Handle canvas resizing for mobile
function resizeCanvas() {
    const container = document.getElementById('gameContainer');
    const maxWidth = window.innerWidth;
    const maxHeight = window.innerHeight - 100; // Leave space for controls

    if (window.innerWidth <= 768) {
        // Mobile view
        const aspectRatio = 1024 / 576;
        let width = maxWidth;
        let height = width / aspectRatio;

        if (height > maxHeight) {
            height = maxHeight;
            width = height * aspectRatio;
        }

        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
    } else {
        // Desktop view
        canvas.style.width = '';
        canvas.style.height = '';
    }
}

// Set up resize listener
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', resizeCanvas);
resizeCanvas();

// Game constants
const GRAVITY = 0.4;
const JUMP_FORCE = -10;
const PLAYER_SPEED = 3;
const ENEMY_SPEED = 1;
const TILE_SIZE = 32;

// Game state
let gameState = 'loading';
let score = 0;
let level = 1;
let camera = { x: 0, y: 0 };

// Audio Manager
class AudioManager {
    constructor() {
        this.sounds = {};
        this.currentMusic = null;
        this.isMuted = false;
        this.loadSounds();
    }

    loadSounds() {
        // Background music
        this.sounds.bgMusic = new Audio('Music/BackgroundMusic/bgmusic.mp3');
        this.sounds.bgMusic.loop = true;
        this.sounds.bgMusic.volume = 0.3;

        // Swimming music
        this.sounds.swimmingMusic = new Audio('Music/SwimmingMusic/swimming.mp3');
        this.sounds.swimmingMusic.loop = true;
        this.sounds.swimmingMusic.volume = 0.3;

        // Sound effects
        this.sounds.jump = new Audio('Music/JumpMusic/jump.mp3');
        this.sounds.jump.volume = 0.5;

        this.sounds.death = new Audio('Music/DeadMusic/Dead.mp3');
        this.sounds.death.volume = 0.5;

        this.sounds.enemyKilled = new Audio('Music/StompingEnemies/Killed.mp3');
        this.sounds.enemyKilled.volume = 0.6;

        // Preload all sounds
        Object.values(this.sounds).forEach(sound => {
            sound.load();
        });
    }

    playBackgroundMusic() {
        if (this.currentMusic !== this.sounds.bgMusic) {
            this.stopAllMusic();
            this.currentMusic = this.sounds.bgMusic;
            if (!this.isMuted) {
                this.sounds.bgMusic.play().catch(e => {
                    console.log('Background music autoplay blocked, will play on user interaction');
                });
            }
        }
    }

    playSwimmingMusic() {
        if (this.currentMusic !== this.sounds.swimmingMusic) {
            this.stopAllMusic();
            this.currentMusic = this.sounds.swimmingMusic;
            if (!this.isMuted) {
                this.sounds.swimmingMusic.play().catch(e => {
                    console.log('Swimming music play failed');
                });
            }
        }
    }

    stopAllMusic() {
        if (this.currentMusic) {
            this.currentMusic.pause();
            this.currentMusic.currentTime = 0;
            this.currentMusic = null;
        }
    }

    playJump() {
        if (!this.isMuted) {
            // Clone and play to allow overlapping sounds
            const jumpSound = this.sounds.jump.cloneNode();
            jumpSound.volume = 0.5;
            jumpSound.play().catch(e => {});
        }
    }

    playDeath() {
        this.stopAllMusic();
        if (!this.isMuted) {
            this.sounds.death.play().catch(e => {});
        }
    }

    playEnemyKilled() {
        if (!this.isMuted) {
            // Clone and play to allow overlapping sounds
            const killedSound = this.sounds.enemyKilled.cloneNode();
            killedSound.volume = 0.6;
            killedSound.play().catch(e => {});
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
            this.stopAllMusic();
        } else if (gameState === 'playing') {
            this.playBackgroundMusic();
        }
    }
}

// Initialize audio manager
const audioManager = new AudioManager();

// Reorganized sprite collections
const sprites = {
    hero: {},
    enemies: {},
    items: {},
    environment: {},
    decorations: {},
    water: {}
};

// Load all sprites from the new organized structure
async function loadSprites() {
    let loadedCount = 0;
    let totalSprites = 0;
    let loadedSprites = [];
    let failedSprites = [];
    
    // Define all sprites to load
    const spritesToLoad = {
        // Hero sprites
        hero: {
            idle: ['heroidle0.png', 'heroidle1.png', 'heroidle2.png', 'heroidle3.png'],
            walk: ['herowalk1.png', 'herowalk2.png', 'herowalk3.png', 'herowalk4.png'],
            jump: ['herojump0.png', 'herojump1.png', 'herojump2.png', 'herojump3.png', 'herojump4.png'],
            standing: ['herostanding.png'],
            climbing: ['heroclimbing1.png', 'heroclimbing2.png'],
            swimming: ['heroswimming1.png', 'heroswimming2.png', 'heroswimming3.png', 'heroswimming4.png'],
            flying: ['heroflying0.png', 'heroflying1.png', 'heroflying3.png', 'heroflying4.png']
        },
        
        // Enemy sprites
        enemies: {
            greenFish: ['greenfish1.png', 'greenfish2.png'],
            redDino: ['reddinowalk1.png', 'reddinowalk2.png', 'reddinowalk3.png', 'reddinowalk4.png'],
            purpleDino: ['purpledinowalk1.png', 'purpledinowalk2.png', 'purpledinowalk3.png', 'purpledinowalk4.png'],
            yellowDino: ['dinowalking1.png', 'dinowalking2.png', 'dinowalking3.png', 'dinowalking4.png'],
            brownBat: ['batflying1.png', 'batflying2.png', 'batflying3.png', 'batflying4.png'],
            purpleBat: ['purplebat1.png', 'purplebat2.png', 'purplebat3.png', 'purplebat4.png'],
            angryBird: ['angrybirdflying1.png', 'angrybirdflying2.png', 'angrybirdflying3.png', 'angrybirdflying4.png'],
            greenBird: ['GreenBirdFlying0.png', 'GreenBirdFlying1.png', 'GreenBirdFlying2.png', 'GreenBirdFlying3.png']
        },
        
        // Item sprites
        items: {
            coin: ['coin.png'],
            heart: ['AnimatingHeart0.png', 'AnimatingHeart1.png', 'AnimatingHeart2.png', 'AnimatingHeart3.png', 'AnimatingHeart4.png'],
            key: ['Key0.png', 'Key1.png', 'Key2.png', 'Key3.png'],
            donut: ['SpinningDonut1.png', 'SpinningDonut2.png', 'SpinningDonut3.png', 'SpinningDonut4.png', 'SpinningDonut5.png', 'SpinningDonut6.png', 'SpinningDonut7.png'],
            door: ['ExitDoor.png']
        },
        
        // Environment sprites
        environment: {
            ground: ['Ground.png'],
            dirt: ['Dirt.png'],
            ladder: ['Ladder0.png', 'Ladder1.png'],
            spinningPlatform: ['SpinningPlatform.png']
        },
        
        // Decoration sprites
        decorations: {
            tree: ['Tree1.png'],
            bigTree: ['BigTree1.png'],
            bubbles: ['bubble0.png', 'bubble1.png', 'bubble2.png', 'bubble3.png', 'bubble4.png', 'bubble5.png']
        },
        
        // Water sprites
        water: {
            lake: ['lake.png']
        }
    };
    
    // Count total sprites (only what's in spritesToLoad object)
    Object.keys(spritesToLoad).forEach(categoryName => {
        const category = spritesToLoad[categoryName];
        Object.values(category).forEach(spriteArray => {
            totalSprites += spriteArray.length;
        });
    });
    
    console.log(`Total sprites to load: ${totalSprites}`);
    
    const checkAllLoaded = (spriteName) => {
        loadedCount++;
        if (spriteName) loadedSprites.push(spriteName);
        console.log(`Loaded ${loadedCount}/${totalSprites} sprites`);
        if (loadedCount === totalSprites) {
            console.log('All sprites loaded! Starting game...');
            console.log('Hero sprites loaded:', Object.keys(sprites.hero));
            console.log('Hero walk sprites count:', sprites.hero.walk?.length || 0);
            document.getElementById('loadingScreen').style.display = 'none';
            initGame();
        }
    };
    
    const checkFailed = (spriteName) => {
        failedSprites.push(spriteName);
        console.error(`Failed to load: ${spriteName}`);
    };
    
    // Add timeout to force game start if some sprites fail
    setTimeout(() => {
        if (loadedCount < totalSprites) {
            console.warn(`Timeout: Only ${loadedCount}/${totalSprites} sprites loaded. Starting game anyway.`);
            console.log('Failed sprites:', failedSprites);
            console.log('Missing sprites count:', totalSprites - loadedCount - failedSprites.length);
            document.getElementById('loadingScreen').style.display = 'none';
            initGame();
        }
    }, 10000); // 10 second timeout
    
    // Load hero sprites
    sprites.hero.idle = [];
    spritesToLoad.hero.idle.forEach(fileName => {
        const img = new Image();
        const path = `PNG/Hero/${fileName}`;
        img.src = path;
        img.onload = () => checkAllLoaded(path);
        img.onerror = () => checkFailed(path);
        sprites.hero.idle.push(img);
    });
    
    sprites.hero.walk = [];
    spritesToLoad.hero.walk.forEach(fileName => {
        const img = new Image();
        const path = `PNG/Hero/${fileName}`;
        img.src = path;
        img.onload = () => checkAllLoaded(path);
        img.onerror = () => checkFailed(path);
        sprites.hero.walk.push(img);
    });
    
    sprites.hero.jump = [];
    spritesToLoad.hero.jump.forEach(fileName => {
        const img = new Image();
        img.src = `PNG/Hero/${fileName}`;
        img.onload = checkAllLoaded;
        img.onerror = () => console.error(`Failed to load: PNG/Hero/${fileName}`);
        sprites.hero.jump.push(img);
    });
    
    sprites.hero.climbing = [];
    spritesToLoad.hero.climbing.forEach(fileName => {
        const img = new Image();
        img.src = `PNG/Hero/${fileName}`;
        img.onload = checkAllLoaded;
        img.onerror = () => console.error(`Failed to load: PNG/Hero/${fileName}`);
        sprites.hero.climbing.push(img);
    });
    
    sprites.hero.swimming = [];
    spritesToLoad.hero.swimming.forEach(fileName => {
        const img = new Image();
        img.src = `PNG/Hero/${fileName}`;
        img.onload = checkAllLoaded;
        img.onerror = () => console.error(`Failed to load: PNG/Hero/${fileName}`);
        sprites.hero.swimming.push(img);
    });
    
    sprites.hero.flying = [];
    spritesToLoad.hero.flying.forEach(fileName => {
        const img = new Image();
        img.src = `PNG/Hero/${fileName}`;
        img.onload = checkAllLoaded;
        img.onerror = () => console.error(`Failed to load: PNG/Hero/${fileName}`);
        sprites.hero.flying.push(img);
    });
    
    // Load enemy sprites
    const enemyFolders = {
        greenFish: 'GreenFish',
        redDino: 'RedDino', 
        purpleDino: 'PurpleDino',
        yellowDino: 'YellowDino',
        brownBat: 'BrownBat',
        purpleBat: 'PurpleBat',
        angryBird: 'AngryBird',
        greenBird: 'GreenBird'
    };
    
    Object.keys(enemyFolders).forEach(enemyType => {
        sprites.enemies[enemyType] = [];
        spritesToLoad.enemies[enemyType].forEach(fileName => {
            const img = new Image();
            img.src = `PNG/Enemies/${enemyFolders[enemyType]}/${fileName}`;
            img.onload = checkAllLoaded;
            img.onerror = () => console.error(`Failed to load: PNG/Enemies/${enemyFolders[enemyType]}/${fileName}`);
            sprites.enemies[enemyType].push(img);
        });
    });
    
    // Load item sprites
    const itemFolders = {
        coin: 'InGameItems',
        heart: 'InGameItems/Health',
        key: 'InGameItems/Keys',
        donut: 'InGameItems/Collectibles',
        door: 'InGameItems/Door'
    };
    
    Object.keys(itemFolders).forEach(itemType => {
        sprites.items[itemType] = [];
        spritesToLoad.items[itemType].forEach(fileName => {
            const img = new Image();
            img.src = `PNG/${itemFolders[itemType]}/${fileName}`;
            img.onload = checkAllLoaded;
            img.onerror = () => console.error(`Failed to load: PNG/${itemFolders[itemType]}/${fileName}`);
            sprites.items[itemType].push(img);
        });
    });
    
    // Load environment sprites
    sprites.environment.ground = new Image();
    sprites.environment.ground.src = 'PNG/Ground/Ground.png';
    sprites.environment.ground.onload = () => checkAllLoaded('PNG/Ground/Ground.png');
    sprites.environment.ground.onerror = () => checkFailed('PNG/Ground/Ground.png');
    
    sprites.environment.dirt = new Image();
    sprites.environment.dirt.src = 'PNG/DirtGround/Dirt.png';
    sprites.environment.dirt.onload = () => checkAllLoaded('PNG/DirtGround/Dirt.png');
    sprites.environment.dirt.onerror = () => checkFailed('PNG/DirtGround/Dirt.png');
    
    sprites.environment.ladder = [];
    spritesToLoad.environment.ladder.forEach(fileName => {
        const img = new Image();
        img.src = `PNG/Ladder/${fileName}`;
        img.onload = checkAllLoaded;
        img.onerror = () => console.error(`Failed to load: PNG/Ladder/${fileName}`);
        sprites.environment.ladder.push(img);
    });
    
    sprites.environment.spinningPlatform = new Image();
    sprites.environment.spinningPlatform.src = 'PNG/SpinningPlatform/SpinningPlatform.png';
    sprites.environment.spinningPlatform.onload = checkAllLoaded;
    sprites.environment.spinningPlatform.onerror = () => console.error('Failed to load: PNG/SpinningPlatform/SpinningPlatform.png');
    
    // Load decoration sprites
    sprites.decorations.tree = new Image();
    sprites.decorations.tree.src = 'PNG/Trees/Tree1.png';
    sprites.decorations.tree.onload = () => checkAllLoaded('PNG/Trees/Tree1.png');
    sprites.decorations.tree.onerror = () => checkFailed('PNG/Trees/Tree1.png');
    
    sprites.decorations.bigTree = new Image();
    sprites.decorations.bigTree.src = 'PNG/Trees/BigTree1.png';
    sprites.decorations.bigTree.onload = () => checkAllLoaded('PNG/Trees/BigTree1.png');
    sprites.decorations.bigTree.onerror = () => checkFailed('PNG/Trees/BigTree1.png');
    
    sprites.decorations.bubbles = [];
    spritesToLoad.decorations.bubbles.forEach(fileName => {
        const img = new Image();
        img.src = `PNG/HeroSwimmingBubbles/${fileName}`;
        img.onload = checkAllLoaded;
        img.onerror = () => console.error(`Failed to load: PNG/HeroSwimmingBubbles/${fileName}`);
        sprites.decorations.bubbles.push(img);
    });
    
    // Load water sprites
    sprites.water.lake = [];
    spritesToLoad.water.lake.forEach(fileName => {
        const img = new Image();
        img.src = `PNG/Water/${fileName}`;
        img.onload = checkAllLoaded;
        img.onerror = () => console.error(`Failed to load: PNG/Water/${fileName}`);
        sprites.water.lake.push(img);
    });
}

// Player class
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 40;
        this.vx = 0;
        this.vy = 0;
        this.grounded = false;
        this.facing = 1;
        this.health = 100;
        this.maxHealth = 100;
        this.invulnerable = false;
        this.invulnerableTime = 0;
        this.animFrame = 0;
        this.animTimer = 0;
        this.state = 'idle';
        this.inWater = false;
        this.swimTimer = 0;
        this.isFlying = false;
        this.jumpSoundCooldown = 0;
        this.flyingTimer = 0;
        this.animDir = 1; // for ping-pong walking
        this._loggedWalkReady = false; // debug: log once when walk sprites are active
        this.walkDist = 0;   // distance accumulator for walk animation
        this.walkPhase = 0;  // continuous accumulator for deterministic indexing
        this.walkStep = 8;   // pixels per frame advance (tune cadence)
        this.prevX = x;      // previous X for distance-based animation
    }
    
    update(deltaTime) {
        // Track previous X at the start of frame
        this.prevX = this.x;
        // Handle invulnerability
        if (this.invulnerable) {
            this.invulnerableTime -= deltaTime;
            if (this.invulnerableTime <= 0) {
                this.invulnerable = false;
            }
        }

        // Handle jump sound cooldown
        if (this.jumpSoundCooldown > 0) {
            this.jumpSoundCooldown -= deltaTime;
        }
        
        // Apply gravity and water physics
        if (!this.grounded) {
            if (this.inWater) {
                // Water resistance - slow down movement but allow control
                this.vy *= 0.95; // Water resistance
                // Very slight upward buoyancy only when not actively moving
                if (Math.abs(this.vy) < 0.5) {
                    this.vy += -0.05; // Gentle buoyancy when stationary
                }
                // Limit max speed in water
                const maxSpeed = 4;
                if (this.vy > maxSpeed) this.vy = maxSpeed;
                if (this.vy < -maxSpeed) this.vy = -maxSpeed;
            } else {
                this.vy += GRAVITY;
                if (this.vy > 15) this.vy = 15;
            }
        }
        
        
        // Check for flying (when running fast and not grounded)
        if (!this.grounded && !this.inWater && Math.abs(this.vx) > 4) {
            this.isFlying = true;
            this.flyingTimer += deltaTime;
        } else {
            if (this.isFlying && this.flyingTimer > 100) { // Had some flying time
                this.isFlying = false;
                this.flyingTimer = 0;
            }
        }
        
        // Update state (only reset animation frame when changing states)
        const oldState = this.state;

        if (this.inWater) {
            this.state = 'swimming';
        } else if (this.isFlying) {
            this.state = 'flying';
        } else if (this.grounded) {
            if (Math.abs(this.vx) > 0.1) {  // Lower threshold to detect movement
                this.state = 'walking';
            } else {
                this.state = 'idle';
            }
        } else {
            if (this.vy < 0) {
                this.state = 'jumping';
            } else {
                this.state = 'falling';
            }
        }
        
        // Only reset animation frame when changing to/from certain states
        if (oldState !== this.state) {
            // Preserve walking animation continuity when entering or leaving walking
            if (this.state !== 'walking' && oldState !== 'walking') {
                this.animFrame = 0;
                this.animTimer = 0;
                this.animDir = 1;
                this.walkDist = 0;
                this.walkPhase = 0;
            }
        }

        
        // Update animation AFTER the state has been determined
        this.animTimer += deltaTime;
        const animSpeed = 100;

        if (this.state === 'walking' && sprites.hero.walk) {
            // Deterministic distance-based ping-pong indexing
            this.walkPhase += Math.abs(this.vx);
            const arr = sprites.hero.walk;
            const frames = arr.length;
            const cycleLen = 2 * (frames - 1);
            const stepCount = Math.floor(this.walkPhase / this.walkStep);
            let idx = stepCount % cycleLen;
            if (idx >= frames) idx = cycleLen - idx; // mirror for ping-pong
            this.animFrame = idx;
        } else if (this.state === 'idle' && sprites.hero.idle) {
            if (this.animTimer > animSpeed) {
                this.animTimer = 0;
                this.animFrame = (this.animFrame + 1) % sprites.hero.idle.length;
            }
        } else if (this.state === 'jumping' && sprites.hero.jump) {
            if (this.animTimer > animSpeed) {
                this.animTimer = 0;
                this.animFrame = Math.min(this.animFrame + 1, sprites.hero.jump.length - 1);
            }
        } else if (this.state === 'swimming' && sprites.hero.swimming) {
            if (this.animTimer > animSpeed) {
                this.animTimer = 0;
                this.animFrame = (this.animFrame + 1) % sprites.hero.swimming.length;
            }
        } else if (this.state === 'flying' && sprites.hero.flying) {
            if (this.animTimer > animSpeed) {
                this.animTimer = 0;
                this.animFrame = (this.animFrame + 1) % sprites.hero.flying.length;
            }
        }
        
        // Move
        this.x += this.vx;
        this.y += this.vy;
        
        // Friction - reduced for better animation
        if (this.grounded) {
            this.vx *= 0.85; // Much less friction for better walking animation
        } else if (this.inWater) {
            this.vx *= 0.90; // Less resistance in water for better swimming
        } else {
            this.vx *= 0.95;
        }
    }

    // Called after collisions so grounded is accurate; keeps walk cycle in sync with actual movement
    postCollisionsUpdate() {
        if (this.inWater) return; // swimming handled in update time-based
        if (this.grounded && Math.abs(this.vx) > 0.1 && sprites.hero.walk && sprites.hero.walk.length > 1) {
            this.state = 'walking';
            const dist = Math.abs(this.x - this.prevX);
            this.walkPhase += dist;
            const frames = sprites.hero.walk.length;
            const cycleLen = 2 * (frames - 1);
            const stepCount = Math.floor(this.walkPhase / this.walkStep);
            let idx = stepCount % cycleLen;
            if (idx >= frames) idx = cycleLen - idx; // mirror for ping-pong
            this.animFrame = idx;
        }
    }
    
    jump() {
        if (this.grounded) {
            this.vy = JUMP_FORCE;
            this.grounded = false;
            // Always play sound for ground jumps
            if (this.jumpSoundCooldown <= 0) {
                audioManager.playJump();
                this.jumpSoundCooldown = 100; // 100ms cooldown
            }
        } else if (this.inWater) {
            // Swimming upward - more responsive
            this.vy -= 2;
            if (this.vy < -6) this.vy = -6;
            // Only play sound if not on cooldown for swimming
            if (this.jumpSoundCooldown <= 0) {
                audioManager.playJump();
                this.jumpSoundCooldown = 300; // 300ms cooldown for swimming sounds
            }
        }
    }
    
    dive() {
        if (this.inWater) {
            // Swimming downward
            this.vy += 2;
            if (this.vy > 6) this.vy = 6;
        }
    }
    
    moveLeft() {
        const speed = this.inWater ? PLAYER_SPEED * 0.7 : PLAYER_SPEED;
        this.vx = -speed;
        this.facing = -1;
    }

    moveRight() {
        const speed = this.inWater ? PLAYER_SPEED * 0.7 : PLAYER_SPEED;
        this.vx = speed;
        this.facing = 1;
    }
    
    takeDamage(amount) {
        if (!this.invulnerable) {
            this.health -= amount;
            this.invulnerable = true;
            this.invulnerableTime = 1000;
            
            if (this.health <= 0) {
                this.health = 0;
                gameOver();
            }
        }
    }
    
    draw(ctx) {
        ctx.save();

        // Flash when invulnerable
        if (this.invulnerable && Math.floor(this.invulnerableTime / 100) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }

        // Determine which sprite array to use
        let spriteArray = null;

        // Prefer walking sprites when moving on ground
        if ((this.state === 'walking' || this.state === 'running') && sprites.hero.walk && sprites.hero.walk.length > 0) {
            spriteArray = sprites.hero.walk;
            if (!this._loggedWalkReady) {
                console.log('Hero walk sprites active:', ['herowalk1.png','herowalk2.png','herowalk3.png','herowalk4.png']);
                this._loggedWalkReady = true;
            }
        } else if (this.state === 'idle' && sprites.hero.idle && sprites.hero.idle.length > 0) {
            spriteArray = sprites.hero.idle;
        } else if (this.state === 'jumping' && sprites.hero.jump && sprites.hero.jump.length > 0) {
            spriteArray = sprites.hero.jump;
        } else if (this.state === 'swimming' && sprites.hero.swimming && sprites.hero.swimming.length > 0) {
            spriteArray = sprites.hero.swimming;
        } else if (this.state === 'flying' && sprites.hero.flying && sprites.hero.flying.length > 0) {
            spriteArray = sprites.hero.flying;
        } else if (sprites.hero.idle && sprites.hero.idle.length > 0) {
            // Default to idle if available
            spriteArray = sprites.hero.idle;
        }

        // Draw the sprite
        if (spriteArray && spriteArray.length > 0) {
            const frameIndex = Math.floor(this.animFrame) % spriteArray.length;
            const currentSprite = spriteArray[frameIndex];

            if (currentSprite && currentSprite.complete && currentSprite.naturalWidth > 0) {
                // Flip horizontally if facing left
                if (this.facing === -1) {
                    ctx.scale(-1, 1);
                    ctx.translate(-(this.x - camera.x) * 2 - this.width, 0);
                }

                ctx.drawImage(
                    currentSprite,
                    this.x - camera.x, this.y - camera.y,
                    this.width, this.height
                );
            } else {
                // Fallback rectangle
                ctx.fillStyle = '#FFD700';
                ctx.fillRect(this.x - camera.x, this.y - camera.y, this.width, this.height);
            }
        } else {
            // Fallback - use a different sprite state or basic rectangle
            let fallbackWorked = false;
            
            // Try idle sprites as fallback
            if (this.state !== 'idle' && sprites.hero.idle && sprites.hero.idle.length > 0) {
                const currentSprite = sprites.hero.idle[0];
                
                if (this.facing === -1) {
                    ctx.scale(-1, 1);
                    ctx.translate(-(this.x - camera.x) * 2 - this.width, 0);
                }
                
                ctx.drawImage(
                    currentSprite,
                    this.x - camera.x, this.y - camera.y,
                    this.width, this.height
                );
                fallbackWorked = true;
            }
            
            if (!fallbackWorked) {
                // Final fallback - yellow rectangle instead of blue
                ctx.fillStyle = '#FFD700';
                ctx.fillRect(this.x - camera.x, this.y - camera.y, this.width, this.height);
            }
        }
        
        ctx.restore();
    }
}

// Enemy class  
class Enemy {
    constructor(x, y, type = 'greenFish') {
        this.x = x;
        this.y = y;
        this.width = 36;
        this.height = 36;
        this.vx = ENEMY_SPEED * (Math.random() > 0.5 ? 1 : -1);
        this.vy = 0;
        this.type = type;
        this.health = this.getHealthByType(type);
        this.grounded = false;
        this.animFrame = 0;
        this.animTimer = 0;
        this.patrolDistance = 100;
        this.startX = x;
        this.isFlying = ['brownBat', 'purpleBat', 'angryBird', 'greenBird'].includes(type);
        this.isFish = ['greenFish', 'sidewayFish'].includes(type);
        this.waterBounds = null; // Will be set when fish is in water
        this.animDir = 1; // for ping-pong on walkers
        this.walkDist = 0; // accumulate distance to drive walk cycle (legacy)
        this.walkPhase = 0; // continuous distance accumulator for deterministic index
        // pixels per animation step for walkers (tuned per type)
        const stepMap = { redDino: 12, purpleDino: 12, yellowDino: 12 };
        this.walkStep = stepMap[type] || 10;
    }
    
    getHealthByType(type) {
        const healthMap = {
            greenFish: 20,
            redDino: 40,
            purpleDino: 50,
            yellowDino: 35,
            brownBat: 25,
            purpleBat: 30,
            angryBird: 15,
            greenBird: 20
        };
        return healthMap[type] || 30;
    }
    
    update(deltaTime) {
        // Fish movement (stay in water)
        if (this.isFish) {
            // Find water bounds for fish
            if (!this.waterBounds) {
                waterBodies.forEach(water => {
                    if (this.x >= water.x && this.x <= water.x + water.width &&
                        this.y >= water.y && this.y <= water.y + water.height) {
                        this.waterBounds = water;
                    }
                });
            }
            
            // Keep fish in water bounds
            if (this.waterBounds) {
                if (this.x <= this.waterBounds.x || this.x >= this.waterBounds.x + this.waterBounds.width - this.width) {
                    this.vx *= -1;
                }
                // Keep fish at water level
                this.y = this.waterBounds.y;
                this.vy = 0;
            }
        }
        // Apply gravity only to non-flying, non-fish enemies
        else if (!this.isFlying && !this.grounded) {
            this.vy += GRAVITY;
            if (this.vy > 15) this.vy = 15;
        }
        
        // Flying enemies have different movement
        if (this.isFlying) {
            this.vy += Math.sin(Date.now() * 0.003) * 0.5; // Floating movement
        }
        
        // Update animation
        const arr = sprites.enemies[this.type];
        // Flyers/fish use time-based animation; walkers use distance-based
        if (this.isFlying || this.isFish) {
            this.animTimer += deltaTime;
            if (this.animTimer > 150) {
                this.animTimer = 0;
                if (arr && arr.length > 0) {
                    this.animFrame = (this.animFrame + 1) % arr.length;
                }
            }
        } else if (arr && arr.length > 1) {
            // Deterministic distance-based frame selection (no missed steps)
            this.walkPhase += Math.abs(this.vx);
            const frames = arr.length;
            const cycleLen = 2 * (frames - 1); // ping-pong cycle length in steps
            const stepCount = Math.floor(this.walkPhase / this.walkStep);
            let idx = stepCount % cycleLen;
            if (idx >= frames) idx = cycleLen - idx; // mirror for ping-pong
            this.animFrame = idx;
        }
        
        // Patrol behavior for non-fish enemies
        if (!this.isFish) {
            // Check for edges (prevent falling off platforms)
            const nextX = this.x + this.vx;
            let onGround = false;
            
            // Check if enemy will be on ground at next position
            platforms.forEach(platform => {
                if (nextX + this.width > platform.x && nextX < platform.x + platform.width &&
                    this.y + this.height >= platform.y && this.y + this.height <= platform.y + platform.height + 5) {
                    onGround = true;
                }
            });
            
            // Turn around if reaching edge or patrol distance
            if (!onGround || Math.abs(this.x - this.startX) > this.patrolDistance) {
                this.vx *= -1;
            }
        }
        
        // Move
        this.x += this.vx;
        this.y += this.vy;
    }
    
    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            return true;
        }
        return false;
    }
    
    draw(ctx) {
        ctx.save();
        
        if (sprites.enemies[this.type] && sprites.enemies[this.type].length > 0) {
            const spriteArray = sprites.enemies[this.type];
            const currentSprite = spriteArray[this.animFrame % spriteArray.length];
            
            // Assets face left by default; flip when moving right
            if (this.vx > 0) {
                ctx.scale(-1, 1);
                ctx.translate(-(this.x - camera.x) * 2 - this.width, 0);
            }
            
            if (currentSprite && currentSprite.complete && currentSprite.naturalWidth > 0) {
                ctx.drawImage(
                    currentSprite,
                    this.x - camera.x, this.y - camera.y,
                    this.width, this.height
                );
            } else {
                // Fallback if not yet loaded
                ctx.fillStyle = '#ff6b6b';
                ctx.fillRect(this.x - camera.x, this.y - camera.y, this.width, this.height);
            }
        } else {
            // Fallback
            ctx.fillStyle = '#ff6b6b';
            ctx.fillRect(this.x - camera.x, this.y - camera.y, this.width, this.height);
        }
        
        // Health bar
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x - camera.x, this.y - camera.y - 10, this.width, 4);
        ctx.fillStyle = 'green';
        const maxHealth = this.getHealthByType(this.type);
        ctx.fillRect(this.x - camera.x, this.y - camera.y - 10, (this.width * this.health) / maxHealth, 4);
        
        ctx.restore();
    }
}

// Platform class
class Platform {
    constructor(x, y, width, height, type = 'grass') {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = type;
    }
    
    draw(ctx) {
        const sprite = this.type === 'dirt' ? sprites.environment.dirt : sprites.environment.ground;
        
        if (sprite) {
            const tileSize = TILE_SIZE;
            
            // Draw single layer tiled platform
            for (let i = 0; i < Math.ceil(this.width / tileSize); i++) {
                ctx.drawImage(
                    sprite,
                    this.x + i * tileSize - camera.x,
                    this.y - camera.y,
                    tileSize, tileSize
                );
            }
        } else {
            // Fallback
            ctx.fillStyle = this.type === 'grass' ? '#4a7c59' : '#8b4513';
            ctx.fillRect(this.x - camera.x, this.y - camera.y, this.width, this.height);
        }
    }
}

// Item class
class Item {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.width = 24;
        this.height = 24;
        this.type = type;
        this.collected = false;
        this.bobOffset = Math.random() * Math.PI * 2;
        this.animFrame = 0;
        this.animTimer = 0;
    }
    
    update(deltaTime) {
        this.bobOffset += deltaTime * 0.003;
        this.animTimer += deltaTime;
        
        // Update animation based on type
        if (this.animTimer > 100) {
            this.animTimer = 0;
            if (sprites.items[this.type] && sprites.items[this.type].length > 1) {
                this.animFrame = (this.animFrame + 1) % sprites.items[this.type].length;
            }
        }
    }
    
    draw(ctx) {
        if (this.collected) return;
        
        const bobY = Math.sin(this.bobOffset) * 3;
        
        if (sprites.items[this.type] && sprites.items[this.type].length > 0) {
            const spriteArray = sprites.items[this.type];
            const currentSprite = spriteArray[this.animFrame % spriteArray.length];
            
            ctx.drawImage(
                currentSprite,
                this.x - camera.x,
                this.y + bobY - camera.y,
                this.width, this.height
            );
        } else {
            // Fallback
            ctx.fillStyle = this.type === 'coin' ? '#ffd700' : this.type === 'heart' ? '#ff4757' : '#5352ed';
            ctx.beginPath();
            ctx.arc(this.x + this.width/2 - camera.x, this.y + this.height/2 + bobY - camera.y, this.width/2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// Decoration class for static environment elements
class Decoration {
    constructor(x, y, type, scale = 1) {
        this.x = x;
        this.y = y;
        this.type = type; // tree, bigTree, ladder
        this.scale = scale;
        this.animFrame = 0;
        this.animTimer = 0;
    }
    
    update(deltaTime) {
        // Animate some decorations
        if (this.type === 'bubbles') {
            this.animTimer += deltaTime;
            if (this.animTimer > 200) {
                this.animTimer = 0;
                this.animFrame = (this.animFrame + 1) % sprites.decorations.bubbles.length;
            }
        }
    }
    
    draw(ctx) {
        let sprite = null;
        let width = 64;
        let height = 80;
        
        if (this.type === 'tree') {
            sprite = sprites.decorations.tree;
            width = 40;
            height = 60;
        } else if (this.type === 'bigTree') {
            sprite = sprites.decorations.bigTree;
            width = 80;
            height = 120;
        } else if (this.type === 'ladder') {
            if (sprites.environment.ladder.length > 0) {
                sprite = sprites.environment.ladder[0];
                width = 32;
                height = 64;
            }
        } else if (this.type === 'bubbles') {
            if (sprites.decorations.bubbles.length > 0) {
                sprite = sprites.decorations.bubbles[this.animFrame];
                width = 16;
                height = 16;
            }
        }
        
        if (sprite) {
            ctx.drawImage(
                sprite,
                this.x - camera.x, this.y - camera.y,
                width * this.scale, height * this.scale
            );
        }
    }
}

// Water class for swimming areas
class Water {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }
    
    draw(ctx) {
        // Always draw as one solid gradient with waves (no tiles)
        const time = Date.now() * 0.003;
        const gradient = ctx.createLinearGradient(0, this.y - camera.y, 0, this.y + this.height - camera.y);
        gradient.addColorStop(0, 'rgba(100, 180, 255, 0.8)');
        gradient.addColorStop(0.5, 'rgba(64, 164, 223, 0.9)');
        gradient.addColorStop(1, 'rgba(30, 120, 180, 1.0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(this.x - camera.x, this.y - camera.y, this.width, this.height);
        
        // Add animated wave effect on the surface
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            const waveY = this.y + 10 + i * 20;
            for (let x = this.x; x < this.x + this.width; x += 6) {
                const waveOffset = Math.sin((x + time * 80) * 0.02 + i * Math.PI / 3) * 4;
                if (x === this.x) {
                    ctx.moveTo(x - camera.x, waveY + waveOffset - camera.y);
                } else {
                    ctx.lineTo(x - camera.x, waveY + waveOffset - camera.y);
                }
            }
            ctx.stroke();
        }
    }
}

// Particle effect
class Particle {
    constructor(x, y, vx, vy, color, life) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.life = life;
        this.maxLife = life;
    }
    
    update(deltaTime) {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.2;
        this.life -= deltaTime;
    }
    
    draw(ctx) {
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - camera.x, this.y - camera.y, 3, 3);
        ctx.globalAlpha = 1;
    }
}

// Game objects
let player;
let enemies = [];
let platforms = [];
let items = [];
let particles = [];
let decorations = [];
let waterBodies = [];

// Create particle effect
function createParticles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(
            x, y,
            (Math.random() - 0.5) * 5,
            Math.random() * -5 - 2,
            color,
            500 + Math.random() * 500
        ));
    }
}

// Initialize game
function initGame() {
    // Create player on ground
    player = new Player(100, 504);
    
    // Create level
    createLevel();
    
    // Start game loop
    gameState = 'playing';
    audioManager.playBackgroundMusic();
    lastTime = performance.now();
    gameLoop();
}

// Create level with new sprites and decorations
function createLevel() {
    platforms = [];
    enemies = [];
    items = [];
    decorations = [];
    waterBodies = [];
    
    // Main ground with gaps for water - at bottom of screen
    platforms.push(new Platform(0, 544, 150, 32, 'grass'));       // Before first water
    platforms.push(new Platform(350, 544, 250, 32, 'grass'));     // Between first and second water
    platforms.push(new Platform(750, 544, 350, 32, 'grass'));     // Between second and third water
    platforms.push(new Platform(1400, 544, 300, 32, 'grass'));    // Between third and fourth water
    platforms.push(new Platform(1880, 544, 1960, 32, 'grass'));   // After last water
    
    // Floating platforms
    platforms.push(new Platform(200, 420, 128, 32, 'grass'));
    platforms.push(new Platform(380, 360, 96, 32, 'grass'));
    platforms.push(new Platform(530, 300, 128, 32, 'grass'));
    platforms.push(new Platform(710, 240, 96, 32, 'grass'));
    platforms.push(new Platform(860, 300, 128, 32, 'grass'));
    platforms.push(new Platform(1050, 200, 160, 32, 'grass'));
    platforms.push(new Platform(1280, 150, 128, 32, 'grass'));
    platforms.push(new Platform(1480, 200, 96, 32, 'grass'));
    platforms.push(new Platform(1100, 400, 128, 32, 'dirt'));
    platforms.push(new Platform(1350, 420, 160, 32, 'dirt'));
    platforms.push(new Platform(1600, 380, 128, 32, 'grass'));
    platforms.push(new Platform(1800, 340, 96, 32, 'grass'));
    
    // Create diverse enemies
    const enemyTypes = ['greenFish', 'redDino', 'purpleDino', 'yellowDino', 'brownBat', 'purpleBat'];
    enemies.push(new Enemy(200, 590, 'greenFish')); // Fish in giant water below ground
    enemies.push(new Enemy(400, 514, 'redDino'));
    enemies.push(new Enemy(800, 514, 'yellowDino'));
    enemies.push(new Enemy(1150, 160, 'brownBat'));
    enemies.push(new Enemy(1200, 590, 'greenFish')); // Fish in giant water below ground
    enemies.push(new Enemy(1650, 340, 'purpleBat'));
    enemies.push(new Enemy(950, 150, 'angryBird'));
    
    // Create items using new sprite types
    items.push(new Item(240, 390, 'coin'));
    items.push(new Item(410, 330, 'donut'));
    items.push(new Item(570, 270, 'coin'));
    items.push(new Item(740, 210, 'key'));
    items.push(new Item(890, 270, 'coin'));
    items.push(new Item(1100, 170, 'heart'));
    items.push(new Item(1320, 120, 'key'));
    items.push(new Item(1500, 170, 'donut'));
    
    // Ground level items
    for (let i = 0; i < 15; i++) {
        const itemType = i % 3 === 0 ? 'donut' : 'coin';
        items.push(new Item(150 + i * 120, 470, itemType));
    }
    
    // Add more items
    items.push(new Item(1150, 370, 'coin'));
    items.push(new Item(1400, 390, 'heart'));
    items.push(new Item(1650, 350, 'key'));
    items.push(new Item(1830, 310, 'coin'));
    
    // Add decorative elements
    decorations.push(new Decoration(180, 420, 'tree'));
    decorations.push(new Decoration(350, 300, 'bigTree'));
    decorations.push(new Decoration(500, 240, 'ladder'));
    decorations.push(new Decoration(650, 180, 'tree'));
    decorations.push(new Decoration(950, 240, 'ladder'));
    decorations.push(new Decoration(1200, 90, 'bigTree'));
    decorations.push(new Decoration(1450, 140, 'tree'));
    decorations.push(new Decoration(1700, 320, 'ladder'));
    decorations.push(new Decoration(1900, 280, 'tree'));
    
    // Add one giant water body below the ground level that extends way down
    waterBodies.push(new Water(0, 576, 3840, 1000)); // Giant water below ground level extending far down
    
    // Add some animated bubbles near water areas
    waterBodies.forEach(water => {
        for (let i = 0; i < 3; i++) {
            decorations.push(new Decoration(
                water.x + Math.random() * water.width,
                water.y + Math.random() * water.height,
                'bubbles'
            ));
        }
    });
}

// Collision detection
function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

// Handle collisions
function handleCollisions() {
    // Reset grounded and water states
    player.grounded = false;
    player.inWater = false;
    
    // Player vs Platforms
    platforms.forEach(platform => {
        if (checkCollision(player, platform)) {
            // Top collision (landing)
            if (player.vy > 0 && player.y < platform.y) {
                player.y = platform.y - player.height;
                player.vy = 0;
                player.grounded = true;
            }
            // Bottom collision
            else if (player.vy < 0 && player.y > platform.y) {
                player.y = platform.y + platform.height;
                player.vy = 0;
            }
            // Side collisions
            else if (player.vx > 0 && player.x < platform.x) {
                player.x = platform.x - player.width;
                player.vx = 0;
            }
            else if (player.vx < 0 && player.x > platform.x) {
                player.x = platform.x + platform.width;
                player.vx = 0;
            }
        }
    });
    
    // Enemies vs Platforms
    enemies.forEach(enemy => {
        if (!enemy.isFlying) {
            enemy.grounded = false;
            platforms.forEach(platform => {
                if (checkCollision(enemy, platform)) {
                    if (enemy.vy > 0 && enemy.y < platform.y) {
                        enemy.y = platform.y - enemy.height;
                        enemy.vy = 0;
                        enemy.grounded = true;
            }
        }
    });

    // After resolving collisions, finalize hero walking animation with accurate grounded state
    if (typeof player.postCollisionsUpdate === 'function') {
        player.postCollisionsUpdate();
    }
}
    });
    
    // Player vs Enemies
    enemies.forEach((enemy, index) => {
        if (checkCollision(player, enemy)) {
            // Jump on enemy
            if (player.vy > 0 && player.y < enemy.y) {
                player.vy = JUMP_FORCE / 2;
                score += 100;
                audioManager.playEnemyKilled();
                createParticles(enemy.x + enemy.width/2, enemy.y + enemy.height/2, '#ff0000', 15);
                enemies.splice(index, 1);
            } else {
                // Take damage
                player.takeDamage(10);
                player.vx = (player.x < enemy.x) ? -8 : 8;
                player.vy = -5;
            }
        }
    });
    
    // Player vs Water
    waterBodies.forEach(water => {
        if (checkCollision(player, water)) {
            player.inWater = true;
            // Create bubbles when entering water
            if (Math.random() < 0.1) {
                createParticles(player.x + player.width/2, player.y + player.height/2, '#40a4df', 3);
            }
        }
    });
    
    // Player vs Items
    items.forEach(item => {
        if (!item.collected && checkCollision(player, item)) {
            item.collected = true;
            
            if (item.type === 'coin') {
                score += 10;
                createParticles(item.x + item.width/2, item.y + item.height/2, 'gold', 8);
            } else if (item.type === 'heart') {
                player.health = Math.min(player.health + 25, player.maxHealth);
                createParticles(item.x + item.width/2, item.y + item.height/2, '#ff69b4', 10);
            } else if (item.type === 'key') {
                score += 50;
                createParticles(item.x + item.width/2, item.y + item.height/2, '#00ffff', 15);
            } else if (item.type === 'donut') {
                score += 25;
                player.health = Math.min(player.health + 10, player.maxHealth);
                createParticles(item.x + item.width/2, item.y + item.height/2, '#ff8c94', 12);
            }
        }
    });
    
    // Keep player in bounds - only trigger game over when WAY outside screen
    if (player.y > canvas.height + 1000) { // Allow swimming very deep before game over
        player.health = 0;
        gameOver();
    }
}

// Update camera
function updateCamera() {
    // Follow player
    const targetX = player.x - canvas.width / 2;
    const targetY = player.y - canvas.height / 2;
    
    // Smooth camera
    camera.x += (targetX - camera.x) * 0.1;
    camera.y += (targetY - camera.y) * 0.1;
    
    // Bounds - allow camera to follow player down into water
    camera.x = Math.max(0, camera.x);
    camera.y = Math.max(-100, Math.min(500, camera.y)); // Allow camera to go much lower
}

// Input handling
const keys = {};

document.addEventListener('keydown', (e) => {
    keys[e.key] = true;

    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') {
        e.preventDefault();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// Mobile controls
function setupMobileControls() {
    const leftBtn = document.getElementById('leftBtn');
    const rightBtn = document.getElementById('rightBtn');
    const jumpBtn = document.getElementById('jumpBtn');
    const muteBtn = document.getElementById('muteBtn');

    if (!leftBtn || !rightBtn || !jumpBtn) return;

    // Prevent default touch behaviors
    const preventDefaults = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    // Left button
    leftBtn.addEventListener('touchstart', (e) => {
        preventDefaults(e);
        keys['ArrowLeft'] = true;
        leftBtn.classList.add('pressed');
    });

    leftBtn.addEventListener('touchend', (e) => {
        preventDefaults(e);
        keys['ArrowLeft'] = false;
        leftBtn.classList.remove('pressed');
    });

    leftBtn.addEventListener('touchcancel', (e) => {
        preventDefaults(e);
        keys['ArrowLeft'] = false;
        leftBtn.classList.remove('pressed');
    });

    // Right button
    rightBtn.addEventListener('touchstart', (e) => {
        preventDefaults(e);
        keys['ArrowRight'] = true;
        rightBtn.classList.add('pressed');
    });

    rightBtn.addEventListener('touchend', (e) => {
        preventDefaults(e);
        keys['ArrowRight'] = false;
        rightBtn.classList.remove('pressed');
    });

    rightBtn.addEventListener('touchcancel', (e) => {
        preventDefaults(e);
        keys['ArrowRight'] = false;
        rightBtn.classList.remove('pressed');
    });

    // Jump button
    jumpBtn.addEventListener('touchstart', (e) => {
        preventDefaults(e);
        keys[' '] = true;
        jumpBtn.classList.add('pressed');
    });

    jumpBtn.addEventListener('touchend', (e) => {
        preventDefaults(e);
        keys[' '] = false;
        jumpBtn.classList.remove('pressed');
    });

    jumpBtn.addEventListener('touchcancel', (e) => {
        preventDefaults(e);
        keys[' '] = false;
        jumpBtn.classList.remove('pressed');
    });

    // Also add mouse events for testing on desktop
    leftBtn.addEventListener('mousedown', () => {
        keys['ArrowLeft'] = true;
        leftBtn.classList.add('pressed');
    });

    leftBtn.addEventListener('mouseup', () => {
        keys['ArrowLeft'] = false;
        leftBtn.classList.remove('pressed');
    });

    leftBtn.addEventListener('mouseleave', () => {
        keys['ArrowLeft'] = false;
        leftBtn.classList.remove('pressed');
    });

    rightBtn.addEventListener('mousedown', () => {
        keys['ArrowRight'] = true;
        rightBtn.classList.add('pressed');
    });

    rightBtn.addEventListener('mouseup', () => {
        keys['ArrowRight'] = false;
        rightBtn.classList.remove('pressed');
    });

    rightBtn.addEventListener('mouseleave', () => {
        keys['ArrowRight'] = false;
        rightBtn.classList.remove('pressed');
    });

    jumpBtn.addEventListener('mousedown', () => {
        keys[' '] = true;
        jumpBtn.classList.add('pressed');
    });

    jumpBtn.addEventListener('mouseup', () => {
        keys[' '] = false;
        jumpBtn.classList.remove('pressed');
    });

    jumpBtn.addEventListener('mouseleave', () => {
        keys[' '] = false;
        jumpBtn.classList.remove('pressed');
    });

    // Mute button
    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            audioManager.toggleMute();
            muteBtn.textContent = audioManager.isMuted ? '🔇' : '🔊';
        });

        muteBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            audioManager.toggleMute();
            muteBtn.textContent = audioManager.isMuted ? '🔇' : '🔊';
        });
    }
}

// Initialize mobile controls when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupMobileControls);
} else {
    setupMobileControls();
}

// Handle input
function handleInput() {
    if (gameState !== 'playing') return;
    
    // Movement
    if (keys['ArrowLeft'] || keys['a']) {
        player.moveLeft();
    }
    if (keys['ArrowRight'] || keys['d']) {
        player.moveRight();
    }
    if (keys[' ']) {
        player.jump();
    }
    if (keys['ArrowDown'] || keys['s']) {
        player.dive();
    }
}

// Draw GUI
function drawGUI(ctx) {
    // Health bar
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(10, 10, 204, 24);
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(12, 12, 200, 20);
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(12, 12, (200 * player.health) / player.maxHealth, 20);
    
    // Health text
    ctx.fillStyle = 'white';
    ctx.font = 'bold 14px Arial';
    ctx.fillText(`HP: ${Math.floor(player.health)}/${player.maxHealth}`, 15, 27);
    
    // Score
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(10, 40, 150, 30);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 20px Arial';
    ctx.fillText(`Score: ${score}`, 15, 62);
    
    // Level
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(canvas.width - 110, 10, 100, 30);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 18px Arial';
    ctx.fillText(`Level: ${level}`, canvas.width - 105, 32);
    
    // Controls hint
    if (performance.now() < 5000) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(canvas.width/2 - 150, canvas.height - 60, 300, 50);
        ctx.fillStyle = 'white';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Arrow Keys/WASD: Move | Space/W/Up: Jump', canvas.width/2, canvas.height - 35);
        ctx.fillText('Jump on enemies to defeat them!', canvas.width/2, canvas.height - 15);
        ctx.textAlign = 'left';
    }
}

// Draw background
function drawBackground(ctx) {
    // Sky gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#98D8E8');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    for (let i = 0; i < 5; i++) {
        const cloudX = (i * 200 - camera.x * 0.2) % (canvas.width + 100);
        const cloudY = 50 + i * 30;
        
        ctx.beginPath();
        ctx.arc(cloudX, cloudY, 25, 0, Math.PI * 2);
        ctx.arc(cloudX + 25, cloudY, 35, 0, Math.PI * 2);
        ctx.arc(cloudX + 50, cloudY, 25, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Mountains
    ctx.fillStyle = 'rgba(100, 100, 150, 0.3)';
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    for (let i = 0; i <= canvas.width; i += 100) {
        const height = 200 + Math.sin(i * 0.01) * 50;
        ctx.lineTo(i - camera.x * 0.1, canvas.height - height);
    }
    ctx.lineTo(canvas.width, canvas.height);
    ctx.fill();
}

// Game loop
let lastTime = 0;

function gameLoop(currentTime) {
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    
    if (gameState === 'playing') {
        // Handle input
        handleInput();

        // Update
        player.update(deltaTime);
        enemies.forEach(enemy => enemy.update(deltaTime));
        items.forEach(item => item.update(deltaTime));
        decorations.forEach(decoration => decoration.update(deltaTime));

        // Update particles
        particles = particles.filter(p => {
            p.update(deltaTime);
            return p.life > 0;
        });

        // Collisions
        handleCollisions();

        // Camera
        updateCamera();

        // Handle music based on player state
        if (player.inWater) {
            audioManager.playSwimmingMusic();
        } else {
            audioManager.playBackgroundMusic();
        }
        
        // Draw
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawBackground(ctx);
        
        // Draw game objects (back to front)
        decorations.forEach(decoration => decoration.draw(ctx));
        platforms.forEach(platform => platform.draw(ctx));
        waterBodies.forEach(water => water.draw(ctx));
        items.forEach(item => item.draw(ctx));
        enemies.forEach(enemy => enemy.draw(ctx));
        particles.forEach(particle => particle.draw(ctx));
        player.draw(ctx);
        
        // Draw GUI
        drawGUI(ctx);
        
        // Check win
        if (enemies.length === 0 && items.filter(i => !i.collected && (i.type === 'coin' || i.type === 'donut')).length === 0) {
            nextLevel();
        }
    }
    
    requestAnimationFrame(gameLoop);
}

// Game over
function gameOver() {
    gameState = 'gameover';
    audioManager.playDeath();
    document.getElementById('finalScore').textContent = `Final Score: ${score}`;
    document.getElementById('gameOverScreen').style.display = 'flex';
}

// Restart game
function restartGame() {
    gameState = 'playing';
    score = 0;
    level = 1;
    document.getElementById('gameOverScreen').style.display = 'none';

    // Reset player
    player = new Player(100, 300);

    // Recreate level
    createLevel();

    // Start background music
    audioManager.playBackgroundMusic();
}

// Next level
function nextLevel() {
    level++;
    score += 500;
    
    // Reset player position
    player.x = 100;
    player.y = 300;
    player.health = player.maxHealth;
    
    // Create new level with more enemies
    createLevel();
    
    // Add extra enemies for higher levels
    const extraEnemyTypes = ['brownBat', 'purpleBat', 'angryBird', 'greenBird'];
    for (let i = 0; i < level - 1; i++) {
        const enemyType = extraEnemyTypes[i % extraEnemyTypes.length];
        enemies.push(new Enemy(400 + i * 200, 350, enemyType));
    }
}

// Start loading
window.addEventListener('load', loadSprites);
