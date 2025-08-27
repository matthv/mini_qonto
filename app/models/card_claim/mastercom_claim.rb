module CardClaim
  class MastercomClaim < CardClaim::ApplicationRecord
    belongs_to :disputed_transaction, class_name: "CardClaim::DisputedTransaction", foreign_key: :disputed_transaction_id
  end
end
