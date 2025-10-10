import { mountAgentClient } from "../agent-setup";

type AgentClient = Awaited<ReturnType<typeof mountAgentClient>>;
type OrganizationRecord = { id: number | string; name: string | null };

const ORGANIZATION_COLLECTION = "Api__OrganizationsView";
const SEGMENT_NAME = "Segment | With Name";

describe("collection segments", () => {
  let clientAgent: AgentClient;

  beforeAll(async () => {
    clientAgent = await mountAgentClient();
  });

  const organizations = () => clientAgent.collection(ORGANIZATION_COLLECTION);

  it("filters organizations using custom segment", async () => {
    const [noNameOrg] = await organizations().list<OrganizationRecord>({
      filters: {
        conditionTree: {
          field: "name",
          operator: "Blank",
        },
      },
    });
    expect(noNameOrg).not.toBeDefined();

    const initialSegmentRecords = await organizations()
      .segment(SEGMENT_NAME)
      .list<OrganizationRecord>();

    const namedOrganizationName = `Named organization ${Date.now()}`;

    const namedOrganization = await organizations().create<OrganizationRecord>({
      name: namedOrganizationName,
    });

    const unnamedOrganization =
      await organizations().create<OrganizationRecord>({ name: null });

    const segmentRecords = await organizations()
      .segment(SEGMENT_NAME)
      .list<OrganizationRecord>();

    expect(segmentRecords.length).toBeGreaterThan(initialSegmentRecords.length);

    expect(segmentRecords.every((record) => Boolean(record.name))).toBe(true);

    expect(
      segmentRecords.some(
        (record) => String(record.id) === String(namedOrganization.id)
      )
    ).toBe(true);
    expect(
      segmentRecords.some(
        (record) => String(record.id) === String(unnamedOrganization.id)
      )
    ).toBe(false);

    const [organizationWithoutName] =
      await organizations().list<OrganizationRecord>({
        filters: {
          conditionTree: {
            field: "name",
            operator: "Blank",
          },
        },
      });
    expect(organizationWithoutName).toBeDefined();

    await organizations().delete([String(namedOrganization.id)]);
    await organizations().delete([String(unnamedOrganization.id)]);
  });
});
