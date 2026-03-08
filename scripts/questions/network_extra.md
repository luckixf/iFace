---
id: net-038
module: 网络
difficulty: 2
tags: [HTTP, 缓存, 强缓存, 协商缓存]
source: 高频
---
## 题目
HTTP 缓存机制详解：强缓存和协商缓存的区别？

## 答案
## HTTP 缓存机制

### 强缓存（不请求服务器）
浏览器直接使用本地缓存，返回 200（from cache）。

```http
# 响应头设置强缓存
Cache-Control: max-age=31536000  # 秒数，优先级高于 Expires
Expires: Wed, 21 Oct 2025 07:28:00 GMT  # 绝对时间，已过时
```

```
触发条件：资源未过期
状态码：200 (from disk/memory cache)
是否请求服务器：否
```

### 协商缓存（请求服务器验证）
浏览器携带缓存标识请求服务器，服务器决定是否使用缓存。

```http
# 方式1：Last-Modified / If-Modified-Since（精度秒级）
响应：Last-Modified: Wed, 21 Oct 2024 07:28:00 GMT
请求：If-Modified-Since: Wed, 21 Oct 2024 07:28:00 GMT

# 方式2：ETag / If-None-Match（精度更高，优先级更高）
响应：ETag: "abc123def456"
请求：If-None-Match: "abc123def456"
```

```
命中协商缓存：304 Not Modified（无 body，节省带宽）
未命中：200 + 新资源
```

### 缓存决策流程
```
请求资源
  ↓
有缓存？→ 否 → 请求服务器 → 200 + 缓存
  ↓ 是
强缓存是否过期？→ 否 → 200 from cache
  ↓ 是
携带 ETag/Last-Modified 请求服务器
  ↓
资源未变化？→ 是 → 304 Not Modified（用本地缓存）
  ↓ 否
200 + 新资源 + 新缓存标识
```

### Cache-Control 常用值
```http
Cache-Control: no-store        # 完全不缓存
Cache-Control: no-cache        # 每次都协商缓存（不是不缓存！）
Cache-Control: private         # 只允许浏览器缓存，CDN不缓存
Cache-Control: public          # CDN 也可缓存
Cache-Control: max-age=0, must-revalidate  # 强制协商
Cache-Control: immutable       # 资源不变（配合 hash 文件名使用）
```

### 最佳实践
```
HTML：Cache-Control: no-cache（每次协商，保证更新及时）
JS/CSS（带 hash）：Cache-Control: max-age=31536000, immutable（长期强缓存）
图片：Cache-Control: max-age=86400（1天）
API 接口：Cache-Control: no-store（敏感数据）
```

---
id: net-039
module: 网络
difficulty: 1
tags: [HTTP, 状态码]
source: 高频
---
## 题目
常见 HTTP 状态码有哪些？分别代表什么意思？

## 答案
## HTTP 状态码

### 1xx 信息性
```
100 Continue        继续发送请求体
101 Switching Protocols  协议升级（如 WebSocket）
```

### 2xx 成功
```
200 OK              请求成功
201 Created         资源创建成功（POST）
204 No Content      成功但无响应体（DELETE）
206 Partial Content 范围请求成功（断点续传）
```

### 3xx 重定向
```
301 Moved Permanently   永久重定向（浏览器缓存新地址）
302 Found               临时重定向（每次都请求原地址）
304 Not Modified        协商缓存命中
307 Temporary Redirect  临时重定向，保持请求方法不变
308 Permanent Redirect  永久重定向，保持请求方法不变
```

### 4xx 客户端错误
```
400 Bad Request         请求语法错误
401 Unauthorized        未认证（需要登录）
403 Forbidden           无权限（已认证但没权限）
404 Not Found           资源不存在
405 Method Not Allowed  请求方法不允许
409 Conflict            资源冲突
413 Payload Too Large   请求体过大
429 Too Many Requests   限流
```

### 5xx 服务端错误
```
500 Internal Server Error  服务器内部错误
502 Bad Gateway            网关错误（上游服务异常）
503 Service Unavailable    服务不可用（过载/维护）
504 Gateway Timeout        网关超时
```

### 面试常考区分
```
301 vs 302：301 永久，浏览器会缓存跳转；302 临时，每次都走原地址
401 vs 403：401 没登录；403 登录了但没权限
302 vs 307：302 可能将 POST 改为 GET；307 严格保持方法不变
```

---
id: net-040
module: 网络
difficulty: 2
tags: [HTTPS, TLS, 加密, 证书]
source: 高频
---
## 题目
HTTPS 的工作原理是什么？TLS 握手过程详解？

## 答案
## HTTPS / TLS 工作原理

### 为什么需要 HTTPS
```
HTTP 明文传输，存在：
- 窃听风险（内容被中间人读取）
- 篡改风险（内容被修改）
- 冒充风险（无法验证服务器身份）

HTTPS = HTTP + TLS（传输层安全）解决以上三个问题
```

### TLS 1.3 握手过程（简化版）
```
客户端                              服务器
  │── ClientHello ────────────────►│
  │   (支持的算法、随机数 C)          │
  │                                 │
  │◄─── ServerHello ───────────────│
  │     (选定算法、随机数 S、证书)     │
  │                                 │
  │  [验证证书：CA 链、有效期、域名]   │
  │                                 │
  │── 生成预主密钥，用服务器公钥加密 ──►│
  │                                 │  服务器用私钥解密
  │  [双方用 C + S + 预主密钥生成会话密钥]
  │                                 │
  │── Finished ────────────────────►│
  │◄─── Finished ───────────────────│
  │                                 │
  │════ 对称加密通信（会话密钥）═════│
```

