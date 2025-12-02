class Forest::BankAccount
  include ForestLiana::Collection

  collection :Api__BankAccount

  search_fields %w[
    id
    iban
    slug
    provider_object_id
    organization.name
  ]

  field :cbs, type: "String" do
    object.cbs
  end

  field :debit_locks_table, type: "String" do
    if object.debit_locks.present?
      object.debit_locks.map { |lock| "#{lock['owner']}: #{lock['reason']}" }.join("<br>")
    else
      ""
    end
  end

  field :credit_locks_table, type: "String" do
    if object.credit_locks.present?
      object.credit_locks.map { |lock| "#{lock['owner']}: #{lock['reason']}" }.join("<br>")
    else
      ""
    end
  end
end
