import Phaser from "phaser";
import Graphics from "../assets/Graphics";
import FOVLayer from "../entities/FOVLayer";
import Player from "../entities/Player";
import Slime from "../entities/Slime";
import Map from "../entities/Map";

const worldTileHeight = 81;
const worldTileWidth = 81;

export default class DungeonScene extends Phaser.Scene {
  lastX: number; // name: type
  lastY: number;
  player: Player | null;
  slimes: Slime[];
  slimeGroup: Phaser.GameObjects.Group | null;
  fov: FOVLayer | null; // field of view 视野
  tilemap: Phaser.Tilemaps.Tilemap | null; // 格子的地图
  roomDebugGraphics?: Phaser.GameObjects.Graphics;

  preload(): void { // 预加载
    this.load.image(Graphics.environment.name, Graphics.environment.file);
    this.load.image(Graphics.util.name, Graphics.util.file);
    this.load.spritesheet(Graphics.player.name, Graphics.player.file, {
      frameHeight: Graphics.player.height,
      frameWidth: Graphics.player.width
    });
    this.load.spritesheet(Graphics.slime.name, Graphics.slime.file, {
      frameHeight: Graphics.slime.height,
      frameWidth: Graphics.slime.width
    });
  }

  constructor() { // 构造函数
    super("DungeonScene");
    this.lastX = -1;
    this.lastY = -1;
    this.player = null;
    this.fov = null;
    this.tilemap = null;
    this.slimes = []; // array 空数组
    this.slimeGroup = null;
  }

  slimePlayerCollide(
    _: Phaser.GameObjects.GameObject,
    slimeSprite: Phaser.GameObjects.GameObject
  ) {
    const slime = this.slimes.find(s => s.sprite === slimeSprite);
    if (!slime) {
      console.log("Missing slime for sprite collision!");
      return;
    }

    if (this.player!.isAttacking()) {
      this.slimes = this.slimes.filter(s => s != slime);
      slime.kill();
      return false;
    } else {
      this.player!.stagger();
      return true;
    }
  }

  create(): void { // 创建场景
    // 创建信息窗口
    this.events.on("wake", () => {
      this.scene.run("InfoScene");
    });
    this.scene.run("InfoScene");

    // 创建玩家的动画
    Object.values(Graphics.player.animations).forEach(anim => {
      if (!this.anims.get(anim.key)) {
        this.anims.create({
          ...anim,
          frames: this.anims.generateFrameNumbers(
            Graphics.player.name,
            anim.frames
          )
        });
      }
    });

    // 创建史莱姆的动画
    Object.values(Graphics.slime.animations).forEach(anim => {
      if (!this.anims.get(anim.key)) {
        this.anims.create({
          ...anim,
          frames: this.anims.generateFrameNumbers(
            Graphics.slime.name,
            anim.frames
          )
        });
      }
    });

    // 创建地图
    const map = new Map(worldTileWidth, worldTileHeight, this);
    this.tilemap = map.tilemap;

    // 创建视野
    this.fov = new FOVLayer(map);

    // 创建玩家的对象
    this.player = new Player(
      this.tilemap.tileToWorldX(map.startingX),
      this.tilemap.tileToWorldY(map.startingY),
      this
    );

    // 创建史莱姆们
    this.slimes = map.slimes;
    this.slimeGroup = this.physics.add.group(this.slimes.map(s => s.sprite));

    // 设置摄像头 / 视角
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.setZoom(2.5);
    this.cameras.main.setBounds(
      0,
      0,
      map.width * Graphics.environment.width,   // 地图的宽度（单位：像素）
      map.height * Graphics.environment.height  // 地图的高度（单位：像素）
    );
    this.cameras.main.startFollow(this.player.sprite);

    // 设置和墙的碰撞效果
    this.physics.add.collider(this.player.sprite, map.wallLayer);
    this.physics.add.collider(this.slimeGroup, map.wallLayer);

    // 设置和门的碰撞效果
    this.physics.add.collider(this.player.sprite, map.doorLayer);
    this.physics.add.collider(this.slimeGroup, map.doorLayer);

    // this.physics.add.overlap(
    //   this.player.sprite,
    //   this.slimeGroup,
    //   this.slimePlayerCollide,
    //   undefined,
    //   this
    // );
    // 设置玩家和史莱姆的碰撞效果
    this.physics.add.collider(
      this.player.sprite,
      this.slimeGroup,
      undefined,
      this.slimePlayerCollide,
      this
    );

    // for (let slime of this.slimes) {
    //   this.physics.add.collider(slime.sprite, map.wallLayer);
    // }

    // 按下 R键 时的效果，显示游戏资源
    this.input.keyboard.on("keydown_R", () => {
      this.scene.stop("InfoScene");
      this.scene.run("ReferenceScene");
      this.scene.sleep();
    });

    // 按下 Q键 时的效果，Debug
    this.input.keyboard.on("keydown_Q", () => {
      this.physics.world.drawDebug = !this.physics.world.drawDebug;  // 设置 debug 开关
      if (!this.physics.world.debugGraphic) {
        this.physics.world.createDebugGraphic();
      }
      this.physics.world.debugGraphic.clear();
      this.roomDebugGraphics!.setVisible(this.physics.world.drawDebug);
    });

    // 按下 F键 时的效果，切换视野
    this.input.keyboard.on("keydown_F", () => {
      this.fov!.layer.setVisible(!this.fov!.layer.visible);
    });

    // Room Debug 时的效果
    this.roomDebugGraphics = this.add.graphics({ x: 0, y: 0 });
    this.roomDebugGraphics.setVisible(false);
    this.roomDebugGraphics.lineStyle(2, 0xff5500, 0.5);
    for (let room of map.rooms) {
      this.roomDebugGraphics.strokeRect(
        this.tilemap!.tileToWorldX(room.x),
        this.tilemap!.tileToWorldY(room.y),
        this.tilemap!.tileToWorldX(room.width),
        this.tilemap!.tileToWorldY(room.height)
      );
    }
  }

  update(time: number, delta: number) { // 更新场景
    // 刷新玩家
    this.player!.update(time);

    // 刷新史莱姆
    for (let slime of this.slimes) {
      slime.update(time);
    }

    // 刷新视野
    const player = new Phaser.Math.Vector2({
      x: this.tilemap!.worldToTileX(this.player!.sprite.body.x),
      y: this.tilemap!.worldToTileY(this.player!.sprite.body.y)
    });
    const camera = this.cameras.main;
    const bounds = new Phaser.Geom.Rectangle(
      this.tilemap!.worldToTileX(camera.worldView.x) - 1,
      this.tilemap!.worldToTileY(camera.worldView.y) - 1,
      this.tilemap!.worldToTileX(camera.worldView.width) + 2,
      this.tilemap!.worldToTileX(camera.worldView.height) + 2
    );
    this.fov!.update(player, bounds, delta);
  }
}
