class Forest::Income
  include ForestLiana::Collection

  collection :Api__Income

  belongs_to :emitter_bank_account, reference: "Api__BankAccount.id" do
    if object.emitter_bic&.start_with?("QNTO")
      Api::BankAccount.find_by(iban: object.emitter_iban, bic: object.emitter_bic)
    end
  end

  search_fields %w[
    id
    emitter_name
    reference
    creditor_name
    emitter_bic
    slug
  ]

  field :cbs, type: "String" do
    object.organization&.core_banking_system
  end
end
