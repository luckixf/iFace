---
id: perf-040
module: 性能优化
difficulty: 2
tags: [Core Web Vitals, LCP, INP, CLS]
source: 高频
---
## 题目
什么是 Core Web Vitals？LCP、INP、CLS 分别代表什么？如何优化？

## 答案
## Core Web Vitals

Google 定义的三个核心用户体验指标，直接影响 SEO 排名。

### LCP（Largest Contentful Paint，最大内容绘制）
```
衡量：视口内最大元素（图片/视频/文本块）的渲染时间
目标：< 2.5s（Good），2.5-4s（Needs Improvement），> 4s（Poor）

常见最大元素：hero 图片、首屏大图、H1 标题块
```

优化方法：
```html
<!-- 1. preload 关键图片 -->
<link rel="preload" href="/hero.jpg" as="image" fetchpriority="high">

<!-- 2. 不要懒加载首屏图片 -->
<img src="/hero.jpg" loading="eager" fetchpriority="high">

<!-- 3. 使用现代图片格式 -->
<picture>
  <source srcset="/hero.avif" type="image/avif">
  <source srcset="/hero.webp" type="image/webp">
  <img src="/hero.jpg">
</picture>
```
```
4. 优化服务器响应时间（TTFB < 800ms）
5. 消除渲染阻塞资源（CSS/JS defer）
6. 使用 CDN 加速图片
```

### INP（Interaction to Next Paint，交互延迟）
```
衡量：用户交互（点击/键盘）到下一帧绘制的延迟
目标：< 200ms（Good），200-500ms（Needs Improvement），> 500ms（Poor）
替代了旧的 FID（First Input Delay）
```

优化方法：
```js
// 1. 避免长任务（Long Task > 50ms）
// 使用 scheduler.yield() 分片
async function processLargeList(items) {
  for (let i = 0; i < items.length; i++) {
    process(items[i]);
    if (i % 50 === 0) await scheduler.yield(); // 让出主线程
  }
}

// 2. 非紧急更新推迟
import { startTransition } from 'react';
startTransition(() => setSearchResults(results));

// 3. Web Worker 处理计算密集任务
```

### CLS（Cumulative Layout Shift，累积布局偏移）
```
衡量：页面生命周期内所有意外布局偏移的累积分数
目标：< 0.1（Good），0.1-0.25（Needs Improvement），> 0.25（Poor）
```

优化方法：
```html
<!-- 1. 图片/视频预留空间 -->
<img src="image.jpg" width="800" height="600" style="aspect-ratio: 4/3">

<!-- 2. 广告/嵌入内容预留空间 -->
<div style="min-height: 250px">
  <ins class="adsbygoogle" ...></ins>
</div>
```
```css
/* 3. 避免插入内容导致偏移 */
/* 4. 字体使用 font-display: optional 避免字体替换偏移 */
@font-face { font-display: optional; }

/* 5. 动画只用 transform/opacity（不触发布局）*/
.expand { transform: scaleY(1.2); } /* 不会 CLS */
/* .expand { height: 200px; } 会造成 CLS */
```

---
id: perf-041
module: 性能优化
difficulty: 2
tags: [图片优化, WebP, AVIF, 懒加载]
source: 高频
---
## 题目
前端图片优化有哪些手段？

## 答案
## 图片优化策略

### 1. 选择合适格式
```
JPEG：照片类图片，有损压缩，不支持透明
PNG：需要透明通道，无损压缩，体积较大
GIF：动图，颜色限 256，已过时
WebP：比 JPEG 小 25-35%，支持透明和动图，Chrome/Safari/Firefox 全支持
AVIF：比 WebP 再小 20%，压缩质量更好，兼容性稍差（Chrome 85+）
SVG：矢量图，无限缩放，适合图标/Logo
```

```html
<!-- 渐进式格式支持 -->
<picture>
  <source srcset="image.avif" type="image/avif">
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg" alt="描述">
</picture>
```

### 2. 响应式图片
```html
<!-- 根据视口宽度加载不同尺寸 -->
<img
  srcset="image-400.webp 400w, image-800.webp 800w, image-1200.webp 1200w"
  sizes="(max-width: 600px) 400px, (max-width: 900px) 800px, 1200px"
  src="image-800.webp"
  alt="响应式图片">
```

