-- ==============================================================================
-- settle_or_cancel_order.lua
-- Atomic Order Settlement, Margin Release, and Realized PnL Application
--
-- KEYS[1]: User Account Hash (e.g., "account:user_12345")
-- KEYS[2]: Active Orders Set (e.g., "orders:active:user_12345")
-- KEYS[3]: Order Hash Key (e.g., "order:ord_a1b2c3")
-- ARGV[1]: Action ("CANCEL", "FILL", "PARTIAL_FILL", or "REJECT")
-- ARGV[2]: Realized PnL (Applicable on fills, pass "0" for cancellations)
-- ARGV[3]: Fill Ratio (Optional 0.0 to 1.0 for PARTIAL_FILL, default "1.0")
-- ==============================================================================

local user_key = KEYS[1]
local active_orders_key = KEYS[2]
local order_key = KEYS[3]
local action = ARGV[1]
local pnl = tonumber(ARGV[2] or '0') or 0
local fill_ratio = tonumber(ARGV[3] or '1.0') or 1.0

-- 1. Order Existence & Margin Verification
if redis.call('EXISTS', order_key) == 0 then
    return cjson.encode({
        status = "ERROR",
        code = "ORDER_NOT_FOUND",
        message = "Order key does not exist or was already settled"
    })
end

local margin_held = tonumber(redis.call('HGET', order_key, 'margin_held') or '0') or 0
local free_balance = tonumber(redis.call('HGET', user_key, 'free_balance') or '0') or 0
local locked_margin = tonumber(redis.call('HGET', user_key, 'locked_margin') or '0') or 0

local new_free = free_balance
local new_locked = locked_margin

if action == "CANCEL" or action == "REJECT" then
    -- Release all reserved margin back to free balance
    new_locked = math.max(0, locked_margin - margin_held)
    new_free = free_balance + margin_held

    -- Clean up order from active set and delete order key
    local order_id = string.gsub(order_key, "order:", "")
    redis.call('SREM', active_orders_key, order_id)
    redis.call('DEL', order_key)

elseif action == "FILL" then
    -- Full Execution: Unlock reserved margin and apply Realized P&L
    new_locked = math.max(0, locked_margin - margin_held)
    new_free = free_balance + margin_held + pnl

    -- Clean up order
    local order_id = string.gsub(order_key, "order:", "")
    redis.call('SREM', active_orders_key, order_id)
    redis.call('DEL', order_key)

elseif action == "PARTIAL_FILL" then
    -- Partial Execution: Release proportional margin, retain residual
    local margin_to_release = margin_held * fill_ratio
    local remaining_margin = math.max(0, margin_held - margin_to_release)

    new_locked = math.max(0, locked_margin - margin_to_release)
    new_free = free_balance + margin_to_release + pnl

    -- Update residual margin on order key
    redis.call('HSET', order_key, 'margin_held', string.format("%.4f", remaining_margin))
else
    return cjson.encode({
        status = "ERROR",
        code = "INVALID_ACTION",
        message = "Action must be CANCEL, REJECT, FILL, or PARTIAL_FILL"
    })
end

-- 2. Update User Account Balances Atomically
redis.call('HSET', user_key, 'free_balance', string.format("%.4f", new_free))
redis.call('HSET', user_key, 'locked_margin', string.format("%.4f", new_locked))

return cjson.encode({
    status = "SETTLED",
    action = action,
    pnl = pnl,
    margin_released = margin_held,
    new_free_balance = new_free,
    new_locked_margin = new_locked
})
