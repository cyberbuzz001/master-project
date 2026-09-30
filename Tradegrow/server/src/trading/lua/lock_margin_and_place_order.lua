-- ==============================================================================
-- lock_margin_and_place_order.lua
-- Atomic Margin Check, Lock, and Order Reservation in Redis
--
-- KEYS[1]: User Account Hash (e.g., "account:user_12345")
-- KEYS[2]: Active Orders Set (e.g., "orders:active:user_12345")
-- ARGV[1]: Order ID (e.g., "ord_a1b2c3")
-- ARGV[2]: Required Margin (e.g., "2500.00")
-- ARGV[3]: Order Details JSON String
-- ARGV[4]: Idempotency Key (Optional)
-- ==============================================================================

local user_key = KEYS[1]
local active_orders_key = KEYS[2]
local order_id = ARGV[1]
local required_margin = tonumber(ARGV[2])
local order_payload = ARGV[3]
local idempotency_key = ARGV[4] or ""

-- 0. Validate Numeric Input
if not required_margin or required_margin < 0 then
    return cjson.encode({
        status = "ERROR",
        code = "INVALID_MARGIN_VALUE",
        message = "Required margin must be a non-negative number"
    })
end

-- 1. Idempotency Check: Return existing order state if already processed
local order_key = "order:" .. order_id
if redis.call('EXISTS', order_key) == 1 then
    local existing_data = redis.call('HGET', order_key, 'data')
    local existing_margin = tonumber(redis.call('HGET', order_key, 'margin_held') or '0')
    local free_balance = tonumber(redis.call('HGET', user_key, 'free_balance') or '0')
    local locked_margin = tonumber(redis.call('HGET', user_key, 'locked_margin') or '0')

    return cjson.encode({
        status = "DUPLICATE",
        order_id = order_id,
        is_replay = true,
        current_free_balance = free_balance,
        current_locked_margin = locked_margin,
        margin_held = existing_margin,
        data = existing_data
    })
end

-- 2. Fetch Current Balances
local free_balance = tonumber(redis.call('HGET', user_key, 'free_balance') or '0')
local locked_margin = tonumber(redis.call('HGET', user_key, 'locked_margin') or '0')

-- 3. Capital Sufficiency Gate
if free_balance < required_margin then
    return cjson.encode({
        status = "REJECTED",
        code = "INSUFFICIENT_FUNDS",
        current_free_balance = free_balance,
        required = required_margin,
        deficit = required_margin - free_balance
    })
end

-- 4. Atomic Margin Lock & Balance Update (Preserve 4-decimal precision)
local updated_free = free_balance - required_margin
local updated_locked = locked_margin + required_margin

redis.call('HSET', user_key, 'free_balance', string.format("%.4f", updated_free))
redis.call('HSET', user_key, 'locked_margin', string.format("%.4f", updated_locked))

-- 5. Persist Order Metadata & Link to Active Set
redis.call('HSET', order_key, 
    'data', order_payload, 
    'margin_held', string.format("%.4f", required_margin),
    'idempotency_key', idempotency_key,
    'created_at', tostring(redis.call('TIME')[1])
)
redis.call('SADD', active_orders_key, order_id)

return cjson.encode({
    status = "ACCEPTED",
    order_id = order_id,
    new_free_balance = updated_free,
    new_locked_margin = updated_locked,
    margin_locked = required_margin
})
