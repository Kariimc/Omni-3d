import type { PipelineJob, StagePayload } from "../../schemas";
import { VoxelDraft } from "../../schemas";

type V3 = [number, number, number];
export type Axis = "x" | "y" | "z";

/** An orthographic silhouette: a binary foreground mask seen along `axis`. Its dims are
 *  the two grid axes perpendicular to the view (z→(nx,ny), x→(ny,nz), y→(nx,nz)). */
export interface Silhouette {
  axis: Axis;
  width: number;
  height: number;
  mask: Uint8Array; // width*height, 1 = foreground
}

export interface VoxelGrid {
  res: [number, number, number];
  occupied: Uint8Array; // nx*ny*nz, 1 = occupied
}

const gridIndex = (x: number, y: number, z: number, [nx, ny]: number[]): number => (z * ny! + y) * nx! + x;

function maskDims(axis: Axis, [nx, ny, nz]: number[]): [number, number] {
  if (axis === "z") return [nx!, ny!];
  if (axis === "x") return [ny!, nz!];
  return [nx!, nz!]; // y
}

function maskIndex(axis: Axis, x: number, y: number, z: number, [nx, ny]: number[]): number {
  if (axis === "z") return y * nx! + x;
  if (axis === "x") return z * ny! + y;
  return z * nx! + x; // y
}

export function countOccupied(grid: VoxelGrid): number {
  let n = 0;
  for (let i = 0; i < grid.occupied.length; i++) n += grid.occupied[i]!;
  return n;
}

/** Render the orthographic silhouette of a voxel grid along `axis`: a pixel is foreground
 *  if any voxel along the view ray is occupied. */
export function projectSilhouette(grid: VoxelGrid, axis: Axis): Silhouette {
  const [nx, ny, nz] = grid.res;
  const [width, height] = maskDims(axis, grid.res);
  const mask = new Uint8Array(width * height);
  for (let z = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        if (grid.occupied[gridIndex(x, y, z, grid.res)]) mask[maskIndex(axis, x, y, z, grid.res)] = 1;
      }
    }
  }
  return { axis, width, height, mask };
}

/** Shape-from-silhouette: the visual hull is the intersection of the back-projected
 *  silhouette cones. Start every voxel occupied, then carve any voxel that projects
 *  outside a silhouette in any view. More views only ever carve more (monotonic). */
export function carveVisualHull(res: [number, number, number], silhouettes: Silhouette[]): VoxelGrid {
  const [nx, ny, nz] = res;
  const occupied = new Uint8Array(nx * ny * nz).fill(1);
  for (const s of silhouettes) {
    for (let z = 0; z < nz; z++) {
      for (let y = 0; y < ny; y++) {
        for (let x = 0; x < nx; x++) {
          const gi = gridIndex(x, y, z, res);
          if (occupied[gi] && !s.mask[maskIndex(s.axis, x, y, z, res)]) occupied[gi] = 0;
        }
      }
    }
  }
  return { res, occupied };
}

/** True if `hull` contains every occupied voxel of `obj` (no false negatives). */
export function gridContains(hull: VoxelGrid, obj: VoxelGrid): boolean {
  for (let i = 0; i < obj.occupied.length; i++) if (obj.occupied[i] && !hull.occupied[i]) return false;
  return true;
}

export function gridEquals(a: VoxelGrid, b: VoxelGrid): boolean {
  if (a.occupied.length !== b.occupied.length) return false;
  for (let i = 0; i < a.occupied.length; i++) if (a.occupied[i] !== b.occupied[i]) return false;
  return true;
}

export interface VoxelBBox {
  min: V3;
  max: V3;
}

/** Real Loop A2: reconstruct the visual hull from per-view silhouettes and emit the
 *  VoxelDraft payload with the real occupied-voxel count. */
export function realVoxelDraft(
  job: PipelineJob,
  silhouettes: Silhouette[],
  resolution: [number, number, number],
  bbox: VoxelBBox = { min: [-0.5, 0, -0.4], max: [0.5, 1.85, 0.4] },
): StagePayload {
  const grid = carveVisualHull(resolution, silhouettes);
  const occupiedVoxels = countOccupied(grid);

  return VoxelDraft.parse({
    $omni3d: "loopA.voxelDraft/v1",
    jobId: job.jobId,
    loop: "A_structural",
    generationProgress: 1,
    octree: {
      format: "shape_from_silhouette",
      maxDepth: Math.ceil(Math.log2(Math.max(...resolution))),
      resolution,
      occupiedVoxels,
      bboxMin: bbox.min,
      bboxMax: bbox.max,
      uri: `asset://${job.jobId}/voxel_draft.svo`,
    },
    userEdits: {
      brushStrokes: [],
      asymmetry: { enabled: false, mirrorOverride: false, regions: [] },
    },
    latentWeightDeltas: `asset://${job.jobId}/latent_delta_a2.npz`,
    nextStage: "loopA.retopology",
  });
}
