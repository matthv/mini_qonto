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
  organizationId: string;
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

  it("rejects creation when iban is in wrong format", async () => {
    const organization = await createOrganization("Wrong Prefix Org");

    let error = new Error();
    try {
      await bankAccounts().create<BankAccountRecord>({
        organization_id: organization.id,
        iban: "8937FR0400440532013000",
      })
    } catch (e) {
      error = e as Error;
    }
    expect(JSON.parse(error.message)).toEqual({
      body: {
        data: {
          attributes: {
          iban: "8937FR0400440532013000",
          organization_id: organization.id,
          },
          type: "Api__BankAccount",
        },
      },
      error: {
        method: "POST",
        path: "/forest/Api__BankAccount?timezone=Europe%2FParis",
        status: 400,
        text: '{"errors":[{"name":"ValidationError","detail":"Invalid IBAN format","status":400,"data":null}]}',
      },
    });
  });

  it("allows creation when iban is present and starts with FR76", async () => {
    const organization = await createOrganization("Valid Org");

    const bankAccount = await bankAccounts().create<BankAccountRecord>({
      organization_id: organization.id,
      iban: "FR7630006000011234567890189",
    });

    expect(bankAccount.iban).toBe("FR7630006000011234567890189");
    expect(bankAccount.organizationId).toBe(parseInt(organization.id));
  });
});
