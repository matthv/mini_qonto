class Forest::CardClaim
  include ForestLiana::Collection

  collection :CardClaim__Claim

  # belongs_to :card, reference: "CardLifecycle__Card.id", is_filterable: false do
  #   CardLifecycle::Card.find(object.card_id)
  # end

  belongs_to :organization, reference: "Api__OrganizationsView.id" do
    Api::OrganizationsView.find_by(id: object.organization_id)
  end

  field :vip, type: "Boolean", is_filterable: true do # filter: filter_vip_claims
    object.vip
  end
end