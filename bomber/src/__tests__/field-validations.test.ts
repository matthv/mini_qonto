import {
  AgentClient,
  BANK_ACCOUNT_COLLECTION,
  ORGANIZATION_COLLECTION,
  clearCollections,
} from "./helpers";
import { mountAgentClient } from "../agent-setup";

type BankAccountRecord = {
  id: string;
  iban: string;
  organization_id: string;
};

type OrganizationRecord = {
  id: string;
  name: string;
};

describe("validations", () => {
  let clientAgent: AgentClient;

  const bankAccounts = () => clientAgent.collection(BANK_ACCOUNT_COLLECTION);
  const organizations = () =>
    clientAgent.collection(ORGANIZATION_COLLECTION);

  const createOrganization = async (name: string) =>
    organizations().create<OrganizationRecord>({ name });

  beforeAll(async () => {
    clientAgent = await mountAgentClient();
  });

  beforeEach(async () => {
    await clearCollections(clientAgent);
  });

  it("rejects creation when iban is missing", async () => {
    const organization = await createOrganization("Missing IBAN Org");

    await expect(
      bankAccounts().create<BankAccountRecord>({
        organization_id: organization.id,
      })
    ).rejects.toThrow(/iban failed validation rule : Present/);
  });

  it("rejects creation when iban does not start with FR76", async () => {
    const organization = await createOrganization("Wrong Prefix Org");

    await expect(
      bankAccounts().create<BankAccountRecord>({
        organization_id: organization.id,
        iban: "DE89370400440532013000",
      })
    ).rejects.toThrow(/iban failed validation rule : StartsWith\(FR76\)/);
  });

  it("allows creation when iban is present and starts with FR76", async () => {
    const organization = await createOrganization("Valid Org");

    const bankAccount = await bankAccounts().create<BankAccountRecord>({
      organization_id: organization.id,
      iban: "FR7630006000011234567890189",
    });

    expect(bankAccount.iban).toBe("FR7630006000011234567890189");
    expect(bankAccount.organization_id).toBe(organization.id);
  });
});
