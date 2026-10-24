export type AirlineCode = 'B6' | 'DL' | 'AA' | 'BA' | 'AS' | 'LH';
export type Actor = AirlineCode | 'FAA';
export interface Airline { code: AirlineCode; name: string; color: string }
export interface SlotSeries { id: string; airport: string; season: string; direction: 'A' | 'D'; time: string; daysMask: string; holder: AirlineCode; operator: AirlineCode; flightNumber: string; priorSeasonUtilization: number }
export interface Occurrence { seriesId: string; date: string; outcome: 'operated' | 'cancelled' | 'justified' | 'scheduled'; reason: string; operatedBy: AirlineCode }
export interface Wanted { direction: 'A' | 'D'; timeFrom: string; timeTo: string; daysMask: string }
export type Term = 'Rest of season' | 'Rest of season plus Winter 2027/28';
export interface Listing { id: string; airline: AirlineCode; type: 'swap' | 'lease_out' | 'lease_in'; seriesId?: string; wanted?: Wanted; term: Term; priceUsd?: number; notes?: string; status: 'open' | 'matched' | 'closed'; createdAt: string }
export type TradeStatus = 'Proposed' | 'Pending FAA approval' | 'Executed' | 'Declined' | 'Rejected';
export interface Trade { id: string; type: 'swap' | 'lease'; fromAirline: AirlineCode; toAirline: AirlineCode; initiator: AirlineCode; seriesIds: string[]; listingIds: string[]; term: Term; priceUsd?: number; status: TradeStatus; effectiveDate?: string; timestamps: { proposed: string; accepted?: string; approved?: string; declined?: string; rejected?: string }; approvalSnapshot?: string }
export interface AuditEvent { id: string; timestamp: string; actor: Actor; action: string; objectId: string; details: string; parties: AirlineCode[] }
export interface DemoState { version: 2; role: Actor; date: string; listings: Listing[]; trades: Trade[]; audit: AuditEvent[] }
export type Status = 'Covered by lease' | 'Secured' | 'Lost' | 'Critical' | 'At risk' | 'Watch' | 'On track';
export interface Seed { airlines: Airline[]; series: SlotSeries[]; occurrences: Occurrence[]; listings: Listing[] }
