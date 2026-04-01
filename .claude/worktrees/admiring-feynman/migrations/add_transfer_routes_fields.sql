-- Migration: Add transfer routes and driver fields to order_services
-- Supports multi-route transfers, vehicle class, transfer mode, and driver info

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'order_services' AND column_name = 'transfer_routes'
    ) THEN
        ALTER TABLE public.order_services ADD COLUMN transfer_routes jsonb;
        COMMENT ON COLUMN public.order_services.transfer_routes IS 'Array of transfer route legs [{pickup, dropoff, pickupTime, distanceKm, durationMin, linkedFlightId, ...}]';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'order_services' AND column_name = 'transfer_mode'
    ) THEN
        ALTER TABLE public.order_services ADD COLUMN transfer_mode text;
        COMMENT ON COLUMN public.order_services.transfer_mode IS 'Transfer mode: individual or group';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'order_services' AND column_name = 'vehicle_class'
    ) THEN
        ALTER TABLE public.order_services ADD COLUMN vehicle_class text;
        COMMENT ON COLUMN public.order_services.vehicle_class IS 'Vehicle class: economy, comfort, business, minivan, minibus, bus';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'order_services' AND column_name = 'driver_name'
    ) THEN
        ALTER TABLE public.order_services ADD COLUMN driver_name text;
        COMMENT ON COLUMN public.order_services.driver_name IS 'Transfer driver name';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'order_services' AND column_name = 'driver_phone'
    ) THEN
        ALTER TABLE public.order_services ADD COLUMN driver_phone text;
        COMMENT ON COLUMN public.order_services.driver_phone IS 'Transfer driver phone number';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'order_services' AND column_name = 'driver_notes'
    ) THEN
        ALTER TABLE public.order_services ADD COLUMN driver_notes text;
        COMMENT ON COLUMN public.order_services.driver_notes IS 'Additional transfer info visible to client';
    END IF;
END $$;
