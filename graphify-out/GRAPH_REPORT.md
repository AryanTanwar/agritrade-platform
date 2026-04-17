# Graph Report - .  (2026-04-17)

## Corpus Check
- 128 files · ~57,497 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 674 nodes · 1679 edges · 65 communities detected
- Extraction: 45% EXTRACTED · 55% INFERRED · 0% AMBIGUOUS · INFERRED: 926 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]

## God Nodes (most connected - your core abstractions)
1. `toJSON()` - 75 edges
2. `query()` - 52 edges
3. `createEscrow()` - 30 edges
4. `farmerCtx()` - 29 edges
5. `createListing()` - 29 edges
6. `withSharedStub()` - 27 edges
7. `BuildKey()` - 26 edges
8. `GetTimestamp()` - 25 edges
9. `sampleEscrowInput()` - 25 edges
10. `sampleListingInput()` - 25 edges

## Surprising Connections (you probably didn't know these)
- `useCreateListing()` --calls--> `CreateListing()`  [INFERRED]
  client\web\src\hooks\useListings.js → client\web\src\pages\farmer\CreateListing.jsx
- `list()` --calls--> `query()`  [INFERRED]
  services\logistics\src\services\shipment.service.js → shared\db.js
- `history()` --calls--> `getHistory()`  [INFERRED]
  services\order\src\controllers\order.controller.js → services\order\src\services\order.service.js
- `verifyPayment()` --calls--> `update()`  [INFERRED]
  services\payment\src\services\razorpay.service.js → services\user\src\services\user.service.js
- `TestRaiseDispute_NotAParty()` --calls--> `newCtx()`  [INFERRED]
  chaincode\tests\escrow_test.go → chaincode\tests\helpers_test.go

## Hyperedges (group relationships)
- **Microservices Layer** — readme_user_service, readme_listing_service, readme_order_service, readme_payment_service, readme_logistics_service, readme_notification_service [EXTRACTED 1.00]
- **Client Applications** — readme_farmer_app, readme_buyer_portal, readme_logistics_portal [EXTRACTED 1.00]
- **Hyperledger Fabric Organisations** — readme_farmers_org, readme_buyers_org, readme_logistics_org [EXTRACTED 1.00]
- **Fabric Smart Contracts** — readme_chaincode_trade, readme_chaincode_escrow, readme_chaincode_supplychain, readme_chaincode_logistics [EXTRACTED 1.00]
- **Persistent Data Stores** — readme_postgresql, readme_redis, readme_ipfs [EXTRACTED 1.00]
- **Observability Stack** — readme_prometheus_grafana, readme_wazuh_siem [INFERRED 0.85]

