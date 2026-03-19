/**
 * Re-exports of generated server types for convenient imports.
 *
 * Usage:
 *   import type { ViewStorageResponse, Player, Ship } from '@/lib/gameTypes'
 *
 * Generated from the server's OpenAPI v2 spec. Regenerate with: pnpm generate:types
 */
import type { components } from './generated/v2api'

// Convenience alias
type Schema = components['schemas']

// Core game objects
export type Player = Schema['Player']
export type Ship = Schema['Ship']
export type ShipClass = Schema['ShipClass']
export type SystemInfo = Schema['SystemInfo']
export type POI = Schema['POI']
export type SystemPOI = Schema['SystemPOI']
export type SystemConnection = Schema['SystemConnection']
export type NearbyPlayer = Schema['NearbyPlayer']
export type CargoItem = Schema['CargoItem']
export type Base = Schema['Base']
export type MapSystem = Schema['MapSystem']
export type PlayerStats = Schema['PlayerStats']

// Auth
export type LoginResponse = Schema['LoginResponse']
export type RegisterResponse = Schema['RegisterResponse']

// Navigation
export type TravelResponse = Schema['TravelResponse']
export type UndockResponse = Schema['UndockResponse']
export type FindRouteResponse = Schema['FindRouteResponse']
export type SearchSystemsResponse = Schema['SearchSystemsResponse']
export type SurveySystemResponse = Schema['SurveySystemResponse']

// Info queries
export type GetBaseResponse = Schema['GetBaseResponse']
export type GetPOIResponse = Schema['GetPOIResponse']
export type GetSystemResponse = Schema['GetSystemResponse']
export type GetShipsResponse = Schema['GetShipsResponse']
export type GetNearbyResponse = Schema['GetNearbyResponse']
export type GetVersionResponse = Schema['GetVersionResponse']
export type GetMapResponse = Schema['GetMapResponse']
export type GetNotesResponse = Schema['GetNotesResponse']
export type GetWrecksResponse = Schema['GetWrecksResponse']
export type GetTradesResponse = Schema['GetTradesResponse']

// Trading
export type BuyResponse = Schema['BuyResponse']
export type SellResponse = Schema['SellResponse']
export type ViewMarketResponse = Schema['ViewMarketResponse']
export type ViewOrdersResponse = Schema['ViewOrdersResponse']
export type CreateSellOrderResponse = Schema['CreateSellOrderResponse']
export type CreateBuyOrderResponse = Schema['CreateBuyOrderResponse']
export type CancelOrderResponse = Schema['CancelOrderResponse']
export type ModifyOrderResponse = Schema['ModifyOrderResponse']
export type AnalyzeMarketResponse = Schema['AnalyzeMarketResponse']
export type EstimatePurchaseResponse = Schema['EstimatePurchaseResponse']

// Storage
export type ViewStorageResponse = Schema['ViewStorageResponse']
export type DepositItemsResponse = Schema['DepositItemsResponse']
export type WithdrawItemsResponse = Schema['WithdrawItemsResponse']

// Ship management
export type SellShipResponse = Schema['SellShipResponse']
export type SwitchShipResponse = Schema['SwitchShipResponse']
export type ListShipsResponse = Schema['ListShipsResponse']
export type BrowseShipsResponse = Schema['BrowseShipsResponse']
export type BuyListedShipResponse = Schema['BuyListedShipResponse']
export type InstallModResponse = Schema['InstallModResponse']
export type UninstallModResponse = Schema['UninstallModResponse']
export type RepairModuleResponse = Schema['RepairModuleResponse']
export type RefuelResponse = Schema['RefuelResponse']
export type RepairResponse = Schema['RepairResponse']
export type ReloadResponse = Schema['ReloadResponse']
export type CommissionShipResponse = Schema['CommissionShipResponse']
export type CommissionQuoteResponse = Schema['CommissionQuoteResponse']
export type CommissionStatusResponse = Schema['CommissionStatusResponse']

// Combat
export type ScanResponse = Schema['ScanResponse']
export type CloakResponse = Schema['CloakResponse']
export type GetBattleStatusResponse = Schema['GetBattleStatusResponse']
export type BattleResponse = Schema['BattleResponse']

// Missions
export type GetMissionsResponse = Schema['GetMissionsResponse']
export type AcceptMissionResponse = Schema['AcceptMissionResponse']
export type CompleteMissionResponse = Schema['CompleteMissionResponse']
export type CompletedMissionsResponse = Schema['CompletedMissionsResponse']
export type ViewCompletedMissionResponse = Schema['ViewCompletedMissionResponse']

// Crafting
export type CraftResponse = Schema['CraftResponse']
export type CatalogResponse = Schema['CatalogResponse']

// Social
export type ChatResponse = Schema['ChatResponse']
export type GetChatHistoryResponse = Schema['GetChatHistoryResponse']
export type GetActionLogResponse = Schema['GetActionLogResponse']

// Forum
export type ForumListResponse = Schema['ForumListResponse']
export type ForumGetThreadResponse = Schema['ForumGetThreadResponse']
export type ForumCreateThreadResponse = Schema['ForumCreateThreadResponse']
export type ForumReplyResponse = Schema['ForumReplyResponse']

// Faction
export type FactionInfoResponse = Schema['FactionInfoResponse']
export type FactionListResponse = Schema['FactionListResponse']
export type CreateFactionResponse = Schema['CreateFactionResponse']

// Insurance & Salvage
export type GetInsuranceQuoteResponse = Schema['GetInsuranceQuoteResponse']
export type BuyInsuranceResponse = Schema['BuyInsuranceResponse']
export type SetHomeBaseResponse = Schema['SetHomeBaseResponse']
export type LootWreckResponse = Schema['LootWreckResponse']
export type SalvageWreckResponse = Schema['SalvageWreckResponse']

// Shared
export type V2Response = Schema['V2Response']
export type V2GameState = Schema['V2GameState']
export type MessageResponse = Schema['MessageResponse']
export type PendingActionResponse = Schema['PendingActionResponse']

// Extracted types from response schemas (replaces hand-written types in types.ts)
export type MarketItem = ViewMarketResponse['items'][number]
export type OrderEntry = ViewOrdersResponse['orders'][number]
export type StorageItem = ViewStorageResponse['items'][number]
export type StorageShip = ViewStorageResponse['ships'][number]
export type StorageGift = NonNullable<ViewStorageResponse['gifts']>[number]
export type Mission = GetMissionsResponse['missions'][number]
export type MissionObjective = NonNullable<Mission['objectives']>[number]
export type MissionRewards = Mission['rewards']
export type Wreck = GetWrecksResponse['wrecks'][number]
export type FleetShip = ListShipsResponse['ships'][number]
export type ShowroomShip = BrowseShipsResponse['listings'][number]
export type BaseDetail = GetBaseResponse['base']
export type FactionDetail = FactionInfoResponse
export type FactionMember = NonNullable<FactionInfoResponse['members']>[number]
export type FactionWar = NonNullable<FactionInfoResponse['wars']>[number]
export type CatalogItem = CatalogResponse['items'][number]
