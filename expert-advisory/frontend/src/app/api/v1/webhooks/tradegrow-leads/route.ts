import { retiredCrmApi } from "@/lib/retired-crm-api";

// The prototype bridge wrote to an instance-local JSON file. Reimplement against
// the authoritative CRM with a dedicated signed, idempotent ingress contract.
export { retiredCrmApi as GET, retiredCrmApi as POST };