### 证书验证
```
1. 浏览器内置受信任的根 CA 列表
2. 服务器证书由中间 CA 签名，中间 CA 由根 CA 签名（证书链）
3. 验证内容：
   - 数字签名（防篡改）
   - 有效期
   - 域名匹配（CN 或 SAN）
   - 证书未被吊销（CRL/OCSP）
```

### 对称 vs 非对称加密
```
握手阶段：非对称加密（RSA/ECDH）安全交换密钥，但慢
传输阶段：对称加密（AES-GCM）快速加密数据

TLS 1.3 改进：
- 1-RTT 握手（TLS 1.2 需要 2-RTT）
- 支持 0-RTT 恢复（有重放风险）
- 废弃不安全算法（RSA 密钥交换、SHA-1 等）
```

---
id: net-041
module: 网络
difficulty: 2
tags: [跨域, CORS, 同源策略]
source: 高频
---
## 题目
什么是同源策略？CORS 跨域的完整机制是什么？

## 答案
## 同源策略与 CORS

### 同源策略
同源 = 协议 + 域名 + 端口 完全相同。

```
https://a.com/page  vs  https://a.com/other  ✅ 同源（路径不同）
https://a.com       vs  http://a.com         ❌ 协议不同
https://a.com       vs  https://b.com        ❌ 域名不同
https://a.com:443   vs  https://a.com:8080   ❌ 端口不同
https://a.com       vs  https://sub.a.com    ❌ 子域名不同
```

### CORS 简单请求
满足以下条件的请求直接发送，服务器通过响应头允许：
```
方法：GET / POST / HEAD
请求头：只含 Accept、Content-Type（text/plain、multipart/form-data、application/x-www-form-urlencoded）
```

```http
# 浏览器自动添加 Origin
Origin: https://frontend.com

# 服务器响应
Access-Control-Allow-Origin: https://frontend.com  # 或 *
Access-Control-Allow-Credentials: true  # 允许 Cookie
```

### CORS 预检请求（Preflight）
非简单请求（如 PUT/DELETE、JSON body、自定义请求头）先发 OPTIONS：

```http
# 预检请求
OPTIONS /api/data HTTP/1.1
Origin: https://frontend.com
Access-Control-Request-Method: PUT
Access-Control-Request-Headers: Content-Type, Authorization

# 预检响应
Access-Control-Allow-Origin: https://frontend.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400  # 预检缓存时间（秒），避免每次都预检
```

### Node.js 服务端设置
```js
// Express
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://frontend.com');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
```

### 其他跨域方案
```
JSONP：只支持 GET，通过 <script> 标签绕过同源（已淘汰）
代理：Nginx 反向代理、开发环境 webpack devServer proxy
postMessage：iframe 跨域通信
document.domain：限同父域（已废弃）
```

---
id: net-042
module: 网络
difficulty: 1
tags: [TCP, 三次握手, 四次挥手]
source: 高频
---
## 题目
TCP 三次握手和四次挥手的过程是什么？为什么需要三次？

## 答案
## TCP 三次握手与四次挥手

### 三次握手（建立连接）
```
客户端                    服务器
  │── SYN(seq=x) ────────►│  客户端：我要连接，序号 x
  │◄── SYN-ACK(seq=y,ack=x+1) ─│  服务器：收到，我的序号 y，期待 x+1
  │── ACK(ack=y+1) ───────►│  客户端：收到，期待 y+1
  │                         │
  └── 连接建立，开始传输数据 ──┘
```

### 为什么需要三次握手？
```
1. 确认双方的发送和接收能力都正常
2. 同步双方的初始序列号（ISN）
3. 防止已失效的连接请求报文突然到达服务器造成错误
   （若只有两次握手，旧的 SYN 到达服务器会直接建立连接，浪费资源）
```

### 四次挥手（断开连接）
```
客户端                    服务器
  │── FIN(seq=u) ─────────►│  客户端：我要断开（半关闭）
  │◄── ACK(ack=u+1) ───────│  服务器：收到你的 FIN
  │                         │  （服务器可能还有数据要发）
  │◄── FIN(seq=v) ──────────│  服务器：我也要断开了
  │── ACK(ack=v+1) ─────────►│  客户端：收到
  │                         │
  └── 等待 2MSL 后完全关闭 ──┘
```

### 为什么需要四次挥手（而不是三次）？
```
TCP 是全双工的，双方各自独立关闭。
服务器收到 FIN 后，可能还有数据未发完，
所以 ACK 和 FIN 不能合并（不像握手时 SYN+ACK 可以合并）。
```

### TIME_WAIT（等待 2MSL）
```
客户端发送最后 ACK 后等待 2MSL（最大报文段生存时间）：
1. 确保服务器收到了最后的 ACK（若丢失，服务器会重发 FIN）
2. 让本次连接的报文全部消失，避免影响下一个相同端口的连接
```

---
id: net-043
module: 网络
difficulty: 2
tags: [HTTP2, HTTP3, 性能]
source: 高频
---
## 题目
HTTP/1.1、HTTP/2、HTTP/3 的核心区别是什么？

## 答案
## HTTP 版本对比

### HTTP/1.1 的问题
```
队头阻塞：同一连接的请求必须串行，前一个响应未完成后续请求等待
连接数限制：浏览器对同域最多 6 个 TCP 连接
Header 冗余：每次请求都发送大量重复头部（Cookie、UA 等）
```

### HTTP/2 改进
```
1. 多路复用（Multiplexing）
   - 单个 TCP 连接上并行发送多个请求/响应
   - 帧（Frame）+ 流（Stream）机制
   - 解决 HTTP 层队头阻塞

2. 头部压缩（HPACK）
   - 静态表 + 动态表 + Huffman 编码
   - 重复 Header 只发差异部分

3. 服务器推送（Server Push）
   - 服务器主动推送客户端可能需要的资源
   - 实际应用中较少使用（被 103 Early Hints 替代）

4. 二进制分帧
   - 文本协议 → 二进制协议，更高效

5. 流优先级
   - 可设置请求优先级
```

