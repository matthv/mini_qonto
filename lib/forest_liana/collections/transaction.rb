class Forest::Transaction
  include ForestLiana::Collection

  collection :Api__Transaction

  search_fields %w[
    id
    operation_type
    declined_reason
    counterparty_name
    clean_counterparty_name
    source_transaction_id
    slug
    side
    status
    description
  ]
end
