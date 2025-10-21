import { mountAgentClient } from "../agent-setup";
import {
  AgentClient,
  clearCollections,
  ORGANIZATION_COLLECTION,
} from "./helpers";

type OrganizationRecord = { id: number | string; name: string | null };

describe("pagination validation", () => {
  let clientAgent: AgentClient;

  beforeAll(async () => {
    clientAgent = await mountAgentClient();
  });

  beforeEach(async () => {
    await clearCollections(clientAgent);

    // Create some test data
    const organizations = clientAgent.collection(ORGANIZATION_COLLECTION);
    for (let i = 1; i <= 10; i++) {
      await organizations.create<OrganizationRecord>({
        name: `Organization ${i}`,
      });
    }
  });

  describe("BUG: Invalid page size with valid page number", () => {
    it("should reject invalid page size (string) with valid page number", async () => {
      const organizations = clientAgent.collection(ORGANIZATION_COLLECTION);

      await expect(
        organizations.list<OrganizationRecord>({
          pagination: {
            number: 1,
            size: "abc" as any,
          },
        })
      ).rejects.toThrow(/Invalid pagination|page|size/i);
    });

    it("should reject negative page size with valid page number", async () => {
      const organizations = clientAgent.collection(ORGANIZATION_COLLECTION);

      await expect(
        organizations.list<OrganizationRecord>({
          pagination: {
            number: 1,
            size: "-50" as any,
          },
        })
      ).rejects.toThrow(/Invalid pagination|page|size/i);
    });

    it("should reject zero page size with valid page number", async () => {
      const organizations = clientAgent.collection(ORGANIZATION_COLLECTION);

      await expect(
        organizations.list<OrganizationRecord>({
          pagination: {
            number: 1,
            size: "0" as any,
          },
        })
      ).rejects.toThrow(/Invalid pagination|page|size/i);
    });
  });

  describe("BUG: Invalid page number with valid page size", () => {
    it("should reject invalid page number (string) with valid page size", async () => {
      const organizations = clientAgent.collection(ORGANIZATION_COLLECTION);

      await expect(
        organizations.list<OrganizationRecord>({
          pagination: {
            number: 1,
            size: "invalid" as any,
          },
        })
      ).rejects.toThrow(/Invalid pagination|page|number/i);
    });

    it("should reject negative page number with valid page size", async () => {
      const organizations = clientAgent.collection(ORGANIZATION_COLLECTION);

      await expect(
        organizations.list<OrganizationRecord>({
          pagination: {
            number: -1,
            size: 50,
          },
        })
      ).rejects.toThrow(/Invalid pagination|page|number/i);
    });

    it("should reject float page number with valid page size", async () => {
      const organizations = clientAgent.collection(ORGANIZATION_COLLECTION);

      await expect(
        organizations.list<OrganizationRecord>({
          pagination: {
            number: "1.5" as any,
            size: 50,
          },
        })
      ).rejects.toThrow(/Invalid pagination|page|number/i);
    });

    it("should reject SQL injection attempt with valid page size", async () => {
      const organizations = clientAgent.collection(ORGANIZATION_COLLECTION);

      await expect(
        organizations.list<OrganizationRecord>({
          pagination: {
            number: "'; DROP TABLE users--" as any,
            size: 50,
          },
        })
      ).rejects.toThrow(/Invalid pagination|page|number/i);
    });
  });

  describe("WORKING: Both parameters invalid", () => {
    it("should reject both invalid parameters", async () => {
      const organizations = clientAgent.collection(ORGANIZATION_COLLECTION);

      await expect(
        organizations.list<OrganizationRecord>({
          pagination: {
            number: "xyz" as any,
            size: "abc" as any,
          },
        })
      ).rejects.toThrow(/Invalid pagination|page/i);
    });
  });

  describe("WORKING: Both parameters valid", () => {
    it("should accept valid pagination parameters", async () => {
      const organizations = clientAgent.collection(ORGANIZATION_COLLECTION);

      const result = await organizations.list<OrganizationRecord>({
        pagination: {
          number: 1,
          size: 5,
        },
      });

      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(5);
    });

    it("should accept valid pagination with plus sign", async () => {
      const organizations = clientAgent.collection(ORGANIZATION_COLLECTION);

      const result = await organizations.list<OrganizationRecord>({
        pagination: {
          number: "+1" as any,
          size: "+50" as any,
        },
      });

      expect(result).toBeDefined();
    });
  });
});
