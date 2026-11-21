import Phaser from 'phaser';
import type { CollisionWorld } from '../../core/collision';
import { MISSION_THEME } from '../../data/missions';
import { ART_SCALE, bakeGroundTile } from '../art';
import type { MissionMap } from './mapgen';
import { drawTerrain, terrainStage } from './terrainArt';

const CHUNK = 800;
/** Long walls can reach well outside their chunk, hence the margin when culling. */
const CULL_MARGIN = 400;

/**
 * The map's ground and obstacles. Obstacles are drawn into one Graphics per 800×800 chunk;
 * a chunk is redrawn only when one of its obstacles changes damage stage, and off-screen
 * chunks are hidden every frame.
 */
export class TerrainLayer {
  private chunks: { g: Phaser.GameObjects.Graphics; x: number; y: number; items: number[] }[] = [];
  /** Per obstacle: its chunk and its drawn damage stage. */
  private obstacleChunk: number[] = [];
  private obstacleStage: number[] = [];

  constructor(
    scene: Phaser.Scene,
    private map: MissionMap,
    private world: CollisionWorld,
    private seed: number,
  ) {
    const m = map;
    const c = MISSION_THEME;
    bakeGroundTile(scene, 'ground-tile', 512, 64, c);
    scene.add
      .tileSprite(0, 0, m.width, m.height, 'ground-tile')
      .setOrigin(0, 0)
      .setTileScale(1 / ART_SCALE, 1 / ART_SCALE)
      .setDepth(0);
    const cols = Math.ceil(m.width / CHUNK);
    const rows = Math.ceil(m.height / CHUNK);
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        this.chunks.push({ g: scene.add.graphics().setDepth(1), x: col * CHUNK, y: r * CHUNK, items: [] });
      }
    }
    m.obstacles.forEach((o, i) => {
      const cx = o.kind === 'rect' ? o.x + o.w / 2 : o.x;
      const cy = o.kind === 'rect' ? o.y + o.h / 2 : o.y;
      const ci = Math.min(rows - 1, Math.floor(cy / CHUNK)) * cols + Math.min(cols - 1, Math.floor(cx / CHUNK));
      this.chunks[ci].items.push(i);
      this.obstacleChunk.push(ci);
      this.obstacleStage.push(0);
    });
    for (let ci = 0; ci < this.chunks.length; ci++) this.drawChunk(ci);
    scene.add.graphics().setDepth(1).lineStyle(6, c.border).strokeRect(0, 0, m.width, m.height);
  }

  /** Obstacle `i` took damage or fell: redraw its chunk if it looks different now. */
  obstacleChanged(i: number, destroyed: boolean): void {
    const w = this.world;
    const stage = terrainStage(w.hp[i], w.terrain[i].hp, !destroyed);
    if (stage === this.obstacleStage[i]) return;
    this.obstacleStage[i] = stage;
    this.drawChunk(this.obstacleChunk[i]);
  }

  /** Hide chunks outside the camera view. */
  cull(view: Phaser.Geom.Rectangle): void {
    for (const ch of this.chunks) {
      ch.g.setVisible(
        ch.x - CULL_MARGIN < view.right && ch.x + CHUNK + CULL_MARGIN > view.x && ch.y - CULL_MARGIN < view.bottom && ch.y + CHUNK + CULL_MARGIN > view.y,
      );
    }
  }

  private drawChunk(ci: number): void {
    const ch = this.chunks[ci];
    ch.g.clear();
    // Rubble first, so standing obstacles draw over it.
    for (const rubble of [true, false]) {
      for (const i of ch.items) {
        if (this.obstacleStage[i] >= 3 !== rubble) continue;
        drawTerrain(ch.g, this.map.obstacles[i], this.world.terrain[i], this.obstacleStage[i], i + this.seed);
      }
    }
  }
}
