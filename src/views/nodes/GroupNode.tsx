// Decorative subgraph container: a labelled rectangle drawn *behind* the member
// nodes. It is non-interactive and not part of the model — purely derived from
// member positions each render — so it never affects serialization/round-trip.

import type { GroupNode as GroupNodeType } from "../../flow/modelToFlow";
import type { NodeProps } from "@xyflow/react";

export function GroupNode({ data }: NodeProps<GroupNodeType>) {
  return (
    <div className="group-node">
      <span className="group-node-title">{data.title}</span>
    </div>
  );
}
