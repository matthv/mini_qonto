class Forest::CompaniesView
  include ForestLiana::Collection

  collection :CompanyMonitoring__CompaniesView

  belongs_to :organization, reference: "Api__OrganizationsView.id" do
    Api::OrganizationsView.find_by(id: object.organization_id)
  end
end