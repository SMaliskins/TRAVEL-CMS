-- Migration: Add hotel-specific fields to order_services
-- Run this in Supabase SQL Editor

-- Add hotel room, board, bed type fields
ALTER TABLE public.order_services
ADD COLUMN IF NOT EXISTS hotel_room text,
ADD COLUMN IF NOT EXISTS hotel_board text CHECK (hotel_board IN ('room_only', 'breakfast', 'half_board', 'full_board', 'all_inclusive')),
ADD COLUMN IF NOT EXISTS hotel_bed_type text CHECK (hotel_bed_type IN ('king_queen', 'twin', 'not_guaranteed'));

-- Add hotel preferences fields
ALTER TABLE public.order_services
ADD COLUMN IF NOT EXISTS hotel_early_check_in boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS hotel_late_check_in boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS hotel_higher_floor boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS hotel_king_size_bed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS hotel_honeymooners boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS hotel_silent_room boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS hotel_rooms_next_to text,
ADD COLUMN IF NOT EXISTS hotel_parking boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS hotel_preferences_free_text text;

-- Add supplier booking type
ALTER TABLE public.order_services
ADD COLUMN IF NOT EXISTS supplier_booking_type text CHECK (supplier_booking_type IN ('gds', 'direct')) DEFAULT 'gds';

-- Comments
COMMENT ON COLUMN public.order_services.hotel_room IS 'Hotel room type';
COMMENT ON COLUMN public.order_services.hotel_board IS 'Board type: room_only, breakfast, half_board, full_board, all_inclusive';
COMMENT ON COLUMN public.order_services.hotel_bed_type IS 'Bed type: king_queen, twin, not_guaranteed';
COMMENT ON COLUMN public.order_services.supplier_booking_type IS 'Supplier booking type: gds or direct';
