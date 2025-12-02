module Api
  class Transfer < Api::ApplicationRecord
    belongs_to :bank_account
    belongs_to :initiator, class_name: "Api::Membership", optional: true
    belongs_to :beneficiary, optional: true

    has_one :organization, through: :bank_account
    has_one :organizations_view, through: :bank_account, foreign_key: :organization_id
    has_one :parent_transaction, as: :subject, class_name: "Api::Transaction", inverse_of: :subject

    STATUS = {
      pending: 0,
      processing: 1,
      validated: 2,
      completed: 3,
      canceled: 4,
      declined: 5,
      standing_processing: 6,
      kyb_onhold: 7,
      pending_review: 8,
      account_canceled: 9,
      beneficiary_account_canceled: 10,
      pending_seizure: 11,
      fraud_review: 12,
      pending_fraud_review: 13,
      financing_requested: 14
    }.freeze

    OPERATION_TYPES = {
      scheduled: 0,
      standing_weekly: 1,
      standing_monthly: 2,
      fx_scheduled: 3,
      deposit_capital: 4,
      kantox: 5,
      closed: 6,
      income_returned: 7,
      legal_law: 8,
      seizure: 9,
      capital_increase: 10,
      f24_remittance: 11,
      pagopa_remittance: 12,
      pay_later: 13,
      international_out: 17,
      nrc_tax: 18,
      treasury: 19
    }.freeze

    DECLINED_REASONS = {
      beneficiary_bic_invalid: 0,
      beneficiary_iban_invalid: 1,
      beneficiary_already_used_by_another: 2,
      beneficiary_canceled: 3,
      insufficient_funds: 4,
      processing_error: 5,
      beneficiary_not_sepa: 6,
      fx_beneficiary_invalid: 7,
      user_assets_frozen: 8,
      kyc_level_refused: 9,
      incoherent_kyc_level: 10,
      invalid_beneficiary_data: 11,
      account_unreachable: 12,
      instant_payment_failed: 13,
      instant_beneficiary_invalid: 14,
      instant_beneficiary_not_sepa: 15,
      instant_processing_error: 16,
      instant_screening_rejected: 17,
      instant_operational_error: 18,
      organization_fx_suspended: 19,
      financing_declined: 20
    }.freeze

    CONTROL_STATUSES = {
      standby: 0,
      document_asked: 1,
      control_approved: 2,
      control_declined: 3
    }.freeze

    TRANSFER_TYPES = {
      external: 0,
      internal: 1
    }.freeze

    enum :status, STATUS
    enum :operation_type, OPERATION_TYPES
    enum :declined_reason, DECLINED_REASONS
    enum :control_status, CONTROL_STATUSES
    enum :transfer_type, TRANSFER_TYPES

    def cancelable?
      kyb_onhold? || pending? || processing? || pending_review? || pending_fraud_review?
    end
  end
end
