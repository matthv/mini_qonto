class Forest::OrganizationsView
  include ForestLiana::Collection

  collection :Api__OrganizationsView

  has_many :claims, reference: "CardClaim__Claim.organization_id", is_filterable: true

  search_fields %w[
    id
    name
    legal_name
    legal_number
    contact_email
    slug
  ]

  field :is_italian, type: "Boolean" do
    object.italian?
  end

  field :is_french, type: "Boolean" do
    object.french?
  end

  field :is_german, type: "Boolean" do
    object.german?
  end

  field :is_spanish, type: "Boolean" do
    object.spanish?
  end
end
