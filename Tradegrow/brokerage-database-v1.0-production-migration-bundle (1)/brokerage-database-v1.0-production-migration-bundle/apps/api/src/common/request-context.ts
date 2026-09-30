export interface RequestContext {
  userId: string;
  correlationId: string;
  ipAddress?: string;
}