### 3. 懒加载
```html
<!-- 原生懒加载（推荐）-->
<img src="image.jpg" loading="lazy" decoding="async">

<!-- 首屏图片不懒加载 -->
<img src="hero.jpg" loading="eager" fetchpriority="high">
```

```js
// Intersection Observer 自定义懒加载
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const img = entry.target;
      img.src = img.dataset.src;
      observer.unobserve(img);
    }
  });
}, { rootMargin: '200px' }); // 提前 200px 开始加载

document.querySelectorAll('img[data-src]').forEach(img => observer.observe(img));
```

### 4. CDN + 图片处理服务
```
Cloudinary、Imgix 等服务支持：
- 实时裁剪（crop）
- 格式转换（format=auto）
- 质量压缩（quality=80）
- 尺寸调整（width=800）

URL 示例：https://cdn.example.com/image.jpg?w=800&q=80&f=webp
```

### 5. 体积优化工具
```
工具链：sharp（Node.js）、imagemin、squoosh
构建集成：vite-imagetools、image-webpack-loader
```

---
id: perf-042
module: 性能优化
difficulty: 2
tags: [代码分割, 懒加载, dynamic import, React]
source: 高频
---
## 题目
什么是代码分割（Code Splitting）？如何在 React 项目中实现？

## 答案
## 代码分割

### 为什么需要代码分割
```
单页应用打包后 bundle 可能很大（数 MB），
用户首屏只需要当前路由的代码，
其余代码按需加载可显著减少首屏体积。
```

### 方案1：React.lazy + Suspense（路由级分割）
```jsx
import React, { Suspense, lazy } from 'react';

// 动态导入，webpack/vite 自动分割为独立 chunk
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings  = lazy(() => import('./pages/Settings'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings"  element={<Settings />} />
      </Routes>
    </Suspense>
  );
}
```

### 方案2：组件级分割（按条件加载）
```jsx
const HeavyChart = lazy(() => import('./HeavyChart'));

function Dashboard({ showChart }) {
  return (
    <div>
      {showChart && (
        <Suspense fallback={<Skeleton />}>
          <HeavyChart />
        </Suspense>
      )}
    </div>
  );
}
```

### 方案3：动态 import（原生）
```js
// 点击时才加载
button.onclick = async () => {
  const { default: module } = await import('./heavy-module.js');
  module.run();
};

// 预取（鼠标 hover 时）
button.onmouseenter = () => import('./heavy-module.js');
```

### Vite 配置手动分割
```js
// vite.config.ts
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          chart: ['echarts'],
          utils: ['lodash', 'dayjs'],
        }
      }
    }
  }
}
```

### 分析 Bundle 体积
```bash
# vite-bundle-visualizer
npx vite-bundle-visualizer

# webpack-bundle-analyzer
npx webpack-bundle-analyzer stats.json
```

---
id: perf-043
module: 性能优化
difficulty: 2
tags: [虚拟列表, 长列表, 性能]
source: 高频
---
## 题目
什么是虚拟列表（Virtual List）？如何实现？

## 答案
## 虚拟列表

### 问题背景
```
渲染 10000 条列表：
- DOM 节点数量巨大，内存占用高
- 滚动时重排重绘开销极大
- 首次渲染慢

虚拟列表：只渲染可见区域的 DOM 节点（通常 20-30 个），
其余用占位填充滚动条，滚动时动态替换内容。
```

### 固定高度虚拟列表实现
```jsx
import { useState, useRef, useCallback } from 'react';

function VirtualList({ items, itemHeight = 50, containerHeight = 400 }) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef(null);

  const totalHeight = items.length * itemHeight;
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(startIndex + visibleCount + 1, items.length);

  // 可见区域的数据
  const visibleItems = items.slice(startIndex, endIndex);
  // 顶部偏移（撑开上方空白）
  const offsetY = startIndex * itemHeight;

  const onScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={onScroll}
    >
      {/* 总高度撑开滚动条 */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {/* 可见区域偏移 */}
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, i) => (
            <div key={startIndex + i} style={{ height: itemHeight }}>
              {item.content}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### 生产环境推荐库
```bash
# react-virtual（TanStack Virtual）
npm install @tanstack/react-virtual

# react-window（轻量）
npm install react-window

