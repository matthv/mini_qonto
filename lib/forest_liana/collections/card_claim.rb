class Forest::CardClaim
  include ForestLiana::Collection

  collection :CardClaim__Claim

  belongs_to :organization, reference: "Api__OrganizationsView.id" do
    Api::OrganizationsView.find_by(id: object.organization_id)
  end

  search_fields %w[
    id
    escalation_level
    organization_legal_country
  ]

  field "Number of disputed transactions", type: "Number" do
    object.number_of_tx
  end

  field "Number of refunded transactions", type: "Number" do
    object.number_of_refunded_tx
  end

  field "Number of rejected transactions", type: "Number" do
    object.number_of_rejected_tx
  end

  field "Total claim amount", type: "String" do
    sprintf("%.2f EUR", object.total_amount / 100.0)
  end

  field "Refunded amount", type: "String" do
    sprintf("%.2f EUR", object.refunded_amount / 100.0)
  end

  field "Rejected amount", type: "String" do
    sprintf("%.2f EUR", object.rejected_amount / 100.0)
  end

  field :vip, type: "Boolean" do
    object.vip
  end
end
