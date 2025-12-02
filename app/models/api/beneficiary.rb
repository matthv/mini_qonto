module Api
  class Beneficiary < Api::ApplicationRecord
    belongs_to :bank_account
    belongs_to :initiator, class_name: "Api::Membership", optional: true

    has_many :transfers
    has_one :organization, through: :bank_account
    has_one :organizations_view, through: :bank_account, foreign_key: :organization_id

    STATUS = {
      pending: 0,
      validated: 1,
      declined: 2
    }.freeze

    ACCOUNT_TYPES = {
      iban: 0,
      aba: 1,
      kantox: 2,
      bank_code: 3,
      bic_swift: 4
    }.freeze

    DECLINED_REASONS = {
      bic_invalid: 0,
      iban_invalid: 1,
      not_sepa: 2,
      validation_failed: 3,
      unknown: 4,
      fx_invalid: 5
    }.freeze

    enum :status, STATUS
    enum :account_type, ACCOUNT_TYPES
    enum :declined_reason, DECLINED_REASONS
  end
end
