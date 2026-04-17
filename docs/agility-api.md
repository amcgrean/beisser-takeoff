# DMSi AgilityPublic REST API Reference

**API version:** v619
**Base URL env var:** `AGILITY_API_URL` — must end with `/AgilityPublic/rest/`
**Client:** `src/lib/agility-api.ts` — singleton `agilityApi` export
**Last updated: 2026-04-17**

---

## Connection & Auth

All calls are **POST-based RPC** with JSON payloads. There is no REST resource structure — every endpoint is `POST /{Service}/{Method}`.

### Login flow

1. Call `Session/Login` with `LoginID` + `Password` to get a `SessionContextId` and `InitialBranch`.
2. Include `ContextId` and `Branch` headers on every subsequent call.
3. Sessions last **4 hours** on the Agility server. The client uses a **3.5-hour TTL** to avoid edge-case expiry.
4. On a **401** response the client invalidates the cached session and retries the call once (automatic re-login).

### Username format

`AGILITY_USERNAME` must include the company domain suffix: `leapi.beisser` — **not** just `leapi`. This is the same format used by mobile/app logins.

### Branch codes (Beisser)

All four Beisser branches use identity mapping (Agility branch ID = Beisser branch code):

| Branch code | Location |
|-------------|----------|
| `10FD` | Fort Dodge |
| `20GR` | Grimes |
| `25BW` | Birchwood (Waukee) |
| `40CV` | Coralville |

### Return codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Warning — operation succeeded, but read `MessageText` |
| `2` | Error — `AgilityApiError` is thrown with `MessageText` |

---

## Required env vars

| Var | Purpose |
|-----|---------|
| `AGILITY_API_URL` | Full base URL e.g. `https://api-1390-1.dmsi.com/AgilityPublic/rest/` |
| `AGILITY_USERNAME` | Must include domain suffix e.g. `leapi.beisser` |
| `AGILITY_PASSWORD` | Password for the API user |
| `AGILITY_BRANCH` | Default branch code (optional, falls back to login default) |

---

## Session Service

### `Session/Login`
Authenticate and obtain a `SessionContextId`.

**Request**
```json
{ "LoginID": "leapi.beisser", "Password": "...", "Branch": "20GR" }
```

**Response fields**
| Field | Type | Notes |
|-------|------|-------|
| `SessionContextId` | string | Required header on all subsequent calls |
| `InitialBranch` | string | Agility internal branch ID |
| `ReturnCode` | int | 0 = success |
| `MessageText` | string | Error detail if ReturnCode ≠ 0 |

**Used by:** Every route that calls the Agility API (automatic via session cache)

---

### `Session/Logout`
Invalidate a server-side session.

**Request**
```json
{}
```

**Used by:** `POST /api/admin/agility/test` (cleanup step)

---

### `Session/AgilityVersion`
Returns the Agility server version string.

**Response fields**
| Field | Type |
|-------|------|
| `AgilityVersion` | string |

**Used by:** `POST /api/admin/agility/test` (connectivity check step 2)

---

### `Session/BranchList`
Returns all branches available to the logged-in user.

**Response fields** (per item in `dsBranchList.dtBranchList`)
| Field | Type |
|-------|------|
| `Branch` | string |
| `BranchName` | string |
| `Active` | bool |

**Used by:** `POST /api/admin/agility/test` (connectivity check step 3). Also used to verify/update `BRANCH_MAP`.

---

## Inventory Service

### `Inventory/ItemPriceAndAvailabilityList` ✅ Wired
Real-time price and availability for one or more items. Use this instead of the stale `agility_items` mirror when accurate pricing is needed (bid time, cart).

**Request**
```json
{
  "CustomerID": "CUSTCODE",
  "ShipToSequence": 1,
  "SaleType": "S",
  "Items": [
    { "ItemID": "2X4-8", "Quantity": 100, "UOM": "EA" }
  ]
}
```

**Response** — array of items in `ItemPriceAndAvailResponse.dsItemPriceAndAvailResponse.dtItemPriceAndAvailResponse`
| Field | Type | Notes |
|-------|------|-------|
| `ItemCode` | string | |
| `ItemDescription` | string | |
| `UOM` | string | |
| `GrossPrice` | number | List price |
| `NetPrice` | number | Customer net price |
| `OnHandQuantity` | number | |
| `AvailableQuantity` | number | On hand minus committed |
| `OnOrderQty` | number | Open PO quantity |
| `HandlingCode` | string | `S`=stock, `N`=non-stock, etc. |
| `NonSaleable` | bool | |
| `Stock` | bool | |
| `Discontinued` | string | |