### HTTP/2 遗留问题
```
TCP 层队头阻塞：TCP 丢包时，整个连接的所有流都要等待重传
TCP 握手延迟：HTTPS 需要 TCP 3次握手 + TLS 握手
```

### HTTP/3 改进
```
基于 QUIC（UDP）：
1. 彻底解决队头阻塞：QUIC 流独立，一个流丢包不影响其他流
2. 0-RTT / 1-RTT 握手：QUIC 集成 TLS 1.3，握手更快
3. 连接迁移：基于 Connection ID 而非 IP+端口，切换网络不断连
4. 改进的拥塞控制
```

### 对比总结
```
特性          HTTP/1.1    HTTP/2      HTTP/3(QUIC)
传输层         TCP         TCP         UDP(QUIC)
多路复用       ❌ 串行      ✅           ✅
队头阻塞       HTTP+TCP层  TCP层        ✅彻底解决
头部压缩       ❌           HPACK        QPACK
握手RTT        1(TLS+1)    1(TLS+1)    0/1-RTT
连接迁移       ❌           ❌           ✅
```

---
id: net-044
module: 网络
difficulty: 2
tags: [XSS, 安全, CSP]
source: 高频
---
## 题目
什么是 XSS 攻击？如何防御？

## 答案
## XSS（跨站脚本攻击）

### 类型

**1. 存储型 XSS（持久型，最危险）**
```
攻击者将恶意脚本存入数据库 → 其他用户访问时脚本被执行
场景：评论区、个人简介、富文本编辑器
```

**2. 反射型 XSS（非持久型）**
```
恶意脚本在 URL 参数中 → 服务器反射回页面 → 执行
场景：搜索框、错误页面（需诱导用户点击恶意链接）
```

**3. DOM 型 XSS**
```
前端 JS 将 URL 参数直接插入 DOM 而未做过滤
场景：document.write(location.hash)
```

### 防御措施

**1. 输入过滤 / 输出转义（最重要）**
```js
// 危险：直接插入 HTML
el.innerHTML = userInput;

// 安全：转义特殊字符
const escape = (str) =>
  str.replace(/&/g,'&amp;').replace(/</g,'&lt;')
     .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
     .replace(/'/g,'&#39;');
el.textContent = userInput; // 最安全
```

**2. CSP（内容安全策略）**
```http
# 只允许同源脚本
Content-Security-Policy: script-src 'self'
# 禁止内联脚本（最有效防御 XSS）
Content-Security-Policy: script-src 'self' 'nonce-abc123'
# 禁止所有外部资源
Content-Security-Policy: default-src 'self'
```

**3. HttpOnly Cookie**
```http
Set-Cookie: session=xxx; HttpOnly; Secure; SameSite=Strict
# HttpOnly: JS 无法读取 Cookie，即使 XSS 也无法窃取
```

**4. 富文本使用白名单过滤**
```js
// 使用 DOMPurify 库
import DOMPurify from 'dompurify';
el.innerHTML = DOMPurify.sanitize(userInput);
```

---
id: net-045
module: 网络
difficulty: 2
tags: [CSRF, 安全, Cookie]
source: 高频
---
## 题目
什么是 CSRF 攻击？如何防御？

## 答案
## CSRF（跨站请求伪造）

### 攻击原理
```
1. 用户登录 bank.com，浏览器保存 Cookie
2. 用户访问恶意网站 evil.com
3. evil.com 页面包含：
   <img src="https://bank.com/transfer?to=hacker&amount=10000">
   或 <form action="https://bank.com/transfer" method="POST">
4. 浏览器自动带上 bank.com 的 Cookie 发送请求
5. 服务器以为是合法用户操作
```

### 防御措施

**1. SameSite Cookie（最有效的现代方案）**
```http
Set-Cookie: session=xxx; SameSite=Strict  # 完全禁止第三方携带
Set-Cookie: session=xxx; SameSite=Lax     # 允许导航（GET），禁止表单 POST
Set-Cookie: session=xxx; SameSite=None; Secure  # 允许第三方（需 HTTPS）
```

**2. CSRF Token**
```
1. 服务器生成随机 token，存在 Session 中，同时发给页面
2. 前端每个请求携带该 token（Header 或表单字段）
3. 服务器验证 token 匹配
```
```js
// 前端发请求时附带
axios.defaults.headers.common['X-CSRF-Token'] = getCsrfToken();
```

**3. 验证 Referer / Origin**
```js
// 服务器检查请求来源
const origin = req.headers.origin || req.headers.referer;
if (!origin?.startsWith('https://bank.com')) {
  return res.status(403).json({ error: 'CSRF detected' });
}
```

**4. 双重 Cookie 验证**
```
Cookie 中存 CSRF token，请求时也在参数/Header 中带上，
服务器对比两者是否一致（第三方网站无法读取 Cookie）
```

### CSRF vs XSS
```
XSS：在目标网站注入并执行恶意脚本
CSRF：借用用户身份向目标网站发送伪造请求（不需要脚本执行权限）
```

---
id: net-046
module: 网络
difficulty: 1
tags: [DNS, CDN, 域名解析]
source: 高频
---
## 题目
DNS 解析过程是什么？CDN 的工作原理是什么？

## 答案
## DNS 解析过程

### 完整流程
```
1. 浏览器缓存（chrome://net-internals/#dns）
2. 操作系统缓存（/etc/hosts 文件优先）
3. 本地 DNS 服务器（ISP 提供，通常是 114.114.114.114）
4. 根域名服务器（.）→ 返回顶级域服务器地址
5. 顶级域名服务器（.com）→ 返回权威 DNS 地址
6. 权威 DNS 服务器 → 返回最终 IP
7. 结果缓存（TTL 时间内有效）
```

