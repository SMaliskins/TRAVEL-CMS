-- Allow hotel_board to store UAI and free text (not just enum)
-- Drops CHECK constraint if exists, allows any text

ALTER TABLE public.order_services DROP CONSTRAINT IF EXISTS order_services_hotel_board_check;

COMMENT ON COLUMN public.order_services.hotel_board IS 'Board/meal type: room_only, breakfast, half_board, full_board, all_inclusive, uai, or free text';
