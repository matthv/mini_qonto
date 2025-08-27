module CardClaim
  class DisputedTransaction < CardClaim::ApplicationRecord
    belongs_to :claim, class_name: "CardClaim::Claim", foreign_key: :claim_id
    belongs_to :api_transaction, class_name: "Api::Transaction", foreign_key: :api_transaction_id
    # has_many :internal_status_history, class_name: "CardClaim::InternalStatusHistory", foreign_key: :disputed_transaction_id
    has_one :mastercom_claim, class_name: "CardClaim::MastercomClaim", foreign_key: :disputed_transaction_id

  end
end
