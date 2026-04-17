# trade-check 搜索指令参考

> 本文档列出系统当前所有搜索指令的构建逻辑、输入条件、搜索引擎和结果处理。
> 生成时间: 2026-04-17 · 基于 commit `1155811`

---

## 搜索引擎

大部分搜索通过 **Serper.dev** (`google.serper.dev/search`) 发起 Google 网页搜索;实地核验额外用 **Serper Maps** (`google.serper.dev/maps`)。

```
POST https://google.serper.dev/search          (网页)
POST https://google.serper.dev/maps            (Maps,返回 places 而非 organic)
Headers: X-API-KEY: <serpApiKey>, Content-Type: application/json
Body: { q: <query>, num: <数量>, gl: 'us', hl: 'en' }
Timeout: 10s
```

网页搜索响应取 `json.organic`,每条 `{ title, link, snippet }`。
Maps 响应取 `json.places`,每条 `{ title, address, phoneNumber, website, category, rating, ratingCount, latitude, longitude, cid }`。

**文件**: `lib/intel/serpapi.js`(`serpSearch` + `mapsSearch`)

---

## 搜索编排流程

```
阶段 1 · 我方背景(用户自己的公司)
  ├─ fetchWebsite(我方URL)           → 抓取我方网站内容
  └─ serpSearch("我方品牌名")         → 我方公司 Google 搜索(上下文补充)

阶段 2 · 发件方实体抽取(LLM)
  └─ extractEntities(inquiry+images) → { companyName, companyUrl, personName, email, phone, ... }

阶段 3 · 基于发件方实体的 9 路并行搜索
  ├─ fetchWebsite(发件方URL)          → 发件方网站抓取
  ├─ waybackFirstSnapshot(URL)        → Wayback Machine 建站时间
  ├─ searchLinkedIn(extracted)        → LinkedIn 搜索
  ├─ searchFacebook(extracted)        → Facebook 搜索
  ├─ searchPanjiva(extracted)         → Panjiva 海关搜索
  ├─ searchMaps(extracted)            → Google Maps 实地核验
  ├─ searchNegative(extracted)        → 负面/诈骗搜索
  ├─ searchPhone(extracted)           → 电话号码搜索
  └─ searchGeneral(extracted)         → 通用搜索
```

---

## 搜索指令详解

### 1. 我方品牌搜索

| 项目 | 值 |
|---|---|
| 文件 | `lib/intel/index.js` · `deriveUserQueryFromSite()` |
| 目的 | 为主分析 LLM 补充我方公司的网络足迹,提供对比基准 |
| 结果数 | 5 条 |
| 面板显示 | 不显示(静默注入 LLM 上下文) |

**查询构建**:
```
优先级:
  1. og:site_name 元标签
  2. <title> 按 | · • - — – 分割后取最短非空段
  3. 二级域名(如 konmison.com → konmison)

最终查询: "品牌名"  (带引号精确匹配)
```

**示例**:
```
我方网站: https://konmison.com
title: "Konmison - Professional Beauty Equipment Manufacturer"
→ 查询: "Konmison"
```

---

### 2. LinkedIn 搜索

| 项目 | 值 |
|---|---|
| 文件 | `lib/intel/searches/linkedin.js` |
| 目的 | 核验发件方人员身份、职位、公司关联 |
| 结果数 | 5 条 |
| 面板卡片 | LinkedIn 核验 |

**查询构建**:
```
有人名 + 公司名: site:linkedin.com/in "人名" "公司名"
仅有人名:       site:linkedin.com/in "人名"
仅有公司名:     site:linkedin.com/company "公司名"
都没有:         跳过(status: skipped)
```

**示例**:
```
personName: "Marija Ignjatović", companyName: "PROSTYLE"
→ 查询: site:linkedin.com/in "Marija Ignjatović" "PROSTYLE"
```

---

### 3. Facebook 搜索

| 项目 | 值 |
|---|---|
| 文件 | `lib/intel/searches/facebook.js` |
| 目的 | 核验发件方公司/个人在 Facebook 上的存在性 |
| 结果数 | 5 条 |
| 面板卡片 | Facebook 核验 |

**查询构建**:
```
有公司名: site:facebook.com "公司名"
仅有人名: site:facebook.com "人名"
都没有:   跳过
```

**示例**:
```
companyName: "PROSTYLE"
→ 查询: site:facebook.com "PROSTYLE"
```

---

### 4. Panjiva 海关足迹搜索

| 项目 | 值 |
|---|---|
| 文件 | `lib/intel/searches/panjiva.js` |
| 目的 | 查找发件方公司的进出口海关记录 |
| 结果数 | 10 条(显示前 5) |
| 面板卡片 | 海关足迹 |

**查询构建**:
```
有公司名: site:panjiva.com "公司名"
没有公司名: 跳过
```

**示例**:
```
companyName: "PROSTYLE"
→ 查询: site:panjiva.com "PROSTYLE"
```

**特殊返回**: 额外返回 `resultCount`(总命中数)和 `hasRecord` 布尔值。

---

### 5. 负面/诈骗搜索

| 项目 | 值 |
|---|---|
| 文件 | `lib/intel/searches/negative.js` |
| 目的 | 搜索与发件方相关的诈骗、投诉、欺诈信息 |
| 结果数 | 5 条 |
| 面板卡片 | 负面搜索 |

**查询构建**:
```
关键词: (scam OR fraud OR 骗 OR complaint)

目标优先级: companyName > email > personName

有目标: "目标" (scam OR fraud OR 骗 OR complaint)
都没有: 跳过
```

