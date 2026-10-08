/** 种子数据结构定义（与 data/dishes.json 对应） */

export interface Dish {
  id: number;
  merchant_id: number;
  name: string;
  price: number | null;
  unit: string;
  priceNote: string | null;
  /** 原表已存在的口语短评（只读参考） */
  existingReview: string | null;
}

export interface Merchant {
  id: number;
  name: string;
  dishes: Dish[];
}

export interface DishesData {
  source: string;
  sourceUrl: string;
  exportedAt: string;
  stats: { merchants: number; dishes: number; withReview: number };
  merchants: Merchant[];
}
