# Smoke Test Commands (Staging)

Set:

```bash
export BASE_URL="https://YOUR-STAGING-DOMAIN"
```

## Health

```bash
curl -sS "$BASE_URL/api/health" | jq
```

## Session / Me

```bash
curl -i -sS "$BASE_URL/api/me"
```

## Deprecated check-in wrapper

```bash
curl -i -sS -X POST "$BASE_URL/api/checkin"
```

Expected: payload includes `deprecated: true`.

## Read active matches (needed for vote/predict IDs)

```bash
curl -sS "$BASE_URL/api/tournament/active" | jq
```

## Vote (replace IDs from active payload)

```bash
curl -i -sS -X POST "$BASE_URL/api/vote" \
  -H "Content-Type: application/json" \
  -d '{"match_id":"<MATCH_ID>","voted_for":"<CAT_ID>"}'
```

## Predict (replace IDs)

```bash
curl -i -sS -X POST "$BASE_URL/api/match/predict" \
  -H "Content-Type: application/json" \
  -d '{"match_id":"<MATCH_ID>","predicted_cat_id":"<CAT_ID>","bet":10}'
```

## Submit cat (small payload)

```bash
curl -i -sS -X POST "$BASE_URL/api/cats/submit" \
  -F "name=SmokeCat" \
  -F "rarity=Common" \
  -F "attack=35" \
  -F "defense=35" \
  -F "speed=35" \
  -F "charisma=35" \
  -F "chaos=35" \
  -F "power=Smoke Test" \
  -F "image=@./loadtest/assets/test-cat.jpg;type=image/jpeg"
```

## Shop endpoints

```bash
curl -sS "$BASE_URL/api/shop/catalog" | jq
curl -sS "$BASE_URL/api/shop/featured" | jq
```

