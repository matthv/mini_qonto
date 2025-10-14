import { create } from "domain";
import { mountAgentClient } from "../agent-setup";
import { clearCollections } from "./helpers";

type AgentClient = Awaited<ReturnType<typeof mountAgentClient>>;
type OrganizationRecord = { id: number | string; name: string | null };

const ORGANIZATION_COLLECTION = "Api__OrganizationsView";


describe("search", () => {
  let clientAgent: AgentClient;

  beforeAll(async () => {
    clientAgent = await mountAgentClient();
  });

  beforeEach(async () => {
    await clearCollections(clientAgent);
  });

  it("search organizations by name", async () => {
    const organizations = clientAgent.collection(ORGANIZATION_COLLECTION);

    const [noNameOrg] = await organizations.list<OrganizationRecord>({
      search: "Old",
    });
    expect(noNameOrg).not.toBeDefined();

    const oldOrganizationName = `Old organization`;

    const oldOrganization = await organizations.create<OrganizationRecord>({
      name: oldOrganizationName,
    });

    const newOrganization =
      await organizations.create<OrganizationRecord>({ name: "new"});

    const [oldOrgSearch] = await organizations.list<OrganizationRecord>({
      search: "Old",
    });
    expect(oldOrgSearch).toBeDefined();
    expect(oldOrgSearch.id).toStrictEqual(oldOrganization.id);

    await organizations.delete([String(oldOrganization.id)]);
    await organizations.delete([String(newOrganization.id)]);
  });

  it("search organizations by id", async () => {
    const organizations = clientAgent.collection(ORGANIZATION_COLLECTION);
    
    await organizations.create<OrganizationRecord>({ name: "new 1" });

    const org2 =
      await organizations.create<OrganizationRecord>({ name: "new 2"});

    const [lastOrgSearch] = await organizations.list<OrganizationRecord>({
      search: String(org2.id),
    });
    expect(lastOrgSearch).toBeDefined();
    expect(lastOrgSearch.id).toStrictEqual(org2.id);
  });
});