# react-virtuoso（支持动态高度）
npm install react-virtuoso
```

```jsx
// react-window 示例
import { FixedSizeList } from 'react-window';

const Row = ({ index, style }) => (
  <div style={style}>Row {index}</div>
);

<FixedSizeList
  height={400}
  width={600}
  itemCount={10000}
  itemSize={50}
>
  {Row}
</FixedSizeList>
```

---
id: perf-044
module: 性能优化
difficulty: 3
tags: [性能监控, PerformanceObserver, Web Vitals]
source: 高频
---
## 题目
如何在前端代码中采集性能指标？PerformanceObserver 怎么用？

## 答案
## 前端性能指标采集

### Navigation Timing（页面加载时序）
```js
// Performance API
const nav = performance.getEntriesByType('navigation')[0];

console.log({
  // DNS 解析时间
  dns: nav.domainLookupEnd - nav.domainLookupStart,
  // TCP 连接时间
  tcp: nav.connectEnd - nav.connectStart,
  // TLS 时间
  tls: nav.secureConnectionStart > 0
    ? nav.connectEnd - nav.secureConnectionStart : 0,
  // TTFB（首字节时间）
  ttfb: nav.responseStart - nav.requestStart,
  // 资源下载时间
  download: nav.responseEnd - nav.responseStart,
  // DOM 解析时间
  domParse: nav.domInteractive - nav.responseEnd,
  // 页面完全加载
  load: nav.loadEventEnd - nav.startTime,
});
```

### PerformanceObserver（现代 API）
```js
// 观测 LCP
new PerformanceObserver((list) => {
  const entries = list.getEntries();
  const lcp = entries[entries.length - 1]; // 最后一个才是最终 LCP
  console.log('LCP:', lcp.startTime, lcp.element);
}).observe({ type: 'largest-contentful-paint', buffered: true });

// 观测 CLS
let clsValue = 0;
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (!entry.hadRecentInput) { // 忽略用户交互引起的偏移
      clsValue += entry.value;
    }
  }
}).observe({ type: 'layout-shift', buffered: true });

// 观测 INP（长动画帧）
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration > 200) {
      console.warn('Long interaction:', entry.duration, entry);
    }
  }
}).observe({ type: 'event', buffered: true, durationThreshold: 100 });

// 观测资源加载
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration > 1000) {
      console.warn('Slow resource:', entry.name, entry.duration);
    }
  }
}).observe({ type: 'resource', buffered: true });
```

### 使用 web-vitals 库（推荐）
```js
import { onLCP, onINP, onCLS, onFCP, onTTFB } from 'web-vitals';

function sendToAnalytics({ name, value, rating, id }) {
  fetch('/api/metrics', {
    method: 'POST',
    body: JSON.stringify({ name, value, rating, id, url: location.href }),
    headers: { 'Content-Type': 'application/json' },
    keepalive: true // 页面卸载时也能发送
  });
}

onLCP(sendToAnalytics);
onINP(sendToAnalytics);
onCLS(sendToAnalytics);
onFCP(sendToAnalytics);
onTTFB(sendToAnalytics);
```

### 自定义性能标记
```js
// 测量某段代码耗时
performance.mark('start-render');
renderHeavyComponent();
performance.mark('end-render');
performance.measure('render-time', 'start-render', 'end-render');

const measure = performance.getEntriesByName('render-time')[0];
console.log('Render took:', measure.duration, 'ms');
```

---
id: perf-045
module: 性能优化
difficulty: 2
tags: [Tree Shaking, Bundle优化, Webpack, Vite]
source: 高频
---
## 题目
什么是 Tree Shaking？如何确保它正确工作？

## 答案
## Tree Shaking

### 概念
Tree Shaking 是打包工具在构建时删除未被引用代码（Dead Code）的优化技术，基于 ES Module 的静态分析。

### 前提条件
```
1. 使用 ES Module（import/export），不能用 CommonJS（require）
2. 代码没有副作用（side effects）
3. 生产模式打包（mode: 'production'）
```

### ES Module vs CommonJS
```js
// CommonJS（无法 Tree Shake）
const { add, subtract } = require('./math');
// require 是运行时动态执行，无法静态分析

