-- Add VAT rate to order_services
-- VAT can be 0% (default) or 21% (configurable per company)

ALTER TABLE order_services 
ADD COLUMN IF NOT EXISTS vat_rate INTEGER DEFAULT 0;

-- Add comment
COMMENT ON COLUMN order_services.vat_rate IS 'VAT rate in percentage (0 or 21)';

-- Add check constraint
ALTER TABLE order_services 
ADD CONSTRAINT order_services_vat_rate_check 
CHECK (vat_rate IN (0, 21));