**LiveEdge route:** `POST /api/erp/price-check` — max 100 items per request

---

### `Inventory/ItemsList` — built, not wired to a route
Paginated item master. Use `paginateAll()` helper for full syncs.

**Request**
```json
{
  "RecordFetchLimit": 200,
  "ChunkStartPointer": 0,
  "ActiveOnly": true,
  "FetchOnlyChangedSince": "2026-01-01T00:00:00",
  "ItemID": "2X4-8"
}
```

**Response** (paginated)
| Field | Type |
|-------|------|
| `ItemCode` | string |
| `ItemDescription` | string |
| `UOM` | string |
| `HandlingCode` | string |
| `Stock` | bool |
| `Discontinued` | string |
| `GrossPrice` | number |
| `NetPrice` | number |
| `OnHandQuantity` | number |
| `AvailableQuantity` | number |
| `PrimarySupplierID` | string |
| `MoreResultsAvailable` | bool | Top-level pagination flag |
| `NextChunkStartPointer` | int | Pass as `ChunkStartPointer` for next page |

---

## Orders Service

### `Orders/SalesOrderCreate` ✅ Wired
Create a new sales order. Primary write path for converting a bid into an SO.

**Request**
```json
{
  "CustomerID": "CUSTCODE",
  "ShipToSequence": 1,
  "SaleType": "S",
  "ExpectDate": "2026-05-01",
  "Reference": "BID-1234",
  "ShipVia": "DELIVERY",
  "Driver": "",
  "Route": "",
  "SalesAgentID": "AGENT1",
  "PONumber": "PO-999",
  "Notes": "Hold for pickup",
  "Lines": [
    { "ItemID": "2X4-8", "Quantity": 100, "UOM": "EA", "Price": 1.25, "WarehouseID": "MAIN" }
  ]
}
```

**Response**
| Field | Type | Notes |
|-------|------|-------|
| `NewOrderID` | int | The new SO number |
| `ReturnCode` | int | |
| `MessageText` | string | |

**LiveEdge route:** `POST /api/legacy-bids/[id]/push-to-erp`

---

### `Orders/SalesOrderCreateValidate` — built, not wired to a route
Validates an order without creating it. Run before `SalesOrderCreate` to surface pricing, inventory, or customer status issues.

**Request:** Same shape as `SalesOrderCreate`

**Response**
| Field | Type | Notes |
|-------|------|-------|
| `ReturnCode` | int | 0 = valid |
| `MessageText` | string | Validation error detail |

---

### `Orders/SalesOrderCancel` ✅ Wired
Cancel an existing sales order.

**Request**
```json
{ "OrderID": "100123" }
```

**LiveEdge route:** `POST /api/sales/orders/[so_number]/push-to-erp`

---

### `Orders/SalesOrderList` — built, not wired to a route
Paginated list of sales orders with optional filters.

**Request**
```json
{
  "CustomerID": "CUSTCODE",
  "Status": "O",
  "StartDate": "2026-01-01",
  "EndDate": "2026-12-31",
  "RecordFetchLimit": 200,
  "ChunkStartPointer": 0,
  "FetchOnlyChangedSince": "2026-04-01T00:00:00"
}
```

**Response** (per item in `OrdersResponse.dsOrdersResponse.dtOrderResponse`)
| Field | Type |
|-------|------|
| `OrderID` | int |
| `BranchID` | string |
| `CustomerID` | string |
| `ShipToSequence` | int |
| `SaleType` | string |
| `OrderDate` | string |
| `ExpectedDate` | string \| null |
| `OrderStatus` | string |
| `TransactionReference` | string |
| `ShipVia` | string |
| `RouteID` | string |
| `OrderTotal` | number |
| `ShipToName` | string \| null |
| `ShipToCity` | string \| null |
| `ShipToState` | string \| null |

---

### `Orders/QuoteCreate` ✅ Wired
Create a quote (not yet an SO). Converts to SO later via `QuoteRelease`.

**Request**
```json
{
  "CustomerID": "CUSTCODE",
  "ShipToSequence": 1,
  "SaleType": "S",
  "Reference": "BID-1234",
  "ExpirationDate": "2026-06-01",
  "SalesAgentID": "AGENT1",
  "Notes": "",
  "Lines": [
    { "ItemID": "2X4-8", "Quantity": 100, "UOM": "EA", "Price": 1.25 }
  ]
}
```

