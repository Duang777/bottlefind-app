import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  Plus,
  RefreshCw,
  Search,
  Target,
  Trash2,
  Twitter,
  User,
  X,
  Zap,
} from 'lucide-react';
import FilterSortBar, { defaultFilterState, type FilterState } from './components/FilterSortBar';
import { cn } from './lib/utils';
import {
  hotspotsApi,
  keywordsApi,
  notificationsApi,
  triggerHotspotCheck,
  type Hotspot,
  type Keyword,
  type Notification,
  type Stats,
} from './services/api';
import { onNewHotspot, onNotification, subscribeToKeywords } from './services/socket';
import { relativeTime, formatDateTime } from './utils/relativeTime';
import { sortHotspots } from './utils/sortHotspots';

type TabKey = 'dashboard' | 'keywords' | 'search';

function calcHeatScore(hotspot: Hotspot): number {
  const likes = hotspot.likeCount ?? 0;
  const retweets = hotspot.retweetCount ?? 0;
  const replies = hotspot.replyCount ?? 0;
  const comments = hotspot.commentCount ?? 0;
  const quotes = hotspot.quoteCount ?? 0;
  const views = hotspot.viewCount ?? 0;
  const raw = likes * 2 + retweets * 3 + replies * 1.5 + comments * 1.5 + quotes * 2 + views / 100;
  if (raw <= 0) return 0;
  return Math.min(100, Math.round(Math.log10(raw + 1) * 25));
}

function getSourceLabel(source: string) {
  const labels: Record<string, string> = {
    twitter: 'Twitter',
    bing: 'Bing',
    google: 'Google',
    sogou: '搜狗',
    bilibili: 'Bilibili',
    weibo: '微博',
    hackernews: 'HackerNews',
    duckduckgo: 'DuckDuckGo',
  };
  return labels[source] || source;
}

function getSourceIcon(source: string) {
  if (source === 'twitter') return <Twitter className="h-3.5 w-3.5" />;
  if (source === 'bilibili') return <Eye className="h-3.5 w-3.5" />;
  return <Globe className="h-3.5 w-3.5" />;
}

function getImportanceLabel(importance: string) {
  if (importance === 'urgent') return '紧急';
  if (importance === 'high') return '高';
  if (importance === 'medium') return '中';
  return '低';
}

