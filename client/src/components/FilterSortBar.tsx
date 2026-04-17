import { useMemo, useState } from 'react';
import { ArrowUpDown, Filter, RotateCcw } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Keyword } from '../services/api';

export interface FilterState {
  source: string;
  importance: string;
  keywordId: string;
  timeRange: string;
  isReal: string;
  sortBy: string;
  sortOrder: string;
}

export const defaultFilterState: FilterState = {
  source: '',
  importance: '',
  keywordId: '',
  timeRange: '',
  isReal: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

interface FilterSortBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  keywords: Keyword[];
}

const SORT_OPTIONS = [
  { value: 'createdAt', label: '抓取时间' },
  { value: 'publishedAt', label: '发布时间' },
  { value: 'importance', label: '重要程度' },
  { value: 'relevance', label: '相关度' },
  { value: 'hot', label: '热度' },
];

const SOURCE_OPTIONS = [
  { value: '', label: '全部来源' },
  { value: 'twitter', label: 'Twitter' },
  { value: 'bing', label: 'Bing' },
  { value: 'google', label: 'Google' },
  { value: 'sogou', label: '搜狗' },
  { value: 'bilibili', label: 'Bilibili' },
  { value: 'weibo', label: '微博热搜' },
  { value: 'hackernews', label: 'HackerNews' },
  { value: 'duckduckgo', label: 'DuckDuckGo' },
];

const IMPORTANCE_OPTIONS = [
  { value: '', label: '全部级别' },
  { value: 'urgent', label: '紧急' },
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
];

const TIME_RANGE_OPTIONS = [
  { value: '', label: '全部时间' },
  { value: '1h', label: '最近 1 小时' },
  { value: 'today', label: '今天' },
  { value: '7d', label: '最近 7 天' },
  { value: '30d', label: '最近 30 天' },
];

const REAL_OPTIONS = [
  { value: '', label: '全部真实性' },
  { value: 'true', label: '真实' },
  { value: 'false', label: '疑似噪声' },
];

function Field({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-2 text-xs text-[#737373] min-w-[170px]">
      <span className="uppercase tracking-[0.12em]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-[12px] border border-[#e5e5e5] bg-white px-3 text-sm text-black outline-none transition-colors focus:border-[#a3a3a3]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function FilterSortBar({ filters, onChange, keywords }: FilterSortBarProps) {
  const [showFilters, setShowFilters] = useState(false);

  const update = (key: keyof FilterState, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  const keywordOptions = useMemo(
    () => [
      { value: '', label: '全部关键词' },
      ...keywords.filter((item) => item.isActive).map((item) => ({ value: item.id, label: item.text })),
    ],
    [keywords]
  );

  const activeFilterCount = [
    filters.source,
    filters.importance,
    filters.keywordId,
    filters.timeRange,
    filters.isReal,
  ].filter(Boolean).length;

  const hasNonDefaultSort = filters.sortBy !== defaultFilterState.sortBy || filters.sortOrder !== defaultFilterState.sortOrder;
  const hasCustomized = activeFilterCount > 0 || hasNonDefaultSort;

  return (
    <section className="space-y-4 rounded-[12px] border border-[#e5e5e5] bg-[#fafafa] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-[9999px] border border-[#e5e5e5] bg-white p-1">
          <span className="px-2 text-[#737373]">
            <ArrowUpDown className="h-3.5 w-3.5" />
          </span>
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => update('sortBy', option.value)}
              className={cn(
                'h-8 rounded-[9999px] px-3 text-xs transition-colors',
                filters.sortBy === option.value ? 'bg-black text-white' : 'text-[#525252] hover:bg-[#f5f5f5]'
              )}
            >
              {option.label}
            </button>
          ))}
          <button
            onClick={() => update('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
            className="h-8 rounded-[9999px] border border-[#e5e5e5] px-3 text-xs text-[#525252] hover:bg-[#f5f5f5]"
          >
            {filters.sortOrder === 'asc' ? '升序' : '降序'}
          </button>
        </div>

        <button
          onClick={() => setShowFilters((prev) => !prev)}
          className={cn(
            'inline-flex h-8 items-center gap-1 rounded-[9999px] border px-3 text-xs transition-colors',
            showFilters || activeFilterCount > 0
              ? 'border-black bg-black text-white'
              : 'border-[#d4d4d4] bg-white text-[#404040] hover:bg-[#f5f5f5]'
          )}
        >
          <Filter className="h-3.5 w-3.5" />
          筛选
          {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>

        {hasCustomized && (
          <button
            onClick={() => onChange({ ...defaultFilterState })}
            className="inline-flex h-8 items-center gap-1 rounded-[9999px] border border-[#d4d4d4] bg-white px-3 text-xs text-[#404040] hover:bg-[#f5f5f5]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            重置
          </button>
        )}
      </div>

      {showFilters && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Field label="来源" value={filters.source} onChange={(value) => update('source', value)} options={SOURCE_OPTIONS} />
          <Field
            label="重要程度"
            value={filters.importance}
            onChange={(value) => update('importance', value)}
            options={IMPORTANCE_OPTIONS}
          />
          <Field
            label="关键词"
            value={filters.keywordId}
            onChange={(value) => update('keywordId', value)}
            options={keywordOptions}
          />
          <Field
            label="时间范围"
            value={filters.timeRange}
            onChange={(value) => update('timeRange', value)}
            options={TIME_RANGE_OPTIONS}
          />
          <Field
            label="真实性"
            value={filters.isReal}
            onChange={(value) => update('isReal', value)}
            options={REAL_OPTIONS}
          />
        </div>
      )}
    </section>
  );
}
