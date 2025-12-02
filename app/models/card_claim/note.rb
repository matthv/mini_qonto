module CardClaim
  class Note < CardClaim::ApplicationRecord
    self.inheritance_column = nil

    belongs_to :claim, class_name: "CardClaim::Claim", foreign_key: :claim_id
  end
end
