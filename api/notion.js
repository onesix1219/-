export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const apiKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_DB_ID;

  if (!apiKey || !dbId) {
    return res.status(500).json({ error: 'Missing environment variables' });
  }

  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ page_size: 100 })
    });

    const data = await response.json();

    const rows = data.results.map(page => {
      const props = page.properties;
      return {
        학교: props['학교']?.title?.[0]?.plain_text || '',
        년도: props['년도']?.number || 0,
        학년: props['학년']?.select?.name || '',
        학기: props['학기']?.select?.name || '',
        '중간/기말': props['중간/기말']?.select?.name || '',
        '1등급컷': props['1등급컷']?.number || 0,
        '2등급컷': props['2등급컷']?.number || 0,
        '분석지 이미지 링크': props['분석지 이미지 링크']?.url || '',
        '기출 분석지 원본 링크': props['기출 분석지 원본 링크']?.url || ''
      };
    });

    res.status(200).json({ rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
