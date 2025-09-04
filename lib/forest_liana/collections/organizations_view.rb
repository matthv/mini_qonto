class Forest::OrganizationsView
  include ForestLiana::Collection

  collection :Api__OrganizationsView

  belongs_to :referrer_organization, reference: "Api__OrganizationsView.id" do
    # referral = object.referrer_referral
    # next if referral.nil? || referral.referrer.nil?

    Api::OrganizationsView.find(object.id)
  end
end