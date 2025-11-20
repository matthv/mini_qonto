import { mountAgentClient } from "../../agent-setup";
import {
  BANK_ACCOUNT_COLLECTION,
  clearCollections,
  INCOME_COLLECTION,
  ORGANIZATION_COLLECTION,
} from "../helpers";

type AgentClient = Awaited<ReturnType<typeof mountAgentClient>>;
type IncomeRecord = {
  id: string | number;
  amount: number | null;
};

describe("filters", () => {
  let clientAgent: AgentClient;

  beforeAll(async () => {
    clientAgent = await mountAgentClient();
  });

  const incomes = () => clientAgent.collection(INCOME_COLLECTION);
  const bankAccounts = () => clientAgent.collection(BANK_ACCOUNT_COLLECTION);
  const organizations = () => clientAgent.collection(ORGANIZATION_COLLECTION);

  beforeEach(async () => {
    await clearCollections(clientAgent);
  });

  describe("type number", () => {
    it("equal", async () => {
      const orga = await organizations().create({
        name: "Test Organization",
      });
      const bank = await bankAccounts().create({
        iban: "DE89370400440532013000",
        organization_id: orga.id,
      });

      await incomes().create<IncomeRecord>({
        amount: 1500,
        bank_account_id: bank.id,
      });
      const target = await incomes().create<IncomeRecord>({
        amount: 2750,
        bank_account_id: bank.id,
      });

      const productsResult = await incomes().list<IncomeRecord>({
        filters: {
          conditionTree: {
            field: "amount",
            operator: "Equal",
            value: target.amount,
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([expect.objectContaining({ amount: 2750 })])
      );
    });

    it("not equal", async () => {
      const orga = await organizations().create({
        name: "Test Organization",
      });
      const bank = await bankAccounts().create({
        iban: "DE89370400440532013000",
        organization_id: orga.id,
      });

      const [first, _] = await Promise.all([
        incomes().create<IncomeRecord>({
          amount: 500,
          bank_account_id: bank.id,
        }),
        incomes().create<IncomeRecord>({
          amount: 800,
          bank_account_id: bank.id,
        }),
      ]);

      const productsResult = await incomes().list<IncomeRecord>({
        filters: {
          conditionTree: {
            field: "amount",
            operator: "NotEqual",
            value: first.amount,
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([expect.objectContaining({ amount: 800 })])
      );
    });

    it("less than", async () => {
      const orga = await organizations().create({
        name: "Test Organization",
      });
      const bank = await bankAccounts().create({
        iban: "DE89370400440532013000",
        organization_id: orga.id,
      });

      const records = await Promise.all([
        incomes().create<IncomeRecord>({
          amount: 120,
          bank_account_id: bank.id,
        }),
        incomes().create<IncomeRecord>({
          amount: 240,
          bank_account_id: bank.id,
        }),
        incomes().create<IncomeRecord>({
          amount: 360,
          bank_account_id: bank.id,
        }),
      ]);

      const sorted = [...records].sort(
        (a, b) => (a.amount ?? 0) - (b.amount ?? 0)
      );
      const threshold = sorted[1].amount!;

      const productsResult = await incomes().list<IncomeRecord>({
        filters: {
          conditionTree: {
            field: "amount",
            operator: "LessThan",
            value: threshold,
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([expect.objectContaining({ amount: 120 })])
      );
    });

    it("less than or equal", async () => {
      const orga = await organizations().create({
        name: "Test Organization",
      });
      const bank = await bankAccounts().create({
        iban: "DE89370400440532013000",
        organization_id: orga.id,
      });

      const records = await Promise.all([
        incomes().create<IncomeRecord>({
          amount: 90,
          bank_account_id: bank.id,
        }),
        incomes().create<IncomeRecord>({
          amount: 180,
          bank_account_id: bank.id,
        }),
        incomes().create<IncomeRecord>({
          amount: 270,
          bank_account_id: bank.id,
        }),
      ]);

      const sorted = [...records].sort(
        (a, b) => (a.amount ?? 0) - (b.amount ?? 0)
      );
      const threshold = sorted[1].amount!;

      const productsResult = await incomes().list<IncomeRecord>({
        filters: {
          conditionTree: {
            field: "amount",
            operator: "LessThanOrEqual",
            value: threshold,
          },
        },
      });

      expect(productsResult).toHaveLength(2);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ amount: 90 }),
          expect.objectContaining({ amount: 180 }),
        ])
      );
    });

    it("greater than", async () => {
      const records = await Promise.all([
        incomes().create<IncomeRecord>({ amount: 400 }),
        incomes().create<IncomeRecord>({ amount: 500 }),
        incomes().create<IncomeRecord>({ amount: 600 }),
      ]);

      const sorted = [...records].sort(
        (a, b) => (a.amount ?? 0) - (b.amount ?? 0)
      );
      const threshold = sorted[1].amount!;

      const productsResult = await incomes().list<IncomeRecord>({
        filters: {
          conditionTree: {
            field: "amount",
            operator: "GreaterThan",
            value: threshold,
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([expect.objectContaining({ amount: 600 })])
      );
    });

    it("greater than or equal", async () => {
      const orga = await organizations().create({
        name: "Test Organization",
      });
      const bank = await bankAccounts().create({
        iban: "DE89370400440532013000",
        organization_id: orga.id,
      });

      const records = await Promise.all([
        incomes().create<IncomeRecord>({
          amount: 700,
          bank_account_id: bank.id,
        }),
        incomes().create<IncomeRecord>({
          amount: 800,
          bank_account_id: bank.id,
        }),
        incomes().create<IncomeRecord>({
          amount: 900,
          bank_account_id: bank.id,
        }),
      ]);

      const sorted = [...records].sort(
        (a, b) => (a.amount ?? 0) - (b.amount ?? 0)
      );
      const threshold = sorted[1].amount!;

      const productsResult = await incomes().list<IncomeRecord>({
        filters: {
          conditionTree: {
            field: "amount",
            operator: "GreaterThanOrEqual",
            value: threshold,
          },
        },
      });

      expect(productsResult).toHaveLength(2);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ amount: 800 }),
          expect.objectContaining({ amount: 900 }),
        ])
      );
    });

    it("in", async () => {
      const orga = await organizations().create({
        name: "Test Organization",
      });
      const bank = await bankAccounts().create({
        iban: "DE89370400440532013000",
        organization_id: orga.id,
      });

      const records = await Promise.all([
        incomes().create<IncomeRecord>({
          amount: 15,
          bank_account_id: bank.id,
        }),
        incomes().create<IncomeRecord>({
          amount: 30,
          bank_account_id: bank.id,
        }),
        incomes().create<IncomeRecord>({
          amount: 45,
          bank_account_id: bank.id,
        }),
      ]);

      const keep = [records[0], records[2]];

      const productsResult = await incomes().list<IncomeRecord>({
        filters: {
          conditionTree: {
            field: "amount",
            operator: "In",
            value: keep.map((record) => record.amount),
          },
        },
      });

      expect(productsResult).toHaveLength(keep.length);
      keep.forEach((record) =>
        expect(productsResult).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ amount: record.amount }),
          ])
        )
      );
    });

    it("not in", async () => {
      const orga = await organizations().create({
        name: "Test Organization",
      });
      const bank = await bankAccounts().create({
        iban: "DE89370400440532013000",
        organization_id: orga.id,
      });

      const records = await Promise.all([
        incomes().create<IncomeRecord>({
          amount: 55,
          bank_account_id: bank.id,
        }),
        incomes().create<IncomeRecord>({
          amount: 65,
          bank_account_id: bank.id,
        }),
        incomes().create<IncomeRecord>({
          amount: 75,
          bank_account_id: bank.id,
        }),
      ]);

      const excluded = [records[0], records[1]];

      const productsResult = await incomes().list<IncomeRecord>({
        filters: {
          conditionTree: {
            field: "amount",
            operator: "NotIn",
            value: excluded.map((record) => record.amount),
          },
        },
      });

      const expected = records.find(
        (record) => !excluded.some((ex) => ex.id === record.id)
      );

      if (!expected) {
        throw new Error("Expected record not found in NotIn test");
      }
      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ amount: expected.amount }),
        ])
      );
    });

    it("present", async () => {
      const orga = await organizations().create({
        name: "Test Organization",
      });
      const bank = await bankAccounts().create({
        iban: "DE89370400440532013000",
        organization_id: orga.id,
      });

      await incomes().create<IncomeRecord>({
        amount: 10,
        bank_account_id: bank.id,
      });
      await incomes().create<IncomeRecord>({
        amount: null,
        bank_account_id: bank.id,
      });

      const productsResult = await incomes().list<IncomeRecord>({
        filters: {
          conditionTree: {
            field: "amount",
            operator: "Present",
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([expect.objectContaining({ amount: 10 })])
      );
    });

    it("missing", async () => {
      const orga = await organizations().create({
        name: "Test Organization",
      });
      const bank = await bankAccounts().create({
        iban: "DE89370400440532013000",
        organization_id: orga.id,
      });

      await Promise.all([
        incomes().create<IncomeRecord>({
          amount: null,
          bank_account_id: bank.id,
        }),
        incomes().create<IncomeRecord>({
          amount: 300,
          bank_account_id: bank.id,
        }),
      ]);

      const productsResult = await incomes().list<IncomeRecord>({
        filters: {
          conditionTree: {
            field: "amount",
            operator: "Missing",
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([expect.objectContaining({ amount: null })])
      );
    });

    it("blank", async () => {
      const orga = await organizations().create({
        name: "Test Organization",
      });
      const bank = await bankAccounts().create({
        iban: "DE89370400440532013000",
        organization_id: orga.id,
      });

      await Promise.all([
        incomes().create<IncomeRecord>({
          amount: null,
          bank_account_id: bank.id,
        }),
        incomes().create<IncomeRecord>({
          amount: 25,
          bank_account_id: bank.id,
        }),
      ]);

      const productsResult = await incomes().list<IncomeRecord>({
        filters: {
          conditionTree: {
            field: "amount",
            operator: "Blank",
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([expect.objectContaining({ amount: null })])
      );
    });
  });
});
