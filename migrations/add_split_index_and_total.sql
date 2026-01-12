-- Add split_index and split_total columns to order_services table
-- These columns track the position and total count of split services

ALTER TABLE order_services
ADD COLUMN IF NOT EXISTS split_index INTEGER NULL,
ADD COLUMN IF NOT EXISTS split_total INTEGER NULL;

-- Add comments
COMMENT ON COLUMN order_services.split_index IS 'Index of this service in the split group (1-based)';
COMMENT ON COLUMN order_services.split_total IS 'Total number of services in the split group';

-- Add check constraint to ensure split_index is valid
ALTER TABLE order_services
ADD CONSTRAINT check_split_index_valid 
CHECK (split_index IS NULL OR (split_index > 0 AND split_index <= split_total));