### DNS 记录类型
```
A      域名 → IPv4 地址
AAAA   域名 → IPv6 地址
CNAME  域名 → 另一个域名（别名）
MX     邮件服务器
TXT    文本信息（域名验证、SPF等）
NS     权威 DNS 服务器
```

### CDN 工作原理
```
没有 CDN：
  用户 → 源站服务器（可能跨越半个地球）

有 CDN：
  1. 域名解析走 CDN 的 NS（CNAME 到 CDN 域名）
  2. CDN 的智能 DNS 根据用户 IP 返回最近节点的 IP
  3. 用户连接最近的 CDN 边缘节点
  4. 命中缓存 → 直接返回
  5. 未命中 → 回源拉取，缓存后返回
```

### CDN 的收益
```
- 降低延迟（就近访问）
- 减轻源站压力
- 抵御 DDoS（流量分散到边缘节点）
- 静态资源加速（JS/CSS/图片/视频）
```

### DNS 预解析优化
```html
<link rel="dns-prefetch" href="//cdn.example.com">
<link rel="preconnect" href="https://cdn.example.com">
```

---
id: net-047
module: 网络
difficulty: 2
tags: [WebSocket, SSE, 长轮询, 实时通信]
source: 高频
---
## 题目
WebSocket、SSE、长轮询的区别是什么？各自适用什么场景？

## 答案
## 实时通信方案对比

### 短轮询（Short Polling）
```js
// 每隔固定时间请求一次
setInterval(async () => {
  const data = await fetch('/api/messages');
  render(data);
}, 3000);
// 缺点：大量无效请求，延迟高
```

### 长轮询（Long Polling）
```js
async function longPoll() {
  const data = await fetch('/api/wait');  // 服务器 hold 住请求，有数据才响应
  render(data);
  longPoll();  // 立即发下一个请求
}
// 优点：比短轮询实时，兼容性好
// 缺点：服务器资源占用，响应延迟
```

### SSE（Server-Sent Events）
```js
// 服务器 → 客户端 单向推送
const es = new EventSource('/api/stream');
es.onmessage = (e) => render(e.data);
es.addEventListener('custom-event', (e) => console.log(e.data));
es.onerror = () => es.close();

// 服务端（Node.js）
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.write(`data: ${JSON.stringify(msg)}\n\n`);
// 自动重连（reconnect）
```

### WebSocket
```js
// 双向全双工通信
const ws = new WebSocket('wss://example.com/ws');
ws.onopen = () => ws.send(JSON.stringify({ type: 'hello' }));
ws.onmessage = (e) => render(JSON.parse(e.data));
ws.onerror = (e) => console.error(e);
ws.onclose = () => reconnect();

// 心跳保活
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) ws.send('ping');
}, 30000);
```

### 对比
```
方式         方向         协议         适用场景
短轮询       客→服        HTTP         简单低频场景
长轮询       客→服        HTTP         兼容性要求高
SSE          服→客        HTTP/2       通知、日志流、AI 流式输出
WebSocket    双向         WS           聊天、游戏、协同编辑
```

---
id: net-048
module: 网络
difficulty: 2
tags: [HTTP, Cookie, Session, Token, JWT]
source: 高频
---
## 题目
Cookie、Session、Token、JWT 的区别和使用场景？

## 答案
## 身份认证方案对比

### Cookie + Session（传统方案）
```
1. 用户登录 → 服务器创建 Session（存在内存/Redis）
2. 服务器返回 Set-Cookie: sessionId=xxx
3. 后续请求浏览器自动带 Cookie
4. 服务器用 sessionId 查 Session 验证身份
```
```
优点：服务端可主动撤销（退出登录立即生效）
缺点：服务端有状态，分布式系统需共享 Session（Redis）
```

### JWT（JSON Web Token）
```
结构：Header.Payload.Signature
Header:  {"alg":"HS256","typ":"JWT"}
Payload: {"sub":"1234","name":"Alice","exp":1700000000}
Signature: HMAC-SHA256(base64(Header)+"."+base64(Payload), secret)
```

```js
// 客户端存储在 localStorage 或内存中
// 请求时手动添加
headers: { Authorization: `Bearer ${token}` }
```

```
优点：无状态，服务端无需存储，天然支持分布式
缺点：
- 无法主动撤销（只能等过期）→ 用短期 token + refresh token
- Payload 可被解码（不要存敏感信息）
- token 泄露风险（存 localStorage 可被 XSS 读取）
```

### Token vs JWT
```
Token：通常是随机字符串，服务端需查库验证
JWT：自包含，服务端无需查库（用签名验证）
```

### 安全建议
```js
// JWT 存储建议：HttpOnly Cookie（防 XSS）+ SameSite（防 CSRF）
Set-Cookie: token=xxx; HttpOnly; Secure; SameSite=Strict

// 短期 access token（15分钟）+ 长期 refresh token（7天）
// access token 过期后用 refresh token 换新的
```

---
id: net-049
module: 网络
difficulty: 3
tags: [TCP, UDP, 对比]
source: 高频
---
## 题目
TCP 和 UDP 的区别是什么？什么场景下使用 UDP？

## 答案
## TCP vs UDP

### 核心区别
```
特性          TCP                    UDP
连接          有连接（三次握手）       无连接
可靠性        可靠（重传、确认）       不可靠（可能丢包）
顺序          有序                    无序
流量控制      有（滑动窗口）          无
拥塞控制      有                      无
速度          慢（开销大）            快
头部大小      20-60 字节              8 字节
广播          不支持                  支持
```

### TCP 适用场景
```
- HTTP/HTTPS（文件传输、网页）
- 文件下载（FTP）
- 邮件（SMTP/IMAP）
- SSH 远程连接
- 数据库连接
一切对数据完整性要求高的场景
```

