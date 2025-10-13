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
  beforeEach(async () => {
    const allProducts = await products().list<ProductRecord>();
    if (allProducts.length > 0) {
      await products().delete(
        allProducts.map((product) => String(product.id))
      );
    }
  });

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
      await Promise.all([
        products().create<ProductRecord>({ name: "string-notequal-keep" }),
        products().create<ProductRecord>({ name: "string-notequal-exclude" }),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            aggregator: "And",
            conditions: [
              {
                field: "name",
                operator: "Contains",
                value: "string-notequal",
              },
              {
                field: "name",
                operator: "NotEqual",
                value: "string-notequal-exclude",
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "string-notequal-keep" }),
        ])
      );
    });

    it("not in", async () => {
      await Promise.all([
        products().create<ProductRecord>({ name: "string-notin-keep" }),
        products().create<ProductRecord>({ name: "string-notin-exclude-a" }),
        products().create<ProductRecord>({ name: "string-notin-exclude-b" }),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            aggregator: "And",
            conditions: [
              {
                field: "name",
                operator: "Contains",
                value: "string-notin",
              },
              {
                field: "name",
                operator: "NotIn",
                value: ["string-notin-exclude-a", "string-notin-exclude-b"],
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "string-notin-keep" }),
        ])
      );
    });

    it("i contains", async () => {
      await Promise.all([
        products().create<ProductRecord>({ name: "string-icontains-match-a" }),
        products().create<ProductRecord>({
          name: "STRING-ICONTAINS-MATCH-b",
        }),
        products().create<ProductRecord>({ name: "unrelated-entry" }),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            aggregator: "And",
            conditions: [
              {
                field: "name",
                operator: "IContains",
                value: "string-icontains",
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(2);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "string-icontains-match-a" }),
          expect.objectContaining({ name: "STRING-ICONTAINS-MATCH-b" }),
        ])
      );
    });

    it("i starts with", async () => {
      await Promise.all([
        products().create<ProductRecord>({ name: "string-istarts-match-a" }),
        products().create<ProductRecord>({
          name: "STRING-ISTARTS-MATCH-b",
        }),
        products().create<ProductRecord>({ name: "prefix-string-istarts-miss" }),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            aggregator: "And",
            conditions: [
              {
                field: "name",
                operator: "IStartsWith",
                value: "string-istarts",
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(2);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "string-istarts-match-a" }),
          expect.objectContaining({ name: "STRING-ISTARTS-MATCH-b" }),
        ])
      );
    });

    it("i ends with", async () => {
      await Promise.all([
        products().create<ProductRecord>({ name: "prefix-a-string-iends" }),
        products().create<ProductRecord>({
          name: "PREFIX-B-STRING-IENDS",
        }),
        products().create<ProductRecord>({ name: "string-iends-trailing-miss" }),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            aggregator: "And",
            conditions: [
              {
                field: "name",
                operator: "IEndsWith",
                value: "string-iends",
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(2);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "prefix-a-string-iends" }),
          expect.objectContaining({
            name: "PREFIX-B-STRING-IENDS",
          }),
        ])
      );
    });

    it("like", async () => {
      await Promise.all([
        products().create<ProductRecord>({ name: "string-like-target-a" }),
        products().create<ProductRecord>({ name: "string-like-target-b" }),
        products().create<ProductRecord>({ name: "string-like-miss" }),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            aggregator: "And",
            conditions: [
              {
                field: "name",
                operator: "Like",
                value: "string-like-target-%",
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(2);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "string-like-target-a" }),
          expect.objectContaining({ name: "string-like-target-b" }),
        ])
      );
    });

    it("i like", async () => {
      await Promise.all([
        products().create<ProductRecord>({ name: "string-ilike-target-a" }),
        products().create<ProductRecord>({
          name: "STRING-ILIKE-TARGET-b",
        }),
        products().create<ProductRecord>({ name: "string-ilike-miss" }),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            aggregator: "And",
            conditions: [
              {
                field: "name",
                operator: "ILike",
                value: "STRING-ILIKE-TARGET-%",
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(2);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "string-ilike-target-a" }),
          expect.objectContaining({
            name: "STRING-ILIKE-TARGET-b",
          }),
        ])
      );
    });

    it("longer than", async () => {
      await Promise.all([
        products().create<ProductRecord>({
          name: "string-longer-this-is-a-very-long-target",
        }),
        products().create<ProductRecord>({ name: "string-longer-short" }),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            aggregator: "And",
            conditions: [
              {
                field: "name",
                operator: "Contains",
                value: "string-longer",
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
            name: "string-longer-this-is-a-very-long-target",
          }),
        ])
      );
    });

    it("shorter than", async () => {
      const shortName = "string-shorter-tiny";
      const longName = "string-shorter-this-is-a-very-long-target";

      await Promise.all([
        products().create<ProductRecord>({ name: shortName }),
        products().create<ProductRecord>({ name: longName }),
      ]);

      const limit = shortName.length + 1;
      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            aggregator: "And",
            conditions: [
              {
                field: "name",
                operator: "Contains",
                value: "string-shorter",
              },
              {
                field: "name",
                operator: "ShorterThan",
                value: limit,
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: shortName }),
        ])
      );
    });

    it("present", async () => {
      const name = "string-present-value";

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
        products().create<ProductRecord>({ name: "string-missing-other" }),
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
      await Promise.all([
        products().create<ProductRecord>({ name: "string-noticontains-allowed" }),
        products().create<ProductRecord>({
          name: "string-noticontains-Excluded",
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
                value: "string-noticontains",
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
          expect.objectContaining({ name: "string-noticontains-allowed" }),
        ])
      );
    });

    it("less than", async () => {
      const shortName = "string-lessthan-s";
      const mediumName = "string-lessthan-medium-length";
      const longName = "string-lessthan-very-very-long-entry";

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
                value: "string-lessthan",
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
      const shortName = "string-lessthaneq-short";
      const mediumName = "string-lessthaneq-medium-length";
      const longName = "string-lessthaneq-very-very-long-entry";

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
                value: "string-lessthaneq",
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
      const shortName = "string-greaterthan-short";
      const mediumName = "string-greaterthan-medium-length";
      const longName = "string-greaterthan-very-very-long-entry";

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
                value: "string-greaterthan",
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
      const shortName = "string-greaterthaneq-short";
      const mediumName = "string-greaterthaneq-medium-length";
      const longName = "string-greaterthaneq-very-very-long-entry";

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
                value: "string-greaterthaneq",
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
      await Promise.all([
        products().create<ProductRecord>({ name: "string-match-target" }),
        products().create<ProductRecord>({ name: "string-match-other" }),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            aggregator: "And",
            conditions: [
              {
                field: "name",
                operator: "Match",
                value: "string-match-target",
              },
            ],
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "string-match-target" }),
        ])
      );
    });
  });
});
