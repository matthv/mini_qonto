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
const dateInPreviousWeek = () => toMidday(daysAgo(8));
const dateSameWeekdayPreviousWeek = () => toMidday(daysAgo(7));
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
const dateSameDayPreviousYear = () => toMidday(addYears(new Date(), -1));
const dateTwoYearsAgo = () => {
  const now = new Date();
  return toMidday(new Date(now.getFullYear() - 2, 6, 15));
};

describe("filters", () => {
  let clientAgent: AgentClient;

  beforeAll(async () => {
    clientAgent = await mountAgentClient();
  });

  const products = () => clientAgent.collection(PRODUCTS_COLLECTION);
  const uniqueSeed = () =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

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

  const listByConditions = (base: string, ...dateConditions: any) => {
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
            ...dateConditions,
          ],
        },
      },
    });
  };

  describe("type date", () => {
    it("after", async () => {
      const base = `date-after-${uniqueSeed()}`;

      await Promise.all([
        createProductAt(`${base}-earlier`, hoursAgo(3)),
        createProductAt(`${base}-later`, hoursAgo(0.5)),
      ]);

      const threshold = hoursAgo(2).toISOString();
      const productsResult = await listByConditions(base, {
        field: "created_at",
        operator: "After",
        value: threshold,
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `${base}-later` }),
        ])
      );
    });

    it("before", async () => {
      const base = `date-before-${uniqueSeed()}`;

      await Promise.all([
        createProductAt(`${base}-earlier`, hoursAgo(5)),
        createProductAt(`${base}-later`, hoursAgo(1)),
      ]);

      const threshold = hoursAgo(3).toISOString();
      const productsResult = await listByConditions(base, {
        field: "created_at",
        operator: "Before",
        value: threshold,
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `${base}-earlier` }),
        ])
      );
    });

    it("after x hours ago", async () => {
      const base = `date-after-x-hours-${uniqueSeed()}`;

      await Promise.all([
        createProductAt(`${base}-within`, hoursAgo(3)),
        createProductAt(`${base}-outside`, hoursAgo(7)),
      ]);

      const productsResult = await listByConditions(base, {
        field: "created_at",
        operator: "AfterXHoursAgo",
        value: 5,
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `${base}-within` }),
        ])
      );
    });

    it("before x hours ago", async () => {
      const base = `date-before-x-hours-${uniqueSeed()}`;

      await Promise.all([
        createProductAt(`${base}-within`, hoursAgo(7)),
        createProductAt(`${base}-outside`, hoursAgo(3)),
      ]);

      const productsResult = await listByConditions(base, {
        field: "created_at",
        operator: "BeforeXHoursAgo",
        value: 5,
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `${base}-within` }),
        ])
      );
    });

    it("past", async () => {
      const base = `date-past-${uniqueSeed()}`;

      await Promise.all([
        createProductAt(`${base}-past`, hoursAgo(2)),
        createProductAt(`${base}-future`, hoursAhead(2)),
      ]);

      const productsResult = await listByConditions(base, {
        field: "created_at",
        operator: "Past",
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `${base}-past` }),
        ])
      );
    });

    it("future", async () => {
      const base = `date-future-${uniqueSeed()}`;

      await Promise.all([
        createProductAt(`${base}-future`, hoursAhead(4)),
        createProductAt(`${base}-past`, hoursAgo(2)),
      ]);

      const productsResult = await listByConditions(base, {
        field: "created_at",
        operator: "Future",
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `${base}-future` }),
        ])
      );
    });

    it("today", async () => {
      const base = `date-today-${uniqueSeed()}`;

      await Promise.all([
        createProductAt(`${base}-today`, new Date()),
        createProductAt(`${base}-older`, daysAgo(2)),
      ]);

      const productsResult = await listByConditions(base, {
        field: "created_at",
        operator: "Today",
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `${base}-today` }),
        ])
      );
    });

    it("yesterday", async () => {
      const base = `date-yesterday-${uniqueSeed()}`;

      await Promise.all([
        createProductAt(`${base}-yesterday`, daysAgo(1)),
        createProductAt(`${base}-older`, daysAgo(3)),
      ]);

      const productsResult = await listByConditions(base, {
        field: "created_at",
        operator: "Yesterday",
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `${base}-yesterday` }),
        ])
      );
    });

    it("previous x days", async () => {
      const base = `date-previous-x-days-${uniqueSeed()}`;

      await Promise.all([
        createProductAt(`${base}-match`, daysAgo(2)),
        createProductAt(`${base}-older`, daysAgo(5)),
      ]);

      const productsResult = await listByConditions(base, {
        field: "created_at",
        operator: "PreviousXDays",
        value: 3,
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `${base}-match` }),
        ])
      );
    });

    it("previous x days to date", async () => {
      const base = `date-previous-x-days-to-date-${uniqueSeed()}`;

      await Promise.all([
        createProductAt(`${base}-match`, daysAgo(2)),
        createProductAt(`${base}-older`, daysAgo(5)),
      ]);

      const productsResult = await listByConditions(base, {
        field: "created_at",
        operator: "PreviousXDaysToDate",
        value: 3,
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `${base}-match` }),
        ])
      );
    });

    it("previous week", async () => {
      const base = `date-previous-week-${uniqueSeed()}`;

      await Promise.all([
        createProductAt(`${base}-match`, dateInPreviousWeek()),
        createProductAt(`${base}-older`, dateTwoWeeksAgo()),
      ]);

      const productsResult = await listByConditions(base, {
        field: "created_at",
        operator: "PreviousWeek",
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `${base}-match` }),
        ])
      );
    });

    it("previous week to date", async () => {
      const base = `date-previous-week-to-date-${uniqueSeed()}`;

      await Promise.all([
        createProductAt(`${base}-match`, dateSameWeekdayPreviousWeek()),
        createProductAt(`${base}-older`, dateTwoWeeksAgo()),
      ]);

      const productsResult = await listByConditions(base, {
        field: "created_at",
        operator: "PreviousWeekToDate",
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `${base}-match` }),
        ])
      );
    });

    it("previous month", async () => {
      const base = `date-previous-month-${uniqueSeed()}`;

      await Promise.all([
        createProductAt(`${base}-match`, dateInPreviousMonth()),
        createProductAt(`${base}-older`, dateTwoMonthsAgo()),
      ]);

      const productsResult = await listByConditions(base, {
        field: "created_at",
        operator: "PreviousMonth",
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `${base}-match` }),
        ])
      );
    });

    it("previous month to date", async () => {
      const base = `date-previous-month-to-date-${uniqueSeed()}`;

      await Promise.all([
        createProductAt(`${base}-match`, dateInPreviousMonth()),
        createProductAt(`${base}-older`, dateTwoMonthsAgo()),
      ]);

      const productsResult = await listByConditions(base, {
        field: "created_at",
        operator: "PreviousMonthToDate",
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `${base}-match` }),
        ])
      );
    });

    it("previous quarter", async () => {
      const base = `date-previous-quarter-${uniqueSeed()}`;

      await Promise.all([
        createProductAt(`${base}-match`, dateInPreviousQuarter()),
        createProductAt(`${base}-older`, dateTwoQuartersAgo()),
      ]);

      const productsResult = await listByConditions(base, {
        field: "created_at",
        operator: "PreviousQuarter",
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `${base}-match` }),
        ])
      );
    });

    it("previous quarter to date", async () => {
      const base = `date-previous-quarter-to-date-${uniqueSeed()}`;

      await Promise.all([
        createProductAt(`${base}-match`, dateInPreviousQuarter()),
        createProductAt(`${base}-older`, dateTwoQuartersAgo()),
      ]);

      const productsResult = await listByConditions(base, {
        field: "created_at",
        operator: "PreviousQuarterToDate",
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `${base}-match` }),
        ])
      );
    });

    it("previous year", async () => {
      const base = `date-previous-year-${uniqueSeed()}`;

      await Promise.all([
        createProductAt(`${base}-match`, dateInPreviousYear()),
        createProductAt(`${base}-older`, dateTwoYearsAgo()),
      ]);

      const productsResult = await listByConditions(base, {
        field: "created_at",
        operator: "PreviousYear",
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `${base}-match` }),
        ])
      );
    });

    it("previous year to date", async () => {
      const base = `date-previous-year-to-date-${uniqueSeed()}`;

      await Promise.all([
        createProductAt(`${base}-match`, dateSameDayPreviousYear()),
        createProductAt(`${base}-older`, dateTwoYearsAgo()),
      ]);

      const productsResult = await listByConditions(base, {
        field: "created_at",
        operator: "PreviousYearToDate",
      });

      expect(productsResult).toHaveLength(1);
      expect(productsResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: `${base}-match` }),
        ])
      );
    });
  });
});
