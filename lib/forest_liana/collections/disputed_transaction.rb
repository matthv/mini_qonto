class Forest::CardClaimDisputedTransaction
  include ForestLiana::Collection

  collection :CardClaim__DisputedTransaction

  field "settled_amount_in_eur_cents", type: "Number" do
    next nil if object.api_transaction&.settled_at.nil?
    object.api_transaction&.amount_cents
  end

  field "status", type: "String" do
    object.api_transaction&.status
  end

  field "transaction_settled_at", type: "Date" do
    object.api_transaction&.settled_at
  end
end
