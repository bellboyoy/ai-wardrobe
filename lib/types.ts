export type Photo = { id: string; path: string; angle: 'front' | 'side' | 'full' | 'other'; is_default: boolean; created_at: string };
export type Item = {
  id: string; path: string; name: string; category: string; colour: string; brand: string; size: string;
  price: string; source: string; url: string; notes: string; status: 'owned' | 'wishlist'; favourite: boolean; created_at: string;
};
export type Look = {
  id: string; photo_id: string | null; item_ids: string[]; outfit_id: string | null; provider: string;
  status: 'running' | 'done' | 'error'; path: string | null; error: string | null; favourite: boolean; created_at: string;
};
export type Outfit = { id: string; name: string; item_ids: string[]; tryon_id: string | null; notes: string; tags: string[]; favourite: boolean; created_at: string };
export type Profile = {
  user_id?: string; display_name: string; city: string; budget: string;
  sizes: Record<string, string>; measurements: Record<string, string>; styles: string[]; brands: string[];
};
export type Suggestion = { name: string; itemIds: string[]; why: string; tags?: string[]; missing?: string };
export type AppConfig = { provider: string; aiReady: boolean; stylist: boolean; hint?: string };
