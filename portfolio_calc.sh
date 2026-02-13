#!/bin/bash

# Portfolio Holdings
ONDS_SHARES=435
ONDS_COST_BASIS=11.91
ONDS_TOTAL_COST=5180.85

NVDA_SHARES=60
NVDA_COST_BASIS=184.50
NVDA_TOTAL_COST=11070.00

SLS_SHARES=207.78
SLS_COST_BASIS=4.31
SLS_TOTAL_COST=895.53

VOO_SHARES=1.43
VOO_COST_BASIS=636.11
VOO_TOTAL_COST=909.64

# Current Prices (from Alpaca API)
ONDS_CURRENT_PRICE=9.69
NVDA_CURRENT_PRICE=185.21
SLS_CURRENT_PRICE=3.73
VOO_CURRENT_PRICE=635.27

# Calculate current values
ONDS_CURRENT_VALUE=$(echo "$ONDS_SHARES * $ONDS_CURRENT_PRICE" | bc -l)
NVDA_CURRENT_VALUE=$(echo "$NVDA_SHARES * $NVDA_CURRENT_PRICE" | bc -l)
SLS_CURRENT_VALUE=$(echo "$SLS_SHARES * $SLS_CURRENT_PRICE" | bc -l)
VOO_CURRENT_VALUE=$(echo "$VOO_SHARES * $VOO_CURRENT_PRICE" | bc -l)

# Calculate P&L
ONDS_PNL=$(echo "$ONDS_CURRENT_VALUE - $ONDS_TOTAL_COST" | bc -l)
NVDA_PNL=$(echo "$NVDA_CURRENT_VALUE - $NVDA_TOTAL_COST" | bc -l)
SLS_PNL=$(echo "$SLS_CURRENT_VALUE - $SLS_TOTAL_COST" | bc -l)
VOO_PNL=$(echo "$VOO_CURRENT_VALUE - $VOO_TOTAL_COST" | bc -l)

# Calculate total portfolio value and total P&L
TOTAL_CURRENT_VALUE=$(echo "$ONDS_CURRENT_VALUE + $NVDA_CURRENT_VALUE + $SLS_CURRENT_VALUE + $VOO_CURRENT_VALUE" | bc -l)
TOTAL_COST=$(echo "$ONDS_TOTAL_COST + $NVDA_TOTAL_COST + $SLS_TOTAL_COST + $VOO_TOTAL_COST" | bc -l)
TOTAL_PNL=$(echo "$TOTAL_CURRENT_VALUE - $TOTAL_COST" | bc -l)

# Calculate percentages
ONDS_PNL_PERCENT=$(echo "scale=2; ($ONDS_PNL / $ONDS_TOTAL_COST) * 100" | bc -l)
NVDA_PNL_PERCENT=$(echo "scale=2; ($NVDA_PNL / $NVDA_TOTAL_COST) * 100" | bc -l)
SLS_PNL_PERCENT=$(echo "scale=2; ($SLS_PNL / $SLS_TOTAL_COST) * 100" | bc -l)
VOO_PNL_PERCENT=$(echo "scale=2; ($VOO_PNL / $VOO_TOTAL_COST) * 100" | bc -l)
TOTAL_PNL_PERCENT=$(echo "scale=2; ($TOTAL_PNL / $TOTAL_COST) * 100" | bc -l)

# Format currency
format_currency() {
    printf "$%.2f\n" "$1"
}

