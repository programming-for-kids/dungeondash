import Phaser from "phaser";
import Graphics from "../assets/Graphics";

const speed = 125;
const attackSpeed = 500;
const attackDuration = 165;
const staggerDuration = 200;
const staggerSpeed = 100;
const attackCooldown = attackDuration * 2;

interface Keys {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  space: Phaser.Input.Keyboard.Key;
  w: Phaser.Input.Keyboard.Key;
  a: Phaser.Input.Keyboard.Key;
  s: Phaser.Input.Keyboard.Key;
  d: Phaser.Input.Keyboard.Key;
}

export default class Player {
  public sprite: Phaser.Physics.Arcade.Sprite;
  private keys: Keys;

  // 成员变量 - member variables
  private attackUntil: number;
  private staggerUntil: number;
  private attackLockedUntil: number;
  private emitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private flashEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private body: Phaser.Physics.Arcade.Body;
  private attacking: boolean;
  private defending: boolean;
  private time: number;
  private staggered: boolean;
  private scene: Phaser.Scene;
  private facingUp: boolean;

  // 构造函数 - 初始化 class 对象的时候调用
  // new Player(10, 10, scene);
  constructor(x: number, y: number, scene: Phaser.Scene) {
    this.scene = scene;
    // 精灵，也就是游戏中的角色
    this.sprite = scene.physics.add.sprite(x, y, Graphics.player.name, 0);
    this.sprite.setSize(8, 8);
    this.sprite.setOffset(20, 28);
    this.sprite.anims.play(Graphics.player.animations.idle.key);
    this.facingUp = false;
    // 玩家深度是5，史莱姆深度是10，深度大的盖住深度小的
    this.sprite.setDepth(5);

    // 添加按键控制
    this.keys = scene.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      w: "w",
      a: "a",
      s: "s",
      d: "d"
    }) as Keys;

    this.attackUntil = 0;
    this.attackLockedUntil = 0;
    this.attacking = false;
    this.defending = false;
    this.staggerUntil = 0;
    this.staggered = false;

    const particles = scene.add.particles(Graphics.player.name);

    // 冲刺效果
    particles.setDepth(6);
    this.emitter = particles.createEmitter({
      alpha: { start: 0.7, end: 0, ease: "Cubic.easeOut" },
      follow: this.sprite,
      quantity: 1,
      lifespan: 200,
      blendMode: Phaser.BlendModes.ADD,
      scaleX: () => (this.sprite.flipX ? -1 : 1),
      emitCallback: (particle: Phaser.GameObjects.Particles.Particle) => {
        particle.frame = this.sprite.frame;
      }
    });
    this.emitter.stop();

    // 被攻击效果
    this.flashEmitter = particles.createEmitter({
      alpha: { start: 0.5, end: 0, ease: "Cubic.easeOut" },
      follow: this.sprite,
      quantity: 1,
      lifespan: 100,
      scaleX: () => (this.sprite.flipX ? -1 : 1),
      emitCallback: (particle: Phaser.GameObjects.Particles.Particle) => {
        particle.frame = this.sprite.frame;
      }
    });
    this.flashEmitter.stop();

    this.body = <Phaser.Physics.Arcade.Body>this.sprite.body;
    this.time = 0;
  }

  isAttacking(): boolean {
    return this.attacking;
  }

  stagger(): void {
    // 如果正在防御，史莱姆攻击无效
    if (this.time > this.staggerUntil && !this.defending) {
      this.staggered = true;
      // TODO
      this.scene.cameras.main.shake(150, 0.001);
      // 50 ms (1s = 1,000 ms; 50ms = 0.05s)
      this.scene.cameras.main.flash(50, 100, 0, 0);
    }
  }

  update(time: number) {
    this.time = time;
    const keys = this.keys;
    let attackAnim = "";
    let moveAnim = "";
    let defendAnim = "";

    // 被攻击的摇晃的效果
    if (this.staggered && !this.body.touching.none && !this.defending) {
      this.staggerUntil = this.time + staggerDuration;
      this.staggered = false;

      this.body.setVelocity(0);
      if (this.body.touching.down) {
        this.body.setVelocityY(-staggerSpeed);
      } else if (this.body.touching.up) {
        this.body.setVelocityY(staggerSpeed);
      } else if (this.body.touching.left) {
        this.body.setVelocityX(staggerSpeed);
        // 设置角色的朝向是往右
        this.sprite.setFlipX(true);
      } else if (this.body.touching.right) {
        this.body.setVelocityX(-staggerSpeed);
        // 设置角色的朝向是往左
        this.sprite.setFlipX(false);
      }
      this.sprite.anims.play(Graphics.player.animations.stagger.key);

      this.flashEmitter.start();
      // this.sprite.setBlendMode(Phaser.BlendModes.MULTIPLY);
    }

    if (time < this.attackUntil || time < this.staggerUntil) {
      return;
    }

    this.body.setVelocity(0);

    // 获取角色当前移动方向
    const left = keys.left.isDown || keys.a.isDown;
    const right = keys.right.isDown || keys.d.isDown;
    const up = keys.up.isDown || keys.w.isDown;
    const down = keys.down.isDown || keys.s.isDown;

    if (!this.body.blocked.left && left) {
      // 往左移动
      this.body.setVelocityX(-speed);
      this.sprite.setFlipX(true);
    } else if (!this.body.blocked.right && right) {
      // 往右移动
      this.body.setVelocityX(speed);
      this.sprite.setFlipX(false);
    }

    if (!this.body.blocked.up && up) {
      // 往上移动
      this.body.setVelocityY(-speed);
    } else if (!this.body.blocked.down && down) {
      // 往下移动
      this.body.setVelocityY(speed);
    }

    if (left || right) {
      moveAnim = Graphics.player.animations.walk.key;
      attackAnim = Graphics.player.animations.slash.key;
      this.facingUp = false;
    } else if (down) {
      moveAnim = Graphics.player.animations.walk.key;
      attackAnim = Graphics.player.animations.slashDown.key;
      this.facingUp = false;
    } else if (up) {
      moveAnim = Graphics.player.animations.walkBack.key;
      attackAnim = Graphics.player.animations.slashUp.key;
      this.facingUp = true;
    } else if (this.facingUp) {
      moveAnim = Graphics.player.animations.idleBack.key;
      defendAnim = Graphics.player.animations.defend.key;
    } else {
      moveAnim = Graphics.player.animations.idle.key;
      defendAnim = Graphics.player.animations.defend.key;
    }

    // 攻击效果
    if (
      keys.space!.isDown &&
      time > this.attackLockedUntil &&
      this.body.velocity.length() > 0
    ) {
      this.attackUntil = time + attackDuration;
      this.attackLockedUntil = time + attackDuration + attackCooldown;
      // 提高攻击时的移动速度
      this.body.velocity.normalize().scale(attackSpeed);
      this.sprite.anims.play(attackAnim, true);
      this.emitter.start();
      // TODO: setBlendMode 的混色模式需要进一步研究
      this.sprite.setBlendMode(Phaser.BlendModes.ADD);
      this.attacking = true;
      return;
    }

    // 防御效果
    if (
      keys.space!.isDown &&
      this.body.velocity.length() === 0
    ) {
      // 播放防御动画
      this.sprite.anims.play(defendAnim, true);
      this.defending = true;
      return;
    }

    // 播放移动或静止的动画
    this.attacking = false;
    this.defending = false;
    this.sprite.anims.play(moveAnim, true);
    this.body.velocity.normalize().scale(speed);
    this.sprite.setBlendMode(Phaser.BlendModes.NORMAL);
    if (this.emitter.on) {
      this.emitter.stop();
    }
    if (this.flashEmitter.on) {
      this.flashEmitter.stop();
    }
  }
}
