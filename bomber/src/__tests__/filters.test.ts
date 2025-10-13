import { SelectOptions } from "@forestadmin-experimental/agent-nodejs-testing/dist/remote-agent-client/types";
import { mountAgentClient } from "../agent-setup";

type AgentClient = Awaited<ReturnType<typeof mountAgentClient>>;
type ProductRecord = { id: string; name: string | null };

const PRODUCTS_COLLECTION = "Biller__Product";

describe("filters", () => {
  let clientAgent: AgentClient;

  beforeAll(async () => {
    clientAgent = await mountAgentClient();
  });

  const products = () => clientAgent.collection(PRODUCTS_COLLECTION);
  const uniqueSeed = () =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  describe("type string", () => {
    it("contains", async () => {
      const createdAfter = new Date().toISOString();

      await Promise.all([
        products().create<ProductRecord>({
          name: "Test-scra",
        }),
        products().create<ProductRecord>({
          name: "Test-scra-2",
        }),
        products().create<ProductRecord>({
          name: "test-scra",
        }),
        products().create<ProductRecord>({
          name: "yes-test-scra",
        }),
        products().create<ProductRecord>({
          name: "yes-tNOst-scra",
        }),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            aggregator: "And",
            conditions: [
              {
                field: "name",
                operator: "Contains",
                value: "Test-scra",
              },
              {
                field: "created_at",
                operator: "After",
                value: createdAfter,
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(4);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "Test-scra" }),
          expect.objectContaining({ name: "Test-scra-2" }),
          expect.objectContaining({ name: "test-scra" }),
          expect.objectContaining({ name: "yes-test-scra" }),
        ])
      );
    });

    it("equal", async () => {
      const createdAfter = new Date().toISOString();

      await Promise.all([
        products().create<ProductRecord>({ name: "string-equal-target" }),
        products().create<ProductRecord>({ name: "string-equal-other" }),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            aggregator: "And",
            conditions: [
              {
                field: "name",
                operator: "Equal",
                value: "string-equal-target",
              },
              {
                field: "created_at",
                operator: "After",
                value: createdAfter,
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "string-equal-target" }),
        ])
      );
    });

    it("starts with", async () => {
      const createdAfter = new Date().toISOString();

      await Promise.all([
        products().create<ProductRecord>({ name: "string-startswith-match-a" }),
        products().create<ProductRecord>({ name: "string-startswith-match-b" }),
        products().create<ProductRecord>({ name: "other-startswith" }),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            aggregator: "And",
            conditions: [
              {
                field: "name",
                operator: "StartsWith",
                value: "string-startswith",
              },
              {
                field: "created_at",
                operator: "After",
                value: createdAfter,
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(2);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "string-startswith-match-a" }),
          expect.objectContaining({ name: "string-startswith-match-b" }),
        ])
      );
    });

    it("ends with", async () => {
      const createdAfter = new Date().toISOString();

      await Promise.all([
        products().create<ProductRecord>({
          name: "string-endswith-match-alpha",
        }),
        products().create<ProductRecord>({
          name: "string-endswith-match-beta",
        }),
        products().create<ProductRecord>({ name: "string-endswith-unrelated" }),
        products().create<ProductRecord>({ name: "another-endswith-target" }),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            aggregator: "And",
            conditions: [
              {
                field: "name",
                operator: "EndsWith",
                value: "match-beta",
              },
              {
                field: "created_at",
                operator: "After",
                value: createdAfter,
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "string-endswith-match-beta" }),
        ])
      );
    });

    it("not contains", async () => {
      const createdAfter = new Date().toISOString();

      await Promise.all([
        products().create<ProductRecord>({ name: "string-notcontains-keep-a" }),
        products().create<ProductRecord>({ name: "string-notcontains-keep-b" }),
        products().create<ProductRecord>({
          name: "string-notcontains-excluded",
        }),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            aggregator: "And",
            conditions: [
              {
                field: "name",
                operator: "Contains",
                value: "string-notcontains",
              },
              {
                field: "name",
                operator: "NotContains",
                value: "excluded",
              },
              {
                field: "created_at",
                operator: "After",
                value: createdAfter,
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(2);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "string-notcontains-keep-a" }),
          expect.objectContaining({ name: "string-notcontains-keep-b" }),
        ])
      );
    });

    it("in", async () => {
      const createdAfter = new Date().toISOString();

      await Promise.all([
        products().create<ProductRecord>({ name: "string-in-choice-a" }),
        products().create<ProductRecord>({ name: "string-in-choice-b" }),
        products().create<ProductRecord>({ name: "string-in-choice-c" }),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            aggregator: "And",
            conditions: [
              {
                field: "name",
                operator: "In",
                value: ["string-in-choice-a", "string-in-choice-c"],
              },
              {
                field: "created_at",
                operator: "After",
                value: createdAfter,
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(2);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "string-in-choice-a" }),
          expect.objectContaining({ name: "string-in-choice-c" }),
        ])
      );
    });

    it("blank", async () => {
      const createdAfter = new Date().toISOString();

      await Promise.all([
        products().create<ProductRecord>({ name: "" }),
        products().create<ProductRecord>({ name: "string-blank-other" }),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            aggregator: "And",
            conditions: [
              {
                field: "name",
                operator: "Blank",
              },
              {
                field: "created_at",
                operator: "After",
                value: createdAfter,
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: "" })])
      );
    });

    it("not equal", async () => {
      const createdAfter = new Date().toISOString();
      const prefix = `string-notequal-${uniqueSeed()}`;

      await Promise.all([
        products().create<ProductRecord>({ name: `${prefix}-keep` }),
        products().create<ProductRecord>({ name: `${prefix}-exclude` }),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            aggregator: "And",
            conditions: [
              {
                field: "name",
                operator: "Contains",
                value: prefix,
              },
              {
                field: "name",
                operator: "NotEqual",
                value: `${prefix}-exclude`,
              },
              {
                field: "created_at",
                operator: "After",
                value: createdAfter,
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `${prefix}-keep` }),
        ])
      );
    });

    it("not in", async () => {
      const createdAfter = new Date().toISOString();
      const prefix = `string-notin-${uniqueSeed()}`;

      await Promise.all([
        products().create<ProductRecord>({ name: `${prefix}-keep` }),
        products().create<ProductRecord>({ name: `${prefix}-exclude-a` }),
        products().create<ProductRecord>({ name: `${prefix}-exclude-b` }),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            aggregator: "And",
            conditions: [
              {
                field: "name",
                operator: "Contains",
                value: prefix,
              },
              {
                field: "name",
                operator: "NotIn",
                value: [`${prefix}-exclude-a`, `${prefix}-exclude-b`],
              },
              {
                field: "created_at",
                operator: "After",
                value: createdAfter,
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `${prefix}-keep` }),
        ])
      );
    });

    it("i contains", async () => {
      const createdAfter = new Date().toISOString();
      const marker = `string-icontains-${uniqueSeed()}`;

      await Promise.all([
        products().create<ProductRecord>({ name: `${marker}-match-a` }),
        products().create<ProductRecord>({
          name: `${marker.toUpperCase()}-MATCH-b`,
        }),
        products().create<ProductRecord>({ name: `no-match-${uniqueSeed()}` }),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            aggregator: "And",
            conditions: [
              {
                field: "name",
                operator: "IContains",
                value: marker,
              },
              {
                field: "created_at",
                operator: "After",
                value: createdAfter,
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(2);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `${marker}-match-a` }),
          expect.objectContaining({ name: `${marker.toUpperCase()}-MATCH-b` }),
        ])
      );
    });

    it("i starts with", async () => {
      const createdAfter = new Date().toISOString();
      const marker = `string-istarts-${uniqueSeed()}`;

      await Promise.all([
        products().create<ProductRecord>({ name: `${marker}-match-a` }),
        products().create<ProductRecord>({
          name: `${marker.toUpperCase()}-MATCH-b`,
        }),
        products().create<ProductRecord>({ name: `prefix-${marker}-miss` }),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            aggregator: "And",
            conditions: [
              {
                field: "name",
                operator: "IStartsWith",
                value: marker,
              },
              {
                field: "created_at",
                operator: "After",
                value: createdAfter,
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(2);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `${marker}-match-a` }),
          expect.objectContaining({ name: `${marker.toUpperCase()}-MATCH-b` }),
        ])
      );
    });

    it("i ends with", async () => {
      const createdAfter = new Date().toISOString();
      const suffix = `string-iends-${uniqueSeed()}`;

      await Promise.all([
        products().create<ProductRecord>({ name: `prefix-a-${suffix}` }),
        products().create<ProductRecord>({
          name: `PREFIX-B-${suffix.toUpperCase()}`,
        }),
        products().create<ProductRecord>({ name: `${suffix}-trailing-miss` }),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            aggregator: "And",
            conditions: [
              {
                field: "name",
                operator: "IEndsWith",
                value: suffix,
              },
              {
                field: "created_at",
                operator: "After",
                value: createdAfter,
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(2);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `prefix-a-${suffix}` }),
          expect.objectContaining({
            name: `PREFIX-B-${suffix.toUpperCase()}`,
          }),
        ])
      );
    });

    it("like", async () => {
      const createdAfter = new Date().toISOString();
      const base = `string-like-${uniqueSeed()}`;

      await Promise.all([
        products().create<ProductRecord>({ name: `${base}-target-a` }),
        products().create<ProductRecord>({ name: `${base}-target-b` }),
        products().create<ProductRecord>({ name: `${base}-miss` }),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            aggregator: "And",
            conditions: [
              {
                field: "name",
                operator: "Like",
                value: `${base}-target-%`,
              },
              {
                field: "created_at",
                operator: "After",
                value: createdAfter,
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(2);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `${base}-target-a` }),
          expect.objectContaining({ name: `${base}-target-b` }),
        ])
      );
    });

    it("i like", async () => {
      const createdAfter = new Date().toISOString();
      const base = `string-ilike-${uniqueSeed()}`;

      await Promise.all([
        products().create<ProductRecord>({ name: `${base}-target-a` }),
        products().create<ProductRecord>({
          name: `${base.toUpperCase()}-TARGET-b`,
        }),
        products().create<ProductRecord>({ name: `${base}-miss` }),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            aggregator: "And",
            conditions: [
              {
                field: "name",
                operator: "ILike",
                value: `${base.toUpperCase()}-TARGET-%`,
              },
              {
                field: "created_at",
                operator: "After",
                value: createdAfter,
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(2);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `${base}-target-a` }),
          expect.objectContaining({
            name: `${base.toUpperCase()}-TARGET-b`,
          }),
        ])
      );
    });

    it("longer than", async () => {
      const createdAfter = new Date().toISOString();
      const base = `string-longer-${uniqueSeed()}`;

      await Promise.all([
        products().create<ProductRecord>({
          name: `${base}-this-is-a-very-long-target`,
        }),
        products().create<ProductRecord>({ name: `${base}-short` }),
      ]);

      const productsResult = await products().list<ProductRecord>({
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
                field: "name",
                operator: "LongerThan",
                value: 25,
              },
              {
                field: "created_at",
                operator: "After",
                value: createdAfter,
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: `${base}-this-is-a-very-long-target`,
          }),
        ])
      );
    });

    it("shorter than", async () => {
      const createdAfter = new Date().toISOString();
      const base = `string-shorter-${uniqueSeed()}`;

      await Promise.all([
        products().create<ProductRecord>({ name: `${base}-tiny` }),
        products().create<ProductRecord>({
          name: `${base}-this-is-a-very-long-target`,
        }),
      ]);

      const productsResult = await products().list<ProductRecord>({
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
                field: "name",
                operator: "ShorterThan",
                value: 15,
              },
              {
                field: "created_at",
                operator: "After",
                value: createdAfter,
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `${base}-tiny` }),
        ])
      );
    });

    it("present", async () => {
      const createdAfter = new Date().toISOString();
      const name = `string-present-${uniqueSeed()}`;

      await Promise.all([
        products().create<ProductRecord>({ name }),
        products().create<ProductRecord>({ name: null }),
        products().create<ProductRecord>({ name: "" }),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            aggregator: "And",
            conditions: [
              {
                field: "name",
                operator: "Present",
              },
              {
                field: "created_at",
                operator: "After",
                value: createdAfter,
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([expect.objectContaining({ name })])
      );
    });

    it("missing", async () => {
      const createdAfter = new Date().toISOString();

      await Promise.all([
        products().create<ProductRecord>({ name: null }),
        products().create<ProductRecord>({
          name: `string-missing-${uniqueSeed()}`,
        }),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            aggregator: "And",
            conditions: [
              {
                field: "name",
                operator: "Missing",
              },
              {
                field: "created_at",
                operator: "After",
                value: createdAfter,
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: null })])
      );
    });

    it("not i contains", async () => {
      const createdAfter = new Date().toISOString();
      const base = `string-noticontains-${uniqueSeed()}`;

      await Promise.all([
        products().create<ProductRecord>({ name: `${base}-allowed` }),
        products().create<ProductRecord>({
          name: `${base}-Excluded`,
        }),
      ]);

      const productsResult = await products().list<ProductRecord>({
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
                field: "name",
                operator: "NotIContains",
                value: "excluded",
              },
              {
                field: "created_at",
                operator: "After",
                value: createdAfter,
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `${base}-allowed` }),
        ])
      );
    });

    it("less than", async () => {
      const createdAfter = new Date().toISOString();
      const base = `string-lessthan-${uniqueSeed()}`;

      await Promise.all([
        products().create<ProductRecord>({ name: `${base}-a` }),
        products().create<ProductRecord>({ name: `${base}-b` }),
        products().create<ProductRecord>({ name: `${base}-c` }),
      ]);

      const productsResult = await products().list<ProductRecord>({
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
                field: "name",
                operator: "LessThan",
                value: `${base}-b`,
              },
              {
                field: "created_at",
                operator: "After",
                value: createdAfter,
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: `${base}-a` })])
      );
    });

    it("less than or equal", async () => {
      const createdAfter = new Date().toISOString();
      const base = `string-lessthaneq-${uniqueSeed()}`;

      await Promise.all([
        products().create<ProductRecord>({ name: `${base}-a` }),
        products().create<ProductRecord>({ name: `${base}-b` }),
        products().create<ProductRecord>({ name: `${base}-c` }),
      ]);

      const productsResult = await products().list<ProductRecord>({
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
                field: "name",
                operator: "LessThanOrEqual",
                value: `${base}-b`,
              },
              {
                field: "created_at",
                operator: "After",
                value: createdAfter,
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(2);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `${base}-a` }),
          expect.objectContaining({ name: `${base}-b` }),
        ])
      );
    });

    it("greater than", async () => {
      const createdAfter = new Date().toISOString();
      const base = `string-greaterthan-${uniqueSeed()}`;

      await Promise.all([
        products().create<ProductRecord>({ name: `${base}-a` }),
        products().create<ProductRecord>({ name: `${base}-b` }),
        products().create<ProductRecord>({ name: `${base}-c` }),
      ]);

      const productsResult = await products().list<ProductRecord>({
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
                field: "name",
                operator: "GreaterThan",
                value: `${base}-b`,
              },
              {
                field: "created_at",
                operator: "After",
                value: createdAfter,
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: `${base}-c` })])
      );
    });

    it("greater than or equal", async () => {
      const createdAfter = new Date().toISOString();
      const base = `string-greaterthaneq-${uniqueSeed()}`;

      await Promise.all([
        products().create<ProductRecord>({ name: `${base}-a` }),
        products().create<ProductRecord>({ name: `${base}-b` }),
        products().create<ProductRecord>({ name: `${base}-c` }),
      ]);

      const productsResult = await products().list<ProductRecord>({
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
                field: "name",
                operator: "GreaterThanOrEqual",
                value: `${base}-b`,
              },
              {
                field: "created_at",
                operator: "After",
                value: createdAfter,
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(2);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `${base}-b` }),
          expect.objectContaining({ name: `${base}-c` }),
        ])
      );
    });

    it("match", async () => {
      const createdAfter = new Date().toISOString();
      const base = `string-match-${uniqueSeed()}`;

      await Promise.all([
        products().create<ProductRecord>({ name: `${base}-target` }),
        products().create<ProductRecord>({ name: `${base}-other` }),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            aggregator: "And",
            conditions: [
              {
                field: "name",
                operator: "Match",
                value: `${base}-target`,
              },
              {
                field: "created_at",
                operator: "After",
                value: createdAfter,
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `${base}-target` }),
        ])
      );
    });
  });
});
