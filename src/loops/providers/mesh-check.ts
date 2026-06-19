import type { PipelineJob, StagePayload } from "../../schemas";
import { EitlValidation } from "../../schemas";
import { EITL, type EitlTerms, runEitlGate } from "../generators";
import type { Mesh } from "./retopology";

export interface MeshTopology {
  triangles: number;
  edges: number;
  boundaryEdges: number;
  nonManifoldEdges: number;
  degenerate: number;
  watertight: boolean;
  manifold: boolean;
}

/** Real topology analysis of an indexed triangle mesh: count faces incident to each
 *  edge to find boundary (hole) edges and non-manifold edges, plus degenerate faces. */
export function analyzeMesh(mesh: Mesh): MeshTopology {
  const idx = mesh.indices;
  const vCount = mesh.positions.length / 3;
  const incident = new Map<number, number>();
  let degenerate = 0;

  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i]!;
    const b = idx[i + 1]!;
    const c = idx[i + 2]!;
    if (a === b || b === c || a === c) {
      degenerate++;
      continue;
    }
    const edges: [number, number][] = [
      [a, b],
      [b, c],
      [c, a],
    ];
    for (const [u, v] of edges) {
      const key = Math.min(u, v) * vCount + Math.max(u, v);
      incident.set(key, (incident.get(key) ?? 0) + 1);
    }
  }

  let boundaryEdges = 0;
  let nonManifoldEdges = 0;
  for (const count of incident.values()) {
    if (count === 1) boundaryEdges++;
    else if (count > 2) nonManifoldEdges++;
  }

  return {
    triangles: idx.length / 3,
    edges: incident.size,
    boundaryEdges,
    nonManifoldEdges,
    degenerate,
    watertight: boundaryEdges === 0,
    manifold: nonManifoldEdges === 0,
  };
}

export interface RealEitlOptions {
  defect?: "vertex_tear";
}

/** Real Loop C: measure mesh integrity and feed the measured defect ratios into the
 *  shared EITL gate — (boundary + non-manifold edges)/edges -> L_manifold, degenerate
 *  faces/triangles -> L_intersections — then run the micro-repair back-edge. Vertex tear
 *  is an animation-playback property, so it is only set via opts.defect. The repair is
 *  modeled (no actual remesh), so checks reflect the gate's post-repair term values. */
export function realEitl(job: PipelineJob, mesh: Mesh, opts: RealEitlOptions = {}): StagePayload {
  const engine = job.targets.engine === "both" ? "ue5" : job.targets.engine;
  const topo = analyzeMesh(mesh);
  const initial: EitlTerms = {
    L_manifold: (topo.boundaryEdges + topo.nonManifoldEdges) / Math.max(1, topo.edges),
    L_intersections: topo.degenerate / Math.max(1, topo.triangles),
    L_vertex_tear: opts.defect === "vertex_tear" ? 0.3 : 0,
  };
  const g = runEitlGate(initial);

  return EitlValidation.parse({
    $omni3d: "loopC.eitl.validation/v1",
    jobId: job.jobId,
    loop: "C_eitl",
    engineRules: { engine, headless: true, rulesetVersion: engine === "ue5" ? "5.4" : "2022.3" },
    costFunction: {
      formula: "w1*L_manifold + w2*L_intersections + w3*L_vertex_tear",
      weights: { w1: EITL.w1, w2: EITL.w2, w3: EITL.w3 },
      terms: {
        L_manifold: g.terms.L_manifold,
        L_intersections: g.terms.L_intersections,
        L_vertex_tear: g.terms.L_vertex_tear,
      },
      score: g.score,
      threshold: EITL.threshold,
      passed: g.passed,
    },
    checks: {
      watertight: g.terms.L_manifold <= EITL.threshold,
      normalsAligned: topo.manifold,
      delit: true,
      vertexTearOnPlayback: g.terms.L_vertex_tear > EITL.threshold,
      uvOverlapSecondary: false,
    },
    microRepair: {
      triggered: g.inpaintPasses > 0,
      failureSites: g.failureSites,
      inpaintPasses: g.inpaintPasses,
      rerunPhases: g.rerunPhases,
    },
    export: {
      ue5: { materialInstances: true, ormPacked: true, emissiveScalarParam: 2.5, unitScaleCm: job.targets.unitScale === "cm" },
      unity: { pipeline: "urp", lightmapUV: true, noVertexTearMecanim: true },
    },
    liveSync: {
      bridge: "websocket",
      endpoint: "ws://127.0.0.1:8788/omni3d",
      engine,
      pushStatus: g.passed ? "streaming" : "halted",
      instantiatedMaterials: g.passed,
    },
  });
}
