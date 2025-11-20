import { mountAgentClient } from "../../agent-setup";
import { clearCollections } from "../helpers";

type AgentClient = Awaited<ReturnType<typeof mountAgentClient>>;
type ProductRecord = {
  id: string | number;
  name: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const PRODUCTS_COLLECTION = "Biller__Product";

const hoursAgo = (hours: number) =>
  new Date(Date.now() - hours * 60 * 60 * 1000);
const hoursAhead = (hours: number) =>
  new Date(Date.now() + hours * 60 * 60 * 1000);
const daysAgo = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const toMidday = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  return copy;
};
const addMonths = (date: Date, months: number) => {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
};
const addYears = (date: Date, years: number) => {
  const copy = new Date(date);
  copy.setFullYear(copy.getFullYear() + years);
  return copy;
};
const startOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);
const startOfQuarter = (date: Date) => {
  const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3;
  return new Date(date.getFullYear(), quarterStartMonth, 1);
};
const startOfYear = (date: Date) => new Date(date.getFullYear(), 0, 1);
const startOfWeek = (date: Date) => {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = (day + 6) % 7;
  copy.setDate(copy.getDate() - diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
};
const dateInPreviousWeek = () => toMidday(daysAgo(4));
const dateTwoWeeksAgo = () => toMidday(daysAgo(15));
const dateInPreviousMonth = () =>
  toMidday(addMonths(startOfMonth(new Date()), -1));
const dateTwoMonthsAgo = () =>
  toMidday(addMonths(startOfMonth(new Date()), -2));
const dateInPreviousQuarter = () =>
  toMidday(addMonths(startOfQuarter(new Date()), -3));
const dateTwoQuartersAgo = () =>
  toMidday(addMonths(startOfQuarter(new Date()), -6));
const dateInPreviousYear = () => {
  const now = new Date();
  return toMidday(new Date(now.getFullYear() - 1, 6, 15));
};
const startOfThisYear = () => startOfYear(new Date());
const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};
const addHours = (date: Date, hours: number) => {
  const copy = new Date(date);
  copy.setHours(copy.getHours() + hours);
  return copy;
};
const dateTwoYearsAgo = () => {
  const now = new Date();
  return toMidday(new Date(now.getFullYear() - 2, 6, 15));
};
const midpoint = (start: Date, end: Date) =>
  new Date(start.getTime() + (end.getTime() - start.getTime()) / 2);

