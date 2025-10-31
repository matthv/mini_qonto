import { mountAgentClient } from "../../agent-setup";
import { AgentClient, clearCollections } from "../helpers";

const ORGANIZATION_COLLECTION = "Api__OrganizationsView";
const BANK_ACCOUNTS_COLLECTION = "Api__BankAccount";

type OrganizationRecord = {
  id: number;
  name: string;
};


describe("action > approvals", () => {
  let clientAgent: AgentClient;

  beforeAll(async () => {
    clientAgent = await mountAgentClient();
  });

  beforeEach(async () => {
    await clearCollections(clientAgent);
  });

  it('should return 403 when approval is required and execute the action when validating the approval', async () => {
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
    await newIban.fill("FR764325325324234234234");

    await clientAgent.overrideActionPermission(BANK_ACCOUNTS_COLLECTION, "Update IBAN", {
      approvalRequired: true
    });

    let error: Error = new Error();
    try {
      await action.execute()
    } catch(e) {
      error = e as Error;
    }
    expect(JSON.parse(error.message)).toEqual({
      error: {
        status: 403,
        text: "{\"errors\":[{\"name\":\"CustomActionRequiresApprovalError\",\"detail\":\"This action requires to be approved.\",\"status\":403,\"data\":{\"user_approval_enabled\":[1]}}]}",
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
              newIban: "FR76 4325 3253 2423 4234 234"
            },
          },
          type: "custom-action-requests"
        }
      }
    });

    // validate approval
    const result = await action.execute(true);

    expect(result.success).toBe(`Bank account ${account.id} updated.`);
  });


  it('should return 403 when validating the approval without having the permission to approve', async () => {
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
    await newIban.fill("FR764325325324234234234");

    await clientAgent.overrideActionPermission(BANK_ACCOUNTS_COLLECTION, "Update IBAN", {
      approvalRequired: true,
      userApprovalEnabled: false,
    });

    let error: Error = new Error();
    try {
      await action.execute(true)
    } catch(e) {
      error = e as Error;
    }
    expect(JSON.parse(error.message).error).toEqual({
      status: 403,
      text: "{\"errors\":[{\"name\":\"CustomActionTriggerForbiddenError\",\"detail\":\"You don't have the permission to trigger this action.\",\"status\":403}]}",
      method: "POST",
      path: "/forest/_actions/Api__BankAccount/0/update-iban?timezone=Europe%2FParis"
    });
  });


  it('should return 403 when validating the approval without having the permission to approve', async () => {
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
    await newIban.fill("FR764325325324234234234");

    await clientAgent.overrideActionPermission(BANK_ACCOUNTS_COLLECTION, "Update IBAN", {
      approvalRequired: true,
      userApprovalEnabled: true,
      selfApprovalEnabled: false
    });

    let error: Error = new Error();
    try {
      await action.execute(true)
    } catch(e) {
      error = e as Error;
    }
    expect(JSON.parse(error.message).error).toEqual({
      status: 403,
      text: "{\"errors\":[{\"name\":\"CustomActionTriggerForbiddenError\",\"detail\":\"You don't have the permission to trigger this action.\",\"status\":403}]}",
      method: "POST",
      path: "/forest/_actions/Api__BankAccount/0/update-iban?timezone=Europe%2FParis"
    });
  });
});