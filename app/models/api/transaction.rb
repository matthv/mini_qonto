module Api
  class Transaction < Api::ApplicationRecord
    belongs_to :bank_account
    belongs_to :subject, polymorphic: true, optional: true
    belongs_to :initiator, class_name: "Api::Membership", optional: true

    # Polymorphic subject associations
    belongs_to :transfer, class_name: "Api::Transfer", inverse_of: :parent_transaction, primary_key: :id, foreign_key: :subject_id, optional: true
    belongs_to :income, class_name: "Api::Income", inverse_of: :parent_transaction, primary_key: :id, foreign_key: :subject_id, optional: true
    belongs_to :wallet_to_wallet, class_name: "Api::WalletToWallet", inverse_of: :parent_transactions, primary_key: :id, foreign_key: :subject_id, optional: true

    has_one :beneficiary, through: :transfer
    has_one :organization, through: :bank_account
    has_one :organizations_view, through: :bank_account, foreign_key: :organization_id

    has_many :disputed_transactions, class_name: "CardClaim::DisputedTransaction", foreign_key: :api_transaction_id
    has_many :claims, through: :disputed_transactions

    STATUS = {
      pending: 0,
      completed: 1,
      declined: 2,
      reversed: 3
    }.freeze

    DECLINED_REASONS = {
      do_not_honor: 5,
      insufficient_funds: 51,
      not_permitted_to_cardholder: 57,
      exceeds_withdrawal_amount_limit: 61,
      exceeds_withdrawal_frequency_limit: 65,
      unable_to_route_transaction: 92,
      direct_debit_postponed: 100,
      user_canceled: 120,
      ops_canceled: 121
    }.freeze

    SIDES = {
      debit: 0,
      credit: 1
    }.freeze

    OPERATION_TYPES = {
      transfer: 0,
      card: 1,
      cheque: 2,
      mandate: 3,
      income: 4,
      biller: 5,
      recall: 6,
      swift_income: 7,
      f24: 8,
      pagopa_payment: 9,
      pay_later: 10,
      financing_installment: 11,
      direct_debit_collection: 12,
      other: 13,
      direct_debit_hold: 14,
      nrc_payment: 15,
      card_acquirer_payout: 16,
      riba_payment: 17,
      account_remuneration: 19
    }.freeze

    enum :operation_type, OPERATION_TYPES
    enum :side, SIDES
    enum :status, STATUS
    enum :declined_reason, DECLINED_REASONS
  end
end
