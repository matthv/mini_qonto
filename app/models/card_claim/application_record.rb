module CardClaim
  class ApplicationRecord < ActiveRecord::Base
    self.abstract_class = true

    connects_to database: {writing: :card_claim, reading: :card_claim}

  end
end