### UDP 适用场景
```
- 视频通话（WebRTC）：可以丢帧，不能有延迟
- 在线游戏：低延迟优先，少量丢包可接受
- DNS 查询：小数据包，一问一答，UDP 更快
- 直播推流：实时性优先
- HTTP/3 (QUIC)：在 UDP 上自己实现可靠传输

共同点：实时性 > 可靠性
```

### QUIC 为什么选择 UDP
```
1. UDP 无内核层面的队头阻塞
2. 可以在用户态自由实现拥塞控制算法
3. 0-RTT 连接恢复
4. 避免 TCP 的僵化（内核协议栈难以修改）
```

---
id: net-050
module: 网络
difficulty: 2
tags: [浏览器, 渲染, 从输入URL到页面]
source: 高频
---
## 题目
从输入 URL 到页面显示，发生了什么？

## 答案
## URL 到页面的完整过程

### 1. URL 解析
```
解析协议、域名、路径、参数
检查 HSTS 预加载列表（是否强制 HTTPS）
```

### 2. DNS 解析
```
浏览器缓存 → OS 缓存 → hosts 文件 → 本地 DNS → 递归查询
得到 IP 地址
```

### 3. TCP 连接 + TLS 握手
```
TCP 三次握手建立连接
HTTPS：TLS 握手（1-RTT 或 0-RTT）
HTTP/3：QUIC 握手（0/1-RTT）
```

### 4. HTTP 请求
```
发送请求（方法、路径、Headers、Body）
服务器处理并返回响应
```

### 5. 浏览器解析与渲染
```
5.1 解析 HTML → DOM Tree
5.2 解析 CSS → CSSOM Tree
    （CSS 是渲染阻塞资源，不阻塞 HTML 解析）
5.3 JS 执行
    - <script>：阻塞 HTML 解析（除非 async/defer）
    - async：下载完立即执行
    - defer：HTML 解析完才执行，保持顺序
5.4 DOM + CSSOM → Render Tree（只含可见节点）
5.5 Layout（重排）：计算位置和尺寸
5.6 Paint（重绘）：绘制像素
5.7 Composite（合成）：GPU 合并图层
```

### 6. 关键优化点
```
DNS 预解析：<link rel="dns-prefetch">
预连接：<link rel="preconnect">
关键 CSS 内联，非关键 CSS 异步加载
JS 使用 defer/async
图片懒加载：loading="lazy"
HTTP/2 多路复用减少连接数
CDN 加速静态资源
```

---
id: net-051
module: 网络
difficulty: 2
tags: [HTTP, 请求方法, RESTful]
source: 高频
---
## 题目
HTTP 请求方法有哪些？GET 和 POST 的区别是什么？

## 答案
## HTTP 请求方法

### 常见方法
```
GET     获取资源（幂等、安全）
POST    创建资源（非幂等）
PUT     全量更新资源（幂等）
PATCH   部分更新资源
DELETE  删除资源（幂等）
HEAD    只获取响应头（不返回 body）
OPTIONS 查询服务器支持的方法（CORS 预检）
```

### GET vs POST 区别
```
特性          GET                     POST
数据位置      URL 查询字符串           请求体（Body）
数据大小      受 URL 长度限制（~2KB）  几乎无限制
安全性        数据暴露在 URL 中        相对安全
缓存          可以被缓存               默认不缓存
幂等性        幂等（多次结果相同）     非幂等
收藏          可以加入收藏夹           不能
历史记录      URL 保存在浏览器历史中  Body 不保存
```

### 幂等性
```
幂等：多次执行结果相同
GET、PUT、DELETE、HEAD 是幂等的
POST、PATCH 不是幂等的

实践意义：
- 幂等方法可以安全重试
- 非幂等方法重试需要防重（如订单去重）
```

### RESTful 设计规范
```
GET    /articles          获取文章列表
GET    /articles/1        获取 id=1 的文章
POST   /articles          创建文章
PUT    /articles/1        全量更新 id=1 的文章
PATCH  /articles/1        部分更新
DELETE /articles/1        删除

状态码语义：
201 Created → POST 成功
204 No Content → DELETE 成功
```

---
id: net-052
module: 网络
difficulty: 3
tags: [网络安全, CSP, HSTS, 点击劫持]
source: 高频
---
## 题目
前端常见安全攻击还有哪些？CSP、HSTS、点击劫持如何防御？

## 答案
## 前端安全防御体系

### 点击劫持（Clickjacking）
```
攻击：将目标网站用透明 iframe 覆盖在诱导页面上，用户点击其实是在操作目标网站

防御：
```
```http
# 禁止被 iframe 嵌入
X-Frame-Options: DENY          # 完全禁止
X-Frame-Options: SAMEORIGIN   # 只允许同源嵌入

# 现代方案（CSP）
Content-Security-Policy: frame-ancestors 'none'
Content-Security-Policy: frame-ancestors 'self' https://trusted.com
```

### HSTS（强制 HTTPS）
```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
# 告诉浏览器该域名始终使用 HTTPS，即使输入 http:// 也自动转
# preload 可提交到 Chrome 的 HSTS 预加载列表（全球生效）
```

### CSP（内容安全策略）
```http
# 基础安全策略
Content-Security-Policy:
  default-src 'self';           # 默认只允许同源
  script-src 'self' 'nonce-abc'; # 脚本需要 nonce 或 hash
  style-src 'self' https://fonts.googleapis.com;
  img-src 'self' data: https:;
  connect-src 'self' https://api.example.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';

# 上线前先用 report-only 模式收集违规
Content-Security-Policy-Report-Only: ...; report-uri /csp-report
```

