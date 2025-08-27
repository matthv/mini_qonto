module CardClaim
  class Claim < CardClaim::ApplicationRecord
    self.inheritance_column = :_type_disabled

    belongs_to :cs_organization, class_name: "Api::CsOrganization", foreign_key: :organization_id, primary_key: :organization_id
    has_many :disputed_transactions, class_name: "CardClaim::DisputedTransaction", foreign_key: :claim_id

    def vip
      cs_organization.vip
    end
  end
end