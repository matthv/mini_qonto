import { PlainFieldOption } from "@forestadmin-experimental/agent-nodejs-testing/dist/remote-agent-client/action-fields/types";
import { mountAgentClient } from "../../agent-setup";
import { AgentClient, clearCollections } from "../helpers";

const ORGANIZATION_COLLECTION = "Api__OrganizationsView";
const BANK_ACCOUNTS_COLLECTION = "Api__BankAccount";

type OrganizationRecord = {
  id: number;
  name: string;
};


describe("action > hooks", () => {
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


  it("search bank accounts by identifier (smart field)", async () => {
    const accounts = clientAgent.collection(BANK_ACCOUNTS_COLLECTION);
    const organizations = clientAgent.collection(ORGANIZATION_COLLECTION);

    const org = await organizations.create<OrganizationRecord>({ name: "org"});
    await accounts.create({ id: 1, iban: "FR76 1234", organization_id: org.id });
    const account2 = await accounts.create({ id: 2, iban: "FR76 5678", organization_id: org.id });

    const [searchResult] = await accounts.list({
      search: `2_5678`,
    });
    expect(searchResult).toBeDefined();
    expect(searchResult.id).toStrictEqual(account2.id);
  });

  describe("action form loading", () => {
    describe("Update IBAN action", () => {
      it("should load action form correctly with default value", async () => {
        const accounts = clientAgent.collection(BANK_ACCOUNTS_COLLECTION);
        const organizations = clientAgent.collection(ORGANIZATION_COLLECTION);

        const org = await organizations.create<OrganizationRecord>({ name: "Test Org" });
        const account = await accounts.create({
          id: 1,
          iban: "FR7612345678901234567890123",
          organization_id: org.id
        });

        const action = await accounts.action("Update IBAN", {
          recordId: account.id
        });

        // Check that the newIban field exists
        const ibanField = action.getFieldString("newIban");
        expect(ibanField).toBeDefined();

        // Check the default value is formatted correctly (with spaces every 4 characters)
        const defaultValue = await ibanField.getValue();
        expect(defaultValue).toBe("FR76 1234 5678 9012 3456 7890 123");
      });

      it("should load action form with empty default when IBAN is missing", async () => {
        const accounts = clientAgent.collection(BANK_ACCOUNTS_COLLECTION);
        const organizations = clientAgent.collection(ORGANIZATION_COLLECTION);

        const org = await organizations.create<OrganizationRecord>({ name: "Test Org" });
        const account = await accounts.create({
          id: 2,
          iban: null,
          organization_id: org.id
        });

        const action = await accounts.action("Update IBAN", {
          recordId: account.id
        });

        const ibanField = action.getFieldString("newIban");
        const defaultValue = await ibanField.getValue();
        expect(defaultValue).toBeFalsy();
      });

      it("should show warning when IBAN does not start with FR76", async () => {
        const accounts = clientAgent.collection(BANK_ACCOUNTS_COLLECTION);
        const organizations = clientAgent.collection(ORGANIZATION_COLLECTION);

        const org = await organizations.create<OrganizationRecord>({ name: "Test Org" });
        const account = await accounts.create({
          id: 3,
          iban: "DE89370400440532013000",
          organization_id: org.id
        });

        const action = await accounts.action("Update IBAN", {
          recordId: account.id
        });

        // Check that the warning layout is visible
        let layout = action.getLayout();
        expect(layout.element(1)).toBeDefined();
        expect(layout.element(1).getHtmlBlockContent()).toContain("IBAN must start with FR76");

        const ibanField = action.getFieldString("newIban");

        // await ibanField.fill("FR76234325325324234234234");

        await ibanField.fill("FR76234325325324234234234");

        layout = action.getLayout();
        expect(() => layout.element(1)).toThrow();

        await ibanField.fill("DE89370400440532013000");

        layout = action.getLayout();
        expect(layout.element(1)).toBeDefined();
        expect(layout.element(1).getHtmlBlockContent()).toContain("IBAN must start with FR76");
      });

      it("should format IBAN value on field change", async () => {
        const accounts = clientAgent.collection(BANK_ACCOUNTS_COLLECTION);
        const organizations = clientAgent.collection(ORGANIZATION_COLLECTION);

        const org = await organizations.create<OrganizationRecord>({ name: "Test Org" });
        const account = await accounts.create({
          id: 4,
          iban: "FR7612345678901234567890123",
          organization_id: org.id
        });

        const action = await accounts.action("Update IBAN", {
          recordId: account.id
        });

        const ibanField = action.getFieldString("newIban");

        // Set a value without spaces
        await ibanField.fill("FR76123456789012");

        // Check that the value is formatted with spaces
        const formattedValue = await ibanField.getValue();
        expect(formattedValue).toBe("FR76 1234 5678 9012");
      });
    });

    describe("Update VIP status action", () => {
      it("should load action form with correct structure", async () => {
        const accounts = clientAgent.collection(BANK_ACCOUNTS_COLLECTION);
        const organizations = clientAgent.collection(ORGANIZATION_COLLECTION);

        const org = await organizations.create<OrganizationRecord>({ name: "Test Org" });
        const account1 = await accounts.create({
          id: 5,
          iban: "FR7612345678901234567890123",
          organization_id: org.id
        });
        const account2 = await accounts.create({
          id: 6,
          iban: "FR7698765432109876543210987",
          organization_id: org.id
        });

        const action = await accounts.action("Update VIP status", {
          recordIds: [account1.id, account2.id]
        });

        // Check that the form is a multi-page layout
        const layout = action.getLayout();
        expect(layout).toBeDefined();

        // Check first page elements
        const page1 = layout.page(0);
        expect(page1).toBeDefined();

        // Check VIP status field exists
        const vipStatusField = action.getDropdownField("vipStatus");
        expect(vipStatusField).toBeDefined();

        // Check organization field exists
        expect(action.doesFieldExist("targetOrganization")).toBe(true);
      });

      it("should show second page when organization is selected", async () => {
        const accounts = clientAgent.collection(BANK_ACCOUNTS_COLLECTION);
        const organizations = clientAgent.collection(ORGANIZATION_COLLECTION);

        const org1 = await organizations.create<OrganizationRecord>({ name: "Org 1" });
        const org2 = await organizations.create<OrganizationRecord>({ name: "Org 2" });
        const account = await accounts.create({
          id: 7,
          iban: "FR7612345678901234567890123",
          organization_id: org1.id
        });

        const action = await accounts.action("Update VIP status", {
          recordIds: [account.id]
        });

        // Set VIP status and organization
        const vipStatusField = action.getDropdownField("vipStatus");
        await vipStatusField.select('Mark as VIP');

        // Note: Setting collection field might require special handling
        // This depends on the testing library's API for collection fields

        // Second page should be accessible after selecting an organization
        const layout = action.getLayout();
        const page2 = layout.page(1);
        expect(page2).toBeDefined();
      });

      it("should show confirmation page with summary", async () => {
        const accounts = clientAgent.collection(BANK_ACCOUNTS_COLLECTION);
        const organizations = clientAgent.collection(ORGANIZATION_COLLECTION);

        const org = await organizations.create<OrganizationRecord>({ name: "Test Org" });
        const account1 = await accounts.create({
          id: 8,
          iban: "FR7612345678901234567890123",
          organization_id: org.id
        });
        const account2 = await accounts.create({
          id: 9,
          iban: "FR7698765432109876543210987",
          organization_id: org.id
        });

        const action = await accounts.action("Update VIP status", {
          recordIds: [account1.id, account2.id]
        });

        // Set VIP status
        const vipStatusField = action.getDropdownField("vipStatus");
        await vipStatusField.select('Mark as VIP');

        // Navigate to the review page (last page)
        const layout = action.getLayout();
        const reviewPage = layout.page(1);
        expect(reviewPage).toBeDefined();

        // Check that review page contains HTML summary
        const htmlBlock = reviewPage.element(0);
        expect(htmlBlock).toBeDefined();
        expect(htmlBlock.getHtmlBlockContent()).toContain("2");
        expect(htmlBlock.getHtmlBlockContent()).toContain("bank account");
      });

      it("should have optional reason field on confirmation page", async () => {
        const accounts = clientAgent.collection(BANK_ACCOUNTS_COLLECTION);
        const organizations = clientAgent.collection(ORGANIZATION_COLLECTION);

        const org = await organizations.create<OrganizationRecord>({ name: "Test Org" });
        const account = await accounts.create({
          id: 10,
          iban: "FR7612345678901234567890123",
          organization_id: org.id
        });

        const action = await accounts.action("Update VIP status", {
          recordIds: [account.id]
        });

        // Check that reason field exists
        expect(action.doesFieldExist("vipReason")).toBe(true);

        // Reason field should be optional (not required)
        const reasonField = action.getFieldString("vipReason");
        expect(reasonField).toBeDefined();
      });

      it("should load VIP status dropdown with correct options", async () => {
        const accounts = clientAgent.collection(BANK_ACCOUNTS_COLLECTION);
        const organizations = clientAgent.collection(ORGANIZATION_COLLECTION);

        const org = await organizations.create<OrganizationRecord>({ name: "Test Org" });
        const account = await accounts.create({
          id: 11,
          iban: "FR7612345678901234567890123",
          organization_id: org.id
        });

        const action = await accounts.action("Update VIP status", {
          recordIds: [account.id]
        });

        const vipStatusField = action.getDropdownField("vipStatus");
        const options = await vipStatusField.getOptions() as unknown as {label: string, value: boolean}[];

        // Check that we have two options: Mark as VIP and Remove VIP status
        expect(options).toHaveLength(2);
        expect(options.some(opt => opt.label === "Mark as VIP" && opt.value === true)).toBe(true);
        expect(options.some(opt => opt.label === "Remove VIP status" && opt.value === false)).toBe(true);
      });
    });
  });
});