### 其他安全响应头
```http
X-Content-Type-Options: nosniff          # 禁止 MIME 嗅探
X-XSS-Protection: 1; mode=block         # 老浏览器 XSS 过滤（已废弃）
Referrer-Policy: strict-origin-when-cross-origin  # 控制 Referer
Permissions-Policy: camera=(), microphone=()       # 禁用敏感 API
```

### SQL 注入（虽然主要是后端）
```js
// 危险：拼接 SQL
db.query(`SELECT * FROM users WHERE name = '${userInput}'`);

// 安全：参数化查询
db.query('SELECT * FROM users WHERE name = ?', [userInput]);
```

---
id: net-053
module: 网络
difficulty: 2
tags: [HTTP, 连接, keep-alive, 连接池]
source: 高频
---
## 题目
HTTP 长连接（keep-alive）是什么？HTTP/1.1 和 HTTP/2 连接复用有什么不同？

## 答案
## HTTP 连接管理

### HTTP/1.0 短连接
```
每次请求新建 TCP 连接，响应后立即关闭。
开销极大（每次三次握手 + TLS 握手）
```

### HTTP/1.1 长连接（Keep-Alive）
```http
# 默认开启（HTTP/1.1 中 Connection: keep-alive 是默认值）
Connection: keep-alive
Keep-Alive: timeout=60, max=100   # 60秒超时，最多100个请求

# 响应
Connection: keep-alive
```

```
同一 TCP 连接上串行复用多个请求
但仍有队头阻塞：前一个响应未完成，后续请求等待

浏览器限制：同域最多 6 个并行 TCP 连接
→ 出现 Domain Sharding（域名分片）优化技巧（HTTP/2 后废弃）
```

### HTTP/2 多路复用
```
单个 TCP 连接上并行处理多个请求/响应
帧（Frame）：数据最小传输单位
流（Stream）：虚拟通道，每个请求/响应是一个流
```

```
HTTP/1.1：请求串行，需要多个连接
  conn1: req1 → res1 → req2 → res2
  conn2: req3 → res3
  conn3: req4 → res4

HTTP/2：单连接并行
  stream1: req1 ≈≈≈≈≈≈≈≈≈≈≈ res1
  stream2:    req2 ≈≈≈≈ res2
  stream3:      req3 ≈≈≈≈≈≈≈≈ res3
```

### 连接池（前端不常见，但 Node.js 中有）
```js
// Node.js http.Agent 连接池
const http = require('http');
const agent = new http.Agent({
  keepAlive: true,
  maxSockets: 10,      // 最大并发连接数
  keepAliveMsecs: 3000 // 保活时间
});

fetch('http://api.example.com', { agent });
```

---
id: net-054
module: 网络
difficulty: 2
tags: [浏览器缓存, Service Worker, PWA]
source: 高频
---
## 题目
Service Worker 是什么？如何用它实现离线缓存？

## 答案
## Service Worker

### 概念
Service Worker 是运行在浏览器后台的独立线程（Worker），可以拦截网络请求，实现离线缓存、后台同步、推送通知等功能。

```
特点：
- 独立于页面线程（不阻塞主线程）
- 只能在 HTTPS 或 localhost 下运行
- 生命周期独立（页面关闭后仍可运行）
- 不能直接操作 DOM
```

### 注册与安装
```js
// main.js（页面中）
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(reg => console.log('SW registered:', reg.scope))
    .catch(err => console.error('SW error:', err));
}
```

### Service Worker 生命周期
```
install（安装）→ activate（激活）→ fetch（拦截请求）
```

### 离线缓存示例（sw.js）
```js
const CACHE_NAME = 'app-v1';
const STATIC_ASSETS = ['/', '/index.html', '/app.js', '/app.css'];

// 安装：预缓存静态资源
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting(); // 立即激活
});

// 激活：清理旧缓存
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 拦截请求（Cache First 策略）
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return res;
      });
    })
  );
});
```

### 缓存策略
```
Cache First：先缓存，适合静态资源（CSS/JS/图片）
Network First：先网络，适合 API 数据（要求最新）
Stale While Revalidate：返回缓存同时后台更新，适合非关键资源
```

---
id: net-055
module: 网络
difficulty: 3
tags: [网络性能, 优化, preload, prefetch]
source: 高频
---
## 题目
preload、prefetch、preconnect 的区别是什么？如何合理使用？

## 答案
## 资源预加载优化

### preload（立即需要）
```html
<!-- 当前页面一定会用到，优先加载 -->
<link rel="preload" href="/fonts/font.woff2" as="font" crossorigin>
<link rel="preload" href="/critical.js" as="script">
<link rel="preload" href="/hero.jpg" as="image">
<link rel="preload" href="/critical.css" as="style">
```
```
- 高优先级，立即下载
- as 属性指定资源类型（影响优先级和 CSP）
- 字体必须加 crossorigin（即使同源）
- 不会自动执行，只下载
- 警告：如果页面未使用 preload 的资源，浏览器会警告
```

### prefetch（未来需要）
```html
<!-- 未来页面/路由可能用到，空闲时加载 -->
<link rel="prefetch" href="/next-page.js" as="script">
<link rel="prefetch" href="/next-page.css" as="style">
```
```
- 低优先级，浏览器空闲时加载
- 跨页面有效（缓存在 disk cache）
- React Router / Next.js 路由预取就是基于此
```

### preconnect（提前建立连接）
```html
<!-- 提前与第三方域名建立 TCP+TLS 连接 -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://cdn.example.com" crossorigin>
```
```
- 只建立连接，不下载资源
- 适合：字体、CDN、API 域名
- 连接闲置会关闭，建议与 preload 配合
```

### dns-prefetch（只做 DNS 解析）
```html
<!-- 比 preconnect 开销更小，用于不确定的第三方域名 -->
<link rel="dns-prefetch" href="//analytics.example.com">
```

