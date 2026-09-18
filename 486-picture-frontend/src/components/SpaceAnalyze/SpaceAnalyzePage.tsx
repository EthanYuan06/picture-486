import React, { useEffect, useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { spaceAnalyzeService } from '../../services/spaceAnalyze';
import { SpaceUsageAnalyzeResponse, SpaceCategoryAnalyzeResponse, SpaceTagAnalyzeResponse, SpaceSizeAnalyzeResponse, SpaceUserAnalyzeResponse } from '../../types/spaceAnalyze';
import { formatSize } from '../../utils/file';
import { BarChart3, PieChart, TrendingUp, Database, Image as ImageIcon, HardDrive, Users } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';

// --- Sub-components ---

const UsageCard: React.FC<{ title: string; value: string | number; subValue?: string; icon: React.ReactNode; color: string }> = ({ title, value, subValue, icon, color }) => (
  <div className="relative overflow-hidden rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-6 shadow-sm hover:shadow-md transition-all duration-300 group dark:bg-white/5 dark:border-white/10 dark:backdrop-blur-sm">
    <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 blur-xl ${color}`}></div>
    <div className="flex justify-between items-start relative z-10">
      <div>
        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-1 dark:text-white/60">{title}</h3>
        <div className="text-2xl font-bold text-[var(--text-primary)] tracking-tight dark:text-white">{value}</div>
        {subValue && <div className="text-xs text-[var(--text-secondary)] mt-2 opacity-80 dark:text-white/40">{subValue}</div>}
      </div>
      <div className={`p-3 rounded-xl bg-[var(--bg-hover)] text-[var(--text-primary)] group-hover:scale-110 transition-transform duration-300 dark:bg-white/5 dark:text-white/80`}>
        {icon}
      </div>
    </div>
  </div>
);

const SectionTitle: React.FC<{ title: string; icon: React.ReactNode }> = ({ title, icon }) => (
  <div className="flex items-center gap-2 mb-6">
    <div className="p-2 rounded-lg bg-primary/20 text-primary">
      {icon}
    </div>
    <h2 className="text-lg font-semibold text-[var(--text-primary)] dark:text-white/90">{title}</h2>
  </div>
);

const EChartsBarChart: React.FC<{ data: { label: string; value: number }[]; color?: string }> = ({ data, color = '#6217d7' }) => {
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderRadius: 8,
      padding: [8, 12],
      textStyle: { color: '#333' }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: data.map(item => item.label),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#888', rotate: 45, interval: 0 }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { type: 'dashed', color: '#eee' } }
    },
    series: [
      {
        data: data.map(item => item.value),
        type: 'bar',
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: color
        },
        barMaxWidth: 40
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '300px', width: '100%' }} />;
};

const EChartsPieChart: React.FC<{ data: { label: string; value: number }[] }> = ({ data }) => {
  const option = {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderRadius: 8,
      padding: [8, 12],
      textStyle: { color: '#333' }
    },
    legend: {
      bottom: '0%',
      left: 'center',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: '#888' }
    },
    series: [
      {
        name: '分布',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 20,
            fontWeight: 'bold',
            formatter: '{b}\n{d}%'
          }
        },
        labelLine: {
          show: false
        },
        data: data.map(item => ({ name: item.label, value: item.value }))
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '300px', width: '100%' }} />;
};


const TagCloud: React.FC<{ tags: SpaceTagAnalyzeResponse[] }> = ({ tags }) => {
  const maxCount = Math.max(...tags.map(t => t.count), 1);
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag, idx) => {
        const opacity = 0.4 + (tag.count / maxCount) * 0.6;
        return (
          <span
            key={idx}
            className="px-3 py-1.5 rounded-lg bg-[var(--bg-hover)] border border-[var(--border-color)] text-sm hover:bg-primary/20 hover:border-primary/30 transition-colors cursor-default dark:bg-white/5 dark:border-white/10"
            title={`使用次数: ${tag.count}`}
          >
             <span className="text-[var(--text-primary)] dark:text-white" style={{ opacity: 0.6 + (tag.count/maxCount) * 0.4 }}>
               {tag.tag}
             </span>
            <span className="ml-1.5 text-xs text-[var(--text-secondary)] opacity-70 dark:text-white/50">{tag.count}</span>
          </span>
        );
      })}
    </div>
  );
};

// --- Main Page ---

const SpaceAnalyzePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'public' | 'all_space'>('public');
  const [loading, setLoading] = useState(false);
  const { userInfo } = useAuthStore();
  const isAdmin = userInfo?.roles?.includes('admin');

  // Data States
  const [usage, setUsage] = useState<SpaceUsageAnalyzeResponse | null>(null);
  const [categories, setCategories] = useState<SpaceCategoryAnalyzeResponse[]>([]);
  const [tags, setTags] = useState<SpaceTagAnalyzeResponse[]>([]);
  const [sizes, setSizes] = useState<SpaceSizeAnalyzeResponse[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const req = {
        queryPublic: activeTab === 'public',
        queryAll: activeTab === 'all_space',
      };

      const [usageRes, catRes, tagRes, sizeRes] = await Promise.all([
        spaceAnalyzeService.getUsageAnalyze(req),
        spaceAnalyzeService.getCategoryAnalyze(req),
        spaceAnalyzeService.getTagAnalyze(req),
        spaceAnalyzeService.getSizeAnalyze(req),
      ]);

      if (usageRes.code === 0) setUsage(usageRes.data);
      if (catRes.code === 0) setCategories(catRes.data);
      if (tagRes.code === 0) setTags(tagRes.data);
      if (sizeRes.code === 0) setSizes(sizeRes.data);

    } catch (error) {
      console.error("Failed to fetch analysis data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 pb-20">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2 dark:text-white">资源分析</h1>
          <p className="text-[var(--text-secondary)] text-sm dark:text-white/40">监控系统资源使用情况与数据分布</p>
        </div>
        
        {isAdmin && (
          <div className="flex p-1 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] dark:bg-white/5 dark:border-white/10">
            <button
              onClick={() => setActiveTab('public')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'public' ? 'bg-primary text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] dark:text-white/60 dark:hover:text-white'
              }`}
            >
              公共图库
            </button>
            <button
              onClick={() => setActiveTab('all_space')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'all_space' ? 'bg-primary text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] dark:text-white/60 dark:hover:text-white'
              }`}
            >
              全部相册
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
          
          {/* 1. Usage Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <UsageCard
              title="已用存储空间"
              value={usage ? formatSize(usage.usedSize) : '-'}
              subValue="无上限限制"
              icon={<HardDrive size={24} />}
              color="bg-blue-500"
            />
            <UsageCard
              title="当前图片数量"
              value={usage ? usage.usedCount : '-'}
              subValue="张图片"
              icon={<ImageIcon size={24} />}
              color="bg-purple-500"
            />
             <UsageCard
              title="分类总数"
              value={categories.length}
              subValue="活跃分类"
              icon={<PieChart size={24} />}
              color="bg-emerald-500"
            />
             <UsageCard
              title="标签总数"
              value={tags.length}
              subValue="活跃标签"
              icon={<Database size={24} />}
              color="bg-orange-500"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* 2. Category Analysis */}
            <div className="lg:col-span-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 shadow-sm dark:bg-white/5 dark:border-white/10 dark:backdrop-blur-sm">
              <SectionTitle title="分类（Top 10）" icon={<PieChart size={20} />} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                   <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-4 dark:text-white/60">按图片数量</h4>
                   <EChartsBarChart 
                     data={categories
                       .sort((a, b) => b.count - a.count)
                       .slice(0, 10)
                       .map(c => ({ label: c.category || '未分类', value: c.count }))
                     } 
                     color="#3b82f6"
                   />
                </div>
                <div>
                   <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-4 dark:text-white/60">按占用空间 (MB)</h4>
                   <EChartsBarChart 
                     data={categories
                       .sort((a, b) => b.totalSize - a.totalSize)
                       .slice(0, 10)
                       .map(c => ({ label: c.category || '未分类', value: parseFloat((c.totalSize / 1024 / 1024).toFixed(2)) }))
                     } 
                     color="#8b5cf6"
                   />
                </div>
              </div>
            </div>

            {/* 3. Size Distribution - Pie Chart */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 shadow-sm dark:bg-white/5 dark:border-white/10 dark:backdrop-blur-sm">
              <SectionTitle title="图片体积分布" icon={<BarChart3 size={20} />} />
              <EChartsPieChart 
                 data={sizes.map(s => ({ label: s.sizeRange, value: s.count }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Tag Cloud */}
            <div className="lg:col-span-3 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 shadow-sm dark:bg-white/5 dark:border-white/10 dark:backdrop-blur-sm">
              <div className="flex flex-col h-full">
                <SectionTitle title="热门标签" icon={<TrendingUp size={20} />} />
                <div className="flex-1">
                  {tags.length > 0 ? (
                    <TagCloud tags={tags} />
                  ) : (
                    <div className="text-center text-[var(--text-secondary)] py-10 dark:text-white/40">暂无标签数据</div>
                  )}
                </div>
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
};

export default SpaceAnalyzePage;