// ES Module（可以 Tree Shake）
import { add } from './math'; // 只用了 add，subtract 会被删除
```

### 副作用声明
```json
// package.json
{
  "name": "my-lib",
  "sideEffects": false,  // 所有模块无副作用，可安全 Tree Shake
  // 或指定有副作用的文件
  "sideEffects": [
    "*.css",
    "*.scss",
    "./src/polyfills.js"
  ]
}
```

### 常见 Tree Shaking 失败原因
```js
// 1. 使用了 CommonJS
const utils = require('./utils'); // 整个模块被引入

// 2. 动态导入（无法静态分析）
const fn = require(`./plugins/${name}`);

// 3. 有副作用的导入
import './setup'; // 即使没用到，也不会被删除

// 4. 没有声明 sideEffects: false
// Webpack 保守策略：不确定就不删

// 5. 对象展开引入
import * as utils from './utils'; // 引入全部
utils.add(1, 2);
```

### 验证 Tree Shaking 效果
```js
// 使用 rollup-plugin-visualizer 或 webpack-bundle-analyzer
// 检查 bundle 中是否包含了未使用的代码

// source-map-explorer 分析具体模块大小
npx source-map-explorer 'build/static/js/*.js'
```

### 按需引入第三方库
```js
// 错误：引入整个 lodash（70KB+）
import _ from 'lodash';
_.debounce(fn, 300);

// 正确：只引入需要的函数
import debounce from 'lodash/debounce';
// 或使用 lodash-es（ES Module 版）
import { debounce } from 'lodash-es';
```

---
id: perf-046
module: 性能优化
difficulty: 2
tags: [防抖, 节流, 性能, 事件优化]
source: 高频
---
## 题目
防抖（debounce）和节流（throttle）的区别是什么？各自适合什么场景？

## 答案
## 防抖与节流

### 防抖（Debounce）
```
在事件停止触发 n 毫秒后才执行一次。
如果期间事件再次触发，重新计时。

关键特点：只执行最后一次
```

```js
function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

// 使用场景
const handleSearch = debounce((query) => {
  fetchResults(query); // 停止输入 300ms 后才搜索
}, 300);

input.addEventListener('input', (e) => handleSearch(e.target.value));
```

### 节流（Throttle）
```
在 n 毫秒内只执行一次，无论触发多少次。

关键特点：固定频率执行
```

```js
function throttle(fn, interval) {
  let lastTime = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastTime >= interval) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
}

// 使用场景
const handleScroll = throttle(() => {
  updateScrollProgress(); // 每 100ms 执行一次
}, 100);

window.addEventListener('scroll', handleScroll);
```

### 对比
```
防抖（Debounce）：
- 等停止后执行
- 适合：搜索框输入、窗口resize完成后、表单验证
- 特点：高频操作只触发最后一次

节流（Throttle）：
- 固定频率执行
- 适合：滚动监听、鼠标移动、游戏循环、按钮点击防连击
- 特点：保证一定时间内执行一次
```

### 立即执行版防抖（leading edge）
```js
function debounce(fn, delay, immediate = false) {
  let timer = null;
  return function (...args) {
    const callNow = immediate && !timer;
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (!immediate) fn.apply(this, args);
    }, delay);
    if (callNow) fn.apply(this, args);
  };
}
// immediate=true：第一次立即执行，之后防抖
```

---
id: perf-047
module: 性能优化
difficulty: 3
tags: [Web Worker, 多线程, 性能]
source: 高频
---
## 题目
Web Worker 是什么？如何用它优化性能？

## 答案
## Web Worker

### 概念
Web Worker 在独立线程中运行 JS 代码，不阻塞主线程（UI 线程），适合 CPU 密集型计算。

```
限制：
- 不能操作 DOM
- 不能访问 window/document
- 通过 postMessage 与主线程通信
- 可以使用 fetch、XMLHttpRequest、IndexedDB、localStorage
```

### 基本用法
```js
// main.js（主线程）
const worker = new Worker('/worker.js');

worker.postMessage({ type: 'compute', data: largeArray });

worker.onmessage = (e) => {
  console.log('Result:', e.data);
};

worker.onerror = (e) => {
  console.error('Worker error:', e.message);
};

// 用完销毁
worker.terminate();
```

```js
// worker.js（Worker 线程）
self.onmessage = (e) => {
  const { type, data } = e.data;
  if (type === 'compute') {
    const result = heavyComputation(data);
    self.postMessage(result);
  }
};