### 使用建议
```
字体（woff2）：   preload + preconnect（Google Fonts 域名）
关键 CSS/JS：     preload
首屏大图：        preload as="image"
下一页路由：      prefetch
API 域名：        preconnect 或 dns-prefetch
不确定的域名：    dns-prefetch（比 preconnect 便宜）
```

### 动态 prefetch（基于用户行为）
```js
// 用户 hover 链接时预取
link.addEventListener('mouseenter', () => {
  const hint = document.createElement('link');
  hint.rel = 'prefetch';
  hint.href = link.href;
  document.head.appendChild(hint);
});
```

---
id: net-056
module: 网络
difficulty: 3
tags: [HTTP, Range, 断点续传, 大文件]
source: 高频
---
## 题目
HTTP 如何实现大文件传输和断点续传？

## 答案
## 大文件传输与断点续传

### Range 请求
```http
# 客户端请求部分内容
GET /file.zip HTTP/1.1
Range: bytes=0-1023        # 第 0~1023 字节（第一个 1KB）
Range: bytes=1024-2047     # 第二个 1KB
Range: bytes=-1024         # 最后 1KB
Range: bytes=1024-         # 从第 1024 字节到结尾

# 服务器响应（206 Partial Content）
HTTP/1.1 206 Partial Content
Content-Range: bytes 0-1023/104857600  # 当前范围/总大小
Content-Length: 1024
Accept-Ranges: bytes  # 表明服务器支持断点续传
```

### 断点续传实现
```js
async function downloadWithResume(url, filename) {
  let downloaded = 0;
  const chunks = [];

  // 先获取文件总大小
  const headRes = await fetch(url, { method: 'HEAD' });
  const total = Number(headRes.headers.get('content-length'));

  const CHUNK = 1024 * 1024; // 1MB 每块

  while (downloaded < total) {
    const end = Math.min(downloaded + CHUNK - 1, total - 1);
    const res = await fetch(url, {
      headers: { Range: `bytes=${downloaded}-${end}` }
    });
    const chunk = await res.arrayBuffer();
    chunks.push(chunk);
    downloaded += chunk.byteLength;
    console.log(`${((downloaded / total) * 100).toFixed(1)}%`);
  }

  const blob = new Blob(chunks);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}
```

### 分片上传（大文件上传）
```js
async function uploadInChunks(file, chunkSize = 5 * 1024 * 1024) {
  const total = Math.ceil(file.size / chunkSize);

  for (let i = 0; i < total; i++) {
    const chunk = file.slice(i * chunkSize, (i + 1) * chunkSize);
    const form = new FormData();
    form.append('file', chunk);
    form.append('index', i);
    form.append('total', total);
    form.append('filename', file.name);

    await fetch('/upload/chunk', { method: 'POST', body: form });
  }

  // 通知服务端合并
  await fetch('/upload/merge', {
    method: 'POST',
    body: JSON.stringify({ filename: file.name, total }),
    headers: { 'Content-Type': 'application/json' }
  });
}
```

---
id: net-057
module: 网络
difficulty: 2
tags: [跨域, JSONP, 代理]
source: 高频
---
## 题目
除了 CORS，还有哪些跨域解决方案？

## 答案
## 跨域解决方案

### 1. Nginx 反向代理（生产环境推荐）
```nginx
server {
  listen 80;
  server_name frontend.com;

  location /api/ {
    proxy_pass http://backend.com/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    # 同源请求，无跨域问题
  }
}
```

### 2. 开发环境代理（Vite/Webpack）
```js
// vite.config.ts
export default {
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, '')
      }
    }
  }
}
```

### 3. JSONP（仅 GET，已过时）
```js
function jsonp(url, callback) {
  const name = `cb_${Date.now()}`;
  window[name] = (data) => {
    callback(data);
    delete window[name];
    document.body.removeChild(script);
  };
  const script = document.createElement('script');
  script.src = `${url}?callback=${name}`;
  document.body.appendChild(script);
}

jsonp('https://api.example.com/data', (data) => console.log(data));
// 服务端返回：cb_1234567890({"result":"..."})
```

### 4. postMessage（iframe 跨域通信）
```js
// 父页面发送
const iframe = document.querySelector('iframe');
iframe.contentWindow.postMessage({ type: 'hello', data: '...' }, 'https://child.com');

// iframe 接收
window.addEventListener('message', (e) => {
  if (e.origin !== 'https://parent.com') return; // 安全验证
  console.log(e.data);
  e.source.postMessage({ type: 'reply' }, e.origin);
});
```

### 5. WebSocket（不受同源限制）
```js
const ws = new WebSocket('wss://api.example.com/ws');
// WebSocket 握手通过 HTTP Upgrade，但之后不受同源策略限制
```

### 各方案对比
```
CORS：   标准方案，服务端配置，推荐
Nginx：  统一代理，生产环境常用
Dev代理：开发环境便捷配置
JSONP：  只支持 GET，有安全风险，已过时
postMessage：iframe 跨窗口通信专用
```

---
id: net-058
module: 网络
difficulty: 3
tags: [HTTP, 性能, 连接优化]
source: 高频
---
## 题目
什么是 HTTP 队头阻塞（Head-of-Line Blocking）？HTTP/2 和 HTTP/3 分别如何解决？

## 答案
## HTTP 队头阻塞

### 什么是队头阻塞
```
队头阻塞：队列中第一个任务阻塞了后续所有任务

HTTP/1.1 层面：
同一 TCP 连接中，请求必须按顺序串行处理。
req1 响应慢 → req2、req3... 全部等待

TCP 层面：
TCP 保证数据有序，一个数据包丢失 → 后续包必须等待重传
（即使数据在不同逻辑流中）
```

