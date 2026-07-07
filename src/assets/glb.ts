import { Document, NodeIO } from "@gltf-transform/core";
import type { Mesh } from "../loops/providers/retopology";

/** Serialize an indexed triangle mesh to a binary glTF (.glb) buffer.
 *  positions = flat xyz Float32Array (VEC3/FLOAT), indices = Uint32Array (UNSIGNED_INT) —
 *  both match glTF 2.0 accessor requirements directly. */
export async function meshToGlb(mesh: Mesh, name = "omni3d_asset"): Promise<Buffer> {
  const doc = new Document();
  const buffer = doc.createBuffer();

  const position = doc
    .createAccessor("POSITION")
    .setType("VEC3")
    .setArray(mesh.positions)
    .setBuffer(buffer);

  const indices = doc
    .createAccessor("indices")
    .setType("SCALAR")
    .setArray(mesh.indices)
    .setBuffer(buffer);

  const prim = doc
    .createPrimitive()
    .setMode(4) // TRIANGLES
    .setAttribute("POSITION", position)
    .setIndices(indices);

  const gltfMesh = doc.createMesh(name).addPrimitive(prim);
  const node = doc.createNode(name).setMesh(gltfMesh);
  doc.createScene(name).addChild(node);

  const bytes = await new NodeIO().writeBinary(doc);
  return Buffer.from(bytes);
}
