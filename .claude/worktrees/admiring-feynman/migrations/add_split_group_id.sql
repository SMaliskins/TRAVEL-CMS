-- Add split_group_id column to order_services table
-- This column will store a UUID that is the same for all services that were created from a single split operation

ALTER TABLE order_services
ADD COLUMN IF NOT EXISTS split_group_id UUID NULL;

-- Add index for performance when querying split groups
CREATE INDEX IF NOT EXISTS idx_order_services_split_group_id ON order_services(split_group_id);

-- Add comment
COMMENT ON COLUMN order_services.split_group_id IS 'UUID shared by all services created from the same split operation';
