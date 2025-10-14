import {
  AgentClient,
  BANK_ACCOUNT_COLLECTION,
  INCOME_COLLECTION,
  ORGANIZATION_COLLECTION,
  clearCollections,
} from "./helpers";
import { mountAgentClient } from "../agent-setup";
import { SelectOptions } from "@forestadmin-experimental/agent-nodejs-testing/dist/remote-agent-client/types";

describe("aggregations count", () => {
  let clientAgent: AgentClient;

  const organizations = () => clientAgent.collection(ORGANIZATION_COLLECTION);
  const bankAccounts = () => clientAgent.collection(BANK_ACCOUNT_COLLECTION);
  const incomes = () => clientAgent.collection(INCOME_COLLECTION);

  const seedIncomeData = async () => {
    const organization = await organizations().create({
      name: "Count Test Org",
    });
    const bankAccount = await bankAccounts().create({
      iban: "DE89370400440532013003",
      organization_id: organization.id,
    });

    await Promise.all(
      [800, 1200, 1600].map((amount, index) =>
        incomes().create({
          amount,
          bank_account_id: bankAccount.id,
          created_at: `2024-0${index + 1}-15T10:00:00.000Z`,
        })
      )
    );
  };

  beforeAll(async () => {
    clientAgent = await mountAgentClient();
  });

  beforeEach(async () => {
    await clearCollections(clientAgent);
    await seedIncomeData();
  });

  it("counts all income records", async () => {
    const count = await incomes().count();

    expect(count).toBe(3);
  });

  it("counts income records with filter", async () => {
    const options: SelectOptions = {
      filters: {
        conditionTree: {
          field: "amount",
          operator: "GreaterThan",
          value: 1000,
        },
      },
    };

    const [filteredIncomes, filteredCount] = await Promise.all([
      incomes().list(options),
      incomes().count(options),
    ]);

    expect(filteredIncomes).toHaveLength(2);
    expect(filteredCount).toBe(2);
  });
});