echo "📊 KAI'S PORTFOLIO UPDATE - $(date '+%A, %B %d, %Y %I:%M %p')"
echo ""
echo "💰 CURRENT HOLDINGS & PERFORMANCE:"
echo ""
echo "🔹 ONDS: $ONDS_SHARES shares"
echo "   Cost basis: $(format_currency $ONDS_TOTAL_COST) @ $(format_currency $ONDS_COST_BASIS)/share"
echo "   Current: $(format_currency $ONDS_CURRENT_VALUE) @ $(format_currency $ONDS_CURRENT_PRICE)/share"
echo "   P&L: $(format_currency $ONDS_PNL) ($ONDS_PNL_PERCENT%)"
echo ""
echo "🔹 NVDA: $NVDA_SHARES shares"
echo "   Cost basis: $(format_currency $NVDA_TOTAL_COST) @ $(format_currency $NVDA_COST_BASIS)/share"
echo "   Current: $(format_currency $NVDA_CURRENT_VALUE) @ $(format_currency $NVDA_CURRENT_PRICE)/share"
echo "   P&L: $(format_currency $NVDA_PNL) ($NVDA_PNL_PERCENT%)"
echo ""
echo "🔹 SLS: $SLS_SHARES shares"
echo "   Cost basis: $(format_currency $SLS_TOTAL_COST) @ $(format_currency $SLS_COST_BASIS)/share"
echo "   Current: $(format_currency $SLS_CURRENT_VALUE) @ $(format_currency $SLS_CURRENT_PRICE)/share"
echo "   P&L: $(format_currency $SLS_PNL) ($SLS_PNL_PERCENT%)"
echo ""
echo "🔹 VOO: $VOO_SHARES shares"
echo "   Cost basis: $(format_currency $VOO_TOTAL_COST) @ $(format_currency $VOO_COST_BASIS)/share"
echo "   Current: $(format_currency $VOO_CURRENT_VALUE) @ $(format_currency $VOO_CURRENT_PRICE)/share"
echo "   P&L: $(format_currency $VOO_PNL) ($VOO_PNL_PERCENT%)"
echo ""
echo "📈 PORTFOLIO SUMMARY:"
echo "   Total Value: $(format_currency $TOTAL_CURRENT_VALUE)"
echo "   Total Cost: $(format_currency $TOTAL_COST)"
echo "   Total P&L: $(format_currency $TOTAL_PNL) ($TOTAL_PNL_PERCENT%)"
echo ""

# Recommendations
if (( $(echo "$ONDS_PNL < -1000" | bc -l) )); then
    echo "⚠️  ONDS ALERT: Down $(format_currency $ONDS_PNL) (-$ONDS_PNL_PERCENT%). Consider:"
    echo "   • Setting stop-loss at $8.50 (12% below current)"
    echo "   • Average down if you believe in the fundamentals"
    echo "   • Take tax loss if no longer bullish"
fi

if (( $(echo "$NVDA_PNL > 500" | bc -l) )); then
    echo "🚀 NVDA WINNER: Up $(format_currency $NVDA_PNL) (+$NVDA_PNL_PERCENT%). Consider:"
    echo "   • Taking some profits at $190+ levels"
    echo "   • Hold core position for AI boom continuation"
    echo "   • Set trailing stop at $175 to protect gains"
fi

if (( $(echo "$SLS_PNL < -300" | bc -l) )); then
    echo "⚠️  SLS CONCERN: Down $(format_currency $SLS_PNL) (-$SLS_PNL_PERCENT%). Consider:"
    echo "   • High risk biotech - set hard stop at $3.20"
    echo "   • Monitor upcoming FDA catalysts"
    echo "   • Consider reducing position size"
fi

echo ""
echo "🎯 TODAY'S RECOMMENDATIONS:"
echo "   • NVDA showing strength - consider gradual profit taking"
echo "   • ONDS oversold - wait for $8.50 support test"
echo "   • SLS high volatility - reduce or set tight stops"
echo "   • VOO steady - good long-term hold"
echo ""
echo "💡 PORTFOLIO STRATEGY:"
echo "   • Total portfolio down $(format_currency $TOTAL_PNL) (-$TOTAL_PNL_PERCENT%)"
echo "   • Consider rebalancing if NVDA becomes >50% of portfolio"
echo "   • Keep 10-20% cash for opportunities"
echo "   • Monitor earnings season for all holdings"