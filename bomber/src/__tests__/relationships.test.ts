import { mountAgentClient } from "../agent-setup";
import { clearCollections } from "./helpers";

type AgentClient = Awaited<ReturnType<typeof mountAgentClient>>;
type OrganizationRecord = { id: string; name: string };
type BankAccountRecord = {
  id: string;
  iban: string;
  organization_id: string;
};

const ORGANIZATION_COLLECTION = "Api__OrganizationsView";
const BANK_ACCOUNT_COLLECTION = "Api__BankAccount";

describe("relationships", () => {
  let clientAgent: AgentClient;

  beforeAll(async () => {
    clientAgent = await mountAgentClient();
  });

  beforeEach(async () => {
    await clearCollections(clientAgent);
  });

  const organizations = () => clientAgent.collection(ORGANIZATION_COLLECTION);
  const bankAccounts = () => clientAgent.collection(BANK_ACCOUNT_COLLECTION);

  describe("OneToMany relationship", () => {
    it("should include bank_accounts in organization", async () => {
      // Create organization
      const org = await organizations().create<OrganizationRecord>({
        name: "Test Org",
      });

      // Create bank account
      const bankAccount = await bankAccounts().create<BankAccountRecord>({
        iban: "FR7612345678901234567890123",
        organization_id: parseInt(org.id),
      });

      await bankAccounts().create<BankAccountRecord>({
        iban: "FR3512345678901234567890123",
        organization_id: parseInt(org.id),
      });

      const relatedBankAccounts = await organizations().relation("bank_accounts", org.id).list();

      expect(relatedBankAccounts.length).toStrictEqual(2);
      expect(relatedBankAccounts[0]).toEqual(expect.objectContaining({
        id: bankAccount.id,
        iban: bankAccount.iban,
      }));
    });
  });
});
