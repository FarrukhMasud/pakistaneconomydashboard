/**
 * Urdu translations keyed by the exact English source string.
 *
 * Component props already carry readable English (`title="Trade Balance"`), so
 * keying the dictionary on that string means a component only has to call
 * `tx(title)` — no key plumbing, and an untranslated string degrades to the
 * English original instead of to a raw key.
 *
 * Scope: headings, descriptions, labels and controls. Figures, series names,
 * institution names, periods and provenance strings deliberately stay in
 * English so a number always reads exactly as the issuing institution
 * published it.
 */
const stringsUr = {
  // ===== Chart card controls =====
  'Latest available period in this chart': 'اس چارٹ میں دستیاب تازہ ترین مدت',
  'Expand chart': 'چارٹ بڑا کریں',
  'Show table': 'جدول دکھائیں',
  'Download the exact data behind this chart as CSV': 'اس چارٹ کا اصل ڈیٹا CSV میں ڈاؤن لوڈ کریں',
  'How to read this chart': 'یہ چارٹ کیسے پڑھیں',
  'Close expanded chart': 'بڑا چارٹ بند کریں',
  Close: 'بند کریں',
  Data: 'ڈیٹا',
  'Chart open in focus view': 'چارٹ فوکس ویو میں کھلا ہے',
  'Tabular data': 'جدولی ڈیٹا',
  'Period / Category': 'مدت / زمرہ',
  'Trace a headline figure:': 'اہم عدد کا ماخذ دیکھیں:',
  'Latest available period:': 'تازہ ترین دستیاب مدت:',
  Theme: 'تھیم',

  // ===== Overview =====
  'Economic Overview': 'معاشی جائزہ',
  'Key macroeconomic indicators at a glance. These headline numbers summarize Pakistan\u2019s economic health — from external accounts (reserves, trade, remittances) to domestic conditions (growth, inflation, monetary policy). Arrows show the direction of change; color reflects whether that movement is favorable, unfavorable, or neutral for the indicator.':
    'اہم معاشی اشاریے ایک نظر میں۔ یہ نمایاں اعداد پاکستان کی معاشی صحت کا خلاصہ پیش کرتے ہیں — بیرونی کھاتوں (ذخائر، تجارت، ترسیلات) سے لے کر ملکی حالات (شرحِ نمو، مہنگائی، زری پالیسی) تک۔ تیر تبدیلی کی سمت بتاتے ہیں؛ رنگ ظاہر کرتا ہے کہ یہ تبدیلی متعلقہ اشاریے کے لیے مثبت ہے، منفی یا غیر جانبدار۔',

  // ===== Trade =====
  'Trade Overview': 'تجارت کا جائزہ',
  'Pakistan\u2019s goods trade flows (excluding services). Pakistan structurally imports more than it exports — primarily energy, machinery, and consumer goods — creating a persistent trade deficit. This deficit is a key driver of foreign exchange pressure and a major focus of IMF program conditionality. Export growth, especially in textiles and food, is critical for reducing external vulnerability.':
    'پاکستان کی اشیا کی تجارت (خدمات کے علاوہ)۔ پاکستان ساختی طور پر برآمدات سے زیادہ درآمدات کرتا ہے — بنیادی طور پر توانائی، مشینری اور اشیائے صرف — جس سے مسلسل تجارتی خسارہ پیدا ہوتا ہے۔ یہ خسارہ زرِ مبادلہ پر دباؤ کی بڑی وجہ اور آئی ایم ایف پروگرام کی شرائط کا اہم نکتہ ہے۔ بیرونی کمزوری کم کرنے کے لیے برآمدات میں اضافہ، خصوصاً ٹیکسٹائل اور خوراک میں، انتہائی ضروری ہے۔',
  'Imports vs Exports': 'درآمدات بمقابلہ برآمدات',
  'Monthly trade flows in USD millions. The gap between imports (red) and exports (green) shows the trade deficit.':
    'ماہانہ تجارت بلحاظ ملین امریکی ڈالر۔ درآمدات (سرخ) اور برآمدات (سبز) کے درمیان فرق تجارتی خسارہ ظاہر کرتا ہے۔',
  'Trade Balance': 'تجارتی توازن',
  'Monthly trade surplus or deficit. Red bars indicate deficit months (imports exceeded exports). The amber dashed line compares each month with the same month in the previous year, making seasonality easier to interpret.':
    'ماہانہ تجارتی بچت یا خسارہ۔ سرخ ستون خسارے کے مہینے ظاہر کرتے ہیں (درآمدات برآمدات سے زیادہ)۔ عنبری نقطہ دار لکیر ہر مہینے کا موازنہ گزشتہ سال کے اسی مہینے سے کرتی ہے تاکہ موسمی اثر سمجھنا آسان ہو۔',
  'Cumulative Imports & Exports (FYTD)': 'مجموعی درآمدات و برآمدات (مالی سال تا حال)',
  'Cumulative Trade Balance (FYTD)': 'مجموعی تجارتی توازن (مالی سال تا حال)',
  'Top Export Destinations': 'سرِفہرست برآمدی منڈیاں',
  'Top Import Sources': 'سرِفہرست درآمدی ممالک',

  // ===== Country trends =====
  'Country Trends': 'ممالک کے رجحانات',
  'Per-country trade & remittance data is not available in the current dataset.':
    'موجودہ ڈیٹا میں ملک بہ ملک تجارت و ترسیلات کے اعداد و شمار دستیاب نہیں۔',
  'A partner-by-partner view of Pakistan\u2019s external sector — exports, imports and (where available) workers\u2019 remittances — for its most important trading and remittance partners. Each card shows the latest month with month-on-month (MoM) and year-on-year (YoY) momentum, plus fiscal-year-to-date totals versus the prior year. Watch for rising imports (red) outpacing exports, or softening remittances, as early signs of external-account pressure.':
    'پاکستان کے بیرونی شعبے کا شراکت دار ممالک کے اعتبار سے جائزہ — برآمدات، درآمدات اور (جہاں دستیاب ہو) ترسیلاتِ زر۔ ہر کارڈ تازہ ترین مہینہ، ماہ بہ ماہ اور سال بہ سال تبدیلی، اور مالی سال تا حال کا گزشتہ سال سے موازنہ دکھاتا ہے۔ درآمدات (سرخ) کا برآمدات سے تیز بڑھنا یا ترسیلات میں کمی بیرونی کھاتے پر دباؤ کی ابتدائی علامات ہیں۔',
  'Remittance Corridors — Monthly Trend': 'ترسیلاتِ زر کے راستے — ماہانہ رجحان',
  'Monthly workers\u2019 remittances from Pakistan\u2019s four largest single-country corridors over the last 36 months. Saudi Arabia and the UAE dominate; sustained declines here are an early warning for the current account, while Ramadan/Eid and December typically bring seasonal spikes.':
    'گزشتہ 36 ماہ کے دوران چار بڑے ممالک سے ماہانہ ترسیلاتِ زر۔ سعودی عرب اور متحدہ عرب امارات سرِفہرست ہیں؛ ان میں مسلسل کمی جاری کھاتے کے لیے ابتدائی خطرے کی گھنٹی ہے، جبکہ رمضان/عید اور دسمبر میں عموماً موسمی اضافہ ہوتا ہے۔',
  'Exports to': 'برآمدات بنام',
  'Imports from': 'درآمدات از',
  'Remittances from': 'ترسیلات از',

  // ===== Reserves =====
  'Foreign Exchange Reserves': 'زرِ مبادلہ کے ذخائر',
  'Pakistan\u2019s foreign currency reserves held by the State Bank of Pakistan and commercial banks. The canonical goods-import-cover measure below uses SBP-held reserves and trailing official goods imports. Reserves hit critically low levels in early 2023 before recovering under successive IMF-supported programs.':
    'اسٹیٹ بینک اور تجارتی بینکوں کے پاس موجود غیر ملکی کرنسی کے ذخائر۔ نیچے دیا گیا درآمدی کور کا معیاری پیمانہ اسٹیٹ بینک کے ذخائر اور گزشتہ بارہ ماہ کی سرکاری درآمدات پر مبنی ہے۔ ذخائر 2023 کے اوائل میں شدید کمی کا شکار ہوئے اور بعد ازاں آئی ایم ایف پروگراموں کے تحت بحال ہوئے۔',
  'SBP gross reserves (solid) and total reserves including commercial banks (dashed). Use YoY overlay or FYTD vs prior FY to compare the recovery path. Reserve cover is the single most-watched measure of Pakistan\'s ability to meet external obligations.':
      'اسٹیٹ بینک کے مجموعی ذخائر (مسلسل لکیر) اور تجارتی بینکوں سمیت کل ذخائر (نقطہ دار)۔ سالانہ موازنہ یا مالی سال تا حال بمقابلہ گزشتہ مالی سال سے بحالی کا موازنہ کریں۔ ذخائر کا کور پاکستان کی بیرونی ذمہ داریاں پوری کرنے کی صلاحیت کا سب سے اہم پیمانہ ہے۔',

  // ===== Exchange rate =====
  'Exchange Rates': 'شرحِ مبادلہ',
  'Pakistani Rupee (PKR) exchange rates against major currencies. A rising line = weaker rupee (more PKR per foreign unit). The exchange rate directly affects import costs, inflation pass-through, and external debt servicing burden.':
    'بڑی کرنسیوں کے مقابلے میں پاکستانی روپے کی شرحِ مبادلہ۔ اوپر جاتی لکیر = کمزور روپیہ (فی غیر ملکی یونٹ زیادہ روپے)۔ شرحِ مبادلہ درآمدی لاگت، مہنگائی اور بیرونی قرضوں کی ادائیگی کے بوجھ پر براہِ راست اثر ڈالتی ہے۔',
  'Exchange Rates (PKR)': 'شرحِ مبادلہ (روپیہ)',
  'PKR per unit of foreign currency — USD, EUR, GBP on left axis; CNY on right axis (different scale). The sharp rise in 2022–2023 reflects significant rupee depreciation during the economic crisis. The dashed purple line shows the Chinese Yuan rate.':
    'فی غیر ملکی یونٹ روپے — ڈالر، یورو، پاؤنڈ بائیں محور پر؛ یوان دائیں محور پر (مختلف پیمانہ)۔ 2022–2023 کا تیز اضافہ معاشی بحران کے دوران روپے کی نمایاں بے قدری ظاہر کرتا ہے۔ جامنی نقطہ دار لکیر چینی یوان کی شرح ہے۔',

  // ===== Remittances =====
  'Workers\u2019 Remittances': 'ترسیلاتِ زر',
  'Overseas worker remittances are Pakistan\u2019s single largest source of foreign exchange — typically exceeding goods export earnings. Over 9 million Pakistanis abroad (primarily in Gulf states, UK, and US) send money home through formal banking channels. Remittances directly support household consumption, reduce poverty, and stabilize the current account. Seasonal spikes occur during Ramadan/Eid and December holidays.':
    'بیرونِ ملک پاکستانیوں کی ترسیلاتِ زر زرِ مبادلہ کا سب سے بڑا واحد ذریعہ ہیں — عموماً اشیا کی برآمدی آمدنی سے بھی زیادہ۔ نوے لاکھ سے زائد بیرونِ ملک پاکستانی (بنیادی طور پر خلیجی ممالک، برطانیہ اور امریکہ میں) رسمی بینکاری ذرائع سے رقوم بھیجتے ہیں۔ یہ ترسیلات گھریلو صرف کو سہارا دیتی ہیں، غربت کم کرتی ہیں اور جاری کھاتے کو استحکام دیتی ہیں۔ رمضان/عید اور دسمبر میں موسمی اضافہ ہوتا ہے۔',
  'Monthly Remittances by Corridor': 'ماہانہ ترسیلات بلحاظ ملک',
  'Monthly workers\u2019 remittances split by SBP\u2019s published corridor buckets. SBP exposes major single-country corridors (Saudi Arabia, UAE, UK, USA), grouped Other GCC and EU buckets, plus the residual shown here as Other countries.':
    'اسٹیٹ بینک کی شائع کردہ درجہ بندی کے مطابق ماہانہ ترسیلاتِ زر۔ اسٹیٹ بینک بڑے ممالک (سعودی عرب، متحدہ عرب امارات، برطانیہ، امریکہ)، دیگر خلیجی ممالک اور یورپی یونین کے گروپ الگ ظاہر کرتا ہے؛ باقی رقم یہاں دیگر ممالک کے طور پر دکھائی گئی ہے۔',
  'Official SBP country/corridor buckets; Other countries is total remittances minus the published corridor buckets.':
    'اسٹیٹ بینک کی سرکاری درجہ بندی؛ دیگر ممالک = کل ترسیلات منہا شائع شدہ ممالک کی رقوم۔',
  'Monthly Total': 'ماہانہ مجموعہ',
  'Monthly remittance inflows in USD millions. Seasonal spikes typically occur during Ramadan, Eid, and the winter holiday period. Consistent growth reflects expanding diaspora and improved formal banking channels.':
    'ماہانہ ترسیلات بلحاظ ملین ڈالر۔ رمضان، عید اور سردیوں کی چھٹیوں میں عموماً اضافہ ہوتا ہے۔ مسلسل نمو بیرونِ ملک آبادی میں اضافے اور بہتر بینکاری ذرائع کی عکاسی کرتی ہے۔',
  'Source Countries (Last 12 Months)': 'بھیجنے والے ممالک (گزشتہ 12 ماہ)',
  'Remittances by source country over the trailing 12 months. Saudi Arabia and UAE together account for nearly half of all inflows, reflecting Pakistan\u2019s large workforce in GCC states. The UK and US are the leading Western corridors.':
    'گزشتہ بارہ ماہ کے دوران ترسیلات بلحاظ ملک۔ سعودی عرب اور متحدہ عرب امارات مل کر تقریباً نصف ترسیلات فراہم کرتے ہیں، جو خلیجی ممالک میں پاکستانی افرادی قوت کی بڑی تعداد ظاہر کرتا ہے۔ برطانیہ اور امریکہ مغرب کے سب سے بڑے ذرائع ہیں۔',

  // ===== FDI =====
  'Foreign Direct Investment': 'براہِ راست غیر ملکی سرمایہ کاری',
  'FDI measures long-term international investment into Pakistan. Unlike portfolio flows, FDI involves lasting ownership interest (≥10% stake) — bringing capital, technology transfer, and jobs. CPEC-era power and infrastructure projects drove FDI to $2.8B (FY2018), but declining since. Key concerns include high concentration in a few source countries, disinvestment in some sectors, and limited diversification beyond power and energy.':
    'براہِ راست غیر ملکی سرمایہ کاری پاکستان میں طویل مدتی بین الاقوامی سرمایہ کاری کی پیمائش کرتی ہے۔ پورٹ فولیو سرمایہ کاری کے برعکس اس میں مستقل ملکیت (10 فیصد یا زائد حصہ) شامل ہوتی ہے — جو سرمایہ، ٹیکنالوجی اور روزگار لاتی ہے۔ سی پیک دور کے بجلی اور بنیادی ڈھانچے کے منصوبوں نے اسے 2.8 ارب ڈالر (مالی سال 2018) تک پہنچایا، مگر اس کے بعد کمی آئی۔ بڑے خدشات میں چند ممالک پر انحصار، بعض شعبوں سے سرمائے کا انخلا اور بجلی و توانائی سے باہر محدود تنوع شامل ہیں۔',
  'Latest monthly FDI': 'تازہ ترین ماہانہ سرمایہ کاری',
  'Latest SBP FDI pulse': 'اسٹیٹ بینک کا تازہ ترین جائزہ',
  'Strongest FDI sector': 'سب سے مضبوط شعبہ',
  'Top FDI source country': 'سرِفہرست سرمایہ کار ملک',
  'FDI disinvestment watchlist': 'سرمائے کے انخلا کی فہرست',
  'Annual Net FDI': 'سالانہ خالص سرمایہ کاری',
  'Annual net FDI in USD millions by completed fiscal year.': 'مکمل مالی سال کے لحاظ سے سالانہ خالص سرمایہ کاری، ملین ڈالر میں۔',
  'Monthly Net FDI': 'ماہانہ خالص سرمایہ کاری',
  'Monthly net direct investment in Pakistan from SBP BPM6 data. Bars above zero show net inflows; bars below zero indicate disinvestment. The amber dashed line compares each month with the same month in the previous year.':
    'اسٹیٹ بینک کے BPM6 اعداد و شمار کے مطابق ماہانہ خالص براہِ راست سرمایہ کاری۔ صفر سے اوپر ستون خالص آمد اور نیچے ستون سرمائے کا انخلا ظاہر کرتے ہیں۔ عنبری نقطہ دار لکیر ہر مہینے کا موازنہ گزشتہ سال کے اسی مہینے سے کرتی ہے۔',
  'Latest Monthly FDI': 'تازہ ترین ماہانہ سرمایہ کاری',
  'FDI Inflow vs Outflow': 'سرمائے کی آمد بمقابلہ اخراج',
  'Gross FDI inflows (new capital entering) versus outflows (disinvestment, profit repatriation). Net FDI = Inflow − Outflow. High outflow years indicate existing investors extracting profits rather than reinvesting — a concern for long-term capital formation.':
    'مجموعی آمد (نیا سرمایہ) بمقابلہ اخراج (سرمائے کا انخلا، منافع کی واپسی)۔ خالص سرمایہ کاری = آمد منہا اخراج۔ زیادہ اخراج والے سال ظاہر کرتے ہیں کہ موجودہ سرمایہ کار دوبارہ سرمایہ کاری کے بجائے منافع نکال رہے ہیں — جو طویل مدتی سرمایہ سازی کے لیے تشویشناک ہے۔',
  'FDI by Sector': 'شعبہ وار سرمایہ کاری',
  'FDI by Country': 'ملک وار سرمایہ کاری',

  // ===== Services / IT =====
  'IT & Services Exports': 'آئی ٹی و خدمات کی برآمدات',
  'IT Export Momentum': 'آئی ٹی برآمدات کی رفتار',
  'Pakistan\u2019s services trade classified by EBOPS (Extended Balance of Payments Services). IT & Telecom is the fastest-growing segment, with computer services (software consultancy, freelancing, and software exports) driving growth. This section includes a month-by-month view of IT and freelance exports with year-on-year momentum. Data from SBP\u2019s Balance of Payments detail tables.':
    'پاکستان کی خدمات کی تجارت، EBOPS درجہ بندی کے مطابق۔ آئی ٹی و ٹیلی کام سب سے تیزی سے بڑھنے والا شعبہ ہے، جس میں کمپیوٹر خدمات (سافٹ ویئر کنسلٹنسی، فری لانسنگ اور سافٹ ویئر برآمدات) نمو کی بنیاد ہیں۔ اس حصے میں آئی ٹی اور فری لانس برآمدات کا ماہ بہ ماہ اور سال بہ سال جائزہ شامل ہے۔ اعداد و شمار اسٹیٹ بینک کی ادائیگیوں کے توازن کی تفصیلی جداول سے ہیں۔',
  'Monthly IT & Freelance Exports': 'ماہانہ آئی ٹی و فری لانس برآمدات',
  'Recent Monthly Performance': 'حالیہ ماہانہ کارکردگی',
  'Monthly services exports · Source: SBP': 'ماہانہ خدمات کی برآمدات · ماخذ: اسٹیٹ بینک',
  'Service Categories (Exports)': 'خدمات کے زمرے (برآمدات)',
  'IT & Telecom Breakdown': 'آئی ٹی و ٹیلی کام کی تفصیل',
  'Breakdown of IT & Telecom exports by sub-category. Computer services (software consultancy, freelance IT, software exports) are the dominant contributor.':
    'ذیلی زمروں کے لحاظ سے آئی ٹی و ٹیلی کام برآمدات کی تفصیل۔ کمپیوٹر خدمات (سافٹ ویئر کنسلٹنسی، فری لانس آئی ٹی، سافٹ ویئر برآمدات) سب سے بڑا حصہ ہیں۔',
  'Services Trade Balance': 'خدمات کا تجارتی توازن',
  'Credit (exports) vs Debit (imports) for top service categories. Green exceeding red = surplus. Transport shows a deficit due to high shipping costs.':
    'بڑے زمروں میں برآمدات بمقابلہ درآمدات۔ سبز کا سرخ سے زیادہ ہونا بچت ظاہر کرتا ہے۔ نقل و حمل میں زیادہ جہاز رانی لاگت کے باعث خسارہ ہے۔',

  // ===== Inflation =====
  Inflation: 'مہنگائی',
  'Inflation measured Year-over-Year (base year 2015–16). SBP\u2019s medium-term inflation target is 5–7%. The CPI is the primary policy target — when CPI exceeds the target, SBP raises the policy rate to cool demand. Food prices (40%+ of CPI basket) disproportionately affect lower-income households. SPI tracks weekly-priced essentials; WPI measures wholesale/producer prices and often leads CPI trends.':
    'مہنگائی سال بہ سال بنیاد پر (بنیادی سال 2015–16)۔ اسٹیٹ بینک کا درمیانی مدتی ہدف 5 تا 7 فیصد ہے۔ صارف قیمت اشاریہ (CPI) بنیادی پالیسی ہدف ہے — جب یہ ہدف سے تجاوز کرے تو اسٹیٹ بینک طلب کم کرنے کے لیے شرحِ سود بڑھاتا ہے۔ خوراک کی قیمتیں (CPI ٹوکری کا 40 فیصد سے زائد) کم آمدنی والے گھرانوں پر زیادہ اثر ڈالتی ہیں۔ SPI ہفتہ وار ضروری اشیا اور WPI تھوک قیمتوں کی پیمائش کرتا ہے جو اکثر CPI سے پہلے رجحان ظاہر کرتا ہے۔',
  'National CPI — Year-over-Year': 'قومی صارف قیمت اشاریہ — سال بہ سال',
  'Month-by-month headline inflation rate, measured against the same month a year earlier.':
    'ماہ بہ ماہ مہنگائی کی شرح، گزشتہ سال کے اسی مہینے کے مقابلے میں۔',
  'Urban vs Rural Inflation': 'شہری بمقابلہ دیہی مہنگائی',
  'Compares CPI inflation in urban and rural areas. Urban inflation tends to be slightly higher due to housing and energy costs, while rural inflation is more sensitive to food prices.':
    'شہری اور دیہی علاقوں میں مہنگائی کا موازنہ۔ رہائش اور توانائی کے اخراجات کے باعث شہری مہنگائی قدرے زیادہ رہتی ہے، جبکہ دیہی مہنگائی خوراک کی قیمتوں سے زیادہ متاثر ہوتی ہے۔',
  'Food vs Non-Food Inflation': 'خوراک بمقابلہ غیر خوراک مہنگائی',
  'Breaks down inflation by food and non-food categories for both urban and rural areas. Food inflation is a major driver of headline CPI in Pakistan, directly affecting household budgets.':
    'شہری و دیہی دونوں علاقوں میں خوراک اور غیر خوراک کے زمروں کے لحاظ سے مہنگائی۔ پاکستان میں خوراک کی مہنگائی مجموعی CPI کا بڑا محرک ہے اور گھریلو بجٹ پر براہِ راست اثر ڈالتی ہے۔',
  'CPI vs SPI vs WPI': 'CPI بمقابلہ SPI بمقابلہ WPI',
  'Compares three key price indices: CPI (consumer prices), SPI (weekly sensitive items like food/fuel), and WPI (wholesale prices). SPI tends to be more volatile as it tracks frequently-changing items.':
    'تین اہم قیمت اشاریوں کا موازنہ: CPI (صارف قیمتیں)، SPI (ہفتہ وار حساس اشیا جیسے خوراک و ایندھن) اور WPI (تھوک قیمتیں)۔ SPI زیادہ اتار چڑھاؤ دکھاتا ہے کیونکہ یہ تیزی سے بدلنے والی اشیا پر مبنی ہے۔',

  // ===== Monetary =====
  'Monetary & Financial Sector': 'زری و مالیاتی شعبہ',
  'Key monetary aggregates tracked by SBP. M2 (broad money) growth that exceeds nominal GDP growth is typically inflationary. Credit to private sector reflects business investment demand — when government \u2018crowds out\u2019 private borrowing through heavy deficit financing, private sector growth suffers. The widening gap between M2 and credit is a classic indicator of government fiscal dominance over monetary policy.':
    'اسٹیٹ بینک کے زیرِ نگرانی اہم زری اعداد۔ جب M2 (وسیع زر) کی نمو برائے نام GDP نمو سے زیادہ ہو تو عموماً مہنگائی بڑھتی ہے۔ نجی شعبے کو قرضہ کاروباری سرمایہ کاری کی طلب ظاہر کرتا ہے — جب حکومت بھاری خسارے کی مالی اعانت کے ذریعے نجی قرض لینے کی گنجائش کم کر دے تو نجی شعبے کی نمو متاثر ہوتی ہے۔ M2 اور قرضے کے درمیان بڑھتا فرق زری پالیسی پر حکومتی مالیاتی غلبے کی نمایاں علامت ہے۔',
  'M2 Money Supply Growth': 'M2 زری رسد میں اضافہ',
  'Year-over-year growth in broad money (M2). M2 includes currency in circulation, demand deposits, and time deposits. High M2 growth can be inflationary; SBP targets M2 growth consistent with GDP and inflation objectives.':
    'وسیع زر (M2) میں سال بہ سال اضافہ۔ M2 میں گردش میں کرنسی، طلبی کھاتے اور میعادی کھاتے شامل ہیں۔ زیادہ نمو مہنگائی کا سبب بن سکتی ہے؛ اسٹیٹ بینک اسے GDP اور مہنگائی کے اہداف سے ہم آہنگ رکھنے کی کوشش کرتا ہے۔',
  'Credit & Deposit Growth': 'قرضوں اور کھاتوں میں اضافہ',
  'YoY growth rates for private sector credit and bank deposits. Rising credit growth signals economic expansion and business confidence. Deposit growth reflects savings mobilization and banking sector health.':
    'نجی شعبے کے قرضوں اور بینک کھاتوں میں سال بہ سال اضافہ۔ قرضوں میں اضافہ معاشی پھیلاؤ اور کاروباری اعتماد ظاہر کرتا ہے۔ کھاتوں میں اضافہ بچتوں اور بینکاری شعبے کی صحت کی عکاسی کرتا ہے۔',
  'Monetary Aggregates': 'زری مجموعے',
  'Absolute levels of M2, private sector credit, and total bank deposits in PKR. The growing gap between M2 and credit reflects government borrowing absorbing a large share of money supply.':
    'M2، نجی شعبے کے قرضے اور کل بینک کھاتوں کی مقدار روپے میں۔ M2 اور قرضے کے درمیان بڑھتا فرق ظاہر کرتا ہے کہ حکومتی قرض گیری زری رسد کا بڑا حصہ جذب کر رہی ہے۔',

  // ===== Fiscal =====
  'Fiscal Overview': 'مالیاتی جائزہ',
  'Pakistan\u2019s fiscal health — GDP growth, government revenue, expenditure, and budget deficits. Pakistan\u2019s tax-to-GDP ratio is among the lowest in Asia, creating chronic revenue shortfalls, and the IMF program targets a positive primary balance (revenue minus non-interest spending) as a condition for continued support.':
    'پاکستان کی مالیاتی صحت — GDP نمو، حکومتی آمدنی، اخراجات اور بجٹ خسارہ۔ پاکستان کا ٹیکس اور GDP کا تناسب ایشیا میں کم ترین میں سے ہے، جس سے آمدنی کی مسلسل کمی رہتی ہے؛ آئی ایم ایف پروگرام مسلسل معاونت کی شرط کے طور پر مثبت بنیادی توازن (آمدنی منہا غیر سودی اخراجات) کا ہدف رکھتا ہے۔',
  'Fiscal Summary — Latest Available': 'مالیاتی خلاصہ — تازہ ترین دستیاب',
  'GDP Growth Rate': 'GDP نمو کی شرح',
  'Annual real GDP growth rate. Values below the zero line indicate economic contraction, as seen in FY2020 (COVID-19 pandemic) and FY2023 (political and economic crisis).':
    'سالانہ حقیقی GDP نمو۔ صفر سے نیچے اقدار معاشی سکڑاؤ ظاہر کرتی ہیں، جیسا کہ مالی سال 2020 (کووڈ-19) اور مالی سال 2023 (سیاسی و معاشی بحران) میں ہوا۔',
  'Revenue vs Expenditure': 'آمدنی بمقابلہ اخراجات',
  'Total government revenue vs total expenditure. The persistent gap between the two lines represents the fiscal deficit — a structural challenge Pakistan has faced for decades.':
    'کل حکومتی آمدنی بمقابلہ کل اخراجات۔ دونوں لکیروں کے درمیان مستقل فرق مالیاتی خسارہ ہے — ایک ساختی مسئلہ جس کا پاکستان کئی دہائیوں سے سامنا کر رہا ہے۔',
  'Revenue Breakdown — Tax vs Non-Tax': 'آمدنی کی تفصیل — ٹیکس بمقابلہ غیر ٹیکس',
  'Stacked composition of government revenue. Tax revenue (FBR collections) is the backbone of fiscal capacity. Non-tax revenue includes dividends, profits, and grants.':
    'حکومتی آمدنی کی ساخت۔ ٹیکس آمدنی (ایف بی آر وصولیاں) مالیاتی صلاحیت کی ریڑھ کی ہڈی ہے۔ غیر ٹیکس آمدنی میں منافع، حصص اور امداد شامل ہیں۔',
  'Fiscal & Primary Balance': 'مالیاتی و بنیادی توازن',
  'Fiscal balance (revenue minus total expenditure) and primary balance (fiscal balance excluding interest payments). A positive primary balance indicates the government can service debt from current revenue — a key IMF reform target.':
    'مالیاتی توازن (آمدنی منہا کل اخراجات) اور بنیادی توازن (سودی ادائیگیوں کے بغیر مالیاتی توازن)۔ مثبت بنیادی توازن ظاہر کرتا ہے کہ حکومت موجودہ آمدنی سے قرض ادا کر سکتی ہے — آئی ایم ایف اصلاحات کا اہم ہدف۔',

  // ===== FBR =====
  'FBR Tax Collection': 'ایف بی آر ٹیکس وصولی',
  'Federal tax collection reported by the Federal Board of Revenue (FBR), Pakistan\u2019s largest source of government revenue. Figures are net of refunds in PKR billion. Official FBR figures and secondary reports attributed to provisional FBR data are explicitly distinguished; missing months are never estimated or interpolated.':
    'فیڈرل بورڈ آف ریونیو (ایف بی آر) کی رپورٹ کردہ وفاقی ٹیکس وصولی، جو حکومتی آمدنی کا سب سے بڑا ذریعہ ہے۔ اعداد ریفنڈ منہا کرنے کے بعد ارب روپے میں ہیں۔ ایف بی آر کے سرکاری اعداد اور عارضی اعداد پر مبنی صحافتی رپورٹس کو الگ الگ ظاہر کیا گیا ہے؛ غائب مہینوں کا اندازہ کبھی نہیں لگایا جاتا۔',
  'Tax Targets vs Reported Collection': 'ٹیکس اہداف بمقابلہ رپورٹ شدہ وصولی',
  'Run-Rate Tracker — Is FBR On Pace?': 'رفتار کا جائزہ — کیا ایف بی آر ہدف پر ہے؟',
  'Monthly Net Collection vs Target': 'ماہانہ خالص وصولی بمقابلہ ہدف',
  'Collection by Tax Head': 'ٹیکس کی مد کے لحاظ سے وصولی',
  'Monthly net collection split across the four federal tax heads: Income/Direct Tax, Sales Tax, Federal Excise Duty (FED) and Customs Duty. Only months for which FBR published a complete four-way breakdown are shown.':
    'چار وفاقی مدات میں ماہانہ خالص وصولی: انکم/ڈائریکٹ ٹیکس، سیلز ٹیکس، فیڈرل ایکسائز ڈیوٹی اور کسٹمز ڈیوٹی۔ صرف وہ مہینے دکھائے گئے ہیں جن کی مکمل تفصیل ایف بی آر نے شائع کی۔',
  'Full-Year Collection by Fiscal Year': 'مالی سال کے لحاظ سے سالانہ وصولی',
  'Total net FBR collection for each completed fiscal year (July–June). Amber bars indicate a provisional full-year figure that has not yet been finalised in the FBR Year Book.':
    'ہر مکمل مالی سال (جولائی–جون) کی کل خالص وصولی۔ عنبری ستون ایسے عارضی سالانہ اعداد ظاہر کرتے ہیں جو ابھی ایف بی آر ایئر بک میں حتمی نہیں ہوئے۔',

  // ===== Budgets =====
  'Federal Budget': 'وفاقی بجٹ',
  'The Government of Pakistan\u2019s annual federal budget — total outlay, how money is raised (FBR taxes, non-tax revenue, borrowing), and how it is spent (debt servicing, defence, pensions, subsidies, development). Figures are the budgeted estimates from the Finance Division\u2019s \u2018Budget in Brief\u2019, in PKR billion. Pakistan\u2019s fiscal year runs July–June.':
    'حکومتِ پاکستان کا سالانہ وفاقی بجٹ — کل حجم، رقم کہاں سے آتی ہے (ایف بی آر ٹیکس، غیر ٹیکس آمدنی، قرض) اور کہاں خرچ ہوتی ہے (قرضوں کی ادائیگی، دفاع، پنشن، سبسڈی، ترقیاتی اخراجات)۔ اعداد وزارتِ خزانہ کی \u2018Budget in Brief\u2019 کے تخمینے ہیں، ارب روپے میں۔ مالی سال جولائی تا جون ہوتا ہے۔',
  'Fiscal year': 'مالی سال',
  'Where the Rupee Comes From': 'روپیہ کہاں سے آتا ہے',
  'Composition of gross federal revenue by source — FBR tax revenue versus non-tax revenue (SBP profits, petroleum levy, dividends and surcharges). The bulk of FBR collection is shared with the provinces under the NFC Award before the federal government spends what remains.':
    'وفاقی آمدنی کی ساخت — ایف بی آر ٹیکس آمدنی بمقابلہ غیر ٹیکس آمدنی (اسٹیٹ بینک منافع، پیٹرولیم لیوی، منافع و سرچارج)۔ ایف بی آر وصولی کا بڑا حصہ این ایف سی ایوارڈ کے تحت صوبوں کو منتقل ہوتا ہے، باقی وفاق خرچ کرتا ہے۔',
  'Where the Rupee Goes': 'روپیہ کہاں خرچ ہوتا ہے',
  'Composition of current (non-development) federal expenditure — markup/debt servicing, defence affairs, pensions, subsidies, grants and running of civil government — plus the development budget. The single largest line is almost always interest on debt.':
    'جاری (غیر ترقیاتی) وفاقی اخراجات کی ساخت — سود/قرضوں کی ادائیگی، دفاع، پنشن، سبسڈی، گرانٹس اور سول حکومت کے اخراجات — نیز ترقیاتی بجٹ۔ سب سے بڑی مد تقریباً ہمیشہ قرضوں کا سود ہوتی ہے۔',
  'This Year vs Last Year': 'امسال بمقابلہ گزشتہ سال',
  'Year-on-year comparison of the headline budget aggregates: total outlay, FBR tax target, development budget (PSDP) and the budgeted fiscal deficit, in PKR billion.':
    'بجٹ کے بڑے اعداد کا سال بہ سال موازنہ: کل حجم، ایف بی آر ٹیکس ہدف، ترقیاتی بجٹ (پی ایس ڈی پی) اور بجٹ خسارہ، ارب روپے میں۔',
  'Actual Spend & Revenue — This Year vs Last Year': 'حقیقی اخراجات و آمدنی — امسال بمقابلہ گزشتہ سال',
  'Realised federal fiscal aggregates compared with the same period a year earlier (PKR billion). A falling deficit and interest bill alongside a rising primary surplus indicates genuine consolidation; the % of GDP appears in the tooltip.':
    'حقیقی وفاقی مالیاتی اعداد کا گزشتہ سال کی اسی مدت سے موازنہ (ارب روپے)۔ خسارے اور سود میں کمی کے ساتھ بنیادی بچت میں اضافہ حقیقی مالیاتی استحکام ظاہر کرتا ہے؛ GDP کا تناسب ٹول ٹپ میں دکھایا گیا ہے۔',
  'Provincial Budgets': 'صوبائی بجٹ',
  'Annual budgets of Pakistan\u2019s four provinces — Punjab, Sindh, Khyber Pakhtunkhwa and Balochistan. Provinces receive the bulk of their resources as federal transfers under the NFC Award, raise their own taxes, and are expected to run cash surpluses to help the consolidated national fiscal position. Figures are budgeted estimates from each province\u2019s Finance Department White Paper, in PKR billion.':
    'پاکستان کے چاروں صوبوں — پنجاب، سندھ، خیبر پختونخوا اور بلوچستان — کے سالانہ بجٹ۔ صوبوں کے وسائل کا بڑا حصہ این ایف سی ایوارڈ کے تحت وفاقی منتقلی سے آتا ہے، وہ اپنے ٹیکس بھی وصول کرتے ہیں اور اُن سے توقع کی جاتی ہے کہ وہ مجموعی قومی مالیاتی پوزیشن بہتر بنانے کے لیے بچت دکھائیں۔ اعداد ہر صوبے کے محکمہ خزانہ کے وائٹ پیپر کے تخمینے ہیں، ارب روپے میں۔',
  'Federal NFC Transfers by Province': 'صوبہ وار وفاقی این ایف سی منتقلی',
  'Provinces Compared — Outlay, Development & Transfers': 'صوبوں کا موازنہ — بجٹ حجم، ترقیاتی پروگرام اور منتقلی',
  'Total budget outlay, development (Annual Development Programme) allocation and federal transfers for each province in the selected fiscal year, in PKR billion. Only provinces whose budget for this year could be independently sourced show bars; blanks are data we deliberately did not estimate.':
    'منتخب مالی سال میں ہر صوبے کا کل بجٹ حجم، ترقیاتی پروگرام کی رقم اور وفاقی منتقلی، ارب روپے میں۔ صرف اُن صوبوں کے ستون دکھائے گئے ہیں جن کا بجٹ آزادانہ ذریعے سے تصدیق شدہ ہے؛ خالی جگہیں وہ اعداد ہیں جن کا ہم نے دانستہ اندازہ نہیں لگایا۔',
  'Cash Surplus Delivered by Province': 'صوبہ وار حاصل شدہ نقد بچت',
  Province: 'صوبہ',
  'Computed from the figures shown. Note: the scope of provincial ADP varies (some provinces quote total development including foreign-funded and federal PSDP), so development-share comparisons are indicative.':
    'دکھائے گئے اعداد سے شمار کیا گیا۔ نوٹ: صوبائی ترقیاتی پروگرام کا دائرہ مختلف ہوتا ہے (بعض صوبے غیر ملکی معاونت اور وفاقی پی ایس ڈی پی سمیت کل ترقیاتی رقم بتاتے ہیں)، اس لیے موازنہ محض اشاراتی ہے۔',

  // ===== Insights =====
  'Building macro risk scorecard from verified data…': 'تصدیق شدہ اعداد سے خطرات کا اسکور کارڈ تیار کیا جا رہا ہے…',
  'Macro Risk Scorecard': 'معاشی خطرات کا اسکور کارڈ',
  'A compact risk dashboard built only from verified dashboard datasets. It labels pressure points without adding estimates or unpublished figures.':
    'صرف تصدیق شدہ اعداد پر مبنی مختصر خطرات کا خلاصہ۔ یہ دباؤ کے نکات کی نشاندہی کرتا ہے، کوئی اندازہ یا غیر شائع شدہ عدد شامل نہیں کرتا۔',
  'Loading IMF compliance tracker…': 'آئی ایم ایف اہداف کا جائزہ لوڈ ہو رہا ہے…',
  'IMF Program Compliance Tracker': 'آئی ایم ایف پروگرام اہداف کا جائزہ',
  'Verified IMF-program scorecard plus live watch items from official dashboard data. Items marked watch are not declared met or missed unless the source data supports that label.':
    'تصدیق شدہ آئی ایم ایف پروگرام اسکور کارڈ اور سرکاری اعداد سے اخذ کردہ زیرِ نظر نکات۔ زیرِ نظر نکات کو پورا یا ناکام قرار نہیں دیا جاتا جب تک ماخذ اعداد اس کی تائید نہ کریں۔',
  'Loading external financing wall…': 'بیرونی ادائیگیوں کا خاکہ لوڈ ہو رہا ہے…',
  'External Financing Wall': 'بیرونی ادائیگیوں کا بوجھ',
  'A source-backed view of the repayment wall, expected rollovers, hard-cash burden, and reserve cushion. FY27 is shown only as a public range because detailed maturities are not fully public.':
    'ماخذ سے تصدیق شدہ جائزہ: قرض ادائیگیوں کا بوجھ، متوقع تجدید، نقد ادائیگی اور ذخائر کا سہارا۔ مالی سال 2027 صرف ایک عوامی حد کے طور پر دکھایا گیا ہے کیونکہ تفصیلی ادائیگیاں مکمل طور پر عوامی نہیں۔',
  'Writing verified Good / Bad / Watch brief…': 'تصدیق شدہ بہتر / خراب / زیرِ نظر خلاصہ تیار کیا جا رہا ہے…',
  'Good / Bad / Watch Brief': 'بہتر / خراب / زیرِ نظر خلاصہ',
  'A rule-based monthly brief from verified dashboard data. It intentionally avoids adding unverified claims, forecasts, or figures not present in source-backed datasets.':
    'تصدیق شدہ اعداد پر مبنی ماہانہ خلاصہ۔ اس میں دانستہ طور پر غیر تصدیق شدہ دعوے، پیش گوئیاں یا ایسے اعداد شامل نہیں کیے جاتے جو ماخذ میں موجود نہ ہوں۔',
  'Loading revenue target meter…': 'محصولات کے ہدف کا میٹر لوڈ ہو رہا ہے…',
  'Revenue Target Meter': 'محصولات کے ہدف کا میٹر',
  'Available FBR collections and explicitly labeled budget estimates versus official targets. Missing official actuals are not inferred.':
    'دستیاب ایف بی آر وصولیاں اور واضح طور پر نشان زد بجٹ تخمینے، سرکاری اہداف کے مقابلے میں۔ غائب سرکاری اعداد کا اندازہ نہیں لگایا جاتا۔',
  'FYTD pace': 'مالی سال تا حال رفتار',
  'FY26 budget target gap': 'مالی سال 2026 بجٹ ہدف کا فرق',
  'FY26 revised target gap': 'مالی سال 2026 نظرثانی شدہ ہدف کا فرق',
  'FY27 required uplift': 'مالی سال 2027 کے لیے مطلوبہ اضافہ',
  'FY26 actual vs budget target': 'مالی سال 2026 حقیقی بمقابلہ بجٹ ہدف',
  'Loading IT export deep dive…': 'آئی ٹی برآمدات کا تفصیلی جائزہ لوڈ ہو رہا ہے…',
  'IT Export Deep Dive': 'آئی ٹی برآمدات کا تفصیلی جائزہ',
  'A focused view of monthly IT & Telecom exports from SBP’s headline services table, with formal freelance receipts and computer-services composition from the detailed EBOPS release.':
    'اسٹیٹ بینک کی خدمات کی مرکزی جدول سے ماہانہ آئی ٹی و ٹیلی کام برآمدات، اور تفصیلی EBOPS اجرا سے رسمی فری لانس وصولیوں اور کمپیوٹر خدمات کی ساخت کا مرکوز جائزہ۔',
  'Latest IT & Telecom exports': 'تازہ ترین آئی ٹی و ٹیلی کام برآمدات',
  'Latest Freelance IT exports': 'تازہ ترین فری لانس آئی ٹی برآمدات',
  'Software consultancy': 'سافٹ ویئر کنسلٹنسی',
  'Computer software exports': 'کمپیوٹر سافٹ ویئر برآمدات',
  'Building the latest official-data briefing…': 'تازہ ترین سرکاری اعداد پر مبنی خلاصہ تیار کیا جا رہا ہے…',
  'Monthly Economic Briefing': 'ماہانہ معاشی خلاصہ',
  'A plain-English briefing generated from the same source-attributed datasets that power the dashboard. It highlights what changed, why it matters, and which source backs each statement.':
    'انہی ماخذ سے منسوب اعداد سے تیار کردہ سادہ خلاصہ جو اس ڈیش بورڈ کی بنیاد ہیں۔ یہ بتاتا ہے کہ کیا بدلا، کیوں اہم ہے، اور ہر بات کے پیچھے کون سا ماخذ ہے۔',
  'Loading World Bank peer data…': 'ورلڈ بینک کے تقابلی اعداد لوڈ ہو رہے ہیں…',
  'Pakistan vs Peer Economies': 'پاکستان بمقابلہ دیگر معیشتیں',
  'Annual peer-country comparisons from the World Bank\u2019s official World Development Indicators. The latest available official year can vary by indicator and country.':
    'ورلڈ بینک کے سرکاری World Development Indicators سے سالانہ تقابلی اعداد۔ تازہ ترین دستیاب سال ہر اشاریے اور ملک کے لحاظ سے مختلف ہو سکتا ہے۔',
  'Peer comparison metric': 'تقابلی پیمانہ',
  'Assembling risk, household, and trend-watch panels…': 'خطرات، گھریلو اثرات اور رجحانات کے پینل تیار کیے جا رہے ہیں…',
  'Risk, Outlook & Household Impact': 'خطرات، پیش منظر اور گھریلو اثرات',
  'Source-backed panels that connect macro indicators to fiscal pressure, external vulnerability, and everyday household impact. Forward-looking labels are trend math only, not forecasts.':
    'ماخذ سے تصدیق شدہ پینل جو معاشی اشاریوں کو مالیاتی دباؤ، بیرونی کمزوری اور روزمرہ گھریلو اثرات سے جوڑتے ہیں۔ مستقبل سے متعلق عنوانات محض رجحان کا حساب ہیں، پیش گوئی نہیں۔',
  'Loading official economic timeline…': 'سرکاری معاشی واقعات لوڈ ہو رہے ہیں…',
  'Official Economic Timeline': 'سرکاری معاشی واقعات',
  'Context markers for charts and indicators. Events are included only when tied to an official or primary institutional source.':
    'چارٹس اور اشاریوں کے لیے سیاق و سباق۔ صرف وہی واقعات شامل ہیں جو کسی سرکاری یا بنیادی ادارہ جاتی ماخذ سے منسلک ہوں۔',
  'Loading learning center…': 'سیکھنے کا مرکز لوڈ ہو رہا ہے…',
  'Learning Center & Glossary': 'سیکھنے کا مرکز و لغت',
  'Plain-English explainers for the dashboard\u2019s core macroeconomic concepts, with official methodology links for deeper reading.':
    'ڈیش بورڈ کے بنیادی معاشی تصورات کی سادہ وضاحت، مزید مطالعے کے لیے سرکاری طریقہ کار کے روابط کے ساتھ۔',
  'Source Confidence & Audit Trail': 'ذرائع کی ساکھ اور تصدیقی سلسلہ',
  'Not every number on this dashboard carries the same weight. This page states, dataset by dataset, whether a figure comes straight from the issuing institution, is derived here from official inputs, or is currently only available through press reporting of official figures.':
    'اس ڈیش بورڈ کا ہر عدد یکساں وزن نہیں رکھتا۔ یہ صفحہ ہر ڈیٹا سیٹ کے بارے میں بتاتا ہے کہ عدد براہِ راست متعلقہ ادارے سے آیا ہے، یہاں سرکاری اعداد سے اخذ کیا گیا ہے، یا فی الحال صرف صحافتی رپورٹنگ کے ذریعے دستیاب ہے۔',
  'Official APIs': 'سرکاری اے پی آئی',
  'Official files': 'سرکاری فائلیں',
  'Curated official documents': 'منتخب سرکاری دستاویزات',
  'Critical datasets': 'اہم ڈیٹا سیٹس',

  // ===== Feedback & API =====
  Feedback: 'رائے',
  'Send corrections, source links, missing indicators, or suggestions for improving the dashboard.':
    'تصحیح، ماخذ کے روابط، غائب اشاریے یا ڈیش بورڈ کی بہتری کے لیے تجاویز بھیجیں۔',
  'Download the Data & API': 'ڈیٹا ڈاؤن لوڈ اور اے پی آئی',
  'Every dataset behind these charts is published as JSON and CSV at a stable URL. No API key, no rate limit, no scraping. Each endpoint carries the issuing institution, its trust tier and the latest observation it contains, so a downloaded file can always be traced back to the official release it came from.':
    'ان چارٹس کے پیچھے موجود ہر ڈیٹا سیٹ مستقل ویب پتے پر JSON اور CSV کی صورت میں دستیاب ہے۔ نہ کوئی کلید، نہ حد، نہ اسکریپنگ کی ضرورت۔ ہر اینڈ پوائنٹ کے ساتھ جاری کرنے والا ادارہ، اس کی ساکھ کا درجہ اور تازہ ترین مدت درج ہے، تاکہ ڈاؤن لوڈ کی گئی فائل ہمیشہ اپنی سرکاری اشاعت تک واپس جوڑی جا سکے۔',

  // ===== Shared controls & momentum labels =====
  MoM: 'ماہانہ',
  YoY: 'سالانہ',
  'Expand tile': 'خانہ بڑا کریں',
  'Close expanded tile': 'بڑا خانہ بند کریں',
  'The Good, the Bad & the Ugly': 'بہتر، خراب اور تشویشناک',
  // ===== Inline labels, tiles, badges & table headers =====
  'State Bank of Pakistan': 'اسٹیٹ بینک آف پاکستان',
  'Pakistan Bureau of Statistics': 'ادارہ شماریات پاکستان',
  'Ministry of Finance': 'وزارتِ خزانہ',
  'Federal Board of Revenue': 'فیڈرل بورڈ آف ریونیو',
  'Board of Investment': 'بورڈ آف انویسٹمنٹ',
  'IMF Pakistan': 'آئی ایم ایف پاکستان',
  'Current stock': 'موجودہ مجموعی رقم',
  'Year-on-year': 'سالانہ تبدیلی',
  'FYTD buildup': 'مالی سال میں اب تک اضافہ',
  'Reform levers': 'اصلاحاتی اقدامات',
  Institution: 'ادارہ',
  Document: 'دستاویز',
  Sheet: 'شیٹ',
  Location: 'مقام',
  Derivation: 'طریقۂ اخذ',
  Status: 'حیثیت',
  Retrieved: 'حاصل کردہ',
  Cadence: 'وقفہ',
  Exports: 'برآمدات',
  Imports: 'درآمدات',
  Open: 'کھولیں',
  Dataset: 'ڈیٹا سیٹ',
  Trust: 'ساکھ',
  Latest: 'تازہ ترین',
  Rows: 'قطاریں',
  'Review note:': 'جائزہ نوٹ:',
  'Source file:': 'ماخذ فائل:',
  'API series:': 'اے پی آئی سلسلے:',
  'Loading source audit…': 'ذرائع کا جائزہ لوڈ ہو رہا ہے…',
  'FY26 gross repayment': 'مالی سال 26 کی مجموعی ادائیگی',
  'Expected rollovers': 'متوقع رول اوور',
  'Hard-cash outflow': 'نقد اخراج',
  'Total external debt': 'کل بیرونی قرض',
  'Net FDI': 'خالص براہِ راست غیر ملکی سرمایہ کاری',
  'Equity & reinvested earnings': 'ایکویٹی اور دوبارہ سرمایہ کاری شدہ منافع',
  'Debt instruments': 'قرض کے آلات',
  'Same month last year': 'گزشتہ سال کا یہی مہینہ',
  'Gross inflow': 'مجموعی آمد',
  Outflow: 'اخراج',
  'YoY change': 'سالانہ تبدیلی',
  Sector: 'شعبہ',
  Inflow: 'آمد',
  'Strongest sector': 'سب سے مضبوط شعبہ',
  Country: 'ملک',
  'Share of named positive inflows': 'نامزد مثبت آمد میں حصہ',
  'Prior period': 'گزشتہ مدت',
  'Top source country': 'سب سے بڑا ماخذ ملک',
  'Largest country outflow': 'سب سے بڑا ملکی اخراج',
  'Largest sector outflow': 'سب سے بڑا شعبہ جاتی اخراج',
  Watchlist: 'زیرِ نظر فہرست',
  'Disinvestment pockets': 'سرمایہ نکالنے والے شعبے',
  'No budget data available.': 'بجٹ کے اعداد و شمار دستیاب نہیں۔',
  'No provincial budget data available.': 'صوبائی بجٹ کے اعداد و شمار دستیاب نہیں۔',
  'Budget Execution': 'بجٹ پر عملدرآمد',
  'Year-to-date actuals': 'سال کے آغاز سے اب تک کے حقیقی اعداد',
  'How the government is actually performing against the budget it proposed. These are realised fiscal-operations figures (not budget estimates), so you can judge promises against delivery.':
    'حکومت اپنے پیش کردہ بجٹ کے مقابلے میں دراصل کیسی کارکردگی دکھا رہی ہے۔ یہ حقیقی مالیاتی کارروائیوں کے اعداد ہیں (بجٹ تخمینے نہیں)، تاکہ وعدوں اور عملدرآمد کا موازنہ کیا جا سکے۔',
  'Please include the chart or tracker name and a source link when reporting data issues.':
    'ڈیٹا سے متعلق مسئلہ بتاتے وقت براہِ کرم متعلقہ چارٹ یا ٹریکر کا نام اور ماخذ کا لنک شامل کریں۔',
  'Total Program': 'کل پروگرام',
  Disbursed: 'ادا شدہ',
  Remaining: 'باقی',
  Next: 'اگلا',
  'RSF amount is tracked separately from the EFF progress bar.':
    'آر ایس ایف کی رقم ای ایف ایف کی پیش رفت سے الگ شمار کی جاتی ہے۔',
  'Performance vs IMF Conditions': 'آئی ایم ایف شرائط کے مقابلے میں کارکردگی',
  'Related IMF Facility': 'متعلقہ آئی ایم ایف سہولت',
  'Key Program Objectives': 'پروگرام کے اہم اہداف',
  'Official data': 'سرکاری اعداد و شمار',
  'Rows are omitted automatically if a verified source value is missing.':
    'اگر تصدیق شدہ سرکاری قدر دستیاب نہ ہو تو متعلقہ قطار خود بخود چھوڑ دی جاتی ہے۔',
  'IMF-published scorecard': 'آئی ایم ایف کا شائع کردہ اسکور کارڈ',
  'Live watch items': 'زیرِ نظر امور',
  'FY26 repayment split': 'مالی سال 26 کی ادائیگیوں کی تقسیم',
  'No verified item currently qualifies.': 'فی الحال کوئی تصدیق شدہ شے اس معیار پر پوری نہیں اترتی۔',
  'Monthly IT and freelance export receipts': 'ماہانہ آئی ٹی اور فری لانس برآمدی وصولیاں',
  Value: 'قدر',
  'Official year': 'سرکاری سال',
  'Fiscal stress monitor': 'مالیاتی دباؤ کا جائزہ',
  'Fiscal balance': 'مالیاتی توازن',
  'FBR target gap': 'ایف بی آر ہدف میں فرق',
  'Public debt': 'سرکاری قرض',
  'Power circular debt': 'بجلی کا گردشی قرضہ',
  'External vulnerability scorecard': 'بیرونی کمزوری کا اسکور کارڈ',
  'Import cover': 'درآمدی کوریج',
  'SBP reserves': 'اسٹیٹ بینک کے ذخائر',
  'FY26 gross external repayment': 'مالی سال 26 کی مجموعی بیرونی ادائیگی',
  'Hard-cash repayment': 'نقد ادائیگی',
  'Latest trade deficit': 'تازہ ترین تجارتی خسارہ',
  'Household impact view': 'گھریلو اثرات کا جائزہ',
  'CPI inflation': 'صارف قیمت اشاریہ مہنگائی',
  'Inflation momentum': 'مہنگائی کی رفتار',
  'Policy rate': 'پالیسی شرح',
  'Petrol price': 'پٹرول کی قیمت',
  'Trend watch, not a forecast': 'رجحان کا جائزہ، پیش گوئی نہیں',
  'Remittances vs 3-month average': 'ترسیلات بمقابلہ 3 ماہ کی اوسط',
  'Trade balance vs 3-month average': 'تجارتی توازن بمقابلہ 3 ماہ کی اوسط',
  'Inflation direction': 'مہنگائی کا رخ',
  'Tax collection vs FYTD target': 'محصولات بمقابلہ مالی سال کا ہدف',
  'How to read it:': 'اسے کیسے پڑھیں:',
  'Latest value': 'تازہ ترین قدر',
  Period: 'مدت',
  Change: 'تبدیلی',
  'Compared with': 'موازنہ',
  Context: 'سیاق',
  Source: 'ماخذ',
  'Current rate': 'موجودہ شرح',
  'Real policy rate': 'حقیقی پالیسی شرح',
  'Last decision': 'آخری فیصلہ',
  'Next MPC decision': 'اگلا زری پالیسی فیصلہ',
  'IMF reserves target': 'آئی ایم ایف کا ذخائر ہدف',
  'What\'s driving the rebuild': 'ذخائر میں اضافے کے اسباب',
  'Each figure links to its official source': 'ہر عدد اپنے سرکاری ماخذ سے منسلک ہے',
  'Loading endpoint index…': 'اینڈ پوائنٹ فہرست لوڈ ہو رہی ہے…',
  'The static API has not been generated for this build. Run':
    'اس بلڈ کے لیے جامد اے پی آئی تیار نہیں کی گئی۔ چلائیں',
  'Individual charts also carry a': 'ہر چارٹ پر ایک',
  'button that exports exactly the series drawn on screen.':
    'بٹن بھی موجود ہے جو اسکرین پر دکھائی گئی سیریز بعینہٖ برآمد کرتا ہے۔',
  Generated: 'تیار شدہ',
  'Copy this URL:': 'یہ ویب پتہ کاپی کریں:',
  'Official primary': 'بنیادی سرکاری',
  'Derived on this dashboard': 'اسی ڈیش بورڈ پر اخذ کردہ',
  'Secondary reporting': 'ثانوی ذریعہ',
  Official: 'سرکاری',
  Derived: 'اخذ کردہ',
  'Press-sourced': 'اخباری ذریعہ',
  Light: 'روشن',
  System: 'سسٹم',
  Dark: 'تاریک',
  'The Good': 'بہتر پہلو',
  'The Bad': 'خراب پہلو',
  'The Ugly': 'تشویشناک پہلو',
  'Editorial · opinion, not official data': 'ادارتی رائے · سرکاری اعداد و شمار نہیں',
  Good: 'بہتر',
  Watch: 'زیرِ نظر',
  Total: 'کل',
  'Monthly Avg': 'ماہانہ اوسط',
  'CY Change': 'کیلنڈر سال میں تبدیلی',
  'FYTD Change': 'مالی سال میں اب تک تبدیلی',
  'Lowest in Period': 'مدت میں کم ترین',
  'Total (SBP + Banks)': 'کل (اسٹیٹ بینک + بینک)',
  'SBP Reserves': 'اسٹیٹ بینک کے ذخائر',
  'Total Remittances': 'کل ترسیلاتِ زر',
  'Gross Inflow': 'مجموعی آمد',
  'Total outlay': 'کل اخراجات',
  'FBR tax target': 'ایف بی آر محصولات کا ہدف',
  'Fiscal deficit': 'مالیاتی خسارہ',
  'Development (PSDP)': 'ترقیاتی پروگرام (پی ایس ڈی پی)',
  'Development (ADP)': 'ترقیاتی پروگرام (اے ڈی پی)',
  'Development share': 'ترقیاتی حصہ',
  'Federal transfers': 'وفاقی منتقلیاں',
  'Federal NFC transfer': 'این ایف سی کے تحت وفاقی منتقلی',
  'Own-source tax': 'اپنے وسائل سے محصولات',
  'Fiscal autonomy': 'مالیاتی خود انحصاری',
  'Budget per person': 'فی کس بجٹ',
  'Surplus / (deficit)': 'بچت / (خسارہ)',
  'Cash surplus delivered': 'فراہم کردہ نقد بچت',
  'Combined surplus delivered': 'مجموعی فراہم کردہ بچت',
  'Full-year IMF target': 'پورے سال کا آئی ایم ایف ہدف',
  'Target met?': 'ہدف پورا ہوا؟',
  Targets: 'اہداف',
  Allocation: 'مختص رقم',
  Outlay: 'اخراجات',
  Deficit: 'خسارہ',
  'Debt servicing': 'قرض کی ادائیگی',
  'Interest (markup) paid': 'ادا شدہ سود (مارک اپ)',
  'Prior year (9M)': 'گزشتہ سال (9 ماہ)',
  'This year (9M)': 'رواں سال (9 ماہ)',
  'Net collection': 'خالص وصولی',
  'Net collection (full FY)': 'خالص وصولی (پورا مالی سال)',
  'Budget target': 'بجٹ ہدف',
  'Revised target': 'نظرثانی شدہ ہدف',
  'Actual / stated estimate': 'حقیقی / بیان کردہ تخمینہ',
  'Required run-rate (period target)': 'درکار رفتار (مدت کا ہدف)',
  'Actual collected': 'حقیقی وصولی',
  'Prior year (same period)': 'گزشتہ سال (اسی مدت)',
  'Latest month vs target': 'تازہ ترین ماہ بمقابلہ ہدف',
  'FYTD vs target': 'مالی سال میں اب تک بمقابلہ ہدف',
  'Broad Money (M2)': 'وسیع زر (ایم 2)',
  'M2 Growth': 'ایم 2 میں اضافہ',
  'Private Credit': 'نجی شعبے کا قرض',
  'Bank Deposits': 'بینک ڈپازٹس',
  'National CPI': 'قومی صارف قیمت اشاریہ',
  'Urban CPI': 'شہری صارف قیمت اشاریہ',
  'Rural CPI': 'دیہی صارف قیمت اشاریہ',
  'Total Services Credit': 'کل خدماتی آمدن',
  'Services Net Balance': 'خدمات کا خالص توازن',
  'IT & Telecom Credit': 'آئی ٹی و ٹیلی کام آمدن',
  'Computer Services': 'کمپیوٹر خدمات',
  'External buffer': 'بیرونی سہارا',
  'Remittance support': 'ترسیلات کا سہارا',
  'Trade gap': 'تجارتی فرق',
  'Inflation pulse': 'مہنگائی کی صورتحال',
  'Tax target pressure': 'محصولات کے ہدف کا دباؤ',
  'FBR FY26 collection': 'ایف بی آر مالی سال 26 وصولی',
  'FY27 tax effort': 'مالی سال 27 محصولاتی کوشش',
  'Import-cover buffer': 'درآمدی کوریج کا سہارا',
  'Inflation vs target': 'مہنگائی بمقابلہ ہدف',
  'Gross FY26 servicing': 'مالی سال 26 کی مجموعی ادائیگی',
  'Rollover dependency': 'رول اوور پر انحصار',
  'Hard-cash burden': 'نقد ادائیگی کا بوجھ',
  'Reserve cushion': 'ذخائر کا سہارا',
  'Primary balance': 'بنیادی توازن',

  // ===== Source coverage notes =====
  "This is the latest period SBP has published in its EBOPS services table. SBP releases this table after the monthly trade and reserves data, so it can lag the rest of the dashboard by a month. The headline totals at the top of this section come from the Balance of Payments summary, which SBP publishes one release earlier.":
    "یہ تازہ ترین مدت ہے جو اسٹیٹ بینک نے اپنے EBOPS خدمات کے جدول میں شائع کی ہے۔ اسٹیٹ بینک یہ جدول ماہانہ تجارت اور ذخائر کے اعداد و شمار کے بعد جاری کرتا ہے، اس لیے یہ بقیہ ڈیش بورڈ سے ایک ماہ پیچھے ہو سکتا ہے۔ اس حصے کے شروع میں دیے گئے مجموعے ادائیگی واجبات کے خلاصے سے لیے گئے ہیں، جو اسٹیٹ بینک ایک اشاعت پہلے جاری کرتا ہے۔",
  "This is the latest period SBP has published in its country-level trade tables. They are released after the headline monthly trade figures, so this chart can stop one month short of the totals above.":
    "یہ تازہ ترین مدت ہے جو اسٹیٹ بینک نے ملک وار تجارتی جدول میں شائع کی ہے۔ یہ جدول ماہانہ مجموعی تجارتی اعداد کے بعد جاری ہوتے ہیں، اس لیے یہ چارٹ اوپر دیے گئے مجموعوں سے ایک ماہ پیچھے رہ سکتا ہے۔",

  // ===== BOP services headline =====
  'Exports of services (credit)': 'خدمات کی برآمدات (کریڈٹ)',
  'Imports of services (debit)': 'خدمات کی درآمدات (ڈیبٹ)',
  'Balance on trade in services': 'خدمات کے تجارتی توازن کا خلاصہ',

    // ===== Loading / error labels =====
    'Loading circular debt tracker…': 'سرکلر ڈیٹ ٹریکر لوڈ ہو رہا ہے…',
    'Could not load circular debt tracker': 'سرکلر ڈیٹ ٹریکر لوڈ نہیں ہو سکا',
    'Loading country trends…': 'ملکی رجحانات لوڈ ہو رہے ہیں…',
    'Could not load country trends': 'ملکی رجحانات لوڈ نہیں ہو سکے',
    'Could not load source audit': 'ماخذ آڈٹ لوڈ نہیں ہو سکا',
    'Something went wrong in this section': 'اس حصے میں کچھ غلط ہو گیا',
    'Loading exchange rates…': 'زرِ مبادلہ کی شرحیں لوڈ ہو رہی ہیں…',
    'Could not load exchange rates': 'زرِ مبادلہ کی شرحیں لوڈ نہیں ہو سکیں',
    'Loading external debt tracker…': 'بیرونی قرض ٹریکر لوڈ ہو رہا ہے…',
    'Could not load external debt tracker': 'بیرونی قرض ٹریکر لوڈ نہیں ہو سکا',
    'Loading FBR tax data…': 'ایف بی آر ٹیکس ڈیٹا لوڈ ہو رہا ہے…',
    'Could not load FBR tax data': 'ایف بی آر ٹیکس ڈیٹا لوڈ نہیں ہو سکا',
    'Loading FDI data…': 'ایف ڈی آئی ڈیٹا لوڈ ہو رہا ہے…',
    'Could not load FDI data': 'ایف ڈی آئی ڈیٹا لوڈ نہیں ہو سکا',
    'Loading federal budget…': 'وفاقی بجٹ لوڈ ہو رہا ہے…',
    'Could not load federal budget': 'وفاقی بجٹ لوڈ نہیں ہو سکا',
    'Loading fiscal data…': 'مالیاتی ڈیٹا لوڈ ہو رہا ہے…',
    'Could not load fiscal data': 'مالیاتی ڈیٹا لوڈ نہیں ہو سکا',
    'Loading IMF tracker…': 'آئی ایم ایف ٹریکر لوڈ ہو رہا ہے…',
    'Could not load IMF tracker': 'آئی ایم ایف ٹریکر لوڈ نہیں ہو سکا',
    'Loading inflation data…': 'مہنگائی کا ڈیٹا لوڈ ہو رہا ہے…',
    'Could not load inflation data': 'مہنگائی کا ڈیٹا لوڈ نہیں ہو سکا',
    'Revenue target meter': 'محصولاتی ہدف میٹر',
    'IT export deep dive': 'آئی ٹی برآمدات کی تفصیل',
    'Peer comparison': 'ہم مرتبہ ممالک کا موازنہ',
    'Economic timeline': 'معاشی ٹائم لائن',
    'Learning center': 'تعلیمی مرکز',
    'Loading source trust audit…': 'ماخذ اعتبار آڈٹ لوڈ ہو رہا ہے…',
    'Source trust': 'ماخذ اعتبار',
    'Loading overview…': 'جائزہ لوڈ ہو رہا ہے…',
    'Could not load economic overview': 'معاشی جائزہ لوڈ نہیں ہو سکا',
    'Loading monetary policy tracker…': 'زری پالیسی ٹریکر لوڈ ہو رہا ہے…',
    'Could not load monetary policy tracker': 'زری پالیسی ٹریکر لوڈ نہیں ہو سکا',
    'Loading monetary data…': 'زری ڈیٹا لوڈ ہو رہا ہے…',
    'Could not load monetary data': 'زری ڈیٹا لوڈ نہیں ہو سکا',
    'Loading provincial budgets…': 'صوبائی بجٹ لوڈ ہو رہے ہیں…',
    'Could not load provincial budgets': 'صوبائی بجٹ لوڈ نہیں ہو سکے',
    'Could not load release calendar': 'اشاعت شیڈول لوڈ نہیں ہو سکا',
    'Loading remittances…': 'ترسیلات لوڈ ہو رہی ہیں…',
    'Could not load remittances': 'ترسیلات لوڈ نہیں ہو سکیں',
    'Loading reserves adequacy…': 'ذخائر کی کفایت لوڈ ہو رہی ہے…',
    'Could not load reserves adequacy': 'ذخائر کی کفایت لوڈ نہیں ہو سکی',
    'Loading reserves data…': 'ذخائر کا ڈیٹا لوڈ ہو رہا ہے…',
    'Could not load reserves data': 'ذخائر کا ڈیٹا لوڈ نہیں ہو سکا',
    'Loading services data…': 'خدمات کا ڈیٹا لوڈ ہو رہا ہے…',
    'Could not load services data': 'خدمات کا ڈیٹا لوڈ نہیں ہو سکا',
    'Loading snapshot…': 'اسنیپ شاٹ لوڈ ہو رہا ہے…',
    'Could not load snapshot': 'اسنیپ شاٹ لوڈ نہیں ہو سکا',
    'Loading trade data…': 'تجارتی ڈیٹا لوڈ ہو رہا ہے…',
    'Could not load trade data': 'تجارتی ڈیٹا لوڈ نہیں ہو سکا',

    // ===== Export pack =====
    'Export pack & printable briefing': 'ایکسپورٹ پیک اور پرنٹ ایبل بریفنگ',
    'Download a ZIP of headline CSVs and source JSON, or open a one-page briefing you can print to PDF.':
      'اہم CSV اور ماخذ JSON کا ZIP ڈاؤن لوڈ کریں، یا ایک صفحے کی بریفنگ کھولیں جسے پی ڈی ایف میں پرنٹ کر سکتے ہیں۔',
    'Download data pack (ZIP)': 'ڈیٹا پیک ڈاؤن لوڈ کریں (ZIP)',
    'Open printable briefing': 'پرنٹ ایبل بریفنگ کھولیں',
    'Critical series RSS': 'اہم سلسلوں کی آر ایس ایس',

    // ===== Overview polish (P2) =====
    'Reserves': 'ذخائر',
    'CPI': 'سی پی آئی',
    'FBR FYTD': 'ایف بی آر مالی سال تا حال',
    'Trade balance': 'تجارتی توازن',
    'Remittances': 'ترسیلات زر',
    'What moved': 'کیا بدلا',
    'Your watchlist': 'آپ کی واچ لسٹ',
    'Page not found': 'صفحہ نہیں ملا',
    'Back to overview': 'جائزے پر واپس',
    'All series': 'تمام سیریز',
    'IT & Telecom': 'آئی ٹی اور ٹیلی کام',
    'Freelance IT': 'فری لانس آئی ٹی',
    'Citation': 'حوالہ',
  };

  export default stringsUr;
