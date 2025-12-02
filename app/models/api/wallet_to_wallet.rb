module Api
  class WalletToWallet < Api::ApplicationRecord
    belongs_to :bank_account

    has_one :organization, through: :bank_account
    has_one :organizations_view, through: :bank_account, foreign_key: :organization_id

    has_many :parent_transactions, as: :subject, class_name: "Api::Transaction", inverse_of: :subject

    OPERATION_TYPES = {
      transfer: 0,
      card_transaction: 1,
      fee: 2,
      credit_note: 3,
      tax: 4
    }.freeze

    STATUS = {
      pending: 0,
      pending_api: 1,
      processing: 2,
      waiting_funds: 3,
      completed: 4,
      retried: 5,
      canceled: 6
    }.freeze

    enum :operation_type, OPERATION_TYPES
    enum :status, STATUS

    scope :not_canceled, -> { where(canceled_at: nil) }
    scope :fee_and_credit_note, -> { where(operation_type: [OPERATION_TYPES[:fee], OPERATION_TYPES[:credit_note]]) }

    def fee?
      operation_type == "fee"
    end

    def credit_note?
      operation_type == "credit_note"
    end
  end
end