**Response**
| Field | Type |
|-------|------|
| `NewOrderID` | int | Quote number |
| `ReturnCode` | int | |
| `MessageText` | string | |

**LiveEdge route:** `POST /api/legacy-bids/[id]/push-to-erp` (when bid is in quote mode)

---

### `Orders/QuoteRelease` ✅ Wired
Promote a quote to an active sales order.

**Request**
```json
{ "QuoteID": "Q-100456" }
```

**Response:** Same as `SalesOrderCreate` — returns `NewOrderID` of the new SO.

**LiveEdge route:** `POST /api/legacy-bids/[id]/promote-quote`

---

## Purchasing Service

### `Purchasing/PurchaseOrderGet` ✅ Wired
Get full live detail for a PO (header + lines + receipts). More current than the `agility_po_*` mirror tables.

**Request**
```json
{ "PONumber": "PO-10001" }
```

**Response:** Full PO object (schema varies — use `Record<string, unknown>` and inspect per field).

**LiveEdge route:** `GET /api/purchasing/pos/[po]/live`

---

### `Purchasing/PurchaseOrderCreate` — built, not wired to a route
Create a purchase order. Intended for the Suggested Buys → PO conversion flow.

**Request**
```json
{
  "SupplierID": "SUPPLIERCODE",
  "SupplierShipFromSequence": 1,
  "ExpectDate": "2026-05-15",
  "Reference": "AUTO-REORDER",
  "Notes": "",
  "Lines": [
    { "ItemID": "2X4-8", "Quantity": 500, "UOM": "EA", "Cost": 0.85, "WarehouseID": "MAIN" }
  ]
}
```

**Response**
| Field | Type |
|-------|------|
| `PONumber` | string | New PO number |
| `ReturnCode` | int | |
| `MessageText` | string | |

---

## Shipments Service

### `Shipments/PickFileCreate` ✅ Wired
Create a pick file in the ERP to initiate warehouse picking for an SO.

**Request**
```json
{
  "OrderID": "100123",
  "PickType": "",
  "PrintPickTicket": false,
  "WarehouseID": "MAIN"
}
```

**Response**
| Field | Type |
|-------|------|
| `PickFileID` | string | |
| `ReturnCode` | int | |
| `MessageText` | string | |

**LiveEdge routes:**
- `POST /api/warehouse/picks/create-pick-file` (warehouse supervisor)
- `POST /api/warehouse/orders/[so_number]/release-pick` (dispatch → warehouse)

---

### `Shipments/ShipmentInfoUpdate` ✅ Wired
Update shipment status or route/stop assignment. Use `ShipmentStatusFlag = "D"` to mark a delivery complete from the driver app.

**Status flag values**

| Flag | Meaning |
|------|---------|
| `L` / `Loaded` | Loaded onto truck |
| `S` / `Staged` | Staged for pickup |
| `E` / `En Route` | Driver en route |
| `D` / `Delivered` | Delivery complete |

**Request**
```json
{
  "OrderID": 100123,
  "ShipmentInfoRequestJSON": {
    "dsShipInfoRequest": {
      "dtShipInfoRequest": [{
        "ShipmentNumber": 1,
        "UpdateAllPickFiles": true,
        "UpdateSalesOrder": false,
        "RouteID": "RT01",
        "StopNumber": 3,
        "ShipDate": "2026-04-17",
        "RequestedDeliveryDate": "",
        "ShipmentStatusFlag": "D"
      }]
    }
  }
}
```

**LiveEdge route:** `POST /api/dispatch/orders/[so_number]/deliver`

---

### `Shipments/PODSignatureCreate` ✅ Wired
Record a proof-of-delivery signature.

**Request**
```json
{
  "OrderID": "100123",
  "ShipmentNum": 1,
  "SignatureName": "John Smith",
  "SignatureData": "<base64-encoded PNG>",
  "SignatureDate": "2026-04-17"
}
```

**LiveEdge route:** `POST /api/dispatch/orders/[so_number]/pod`

---

### `Shipments/ShipmentsList` — built, not wired to a route
Paginated shipment list with optional date/order filters.

