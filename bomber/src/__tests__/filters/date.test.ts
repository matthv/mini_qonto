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
const dateInPreviousWeek = () => toMidday(daysAgo(4));
const dateSameWeekdayPreviousWeek = () => toMidday(daysAgo(6));
const dateTwoWeeksAgo = () => toMidday(daysAgo(15));
const dateInPreviousMonth = () =>
  toMidday(addMonths(startOfMonth(new Date()), -1));
const dateInPreviousMonthPlusOneDay = () => addDays(dateInPreviousMonth(), 1);
const dateTwoMonthsAgo = () =>
  toMidday(addMonths(startOfMonth(new Date()), -2));
const dateInPreviousQuarter = () =>
  toMidday(addMonths(startOfQuarter(new Date()), -3));
const dateInPreviousQuarterPlusOneDay = () =>
  addDays(dateInPreviousQuarter(), 1);
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
const startOfThisYearPlusOneDay = () => addDays(startOfThisYear(), 1);
const dateSameDayPreviousYear = () => toMidday(addYears(new Date(), -1));
const dateTwoYearsAgo = () => {
  const now = new Date();
  return toMidday(new Date(now.getFullYear() - 2, 6, 15));
};
const dateToday = () => toMidday(new Date());

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
      await Promise.all([
        createProductAt(
          `previous-week-to-date-match`,
          dateSameWeekdayPreviousWeek()
        ),
        createProductAt(`previous-week-to-date-match-2`, dateToday()),
        createProductAt(`previous-week-to-date-older`, dateTwoWeeksAgo()),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            field: "created_at",
            operator: "PreviousWeekToDate",
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `previous-week-to-date-match` }),
          expect.objectContaining({ name: `previous-week-to-date-match-2` }),
        ])
      );
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
      await Promise.all([
        createProductAt(`previous-month-to-date-match`, dateInPreviousMonth()),
        createProductAt(
          `previous-month-to-date-match-1`,
          dateInPreviousMonthPlusOneDay()
        ),
        createProductAt(`previous-month-to-date-match-2`, dateToday()),
        createProductAt(`previous-month-to-date-older`, dateTwoMonthsAgo()),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            field: "created_at",
            operator: "PreviousMonthToDate",
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `previous-month-to-date-match` }),
          expect.objectContaining({ name: `previous-month-to-date-match-1` }),
          expect.objectContaining({ name: `previous-month-to-date-match-2` }),
        ])
      );
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
      await Promise.all([
        createProductAt(
          `previous-quarter-to-date-match-1`,
          dateInPreviousQuarter()
        ),
        createProductAt(
          `previous-quarter-to-date-match`,
          dateInPreviousQuarterPlusOneDay()
        ),
        createProductAt(`previous-quarter-to-date-match-2`, dateToday()),
        createProductAt(`previous-quarter-to-date-older`, dateTwoQuartersAgo()),
      ]);

      const productsResult = await products().list<ProductRecord>({
        filters: {
          conditionTree: {
            field: "created_at",
            operator: "PreviousQuarterToDate",
          },
        },
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `previous-quarter-to-date-match-1` }),
          expect.objectContaining({ name: `previous-quarter-to-date-match` }),
          expect.objectContaining({
            name: `previous-quarter-to-date-match-2`,
          }),
        ])
      );
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
      await Promise.all([
        createProductAt(
          `previous-year-to-date-match`,
          startOfThisYearPlusOneDay()
        ),
        createProductAt(`previous-year-to-date-match-2`, dateToday()),
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

      expect(productsResult).toHaveLength(2);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `previous-year-to-date-match` }),
          expect.objectContaining({ name: `previous-year-to-date-match-2` }),
        ])
      );
    });
  });
});
