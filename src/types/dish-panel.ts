/** 面板共享类型（排序 / 筛选 / 评价草稿） */

export type SortKey = 'default' | 'rating' | 'price-asc' | 'price-desc' | 'most-reviewed';

/** 评分门槛筛选：0 = 全部 */
export type MinRating = 0 | 3 | 4;

/** 评价表单草稿（不含 dish_id，由业务层补齐） */
export interface ReviewFormDraft {
  nickname: string;
  rating: number;
  taste: number | null;
  portion: number | null;
  value: number | null;
  tags: string[];
  content: string;
}
