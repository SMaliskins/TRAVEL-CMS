-- Migration: Add meal_plan_text for Package Tour parsed meal display
-- Stores the exact meal plan text from document (e.g. "Ultra All Inclusive", "BB")
-- Used for display in Package Tour table; hotel_board remains enum for Edit modal

ALTER TABLE public.order_services
ADD COLUMN IF NOT EXISTS meal_plan_text text;

COMMENT ON COLUMN public.order_services.meal_plan_text IS 'Parsed meal plan text from document (Package Tour). Display as-is; hotel_board used for Edit dropdown.';
