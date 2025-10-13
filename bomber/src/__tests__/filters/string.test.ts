import { SelectOptions } from "@forestadmin-experimental/agent-nodejs-testing/dist/remote-agent-client/types";
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

  beforeEach(async () => {
    const allProducts = await products().list<ProductRecord>();
    await products().delete(allProducts.map((product) => product.id as number));
  });

  const products = () => clientAgent.collection(PRODUCTS_COLLECTION);
  const uniqueSeed = () =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  describe("type string", () => {
    it("contains", async () => {
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
                value: base.length + "-tiny".length + 2,
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
      const name = `string-present-${uniqueSeed()}`;

      await Promise.all([
        products().create<ProductRecord>({ name }),
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
      const base = `string-lessthan-${uniqueSeed()}`;

      const shortName = `${base}-s`;
      const mediumName = `${base}-medium-length`;
      const longName = `${base}-very-very-long-entry`;

      await Promise.all([
        products().create<ProductRecord>({ name: shortName }),
        products().create<ProductRecord>({ name: mediumName }),
        products().create<ProductRecord>({ name: longName }),
      ]);

      const threshold = mediumName.length;
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
                value: threshold,
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: shortName })])
      );
    });

    it("less than or equal", async () => {
      const base = `string-lessthaneq-${uniqueSeed()}`;

      const shortName = `${base}-short`;
      const mediumName = `${base}-medium-length`;
      const longName = `${base}-very-very-long-entry`;

      await Promise.all([
        products().create<ProductRecord>({ name: shortName }),
        products().create<ProductRecord>({ name: mediumName }),
        products().create<ProductRecord>({ name: longName }),
      ]);

      const threshold = mediumName.length;
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
                value: threshold,
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(2);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: shortName }),
          expect.objectContaining({ name: mediumName }),
        ])
      );
    });

    it("greater than", async () => {
      const base = `string-greaterthan-${uniqueSeed()}`;

      const shortName = `${base}-short`;
      const mediumName = `${base}-medium-length`;
      const longName = `${base}-very-very-long-entry`;

      await Promise.all([
        products().create<ProductRecord>({ name: shortName }),
        products().create<ProductRecord>({ name: mediumName }),
        products().create<ProductRecord>({ name: longName }),
      ]);

      const threshold = mediumName.length;
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
                value: threshold,
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: longName })])
      );
    });

    it("greater than or equal", async () => {
      const base = `string-greaterthaneq-${uniqueSeed()}`;

      const shortName = `${base}-short`;
      const mediumName = `${base}-medium-length`;
      const longName = `${base}-very-very-long-entry`;

      await Promise.all([
        products().create<ProductRecord>({ name: shortName }),
        products().create<ProductRecord>({ name: mediumName }),
        products().create<ProductRecord>({ name: longName }),
      ]);

      const threshold = mediumName.length;
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
                value: threshold,
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(2);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: mediumName }),
          expect.objectContaining({ name: longName }),
        ])
      );
    });

    it("match", async () => {
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
