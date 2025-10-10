import { SelectOptions } from "@forestadmin-experimental/agent-nodejs-testing/dist/remote-agent-client/types";
import { mountAgentClient } from "../agent-setup";

type AgentClient = Awaited<ReturnType<typeof mountAgentClient>>;
type OrganizationRecord = { id: string; name: string };

const ORGANIZATION_COLLECTION = "Api__OrganizationsView";

describe("crud", () => {
  let clientAgent: AgentClient;

  beforeAll(async () => {
    clientAgent = await mountAgentClient();
  });

  const organizations = () => clientAgent.collection(ORGANIZATION_COLLECTION);

  it("creates a bank account record", async () => {
    const organization = await organizations().list<OrganizationRecord>();
    expect(organization.length).toBeGreaterThan(0);

    const created = await organizations().create<OrganizationRecord>({
      name: "Test Organization",
    });

    const filter: SelectOptions = {
      filters: {
        conditionTree: {
          field: "id",
          operator: "Equal",
          value: parseInt(created.id),
        },
      },
    };

    expect(created.id).toBeDefined();
    expect(created.name).toBe("Test Organization");

    await organizations().update<OrganizationRecord>(created.id, {
      name: "Updated Organization",
    });

    const [createdOrg] = await organizations().list<OrganizationRecord>(filter);
    expect(createdOrg.id).toBe(created.id);
    expect(createdOrg.name).toBe("Updated Organization");

    await organizations().delete([created.id]);

    const shouldBeDeleted = await organizations().list<OrganizationRecord>(
      filter
    );

    expect(shouldBeDeleted.length).toBe(0);
  });
});