## Communities

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (82): confirmOrder(), createListing(), placeOrder(), isConflict(), isForbidden(), isNotFound(), isStateError(), TestAUDIT_Escrow_CannotRefundAfterRelease() (+74 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (28): ChainError, ErrorCode, Event, HistoryRecord, PagedQueryResult, NewConflictError(), NewForbiddenError(), NewInternalError() (+20 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (46): changePassword(), generateTokens(), login(), logout(), refreshToken(), healthCheck(), query(), withTransaction() (+38 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (31): decrypt(), encrypt(), getKey(), sha256Hash(), disable2FA(), registerBuyer(), registerFarmer(), setup2FA() (+23 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (32): addEventHandler(), disconnect(), enrollAdmin(), enrollUser(), evaluateTransaction(), getContract(), getGateway(), getNetwork() (+24 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (24): Dashboard(), ListingDetail(), Listings(), Marketplace(), MyOrders(), FarmerOrders(), OrderTracking(), PaymentFlow() (+16 more)

### Community 6 - "Community 6"
Cohesion: 0.06
Nodes (13): AuthProvider(), useAuth(), DashboardScreen(), RootNavigator(), Layout(), ListingDetailScreen(), Login(), LoginScreen() (+5 more)

### Community 7 - "Community 7"
Cohesion: 0.2
Nodes (30): confirmDelivery(), logisticsCtx(), newCtx(), createShipment(), sampleShipmentInput(), TestConfirmDelivery_Success(), TestCreateShipment_Duplicate(), TestCreateShipment_InvalidCargoType() (+22 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (32): Graphify Project Configuration, Graphify Output Directory, AgriTrade Platform, API Gateway, Buyer Portal Client, Buyers Org, Escrow Chaincode, Logistics Chaincode (+24 more)

### Community 9 - "Community 9"
Cohesion: 0.15
Nodes (19): ActorType, EventType, GeoLocation, IoTReadings, SmartContract, SupplyChainEvent, SupplyChainSummary, sampleEventInput() (+11 more)

### Community 10 - "Community 10"
Cohesion: 0.11
Nodes (6): handleTPLWebhook(), handleWebhook(), _onPaymentCaptured(), _onPaymentFailed(), _onRefundProcessed(), process()

### Community 11 - "Community 11"
Cohesion: 0.11
Nodes (9): AppError, BlockchainError, ConflictError, ForbiddenError, globalErrorHandler(), NotFoundError, RateLimitError, UnauthorizedError (+1 more)

### Community 12 - "Community 12"
Cohesion: 0.2
Nodes (1): history()

### Community 13 - "Community 13"
Cohesion: 0.22
Nodes (1): shutdown()

### Community 14 - "Community 14"
Cohesion: 0.57
Nodes (6): api(), completeOrder(), markInTransit(), registerBuyer(), registerFarmer(), seq()

### Community 15 - "Community 15"
Cohesion: 0.33
Nodes (5): CargoType, GeoPoint, IoTSnapshot, Shipment, ShipmentStatus

### Community 16 - "Community 16"
Cohesion: 0.33
Nodes (5): ListingStatus, Location, OrderStatus, TradeListing, TradeOrder

### Community 17 - "Community 17"
Cohesion: 0.4
Nodes (1): main()

### Community 18 - "Community 18"
Cohesion: 0.4
Nodes (1): mockIdentity

### Community 19 - "Community 19"
Cohesion: 0.5
Nodes (3): DisputeOutcome, Escrow, EscrowStatus

### Community 20 - "Community 20"
Cohesion: 0.5
Nodes (0): 

### Community 21 - "Community 21"
Cohesion: 0.83
Nodes (3): containsSQLInjection(), scanObject(), sqlInjectionGuard()

### Community 22 - "Community 22"
Cohesion: 0.83
Nodes (3): sanitizeObject(), sanitizeValue(), xssClean()

### Community 23 - "Community 23"
Cohesion: 0.5
Nodes (0): 

### Community 24 - "Community 24"
Cohesion: 0.67
Nodes (1): App()

### Community 25 - "Community 25"
Cohesion: 0.67
Nodes (1): BlockchainTimeline()

### Community 26 - "Community 26"
Cohesion: 0.67
Nodes (1): ListingCard()

### Community 27 - "Community 27"
Cohesion: 0.67
Nodes (0): 

### Community 28 - "Community 28"
Cohesion: 0.67
Nodes (0): 

### Community 29 - "Community 29"
Cohesion: 0.67
Nodes (0): 

### Community 30 - "Community 30"
Cohesion: 0.67
Nodes (0): 

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Community 43"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Community 44"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Community 45"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Community 46"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Community 47"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Community 48"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Community 49"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "Community 50"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "Community 51"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "Community 52"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "Community 53"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "Community 54"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "Community 55"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Community 56"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "Community 57"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "Community 58"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "Community 59"
Cohesion: 1.0
Nodes (0): 

### Community 60 - "Community 60"
Cohesion: 1.0
Nodes (0): 

### Community 61 - "Community 61"
Cohesion: 1.0
Nodes (0): 

### Community 62 - "Community 62"
Cohesion: 1.0
Nodes (0): 

### Community 63 - "Community 63"
Cohesion: 1.0
Nodes (0): 

### Community 64 - "Community 64"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **35 isolated node(s):** `ErrorCode`, `Event`, `HistoryRecord`, `PagedQueryResult`, `EscrowStatus` (+30 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 31`** (2 nodes): `OrderStatusBadge.js`, `OrderStatusBadge()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (2 nodes): `OTPScreen.js`, `OTPScreen()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (2 nodes): `MarketplaceScreen.js`, `MarketplaceScreen()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (2 nodes): `OrdersScreen.js`, `OrdersScreen()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (2 nodes): `PlaceOrderScreen.js`, `PlaceOrderScreen()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (2 nodes): `OTPVerify.jsx`, `OTPVerify()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (2 nodes): `rate-limiter.js`, `createLimiter()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (2 nodes): `redactSensitive()`, `logger.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (2 nodes): `validate()`, `index.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (2 nodes): `loginAsFarmer()`, `farmer-listing.spec.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (1 nodes): `eslint.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (1 nodes): `playwright.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (1 nodes): `babel.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (1 nodes): `index.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (1 nodes): `postcss.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (1 nodes): `tailwind.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (1 nodes): `vite.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (1 nodes): `main.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (1 nodes): `router.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (1 nodes): `index.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (1 nodes): `cors.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (1 nodes): `helmet.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (1 nodes): `listing.routes.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (1 nodes): `logistics.routes.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (1 nodes): `notification.routes.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (1 nodes): `order.routes.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (1 nodes): `payment.routes.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (1 nodes): `auth.routes.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (1 nodes): `user.routes.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (1 nodes): `auth.spec.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (1 nodes): `marketplace.spec.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62`** (1 nodes): `gateway.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 63`** (1 nodes): `aes256.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (1 nodes): `hashUtils.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `query()` connect `Community 2` to `Community 0`, `Community 1`, `Community 3`, `Community 4`, `Community 7`?**
  _High betweenness centrality (0.209) - this node is a cross-community bridge._
- **Why does `CreateListing()` connect `Community 0` to `Community 5`?**
  _High betweenness centrality (0.155) - this node is a cross-community bridge._
- **Why does `useCreateListing()` connect `Community 5` to `Community 0`?**
  _High betweenness centrality (0.151) - this node is a cross-community bridge._
- **Are the 74 inferred relationships involving `toJSON()` (e.g. with `TestAUDIT_Trade_PlaceOrder_RequiresBuyerMSP()` and `TestAUDIT_Trade_CreateListing_RequiresFarmerMSP()`) actually correct?**
  _`toJSON()` has 74 INFERRED edges - model-reasoned connections that need verification._
- **Are the 49 inferred relationships involving `query()` (e.g. with `create()` and `getById()`) actually correct?**
  _`query()` has 49 INFERRED edges - model-reasoned connections that need verification._
- **Are the 29 inferred relationships involving `createEscrow()` (e.g. with `TestAUDIT_Escrow_CreateEscrow_RequiresBuyerMSP()` and `TestAUDIT_Escrow_ReleaseEscrow_ForbidsThirdPartyMSP()`) actually correct?**
  _`createEscrow()` has 29 INFERRED edges - model-reasoned connections that need verification._
- **Are the 27 inferred relationships involving `farmerCtx()` (e.g. with `TestAUDIT_Trade_PlaceOrder_RequiresBuyerMSP()` and `TestAUDIT_Escrow_CreateEscrow_RequiresBuyerMSP()`) actually correct?**
  _`farmerCtx()` has 27 INFERRED edges - model-reasoned connections that need verification._