function heavyComputation(arr) {
  // 排序、加密、数据处理等 CPU 密集型操作
  return arr.sort((a, b) => a - b);
}
```

### Vite/webpack 中使用
```js
// Vite（内置支持）
const worker = new Worker(
  new URL('./worker.js', import.meta.url),
  { type: 'module' }
);
```

### Comlink（简化 Worker 通信）
```js
// worker.js
import { expose } from 'comlink';
const api = {
  async computeHash(data) {
    return await crypto.subtle.digest('SHA-256', data);
  }
};
expose(api);

// main.js
import { wrap } from 'comlink';
const worker = new Worker('./worker.js');
const api = wrap(worker);
const hash = await api.computeHash(data); // 像调用普通函数！
```

### 适用场景
```
- 图片处理（压缩、滤镜、格式转换）
- 大数据排序/过滤/计算
- 加密/解密
- JSON 大文件解析
- 实时数据流处理
- PDF 生成
```

---
id: perf-048
module: 性能优化
difficulty: 2
tags: [requestAnimationFrame, requestIdleCallback, 动画]
source: 高频
---
## 题目
requestAnimationFrame 和 requestIdleCallback 的区别和使用场景？

## 答案
## rAF 与 rIC

### requestAnimationFrame（rAF）
```
在浏览器下一次绘制前执行回调（通常 60fps = 每 16.67ms）
与屏幕刷新率同步，动画最流畅
```

```js
// 动画循环
function animate() {
  // 更新动画状态
  el.style.transform = `translateX(${x++}px)`;

  if (x < 300) {
    requestAnimationFrame(animate); // 继续下一帧
  }
}
requestAnimationFrame(animate);

// 取消
const id = requestAnimationFrame(animate);
cancelAnimationFrame(id);
```

```js
// 性能优化：避免在 rAF 内读取布局信息
// 不好：读写交替（布局抖动）
function bad() {
  requestAnimationFrame(() => {
    const width = el.offsetWidth; // 读（触发重排）
    el.style.width = width + 1 + 'px'; // 写
  });
}

// 好：先读后写
let cachedWidth = el.offsetWidth;
function good() {
  requestAnimationFrame(() => {
    el.style.width = cachedWidth + 1 + 'px'; // 只写
  });
}
```

### requestIdleCallback（rIC）
```
在浏览器空闲时执行回调（帧与帧之间的空余时间）
不能用于紧急任务，会被高优任务打断
```

```js
requestIdleCallback((deadline) => {
  // deadline.timeRemaining()：当前帧剩余时间（ms）
  // deadline.didTimeout：是否因超时强制执行
  while (deadline.timeRemaining() > 0 && tasks.length > 0) {
    doTask(tasks.shift()); // 利用空闲时间处理任务
  }
  if (tasks.length > 0) {
    requestIdleCallback(processQueue); // 还有任务，等下次空闲
  }
}, { timeout: 2000 }); // 最长等待 2s，超时强制执行
```

### 对比
```
特性                  rAF                    rIC
执行时机              每帧绘制前              帧间空闲时
执行频率              每帧（~60fps）          不固定，取决于负载
适用场景              动画、视觉更新          低优先级任务、数据上报
是否保证执行          每帧必执行              可能长时间不执行
Safari 支持           ✅                     ❌（需 polyfill）
```

### rIC polyfill
```js
// Safari 不支持 rIC，简单 polyfill
window.requestIdleCallback = window.requestIdleCallback || ((cb) => {
  return setTimeout(() => cb({
    timeRemaining: () => 50,
    didTimeout: false
  }), 1);
});
```

---
id: perf-049
module: 性能优化
difficulty: 3
tags: [内存泄漏, 内存管理, Chrome DevTools]
source: 高频
---
## 题目
前端内存泄漏有哪些常见原因？如何排查和修复？

## 答案
## 前端内存泄漏

### 常见原因

**1. 未清理的事件监听器**
```js
// 泄漏：组件卸载后监听器仍存在
function Component() {
  useEffect(() => {
    window.addEventListener('resize', handleResize); // 持有引用
    // 忘记返回清理函数！
  }, []);
}

