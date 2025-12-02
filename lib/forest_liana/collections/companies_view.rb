class Forest::CompaniesView
  include ForestLiana::Collection

  collection :CompanyMonitoring__CompaniesView

  belongs_to :organization, reference: "Api__OrganizationsView.id" do
    Api::OrganizationsView.find_by(id: object.organization_id)
  end

  field :creditsafe_report_url, type: "String" do
    object.creditsafe_report_url
  end
end