**Request**
```json
{
  "OrderID": "100123",
  "StartDate": "2026-04-01",
  "EndDate": "2026-04-30",
  "RecordFetchLimit": 200,
  "ChunkStartPointer": 0
}
```

**Response:** Array of shipment records in `dsShipmentsList.dtShipmentsList`. Schema varies — inspect at runtime.

---

## Customer Service

### `Customer/CustomersList` — built, not wired to a route
Paginated customer list for bulk sync.

**Request**
```json
{
  "RecordFetchLimit": 200,
  "ChunkStartPointer": 0,
  "ActiveOnly": true,
  "FetchOnlyChangedSince": "2026-01-01T00:00:00",
  "CustomerID": "CUSTCODE"
}
```

**Response:** Array in `dsCustomersList.dtCustomersList`. Schema varies.

---

## AccountsReceivable Service

### `AccountsReceivable/CustomerOpenActivity` ✅ Wired
Real-time AR open balance and invoice list for a customer.

**Request**
```json
{ "CustomerID": "CUSTCODE" }
```

**Response:** AR open activity object (schema varies — inspect at runtime).

**LiveEdge route:** `GET /api/sales/customers/[code]/ar-live`

---

### `AccountsReceivable/CustomerBilltoBalancesList` — built, not wired to a route
AR balances grouped by bill-to customer.

**Request**
```json
{ "CustomerID": "CUSTCODE" }
```

**Response:** Balance summary object (schema varies).

---

## Dispatch Service

### `Dispatch/DispatchGet` — built, not wired to a route
Get dispatch information for a date, route, or specific order.

**Request**
```json
{
  "DispatchDate": "2026-04-17",
  "RouteID": "RT01",
  "OrderID": "100123"
}
```

All fields are optional — omitting all returns today's full dispatch.

**Response:** Dispatch object (schema varies — inspect at runtime).

---

## Utility: `paginateAll()`

Helper exported from `agility-api.ts` for endpoints that use chunked pagination (`MoreResultsAvailable` / `NextChunkStartPointer`).

```ts
import { paginateAll, agilityApi } from '@/lib/agility-api';

const allItems = await paginateAll(
  (pointer) => agilityApi.itemsList({ RecordFetchLimit: 200, ChunkStartPointer: pointer }),
  10_000  // safety cap
);
```

---

## Method Summary

| Service | Method | Status | LiveEdge route |
|---------|--------|--------|----------------|
| Session | Login | Auto (internal) | All Agility routes |
| Session | Logout | Auto (internal) | All Agility routes |
| Session | AgilityVersion | Wired | `POST /api/admin/agility/test` |
| Session | BranchList | Wired | `POST /api/admin/agility/test` |
| Inventory | ItemPriceAndAvailabilityList | **Wired** | `POST /api/erp/price-check` |
| Inventory | ItemsList | Built — not wired | — |
| Orders | SalesOrderCreate | **Wired** | `POST /api/legacy-bids/[id]/push-to-erp` |
| Orders | SalesOrderCreateValidate | Built — not wired | — |
| Orders | SalesOrderCancel | **Wired** | `POST /api/sales/orders/[so_number]/push-to-erp` |
| Orders | SalesOrderList | Built — not wired | — |
| Orders | QuoteCreate | **Wired** | `POST /api/legacy-bids/[id]/push-to-erp` |
| Orders | QuoteRelease | **Wired** | `POST /api/legacy-bids/[id]/promote-quote` |
| Purchasing | PurchaseOrderCreate | Built — not wired | — |
| Purchasing | PurchaseOrderGet | **Wired** | `GET /api/purchasing/pos/[po]/live` |
| Shipments | PickFileCreate | **Wired** | `POST /api/warehouse/picks/create-pick-file`, `POST /api/warehouse/orders/[so_number]/release-pick` |
| Shipments | ShipmentInfoUpdate | **Wired** | `POST /api/dispatch/orders/[so_number]/deliver` |
| Shipments | PODSignatureCreate | **Wired** | `POST /api/dispatch/orders/[so_number]/pod` |
| Shipments | ShipmentsList | Built — not wired | — |
| Customer | CustomersList | Built — not wired | — |
| AccountsReceivable | CustomerOpenActivity | **Wired** | `GET /api/sales/customers/[code]/ar-live` |
| AccountsReceivable | CustomerBilltoBalancesList | Built — not wired | — |
| Dispatch | DispatchGet | Built — not wired | — |

**Wired: 11 methods | Built but not yet wired to a route: 7 methods**