// 修复
useEffect(() => {
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
```

**2. 未清理的定时器**
```js
// 泄漏
useEffect(() => {
  const timer = setInterval(fetchData, 1000);
  // 组件卸载后 timer 仍在运行，持有对 fetchData（和组件状态）的引用
}, []);

// 修复
useEffect(() => {
  const timer = setInterval(fetchData, 1000);
  return () => clearInterval(timer);
}, []);
```

**3. 闭包引用**
```js
// 泄漏：缓存了大对象的引用
function createHeavyObject() {
  const hugeData = new Array(1000000).fill('x');
  return {
    getValue: () => hugeData[0] // 闭包持有 hugeData
  };
}
const obj = createHeavyObject();
// 只要 obj.getValue 存在，hugeData 就不会被 GC
```

**4. 未清理的 Observer**
```js
// 泄漏
const observer = new IntersectionObserver(callback);
observer.observe(el);
// 组件卸载时忘记 disconnect

// 修复
useEffect(() => {
  const observer = new IntersectionObserver(callback);
  observer.observe(el.current);
  return () => observer.disconnect();
}, []);
```

**5. 全局变量意外增长**
```js
// 泄漏：全局数组持续增长
window.logs = [];
function log(msg) {
  window.logs.push(msg); // 永不清空
}
```

### Chrome DevTools 排查
```
1. 打开 DevTools → Memory 面板
2. 拍摄堆快照（Heap Snapshot）
3. 执行可能泄漏的操作
4. 再次拍摄快照
5. 对比两次快照，查看新增对象
6. 使用 Allocation Timeline 追踪内存增长

关键指标：
- Task Manager（Shift+Esc）查看页面内存使用
- 持续增长且不释放 = 泄漏
```

---
id: perf-050
module: 性能优化
difficulty: 3
tags: [首屏优化, SSR, 骨架屏, 性能]
source: 高频
---
## 题目
如何系统性地优化首屏加载性能？从哪些维度入手？

## 答案
## 首屏加载性能优化体系

### 1. 减少关键路径长度（Critical Rendering Path）
```html
<!-- 关键 CSS 内联（< 14KB）-->
<head>
  <style>/* 首屏必要样式 */</style>
</head>

<!-- 非关键 CSS 异步加载 -->
<link rel="preload" href="app.css" as="style" onload="this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="app.css"></noscript>

<!-- JS 不阻塞渲染 -->
<script src="app.js" defer></script>
<script src="analytics.js" async></script>
```

### 2. 减少 JS Bundle 体积
```
路由级代码分割（React.lazy + Suspense）
第三方库按需引入（lodash-es、antd 按需）
Tree Shaking（ES Module）
删除无用代码和依赖
生产构建 + Terser 压缩
```

### 3. 服务端渲染（SSR）
```
CSR（客户端渲染）：白屏时间 = 下载 JS + 执行 JS + 数据请求
SSR（服务端渲染）：服务端生成 HTML，浏览器直接渲染

Next.js / Nuxt.js 方案：
- getServerSideProps：每次请求生成 HTML
- getStaticProps：构建时生成 HTML（SSG）
- Streaming SSR：边生成边发送（React 18）
```

### 4. 骨架屏（Skeleton Screen）
```jsx
// 数据加载前展示骨架，减少视觉空白感
function Card({ loading, data }) {
  if (loading) {
    return (
      <div className="skeleton">
        <div className="skeleton-avatar" />
        <div className="skeleton-text" />
        <div className="skeleton-text short" />
      </div>
    );
  }
  return <div>{data.title}</div>;
}
```

```css
.skeleton div {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### 5. 资源优化清单
```
图片：WebP/AVIF + 响应式 + 懒加载 + CDN
字体：preload + font-display: swap + 子集化
第三方脚本：async + 延迟加载 + 放到 body 底部
API：并行请求（Promise.all）+ 接口聚合 + BFF 层
HTTP：HTTP/2 + Brotli 压缩 + 强缓存（hash 文件名）
```

### 6. 度量与监控
```js
// 真实用户监控（RUM）
import { onLCP, onFCP, onCLS, onINP, onTTFB } from 'web-vitals';
[onLCP, onFCP, onCLS, onINP, onTTFB].forEach(fn => fn(sendToServer));

// 目标值
// FCP < 1.8s, LCP < 2.5s, CLS < 0.1, INP < 200ms, TTFB < 800ms
```