**示例**:
```
companyName: "PROSTYLE"
→ 查询: "PROSTYLE" (scam OR fraud OR 骗 OR complaint)

没有公司名但有邮箱: email: "john@example.com"
→ 查询: "john@example.com" (scam OR fraud OR 骗 OR complaint)
```

---

### 6. 电话号码搜索

| 项目 | 值 |
|---|---|
| 文件 | `lib/intel/searches/phone.js` |
| 目的 | 搜索发件方电话号码的网络足迹(验真/关联公司) |
| 结果数 | 5 条 |
| 面板卡片 | 发件方电话核验 |

**查询构建**:
```
有电话: 去除空格/横杠/括号后精确搜索 "标准化号码"
号码太短(<6位): 跳过
没有电话: 跳过
```

**预处理**:
```javascript
normalized = phone.replace(/[\s\-()]/g, '')
// "+86 138-0013-8000" → "+8613800138000"
```

**示例**:
```
phone: "+381 64 123 4567"
→ 标准化: "+381641234567"
→ 查询: "+381641234567"
```

---

### 7. Google Maps 实地核验

| 项目 | 值 |
|---|---|
| 文件 | `lib/intel/searches/maps.js` |
| 目的 | 验证发件方公司地址是否真实存在,识别住宅冒充工厂、虚拟地址、PO Box 等;同步获取门面照片、评分、营业类型 |
| 端点 | `google.serper.dev/maps`(独立于 web 搜索) |
| 结果数 | 5 条 |
| 面板卡片 | 实地核验 |

**查询构建**:
```
有公司名 + 地址:  "公司名" 地址
仅有公司名 + 国家: "公司名" 国家
仅有公司名:       "公司名"
没有公司名:       跳过
```

**示例**:
```
companyName: "PROSTYLE", address: "Kralja Petra 1, Belgrade", country: "Serbia"
→ 查询: "PROSTYLE" Kralja Petra 1, Belgrade

companyName: "PROSTYLE", country: "Serbia"  (无地址)
→ 查询: "PROSTYLE" Serbia
```

**返回每个 place 字段**: `title / address / phoneNumber / website / category / rating / ratingCount / latitude / longitude / cid`

**说明**: 小贸易商 / 新公司 / 中国非一线工厂 Maps 收录率较低,空结果不一定是负面信号(类似 Wayback)。LLM 提示已经包含此判断。

---

### 8. 通用搜索

| 项目 | 值 |
|---|---|
| 文件 | `lib/intel/searches/general.js` |
| 目的 | 对发件方公司名做不限站点的 Google 搜索,捕获其他来源信息 |
| 结果数 | 5 条 |
| 面板卡片 | 不单独上面板(结果纳入简报供 LLM 使用) |

**查询构建**:
```
有公司名: "公司名"
没有公司名: 跳过
```

**示例**:
```
companyName: "PROSTYLE"
→ 查询: "PROSTYLE"
```

---

### 9. Wayback Machine 建站时间

| 项目 | 值 |
|---|---|
| 文件 | `lib/intel/wayback.js` |
| 目的 | 查询发件方网站最早的 Internet Archive 快照,推断建站时间 |
| API | `https://archive.org/wayback/available?url=<URL>&timestamp=19900101` |
| 面板卡片 | 建站时间(固定在最后) |
| 计费 | 免费 |

**查询**: 直接用 `extracted.companyUrl`,不经过 Serper。

---

### 10. 发件方网站抓取

| 项目 | 值 |
|---|---|
| 文件 | `lib/intel/fetchWebsite.js` |
| 目的 | 直接抓取发件方公司网站,分析网站专业度 |
| 面板卡片 | 发件方公司网站 |
| 超时 | 8s |

**查询**: 直接 `fetch(extracted.companyUrl)`,HTML 剥离后返回摘要文本。

---

## 完整搜索示例(假设场景)

**输入**:
```
我方网站: https://konmison.com
询盘文本: Hi, I'm Marija from PROSTYLE, www.kozmetikaonline.com
         prostyledooinfo@gmail.com, +381 64 123 4567
         We'd like to buy beauty equipment.
```

**抽取结果**:
```json
{
  "companyName": "PROSTYLE",
  "companyUrl": "https://www.kozmetikaonline.com",
  "personName": "Marija",
  "email": "prostyledooinfo@gmail.com",
  "phone": "+381641234567",
  "country": "Serbia",
  "address": "Kralja Petra 1, Belgrade"
}
```

**阶段 1 · 我方搜索**:
| # | 查询 | 来源 |
|---|---|---|
| 0 | `"Konmison"` | 品牌名搜索 |

**阶段 3 · 发件方搜索(9 路并行)**:
| # | 搜索项 | 查询指令 |
|---|---|---|
| 1 | 发件方网站 | `fetch https://www.kozmetikaonline.com` |
| 2 | Wayback | `archive.org/wayback/available?url=kozmetikaonline.com` |
| 3 | LinkedIn | `site:linkedin.com/in "Marija" "PROSTYLE"` |
| 4 | Facebook | `site:facebook.com "PROSTYLE"` |
| 5 | Panjiva | `site:panjiva.com "PROSTYLE"` |
| 6 | 实地核验(Maps) | `"PROSTYLE" Kralja Petra 1, Belgrade` |
| 7 | 负面搜索 | `"PROSTYLE" (scam OR fraud OR 骗 OR complaint)` |
| 8 | 电话 | `"+381641234567"` |
| 9 | 通用 | `"PROSTYLE"` |

**Serper API 调用总计**: 1(我方) + 5(LinkedIn/Facebook/Panjiva/负面/通用) + 1(电话) + 1(Maps) = **8 次**
**免费调用**: 网站抓取(2 次) + Wayback(1 次) = 3 次
