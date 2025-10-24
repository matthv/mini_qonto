import { mountAgentClient } from "../../agent-setup";
import { AgentClient, clearCollections } from "../helpers";

const ORGANIZATION_COLLECTION = "Api__OrganizationsView";
const BANK_ACCOUNTS_COLLECTION = "Api__BankAccount";

type OrganizationRecord = {
  id: number;
  name: string;
};


describe("action > execute", () => {
  let clientAgent: AgentClient;

  beforeAll(async () => {
    clientAgent = await mountAgentClient();
  });

  beforeEach(async () => {
    await clearCollections(clientAgent);
  });

  it('should return the error message when action fails', async () => {
    const accounts = clientAgent.collection(BANK_ACCOUNTS_COLLECTION);
    const organizations = clientAgent.collection(ORGANIZATION_COLLECTION);

    const org = await organizations.create<OrganizationRecord>({ name: "Test Org" });
    const account = await accounts.create({
      iban: "FR7612345678901234567890123",
      organization_id: org.id
    });

    const action = await accounts.action("Update IBAN", {
      recordId: account.id
    });

    const newIban = await action.getFieldString("newIban");
    await newIban.fill("FR234325325324234234234");

    expect(async () => await action.execute()).rejects.toThrow(JSON.stringify({
      error: {
        status: 400,
        text: "{\"type\":\"Error\",\"status\":400,\"error\":\"The IBAN must start with FR76.\",\"html\":null}",
        method: "POST",
        path: "/forest/_actions/Api__BankAccount/0/update-iban?timezone=Europe%2FParis"
      },
      body: {
        data: {
          attributes: {
            collection_name: "Api__BankAccount",
            ids: [
              account.id
            ],
            values: {
              newIban: "FR23 4325 3253 2423 4234 234"
            }
          },
          type: "custom-action-requests"
        }
      }
    }, null, 4));
  });

  it('should return the html if resultBuilder has defined html', async () => {
    const accounts = clientAgent.collection(BANK_ACCOUNTS_COLLECTION);
    const organizations = clientAgent.collection(ORGANIZATION_COLLECTION);

    const org = await organizations.create<OrganizationRecord>({ name: "Test Org" });
    const account = await accounts.create({
      iban: "FR12345678901234567890123",
      organization_id: org.id
    });

    const action = await accounts.action("Update IBAN", {
      recordId: account.id
    });

    const newIban = await action.getFieldString("newIban");
    await newIban.fill("FR76234325325324234234234");

    const result = await action.execute();

    expect(result.success).toBe(`Bank account ${account.id} updated.`);

    const errorMessage = result.html;
    expect(errorMessage).toBe(
    `<div>
  <p>Bank account ${account.id} updated.</p>
  <ul>
    <li><strong>Existing record details:</strong> id=${account.id}, iban=FR12345678901234567890123, organization_id=${org.id}</li>
    <li><strong>New IBAN:</strong> FR76 2343 2532 5324 2342 3423 4</li>
    <li><strong>Collection:</strong> Api__BankAccount</li>
    <li><strong>Native driver:</strong> ActiveRecord::ConnectionAdapters::PostgreSQLAdapter</li>
    <li><strong>Sample datasource fields:</strong> created_at, iban, id</li>
    <li><strong>User:</strong> forest admin</li>
    <li><strong>Timezone:</strong> Europe/Paris</li>
  </ul>
</div>
`);
  });
});