import { mountAgentClient } from "../agent-setup";
import { AgentClient, clearCollections } from "./helpers";

type OrganizationRecord = { id: number | string; name: string | null };

const ORGANIZATION_COLLECTION = "Api__OrganizationsView";
const BANK_ACCOUNTS_COLLECTION = "Api__BankAccount";

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

    await organizations.create<OrganizationRecord>({
      name: "new",
    });

    const [oldOrgSearch] = await organizations.list<OrganizationRecord>({
      search: "Old",
    });
    expect(oldOrgSearch).toBeDefined();
    expect(oldOrgSearch.id).toStrictEqual(oldOrganization.id);
  });

  it("search organizations by id", async () => {
    const organizations = clientAgent.collection(ORGANIZATION_COLLECTION);

    await organizations.create<OrganizationRecord>({ name: "new 1" });

    const org2 = await organizations.create<OrganizationRecord>({
      name: "new 2",
    });

    const [lastOrgSearch] = await organizations.list<OrganizationRecord>({
      search: String(org2.id),
    });
    expect(lastOrgSearch).toBeDefined();
    expect(lastOrgSearch.id).toStrictEqual(org2.id);
  });

  it("search bank accounts by identifier (smart field)", async () => {
    const accounts = clientAgent.collection(BANK_ACCOUNTS_COLLECTION);
    const organizations = clientAgent.collection(ORGANIZATION_COLLECTION);

    const org = await organizations.create<OrganizationRecord>({ name: "org" });
    await accounts.create({
      id: 1,
      iban: "FR76 1234",
      organization_id: org.id,
    });
    const account2 = await accounts.create({
      id: 2,
      iban: "FR76 5678",
      organization_id: org.id,
    });

    const [searchResult] = await accounts.list({
      search: `2_5678`,
    });
    expect(searchResult).toBeDefined();
    expect(searchResult.id).toStrictEqual(account2.id);
  });
});
