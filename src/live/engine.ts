/** Engine-side translation of an `asset.push` event into concrete operations.
 *  Stands in for a real UE5/Unity plugin — same action list either would run. */

export interface EngineAction {
  kind: string;
  detail: string;
}

export interface AssetPush {
  engine: "ue5" | "unity";
  bundle: string;
  endpoint: string;
}

export interface EngineBridge {
  readonly name: string;
  apply(push: AssetPush): EngineAction[];
}

const ue5Actions = (p: AssetPush): EngineAction[] => [
  { kind: "material_instance", detail: "create MI from M_Omni3D_Master (ORM packed)" },
  { kind: "assign_maps", detail: "BaseColor, Normal, ORM, Emissive (scalar intensity)" },
  { kind: "place_mesh", detail: "import SkeletalMesh at 1 unit = 1 cm" },
  { kind: "anim_blueprint", detail: "bind to existing UE5 AnimBlueprint" },
  { kind: "live_link", detail: `link ${p.endpoint} -> ${p.bundle}` },
];

const unityActions = (p: AssetPush): EngineAction[] => [
  { kind: "material", detail: "create URP/Lit material" },
  { kind: "assign_maps", detail: "Albedo, Normal, MetallicSmoothness, Emissive" },
  { kind: "lightmap_uv", detail: "assign non-overlapping secondary UVs" },
  { kind: "mecanim", detail: "Humanoid avatar, zero vertex tear at joints" },
  { kind: "live_link", detail: `link ${p.endpoint} -> ${p.bundle}` },
];

export const actionsFor = (p: AssetPush): EngineAction[] =>
  p.engine === "ue5" ? ue5Actions(p) : unityActions(p);

/** Logs the operations a real engine plugin would perform. */
export class ConsoleEngineBridge implements EngineBridge {
  readonly name = "console";
  apply(push: AssetPush): EngineAction[] {
    const actions = actionsFor(push);
    for (const a of actions) console.log(`   ⚙ [${push.engine}] ${a.kind}: ${a.detail}`);
    return actions;
  }
}

/** Records actions for assertions in tests. */
export class RecordingEngineBridge implements EngineBridge {
  readonly name = "recording";
  readonly actions: EngineAction[] = [];
  apply(push: AssetPush): EngineAction[] {
    const a = actionsFor(push);
    this.actions.push(...a);
    return a;
  }
}