### HTTP/2 的解决（部分解决）
```
引入多路复用（Multiplexing）：
- 单连接上多个流（Stream）并行
- 解决了 HTTP 层的队头阻塞

但 TCP 层队头阻塞依然存在：
- HTTP/2 的所有流共享一个 TCP 连接
- 一旦 TCP 丢包，所有流都要等待重传
- 网络质量差时 HTTP/2 可能比 HTTP/1.1 更慢！
  （HTTP/1.1 多个 TCP 连接，一个丢包不影响其他）
```

### HTTP/3 的解决（彻底解决）
```
基于 QUIC（UDP）：
- 每个流（Stream）独立，流之间无依赖
- 一个流丢包只影响该流，其他流正常进行
- QUIC 在用户态实现可靠传输，可以精确控制

QUIC 的其他优势：
- 集成 TLS 1.3，握手更快（0/1-RTT）
- 连接迁移（切换 WiFi/4G 不断连）
- 改进的拥塞控制算法
```

### 实际性能对比
```
网络质量好（0% 丢包）：HTTP/2 ≈ HTTP/3 > HTTP/1.1
网络质量差（2% 丢包）：HTTP/3 > HTTP/1.1 > HTTP/2
移动端弱网环境：HTTP/3 优势明显
```

---
id: net-059
module: 网络
difficulty: 2
tags: [HTTP, 请求头, 响应头, Header]
source: 高频
---
## 题目
常见的 HTTP 请求头和响应头有哪些？分别有什么作用？

## 答案
## 常见 HTTP Headers

### 通用头（请求和响应都有）
```http
Cache-Control: no-cache, max-age=3600
Connection: keep-alive
Content-Type: application/json; charset=utf-8
Content-Length: 1234
Date: Mon, 01 Jan 2024 00:00:00 GMT
Transfer-Encoding: chunked   # 分块传输（不知道总大小时）
```

### 请求头
```http
Host: api.example.com                   # 必须，目标主机
Accept: application/json, text/html     # 期望响应类型
Accept-Encoding: gzip, br, deflate      # 支持的压缩格式
Accept-Language: zh-CN,zh;q=0.9        # 语言偏好
User-Agent: Mozilla/5.0 ...             # 浏览器标识
Referer: https://example.com/page      # 来源页面
Origin: https://frontend.com           # CORS 来源（跨域时）
Authorization: Bearer <token>          # 认证 Token
Cookie: session=xxx; theme=dark        # Cookie
If-None-Match: "abc123"                # 协商缓存 ETag
If-Modified-Since: ...                 # 协商缓存时间
Range: bytes=0-1023                    # 断点续传
Content-Type: application/json        # 请求体类型
```

### 响应头
```http
Content-Type: application/json         # 响应体类型
Content-Encoding: gzip                 # 响应体压缩方式
ETag: "abc123"                         # 协商缓存标识
Last-Modified: ...                     # 资源修改时间
Set-Cookie: session=xxx; HttpOnly      # 设置 Cookie
Location: https://new.example.com     # 重定向地址
Access-Control-Allow-Origin: *        # CORS 许可
Content-Security-Policy: ...           # CSP 安全策略
X-Frame-Options: DENY                  # 点击劫持防御
Strict-Transport-Security: ...        # HSTS
Vary: Accept-Encoding                  # 缓存键变化（编码不同时不同缓存）
```

---
id: net-060
module: 网络
difficulty: 3
tags: [网络优化, 性能, 前端工程]
source: 高频
---
## 题目
前端网络性能优化有哪些综合手段？如何系统性地优化首屏加载？

## 答案
## 前端网络性能综合优化

### 1. 减少请求数量
```
- 代码分割（Code Splitting）：按路由懒加载
- 雪碧图（Sprite）→ 已被 SVG Icon / 字体图标替代
- 内联关键资源（Critical CSS 内联）
- 合并小文件（HTTP/1.1 下），HTTP/2 后反而要拆分
```

### 2. 减少传输体积
```
- JS/CSS/HTML 压缩（Minify）
- Gzip 压缩（70% 体积减少）
- Brotli 压缩（比 Gzip 再减 15-20%）
- Tree Shaking 删除未用代码
- 图片优化：WebP/AVIF 格式，响应式图片
- 视频使用流式传输
```

### 3. 利用缓存
```
- 强缓存：带 hash 的静态资源（max-age=31536000, immutable）
- 协商缓存：HTML 文件（no-cache）
- Service Worker 离线缓存
- CDN 边缘缓存
```

### 4. 加快资源发现
```html
<link rel="preload" href="/critical.js" as="script">
<link rel="preload" href="/font.woff2" as="font" crossorigin>
<link rel="prefetch" href="/next-page.js">
<link rel="preconnect" href="https://cdn.example.com">
<link rel="dns-prefetch" href="//analytics.com">
```

### 5. 渲染优化
```html
<!-- JS 不阻塞 HTML 解析 -->
<script src="app.js" defer></script>
<script src="analytics.js" async></script>

<!-- 图片懒加载 -->
<img src="image.jpg" loading="lazy" decoding="async">

<!-- 关键 CSS 内联，非关键异步 -->
<style>/* 首屏关键样式 */</style>
<link rel="preload" href="app.css" as="style" onload="this.rel='stylesheet'">
```

### 6. 使用现代协议
```
HTTP/2：多路复用、头部压缩、Server Push
HTTP/3：QUIC、0-RTT、连接迁移
TLS 1.3：更快握手
```

### 7. 度量指标
```
LCP（最大内容绘制）< 2.5s
FID/INP（交互延迟）< 100ms / 200ms
CLS（累积布局偏移）< 0.1
TTFB（首字节时间）< 800ms
FCP（首次内容绘制）< 1.8s

工具：Lighthouse、WebPageTest、Chrome DevTools Network
```
```

现在运行脚本转换并追加到 network.json：
