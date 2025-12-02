module CardClaim
  class SupportingDocument < CardClaim::ApplicationRecord
    self.inheritance_column = nil

    belongs_to :claim, class_name: "CardClaim::Claim", foreign_key: :claim_id

    TYPES = {
      unknown: "unknown",
      receipt: "receipt",
      correspondence: "correspondence",
      invoice: "invoice",
      cancellation_proof: "cancellation_proof",
      return_proof: "return_proof",
      other: "other"
    }.freeze

    enum :doc_type, TYPES
  end
end
