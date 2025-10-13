import { mountAgentClient } from "../../agent-setup";

type AgentClient = Awaited<ReturnType<typeof mountAgentClient>>;
type ProductRecord = {
  id: string | number;
  name: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const PRODUCTS_COLLECTION = "Biller__Product";

describe("filters", () => {
  let clientAgent: AgentClient;

  beforeAll(async () => {
    clientAgent = await mountAgentClient();
  });

  const products = () => clientAgent.collection(PRODUCTS_COLLECTION);
  const uniqueSeed = () =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const toNumericId = (record: ProductRecord) => {
    const numericId = Number(record.id);
    if (Number.isNaN(numericId)) {
      throw new Error(`Record id ${record.id} is not numeric`);
    }
    return numericId;
  };
  const listWithBase = async (
    base: string,
    createdAfter: string,
    condition: { field: string; operator: string; value?: unknown }
  ) => {
    return products().list<ProductRecord>({
      filters: {
        conditionTree: {
          aggregator: "And",
          conditions: [
            {
              field: "name",
              operator: "Contains",
              value: base,
            },
            {
              field: "created_at",
              operator: "After",
              value: createdAfter,
            },
            condition,
          ],
        },
      },
    });
  };

  describe("type number", () => {
    it("equal", async () => {
      const base = `number-equal-${uniqueSeed()}`;
      const createdAfter = new Date().toISOString();

      const [target, other] = await Promise.all([
        products().create<ProductRecord>({ name: `${base}-target` }),
        products().create<ProductRecord>({ name: `${base}-other` }),
      ]);

      const productsResult = await listWithBase(base, createdAfter, {
        field: "id",
        operator: "Equal",
        value: toNumericId(target),
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: target.id })])
      );
    });

    it("not equal", async () => {
      const base = `number-notequal-${uniqueSeed()}`;
      const createdAfter = new Date().toISOString();

      const [first, second] = await Promise.all([
        products().create<ProductRecord>({ name: `${base}-first` }),
        products().create<ProductRecord>({ name: `${base}-second` }),
      ]);

      const productsResult = await listWithBase(base, createdAfter, {
        field: "id",
        operator: "NotEqual",
        value: toNumericId(first),
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: second.id })])
      );
    });

    it("less than", async () => {
      const base = `number-lessthan-${uniqueSeed()}`;
      const createdAfter = new Date().toISOString();

      const records = await Promise.all([
        products().create<ProductRecord>({ name: `${base}-a` }),
        products().create<ProductRecord>({ name: `${base}-b` }),
        products().create<ProductRecord>({ name: `${base}-c` }),
      ]);

      const sorted = [...records].sort(
        (a, b) => toNumericId(a) - toNumericId(b)
      );
      const threshold = toNumericId(sorted[1]);

      const productsResult = await listWithBase(base, createdAfter, {
        field: "id",
        operator: "LessThan",
        value: threshold,
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: sorted[0].id })])
      );
    });

    it("less than or equal", async () => {
      const base = `number-lessthaneq-${uniqueSeed()}`;
      const createdAfter = new Date().toISOString();

      const records = await Promise.all([
        products().create<ProductRecord>({ name: `${base}-a` }),
        products().create<ProductRecord>({ name: `${base}-b` }),
        products().create<ProductRecord>({ name: `${base}-c` }),
      ]);

      const sorted = [...records].sort(
        (a, b) => toNumericId(a) - toNumericId(b)
      );
      const threshold = toNumericId(sorted[1]);

      const productsResult = await listWithBase(base, createdAfter, {
        field: "id",
        operator: "LessThanOrEqual",
        value: threshold,
      });

      const expectedIds = new Set([sorted[0].id, sorted[1].id]);
      expect(productsResult).toHaveLength(expectedIds.size);
      expectedIds.forEach((id) =>
        expect(productsResult).toEqual(
          expect.arrayContaining([expect.objectContaining({ id })])
        )
      );
    });

    it("greater than", async () => {
      const base = `number-greaterthan-${uniqueSeed()}`;
      const createdAfter = new Date().toISOString();

      const records = await Promise.all([
        products().create<ProductRecord>({ name: `${base}-a` }),
        products().create<ProductRecord>({ name: `${base}-b` }),
        products().create<ProductRecord>({ name: `${base}-c` }),
      ]);

      const sorted = [...records].sort(
        (a, b) => toNumericId(a) - toNumericId(b)
      );
      const threshold = toNumericId(sorted[1]);

      const productsResult = await listWithBase(base, createdAfter, {
        field: "id",
        operator: "GreaterThan",
        value: threshold,
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: sorted[2].id })])
      );
    });

    it("greater than or equal", async () => {
      const base = `number-greaterthaneq-${uniqueSeed()}`;
      const createdAfter = new Date().toISOString();

      const records = await Promise.all([
        products().create<ProductRecord>({ name: `${base}-a` }),
        products().create<ProductRecord>({ name: `${base}-b` }),
        products().create<ProductRecord>({ name: `${base}-c` }),
      ]);

      const sorted = [...records].sort(
        (a, b) => toNumericId(a) - toNumericId(b)
      );
      const threshold = toNumericId(sorted[1]);

      const productsResult = await listWithBase(base, createdAfter, {
        field: "id",
        operator: "GreaterThanOrEqual",
        value: threshold,
      });

      const expectedIds = new Set([sorted[1].id, sorted[2].id]);
      expect(productsResult).toHaveLength(expectedIds.size);
      expectedIds.forEach((id) =>
        expect(productsResult).toEqual(
          expect.arrayContaining([expect.objectContaining({ id })])
        )
      );
    });

    it("in", async () => {
      const base = `number-in-${uniqueSeed()}`;
      const createdAfter = new Date().toISOString();

      const records = await Promise.all([
        products().create<ProductRecord>({ name: `${base}-a` }),
        products().create<ProductRecord>({ name: `${base}-b` }),
        products().create<ProductRecord>({ name: `${base}-c` }),
      ]);

      const keep = [records[0], records[2]];

      const productsResult = await listWithBase(base, createdAfter, {
        field: "id",
        operator: "In",
        value: keep.map(toNumericId),
      });

      expect(productsResult).toHaveLength(keep.length);
      keep.forEach((record) =>
        expect(productsResult).toEqual(
          expect.arrayContaining([expect.objectContaining({ id: record.id })])
        )
      );
    });

    it("not in", async () => {
      const base = `number-notin-${uniqueSeed()}`;
      const createdAfter = new Date().toISOString();

      const records = await Promise.all([
        products().create<ProductRecord>({ name: `${base}-a` }),
        products().create<ProductRecord>({ name: `${base}-b` }),
        products().create<ProductRecord>({ name: `${base}-c` }),
      ]);

      const excluded = [records[0], records[1]];

      const productsResult = await listWithBase(base, createdAfter, {
        field: "id",
        operator: "NotIn",
        value: excluded.map(toNumericId),
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
          expect.objectContaining({ id: expected.id }),
        ])
      );
    });

    it("present", async () => {
      const base = `number-present-${uniqueSeed()}`;
      const createdAfter = new Date().toISOString();

      const records = await Promise.all([
        products().create<ProductRecord>({ name: `${base}-a` }),
        products().create<ProductRecord>({ name: `${base}-b` }),
      ]);

      const productsResult = await listWithBase(base, createdAfter, {
        field: "id",
        operator: "Present",
      });

      expect(productsResult).toHaveLength(records.length);
      records.forEach((record) =>
        expect(productsResult).toEqual(
          expect.arrayContaining([expect.objectContaining({ id: record.id })])
        )
      );
    });

    it("missing", async () => {
      const base = `number-missing-${uniqueSeed()}`;
      const createdAfter = new Date().toISOString();

      await Promise.all([
        products().create<ProductRecord>({ name: `${base}-a` }),
        products().create<ProductRecord>({ name: `${base}-b` }),
      ]);

      const productsResult = await listWithBase(base, createdAfter, {
        field: "id",
        operator: "Missing",
      });

      expect(productsResult).toHaveLength(0);
    });

    it("blank", async () => {
      const base = `number-blank-${uniqueSeed()}`;
      const createdAfter = new Date().toISOString();

      await Promise.all([
        products().create<ProductRecord>({ name: `${base}-a` }),
        products().create<ProductRecord>({ name: `${base}-b` }),
      ]);

      const productsResult = await listWithBase(base, createdAfter, {
        field: "id",
        operator: "Blank",
      });

      expect(productsResult).toHaveLength(0);
    });
  });
});
