<div dir="rtl">

# showmi-scraper

אוסף את לוחות ההופעות של התיאטראות (הצגות, תמונות, תיאורים, תאריכים ושעות)
לתוך Supabase, ומשם האפליקציה showmi קוראת אותם. רץ ב־GitHub Actions פעמיים ביום.

```
אתר התיאטרון ──adapter──▶ ScrapedShow[] ──בדיקות שפיות──▶ Supabase ──▶ האפליקציה
```

| תיאטרון | מצב | מקור הנתונים |
|---------|-----|---------------|
| הבימה | ✅ האדפטר כתוב, צריך הרצת dry run ראשונה מול האתר האמיתי | עמודי ההצגות (`/shows/<slug>/`) |
| בית ליסין | ⏳ | דף הבית מציג כל מופע עם מספר ההזמנה שלו |
| הקאמרי | ⏳ | הלוח נטען ב־AJAX, צריך לאתר את הבקשה ב־DevTools |

## הקמה ראשונית

1. **מסד נתונים**: בלוח הבקרה של Supabase, לפתוח את SQL Editor, להדביק ולהריץ את
   `../supabase/migrations/0001_catalog.sql` (או להריץ `supabase db push` עם ה־CLI).
2. **התקנה**: `cd scraper && npm install`
3. **הרצת ניסיון** (לא צריך מסד נתונים): `npm run scrape:dry -- --theater habima`.
   אחר כך לפתוח את `out/habima.json` ולהשוות לאתר: שמות, תיאורים, תאריכים,
   הפרדה בין שחקנים ליוצרים, ותמונות.
4. **הרצה אמיתית**: להעתיק את `.env.example` ל־`.env`, למלא את הערכים ולהריץ
   `npm run scrape:local -- --theater habima`
5. **תזמון**: ב־GitHub, להיכנס ל־Settings → Secrets and variables → Actions ולהוסיף
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` ו־`SCRAPER_CONTACT`. אחר כך
   Actions → "Scrape theater schedules" → Run workflow, כדי להריץ פעם אחת ידנית.

המפתח `service-role` עוקף את הרשאות ה־RLS. הוא נשמר רק ב־GitHub Secrets
וב־`.env` המקומי, ולעולם לא נכנס לאפליקציה. האפליקציה משתמשת במפתח `anon`.

## כשמשהו נשבר

- **הריצה נכשלת עם הודעת `sanity: …`**: הפרסר מצא הרבה פחות מבפעם הקודמת, ולכן
  שום דבר לא נכתב והאפליקציה ממשיכה להציג את הנתונים של אתמול. צריך להריץ dry run
  מקומית, להשוות לאתר ולתקן את האדפטר. הדגל `--force` כותב בכל זאת.
- **להצגה אין קטגוריות**: ה־`genreLabel` שלה לא התאים לאף מילת מפתח. צריך להוסיף
  מילה ב־`src/lib/categories.ts`.

## הוספת תיאטרון

1. ליצור קובץ `src/adapters/<theater>.ts` שמייצא `Adapter` ומחזיר
   `ScrapedShow[]` (המבנה מוגדר ב־`src/types.ts`).
2. להשאיר את הפרסור בפונקציות טהורות שמקבלות HTML או JSON, כדי שאפשר יהיה לבדוק
   אותן מול קובץ שמור.
3. לרשום את האדפטר במערך `ADAPTERS` ב־`src/index.ts`.

## בדיקות

מריצים `npm test`. הפיקסצ'ר של הבימה הוא **סינתטי**: הטקסט אמיתי, אבל מבנה
ה־HTML הוא ניחוש. אחרי שהרצת ה־dry run עובדת, כדאי לשמור עמוד אמיתי במקומו:

```
curl -s "https://www.habima.co.il/shows/<slug>/" > test/fixtures/habima-show.html
```

## לצד אפליקציית Expo

הסקרייפר הוא חבילת npm נפרדת, והאפליקציה אף פעם לא מייבאת ממנו. כדי שכלי
האפליקציה יתעלמו ממנו, צריך להוסיף `"scraper"` ל־`exclude` ב־`tsconfig.json`
שבשורש, ואת `scraper/**` לרשימת ההתעלמויות בהגדרות ה־ESLint שבשורש.

</div>