function App() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [newKeyword, setNewKeyword] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [dashboardFilters, setDashboardFilters] = useState<FilterState>({ ...defaultFilterState });
  const [searchFilters, setSearchFilters] = useState<FilterState>({ ...defaultFilterState });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchResults, setSearchResults] = useState<Hotspot[]>([]);
  const [expandedReasons, setExpandedReasons] = useState<Set<string>>(new Set());
  const [expandedContents, setExpandedContents] = useState<Set<string>>(new Set());
  const [allReasonsExpanded, setAllReasonsExpanded] = useState(false);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2600);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const filterParams: Record<string, string | number> = {
        page: currentPage,
        limit: 20,
      };

      if (dashboardFilters.source) filterParams.source = dashboardFilters.source;
      if (dashboardFilters.importance) filterParams.importance = dashboardFilters.importance;
      if (dashboardFilters.keywordId) filterParams.keywordId = dashboardFilters.keywordId;
      if (dashboardFilters.timeRange) filterParams.timeRange = dashboardFilters.timeRange;
      if (dashboardFilters.isReal) filterParams.isReal = dashboardFilters.isReal;
      if (dashboardFilters.sortBy) filterParams.sortBy = dashboardFilters.sortBy;
      if (dashboardFilters.sortOrder) filterParams.sortOrder = dashboardFilters.sortOrder;

      const [keywordsData, hotspotsData, statsData, notifData] = await Promise.all([
        keywordsApi.getAll(),
        hotspotsApi.getAll(filterParams),
        hotspotsApi.getStats(),
        notificationsApi.getAll({ limit: 20 }),
      ]);

      setKeywords(keywordsData);
      setHotspots(hotspotsData.data);
      setTotalPages(hotspotsData.pagination.totalPages);
      setStats(statsData);
      setNotifications(notifData.data);
      setUnreadCount(notifData.unreadCount);

      const activeKeywords = keywordsData.filter((item) => item.isActive).map((item) => item.text);
      if (activeKeywords.length > 0) {
        subscribeToKeywords(activeKeywords);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      showToast('加载数据失败，请稍后重试', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, dashboardFilters]);

  useEffect(() => {
    setCurrentPage(1);
  }, [dashboardFilters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const unsubHotspot = onNewHotspot((hotspot) => {
      setHotspots((prev) => [hotspot as Hotspot, ...prev.slice(0, 19)]);
      showToast(`检测到新热点：${hotspot.title.slice(0, 24)}`, 'success');
      loadData();
    });

    const unsubNotif = onNotification(() => {
      setUnreadCount((prev) => prev + 1);
    });

    return () => {
      unsubHotspot();
      unsubNotif();
    };
  }, [loadData]);

  const handleAddKeyword = async (event: FormEvent) => {
    event.preventDefault();
    if (!newKeyword.trim()) return;

    try {
      const keyword = await keywordsApi.create({ text: newKeyword.trim() });
      setKeywords((prev) => [keyword, ...prev]);
      setNewKeyword('');
      showToast('关键词已添加', 'success');
      subscribeToKeywords([keyword.text]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '添加失败，请稍后重试';
      showToast(message, 'error');
    }
  };

  const handleDeleteKeyword = async (id: string) => {
    try {
      await keywordsApi.delete(id);
      setKeywords((prev) => prev.filter((item) => item.id !== id));
      showToast('关键词已删除', 'success');
    } catch (error) {
      console.error('Failed to delete keyword:', error);
      showToast('删除失败，请稍后重试', 'error');
    }
  };

  const handleToggleKeyword = async (id: string) => {
    try {
      const updated = await keywordsApi.toggle(id);
      setKeywords((prev) => prev.map((item) => (item.id === id ? updated : item)));
    } catch (error) {
      console.error('Failed to toggle keyword:', error);
      showToast('更新失败，请稍后重试', 'error');
    }
  };

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault();
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    try {
      const result = await hotspotsApi.search(searchQuery.trim());
      setSearchResults(result.results);
      showToast(`搜索完成，共 ${result.results.length} 条结果`, 'success');
    } catch (error) {
      console.error('Search failed:', error);
      showToast('搜索失败，请稍后重试', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualCheck = async () => {
    setIsChecking(true);
    try {
      await triggerHotspotCheck();
      showToast('已触发热点扫描', 'success');
      setTimeout(loadData, 5000);
    } catch (error) {
      console.error('Manual check failed:', error);
      showToast('触发扫描失败', 'error');
    } finally {
      setIsChecking(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    } catch (error) {
      console.error('Failed to mark notifications read:', error);
      showToast('标记已读失败', 'error');
    }
  };

  const toggleReason = (id: string) => {
    setExpandedReasons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleContent = (id: string) => {
    setExpandedContents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllReasons = (list: Hotspot[]) => {
    if (allReasonsExpanded) {
      setExpandedReasons(new Set());
    } else {
      setExpandedReasons(new Set(list.filter((item) => item.relevanceReason).map((item) => item.id)));
    }
    setAllReasonsExpanded(!allReasonsExpanded);
  };

  const filteredSearchResults = useMemo(() => {
    let result = [...searchResults];

    if (searchFilters.source) {
      result = result.filter((item) => item.source === searchFilters.source);
    }
    if (searchFilters.importance) {
      result = result.filter((item) => item.importance === searchFilters.importance);
    }
    if (searchFilters.isReal === 'true') {
      result = result.filter((item) => item.isReal);
    }
    if (searchFilters.isReal === 'false') {
      result = result.filter((item) => !item.isReal);
    }
    if (searchFilters.keywordId) {
      result = result.filter((item) => item.keyword?.id === searchFilters.keywordId);
    }
    if (searchFilters.timeRange) {
      const now = new Date();
      let dateFrom: Date | null = null;

      if (searchFilters.timeRange === '1h') dateFrom = new Date(now.getTime() - 60 * 60 * 1000);
      if (searchFilters.timeRange === 'today') {
        dateFrom = new Date(now);
        dateFrom.setHours(0, 0, 0, 0);
      }
      if (searchFilters.timeRange === '7d') dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (searchFilters.timeRange === '30d') dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      if (dateFrom) {
        result = result.filter((item) => new Date(item.createdAt) >= dateFrom);
      }
    }

    return sortHotspots(result, searchFilters.sortBy || 'createdAt', (searchFilters.sortOrder || 'desc') as 'asc' | 'desc');
  }, [searchResults, searchFilters]);

  const renderHotspotCard = (hotspot: Hotspot, index: number) => {
    const heatScore = calcHeatScore(hotspot);
    const reasonOpened = expandedReasons.has(hotspot.id);
    const contentOpened = expandedContents.has(hotspot.id);

    return (
      <motion.article
        key={hotspot.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, delay: index * 0.02 }}
        className="rounded-[12px] border border-[#e5e5e5] bg-white p-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-[9999px] border border-[#d4d4d4] bg-[#fafafa] px-3 py-1 text-[#525252]">
                {getSourceIcon(hotspot.source)}
                {getSourceLabel(hotspot.source)}
              </span>
              <span className="rounded-[9999px] border border-[#d4d4d4] bg-[#fafafa] px-3 py-1 text-[#525252]">
                重要度 {getImportanceLabel(hotspot.importance)}
              </span>
              <span className="rounded-[9999px] border border-[#d4d4d4] bg-[#fafafa] px-3 py-1 text-[#525252]">
                真实性 {hotspot.isReal ? '真实' : '疑似噪声'}
              </span>
              <span className="rounded-[9999px] border border-[#d4d4d4] bg-[#fafafa] px-3 py-1 text-[#525252]">热度 {heatScore}</span>
            </div>

            <h3 className="text-[19px] font-medium leading-[1.4] text-black">{hotspot.title}</h3>

            {hotspot.summary && <p className="mt-2 text-sm leading-6 text-[#525252]">{hotspot.summary}</p>}

            {hotspot.authorName && (
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-[#737373]">
                <User className="h-3.5 w-3.5" />
                {hotspot.authorName}
                {hotspot.authorVerified ? ' · 已认证' : ''}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#737373]">
              <span className="inline-flex items-center gap-1">
                <Target className="h-3.5 w-3.5" />
                相关度 {hotspot.relevance}%
              </span>
              {hotspot.likeCount != null && hotspot.likeCount > 0 && (
                <span className="inline-flex items-center gap-1" title="点赞数">
                  <Zap className="h-3.5 w-3.5" />
                  {hotspot.likeCount.toLocaleString()}
                </span>
              )}
              {hotspot.viewCount != null && hotspot.viewCount > 0 && (
                <span className="inline-flex items-center gap-1" title="浏览量">
                  <Eye className="h-3.5 w-3.5" />
                  {hotspot.viewCount.toLocaleString()}
                </span>
              )}
              {hotspot.publishedAt && (
                <span className="inline-flex items-center gap-1" title={formatDateTime(hotspot.publishedAt)}>
                  <Clock className="h-3.5 w-3.5" />
                  发布 {relativeTime(hotspot.publishedAt)}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Activity className="h-3.5 w-3.5" />
                抓取 {relativeTime(hotspot.createdAt)}
              </span>
            </div>

            {hotspot.relevanceReason && (
              <div className="mt-3">
                <button
                  onClick={() => toggleReason(hotspot.id)}
                  className="inline-flex items-center gap-1 text-xs text-[#525252] underline-offset-2 hover:underline"
                >
                  {reasonOpened ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  AI 相关性解释
                </button>
                {reasonOpened && <p className="mt-2 rounded-[12px] border border-[#e5e5e5] bg-[#fafafa] p-3 text-xs leading-5 text-[#525252]">{hotspot.relevanceReason}</p>}
              </div>
            )}

            {hotspot.content && hotspot.content !== hotspot.summary && (
              <div className="mt-3">
                <button
                  onClick={() => toggleContent(hotspot.id)}
                  className="inline-flex items-center gap-1 text-xs text-[#525252] underline-offset-2 hover:underline"
                >
                  {contentOpened ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  <FileText className="h-3.5 w-3.5" />
                  原文片段
                </button>
                {contentOpened && (
                  <p className="mt-2 max-h-44 overflow-auto rounded-[12px] border border-[#e5e5e5] bg-[#fafafa] p-3 text-xs leading-5 text-[#525252]">
                    {hotspot.content}
                  </p>
                )}
              </div>
            )}
          </div>

          <a
            href={hotspot.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded-[9999px] border border-[#d4d4d4] bg-white px-3 py-1.5 text-xs text-[#404040] transition-colors hover:bg-[#fafafa]"
          >
            打开来源
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </motion.article>
    );
  };

  return (
    <div className="min-h-screen bg-white text-black">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.18 }}
            className={cn(
              'fixed left-1/2 top-5 z-[60] rounded-[9999px] border px-4 py-2 text-sm',
              toast.type === 'success' ? 'border-[#d4d4d4] bg-white text-black' : 'border-black bg-black text-white'
            )}
          >
            <span className="inline-flex items-center gap-1">
              {toast.type === 'success' ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
              {toast.message}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="sticky top-0 z-50 border-b border-[#262626] bg-black text-white">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-[12px] border border-[#525252] bg-[#090909]">
              <Activity className="h-4 w-4 text-[#fafafa]" />
            </div>
            <div className="leading-tight">
              <h1 className="text-[16px] font-medium tracking-[-0.01em]">BottleFind</h1>
              <p className="text-[11px] text-[#a3a3a3]">热点监控控制台</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleManualCheck}
              disabled={isChecking}
              className="inline-flex h-8 items-center gap-1 rounded-[9999px] border border-[#525252] bg-[#090909] px-3 text-xs transition-colors hover:bg-[#111111] disabled:cursor-wait disabled:opacity-70"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isChecking && 'animate-spin')} />
              {isChecking ? '扫描中' : '立即扫描'}
            </button>

            <div className="relative">
              <button
                onClick={() => setShowNotifications((prev) => !prev)}
                className="inline-flex h-8 items-center gap-1 rounded-[9999px] border border-[#525252] bg-[#090909] px-3 text-xs transition-colors hover:bg-[#111111]"
              >
                <Bell className="h-3.5 w-3.5" />
                通知
                {unreadCount > 0 ? <span>({unreadCount > 99 ? '99+' : unreadCount})</span> : null}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.16 }}
                    className="absolute right-0 top-10 z-50 w-[330px] rounded-[12px] border border-[#e5e5e5] bg-white p-3 text-black"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-medium">消息中心</p>
                      {unreadCount > 0 && (
                        <button onClick={handleMarkAllRead} className="rounded-[9999px] border border-[#d4d4d4] px-3 py-1 text-xs text-[#404040] hover:bg-[#fafafa]">
                          全部已读
                        </button>
                      )}
                    </div>
                    <div className="max-h-72 space-y-2 overflow-auto">
                      {notifications.length === 0 ? (
                        <p className="rounded-[12px] border border-[#e5e5e5] bg-[#fafafa] p-3 text-xs text-[#737373]">暂无通知</p>
                      ) : (
                        notifications.slice(0, 8).map((item) => (
                          <article
                            key={item.id}
                            className={cn(
                              'rounded-[12px] border border-[#e5e5e5] p-3 text-xs',
                              item.isRead ? 'bg-white text-[#737373]' : 'bg-[#fafafa] text-[#404040]'
                            )}
                          >
                            <p className="font-medium">{item.title}</p>
                            <p className="mt-1 line-clamp-2">{item.content}</p>
                          </article>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <nav className="mb-6 flex flex-wrap items-center gap-2">
          {(
            [
              { key: 'dashboard', label: '热点看板', icon: Activity },
              { key: 'keywords', label: '关键词管理', icon: Target },
              { key: 'search', label: '全网搜索', icon: Search },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                'inline-flex h-9 items-center gap-1 rounded-[9999px] border px-4 text-sm transition-colors',
                activeTab === key
                  ? 'border-black bg-black text-white'
                  : 'border-[#d4d4d4] bg-white text-[#404040] hover:bg-[#fafafa]'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>

        {activeTab === 'dashboard' && (
          <section className="space-y-6">
            {stats && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: '总热点', value: stats.total },
                  { label: '今日新增', value: stats.today },
                  { label: '紧急级别', value: stats.urgent },
                  { label: '监控关键词', value: keywords.filter((item) => item.isActive).length },
                ].map((item) => (
                  <article key={item.label} className="rounded-[12px] border border-[#e5e5e5] bg-[#fafafa] p-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-[#737373]">{item.label}</p>
                    <p className="mt-2 text-2xl font-medium tracking-[-0.01em]">{item.value}</p>
                  </article>
                ))}
              </div>
            )}

            <FilterSortBar filters={dashboardFilters} onChange={setDashboardFilters} keywords={keywords} />

            <section className="space-y-3">
              {hotspots.length > 0 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-[#737373]">当前页 {hotspots.length} 条热点</p>
                  <button
                    onClick={() => toggleAllReasons(hotspots)}
                    className="rounded-[9999px] border border-[#d4d4d4] px-3 py-1 text-xs text-[#404040] hover:bg-[#fafafa]"
                  >
                    {allReasonsExpanded ? '收起全部 AI 解释' : '展开全部 AI 解释'}
                  </button>
                </div>
              )}

              {isLoading && hotspots.length === 0 && (
                <p className="rounded-[12px] border border-[#e5e5e5] bg-[#fafafa] p-4 text-sm text-[#737373]">正在加载热点数据...</p>
              )}

              {!isLoading && hotspots.length === 0 && (
                <p className="rounded-[12px] border border-[#e5e5e5] bg-[#fafafa] p-4 text-sm text-[#737373]">暂无符合条件的热点数据</p>
              )}

              {hotspots.map((hotspot, index) => renderHotspotCard(hotspot, index))}
            </section>

            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage <= 1}
                  className="inline-flex h-8 items-center justify-center rounded-[9999px] border border-[#d4d4d4] bg-white px-3 text-xs text-[#404040] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>

                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let pageNumber = i + 1;
                  if (totalPages > 7) {
                    if (currentPage <= 4) pageNumber = i + 1;
                    else if (currentPage >= totalPages - 3) pageNumber = totalPages - 6 + i;
                    else pageNumber = currentPage - 3 + i;
                  }

                  return (
                    <button
                      key={pageNumber}
                      onClick={() => setCurrentPage(pageNumber)}
                      className={cn(
                        'inline-flex h-8 min-w-8 items-center justify-center rounded-[9999px] border px-3 text-xs',
                        currentPage === pageNumber
                          ? 'border-black bg-black text-white'
                          : 'border-[#d4d4d4] bg-white text-[#404040] hover:bg-[#fafafa]'
                      )}
                    >
                      {pageNumber}
                    </button>
                  );
                })}

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage >= totalPages}
                  className="inline-flex h-8 items-center justify-center rounded-[9999px] border border-[#d4d4d4] bg-white px-3 text-xs text-[#404040] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </section>
        )}

        {activeTab === 'keywords' && (
          <section className="space-y-6">
            <form onSubmit={handleAddKeyword} className="rounded-[12px] border border-[#e5e5e5] bg-[#fafafa] p-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(event) => setNewKeyword(event.target.value)}
                  placeholder="输入要监控的关键词，例如 GPT-5、AI 搜索、模型开源..."
                  className="h-10 flex-1 rounded-[9999px] border border-[#d4d4d4] bg-white px-4 text-sm text-black outline-none transition-colors focus:border-[#a3a3a3]"
                />
                <button
                  type="submit"
                  className="inline-flex h-10 items-center justify-center gap-1 rounded-[9999px] border border-black bg-black px-4 text-sm text-white transition-colors hover:bg-[#090909]"
                >
                  <Plus className="h-4 w-4" />
                  添加关键词
                </button>
              </div>
            </form>

            {keywords.length === 0 && (
              <p className="rounded-[12px] border border-[#e5e5e5] bg-[#fafafa] p-4 text-sm text-[#737373]">
                还没有监控关键词。先添加一个关键词，BottleFind 会开始跟踪相关热点。
              </p>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              {keywords.map((keyword) => (
                <article key={keyword.id} className="rounded-[12px] border border-[#e5e5e5] bg-white p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-base font-medium">{keyword.text}</p>
                      <p className="mt-1 text-xs text-[#737373]">
                        状态：{keyword.isActive ? '监控中' : '已暂停'}
                        {keyword._count ? ` · 已捕获 ${keyword._count.hotspots} 条` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteKeyword(keyword.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-[9999px] border border-[#d4d4d4] text-[#525252] hover:bg-[#fafafa]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="mt-3">
                    <button
                      onClick={() => handleToggleKeyword(keyword.id)}
                      className={cn(
                        'inline-flex h-8 items-center rounded-[9999px] border px-3 text-xs',
                        keyword.isActive
                          ? 'border-black bg-black text-white'
                          : 'border-[#d4d4d4] bg-white text-[#404040] hover:bg-[#fafafa]'
                      )}
                    >
                      {keyword.isActive ? '暂停监控' : '恢复监控'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'search' && (
          <section className="space-y-6">
            <form onSubmit={handleSearch} className="rounded-[12px] border border-[#e5e5e5] bg-[#fafafa] p-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737373]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="搜索关键词、事件、作者或站点"
                    className="h-10 w-full rounded-[9999px] border border-[#d4d4d4] bg-white pl-10 pr-4 text-sm text-black outline-none transition-colors focus:border-[#a3a3a3]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex h-10 items-center justify-center gap-1 rounded-[9999px] border border-black bg-black px-4 text-sm text-white transition-colors hover:bg-[#090909] disabled:cursor-wait disabled:opacity-70"
                >
                  {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {isLoading ? '搜索中' : '开始搜索'}
                </button>
              </div>
            </form>

            <FilterSortBar filters={searchFilters} onChange={setSearchFilters} keywords={keywords} />

            {searchResults.length === 0 && (
              <p className="rounded-[12px] border border-[#e5e5e5] bg-[#fafafa] p-4 text-sm text-[#737373]">
                输入关键词后，BottleFind 将聚合多源热点并给出相关度排序。
              </p>
            )}

            {searchResults.length > 0 && filteredSearchResults.length === 0 && (
              <p className="rounded-[12px] border border-[#e5e5e5] bg-[#fafafa] p-4 text-sm text-[#737373]">当前筛选条件下没有结果，请调整筛选后重试。</p>
            )}

            <section className="space-y-3">{filteredSearchResults.map((hotspot, index) => renderHotspotCard(hotspot, index))}</section>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