describe("filters", () => {
  let clientAgent: AgentClient;

  beforeAll(async () => {
    clientAgent = await mountAgentClient();
  });

  beforeEach(async () => {
    await clearCollections(clientAgent);
  });

  const products = () => clientAgent.collection(PRODUCTS_COLLECTION);

  const createProductAt = async (name: string, createdAt: Date) => {
    const payload = {
      name,
      created_at: createdAt.toISOString(),
      updated_at: createdAt.toISOString(),
    };
    const created = await products().create<ProductRecord>(payload);
    const productId = created.id;

    await products().update<ProductRecord>(productId, {
      created_at: createdAt.toISOString(),
      updated_at: createdAt.toISOString(),
    });

    return { id: productId, name };
  };

  describe("type date", () => {
    it("after", async () => {
      await Promise.all([
        createProductAt(`earlier`, hoursAgo(3)),
        createProductAt(`later`, hoursAgo(0.5)),
      ]);

      const threshold = hoursAgo(2).toISOString();
      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            field: "created_at",
            operator: "After",
            value: threshold,
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: `later` })])
      );
    });

    it("before", async () => {
      await Promise.all([
        createProductAt(`earlier`, hoursAgo(5)),
        createProductAt(`later`, hoursAgo(1)),
      ]);

      const threshold = hoursAgo(3).toISOString();
      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            field: "created_at",
            operator: "Before",
            value: threshold,
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: `earlier` })])
      );
    });

    it("after x hours ago", async () => {
      await Promise.all([
        createProductAt(`within`, hoursAgo(3)),
        createProductAt(`outside`, hoursAgo(7)),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            field: "created_at",
            operator: "AfterXHoursAgo",
            value: 5,
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: `within` })])
      );
    });

    it("before x hours ago", async () => {
      await Promise.all([
        createProductAt(`within`, hoursAgo(7)),
        createProductAt(`outside`, hoursAgo(3)),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            field: "created_at",
            operator: "BeforeXHoursAgo",
            value: 5,
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: `within` })])
      );
    });

    it("past", async () => {
      await Promise.all([
        createProductAt(`past`, hoursAgo(2)),
        createProductAt(`future`, hoursAhead(2)),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            field: "created_at",
            operator: "Past",
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: `past` })])
      );
    });

    it("future", async () => {
      await Promise.all([
        createProductAt(`future`, hoursAhead(4)),
        createProductAt(`past`, hoursAgo(2)),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            field: "created_at",
            operator: "Future",
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: `future` })])
      );
    });

    it("today", async () => {
      await Promise.all([
        createProductAt(`today`, new Date()),
        createProductAt(`older`, daysAgo(2)),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            field: "created_at",
            operator: "Today",
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: `today` })])
      );
    });

    it("yesterday", async () => {
      await Promise.all([
        createProductAt(`yesterday`, daysAgo(1)),
        createProductAt(`older`, daysAgo(3)),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            field: "created_at",
            operator: "Yesterday",
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: `yesterday` })])
      );
    });

    it("previous x days", async () => {
      await Promise.all([
        createProductAt(`previous-x-days-match`, daysAgo(2)),
        createProductAt(`previous-x-days-today`, new Date()),
        createProductAt(`previous-x-days-older`, daysAgo(5)),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            field: "created_at",
            operator: "PreviousXDays",
            value: 3,
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `previous-x-days-match` }),
        ])
      );
      expect(
        productsResult.find(
          (product) => product.name === `previous-x-days-today`
        )
      ).toBeUndefined();
    });

    it("previous x days to date", async () => {
      await Promise.all([
        createProductAt(`previous-x-days-to-date-match`, daysAgo(2)),
        createProductAt(`previous-x-days-to-date-older`, daysAgo(5)),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            field: "created_at",
            operator: "PreviousXDaysToDate",
            value: 3,
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `previous-x-days-to-date-match` }),
        ])
      );
    });

    it("previous week", async () => {
      await Promise.all([
        createProductAt(`previous-week-match`, dateInPreviousWeek()),
        createProductAt(`previous-week-older`, dateTwoWeeksAgo()),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            field: "created_at",
            operator: "PreviousWeek",
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `previous-week-match` }),
        ])
      );
    });

    it("previous week to date", async () => {
      const now = new Date();
      const weekStart = startOfWeek(now);
      const inside = midpoint(weekStart, now);
      const nearNow = midpoint(inside, now);
      const boundary = weekStart;
      const before = addHours(weekStart, -1);

      await Promise.all([
        createProductAt(`previous-week-to-date-inside`, inside),
        createProductAt(`previous-week-to-date-near-now`, nearNow),
        createProductAt(`previous-week-to-date-boundary`, boundary),
        createProductAt(`previous-week-to-date-before`, before),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            field: "created_at",
            operator: "PreviousWeekToDate",
          },
        },
      });

      const names = productsResult.map(({ name }) => name);
      expect(names).toEqual(
        expect.arrayContaining([
          `previous-week-to-date-inside`,
          `previous-week-to-date-near-now`,
        ])
      );
      expect(names).not.toContain(`previous-week-to-date-before`);
      expect(names).not.toContain(`previous-week-to-date-boundary`);
    });

    it("previous month", async () => {
      await Promise.all([
        createProductAt(`previous-month-match`, dateInPreviousMonth()),
        createProductAt(`previous-month-older`, dateTwoMonthsAgo()),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            field: "created_at",
            operator: "PreviousMonth",
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `previous-month-match` }),
        ])
      );
    });

    it("previous month to date", async () => {
      const now = new Date();
      const monthStart = startOfMonth(now);
      const inside = midpoint(monthStart, now);
      const nearNow = midpoint(inside, now);
      const boundary = monthStart;
      const before = addDays(monthStart, -1);

      await Promise.all([
        createProductAt(`previous-month-to-date-inside`, inside),
        createProductAt(`previous-month-to-date-near-now`, nearNow),
        createProductAt(`previous-month-to-date-boundary`, boundary),
        createProductAt(`previous-month-to-date-before`, before),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            field: "created_at",
            operator: "PreviousMonthToDate",
          },
        },
      });

      const names = productsResult.map(({ name }) => name);
      expect(names).toEqual(
        expect.arrayContaining([
          `previous-month-to-date-inside`,
          `previous-month-to-date-near-now`,
        ])
      );
      expect(names).not.toContain(`previous-month-to-date-before`);
      expect(names).not.toContain(`previous-month-to-date-boundary`);
    });

    it("previous quarter", async () => {
      await Promise.all([
        createProductAt(`previous-quarter-match`, dateInPreviousQuarter()),
        createProductAt(`previous-quarter-older`, dateTwoQuartersAgo()),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            field: "created_at",
            operator: "PreviousQuarter",
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `previous-quarter-match` }),
        ])
      );
    });

    it("previous quarter to date", async () => {
      const now = new Date();
      const quarterStart = startOfQuarter(now);
      const inside = midpoint(quarterStart, now);
      const nearNow = midpoint(inside, now);
      const boundary = quarterStart;
      const before = addDays(quarterStart, -1);

      await Promise.all([
        createProductAt(`previous-quarter-to-date-inside`, inside),
        createProductAt(`previous-quarter-to-date-near-now`, nearNow),
        createProductAt(`previous-quarter-to-date-boundary`, boundary),
        createProductAt(`previous-quarter-to-date-before`, before),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            field: "created_at",
            operator: "PreviousQuarterToDate",
          },
        },
      });

      const names = productsResult.map(({ name }) => name);
      expect(names).toEqual(
        expect.arrayContaining([
          `previous-quarter-to-date-inside`,
          `previous-quarter-to-date-near-now`,
        ])
      );
      expect(names).not.toContain(`previous-quarter-to-date-before`);
      expect(names).not.toContain(`previous-quarter-to-date-boundary`);
    });

    it("previous year", async () => {
      await Promise.all([
        createProductAt(`previous-year-match`, dateInPreviousYear()),
        createProductAt(`previous-year-older`, dateTwoYearsAgo()),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            field: "created_at",
            operator: "PreviousYear",
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `previous-year-match` }),
        ])
      );
    });

    it("previous year to date", async () => {
      const now = new Date();
      const yearStart = startOfThisYear();
      const inside = midpoint(yearStart, now);
      const nearNow = midpoint(inside, now);

      await Promise.all([
        createProductAt(`previous-year-to-date-inside`, inside),
        createProductAt(`previous-year-to-date-near-now`, nearNow),
        createProductAt(`previous-year-to-date-older`, dateTwoYearsAgo()),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            field: "created_at",
            operator: "PreviousYearToDate",
          },
        },
      });

      const names = productsResult.map(({ name }) => name);
      expect(names).toEqual(
        expect.arrayContaining([
          `previous-year-to-date-inside`,
          `previous-year-to-date-near-now`,
        ])
      );
      expect(names).not.toContain(`previous-year-to-date-older`);
    });
  });
});
