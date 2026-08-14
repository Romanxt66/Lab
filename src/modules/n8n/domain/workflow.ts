export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  updatedAt: string | null;
}

export type N8nWorkflowDTO = N8nWorkflow;

export function toWorkflowDTO(w: N8nWorkflow): N8nWorkflowDTO {
  return w;
}
