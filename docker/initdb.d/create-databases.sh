#!/bin/sh
set -eu

create_database() {
  database_name="$1"

  existing=$(psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres -tc "SELECT 1 FROM pg_database WHERE datname='${database_name}'" | tr -d '[:space:]')

  if [ "$existing" = "1" ]; then
    echo "Database ${database_name} already exists"
  else
    echo "Creating database: ${database_name}"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres -c "CREATE DATABASE \"${database_name}\""
  fi
}

create_database "${DB_API_NAME:-mini_qonto_api_development}"
create_database "${DB_CARD_CLAIM_NAME:-mini_qonto_card_claim_development}"
create_database "${DB_COMPANY_MONITORING_NAME:-mini_qonto_company_monitoring_development}"
create_database "${DB_BILLER_NAME:-mini_qonto_biller_development}"
