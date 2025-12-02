module CardClaim
  class DisputedTransaction < CardClaim::ApplicationRecord
    belongs_to :claim, class_name: "CardClaim::Claim", foreign_key: :claim_id
    belongs_to :api_transaction, class_name: "Api::Transaction", foreign_key: :api_transaction_id
    has_many :internal_status_history, class_name: "CardClaim::InternalStatusHistory", foreign_key: :disputed_transaction_id
    has_one :mastercom_claim, class_name: "CardClaim::MastercomClaim", foreign_key: :disputed_transaction_id

    INTERNAL_STATUS = {
      first_chargeback: "first_chargeback",
      second_presentment: "second_presentment",
      prearbitration_lost: "prearbitration_lost",
      arbitration_lost: "arbitration_lost",
      first_chargeback_pending: "first_chargeback_pending",
      first_chargeback_processed: "first_chargeback_processed",
      chargeback_not_applicable: "chargeback_not_applicable",
      first_chargeback_processing: "first_chargeback_processing",
      first_chargeback_cancelled: "first_chargeback_cancelled",
      first_chargeback_rejected: "first_chargeback_rejected",
      second_presentment_received: "second_presentment_received",
      second_presentment_accepted: "second_presentment_accepted",
      prearbitration_issued: "prearbitration_issued",
      prearbitration_loss_received: "prearbitration_loss_received",
      prearbitration_loss_accepted: "prearbitration_loss_accepted",
      prearbitration_won: "prearbitration_won",
      arbitration_issued: "arbitration_issued",
      arbitration_loss_received: "arbitration_loss_received",
      arbitration_loss_accepted: "arbitration_loss_accepted",
      arbitration_won: "arbitration_won"
    }.freeze

    DISPLAYED_STATUS = {
      in_review: "in_review",
      refunded: "refunded",
      not_refunded: "not_refunded"
    }.freeze

    REJECTION_REASONS = [
      :tx_authn_pin,
      :tx_authn_otp,
      :tx_authn_sca,
      :tx_authn_google_pay,
      :tx_authn_apple_pay,
      :tx_older90days,
      :tx_older56days,
      :tx_already_disputed,
      :no_evidence_fraud,
      :merchant_tc,
      :card_not_blocked_after_lost,
      :card_used_after_lost
    ].freeze

    INTERNAL_REJECTION_REASONS = {
      sca: "sca",
      pos: "pos",
      nop: "nop",
      loc: "loc",
      hab: "hab",
      rec: "rec",
      aut_subscription_not_canceled: "aut_subscription_not_canceled",
      aut_xpay_transaction: "aut_xpay_transaction",
      aut_suspected_fraud: "aut_suspected_fraud",
      aut_phishing: "aut_phishing",
      aut_negligence: "aut_negligence",
      aut_internal_company_dispute: "aut_internal_company_dispute",
      aut_exceeded_timeframe_8w: "aut_exceeded_timeframe_8w",
      aut_sensitive_actions_validated_by_Sca: "aut_sensitive_actions_validated_by_Sca",
      aut_transaction_initiated_by_customer: "aut_transaction_initiated_by_customer",
      service_rendered: "service_rendered",
      products_not_returned_by_customer: "products_not_returned_by_customer",
      scam: "scam",
      sales_conditions_accepted_by_customer: "sales_conditions_accepted_by_customer",
      subscription_not_cancelled_on_time: "subscription_not_cancelled_on_time",
      exceeded_90d_timeframe: "exceeded_90d_timeframe",
      chargeback_not_applicable_2: "chargeback_not_applicable"
    }.freeze

    TRANSACTION_PROCESSING_MODE = {
      immediate_debit: "immediate_debit",
      deferred_debit: "deferred_debit"
    }

    enum :internal_status, INTERNAL_STATUS
    enum :displayed_status, DISPLAYED_STATUS
    enum :internal_rejection_reason, INTERNAL_REJECTION_REASONS
    enum :transaction_processing_mode, TRANSACTION_PROCESSING_MODE

    def status_history
      str = ""
      internal_status_history.each do |record|
        time = Time.find_zone("UTC").parse(record.created_at.to_s)
        formatted_time = time.in_time_zone("Europe/Paris").strftime("[%d-%m-%Y %H:%M]")
        formatted_status = record.internal_status
        formatted_amount = sprintf("%.2f EUR", (record.refunded_amount_in_eur_cents || 0) / 100.0)
        str += "#{formatted_status}\t#{formatted_amount}\t#{formatted_time}\n"
      end
      str
    end
  end
end
