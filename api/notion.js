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
        '1등급컷': props['1등급컷']?.number ?? null,
        '2등급컷': props['2등급컷']?.number ?? null,
        '분석지 이미지 링크': props['분석지 이미지 링크']?.url || '',
        '기출 분석지 원본 링크': props['기출 분석지 원본 링크']?.url || '',
        // 문제 유형
        '객관식': props['객관식']?.number || 0,
        '서술형': props['서술형']?.number || 0,
        '단답형': props['단답형']?.number || 0,
        // 난이도
        '난이도_하': props['난이도_하']?.number || 0,
        '난이도_중하': props['난이도_중하']?.number || 0,
        '난이도_중': props['난이도_중']?.number || 0,
        '난이도_중상': props['난이도_중상']?.number || 0,
        '난이도_상': props['난이도_상']?.number || 0,
        '난이도_최상': props['난이도_최상']?.number || 0,
        // 연계 출처
        '연계_교과서': props['연계_교과서']?.number || 0,
        '연계_학교프린트': props['연계_학교프린트']?.number || 0,
        '연계_부교재': props['연계_부교재']?.number || 0,
        '연계_비연계': props['연계_비연계']?.number || 0,
      };
    });

    res.status(200).json({ rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
